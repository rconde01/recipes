<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { formatSubAmount } from '$lib/substitutions';
	import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_ORDER } from '$lib/ingredient-categories';
	import type { IngredientCategory } from '$lib/ingredient-categories';
	import { scaleRecipeLocal } from '$lib/recipe-scaler';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let editing = $state(false);
	let ingredients = $state(['']);
	let instructions = $state(['']);

	// Unit display mode
	let unitMode = $state<'default' | 'preference'>('preference');

	// Volume units in cups
	const toCups: Record<string, number> = {
		cup: 1, tbsp: 1/16, tsp: 1/48, ml: 1/236.588, l: 1000/236.588,
		'fl oz': 1/8, pint: 2, quart: 4, gallon: 16
	};

	// Weight units in grams
	const toGrams: Record<string, number> = {
		g: 1, kg: 1000, oz: 28.3495, lb: 453.592
	};

	function isVolumeUnit(u: string) { return toCups[u] != null; }
	function isWeightUnit(u: string) { return toGrams[u] != null; }

	// Auto-convert based on ingredient preference and user's weight unit setting
	function convertToPreferred(qty: number | null, unit: string, densityGPerCup: number | null, preferredUnit: string): { qty: string; unit: string } | null {
		if (qty == null || !unit) return null;

		const sourceIsVolume = isVolumeUnit(unit);
		const sourceIsWeight = isWeightUnit(unit);

		// No ingredient preference set — still normalize weight units to user's preferred abbreviation
		if (!preferredUnit) {
			if (sourceIsWeight) {
				const targetUnit = data.weightPreference || 'g';
				if (unit === targetUnit) return null;
				const grams = qty * toGrams[unit];
				const val = grams / toGrams[targetUnit];
				return { qty: formatConvertedQty(val, targetUnit), unit: targetUnit };
			}
			return null;
		}

		if (densityGPerCup == null) return null;

		const wantWeight = preferredUnit === 'weight';
		const wantVolume = preferredUnit === 'volume';
		if (!wantWeight && !wantVolume) return null;

		if (wantWeight) {
			const targetUnit = data.weightPreference || 'g';
			// Already in the preferred weight unit — no conversion needed
			if (sourceIsWeight && unit === targetUnit) return null;
			// Convert between weight units (e.g. oz -> g)
			if (sourceIsWeight) {
				const grams = qty * toGrams[unit];
				const val = grams / toGrams[targetUnit];
				return { qty: formatConvertedQty(val, targetUnit), unit: targetUnit };
			}
			// Convert from volume to weight
			if (!sourceIsVolume) return null;
			const cups = qty * toCups[unit];
			const grams = cups * densityGPerCup;
			const val = grams / toGrams[targetUnit];
			return { qty: formatConvertedQty(val, targetUnit), unit: targetUnit };
		} else {
			// Already in volume — no conversion needed
			if (sourceIsVolume) return null;
			if (!sourceIsWeight) return null;
			const grams = qty * toGrams[unit];
			const cups = grams / densityGPerCup;
			return { qty: formatConvertedQty(cups, 'cup'), unit: 'cup' };
		}
	}

	function formatConvertedQty(val: number, unit: string): string {
		if (unit === 'g') return Math.round(val).toString();
		if (unit === 'oz') return val >= 10 ? Math.round(val).toString() : val.toFixed(1).replace(/\.0$/, '');
		if (val >= 100) return Math.round(val).toString();
		if (val >= 10) return val.toFixed(1).replace(/\.0$/, '');
		return val.toFixed(2).replace(/\.?0+$/, '');
	}

	// Scaler state
	let scaleFactor = $state(1);
	let isScaling = $state(false);
	let scaleByIngredient = $state(false);
	let selectedIngredientIdx = $state(-1);
	let targetIngredientQty = $state('');

	// AI-scaled result (set via fetch, not nested form)
	let aiScaleResult = $state<{ ingredients: string[]; instructions: string[]; factor: number } | null>(null);

	// Parsed ingredient type (used in several derivations below)
	type ParsedIngredient = typeof data.parsedIngredients[0];

	// Ingredients that have parseable quantities (for scale-by-ingredient)
	let scalableIngredients = $derived(
		data.parsedIngredients
			.map((pi: ParsedIngredient, idx: number) => ({ idx, pi }))
			.filter(({ pi }: { pi: ParsedIngredient }) => pi.quantity != null && pi.quantity > 0)
	);

	// Compute scale factor from ingredient target
	function updateFactorFromIngredient() {
		if (selectedIngredientIdx < 0) return;
		const pi = data.parsedIngredients[selectedIngredientIdx];
		if (!pi || pi.quantity == null || pi.quantity <= 0) return;
		const target = parseFloat(targetIngredientQty);
		if (isNaN(target) || target <= 0) return;
		scaleFactor = target / pi.quantity;
	}

	// Trigger AI scaling via fetch
	async function triggerAiScale() {
		if (scaleFactor === 1 || isScaling) return;
		isScaling = true;
		try {
			const formData = new FormData();
			formData.set('scale_factor', String(scaleFactor));
			const res = await fetch(`?/scale`, { method: 'POST', body: formData });
			const result = await res.json();
			// SvelteKit returns { type, data } for form actions
			const d = result?.data;
			if (d && typeof d === 'string') {
				const parsed = JSON.parse(d);
				if (parsed?.scaled) {
					aiScaleResult = parsed.scaled;
				}
			} else if (d?.scaled) {
				aiScaleResult = d.scaled;
			} else if (result?.type === 'success' && result?.data) {
				// Try different response shapes
				const inner = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
				if (inner?.scaled) aiScaleResult = inner.scaled;
			}
		} catch (err) {
			console.error('AI scale failed:', err);
		} finally {
			isScaling = false;
		}
	}

	// Reset AI result when factor changes
	$effect(() => {
		if (aiScaleResult && aiScaleResult.factor !== scaleFactor) {
			aiScaleResult = null;
		}
	});

	// Local scaled result (instant, client-side)
	let localScaleResult = $derived(() => {
		if (scaleFactor === 1) return null;
		if (aiScaleResult && aiScaleResult.factor === scaleFactor) return null; // use AI result
		return scaleRecipeLocal(data.recipe.ingredients, data.recipe.instructions, scaleFactor);
	});

	// Active scale result: AI if available, else local
	let activeScale = $derived(() => {
		if (aiScaleResult && aiScaleResult.factor === scaleFactor) {
			return { ingredients: aiScaleResult.ingredients, instructions: aiScaleResult.instructions };
		}
		const local = localScaleResult();
		if (local) {
			return { ingredients: local.ingredients.map((si) => si.scaled), instructions: local.instructions };
		}
		return null;
	});

	// Display ingredients/instructions: scaled if active, original otherwise
	let displayIngredients = $derived(activeScale()?.ingredients ?? data.recipe.ingredients);
	let displayInstructions = $derived(activeScale()?.instructions ?? data.recipe.instructions);

	$effect(() => {
		const r = data.recipe;
		ingredients = r.ingredients.length > 0 ? [...r.ingredients] : [''];
		instructions = r.instructions.length > 0 ? [...r.instructions] : [''];
	});

	function addIngredient() {
		ingredients = [...ingredients, ''];
	}

	function removeIngredient(index: number) {
		ingredients = ingredients.filter((_, i) => i !== index);
		if (ingredients.length === 0) ingredients = [''];
	}

	function addInstruction() {
		instructions = [...instructions, ''];
	}

	function removeInstruction(index: number) {
		instructions = instructions.filter((_, i) => i !== index);
		if (instructions.length === 0) instructions = [''];
	}

	function autoResize(el: HTMLTextAreaElement) {
		el.style.height = '0';
		el.style.height = el.scrollHeight + 'px';
	}

	function autoResizeAll() {
		document.querySelectorAll<HTMLTextAreaElement>('textarea[name="ingredients"], textarea[name="instructions"], textarea[name="description"]').forEach(autoResize);
	}

	$effect(() => {
		// Re-run when ingredients or instructions change
		ingredients;
		instructions;
		// Tick to let DOM update
		requestAnimationFrame(autoResizeAll);
	});

	let totalMinutes = $derived(data.timelineSteps.reduce((sum: number, s: { duration_minutes: number }) => sum + s.duration_minutes, 0));
	let activeMinutes = $derived(data.timelineSteps.filter((s: { is_passive: boolean }) => !s.is_passive).reduce((sum: number, s: { duration_minutes: number }) => sum + s.duration_minutes, 0));
	let passiveMinutes = $derived(totalMinutes - activeMinutes);
	let allEquipment = $derived([...new Set(data.timelineSteps.flatMap((s: { equipment: string[] }) => s.equipment))]);
	let allTechniques = $derived([...new Set(data.timelineSteps.flatMap((s: { techniques: string[] }) => s.techniques))]);
	let maxDuration = $derived(Math.max(...data.timelineSteps.map((s: { duration_minutes: number }) => s.duration_minutes), 1));

	// Ingredient sort mode
	type SortMode = 'category' | 'order-used' | 'original';
	let sortMode = $state<SortMode>('order-used');

	// Group ingredients by food category or sort by order used
	let groupedIngredients = $derived(() => {
		const indexed = data.parsedIngredients.map((pi: ParsedIngredient, idx: number) => ({ idx, pi }));

		if (sortMode === 'order-used') {
			// Sort by first step that mentions the ingredient, then original order for unmatched
			const sorted = [...indexed].sort((a, b) => {
				const aStep = a.pi.firstUsedInStep < 0 ? 9999 : a.pi.firstUsedInStep;
				const bStep = b.pi.firstUsedInStep < 0 ? 9999 : b.pi.firstUsedInStep;
				if (aStep !== bStep) return aStep - bStep;
				return a.idx - b.idx;
			});
			// Group by step number
			const groups = new Map<string, { idx: number; pi: ParsedIngredient }[]>();
			for (const item of sorted) {
				const stepLabel = item.pi.firstUsedInStep >= 0
					? `Step ${item.pi.firstUsedInStep + 1}`
					: 'Not referenced in directions';
				if (!groups.has(stepLabel)) groups.set(stepLabel, []);
				groups.get(stepLabel)!.push(item);
			}
			return [...groups.entries()];
		}

		if (sortMode === 'original') {
			return [['All Ingredients', indexed]] as [string, { idx: number; pi: ParsedIngredient }[]][];
		}

		// Default: group by category
		const groups = new Map<string, { idx: number; pi: ParsedIngredient }[]>();
		indexed.forEach(({ idx, pi }: { idx: number; pi: ParsedIngredient }) => {
			const cat = pi.foodCategory as string;
			if (!groups.has(cat)) groups.set(cat, []);
			groups.get(cat)!.push({ idx, pi });
		});
		const sorted: [string, { idx: number; pi: ParsedIngredient }[]][] = [];
		for (const cat of CATEGORY_ORDER) {
			if (groups.has(cat)) sorted.push([cat, groups.get(cat)!]);
		}
		for (const [cat, items] of groups) {
			if (!sorted.find(([c]) => c === cat)) sorted.push([cat, items]);
		}
		return sorted;
	});

	// Mobile navigation state
	let mobileShowDetail = $state(true);

	// Substitution panel state
	let expandedIngredient = $state<number | null>(null);

	function toggleSubstitutions(index: number) {
		expandedIngredient = expandedIngredient === index ? null : index;
	}

	function formatYield(value: string): string {
		// Fix stored duplicates like "8, 8 servings" → "8 servings"
		const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
		if (parts.length <= 1) return value;
		return parts.find((s) => /[a-zA-Z]/.test(s)) || parts[0];
	}

	function formatTime(value: string): string {
		const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
		if (!match) return value;
		const h = parseInt(match[1] || '0');
		const m = parseInt(match[2] || '0');
		const parts: string[] = [];
		if (h > 0) parts.push(`${h} hr${h > 1 ? 's' : ''}`);
		if (m > 0) parts.push(`${m} min`);
		if (parts.length === 0) return value;
		return parts.join(' ');
	}

	function formatDuration(minutes: number): string {
		if (minutes === 0) return '0 min';
		if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
		if (minutes < 60) return `${Math.round(minutes)} min`;
		const h = Math.floor(minutes / 60);
		const m = Math.round(minutes % 60);
		if (m === 0) return `${h}h`;
		return `${h}h ${m}m`;
	}
