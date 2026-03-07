/**
 * Automatic recipe type categorization (main, side, dessert, etc.).
 * Uses local pattern matching with optional AI enhancement.
 */

import { env } from '$env/dynamic/private';

export type RecipeType =
	| 'main'
	| 'side'
	| 'dessert'
	| 'appetizer'
	| 'breakfast'
	| 'soup'
	| 'salad'
	| 'bread'
	| 'beverage'
	| 'sauce'
	| 'snack'
	| 'other';

export const RECIPE_TYPE_LABELS: Record<RecipeType, string> = {
	main: 'Main Course',
	side: 'Side Dish',
	dessert: 'Dessert',
	appetizer: 'Appetizer',
	breakfast: 'Breakfast',
	soup: 'Soup',
	salad: 'Salad',
	bread: 'Bread',
	beverage: 'Beverage',
	sauce: 'Sauce / Condiment',
	snack: 'Snack',
	other: 'Other',
};

export const RECIPE_TYPE_COLORS: Record<RecipeType, string> = {
	main: '#d32f2f',
	side: '#7cb342',
	dessert: '#e91e63',
	appetizer: '#ff9800',
	breakfast: '#fdd835',
	soup: '#4caf50',
	salad: '#66bb6a',
	bread: '#8d6e63',
	beverage: '#29b6f6',
	sauce: '#ab47bc',
	snack: '#ff7043',
	other: '#757575',
};

interface PatternRule {
	type: RecipeType;
	titlePatterns: RegExp[];
	ingredientPatterns: RegExp[];
	instructionPatterns: RegExp[];
	weight: number;
}

