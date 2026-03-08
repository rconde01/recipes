<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children } = $props<{ data: LayoutData; children: any }>();
	let menuOpen = $state(false);
</script>

<nav>
	<div class="nav-bar">
		<a href="/" class="brand">Recipes</a>
		<button class="hamburger" onclick={() => (menuOpen = !menuOpen)} aria-label="Toggle menu">
			{#if menuOpen}✕{:else}☰{/if}
		</button>
	</div>
	<div class="nav-menu" class:open={menuOpen}>
		{#if data.user}
			<a href="/meal-plan" onclick={() => (menuOpen = false)}>Meal Plan</a>
			<a href="/cook" onclick={() => (menuOpen = false)}>Cook</a>
			<a href="/ingredients" onclick={() => (menuOpen = false)}>Ingredients</a>
			<span class="user-greeting">Hi, {data.user.username}</span>
			<form method="POST" action="/logout">
				<button type="submit" class="logout-btn">Logout</button>
			</form>
		{:else}
			<a href="/login" onclick={() => (menuOpen = false)}>Login</a>
			<a href="/register" onclick={() => (menuOpen = false)}>Register</a>
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
		position: sticky;
		top: 0;
		z-index: 100;
		background: #fff;
		border-bottom: 1px solid #e0e0e0;
		padding-top: env(safe-area-inset-top, 0px);
	}

	.nav-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		padding-left: max(1rem, env(safe-area-inset-left));
		padding-right: max(1rem, env(safe-area-inset-right));
	}

	.brand {
		color: #333;
		text-decoration: none;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.brand:hover {
		color: #e65100;
	}

	.hamburger {
		display: none;
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0.25rem;
		color: #333;
	}

	.nav-menu {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 0 1rem 0.75rem;
	}

	.nav-menu a {
		color: #333;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.nav-menu a:hover {
		color: #e65100;
	}

	.user-greeting {
		font-size: 0.95rem;
		white-space: nowrap;
	}

	.logout-btn {
		background: none;
		border: 1px solid #ccc;
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		cursor: pointer;
	}

	@media (max-width: 600px) {
		.hamburger {
			display: block;
		}

		.nav-menu {
			display: none;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
			padding: 0 1rem 1rem;
		}

		.nav-menu.open {
			display: flex;
		}
	}

	main {
		margin: 0;
		padding: 0;
	}
</style>
