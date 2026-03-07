import { redirect } from '@sveltejs/kit';
import { getRecipesByUser, getRecipeSteps } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const recipes = await getRecipesByUser(locals.user.id);
	const selectedIds = url.searchParams.getAll('recipe');

	if (selectedIds.length === 0) {
		return {
			recipes,
			selectedIds: [] as string[],
			selectedRecipes: [] as { id: string; title: string; steps: StepData[] }[]
		};
	}

	// Load steps for selected recipes
	const selectedRecipes: { id: string; title: string; steps: StepData[] }[] = [];
	for (const recipeId of selectedIds) {
		const recipe = recipes.find((r) => r.id === recipeId);
		if (!recipe) continue;

		const steps = await getRecipeSteps(recipeId);
		selectedRecipes.push({
			id: recipe.id,
			title: recipe.title,
			steps: steps.map((s) => ({
				raw_text: s.raw_text,
				duration_minutes: s.duration_minutes,
				is_passive: s.is_passive === 1,
				equipment: JSON.parse(s.equipment) as string[],
				ingredients: JSON.parse(s.ingredients) as string[],
				techniques: JSON.parse(s.techniques) as string[],
			}))
		});
	}

	return { recipes, selectedIds, selectedRecipes };
};

interface StepData {
	raw_text: string;
	duration_minutes: number;
	is_passive: boolean;
	equipment: string[];
	ingredients: string[];
	techniques: string[];
}
