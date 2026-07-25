# T003 — Build contract (Judge decision)

Status: **approved with two board corrections** (see §0). This document is the binding
contract for T004/T005/T006. Where it disagrees with T001/T002, this document wins.

Everything below was re-verified against the working tree, not taken on trust from the
prior receipts. Verification commands and their real output are recorded in §8.

---

## 0. Two corrections that block T004 as currently written

These were not caught by T001 or T002 and must be fixed before or during dispatch.

### 0.1 `@playwright/test` does not exist in this repo. The board's verify command cannot run.

The board says `verification.command: npx playwright test website/tests/interaction-contract.spec.ts`.
That command cannot work today:

```
$ node -e "console.log(require.resolve('@playwright/test'))"
Error: Cannot find module '@playwright/test'

$ npx --no-install playwright test --config <probe>/playwright.config.js
Error: Cannot find module '@playwright/test'
Require stack:
- <probe>/smoke.spec.js
- node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/lib/transform/transform.js
```

`playwright` 1.58.2 exists only as a dev dependency of `packages/frameworks/react`,
`packages/frameworks/solid`, and two `poc/` packages. `@playwright/test` is in no
`package.json` anywhere and is not in the pnpm store. The `playwright` CLI's `test`
subcommand loads, but any spec that does `import { test } from '@playwright/test'` fails.

Compounding this: crew workers have no network (`crew-sandbox-no-network` memory), so the
Worker **cannot** `pnpm add -D @playwright/test`.

**Decision: build the harness as a plain Node script against the `playwright` library, not
`@playwright/test`.** This is zero-install, works today, and matches the repo's own
precedent — `scripts/e2e.mjs` is a plain Node script that resolves a tool through
`createRequire` against another package's manifest.

Proven working, from repo root:

```js
import { createRequire } from 'node:module';
const req = createRequire(resolve(root, 'packages/frameworks/react/package.json'));
const { chromium } = req('playwright');   // → launches, 1.58.2, browsers cached
```

Probe result: `TEXT: hi`, `overflow: 390`, `fonts.check available: function`, `LAUNCH-OK`.
Chromium builds are already installed (`~/Library/Caches/ms-playwright/chromium-1208` et al).

New canonical command: **`node website/tests/interaction-contract.mjs`**.

Assertions use `node:assert/strict`. The script prints one `PASS`/`FAIL` line per assertion
per variant and exits non-zero on any failure.

> Required board update (PM owns this, Judge does not mutate state):
> - `verification.command` → `node website/tests/interaction-contract.mjs`
> - `goal.oracle.final_proof` → same command
> - T004/T005/T006 `verify[0]` → same command
> If the owner later installs `@playwright/test@1.58.2` at the root, the same assertion
> module can be re-exported into a `.spec.ts` with no rewrite. That is optional polish,
> not a requirement of this goal.

### 0.2 `website/` does not exist, and `website/assets/fonts/` is already gitignored

T001 recorded "an empty `website/` directory". It is not there now:

```
$ ls website
ls: website: No such file or directory
```

T004 creates it from nothing. Nothing to avoid resurrecting.

More importantly, `.gitignore` already contains:

```
# Licensed Que Grotesque webfonts (TypeBerka professional license — do not commit)
website/assets/fonts/
```

So the font files the oracle checks for **will never be committed**. That is correct and
must stay. The consequence is that the interaction contract is only green on a machine that
has the licensed font folder and has run the install step. That is accepted: the font is a
purchased first-party asset, and a red font assertion on a machine without it is the honest
outcome. §6.3 defines the install step; §7 makes it a prerequisite of the verify sequence.

---

## 1. Decision — the six-vs-three framework conflict

The reference art shows six stickers (React, Vue, Svelte, Solid, Angular, Qwik) in one row
beneath a `COMPILED OUTPUTS` badge, each fed by a dashed arrow. Only three emitters exist.
`ls packages/frameworks/` → `react`, `solid`, `qwik`. README's own status table says
"More frameworks (Angular, Vue, Svelte) | Planned".

### Options considered

| Option | Verdict |
|---|---|
| **A.** Show only the three real ones | Honest, but discards the owner's key art, and leaves the peel section with no subject — a decorative peel is one of the named misfires. Rejected. |
| **B.** Six, three greyed with badges | Honest but inert. The three planned ones read as "broken" rather than "next". Doesn't earn the peel. Rejected. |
| **C.** Six, greyed + not clickable | Same as B with better affordance. Still leaves the peel decorative. Rejected. |
| **D.** T002's proposal: three full-colour and clickable; Vue/Svelte/Angular are the peel stickers whose adhesive underside reads COMING SOON | Right instinct, but as written it lies at rest: if all six sit in one `COMPILED OUTPUTS` row looking alike, a user who never peels is misled. |

### Decision — **D, hardened: the two-tier sticker board**

Adopt T002's peel-reveal, but the honesty must land *before* any interaction, not as a
reward for peeling.

1. The three shipped emitters — React, Solid, Qwik — are full-colour, full-saturation,
   clickable, and are the only stickers inside the group labelled **COMPILED OUTPUTS**.
   They carry `data-status="shipped"`.
