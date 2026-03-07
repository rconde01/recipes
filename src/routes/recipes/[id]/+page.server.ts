import { redirect, fail, error } from '@sveltejs/kit';
import {
	getRecipesByUser, getRecipeById, updateRecipe, deleteRecipe,
	getRecipeIngredients, setRecipeIngredients, getAllKnownIngredients,
	getUserIngredientOverride
} from '$lib/server/db';
import type { RecipeExtras } from '$lib/server/db';
import { parseAndMatchIngredient } from '$lib/server/ingredient-parser';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const recipe = await getRecipeById(params.id, locals.user.id);
	if (!recipe) {
		error(404, 'Recipe not found');
	}

	const [recipes, recipeIngredients, knownIngredients] = await Promise.all([
		getRecipesByUser(locals.user.id),
		getRecipeIngredients(params.id),
		getAllKnownIngredients()
	]);

	// Build a map of known ingredient id -> name + density
	const knownMap = Object.fromEntries(
		knownIngredients.map((ki) => [ki.id, { name: ki.canonical_name, density_g_per_cup: ki.density_g_per_cup, category: ki.category }])
	);

	// Enrich parsed ingredients with known ingredient info and user overrides
	const enrichedIngredients = await Promise.all(
		recipeIngredients.map(async (ri) => {
			let known_name: string | null = null;
			let density_g_per_cup: number | null = null;
			let user_override = false;
			if (ri.known_ingredient_id && knownMap[ri.known_ingredient_id]) {
				const ki = knownMap[ri.known_ingredient_id];
				known_name = ki.name;
				density_g_per_cup = ki.density_g_per_cup;
				// Check user override
				const override = await getUserIngredientOverride(locals.user!.id, ri.known_ingredient_id);
				if (override?.density_g_per_cup != null) {
					density_g_per_cup = override.density_g_per_cup;
					user_override = true;
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
				user_override
			};
		})
	);

	return {
		recipe: {
			...recipe,
			ingredients: JSON.parse(recipe.ingredients) as string[],
			instructions: JSON.parse(recipe.instructions) as string[]
		},
		recipes,
		parsedIngredients: enrichedIngredients
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

		const extras: RecipeExtras = {
			source_url: formData.get('source_url')?.toString().trim() ?? '',
			prep_time: formData.get('prep_time')?.toString().trim() ?? '',
			cook_time: formData.get('cook_time')?.toString().trim() ?? '',
			total_time: formData.get('total_time')?.toString().trim() ?? '',
			yield: formData.get('yield')?.toString().trim() ?? '',
			category: formData.get('category')?.toString().trim() ?? '',
			cuisine: formData.get('cuisine')?.toString().trim() ?? '',
			image_url: formData.get('image_url')?.toString().trim() ?? ''
		};

		await updateRecipe(params.id, locals.user.id, title, description, ingredients, instructions, extras);

		// Re-parse and match ingredients
		const parsedIngredients = await Promise.all(
			ingredients.map((raw) => parseAndMatchIngredient(raw))
		);
		await setRecipeIngredients(params.id, parsedIngredients);

		return { success: true };
	},

	delete: async ({ params, locals }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		await deleteRecipe(params.id, locals.user.id);
		redirect(303, '/recipes');
	}
};
