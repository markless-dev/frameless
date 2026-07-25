# T004 — Locked visual system

Judge independently recomputed every T003 contrast ratio, dimension, bit depth and SVG
claim before ruling. All verified exactly. **This spec is binding for T006, T009, T010.**

## The organizing idea

**Lime is a synthetic overlay on a desaturated natural bed.** From which everything else
follows mechanically:

> **Lime is a surface and a mark. Never an ink.**

Relative luminance 0.6616 — it is a *light* color that behaves like a highlighter. An agent
that internalizes this one sentence generalizes correctly to cases the kit never enumerated.

## 1. Cream — two tokens, one halo

| Token | Value | Job |
|---|---|---|
| `--halo` | `#fdf8e4` | Die-cut band. Only this. Never a page surface. |
| `--surface` | `#f2efd4` | Default light page bed. |
| `--paper-warm` | `#ebd5a0` | Texture beds, decorative bands. |
| `--paper-edge` | `#dec48c` | Corner vignette gradient stop only. |

`#fdf8e4` is the **median** of the five measured creams, not the mean — `#fcfcfa` is a cool
outlier among four warm values, and averaging yields a cream present in no file. A median is
a real measured pixel, so the token traces to an asset.

**Measured consequence:** `--halo` vs `--surface` is only **1.09:1**. The halo is nearly
invisible on the page bed. That is correct sticker physics, and it makes the keyline
load-bearing — see §2.

## 2. Outline — `--ink: #11160f`. Normalize; reject the hue-derived rule.

The leaf's 12px outline: thickest, most deliberately drawn, faint green cast consistent with
the aged print. Not pure black — nothing in this piece is.

**Pine's green outline is an inconsistency, not a rule.** Three reasons, weighted:

1. **A hue-derived outline is unimplementable.** What is the "subject hue" of a button, a
   badge, the word *frameless*? A rule that only works on nature illustrations cannot govern
   a UI kit.
2. **The evidence is noise.** 3 near-neutral / 1 green / 1 absent is variance, not a system.
3. **The keyline is load-bearing.** Since halo-vs-surface is 1.09:1, the ink keyline
   (15.78:1) is the *only* thing separating a sticker from the page. Let it drift toward the
   subject hue and a light-hued subject produces a light keyline — the sticker dissolves.

`mushroom.png` having no keyline is a **source defect**, not a permitted variant. Legacy
raster stickers keep their original outlines (we don't repaint them, and the kit shouldn't
lie about its own assets). Every *new* die-cut and every UI primitive uses `--ink`. Document
as a stated exception in `assets/README`.

## 3. Halo geometry — clamped ratio. Shadows forbidden.

Measured 2.7–3.6% of longest edge. Midpoint → **3.2%**.

```css
--sticker-halo-ratio: 0.032;
--sticker-halo: clamp(0.375rem, 3.2cqmax, 1.5rem);
--sticker-halo-fixed: 0.75rem; /* where container units unavailable */
```

`cqmax` *is* "longest edge of the container," so the CSS expresses the measured rule exactly.
Floor 6px (below that a cut edge stops reading); ceiling 24px = 3.6% × 640, the **measured
maximum** — do not extrapolate past what the art does.

Stacking outward: artwork → `--ink` keyline → `--halo` band → nothing.

**Shadows FORBIDDEN.** T003 verified 0.00 dark-fringe px across all five — a treatment, not
an oversight. These are printed and cut flat, not floating. State as a hard prohibition:
`box-shadow` is the single most likely thing a generating model adds by reflex, and unstated
it appears in every one-shot. Depth comes from halo, keyline, rotation, overlap.

**One bounded exception** — a physically lifting corner genuinely casts one:
```css
--shadow-peel: drop-shadow(0 4px 6px rgb(17 22 15 / 0.28)); /* .is-peeling ONLY */
```
Gate assertion: `box-shadow` absent everywhere; `drop-shadow` only under `.is-peeling`.

## 4. The lime law

