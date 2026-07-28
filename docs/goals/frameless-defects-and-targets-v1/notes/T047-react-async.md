# T047 — React's `await` now survives, and the staleness question resolves **REAL**

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Dispatched at `f822cf8`, tree clean, in sync with `origin/main`, **999 tests** —
all three verified here rather than accepted (`git status --porcelain` empty,
`git rev-parse HEAD origin/main` both `f822cf8...`). Spec: T043 receipt and
`notes/T043-async-axis.md` §3; sibling `notes/T046-solid-async.md` is the harness
model.

## 0. Headline

**The one-boolean repair works and the corpus does not move. And the measurement
T043 could not take comes back DIRTY — the staleness is REAL, and a SECOND defect
rides with it that nobody predicted.**

```
                       react (emitted)   solid (T046, measured)
  while both suspended      0|idle             0|pending
  after the overlap         1|done             2|done
  after the third click     2|done             3|done
```

T043's divergence prediction **holds**. `docs/DEFECTS.md` entry 12 is filed
**OPEN**, carrying both halves. Per the card's stop_if I recorded it and stopped
there: **no lowering change was attempted**, and `assertLowerableWrites` was not
touched.

## 1. The witnessed RED, verbatim — before any edit

```
========== A7 (await promise-valued prop) ==========
build: OK
validate: OK
EMIT THREW: yuku-analyzer rejected emitted handler: 'await' is reserved in an
async/module context and cannot be used as an identifier; Expected a semicolon or
an implicit semicolon after a statement, but found 'ready'
    at reanalyzeFunction   (react/src/emitter/index.ts:150:9)
    at replaceFreeNames    (react/src/emitter/index.ts:167:2)
    at replaceVersionReads (react/src/emitter/index.ts:1951:2)
    at toConstSsa          (react/src/emitter/index.ts:2050:3)
    at emitSingleHandler   (react/src/emitter/index.ts:2227:13)

========== A8 (A7 + preventDefault) ==========
build: OK
validate: OK
EMIT THREW: <identical>
```

**One correction to the dispatch's framing, worth carrying.** T046's Solid RED
fired from `validateEnrichedIr` **and** `emit`. React's fires from `emit`
**only** — `validateEnrichedIr` returns cleanly. React never had a rule against
async handlers; it had a scratch arrow that could not re-parse one. Same axis,
genuinely different mechanism, and the entry says so.

**T043 §3's wrapper replication, re-derived rather than inherited**, against the
same `yuku-analyzer` the emitter uses (`analyze(src, { lang: 'jsx', sourceType:
'module', preserveParens: false })`):

```
wrapper async=false: diagnostics=2  unresolved=[]
    - 'await' is reserved in an async/module context and cannot be used as an identifier
    - Expected a semicolon or an implicit semicolon after a statement, but found 'ready'
wrapper async=true:  diagnostics=0  unresolved=[phase,ready]
```

Reproduced exactly, both numbers and both lists.

## 2. The repair

`packages/frameworks/react/src/emitter/index.ts`, one assignment in
`replaceFreeNames`:

```ts
const fn = t.arrowFunctionExpression(
	[],
	statement ? t.blockStatement([t.cloneNode(node, true)]) : t.cloneNode(node, true),
);
fn.async = true;
```

**Deviation, recorded.** T043 wrote the repair as
`t.arrowFunctionExpression([], body, /* async */ true)`. That signature does not
exist: `src/emitter/estree.ts:61` takes `(params, body)` and hardcodes
`async: false`, and **`estree.ts` is outside this card's `allowed_files`**. Setting
the flag at the call site is also the better change on its own merits — this is
the only arrow that helper builds that is **thrown away**; every other one is real
output whose `async` must stay `false`. A comment at the site says exactly that,
so the next reader does not "tidy" it into the constructor.

## 3. Why it cannot regress the corpus, and the falsifier that was run

`reanalyzeFunction` analyzes under `sourceType: 'module'`, where `await` is
**already** reserved as an identifier — so no body that parses today parses
differently under an async wrapper. Falsified rather than argued:
`node packages/frameworks/react/scripts/regenerate.ts` followed by
`git diff --exit-code -- packages/frameworks/react/generated` is **clean**, and a
registered test asserts directly that a synchronous handler still emits
`onClick={(event) => {` with no `async` anywhere in the output.

