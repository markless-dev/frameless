import { Component } from '@angular/core';

import { Contacts } from '../emitted/Contacts';
import { noTrace } from './scenario-props';

/**
 * The /contacts route, and one of this lane's wrapper components.
 *
 * THE EIGHTH APPLICATION - CONTACTS - and THE FORMS CARD. It is the FOURTH
 * scenario in this corpus that all six lanes emit and ship, after S13, S15 and S16,
 * This comment used to add "UNLIKE S16 THE AXIS IT MEASURES IS ACTUALLY ON THE
 * PAGE" - S16's axis is on its page now, in five of six lanes, so the contrast is
 * WITHDRAWN rather than left to read as current. What is true of THIS page, and
 * unlike S16, is that its axis is on it in ALL SIX: THIRTEEN control
 * kinds - text, search, email, tel, url, number, date, time, range, select, radio,
 * checkbox and textarea - every one of them bound and every one of them observable
 * in the live preview card beneath the form.
 *
 * THE BOARD'S PREMISE IS PARTLY REFUTED AND THE REFUTATION IS ALREADY IN THIS DEMO.
 * It said only `checkbox` and `textarea` were proven and that `select`, `radio` and
 * the multi-field form shape were unmeasured in all six lanes. The /s7 route IS that
 * shape - a `<form>` with a `<select>`, a `<textarea>`, a radio group and a keyed
 * checkbox group - it emits in all six lanes, and `pnpm e2e` drives it in a real
 * browser across six demos.
 *
 * MEASURED ON A PROBE THROUGH ALL SIX REAL EMITTERS: every one of the sixteen
 * `type=` values emits everywhere. No emitter reads the VALUE of a `type` attribute,
 * so the axis has no per-type refusal in it at all. What costs something is the
 * attribute BESIDE the type, and it costs the emitted TYPECHECK rather than any
 * emitter: `required`, `multiple`, `disabled`, `readonly`, `autofocus`, `spellcheck`
 * and a static `checked` each add an `error TS` line to all three JSX lanes, while
 * `min`, `max` and `step` are FREE - which is why the number, date, time and range
 * fields here carry real bounds. The required markers are literal `*` characters in
 * the label text and the submit guard is `aria-disabled`.
 *
 * TWO REFERENCE DEFECTS, MEASURED LIVE AND NOT COPIED: with its New Contact dialog
 * open the reference holds SEVEN inputs, TWO selects and ZERO textareas - its Notes
 * field is a single-line input - and `document.querySelectorAll('h1,h2,h3,h4')`
 * returns ZERO on the whole document. This page ships a real textarea, an `<h1>` and
 * three `<h2>`s.
 *
 * A `date` INPUT IS NOT A CLOCK AND THIS PAGE NAMES NO GLOBAL. `since` and `slot`
 * are literal seeded strings, so the angular lane - which cannot resolve `Date` in a
 * transplanted body - is not lost for a reason unrelated to forms.
 * THIS LANE ALMOST LOST THE CARD, AND NOT ON THE AXIS. The first spelling of the
 * fixture used TEMPLATE LITERALS inside template expressions - a company link
 * `href`, a per-status avatar class, a joined first/last name and the tag
 * checkboxes' `id`/`for` pair - and this emitter refused it, verbatim:
 *
 *   Angular emitter refuses the template expression "`#/company/${row.id}`": a
 *   backtick, a ${ or a backslash would terminate or interpolate the TypeScript
 *   template literal the inline template lives in
 *
 * The other five lanes took every one of them. The narrowing is the same one
 * constraint (10) makes for globals: the strings are SEEDED FIELDS on the rows
 * (`href`, `avatarClass`, `full`, `initial`, `domId`, `controlId`) or `computed`
 * getters, both of which live in the CLASS rather than in the inline template.
 *
 * NOTHING HERE IS EMITTED OUTPUT and nothing here is app code: this component
 * renders the emitted `<frameless-contacts>` and two `<link>`s. It exists for the
 * reason ./todomvc-page.ts, ./hn-page.ts, ./habits-page.ts and ./board-page.ts
 * record: to link stylesheets on this route and no other, because `contacts.css`
 * restyles `body`, `:root`, `#root` and `#app`, and a global link would move the
 * geometry of the nine s1-s9 scenarios `pnpm e2e` compares across six lanes.
 *
 * `contacts.css` IS THIS REPOSITORY'S OWN WORK - the Square UI reference is
 * licence-restricted to REFERENCE-ONLY, so nothing was copied from it and its
 * geometry was MEASURED in a browser instead. It is copied into
 * `public/contact-css/` by `pnpm copy-contact-css` and picked up by the `public`
 * asset glob in angular.json. `/shadcn-theme/tokens.css` is the vendored shadcn/ui
 * default theme (MIT, (c) 2023 shadcn) and MUST LOAD FIRST.
 *
 * Like the four routes above it is deliberately NOT part of the 6 x 9 three-way
 * contract, so it is browsable only. It carries no seed: IR-8 has no lowering for an
 * array type, so the nine contacts, five companies and five tags are seeded INSIDE
 * the emitted component and all six lanes start from byte-identical data.
 */
@Component({
  selector: 'app-contacts-page',
  imports: [Contacts],
  template: `
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/contact-css/contacts.css" />
    <frameless-contacts [onTrace]="trace" />
  `,
})
export class ContactsPage {
  readonly trace = noTrace;
}
