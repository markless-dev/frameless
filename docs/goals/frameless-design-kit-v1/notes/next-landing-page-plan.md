# Next tranche — landing page, 3 variants from the kit

Agreed with the owner while the kit was still building. This is **not** part of
`frameless-design-kit-v1`; it needs its own board once the kit closes.

## The lesson this plan is built on

The previous attempt cited three reference sites and the result took them as **architecture**
rather than as **mechanics**:

- avara.xyz was cited for the *sticker-popup interaction* → became the whole page shape
- sticker.oooo.so was cited for the *peel effect* → treated as a layout idea
- react.gg was cited for *energy* → produced nothing structural

The output was a single scattered-stickers screen with no second section. Twice.

**Rule for this tranche: a reference contributes one mechanic. Page shape comes from the kit,
never from the reference.**

## Sequence

### 1. Cold-agent one-shot first (T012 of the kit goal)
Before any variant work. A fresh agent, the kit path, one sentence. It is the honest baseline:
does the kit produce a coherent full page unaided?

Cheap, and it decides whether to fix the kit before multiplying the problem by three. Fixing a
kit defect once beats fixing it in three variants.

### 2. One section-complete skeleton
Build **one** page from the kit with all mandatory sections from
`artifacts/web/page-composition.md`: hero, six targets, one-source-six-outputs, how it works,
activation-neutrality, the oracle, who it's for, Studio teaser, footer-marks.

Real compiled output throughout — never hand-written snippets. **No signature mechanic yet.**

This is the shared spine, and it is what structurally prevents a repeat of the one-hero
failure.

### 3. Fork three ways
Each variant changes **only** the hero mechanic and the output-exploration section. Everything
else stays common.

That makes the variants genuinely comparable: the owner chooses between *ideas*, not between
one finished page and two stubs.

## The three mechanics (owner-selected)

### A — The Pile *(avara mechanic)*
Scattered draggable framework stickers. Click one and its real compiled output opens.
Hero is physics and scatter. The playful end of the range.

### B — The Bench *(the brand's own device)*
Six window frames, and inside each the **identical** view. Scrub between frames; the view
never changes. Hero *is* "six frames, one view".

Strongest conceptually — the hero and the thesis are the same object. If the six crops ever
differ, the device argues the opposite of the product claim.

### C — The Peel *(sticker.oooo.so mechanic)*
The `.tsrx` source as a sticker. Peel the corner and the emitted framework code is literally
underneath. Hero is the compile step as a physical gesture.

The peel is also the only place `drop-shadow` is permitted in the whole system, so this
variant exercises a rule nothing else does.

## Constraints inherited from the kit

Non-negotiable in every variant:

- Minimum seven sections. A hero is not a landing page.
- No text on the raw photograph. Scrim, or bound the photo inside a frame/card/die-cut.
- Lime is a surface and a mark, never an ink. Display lime only on `--surface-deep`.
- No `box-shadow` anywhere. Only `--shadow-peel`, only while peeling.
- Pure white is not a surface.
- All six marks, canonical order, never in `--accent`, each labelled with its name.
- Decorative stickers never overlap readable text.
- Holds at 390px; `prefers-reduced-motion` honoured.
- `footer-marks` present — trademark and font licence.

## Verification for that tranche

- `node brand/tools/structural-gate.mjs` stays green.
- A per-variant interaction contract, Playwright-driven: the mechanic works, real emitter
  output is shown, all mandatory sections exist, Que Grotesque actually loads, mobile holds.
- The three variants must use **genuinely different** core mechanics — three skins of one
  mechanic fails the owner's intent.

## Note

`website/` is likely being deleted (OD5). This tranche starts from the kit, not from those
variants. The kit is self-contained and verified independent of `website/`, so its removal
costs nothing here.