const RULES: PatternRule[] = [
	{
		type: 'dessert',
		titlePatterns: [
			/\b(cake|cupcake|cookie|brownie|pie|tart|pudding|mousse|fudge|truffle|macaron|meringue|pavlova|cr[eè]me\s*br[uû]l[eé]e|cheesecake|scone|muffin|donut|doughnut|pastry|cobbler|crisp|crumble|sorbet|gelato|ice\s*cream|panna\s*cotta|tiramisu|baklava|cannoli|eclair|profiterole|souffle|flan)\b/i,
			/\b(dessert|sweet\s*treat|confection)\b/i,
		],
		ingredientPatterns: [
			/\b(powdered sugar|confectioners|vanilla extract|chocolate chips|cocoa powder|sprinkles|frosting|fondant|ganache|meringue)\b/i,
		],
		instructionPatterns: [
			/\b(frost|ice the cake|decorate|pipe|whip cream|fold in chocolate)\b/i,
		],
		weight: 10,
	},
	{
		type: 'breakfast',
		titlePatterns: [
			/\b(pancake|waffle|french toast|omelet|omelette|frittata|scrambl|breakfast|brunch|granola|cereal|porridge|oatmeal|eggs?\s*benedict|hash\s*brown|quiche|crepe)\b/i,
		],
		ingredientPatterns: [
			/\b(maple syrup|breakfast sausage|bacon.*eggs?|eggs?.*bacon)\b/i,
		],
		instructionPatterns: [],
		weight: 8,
	},
	{
		type: 'soup',
		titlePatterns: [
			/\b(soup|stew|chowder|bisque|broth|consomm[eé]|gumbo|chili|pozole|pho|ramen|gazpacho|minestrone|borscht|laksa|tom\s*yum|tom\s*kha)\b/i,
		],
		ingredientPatterns: [
			/\b(broth|stock|bouillon)\b/i,
		],
		instructionPatterns: [
			/\b(simmer.*broth|bring.*stock.*boil|pur[eé]e.*soup)\b/i,
		],
		weight: 9,
	},
	{
		type: 'salad',
		titlePatterns: [
			/\b(salad|slaw|coleslaw|tabbouleh|fattoush|panzanella|waldorf|caesar|cobb|nicoise|caprese)\b/i,
		],
		ingredientPatterns: [
			/\b(lettuce|arugula|mixed greens|romaine|kale.*salad|salad dressing|vinaigrette)\b/i,
		],
		instructionPatterns: [
			/\b(toss with dressing|assemble salad)\b/i,
		],
		weight: 8,
	},
	{
		type: 'bread',
		titlePatterns: [
			/\b(bread|loaf|baguette|focaccia|ciabatta|naan|pita|flatbread|roll|bun|brioche|sourdough|pretzel|cornbread|biscuit)\b/i,
		],
		ingredientPatterns: [
			/\b(yeast|bread flour|active dry yeast|instant yeast)\b/i,
		],
		instructionPatterns: [
			/\b(knead|proof|rise.*double|punch down|shape.*loav)\b/i,
		],
		weight: 7,
	},
	{
		type: 'appetizer',
		titlePatterns: [
			/\b(appetizer|starter|hors\s*d'oeuvre|bruschetta|crostini|dip|hummus|guacamole|spring roll|egg roll|wonton|dumpling|empanada|samosa|ceviche|carpaccio|antipast[oi]|tapas|canap[eé]|pâté|terrine)\b/i,
		],
		ingredientPatterns: [],
		instructionPatterns: [],
		weight: 7,
	},
	{
		type: 'beverage',
		titlePatterns: [
			/\b(smoothie|juice|lemonade|cocktail|mocktail|punch|shake|milkshake|tea|coffee|latte|chai|horchata|agua\s*fresca|sangria|margarita|mojito|daiquiri|spritz)\b/i,
		],
		ingredientPatterns: [],
		instructionPatterns: [
			/\b(blend until smooth|strain.*glass|shake.*ice|muddle)\b/i,
		],
		weight: 9,
	},
	{
		type: 'sauce',
		titlePatterns: [
			/\b(sauce|gravy|salsa|chutney|pesto|aioli|vinaigrette|dressing|marinade|glaze|jam|jelly|preserve|compote|relish|ketchup|mustard|hot sauce|bbq sauce|chimichurri)\b/i,
		],
		ingredientPatterns: [],
		instructionPatterns: [
			/\b(reduce.*thick|simmer.*sauce|blend.*smooth.*sauce)\b/i,
		],
		weight: 7,
	},
	{
		type: 'snack',
		titlePatterns: [
			/\b(snack|popcorn|trail mix|energy ball|energy bite|granola bar|protein bar|chips|crackers|jerky|nuts|bark)\b/i,
		],
		ingredientPatterns: [],
		instructionPatterns: [],
		weight: 6,
	},
	{
		type: 'side',
		titlePatterns: [
			/\b(side\s*dish|mashed\s*potatoes?|roasted?\s*(vegetables?|veggies)|rice\s*pilaf|gratin|casserole|stuffing|mac\s*(and|&|n)\s*cheese|coleslaw|baked\s*beans|corn\s*on|potato\s*salad|green\s*bean)\b/i,
		],
		ingredientPatterns: [],
		instructionPatterns: [],
		weight: 6,
	},
	{
		type: 'main',
		titlePatterns: [
			/\b(chicken|beef|pork|steak|salmon|shrimp|lamb|turkey|duck|fish|tofu|roast|grill|bake|braise|curry|stir[- ]?fry|casserole|lasagna|pasta|spaghetti|fettuccin|linguine|ravioli|gnocchi|risotto|paella|enchilada|taco|burrito|burger|meatloaf|pot\s*roast|fried\s*rice|biryani|tikka\s*masala|pad\s*thai|lo\s*mein|teriyaki|schnitzel|tagine|moussaka|shepherd'?s?\s*pie|pot\s*pie|wellington)\b/i,
		],
		ingredientPatterns: [
			/\b(chicken breast|ground beef|pork loin|salmon fillet|shrimp|lamb chop|tofu)\b/i,
		],
		instructionPatterns: [
			/\b(sear|grill|roast.*until.*internal|braise|cook.*until.*done|rest.*minutes.*before.*slic)\b/i,
		],
		weight: 5,
	},
];

/**
 * Categorize a recipe using local pattern matching.
 */
export function categorizeRecipeLocal(
	title: string,
	ingredients: string[],
	instructions: string[]
): RecipeType {
	const scores: Record<string, number> = {};
	const ingredientText = ingredients.join(' ');
	const instructionText = instructions.join(' ');

	for (const rule of RULES) {
		let score = 0;

		for (const pattern of rule.titlePatterns) {
			if (pattern.test(title)) {
				score += rule.weight * 3; // title matches carry most weight
			}
		}

		for (const pattern of rule.ingredientPatterns) {
			if (pattern.test(ingredientText)) {
				score += rule.weight;
			}
		}

		for (const pattern of rule.instructionPatterns) {
			if (pattern.test(instructionText)) {
				score += rule.weight;
			}
		}

		if (score > 0) {
			scores[rule.type] = (scores[rule.type] ?? 0) + score;
		}
	}

	// Additional heuristic: if we have lots of sugar/chocolate and flour, likely dessert
	const sugarMatch = ingredientText.match(/\b(sugar|chocolate|vanilla)\b/gi);
	if (sugarMatch && sugarMatch.length >= 2) {
		scores['dessert'] = (scores['dessert'] ?? 0) + 8;
	}

	// If we have a protein as the primary ingredient, likely main
	const firstFew = ingredients.slice(0, 3).join(' ').toLowerCase();
	if (/\b(chicken|beef|pork|salmon|shrimp|lamb|turkey|tofu|fish)\b/.test(firstFew)) {
		scores['main'] = (scores['main'] ?? 0) + 8;
	}

	// Find the highest-scoring type
	let bestType: RecipeType = 'other';
	let bestScore = 0;
	for (const [type, score] of Object.entries(scores)) {
		if (score > bestScore) {
			bestScore = score;
			bestType = type as RecipeType;
		}
	}

	return bestType;
}

/**
 * Map an existing category string (from recipe import) to a RecipeType.
 */
export function mapImportedCategory(category: string): RecipeType | null {
	if (!category) return null;
	const lower = category.toLowerCase().trim();

	const mapping: Record<string, RecipeType> = {
		'main course': 'main',
		'main dish': 'main',
		'main': 'main',
		'entree': 'main',
		'entrée': 'main',
		'dinner': 'main',
		'lunch': 'main',
		'side dish': 'side',
		'side': 'side',
		'dessert': 'dessert',
		'desserts': 'dessert',
		'appetizer': 'appetizer',
		'appetizers': 'appetizer',
		'starter': 'appetizer',
		'hors d\'oeuvre': 'appetizer',
		'breakfast': 'breakfast',
		'brunch': 'breakfast',
		'soup': 'soup',
		'soups': 'soup',
		'stew': 'soup',
		'salad': 'salad',
		'salads': 'salad',
		'bread': 'bread',
		'breads': 'bread',
		'baking': 'bread',
		'beverage': 'beverage',
		'beverages': 'beverage',
		'drink': 'beverage',
		'drinks': 'beverage',
		'cocktail': 'beverage',
		'sauce': 'sauce',
		'sauces': 'sauce',
		'condiment': 'sauce',
		'dressing': 'sauce',
		'snack': 'snack',
		'snacks': 'snack',
	};

	if (mapping[lower]) return mapping[lower];

	// Partial match
	for (const [key, type] of Object.entries(mapping)) {
		if (lower.includes(key) || key.includes(lower)) return type;
	}

	return null;
}

/**
 * Categorize a recipe using AI for better accuracy.
 */
export async function categorizeRecipeWithAi(
	title: string,
	ingredients: string[],
	instructions: string[]
): Promise<RecipeType | null> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) return null;

	const validTypes = Object.keys(RECIPE_TYPE_LABELS).join(', ');
	const prompt = `Categorize this recipe into exactly one type.

Title: ${title}

Ingredients (first 10):
${ingredients.slice(0, 10).map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Instructions (first 5):
${instructions.slice(0, 5).map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

Valid types: ${validTypes}

Respond with ONLY the type name, nothing else. For example: "main" or "dessert"`;

	try {
		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify({
				model: 'claude-haiku-4-5-20251001',
				max_tokens: 20,
				messages: [{ role: 'user', content: prompt }],
			}),
		});

		if (!response.ok) return null;

		const data = await response.json();
		const text = (data.content?.[0]?.text ?? '').trim().toLowerCase();

		if (text in RECIPE_TYPE_LABELS) {
			return text as RecipeType;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Smart categorization: uses imported category, then AI, then local patterns.
 */
export async function categorizeRecipeSmart(
	title: string,
	ingredients: string[],
	instructions: string[],
	existingCategory: string
): Promise<RecipeType> {
	// If recipe already has a recognizable category from import, map it
	const mapped = mapImportedCategory(existingCategory);
	if (mapped) return mapped;

	// Try AI
	const aiResult = await categorizeRecipeWithAi(title, ingredients, instructions);
	if (aiResult) return aiResult;

	// Fall back to local pattern matching
	return categorizeRecipeLocal(title, ingredients, instructions);
}
