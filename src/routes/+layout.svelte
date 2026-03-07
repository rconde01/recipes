<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children } = $props<{ data: LayoutData; children: any }>();
</script>

<nav>
	<div class="nav-links">
		<a href="/">Recipes</a>
		{#if data.user}
			<a href="/meal-plan">Meal Plan</a>
			<a href="/cook">Cook</a>
		{/if}
	</div>
	<div>
		{#if data.user}
			<span>Hi, {data.user.username}</span>
			<form method="POST" action="/logout">
				<button type="submit">Logout</button>
			</form>
		{:else}
			<a href="/login">Login</a>
			<a href="/register">Register</a>
		{/if}
	</div>
</nav>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		font-family: system-ui, -apple-system, sans-serif;
		margin: 0;
		padding: 0;
		background: #f5f5f5;
		color: #333;
	}

	nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		background: #fff;
		border-bottom: 1px solid #e0e0e0;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	nav a {
		color: #333;
		text-decoration: none;
		font-weight: 600;
	}

	nav a:hover {
		color: #e65100;
	}

	nav div {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	nav button {
		background: none;
		border: 1px solid #ccc;
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		cursor: pointer;
	}

	main {
		margin: 0;
		padding: 0;
	}
</style>
