/**
 * Categorize ingredients into food groups for display and organization.
 */

export type IngredientCategory =
	| 'meat'
	| 'poultry'
	| 'seafood'
	| 'dairy'
	| 'vegetable'
	| 'fruit'
	| 'herb'
	| 'spice'
	| 'grain'
	| 'legume'
	| 'nut'
	| 'oil'
	| 'sweetener'
	| 'baking'
	| 'condiment'
	| 'liquid'
	| 'other';

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
	meat: 'Meat',
	poultry: 'Poultry',
	seafood: 'Seafood',
	dairy: 'Dairy',
	vegetable: 'Vegetables',
	fruit: 'Fruit',
	herb: 'Herbs',
	spice: 'Spices & Seasonings',
	grain: 'Grains & Starches',
	legume: 'Legumes',
	nut: 'Nuts & Seeds',
	oil: 'Oils & Fats',
	sweetener: 'Sweeteners',
	baking: 'Baking',
	condiment: 'Condiments & Sauces',
	liquid: 'Liquids',
	other: 'Other',
};

export const CATEGORY_COLORS: Record<IngredientCategory, string> = {
	meat: '#c62828',
	poultry: '#d84315',
	seafood: '#0277bd',
	dairy: '#f9a825',
	vegetable: '#2e7d32',
	fruit: '#e65100',
	herb: '#558b2f',
	spice: '#6a1b9a',
	grain: '#795548',
	legume: '#827717',
	nut: '#4e342e',
	oil: '#f57f17',
	sweetener: '#ad1457',
	baking: '#5d4037',
	condiment: '#455a64',
	liquid: '#0097a7',
	other: '#757575',
};

