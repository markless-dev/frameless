<script lang="ts">
	import Contacts from '$lib/emitted/Contacts.svelte';
	import { noTrace } from '$lib/scenario-props';
</script>

<!--
	THE EIGHTH APPLICATION - CONTACTS - and THE FORMS CARD. It is the FOURTH
	scenario in this corpus that all six lanes emit and ship, after S13, S15 and S16,
	This comment used to add "UNLIKE S16 THE AXIS IT MEASURES IS ACTUALLY ON THE
	PAGE" - S16's axis is on its page now, in five of six lanes, so the contrast is
	WITHDRAWN rather than left to read as current. What is true of THIS page, and
	unlike S16, is that its axis is on it in ALL SIX: THIRTEEN control
	kinds - text, search, email, tel, url, number, date, time, range, select, radio,
	checkbox and textarea - every one of them bound and every one of them observable
	in the live preview card beneath the form.

	THE BOARD'S PREMISE IS PARTLY REFUTED AND THE REFUTATION IS ALREADY IN THIS DEMO.
	It said only `checkbox` and `textarea` were proven and that `select`, `radio` and
	the multi-field form shape were unmeasured in all six lanes. The /s7 route IS that
	shape - a `<form>` with a `<select>`, a `<textarea>`, a radio group and a keyed
	checkbox group - it emits in all six lanes, and `pnpm e2e` drives it in a real
	browser across six demos.

	MEASURED ON A PROBE THROUGH ALL SIX REAL EMITTERS: every one of the sixteen
	`type=` values emits everywhere. No emitter reads the VALUE of a `type` attribute,
	so the axis has no per-type refusal in it at all. What costs something is the
	attribute BESIDE the type, and it costs the emitted TYPECHECK rather than any
	emitter: `required`, `multiple`, `disabled`, `readonly`, `autofocus`, `spellcheck`
	and a static `checked` each add an `error TS` line to all three JSX lanes, while
	`min`, `max` and `step` are FREE - which is why the number, date, time and range
	fields here carry real bounds. The required markers are literal `*` characters in
	the label text and the submit guard is `aria-disabled`.

	TWO REFERENCE DEFECTS, MEASURED LIVE AND NOT COPIED: with its New Contact dialog
	open the reference holds SEVEN inputs, TWO selects and ZERO textareas - its Notes
	field is a single-line input - and `document.querySelectorAll('h1,h2,h3,h4')`
	returns ZERO on the whole document. This page ships a real textarea, an `<h1>` and
	three `<h2>`s.

	A `date` INPUT IS NOT A CLOCK AND THIS PAGE NAMES NO GLOBAL. `since` and `slot`
	are literal seeded strings, so the angular lane - which cannot resolve `Date` in a
	transplanted body - is not lost for a reason unrelated to forms.
	THIS LANE IS THE ONLY ONE THAT REFUSED ANYTHING ON THIS AXIS, and neither refusal
	is about an input TYPE. Both were reproduced on probes through this very emitter
	and both shaped the fixture:

	  * `htmlFor` on a <label>, verbatim: "Emitted Svelte module Probe.svelte did not
	    compile warning-free: a11y_label_has_associated_control,
	    attribute_invalid_property_name." The portable spelling is `for`, which the
	    REACT emitter rewrites to `htmlFor` on its own.
	  * a <form> with a submit handler and NO click handler, verbatim: "Emitted Svelte
	    module ZProbe.svelte suppresses [a11y_click_events_have_key_events,
	    a11y_no_noninteractive_element_interactions] but without those annotations
	    Svelte reports []. A suppression that changes nothing is a silent over-fire."
	    S13 constraint 13 and S14 constraint 11 recorded it; it was RE-MEASURED here,
	    and the fixture's form carries a `press` trace beside its `add` trace for
	    exactly this reason.

	TWO STYLESHEETS, AND THE ORDER IS LOAD-BEARING. `/shadcn-theme/tokens.css` is the
	vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load FIRST.
	`/contact-css/contacts.css` is THIS REPOSITORY'S OWN WORK - the Square UI
	reference is licence-restricted to REFERENCE-ONLY, so nothing was copied and its
	geometry was MEASURED in a browser instead. Both are written into `static/` -
	`static`, not `public`, because SvelteKit is the one lane of the six that names
	its asset root that way. They are linked HERE rather than in src/app.html because
	`contacts.css` restyles `body`. Like S10-S16 this page is browsable only.
-->
<link rel="stylesheet" href="/shadcn-theme/tokens.css" />
<link rel="stylesheet" href="/contact-css/contacts.css" />
<Contacts onTrace={noTrace} />
