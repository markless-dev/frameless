# T031 — S8 async event handlers: BLOCKED, and the axis refuted the corpus rather than the corpus refuting the axis

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Dispatched at `4566540`, 968 tests, tree clean and still clean at the end of this
card. Follows the pattern T034, T026, T027 and T030 established; ruling is
`notes/T024-corpus-breadth.md` §3, §5.

## 0. Headline

**S8 DID NOT LAND. Nothing was written to the corpus, and that is the card's own
stop_if firing, not a shortfall.** `stop_if` says *"S8 lands in fewer than SIX
lanes"*, and the measurement below is that **S8 cannot land in six lanes on
today's emitters — by any authoring at all.**

**The card predicted the terminal finding would be a Qwik `sync$` throw. Qwik is
the only lane of six that gets this axis completely right.** It emitted the
`sync$` array form for an `event.preventDefault()` sitting at the top of an
**authored `async`** handler, on the first try, with no throw. Defect 1's repair
generalizes (§3).

**Four of the six emitters cannot express an async event handler, and they fail
in four different ways** (§2). Two are v-limits being enforced loudly. **Two are
silent miscompilations that produce output no one refused**:

| lane | authored `async` / `await` | deferred continuation (`f().then(cb)`) |
| --- | --- | --- |
| react | **THROWS** — internal re-parse crash, misleading message | **SILENTLY EMITS BROKEN CODE** — `TS2588` × 2 |
| solid | **THROWS** — designed v-limit, `requires a synchronous arrow` | OK |
| qwik | **OK**, including the `sync$` split | **THROWS** — designed v-limit |
| svelte | OK | OK |
| vue | OK | OK |
| angular | **SILENTLY EMITS INVALID TS** — `TS1308`; or silently DROPS `async` | OK |

**The impossibility is a two-line proof, not a survey** (§4). An asynchronous
boundary inside a handler is either (a) `async`/`await`, or (b) a continuation
function. **Solid refuses every `async` arrow. React miscompiles every write
inside a nested function.** There is no third way to defer a state write in
JavaScript, so the two lanes between them exclude the entire space.

**The compiler is not the problem and is exonerated by measurement.** The S8 IR
carries **ZERO zero-read sites, 0 of 14**, is capability-free, lowers all three
authored `async` arrows with `async: true` intact, and derives the
`preventDefault` `SyncPolicy` correctly **out of an async handler** (§1). Every
failure below is in an emitter.

**These are OUR emitters, not the frameworks.** React, Solid and Angular all
support async event handlers natively; a stock scaffold in any of them does this
without complaint. Nothing here is an upstream defect and nothing here should be
reported upstream.

**The tree is exactly as dispatched.** 968 tests green, `git status --porcelain`
empty, HEAD still `4566540`. No fixture, no golden, no `generated/`, no demo
route, no contract edit, no budget row — because a golden alone would have turned
every derived inventory in four lanes red (§5).

---

## 1. The compiler handles S8 perfectly — measured, not assumed

The instrument is a generic walker written for this card that **enumerates no
node kinds at all**: it visits every object in the IR, records the KEY PATH at
which each `reads` array sits, and classifies a site from that path. Run over the
canonical S8 authoring (§2.1):

```
all `reads` arrays: 27  empty: 9
DOM/dynamic sites: 14
ZERO-READ DOM SITES: 0  []
empty non-DOM: components.0.locals.{0,1,2,4}
               records.bindings.{1,2,3,5,6}
components=1  imports=0  module.exports=1
elementHandleBindings=0  handleForwards=0  behaviors=0  handleCalls=0
events: 3   async handlers: 3
syncPolicies: [null,
               {"when":{"type":"constant-truthy","value":true},"actions":["preventDefault"]},
               null]
```

Four state declarations initialised from literals plus the props root, exactly
S5's, S6's and S7's class. **Zero zero-read DOM sites.** Every capability-guard
input is zero, so S8 is capability-free by measurement and T024's ruling holds
for it.

Three things are worth naming because they are the *positive* result of this
card:

1. `handler.expression.async === true` survives into the IR intact, with the
   `AwaitExpression` in the body.
