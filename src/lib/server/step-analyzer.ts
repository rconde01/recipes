import { env } from '$env/dynamic/private';

export interface AnalyzedStep {
	raw_text: string;
	duration_minutes: number;
	is_passive: boolean;
	equipment: string[];
	ingredients: string[];
	techniques: string[];
}

// Known equipment patterns
const EQUIPMENT: string[] = [
	'oven', 'stove', 'stovetop', 'grill', 'broiler', 'microwave',
	'slow cooker', 'pressure cooker', 'instant pot', 'air fryer', 'deep fryer',
	'stand mixer', 'hand mixer', 'food processor', 'blender', 'immersion blender',
	'baking sheet', 'sheet pan', 'cookie sheet', 'baking pan', 'cake pan',
	'muffin tin', 'loaf pan', 'springform pan', 'bundt pan', 'pie dish',
	'cast iron skillet', 'skillet', 'frying pan', 'saucepan', 'stockpot',
	'pot', 'dutch oven', 'wok', 'roasting pan', 'casserole dish', 'baking dish',
	'mixing bowl', 'bowl', 'whisk', 'spatula', 'wooden spoon', 'ladle', 'tongs',
	'rolling pin', 'cutting board', 'knife', 'peeler', 'grater', 'zester',
	'colander', 'strainer', 'sieve', 'wire rack', 'cooling rack',
	'parchment paper', 'aluminum foil', 'plastic wrap', 'thermometer',
	'pastry bag', 'piping bag', 'bench scraper', 'pastry brush',
	'mandoline', 'mortar and pestle', 'kitchen scale',
];

// Known cooking techniques
const TECHNIQUES: string[] = [
	'sauté', 'saute', 'sear', 'pan-fry', 'pan fry', 'deep-fry', 'deep fry',
	'stir-fry', 'stir fry', 'fry', 'brown', 'caramelize',
	'boil', 'simmer', 'poach', 'blanch', 'steam', 'braise', 'stew',
	'bake', 'roast', 'broil', 'grill', 'toast', 'char',
	'whisk', 'beat', 'fold', 'cream', 'knead', 'mix', 'stir', 'combine',
	'blend', 'puree', 'mash', 'whip', 'emulsify',
	'chop', 'dice', 'mince', 'slice', 'julienne', 'cube', 'grate', 'shred', 'zest',
	'marinate', 'brine', 'cure', 'rest', 'proof', 'rise',
	'reduce', 'deglaze', 'glaze', 'baste', 'drizzle',
	'strain', 'drain', 'sift', 'press',
	'preheat', 'temper', 'bloom', 'toast',
	'season', 'garnish', 'plate',
	'ferment', 'pickle', 'smoke',
	'chill', 'refrigerate', 'freeze', 'cool', 'thaw',
];

// Passive action keywords — steps where you're mostly waiting
const PASSIVE_KEYWORDS = [
	'bake', 'roast', 'broil', 'simmer', 'boil', 'slow cook',
	'let rest', 'let stand', 'let sit', 'let cool', 'let rise',
	'allow to', 'leave to', 'set aside', 'refrigerate', 'chill',
	'freeze', 'marinate', 'proof', 'rise', 'cool',
	'wait', 'until done', 'until golden', 'until tender',
];

// Time extraction patterns
const TIME_PATTERNS: { re: RegExp; toMinutes: (m: RegExpMatchArray) => number }[] = [
	// "1 hour and 30 minutes", "1 hour 30 minutes"
	{ re: /(\d+)\s*hours?\s*(?:and\s*)?(\d+)\s*min(?:ute)?s?/i, toMinutes: (m) => parseInt(m[1]) * 60 + parseInt(m[2]) },
	// "1.5 hours"
	{ re: /(\d+(?:\.\d+)?)\s*hours?/i, toMinutes: (m) => Math.round(parseFloat(m[1]) * 60) },
	// "30 minutes", "30 mins", "30-35 minutes"
	{ re: /(\d+)(?:\s*-\s*\d+)?\s*min(?:ute)?s?/i, toMinutes: (m) => parseInt(m[1]) },
	// "30 seconds"
	{ re: /(\d+)\s*seconds?/i, toMinutes: (m) => Math.round(parseInt(m[1]) / 60 * 10) / 10 },
	// "overnight"
	{ re: /\bovernight\b/i, toMinutes: () => 480 },
];

function extractDuration(text: string): number {
	for (const { re, toMinutes } of TIME_PATTERNS) {
		const match = text.match(re);
		if (match) return toMinutes(match);
	}
	return 0;
}

function extractEquipment(text: string): string[] {
	const lower = text.toLowerCase();
	const found = new Set<string>();
	// Sort by length descending so "cast iron skillet" matches before "skillet"
	const sorted = [...EQUIPMENT].sort((a, b) => b.length - a.length);
	for (const eq of sorted) {
		if (lower.includes(eq)) {
			// Don't add shorter variants if a longer one already matched
			let subsumed = false;
			for (const existing of found) {
				if (existing.includes(eq)) { subsumed = true; break; }
			}
			if (!subsumed) found.add(eq);
		}
	}
	return [...found];
}

