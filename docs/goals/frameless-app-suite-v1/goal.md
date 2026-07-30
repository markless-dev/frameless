# Frameless app suite: the data-fetching door, TodoMVC Advanced, and a Codex clone

## What the owner asked for

From a Slack conversation with **Patrick Stapleton**, preserved as plan facts below. The
short version: build the apps frameworks actually get tested with, prove behaviour matches
across all six lanes with witness, and **copy the styles of the real thing** — "find a good
shadcn dashboard template or something… same with chatgpt copy".

## The fork the owner settled

Patrick's list is a **capability roadmap disguised as a demo list**. Measured at prep:

- The authoring surface is exactly `state`, `computed`, `element`, `shared` —
  **zero lifecycle hooks**. No `onMount`, no `effect`.
- **Zero** `computed(async …)` instances exist in the corpus, in any lane.

So data fetching, optimistic updates, remote query and streaming all depend on **one door
nobody has opened**. The owner chose: **probe the door first, then build what it supports,
stopping at each refusal.** An honest capability list is worth more than a demo built on a
guess.

## The oracle

Three parts, all required.

1. **THE DOOR IS MEASURED.** `computed(async …)` is probed in **all six lanes** with a
   witnessed result per lane — emits / refuses-with-verbatim-message / emits-but-misbehaves.
   This lands **before** any app depends on it, and a refusal is a legitimate result.
2. **EVERY APP THAT SHIPS IS AUTHORED ONCE, EMITTED SIX WAYS, AND LOOKS LIKE ITS REFERENCE.**
   One `.tsrx` source per app; **no hand-written per-lane app code**; each lane's site runs
   from a documented, **actually-run** command; and each app visually matches a **named
   reference design** recorded on its card. A lane that cannot be generated is left
   **unbuilt with its verbatim refusal**, never hand-filled.
3. **NOTHING REGRESSES.** `pnpm test` at its baseline of **exactly one failure** (the foreign
   `package-inventory` ARM B); `pnpm check` **does not rise** above **267**; `pnpm e2e` stays
   **6 × 9**; `pnpm lint` and `pnpm check:citations` clean.

**Completion proof**: the six-lane door result; each shipped app emitted from one source into
six lanes with a launch command that was run and a visual match to its named reference; and
every refusal recorded verbatim. **Per §2 a lane may be UNBUILT when it carries a verbatim
refusal** — so "six lanes" means *six attempted*, not *six shipped*. **T002 ruled TodoMVC
Advanced ships in FIVE**; that is a satisfied oracle, not a narrowed one. A missing lane with
no refusal is still a rejection.

## Rulings (measured — these override anything above them)

**T001, the door.** `computed(async …)` is **closed in all six lanes**, by a pincer **upstream
of every emitter**: the Markless compiler demands an `@try`/`@pending`/`@catch` boundary, and
the IR cannot represent `JSXTryExpression`. The surface has a **fourth template control-flow
form** this charter originally missed — `@try`/`@pending`/`@catch`, whose `@pending` *is* the
spinner. **Fetch-on-render is unreachable in every lane.** **Angular is the only lane that does
not verify its own bytes** — its `EMITS` means "did not throw", not "produced valid output".

**T003, what it actually cost.** The ruling said five lanes. **It is four**, and the second
loss was invisible to every static gate. **Vue emits, passes its own gate, `compileScript`,
`tsc` and `pnpm check` — then throws in the browser**: `_ctx.Promise is not a constructor`. The
vue emitter inlines handlers into *template expressions*, and `@vue/shared`'s `GLOBALS_ALLOWED`
carries `Date` and `JSON` but not `Promise` or `setTimeout`. **Five static gates passed a module
only a browser could refute.** Angular refuses at emit, as predicted. Verdict for the async
axes: **four run, one emits-but-misbehaves, one refuses.** And: a probe verdict is not a lane
verdict — T001's per-lane results were `emit()`-only, which is how "solid EMITS P9" survived
until the Solid gate refused it.

**T002, what that means.** "Streaming and optimistic updates emit in all six lanes" is true of
the **lowering** and false of the **source**: P8 measured one host-made promise awaited N
times. A **new promise per user action** has an **empty six-lane intersection** — qwik cannot
consume a callback prop's return value in any statement form, and angular cannot **name** a
global to make its own. The binding constraint is **one promise per render, or lose a lane**.

