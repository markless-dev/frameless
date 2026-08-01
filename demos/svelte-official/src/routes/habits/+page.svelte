<script lang="ts">
	import HabitTracker from '$lib/emitted/HabitTracker.svelte';
	import { noTrace } from '$lib/scenario-props';
</script>

<!--
	THE SIXTH APPLICATION - the HABIT TRACKER - and THE SIX-LANE FAN-OUT PAGE. It
	is a SIX-LANE APPLICATION, and the FIRST that was designed to be so rather than
	turning out that way - the position this header used to state instead ("the
	SECOND ... after S13") counted from S13, which was never first, and the /hn
	header records why. The whole app is SYNCHRONOUS DERIVED STATE, so there is no
	`Promise` or
	`setTimeout` for the angular lane's global-identifier ban to catch, no async
	door for the vue lane's GLOBALS_ALLOWED gap to open, and NO COMPONENT REFERENCE
	for either of the two emitter defects T003 isolated to reach.

	THAT LAST ABSENCE IS WHY THIS LANE HAS THE PAGE AT ALL. S14 is UNBUILT here:
	`HnItem` names itself, and this emitter refuses a same-module component
	reference outright - "a .svelte file declares exactly one component, and a
	snippet cannot own state or a lifecycle". S15 is a SINGLE component, so that
	refusal is not reachable, and this lane is back to parity.

	Its date - "JULY 30, 2026" over "Thursday" - is a LITERAL STRING in the seeded
	data, because the angular emitter cannot NAME `Date` and a clock would have
	cost this app the very lane count it exists to measure. See
	packages/compiler/test/fixtures/s15-habit-tracker.tsrx constraint (10).

	WHAT ONE CLICK ON A HABIT TOGGLE MOVES, all of it derived from ONE `habits`
	cell and none of it written by the handler: the toggle's own fill, the row
	title's strikethrough, THE SIDEBAR ROW'S strikethrough (a second repeat in a
	different subtree - which is what makes this fan-out rather than a row
	re-render), the header counter, the sidebar badge, the progress bar's width
	class, the encouragement sentence AND its emoji, and today's dot inside that
	row's nested day strip. EIGHT observables.

	WHAT IS INERT AND NOT FAKED: `Statistics`, `New habit`, the sidebar toggle and
	the theme toggle. `.tsrx` has no routing construct at all. WHAT IS ABSENT: the
	reference's 30-day heat-map and sparkline - roughly two hundred decorative
	cells per habit that would triple the template while measuring nothing the
	eight observables do not already measure.

	AND THERE IS NO `<form>` ON THIS PAGE, which is why the a11y refusal S13 hit in
	this lane is not reachable either. That emitter suppresses
	[a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions]
	at every `<form>` carrying an event and then proves the suppression fires in
	both directions; S13 needed a `press` trace on its search form to survive it.
	Every clickable here is a `<button type="button">` or an `<a href="#/...">`.
-->
<!--
	TWO STYLESHEETS, AND THE ORDER IS LOAD-BEARING. `/shadcn-theme/tokens.css` is
	the vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load
	FIRST, because every colour in the second file is a `var()` from it.
	`/habit-css/habits.css` is THIS REPOSITORY'S OWN WORK - the Square UI reference
	is licence-restricted to REFERENCE-ONLY, so nothing was copied from it and its
	geometry was MEASURED in a browser instead. Both are written into `static/` -
	`static`, not `public`, because SvelteKit is the one lane of the six that names
	its asset root that way - by `pnpm copy-shadcn-theme` and `pnpm copy-habit-css`,
	and every lane serves them at the same two URLs.

	They are linked HERE rather than in src/app.html because `habits.css` restyles
	`body`, so a global link would move the geometry of the nine s1-s9 scenarios
	that `pnpm e2e` compares across six lanes. Like S10-S14 this page is browsable
	only - `scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'].
-->
<link rel="stylesheet" href="/shadcn-theme/tokens.css" />
<link rel="stylesheet" href="/habit-css/habits.css" />
<HabitTracker onTrace={noTrace} />