function extractTechniques(text: string): string[] {
	const lower = text.toLowerCase();
	const found = new Set<string>();
	const sorted = [...TECHNIQUES].sort((a, b) => b.length - a.length);
	for (const tech of sorted) {
		// Word boundary match
		const re = new RegExp(`\\b${tech.replace(/-/g, '[-\\s]')}(?:s|d|ing|ed)?\\b`, 'i');
		if (re.test(lower)) {
			let subsumed = false;
			for (const existing of found) {
				if (existing.includes(tech)) { subsumed = true; break; }
			}
			if (!subsumed) found.add(tech);
		}
	}
	return [...found];
}

function extractIngredientRefs(text: string, recipeIngredients: string[]): string[] {
	const lower = text.toLowerCase();
	const found: string[] = [];
	for (const ing of recipeIngredients) {
		const ingLower = ing.toLowerCase();
		// Extract the name part (skip quantity/unit) — use last 2-3 words as name
		const words = ingLower.split(/\s+/);
		// Try progressively shorter suffixes
		for (let start = 0; start < Math.min(words.length, 3); start++) {
			const candidate = words.slice(start).join(' ');
			if (candidate.length >= 3 && lower.includes(candidate)) {
				found.push(ing);
				break;
			}
		}
	}
	return found;
}

function isPassiveStep(text: string): boolean {
	const lower = text.toLowerCase();
	for (const kw of PASSIVE_KEYWORDS) {
		if (lower.includes(kw)) return true;
	}
	// If the step has a long duration and mentions waiting-type words
	const duration = extractDuration(text);
	if (duration >= 15 && /\b(until|while|let)\b/i.test(text)) return true;
	return false;
}

export function analyzeStep(text: string, recipeIngredients: string[]): AnalyzedStep {
	return {
		raw_text: text,
		duration_minutes: extractDuration(text),
		is_passive: isPassiveStep(text),
		equipment: extractEquipment(text),
		ingredients: extractIngredientRefs(text, recipeIngredients),
		techniques: extractTechniques(text),
	};
}

export function analyzeAllSteps(instructions: string[], recipeIngredients: string[]): AnalyzedStep[] {
	return instructions.map((text) => analyzeStep(text, recipeIngredients));
}

// --- AI-powered step analysis (optional, uses Anthropic API) ---

interface AiStepAnalysis {
	duration_minutes: number;
	is_passive: boolean;
	equipment: string[];
	ingredients: string[];
	techniques: string[];
}

export async function analyzeStepsWithAi(
	instructions: string[],
	recipeIngredients: string[]
): Promise<AnalyzedStep[] | null> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) return null;

	const prompt = `Analyze each cooking instruction step. For each step, extract:
- duration_minutes: estimated time in minutes (0 if not mentioned or unclear)
- is_passive: true if the cook is mostly waiting (baking, resting, marinating, cooling), false if actively working
- equipment: array of equipment/tools used (e.g. "oven", "skillet", "whisk")
- ingredients: array of ingredients referenced from the recipe's ingredient list
- techniques: array of cooking techniques used (e.g. "sauté", "fold", "simmer")

Recipe ingredients for reference:
${recipeIngredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Instructions to analyze:
${instructions.map((inst, i) => `Step ${i + 1}: ${inst}`).join('\n')}

Respond with ONLY a JSON array of objects, one per step, in order. No markdown, no explanation.
Example: [{"duration_minutes":5,"is_passive":false,"equipment":["skillet"],"ingredients":["olive oil","garlic"],"techniques":["sauté"]}]`;

	try {
		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-haiku-4-5-20251001',
				max_tokens: 4096,
				messages: [{ role: 'user', content: prompt }]
			})
		});

		if (!response.ok) {
			console.error(`AI analysis failed: ${response.status}`);
			return null;
		}

		const data = await response.json();
		const text = data.content?.[0]?.text ?? '';

		// Parse JSON from response (handle potential markdown wrapping)
		const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '').trim();
		const parsed: AiStepAnalysis[] = JSON.parse(jsonStr);

		if (!Array.isArray(parsed) || parsed.length !== instructions.length) {
			console.error('AI returned unexpected number of steps');
			return null;
		}

		return parsed.map((step, i) => ({
			raw_text: instructions[i],
			duration_minutes: typeof step.duration_minutes === 'number' ? step.duration_minutes : 0,
			is_passive: Boolean(step.is_passive),
			equipment: Array.isArray(step.equipment) ? step.equipment.filter((e): e is string => typeof e === 'string') : [],
			ingredients: Array.isArray(step.ingredients) ? step.ingredients.filter((e): e is string => typeof e === 'string') : [],
			techniques: Array.isArray(step.techniques) ? step.techniques.filter((e): e is string => typeof e === 'string') : [],
		}));
	} catch (err) {
		console.error('AI step analysis error:', err);
		return null;
	}
}

/**
 * Analyze steps using AI if available, falling back to local regex analysis.
 */
export async function analyzeStepsSmart(
	instructions: string[],
	recipeIngredients: string[]
): Promise<AnalyzedStep[]> {
	// Try AI first
	const aiResult = await analyzeStepsWithAi(instructions, recipeIngredients);
	if (aiResult) return aiResult;

	// Fall back to local analysis
	return analyzeAllSteps(instructions, recipeIngredients);
}
