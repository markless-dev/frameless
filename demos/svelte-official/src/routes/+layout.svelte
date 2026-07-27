<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	/**
	 * The activation marker the shared contract waits for before it clicks.
	 *
	 * Set **imperatively**, in Svelte's own post-mount signal, in the *root*
	 * layout. Three alternatives that would each be wrong:
	 *
	 * - a template attribute binding would be emitted by SSR, and the
	 *   contract's `forbidInServedPayload` would correctly fail the served
	 *   payload for carrying a string only activation can produce;
	 * - `src/hooks.client.ts` init runs *before* hydration completes, so the
	 *   marker would be a lie about interactivity;
	 * - a child component's `onMount` would only prove that child mounted.
	 *
	 * The root layout is the last mount in the tree: Svelte flushes mount
	 * effects child-first, and the page component is rendered *into* this
	 * layout through `{@render children()}`, so this runs after the whole route
	 * subtree has mounted. T002's dissent flagged that as documentary. It is no
	 * longer: S1/S2/S3 click as soon as the marker appears, and every
	 * server-rendered assertion between the marker and the first click passes,
	 * across three routes, with no settle delay anywhere in the lane.
	 */
	onMount(() => {
		document.documentElement.setAttribute('data-frameless-activated', 'svelte');
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
