# Components

> **Agents: every file here is a working page.** Open it in a browser and it renders, because it
> links the real kit CSS with relative paths. Each one opens by stating what it is for and when
> to use it, so you can choose correctly without reading all twelve.

Each component's CSS lives in the `<style>` block of its own HTML file. That is deliberate: a
component has to be readable and pasteable as one thing. The two files that are *not* components
are `component-tokens.css` and `specimen.css` (page chrome only — ignore it).

## Choosing

| Component | Use it for | The one thing to get right |
|---|---|---|
| [`sticker`](./sticker.html) | Anything that should read as an object **on** the page rather than a region **of** it | Fill, tinted keyline, thick band, **drop shadow**, tilt. All five |
| [`framework-badge`](./framework-badge.html) | Naming the compilation targets | Full-colour marks, saturated fills, canonical order, and **never** a mark in `--accent` |
| [`framework-carousel`](./framework-carousel.html) | **The thesis, demonstrated** | Real emitted files with a path, a line count and a hash. Never a fabricated snippet |
| [`wordmark`](./wordmark.html) | Saying the name | Four layers, and the fourth is the shadow. On paper use `.wordmark--paper` |
| [`button`](./button.html) | Committing to an action | The label on a lime fill is `--accent-ink`. Never white, never cream |
| [`hero`](./hero.html) | Opening a page, once | The headline is fixed — *Compile once, output anywhere.* Never count the targets |
| [`card`](./card.html) | Content longer than a label, shorter than a section | A card is a sticker-card: colour fill, thick cream band, hard offset shadow |
| [`code-block`](./code-block.html) | Source, output, terminal, diffs | Que Grotesque must never set code |
| [`output-switcher`](./output-switcher.html) | The same argument as the carousel, with no JavaScript | Superseded by `framework-carousel`. Reach for that one first |
| [`callout`](./callout.html) | A truth, a constraint, a measurement | Don't use it for emphasis |
| [`footer-marks`](./footer-marks.html) | Trademarks and the font licence | Mandatory on every page |
| [`coming-soon-tag`](./coming-soon-tag.html) | Frameless Studio | Never imply availability, never manufacture urgency |

If a page ships exactly one interaction, make it `framework-carousel`. It is the only component
that demonstrates the claim rather than asserting it. The ranking is in
[`../artifacts/web/page-composition.md`](../artifacts/web/page-composition.md), which you should
read before building a page — a hero on its own is not a page.

## The rules every component here obeys

1. **Every die-cut object casts a shadow, and it is `filter: drop-shadow()`.** Elevation is the
   brand. Use the scale in [`../tokens/elevation.css`](../tokens/elevation.css): `--elev-sticker`,
   `--elev-card`, `--elev-lifted`. Never `box-shadow` — it casts the element's *box*, and a
   rounded rectangle floating behind a die-cut shape is the tell that the object is fake. The one
   exception is `--elev-inset`, because a filter cannot draw inside an alpha silhouette.
   *A previous version of this file made shadows forbidden kit-wide. That was measured off four
   flat PNG exports, it deleted the quality the concept art is most recognisable for, and it is
   the single thing this rebuild exists to correct.*
2. **The bed is never a flat fill.** The page grain arrives with `colors_and_type.css`; sections
   may add `--texture-grid` on top.
3. **Colour comes from tokens,** and it is saturated. No component sets a hex except to
   *demonstrate a forbidden pairing*, and those are labelled as such on the page.
4. **Framework marks are full colour and inlined as real `<svg>`,** never CSS masks: a mask can
   carry exactly one colour, and a mask or a `url()` is CORS-blocked on `file://`.
5. **Motion comes from `../motion/motion.css`,** which is generated from `../motion/motion.json`.
   No component invents a duration or a curve.
6. **`prefers-reduced-motion: reduce` is honoured** by every component. Note what that does *not*
   cover: shadows, tilts and the carousel's desaturation are resting states, not movement, and
   they stay.
7. **State is never carried by colour alone.** Every stateful thing also carries a word or a
   different geometry, because colour dies in grayscale and opacity reads as a loading skeleton.
8. **Decorative stickers are never at `0deg`** and never sit behind readable text.

## `component-tokens.css`

Now a small file. The die-cut vocabulary that used to live here is system-level and has moved:

| Was here | Lives in |
|---|---|
| `.die-cut`, `--sticker-band`, `--sticker-keyline`, `--sticker-radius`, the tilts, the peel | [`../tokens/sticker.css`](../tokens/sticker.css) |
| The shadow scale, the page grain, the gloss and band-sheen gradients | [`../tokens/elevation.css`](../tokens/elevation.css) |
| `--band`, `--keyline`, the six `--fw-*` families | [`../tokens/color.css`](../tokens/color.css) |

What remains is genuinely about components: the control padding and minimum hit target, and the
`.lift` interaction, which raises an object two pixels and swaps `--elev-sticker` for
`--elev-lifted` — the shadow growing is the part the eye reads as lift.

`--sticker-keyline` is 2px because that is exactly `--focus-width`, which is what keeps
`colors_and_type.css`'s promise that a focused die-cut component shifts by zero pixels. Every
component writes `var(--sticker-keyline, 2px)` with the fallback, so a snippet pasted into a page
that only linked `colors_and_type.css` still draws a correct keyline.

## Verifying

- `node ../motion/build-motion.mjs --check` — proves `motion.css` and `motion/specimen.html`
  still match `motion.json` byte for byte.
- `node ../assets/wordmark/build-wordmark.mjs --check` — proves every outlined wordmark SVG still
  matches the shipped WOFF2.
- Several components assert their own rules in the page and log to the console if they are
  broken: `framework-badge` checks canonical order, that no mark resolved to `--accent`, and that
  **every sticker is still elevated**; `wordmark` checks that its shadow layer survived;
  `sticker` measures its own container-query band at three widths; `code-block` checks that Que
  Grotesque did not end up setting code; and `button` measures its own layout shift on focus.
