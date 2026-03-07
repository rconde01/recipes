<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();
	let showImport = $state(false);
</script>

<svelte:head>
	<title>My Recipes</title>
</svelte:head>

<div class="recipes-layout">
	<aside class="recipe-list">
		<div class="list-header">
			<h2>My Recipes</h2>
			<form method="POST" action="?/create">
				<button type="submit" class="btn-new">+ New</button>
			</form>
		</div>

		{#if data.recipes.length === 0}
			<p class="empty">No recipes yet. Create your first one!</p>
		{:else}
			<ul>
				{#each data.recipes as recipe}
					<li>
						<a href="/recipes/{recipe.id}">{recipe.title}</a>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>

	<section class="recipe-detail">
		<div class="placeholder">
			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}
			<p>Select a recipe from the list, create a new one, or import from a URL.</p>
			<button class="btn-import" onclick={() => showImport = !showImport}>
				{showImport ? 'Cancel' : 'Import from URL'}
			</button>
			{#if showImport}
				<form method="POST" action="?/import" class="import-form">
					<input type="url" name="url" placeholder="https://example.com/recipe" required />
					<button type="submit" class="btn-save">Import</button>
				</form>
			{/if}
		</div>
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

	.empty {
		padding: 1rem;
		color: #999;
		font-size: 0.9rem;
	}

	section.recipe-detail {
		flex: 1;
		padding: 2rem;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #999;
		gap: 1rem;
	}

	.error {
		color: #c62828;
		background: #ffebee;
		padding: 0.7rem;
		border-radius: 4px;
		width: 100%;
		max-width: 500px;
		text-align: center;
	}

	.btn-import {
		background: #e65100;
		color: white;
		border: none;
		padding: 0.5rem 1.2rem;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
	}

	.btn-import:hover {
		background: #bf360c;
	}

	.import-form {
		display: flex;
		gap: 0.5rem;
		width: 100%;
		max-width: 500px;
	}

	.import-form input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.95rem;
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
</style>
