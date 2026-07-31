<script lang="ts">
	import HnFront from '$lib/emitted/HnFront.svelte';
	import { noTrace } from '$lib/scenario-props';
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

	WHAT IS INERT AND NOT FAKED. `past`, `comments`, `ask`, `show`, `jobs` and
	`submit` do nothing: `.tsrx` has no routing construct, and three host routes
	would mean three instances with independent state. The footer search FILTERS
	IN PLACE rather than handing the query to Algolia, for the same reason.
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
<HnFront onTrace={noTrace} />
