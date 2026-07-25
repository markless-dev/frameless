# Assets

Everything here was promoted from `brand/_source/concept/`, which is the durable in-repo copy of
the original concept art. Sources were **copied, never moved** — `_source/` stays intact so any
later measurement re-runs against the same pixels.

> **This file was rewritten after the kit rebuild.** The version before it documented four
> stickers that do not exist, a central device that was never in the brief, and a sage sky. The
> binding description of the visual system is
> `docs/goals/frameless-design-kit-v1/notes/REBUILD-SPEC.md`; where this file and that one
> disagree, that one wins and this one is stale.

## Inventory

### `stickers/` — five, and only five

| File | Size | Bytes | Band, as drawn | Outline |
|---|---|---|---|---|
| `flower.png` | 381 × 640 | 28,887 | `#fefdea` | interior stroke ~3px |
| `leaf.png` | 389 × 640 | 31,213 | `#faebcd` | dark neutral, ~12px |
| `mushroom.png` | 591 × 640 | 98,081 | `#fefdf8` | **none** |
| `pine.png` | 444 × 640 | 21,821 | `#fdf8e4` | `#115b2e` (green) |
| `seagull.png` | 640 × 590 | 21,322 | `#fcfcfa` | `#111010`, ~6px |

All five are 8-bit RGBA with alpha. Sizes and byte counts re-measured against the files on disk.

**There is no second group.** A previous version of this file listed four further "concept"
stickers — `prism`, `lighthouse`, `window`, `compass` — generated to carry the product argument.
They were deleted along with the device they were built for, and nothing in the kit may reference
them. The nature five are the whole sticker set.

#### These are flat exports. The elevation is added at render time.

The five PNGs are flat illustration exports: no shadow is baked into their pixels, and the band
drawn into each one measures 2.7%–3.6% of its longest edge.

**Neither fact is a rule.** Reading them as one is exactly the error that produced the rejected
first attempt — four flat vector exports were measured, generalised to the whole system, and the
result banned the defining quality of the brand and shipped a 3.2% hairline that read as a border
rather than as cut paper.

What actually governs a die-cut object is in `../tokens/sticker.css` and `../tokens/elevation.css`:

- the band is **6–8% of the object's width** (`--sticker-band-ratio: 0.07`), measured on
  avara.xyz's stickers and corroborated against the concept art's badges;
- **elevation is mandatory**, applied as `filter: var(--elev-sticker)` — a stacked
  `drop-shadow()`, never a `box-shadow`, because a `box-shadow` draws a rounded rectangle behind a
  die-cut shape and kills the illusion.

So a source PNG placed on a page still gets its shadow from the kit. Do not paint one into the
asset, and do not read a flat export as permission to ship a flat object.

#### Stated exception: the source stickers keep their original outlines

`mushroom.png` has **no keyline at all**. `pine.png`'s keyline is **green**, not neutral.

Both are kept as drawn. We do not repaint source art, and a kit that quietly "fixed" its own
assets would be lying about what it contains.

**These are documented deviations, not licences to vary.** Every *new* die-cut element takes its
keyline from `--keyline`, or — for a framework sticker — from the dark end of that sticker's own
hue, per `../tokens/color.json#/framework_colors`. Pine's green outline is not evidence for a
general "keyline follows the subject" rule at *source-asset* scale: the evidence there is three
near-neutral outlines against one green and one absent.

`mushroom.png` is the weakest asset in the set. It was the outlier twice — 16-bit *and* no
keyline — and it is a candidate for regeneration rather than repair.

#### `mushroom.png` was normalised from 16-bit to 8-bit

The source is 16-bit RGBA at 116,383 bytes: roughly four times its peers for zero visible benefit
on a flat illustration. The promoted copy is 8-bit RGBA at 98,081 bytes.

Converted with `sips`, then verified rather than assumed. Every opaque pixel and every alpha value
is **identical** to an exact 16→8 reduction of the source (max Δ = 0 across 260,337 opaque RGB
samples and 378,240 alpha samples). Composited over the page bed, the largest difference anywhere
in the image is **0.92 of one 8-bit level**. The only pixels that changed are fully transparent
ones, whose RGB was zeroed — which is invisible by definition and accounts for the 16% size
reduction.

**Standing rule: no asset under `assets/` may exceed 8 bits per sample.** `brand/tools/structural-gate.mjs`
reads the IHDR of every PNG here and fails if one does.

### `logos/` — third-party framework marks

`angular.svg` · `qwik.svg` · `react.svg` · `solid.svg` · `svelte.svg` · `vue.svg`

All six are Simple-Icons-shaped: a single `<path>`, `viewBox="0 0 24 24"`, no groups, no embedded
raster, `role="img"` with a `<title>`, and — the load-bearing detail — **no `fill` attribute**, so
they inherit `currentColor`.

See the trademark section below before using any of them. It is not optional reading.

