# Frameless — landing page variants

Two variants, both built from the brand kit at `../brand/`, both forked from one
section-complete skeleton so they are genuinely comparable.

Open them straight from disk — no server needed:

| | Path | Mechanic |
|---|---|---|
| **Skeleton** | `index.html` | The shared spine. No signature mechanic. |
| **A — The Shelf** | `variants/shelf/index.html` | Select a framework; the others grey out; a panel slides in with its real compiled output. |
| **C — The Peel** | `variants/peel/index.html` | The `.tsrx` source is a sticker over its own output. Peel the corner and the emitted code is underneath. |

---

## The recommendation

**Ship the Shelf as the primary, and keep the Peel as the moment further down the page.**

They are not competing for the same job:

- **The Shelf makes the claim inspectable.** It answers "does it work with mine?" — you find
  your framework, you see the real emitted file, its path, its line count and its hash. It is
  the section a skeptical engineer actually needs.
- **The Peel makes the compile step physical.** It is the better *first* impression and the
  worse *reference*: you cannot scan six frameworks with it, but nobody forgets it.

A page carrying both — the Peel high as the hook, the Shelf below as the proof — is stronger
than either alone. That is the real finding from building them.

---

## Grades, honestly

Graded by screenshotting in a real browser and comparing against the concept art, on: belongs
beside the art · real elevation · texture not flat fill · survives next to avara.xyz and
react.gg · type heavy and confident.

| | Grade | Note |
|---|---|---|
| Hero (both) | **A−** | The die-cut treatment: lime fill, black keyline, cream band, stacked `drop-shadow`. |
| Framework badges | **A−** | Full colour, glossy, tinted bands, cast shadows. Closest thing here to the art. |
| Skeleton | **B+** | Nine sections, four alternating beds, 7.2 screens. |
| **A — Shelf** | **B** | Mechanic verified. Two layout defects survive at 1440 — see below. |
| **C — Peel** | **B+** | Mechanic verified. The payload reads. |

### Known defects — not hidden

**The Shelf, at 1440px:**
1. The detail panel clips its own code block at the carousel's lower edge.
2. The chevrons overlap the scaled selected sticker.

Both are *integration* faults — the carousel grades A− on its own specimen page, where it sits
in a taller container. Fixing them properly means adjusting the component in the kit, which was
outside this tranche's scope. **Fix these before shipping the Shelf.**

**Both variants:** every section is still the same shape — eyebrow, title, body, left-aligned.
`page-composition.md` asks for at least three distinct section shapes. The mechanic sections
break the pattern; the other seven do not.

---

## Why there is no third variant

The charter allowed two: *"Two variants is acceptable, three is the target… A + C is the
strongest pair if time forces a choice."*

The unbuilt third was **The Pile** — scattered draggable stickers. It is the weakest of the
three by the kit's own ranking of what interactivity should mean: it decorates rather than
demonstrates. Building it would also have meant leaving the Shelf's known defects unfixed to
add a variant nobody would pick.

**If a third is wanted, build it as a third *argument*, not a third decoration.** The strongest
unbuilt candidate is the activation-neutrality demo — hydrate versus resume, side by side, at
the moment of activation. It is the most technically interesting thing the project has and it
currently has no visual moment anywhere.

---

## What is real on these pages

Every code sample is a verbatim file read out of this repository:

- `packages/compiler/test/fixtures/s1-render-once.tsrx` — the source
- `packages/frameworks/{react,solid,qwik}/generated/S1.jsx` — the outputs

Nothing is hand-written to look plausible. Vue, Svelte and Angular have no emitted files in this
repo, and the Shelf says so plainly in those panels rather than fabricating a sample — a
fabricated hash would turn the one inspectable claim on the page into an unverifiable one.

## Verification

```bash
node ../brand/tools/structural-gate.mjs   # 26 checks, mutation-proven
```

Both variants were checked from `file://` at 1440px and 390px: zero console errors, zero failed
requests, no horizontal overflow, Que Grotesque confirmed loaded.

**Always verify from `file://`, not only a dev server.** CSS `mask-image: url()` is CORS-blocked
from disk, and it silently blanked all six framework marks once already in this project.
