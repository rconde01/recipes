import { findKnownIngredientByName } from './db';

export interface ParsedIngredient {
	raw_text: string;
	quantity: number | null;
	unit: string;
	name: string;
	known_ingredient_id: string | null;
}

// Common unit aliases mapped to canonical forms
const UNIT_MAP: Record<string, string> = {
	// Volume
	cup: 'cup', cups: 'cup', c: 'cup',
	tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp', tbl: 'tbsp',
	teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
	'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl oz': 'fl oz',
	liter: 'liter', liters: 'liter', litre: 'liter', litres: 'liter', l: 'liter',
	milliliter: 'ml', milliliters: 'ml', ml: 'ml',
	gallon: 'gallon', gallons: 'gallon', gal: 'gallon',
	quart: 'quart', quarts: 'quart', qt: 'quart',
	pint: 'pint', pints: 'pint', pt: 'pint',
	// Weight
	pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
	ounce: 'oz', ounces: 'oz', oz: 'oz',
	gram: 'g', grams: 'g', g: 'g',
	kilogram: 'kg', kilograms: 'kg', kg: 'kg',
	// Count/other
	pinch: 'pinch', pinches: 'pinch',
	dash: 'dash', dashes: 'dash',
	piece: 'piece', pieces: 'piece',
	slice: 'slice', slices: 'slice',
	clove: 'clove', cloves: 'clove',
	sprig: 'sprig', sprigs: 'sprig',
	bunch: 'bunch', bunches: 'bunch',
	can: 'can', cans: 'can',
	package: 'package', packages: 'package', pkg: 'package',
	stick: 'stick', sticks: 'stick',
	head: 'head', heads: 'head',
	stalk: 'stalk', stalks: 'stalk',
	large: 'large', medium: 'medium', small: 'small',
};

// Unicode fraction map
const UNICODE_FRACTIONS: Record<string, number> = {
	'\u00BC': 0.25,  // ¼
	'\u00BD': 0.5,   // ½
	'\u00BE': 0.75,  // ¾
	'\u2153': 1 / 3, // ⅓
	'\u2154': 2 / 3, // ⅔
	'\u2155': 0.2,   // ⅕
	'\u2156': 0.4,   // ⅖
	'\u2157': 0.6,   // ⅗
	'\u2158': 0.8,   // ⅘
	'\u2159': 1 / 6, // ⅙
	'\u215A': 5 / 6, // ⅚
	'\u215B': 0.125, // ⅛
	'\u215C': 0.375, // ⅜
	'\u215D': 0.625, // ⅝
	'\u215E': 0.875, // ⅞
};

function parseQuantity(text: string): { quantity: number | null; rest: string } {
	let str = text.trim();

	// Replace unicode fractions with decimal
	for (const [char, val] of Object.entries(UNICODE_FRACTIONS)) {
		if (str.includes(char)) {
			// Check for whole number before fraction: "1½"
			const idx = str.indexOf(char);
			const before = str.substring(0, idx).trim();
			const after = str.substring(idx + 1).trim();
			const whole = before.length > 0 ? parseFloat(before) : 0;
			if (!isNaN(whole)) {
				return { quantity: whole + val, rest: after };
			}
			return { quantity: val, rest: after };
		}
	}

	// Match patterns like "1 1/2", "1/2", "1.5", "1"
	const mixedFractionRe = /^(\d+)\s+(\d+)\/(\d+)/;
	const fractionRe = /^(\d+)\/(\d+)/;
	const decimalRe = /^(\d+(?:\.\d+)?)/;

	let match = str.match(mixedFractionRe);
	if (match) {
		const whole = parseInt(match[1], 10);
		const num = parseInt(match[2], 10);
		const den = parseInt(match[3], 10);
		return { quantity: whole + num / den, rest: str.substring(match[0].length).trim() };
	}

	match = str.match(fractionRe);
	if (match) {
		const num = parseInt(match[1], 10);
		const den = parseInt(match[2], 10);
		return { quantity: num / den, rest: str.substring(match[0].length).trim() };
	}

	match = str.match(decimalRe);
	if (match) {
		return { quantity: parseFloat(match[1]), rest: str.substring(match[0].length).trim() };
	}

	return { quantity: null, rest: str };
}

function parseUnit(text: string): { unit: string; rest: string } {
	const str = text.trim();

	// Try multi-word units first
	const multiWordUnits = ['fluid ounce', 'fluid ounces', 'fl oz'];
	for (const mwu of multiWordUnits) {
		if (str.toLowerCase().startsWith(mwu)) {
			const rest = str.substring(mwu.length).trim();
			// Remove trailing period or "of"
			return { unit: UNIT_MAP[mwu] ?? mwu, rest: rest.replace(/^\.?\s*(of\s+)?/, '') };
		}
	}

	// Try single-word unit at start
	const wordMatch = str.match(/^([a-zA-Z]+)\.?\s*/);
	if (wordMatch) {
		const candidate = wordMatch[1].toLowerCase();
		if (UNIT_MAP[candidate] !== undefined) {
			let rest = str.substring(wordMatch[0].length).trim();
			// Remove "of" after unit: "cups of flour"
			rest = rest.replace(/^of\s+/i, '');
			return { unit: UNIT_MAP[candidate], rest };
		}
	}

	return { unit: '', rest: str };
}

function cleanIngredientName(name: string): string {
	return name
		.replace(/\s*\(.*?\)\s*/g, ' ')   // remove parentheticals
		.replace(/,.*$/, '')                // remove everything after comma (prep instructions)
		.replace(/\s+/g, ' ')              // collapse whitespace
		.trim()
		.toLowerCase();
}

export function parseIngredientLine(raw: string): Omit<ParsedIngredient, 'known_ingredient_id'> {
	const { quantity, rest: afterQty } = parseQuantity(raw);
	const { unit, rest: afterUnit } = parseUnit(afterQty);
	const name = cleanIngredientName(afterUnit);

	return { raw_text: raw, quantity, unit, name };
}

export async function parseAndMatchIngredient(raw: string): Promise<ParsedIngredient> {
	const parsed = parseIngredientLine(raw);
	const known = parsed.name ? await findKnownIngredientByName(parsed.name) : undefined;
	return {
		...parsed,
		known_ingredient_id: known?.id ?? null
	};
}
