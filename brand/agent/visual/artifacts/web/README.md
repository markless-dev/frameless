# artifacts/web

| File | What it is |
|---|---|
| [`page-composition.md`](./page-composition.md) | **The spec.** Required reading before building any page. Binding. |

## Where the worked example went

This folder used to ship `landing-page.html` beside the spec: a complete ten-section page that
showed what satisfying it looked like end to end. **It was deleted, deliberately.**

It was built against the pre-rebuild visual system. Every colour in it came from the desaturated
palette measured off a generated stand-in rather than off the concept art; it was tokenised
against `--halo`, `--paper-warm` and `--surface-deep`, none of which exist; two of its sections
were built on the *six frames, one view* device, which was an invention that was rejected and
removed; and it referenced `stickers/lighthouse.png`, one of four concept stickers that were
deleted with it. It did not render.

Three ways forward were available and only one of them is honest:

- **Retokenise it.** The rename is the small part. Underneath, the page is composed for a light
  paper bed with flat die-cut objects and no elevation, and the rebuilt system is a dark textured
  bed with mandatory `drop-shadow` depth. Correcting that is not a rename, it is rebuilding the
  page — and a rebuilt page immediately competes with the real ones.
- **Keep it as-is.** A worked example that renders broken and teaches three rules the owner
  overturned is worse than no worked example. An agent reading this kit cannot tell which of two
  contradicting files is current.
- **Delete it and point at the real pages.** Taken.

**The worked examples are the landing page variants under `website/`.** They are built from this
kit, against this spec, and graded section by section against the concept art. Read the spec here;
read a real page there.

`../product/studio-inspector.html` is still in the repository and is still current — the same
tokens applied to a dense working surface rather than to a page. It is the artifact to read for
how the system behaves at panel scale.

## What the spec is for

The most common failure when building from a brand kit is producing one beautiful full-screen hero
and stopping. `page-composition.md` exists to make that structurally difficult: it names the
mandatory sections, the rhythm rules, and the five hard rules that were learned from a page that
got them wrong.

Read it before you open an editor, not after.

## Copy

Nothing on a Frameless page is invented. Every line is lifted from the verbal half:

| Section | Source |
|---|---|
| Hero headline | `verbal/messaging.md` → Hero. **The line is fixed.** |
| Hero subhead | `verbal/messaging.md` → Approved subheads |
| One source, framework-native output | `verbal/voice.md` → rule 5 |
| How it works | `verbal/messaging.md` → the three-beat explainer |
| Activation-neutrality | `verbal/messaging.md` → Activation-neutrality; `voice.md` → rule 4 |
| The oracle | `verbal/messaging.md` → The oracle, and objection handling |
| Who it's for | `verbal/audience.yaml` |
| Frameless Studio | `verbal/messaging.md` → Frameless Studio |
| Footer | the `footer-marks` component, verbatim |

If you need a line that isn't there, write it against `voice.md` — do not improvise against the
vibe.

## Checking a page you built

```bash
node brand/tools/structural-gate.mjs
```

Then, in a real browser, **opened from `file://`** — that is the delivery surface, and a CSS
`mask-image` pointing at a file path is CORS-blocked from disk, which has silently blanked the
whole framework mark set once already. Inline the SVG, or inline it as a `data:` URI:

- Every mandatory section present, each with a scannable heading.
- Zero console errors and zero failed requests.
- No horizontal overflow at 390px.
- `prefers-reduced-motion: reduce` honoured — the motion layer does this for you, so the way to
  break it is to hardcode a duration instead of using a token.
- No `box-shadow` in computed styles except `--elev-inset`, and every die-cut object carrying an
  `--elev-*` drop shadow.
- No lime text on any light surface, and no `--ink` label on a lime fill.
- Grain visible on the bed. A flat fill passes every automated check and fails the brief.

Then look at it beside `brand/_source/concept/CONCEPT-ART-AUTHORITATIVE.jpeg`. A green gate is not
evidence of a good-looking page: the first attempt passed every automated check it had and was
rejected on sight.
