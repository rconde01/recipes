import type { RecipeExtras } from './db';

interface ParsedRecipe {
	title: string;
	description: string;
	ingredients: string[];
	instructions: string[];
	extras: RecipeExtras;
}

function extractJsonLd(html: string): unknown[] {
	const results: unknown[] = [];
	const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	let match;
	while ((match = regex.exec(html)) !== null) {
		try {
			const parsed = JSON.parse(match[1]);
			if (Array.isArray(parsed)) {
				results.push(...parsed);
			} else {
				results.push(parsed);
			}
		} catch {
			// Invalid JSON, skip
		}
	}
	return results;
}

function findRecipeInGraph(obj: unknown): Record<string, unknown> | null {
	if (!obj || typeof obj !== 'object') return null;
	const record = obj as Record<string, unknown>;

	// Check if this object itself is a Recipe
	const type = record['@type'];
	if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
		return record;
	}

	// Check @graph array
	if (Array.isArray(record['@graph'])) {
		for (const item of record['@graph']) {
			const found = findRecipeInGraph(item);
			if (found) return found;
		}
	}

	return null;
}

function parseInstructions(instructions: unknown): string[] {
	if (!instructions) return [];
	if (typeof instructions === 'string') return [instructions];
	if (!Array.isArray(instructions)) return [];

	const result: string[] = [];
	for (const item of instructions) {
		if (typeof item === 'string') {
			result.push(item);
		} else if (item && typeof item === 'object') {
			const obj = item as Record<string, unknown>;
			if (obj['@type'] === 'HowToStep' && typeof obj.text === 'string') {
				result.push(obj.text);
			} else if (obj['@type'] === 'HowToSection' && Array.isArray(obj.itemListElement)) {
				result.push(...parseInstructions(obj.itemListElement));
			}
		}
	}
	return result;
}

function parseIngredients(ingredients: unknown): string[] {
	if (!ingredients) return [];
	if (!Array.isArray(ingredients)) return [];
	return ingredients.filter((i): i is string => typeof i === 'string');
}

function str(val: unknown): string {
	if (typeof val === 'string') return val;
	if (Array.isArray(val)) return val.filter((v) => typeof v === 'string').join(', ');
	return '';
}

function parseYield(val: unknown): string {
	if (typeof val === 'string') return val;
	if (Array.isArray(val)) {
		// Prefer the most descriptive entry (e.g. "8 servings" over "8")
		const strings = val.filter((v): v is string => typeof v === 'string');
		const descriptive = strings.find((s) => /[a-zA-Z]/.test(s));
		return descriptive || strings[0] || '';
	}
	if (typeof val === 'number') return `${val} servings`;
	return '';
}

function parseImage(val: unknown): string {
	if (typeof val === 'string') return val;
	if (Array.isArray(val) && val.length > 0) return parseImage(val[0]);
	if (val && typeof val === 'object' && 'url' in val) return str((val as Record<string, unknown>).url);
	return '';
}

export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe> {
	const response = await fetch(url, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
			'Accept': 'text/html'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
	}

	const html = await response.text();
	const jsonLdItems = extractJsonLd(html);

	let recipe: Record<string, unknown> | null = null;
	for (const item of jsonLdItems) {
		recipe = findRecipeInGraph(item);
		if (recipe) break;
	}

	if (!recipe) {
		throw new Error('No recipe found on this page. The page must contain structured recipe data (JSON-LD).');
	}

	return {
		title: str(recipe.name) || 'Imported Recipe',
		description: str(recipe.description),
		ingredients: parseIngredients(recipe.recipeIngredient),
		instructions: parseInstructions(recipe.recipeInstructions),
		extras: {
			source_url: url,
			prep_time: str(recipe.prepTime),
			cook_time: str(recipe.cookTime),
			total_time: str(recipe.totalTime),
			yield: parseYield(recipe.recipeYield),
			category: str(recipe.recipeCategory),
			cuisine: str(recipe.recipeCuisine),
			image_url: parseImage(recipe.image)
		}
	};
}
