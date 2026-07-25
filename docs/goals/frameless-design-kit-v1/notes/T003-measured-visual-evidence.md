# T003 — Measured visual evidence

All values sampled from real pixels (`sips` → BMP/PNG, parsed in Node). `sips` was verified
non-color-shifting by a round-trip that preserved neutral white. **Nothing here is
estimated.** Where the Scout could not measure something, it is marked as such.

## Five ways the brief was wrong

The brief was written from memory of the concept art. Measurement contradicts it in five
places, and the kit follows the measurements.

| Brief said | Measured reality |
|---|---|
| Coastal scene, blue sky | Sky is **sage `#a9baa7`** (H114 S12% L69%). The whole print is aged and desaturated; the "blue" is simultaneous contrast against warm cream. |
| Heavy **black** outlines | Outlines are near-black and **tinted**: `#111010`, `#11160f`, and pine is `#115b2e` (dark green). Mushroom has **no black keyline at all**. |
| Die-cut stickers with drop shadow | **No drop shadow on any sticker.** Verified: 0.00 dark-fringe px per edge on four of five. Flower's sub-pixel fringe is symmetric on all sides — an alpha-matte artifact, not a designed offset. |
| Cream die-cut border | Cream is **not consistent**: `#faebcd` → `#fefdf8` across the five files. No single value can be lifted verbatim. |
| Lime used for display type | Lime is **unusable on every light surface in the art**. Display type must be scoped to dark backgrounds only. |

Also: `coast-environment.jpg` has **no uniform cream frame** — the aging is a corner
vignette only (`#dec48c` TL, `#c7b07d` TR).

## Environment palette

Large-block averages, which integrate the halftone dot screen correctly (7×7 point samples
under-integrate it and read too light).

| Region | Hex |
|---|---|
| Sky upper | `#a9baa7` |
| Sky horizon band | `#ddd1a8` |
| Cloud cream core | `#ebd5a0` |
| Cloud shadow | `#cac6a5` |
| Sea deep | `#70988b` |
| Sea mid | `#43837a` |
| Sea turquoise | `#337b71` |
| Grass lit | `#7e7d3c` |
| Grass shadowed | `#777732` |
| Cliff rock | `#8a835b` |
| Sand / dirt path | `#c39b5b` |
| Paper vignette TL / TR | `#dec48c` / `#c7b07d` |

Accents: daisy white `#f2efd4` · yellow `#eeab00` · pink `#ec7265` · sea foam `#fff9db` ·
lighthouse roof `#b86843`.

## Sticker vocabulary

**Die-cut cream halo at 2.7–3.6% of the longest edge, near-black tinted outline, zero drop
shadow.** Edges are smooth die-cut curves with 1–2px antialias.

| File | Size | Cream | Halo px (% long edge) | Outline |
|---|---|---|---|---|
| flower | 381×640 | `#fefdea` | not separable¹ | interior runs ~3px |
| leaf | 389×640 | `#faebcd` | 17 (2.7%) | `#11160f`, ~12px |
| mushroom | 591×640 | `#fefdf8` | 23 (3.6%) | none² |
| pine | 444×640 | `#fdf8e4` | 20 (3.1%) | `#115b2e` |
| seagull | 640×590 | `#fcfcfa` | 18 (2.8%) | `#111010`, ~6px |

¹ White petals — the cream run never terminates in a darker pixel.
² First opaque pixel inside the cream is cap red `#980c07`.

## `#cce007` — the lime law

`#cce007` = H66 S94% L45%, relative luminance 0.6616.

**Relationship to the art:** the natural greens are low-saturation olives (grass lit
`#7e7d3c` H59 S35%, grass shadow `#777732` H60 S41%, cliff `#8a835b` H51 S21%). The lime
shares their hue almost exactly (Δ6–7°) at **2.3–2.7× the saturation**. It is neither
harmony nor clash — it is *the same hue at synthetic saturation*, reading as a deliberate
synthetic overlay on a natural bed. That is a genuinely good reason for the lime to be the
brand color: it belongs to the landscape's hue family while obviously not being of it.

**Contrast — the hard constraint:**

| Against | Ratio | Normal | Large | UI |
|---|---|---|---|---|
| black `#000000` | **14.23** | PASS | PASS | PASS |
| sticker outline `#111010` | **12.88** | PASS | PASS | PASS |
| sea turquoise `#337b71` | 3.38 | FAIL | PASS | PASS |
| grass shadow `#777732` | 3.18 | FAIL | PASS | PASS |
| sea mid `#43837a` | 2.99 | FAIL | FAIL | FAIL |
| cliff rock `#8a835b` | 2.60 | FAIL | FAIL | FAIL |
| sand path `#c39b5b` | 1.74 | FAIL | FAIL | FAIL |
| white `#ffffff` | **1.48** | FAIL | FAIL | FAIL |
| sticker cream `#fefdea` | 1.44 | FAIL | FAIL | FAIL |
| sky upper `#a9baa7` | 1.39 | FAIL | FAIL | FAIL |
| cloud cream `#ebd5a0` | **1.02** | FAIL | FAIL | FAIL |

**Lime passes normal-text contrast against exactly two things: black, and the near-black
sticker outline.** Lime on cloud cream at 1.02 is effectively invisible. Text *on* lime:
black passes at 14.23, white fails at 1.48.

This single fact governs the entire color system. Any kit that lets an agent put lime on
cream will generate inaccessible pages forever.

## Fonts

WOFF2 headers parsed and brotli table streams decompressed for real values:

| File | Bytes | usWeightClass | Glyphs |
|---|---|---|---|
| Regular | 25,216 | 400 | 262 |
| Medium | 24,820 | 500 | 262 |
| Bold | 23,000 | 700 | 262 |
| Black | 20,184 | 900 | 262 |

All **static** (no `fvar`), unitsPerEm 2048, 17 tables, hinting retained. **262 glyphs = a
Latin subset** (a full retail grotesque runs 400–900+).

**Licensing is clean today.** A repo-wide scan found no Que Grotesque OTF/TTF/variable
source anywhere. The kit must carry an explicit purchased-font note and a standing rule
that only these subset WOFF2 files may ever be committed.

## Logos

All six are clean single-`<path>` marks, `viewBox="0 0 24 24"`, zero groups, zero embedded
raster, **no `fill` attribute** (they inherit `currentColor`), with `role="img"` and
`<title>`. Simple-Icons-shaped.

**They are third-party trademarks** (React/Meta, Vue, Svelte, Angular/Google, Qwik, Solid)
and require an attribution note plus an explicit "no endorsement implied" line.

## Gap list — must be created

- **The Frameless wordmark does not exist as a file.** Only `website/tmp-wordmark-probe.html`
  explored weights at 108px on `#1d2c22`. No lime die-cut wordmark, no lockup, no
  clear-space or min-size spec, no monogram.
- Favicon set, apple-touch-icon, manifest icons.
- OG / social card (1200×630).
- **Framework badge treatment** — the six logos are bare 24px paths with the sticker
  vocabulary *not* applied.
- Canonical cream and outline tokens (sources are inconsistent).
- A committed color token file — none exists in any form.
- **Sticker vocabulary for the compiler half of the story.** All five existing stickers are
  nature; nothing represents code, output, or transformation.
- `mushroom.png` is 16-bit — normalize to 8-bit RGBA.
- Texture tileability for `paper.jpg` / `backing.jpg` — **not measured**, verify before
  using as a repeating fill.