// Pattern lists for each category (checked against lowercased ingredient name)
const CATEGORY_PATTERNS: [IngredientCategory, string[]][] = [
	['poultry', [
		'chicken', 'turkey', 'duck', 'goose', 'quail', 'cornish hen', 'pheasant',
		'chicken breast', 'chicken thigh', 'chicken wing', 'chicken leg', 'drumstick',
		'ground turkey', 'turkey breast',
	]],
	['seafood', [
		'salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'trout', 'bass', 'swordfish',
		'shrimp', 'prawn', 'lobster', 'crab', 'scallop', 'clam', 'mussel', 'oyster',
		'squid', 'calamari', 'octopus', 'anchovy', 'anchovies', 'sardine', 'sardines',
		'fish sauce', 'fish', 'mahi', 'snapper', 'catfish', 'mackerel',
	]],
	['meat', [
		'beef', 'pork', 'lamb', 'veal', 'venison', 'bison', 'goat',
		'steak', 'ground beef', 'ground pork', 'bacon', 'pancetta', 'prosciutto',
		'ham', 'sausage', 'chorizo', 'salami', 'pepperoni',
		'ribs', 'roast', 'tenderloin', 'sirloin', 'chuck', 'brisket', 'flank',
		'meatball', 'meat',
	]],
	['herb', [
		'basil', 'parsley', 'cilantro', 'dill', 'mint', 'rosemary', 'thyme',
		'oregano', 'sage', 'tarragon', 'chive', 'chives', 'bay leaf', 'bay leaves',
		'marjoram', 'lavender', 'lemongrass', 'epazote',
		'fresh basil', 'fresh parsley', 'fresh cilantro', 'fresh dill',
		'fresh mint', 'fresh rosemary', 'fresh thyme', 'fresh oregano',
	]],
	['spice', [
		'salt', 'pepper', 'black pepper', 'white pepper', 'cayenne',
		'cumin', 'coriander', 'turmeric', 'paprika', 'smoked paprika',
		'cinnamon', 'nutmeg', 'clove', 'cloves', 'allspice', 'cardamom',
		'ginger', 'ground ginger', 'star anise', 'anise', 'fennel seed',
		'mustard seed', 'mustard powder', 'celery seed', 'celery salt',
		'garlic powder', 'onion powder', 'chili powder', 'chili flake',
		'red pepper flake', 'crushed red pepper', 'curry powder', 'garam masala',
		'five spice', 'za\'atar', 'sumac', 'saffron', 'vanilla',
		'vanilla extract', 'vanilla bean', 'seasoning', 'old bay',
	]],
	['dairy', [
		'milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream',
		'cream cheese', 'mascarpone', 'ricotta', 'mozzarella', 'cheddar',
		'parmesan', 'gruyère', 'gruyere', 'feta', 'gouda', 'brie',
		'provolone', 'swiss', 'monterey jack', 'colby', 'fontina',
		'buttermilk', 'half-and-half', 'half and half', 'whipping cream',
		'heavy cream', 'evaporated milk', 'condensed milk', 'ghee',
		'crème fraîche', 'creme fraiche', 'kefir', 'whey',
		'Pecorino', 'Asiago', 'Neufchâtel',
	]],
	['vegetable', [
		'onion', 'garlic', 'tomato', 'potato', 'carrot', 'celery',
		'bell pepper', 'jalapeño', 'jalapeno', 'chili pepper', 'poblano',
		'broccoli', 'cauliflower', 'spinach', 'kale', 'lettuce', 'arugula',
		'zucchini', 'squash', 'eggplant', 'mushroom', 'corn', 'pea', 'peas',
		'green bean', 'asparagus', 'artichoke', 'beet', 'turnip', 'radish',
		'cucumber', 'cabbage', 'brussels sprout', 'leek', 'shallot',
		'scallion', 'green onion', 'spring onion', 'sweet potato', 'yam',
		'parsnip', 'rutabaga', 'bok choy', 'fennel', 'okra',
		'avocado', 'olive', 'olives', 'caper', 'capers',
		'sun-dried tomato', 'roasted pepper', 'pumpkin', 'butternut',
		'acorn squash', 'spaghetti squash', 'watercress', 'endive',
	]],
	['fruit', [
		'apple', 'banana', 'lemon', 'lime', 'orange', 'grapefruit',
		'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry',
		'cherry', 'grape', 'peach', 'plum', 'apricot', 'nectarine',
		'mango', 'pineapple', 'coconut', 'pomegranate', 'fig', 'date',
		'raisin', 'raisins', 'currant', 'prune', 'dried fruit',
		'lemon juice', 'lime juice', 'orange juice', 'lemon zest', 'orange zest',
		'pear', 'kiwi', 'papaya', 'guava', 'passion fruit', 'melon',
		'watermelon', 'cantaloupe', 'honeydew',
	]],
	['nut', [
		'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut',
		'macadamia', 'pine nut', 'pine nuts', 'peanut', 'peanuts',
		'sunflower seed', 'pumpkin seed', 'sesame seed', 'flax seed', 'flaxseed',
		'chia seed', 'chia seeds', 'hemp seed', 'poppy seed',
		'almond butter', 'peanut butter', 'cashew butter', 'tahini',
		'sunflower seed butter', 'soy nut butter',
		'almond flour', 'coconut flour',
	]],
	['grain', [
		'flour', 'all-purpose flour', 'bread flour', 'whole wheat flour',
		'rice', 'pasta', 'noodle', 'bread', 'tortilla', 'pita',
		'oat', 'oats', 'rolled oats', 'quinoa', 'couscous', 'bulgur',
		'barley', 'farro', 'millet', 'polenta', 'cornmeal', 'grits',
		'breadcrumb', 'bread crumb', 'panko', 'cracker',
		'cornstarch', 'corn starch', 'tapioca', 'arrowroot',
		'potato starch',
	]],
	['legume', [
		'bean', 'beans', 'lentil', 'lentils', 'chickpea', 'chickpeas',
		'black bean', 'kidney bean', 'pinto bean', 'navy bean', 'cannellini',
		'edamame', 'tofu', 'tempeh', 'soybean', 'hummus',
		'split pea', 'lima bean',
	]],
	['oil', [
		'oil', 'olive oil', 'vegetable oil', 'canola oil', 'coconut oil',
		'sesame oil', 'avocado oil', 'peanut oil', 'sunflower oil',
		'grapeseed oil', 'walnut oil', 'truffle oil',
		'cooking spray', 'shortening', 'lard', 'tallow',
	]],
	['sweetener', [
		'sugar', 'granulated sugar', 'brown sugar', 'powdered sugar',
		'confectioners sugar', 'coconut sugar', 'maple sugar',
		'honey', 'maple syrup', 'agave', 'molasses', 'corn syrup',
		'stevia', 'erythritol', 'monk fruit',
	]],
	['baking', [
		'baking powder', 'baking soda', 'yeast', 'active dry yeast',
		'instant yeast', 'cream of tartar', 'cocoa powder', 'cacao powder',
		'chocolate', 'chocolate chip', 'gelatin', 'pectin',
		'food coloring', 'extract', 'sprinkle',
	]],
	['condiment', [
		'soy sauce', 'tamari', 'coconut aminos', 'worcestershire',
		'hot sauce', 'sriracha', 'tabasco', 'ketchup', 'mustard',
		'dijon', 'mayonnaise', 'mayo', 'vinegar', 'balsamic',
		'red wine vinegar', 'white wine vinegar', 'apple cider vinegar',
		'rice vinegar', 'mirin', 'sake', 'wine', 'white wine', 'red wine',
		'tomato paste', 'tomato sauce', 'marinara', 'salsa', 'pesto',
		'hoisin', 'oyster sauce', 'teriyaki', 'barbecue sauce', 'bbq sauce',
		'chutney', 'relish', 'jam', 'jelly', 'preserve',
		'nutritional yeast', 'miso', 'gochujang', 'harissa',
		'liquid aminos',
	]],
	['liquid', [
		'water', 'broth', 'stock', 'chicken broth', 'beef broth',
		'vegetable broth', 'bone broth', 'mushroom broth',
		'bouillon', 'coconut milk', 'coconut cream',
		'oat milk', 'almond milk', 'soy milk',
		'beer', 'bourbon', 'whiskey', 'rum', 'brandy', 'vodka',
		'coffee', 'espresso', 'tea',
	]],
];

