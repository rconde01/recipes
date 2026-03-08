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
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		gap: 0.5rem;
		background: #fff;
		border-bottom: 1px solid #e0e0e0;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	nav a {
		color: #333;
		text-decoration: none;
		font-weight: 600;
		white-space: nowrap;
		font-size: 0.95rem;
	}

	nav a:hover {
		color: #e65100;
	}

	nav div {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	nav span {
		white-space: nowrap;
		font-size: 0.95rem;
	}

	nav button {
		background: none;
		border: 1px solid #ccc;
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		cursor: pointer;
		white-space: nowrap;
	}

	@media (max-width: 480px) {
		nav {
			padding: 0.5rem 0.75rem;
			gap: 0.25rem 0.5rem;
		}

		.nav-links {
			gap: 0.75rem;
		}

		nav a, nav span {
			font-size: 0.85rem;
		}

		nav button {
			font-size: 0.85rem;
			padding: 0.3rem 0.6rem;
		}
	}

	main {
		margin: 0;
		padding: 0;
	}
</style>