2. `handler.reads` / `handler.writes` are correct **across** the await — the
   post-await `ticks = ticks + 1` is recorded as both a read and a write of
   `state:ticks`.
3. **The `preventDefault` `SyncPolicy` is derived out of an ASYNC handler**, with
   the same `constant-truthy` shape S3's synchronous cancel produces. The
   compiler did not need to be told about async at all.

So the corpus's front half is ready for S8 today. The back half is not.

## 2. The four-authoring × six-lane matrix, verbatim

Four authorings were emitted through all six real emitters (`emit()` +
`formatEmitted()`, the exact call the `regenerate` scripts make). Every message
below is copied out of the thrown `Error`.

### 2.1 A1 — the canonical authoring: `async` + `await Promise.resolve()`

Three async handlers: one writing state either side of the boundary, one whose
body opens with `event.preventDefault()` on a `type="submit"` button (Defect 1's
exact shape), one appending to a keyed collection after the boundary.

```
react    THREW: yuku-analyzer rejected emitted handler: 'await' is reserved in an
         async/module context and cannot be used as an identifier; Expected a
         semicolon or an implicit semicolon after a statement, but found 'Promise'
solid    THREW: EventHandlerRecord event:0 requires a synchronous arrow
qwik     OK
svelte   OK
vue      OK
angular  THREW: Angular emitter cannot resolve the identifier "Promise" in a
         transplanted body: it is neither a body-local binding, a function
         parameter, a @for variable, nor a declared component member (cancelled,
         depth, onTrace, phase, rows, seed, ticks, trail). The emitter throws
         rather than guessing whether it is a global
```

