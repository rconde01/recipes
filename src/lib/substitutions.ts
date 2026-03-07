/**
 * Ingredient substitution knowledge base.
 *
 * Each entry maps a canonical ingredient name to a list of possible
 * substitutions with ratios, notes, and categories.
 */

export interface Substitution {
	name: string;
	ratio: string; // e.g. "1:1", "3/4 cup per 1 cup"
	notes: string;
	category: 'direct' | 'dietary' | 'emergency'; // how close the substitution is
}

// Map from canonical (lowercased) ingredient name to substitutions
const SUBSTITUTION_DB: Record<string, Substitution[]> = {
	'all-purpose flour': [
		{ name: 'whole wheat flour', ratio: '1:1 (may be denser)', notes: 'Use 3/4 cup + 2 tbsp per cup for lighter results. Adds nuttier flavor.', category: 'direct' },
		{ name: 'cake flour', ratio: '1 cup + 2 tbsp per 1 cup AP', notes: 'Makes lighter, more tender baked goods.', category: 'direct' },
		{ name: 'bread flour', ratio: '1:1', notes: 'Slightly chewier results due to higher protein.', category: 'direct' },
		{ name: 'almond flour', ratio: '1:1 (add binding)', notes: 'Gluten-free. May need extra egg for binding. Very different texture.', category: 'dietary' },
		{ name: 'oat flour', ratio: '1:1', notes: 'Gluten-free (if certified). Blend rolled oats to make your own.', category: 'dietary' },
		{ name: 'coconut flour', ratio: '1/4 cup per 1 cup AP', notes: 'Very absorbent. Increase eggs and liquid significantly.', category: 'dietary' },
	],
	'bread flour': [
		{ name: 'all-purpose flour', ratio: '1:1', notes: 'Slightly less chewy. Add 1 tsp vital wheat gluten per cup for closer results.', category: 'direct' },
		{ name: 'whole wheat flour', ratio: '1:1', notes: 'Denser result, nuttier flavor.', category: 'direct' },
	],
	'cake flour': [
		{ name: 'all-purpose flour + cornstarch', ratio: '1 cup minus 2 tbsp AP + 2 tbsp cornstarch', notes: 'Sift together twice for best results.', category: 'direct' },
	],
	'whole wheat flour': [
		{ name: 'all-purpose flour', ratio: '1:1', notes: 'Lighter texture, less fiber.', category: 'direct' },
		{ name: 'white whole wheat flour', ratio: '1:1', notes: 'Milder flavor than regular whole wheat.', category: 'direct' },
		{ name: 'spelt flour', ratio: '1:1', notes: 'Similar nutrition, slightly sweeter. Not gluten-free.', category: 'direct' },
	],
	'almond flour': [
		{ name: 'all-purpose flour', ratio: '1:1 (reduce fat)', notes: 'Not gluten-free. Reduce any added fat slightly.', category: 'direct' },
		{ name: 'sunflower seed flour', ratio: '1:1', notes: 'Nut-free alternative. May turn green due to chlorophyll (harmless).', category: 'dietary' },
		{ name: 'oat flour', ratio: '1:1', notes: 'Different flavor, works well in cookies and pancakes.', category: 'direct' },
	],
	'coconut flour': [
		{ name: 'almond flour', ratio: '3-4 cups almond per 1 cup coconut', notes: 'Reduce eggs; almond flour is much less absorbent.', category: 'direct' },
	],
	butter: [
		{ name: 'coconut oil', ratio: '1:1', notes: 'Solid at room temperature like butter. Slight coconut flavor.', category: 'direct' },
		{ name: 'olive oil', ratio: '3/4 cup per 1 cup butter', notes: 'Best for savory dishes. Changes flavor profile.', category: 'direct' },
		{ name: 'vegetable oil', ratio: '3/4 cup per 1 cup butter', notes: 'Neutral flavor. Won\'t cream the same way.', category: 'direct' },
		{ name: 'applesauce', ratio: '1/2 cup per 1 cup butter', notes: 'Low-fat option for baking. Adds moisture and sweetness.', category: 'dietary' },
		{ name: 'Greek yogurt', ratio: '1/2 cup per 1 cup butter', notes: 'Adds tang and moisture. Good for quick breads and muffins.', category: 'dietary' },
		{ name: 'vegan butter', ratio: '1:1', notes: 'Dairy-free. Check brand for baking suitability.', category: 'dietary' },
		{ name: 'ghee', ratio: '1:1', notes: 'Clarified butter, lactose-free. Higher smoke point.', category: 'direct' },
	],
	milk: [
		{ name: 'oat milk', ratio: '1:1', notes: 'Creamy, slightly sweet. Good all-purpose dairy-free sub.', category: 'dietary' },
		{ name: 'almond milk', ratio: '1:1', notes: 'Thinner than whole milk. Works in most recipes.', category: 'dietary' },
		{ name: 'soy milk', ratio: '1:1', notes: 'Closest to dairy in protein content.', category: 'dietary' },
		{ name: 'coconut milk (carton)', ratio: '1:1', notes: 'Slightly sweet. Not the same as canned coconut milk.', category: 'dietary' },
		{ name: 'half-and-half + water', ratio: '1/2 cup each per 1 cup milk', notes: 'When you only have half-and-half on hand.', category: 'emergency' },
		{ name: 'evaporated milk + water', ratio: '1/2 cup each per 1 cup milk', notes: 'Slightly caramelized flavor.', category: 'emergency' },
	],
	'heavy cream': [
		{ name: 'coconut cream', ratio: '1:1', notes: 'Dairy-free. Chill can and scoop thick cream from top.', category: 'dietary' },
		{ name: 'milk + butter', ratio: '3/4 cup milk + 1/4 cup melted butter', notes: 'Won\'t whip, but works for sauces and baking.', category: 'emergency' },
		{ name: 'evaporated milk', ratio: '1:1', notes: 'Won\'t whip, but good for cooking and baking.', category: 'emergency' },
		{ name: 'cashew cream', ratio: '1:1', notes: 'Blend soaked cashews with water. Vegan, very creamy.', category: 'dietary' },
	],
	'sour cream': [
		{ name: 'Greek yogurt', ratio: '1:1', notes: 'Slightly tangier. Works in baking and toppings.', category: 'direct' },
		{ name: 'cottage cheese (blended)', ratio: '1:1', notes: 'Blend until smooth. Higher protein.', category: 'direct' },
		{ name: 'cashew cream + lemon juice', ratio: '1:1', notes: 'Vegan option. Add 1 tbsp lemon juice per cup.', category: 'dietary' },
	],
	'cream cheese': [
		{ name: 'mascarpone', ratio: '1:1', notes: 'Richer, slightly sweeter. Great for desserts.', category: 'direct' },
		{ name: 'ricotta (strained)', ratio: '1:1', notes: 'Lighter, grainier. Strain overnight for best results.', category: 'direct' },
		{ name: 'Neufchâtel cheese', ratio: '1:1', notes: 'Lower fat version. Sold as "1/3 less fat cream cheese."', category: 'direct' },
		{ name: 'silken tofu + lemon juice', ratio: '1:1', notes: 'Vegan. Blend until smooth with 1 tbsp lemon per 8 oz.', category: 'dietary' },
	],
	'granulated sugar': [
		{ name: 'coconut sugar', ratio: '1:1', notes: 'Lower glycemic index. Slight caramel flavor, darker color.', category: 'direct' },
		{ name: 'honey', ratio: '3/4 cup per 1 cup sugar', notes: 'Reduce other liquids by 1/4 cup. Lower oven by 25°F.', category: 'direct' },
		{ name: 'maple syrup', ratio: '3/4 cup per 1 cup sugar', notes: 'Reduce other liquids by 3 tbsp. Adds distinct flavor.', category: 'direct' },
		{ name: 'brown sugar', ratio: '1:1', notes: 'Adds moisture and molasses flavor.', category: 'direct' },
		{ name: 'stevia', ratio: '1 tsp per 1 cup sugar', notes: 'Zero calorie. Doesn\'t caramelize or add bulk.', category: 'dietary' },
		{ name: 'erythritol', ratio: '1:1 (or 3/4 cup)', notes: 'Sugar alcohol. Slight cooling sensation. Keto-friendly.', category: 'dietary' },
	],
	'brown sugar': [
		{ name: 'granulated sugar + molasses', ratio: '1 cup sugar + 1 tbsp molasses', notes: 'Mix well. This is literally how brown sugar is made.', category: 'direct' },
		{ name: 'coconut sugar', ratio: '1:1', notes: 'Similar caramel notes. Slightly different moisture.', category: 'direct' },
		{ name: 'maple sugar', ratio: '1:1', notes: 'Distinct maple flavor. Expensive but delicious.', category: 'direct' },
	],
	'powdered sugar': [
		{ name: 'granulated sugar (blended)', ratio: '1:1', notes: 'Blend granulated sugar + 1 tsp cornstarch per cup in blender until powdery.', category: 'direct' },
	],
	honey: [
		{ name: 'maple syrup', ratio: '1:1', notes: 'Different flavor but similar consistency and sweetness.', category: 'direct' },
		{ name: 'agave nectar', ratio: '1:1', notes: 'Milder flavor, slightly thinner.', category: 'direct' },
		{ name: 'corn syrup', ratio: '1:1', notes: 'Less sweet, neutral flavor. Works for texture.', category: 'emergency' },
		{ name: 'brown rice syrup', ratio: '1:1', notes: 'Less sweet, nutty flavor. Vegan.', category: 'dietary' },
	],
	'maple syrup': [
		{ name: 'honey', ratio: '1:1', notes: 'Sweeter, different flavor profile.', category: 'direct' },
		{ name: 'agave nectar', ratio: '1:1', notes: 'Vegan alternative with mild flavor.', category: 'direct' },
		{ name: 'brown sugar syrup', ratio: '1:1', notes: 'Dissolve 1/2 cup brown sugar in 1/4 cup water.', category: 'emergency' },
	],
	eggs: [
		{ name: 'flax egg', ratio: '1 tbsp ground flax + 3 tbsp water per egg', notes: 'Let sit 5 min until gel forms. Best for baking.', category: 'dietary' },
		{ name: 'chia egg', ratio: '1 tbsp chia seeds + 3 tbsp water per egg', notes: 'Let sit 5 min. Visible specks in final product.', category: 'dietary' },
		{ name: 'applesauce', ratio: '1/4 cup per egg', notes: 'Adds moisture and binding. Best for cakes and muffins.', category: 'dietary' },
		{ name: 'mashed banana', ratio: '1/4 cup per egg', notes: 'Adds banana flavor. Good for pancakes and quick breads.', category: 'dietary' },
		{ name: 'silken tofu', ratio: '1/4 cup blended per egg', notes: 'Neutral flavor, good binding. Works in dense baked goods.', category: 'dietary' },
		{ name: 'commercial egg replacer', ratio: 'per package directions', notes: 'Bob\'s Red Mill, JUST Egg, etc. Most reliable vegan option.', category: 'dietary' },
	],
	'vegetable oil': [
		{ name: 'canola oil', ratio: '1:1', notes: 'Neutral flavor, almost identical performance.', category: 'direct' },
		{ name: 'melted coconut oil', ratio: '1:1', notes: 'May add slight coconut flavor. Solidifies when cool.', category: 'direct' },
		{ name: 'olive oil', ratio: '1:1', notes: 'Adds flavor. Best for savory dishes.', category: 'direct' },
		{ name: 'applesauce', ratio: '1:1', notes: 'Low-fat option for baking. Adds moisture and sweetness.', category: 'dietary' },
		{ name: 'melted butter', ratio: '1:1', notes: 'Richer flavor, not dairy-free.', category: 'direct' },
		{ name: 'avocado oil', ratio: '1:1', notes: 'Neutral flavor, high smoke point.', category: 'direct' },
	],
	'olive oil': [
		{ name: 'avocado oil', ratio: '1:1', notes: 'Neutral flavor, higher smoke point. Good for high heat.', category: 'direct' },
		{ name: 'vegetable oil', ratio: '1:1', notes: 'Neutral flavor. Loses the olive oil character.', category: 'direct' },
		{ name: 'coconut oil', ratio: '1:1', notes: 'Slight coconut flavor. Good for medium heat.', category: 'direct' },
		{ name: 'butter', ratio: '1:1', notes: 'Rich flavor, lower smoke point. Not dairy-free.', category: 'direct' },
	],
	'baking powder': [
		{ name: 'baking soda + cream of tartar', ratio: '1/4 tsp soda + 1/2 tsp cream of tartar per 1 tsp', notes: 'Mix fresh each time. This is what baking powder is.', category: 'direct' },
		{ name: 'self-rising flour', ratio: 'replace AP flour with self-rising, omit baking powder and salt', notes: 'Self-rising flour already contains baking powder.', category: 'emergency' },
	],
	'baking soda': [
		{ name: 'baking powder', ratio: '3 tsp per 1 tsp baking soda', notes: 'Triple the amount. May affect flavor slightly.', category: 'direct' },
	],
	salt: [
		{ name: 'kosher salt', ratio: '1.5 tsp per 1 tsp table salt', notes: 'Larger crystals, less dense. Diamond Crystal: use 2x.', category: 'direct' },
		{ name: 'sea salt', ratio: '1:1 (fine) or adjust if coarse', notes: 'May have mineral flavors depending on source.', category: 'direct' },
		{ name: 'soy sauce', ratio: '1 tbsp per 1/2 tsp salt', notes: 'Adds umami and color. Reduce other liquids slightly.', category: 'emergency' },
	],
	'cocoa powder': [
		{ name: 'cacao powder', ratio: '1:1', notes: 'Less processed, slightly more bitter. Higher in nutrients.', category: 'direct' },
		{ name: 'carob powder', ratio: '1:1', notes: 'Caffeine-free, naturally sweeter. Different flavor.', category: 'dietary' },
		{ name: 'dark chocolate (melted)', ratio: '1 oz per 3 tbsp cocoa + reduce fat by 1 tbsp', notes: 'Richer flavor. Adjust sugar and fat accordingly.', category: 'emergency' },
	],
	cornstarch: [
		{ name: 'arrowroot powder', ratio: '1:1', notes: 'Freezer-friendly, clear when cooked. Don\'t boil.', category: 'direct' },
		{ name: 'tapioca starch', ratio: '2 tbsp per 1 tbsp cornstarch', notes: 'Makes sauces slightly more glossy/chewy.', category: 'direct' },
		{ name: 'all-purpose flour', ratio: '2 tbsp per 1 tbsp cornstarch', notes: 'Makes opaque sauce. Cook longer to remove raw flour taste.', category: 'emergency' },
		{ name: 'potato starch', ratio: '1:1', notes: 'Good for frying. Don\'t boil — breaks down at high heat.', category: 'direct' },
	],
	rice: [
		{ name: 'quinoa', ratio: '1:1', notes: 'Higher protein. Cook with 1.5x water.', category: 'direct' },
		{ name: 'cauliflower rice', ratio: '1:1', notes: 'Low-carb option. Much softer texture, cooks in 5 min.', category: 'dietary' },
		{ name: 'couscous', ratio: '1:1', notes: 'Cooks faster (5 min). Actually a pasta, not a grain.', category: 'direct' },
		{ name: 'bulgur', ratio: '1:1', notes: 'Nutty flavor, chewy texture. More fiber.', category: 'direct' },
		{ name: 'orzo', ratio: '1:1', notes: 'Rice-shaped pasta. Different texture but similar use.', category: 'direct' },
	],
	'peanut butter': [
		{ name: 'almond butter', ratio: '1:1', notes: 'Milder flavor, similar texture.', category: 'direct' },
		{ name: 'cashew butter', ratio: '1:1', notes: 'Creamier, milder. Great for sauces.', category: 'direct' },
		{ name: 'sunflower seed butter', ratio: '1:1', notes: 'Nut-free. May turn green in baked goods (harmless).', category: 'dietary' },
		{ name: 'tahini', ratio: '1:1', notes: 'Sesame-based. More bitter, great in savory dishes.', category: 'direct' },
		{ name: 'soy nut butter', ratio: '1:1', notes: 'Nut-free and peanut-free. Similar texture.', category: 'dietary' },
	],
	'rolled oats': [
		{ name: 'quick oats', ratio: '1:1', notes: 'Finer texture. Cooks faster, softer in baking.', category: 'direct' },
		{ name: 'steel-cut oats', ratio: '1:1 (increase cook time)', notes: 'Chewier, nuttier. Takes 20-30 min to cook.', category: 'direct' },
		{ name: 'quinoa flakes', ratio: '1:1', notes: 'Gluten-free (oats may have cross-contamination).', category: 'dietary' },
	],
	water: [
		{ name: 'broth/stock', ratio: '1:1', notes: 'Adds flavor and depth. Use for savory dishes.', category: 'direct' },
		{ name: 'coconut water', ratio: '1:1', notes: 'Slightly sweet. Interesting in rice and smoothies.', category: 'direct' },
	],
	// Common non-DB ingredients
	garlic: [
		{ name: 'garlic powder', ratio: '1/8 tsp per clove', notes: 'Milder, more uniform flavor. Add to liquids.', category: 'emergency' },
		{ name: 'garlic paste', ratio: '1/2 tsp per clove', notes: 'Convenient, similar fresh flavor.', category: 'direct' },
		{ name: 'shallot', ratio: '1 shallot per 2-3 cloves', notes: 'Milder, slightly sweet garlic-onion flavor.', category: 'emergency' },
	],
	onion: [
		{ name: 'shallot', ratio: '3 shallots per 1 medium onion', notes: 'Milder, more refined flavor.', category: 'direct' },
		{ name: 'onion powder', ratio: '1 tbsp per 1 medium onion', notes: 'No texture. Good for seasoning.', category: 'emergency' },
		{ name: 'leek (white part)', ratio: '1 leek per 1 onion', notes: 'Milder, slightly sweet. Great in soups.', category: 'direct' },
		{ name: 'green onion/scallion', ratio: '6-8 per 1 medium onion', notes: 'Milder, best added later in cooking.', category: 'direct' },
	],
	lemon: [
		{ name: 'lime', ratio: '1:1', notes: 'Slightly different flavor profile but works in most recipes.', category: 'direct' },
		{ name: 'white wine vinegar', ratio: '1/2 tsp per 1 tsp lemon juice', notes: 'For acidity only, no citrus flavor.', category: 'emergency' },
		{ name: 'orange juice', ratio: '1:1', notes: 'Sweeter, less tart. Best for dressings and marinades.', category: 'emergency' },
	],
	'chicken broth': [
		{ name: 'vegetable broth', ratio: '1:1', notes: 'Vegetarian/vegan. Lighter flavor.', category: 'dietary' },
		{ name: 'bouillon cube + water', ratio: '1 cube per 1 cup', notes: 'Saltier, adjust seasoning. Always available in pantry.', category: 'emergency' },
		{ name: 'bone broth', ratio: '1:1', notes: 'Richer, more collagen. Great for soups.', category: 'direct' },
		{ name: 'mushroom broth', ratio: '1:1', notes: 'Deep umami flavor. Good vegetarian option.', category: 'dietary' },
	],
	'tomato paste': [
		{ name: 'tomato sauce', ratio: '3 tbsp per 1 tbsp paste', notes: 'Thinner. Reduce other liquids or cook down.', category: 'direct' },
		{ name: 'ketchup', ratio: '1:1', notes: 'Sweeter with vinegar. Works in a pinch for stews.', category: 'emergency' },
		{ name: 'sun-dried tomatoes (blended)', ratio: '1:1', notes: 'Intense flavor. Rehydrate and blend smooth.', category: 'direct' },
	],
	'soy sauce': [
		{ name: 'tamari', ratio: '1:1', notes: 'Gluten-free, slightly richer. Nearly identical use.', category: 'dietary' },
		{ name: 'coconut aminos', ratio: '1:1 (add a pinch of salt)', notes: 'Soy-free and gluten-free. Slightly sweeter, less salty.', category: 'dietary' },
		{ name: 'Worcestershire sauce', ratio: '1:1', notes: 'Different flavor but adds similar umami depth.', category: 'emergency' },
		{ name: 'liquid aminos', ratio: '1:1', notes: 'Similar flavor, often lower sodium.', category: 'direct' },
	],
	'Parmesan cheese': [
		{ name: 'Pecorino Romano', ratio: '1:1', notes: 'Sharper, saltier. Made from sheep\'s milk.', category: 'direct' },
		{ name: 'nutritional yeast', ratio: '2 tbsp per 1/4 cup Parmesan', notes: 'Vegan. Cheesy, nutty flavor. Great on pasta.', category: 'dietary' },
		{ name: 'Asiago cheese', ratio: '1:1', notes: 'Similar aged cheese flavor, slightly milder.', category: 'direct' },
	],
	yogurt: [
		{ name: 'sour cream', ratio: '1:1', notes: 'Higher fat, thicker. Works in baking and toppings.', category: 'direct' },
		{ name: 'coconut yogurt', ratio: '1:1', notes: 'Dairy-free. Slight coconut flavor.', category: 'dietary' },
		{ name: 'buttermilk', ratio: '1:1', notes: 'Thinner. Best for marinades and baking.', category: 'direct' },
	],
	buttermilk: [
		{ name: 'milk + vinegar', ratio: '1 cup milk + 1 tbsp white vinegar or lemon juice', notes: 'Let stand 5-10 min until it curdles. Most common sub.', category: 'direct' },
		{ name: 'milk + cream of tartar', ratio: '1 cup milk + 1.75 tsp cream of tartar', notes: 'No acid flavor. Good for biscuits.', category: 'direct' },
		{ name: 'yogurt + milk', ratio: '3/4 cup yogurt + 1/4 cup milk', notes: 'Closest in tang and thickness.', category: 'direct' },
	],
	'vanilla extract': [
		{ name: 'vanilla bean paste', ratio: '1:1', notes: 'Adds visible vanilla bean specks. Richer flavor.', category: 'direct' },
		{ name: 'vanilla bean', ratio: '1/2 bean per 1 tsp extract', notes: 'Split and scrape seeds. Most intense flavor.', category: 'direct' },
		{ name: 'almond extract', ratio: '1/2 tsp per 1 tsp vanilla', notes: 'Stronger flavor. Use less. Different but complementary.', category: 'emergency' },
		{ name: 'maple syrup', ratio: '1:1', notes: 'Adds sweetness and warm flavor. Not a perfect match.', category: 'emergency' },
	],
	'white wine': [
		{ name: 'chicken or vegetable broth', ratio: '1:1', notes: 'No alcohol. Loses acidity — add splash of lemon juice.', category: 'direct' },
		{ name: 'white wine vinegar + water', ratio: '1 tbsp vinegar + rest water per 1/4 cup wine', notes: 'Mimics acidity without alcohol.', category: 'emergency' },
		{ name: 'dry vermouth', ratio: '1:1', notes: 'Similar flavor profile. Lasts longer in the fridge.', category: 'direct' },
		{ name: 'apple cider', ratio: '1:1', notes: 'Slightly sweeter but good acidity.', category: 'emergency' },
	],
	'red wine': [
		{ name: 'beef broth', ratio: '1:1', notes: 'No alcohol. Add 1 tbsp red wine vinegar per cup for acidity.', category: 'direct' },
		{ name: 'grape juice + vinegar', ratio: '1 cup juice + 1 tbsp red wine vinegar', notes: 'Sweetener. Reduce sugar in recipe if needed.', category: 'emergency' },
		{ name: 'pomegranate juice', ratio: '1:1', notes: 'Good color and tart flavor.', category: 'emergency' },
	],
};

/**
 * Look up substitutions for an ingredient by name.
 * Tries exact match first, then fuzzy substring matching.
 */
export function getSubstitutions(ingredientName: string): Substitution[] {
	const lower = ingredientName.toLowerCase().trim();

	// Exact match
	if (SUBSTITUTION_DB[lower]) {
		return SUBSTITUTION_DB[lower];
	}

	// Try matching with common variations
	// Strip plural 's'
	const singular = lower.endsWith('s') ? lower.slice(0, -1) : lower;
	if (SUBSTITUTION_DB[singular]) {
		return SUBSTITUTION_DB[singular];
	}

	// Substring: ingredient name contains a known key
	for (const [key, subs] of Object.entries(SUBSTITUTION_DB)) {
		if (lower.includes(key) || key.includes(lower)) {
			return subs;
		}
	}

	return [];
}

/**
 * Get all known ingredient names that have substitution data.
 */
export function getSubstitutableIngredients(): string[] {
	return Object.keys(SUBSTITUTION_DB);
}
