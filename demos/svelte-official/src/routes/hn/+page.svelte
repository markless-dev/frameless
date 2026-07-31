<script lang="ts">
	import { goto } from '$app/navigation';
	import HnFront from '$lib/emitted/HnFront.svelte';
	import { hnDestination } from '$lib/scenario-props';

	// THE /hn NAV SINK, added by frameless-app-fidelity-v1 T006, and THE SHORTEST
	// OF THE SIX BECAUSE THIS LANE HAS ONE DESTINATION AND NOT TWO.
	//
	// `goto` is SvelteKit's own client navigation - the router this app already
	// had - so the logo and the wordmark reach /hn without a document reload.
	// `hnDestination` also names '/hn-item', and IT NEVER FIRES HERE: this lane
	// EMITS NO `HnItem` AT ALL, so there is no /hn-item route to reach and the
	// guard below refuses to invent one. The refusal is the emitter's, verbatim,
	// re-measured through the real `emit()` at HEAD:
	//   Svelte emitter has no lowering for a same-module component reference
	//   (HnItem)
	// A `.svelte` file declares exactly one component and a snippet cannot own
	// state or a lifecycle, so `HnItem` naming ITSELF has nowhere to land. See
	// packages/frameworks/svelte/test/unbuilt-scenarios.ts. THE COMMENTS LINK ON
	// THIS PAGE THEREFORE STAYS INERT IN THIS LANE, which is why "the comments
	// link works" is a FOUR-LANE claim and is labelled as one everywhere it is
	// made - including on the page itself, in `.hn-note`.
	const hnTrace = (name: string, detail: Record<string, unknown>): void => {
		const to = hnDestination(name, detail);
		if (to === '/hn') void goto(to);
	};
</script>

<!--
	THE FOURTH APPLICATION - the HACKER NEWS FRONT PAGE - and the FIRST in this
	corpus that all SIX lanes emit. S11 and S12 lose angular to its
	global-identifier ban; S13 names no global anywhere, because every relative
	age is a literal string in the seeded data rather than something computed from
	`Date`. That is a constraint of the fixture, not luck.

	THE AXIS IS "DATA WITHOUT A DOOR", AND THE DOOR IS SHUT BEFORE THE PAGE
	STARTS. Fetch-on-render is unreachable in every lane - there is no lifecycle
	hook in the authoring surface and `computed(async ...)` is closed by a pincer
	upstream of every emitter - so this page CANNOT load its stories on appear and
	does not pretend to. The twelve stories are seeded inside the emitted
	component exactly as S10, S11 and S12 seed theirs. No seed prop in any lane:
	IR-8 has no lowering for an array type.

	THIS LANE REFUSED THE MODULE ONCE, AND THE REFUSAL IS WHY THE FOOTER SEARCH
	FORM CARRIES A CLICK HANDLER IT WOULD OTHERWISE NOT NEED. The Svelte emitter
	suppresses [a11y_click_events_have_key_events,
	a11y_no_noninteractive_element_interactions] at every `<form>` that carries an
	event, and then proves the suppression fires in BOTH directions. A form with a
	`submit` handler and no `click` handler makes it redundant, and the emitter
	threw: "Emitted Svelte module HnFront.svelte suppresses
	[a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions]
	but without those annotations Svelte reports []. A suppression that changes
	nothing is a silent over-fire." S10, S11 and S12 all happen to carry a `press`
	trace on their forms, so no earlier fixture had ever exposed it.

	WHAT IS INERT AND NOT FAKED, CORRECTED BY frameless-app-fidelity-v1 T006. The
	old wording said `past`, `comments`, `ask`, `show`, `jobs` and `submit` do
	nothing BECAUSE `.tsrx` has no routing construct. The premise is true and the
	"because" was not: every stub already emitted `preventDefault()` plus an
	`onTrace('nav', ...)` naming its destination, and the empty `noTrace` this
	page used to pass was where they died. SEVENTEEN OF THE THIRTY-ONE STUBS ARE
	STILL INERT and always will be - `new`, `past`, the masthead `comments`
	(/newcomments, not a story thread), `ask`, `show`, `jobs`, `submit`, `login`,
	`More` and the eight footer links are EACH A SEPARATE APPLICATION, which no
	routing construct anywhere would reach - and the page LABELS them in
	`.hn-note` rather than pointing them somewhere false. IN THIS LANE the
	per-story comments link is inert too, because this lane emits no `HnItem`.
	The footer search FILTERS IN PLACE rather than handing the query to Algolia.
	Upvote, unvote, hide and the search filter all work.
-->
<!--
	ONE STYLESHEET, AND IT IS THIS REPOSITORY'S OWN WORK. Nothing was copied from
	news.ycombinator.com. `demos/shared/hn-css/hn.css` reproduces the MEASURED
	geometry - the #ff6600 masthead, the #f6f6ef page, the Verdana 10/8/7pt scale
	- against the class names the six emitters print. It is written into
	`static/hn-css/` by `pnpm copy-hn-css` (`static`, not `public`, because
	SvelteKit is the one lane of the six that names its asset root that way), and
	every lane serves it at the same URL.

	It is linked HERE rather than in src/app.html for the reason the TodoMVC and
	codex routes record: it restyles `body`, so a global link would move the
	geometry of the nine s1-s9 scenarios that `pnpm e2e` compares across six
	lanes. Like those routes this page is browsable only - `scripts/e2e.mjs` pins
	`threeWayScenarios` to the literal ['s1'..'s9'].
-->
<link rel="stylesheet" href="/hn-css/hn.css" />
<HnFront onTrace={hnTrace} />
