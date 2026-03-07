import { redirect } from '@sveltejs/kit';
import { getRecipesByUser, getRecipeIngredients, getAllKnownIngredients, getUserIngredientOverride } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const recipes = await getRecipesByUser(locals.user.id);

	// Get selected recipe IDs from query params
	const selectedIds = url.searchParams.getAll('recipe');

	if (selectedIds.length === 0) {
		return { recipes, selectedIds: [] as string[], aggregatedIngredients: [] as AggregatedItem[], listName: '' };
	}

	const listName = url.searchParams.get('listName') || 'Grocery List';

	// Fetch parsed ingredients for all selected recipes
	const knownIngredients = await getAllKnownIngredients();
	const knownMap = Object.fromEntries(
		knownIngredients.map((ki) => [ki.id, ki])
	);

	interface RawItem {
		raw_text: string;
		quantity: number | null;
		unit: string;
		name: string;
		known_ingredient_id: string | null;
	}

	const allItems: RawItem[] = [];
	for (const recipeId of selectedIds) {
		const items = await getRecipeIngredients(recipeId);
		allItems.push(...items);
	}

	// Aggregate: group by (known_ingredient_id OR raw name) + unit
	const aggregation = new Map<string, {
		name: string;
		known_ingredient_id: string | null;
		unit: string;
		quantity: number;
		category: string;
		density_g_per_cup: number | null;
		raw_items: string[];
	}>();

	for (const item of allItems) {
		// Use known ingredient ID as key if matched, otherwise use cleaned name
		const nameKey = item.known_ingredient_id ?? item.name.toLowerCase();
		const key = `${nameKey}::${item.unit}`;

		const existing = aggregation.get(key);
		if (existing) {
			existing.quantity += item.quantity ?? 0;
			if (!existing.raw_items.includes(item.raw_text)) {
				existing.raw_items.push(item.raw_text);
			}
		} else {
			let displayName = item.name;
			let category = '';
			let density: number | null = null;

			if (item.known_ingredient_id && knownMap[item.known_ingredient_id]) {
				const ki = knownMap[item.known_ingredient_id];
				displayName = ki.canonical_name;
				category = ki.category;
				density = ki.density_g_per_cup;

				// Check user override
				const override = await getUserIngredientOverride(locals.user!.id, item.known_ingredient_id);
				if (override?.density_g_per_cup != null) {
					density = override.density_g_per_cup;
				}
			}

			aggregation.set(key, {
				name: displayName,
				known_ingredient_id: item.known_ingredient_id,
				unit: item.unit,
				quantity: item.quantity ?? 0,
				category,
				density_g_per_cup: density,
				raw_items: [item.raw_text]
			});
		}
	}

	// Sort by category then name
	const aggregatedIngredients = [...aggregation.values()]
		.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

	return { recipes, selectedIds, aggregatedIngredients, listName };
};

interface AggregatedItem {
	name: string;
	known_ingredient_id: string | null;
	unit: string;
	quantity: number;
	category: string;
	density_g_per_cup: number | null;
	raw_items: string[];
}