2. Vue, Svelte and Angular live in a **separate, separately-labelled group** headed
   **PLANNED — peel to check**. They are desaturated, carry a visible `PLANNED` tag on the
   sticker face, are `aria-disabled="true"`, and carry `data-status="planned"`.
3. Activating a planned sticker never opens a code panel. It cannot, because there is no
   code. This is asserted (§5, assertion 5).
4. Peeling a planned sticker reveals the adhesive underside reading
   **NOT SHIPPED YET — this emitter doesn't exist**, with the README's own word, *Planned*.

Why this is the right call, not just a compromise:

- **It is true at every frame.** At rest, on hover, on click, and after the peel, the page
  says the same thing. No state of the UI overstates support.
- **It gives the peel a job.** The peel stops being a gimmick bolted onto a section and
  becomes the mechanism that answers a question the user actually has ("what about Vue?").
  This is the single strongest defense against the "decorative peel" misfire.
- **It preserves the owner's key art.** Six stickers, dashed arrows, the same composition.
- **It is machine-checkable.** Assertions 3, 4 and 5 pin the shipped set to exactly
  `{react, solid, qwik}` and the planned set to exactly `{vue, svelte, angular}`. If a
  future Worker quietly promotes Vue to look supported, the contract goes red.

### Two further honesty rulings

- **Markless.** T001 flags that positioning Frameless as fully standalone is overstated —
  it vendors `@markless/compiler`. Do **not** give Markless a sticker; that muddles the
  story. Do put one line in the footer: *"Frameless is built on the Markless compiler."*
- **The CLI.** `packages/cli`'s `TARGET_INVENTORY` is react and solid only. The site must
  **not** print `frameless build --target qwik`. If a command is shown at all, it is
  `--target react --target solid`, or no command at all. V1 shows no CLI command.
- **Import specifier.** The source shown on the page is the verbatim fixture, which imports
  `@markless/core`. Do not substitute the README's `@frameless.md/core`. Asserted (§5, #18).

---

## 2. Decision — the three variants

Constraint being enforced: the mechanics must differ in *kind*, not in skin. The axis I am
separating them on is **how the user causes an output to appear**:

- **V1 selection** — you pick a thing and it opens.
- **V2 progression** — you advance a process and it unfolds, reversibly.
- **V3 causation** — you perform the compile with your hand and keep the result.

None of these three collapses into another, because removing the mechanic destroys the
page in each case.

---

### Variant 1 — **The Pile** (avara mechanic, faithful)

This is the one the owner explicitly asked for: *"exactly like this but with the frameworks
so people can see each output."* It is also the correct first build, because it establishes
the output panel, the spec table, the sticker kit and the peel that V2 and V3 reuse.

**Core mechanic.** One fixed, full-viewport, non-scrolling stage. The entire page is a
loose overlapping pile of die-cut stickers. Nothing scrolls; everything is a sticker.

**Exactly what the user does.**
- *Pointer drag* on any sticker moves it around the stage. Three nested transform layers
  per T002's teardown — outer `translateY` idle float (per-sticker phase offset), middle
  drag offset, inner resting `rotate()` between 2° and 17°. They never fight because they
  are separate elements.
- *Click* a shipped sticker: it scales ~2x and settles left-of-centre; every other sticker
  desaturates to near-black silhouette; a panel slides in from the right (448px, inset 8px,
  rounded, dark charcoal).
- *Click and hold-drag* are disambiguated by a 6px movement threshold — past 6px the
  pointerup does not open the panel. This is the single most likely bug in this variant.
- *`<` / `>` controls* at bottom centre cycle React → Solid → Qwik **with the `.tsrx`
  source pinned in place**. Only the output column changes. This gesture *is* the product
  thesis.
- *Arrow keys* also cycle. *Escape* or backdrop click closes.
- *Peel*: the three planned stickers sit in their own cluster in the lower third. Grab the
  die-cut edge and drag — the corner lifts and the underside reads NOT SHIPPED YET.
- *Studio*: a lime "Frameless Studio" sticker in the pile. Clicking it opens the same panel
  chrome but with no code — a description, a COMING SOON stamp, and a disabled CTA.

