# /human

The brand as one rendered page a person can read and share: [`index.html`](./index.html).

Open it in a browser. No build step, no server — it links the real kit CSS with relative
paths, so what you see is the system itself rather than a picture of it.

## It is generated. Do not edit it.

`index.html` is written by [`build-guideline.mjs`](./build-guideline.mjs) from the same files
`/agent` reads:

```bash
node brand/human/build-guideline.mjs           # regenerate
node brand/human/build-guideline.mjs --check    # prove it has not drifted
```

`--check` regenerates in memory and exits non-zero if the file on disk disagrees — the same
contract as `agent/visual/motion/build-motion.mjs` and
`agent/visual/assets/wordmark/build-wordmark.mjs`.

A hand-written brand guideline is the drifting PDF this kit exists to replace. Within a week
of a token change it is quietly wrong and nothing fails. So there is no value on that page
that a person typed twice: every hex, ratio, `clamp()`, shadow, duration, curve and quoted
line is read out of `tokens/color.json`, `tokens/utopia.config.json`, `tokens/elevation.css`,
`tokens/sticker.css`, `colors_and_type.css`, `motion/motion.json`, `fonts/quegrotesque.json`,
`assets/wordmark/metrics.json` and `agent/verbal/*.md` at build time.

That is not a theoretical benefit. The generator was rewritten after the kit rebuild because it
**threw**: it looked for a lettered hero option in `messaging.md` that the corrected verbal half
had removed, since the headline is fixed and there is nothing to choose between. Behind that one
crash it was stale everywhere else too — it rendered `--halo`, `--sticker-halo-ratio` and a "six
frames, one view" device, none of which exist, under a section headed *"Nothing floats"* that
restated a shadow ban the owner had overturned. None of that was visible until something executed
it, which is the argument for generating the page rather than writing it.

## Checking it from outside

Every generated value is wrapped in `<span class="v" data-from="…">`, and the `data-from` is a
resolvable pointer back into the source:

| Form | Means |
|---|---|
| `<file>#<json-pointer>` | resolve that pointer in that JSON file |
| `clamp:type/3`, `clamp:space/s-m` | recompute the clamp from `utopia.config.json` |
| `css:<file>#--token` | read that custom property out of that stylesheet |
| `text:<file>` | the line appears verbatim in that Markdown |

`data-as="bool"` renders a boolean as ✓/✗; `data-as="length"` renders an array's length. So
the claim "this page agrees with the kit" is checkable by walking the DOM, not something you
have to take on trust.

## Two rules the page applies to itself

**1. It will not set type in a pairing that fails.** A colour pairing whose ratio — *recomputed
at build time from its own hex pair*, not read from the file — falls below AA normal text is
never rendered as type, not even to demonstrate the failure. Those specimens render as a fill bar
on their bed instead. Nor will it set type in lime anywhere, at any ratio: lime is a surface, a
mark and a display voice, and a specimen is set too small for the one place lime type is legal.
A demonstration of a forbidden pairing therefore cannot quietly become an instance of one.

**2. Every die-cut object on it carries a real drop shadow.** Elevation is mandatory in this kit,
and a guideline that documents that on flat rectangles is arguing against itself. The swatches,
the framework stickers, the curve cards and the voice cards all sit on an `--elev-*` step, and the
depth section shows the whole scale side by side.

## To change what the guideline says

Change the source, then regenerate. Editing `index.html` is the one thing that cannot work:
the next run overwrites it, and `--check` fails in the meantime.
