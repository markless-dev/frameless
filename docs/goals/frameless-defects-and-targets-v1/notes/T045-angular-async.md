# T045 — R1: the missing Angular typecheck oracle, then the `async` lowering

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Dispatched at `48ee449`, tree clean, 976 tests. Implements
`notes/T043-async-axis.md` ruling **R1**. Serialization hold behind
`frameless-vue-v1` T012 was discharged before dispatch and re-checked here: the
tree really was clean at `48ee449` and `pnpm test` reported no Vue failures.

## 0. Headline

**The instrument was the repair.** Angular was the only lane in this repo that
emits TypeScript and typechecks none of it, and the dropped `async` was one
instance of a hole through which *any* type-invalid Angular emission shipped
silently. `packages/frameworks/angular/test/emitted-typecheck.test.ts` now exists,
was watched RED on a planted async authoring with the verbatim `TS1308`, and only
then did the emitter move.

**Two failure modes, and only one is catchable — so the repair ships two
instruments.** That is not belt-and-braces. It is forced: `async`-without-`await`
emits **valid TypeScript**, and no oracle that has ever existed could catch it.

## 1. Re-derived, not inherited

T043 was a Judge's ruling and I re-derived its three load-bearing claims at
`48ee449` before touching anything, because this board has twice endorsed a
conclusion that one more measurement would have overturned.

| claim | how I checked | result |
| --- | --- | --- |
| the string `async` occurs **zero** times in the Angular emitter | `grep -c async src/emitter/index.ts` | **0** — confirmed |
| `tsconfig.json` does not `include` `generated/**` | read the file | confirmed: `src/**`, `test/**`, `scripts/**`, `vitest.node.config.ts`, one `.d.ts` |
| only React and Solid have an `emitted-typecheck.test.ts` | `ls packages/frameworks/*/test/` | confirmed; Angular had `emitter`, `gate`, `parse-emitted`, `toolchain` |

And the mechanism, read rather than assumed: handler methods are built from a
hand-written string template at `classMembers()`, and `qualify()` transplants the
arrow's **body** into it. The arrow node still carried `async: true` the whole
time — the emitter simply never read the field.

`parse-emitted.test.ts` cannot see this **by construction**, not by weakness: it
runs `@angular/compiler`'s `parseTemplate` over the emitted *template*. The class
body is not a template, and in the defect case the template is entirely correct.

## 2. RED CALIBRATION 1 — verbatim, before the emitter moved

The planted authoring is T043 §6's re-specified S8 body — `await` on a
**promise-valued prop**, so that Angular's globals v-limit and Qwik's
callback-statement rule are both authored *around* rather than weakened:

```
async (event) => { phase = 'pending'; await ready; ticks = ticks + 1; phase = 'done'; }
```

Run through the real pipeline (`buildEnrichedIr` → `emit` → `formatEmitted`, the
three calls `scripts/regenerate.ts` makes), the oracle failed:

```
 ❯ |angular-node| test/emitted-typecheck.test.ts (9 tests | 1 failed) 669ms
     × RED CALIBRATION 1: an authored async handler with await emits type-valid TypeScript 78ms

 FAIL  test/emitted-typecheck.test.ts > Angular emitted output type-checks >
       RED CALIBRATION 1: an authored async handler with await emits type-valid TypeScript
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "generated/async-with-await.ts: TS1308 'await' expressions are only allowed within async functions and at the top levels of modules.",
+ ]
```

`TS1308 'await' expressions are only allowed within async functions and at the
top levels of modules.` — matching T043 §1.2 exactly, under this repo's own
`typescript@5.9.3`.

## 3. RED CALIBRATION 2 — the case that CANNOT go red, and why one instrument is insufficient

**The oracle was green on `async`-without-`await` before the fix and is green
after it.** That is not a gap in this oracle. It is a gap in the *category*.

```
async (event) => { phase = 'pending'; ticks = ticks + 1; onTrace('run', { phase: 'done' }); }
```

emitted, before the repair:

```ts
	onH1Click(event: any): void {
		this.phase = 'pending';
		this.ticks = this.ticks + 1;
		this.onTrace('run', { phase: 'done' });
	}
```

That is **flawless TypeScript**. Every identifier resolves, every member exists,
the return annotation matches the body. The only thing wrong with it is that the
author wrote `async` and the method is not async: it returns `void` where it
should return `Promise<void>`, and any caller that awaits it silently awaits a
non-promise. **There is no type error to find**, so no typecheck oracle — not
this one, not a perfect one, not one with `strict` on — can ever report it. A
compile oracle is a total function of the emitted text's *type validity*, and
this defect is invisible in that projection.