**Panel anatomy** (mapped from avara's spec table, per T002):

| avara row | Frameless row |
|---|---|
| Surfaces | Reactivity primitive (`useState` / `createSignal` / `useSignal`) |
| Industry | Activation model (hydrates / hydrates / resumes) |
| Since | Emitter status (Shipped, verified from a fresh clone) |
| Chains | Lines emitted (computed from the real file) |
| Status | Verified by (`pnpm e2e`, 3 frameworks × 3 scenarios, real browser) |

Every value in that table is derived from the captured file or from repo-verified facts.
No invented numbers.

**Why it is memorable.** The pile is grabbable, physical, and has no chrome. And the
`< >` cycle with the source pinned turns "compile once, output anywhere" from a claim into
a two-second gesture the user performs themselves.

**Difficulty:** ~10–14h. The largest cost is the sticker physics layer and the panel.

**Single biggest risk:** drag/click disambiguation. A pile that opens a panel every time
you try to move a sticker feels broken. Mitigation is the 6px threshold plus
`setPointerCapture`; it must be built first, not last.

---

### Variant 2 — **The Compile Lane** (scroll is the compiler)

**Core mechanic.** Scroll position *is* compilation progress, and it is reversible. A
single `.tsrx` source card is pinned on the left. As you scroll, a scan line travels down
the source, consuming it line by line. On the right, three output columns write themselves
in — character by character — each fed from the scan line by a dashed arrow lifted straight
from the key art. Scroll back up and the outputs *un-write*. Progress is a deterministic
0→100% function of scroll offset, not an animation that fires once.

**Exactly what the user does.**
- *Scroll* (wheel, trackpad, touch, PageDown/PageUp, Home/End) drives compilation. **No
  scroll hijacking**: implemented as a tall spacer plus `position: sticky`, with progress
  read from `getBoundingClientRect()`. The native scrollbar keeps working.
- *Drag the progress rail* on the right edge to scrub compilation directly.
- *Click a framework column header* (the sticker) to expand that column full-width with the
  complete output — this is the variant's popup.
- *Peel*: at the bottom of the lane, three more dashed arrows point at the three planned
  stickers. The lane ends by admitting where it stops.
- *Studio*: the final card past the peel — "and next: Frameless Studio", COMING SOON.

**Why it is memorable.** It makes an invisible process into a machine you drive with your
finger, and — critically — you can run it *backwards*. Nobody has scrubbed a compiler
before.

**Difficulty:** ~14–18h. The hardest of the three.

**Single biggest risk:** reveal performance. Naively appending DOM nodes per character will
jank. Mitigation is mandatory: the full output text is rendered once into the DOM at load,
and reveal is a pure CSS `clip-path` / `--progress` custom-property effect over static
text. No DOM churn on scroll, no `requestAnimationFrame` text rebuilding. If a Worker is
about to mutate `textContent` on scroll, that is a design failure — and it would also break
assertion 9, which compares full `textContent` against the file byte-for-byte.

*(That is a deliberate coupling: assertion 9 makes the performant implementation the only
implementation that passes.)*

---

### Variant 3 — **The Press** (drag the source onto a framework to compile it)

**Core mechanic.** A workbench, seen top-down. One `.tsrx` source sticker sits in the
middle. Six framework plates are arranged around it. You physically **drag the source onto
a plate**. On drop, the plate stamps, and a printed strip of that framework's real compiled
output slides out of it like a specimen card — and *stays on the desk*. Press all three and
you have three real outputs lying side by side, which is precisely the comparison the
product exists to make.

**Exactly what the user does.**
- *Pointer-drag* the source sticker onto a plate (`setPointerCapture`, pointer events, so
  touch works). Plates highlight on hover-while-dragging.
- *Keyboard path is mandatory, not an afterthought*: `Tab` to a plate, `Enter` presses it.
  This is also the path the contract asserts, so it cannot rot.
- Drop on a **planned** plate and it *refuses*: the plate's corner peels up on its own,
  revealing NOT SHIPPED YET underneath. **The peel is the error state.** No output strip is
  produced.
- Output strips can be dragged around and laid next to each other; a strip's header is the
  provenance line from the real file.
- *Studio*: a sealed envelope on the desk. You can peel its flap, but it is sealed shut —
  COMING SOON.

**Why it is memorable.** The user performs the compilation. Cause and effect sit in the
hand, and the page accumulates state rather than resetting — you build the comparison
yourself instead of being shown it.

**Difficulty:** ~12–16h.

**Single biggest risk:** drag-and-drop accessibility and touch. Mitigation is the mandatory
keyboard press path plus pointer events (never HTML5 drag-and-drop, which is unusable on
touch and untestable in a headless browser).

---

### Distinctness check

| | V1 The Pile | V2 The Compile Lane | V3 The Press |
|---|---|---|---|
| Input that drives it | click + free drag | scroll / scrub | drag-to-target + Enter |
| Page model | fixed stage, no scroll | one long reversible timeline | accumulating workspace |
| Output appears because | you selected it | you advanced past it | you caused it |
| State after use | one panel open | scrubbed to a position | three strips collected |
| Peel's role | answers "what about Vue?" | the honest ending | the rejection state |

Remove the mechanic from any one of them and there is no page left. They are not reskins.

---

## 3. Decision — the peel technique

**Decision: CSS/SVG fold-line peel. No three.js, in any variant, in this goal.**

Reasoning, in priority order:

1. **Testability, which is decisive.** T002 found that sticker.oooo.so renders *nothing*
   under default headless Chromium and only appeared with
   `--use-angle=swiftshader --enable-unsafe-swiftshader`. The oracle for this entire goal is
   a headless browser run. A WebGL peel would make the primary proof GPU-dependent and
   flaky. That alone settles it.
2. ~600KB of dependency for one section of a landing page, which the Worker cannot install
   anyway (no network).
3. The parameter model T002 extracted (curl radius, stiffness, wind) is fully expressible in
   CSS custom properties.

**Technique spec.**
- Two stacked layers: the sticker face, and the adhesive underside (matte warm grey-white,
  `#EDE7D8`-ish, slightly darker than the cream).
- A fold line derived from pointer position along the drag axis.
- `clip-path: polygon(...)` splits the face at the fold; the flap is a second copy of the
  face reflected about the fold axis, rotated with `rotate3d` under a `perspective` on the
  parent.
- A `linear-gradient` overlay along the fold for the curl highlight; a `drop-shadow` whose
  blur and offset grow with peel distance.
- Single source of truth: a `--peel` custom property, `0`→`1`.
- `--peel` is mirrored to `aria-valuenow` as `Math.round(peel * 100)` on every update.

**Accessibility contract — mandatory regardless of technique**, because the whole
interaction contract depends on it:

```html
<div data-peel role="slider"
     tabindex="0"
     aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
     aria-valuetext="0% peeled"
     aria-label="Peel the sticker to see whether this emitter exists"
     aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
     style="touch-action: none">
```

Arrow keys move `--peel` in steps of 5. Pointer drag is continuous.

**Fallback trigger — stated as a hard stop, not a judgment call.** The Worker does not get
to decide to escalate. If the Worker concludes the CSS peel cannot reach
`aria-valuenow >= 90` without visible clipping or z-fighting artifacts at 390px width, that
is a `stop_if`: stop and return to Judge. Do not install three.js. Do not fake the peel by
setting `aria-valuenow` without moving geometry — assertion 15 exists specifically to catch
that, and it will.

**Deferred:** the peel sound. T002 is right that it carries a lot of the physicality, but it
is an asset-generation task and asset generation is the named second misfire. Not in T004.

---

## 4. Decision — how real emitter output reaches the page

**T001's recommendation is CONFIRMED, on independently re-verified grounds.**

Read the committed files with `fs` at build time. Do not import `@frameless/compiler`.

Re-verified reasons:
- All nine generated files plus the three fixtures are git-tracked and currently clean:
  `git status --porcelain packages/frameworks/ packages/compiler/test/fixtures/` → empty.
  So captured output is byte-traceable to a commit, which is exactly what the T999 oracle
  demands.
- Every package `exports` field points at raw `./src/index.ts`; `packages/cli` and all three
  framework packages are `"private": true`, all `0.0.0`; `@frameless/compiler` depends on a
  `file:` tarball in `vendor/`. Importing the compiler would drag the website into the
  workspace TypeScript toolchain — which this repo has deliberately excluded (commit
  `7f4c04d` ignores `website/` in the lint pass, and `pnpm-workspace.yaml` does not list it).
- The Worker has no network, so anything requiring an install is dead on arrival.

### Scenarios to show

- **S1 `RenderOnce` is the hero, and is the only scenario T004 must ship.** It is the right
  choice for a specific, demonstrable reason: **Solid emits `<Show when= fallback=>` where
  React and Qwik emit a ternary.** Verified — `grep -l '<Show' packages/frameworks/*/generated/S1.jsx`
  matches solid only. That is a *substantive* idiom difference a visitor can see in two
  seconds, and it is the clearest possible proof that Frameless is not doing
  lowest-common-denominator syntax translation.
- **S2 and S3 are captured too** (same loop, zero extra cost) and are available to V2/V3.
  S2 additionally shows `<For>` in Solid vs `useStore` in Qwik vs array `.map` in React.
  Not required by the contract.

### The build script contract

**Path:** `website/scripts/capture-emitter-output.mjs`

**Reads exactly these twelve files** (all verified present and git-tracked):

```
packages/compiler/test/fixtures/s1-render-once.tsrx
packages/compiler/test/fixtures/s2-keyed-todo.tsrx
packages/compiler/test/fixtures/s3-event-form.tsrx
packages/frameworks/{react,solid,qwik}/generated/{S1,S2,S3}.jsx
```

**Writes exactly one artifact:** `website/src/data/emitter-output.js`

An ES module, not JSON. Rationale: a plain static site loaded over `http://` can
`import` it from a `<script type="module">` with no `fetch`, no MIME configuration, and no
CORS surprises — while still being human-reviewable and diffable in a PR.

```js
// @generated by website/scripts/capture-emitter-output.mjs — do not edit by hand.
export default {
  commit: "<git rev-parse HEAD>",
  scenarios: [
    {
      id: "s1",
      title: "RenderOnce",
      sourcePath: "packages/compiler/test/fixtures/s1-render-once.tsrx",
      source: "<verbatim .tsrx text>",
      outputs: {
        react: { path: "packages/frameworks/react/generated/S1.jsx",
                 code: "<verbatim text>", sha256: "<hex>", lines: 33, bytes: 877 },
        solid: { ... },
        qwik:  { ... }
      }
    }
    /* s2, s3 */
  ]
};
```

**Hard requirements on the script:**

1. **Fail loudly if a source file moves.** Missing input → print the exact expected absolute
   path and `process.exit(1)`. Never silently skip, never emit a partial artifact, never
   fall back to a stub.
2. **Provenance gate — the anti-fabrication guard.** For each captured output, assert the
   first line is exactly:
   ```
   // @generated by @frameless/<framework>; do not edit.
   ```
   Verified present on all nine files. If it does not match, `exit 1`. This means the build
   step itself refuses to ship anything that did not come out of an emitter.
3. **Verbatim.** No reformatting, no re-indentation (the files use tabs — keep them), no
   trimming of interior whitespace, no truncation, no ellipsis. The only permitted
   normalization is `\r\n` → `\n`.
4. **Deterministic and re-runnable.** No timestamp field. Same inputs → byte-identical
   output. `git diff --quiet website/src/data/emitter-output.js` after a re-run is part of
   the verify sequence, which proves the committed artifact is current.
5. `emitter-output.js` **is committed.** The site works from a clean checkout without
   running the script; the script exists to prove the artifact is still true.

---

## 5. The interaction contract

Every variant must pass every assertion. The harness auto-discovers variants by globbing
`website/variants/*/index.html`, so V2 and V3 inherit the contract by existing — T005 and
T006 add a directory, not a test file.

### 5.1 Shared DOM hooks — mandatory in every variant

This is the part that makes one spec cover three variants. A variant may look like anything;
it must expose these.

| Hook | Meaning |
|---|---|
| `[data-frameless-variant]` on `<html>` | `pile` \| `lane` \| `press` |
| `[data-framework-sticker][data-framework][data-status]` | a framework sticker; status is `shipped` \| `planned` |
| `[data-output-panel]` | the popup/panel/column/strip that shows output |
| `[data-output-panel][data-open="true"\|"false"]` | open state |
| `[data-output-panel][data-output-framework]` | which framework is currently shown |
| `[data-output-code]` | the element whose `textContent` **is** the compiled output |
| `[data-output-gutter]` | optional; line numbers live here, **never** inside `[data-output-code]` |
| `[data-panel-close]` | close control |
| `[data-source-code]` | the element whose `textContent` is the `.tsrx` source |
| `[data-peel]` | `role="slider"`, the peel control |
| `[data-peel-flap]` | the element whose geometry actually moves |
| `[data-studio-teaser][data-available="false"]` | the Studio coming-soon moment |
| `[data-wordmark]` | the `frameless` wordmark, live text |
| `[data-attribution]` | footer credits |

### 5.2 The assertions

**Load and structure**

1. The page loads with zero uncaught errors: the count of `pageerror` events is `0`, and no
   same-origin response has status `>= 400`.
2. `document.documentElement` has `[data-frameless-variant]` whose value is one of
   `pile`, `lane`, `press`.
3. `[data-framework-sticker][data-status="shipped"]` matches **exactly 3** elements, and the
   set of their `data-framework` values is **exactly** `{react, solid, qwik}`.
4. `[data-framework-sticker][data-status="planned"]` matches **exactly 3** elements, the set
   of their `data-framework` values is **exactly** `{vue, svelte, angular}`, and every one
   has `aria-disabled="true"`.
5. **Planned stickers never show code.** For each of the three planned stickers: click it,
   wait 500ms, and assert `[data-output-panel][data-open="true"]` matches 0 elements.

**Real emitter output — the core of the oracle**

6. For each `fw` in `{react, solid, qwik}`: activating `[data-framework-sticker][data-framework="<fw>"]`
   causes `[data-output-panel][data-open="true"]` to be visible within 2000ms, and that
   panel's `data-output-framework` equals `<fw>`.
7. `[data-output-code]` `textContent` contains the exact provenance line
   `// @generated by @frameless/<fw>; do not edit.`
8. Discriminator inclusion **and exclusion** (all verified true against the real S1 files):

   | fw | must contain | must NOT contain |
   |---|---|---|
   | react | `useState(`, `useRef(`, `from 'react'` | `createSignal`, `component$` |
   | solid | `createSignal(`, `<Show`, `untrack(`, `from 'solid-js'` | `useState`, `component$` |
   | qwik | `component$(`, `useComputed$(`, `useTask$(`, `@qwik.dev/core` | `createSignal`, `useState` |

   The exclusions are what make this meaningful: they prove the panel swapped content rather
   than concatenating everything.
9. **Byte equality.** The harness reads `packages/frameworks/<fw>/generated/S1.jsx` from disk
   with `fs` at test time and asserts:
   ```
   normalize(panelCodeTextContent) === normalize(fileContents)
   normalize = s => s.replace(/\r\n/g, '\n').trim()
   ```
   This is the assertion that makes hand-written snippets impossible. It also constrains
   implementation: syntax highlighting may only wrap text in `<span>`s — no injected line
   numbers, ellipses, prompts, or re-indentation inside `[data-output-code]`.
10. **Switching swaps.** With React's panel open, activate Solid's sticker. Assert
    `data-output-framework` becomes `solid`, `[data-output-code]` `textContent` differs from
    the React text, it now satisfies row `solid` of assertion 8, and
    `[data-output-panel][data-open="true"]` still matches exactly 1 element (a swap, not a
    second panel).
11. **Close.** Activating `[data-panel-close]` results in no visible
    `[data-output-panel][data-open="true"]`. Separately: reopen, press `Escape`, same result.

**Peel**

12. At least one `[data-peel]` exists with `role="slider"`, `aria-valuemin="0"`,
    `aria-valuemax="100"`, and initial `aria-valuenow === "0"`.
13. **Pointer drag.** Move the mouse to the peel's bounding-box start handle, `mouse.down()`,
    move across `>= 120px` in `>= 8` discrete steps, then read `aria-valuenow`. Assert it
    parses as an integer and is `>= 15`. Then `mouse.up()`. (`>= 15`, not `> 0`, so a 1px
    twitch cannot pass.)
14. **Keyboard.** Focus `[data-peel]`, press `ArrowRight` five times, assert `aria-valuenow`
    is strictly greater than the value read immediately before the key presses.
15. **Geometry actually moved — anti-fakery.** Record
    `[data-peel-flap].getBoundingClientRect()` and the computed value of `--peel` before the
    drag in #13 and after. Assert at least one of width/height/x/y changed by `> 2px`, **and**
    the computed `--peel` changed. Without this, a Worker could satisfy #13 by setting an
    attribute and never building a peel at all.

**Typography**

16. Await `document.fonts.ready`, then assert **both**:
    - `document.fonts.check('900 48px "Que Grotesque"') === true`
    - the first family in `getComputedStyle(document.querySelector('[data-wordmark]')).fontFamily`
      is `Que Grotesque` (after stripping quotes).
17. **The self-hosted file was really fetched** — defeats a false green from a
    desktop-installed copy of the font on the developer's machine. Assert
    `performance.getEntriesByType('resource')` contains at least one entry whose `name`
    matches `/QueGrotesque.*\.woff2$/` with `decodedBodySize > 0`. Correspondingly, the
    `@font-face` rules **must not** use `local()` — `url()` sources only.

**Studio, honesty, layout**

18. `[data-source-code]` `textContent`, normalized, equals the captured `.tsrx` source read
    from `packages/compiler/test/fixtures/s1-render-once.tsrx`, and contains
    `@markless/core`.
19. Exactly one `[data-studio-teaser]` exists, is visible, has `data-available="false"`, its
    `textContent` matches `/coming soon/i`, and
    `document.querySelectorAll('[data-studio-teaser] a[href^="http"]').length === 0`.
20. **No component framework shipped.** `window.React`, `window.Vue`, `window.Solid` and
    `window.qwik` are all `undefined`, and no `performance.getEntriesByType('resource')`
    entry name matches `/(^|\/)(react|react-dom|solid-js|vue|svelte)[.@\/-]|@qwik|@builder\.io/`.
    (Guards the "no framework" constraint mechanically.)
21. **Mobile 390.** Set viewport to `390 x 844`, reload, await `document.fonts.ready`, then
    assert `document.documentElement.scrollWidth <= 391` **and**
    `document.body.scrollWidth <= 391`.
22. **Mobile is not a dead skin.** Still at `390 x 844`: re-run assertion 6 and assertion 9
    for `solid` — the panel must open and still contain byte-identical Solid output. Then
    assert `[data-peel]` exists and `[data-studio-teaser]` is visible.
23. **Attribution, conditional.** If `document.querySelector('[data-icon-source="game-icons"]')`
    exists, then `[data-attribution]` `textContent` must match `/game[- ]?icons/i` **and**
    `/CC BY/i`. (Game Icons is CC BY 3.0.)

Assertions 9, 15, 17, 20 and 22 are the anti-misfire core. They are the ones that a pretty
static page cannot pass.

---

## 6. Shared foundation

### 6.1 Directory layout

```
website/
  index.html                       local variant chooser (dev tooling, not the product)
  README.md                        how to run, per T007
  variants/
    pile/index.html                Variant 1  (T004)
    lane/index.html                Variant 2  (T005)
    press/index.html               Variant 3  (T006)
  src/
    css/tokens.css                 palette, type scale, sticker language
    css/base.css                   reset, grid backdrop, layout primitives
    css/sticker.css                die-cut sticker kit
    css/peel.css                   the fold-line peel
    js/emitter-panel.js            panel open/close/swap, renders captured output
    js/stickers.js                 pile physics, drag/click threshold
    js/peel.js                     the peel controller (--peel <-> aria-valuenow)
    js/studio.js                   the coming-soon moment
    data/emitter-output.js         GENERATED — committed, never hand-edited
  assets/
    fonts/                         GITIGNORED — populated by install-fonts.mjs
    img/                           (empty in T004)
  scripts/
    capture-emitter-output.mjs
    install-fonts.mjs
    serve.mjs
  tests/
    interaction-contract.mjs       runner: serves, loops variants, exits non-zero
    contract-assertions.mjs        the 23 assertions, one exported function each
```

`website/index.html` is a plain list of links to the three variants so the owner can compare
at T007. It is dev tooling and is explicitly not a second product page — it does not violate
"homepage only". It is exempt from the interaction contract (the harness globs
`variants/*/index.html` only).

### 6.2 Serving the site

Plain static files. **Decision: a zero-dependency Node static server**,
`website/scripts/serve.mjs`, built on `node:http` + `node:fs`.

Why not `file://`: Chromium blocks ES module imports over `file://` (CORS), which would kill
`import EMITTER_OUTPUT from '../src/data/emitter-output.js'`. Why not `npx serve` /
`python3 -m http.server`: the former needs network, the latter is an undeclared system
dependency and gives no control over MIME for `.woff2`.

Requirements: correct `Content-Type` for `.html .css .js .mjs .json .woff2 .svg .png .webp`,
directory index resolution to `index.html`, a real `404`, `--port` (default `4321`), and
`--port 0` support so the test harness can bind an ephemeral port and avoid collisions.

Manual command:

```sh
node website/scripts/serve.mjs          # → http://localhost:4321/variants/pile/
```

### 6.3 Fonts

`website/scripts/install-fonts.mjs` copies **four** `.woff2` files:

```
/Users/jacksm5pro/Downloads/Que_Grotesque_Professional_License_typeberka.com/WOFF/
  QueGrotesque-Black.woff2     -> 900   (the wordmark)
  QueGrotesque-Bold.woff2      -> 700
  QueGrotesque-Medium.woff2    -> 500
  QueGrotesque-Regular.woff2   -> 400
```

into `website/assets/fonts/`. All four verified present at that path.

- Fails loudly with the expected source path if the folder is absent.
- **"Subset" means weight subset, not glyph subsetting.** Glyph subsetting would require
  `fonttools`/`pyftsubset`, which is an undeclared dependency the Worker cannot install.
  Four of nine weights, `.woff2` only, is the correct reading of the constraint.
- Never copy `OTF/`, `TTF/`, or `Variable/`. The variable file exposes the whole family.
- `website/assets/fonts/` stays gitignored — the rule is already in `.gitignore` and must not
  be relaxed.
- `@font-face` uses `url()` only, **never `local()`**, so assertion 17 is meaningful.
  `font-display: swap`.

### 6.4 Design tokens

Straight from T002's sampled palette, as CSS custom properties in `tokens.css`:

```
--lime #C3D93A   --green-deep #173A22   --cream #F5EFDD   --ink #12100E
--sky #A6CDE0    --teal #3B8CA0         --cliff #6E9B4E   --sand #D9C9A3
--pink #E8A0B4   --yellow #F2D14E
```

Sticker language: cream die-cut border 10–14px, black outline inside it, soft drop shadow,
every sticker rotated a few degrees off-axis, paper-crinkle texture.

### 6.5 Asset policy — the anti-misfire ruling

goal.md names a second misfire: *"burning the whole tranche on asset generation and never
shipping a working interaction."* Therefore:

> **T004 generates zero image assets. Codex image generation is entirely out of scope for
> T004.**

| Asset | T004 | Rationale |
|---|---|---|
| **Wordmark** | **Live CSS text, Que Grotesque Black** | Confirms T002's lean. Decisive extra reason: assertion 16 checks the computed `font-family` of `[data-wordmark]`. If the wordmark were an image, the font oracle would be unverifiable. Lime fill, black offset `text-shadow`, cream die-cut edge via `paint-order: stroke fill` + `-webkit-text-stroke`. |
| **Framework stickers** | **Text-first die-cut plates** — framework wordmark in Que Grotesque on the brand colour field | Official logo SVGs need network, which the Worker does not have. Text plates are 100% honest, on-brand, and ship today. The contract never asserts logos, so adding them later is a pure enhancement. |
| **Paper / crinkle texture** | **Inline SVG `feTurbulence` filter** | Zero files, themeable, scales. |
| **Backdrop** | **Near-black + fine grid** (react.gg device) | Correct for a fixed dark stage where stickers must pop, and it is CSS. |
| Coastal poster parallax layers | **Deferred** | Polish pass or V2/V3. |
| Official logo SVGs | **Deferred** | Needs network. |
| Nature stickers (leaf, mushroom, seagull) | **Deferred** | Decorative. |
| Peel sound | **Deferred** | Asset generation. |
| Game Icons | **Deferred** | If used later, assertion 23 activates and the CC BY footer credit becomes mandatory. |

---

## 7. The T004 Worker package

Paste-ready for `state.yaml`.

```yaml
  - id: T004
    type: worker
    assignee: Worker
    status: queued
    reasoning_hint: medium
    objective: >-
      Build the shared foundation plus Variant 1 "The Pile" end to end, and stand up the
      interaction-contract harness so it runs green against Variant 1. Follow
      docs/goals/frameless-website-v1/notes/T003-build-contract.md exactly; it is binding.
      Foundation: website/ scaffold per contract section 6.1; install-fonts.mjs copying the
      four licensed Que Grotesque woff2 weights into the gitignored website/assets/fonts/;
      tokens.css from the T002 palette; capture-emitter-output.mjs producing the committed
      website/src/data/emitter-output.js from the twelve committed fixture and generated
      files, with the "@generated by @frameless/<fw>" provenance gate; serve.mjs, a
      zero-dependency node:http static server; and the CSS fold-line peel with
      role="slider" + aria-valuenow. Variant 1 is the avara mechanic: a fixed non-scrolling
      full-viewport stage of draggable die-cut stickers, click to select (6px drag
      threshold), others desaturate, a 448px right-hand panel showing that framework's real
      compiled S1 output verbatim plus the spec table, and < > controls that cycle
      React/Solid/Qwik with the .tsrx source pinned. React/Solid/Qwik are data-status=shipped
      and clickable; Vue/Svelte/Angular are data-status=planned, aria-disabled, in a
      separately labelled PLANNED group, and are the peel stickers whose underside reads NOT
      SHIPPED YET. Include the Frameless Studio coming-soon sticker. The harness is plain
      Node against the playwright library resolved via createRequire — NOT @playwright/test,
      which is not installed and cannot be installed. It must auto-discover
      website/variants/*/index.html so T005 and T006 inherit the contract for free. All 23
      assertions in contract section 5.2 must pass for Variant 1. It must be a running,
      interactive page, not a mockup.
    allowed_files:
      - "website/**"
      - "package.json"
      - ".gitignore"
    verify:
      - "node website/scripts/install-fonts.mjs"
      - "node website/scripts/capture-emitter-output.mjs"
      - "git diff --quiet website/src/data/emitter-output.js"
      - "node website/tests/interaction-contract.mjs"
      - "git status --porcelain website/assets/fonts | grep . ; test $? -eq 1"
    stop_if:
      - "Need files outside allowed_files — packages/, demos/ and poc/ are read-only."
      - "Any new npm dependency appears necessary, including @playwright/test or three.js. The sandbox has no network. Stop and report; do not install, do not vendor."
      - "The licensed font folder is missing at /Users/jacksm5pro/Downloads/Que_Grotesque_Professional_License_typeberka.com/WOFF/."
      - "Any generated S1.jsx first line is not exactly '// @generated by @frameless/<fw>; do not edit.' — upstream moved; stop rather than adapt."
      - "You are about to hand-write, reformat, re-indent, truncate or abbreviate any compiled output, or inject line numbers inside [data-output-code]."
      - "You are about to set aria-valuenow on the peel without moving real geometry."
      - "The CSS peel cannot reach aria-valuenow >= 90 without visible artifacts at 390px width."
      - "Verification fails twice."
```

### Notes for the Worker on verify

- Run in the listed order. `install-fonts.mjs` must precede the contract run or assertions
  16/17 fail.
- `git diff --quiet website/src/data/emitter-output.js` proves the capture step is
  deterministic and the committed artifact is current.
- The last line asserts the fonts directory produced no git-visible changes, i.e. the
  licensed files were not accidentally staged.

### Required board updates (PM owns these; Judge does not mutate state)

1. `verification.command`: `npx playwright test website/tests/interaction-contract.spec.ts`
   → `node website/tests/interaction-contract.mjs`
2. `goal.oracle.final_proof`: same command substitution.
3. T005 and T006 `verify[0]`: same command substitution.
4. Add to `notes`: "`@playwright/test` is not installed and the Worker sandbox has no
   network; the contract harness uses the `playwright` library directly via `createRequire`,
   matching the precedent in `scripts/e2e.mjs`."
5. Record the variant names on T005/T006: T005 = Variant 2 "The Compile Lane" (scroll-scrub),
   T006 = Variant 3 "The Press" (drag-to-compile), so the mechanics cannot drift into
   reskins.

---

## 8. Verification performed for this decision

| Claim | How checked | Result |
|---|---|---|
| Only three emitters | `ls packages/frameworks/` | `react solid qwik` |
| Generated files committed and clean | `git ls-files`, `git status --porcelain` | 9 files tracked, working tree clean |
| Provenance header on all nine | `head -2` on all nine | `// @generated by @frameless/<fw>; do not edit.` on every one |
| `<Show` is Solid-only | `grep -l '<Show' packages/frameworks/*/generated/S1.jsx` | solid only |
| Full discriminator matrix S1/S2/S3 | `grep -l` per token | mutually exclusive as tabulated in §5.2 |
| `@playwright/test` availability | `require.resolve`, `npx playwright test --config` | **Not installed. Spec import fails.** |
| `playwright` library usable | `createRequire(packages/frameworks/react/package.json)('playwright')` + real launch | **LAUNCH-OK**, 390px viewport and `document.fonts.check` both available |
| Browsers present | `ls ~/Library/Caches/ms-playwright/` | chromium-1194/1200/1208, webkit, firefox |
| `website/` state | `ls website` | **Does not exist** (T001 said "empty dir") |
| Fonts gitignored | `.gitignore` | `website/assets/fonts/` already ignored |
| Four woff2 weights present | `ls .../WOFF/` | Black, Bold, Medium, Regular all present as `.woff2` |
| Reference art shows six | opened `/Users/jacksm5pro/Downloads/image (3).png` | six stickers under `COMPILED OUTPUTS` with dashed arrows |
| README calls the other three Planned | `README.md:243` | "More frameworks (Angular, Vue, Svelte) | Planned" |
| Repo precedent for createRequire tool resolution | `scripts/e2e.mjs:36-38` | resolves `@async/witness/cli` this way |

---

## 9. What would make me reject T004 at review

- Any code sample in the DOM that is not byte-identical to a file under
  `packages/frameworks/*/generated/`.
- A peel whose `aria-valuenow` moves while `[data-peel-flap]` geometry does not.
- Vue, Svelte or Angular presented in a way that a user who never peels would read as
  supported.
- A green contract run where the font assertions were relaxed, or `local()` was added to
  `@font-face`, or the wordmark became an image.
- Variant 1 that scrolls, or whose stickers are not draggable — that is the avara mechanic
  removed, and the owner asked for it by name.
- Foundation delivered without a running Variant 1. Scaffolding is not progress.