| Context | Ruling |
|---|---|
| Body text | **NEVER.** Any surface, any size. |
| Display type | Only on `--surface-deep` (9.91:1), at `--step-3`+. |
| Button fill | Primary CTA = lime fill + `--ink` label (**12.43:1**). The flagship usage. |
| Button text | Never lime + white (1.48). Never lime + cream (1.44). *Name these — they are the two most likely agent errors.* |
| Borders | On dark, fine. On light, lime may never be the sole indicator — pair with an `--ink` keyline carrying the 3:1. |
| Icons | As borders: the outline carries contrast, the lime carries brand. |
| Focus ring | **Two-tone: inner `--ink` 2px + outer lime 2px.** On any surface one half passes 3:1. One rule, works everywhere. |
| On photograph | Forbidden as text on raw art. Permitted only as a lime *fill shape* with die-cut cream + ink edges, or over a scrim (§11). |

**Minimum size for 3:1-only pairings** (`#337b71` 3.38, `#777732` 3.18): **`--step-2` or
larger** — 1.7578→2.3322rem, above 24px at every viewport. Gating on a *token* rather than a
px number makes it checkable by the gate.

`tokens/color.json` carries `permitted_pairs` / `forbidden_pairs` **with ratios as data**, so
T006's verify is a real recomputation, not a claim.

## 5. Dark surface — `#1d2c22`

Rejecting pure black and `#111010`: nothing here is pure black, and `#111010` is
indistinguishable from black at fill scale — wasting the chance to make the dark bed read as
the same aged print. `#1d2c22` is a desaturated deep green in the environment's own hue
family: the dark end of *this* world, not generic dark mode. Gives lime **9.91:1** (AAA),
unlocking lime display type with no size caveat.

**Two dark tokens, strictly separated:**
- `--ink: #11160f` — strokes, keylines, text on light. **Never a large fill.**
- `--surface-deep: #1d2c22` — large fills, hero beds, footer. **Never a stroke.**

**Forbidden pair, stated explicitly: `--ink` on `--surface-deep` = 1.25:1.** Invisible. This
is the exact mistake the separation prevents.

## 6. Semantic roles

| Role | Light | vs surface | Dark | vs deep | Intent |
|---|---|---|---|---|---|
| `--surface` | `#f2efd4` | — | `#1d2c22` | — | Aged paper. **Pure white forbidden as a page surface.** |
| `--ink` | `#11160f` | 15.78 | `#fdf8e4` | 13.74 | Reading copy, keylines. |
| `--ink-muted` | `#6b6b2d` | **4.80** | `#ebd5a0` | ~11 | Secondary text. *Derived: grass shadow ×0.90.* |
| `--accent` | `#cce007` | 1.27 ✗ | `#cce007` | 9.91 | Governed entirely by §4. |
| `--accent-deep` | `#2e6f66` | **5.05** | `#70988b` | ~5 | **The accent that CAN be an ink.** *Derived: sea ×0.90.* |
| `--success` | `#115b2e` | 7.06 | `#cce007` | 9.91 | Measured pine. |
| `--warning` | `#eeab00` | 1.73 ✗ | `#eeab00` | 7.29 | **Fill-only on light**, `--ink` label. |
| `--danger` | `#9c5839` | 4.67 | `#ec7265` | 4.99 | *Derived: roof ×0.85 / measured pink.* |

**Two corrections to T003.** Both were framed as good pairings; both **fail AA normal text**:
`#777732` = 4.04, `#337b71` = 4.29. Hence the derived replacements. Every derived value must
carry `derived_from` in the JSON so the kit never pretends it was sampled.

`--accent-deep` exists **because lime cannot be an ink**. Without a second accent working on
both beds, every link and inline emphasis falls back to plain ink and the palette reads as
monochrome-plus-a-highlighter.

## 7. Six-badge ruling — ⚠️ SUPERSEDED BY OWNER 2026-07-24

> **OWNER RULING: do not write "planned". All six frameworks are shipped.**
>
> The three-state axis below is **void**. Every framework badge renders in the `shipped`
> treatment: full `--halo`, solid `--ink` keyline, logo at 100%. No dimmed logos, no dashed
> keylines, no halo-less variants, no PLANNED/PARTIAL labels.
>
> **What survives from the ruling below and still applies:**
> - The in-badge **text label** stays — it survives cropping and grayscale, and it is good
>   design regardless of state. It now carries the framework's *name*.
> - **Framework marks may never render in `--accent`** (§12). Unchanged and still binding.
> - The badge component still owns the canonical framework order:
>   React, Vue, Svelte, Solid, Angular, Qwik.
>
> `tokens/color.json` was authored against the old spec and contains PLANNED-state entries
> (a dimmed `#989885` logo pairing). These must be removed — tracked as a T006 follow-up.
>
> The original ruling is preserved below, struck, for traceability.

