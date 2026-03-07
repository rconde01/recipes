import { redirect, fail } from '@sveltejs/kit';
import { getRecipesByUser, createRecipe, deleteRecipe } from '$lib/server/db';
import { parseRecipeFromUrl } from '$lib/server/recipe-parser';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const recipes = await getRecipesByUser(locals.user.id);
	return { recipes };
};

export const actions: Actions = {
	create: async ({ locals }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		const recipe = await createRecipe(
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

		await deleteRecipe(id, locals.user.id);
		redirect(303, '/recipes');
	},

	import: async ({ request, locals }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		const formData = await request.formData();
		const url = formData.get('url')?.toString().trim() ?? '';

		if (!url) {
			return fail(400, { error: 'URL is required.' });
		}

		try {
			new URL(url);
		} catch {
			return fail(400, { error: 'Please enter a valid URL.' });
		}

		try {
			const parsed = await parseRecipeFromUrl(url);
			const recipe = await createRecipe(
				locals.user.id,
				parsed.title,
				parsed.description,
				parsed.ingredients,
				parsed.instructions,
				parsed.extras
			);
			redirect(303, `/recipes/${recipe.id}`);
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && 'location' in err) throw err;
			const message = err instanceof Error ? err.message : 'Failed to import recipe.';
			return fail(400, { error: message });
		}
	}
};
