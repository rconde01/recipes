<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';

	let { data } = $props<{ data: PageData }>();

	let editingId = $state<string | null>(null);
	let showAddForm = $state(false);
	let filterText = $state('');
	let filterCategory = $state('');

	const UNIT_OPTIONS = ['', 'weight', 'volume'];

	let categories = $derived(() => {
		const cats = new Set<string>();
		for (const ing of data.ingredients) {
			if (ing.category) cats.add(ing.category);
		}
		return [...cats].sort();
	});

	let filtered = $derived(() => {
		let list = data.ingredients;
		if (filterText) {
			const q = filterText.toLowerCase();
			list = list.filter((i: typeof data.ingredients[0]) => i.canonical_name.toLowerCase().includes(q));
		}
		if (filterCategory) {
			list = list.filter((i: typeof data.ingredients[0]) => i.category === filterCategory);
		}
		return list;
	});

	function startEdit(id: string) {
		editingId = id;
	}

	function cancelEdit() {
		editingId = null;
	}
</script>

<svelte:head>
	<title>Ingredients Database</title>
</svelte:head>

<div class="page">
	<div class="header">
		<h1>Ingredients Database</h1>
		<p class="subtitle">{data.ingredients.length} ingredients with density and calorie data</p>
	</div>

	<div class="toolbar">
		<div class="filters">
			<input
				type="text"
				placeholder="Search ingredients..."
				bind:value={filterText}
				class="search-input"
			/>
			<select bind:value={filterCategory} class="category-filter">
				<option value="">All categories</option>
				{#each categories() as cat}
					<option value={cat}>{cat}</option>
				{/each}
			</select>
		</div>
		<button class="btn-add" onclick={() => showAddForm = !showAddForm}>
			{showAddForm ? 'Cancel' : '+ Add Ingredient'}
		</button>
	</div>

	{#if showAddForm}
		<form method="POST" action="?/add" use:enhance={() => {
			return async ({ update }) => {
				await update();
				showAddForm = false;
			};
		}} class="add-form">
			<div class="form-row">
				<label>
					<span>Name</span>
					<input type="text" name="name" required placeholder="e.g. chickpea flour" />
				</label>
				<label>
					<span>Category</span>
					<input type="text" name="category" placeholder="e.g. flour" />
				</label>
				<label>
					<span>Grams per cup</span>
					<input type="number" name="density" step="any" placeholder="e.g. 120" />
				</label>
				<label>
					<span>Calories per gram</span>
					<input type="number" name="calories" step="any" placeholder="e.g. 3.64" />
				</label>
				<label>
					<span>Preferred unit</span>
					<select name="preferred_unit" class="unit-select">
						{#each UNIT_OPTIONS as u}
							<option value={u}>{u || '—'}</option>
						{/each}
					</select>
				</label>
				<button type="submit" class="btn-save">Add</button>
			</div>
		</form>
	{/if}

	<div class="table-container">
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Category</th>
					<th class="num">g / cup</th>
					<th class="num">cal / g</th>
					<th class="num">cal / cup</th>
					<th>Pref. Unit</th>
					<th class="actions-col">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered() as ingredient (ingredient.id)}
					{#if editingId === ingredient.id}
						<tr class="editing-row">
							<td colspan="7">
								<form method="POST" action="?/update" use:enhance={() => {
									return async ({ update }) => {
										await update();
										editingId = null;
									};
								}} class="edit-form">
									<input type="hidden" name="id" value={ingredient.id} />
									<div class="form-row">
										<label>
											<span>Name</span>
											<input type="text" name="name" value={ingredient.canonical_name} required />
										</label>
										<label>
											<span>Category</span>
											<input type="text" name="category" value={ingredient.category} />
										</label>
										<label>
											<span>Grams per cup</span>
											<input type="number" name="density" step="any" value={ingredient.density_g_per_cup ?? ''} />
										</label>
										<label>
											<span>Calories per gram</span>
											<input type="number" name="calories" step="any" value={ingredient.calories_per_gram ?? ''} />
										</label>
										<label>
											<span>Preferred unit</span>
											<select name="preferred_unit" class="unit-select">
												{#each UNIT_OPTIONS as u}
													<option value={u} selected={ingredient.preferred_unit === u}>{u || '—'}</option>
												{/each}
											</select>
										</label>
										<div class="edit-actions">
											<button type="submit" class="btn-save">Save</button>
											<button type="button" class="btn-cancel" onclick={cancelEdit}>Cancel</button>
										</div>
									</div>
								</form>
							</td>
						</tr>
					{:else}
						<tr>
							<td class="name-cell">{ingredient.canonical_name}</td>
							<td><span class="category-badge">{ingredient.category || '—'}</span></td>
							<td class="num">{ingredient.density_g_per_cup ?? '—'}</td>
							<td class="num">{ingredient.calories_per_gram ?? '—'}</td>
							<td class="num">
								{#if ingredient.density_g_per_cup != null && ingredient.calories_per_gram != null}
									{Math.round(ingredient.density_g_per_cup * ingredient.calories_per_gram)}
								{:else}
									—
								{/if}
							</td>
							<td>
								{#if ingredient.preferred_unit}
									<span class="unit-badge">{ingredient.preferred_unit}</span>
								{:else}
									<span class="no-pref">—</span>
								{/if}
							</td>
							<td class="actions-col">
								<button class="btn-edit" onclick={() => startEdit(ingredient.id)}>Edit</button>
								<form method="POST" action="?/delete" use:enhance class="inline-form">
									<input type="hidden" name="id" value={ingredient.id} />
									<button type="submit" class="btn-delete">Delete</button>
								</form>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>

	{#if filtered().length === 0}
		<p class="empty">No ingredients found.</p>
	{/if}
</div>

<style>
	.page {
		max-width: 1060px;
		margin: 0 auto;
		padding: 1.5rem 1rem;
	}

	.header {
		margin-bottom: 1rem;
	}

	.header h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.subtitle {
		margin: 0.25rem 0 0 0;
		color: #888;
		font-size: 0.9rem;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.filters {
		display: flex;
		gap: 0.5rem;
		flex: 1;
	}

	.search-input {
		padding: 0.4rem 0.75rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.9rem;
		flex: 1;
		max-width: 300px;
	}

	.category-filter {
		padding: 0.4rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.85rem;
		background: #fff;
	}

	.btn-add {
		background: #e65100;
		color: #fff;
		border: none;
		padding: 0.45rem 1rem;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-add:hover { background: #bf360c; }

	.add-form, .edit-form {
		background: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.form-row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.form-row label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex: 1;
		min-width: 110px;
	}

	.form-row label span {
		font-size: 0.75rem;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.form-row input[type='text'],
	.form-row input[type='number'] {
		padding: 0.4rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.unit-select {
		padding: 0.4rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.9rem;
		background: #fff;
	}

	.btn-save {
		background: #2e7d32;
		color: #fff;
		border: none;
		padding: 0.45rem 1rem;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-save:hover { background: #1b5e20; }

	.btn-cancel {
		background: #fff;
		border: 1px solid #ccc;
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.btn-cancel:hover { background: #f5f5f5; }

	.edit-actions {
		display: flex;
		gap: 0.4rem;
		align-items: flex-end;
	}

	.table-container {
		background: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th {
		text-align: left;
		padding: 0.6rem 0.75rem;
		background: #f5f5f5;
		border-bottom: 2px solid #e0e0e0;
		font-weight: 600;
		color: #555;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}

	td {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #f0f0f0;
		vertical-align: middle;
	}

	tr:hover { background: #fafafa; }

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.name-cell {
		font-weight: 500;
	}

	.category-badge {
		display: inline-block;
		font-size: 0.75rem;
		padding: 0.1rem 0.5rem;
		border-radius: 3px;
		background: #f3e5f5;
		color: #7b1fa2;
		font-weight: 500;
	}

	.unit-badge {
		display: inline-block;
		font-size: 0.75rem;
		padding: 0.1rem 0.5rem;
		border-radius: 3px;
		background: #e8f5e9;
		color: #2e7d32;
		font-weight: 600;
	}

	.no-pref {
		color: #ccc;
	}

	.actions-col {
		width: 120px;
		white-space: nowrap;
	}

	.btn-edit {
		background: none;
		border: 1px solid #ccc;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.btn-edit:hover { background: #f5f5f5; }

	.btn-delete {
		background: none;
		border: 1px solid #ccc;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.8rem;
		color: #c62828;
	}

	.btn-delete:hover { background: #ffebee; }

	.inline-form {
		display: inline;
	}

	.editing-row {
		background: #fffde7;
	}

	.editing-row:hover { background: #fffde7; }

	.empty {
		text-align: center;
		color: #999;
		padding: 2rem;
	}

	@media (max-width: 600px) {
		.toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.filters {
			flex-direction: column;
		}

		.search-input {
			max-width: none;
		}

		.form-row {
			flex-direction: column;
		}
	}
</style>
