<script lang="ts">
	import type { ActionData } from './$types';

	let { form } = $props<{ form: ActionData }>();
</script>

<svelte:head>
	<title>Login - Recipes</title>
</svelte:head>

<div class="auth-container">
	<h1>Login</h1>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<form method="POST">
		<label>
			Email
			<input type="email" name="email" value={form?.email ?? ''} required />
		</label>

		<label>
			Password
			<input type="password" name="password" required />
		</label>

		<button type="submit">Login</button>
	</form>

	<p class="alt-link">Don't have an account? <a href="/register">Register</a></p>
</div>

<style>
	.auth-container {
		max-width: 400px;
		margin: 2rem auto;
		padding: 2rem;
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	h1 {
		margin-top: 0;
		text-align: center;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-weight: 500;
	}

	input {
		padding: 0.6rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	button {
		padding: 0.7rem;
		background: #e65100;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		margin-top: 0.5rem;
	}

	button:hover {
		background: #bf360c;
	}

	.error {
		color: #c62828;
		background: #ffebee;
		padding: 0.7rem;
		border-radius: 4px;
		text-align: center;
	}

	.alt-link {
		text-align: center;
		margin-top: 1rem;
	}

	.alt-link a {
		color: #e65100;
	}
</style>
