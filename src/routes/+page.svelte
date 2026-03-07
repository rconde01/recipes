<script lang="ts">
	import type { LayoutData } from './$types';

	let { data } = $props<{ data: LayoutData }>();
</script>

<svelte:head>
	<title>Recipes</title>
</svelte:head>

<h1>Welcome to Recipes</h1>

{#if data.user}
	<p>You're logged in as <strong>{data.user.username}</strong>.</p>
{:else}
	<p>Please <a href="/login">login</a> or <a href="/register">create an account</a> to get started.</p>
{/if}
