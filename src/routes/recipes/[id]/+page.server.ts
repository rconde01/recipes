import { redirect, fail, error } from '@sveltejs/kit';
import { getRecipesByUser, getRecipeById, updateRecipe, deleteRecipe } from '$lib/server/db';
import type { RecipeExtras } from '$lib/server/db';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const recipe = await getRecipeById(params.id, locals.user.id);
	if (!recipe) {
		error(404, 'Recipe not found');
	}

	const recipes = await getRecipesByUser(locals.user.id);

	return {
		recipe: {
			...recipe,
			ingredients: JSON.parse(recipe.ingredients) as string[],
			instructions: JSON.parse(recipe.instructions) as string[]
		},
		recipes
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
