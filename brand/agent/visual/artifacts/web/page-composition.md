# Page composition — REQUIRED READING before building any page

> **Agents: a hero is not a landing page.** The most common failure when building from a
> brand kit is producing one beautiful full-screen hero and stopping. The result looks like a
> holding page, answers no questions, and cannot be shipped.
>
> **If you build only a hero, you have not completed the task.**

## The minimum shippable landing page

A Frameless landing page has **at least seven sections**. Build all of them. In this order
unless there's a specific reason to deviate.

| # | Section | Job | Must contain |
|---|---|---|---|
| 1 | **Hero** | State what this is in one breath | Wordmark, headline from `messaging.md`, subhead, primary CTA, secondary CTA |
| 2 | **The targets** | Prove breadth concretely | Every framework badge, canonical order, each named as a word. **Never a total** |
| 3 | **One source, framework-native output** | Show the product working | The `.tsrx` source next to real compiled output; `output-switcher` |
| 4 | **How it works** | The three-beat explainer | Write once → compile out → prove it matches |
| 5 | **Activation-neutrality** | The differentiator | Hydration and resumption side by side, from `messaging.md` |
| 6 | **The oracle** | Why the claim is believable | Mutation-tested checker, browser-verified behavior |
| 7 | **Who it's for** | Let the reader self-identify | 2–3 audience segments from `audience.yaml` |
| 8 | **Frameless Studio** | The teaser | `coming-soon-tag`, no urgency, nothing to sign up for |
| 9 | **Footer** | Legal + provenance | `footer-marks` — trademark and font licensing |

Sections 1–7 and 9 are **mandatory**. Section 8 is strongly recommended.

## Rhythm — how sections differ from each other

A page of nine identically-shaped bands is as bad as one hero. Vary the treatment:

- **Alternate the bed.** The kit's bed is **dark by default** — `--surface`, with
  `--surface-raised` for panels and `--surface-sunk` for wells. Relief comes from the light
  paper island (`[data-surface="light"]`), used for reading-length copy. Trade them off; the
  dark bands are where lime display type is legal, so they carry the loud moments.
- **The bed is never a flat fill.** The page grain (`--texture-noise`) is on by default via
  `colors_and_type.css`. Do not cancel it. A faint ruled grid (`--texture-grid`) is the
  optional companion for empty space, never under reading copy.
- **Every die-cut object carries elevation.** `filter: var(--elev-sticker)` on a sticker,
  `var(--elev-card)` on a panel or code well, `var(--elev-lifted)` on the selected or hovered
  one. A flat object is the failure this kit was rebuilt to correct.
- **Alternate the density.** A dense section (code, comparison) should be followed by a
  breathing one (a single statement, a lot of space).
- **Vary the width.** Full-bleed bands, contained text columns, and off-grid sticker
  placements should not all be the same measure.
- **Use `--space-2xl-3xl` between major sections**, `--space-l-xl` within them. The one-up
  pairs exist for exactly this — they open up more on desktop than a single step does.

Aim for **at least three distinct section shapes** across the page.

## Hard rules learned from a failed one-shot

These come from an actual generated page that got them wrong. They are not hypothetical.

### 1. Never put text directly on the photograph
The coast image is Tier 3 forbidden as a full-bleed hero with a headline on it. Local
luminance across that image swings from 1.02 to 3.38 against lime — contrast is a property of
the pixel under each glyph, not of the image.

If the photo appears behind content it needs a **mandatory flat wash** of the page bed — see
`../../components/hero.html`, which declares the one sanctioned value — and then the normal ink
rules apply as if the region were that solid colour. **Preferred: use the photo as a bounded
die-cut image inside a sticker or a card, with no text on it at all.** The coast is a photo
*sticker*, not wallpaper.

### 2. Lime is never body text, and never sits on anything light
`#cce007` on white is 1.48:1. On the light paper island, 1.28:1. On the cream die-cut band,
1.09:1. It clears only on the dark bed, at 12.41:1, and only at `--step-3` or larger — that is
where the hero headline lives. Everywhere else lime is a **fill** carrying an `--accent-ink`
label at 13.08:1. `--ink` is now cream: putting it on lime is 1.22:1 and invisible.

### 3. Every section needs a heading a reader can scan
A page whose only large type is the wordmark gives a skimming reader nothing. Each section
gets a real heading at `--step-3` or larger.

### 4. Decorative stickers never overlap readable text
Nature stickers place in the margins, in gutters, at section seams. If a sticker sits behind
a paragraph, move the sticker — never lighten the text.

### 5. The page must work at 390px
Sticker collages that depend on absolute positioning collapse on mobile. Every scattered
layout needs a defined stacked fallback. Check it.

## What "interactive" should mean here

Interactivity should **demonstrate the product**, not decorate the page. Ranked:

1. **`output-switcher`** — one source, tab through six real compiled outputs. This is the
   single most valuable interaction on the page; it makes the central claim inspectable.
2. **Peel** — a die-cut sticker that physically lifts. Uses the `peel` curve, and steps the
   object from `--elev-sticker` up to `--elev-lifted`. It is not the only place a shadow is
   permitted — every object has one — it is the place the shadow visibly *changes*, which is
   what makes the gesture read as physical.
3. **Framework badges that open** to reveal that framework's actual emitted code.
4. Drag / scatter of decorative stickers. Charming, lowest value — never at the cost of the
   above.

Do not ship a page where the *only* interaction is dragging decorations around.

## Length

**A page carrying all the mandatory sections runs about 10–14 screens** on desktop at
1440×900. That is the honest number, measured: two independently built pages carrying this
section list came in at 12.4 and 13.0 screens. Both have since been superseded, and the
measurement is what survived them.

Do not treat length as the target in either direction. The section list is the requirement;
the length is whatever the section list plus the mandated `--space-2xl-3xl` between bands
produces. If yours fits in one viewport, sections are missing. If it runs long but every
section is on the list and none is filler, it is correct.

> Earlier revisions of this file said "4–8 screens". That was wrong — it was written before any
> complete page existed, and it contradicted the nine sections this same document mandates. It
> was caught by a cold agent that measured both numbers instead of believing one of them.

## Self-check before declaring done

- [ ] At least seven sections, not one hero
- [ ] Bed alternates between the dark default and the light paper island at least twice
- [ ] Page grain present — no section is a flat fill
- [ ] Every die-cut object carries an `--elev-*` shadow; no `box-shadow` except `--elev-inset`
- [ ] No total anywhere in the copy — the targets are named, never counted
- [ ] All six framework marks present, canonical order, none in `--accent`
- [ ] Real compiled output shown, not a hand-written snippet
- [ ] No text sitting directly on the raw photograph
- [ ] No lime text on any light surface, and no `--ink` label on a lime fill
- [ ] Every section has a scannable heading
- [ ] `footer-marks` present with trademark and font licensing
- [ ] Layout holds at 390px
- [ ] `prefers-reduced-motion` honored
- [ ] Opens from `file://` with zero console errors and zero failed requests
