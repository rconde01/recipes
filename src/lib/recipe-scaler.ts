/**
 * Recipe scaler: scales ingredient quantities and updates directions text.
 * This module contains only local (non-AI) scaling logic and can be imported
 * from both client and server code.
 */

export interface ScaledIngredient {
	original: string;
	scaled: string;
	originalQty: number | null;
	scaledQty: number | null;
	unit: string;
	name: string;
}

export interface ScaleResult {
	ingredients: ScaledIngredient[];
	instructions: string[];
	scaleFactor: number;
}

// Regex to match quantity at the start of an ingredient string
const QTY_REGEX = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)\s*/;

export function parseFraction(s: string): number {
	s = s.trim();
	const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
	if (mixedMatch) {
		return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
	}
	const fracMatch = s.match(/^(\d+)\/(\d+)$/);
	if (fracMatch) {
		return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
	}
	return parseFloat(s) || 0;
}

export function formatQuantity(n: number): string {
	if (n === 0) return '0';

	const whole = Math.floor(n);
	const frac = n - whole;

	const fractions: [number, string][] = [
		[0.125, '1/8'], [0.25, '1/4'], [0.333, '1/3'],
		[0.375, '3/8'], [0.5, '1/2'], [0.625, '5/8'],
		[0.667, '2/3'], [0.75, '3/4'], [0.875, '7/8'],
	];

	for (const [val, str] of fractions) {
		if (Math.abs(frac - val) < 0.04) {
			return whole > 0 ? `${whole} ${str}` : str;
		}
	}

	if (frac < 0.04) return `${whole}`;

	const rounded = Math.round(n * 100) / 100;
	if (rounded === Math.round(rounded)) return `${Math.round(rounded)}`;
	if (rounded * 10 === Math.round(rounded * 10)) return rounded.toFixed(1);
	return rounded.toFixed(2);
}

/**
 * Scale a single ingredient line by a factor.
 */
export function scaleIngredient(raw: string, factor: number): ScaledIngredient {
	const match = raw.match(QTY_REGEX);
	if (!match) {
		return { original: raw, scaled: raw, originalQty: null, scaledQty: null, unit: '', name: raw };
	}

	const originalQty = parseFraction(match[1]);
	const scaledQty = originalQty * factor;
	const rest = raw.slice(match[0].length);

	const unitMatch = rest.match(/^(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|quarts?|pints?|gallons?|cloves?|cans?|packages?|bunche?s?|stalks?|pieces?|slices?|sticks?|heads?|sprigs?)\b\.?\s*/i);
	const unit = unitMatch ? unitMatch[1] : '';
	const name = unitMatch ? rest.slice(unitMatch[0].length) : rest;

	const scaledStr = `${formatQuantity(scaledQty)} ${rest}`;

	return {
		original: raw,
		scaled: scaledStr.trim(),
		originalQty,
		scaledQty,
		unit,
		name: name.trim()
	};
}

/**
 * Scale all quantities found in a direction/instruction text.
 */
export function scaleInstruction(text: string, factor: number): string {
	const unitPattern = /(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|quarts?|pints?|gallons?|cloves?)\b/gi;

	return text.replace(unitPattern, (_match, qty, unit) => {
		const parsed = parseFraction(qty);
		const scaled = parsed * factor;
		return `${formatQuantity(scaled)} ${unit}`;
	});
}

/**
 * Scale an entire recipe locally (no AI).
 */
export function scaleRecipeLocal(
	ingredients: string[],
	instructions: string[],
	factor: number
): ScaleResult {
	return {
		ingredients: ingredients.map((ing) => scaleIngredient(ing, factor)),
		instructions: instructions.map((inst) => scaleInstruction(inst, factor)),
		scaleFactor: factor,
	};
}