/**
 * Categorize an ingredient name into a food group.
 * Uses the parsed ingredient name (without qty/unit) for best results.
 */
export function categorizeIngredient(name: string): IngredientCategory {
	const lower = name.toLowerCase().trim();
	if (!lower) return 'other';

	// Check each category's patterns, longest match first within each category
	for (const [category, patterns] of CATEGORY_PATTERNS) {
		// Sort patterns longest first so "chicken breast" matches before "chicken"
		const sorted = [...patterns].sort((a, b) => b.length - a.length);
		for (const pattern of sorted) {
			// Check if the ingredient name contains the pattern as a word
			if (lower === pattern) return category;
			if (lower.includes(pattern)) return category;
		}
	}

	return 'other';
}

/**
 * Map a known_ingredients DB category to our display category.
 * The DB uses categories like 'flour', 'dairy', 'oil', 'sweetener', 'baking', 'seasoning', 'grain', 'nut', 'liquid'.
 */
export function mapDbCategory(dbCategory: string): IngredientCategory {
	const map: Record<string, IngredientCategory> = {
		flour: 'grain',
		dairy: 'dairy',
		oil: 'oil',
		sweetener: 'sweetener',
		baking: 'baking',
		seasoning: 'spice',
		grain: 'grain',
		nut: 'nut',
		liquid: 'liquid',
	};
	return map[dbCategory] ?? 'other';
}

/** Display order for categories */
export const CATEGORY_ORDER: IngredientCategory[] = [
	'meat', 'poultry', 'seafood', 'dairy',
	'vegetable', 'fruit', 'herb', 'spice',
	'grain', 'legume', 'nut', 'oil',
	'sweetener', 'baking', 'condiment', 'liquid', 'other',
];
