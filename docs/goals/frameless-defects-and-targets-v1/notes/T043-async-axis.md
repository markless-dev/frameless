# T043 — the async-handler axis: T031's impossibility proof is REFUTED, and S8 is re-specified

Judge, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Dispatched at `2667b1f`, 975 tests, tree clean. Read-only: nothing in this repo was
edited except this file. Every claim below was re-derived this session with probes
written to the session scratchpad; none is inherited from T031's transcript or from
the PM's dispatch prose.

## 0. Headline

**T031 §4's two-line impossibility proof does not hold, and the error is a
classification error, not an arithmetic one.** The proof reads: an async boundary
is either (a) `async`/`await` or (b) a continuation function; Solid refuses every
(a), React miscompiles every (b), so the intersection is empty. Both premises are
true. **The proof treats two emitter *bugs* as fixed points.** Neither is a
v-limit:

- Solid's refusal is `fn.async` inside a validator, in a lane whose *entire
  lowering pipeline is already async-safe* — proven below, at the level of the
  re-parse primitive, not by inspection.
- React's `await` failure is a **synthetic scratch arrow** that `replaceFreeNames`
  builds, re-parses, and then throws away. It is missing one boolean.

**And T031 declared the space empty without enumerating it.** It tried four
authorings. A fifth — **`await` on a promise-*valued* prop, i.e. an `await` with no
call and no free global** — clears both of the genuine, designed v-limits on this
axis (Angular's globals rule, Qwik's callback-statement rule) and emits **correctly
in four of six lanes today**:

```
A7  async (event) => { phase = 'pending'; await ready; ticks = ticks + 1; phase = 'done'; }

  react   THREW  (FINDING 3 — one line)
  solid   THREW  (FINDING 4 — one line)
  qwik    OK
  svelte  OK
  vue     OK
  angular OK-BUT-WRONG  (FINDING 1 — emits `await` inside a non-async method)
```

The only two lanes that refuse A7 are exactly the two whose refusals are bugs.
**S8 is landable in six lanes after three small repairs**, and the third of five
findings is already discharged (T044).

**The Angular finding is worse than briefed, and its root cause is not the
emitter.** `packages/frameworks/angular/tsconfig.json` does not `include`
`generated/**`, and the lane has no `emitted-typecheck.test.ts` — it has
`parse-emitted.test.ts`, which checks **template grammar** via `parseTemplate`, not
the TypeScript class body. **Angular is the only lane in this repo that emits
TypeScript and typechecks none of it.** The dropped `async` is one instance of a
hole through which *any* type-invalid Angular emission ships silently. I verified
that the invalid case really is uncaught: the A8 output below is `TS1308` under
this repo's own `typescript@5.9.3` and no instrument in the repo runs that check.

## 1. What I measured, and how

A probe outside the repo built the enriched IR with `buildEnrichedIr` and ran it
through `emit()` + `formatEmitted()` for all six lanes — the exact call each lane's
`regenerate.ts` makes. Emitted Angular strings were typechecked with the repo's own
`node_modules/.bin/tsc`. Vue's SFC was compiled with the repo's own
`@vue/compiler-sfc@3.5.40`. Nothing was registered; no golden, no fixture, no
`generated/` byte moved; `git status` is unchanged apart from this note.

### 1.1 The matrix, re-derived — and two cells T031 got wrong

| authoring | react | solid | qwik | svelte | vue | angular |
| --- | --- | --- | --- | --- | --- | --- |
| A1 `await Promise.resolve()` | THREW | THREW | OK | OK | OK | THREW (globals v-limit, **correct**) |
| A2 `await onTrace(...)` (callback prop) | THREW | THREW | THREW (**correct**) | OK | OK | **silent — invalid TS** |
| A3 `async`, no `await` | OK | THREW | OK | OK | OK | **silent — `async` dropped, VALID TS** |
| A4 `settle().then(cb)` | THREW (T044 guard) | **OK, lowers nested** | THREW (**correct**) | OK | **OK, lowers nested** | **OK, lowers nested** |
| A5 `defer(cb)`, no promise | THREW (T044 guard) | OK | **OK, lowers nested** | OK | OK | OK |
| **A7 `await ready` (prop value)** | THREW | THREW | **OK** | **OK** | **OK** | silent — invalid TS |
| **A8 = A7 + `preventDefault()`** | THREW | THREW | **OK, `sync$` split** | **OK** | **OK** | silent — invalid TS |

