<script lang="ts">
	import type { PageData, ActionData } from './$types';

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
</style>
