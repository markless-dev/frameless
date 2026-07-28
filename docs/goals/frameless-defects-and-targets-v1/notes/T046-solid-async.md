# T046 — Solid's async refusal was an accident, and the across-await proof is CLEAN

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Dispatched at `f4d2e01`, tree clean, in sync with `origin/main`, **994 tests** —
all three verified here rather than accepted. Spec: T043 receipt and
`notes/T043-async-axis.md` §2.

## 0. Headline

**The `|| fn.async` clause was an accident. All four evidence lines were
re-derived at the repair and all four hold. And the proof T043 could not take
comes back CLEAN: reads and writes lower correctly across the `await`, measured
by *running the emitted handler* against the real solid-js client runtime, three
dispatches, two of them overlapping at the boundary.**

The ruling is **not** inverted. It is strengthened by one thing T043 did not
have: a behavioural measurement rather than an argument from the re-parse
primitive.

## 1. The witnessed RED, verbatim

Before any edit, on the re-specified S8 authoring (`await` on a promise-*valued*
prop — clearing Angular's globals v-limit and Qwik's callback-statement rule,
both of which are correct and both untouched):

```
========== A7 (await promise-valued prop) ==========
build: OK
VALIDATE THREW: EventHandlerRecord event:0 requires a synchronous arrow
EMIT THREW: Error: EventHandlerRecord event:0 requires a synchronous arrow

========== A8 (A7 + preventDefault) ==========
build: OK
VALIDATE THREW: EventHandlerRecord event:0 requires a synchronous arrow
EMIT THREW: Error: EventHandlerRecord event:0 requires a synchronous arrow
```

`buildEnrichedIr` succeeded both times. The refusal is **entirely Solid's**, and
it fires from `validateEnrichedIr` and again from `emit`.

## 2. The four evidence lines, RE-DERIVED — not inherited

The dispatch said to measure, never inherit. I ran each one.

**(1) Provenance — confirmed.**

```
$ git blame -L 1170,1180 -- packages/frameworks/solid/src/emitter/index.ts
1309b00a ... 1174) if (!t.isArrowFunctionExpression(fn) || fn.async)
1309b00a ... 1175)   throw new Error(`EventHandlerRecord ${event.id} requires a synchronous arrow`);

$ git log -1 --format=%s 1309b00
t006: solid emitter + dossier gate (codex killed at ceiling; PM completing)
```

Both lines land in `1309b00`. Note the neighbours: `:1170-1171` and `:1179` are
`a4af414a`, a *later* commit — so this line was **read past** by a subsequent
editing session and left alone.