**From `file://`, inline them.** A CSS `mask-image: url(./logos/react.svg)` is CORS-blocked when
the page is opened off disk, and all six marks render blank with no error. Inline the SVG, or
inline it as a `data:` URI. This has silently blanked the mark set once already.

### `textures/` — repeating beds

| File | Size | Bytes |
|---|---|---|
| `paper.jpg` | 700 × 700 | 42,997 |
| `backing.jpg` | 700 × 700 | 50,754 |

Both 8-bit RGB, no alpha.

**Tileability is unverified.** Neither file has been tested for seamless edge-matching. Check
before using either as a `background-repeat` fill; if they do not tile, use them as a single
bounded panel rather than a repeat.

Neither is the page grain. The page grain is `--texture-noise` in `../tokens/elevation.css`: a
self-contained SVG `data:` URI, so it costs no request and cannot fail to load from disk. These
two JPEGs are a heavier, bounded material — a backing card, a panel — not the global bed.

### `photos/` — the environment

`coast-environment.jpg` — 2400 × 1351, 669,074 bytes, 8-bit RGB.

The lighthouse-and-cliffs scene the palette was measured from.

**The sky in it is cyan-blue, not sage.** A previous version of this file recorded `#a9baa7` and
argued that the blue people remember was simultaneous contrast against warm cream. That was
measured off a generated stand-in rather than off the concept art. Sampled from the real art, the
upper sky is **`#91c3c7`**, the cloud is a cool `#dddfc8`, and the deep sea is a genuinely blue
`#768ac9`. The whole art is cooler, bluer, brighter and more saturated than the substitute — see
`REBUILD-SPEC.md` for the full region-by-region table.

#### Weight budget

669KB is too heavy to ship as-is at full width. It must go through `<picture>` with width-limited
variants:

| Variant | Width | Use |
|---|---|---|
| `coast-480.webp` | 480 | phones, and as a die-cut photo sticker at any size |
| `coast-960.webp` | 960 | tablet, card-bounded use |
| `coast-1600.webp` | 1600 | desktop decorative band |
| `coast-environment.jpg` | 2400 | fallback and print reference only |

The variants are not generated yet. Until they are, use the photo **small** — inside a card or a
die-cut frame — rather than full-bleed. That is the preferred usage anyway.

#### How the photograph may be used

Three tiers, and the third one matters most because it is what an agent reaches for by default:

1. **Permitted** — decorative, behind a **mandatory wash** of the page bed. Once the wash is
   applied, treat the region as that solid colour and apply its rules exactly. **No text over raw
   photograph, ever.** Contrast is a property of the pixel under the glyph, and local luminance
   here swings 1.02:1 to 3.38:1 against lime depending on where a letter lands. The wash removes
   the variable instead of testing it. `../components/hero.html` declares the one sanctioned
   value and shows the composition.
2. **Preferred** — the photo as a bounded die-cut image inside a sticker or a card, with no text
   on it, carrying the same band, keyline and `--elev-sticker` shadow as any other die-cut object.
   This is the most on-brand use: the coast is a photo *sticker*, not wallpaper.
3. **Forbidden** — full-bleed hero with a headline sitting on the photograph.

## Trademarks and attribution

React, Vue, Svelte, Solid, Angular and Qwik are trademarks of their respective owners. Frameless
is not affiliated with, endorsed by, or sponsored by any of them. The marks are used
**nominatively**, to identify compilation targets.

**Simple Icons' CC0 dedication covers the path data, not the trademarks.** Both facts are true at
once and both have to be stated: you are free to copy the SVG geometry, and you are still bound by
each project's trademark policy when you display it. CC0 on the drawing is not permission to use
the mark.

### A framework mark may never render in `--accent`

All six marks inherit `currentColor`, which is exactly what makes recolouring them trivial — so
the rule has to be written down rather than assumed.

Nominative use requires the mark stay recognisable. A lime React logo is both a trademark risk and
brand confusion: it reads as a Frameless product rather than as a reference to React.

**Marks render in the project's own official brand colour, in white on a saturated fill, in
`--ink`, or as the grey `--silhouette` used for the deselected carousel state. Nothing else.**

### Canonical order and labelling

Always render the marks in the canonical order:

**React, Vue, Svelte, Solid, Angular, Qwik.**

It opens on the most recognized and closes on Qwik, which is the one that makes the technical
point (it resumes rather than hydrates). Keep this order in badges, tables, nav and prose. Never
total them up — the count is not the claim.

Every badge carries the framework's **name as a word rendered inside it**, in white, not only the
mark. A logo alone is not identification for anyone who does not already know the logo, and a word
survives cropping, grayscale and being screenshotted without alt text.

If you are placing these SVGs by hand, you are the one holding that guarantee.

## Sticker vocabulary

Five die-cut stickers: `flower`, `leaf`, `mushroom`, `pine`, `seagull`.

