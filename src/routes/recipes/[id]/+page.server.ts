import { redirect, fail, error } from '@sveltejs/kit';
import {
	getRecipesByUser, getRecipeById, updateRecipe, deleteRecipe,
	getRecipeIngredients, setRecipeIngredients, getRecipeSteps, setRecipeSteps,
	getAllKnownIngredients, getUserIngredientOverride, updateRecipeType,
	getUserWeightPreference
} from '$lib/server/db';
import type { RecipeExtras } from '$lib/server/db';
import { parseAndMatchIngredient } from '$lib/server/ingredient-parser';
import { analyzeStepsSmart } from '$lib/server/step-analyzer';
import { getSubstitutions } from '$lib/substitutions';
import { categorizeIngredient, mapDbCategory } from '$lib/ingredient-categories';
import type { IngredientCategory } from '$lib/ingredient-categories';
import { scaleRecipeSmart } from '$lib/server/recipe-scaler-ai';
import { categorizeRecipeSmart, RECIPE_TYPE_LABELS, RECIPE_TYPE_COLORS } from '$lib/server/recipe-categorizer';
import type { RecipeType } from '$lib/server/recipe-categorizer';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const recipe = await getRecipeById(params.id, locals.user.id);
	if (!recipe) {
		error(404, 'Recipe not found');
	}

	const [recipes, recipeIngredients, knownIngredients, recipeSteps, weightPreference] = await Promise.all([
		getRecipesByUser(locals.user.id),
		getRecipeIngredients(params.id),
		getAllKnownIngredients(),
		getRecipeSteps(params.id),
		getUserWeightPreference(locals.user.id)
	]);

	// Build a map of known ingredient id -> name + density
	const knownMap = Object.fromEntries(
		knownIngredients.map((ki) => [ki.id, { name: ki.canonical_name, density_g_per_cup: ki.density_g_per_cup, category: ki.category, preferred_unit: ki.preferred_unit }])
	);

	// Enrich parsed ingredients with known ingredient info and user overrides
	const enrichedIngredients = await Promise.all(
		recipeIngredients.map(async (ri) => {
			let known_name: string | null = null;
			let density_g_per_cup: number | null = null;
			let preferred_unit = '';
			let user_override = false;
			if (ri.known_ingredient_id && knownMap[ri.known_ingredient_id]) {
				const ki = knownMap[ri.known_ingredient_id];
				known_name = ki.name;
				density_g_per_cup = ki.density_g_per_cup;
				preferred_unit = ki.preferred_unit;
				// Check user override
				const override = await getUserIngredientOverride(locals.user!.id, ri.known_ingredient_id);
				if (override?.density_g_per_cup != null) {
					density_g_per_cup = override.density_g_per_cup;
					user_override = true;
				}
			}
			// Look up substitutions using known name or parsed name
			const subLookupName = known_name ?? ri.name;
			const substitutions = subLookupName ? getSubstitutions(subLookupName) : [];

			// Categorize: use DB category if matched, otherwise infer from name
			let foodCategory: IngredientCategory = 'other';
			if (ri.known_ingredient_id && knownMap[ri.known_ingredient_id]) {
				foodCategory = mapDbCategory(knownMap[ri.known_ingredient_id].category);
			}
			// If DB gave us 'other' or ingredient wasn't matched, try name-based categorization
			if (foodCategory === 'other') {
				foodCategory = categorizeIngredient(ri.name || ri.raw_text);
			}

			// Find first step that mentions this ingredient
			// Try multiple search terms: full parsed name, known name, and the
			// last significant word (e.g. "flour" from "all-purpose flour")
			const candidates = new Set<string>();
			for (const raw of [ri.name, known_name]) {
				if (!raw) continue;
				const lower = raw.toLowerCase().trim();
				if (lower.length >= 3) candidates.add(lower);
				// Also add each individual word (handles "vanilla extract" → "vanilla",
				// "all-purpose flour" → "flour", etc.)
				const words = lower.split(/\s+/);
				if (words.length > 1) {
					for (const word of words) {
						if (word.length >= 3) candidates.add(word);
					}
				}
			}
			let firstUsedInStep = -1;
			if (candidates.size > 0) {
				const instructions = JSON.parse(recipe.instructions) as string[];
				for (let si = 0; si < instructions.length; si++) {
					const stepLower = instructions[si].toLowerCase();
					for (const term of candidates) {
						if (stepLower.includes(term)) {
							firstUsedInStep = si;
							break;
						}
					}
					if (firstUsedInStep >= 0) break;
				}
			}

			return {
				raw_text: ri.raw_text,
				quantity: ri.quantity,
				unit: ri.unit,
				name: ri.name,
				known_ingredient_id: ri.known_ingredient_id,
				known_name,
				density_g_per_cup,
				preferred_unit,
				user_override,
				substitutions,
				foodCategory,
				firstUsedInStep
			};
		})
	);

	// Auto-categorize recipe type if not set
	const recipeIngredientsList = JSON.parse(recipe.ingredients) as string[];
	const recipeInstructionsList = JSON.parse(recipe.instructions) as string[];
	let recipeType = recipe.recipe_type as RecipeType || '';
	if (!recipeType) {
		recipeType = await categorizeRecipeSmart(
			recipe.title,
			recipeIngredientsList,
			recipeInstructionsList,
			recipe.category
		);
		// Persist the auto-categorized type
		await updateRecipeType(params.id, locals.user!.id, recipeType);
	}

	// Parse step data
	const timelineSteps = recipeSteps.map((step) => ({
		position: step.position,
		raw_text: step.raw_text,
		duration_minutes: step.duration_minutes,
		is_passive: step.is_passive === 1,
		equipment: JSON.parse(step.equipment) as string[],
		ingredients: JSON.parse(step.ingredients) as string[],
		techniques: JSON.parse(step.techniques) as string[],
	}));

	return {
		recipe: {
			...recipe,
			ingredients: JSON.parse(recipe.ingredients) as string[],
			instructions: JSON.parse(recipe.instructions) as string[]
		},
		recipes,
		parsedIngredients: enrichedIngredients,
		timelineSteps,
		weightPreference,
		recipeType: recipeType as RecipeType,
		recipeTypeLabel: RECIPE_TYPE_LABELS[recipeType as RecipeType] ?? recipeType,
		recipeTypeColor: RECIPE_TYPE_COLORS[recipeType as RecipeType] ?? '#757575',
		allRecipeTypes: Object.entries(RECIPE_TYPE_LABELS).map(([value, label]) => ({ value, label }))
	} as const;
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		const formData = await request.formData();
		const title = formData.get('title')?.toString().trim() ?? '';
		const description = formData.get('description')?.toString().trim() ?? '';
		const ingredientsRaw = formData.getAll('ingredients').map((v) => v.toString().trim());
		const instructionsRaw = formData.getAll('instructions').map((v) => v.toString().trim());

		if (!title) {
			return fail(400, { error: 'Title is required.' });
		}

		const ingredients = ingredientsRaw.filter((i) => i.length > 0);
		const instructions = instructionsRaw.filter((i) => i.length > 0);

		// Determine recipe type: use user-selected if provided, else re-categorize
		let recipeType = formData.get('recipe_type')?.toString().trim() ?? '';
		if (!recipeType) {
			recipeType = await categorizeRecipeSmart(title, ingredients, instructions,
				formData.get('category')?.toString().trim() ?? '');
		}

		const extras: RecipeExtras = {
			source_url: formData.get('source_url')?.toString().trim() ?? '',
			prep_time: formData.get('prep_time')?.toString().trim() ?? '',
			cook_time: formData.get('cook_time')?.toString().trim() ?? '',
			total_time: formData.get('total_time')?.toString().trim() ?? '',
			yield: formData.get('yield')?.toString().trim() ?? '',
			category: formData.get('category')?.toString().trim() ?? '',
			cuisine: formData.get('cuisine')?.toString().trim() ?? '',
			image_url: formData.get('image_url')?.toString().trim() ?? '',
			recipe_type: recipeType
		};

		await updateRecipe(params.id, locals.user.id, title, description, ingredients, instructions, extras);

		// Re-parse and match ingredients
		const parsedIngredients = await Promise.all(
			ingredients.map((raw) => parseAndMatchIngredient(raw))
		);
		await setRecipeIngredients(params.id, parsedIngredients);

		// Re-analyze steps for timeline
		const analyzedSteps = await analyzeStepsSmart(instructions, ingredients);
		await setRecipeSteps(params.id, analyzedSteps);

		return { success: true };
	},

	scale: async ({ request, params, locals }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		const formData = await request.formData();
		const factor = parseFloat(formData.get('scale_factor')?.toString() ?? '1');

		if (isNaN(factor) || factor <= 0 || factor > 100) {
			return fail(400, { error: 'Invalid scale factor.' });
		}

		const recipe = await getRecipeById(params.id, locals.user.id);
		if (!recipe) {
			return fail(404, { error: 'Recipe not found.' });
		}

		const ingredients = JSON.parse(recipe.ingredients) as string[];
		const instructions = JSON.parse(recipe.instructions) as string[];

		const result = await scaleRecipeSmart(ingredients, instructions, factor, recipe.yield);

		return {
			scaled: {
				ingredients: result.ingredients.map((si) => si.scaled),
				instructions: result.instructions,
				factor: result.scaleFactor,
			}
		};
	},

	delete: async ({ params, locals }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		await deleteRecipe(params.id, locals.user.id);
		redirect(303, '/recipes');
	}
};