**Correction 1 to T031.** T031's matrix records A4 as `OK` for svelte, vue and
angular. `OK` there means *the emitter did not throw* — none of those three cells
was checked for correctness, and T031's own §2.4 typechecked only the React one.
That is the same "an instrument that cannot fail" failure the board has corrected
four times. I checked all three. **All three are genuinely correct**, and the Vue
one is the only non-obvious cell, because Vue's emitted SFC contains a *raw*
nested write:

```html
@click="(event) => { phase = 'pending'; settle().then(() => { ticks = ticks + 1; }); }"
```

Compiled through `@vue/compiler-sfc` with `inlineTemplate: true`, that becomes:

```js
onClick: _cache[0] || (_cache[0] = (event) => {
  phase.value = 'pending';
  __props.settle().then(() => { ticks.value = ticks.value + 1; ... });
})
```

Vue's own compiler rewrites `SETUP_REF` bindings **at every nesting depth**, so the
lane is correct for a reason that lives downstream of frameless. Worth recording,
because it is a *dependency* on Vue compiler behaviour, not a property of our
emitter. Had it come back unrewritten, FINDING 2 would have been a two-lane defect
and T044's ruling would have needed re-examination. A cell that could have refuted
the ruling and did not is worth more than one that could only confirm it.

**Correction 2 to T031.** T031 §6 item 2 and T044 §3's shipped message both say
nested writes lower correctly "in the Solid emitter", singular. Measured: **Solid,
Qwik, Svelte, Vue and Angular all lower nested writes correctly.** React is alone,
one lane of six, not one-of-two. This strengthens T044's entry 8 rather than
weakening it, and it means the "port Solid's approach" framing understates how
settled the question is — five independent implementations agree.

### 1.2 Angular, verbatim, and the typecheck

A8's emitted Angular class, verbatim from this session's emitter:

```ts
	onH1Click(event: any): void {
		event.preventDefault();
		this.phase = 'pending';
		await this.ready;
		this.ticks = this.ticks + 1;
		this.phase = 'done';
		this.onTrace('run', { phase: 'done' }, event);
	}
```

Under this repo's `typescript@5.9.3`:

```
a8.ts(26,3): error TS1308: 'await' expressions are only allowed within async
             functions and at the top levels of modules.
a3.ts        (clean — only the expected TS2307 for '@angular/core')
```

So Angular has **two** failure modes and they need separating, because the dispatch
brief conflates them:

- **A3 (async, no `await`)** — the `async` keyword is dropped, the method returns
  `void` instead of a promise, and the output is **valid TypeScript**. No oracle
  anywhere could catch this, even a perfect one. This is the semantic downgrade.
- **A7/A8 (async with `await`)** — the `async` is dropped and the `await` is kept,
  producing **invalid TypeScript**. A typecheck oracle *would* catch this — and the
  Angular lane does not have one.

The mechanism, re-derived: the string `async` occurs **zero** times in
`packages/frameworks/angular/src/emitter/index.ts` (I ran the grep; it is also zero
in the Svelte emitter, which is harmless there because Svelte prints the authored
arrow rather than transplanting it into a method). The emission site is a
hand-built string at **`packages/frameworks/angular/src/emitter/index.ts:769`**:

```ts
text: `${handler.name}(${parameters}): void {\n${indentBlock(body, '\t')}\n}`,
```

`qualify()` transplants the body into that template and the arrow's modifier has
nowhere to go.

### 1.3 The instrument gap, measured

| lane | emits | compile oracle over emitted output |
| --- | --- | --- |
| react | `.jsx` | `test/emitted-typecheck.test.ts` (real `tsc`) |
| solid | `.jsx` | `test/emitted-typecheck.test.ts` (real `tsc`) |
| svelte | `.svelte` | `test/compile-emitted.test.ts` (svelte compiler) |
| vue | `.vue` | `test/compile-emitted.test.ts` (vue compiler) |
| qwik | `.jsx` | **none** — analyzer grammar check at emission only |
| **angular** | **`.ts`** | **none** — `parse-emitted.test.ts` checks the *template*, not the class |

