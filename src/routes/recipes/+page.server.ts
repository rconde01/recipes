import { redirect, fail } from '@sveltejs/kit';
import { getRecipesByUser, createRecipe, deleteRecipe } from '$lib/server/db';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const recipes = getRecipesByUser(locals.user.id);
	return { recipes };
};

export const actions: Actions = {
	create: async ({ locals }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		const recipe = createRecipe(
			locals.user.id,
			'Untitled Recipe',
			'',
			[''],
			['']
		);

		redirect(303, `/recipes/${recipe.id}`);
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		const formData = await request.formData();
		const id = formData.get('id')?.toString() ?? '';

		if (!id) {
			return fail(400, { error: 'Recipe ID is required.' });
		}

		deleteRecipe(id, locals.user.id);
		redirect(303, '/recipes');
	}
};