## Known blockers, all measured, that this goal will hit

- **NO LIFECYCLE**, and **the door is now MEASURED — see §Rulings.** `computed(async …)` is
  **closed in all six lanes**.
- **`.svelte` and `.vue` refuse multi-component modules by name.** One component per module —
  but **T002 ruled this is not limiting**: multi-*module* composition is shipped and
  e2e-proven at `demos/composition-kit/src/page.tsrx`, which composes four `.tsrx` modules.
- **TWO-WORD DOM EVENTS ARE UNSPELLABLE IN EVERY LANE.** `build.ts` does
  `name.slice(2).toLowerCase()`, so `onKeyDown` and `onDoubleClick` cannot be produced —
  and React's double-click name is `onDoubleClick`, which no capitalisation over `dblclick`
  can reach. `onKeydown` and `onDblclick` **never fire**. `DEFECTS.md` entry 15. **This will
  hit the Codex clone hard** — keyboard shortcuts, tab navigation, pane focus.
- **REACT MISCOMPILES A STATE WRITE NESTED IN AN `if`** — and entry 8's shipped refusal has a
  hole exactly that shape, so it is **neither lowered nor refused** (`DEFECTS.md` 8.1).
  Every conditional in an authored handler must be an **expression**.
- **No routing construct exists in `.tsrx`**, though all six demos already route at the host.
- **`grep` is blind to the React emitter** — one NUL byte, `exit 1` with no output. T008 on
  the sibling board owns it; until then, use Python for sweeps of that file.

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

  **Two wrong readings, both measured at HEAD, both of which have already fired on this
  board.** Sorting the **bare digest column** (`| awk '{print $1}' | sort |`) gives
  **`feddd40b`** — T004 hit this one. Sorting the **paths** and hashing the lines in that
  order gives **`b1dd182a`** — T005 hit this one. With **no sort** the value is not
  deterministic: two consecutive runs at HEAD gave `599f32e1` and `1314b5fb`, and the cause
  is `find`'s traversal order alone — both runs produced the same 116 digests, differing
  only in line order, so **do not record an expected value for the unsorted reading.**

  *"Sort the paths" is worth spelling out, because it names two different operations and
  only one of them is a fingerprint: sorting by path and hashing the resulting `shasum`
  **lines** gives `b1dd182a`, while hashing the sorted **path list itself** gives
  `ff230487` and reads no file content at all.*

  *This paragraph used to instruct the bare-digest-column reading — the refuted wording is
  preserved verbatim in `notes/T999-final-audit.md` §3 and on T007's card, and is not
  repeated here so that no successor can grep it back into use. It returns `feddd40b` and
  therefore **could not produce the expected value printed alongside it**. It fired twice,
  on T005 and T004, before T999 caught it. If you change the method, change the expected
  values in the same edit.*
- **Never `pkill -f` on a broad pattern.** A prior task killed one of the owner's long-running
  servers that way. Kill by recorded PID only, and only PIDs you started.

## Likely misfire

**Building the apps on an unmeasured door.** Streaming, optimistic updates and remote query
all reduce to "can a component fetch". If the answer is no, four apps' worth of authoring
gets written against a shape that cannot exist. **That is why the probe is Phase A and not a
footnote.**

The second misfire is **hand-writing the lanes** — the fastest route to six impressive demos,
and it proves nothing. The third is **shipping unstyled**: TodoMVC's first pass emitted
correct markup with no stylesheet, and three of the five visual features were missing. **The
visual reference belongs on the card before the app is built, not after.**

## Tranche

Probe the async door in six lanes and rule what it supports. Then ship **TodoMVC Advanced**
(fetch, optimistic updates, artificial delay, local filtering *and* remote query), styled to
a named reference. Then attempt the **Codex clone** (streaming, sidebar, chat thread, right
and bottom detail panes with tabs, navigation during streaming). **Stop at each refusal and
record it.** The dashboard and Twitter are recorded as candidates, not scope — Patrick's own
reading is that the Codex clone subsumes Twitter's infinite scroll and CRUD.
