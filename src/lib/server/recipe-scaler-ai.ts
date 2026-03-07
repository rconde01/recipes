/**
 * AI-powered recipe scaling (server-only, uses Anthropic API).
 */

import { env } from '$env/dynamic/private';
import { scaleIngredient, scaleRecipeLocal } from '$lib/recipe-scaler';
import type { ScaleResult } from '$lib/recipe-scaler';

/**
 * Scale a recipe using AI for smarter adjustments.
 * Handles: cooking time changes, pan sizes, batch notes,
 * non-linear seasoning/leavener scaling.
 */
export async function scaleRecipeWithAi(
	ingredients: string[],
	instructions: string[],
	factor: number,
	originalYield: string
): Promise<ScaleResult | null> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) return null;

	const prompt = `Scale this recipe by a factor of ${factor}x (from "${originalYield || 'original yield'}" to ${factor}x that amount).

INGREDIENTS:
${ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

INSTRUCTIONS:
${instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

Scale the recipe intelligently:
1. Scale all ingredient quantities by ${factor}x
2. Update any quantities mentioned in the instructions
3. Adjust cooking times if the larger/smaller batch would need different timing
4. Note if pan sizes need to change or if batches are needed
5. Seasonings and leaveners may not scale linearly — adjust appropriately
6. Keep the same number of steps

Respond with ONLY a JSON object:
{
  "ingredients": ["scaled ingredient 1", "scaled ingredient 2", ...],
  "instructions": ["scaled instruction 1", "scaled instruction 2", ...]
}

No markdown, no explanation.`;

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
			console.error(`AI scaling failed: ${response.status}`);
			return null;
		}

		const data = await response.json();
		const text = data.content?.[0]?.text ?? '';
		const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '').trim();
		const parsed = JSON.parse(jsonStr);

		if (!Array.isArray(parsed.ingredients) || !Array.isArray(parsed.instructions)) {
			return null;
		}

		return {
			ingredients: parsed.ingredients.map((ing: string, i: number) => {
				const original = ingredients[i] ?? '';
				const origResult = scaleIngredient(original, 1);
				const scaledResult = scaleIngredient(ing, 1);
				return {
					original,
					scaled: ing,
					originalQty: origResult.originalQty,
					scaledQty: scaledResult.originalQty,
					unit: origResult.unit,
					name: origResult.name,
				};
			}),
			instructions: parsed.instructions,
			scaleFactor: factor,
		};
	} catch (err) {
		console.error('AI recipe scaling error:', err);
		return null;
	}
}

/**
 * Scale a recipe, using AI if available, falling back to local scaling.
 */
export async function scaleRecipeSmart(
	ingredients: string[],
	instructions: string[],
	factor: number,
	originalYield: string
): Promise<ScaleResult> {
	const aiResult = await scaleRecipeWithAi(ingredients, instructions, factor, originalYield);
	if (aiResult) return aiResult;
	return scaleRecipeLocal(ingredients, instructions, factor);
}