**Therefore the second instrument cannot be another derived check over the same
output. It has to assert the emitted keyword itself.** That lives in
`packages/frameworks/angular/test/emitter.test.ts`, and it was watched RED:

```
     × async WITH await: the keyword is carried and the return type widens 12ms
     × async WITHOUT await: the keyword is carried even though the output would typecheck either way 2ms

AssertionError: expected '// @generated by @frameless/angular f…' to match /\basync onH\d+Click\(event: any\): Pr…/
- Expected:
/\basync onH\d+Click\(event: any\): Promise<void> \{/
```

Two REDs there, not one: the mode-A row and the mode-B row fail independently, so
neither is carrying the other. The **synchronous control** in the same block
passed at RED time, which is what stops "async is carried" from being vacuously
true of every handler — an emitter that stamped `async` on everything would have
passed both failing rows.

`emitted-typecheck.test.ts` carries the complementary half: a standing test that
pins the oracle's **blindness** to mode B, green before and after the repair. The
limit is now stated in the suite rather than left for a reader to infer.

**One honest caveat about the control.** My first draft of it asserted
`not.toMatch(/\basync\b/)` over the whole emitted module and failed for a reason
that was *my* fault, not the emitter's: I had named the probe component
`AsyncProbe`, so the selector `frameless-async-probe` matched. Renamed to
`HandlerProbe`. Recorded because a red I had briefly mistaken for a third defect
red was an artifact of the fixture — exactly the "reads like evidence and is not"
class T043 §2 flagged about its own contaminated probe.

## 4. RED CALIBRATION 3 — the oracle fires on nothing in the shipped corpus

In the same pre-fix run, **8 of 9 oracle tests passed**, including:

```
✓ the shipped corpus reports NOTHING but the expected unresolved @angular/* import
```

All seven `generated/S1.ts`…`S7.ts` are clean apart from exactly one
`TS2307 Cannot find module '@angular/core'` per file. The assertion is two-sided:
the unexpected set must be empty **and** the total diagnostic count must equal the
file count, so an options change that stopped resolving anything at all cannot
masquerade as a clean corpus.

**The `@angular/*` allowance is narrow, not a blanket suppression.** It matches on
**code and module name**, and a calibration plants a second unresolved import
(`'./nowhere.ts'`) and watches the lane reject it even though it is also a
`TS2307`. Three further planted mutations prove the lane can fail at all: an
undeclared member read (`TS2339`), that second import, and an illegal construct in
the class body (`TS1308`) — the last one with the template left untouched, which
is precisely the bug `parse-emitted.test.ts` is structurally unable to see.

**No `@angular/core` was added**, and `generated/**` was **not** added to
`tsconfig.json`. Both were stop_ifs and both would have been the easy move. The
oracle is a vitest file running `ts.createProgram` in React's shape, using T043
§10's measured option recipe.

## 5. The repair

`packages/frameworks/angular/src/emitter/index.ts`, three edits:

1. `LoweredHandler` gains `readonly isAsync: boolean`.
2. `handlerIsAsync(record)` reads `arrow.async`, sitting beside the existing
   `eventParameterName(record)` which already reads `arrow.params`.
3. The emission site carries both the modifier and the return type:
   `async name(...): Promise<void>` vs. `name(...): void`.

**Why this is admissible under ruling 3a**, which forbids content triggers: `async`
is a flag on the arrow node, part of its **declared signature**, exactly like the
parameter list this file already reads two functions earlier. Nothing about the
body is inspected. Every handler gets the identical treatment.

**The modifier and the return type move together** because they must: an `async`
method annotated `: void` is itself a type error, so splitting them would have
traded one `TS1308` for a different diagnostic.

Emitted output after the repair, verbatim:

```ts
	async onH1Click(event: any): Promise<void> {
		this.phase = 'pending';
		await this.ready;
		this.ticks = this.ticks + 1;
		this.phase = 'done';
	}
```

The lowering still runs **across** the `await` — `this.ticks = this.ticks + 1` and
`this.phase = 'done'` are both qualified after it — so the repair cannot pass by
emitting an async method wrapped around a stale body.

**No emitted byte moved.** `node scripts/regenerate.ts` followed by
`git diff --exit-code -- packages/frameworks/angular/generated` is clean. The
shipped corpus has no async handler, so a correct repair is **invisible** to it;
that is why the planted calibration is the whole proof. The emitter tests now
**assert** the corpus is async-free rather than assuming it, so the day S8 lands
that licence is re-checked rather than inherited.

## 6. `docs/emitter-idiom-policy.md` — gate outcomes, recorded here per T043 §9

The policy file is contended with the live Vue T012 card and was **not edited**.

