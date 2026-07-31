# The habit-tracker sheet — this repository's own work

`habits.css` styles `S15` (`/habits`) in all six lanes. It is **not vendored**
and nothing in it was copied from anywhere.

## Provenance, and the licence that constrains it

The named visual reference recorded on the card before the build was
<https://square-ui-habit-tracker.vercel.app/>, part of `zerostaticthemes/square-ui`.

**That project is NOT MIT.** It ships a bespoke *"ln-dev UI License"* © 2026 lndev
— GitHub classifies the repository `NOASSERTION` — which forbids publication of the
templates **or any derivative** in any repository. Frameless is public, so the owner
ruled the reference **reference-only**.

What that means in practice, and what was actually done:

- **Nothing was copied.** Not a class name, not a declaration, not a file. This
  sheet's class names come from
  `packages/compiler/test/fixtures/s15-habit-tracker.tsrx` and are printed
  unchanged by all six emitters.
- **The geometry was MEASURED, in a browser.** Every number in `habits.css` that
  has a counterpart on the reference is a `getBoundingClientRect()` or
  `getComputedStyle()` reading taken off the rendered page with Playwright — the
  256px sidebar, the 60px top bar, the 704px (44rem) centred content column, the
  44px toggle, the 80px minimum streak card, the 12px card radius, the 30px/900
  weekday heading at `-0.75px` tracking.
- **Every colour is a vendored MIT token**, `var(--...)` out of
  `demos/shared/shadcn-theme/`, which is the shadcn/ui **default theme** (MIT,
  © 2023 shadcn). No colour was read off the reference and reproduced.

### The one place the palettes deliberately differ, and why

The reference's accent — the filled checkbox, the progress bar, the 30-day
heat-map — is `oklch(0.6 0.22 290)`, a **purple that is not a shadcn default
token**. `--primary` in the vendored default theme is `oklch(0.205 0 0)`,
near-black. This sheet uses `--primary`.

Reproducing the purple would be reproducing **their theme** rather than the
measured geometry, which is the thing the licence ruling forbids. The fan-out is
unaffected: the toggle still goes from a dashed transparent ring to a solid
filled field, which is what is asserted.

## Where this page deliberately overshoots the reference: the row is the target

The reference's habit row is a `<div>` carrying one `<button>`, and that button
is **44×44** — the same 44 this sheet measured and reproduced. Everything else in
the row is inert there, and it was inert here too. Driven live on the reference
at 1440×900, one page per arm from a fresh load:

| clicked | reference | this page, before | this page, now |
| --- | --- | --- | --- |
| the 44×44 toggle | `0/6 → 1/6`, 2 strikethroughs | 12 observables move | 12 observables move |
| the emoji inside it | `0/6 → 1/6` | 12 observables move | 12 observables move |
| the habit **name** | **nothing** | **nothing** | **12 observables move** |
| the row body / dot strip | **nothing** | **nothing** | **12 observables move** |

The reference's own toggle even computes `cursor: default`; this one is
`cursor: pointer`, over the whole row. That is a **deliberate divergence**, and
it is recorded here rather than in a comparison table that quietly reports a
match: a 44×44 target on a 664×74 row is **four per cent** of the row, and a
reader who clicks the other ninety-six per cent sees nothing move and concludes
the page is dead — which is what happened.

It is bought with `.ht-check::after`, one transparent overlay that belongs to the
**same button**, so no handler, no markup and no emitted artifact changes. The
cost is measured and kept: text inside a habit card can no longer be selected
with the mouse (`getSelection()` returns `''` over the card name and `'Meditate'`
over the sidebar name, which is not overlaid). `habits.css` carries the full
argument, including the negative control that caught the first version
swallowing the 10px gap between cards.

## Cascade order is load-bearing

```html
<link rel="stylesheet" href="/shadcn-theme/tokens.css" />
<link rel="stylesheet" href="/habit-css/habits.css" />
```

`tokens.css` **must load first** — every colour here is a `var()` from it. It is
written into each lane's asset root by `demos/shared/copy-shadcn-theme.mjs`;
this file by `demos/shared/copy-habit-css.mjs`. Both are asserted the same way:
delete the copies, re-run, compare digests.

## Why it is linked per-route and never globally

`habits.css` restyles `body`, `:root`, `#root` and `#app`. A global link would
move the geometry of the nine `s1`–`s9` scenarios that `pnpm e2e` compares byte
for byte across six lanes. Every lane links it in its `/habits` route wiring, so
the six pages stay like for like. `todomvc-app-css`, `codex.css` and `hn.css` all
record the same rule.

## The shell neutralisation at the top is a measured repair

`hn.css` found it first: react, solid and vue are served by a create-vite
scaffold that sets `:root { font: 18px/145%; letter-spacing: 0.18px }` and
`#root`/`#app { width: 1126px; text-align: center }`, and qwik, svelte and
angular are not — so the same emitted markup rendered **two different pages**
across six lanes while every declared value was identical. It is neutralised
here, in the page-scoped sheet, and never in the three shells, which are shared
with S1–S12.