</script>

<svelte:head>
	<title>{data.recipe.title} - Recipes</title>
</svelte:head>

<div class="recipes-layout" class:mobile-show-detail={mobileShowDetail}>
	<aside class="recipe-list">
		<div class="list-header">
			<h2>My Recipes</h2>
			<form method="POST" action="/recipes?/create">
				<button type="submit" class="btn-new">+ New</button>
			</form>
		</div>

		<ul>
			{#each data.recipes as recipe}
				<li>
					<a href="/recipes/{recipe.id}" class:active={recipe.id === data.recipe.id} onclick={() => mobileShowDetail = true}>
						{recipe.title}
					</a>
				</li>
			{/each}
		</ul>
	</aside>

	<section class="recipe-detail">
		<button class="mobile-back-btn" onclick={() => mobileShowDetail = false}>
			&#8592; All Recipes
		</button>
		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
		{#if form?.success}
			<p class="success">Recipe saved.</p>
		{/if}

		<div class="detail-header">
			<div class="header-top">
				<h1 class="title-display">{data.recipe.title}</h1>
				<div class="header-actions">
					{#if !editing}
						<button type="button" class="btn-edit" onclick={() => editing = true}>Edit</button>
					{/if}
				</div>
			</div>
			<div class="header-meta">
				<span class="recipe-type-badge" style="background: {data.recipeTypeColor}">{data.recipeTypeLabel}</span>
			</div>
		</div>

		{#if data.recipe.image_url}
			<div class="recipe-image">
				<img src={data.recipe.image_url} alt={data.recipe.title} />
			</div>
		{/if}

		<table class="recipe-meta">
			<tbody>
				{#if data.recipe.source_url}
					<tr>
						<th>Source</th>
						<td><a href={data.recipe.source_url} target="_blank" rel="noopener">{data.recipe.source_url}</a></td>
					</tr>
				{/if}
				{#if data.recipe.prep_time}
					<tr><th>Prep Time</th><td>{formatTime(data.recipe.prep_time)}</td></tr>
				{/if}
				{#if data.recipe.cook_time}
					<tr><th>Cook Time</th><td>{formatTime(data.recipe.cook_time)}</td></tr>
				{/if}
				{#if data.recipe.total_time}
					<tr><th>Total Time</th><td>{formatTime(data.recipe.total_time)}</td></tr>
				{/if}
				{#if data.recipe.yield}
					<tr><th>Yield</th><td>{formatYield(data.recipe.yield)}</td></tr>
				{/if}
				{#if data.recipe.category}
					<tr><th>Category</th><td>{data.recipe.category}</td></tr>
				{/if}
				{#if data.recipe.cuisine}
					<tr><th>Cuisine</th><td>{data.recipe.cuisine}</td></tr>
				{/if}
			</tbody>
		</table>

		{#if editing}
		<form method="POST" action="?/save">
			<input type="text" name="title" value={data.recipe.title} placeholder="Recipe title" class="title-input" required />

			<div class="header-meta" style="margin-bottom: 1rem;">
				<select name="recipe_type" class="recipe-type-select" value={data.recipeType}>
					{#each data.allRecipeTypes as rt}
						<option value={rt.value} selected={rt.value === data.recipeType}>{rt.label}</option>
					{/each}
				</select>
			</div>

			<!-- Hidden fields for extras so they persist on save -->
			<input type="hidden" name="source_url" value={data.recipe.source_url} />
			<input type="hidden" name="prep_time" value={data.recipe.prep_time} />
			<input type="hidden" name="cook_time" value={data.recipe.cook_time} />
			<input type="hidden" name="total_time" value={data.recipe.total_time} />
			<input type="hidden" name="yield" value={data.recipe.yield} />
			<input type="hidden" name="category" value={data.recipe.category} />
			<input type="hidden" name="cuisine" value={data.recipe.cuisine} />
			<input type="hidden" name="image_url" value={data.recipe.image_url} />

			<label class="field">
				Description
				<textarea name="description" rows="1" placeholder="Brief description..." oninput={(e) => autoResize(e.currentTarget)}>{data.recipe.description}</textarea>
			</label>

			<div class="field">
				<div class="field-header">
					<span>Ingredients</span>
					<button type="button" class="btn-add" onclick={addIngredient}>+ Add</button>
				</div>
				{#each ingredients as ingredient, i}
					<div class="list-item">
						<textarea name="ingredients" rows="1" placeholder="e.g. 2 cups flour" oninput={(e) => autoResize(e.currentTarget)}>{ingredient}</textarea>
						<button type="button" class="btn-remove" onclick={() => removeIngredient(i)}>&times;</button>
					</div>
				{/each}
			</div>

			<div class="field">
				<div class="field-header">
					<span>Instructions</span>
					<button type="button" class="btn-add" onclick={addInstruction}>+ Add</button>
				</div>
				{#each instructions as instruction, i}
					<div class="list-item">
						<span class="step-num">{i + 1}.</span>
						<div class="instruction-wrapper">
							<textarea name="instructions" rows="1" placeholder="Describe this step..." oninput={(e) => autoResize(e.currentTarget)}>{instruction}</textarea>
						</div>
						<button type="button" class="btn-remove" onclick={() => removeInstruction(i)}>&times;</button>
					</div>
				{/each}
			</div>

			<div class="edit-actions">
				<button type="submit" class="btn-save">Save</button>
				<button type="button" class="btn-cancel" onclick={() => editing = false}>Cancel</button>
				<button type="submit" formaction="?/delete" class="btn-delete" onclick={(e) => { if (!confirm('Delete this recipe?')) e.preventDefault(); }}>Delete</button>
			</div>
		</form>
		{:else}

		<!-- Recipe Scaler -->
		<div class="scaler-bar">
			<span class="scaler-label">Scale Recipe</span>
			<div class="scaler-presets">
				{#each [0.5, 1, 1.5, 2, 3, 4] as preset}
					<button
						type="button"
						class="scale-preset"
						class:active={scaleFactor === preset && !scaleByIngredient}
						onclick={() => { scaleByIngredient = false; scaleFactor = preset; }}
					>{preset}x</button>
				{/each}
			</div>
			<div class="scaler-custom">
				<input
					type="number"
					min="0.25"
					max="100"
					step="0.25"
					bind:value={scaleFactor}
					class="scale-input"
				/>
				<span class="scale-x">x</span>
			</div>
			{#if scalableIngredients.length > 0}
				<button
					type="button"
					class="scale-preset"
					class:active={scaleByIngredient}
					onclick={() => scaleByIngredient = !scaleByIngredient}
				>By ingredient</button>
			{/if}
			{#if scaleFactor !== 1}
				<button type="button" class="btn-ai-scale" disabled={isScaling} onclick={triggerAiScale}>
					{isScaling ? 'Scaling...' : 'AI Scale'}
				</button>
				<button type="button" class="scale-reset" onclick={() => { scaleFactor = 1; scaleByIngredient = false; selectedIngredientIdx = -1; targetIngredientQty = ''; }}>Reset</button>
			{/if}
			{#if scaleFactor !== 1}
				<span class="scale-status">
					{#if aiScaleResult && aiScaleResult.factor === scaleFactor}
						AI-scaled
					{:else}
						locally scaled
					{/if}
				</span>
			{/if}
		</div>
		{#if scaleByIngredient && scalableIngredients.length > 0}
			<div class="scale-by-ingredient">
				<span class="scaler-label">Scale to:</span>
				<input
					type="number"
					min="0.01"
					step="0.25"
					bind:value={targetIngredientQty}
					oninput={updateFactorFromIngredient}
					class="scale-input"
					placeholder="qty"
				/>
				<select
					class="ingredient-select"
					bind:value={selectedIngredientIdx}
					onchange={() => { if (targetIngredientQty) updateFactorFromIngredient(); }}
				>
					<option value={-1}>Choose ingredient...</option>
					{#each scalableIngredients as { idx, pi }}
						<option value={idx}>{pi.quantity} {pi.unit} {pi.name || pi.raw_text}</option>
					{/each}
				</select>
				{#if scaleFactor !== 1 && selectedIngredientIdx >= 0}
					<span class="scale-factor-display">= {scaleFactor.toFixed(2)}x</span>
				{/if}
			</div>
		{/if}

		{#if data.recipe.description}
			<div class="read-section">
				<h3>Description</h3>
				<p>{data.recipe.description}</p>
			</div>
		{/if}

		<div class="read-section">
			<div class="section-header-row">
				<h3>Ingredients{#if scaleFactor !== 1} <span class="scale-badge">{scaleFactor}x</span>{/if}</h3>
				{#if data.parsedIngredients.length > 0}
					<div class="unit-toggle">
						<label class="radio-label">
							<input type="radio" name="unitMode" value="default" bind:group={unitMode} />
							<span>Default</span>
						</label>
						<label class="radio-label">
							<input type="radio" name="unitMode" value="preference" bind:group={unitMode} />
							<span>Preference</span>
						</label>
					</div>
				{/if}
			</div>
			<ul class="read-list">
				{#each displayIngredients as ingredient, i}
					{@const pi = data.parsedIngredients[i]}
					{@const converted = unitMode === 'preference' && pi ? convertToPreferred(pi.quantity, pi.unit, pi.density_g_per_cup, pi.preferred_unit) : null}
					{#if converted}
						<li><span class="converted-ingredient">{ingredient.replace(/^[\d\s\/½¼¾⅓⅔⅛⅜⅝⅞.]+\s*\S+/, `${converted.qty} ${converted.unit}`)}</span></li>
					{:else}
						<li>{ingredient}</li>
					{/if}
				{/each}
			</ul>
		</div>

		<div class="read-section">
			<h3>Instructions{#if scaleFactor !== 1} <span class="scale-badge">{scaleFactor}x</span>{/if}</h3>
			<ol class="read-list">
				{#each displayInstructions as instruction}
					<li>{instruction}</li>
				{/each}
			</ol>
		</div>

		{#if data.parsedIngredients.length > 0}
				<div class="field">
					<div class="field-header">
						<span>Ingredient Breakdown</span>
						<div class="sort-toggle">
							<span class="sort-label">Sort:</span>
							<button class="sort-btn" class:active={sortMode === 'category'} onclick={() => sortMode = 'category'}>Category</button>
							<button class="sort-btn" class:active={sortMode === 'order-used'} onclick={() => sortMode = 'order-used'}>Order Used</button>
							<button class="sort-btn" class:active={sortMode === 'original'} onclick={() => sortMode = 'original'}>Original</button>
						</div>
					</div>
					<table class="ingredients-table">
						<thead>
							<tr>
								<th style="width: 45%">Ingredient</th>
								<th style="width: 15%">Qty</th>
								<th style="width: 15%">Unit</th>
								<th style="width: 25%">Category</th>
							</tr>
						</thead>
						<tbody>
							{#each groupedIngredients() as [category, items]}
								<tr class="category-header-row">
									<td colspan="4">
										{#if CATEGORY_COLORS[category as IngredientCategory]}
											<span class="category-dot" style="background: {CATEGORY_COLORS[category as IngredientCategory]}"></span>
											{CATEGORY_LABELS[category as IngredientCategory]}
										{:else}
											{category}
										{/if}
										<span class="category-count">({items.length})</span>
									</td>
								</tr>
								{#each items as { idx, pi }}
								{@const conv = unitMode === 'preference' ? convertToPreferred(pi.quantity, pi.unit, pi.density_g_per_cup, pi.preferred_unit) : null}
									<tr
										class:has-subs={pi.substitutions.length > 0}
										class:expanded={expandedIngredient === idx}
										onclick={() => { if (pi.substitutions.length > 0) toggleSubstitutions(idx); }}
									>
										<td>
											<span class="ingredient-name">
												{pi.name || pi.raw_text}
												{#if pi.substitutions.length > 0}
													<span class="sub-indicator" title="Click to see substitutions">
														{expandedIngredient === idx ? '▾' : '▸'} {pi.substitutions.length}
													</span>
												{/if}
											</span>
										</td>
									<td>{conv ? conv.qty : (pi.quantity != null ? pi.quantity : '—')}</td>
									<td>{conv ? conv.unit : (pi.unit || '—')}</td>
										<td>
											<span class="cat-badge" style="background: {CATEGORY_COLORS[pi.foodCategory as IngredientCategory] ?? '#757575'}">{CATEGORY_LABELS[pi.foodCategory as IngredientCategory] ?? pi.foodCategory}</span>
										</td>
									</tr>
									{#if expandedIngredient === idx && pi.substitutions.length > 0}
										<tr class="sub-row">
											<td colspan="4">
												<div class="sub-panel">
													<div class="sub-panel-header">Substitutions for <strong>{pi.known_name || pi.name}</strong></div>
													<div class="sub-list">
														{#each pi.substitutions as sub}
															{@const amount = formatSubAmount(pi.quantity, pi.unit, sub)}
															<div class="sub-card" class:sub-direct={sub.category === 'direct'} class:sub-dietary={sub.category === 'dietary'} class:sub-emergency={sub.category === 'emergency'}>
																<div class="sub-card-top">
																	<span class="sub-name">{sub.name}</span>
																	<span class="sub-cat-badge">{sub.category}</span>
																</div>
																{#if amount}
																	<div class="sub-amount">{amount}</div>
																{/if}
																{#if sub.ratioNote && !amount.includes(sub.name)}
																	<div class="sub-ratio-note">{sub.ratioNote}</div>
																{/if}
																<div class="sub-notes">{sub.notes}</div>
															</div>
														{/each}
													</div>
												</div>
											</td>
										</tr>
									{/if}
								{/each}
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}

		{#if data.timelineSteps.length > 0}

			<div class="timeline-section">
				<h3>Recipe Timeline</h3>

				<div class="timeline-summary">
					<div class="summary-item">
						<span class="summary-label">Total</span>
						<span class="summary-value">{formatDuration(totalMinutes)}</span>
					</div>
					<div class="summary-item">
						<span class="summary-label">Active</span>
						<span class="summary-value active-text">{formatDuration(activeMinutes)}</span>
					</div>
					<div class="summary-item">
						<span class="summary-label">Passive</span>
						<span class="summary-value passive-text">{formatDuration(passiveMinutes)}</span>
					</div>
					{#if allEquipment.length > 0}
						<div class="summary-item wide">
							<span class="summary-label">Equipment</span>
							<span class="summary-value">{allEquipment.join(', ')}</span>
						</div>
					{/if}
					{#if allTechniques.length > 0}
						<div class="summary-item wide">
							<span class="summary-label">Techniques</span>
							<span class="summary-value">{allTechniques.join(', ')}</span>
						</div>
					{/if}
				</div>

				<div class="timeline-chart">
					{#each data.timelineSteps as step, i}
						{@const barWidth = step.duration_minutes > 0 ? Math.max((step.duration_minutes / maxDuration) * 100, 8) : 8}
						<div class="timeline-row">
							<div class="timeline-step-num">{i + 1}</div>
							<div class="timeline-bar-container">
								<div
									class="timeline-bar"
									class:passive={step.is_passive}
									style="width: {barWidth}%"
								>
									<span class="bar-label">
										{#if step.duration_minutes > 0}
											{formatDuration(step.duration_minutes)}
										{:else}
											—
										{/if}
									</span>
								</div>
								<div class="timeline-details">
									<p class="step-text">{step.raw_text.length > 100 ? step.raw_text.slice(0, 100) + '...' : step.raw_text}</p>
									<div class="step-tags">
										{#if step.is_passive}
											<span class="tag tag-passive">passive</span>
										{:else}
											<span class="tag tag-active">active</span>
										{/if}
										{#each step.equipment as eq}
											<span class="tag tag-equipment">{eq}</span>
										{/each}
										{#each step.techniques as tech}
											<span class="tag tag-technique">{tech}</span>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<div class="timeline-legend">
					<span class="legend-item"><span class="legend-swatch active-swatch"></span> Active (hands-on)</span>
					<span class="legend-item"><span class="legend-swatch passive-swatch"></span> Passive (waiting)</span>
				</div>
			</div>
		{/if}
	</section>
</div>

<style>
	.recipes-layout {
		display: flex;
		gap: 0;
		margin: 0 auto;
		max-width: none;
	}

	aside.recipe-list {
		width: 280px;
		min-width: 280px;
		background: #fff;
		border-right: 1px solid #e0e0e0;
		display: flex;
		flex-direction: column;
	}

	.list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.list-header h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.btn-new {
		background: #e65100;
		color: white;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.btn-new:hover {
		background: #bf360c;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
	}

	li a {
		display: block;
		padding: 0.75rem 1rem;
		color: #333;
		text-decoration: none;
		border-bottom: 1px solid #f0f0f0;
	}

	li a:hover {
		background: #fff3e0;
	}

	li a.active {
		background: #fff3e0;
		border-left: 3px solid #e65100;
		font-weight: 600;
	}

	section.recipe-detail {
		flex: 1;
		min-width: 0;
		padding: 2rem;
		box-sizing: border-box;
	}

	.detail-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.header-top {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.title-display {
		flex: 1;
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		min-width: 0;
		word-break: break-word;
	}

	.btn-edit {
		background: none;
		border: 1px solid #e65100;
		color: #e65100;
		padding: 0.4rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	.btn-edit:hover {
		background: #fff3e0;
	}

	.btn-cancel {
		background: none;
		border: 1px solid #ccc;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	.btn-cancel:hover {
		background: #f5f5f5;
	}

	.edit-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
	}

	.read-section {
		margin-bottom: 1.5rem;
	}

	.read-section h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.read-section p {
		margin: 0;
		line-height: 1.5;
		color: #444;
	}

	.section-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.unit-toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		color: #555;
	}

	.radio-label input[type='radio'] {
		accent-color: #e65100;
		width: 14px;
		height: 14px;
	}

	.converted-ingredient {
		color: #e65100;
	}

	.read-list {
		margin: 0;
		padding-left: 1.25rem;
		line-height: 1.6;
		color: #444;
		list-style: disc;
	}

	ol.read-list {
		list-style: decimal;
	}

	.read-list li {
		margin-bottom: 0.25rem;
	}

	.header-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.title-input {
		flex: 1;
		font-size: 1.5rem;
		font-weight: 700;
		border: none;
		border-bottom: 2px solid #e0e0e0;
		padding: 0.3rem 0;
		background: transparent;
		outline: none;
		min-width: 0;
	}

	.title-input:focus {
		border-color: #e65100;
	}

	.recipe-type-badge {
		display: inline-block;
		font-size: 0.75rem;
		color: #fff;
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	.recipe-type-select {
		padding: 0.25rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.85rem;
		background: #fff;
		cursor: pointer;
	}

	.recipe-type-select:hover {
		border-color: #e65100;
	}

	.recipe-image {
		margin-bottom: 1.5rem;
	}

	.recipe-image img {
		max-width: 100%;
		max-height: 300px;
		border-radius: 8px;
		object-fit: cover;
	}

	.recipe-meta {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1.5rem;
		font-size: 0.95rem;
	}

	.recipe-meta th {
		text-align: left;
		padding: 0.5rem 1rem 0.5rem 0;
		color: #666;
		font-weight: 600;
		white-space: nowrap;
		border-bottom: 1px solid #f0f0f0;
		width: 120px;
	}

	.recipe-meta td {
		padding: 0.5rem 0;
		border-bottom: 1px solid #f0f0f0;
		word-break: break-all;
	}

	.recipe-meta a {
		color: #e65100;
		text-decoration: none;
	}

	.recipe-meta a:hover {
		text-decoration: underline;
	}

	.ingredients-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
		margin-top: 0.5rem;
		table-layout: fixed;
	}

	.ingredients-table th {
		text-align: left;
		padding: 0.5rem 0.75rem;
		background: #f5f5f5;
		border-bottom: 2px solid #e0e0e0;
		font-weight: 600;
		color: #555;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.ingredients-table td {
		padding: 0.4rem 0.75rem;
		border-bottom: 1px solid #f0f0f0;
		word-break: break-word;
		overflow-wrap: break-word;
	}

	.ingredients-table td:last-child {
		word-break: normal;
		overflow-wrap: break-word;
	}

	.ingredients-table tr:hover {
		background: #fafafa;
	}

	.matched {
		color: #2e7d32;
		font-weight: 500;
	}

	.unmatched {
		color: #999;
		font-style: italic;
	}

	/* Scaler */
	.scaler-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: #f5f5f5;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.scaler-label {
		font-weight: 600;
		font-size: 0.85rem;
		color: #555;
	}

	.scaler-presets {
		display: flex;
		gap: 0.25rem;
	}

	.scale-preset {
		background: #fff;
		border: 1px solid #ccc;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 500;
	}

	.scale-preset:hover { background: #f0f0f0; }

	.scale-preset.active {
		background: #e65100;
		color: #fff;
		border-color: #e65100;
	}

	.scaler-custom {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.scale-input {
		width: 4rem;
		padding: 0.2rem 0.4rem;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 0.85rem;
		text-align: center;
	}

	.scale-x {
		font-size: 0.8rem;
		color: #888;
		font-weight: 600;
	}

	.scale-by-ingredient {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #fafafa;
		border: 1px solid #e0e0e0;
		border-top: none;
		border-radius: 0 0 6px 6px;
		margin-bottom: 1.5rem;
		margin-top: -1.5rem;
		flex-wrap: wrap;
	}

	.ingredient-select {
		padding: 0.25rem 0.4rem;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 0.85rem;
		max-width: 300px;
	}

	.scale-factor-display {
		font-size: 0.8rem;
		color: #e65100;
		font-weight: 600;
	}

	.btn-ai-scale {
		background: #1565c0;
		color: white;
		border: none;
		padding: 0.25rem 0.6rem;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.btn-ai-scale:hover { background: #0d47a1; }
	.btn-ai-scale:disabled { opacity: 0.5; cursor: not-allowed; }

	.scale-reset {
		background: none;
		border: 1px solid #ccc;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.75rem;
		color: #888;
	}

	.scale-reset:hover { background: #fff; }

	.scale-status {
		font-size: 0.7rem;
		color: #888;
		font-style: italic;
	}

	.scale-badge {
		display: inline-block;
		font-size: 0.7rem;
		background: #e65100;
		color: #fff;
		padding: 0.05rem 0.35rem;
		border-radius: 3px;
		font-weight: 600;
		vertical-align: middle;
		margin-left: 0.3rem;
	}

	.scaled-value {
		font-size: 0.8rem;
		color: #e65100;
		font-weight: 600;
		padding: 0.3rem 0.5rem;
		background: #fff3e0;
		border-radius: 3px;
		border: 1px solid #ffcc80;
		word-break: break-word;
	}

	.instruction-wrapper {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.instruction-wrapper textarea {
		width: 100%;
	}

	.scaled-instruction {
		font-size: 0.82rem;
		color: #e65100;
		background: #fff3e0;
		padding: 0.4rem 0.5rem;
		border-radius: 3px;
		border: 1px solid #ffcc80;
		line-height: 1.35;
	}

	/* Sort toggle */
	.sort-toggle {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.sort-label {
		font-size: 0.75rem;
		color: #888;
		font-weight: 500;
	}

	.sort-btn {
		background: #fff;
		border: 1px solid #ccc;
		padding: 0.15rem 0.5rem;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.7rem;
		font-weight: 500;
		color: #666;
	}

	.sort-btn:hover { background: #f5f5f5; }
	.sort-btn.active {
		background: #e65100;
		color: #fff;
		border-color: #e65100;
	}

	/* Category styles */
	.category-header-row td {
		padding: 0.5rem 0.75rem 0.3rem;
		font-weight: 700;
		font-size: 0.8rem;
		color: #333;
		background: #fafafa;
		border-bottom: 1px solid #e0e0e0;
		border-top: 1px solid #e0e0e0;
	}

	.category-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-right: 0.3rem;
		vertical-align: middle;
	}

	.category-count {
		font-weight: 400;
		color: #999;
		font-size: 0.75rem;
		margin-left: 0.2rem;
	}

	.cat-badge {
		display: inline;
		font-size: 0.6rem;
		color: #fff;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}

	/* Substitution styles */
	.ingredients-table tr.has-subs {
		cursor: pointer;
	}

	.ingredients-table tr.has-subs:hover {
		background: #fff8e1;
	}

	.ingredients-table tr.expanded {
		background: #fff3e0;
	}

	.ingredient-name {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.sub-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		font-size: 0.7rem;
		color: #e65100;
		font-weight: 600;
		background: #fff3e0;
		padding: 0.05rem 0.35rem;
		border-radius: 3px;
		white-space: nowrap;
	}

	.sub-row td {
		padding: 0 !important;
		border-bottom: 2px solid #e65100;
	}

	.sub-panel {
		background: #fafafa;
		padding: 0.75rem;
		border-top: 1px solid #e0e0e0;
	}

	.sub-panel-header {
		font-size: 0.85rem;
		margin-bottom: 0.5rem;
		color: #555;
	}

	.sub-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.5rem;
	}

	.sub-card {
		background: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 0.6rem;
		font-size: 0.82rem;
		line-height: 1.35;
		border-left: 3px solid #ccc;
	}

	.sub-card.sub-direct {
		border-left-color: #2e7d32;
	}

	.sub-card.sub-dietary {
		border-left-color: #1565c0;
	}

	.sub-card.sub-emergency {
		border-left-color: #e65100;
	}

	.sub-card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.sub-name {
		font-weight: 600;
		color: #333;
	}

	.sub-cat-badge {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-weight: 600;
	}

	.sub-direct .sub-cat-badge {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.sub-dietary .sub-cat-badge {
		background: #e3f2fd;
		color: #1565c0;
	}

	.sub-emergency .sub-cat-badge {
		background: #fff3e0;
		color: #e65100;
	}

	.sub-amount {
		font-weight: 600;
		color: #333;
		font-size: 0.85rem;
		margin-bottom: 0.15rem;
		background: #f5f5f5;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		display: inline-block;
	}

	.sub-ratio-note {
		font-weight: 500;
		color: #555;
		font-size: 0.78rem;
		margin-bottom: 0.15rem;
		font-style: italic;
	}

	.sub-notes {
		color: #777;
		font-size: 0.78rem;
	}

	.override-badge {
		display: inline-block;
		font-size: 0.7rem;
		background: #e3f2fd;
		color: #1565c0;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-weight: 600;
		vertical-align: middle;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-save {
		background: #e65100;
		color: white;
		border: none;
		padding: 0.5rem 1.2rem;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
	}

	.btn-save:hover {
		background: #bf360c;
	}

	.btn-delete {
		background: none;
		color: #c62828;
		border: 1px solid #c62828;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.btn-delete:hover {
		background: #ffebee;
	}

	.field {
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-weight: 500;
	}

	.field textarea,
	.field input[type='text'] {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.95rem;
		font-family: inherit;
		resize: none;
		overflow: hidden;
		box-sizing: border-box;
	}


	.field-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 600;
	}

	.btn-add {
		background: none;
		border: 1px solid #ccc;
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.btn-add:hover {
		background: #f5f5f5;
	}

	.list-item {
		display: flex;
		align-items: start;
		gap: 0.5rem;
	}

	.list-item > input,
	.list-item > textarea {
		flex: 1;
		min-width: 0;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.95rem;
		font-family: inherit;
	}

	.instruction-wrapper textarea {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.95rem;
		font-family: inherit;
	}

	.step-num {
		padding-top: 0.5rem;
		color: #999;
		font-weight: 600;
		min-width: 1.5rem;
	}

	.btn-remove {
		background: none;
		border: none;
		color: #999;
		font-size: 1.2rem;
		cursor: pointer;
		padding: 0.3rem;
	}

	.btn-remove:hover {
		color: #c62828;
	}

	.error {
		color: #c62828;
		background: #ffebee;
		padding: 0.7rem;
		border-radius: 4px;
	}

	.success {
		color: #2e7d32;
		background: #e8f5e9;
		padding: 0.7rem;
		border-radius: 4px;
	}

	/* Timeline */
	.timeline-section {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 2px solid #e0e0e0;
	}

	.timeline-section h3 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
	}

	.timeline-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: #fafafa;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.summary-item.wide {
		flex-basis: 100%;
	}

	.summary-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #888;
		font-weight: 600;
	}

	.summary-value {
		font-size: 0.95rem;
		font-weight: 500;
	}

	.active-text { color: #e65100; }
	.passive-text { color: #1565c0; }

	.timeline-chart {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.timeline-row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.timeline-step-num {
		min-width: 1.5rem;
		font-weight: 700;
		color: #999;
		padding-top: 0.35rem;
		text-align: right;
	}

	.timeline-bar-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.timeline-bar {
		height: 28px;
		background: #e65100;
		border-radius: 4px;
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
		min-width: 60px;
		transition: width 0.3s ease;
	}

	.timeline-bar.passive {
		background: #90caf9;
	}

	.bar-label {
		color: white;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.timeline-details {
		padding-left: 0.25rem;
	}

	.step-text {
		margin: 0;
		font-size: 0.85rem;
		color: #555;
		line-height: 1.3;
	}

	.step-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.3rem;
	}

	.tag {
		display: inline-block;
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		font-weight: 500;
	}

	.tag-active {
		background: #fff3e0;
		color: #e65100;
	}

	.tag-passive {
		background: #e3f2fd;
		color: #1565c0;
	}

	.tag-equipment {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.tag-technique {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.timeline-legend {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
		font-size: 0.8rem;
		color: #888;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.legend-swatch {
		display: inline-block;
		width: 14px;
		height: 14px;
		border-radius: 3px;
	}

	.active-swatch { background: #e65100; }
	.passive-swatch { background: #90caf9; }

	/* Mobile back button — hidden on desktop */
	.mobile-back-btn {
		display: none;
	}

	/* Mobile layout */
	@media (max-width: 768px) {
		.recipes-layout {
			display: block;
			position: relative;
		}

		aside.recipe-list {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 200;
			background: #fff;
			transform: translateX(0);
			transition: transform 0.3s ease;
			overflow-y: auto;
		}

		/* When detail is shown, slide the list off-screen to the left */
		.recipes-layout.mobile-show-detail aside.recipe-list {
			transform: translateX(-100%);
			pointer-events: none;
		}

		section.recipe-detail {
			width: 100%;
			min-width: 0;
			padding: 1rem;
			box-sizing: border-box;
		}

		.mobile-back-btn {
			display: inline-flex;
			align-items: center;
			gap: 0.3rem;
			background: none;
			border: none;
			color: #e65100;
			font-size: 0.9rem;
			font-weight: 600;
			cursor: pointer;
			padding: 0.4rem 0;
			margin-bottom: 0.5rem;
		}

		.mobile-back-btn:hover {
			color: #bf360c;
		}

		.header-top {
			flex-wrap: wrap;
		}

		.title-input {
			flex-basis: 100%;
			font-size: 1.2rem;
		}

		.header-actions {
			width: 100%;
			justify-content: flex-start;
		}

		.header-meta {
			flex-wrap: wrap;
		}

		.scaler-bar {
			flex-wrap: wrap;
		}

		.recipe-meta th {
			width: auto;
		}

		.ingredients-table {
			font-size: 0.8rem;
		}

		.sub-list {
			grid-template-columns: 1fr;
		}

		.timeline-summary {
			flex-direction: column;
			gap: 0.5rem;
		}
	}
</style>
