# The task-board sheet — this repository's own work

`board.css` styles `S16` (`/board`) in all six lanes. It is **not vendored** and
nothing in it was copied from anywhere.

## Provenance, and the licence that constrains it

The named visual reference recorded on the card before the build was
<https://square-ui-task-management.vercel.app/>, part of `zerostaticthemes/square-ui`.

**That project is NOT MIT.** It ships a bespoke *"ln-dev UI License"* © 2026 lndev
— GitHub classifies the repository `NOASSERTION` — which forbids publication of the
templates **or any derivative** in any repository. Frameless is public, so the owner
ruled the reference **reference-only**.

What that means in practice, and what was actually done:

- **Nothing was copied.** Not a class name, not a declaration, not a file. This
  sheet's class names come from
  `packages/compiler/test/fixtures/s16-task-board.tsrx` and are printed unchanged
  by all six emitters.
- **The geometry was MEASURED, in a browser.** Every number in `board.css` that
  has a counterpart on the reference is a `getBoundingClientRect()` or
  `getComputedStyle()` reading taken off the rendered page with Playwright at
  1440×1000 — the 256px sidebar, the 60px top bar, the toolbar row ending at
  y=118, the board starting at y=134, the 360px column at 12px gap and 12px
  padding, the 334px card, the 10px radii, the 14px/500 card title and the
  18px/600 page heading.
- **Every colour is a vendored MIT token**, `var(--...)` out of
  `demos/shared/shadcn-theme/`, which is the shadcn/ui **default theme** (MIT,
  © 2023 shadcn). No colour was read off the reference and reproduced.

### The one place the palettes deliberately differ, and why

The reference's tag chips are **coloured per category** — a blue `Design`, a pink
`Product`, an amber `New releases`. Those are **not shadcn default tokens**.
Reproducing them would be reproducing **their theme** rather than the measured
geometry, which is the thing the licence ruling forbids, and it is the same
ruling `habit-css/README.md` records for that page's purple accent.

The chips here are `--secondary` on `--secondary-foreground` and keep the
**measured** 20px height, 8px horizontal padding, 6px radius and 11px/500 type.
Nothing this page asserts depends on chip colour.

## What this page HAS, in how many lanes, and what it still does not

**This section used to say `S16` "is the drag-and-drop scenario and it has no
drag".** That sentence is **false at HEAD** and it was already false the moment
the drag landed — the same change that shipped the drag also added the
`[draggable='true']` cursor rules and the `[data-dragging='yes']` highlight to
this very sheet, and this paragraph was not updated with them. It is corrected
here off a measurement taken at HEAD, not off a receipt.

**The drag is real, and it is a FIVE-LANE claim.** Measured with a **real native
mouse drag** — mouse down on the card, twenty interpolated moves, mouse up; no
synthetic `DragEvent` anywhere — at 1600×1000, driving card `t1` out of
`backlog` and onto `todo`, twice through all six lanes:

| lane | card moved and STAYED | `data-dragging="yes"` during the gesture |
| --- | --- | --- |
| react | **NO — inert** | none — the card never reaches it |
| solid | yes | `t1` |
| qwik | yes | `t1` |
| svelte | yes | `t1` |
| vue | yes | `t1` |
| angular | yes | `t1` |

`document.querySelectorAll('[draggable="true"]')` returns **9 in all six lanes**,
so react is not missing the attribute — it is missing the listener. react-dom
says so in its own console while the gesture runs: *"Invalid event handler
property `onDragstart` / `onDragend` / `onDragover`"*. That is `docs/DEFECTS.md`
entry 15 on screen, and `.tb-note` on the page says which lane does which.

**The reading can fail.** The identical gesture released over the sidebar — not a
drop zone — moves nothing, in **all six** lanes.

**The arrows are not a leftover.** `◀`/`▶` move a card in **all six** lanes and
are how react moves one, which is why removing them would break a working lane.

### What is still genuinely absent

No drag **ghost** and no **drop-target** highlight. Both need a bound `class` or
`style`, whose lowering is unmeasured in all six lanes, and the card that shipped
the drag refused to reach for one by name rather than attempting it. The
dragging highlight that *does* exist is a bound `data-` attribute
(`data-dragging`), not a bound class — which is exactly why it was affordable.

That absence still explains an absence in this file: no rule here binds a
`style`-shaped inline width or transform. A drag ghost is exactly where an
inline `style` binding would have been reached for, and no fixture in this corpus
binds one.

**And the reference has no drag at all.** Re-measured at HEAD on the live
reference: `document.querySelectorAll('[draggable]')` is **0**, and
`[draggable="true"]` is **0**. This page **overshoots** what it copies — the
absence above is ours to explain, the drag is not.

## Cascade order is load-bearing

```html
<link rel="stylesheet" href="/shadcn-theme/tokens.css" />
<link rel="stylesheet" href="/board-css/board.css" />
```

`tokens.css` **must load first** — every colour here is a `var()` from it. It is
written into each lane's asset root by `demos/shared/copy-shadcn-theme.mjs`;
this file by `demos/shared/copy-board-css.mjs`. Both are asserted the same way:
delete the copies, re-run, compare digests.

## Why it is linked per-route and never globally

`board.css` restyles `body`, `:root`, `#root` and `#app`. A global link would
move the geometry of the nine `s1`–`s9` scenarios that `pnpm e2e` compares byte
for byte across six lanes. Every lane links it in its `/board` route wiring, so
the six pages stay like for like. `todomvc-app-css`, `codex.css`, `hn.css` and
`habits.css` all record the same rule.

## The shell neutralisation at the top is a measured repair

`hn.css` found it first: react, solid and vue are served by a create-vite
scaffold that sets `:root { font: 18px/145%; letter-spacing: 0.18px }` and
`#root`/`#app { width: 1126px; text-align: center }`, and qwik, svelte and
angular are not — so the same emitted markup rendered **two different pages**
across six lanes while every declared value was identical. It is neutralised
here, in the page-scoped sheet, and never in the three shells, which are shared
with S1–S12.