## 4. THE MEASUREMENT — real `react-dom`, not an inference from `toConstSsa`

### 4.1 What the emitter now produces

```jsx
onClick={async (event) => {
	await ready;
	const nextTicks = ticks + 1;
	setTicks(nextTicks);
	const nextPhase = 'done';
	setPhase(nextPhase);
	onTrace('run', { phase: 'done' }, event);
}}
```

Two things are visible in that text before anything is run, and **both were
confirmed behaviourally rather than read off**:

- `const nextTicks = ticks + 1` reads the **render-closure** `useState` binding.
- **`phase = 'pending'` is not there at all.** T043 predicted (a) and said nothing
  about (b); (b) is `toConstSsa`'s "retain only the final sync per cell" rule
  (T002 rulings 4 and 5), which is sound when nothing can render between the two
  writes and is **not** sound across an `await`.

### 4.2 The behavioural measurement

The registered test lifts the `onClick` arrow back out of the emitted JSX **by
AST**, rebuilds the emitted component body exactly — same prop destructuring, same
two `useState` calls in the same order — renders it with `react-dom/client`, and
dispatches:

1. dispatch A — runs to the `await` and suspends;
2. dispatch B — fires **while A is still suspended**, from the same closure, which
   is what a real double click gets because React has not re-rendered;
3. release, settle both, then dispatch C from the **newest render's** closure,
   which is what a real third click gets after React reattached.

Measured:

```
initial                              0|idle
while both suspended                 0|idle      <- solid: 0|pending
after the overlap resolved           1|done      <- solid: 2|done
after the third, sequential click    2|done      <- solid: 3|done
trace                                3 entries
preventDefault (A8)                  3
renders                              3           <- live shape: 4
```

**Two clicks, one increment.** And `pending` is never rendered — not late, not
briefly: never, because it is not in the output.

### 4.3 Two calibrations

**Calibration A — the harness can report the clean numbers.** The same harness,
the same dispatch sequence, over a hand-written live-reading handler (React's own
idiomatic answer, `setTicks((current) => current + 1)`, with the pre-await write
left in) reports **exactly Solid's row**: `0|pending`, 2, 3. So the numbers above
belong to the emitted code and not to the instrument. This is the mirror image of
T046's calibration, which ran the *stale* shape through the *Solid* harness and
got 2 — the two lanes' instruments now cross-check each other.

