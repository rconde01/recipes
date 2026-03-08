<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let selectedRecipeIds = $state<Set<string>>(new Set());
	let listName = $state('Grocery List');

	$effect(() => {
		selectedRecipeIds = new Set(data.selectedIds);
	});

	$effect(() => {
		listName = data.listName || 'Grocery List';
	});
	let exportMessage = $state('');

	function toggleRecipe(id: string) {
		const next = new Set(selectedRecipeIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedRecipeIds = next;
	}

	function generateUrl(): string {
		const params = new URLSearchParams();
		for (const id of selectedRecipeIds) {
			params.append('recipe', id);
		}
		params.set('listName', listName);
		return `/meal-plan?${params.toString()}`;
	}

	function formatQuantity(qty: number, unit: string): string {
		if (qty === 0 && !unit) return '';
		const qtyStr = qty % 1 === 0 ? qty.toString() : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
		if (!unit) return qtyStr;
		return `${qtyStr} ${unit}`;
	}

	function formatLine(item: { name: string; quantity: number; unit: string }): string {
		const qtyPart = formatQuantity(item.quantity, item.unit);
		if (qtyPart) return `${qtyPart} ${item.name}`;
		return item.name;
	}

	// Plain text list
	function exportPlainText(): string {
		let text = `${listName}\n${'='.repeat(listName.length)}\n\n`;
		let currentCategory = '';
		for (const item of data.aggregatedIngredients) {
			if (item.category && item.category !== currentCategory) {
				currentCategory = item.category;
				text += `\n## ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}\n`;
			}
			text += `- ${formatLine(item)}\n`;
		}
		return text;
	}

	// Microsoft To Do format (one task per line, importable via copy-paste)
	function exportMicrosoftTodo(): string {
		let text = '';
		for (const item of data.aggregatedIngredients) {
			text += `${formatLine(item)}\n`;
		}
		return text;
	}

	// Todoist CSV format
	function exportTodoistCsv(): string {
		let csv = 'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE\n';
		// Project row
		csv += `project,"${listName}",,,,,,,,\n`;
		let currentCategory = '';
		for (const item of data.aggregatedIngredients) {
			if (item.category && item.category !== currentCategory) {
				currentCategory = item.category;
				csv += `section,"${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}",,,,,,,,\n`;
			}
			const content = formatLine(item).replace(/"/g, '""');
			csv += `task,"${content}",,4,1,,,,en,\n`;
		}
		return csv;
	}

	// Apple Reminders (plain text, one per line — paste into Notes then select-all and share to Reminders)
	function exportAppleReminders(): string {
		let text = `${listName}\n\n`;
		for (const item of data.aggregatedIngredients) {
			text += `${formatLine(item)}\n`;
		}
		return text;
	}

	// AnyList format (plain text import)
	function exportAnyList(): string {
		let text = '';
		let currentCategory = '';
		for (const item of data.aggregatedIngredients) {
			if (item.category && item.category !== currentCategory) {
				currentCategory = item.category;
				text += `\n[${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}]\n`;
			}
			text += `${formatLine(item)}\n`;
		}
		return text;
	}

	async function copyToClipboard(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			exportMessage = `Copied ${label} to clipboard!`;
			setTimeout(() => exportMessage = '', 3000);
		} catch {
			// Fallback: open in a textarea modal
			exportMessage = `Could not copy automatically. Please select and copy manually.`;
			setTimeout(() => exportMessage = '', 5000);
		}
	}

	function downloadFile(content: string, filename: string, mime: string) {
		const blob = new Blob([content], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
		exportMessage = `Downloaded ${filename}`;
		setTimeout(() => exportMessage = '', 3000);
	}
</script>

<svelte:head>
	<title>Meal Plan</title>
</svelte:head>

<div class="meal-plan-layout">
	<aside class="recipe-picker">
		<div class="picker-header">
			<h2>Select Meals</h2>
		</div>

		<div class="list-name-field">
			<label>
				List name
				<input type="text" bind:value={listName} placeholder="Grocery List" />
			</label>
		</div>

		{#if data.recipes.length === 0}
			<p class="empty">No recipes yet. <a href="/recipes">Create some first</a>.</p>
		{:else}
			<ul>
				{#each data.recipes as recipe}
					<li>
						<label class="recipe-checkbox">
							<input
								type="checkbox"
								checked={selectedRecipeIds.has(recipe.id)}
								onchange={() => toggleRecipe(recipe.id)}
							/>
							<span>{recipe.title}</span>
						</label>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="picker-footer">
			<a href={generateUrl()} class="btn-generate">Generate List</a>
		</div>
	</aside>

	<section class="shopping-list">
		{#if data.aggregatedIngredients.length === 0}
			<div class="placeholder">
				<p>Select recipes on the left and click "Generate List" to create an aggregated shopping list.</p>
			</div>
		{:else}
			<h2>{data.listName}</h2>
			<p class="subtitle">{data.selectedIds.length} recipe{data.selectedIds.length === 1 ? '' : 's'} selected</p>

			{#if exportMessage}
				<p class="export-msg">{exportMessage}</p>
			{/if}

			<div class="export-buttons">
				<button onclick={() => copyToClipboard(exportMicrosoftTodo(), 'Microsoft To Do')}>
					Microsoft To Do
				</button>
				<button onclick={() => downloadFile(exportTodoistCsv(), `${listName.replace(/\s+/g, '_')}.csv`, 'text/csv')}>
					Todoist (CSV)
				</button>
				<button onclick={() => copyToClipboard(exportAppleReminders(), 'Apple Reminders')}>
					Apple Reminders
				</button>
				<button onclick={() => copyToClipboard(exportAnyList(), 'AnyList')}>
					AnyList
				</button>
				<button onclick={() => copyToClipboard(exportPlainText(), 'plain text')}>
					Plain Text
				</button>
			</div>

			<table class="shopping-table">
				<thead>
					<tr>
						<th>Qty</th>
						<th>Unit</th>
						<th>Ingredient</th>
						<th>Category</th>
						<th>From</th>
					</tr>
				</thead>
				<tbody>
					{#each data.aggregatedIngredients as item}
						<tr>
							<td class="qty">{item.quantity > 0 ? formatQuantity(item.quantity, '') : '—'}</td>
							<td>{item.unit || '—'}</td>
							<td class="ingredient-name">{item.name}</td>
							<td><span class="category-badge">{item.category || '—'}</span></td>
							<td class="from-col">
								{#each item.raw_items as raw, i}
									<span class="raw-item">{raw}</span>{#if i < item.raw_items.length - 1}, {/if}
								{/each}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>

<style>
	.meal-plan-layout {
		display: flex;
		gap: 0;
		min-height: calc(100vh - 73px);
		margin: 0 auto;
		max-width: none;
	}

	aside.recipe-picker {
		width: 300px;
		min-width: 300px;
		background: #fff;
		border-right: 1px solid #e0e0e0;
		display: flex;
		flex-direction: column;
	}

	.picker-header {
		padding: 1rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.picker-header h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.list-name-field {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.list-name-field label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #666;
	}

	.list-name-field input {
		padding: 0.4rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
	}

	li {
		border-bottom: 1px solid #f0f0f0;
	}

	.recipe-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.recipe-checkbox:hover {
		background: #fff3e0;
	}

	.recipe-checkbox input[type='checkbox'] {
		accent-color: #e65100;
		width: 16px;
		height: 16px;
	}

	.picker-footer {
		padding: 1rem;
		border-top: 1px solid #e0e0e0;
	}

	.btn-generate {
		display: block;
		text-align: center;
		background: #e65100;
		color: white;
		text-decoration: none;
		padding: 0.6rem 1rem;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.btn-generate:hover {
		background: #bf360c;
	}

	.empty {
		padding: 1rem;
		color: #999;
		font-size: 0.9rem;
	}

	.empty a {
		color: #e65100;
	}

	section.shopping-list {
		flex: 1;
		padding: 2rem;
		overflow-y: auto;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #999;
	}

	h2 {
		margin: 0 0 0.25rem 0;
		font-size: 1.4rem;
	}

	.subtitle {
		color: #999;
		font-size: 0.9rem;
		margin: 0 0 1rem 0;
	}

	.export-msg {
		color: #2e7d32;
		background: #e8f5e9;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.export-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.export-buttons button {
		background: #fff;
		border: 1px solid #ccc;
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		color: #333;
	}

	.export-buttons button:hover {
		background: #fff3e0;
		border-color: #e65100;
		color: #e65100;
	}

	.shopping-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.shopping-table th {
		text-align: left;
		padding: 0.6rem 0.75rem;
		background: #f5f5f5;
		border-bottom: 2px solid #e0e0e0;
		font-weight: 600;
		color: #555;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.shopping-table td {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #f0f0f0;
	}

	.shopping-table tr:hover {
		background: #fafafa;
	}

	.qty {
		font-weight: 600;
		white-space: nowrap;
	}

	.ingredient-name {
		font-weight: 500;
	}

	.category-badge {
		display: inline-block;
		font-size: 0.75rem;
		background: #f0f0f0;
		color: #666;
		padding: 0.15rem 0.5rem;
		border-radius: 10px;
		text-transform: capitalize;
	}

	.from-col {
		font-size: 0.8rem;
		color: #888;
	}

	.raw-item {
		font-style: italic;
	}
</style>
