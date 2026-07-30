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
every refusal recorded verbatim.

## Known blockers, all measured, that this goal will hit

- **NO LIFECYCLE.** The only data-fetching door is `computed(async …)`, unmeasured everywhere.
- **TWO-WORD DOM EVENTS ARE UNSPELLABLE IN EVERY LANE.** `build.ts` does
  `name.slice(2).toLowerCase()`, so `onKeyDown` and `onDoubleClick` cannot be produced —
  and React's double-click name is `onDoubleClick`, which no capitalisation over `dblclick`
  can reach. `onKeydown` and `onDblclick` **never fire**. `DEFECTS.md` entry 15. **This will
  hit the Codex clone hard** — keyboard shortcuts, tab navigation, pane focus.
- **REACT MISCOMPILES A STATE WRITE NESTED IN AN `if`** — and entry 8's shipped refusal has a
  hole exactly that shape, so it is **neither lowered nor refused** (`DEFECTS.md` 8.1).
  Every conditional in an authored handler must be an **expression**.
- **`.svelte` and `.vue` refuse multi-component modules by name.** One component per module.
- **No routing construct exists in `.tsrx`**, though all six demos already route at the host.
- **`grep` is blind to the React emitter** — one NUL byte, `exit 1` with no output. T008 on
  the sibling board owns it; until then, use Python for sweeps of that file.

## Non-negotiable constraints

- **Never test a framework outside its design envelope**, or read that output as a defect.
- **Do not file anything upstream.**
- **The owner's three uncommitted paths** — `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `website/` — are in-flight work. Fingerprint at start and end of every task; never modify.
  **Sort the digests, not the paths.** Expected `f326d314` / `aeb7edc1` / `f936e169`,
  116 files.
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