They are source assets and they are decorative. Their job is register — this is a naturalist's
world, not a tech one — and they carry no part of the product argument. The argument is carried by
the framework stickers, which are built from `../tokens/color.json#/framework_colors` rather than
drawn.

**Placement rule:** decorative stickers never overlap readable text. Margins, gutters, section
seams. If a sticker lands behind a paragraph, move the sticker — never lighten the text.

**Rest tilt:** rotated at rest like every other die-cut object (`--tilt-1` … `--tilt-4`). A sticker
at 0deg reads as a div.

**Elevation:** every placed sticker carries `filter: var(--elev-sticker)`. A flat one is a printed
rectangle, which is the thing this rebuild exists to correct.

## Fonts

Not here. See `../fonts/` — and read `../fonts/LICENSE.md` first. Que Grotesque is a purchased
commercial typeface and the WOFF2 files are not redistributable.

## `wordmark/` — the identity, in both forms

The Frameless wordmark ships **twice**, and which one you reach for is not a preference.

| File | What it is | Reach for it when |
|---|---|---|
| `wordmark.css` | The **live CSS/HTML component** | A browser is doing the rendering. **This is primary.** |
| `frameless-wordmark.svg` | Outlined full lockup | Live text cannot be relied on |
| `frameless-mark.svg` | Outlined mark tile | Avatars, app icons |
| `favicon.svg` · `favicon-32.png` | Favicon set | `<link rel="icon">` |
| `og-card.svg` · `og-card.png` | 1200 × 630 social card | `og:image` — scrapers want the PNG |
| `metrics.json` | Measured font metrics | The numbers the CSS geometry derives from |
| `build-wordmark.mjs` | Generator | Regenerating every SVG. Node stdlib only |

**The live component is the primary artefact because it stays editable.** It resizes fluidly,
recolours by one custom property, is selectable and searchable, costs no extra request, and cannot
drift from the type system because it *is* the type system. A raster wordmark would be the one
un-editable thing in an otherwise structured kit.

The outlined SVGs exist for the two places live text genuinely fails: a favicon has no reliable
access to a self-hosted `@font-face`, and an OG card is rasterised by machines that will never load
a webfont.

### The outlines are real Que Grotesque, not a redrawing

Every path in every SVG in `wordmark/` is the actual glyph contour out of the actual shipped WOFF2.
`build-wordmark.mjs` decodes the WOFF2 — Brotli, then the transformed-`glyf` triplet reconstruction
— and emits the contours directly, so the outlined lockup and the live lockup are the same
letterforms by construction rather than by eye.

Verified against the browser: the summed advance width of *frameless* computed from the font tables
is **4992.69px** at a 1000px em, against **4987.80px** measured in Chromium with the same font
loaded. The 4.89px difference (**0.098%**) is GPOS kerning, which the generator does not apply and
the browser does.

**Licensing:** the generator *reads* the WOFF2 and writes outlines for the brand's own fixed
strings. It does not copy, re-encode or redistribute the font. Outlining a logotype is the normal
permitted way to ship a wordmark — see `../fonts/LICENSE.md`.

### Recolouring is one property

```css
.wordmark { --wordmark-fill: var(--warning); }
```

That is the whole API. `--wordmark-keyline`, `--wordmark-band` and `--wordmark-shadow` exist so the
die-cut can be inverted for a special surface, and you should almost never touch them.

### The lockup has four layers, and the fourth is the shadow

Outward: **lime fill → thick black keyline → thick cream band → drop shadow.**

The shadow is not decoration on this mark, it is part of it. The concept art's wordmark carries a
heavy offset shadow, and it is the single most recognisable quality of the identity. A lockup drawn
without it is not this wordmark. The geometry is derived rather than eyeballed — the band and the
keyline reuse the die-cut rules with the **letterform as the die-cut object**, so the basis is its
ink height (0.7275em for *frameless*, measured and recorded in `wordmark/metrics.json`):

| Layer | Ratio of ink height |
|---|---|
| band | 11.5% |
| keyline | 9.0% |
| shadow offset | dx 1.8%, dy 8.5% |

### Where the wordmark sits

The dark bed is home. Lime as an **ink** fails on every light bed — 1.28:1 on the light paper
island, 1.09:1 on the cream band, 1.48:1 on white — but the lockup's lime is a **fill** ringed by a
keyline nine times the weight of a hairline, which is exactly what the concept art does over a
bright sky. On the light paper island use `.wordmark--paper`, which keeps the lime and turns the
band white, because cream on cream disappears. `.wordmark--ink` is the one-colour print fallback,
not the light-bed variant.

**Stated exception:** `favicon.svg` and the mark lockup carry a heavier cut than the ratio gives.
That is the rule applied, not broken — the keyline exists because it is the only thing separating a
die-cut object from its bed, and below one device pixel it stops doing that.