Angular's is a **correct, documented refusal**
(`packages/frameworks/angular/src/emitter/index.ts:244`: *"THERE IS NO GLOBALS
ALLOWLIST, deliberately"*). It is not the Angular finding; §2.3 is.

### 2.2 A2 — `async` + `await onTrace(...)`, i.e. no free global

Written specifically to get past Angular's globals v-limit by making the awaited
expression a declared component member.

```
react    THREW (same re-parse crash)
solid    THREW: EventHandlerRecord event:0 requires a synchronous arrow
qwik     THREW: Qwik v1 callbacks must be observational expression statements in event:0
svelte   OK
vue      OK
angular  NO THROW — AND THE OUTPUT IS INVALID TYPESCRIPT
```

Angular emitted, verbatim:

```ts
	onH3Click(event: any): void {
		this.phase = 'pending';
		await this.onTrace('run', { phase: 'pending' }, event);
		this.ticks = this.ticks + 1;
		this.phase = 'done';
	}
```

`await` in a method that is not `async`. Typechecked with this repo's own
`typescript@5.9.3`:

```
angular-await.ts(25,3): error TS1308: 'await' expressions are only allowed within
async functions and at the top levels of modules.
```

Qwik's refusal is also a designed constraint —
`packages/frameworks/qwik/src/emitter/index.ts:936`. A statement containing a
callback-prop call must BE that call; `await onTrace(...)` is an
`AwaitExpression`, so it is refused. Note the irony: Qwik's own lowering emits
`await props.onTrace$(...)` for that statement itself. Awaiting a callback prop
is a thing the Qwik emitter *does* and a thing it will not *accept*.

### 2.3 A3 — `async` with NO `await` anywhere

The narrowest possible probe: does a lane preserve the `async` keyword?

```
react    OK   — emits `onClick={async (event) => {`
solid    THREW: EventHandlerRecord event:0 requires a synchronous arrow
qwik     OK
svelte   OK
vue      OK
angular  NO THROW — AND THE `async` IS SILENTLY GONE: `onH3Click(event: any): void {`
```

**This is the most serious single finding on this card.** The Angular output
compiles clean — the scratch typecheck reports nothing but the expected
"cannot find module '@angular/core'". An authored `async` handler became a
synchronous method, its return value stopped being a promise, and **no
instrument in this repo would have gone red.** `pnpm check`, `pnpm lint` and the
emitted-typecheck gate all pass on it.

The mechanism is not subtle: **the string `async` does not occur even once in
`packages/frameworks/angular/src/emitter/index.ts`.** The emitter has no concept
of an async handler, so `qualify()` transplants the body into a class method and
the modifier is dropped on the floor.

### 2.4 A4 — no `async` at all: a deferred continuation, `settle().then(cb)`

The only remaining shape. A prop returning a promise, so there is no free global
for Angular to refuse and no `async` for Solid to refuse.

```
react    NO THROW — AND THE OUTPUT IS BROKEN
solid    OK   — and it lowers the nested writes CORRECTLY: `setTicks(ticks() + 1)`
qwik     THREW: Qwik v1 callbacks must be observational expression statements in event:0
svelte   OK
vue      OK
angular  OK
```

React emitted, verbatim:

```jsx
				onClick={(event) => {
					const nextPhase = 'pending';
					setPhase(nextPhase);
					settle().then(() => {
						ticks = ticks + 1;
						nextPhase = 'done';
					});
					onTrace('run', { phase: 'pending' }, event);
				}}
```

Typechecked with this repo's own `typescript@5.9.3`:

```
react-then.jsx(20,7): error TS2588: Cannot assign to 'ticks' because it is a constant.
react-then.jsx(21,7): error TS2588: Cannot assign to 'nextPhase' because it is a constant.
```

Two independent defects in five lines, and the second is the nastier one:

- `ticks = ticks + 1` was **never lowered at all**. `emitMutableHandler` iterates
  `fn.body.body` — `packages/frameworks/react/src/emitter/index.ts:1775`,
  `for (const statement of fn.body.body)` — so **only top-level statements are
  candidates for write lowering**. A write inside any nested function is copied
  through verbatim, where it becomes an assignment to the `const` that `useState`
  destructured.
- `nextPhase = 'done'` is worse. `toConstSsa` → `replaceVersionReads` →
  `replaceFreeNames` (`:1832`, `:161`) rewrote the nested **write target** as if
  it were a version **read**, renaming `phase` to `nextPhase` — and then froze
  `nextPhase` with `const`. The emitter manufactured the assignment it cannot
  execute.

Reproduced with a second, unrelated nesting (`defer(() => { ticks = ticks + 1 })`,
a plain callback prop rather than `.then`) to confirm the defect is about
**nesting**, not about promises: identical raw `ticks = ticks + 1` in the output.

**Qwik, by contrast, lowers nested writes correctly** — the same `defer` probe
gave `ticks.value = ticks.value + 1` inside the nested arrow, and A4's failure in
Qwik is the callback-statement v-limit, nothing to do with nesting.

## 3. THE GOOD RESULT: Qwik, alone of six, gets this axis right

The card's hardest stop condition was a Qwik `sync$` throw. It did not happen.
Given A1's `type="submit"` button whose **authored `async`** handler opens with
`event.preventDefault()`, Qwik emitted, verbatim:

```jsx
			<button
				type="submit"
				data-action="cancel"
				onClick$={[
					sync$((event) => {
						event.preventDefault();
					}),
					$(async (event) => {
						cancelled.value = 'sync';
						await Promise.resolve();
						cancelled.value = 'resumed';
						await props.onTrace$('cancel', { cancelled: 'resumed' }, event);
					}),
				]}
			>
```

That is Defect 1's repair, generalised from the one synchronous site it was
proven at to an authored async handler, with the `sync$` body still closure-free
by construction. The emitter's own comment
(`packages/frameworks/qwik/src/emitter/index.ts:511-517`) turns out to have been
right for a reason it had not yet been tested on: *"That handler is fully
SYNCHRONOUS: the cause is QRL laziness, not `async`, which is why neither this
lowering nor the gate policy guarding it looks at `async`."* Because the lowering
never looked at `async`, it did the right thing the first time it met one.

Qwik also handled the post-await store write (`rows.splice(0, rows.length, ...)`)
and the post-await signal writes without a hint.

## 4. WHY SIX LANES IS IMPOSSIBLE — the argument, not the survey

Four authorings is evidence; this is the proof, and it is why no fifth authoring
was tried.

An event handler whose observable effect lands **after** an asynchronous boundary
must express that boundary in one of exactly two ways:

- **(a) `async` / `await`.** `packages/frameworks/solid/src/emitter/index.ts:1174`
  reads `if (!t.isArrowFunctionExpression(fn) || fn.async) throw`. The check is on
  the flag itself, inside `validateEnrichedIr`. **Every** async arrow is refused,
  whatever its body. There is no async authoring Solid accepts.
- **(b) a continuation function** — `.then(cb)`, a callback prop, a scheduler,
  anything. The state write then lives inside a nested function, and
  `packages/frameworks/react/src/emitter/index.ts:1775` only lowers top-level
  statements. **Every** nested write is emitted as an assignment to a `const`.
  There is no continuation authoring React emits correctly.

There is no third way to defer a state write in JavaScript. Solid excludes (a),
React excludes (b), so the intersection is empty and **S8 has no six-lane
spelling today**. Qwik and Angular narrow it further from the other side, but
they are not needed for the conclusion.

This is also why no A5 was attempted with a cleverer promise source. The
constraint is not about *where the promise comes from*; a promise source that
satisfied Angular's globals rule and Qwik's callback rule simultaneously would
still hit Solid on (a) and React on (b).

## 5. Why NOTHING was written, and why that is the safe choice

The obvious partial landing — commit the fixture and the golden, land the four
lanes that work, leave two red — is the **broken-matrix case**, and it is worse
here than it looks:

T035/T036 made every corpus inventory **derived from `goldens/s<n>-*.json`**.
Dropping `s8-async-handlers.json` into that directory is enough, on its own, to
enlist S8 into every lane's gate test, emitter test, parse-emitted test,
type-check test, both `size.test.ts` budget tables and the compiler's own
sufficiency loops — **in all six lanes, with no other edit**. That derivation is
a feature and it worked perfectly for S5, S6 and S7. Here it means the golden
alone turns four lanes red and leaves `pnpm test` broken for whoever touches this
tree next.

Phase F's stopping rule requires a scenario to land in all six. So:

- No `packages/compiler/test/fixtures/s8-async-handlers.tsrx`.
- No `packages/compiler/test/goldens/s8-async-handlers.json`.
- No `FIXTURES` / `EXPECTED_HOSTS` entry.
- No `generated/S8.*` in any lane, no `regenerate.ts` edit.
- No `/s8` route, no `AsyncBoard` in any demo, no `scenarios.box.ts` edit.
- No `three-way-contract.ts` edit — `'s8'`, `assertS8` and `resumeSymbols.s8` do
  not exist.
- No `scripts/e2e.mjs` edit, no `MUTANTS` rows, no `SCENARIO_FILES` entry.
- No S8 row in either `size.test.ts`.

`pnpm test` is **968 passed / 50 files**, `git status --porcelain` is empty and
HEAD is `4566540` — the tree is byte-identical to how this card received it.

**The two harness commands are reported `blocked` regardless**, per the card's
own stop_if: `pnpm mutate:corpus` restores with `git checkout --` over
`MUTATION_SURFACE` and is not safe without a sole writer. There is additionally
nothing for it to mutate, since no S8 mutant exists.

```
pnpm mutate:corpus --scenario s8      # nothing to run: S8 does not exist
pnpm mutate:corpus --scenario s1 ... --scenario s7
```

## 6. What the PM has to decide, with the cost of each option

This is a **product/architecture decision about the emitters**, which this card's
`allowed_files` deliberately does not reach — it carries no emitter and no gate.
Ranked by what each buys:

1. **Angular loses `async` silently (§2.3) — fix this first regardless of S8.**
   It is the only finding here that corrupts *without any diagnostic anywhere*,
   and it is live today for any future fixture, not just S8. The emitter needs to
   carry the arrow's `async` onto the class method. Small, local, and it turns a
   silent semantic downgrade into correct output.
2. **React's nested-write hole (§2.4) is a correctness hole with a live blast
   radius wider than S8.** Any handler that writes state inside any nested
   function — a `.then`, a callback prop, an array method with a side effect —
   emits an assignment to a `const`. The corpus has never had one, which is
   exactly why nobody has seen it. At minimum the emitter should **throw** on a
   write it cannot lower, the way Angular throws on an identifier it cannot
   resolve. Refusing loudly is a one-line change; lowering nested writes properly
   is not.
3. **React's `await` re-parse crash (§2.1/§2.2)** is narrower: `replaceFreeNames`
   (`:161`) wraps a statement in a **synchronous** arrow before re-parsing it, so
   any statement containing `await` fails to parse. Making that wrapper `async`
   is a plausible one-line fix, but it should not be made without deciding (2)
   first — an async React handler that then miscompiles its nested writes is a
   worse place to stand than a loud refusal.
4. **Solid's `requires a synchronous arrow` (§2.1) is a v-limit and was left
   alone.** It is a bare `throw` inside `validateEnrichedIr` with **no dossier
   reference, no test and no documentation anywhere in the repo** — grep finds the
   string exactly once, at the throw site. Solid itself has no problem with async
   listeners, so this is an emitter-authoring decision that was never written
   down. It needs a ruling either way; today it is the single hardest blocker on
   this axis.
5. **Qwik's callback-statement rule (§2.2/§2.4)** is a designed, commented
   constraint and looks correct as stated. Worth recording that it forbids
   authoring the exact `await props.onTrace$(...)` the emitter itself generates.
6. **Then re-open S8.** With (1), (2) and (4) settled, A1 — authored
   `async` + `await`, with `preventDefault` in one handler — is the right
   scenario, and Qwik has already shown it emits correctly.

**S8 should not be re-attempted before those rulings.** Every authoring of it
runs into at least one of them.

## 7. What was NOT done, and why each refusal is the card's

- **No emitter and no gate was touched.** Not React's, not Solid's, not
  Angular's. All four findings are recorded, none is repaired; every one of those
  files is outside `allowed_files`.
- **The Solid `requires a synchronous arrow` v-limit was not weakened**, though
  it alone blocks the card.
- **The Angular globals v-limit was not weakened.** §2.1's refusal is correct and
  the authoring was changed instead (A2), which is what exposed §2.2.
- No fixture and no golden was created, so **no existing golden moved** and the
  42/42 is untouched. §5.
- No `expectedNavigations` relaxed, no activation-neutrality assertion weakened,
  no observation string moved — none was reached.
- The whitespace v-limit never fired: every static text node in every draft is a
  single word.
- No branch in any draft, so the Solid `show-two-arm` constraint had nothing to
  bite.
- `pnpm mutate:corpus` was **not run**, per stop_if.
- **No commit and no history rewrite.** HEAD is still `4566540`.

## 8. Parallel safety

Verified at the first command of this session and again at the last:
`git status --porcelain` empty both times, HEAD `4566540` both times. **Unlike
T030, nothing landed underneath this card.** The PM's "nothing else is running"
held, and was checked rather than trusted.

## 9. Reproducing every claim in this note

Four `.tsrx` drafts and three probe scripts were written to the session
scratchpad, never to the repo. To reproduce from scratch, author the four
authorings in §2 as `.tsrx` modules and run each through
`emit(await buildEnrichedIr({...}))` for all six lanes — the same call
`packages/frameworks/<lane>/scripts/regenerate.ts` makes:

```
A1  async (event) => { s = 'a'; await Promise.resolve(); s = 'b'; onTrace(...); }
A2  async (event) => { s = 'a'; await onTrace(...); s = 'b'; }
A3  async (event) => { s = 'a'; onTrace(...); }
A4        (event) => { s = 'a'; settle().then(() => { s = 'b'; }); onTrace(...); }
```

The two typecheck results are reproduced by writing the Angular A2 output and the
React A4 output to disk and running this repo's own
`node_modules/.bin/tsc --noEmit --skipLibCheck` over them; the module-resolution
errors for `@angular/core` and `react` are artifacts of checking a single file
outside its package and are not part of either finding.

The §1 measurement is reproduced by walking `buildEnrichedIr`'s output over A1
with a walker that classifies each `reads` array by its key path.
