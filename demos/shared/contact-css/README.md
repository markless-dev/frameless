# The contacts sheet — this repository's own work

`contacts.css` styles `S17` (`/contacts`) in all six lanes. It is **not vendored**
and nothing in it was copied from anywhere.

## Provenance, and the licence that constrains it

The named visual reference recorded on the card before the build was
<https://square-ui-contacts.vercel.app/>, part of `zerostaticthemes/square-ui`.

**That project is NOT MIT.** It ships a bespoke *"ln-dev UI License"* © 2026 lndev
— GitHub classifies the repository `NOASSERTION` — which forbids publication of the
templates **or any derivative** in any repository. Frameless is public, so the owner
ruled the reference **reference-only**.

What that means in practice, and what was actually done:

- **Nothing was copied.** Not a class name, not a declaration, not a file, not a
  contact. The nine seeded people, five companies and five tags in
  `packages/compiler/test/fixtures/s17-contacts.tsrx` are this repository's own
  invention; the reference's own sample data was read only to learn what SHAPE a
  contact row has. This sheet's class names come from that fixture and are
  printed unchanged by all six emitters.
- **The geometry was MEASURED, in a browser** — including the New Contact dialog,
  which this card was the first to open. Every number in `contacts.css` that has
  a counterpart on the reference is a `getBoundingClientRect()` or
  `getComputedStyle()` reading taken off the rendered page with Playwright at
  1440×1000: the 256px sidebar, the `[439, 21, 320, 36]` search field at radius
  8, the 370×194 card at a 382 column pitch and a 206 row pitch with radius 14
  and 16px padding, the 22px tag chip at 12px/500, the 480px dialog at radius 10
  and 24px padding, the 36px form control at radius 8 and 4px/12px padding, the
  14px/500 label 8px above it, the 209 + 12 + 209 two-column field row, the 74px
  form row pitch and the 115×36 submit button.
- **Every colour is a vendored MIT token**, `var(--...)` out of
  `demos/shared/shadcn-theme/`, which is the shadcn/ui **default theme** (MIT,
  © 2023 shadcn). No colour was read off the reference and reproduced.

### The two places the palettes deliberately differ, and why

The reference's **avatars are per-contact gradient discs** and its **tag chips are
coloured per tag** — a blue `Customer`, a violet `VIP`, an amber `Lead`. Neither
set is a shadcn default token. Reproducing them would be reproducing **their
theme** rather than the measured geometry, which is the thing the licence ruling
forbids, and it is the same ruling `habit-css/README.md` records for that page's
purple accent and `board-css/README.md` for the task board's category chips.

The avatars here are `--secondary` discs carrying the contact's initials at the
**measured** 40px; the chips are `--secondary` at the **measured** 22px height,
8px horizontal padding, pill radius and 12px/500 type. Nothing this page asserts
depends on either colour.

## What the reference gets wrong, and this page does not

Both measured live, both recorded rather than reproduced:

- **Its "Notes" field is a single-line `<input>`.** With the New Contact dialog
  open the whole document holds **seven `<input>`s, two `<select>`s and zero
  `<textarea>`s**. A notes field that cannot wrap is a defect; this page ships a
  real `<textarea>` at 72px.
- **The page has no heading element at all.**
  `document.querySelectorAll('h1,h2,h3,h4')` returns **zero** on the whole
  document, dialog included. This page has an `<h1>` and three `<h2>`s. It is the
  same family as the heading-order defect `board-css/README.md` records.
- **Only its email field carries a `type`.** Its phone field is not
  `type="tel"`, and first name, last name, role and notes carry no `type` at all.
  This page types every field, which is the entire subject of the card.

## The one place the LAYOUT diverges, and why

The reference opens the form as a **modal dialog**. `.tsrx` has no portal, no
focus trap and no `dialog` construct, and a modal that is merely an absolutely
positioned `<div>` is a worse artifact than a panel — so the form is a
**persistent panel below the grid**, at the dialog's own measured 480px width.

That is deliberately the cheaper divergence: it keeps **both** geometries
comparable at once. The grid still reads 370 / 12 / 14 and the form still reads
480 / 24 / 10 / 74, where a right-hand rail would have cost the grid a column and
made the card pitch unmeasurable.

## What is NOT in this file, and it is a measurement

**No rule here binds or depends on an inline `style`.** The priority ladder is
the obvious place a range control would have reached for one — a filled track, a
proportional bar — and it is a **class name** instead (`.cs-prio-1` … `.cs-prio-5`).
No fixture in this corpus binds a `style` attribute, so the lowering is
**unmeasured in all six lanes**; `board-css/README.md` records the same absence
from the other end, where a drag ghost would have wanted one.

**No rule here depends on `required`, `disabled`, `maxlength`, `size` or
`multiple`.** Each of those costs the emitted typecheck an `error TS` line in at
least one JSX lane and `pnpm check` must not rise above 267, so the required
markers are literal `*` characters in the label text and the submit guard is
`aria-disabled` — the one boolean-shaped spelling all six lanes agree on. The
`.cs-submit[aria-disabled='true']` rule at the bottom is what makes that visible.

## Cascade order is load-bearing

```html
<link rel="stylesheet" href="/shadcn-theme/tokens.css" />
<link rel="stylesheet" href="/contact-css/contacts.css" />
```

`tokens.css` **must load first** — every colour here is a `var()` from it. It is
written into each lane's asset root by `demos/shared/copy-shadcn-theme.mjs`;
this file by `demos/shared/copy-contact-css.mjs`. Both are asserted the same way:
delete the copies, re-run, compare digests.

## Why it is linked per-route and never globally

`contacts.css` restyles `body`, `:root`, `#root` and `#app`. A global link would
move the geometry of the nine `s1`–`s9` scenarios that `pnpm e2e` compares byte
for byte across six lanes. Every lane links it in its `/contacts` route wiring, so
the six pages stay like for like. `todomvc-app-css`, `codex.css`, `hn.css`,
`habits.css` and `board.css` all record the same rule.

## The shell neutralisation at the top is a measured repair

`hn.css` found it first: react, solid and vue are served by a create-vite
scaffold that sets `:root { font: 18px/145%; letter-spacing: 0.18px }` and
`#root`/`#app { width: 1126px; text-align: center }`, and qwik, svelte and
angular are not — so the same emitted markup rendered **two different pages**
across six lanes while every declared value was identical. It is neutralised
here, in the page-scoped sheet, and never in the three shells, which are shared
with S1–S12.