`packages/frameworks/angular/tsconfig.json` includes `src/**`, `test/**`,
`scripts/**` — **not `generated/**`** — so `pnpm check`'s
`tsc -p packages/frameworks/angular --noEmit` never sees the emitted component
either. Angular is the acute case because it is the only lane emitting
TypeScript-specific syntax (class methods, return annotations, decorators) where a
grammar-valid string can be type-invalid. Qwik's gap is real but one rank lower:
its `.jsx` is at least parsed, and its emitted constructs are the same JSX the
React and Solid oracles cover.

**The objection this has to survive**, and it does: `packages/frameworks/angular`
is deliberately free of `@angular/core` (see `test/toolchain.test.ts` — that
absence is the structural guarantee Vite 7 and Vite 8 never meet in one package),
so a naive `tsc` over `generated/` cannot resolve the import. That does **not**
block the instrument. The check I ran resolves everything else and reports exactly
one expected `TS2307` per file; the oracle asserts *no diagnostic other than
`TS2307` for `@angular/*`*. No dependency is added and the toolchain ruling is
untouched.

## 2. FINDING 4 — Solid's refusal is an ACCIDENT, ruled

The dispatch asks whether Solid's bare throw is a considered v-limit nobody wrote
down, or an accident. **Accident.** Four independent lines of evidence, three of
them re-derived here:

1. **Provenance.** `git blame` puts `packages/frameworks/solid/src/emitter/index.ts:1174-1175`
   in commit `1309b00`, whose own message is
   *"t006: solid emitter + dossier gate (codex killed at ceiling; PM completing)"*.
   It is original-landing code from a session that ran out of budget.
