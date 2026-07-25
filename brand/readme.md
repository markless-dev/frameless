# Frameless — brand kit

A brand encoded as **instructions an agent can act on**, not documentation a human reads and
drifts from.

Two formats, one system:

- **`/human`** — the brand as a rendered guideline you can read and share.
- **`/agent`** — the same brand as YAML, JSON, Markdown, CSS, SVG and HTML that any agentic
  tool can read and build from.

Both are generated from the same sources, so they cannot disagree.

---

## Try it

Drop this folder into Claude Code, Cursor, Codex, or any agent with filesystem access, and say:

> Generate an HTML landing page based on the atomic design system and strategy in this kit.

That prompt is the kit's own acceptance test. If it doesn't produce something recognizably
Frameless, the kit has a bug — not the agent.

---

## Agents: read in this order

Do not skim. Each file below tells you something you cannot infer from the others.

| # | Read | Why |
|---|---|---|
| 1 | `agent/verbal/positioning.md` | What Frameless is, what to claim, what to never claim |
| 2 | `agent/verbal/voice.md` | How it sounds — WRONG/RIGHT pairs in real copy |
| 3 | `agent/verbal/messaging.md` | Production copy you can lift verbatim |
| 4 | `agent/verbal/concepts.md` | **The creative territory.** Read before any design decision a token doesn't cover |
| 5 | `agent/visual/colors_and_type.css` | The single CSS entry point — import this |
| 6 | `agent/visual/tokens/color.json` | Tokens with intent, plus permitted/forbidden pairs as data |
| 7 | `agent/visual/artifacts/web/page-composition.md` | **Required before building any page** |
| 8 | `agent/visual/components/` | 12 primitives; each states what it's for |
| 9 | `agent/visual/motion/motion.json` | Motion parameters; CSS is generated from this |
| 10 | `agent/visual/artifacts/web/landing-page.html` | **The reference implementation.** A complete page built from the kit — read it when unsure how pieces combine |
| 11 | `magic_trick.md` | Where a human has to walk back in |

Humans: open `human/index.html`. It is *generated* from the same token, motion and verbal
sources `/agent` uses, so it cannot drift from what agents build. Regenerate with
`node brand/human/build-guideline.mjs`.

`agent/verbal/audience.yaml` and `differentiation.md` matter when you're writing copy aimed at
a specific reader or handling an objection.

---

## The five things most likely to go wrong

Every one of these has been observed in a real generated page. They are not hypothetical.

### 1. A hero is not a landing page
The single most common failure is producing one beautiful full-screen hero and stopping.
**Minimum seven sections.** See `artifacts/web/page-composition.md` for the required inventory.

### 2. Lime is a surface and a mark, never an ink
`#cce007` has a relative luminance of 0.6616 — it is a *light* colour that behaves like a
highlighter. It passes normal-text contrast against exactly two things: `--ink` and
`--surface-deep`.

Against white it is **1.48**. Against cream, **1.44**. Against the sky in the brand
photograph, **1.39**. Never set body text in it. Lime display type lives on dark beds;
everywhere else lime is a *fill* with `--ink` on top.

### 3. No `box-shadow`. Anywhere.
The stickers were measured: zero drop shadow, on all of them. They are printed and cut flat,
not floating. Depth comes from the die-cut halo, the keyline, rotation and overlap.

The sole exception is `--shadow-peel`, a `drop-shadow()`, only while a corner is physically
lifting.

### 4. Never put text on the raw photograph
Contrast is a property of the pixel under each glyph, not of the image. Local luminance in the
coast photo swings from 1.02 to 3.38 against lime. Text over it needs `--scrim-deep` or
`--scrim-paper`. Better: use the photo **bounded** inside a frame, card, or die-cut, with no
text on it. It's a photo sticker, not wallpaper.

### 5. Pure white is not a surface
`--surface` is `#f2efd4`, aged paper. White breaks the print thesis, and it is the bed lime
fails hardest against.

---

## The headline is fixed

> # Compile once, output anywhere.

That is the line, on every hero. Do not rewrite it, do not "improve" it, and **never replace it
with a count** — no "ship six", no "six outputs", no totals. Counting turns a promise into an
inventory and makes it sound conditional. See `agent/verbal/messaging.md`.

---

## Retuning the system

The kit is meant to be edited, in code, by whoever is closest to the work.

| Change | Edit |
|---|---|
| Brand colour | `tokens/color.json` + `tokens/color.css`, then recheck the pair ratios |
| Type or space scale | Open the `configUrl` in `tokens/utopia.config.json`, retune, re-export both the CSS and the config |
| Motion | `motion/motion.json` — the CSS is generated from it |
| Voice or claims | `agent/verbal/` |

Run the structural gate after any change:

```bash
node brand/tools/structural-gate.mjs
```

It recomputes every contrast ratio and every fluid `clamp()` from the stored parameters and
fails if the CSS has drifted from its own config. Values in this kit are checked, not asserted.

---

## Provenance

`_source/` holds the inputs the kit was derived from — the concept art and the original
sticker set. It is deliberately outside `/agent` and `/human` so an agent reading the kit is
never confused about which files are instructions and which are history.

## Licensing

**Que Grotesque is a purchased, commercially licensed typeface.** Read
`agent/visual/fonts/LICENSE.md` before copying, zipping, publishing or deploying anything here.
Self-hosted subsets only; never re-upload, mirror, or serve from another origin.

Framework marks are third-party trademarks used nominatively. See
`agent/visual/assets/README.md`. Frameless is not affiliated with or endorsed by any of them,
and the marks may never be recoloured to `--accent`.