**(2) Single occurrence, no test, no documentation — confirmed, with a
correction.** Repo-wide, excluding `node_modules` and `.git`, the string
`requires a synchronous arrow` occurs in **exactly one tracked code location**:
`packages/frameworks/solid/src/emitter/index.ts:1175`. Every other hit is prose —
`notes/T031-corpus-s8-async.md` (6), `notes/T043-async-axis.md` (2), and
`state.yaml` (1, in T031's own receipt).

**The correction the dispatch's phrasing invites.** "No documentation" is true of
the *code*, but this string is discussed in three board documents, and T031 §2.1
called it "a designed v-limit" **in writing**. It was documented — as something it
is not. That is worse than undocumented, and it is the mechanism by which an
accident became an impossibility proof. `git log -S` returns three commits: the
landing (`1309b00`), and the two that wrote it up as a limit (`f2d8aaf`,
`439ac30`). **Not one of the three is a decision.**

**(3) It is `:828` with the arity clause dropped — confirmed, and the drop is
itself the tell.**

```ts
:828   if (!t.isArrowFunctionExpression(fn) || fn.async || fn.params.length !== 0)   // computed binding
:1174  if (!t.isArrowFunctionExpression(fn) || fn.async)                             // event handler
```

`.async` appears **three** times in the whole file: `:786` (Solid refuses async
*state constructs* outright — a real, load-bearing rule), `:828`, and `:1174`.
The arity clause had to be dropped because a handler takes an `event` parameter.
Someone adapted the predicate to a new site, removed the clause that was
obviously wrong there, and did not ask the same question of the clause next to
it.

**(4) The pipeline was already async-safe — confirmed by reading the primitive.**
`reanalyzeExpression` (`:161`) builds `const __framelessExpression = <the arrow
itself>` and re-analyzes; it wraps **nothing**, so an async arrow re-parses as
valid module-level source. `normalizeHandler` mutates the arrow in place. And
this is now measured, not argued: after the one-line narrowing the emitted output
carries `async` with **zero** analyzer diagnostics and **zero** emitted bytes
moved anywhere in `generated/`.

**Verdict: ACCIDENT. Four for four.** The evidence does not point anywhere else.

## 3. The repair

`packages/frameworks/solid/src/emitter/index.ts`:

```ts
if (!t.isArrowFunctionExpression(fn))
	throw new Error(`EventHandlerRecord ${event.id} requires an arrow function`);
```

**Deviation, recorded.** The card said narrow the *predicate*; I also changed the
*message*, because `requires a synchronous arrow` would have been actively false
after the narrowing and is the exact string three documents already misread. The
arity clause is deliberately **not** reinstated, and the comment at the site says
why `:828` and `:1174` legitimately differ, so the next reader does not "restore"
the symmetry.

**No v-limit replaces it.** There is nothing to limit.

## 4. The across-await proof — THIS CARD'S DELIVERABLE

T043 §2 said plainly: *"I could not run the async arrow end-to-end through Solid
without editing the validator, and I did not."* Its own flag-flip probe was
self-declared **contaminated**. So none of the below is inherited.

### 4.1 What the emitter now produces

```jsx
onClick={async (event) => {
	event.preventDefault();
	setPhase('pending');
	await props.ready;
	setTicks(ticks() + 1);
	setPhase('done');
	props.onTrace('run', { phase: 'done' }, event);
}}
```

`async` survives. The awaited prop lowers to `props.ready`. Writes on **both**
sides of the boundary lower to setters. The load-bearing detail is
`setTicks(ticks() + 1)`: the read happens **at resume**, from the live signal —
nothing is hoisted above the `await` into a captured const. `analyze()` reports
**0 diagnostics** on the emitted module.

### 4.2 The behavioural measurement

Structural assertions on emitted text are not a proof of behaviour, so the
registered test lifts the `onClick` arrow **back out of the emitted JSX by AST**,
rebuilds it over real `createSignal`s in a scope that mirrors the emitted
component body exactly, and dispatches it **three times**:

1. dispatch A — runs to the `await` and suspends;
2. dispatch B — fires **while A is still suspended**;
3. release the promise, settle both, then dispatch C **sequentially**.

Measured:

```
initial                              ticks=0 phase=idle
after dispatch 1 (pre-await resume)  ticks=0 phase=pending
after dispatch 2 (both suspended)    ticks=0 phase=pending
after both resumed                   ticks=2 phase=done
preventDefault calls: 2
trace: [ 'run:{"phase":"done"}', 'run:{"phase":"done"}' ]
after sequential dispatch 3          ticks=3 phase=done

ACROSS-AWAIT PROOF: PASS
```

`ticks() === 3`, `phase() === 'done'`, `preventDefault()` observed **three**
times, three trace entries. **Reads and writes lower correctly across the await.**

**Why two overlapping dispatches and not one.** T043 §3 predicts React and Solid
diverge on a *second* dispatch across an `await` — render-closure staleness
versus a live signal read — and warns that a single-click assertion passes under
both lowerings. One dispatch here would have proven nothing. Solid's half of that
prediction is now measured, and it comes back **clean**.

### 4.3 Two calibrations, because a green test is evidence only if something
proves it can go red

**Calibration A — the harness discriminates.** The same harness is run against a
hand-written **stale** variant: React's `toConstSsa` shape, with
`const nextTicks = ticks() + 1` hoisted **above** the await. It reports **2**, not
3, and the test asserts exactly that. The instrument can tell a live read from a
captured one, and it is registered saying so.

**Calibration B — the substrate is the one I claim.** This suite runs under
`environment: 'node'`, where solid-js's exports map sends a bare `solid-js` import
to `dist/server.js` — the **SSR** build, whose signals are plain getter/setter
pairs with no ownership, no equality check and no batching. Event handlers never
run there, and a stale-vs-live proof on inert signals would have been **green and
blind**. The test loads `solid-js/dist/solid.js` by resolved path and then
*proves* it did: a `createMemo` recomputed after a `set` returns **10** on the
client build and **2** on the bare specifier. Measured both ways before it was
written in.

### 4.4 The standing tests were watched RED against the old predicate

The §1 witness was taken with a scratch probe, before the tests existed. So after
the repair I **restored `|| fn.async`** and ran the registered suite:

```
× accepts an async handler and keeps `async` and `await` in the output
× reads and writes lower correctly ACROSS the await, measured by running it
× preserves the authored preventDefault at the top of an async body
× the narrowed check still refuses a handler that is not an arrow
  "Error: EventHandlerRecord event:0 requires a synchronous arrow"
Tests  4 failed | 184 passed (188)
```

Four of the five, with the verbatim RED. The fifth — calibration A, the stale
counterfactual — stays green by design: it never touches the emitter, it exists to
prove the harness can distinguish. The predicate was restored immediately and the
suite is 188/188 with `generated/` byte-identical.

## 5. Constraints honoured

- **The nested-write lowering was not touched.** Solid is entry 8's reference
  implementation. The diff to the emitter is one predicate, one message and a
  comment block; `git diff --stat` on `src/` is a single hunk.
- **No fixture and no golden were registered.** The scenario inventories are
  derived from `goldens/s<n>-*.json`, so one golden enlists every lane's gates at
  once. This is a probe source, per the T039 pattern.
- **No emitted byte moved.** `node packages/frameworks/solid/scripts/regenerate.ts`
  followed by `git diff --exit-code -- packages/frameworks/solid/generated` is
  clean. That is also the falsifier for "widening the gate cannot regress the
  shipped corpus", and it is cheap enough that it should stay in every card on
  this axis.
- **No other package moved.** `git diff --exit-code` over `packages/compiler`,
  the five other framework packages, `demos` and `scripts` is clean.
- **`pnpm e2e`, `pnpm test:browser` and `pnpm mutate:corpus` were NOT run.**
- **No v-limit was weakened.** Angular's globals rule and Qwik's
  callback-statement rule are both untouched, and the probe is authored *around*
  both — which is why it is the re-specified S8 authoring and not `await
  Promise.resolve()`.

## 6. What this does NOT establish

- **No served payload.** The proof is at the emitter and in a node harness over
  the real client runtime. No browser has ever run an async Solid handler emitted
  by frameless. That is a corpus card's job — the re-specified S8 — and it is the
  same gap entry 10 carries.
- **The React half of T043 §3's divergence prediction is still unmeasured.** Only
  Solid's half is done, and it is the half predicted clean. T047 owns the other.
- **The S8 scenario is not landed.** This card cleared the second of the three
  blockers (R2). R1 landed at T045; R3 is T047.
- **The Qwik documentary obligation from T043 §4 is untouched** — it rides along
  with a Qwik card, and `packages/frameworks/qwik` is outside `allowed_files`.

## 7. Numbering — the ledger reservation is stale

T043 §7 reserved **entry 10** for this defect and **entry 11** for React's. Entry
10 was taken first by the boolean-attribute repair (T041 ruling, T049 repair). The
card text still says "entry 10"; the dispatch corrected it to **11**, which is
what shipped, and the React `await` defect will be **12**. Entry 11 records the
reservation and its staleness in-line so the next reader is not left reconciling
two numbering schemes.

## 8. Verification

| command | result |
| --- | --- |
| `pnpm --dir packages/frameworks/solid exec vitest run --config vitest.node.config.ts` | 188 passed (was 183) |
| `pnpm test` | **999 passed**, 51 files (was 994 — the five new tests, no other movement) |
| `pnpm check` | clean, all six tsconfigs |
| `pnpm lint` | 0 warnings, 0 errors, 381 files |
| `regenerate.ts` + `git diff --exit-code -- .../solid/generated` | **no bytes moved** |
| `git diff --exit-code` over the other six packages, `demos`, `scripts` | clean |

Baseline re-measured before the edit: **994 passed, 51 files** — the dispatch's
number, confirmed rather than trusted.

## 9. Reproducing this note

Author the §4.1 source as a `.tsrx` probe (a `<form>` wrapper is required — a code
block renders a single node), run `buildEnrichedIr` → `validateEnrichedIr` →
`emit` → `formatEmitted` for Solid, then `analyze()` the emitted string with
`{ lang: 'jsx', sourceType: 'module' }`, walk to the `onClick` `JSXAttribute`, and
`generate()` its expression. Rebuild it with `new Function('createSignal',
'props', ...)` over `solid-js/dist/solid.js` and dispatch as in §4.2. To see the
RED, restore `|| fn.async` at `:1174`. To see calibration A go red, hoist the
increment's read above the `await`. To see calibration B go red, import
`createSignal` from the bare `solid-js` specifier instead.
