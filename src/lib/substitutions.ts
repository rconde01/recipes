/**
 * Ingredient substitution knowledge base.
 *
 * Each entry maps a canonical ingredient name to a list of possible
 * substitutions with computable ratios and notes.
 */

export interface Substitution {
	name: string;
	/** Numeric multiplier: amount of substitute per 1 unit of original.
	 *  e.g. 0.75 means use 3/4 the amount. null for complex multi-part subs. */
	ratio: number | null;
	/** Override unit for the substitute (e.g. "tsp" when original is "clove"). null = same unit. */
	subUnit: string | null;
	/** Human-readable description for complex substitutions that can't be expressed as a simple ratio */
	ratioNote: string;
	notes: string;
	category: 'direct' | 'dietary' | 'emergency';
}

/**
 * Format a computed substitution amount for display.
 * Given original quantity/unit and the substitution, returns a string like "1.5 cups olive oil".
 */
export function formatSubAmount(
	originalQty: number | null,
	originalUnit: string,
	sub: Substitution
): string {
	if (originalQty == null || originalQty === 0) {
		// No quantity to compute from
		if (sub.ratio != null && sub.ratioNote) return sub.ratioNote;
		if (sub.ratioNote) return sub.ratioNote;
		return '';
	}

	if (sub.ratio == null) {
		// Complex sub — show the ratioNote scaled if possible
		return sub.ratioNote;
	}

	const computed = originalQty * sub.ratio;
	const unit = sub.subUnit ?? originalUnit;
	const rounded = formatNumber(computed);

	if (unit) {
		return `${rounded} ${unit} ${sub.name}`;
	}
	return `${rounded} ${sub.name}`;
}

function formatNumber(n: number): string {
	// Show nice fractions for common amounts
	if (n === 0) return '0';

	const whole = Math.floor(n);
	const frac = n - whole;

	const fractions: [number, string][] = [
		[0.125, '1/8'], [0.25, '1/4'], [0.333, '1/3'],
		[0.375, '3/8'], [0.5, '1/2'], [0.625, '5/8'],
		[0.667, '2/3'], [0.75, '3/4'], [0.875, '7/8'],
	];

	// Find closest fraction within tolerance
	for (const [val, str] of fractions) {
		if (Math.abs(frac - val) < 0.04) {
			return whole > 0 ? `${whole} ${str}` : str;
		}
	}

	if (frac < 0.04) return `${whole}`;

	// Fall back to 1 or 2 decimal places
	const rounded = Math.round(n * 100) / 100;
	if (rounded === Math.round(rounded)) return `${Math.round(rounded)}`;
	if (rounded * 10 === Math.round(rounded * 10)) return rounded.toFixed(1);
	return rounded.toFixed(2);
}


