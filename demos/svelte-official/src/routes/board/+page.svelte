<script lang="ts">
	import TaskBoard from '$lib/emitted/TaskBoard.svelte';
	import { noTrace } from '$lib/scenario-props';
</script>

<!--
	THE SEVENTH APPLICATION - the TASK BOARD - and THE DRAG CARD. It is the THIRD
	scenario in this corpus that all six lanes emit and ship, after S13 and S15.

	THE AXIS THIS PAGE EXISTS TO MEASURE IS NOT ON IT, AND THIS LANE IS THE ONLY
	ONE THAT REFUSED ANY PART OF IT. The board predicted the two-word drag events
	"cannot be produced" because the compiler does `name.slice(2).toLowerCase()`.
	Measured on a probe through all six real emitters, THEY ARE PRODUCED, and this
	lane prints `ondragover`, `ondragstart`, `ondragend`, `onpointerdown` - which
	ARE the real DOM event names, so this lane would have been CORRECT BY ACCIDENT
	of the same casing loss that makes react's `onDragover` inert.

	WHAT THIS LANE REFUSED IS THE ELEMENT, NOT THE EVENT, verbatim:

		Emitted Svelte module Probe.svelte did not compile warning-free:
		a11y_no_static_element_interactions.

	on a <div> or a <span> carrying ANY drag handler, and

		... a11y_consider_explicit_label.

	on a <button> with no accessible name. The identical handlers on <ul> and <li>
	emit clean - which is why S16's ONE <ul>/<li> pair is exactly where the drop
	zone and the draggable card would have gone.

	WHAT KEPT THEM OFF THE PAGE is the type baseline in the three JSX lanes: one
	drop zone and one draggable card take `pnpm check` from 267 to 280, which this
	board's oracle forbids. Cards move with the arrow buttons instead - a DIFFERENT
	INTERACTION - and the page SAYS SO in `.tb-note` rather than passing it off as
	the axis. See packages/compiler/test/fixtures/s16-task-board.tsrx.

	WHAT ONE ARROW CLICK MOVES, all derived from ONE `columns` cell: the card
	leaves one column's list and appears in another's - a real subtree move across
	two repeat instances - plus both column counts, the source column's empty
	placeholder, the header's shipped counter and total, the summary sentence AND
	its emoji, and the moved card's own arrows, whose `hidden` is decided by the
	column it now sits in. NINE observables.

	There is no <form> and no component reference here, so neither the a11y refusal
	S13 hit in this lane nor the same-module self-reference refusal that leaves S14
	unbuilt is reachable. Every clickable is a <button type="button"> or an
	<a href="#/...">.
-->
<!--
	TWO STYLESHEETS, AND THE ORDER IS LOAD-BEARING. `/shadcn-theme/tokens.css` is
	the vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load
	FIRST, because every colour in the second file is a `var()` from it.
	`/board-css/board.css` is THIS REPOSITORY'S OWN WORK - the Square UI reference
	is licence-restricted to REFERENCE-ONLY, so nothing was copied from it and its
	geometry was MEASURED in a browser instead. Both are written into `static/` -
	`static`, not `public`, because SvelteKit is the one lane of the six that names
	its asset root that way - by `pnpm copy-shadcn-theme` and `pnpm copy-board-css`.

	They are linked HERE rather than in src/app.html because `board.css` restyles
	`body`, so a global link would move the geometry of the nine s1-s9 scenarios
	that `pnpm e2e` compares across six lanes. Like S10-S15 this page is browsable
	only - `scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'].
-->
<link rel="stylesheet" href="/shadcn-theme/tokens.css" />
<link rel="stylesheet" href="/board-css/board.css" />
<TaskBoard onTrace={noTrace} />
