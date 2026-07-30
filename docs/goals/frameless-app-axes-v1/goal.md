# Frameless app axes: recursion, drag, six-lane fan-out, forms — and Hacker News

## What the owner asked for

From the Square UI demo list the owner supplied, plus Hacker News carried over from
`frameless-real-apps-v1`. The owner's words: *"I want #2 but with hacker news too."*

**This board supersedes the open app cards on `frameless-real-apps-v1`** — HN front page, HN
item page, `pnpm demo`, and React emitter greppability — so HN is not split across two boards.
That board's completed receipts (T001, T006, T007) stay as record.

## The method: pick by untested AXIS, never by app

Every app on the previous board earned its place by breaking something; the ones that would
break nothing taught nothing. S10 covered CRUD + in-memory state + filtering. S11 added fetch
with delay, optimistic updates and remote query. S12 added streaming, panes, tabs,
navigation-during-stream and the `textarea` value binding.

**Four axes remain unmeasured**, and each app below is chosen because it is the cleanest probe
of one:

| axis | probe | expectation |
| --- | --- | --- |
| **RECURSION** — the largest remaining *structural* unknown | HN item page, recursive comments | May refuse. Nothing in the corpus is self-referential. |
| **DRAG AND DROP** — the largest remaining *interaction* unknown | Task management (Trello-like) | **Likely refuses**: `onDragStart`/`onDragOver`/`onPointerDown` are all two-word (`DEFECTS.md` 15). |
| **SIX-LANE FAN-OUT** — the first app that could lose **no** lane | Habit tracker | Pure synchronous derived state, no async door. |
| **FORM INPUT TYPES** | Contacts | Only `checkbox` and `textarea` are proven. |

**A refusal is a legitimate result and is worth more than a guess.** An axis that refuses is
recorded verbatim and the app ships narrowed, or goes unbuilt with its message.

## The oracle

Three parts, all required.

1. **EVERY AXIS GETS A VERDICT.** Recursion, drag-and-drop, six-lane fan-out and form input
   types are each measured in **all six lanes** with a witnessed per-lane result — emits /
   refuses-with-verbatim-message / emits-but-misbehaves. **A probe verdict is not a lane
   verdict: re-run each lane's own gate. Five static gates are not a lane verdict either: run
   it in a browser.** Both rules were bought with defects on the last board.
2. **EVERY APP THAT SHIPS IS AUTHORED ONCE, EMITTED SIX WAYS, LOOKS LIKE ITS REFERENCE, AND IS
   FINDABLE.** One `.tsrx` source per app; **no hand-written per-lane app code**, proved by
   **derivation**; a documented **actually-run** command per lane; a visual match to a **named
   reference** recorded on the card *before* the build; and **listed in `pnpm demo`**. A lane
   that cannot be generated is left **unbuilt with its verbatim refusal**, never hand-filled.
3. **NOTHING REGRESSES.** `pnpm test` at **exactly one failure** (the foreign
   `package-inventory` ARM B); `pnpm check` **does not rise** above **267**; `pnpm e2e` stays
   **6 × 9**; `pnpm lint` and `pnpm check:citations` clean.

**Completion proof**: the four axis verdicts stated per lane; for each shipped app, the launch
command that was run, its `pnpm demo` entry, and a visual comparison against its named
reference; and every refusal recorded verbatim. **"Six lanes" means six ATTEMPTED, not six
shipped** — a missing lane *with* a verbatim refusal is a satisfied oracle; a missing lane with
no refusal is a rejection.

## Measured facts this board starts from

- **`pnpm demo` is badly out of date.** It lists **3 of 6 lanes** (react, solid, qwik) and
  **3 of 12 scenarios** (S1–S3). S10 TodoMVC, S11 TodoMVC Advanced and S12 Codex clone are
  **invisible in the front door**, as are svelte, vue and angular entirely.
- **Fetch-on-render is unreachable in every lane** — no lifecycle hook, and `computed(async …)`
  is closed by a pincer upstream of every emitter. **HN's front page cannot load on appear**;
  it seeds in-component exactly as S10 and S11 do.
- **Angular refuses every global identifier** in a transplanted body — `Date`, `Promise`,
  `setTimeout`, `fetch`, `JSON`. **It has no clock.** Any date or relative-time display must
  arrive as a prop, or the lane goes unbuilt for a reason unrelated to the axis being tested.
  **This is the trap that would quietly kill the habit tracker's six-lane claim.**
- **Vue's template-expression global limit** — `@vue/shared`'s `GLOBALS_ALLOWED` omits
  `Promise` and `setTimeout`, and the emitter inlines handlers into template expressions, so it
  emits `new _ctx.Promise(...)`. **Five static gates pass it; only a browser refutes it.**
- **Two-word DOM events are unspellable in every lane.** `build.ts` does
  `name.slice(2).toLowerCase()`. `DEFECTS.md` 15. **This is what makes drag-and-drop the
  interesting card, not the impossible one** — record the refusal.
- **React miscompiles a state write nested in an `if`**, and entry 8's refusal has a hole that
  exact shape, so it is **neither lowered nor refused** (`DEFECTS.md` 8.1). Every conditional in
  an authored handler must be an **expression**; no loop around an `await`.