**Calibration B — the substrate can fail.** T046 found that a bare `solid-js`
import under `environment: 'node'` loads the inert SSR build, which would have made
its whole proof a green vacuum, and the card told me to check the equivalent for
`react-dom`. I did, and the equivalent problem is bigger: **there is no DOM at
all** in this suite, and no DOM implementation is a declared dependency anywhere in
the workspace (jsdom exists in the pnpm store only as an undeclared transitive of
another package's vitest, and the crew sandbox cannot install). `react-dom/server`
was not an option because it never re-renders — and re-rendering is the entire
mechanism under test.

So the test installs a **minimal hand-rolled DOM**, ~100 lines, used only to let
`react-dom/client` reconcile and commit. React's event system is never used; the
handler is called directly, exactly as the Solid proof does. Nothing re-implements
a hook or a scheduler. And a module-level guard **proves the runtime commits**:
it renders a counter, drives it once through a **captured** closure and once
through a **fresh** one, and requires `0,1,1,2`. If the shim ever stopped carrying
real commits, every measurement below would report the initial state forever and
the file would be green and blind; instead it throws at load with a message saying
so.

That guard is also the tightest possible demonstration that the mechanism under
test is real: **the same runtime, on hand-written code, shows a captured closure
failing to advance and a fresh one advancing.**

### 4.4 The standing tests were watched RED against the unrepaired emitter

The §1 witness was taken with a scratch probe before the tests existed, so after
writing them I removed `fn.async = true` and ran the registered suite:

```
× accepts an async handler and keeps `async` and `await` in the output
× MEASURED, OPEN DEFECT: a second dispatch across the await reads a STALE closure
× preserves the authored preventDefault at the top of an async body
  Error: yuku-analyzer rejected emitted handler: 'await' is reserved in an
  async/module context and cannot be used as an identifier; Expected a semicolon
  or an implicit semicolon after a statement, but found 'ready'
Tests  3 failed | 182 passed (185)
```

Three of the five, with the verbatim RED. The other two stay green **by design**
and it is worth saying which and why: calibration A never touches the emitter — it
exists to prove the harness can produce 3 — and the synchronous-leak test asserts
the *absence* of `async`, which the unrepaired emitter trivially satisfies. The
flag was restored immediately; 185/185, `generated/` byte-identical.

## 5. The stop_if, and what I did not do

The card's stop_if reads: *"The staleness question resolves as REAL. Record it
verbatim in entry 12 and STOP."* **It fired.** What I stopped short of:

- **No lowering change.** Reading live (a functional updater, or hoisting nothing
  above the boundary) and un-collapsing writes across a suspension point are both
  design changes to `toConstSsa`, and both are exactly what T043 handed to
  `frameless-emitter-capability-v1`. Not attempted.
- **`assertLowerableWrites` untouched.** Entry 8 stays OPEN with its lift trigger.
  Every write in this probe is at the **top level** of the handler body, so entry 8
  never fired here and entry 12.2 is a genuinely separate lowering defect. The
  overlap is only that both are answered by porting what five other emitters do.
- **No fixture, no golden.** Probe source, per the T039/T046 pattern — the
  inventories are derived from `goldens/s<n>-*.json`, so one golden enlists every
  lane's gates at once.
- **`pnpm e2e`, `pnpm test:browser`, `pnpm mutate:corpus` were NOT run.**
- **No v-limit weakened.** Angular's globals rule and Qwik's callback-statement
  rule are untouched; the probe is authored *around* both, which is why it is the
  re-specified S8 authoring and not `await Promise.resolve()`.
- **No file outside `allowed_files` was edited** — including `estree.ts`, which
  the ruling's literal repair would have required (§2).

## 6. What this means for S8 — T028 and the corpus card must read this

**S8's React row is `1|done` / `2|done`, and the two-dispatch contract is now a
measured requirement rather than a precaution.** A single-dispatch assertion
passes under both lowerings and asserts nothing about the axis it exists to test.
S8 must **assert the divergence**, naming entry 12.2, so that the day React's
lowering is repaired the scenario goes red and is updated deliberately.

On T043 §6's objective trigger: R1 (T045), R2 (T046) and R3 (this card) have all
landed **with witnessed RED calibrations**, which is the condition as written. But
the trigger's second branch also names *"turns out to require a design change
rather than the repair specified here"*, and the honest reading is that **the
repair specified here landed in full while the axis it unblocks turned out to
carry a defect the ruling had only predicted**. That is a judgement for T028 and
the PM, not for this card, and I am not making it. What T028 needs is on the table:
the syntax half is closed, the behavioural half is open, measured, and pinned by
tests that will report either way.

## 7. Verification

| command | result |
| --- | --- |
| `pnpm --dir packages/frameworks/react exec vitest run --config vitest.node.config.ts` | 185 passed (was 180) |
| `pnpm test` | 1004 passed (was 999 — the five new tests, no other movement) |
| `pnpm check` | clean, all six tsconfigs |
| `pnpm lint` | 0 warnings, 0 errors |
| `regenerate.ts` + `git diff --exit-code -- .../react/generated` | **no bytes moved** |
| `git diff --exit-code` over the other six packages, `demos`, `scripts` | clean |

## 8. Reproducing this note

Author the §4.1 source as a `.tsrx` probe (a `<form>` wrapper is required — a code
block renders a single node), run `buildEnrichedIr` → `validateEnrichedIr` →
`emit` → `formatEmitted` for React. To see the RED, remove `fn.async = true` from
`replaceFreeNames`. To see the wrapper measurement, call `analyze()` on
`const __framelessHandler = () => { phase = await ready; };` with and without
`async` and compare **both** `diagnostics` and `unresolvedReferences`. To see
calibration A go red, replace the functional updater with `setTicks(ticks + 1)`.
To see calibration B go red, make `DomNode.appendChild` a no-op.