// Map from canonical (lowercased) ingredient name to substitutions
const SUBSTITUTION_DB: Record<string, Substitution[]> = {
	'all-purpose flour': [
		{ name: 'whole wheat flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'May be denser. Use 7/8 cup per cup for lighter results. Adds nuttier flavor.', category: 'direct' },
		{ name: 'cake flour', ratio: 1.125, subUnit: null, ratioNote: '', notes: 'Makes lighter, more tender baked goods.', category: 'direct' },
		{ name: 'bread flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Slightly chewier results due to higher protein.', category: 'direct' },
		{ name: 'almond flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Gluten-free. May need extra egg for binding. Very different texture.', category: 'dietary' },
		{ name: 'oat flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Gluten-free (if certified). Blend rolled oats to make your own.', category: 'dietary' },
		{ name: 'coconut flour', ratio: 0.25, subUnit: null, ratioNote: '', notes: 'Very absorbent. Increase eggs and liquid significantly.', category: 'dietary' },
	],
	'bread flour': [
		{ name: 'all-purpose flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Slightly less chewy. Add 1 tsp vital wheat gluten per cup for closer results.', category: 'direct' },
		{ name: 'whole wheat flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Denser result, nuttier flavor.', category: 'direct' },
	],
	'cake flour': [
		{ name: 'all-purpose flour + cornstarch', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 1 cup minus 2 tbsp AP flour + 2 tbsp cornstarch', notes: 'Sift together twice for best results.', category: 'direct' },
	],
	'whole wheat flour': [
		{ name: 'all-purpose flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Lighter texture, less fiber.', category: 'direct' },
		{ name: 'white whole wheat flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Milder flavor than regular whole wheat.', category: 'direct' },
		{ name: 'spelt flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Similar nutrition, slightly sweeter. Not gluten-free.', category: 'direct' },
	],
	'almond flour': [
		{ name: 'all-purpose flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Not gluten-free. Reduce any added fat slightly.', category: 'direct' },
		{ name: 'sunflower seed flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Nut-free alternative. May turn green due to chlorophyll (harmless).', category: 'dietary' },
		{ name: 'oat flour', ratio: 1, subUnit: null, ratioNote: '', notes: 'Different flavor, works well in cookies and pancakes.', category: 'direct' },
	],
	'coconut flour': [
		{ name: 'almond flour', ratio: 3.5, subUnit: null, ratioNote: '', notes: 'Reduce eggs; almond flour is much less absorbent.', category: 'direct' },
	],
	butter: [
		{ name: 'coconut oil', ratio: 1, subUnit: null, ratioNote: '', notes: 'Solid at room temperature like butter. Slight coconut flavor.', category: 'direct' },
		{ name: 'olive oil', ratio: 0.75, subUnit: null, ratioNote: '', notes: 'Best for savory dishes. Changes flavor profile.', category: 'direct' },
		{ name: 'vegetable oil', ratio: 0.75, subUnit: null, ratioNote: '', notes: 'Neutral flavor. Won\'t cream the same way.', category: 'direct' },
		{ name: 'applesauce', ratio: 0.5, subUnit: null, ratioNote: '', notes: 'Low-fat option for baking. Adds moisture and sweetness.', category: 'dietary' },
		{ name: 'Greek yogurt', ratio: 0.5, subUnit: null, ratioNote: '', notes: 'Adds tang and moisture. Good for quick breads and muffins.', category: 'dietary' },
		{ name: 'vegan butter', ratio: 1, subUnit: null, ratioNote: '', notes: 'Dairy-free. Check brand for baking suitability.', category: 'dietary' },
		{ name: 'ghee', ratio: 1, subUnit: null, ratioNote: '', notes: 'Clarified butter, lactose-free. Higher smoke point.', category: 'direct' },
	],
	milk: [
		{ name: 'oat milk', ratio: 1, subUnit: null, ratioNote: '', notes: 'Creamy, slightly sweet. Good all-purpose dairy-free sub.', category: 'dietary' },
		{ name: 'almond milk', ratio: 1, subUnit: null, ratioNote: '', notes: 'Thinner than whole milk. Works in most recipes.', category: 'dietary' },
		{ name: 'soy milk', ratio: 1, subUnit: null, ratioNote: '', notes: 'Closest to dairy in protein content.', category: 'dietary' },
		{ name: 'coconut milk (carton)', ratio: 1, subUnit: null, ratioNote: '', notes: 'Slightly sweet. Not the same as canned coconut milk.', category: 'dietary' },
		{ name: 'half-and-half + water', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 1/2 cup half-and-half + 1/2 cup water', notes: 'When you only have half-and-half on hand.', category: 'emergency' },
		{ name: 'evaporated milk + water', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 1/2 cup evaporated milk + 1/2 cup water', notes: 'Slightly caramelized flavor.', category: 'emergency' },
	],
	'heavy cream': [
		{ name: 'coconut cream', ratio: 1, subUnit: null, ratioNote: '', notes: 'Dairy-free. Chill can and scoop thick cream from top.', category: 'dietary' },
		{ name: 'milk + butter', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 3/4 cup milk + 1/4 cup melted butter', notes: 'Won\'t whip, but works for sauces and baking.', category: 'emergency' },
		{ name: 'evaporated milk', ratio: 1, subUnit: null, ratioNote: '', notes: 'Won\'t whip, but good for cooking and baking.', category: 'emergency' },
		{ name: 'cashew cream', ratio: 1, subUnit: null, ratioNote: '', notes: 'Blend soaked cashews with water. Vegan, very creamy.', category: 'dietary' },
	],
	'sour cream': [
		{ name: 'Greek yogurt', ratio: 1, subUnit: null, ratioNote: '', notes: 'Slightly tangier. Works in baking and toppings.', category: 'direct' },
		{ name: 'cottage cheese (blended)', ratio: 1, subUnit: null, ratioNote: '', notes: 'Blend until smooth. Higher protein.', category: 'direct' },
		{ name: 'cashew cream + lemon juice', ratio: 1, subUnit: null, ratioNote: '', notes: 'Vegan option. Add 1 tbsp lemon juice per cup.', category: 'dietary' },
	],
	'cream cheese': [
		{ name: 'mascarpone', ratio: 1, subUnit: null, ratioNote: '', notes: 'Richer, slightly sweeter. Great for desserts.', category: 'direct' },
		{ name: 'ricotta (strained)', ratio: 1, subUnit: null, ratioNote: '', notes: 'Lighter, grainier. Strain overnight for best results.', category: 'direct' },
		{ name: 'Neufchâtel cheese', ratio: 1, subUnit: null, ratioNote: '', notes: 'Lower fat version. Sold as "1/3 less fat cream cheese."', category: 'direct' },
		{ name: 'silken tofu + lemon juice', ratio: 1, subUnit: null, ratioNote: '', notes: 'Vegan. Blend until smooth with 1 tbsp lemon per 8 oz.', category: 'dietary' },
	],
	'granulated sugar': [
		{ name: 'coconut sugar', ratio: 1, subUnit: null, ratioNote: '', notes: 'Lower glycemic index. Slight caramel flavor, darker color.', category: 'direct' },
		{ name: 'honey', ratio: 0.75, subUnit: null, ratioNote: '', notes: 'Reduce other liquids by 1/4 cup. Lower oven by 25°F.', category: 'direct' },
		{ name: 'maple syrup', ratio: 0.75, subUnit: null, ratioNote: '', notes: 'Reduce other liquids by 3 tbsp. Adds distinct flavor.', category: 'direct' },
		{ name: 'brown sugar', ratio: 1, subUnit: null, ratioNote: '', notes: 'Adds moisture and molasses flavor.', category: 'direct' },
		{ name: 'stevia', ratio: null, subUnit: 'tsp', ratioNote: 'Per 1 cup: 1 tsp stevia', notes: 'Zero calorie. Doesn\'t caramelize or add bulk.', category: 'dietary' },
		{ name: 'erythritol', ratio: 1, subUnit: null, ratioNote: '', notes: 'Sugar alcohol. Slight cooling sensation. Keto-friendly.', category: 'dietary' },
	],
	'brown sugar': [
		{ name: 'granulated sugar + molasses', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 1 cup sugar + 1 tbsp molasses', notes: 'Mix well. This is literally how brown sugar is made.', category: 'direct' },
		{ name: 'coconut sugar', ratio: 1, subUnit: null, ratioNote: '', notes: 'Similar caramel notes. Slightly different moisture.', category: 'direct' },
		{ name: 'maple sugar', ratio: 1, subUnit: null, ratioNote: '', notes: 'Distinct maple flavor. Expensive but delicious.', category: 'direct' },
	],
	'powdered sugar': [
		{ name: 'granulated sugar (blended)', ratio: 1, subUnit: null, ratioNote: '', notes: 'Blend granulated sugar + 1 tsp cornstarch per cup in blender until powdery.', category: 'direct' },
	],
	honey: [
		{ name: 'maple syrup', ratio: 1, subUnit: null, ratioNote: '', notes: 'Different flavor but similar consistency and sweetness.', category: 'direct' },
		{ name: 'agave nectar', ratio: 1, subUnit: null, ratioNote: '', notes: 'Milder flavor, slightly thinner.', category: 'direct' },
		{ name: 'corn syrup', ratio: 1, subUnit: null, ratioNote: '', notes: 'Less sweet, neutral flavor. Works for texture.', category: 'emergency' },
		{ name: 'brown rice syrup', ratio: 1, subUnit: null, ratioNote: '', notes: 'Less sweet, nutty flavor. Vegan.', category: 'dietary' },
	],
	'maple syrup': [
		{ name: 'honey', ratio: 1, subUnit: null, ratioNote: '', notes: 'Sweeter, different flavor profile.', category: 'direct' },
		{ name: 'agave nectar', ratio: 1, subUnit: null, ratioNote: '', notes: 'Vegan alternative with mild flavor.', category: 'direct' },
		{ name: 'brown sugar syrup', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: dissolve 1/2 cup brown sugar in 1/4 cup water', notes: 'Simmer until dissolved and slightly thickened.', category: 'emergency' },
	],
	eggs: [
		{ name: 'flax egg', ratio: null, subUnit: null, ratioNote: 'Per 1 egg: 1 tbsp ground flax + 3 tbsp water', notes: 'Let sit 5 min until gel forms. Best for baking.', category: 'dietary' },
		{ name: 'chia egg', ratio: null, subUnit: null, ratioNote: 'Per 1 egg: 1 tbsp chia seeds + 3 tbsp water', notes: 'Let sit 5 min. Visible specks in final product.', category: 'dietary' },
		{ name: 'applesauce', ratio: 0.25, subUnit: 'cup', ratioNote: '', notes: 'Adds moisture and binding. Best for cakes and muffins.', category: 'dietary' },
		{ name: 'mashed banana', ratio: 0.25, subUnit: 'cup', ratioNote: '', notes: 'Adds banana flavor. Good for pancakes and quick breads.', category: 'dietary' },
		{ name: 'silken tofu', ratio: 0.25, subUnit: 'cup', ratioNote: '', notes: 'Neutral flavor, good binding. Works in dense baked goods.', category: 'dietary' },
		{ name: 'commercial egg replacer', ratio: null, subUnit: null, ratioNote: 'Per package directions', notes: 'Bob\'s Red Mill, JUST Egg, etc. Most reliable vegan option.', category: 'dietary' },
	],
	'vegetable oil': [
		{ name: 'canola oil', ratio: 1, subUnit: null, ratioNote: '', notes: 'Neutral flavor, almost identical performance.', category: 'direct' },
		{ name: 'melted coconut oil', ratio: 1, subUnit: null, ratioNote: '', notes: 'May add slight coconut flavor. Solidifies when cool.', category: 'direct' },
		{ name: 'olive oil', ratio: 1, subUnit: null, ratioNote: '', notes: 'Adds flavor. Best for savory dishes.', category: 'direct' },
		{ name: 'applesauce', ratio: 1, subUnit: null, ratioNote: '', notes: 'Low-fat option for baking. Adds moisture and sweetness.', category: 'dietary' },
		{ name: 'melted butter', ratio: 1, subUnit: null, ratioNote: '', notes: 'Richer flavor, not dairy-free.', category: 'direct' },
		{ name: 'avocado oil', ratio: 1, subUnit: null, ratioNote: '', notes: 'Neutral flavor, high smoke point.', category: 'direct' },
	],
	'olive oil': [
		{ name: 'avocado oil', ratio: 1, subUnit: null, ratioNote: '', notes: 'Neutral flavor, higher smoke point. Good for high heat.', category: 'direct' },
		{ name: 'vegetable oil', ratio: 1, subUnit: null, ratioNote: '', notes: 'Neutral flavor. Loses the olive oil character.', category: 'direct' },
		{ name: 'coconut oil', ratio: 1, subUnit: null, ratioNote: '', notes: 'Slight coconut flavor. Good for medium heat.', category: 'direct' },
		{ name: 'butter', ratio: 1, subUnit: null, ratioNote: '', notes: 'Rich flavor, lower smoke point. Not dairy-free.', category: 'direct' },
	],
	'baking powder': [
		{ name: 'baking soda + cream of tartar', ratio: null, subUnit: null, ratioNote: 'Per 1 tsp: 1/4 tsp baking soda + 1/2 tsp cream of tartar', notes: 'Mix fresh each time. This is what baking powder is.', category: 'direct' },
		{ name: 'self-rising flour', ratio: null, subUnit: null, ratioNote: 'Replace AP flour with self-rising flour; omit baking powder and salt', notes: 'Self-rising flour already contains baking powder.', category: 'emergency' },
	],
	'baking soda': [
		{ name: 'baking powder', ratio: 3, subUnit: null, ratioNote: '', notes: 'Triple the amount. May affect flavor slightly.', category: 'direct' },
	],
	salt: [
		{ name: 'kosher salt', ratio: 1.5, subUnit: null, ratioNote: '', notes: 'Larger crystals, less dense. Diamond Crystal: use 2x.', category: 'direct' },
		{ name: 'sea salt', ratio: 1, subUnit: null, ratioNote: '', notes: 'Fine sea salt is 1:1. Adjust if using coarse grind.', category: 'direct' },
		{ name: 'soy sauce', ratio: null, subUnit: null, ratioNote: 'Per 1/2 tsp salt: 1 tbsp soy sauce', notes: 'Adds umami and color. Reduce other liquids slightly.', category: 'emergency' },
	],
	'cocoa powder': [
		{ name: 'cacao powder', ratio: 1, subUnit: null, ratioNote: '', notes: 'Less processed, slightly more bitter. Higher in nutrients.', category: 'direct' },
		{ name: 'carob powder', ratio: 1, subUnit: null, ratioNote: '', notes: 'Caffeine-free, naturally sweeter. Different flavor.', category: 'dietary' },
		{ name: 'dark chocolate (melted)', ratio: null, subUnit: null, ratioNote: 'Per 3 tbsp cocoa: 1 oz dark chocolate, reduce fat by 1 tbsp', notes: 'Richer flavor. Adjust sugar and fat accordingly.', category: 'emergency' },
	],
	cornstarch: [
		{ name: 'arrowroot powder', ratio: 1, subUnit: null, ratioNote: '', notes: 'Freezer-friendly, clear when cooked. Don\'t boil.', category: 'direct' },
		{ name: 'tapioca starch', ratio: 2, subUnit: null, ratioNote: '', notes: 'Makes sauces slightly more glossy/chewy.', category: 'direct' },
		{ name: 'all-purpose flour', ratio: 2, subUnit: null, ratioNote: '', notes: 'Makes opaque sauce. Cook longer to remove raw flour taste.', category: 'emergency' },
		{ name: 'potato starch', ratio: 1, subUnit: null, ratioNote: '', notes: 'Good for frying. Don\'t boil — breaks down at high heat.', category: 'direct' },
	],
	rice: [
		{ name: 'quinoa', ratio: 1, subUnit: null, ratioNote: '', notes: 'Higher protein. Cook with 1.5x water.', category: 'direct' },
		{ name: 'cauliflower rice', ratio: 1, subUnit: null, ratioNote: '', notes: 'Low-carb option. Much softer texture, cooks in 5 min.', category: 'dietary' },
		{ name: 'couscous', ratio: 1, subUnit: null, ratioNote: '', notes: 'Cooks faster (5 min). Actually a pasta, not a grain.', category: 'direct' },
		{ name: 'bulgur', ratio: 1, subUnit: null, ratioNote: '', notes: 'Nutty flavor, chewy texture. More fiber.', category: 'direct' },
		{ name: 'orzo', ratio: 1, subUnit: null, ratioNote: '', notes: 'Rice-shaped pasta. Different texture but similar use.', category: 'direct' },
	],
	'peanut butter': [
		{ name: 'almond butter', ratio: 1, subUnit: null, ratioNote: '', notes: 'Milder flavor, similar texture.', category: 'direct' },
		{ name: 'cashew butter', ratio: 1, subUnit: null, ratioNote: '', notes: 'Creamier, milder. Great for sauces.', category: 'direct' },
		{ name: 'sunflower seed butter', ratio: 1, subUnit: null, ratioNote: '', notes: 'Nut-free. May turn green in baked goods (harmless).', category: 'dietary' },
		{ name: 'tahini', ratio: 1, subUnit: null, ratioNote: '', notes: 'Sesame-based. More bitter, great in savory dishes.', category: 'direct' },
		{ name: 'soy nut butter', ratio: 1, subUnit: null, ratioNote: '', notes: 'Nut-free and peanut-free. Similar texture.', category: 'dietary' },
	],
	'rolled oats': [
		{ name: 'quick oats', ratio: 1, subUnit: null, ratioNote: '', notes: 'Finer texture. Cooks faster, softer in baking.', category: 'direct' },
		{ name: 'steel-cut oats', ratio: 1, subUnit: null, ratioNote: '', notes: 'Chewier, nuttier. Takes 20-30 min to cook.', category: 'direct' },
		{ name: 'quinoa flakes', ratio: 1, subUnit: null, ratioNote: '', notes: 'Gluten-free (oats may have cross-contamination).', category: 'dietary' },
	],
	water: [
		{ name: 'broth/stock', ratio: 1, subUnit: null, ratioNote: '', notes: 'Adds flavor and depth. Use for savory dishes.', category: 'direct' },
		{ name: 'coconut water', ratio: 1, subUnit: null, ratioNote: '', notes: 'Slightly sweet. Interesting in rice and smoothies.', category: 'direct' },
	],
	// Common non-DB ingredients
	garlic: [
		{ name: 'garlic powder', ratio: 0.125, subUnit: 'tsp', ratioNote: '', notes: 'Milder, more uniform flavor. Add to liquids.', category: 'emergency' },
		{ name: 'garlic paste', ratio: 0.5, subUnit: 'tsp', ratioNote: '', notes: 'Convenient, similar fresh flavor.', category: 'direct' },
		{ name: 'shallot', ratio: 0.4, subUnit: null, ratioNote: '', notes: 'Milder, slightly sweet garlic-onion flavor.', category: 'emergency' },
	],
	onion: [
		{ name: 'shallot', ratio: 3, subUnit: null, ratioNote: '', notes: 'Milder, more refined flavor.', category: 'direct' },
		{ name: 'onion powder', ratio: 1, subUnit: 'tbsp', ratioNote: '', notes: 'No texture. Good for seasoning.', category: 'emergency' },
		{ name: 'leek (white part)', ratio: 1, subUnit: null, ratioNote: '', notes: 'Milder, slightly sweet. Great in soups.', category: 'direct' },
		{ name: 'green onion/scallion', ratio: 7, subUnit: null, ratioNote: '', notes: 'Milder, best added later in cooking.', category: 'direct' },
	],
	lemon: [
		{ name: 'lime', ratio: 1, subUnit: null, ratioNote: '', notes: 'Slightly different flavor profile but works in most recipes.', category: 'direct' },
		{ name: 'white wine vinegar', ratio: 0.5, subUnit: null, ratioNote: '', notes: 'For acidity only, no citrus flavor.', category: 'emergency' },
		{ name: 'orange juice', ratio: 1, subUnit: null, ratioNote: '', notes: 'Sweeter, less tart. Best for dressings and marinades.', category: 'emergency' },
	],
	'chicken broth': [
		{ name: 'vegetable broth', ratio: 1, subUnit: null, ratioNote: '', notes: 'Vegetarian/vegan. Lighter flavor.', category: 'dietary' },
		{ name: 'bouillon cube + water', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 1 bouillon cube dissolved in 1 cup water', notes: 'Saltier, adjust seasoning. Always available in pantry.', category: 'emergency' },
		{ name: 'bone broth', ratio: 1, subUnit: null, ratioNote: '', notes: 'Richer, more collagen. Great for soups.', category: 'direct' },
		{ name: 'mushroom broth', ratio: 1, subUnit: null, ratioNote: '', notes: 'Deep umami flavor. Good vegetarian option.', category: 'dietary' },
	],
	'tomato paste': [
		{ name: 'tomato sauce', ratio: 3, subUnit: null, ratioNote: '', notes: 'Thinner. Reduce other liquids or cook down.', category: 'direct' },
		{ name: 'ketchup', ratio: 1, subUnit: null, ratioNote: '', notes: 'Sweeter with vinegar. Works in a pinch for stews.', category: 'emergency' },
		{ name: 'sun-dried tomatoes (blended)', ratio: 1, subUnit: null, ratioNote: '', notes: 'Intense flavor. Rehydrate and blend smooth.', category: 'direct' },
	],
	'soy sauce': [
		{ name: 'tamari', ratio: 1, subUnit: null, ratioNote: '', notes: 'Gluten-free, slightly richer. Nearly identical use.', category: 'dietary' },
		{ name: 'coconut aminos', ratio: 1, subUnit: null, ratioNote: '', notes: 'Soy-free and gluten-free. Slightly sweeter, less salty. Add a pinch of salt.', category: 'dietary' },
		{ name: 'Worcestershire sauce', ratio: 1, subUnit: null, ratioNote: '', notes: 'Different flavor but adds similar umami depth.', category: 'emergency' },
		{ name: 'liquid aminos', ratio: 1, subUnit: null, ratioNote: '', notes: 'Similar flavor, often lower sodium.', category: 'direct' },
	],
	'Parmesan cheese': [
		{ name: 'Pecorino Romano', ratio: 1, subUnit: null, ratioNote: '', notes: 'Sharper, saltier. Made from sheep\'s milk.', category: 'direct' },
		{ name: 'nutritional yeast', ratio: null, subUnit: null, ratioNote: 'Per 1/4 cup Parmesan: 2 tbsp nutritional yeast', notes: 'Vegan. Cheesy, nutty flavor. Great on pasta.', category: 'dietary' },
		{ name: 'Asiago cheese', ratio: 1, subUnit: null, ratioNote: '', notes: 'Similar aged cheese flavor, slightly milder.', category: 'direct' },
	],
	yogurt: [
		{ name: 'sour cream', ratio: 1, subUnit: null, ratioNote: '', notes: 'Higher fat, thicker. Works in baking and toppings.', category: 'direct' },
		{ name: 'coconut yogurt', ratio: 1, subUnit: null, ratioNote: '', notes: 'Dairy-free. Slight coconut flavor.', category: 'dietary' },
		{ name: 'buttermilk', ratio: 1, subUnit: null, ratioNote: '', notes: 'Thinner. Best for marinades and baking.', category: 'direct' },
	],
	buttermilk: [
		{ name: 'milk + vinegar', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 1 cup milk + 1 tbsp white vinegar or lemon juice', notes: 'Let stand 5-10 min until it curdles. Most common sub.', category: 'direct' },
		{ name: 'milk + cream of tartar', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 1 cup milk + 1 3/4 tsp cream of tartar', notes: 'No acid flavor. Good for biscuits.', category: 'direct' },
		{ name: 'yogurt + milk', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 3/4 cup yogurt + 1/4 cup milk', notes: 'Closest in tang and thickness.', category: 'direct' },
	],
	'vanilla extract': [
		{ name: 'vanilla bean paste', ratio: 1, subUnit: null, ratioNote: '', notes: 'Adds visible vanilla bean specks. Richer flavor.', category: 'direct' },
		{ name: 'vanilla bean', ratio: 0.5, subUnit: 'bean', ratioNote: '', notes: 'Split and scrape seeds. Most intense flavor.', category: 'direct' },
		{ name: 'almond extract', ratio: 0.5, subUnit: null, ratioNote: '', notes: 'Stronger flavor. Use less. Different but complementary.', category: 'emergency' },
		{ name: 'maple syrup', ratio: 1, subUnit: null, ratioNote: '', notes: 'Adds sweetness and warm flavor. Not a perfect match.', category: 'emergency' },
	],
	'white wine': [
		{ name: 'chicken or vegetable broth', ratio: 1, subUnit: null, ratioNote: '', notes: 'No alcohol. Loses acidity — add splash of lemon juice.', category: 'direct' },
		{ name: 'white wine vinegar + water', ratio: null, subUnit: null, ratioNote: 'Per 1/4 cup: 1 tbsp vinegar + rest water', notes: 'Mimics acidity without alcohol.', category: 'emergency' },
		{ name: 'dry vermouth', ratio: 1, subUnit: null, ratioNote: '', notes: 'Similar flavor profile. Lasts longer in the fridge.', category: 'direct' },
		{ name: 'apple cider', ratio: 1, subUnit: null, ratioNote: '', notes: 'Slightly sweeter but good acidity.', category: 'emergency' },
	],
	'red wine': [
		{ name: 'beef broth', ratio: 1, subUnit: null, ratioNote: '', notes: 'No alcohol. Add 1 tbsp red wine vinegar per cup for acidity.', category: 'direct' },
		{ name: 'grape juice + vinegar', ratio: null, subUnit: null, ratioNote: 'Per 1 cup: 1 cup grape juice + 1 tbsp red wine vinegar', notes: 'Sweeter. Reduce sugar in recipe if needed.', category: 'emergency' },
		{ name: 'pomegranate juice', ratio: 1, subUnit: null, ratioNote: '', notes: 'Good color and tart flavor.', category: 'emergency' },
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
