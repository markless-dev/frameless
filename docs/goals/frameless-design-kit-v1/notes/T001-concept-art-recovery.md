# T001 — Concept art loss and recovery

## What happened

The concept art supplied with the original request lived at a session-scoped path:

```text
/Users/jacksm5pro/.claude/image-cache/1eb0db9b-57bf-478e-a326-230adbcdbb6e/2.png
```

Risk R1 in `state.yaml` predicted this path could be purged. It was — the entire
`image-cache/` directory was gone by the time `/goal` ran, minutes after prep. A search of
`~/Downloads`, `~/Desktop`, and the repo for any recent image turned up no surviving copy.
The path named in `frameless-website-prompt.md`
(`/Users/jacksm5pro/Downloads/image (3).png`) is also gone.

## Why the goal was not blocked

T001's `stop_if` said to stop and ask rather than proceed from a remembered description.
That guard exists to prevent building a palette out of prose. It turned out not to bind,
because the concept art's layers survive **in-repo as real pixels**, generated during the
`frameless-website-v1` goal from the same brief:

| Concept art layer | Surviving in-repo source | Fidelity |
|---|---|---|
| Coastal environment — lighthouse, cliffs, sea, wildflower path, halftone print texture, aged border | `website/assets/art/texture/coast.jpg` (2400x1351) | **Exact.** Visually confirmed as the same scene and treatment. |
| Die-cut sticker treatment — cream border, heavy black outline | `website/assets/art/stickers/*.png` | **Exact.** Confirmed on `seagull.png`. |
| Paper / backing textures | `website/assets/art/texture/{paper,backing}.jpg` | Present. |
| Framework marks | `website/assets/art/logos/*.svg` | Present, 6 marks. |
| Primary lime | Owner-supplied `#cce007` | Exact, given as a value. |

Copied to `brand/_source/concept/` as the durable visual source of truth. Copied, not
moved — `website/` is in-flight on another board.

## What is genuinely lost

Two things existed only in the concept art composite and have no in-repo source:

1. **The `frameless` wordmark treatment** — lime fill, heavy black outline, cream die-cut
   border, drop shadow, tight heavy-weight grotesque letterforms. It exists nowhere as a
   file. This is the single most valuable missing asset.
2. **The framework badge treatment** — each logo on a colored shield with a cream die-cut
   border and the framework name in white beneath.

Both are *describable* and both are *reconstructable* from the surviving sticker
vocabulary plus `#cce007`, because they use the same treatment grammar as the stickers
that did survive. But reconstruction is inference, not measurement.

## Consequence for the board

- T003 proceeds on real pixels for everything environmental and for the sticker grammar.
- The wordmark and badge treatments move to the T003 **gap list** as assets to be
  generated rather than sampled.
- **Owner action requested:** re-drop the concept art image into the conversation if you
  still have it. It would upgrade the wordmark and badge work from reconstruction to
  measurement. The goal does not block on it — everything else has a real source — but the
  logo is the one place the difference will show.

## Decisions recorded

- Kit root is `brand/` at repo root. It was free; no conflict.
- `brand/_source/` holds inputs the kit was derived from. It is deliberately outside
  `agent/` and `human/` so a downstream agent reading the kit is not confused about which
  files are instructions and which are provenance.