## ~~7. Six-badge ruling — CONFIRMED, with hard refinements~~ *(void — see above)*

The stateful component is right, but two obvious implementations **fail the
screenshotted-out-of-context test**:
- **Opacity alone fails** — reads as hover or loading skeleton.
- **Color alone fails** — dies in grayscale and for colorblind viewers.

**Every state carries a text label rendered inside the badge.** Not a tooltip, not an
`aria-label`, not a caption. A word, in the badge, always. It is the only treatment surviving
a crop, a grayscale conversion, and an alt-text-free repost.

| State | Frameworks | Halo | Keyline | Logo | Label |
|---|---|---|---|---|---|
| `shipped` | React, Solid | Full `--halo` | Solid `--ink` | `--ink` 100% | **SHIPPED** |
| `proven-narrow` | Qwik | `--paper-warm` | Solid `--ink` | `--ink-muted` | **PARTIAL** + `data-scope="S1–S3 only"` |
| `planned` | Vue, Svelte, Angular | **NONE** | **Dashed** `--ink` | `--ink` 40% | **PLANNED** |

**The key refinement: `planned` has no halo at all.** Not a dimmed shipped badge. In this
brand the die-cut halo *is* the signal of a real printed collectible thing — **an unprinted
thing has no cut edge.** Brand-native rather than a generic disabled style, and it survives
grayscale and cropping because the *geometry* differs, not just the color.

- **No default state.** `framework="vue"` with no state renders `planned`, never `shipped`.
  Default to the most conservative state, always.
- **The badge fixes the badge, not the sentence.** The six-mark lockup may only appear with
  copy naming the state axis — e.g. *"Three targets shipped. Three planned."* Encode in both
  `components/framework-badge.html` and the verbal half, or T002's #1 false claim returns
  through the copy.

## 8. Components — 11 primitives

`sticker` (die-cut base) · `framework-badge` (structurally prevents the overclaim) ·
`wordmark` (3 lockups; gap-list item) · `button` (lime law's flagship) · `hero` (the one
place lime type is legal) · `card` · `code-block` (the product *is* code) ·
`output-switcher` (**the only component that demonstrates the thesis rather than asserting
it**) · `coming-soon-tag` · `callout` (makes honesty a design element) · `footer-marks`
(**must be a component — otherwise the cold agent omits it**).

Focus ring is a token/utility, not a component.

## 9. Motion — JSON first

`motion.json` → generated `motion.css` → `specimen.html`.

| Name | Curve | ms | For |
|---|---|---|---|
| `press` | `cubic-bezier(0.4, 0, 1, 1)` | 90 | Pressing a sticker down is instant. |
| `release` | `cubic-bezier(0, 0, 0.2, 1)` | 160 | **Deliberately asymmetric with press** — down fast, up gentle. |
| `peel` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 260 | Overshoot = a physical object with springiness. |
| `slide` | `cubic-bezier(0.65, 0, 0.35, 1)` | 300 | Output-switcher; A↔B swaps. |
| `settle` | `cubic-bezier(0.22, 1, 0.36, 1)` | 420 | Long tail, no overshoot — settles, doesn't bounce twice. |
| `instant` | `linear` | 0 | `prefers-reduced-motion`. |

```css
peel:  rotate(-1.5deg) translateY(-3px) scale(1.015) + --shadow-peel
press: translateY(1px) scale(0.985)   /* no rotation */
rest:  --tilt-1: -2.5deg; --tilt-2: 1.75deg; --tilt-3: -1deg;
```

**Decorative stickers are never at 0deg. A sticker placed perfectly square reads as a div.**

`prefers-reduced-motion: reduce` mandatory: durations → 0ms, no transforms, opacity fades
capped at 120ms.

## 10. Typography

| Weight | Steps | Role |
|---|---|---|
| Black 900 | `--step-7`, `--step-6` | Display only. Tracking `-0.02em`. |
| Bold 700 | `--step-5`…`--step-3` | Headings; button labels; badge labels uppercase `+0.06em`. |
| Medium 500 | `--step-2` | Lead paragraphs, UI labels, nav. |
| Regular 400 | `--step-0`…`--step--2` | Reading copy, captions, legal. |

