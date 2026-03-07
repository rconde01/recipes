<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { formatSubAmount } from '$lib/substitutions';
	import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_ORDER } from '$lib/ingredient-categories';
	import type { IngredientCategory } from '$lib/ingredient-categories';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let ingredients = $state(['']);
	let instructions = $state(['']);

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

	let totalMinutes = $derived(data.timelineSteps.reduce((sum: number, s: { duration_minutes: number }) => sum + s.duration_minutes, 0));
	let activeMinutes = $derived(data.timelineSteps.filter((s: { is_passive: boolean }) => !s.is_passive).reduce((sum: number, s: { duration_minutes: number }) => sum + s.duration_minutes, 0));
	let passiveMinutes = $derived(totalMinutes - activeMinutes);
	let allEquipment = $derived([...new Set(data.timelineSteps.flatMap((s: { equipment: string[] }) => s.equipment))]);
	let allTechniques = $derived([...new Set(data.timelineSteps.flatMap((s: { techniques: string[] }) => s.techniques))]);
	let maxDuration = $derived(Math.max(...data.timelineSteps.map((s: { duration_minutes: number }) => s.duration_minutes), 1));

	// Group ingredients by food category
	type ParsedIngredient = typeof data.parsedIngredients[0];
	let groupedIngredients = $derived(() => {
		const groups = new Map<string, { idx: number; pi: ParsedIngredient }[]>();
		data.parsedIngredients.forEach((pi: ParsedIngredient, idx: number) => {
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

	// Substitution panel state
	let expandedIngredient = $state<number | null>(null);

	function toggleSubstitutions(index: number) {
		expandedIngredient = expandedIngredient === index ? null : index;
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

<div class="recipes-layout">
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
					<a href="/recipes/{recipe.id}" class:active={recipe.id === data.recipe.id}>
						{recipe.title}
					</a>
				</li>
			{/each}
		</ul>
	</aside>

	<section class="recipe-detail">
		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
		{#if form?.success}
			<p class="success">Recipe saved.</p>
		{/if}

		<form method="POST" action="?/save">
			<div class="detail-header">
				<input type="text" name="title" value={data.recipe.title} placeholder="Recipe title" class="title-input" required />
				<div class="header-actions">
					<button type="submit" class="btn-save">Save</button>
					<button type="submit" formaction="?/delete" class="btn-delete" onclick={(e) => { if (!confirm('Delete this recipe?')) e.preventDefault(); }}>Delete</button>
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
						<tr><th>Prep Time</th><td>{data.recipe.prep_time}</td></tr>
					{/if}
					{#if data.recipe.cook_time}
						<tr><th>Cook Time</th><td>{data.recipe.cook_time}</td></tr>
					{/if}
					{#if data.recipe.total_time}
						<tr><th>Total Time</th><td>{data.recipe.total_time}</td></tr>
					{/if}
					{#if data.recipe.yield}
						<tr><th>Yield</th><td>{data.recipe.yield}</td></tr>
					{/if}
					{#if data.recipe.category}
						<tr><th>Category</th><td>{data.recipe.category}</td></tr>
					{/if}
					{#if data.recipe.cuisine}
						<tr><th>Cuisine</th><td>{data.recipe.cuisine}</td></tr>
					{/if}
				</tbody>
			</table>

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
				<textarea name="description" rows="2" placeholder="Brief description...">{data.recipe.description}</textarea>
			</label>

			<div class="field">
				<div class="field-header">
					<span>Ingredients</span>
					<button type="button" class="btn-add" onclick={addIngredient}>+ Add</button>
				</div>
				{#each ingredients as ingredient, i}
					<div class="list-item">
						<input type="text" name="ingredients" value={ingredient} placeholder="e.g. 2 cups flour" />
						<button type="button" class="btn-remove" onclick={() => removeIngredient(i)}>&times;</button>
					</div>
				{/each}
			</div>

			{#if data.parsedIngredients.length > 0}
				<div class="field">
					<div class="field-header">
						<span>Ingredient Breakdown</span>
					</div>
					<table class="ingredients-table">
						<thead>
							<tr>
								<th>Category</th>
								<th>Qty</th>
								<th>Unit</th>
								<th>Ingredient</th>
								<th>Matched To</th>
								<th>g/cup</th>
							</tr>
						</thead>
						<tbody>
							{#each groupedIngredients() as [category, items]}
								<tr class="category-header-row">
									<td colspan="6">
										<span class="category-dot" style="background: {CATEGORY_COLORS[category as IngredientCategory] ?? '#757575'}"></span>
										{CATEGORY_LABELS[category as IngredientCategory] ?? category}
										<span class="category-count">({items.length})</span>
									</td>
								</tr>
								{#each items as { idx, pi }}
									<tr
										class:has-subs={pi.substitutions.length > 0}
										class:expanded={expandedIngredient === idx}
										onclick={() => { if (pi.substitutions.length > 0) toggleSubstitutions(idx); }}
									>
										<td>
											<span class="cat-badge" style="background: {CATEGORY_COLORS[pi.foodCategory as IngredientCategory] ?? '#757575'}">{CATEGORY_LABELS[pi.foodCategory as IngredientCategory] ?? pi.foodCategory}</span>
										</td>
										<td>{pi.quantity != null ? pi.quantity : '—'}</td>
										<td>{pi.unit || '—'}</td>
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
										<td>
											{#if pi.known_name}
												<span class="matched">{pi.known_name}</span>
											{:else}
												<span class="unmatched">unmatched</span>
											{/if}
										</td>
										<td>
											{#if pi.density_g_per_cup != null}
												{pi.density_g_per_cup}{#if pi.user_override} <span class="override-badge">custom</span>{/if}
											{:else}
												—
											{/if}
										</td>
									</tr>
									{#if expandedIngredient === idx && pi.substitutions.length > 0}
										<tr class="sub-row">
											<td colspan="6">
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

			<div class="field">
				<div class="field-header">
					<span>Instructions</span>
					<button type="button" class="btn-add" onclick={addInstruction}>+ Add</button>
				</div>
				{#each instructions as instruction, i}
					<div class="list-item">
						<span class="step-num">{i + 1}.</span>
						<textarea name="instructions" rows="2" placeholder="Describe this step...">{instruction}</textarea>
						<button type="button" class="btn-remove" onclick={() => removeInstruction(i)}>&times;</button>
					</div>
				{/each}
			</div>
		</form>

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
		min-height: calc(100vh - 73px);
		margin: -2rem auto;
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
		padding: 2rem;
		overflow-y: auto;
	}

	.detail-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
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
	}

	.title-input:focus {
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
		display: inline-block;
		font-size: 0.6rem;
		color: #fff;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
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
		resize: vertical;
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

	.list-item input,
	.list-item textarea {
		flex: 1;
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
</style>