- **`grep` is blind to the React emitter** — one NUL byte, `exit 1` with **no output at all**,
  so a sweep reports "no matches" when it means "not searched". **T001 owns this**; until it
  lands, use Python for sweeps of that file.
- **Multi-*module* composition is shipped** — `demos/composition-kit/src/page.tsrx` composes
  four `.tsrx` modules. The limit is one component per **module**, which matters for recursion.
- **The next free scenario ordinal is `s13`.** The ordinal slot is **load-bearing**: ten-plus
  per-lane suites derive their `generated/` inventory from `/^s(\d+)-[\w-]+\.json$/` and assert
  it exactly. Adding a golden alone moves the vue gate's derived census.

## The visual references, and the licence that constrains them

**Square UI is NOT MIT.** `zerostaticthemes/square-ui` ships a bespoke *"ln-dev UI License"*
© 2026 lndev — GitHub classifies it `NOASSERTION` — forbidding publication of the templates
**or any derivatives** in any repository. Frameless is public. **The owner ruled
reference-only.**

This costs almost nothing, and the reason is measured: **every class read off the live
reference is a stock Tailwind utility bound to a stock shadcn token**, so their styles *are*
the MIT tokens already vendored at `demos/shared/shadcn-theme/` (MIT © 2023 shadcn, from
`theming.mdx`'s "Default Theme CSS" block — **not** `apps/v4/app/globals.css`, which is the
docs *site's* theme).

**Copy nothing from that repo. Reproduce the measured geometry on the vendored tokens, and
assert every visual feature off the rendered IMAGE, never off the CSS.** T005 on the last board
found a control that was **clickable but not drawn**, and a one-pixel offset a presence check
would have passed. T007 before it found a 3614-pixel heading divergence invisible to every
computed-style check.

Reference URLs, all QA'd live by the PM except where noted:

- Task management — <https://square-ui-task-management.vercel.app/> — **the reference itself has
  no working drag** (the drag selects text), its Filter popover opens but does not filter, and
  "Add task" is inert. We would ship something *more* functional than the original.
- Habit tracker — <https://square-ui-habit-tracker.vercel.app/> — **one click fans out to five
  observable updates**: checkbox, strikethrough, header counter, sidebar badge, progress bar,
  encouragement line.
- Contacts — <https://square-ui-contacts.vercel.app/> — **NOT QA'd by the PM.**
- Hacker News — <https://news.ycombinator.com/> — its own canonical styling.

## Non-negotiable constraints

- **Never test a framework outside its design envelope**, or read that output as a defect.
- **Do not file anything upstream.**
- **The owner's three uncommitted paths** — `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `website/` — are in-flight work. Fingerprint at start and end of every task; never modify.
  Expected `f326d314` / `aeb7edc1` / `f936e169`, 116 files.
  **THE METHOD IS: SORT THE WHOLE `shasum` OUTPUT LINES.**

  ```sh
  shasum -a 256 pnpm-lock.yaml                                   # f326d314…
  shasum -a 256 pnpm-workspace.yaml                              # aeb7edc1…
  find website -type f -print0 | xargs -0 shasum -a 256 | sort | shasum -a 256   # f936e169…
  find website -type f | wc -l                                   # 116
  ```

  **Three wrong readings, all measured.** The **sorted digest column** gives `feddd40b` — note
  *sorted*: **bare** it is nondeterministic (`990e3330` and `d6faf15e` on consecutive runs). Sorting
  by **path** and hashing the lines in that order gives `b1dd182a`. Hashing the sorted **path
  list itself** gives `ff230487` and reads no file content at all. With **no sort** the value is
  not deterministic — `find`'s traversal order alone — so **record no expected value for it**.
  If you change the method, change the expected values in the same edit.
- **Never `pkill -f` on a broad pattern.** A prior task killed one of the owner's long-running
  servers this way and it could not be restored. Kill by recorded PID only, and only PIDs you
  started. **TWO foreign processes are running**: `node` PID **64413** on **5175** and `node` PID **24931**
  on **5178**. Both were left alive. **Do not assume either port is free, and never kill them.**
- **`git diff --exit-code` is blind to untracked additions.** Pair it with `git status --short`.
- **REACT, SOLID AND VUE ANSWER 200 FOR ANY PATH** — they fall through to S1. **A 200 in those
  lanes is not proof a page exists.** Hash the response body and prove it differs per route.
  T001 caught this as a verification that could pass while measuring almost nothing. svelte,
  qwik and angular 404 correctly.
- **No new dependency.** Resolve harness tools out of `node_modules/.pnpm` instead.

## Likely misfire

**Shipping four apps and measuring three axes.** The apps are the instrument, not the product.
If the habit tracker silently takes a date from `Date` and loses angular, the six-lane claim
evaporates and the card taught nothing. If drag-and-drop is quietly replaced with click-to-move
because drag refused, the axis goes unmeasured while the demo looks complete. **Record the
refusal, ship narrowed, and say which axis is missing.**

## What counts as enough

Four axis verdicts, each witnessed per lane. Every app that could ship, shipped from one source
and findable in `pnpm demo`. Every app that could not, recorded verbatim. Baselines unmoved.
