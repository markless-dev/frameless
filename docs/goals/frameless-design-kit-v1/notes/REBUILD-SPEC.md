# Rebuild spec — measured from the authoritative concept art

Source of truth: `brand/_source/concept/CONCEPT-ART-AUTHORITATIVE.jpeg` (1448×1086).
Sampled by block-average from real pixels. **This supersedes every colour value in the kit.**

## The palette that was wrong, and what it actually is

| Region | Old (from the substitute) | **Measured from real art** |
|---|---|---|
| Sky upper | `#a9baa7` sage | **`#91c3c7`** — cyan-blue |
| Sky mid | — | `#68918d` |
| Cloud | `#ebd5a0` warm cream | **`#dddfc8`** — cool white |
| Sea deep | `#70988b` green-grey | **`#768ac9`** — genuinely blue |
| Sea mid | `#43837a` | `#8da3a6` |
| Grass lit | `#7e7d3c` | `#9a8d50` — brighter olive-gold |
| Cliff | `#8a835b` | `#85a591` |

The old palette was desaturated and green-shifted because it came from a generated stand-in.
The real art is **cooler, bluer and brighter**.

## The wordmark — the thing the whole brand rests on

| Part | Measured |
|---|---|
| Lime fill | **`#bcce05`** (block avg; owner's canonical `#cce007` is correct — JPEG averaging pulls it down) |
| Cream die-cut band | **`#e0dfca`** |
| Keyline | Heavy black, thick |

**It has a heavy offset drop shadow.** Chunky, dark, offset down-right. This is the single
most defining quality of the mark and the kit previously **banned it**.

Construction, outward: lime fill → thick black keyline → thick cream band → **drop shadow**.

## Framework badges — full colour, one per framework

Block-averaged (so true fills are more saturated than these; hues are correct):

| Framework | Measured | Direction |
|---|---|---|
| React | `#6ca9ce` | cyan-blue |
| Vue | `#218563` | deep green |
| Svelte | `#f49e74` | orange |
| Solid | `#4077cd` | strong blue |
| Angular | `#d96d7b` | crimson |
| Qwik | `#8979f8` | violet |

Each badge is a **rounded die-cut sticker**: saturated colour fill, glossy, the framework's own
logo in full colour, the name in white beneath, thick cream band, and a **drop shadow**.

They are NOT flat outlined rectangles with monochrome logos. That was the previous failure.

## Rules this rebuild replaces

| Old rule | Replacement |
|---|---|
| `box-shadow` forbidden kit-wide | **Elevation is mandatory — via `filter: drop-shadow()`.** See below. |
| One flat cream `--halo #fdf8e4` | Band is **tinted per sticker** and may be a gradient. Neutral cream `#e0dfca` only for the wordmark. |
| Neutral keyline `#11160f` everywhere | Keyline is the **dark end of that sticker's own hue**. |
| Band ≈ 3.2% of longest edge | **6–8% of width.** Chunky. |
| Desaturated "aged print" | **Saturated and vivid.** |
| Lime is never an ink | Still true for body text — lime on light genuinely fails. But lime is the hero display colour on dark, as in the art. |
| Six-frames device | **Deleted.** Never existed in the brief. |
| Counting targets | **Banned.** Headline is fixed: *"Compile once, output anywhere."* |

## Shadows: `drop-shadow`, NOT `box-shadow`

**Use `filter: drop-shadow()` everywhere.** Not `box-shadow`.

`box-shadow` casts a shadow of the element's *box* — a rectangle, or a rounded rectangle. A
die-cut sticker is an irregular shape with a cut edge, so `box-shadow` would draw a rectangle
floating behind it and instantly break the illusion.

`filter: drop-shadow()` follows the element's **actual alpha silhouette** — the cut edge, the
lettering, the wobble of the die-cut band. It is the only correct shadow for this brand.

```css
--elev-sticker: drop-shadow(0 6px 0 rgb(0 0 0 / 0.30));      /* chunky, offset, hard */
--elev-card:    drop-shadow(0 10px 14px rgb(0 0 0 / 0.35));  /* softer, larger */
--elev-lifted:  drop-shadow(0 18px 22px rgb(0 0 0 / 0.45));  /* peel / hover / selected */
```

Stack multiple `drop-shadow()` filters for a hard offset plus a soft ambient, the way the
concept art's wordmark reads.

**Consequence:** shadows go on the element that owns the alpha — the PNG, the SVG, or the
die-cut wrapper. Applying `filter` to a parent shadows the whole subtree as one silhouette,
which is usually what you want for a sticker and never what you want for a text block.

`box-shadow` stays effectively unused. Where a genuine rectangular panel needs depth (the
detail panel, a code block), a border plus a `drop-shadow` on the wrapper is preferred for
consistency.

## Texture — required

The background is **never a flat fill**.

- A **fine noise/grain** overlay across the whole page (owner's explicit request).
- react.gg-style **faint ruled grid** is a proven companion; use sparingly.
- The concept art itself has visible paper/print grain — match that register.

Implement as a tileable SVG/CSS noise at low opacity so it costs nothing and never breaks.

## The selection mechanic — from avara

Framework stickers in a row. Select one (click **or ← / →**):

- selected **scales up ~2×**, stays at a **fixed focal position**
- **all others desaturate to grey silhouettes**
- a **label chip** appears above the selected one
- a **detail panel slides in from the right** (~430px) showing that framework's **real compiled
  output** plus a spec table: activation model, output path, line count, hash
- prev/next chevrons bottom-centre

Nintendo-Switch carousel: the row slides beneath a fixed focal point.

## Grading — required after every section

After building each section, screenshot it and grade **A–F** against:

1. Does it look like the concept art? (depth, saturation, sticker feel)
2. Is there real elevation — shadows, layering?
3. Is there texture, or is it a flat fill?
4. Would it survive next to avara.xyz / react.gg?
5. Is the type heavy and confident?

**Below a B: rebuild it before moving on.** Do not accumulate sections that need fixing later.
