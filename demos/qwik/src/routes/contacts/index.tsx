import { $, component$ } from "@qwik.dev/core";
import { Contacts } from "../../emitted/Contacts.jsx";

// THE EIGHTH APPLICATION - CONTACTS - and THE FORMS CARD. It is the FOURTH
// scenario in this corpus that all six lanes emit and ship, after S13, S15 and S16,
// This comment used to add "UNLIKE S16 THE AXIS IT MEASURES IS ACTUALLY ON THE
// PAGE" - S16's axis is on its page now, in five of six lanes, so the contrast is
// WITHDRAWN rather than left to read as current. What is true of THIS page, and
// unlike S16, is that its axis is on it in ALL SIX: THIRTEEN control
// kinds - text, search, email, tel, url, number, date, time, range, select, radio,
// checkbox and textarea - every one of them bound and every one of them observable
// in the live preview card beneath the form.
//
// THE BOARD'S PREMISE IS PARTLY REFUTED AND THE REFUTATION IS ALREADY IN THIS DEMO.
// It said only `checkbox` and `textarea` were proven and that `select`, `radio` and
// the multi-field form shape were unmeasured in all six lanes. The /s7 route IS that
// shape - a `<form>` with a `<select>`, a `<textarea>`, a radio group and a keyed
// checkbox group - it emits in all six lanes, and `pnpm e2e` drives it in a real
// browser across six demos.
//
// MEASURED ON A PROBE THROUGH ALL SIX REAL EMITTERS: every one of the sixteen
// `type=` values emits everywhere. No emitter reads the VALUE of a `type` attribute,
// so the axis has no per-type refusal in it at all. What costs something is the
// attribute BESIDE the type, and it costs the emitted TYPECHECK rather than any
// emitter: `required`, `multiple`, `disabled`, `readonly`, `autofocus`, `spellcheck`
// and a static `checked` each add an `error TS` line to all three JSX lanes, while
// `min`, `max` and `step` are FREE - which is why the number, date, time and range
// fields here carry real bounds. The required markers are literal `*` characters in
// the label text and the submit guard is `aria-disabled`.
//
// TWO REFERENCE DEFECTS, MEASURED LIVE AND NOT COPIED: with its New Contact dialog
// open the reference holds SEVEN inputs, TWO selects and ZERO textareas - its Notes
// field is a single-line input - and `document.querySelectorAll('h1,h2,h3,h4')`
// returns ZERO on the whole document. This page ships a real textarea, an `<h1>` and
// three `<h2>`s.
//
// A `date` INPUT IS NOT A CLOCK AND THIS PAGE NAMES NO GLOBAL. `since` and `slot`
// are literal seeded strings, so the angular lane - which cannot resolve `Date` in a
// transplanted body - is not lost for a reason unrelated to forms.
// TWO STYLESHEETS, AND THE ORDER IS LOAD-BEARING. `/shadcn-theme/tokens.css` is the
// vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load FIRST,
// because every colour in the second file is a `var()` from it.
// `/contact-css/contacts.css` is THIS REPOSITORY'S OWN WORK - the Square UI
// reference is licence-restricted to REFERENCE-ONLY, so nothing was copied from it
// and its geometry was MEASURED in a browser instead, dialog included. Both are
// written into `public/` by `pnpm copy-shadcn-theme` and `pnpm copy-contact-css`,
// and linked HERE rather than in src/root.tsx's <head> because `contacts.css`
// restyles `body`.
//
// S17 IS A SINGLE COMPONENT, so this lane keeps its `onTrace$`: a function prop
// never crosses a component boundary here and the un-forwardable-prop defect T003
// isolated is not reachable. THIS LANE'S OWN ATTRIBUTE COSTS ARE THE WIDEST OF THE
// THREE - it charges for `list` and `inputmode` where the other two do not - and the
// fixture spends none of them.
//
// Like S10-S16 this page is deliberately OUT of the 6 x 9 three-way contract -
// `scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'] - so it is
// browsable only. QWIK CITY CANONICALISES TO A TRAILING SLASH: `/contacts` answers
// 301 with `location: /contacts/`.
export default component$(() => (
  <>
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/contact-css/contacts.css" />
    <Contacts onTrace$={$(() => {})} />
  </>
));