2. **It has no reachable justification.** `git log -S "requires a synchronous arrow"`
   returns exactly one commit; the string occurs exactly once in code, at the throw,
   with no dossier reference, no test and no documentation. Every other v-limit in
   this repo that survived scrutiny (Angular's globals rule, Qwik's callback rule,
   T039's whitespace limit) carries a comment explaining the cost.
3. **It is a copy of a check that is load-bearing somewhere else.** Sixty lines
   earlier, `:828` reads
   `if (!t.isArrowFunctionExpression(fn) || fn.async || fn.params.length !== 0)`
   for a **computed binding**, where async genuinely is unsupported — Solid refuses
   async state constructs outright at `:786`. The handler check is the same
   predicate with the arity clause dropped. It is a shape assertion that travelled,
   not a decision.
4. **The pipeline behind it is already async-safe, and this is the decisive one.**
   Solid's re-parse primitive is `reanalyzeExpression` (`:161`), which prints
   `const __framelessExpression = <the arrow itself>` and re-analyzes. It wraps
   **nothing**. An `async` arrow prints and re-parses as valid module-level source.
   Contrast React (§3), whose primitive fabricates a *synchronous* wrapper. And
   `normalizeHandler` (`:2390`) mutates the arrow in place and returns it, so
   `fn.async` would survive to output untouched. The one construct that could have
   conflicted — `syncPolicy` `renormalize`, which unshifts `event.preventDefault()`
   to the top of the body — is *strengthened* by async, not broken: the call still
   runs before the first `await`, and Solid is a real DOM listener with no QRL
   laziness.

I could not run the async arrow end-to-end through Solid without editing the
validator, and I did not. I flipped the flag to `false` in a cloned IR while
leaving the `await` in the body; that threw, but the probe is **contaminated** —
`(event) => { await x }` is genuinely invalid JavaScript, so the failure is
expected and proves nothing either way. I record it because it is the kind of
result that reads like evidence and is not. The load-bearing evidence is (4).

**Ruling.** Narrow the check to `!t.isArrowFunctionExpression(fn)`. Do not add a
documented v-limit; there is nothing to limit. The repair must be preceded by a
witnessed RED — the current `requires a synchronous arrow` message on an authored
async handler — and must prove the emitted Solid handler keeps the `async` keyword
and lowers reads and writes correctly **across** the `await`.

## 3. FINDING 3 — React's re-parse wrapper, and why the repair is one boolean

Re-derived by stack trace, not by reading:

```
yuku-analyzer rejected emitted handler: 'await' is reserved in an async/module
context and cannot be used as an identifier
    at reanalyzeFunction  (react/src/emitter/index.ts:150:9)
    at replaceFreeNames   (react/src/emitter/index.ts:167:2)
    at replaceVersionReads(react/src/emitter/index.ts:1951:2)
    at toConstSsa         (react/src/emitter/index.ts:2050:3)
```

`replaceFreeNames` (`:161`) builds `t.arrowFunctionExpression([], <cloned node>)` —
a **synchronous** scratch arrow — purely to get scope analysis, then splices
`fn.body.body[0]` back out and discards the wrapper. I replicated the wrapper
against the same `yuku-analyzer` the emitter uses:

```
wrapper async=false: diagnostics=2  unresolved=[]
wrapper async=true:  diagnostics=0  unresolved=[phase,ready]
```

Two things follow. The repair is `t.arrowFunctionExpression([], body, /* async */ true)`.
And the sync wrapper's failure mode is worse than a throw would suggest: it reports
`unresolved=[]`, so if the diagnostic were ever suppressed rather than fixed, free-name
replacement would silently do **nothing**. Anyone tempted to soften that throw
should read that line twice.

**Why this cannot regress the corpus.** The wrapper never reaches output, and in
`sourceType: 'module'` `await` is already reserved as an identifier, so no existing
body can parse differently under an async wrapper. The claim is falsifiable and the
falsifier is cheap: `regenerate.ts` for all six lanes plus
`git diff --exit-code -- packages/frameworks/*/generated`.

**One thing the repair does NOT settle, and the S8 designer must measure.** React's
`toConstSsa` lowers `ticks = ticks + 1` to `const nextTicks = ticks + 1; setTicks(nextTicks)`,
reading the **render-closure** binding. After an `await`, that binding is stale —
the classic React footgun whose idiomatic answer is the functional updater
`setTicks(t => t + 1)`. Solid's `setTicks(ticks() + 1)` reads the live signal and is
**not** stale. So React and Solid are **predicted to diverge on a second dispatch
across an await**, and a single-click S8 assertion would pass in both while hiding
it. This is a prediction, not a measurement — I could not emit React's async output
without the repair, and I did not make it. It is flagged here so R3 and S8 are
designed to expose it rather than to pass.

## 4. FINDING 5 — Qwik. Correct as designed. Not a defect.

Re-confirmed both halves myself. Qwik refuses `await onTrace(...)` at
`packages/frameworks/qwik/src/emitter/index.ts:936` (*"Qwik v1 callbacks must be
observational expression statements"*), and Qwik's own lowering emits
`await props.onTrace$('run', ...)` — I have both in the same session's output. The
irony is real and it is not a bug: the emitter's generated form is a *lowering
product*, the authored form is an *input*, and a compiler is entitled to generate
what it will not accept. C compilers do this constantly.

**No `docs/DEFECTS.md` entry.** The obligation is documentary only: the comment at
`:936` should record that the rule forbids authoring the exact `await props.onX$()`
the emitter itself generates, so the next reader does not file it as an
inconsistency. That is a one-comment addition and it rides along with whichever
Qwik card touches that file next — **it does not justify a card of its own**, and a
docs-only card here would be exactly the micro-slice this board keeps producing.

Qwik remains the only lane that gets this axis right end to end. I reproduced the
`sync$` split on A8 — an authored `async` handler opening with `preventDefault()` —
and it is byte-for-byte the shape T031 reported, generalised from Defect 1's single
synchronous proof site with no `async`-aware code anywhere in the lowering.

## 5. The per-lane ruling, the repair, and the order

| # | lane | ruling | repair | where |
| --- | --- | --- | --- | --- |
| R1 | **angular** | **DEFECT.** Silent semantic downgrade, and the lane has no typecheck oracle. **Lower, do not merely refuse.** | Build the missing oracle over `generated/**`; then carry `fn.async` onto the class method (`async name(...): Promise<void>`) | this board, **first** |
| R2 | **solid** | **DEFECT — accidental, not a v-limit.** | Narrow `:1174` to `!isArrowFunctionExpression(fn)` | this board, second |
| R3 | **react** | **DEFECT.** Loud, narrow, one boolean. | `replaceFreeNames` wrapper → async | this board, third |
| — | **react (nested-write LOWERING)** | Entry 8's lift. **Design change. HANDS OFF.** | port the five-lane-agreed approach | `frameless-emitter-capability-v1` |
| — | **qwik** | **NOT a defect.** Correct as designed. | one comment, riding along | no card |
| — | **svelte, vue** | **Correct on every authoring measured.** Vue's correctness depends on `@vue/compiler-sfc` binding rewriting — record the dependency. | none | none |

### Why Angular first, and why LOWER rather than THROW

The dispatch asks whether a fail-closed throw suffices. **It does not**, for three
reasons, and I want the strongest counter-argument on the record first: the T039
precedent says a fail-closed v-limit with a lift trigger is this board's house
style, it is cheaper, and it cannot regress anything. That argument is right about
cost and wrong about fit.

1. **A throw does not close the hole it was reached for.** The reason nobody saw
   this is not that the emitter was quiet — it is that **nothing typechecks emitted
   Angular**. Ship a throw and the next type-invalid Angular emission is exactly as
   silent. The instrument is the repair; the `async` fix is one thing it catches.
2. **T039's v-limit refused a construct with a portable substitute already asserted
   in six lanes.** There is no portable substitute for an async event handler.
   Refusing it makes Angular the one lane that permanently cannot express a
   mainstream construct its own framework supports natively, which is the exact
   trade T041 is being told to weigh sceptically for dynamic boolean attributes.
3. **The lowering is smaller than the refusal's blast radius.** One string template
   at `:769`. Angular already lowers nested writes correctly (§1.1), so no second
   problem is hiding behind this one.

Angular goes first because it is now the **only remaining lane whose failure is
silent** — T044 discharged the other one — and because a silent defect gets more
expensive the longer the corpus grows around it. Solid second: one line, and it
decides whether the (a) axis exists at all. React last: also one line, but it is the
one with a live interaction (§3's staleness prediction), so it should be made with
the most information on the table, and nothing forces it earlier now that T031's
"FINDING 2 before FINDING 3" ordering is discharged.

## 6. S8 — RE-SPECIFIED. Phase F does not close at seven. **T028, read this section.**

**Ruling: S8 stays as Phase F's eighth scenario and is RE-SPECIFIED.** It is not
dropped, and Phase F does not close at seven — *conditionally*, on an objective
trigger T028 can check rather than infer.

**The re-specification.** The awaited expression must be a **promise-valued prop**:

```
async (event) => {
    event.preventDefault();      // Defect 1's shape, inside an async handler
    phase = 'pending';
    await ready;                 // `ready` is a PROP holding a promise
    ticks = ticks + 1;
    phase = 'done';
    onTrace('run', { phase: 'done' }, event);
}
```

It must **not** await a free global (`await Promise.resolve()` — Angular's globals
v-limit refuses `Promise`, and that refusal is **correct** and must not be
weakened), and must **not** await a callback-prop call (`await settle()` — Qwik's
callback-statement rule refuses it, and that refusal is **correct** too). Authoring
around two designed v-limits is precisely what T030 did for S7 with `aria-disabled`;
the precedent is established and the alternative — widening a gate — is what this
board's charter forbids.

Measured today, that authoring emits correctly in **qwik, svelte and vue**, emits
in angular with the `async` dropped, and is refused only by react and solid — the
two repairs. **After R1, R2 and R3, S8 lands in six lanes.**

**The objective trigger, so T028 does not have to infer anything.**

- If **R1, R2 and R3 all land with witnessed RED calibrations** → S8 is authored as
  above and Phase F closes at **eight**. The stopping rule is met as ratified.
- If **any of R1/R2/R3 is refused, or fails its RED calibration, or turns out to
  require a design change rather than the repair specified here** → Phase F closes
  at **seven**, and T028 records the measured refusal with the lane, the file, the
  line and the verbatim message. That is a documented refusal, not a shortfall.

Either way T028 has a fact to check, not a judgement to make. **T028 must not treat
"seven landed" as automatically closing Phase F, and must not treat this ruling as
a promise that eight will.**

**Two design constraints S8 must carry, both derived above:**

1. **The behavioural contract must dispatch the handler TWICE**, not once. §3
   predicts React and Solid diverge on the second dispatch across an `await`
   (render-closure staleness vs. live signal read). A single-click assertion passes
   in both lanes and asserts nothing about the axis it exists to test. An
   instrument that cannot fail is not an instrument.
2. **`preventDefault()` belongs in the fixture.** It is the only construct that
   proves Qwik's `sync$` split generalises to an authored async handler, which is
   currently proven nowhere in the shipped corpus — only in T031's and this
   session's scratch probes. Landing it converts a scratchpad measurement into a
   standing one.

## 7. `docs/DEFECTS.md`, and the oracle

**Three new entries. Each is filed by the repair card that closes it, not by a
documentation card.** That is T044's own pattern — entry 8 landed with the repair —
and it keeps every card a vertical slice with an executable change rather than
producing a docs-only card on a board that has already been warned about that.

- **Entry 9** (filed by R1) — *Angular silently drops `async` from an authored
  event handler.* Must name the instrument gap as the reason it shipped invisibly,
  and must record both failure modes separately: valid-TS-but-wrong (A3) and
  invalid-TS-and-unchecked (A7/A8). Closed by R1.
- **Entry 10** (filed by R2) — *Solid refuses every async event handler through an
  undocumented bare throw, in a lane whose framework supports them natively.* Must
  record the accident finding and the four evidence lines of §2, so it is not
  re-litigated as a v-limit. Closed by R2.
- **Entry 11** (filed by R3) — *The React emitter cannot emit any handler containing
  `await`, because a scope-analysis wrapper is synchronous.* Must carry §3's
  staleness prediction as an explicit OPEN sub-question. Closed by R3 only if the
  staleness measurement comes back clean; otherwise R3 closes the syntax half and
  entry 11 stays OPEN with a lift trigger.

**No entry for Qwik.** §4.

**Half 1's oracle does NOT extend.** T038 ruled that half 1 is defined over the six
named defects, and that redefining it mid-goal to absorb findings the goal itself
produced makes the goal uncloseable by construction. T044 followed that for entry 8.
Same treatment here, and the reasoning is stronger with each addition: this axis
alone would add three. T999 records their status; the oracle does not move.

## 8. Hand-off

**Stays on this board:** R1, R2, R3. All three are prerequisites for S8, which is
this board's own Phase F stopping rule. None is a capability question.

**Hands off to `docs/goals/frameless-emitter-capability-v1`:** React nested-write
**lowering** — the lift trigger on entry 8, left open by T044 §8.1. It is a genuine
design change; it is **not** needed for S8, because the re-specified S8 uses
`async`/`await` and keeps every write at the top level of the handler body; and §1.1
strengthens the case that a port is well-founded, since five independent emitters
already agree on the semantics. That goal is blocked until T028 closes Phase F, which
is the correct place for it.

## 9. What I did not do

- **Nothing was implemented.** No emitter, no gate, no test, no fixture, no golden,
  no `tsconfig`. `git status` shows this note and nothing else.
- **No fixture was registered.** Per the dispatch: the inventories are derived from
  `goldens/s<n>-*.json`, so a golden alone enlists a scenario into every lane's gates.
  Every probe lived in the session scratchpad.
- **`pnpm e2e`, `pnpm test:browser` and `pnpm mutate:corpus` were not run.**
- **No v-limit was weakened, and two were affirmed** — Angular's globals rule and
  Qwik's callback-statement rule. The S8 re-specification is authored *around* both.
- **Nothing is upstream.** React, Solid and Angular all support async event handlers
  natively; every failure here is in our emitters. The owner's autonomy-grant
  exclusion on outward-facing filings is not engaged.
- **I did not rule on `docs/emitter-idiom-policy.md`'s six gates for these repairs.**
  R1 changes an emission-site *form* (`name(): void` → `async name(): Promise<void>`)
  and the charter says the policy governs every such choice. R1's card carries that
  obligation; the file is contended with the live Vue T012 card, so R1 must record
  the gate outcomes in its note rather than editing the policy.

## 10. Reproducing this note

Author A1–A8 from §1.1 as `.tsrx` modules in a scratch directory and run each
through `emit(await buildEnrichedIr({...}))` + `formatEmitted()` for all six lanes.
Typecheck emitted Angular with `node_modules/.bin/tsc --noEmit --skipLibCheck
--target es2022 --module esnext --moduleResolution bundler --experimentalDecorators`;
the `TS2307` for `@angular/core` is an artifact of checking outside the package and
is not part of any finding. Compile the emitted Vue SFC with the repo's own
`@vue/compiler-sfc` at `inlineTemplate: true` to see the nested `.value` rewrite.
Reproduce §3 by calling `analyze()` from `yuku-analyzer` on
`const __framelessHandler = () => { phase = await ready; };` with and without
`async`, and compare both `diagnostics` and `unresolvedReferences`.
