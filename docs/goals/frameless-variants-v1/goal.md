# Goal: Frameless landing page — 2–3 variants, built from the rebuilt kit

## Original request

> "Continue this kind of system until the 2-3 variants are built, you need no more input from
> me. I will be heading to bed for the night."

Preceded by, on reviewing the first attempt:

> "This looks absolutely horrible… the colors suck visually, it all sucks… this takes no
> element of ANY examples I gave you… The whole thing needs to be completely redone."
> "the shadow / elevated sticker is important" · "make sure there's a little bit of noise
> textures" · "when done for each section you're going to grade it visually and change it if
> it's under an unacceptable grade"

## Interpreted outcome

**2–3 complete landing page variants**, each built from the rebuilt kit at `brand/`, each
looking like it belongs beside `brand/_source/concept/CONCEPT-ART-AUTHORITATIVE.jpeg`, each
using a genuinely different core interaction mechanic, and each graded visually section by
section with anything under a **B** rebuilt before moving on.

## Input shape

`existing_plan` — the variant plan exists at
`docs/goals/frameless-design-kit-v1/notes/next-landing-page-plan.md`, but **one of its three
mechanics is void** (see below). Preserve the plan, correct the dead mechanic, execute.

## Authority — full autonomy

The owner is asleep and has explicitly delegated all remaining decisions:
*"you need no more input from me."*

**Do not block on owner input.** Where a decision is needed, make it, record it in the receipt
with the reasoning, and continue. Local, non-destructive, branch-scoped work only. No pushes,
no merges, no publishing.

## Goal oracle

Three signals. All must hold for every shipped variant.

1. **Visual grade ≥ B**, section by section, against these criteria:
   - Does it look like it belongs beside the concept art? (depth, saturation, sticker feel)
   - Is there real elevation — `drop-shadow`, layering?
   - Is there texture, or is it a flat fill?
   - Would it survive next to avara.xyz / react.gg?
   - Is the type heavy and confident?

   Grading is done by screenshotting in a real browser and comparing against the art.
   **Below a B is rebuilt before moving on** — never accumulated as debt.

2. **Interaction contract passes** per variant, Playwright-verified: the signature mechanic
   works, real emitted output is shown, all mandatory sections exist, Que Grotesque loads,
   holds at 390px, `prefers-reduced-motion` honoured, zero console errors **from `file://`**.

3. **Structural gate green** — `node brand/tools/structural-gate.mjs`. It is currently RED and
   its assertions encode rules the owner overturned. Fixing it is task one, not optional.

## Constraints — non-negotiable

Every one of these comes from explicit owner instruction. Violating any is a failed variant.

- **Hero text is fixed: "Compile once, output anywhere."** Never rewrite it.
- **Never count the targets.** No "ship six", "six outputs", "six frameworks", no totals.
- **`filter: drop-shadow()`, never `box-shadow`.** A die-cut sticker is an irregular shape;
  `box-shadow` casts a rectangle and kills the illusion. `drop-shadow` follows the alpha.
- **Elevation is mandatory.** The old kit-wide shadow ban was the single worst error.
- **Noise texture everywhere.** The background is never a flat fill.
- **Saturated palette from the real art** (`REBUILD-SPEC.md`). Not the desaturated substitute.
- Minimum **seven sections** per variant. A hero is not a landing page.
- No text on raw photography. No lime body text; lime display only where contrast passes.
- All six framework marks in canonical order, never recoloured to `--accent`.
- **Must work opened from `file://`**, not only over http. CSS mask/image `url()` is
  CORS-blocked from disk — inline as data URIs or real inline SVG.
- Frameless Studio is **coming soon**; never imply availability.

## Existing plan facts (preserve, but corrected)

From `docs/goals/frameless-design-kit-v1/notes/next-landing-page-plan.md`:

- Build **one section-complete skeleton first**, then fork it into variants changing only the
  hero mechanic and the output-exploration section. This is what makes variants comparable and
  stops any of them shipping as a one-hero page. **Keep this.**
- A reference contributes **one mechanic**. Page shape comes from the kit, never from the
  reference. The previous failure took avara as *architecture* and shipped one scattered screen.

