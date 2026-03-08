import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	getAllKnownIngredients,
	createKnownIngredient,
	updateKnownIngredient,
	deleteKnownIngredient,
	getUserWeightPreference,
	setUserWeightPreference
} from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	const [ingredients, weightPreference] = await Promise.all([
		getAllKnownIngredients(),
		getUserWeightPreference(locals.user.id)
	]);
	return { ingredients, weightPreference };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const category = (data.get('category') as string)?.trim() || '';
		const densityStr = data.get('density') as string;
		const caloriesStr = data.get('calories') as string;

		if (!name) return fail(400, { error: 'Name is required' });

		const density = densityStr ? parseFloat(densityStr) : null;
		const calories = caloriesStr ? parseFloat(caloriesStr) : null;

		if (density !== null && isNaN(density)) return fail(400, { error: 'Invalid density value' });
		if (calories !== null && isNaN(calories)) return fail(400, { error: 'Invalid calories value' });

		const preferredUnit = (data.get('preferred_unit') as string)?.trim() || '';

		await createKnownIngredient(name, category, density, calories, preferredUnit);
		return { success: true };
	},

	update: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const data = await request.formData();
		const id = data.get('id') as string;
		const name = (data.get('name') as string)?.trim();
		const category = (data.get('category') as string)?.trim() || '';
		const densityStr = data.get('density') as string;
		const caloriesStr = data.get('calories') as string;
		const preferredUnit = (data.get('preferred_unit') as string)?.trim() || '';

		if (!id || !name) return fail(400, { error: 'ID and name are required' });

		const density = densityStr ? parseFloat(densityStr) : null;
		const calories = caloriesStr ? parseFloat(caloriesStr) : null;

		if (density !== null && isNaN(density)) return fail(400, { error: 'Invalid density value' });
		if (calories !== null && isNaN(calories)) return fail(400, { error: 'Invalid calories value' });

		await updateKnownIngredient(id, name, category, density, calories, preferredUnit);
		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const data = await request.formData();
		const id = data.get('id') as string;
		if (!id) return fail(400, { error: 'ID is required' });

		await deleteKnownIngredient(id);
		return { success: true };
	},

	setWeightPreference: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const data = await request.formData();
		const pref = (data.get('weight_preference') as string)?.trim();
		if (pref !== 'g' && pref !== 'oz') return fail(400, { error: 'Invalid weight preference' });
		await setUserWeightPreference(locals.user.id, pref);
		return { success: true };
	}
};