**The procedure does not apply, and the policy itself says so.** Its preamble:
*"If the current emitted output is not in that set, this is a defect fix and the
procedure does not apply. Never run Gate 5 against known-broken output: it will
always `FAIL`, and the `FAIL` is meaningless."*

The preamble puts the burden of that showing on whoever invokes it, and demands
named evidence — "a framework diagnostic, a lint rule the framework ships against
that shape, a dedicated construct the framework provides *because* that shape does
not work, or a witnessed runtime failure." **The evidence is a framework
diagnostic, and it is the strongest kind: TypeScript's own `TS1308`, quoted in §2.**
`name(): void { await x }` is not a sanctioned spelling of an async handler; it is
not a spelling of anything, because it does not compile. Mode B is the same
determination without a diagnostic: `: void` is not a sanctioned form for a method
the author declared `async`, since it contradicts the declaration.

So the sanctioned set for "an authored async event handler in Angular" has exactly
one member at this emission site — `async name(...): Promise<void>` — and there is
no baseline/candidate pair to adjudicate. **This is forced lowering by
expressibility**, the same family as the whole Angular lane: Angular's template
expression grammar has no arrow functions, so a frameless handler must become a
class method, and an *async* frameless handler must become an *async* class method.

For completeness, since the ruling asked for outcomes rather than a dismissal —
had it been run as a sugar question, no gate would have denied it: **G1** the form
compiles clean under the lockfile's `typescript@5.9.3` while the alternative does
not; **G2** the change is entirely inside the emitted module and adds no import;
**G3** the trigger is `arrow.async`, a declared signature flag, never body
contents; **G4** the domain is *every handler in `classMembers()`'s
`handlersByEventId` loop*, stated in emitter terms, and it is total over it;
**G5** the alternative does not run at all, so there is no neutral comparison to
make — which is exactly the "meaningless `FAIL`" the preamble warns against;
**G6** two standing checks now pin it, one per failure mode.

## 7. What I did not do

- **No S8 fixture and no golden.** Blocked on T046 and T047; a golden alone
  enlists the scenario into every lane's derived gates at once. Both planted
  authorings live inside test files and are emitted in-memory.
- **No dependency added.** No `@angular/core`, no `@angular/build`, no
  `typescript` entry — `ts` resolves from the workspace root the same way React's
  oracle resolves it, and `pnpm-lock.yaml` did not move.
- **No `tsconfig.json` change.**
- **No v-limit weakened.** Angular's globals rule and Qwik's callback-statement
  rule are both authored *around*, per T043 §6.
- **`pnpm mutate:corpus` was not run** — it restores with `git checkout --` over
  `MUTATION_SURFACE`. `pnpm e2e` and `pnpm test:browser` were not run either; this
  lane is node-only by T002 ruling 1.
- **Nothing outside `allowed_files` was touched**, and no commit was made.
- **Nothing is upstream.** Angular supports async event handlers natively.

## 8. Verification

All green on the **first** attempt.

| command | result |
| --- | --- |
| `pnpm --dir packages/frameworks/angular exec vitest run --config vitest.node.config.ts` | **5 files, 114 tests passed** |
| `pnpm test` | **51 files, 989 tests passed** (976 at dispatch + 9 oracle + 4 keyword) |
| `pnpm check` | clean |
| `pnpm lint` | 0 warnings, 0 errors, 381 files |
| `node scripts/regenerate.ts` + `git diff --exit-code -- angular/generated` | **no byte moved** |
| `git diff --exit-code --` compiler, react, solid, qwik, svelte, vue, demos, scripts, idiom-policy | **untouched** |

The test-count arithmetic is exact and worth stating, because "the suite grew" is
not evidence on its own: 976 → 989 is +13, which is the 9 tests in the new oracle
plus the 4 in the new `emitter.test.ts` block. No pre-existing test changed count.

## 9. For T046, T047 and T028

**R1 landed with a witnessed RED calibration**, which is the first of the three
conditions in T043 §6's objective trigger for Phase F closing at eight. T028 must
not read this as a promise about the other two.

One thing R1 measured that R2 and R3 should carry: **the `git diff --exit-code`
over `generated/` is not a formality on this axis.** A correct async repair is
invisible to a corpus with no async handler in it, so for each of R2 and R3 the
planted probe *is* the proof, and a green regenerate diff proves only that nothing
was broken — never that anything was fixed.

And the structural finding is not Angular-specific. **Qwik still has no compile
oracle over its emitted `.jsx`** (T043 §1.3). That is one rank lower than the hole
closed here, since its output is at least parsed by the analyzer and its
constructs are the same JSX React's and Solid's oracles cover — but it is now the
only such gap left, and this card is the evidence for what such a gap costs.