**Correction — the "Bench" mechanic is void.** It was "six frames, one view", an invention the
owner rejected outright; the component and concept have been deleted. Replaced by the mechanic
that was actually asked for and is already built:

| Variant | Mechanic | Status |
|---|---|---|
| **A — The Shelf** | The avara mechanic: framework stickers in a row; select by click or ←/→; selected scales up at a fixed focal point, others desaturate to grey; detail panel slides in with that framework's real compiled output. | `components/framework-carousel.html` **already built and graded A−**. |
| **B — The Pile** | Scattered, draggable stickers with physics; click one and its compiled output opens. | To build. |
| **C — The Peel** | The `.tsrx` source as a sticker; peel the corner and the emitted framework code is literally underneath. Sticker Forge params: stroke 18px, tilt −3°, curl 0.120, stiffness 72%. | To build. |

Two variants is acceptable; three is the target. **A + C is the strongest pair** if time forces
a choice — the Shelf is proven and the Peel exercises `drop-shadow` on a lifting corner, the
one place the kit's motion system has a unique moment.

## PM decisions already made (owner delegated)

- **Hero treatment: option D.** Lime fill → thick black keyline → **cream band** → stacked
  `drop-shadow`. The comparison render showed keyline-alone muddies on a dark bed because the
  outline has nothing to separate from; the cream band is what makes the type read as a
  die-cut object. This is the concept art's own construction.
- **Page bed lifts toward the art's brightness.** A near-black page was a PM invention, not the
  art's. Dark stays as a *secondary* surface for code blocks and detail panels.
- **Known defect to fix in the hero:** the cream band adds ~26px of stroke in every direction,
  so at `line-height: .92` the band on line two eats the descenders of line one. Needs ~1.06
  and a per-line stack.

## Likely misfire

**Shipping three variants that are technically correct and still ugly.** The previous attempt
passed 23 structural checks, a cold-agent test and a skeptical Judge audit — and the owner
rejected it on sight. Every check verified internal consistency; none asked "does this look
good next to the art?"

That is why signal 1 is a *visual* grade and why it is listed first. **A green gate is not
evidence of a good-looking page.** Guard rails:

- three skins of one mechanic fails the owner's intent;
- a flat page passes the gate and fails the goal;
- accumulating "fix it later" sections is how the last one reached twelve screens of wrong.

Second misfire: rebuilding the kit again instead of building variants. The kit is rebuilt and
graded. Fix its four known breaks, then **build pages**.

## Known open work inherited from the kit rebuild

1. `brand/tools/structural-gate.mjs` asserts the **overturned** rules — the `box-shadow` ban
   and `drop-shadow`-peel-only. Rewrite to match the new system (elevation required;
   `box-shadow` discouraged in favour of `drop-shadow`).
2. `brand/human/build-guideline.mjs` throws — it looks for a `messaging.md` section the
   corrected verbal half removed.
3. `brand/agent/visual/assets/README.md` still documents four deleted stickers, the deleted
   six-frames device, and describes the sky as sage.
4. `artifacts/web/landing-page.html` and `artifacts/product/studio-inspector.html` are on old
   token names and reference deleted assets — they render broken.

## Non-goals

- Rebuilding the brand kit again. It is rebuilt; fix the four breaks and move on.
- Shipping Frameless Studio.
- Deploying, hosting, domains, pushing, merging.
- Touching `packages/`, `demos/`, or `poc/` except to *read* emitter output.

## What counts as enough

2–3 variants under `website/`, each running locally from `file://`, each with all mandatory
sections, each carrying a genuinely different mechanic, each section graded ≥ B against the
concept art, the interaction contract green per variant, and the structural gate green — plus
a short comparison note so the owner can pick a direction on waking.

## The `website/` folder

The owner directed: *"remove and redo the website folder."* It is **archived** at
`scratchpad/archive/website-pre-rebuild.tar.gz` (46 of 47 files were untracked, so deletion is
otherwise irreversible). Delete and rebuild from the kit. `docs/goals/frameless-website-v1` is
moot and should be closed.