**`font-synthesis: none` globally, mandatory.** There is no italic or oblique in a static
subset set. Without this, browsers synthesize a fake italic and fake bold and the brand
silently degrades.

Latin-subset constraints: no non-English display copy in Que Grotesque; define a fallback
stack. Do not assume ™ or © exist — `footer-marks` needs them. Que Grotesque is **not**
monospace and must never set code; `code-block` uses `ui-monospace`.

**T006 must enumerate actual glyph coverage** into `fonts/quegrotesque.json` and derive the
fallback from that measurement. Judge could not verify (no `fontTools`); T003's 262-glyph
figure is single-sourced and should be re-measured by the task depending on it.

## 11. Photograph — restricted, three tiers

- **Tier 1 permitted:** decorative, **behind a mandatory scrim** — `--scrim-deep` (`#1d2c22`
  @72%) or `--scrim-paper` (`#f2efd4` @88%); ink/lime rules then apply as if on that solid.
  **No text over raw photograph, ever.** Contrast is a property of the pixel under the glyph,
  and measured local luminance swings 1.02→3.38 against lime. Remove the variable rather than
  test it.
- **Tier 2 preferred:** the photo as a bounded die-cut image inside a `sticker`/`card`, no
  text on it. Most on-brand — the coast is a photo *sticker*, not wallpaper.
- **Tier 3 forbidden:** full-bleed hero with a headline on the photo. **This is exactly what a
  cold agent does by default, so it must be forbidden by name.**
- Weight budget: 669KB / 2400×1351 ships via `<picture>` with width-limited variants.

## 12. Trademark & attribution — as a component

`footer-marks` carries:

> React, Vue, Svelte, Solid, Angular and Qwik are trademarks of their respective owners.
> Frameless is not affiliated with, endorsed by, or sponsored by any of them. Marks are used
> nominatively to identify compilation targets.

> Que Grotesque is licensed to Frameless. The WOFF2 files in this kit are self-hosted subsets
> and may not be redistributed, re-uploaded, or served from another origin.

Simple Icons' CC0 covers **path data, not trademarks** — state both.

**New rule from a real finding:** all six logos inherit `currentColor` (no `fill`), which is
exactly what makes recoloring trivial — so the kit must **forbid rendering a framework mark
in `--accent`**. Nominative use requires the mark stay recognizable; a lime React logo is
both a trademark risk and brand confusion. Marks render only in `--ink`, `--ink-muted`, or
their official brand color. `framework-badge` enforces this.

## 13. `mushroom.png` — normalize to 8-bit

116KB vs 21–31KB peers, ~4× weight for zero visible benefit on a flat illustration. Gate
assertion: no asset under `assets/` exceeds 8 bits per sample. It is the outlier **twice**
(16-bit *and* no keyline) — the weakest source asset, possibly worth regenerating.

## Board-truth note

Judge's four board-truth complaints were **stale** — it read a snapshot taken before the
T002/T003/T007 receipts landed. Verified against the checker: T002 `done`, T003 `done` with
receipt + `notes/T003-measured-visual-evidence.md`, T007 `done` with receipt, `active_task`
advanced, checker green with zero errors. No action needed; recorded so the correction isn't
re-applied later.

## OWNER DECISIONS carried forward

1. **Is "PLANNED" truthful for Vue/Svelte/Angular?** With zero code, the honest label may be
   "NOT SUPPORTED." Only the owner knows if they are genuinely roadmapped.
2. **Maturity label** — "proven early-stage" (current) vs "alpha" vs "research preview".
3. **Zip-able kit + licensed font.** The charter says self-contained *and* zip-able; bundling
   commercial WOFF2 in a distributable folder is a redistribution vector regardless of the
   note. Alternative: ship `fonts/` as `@font-face` + metrics + fallback with WOFF2 gitignored.
4. **Two coexisting token systems** — now concrete (`--surface: #f2efd4`,
   `--surface-deep: #1d2c22` will visibly diverge from `frameless-website-v1`).
5. **README overclaims** — the kit's verbal half will contradict the live README until fixed.
