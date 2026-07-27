# T003 — the Angular emitter, gate and goldens

`packages/frameworks/angular` lands as one vertical slice: an emitter, a
two-arbiter gate, three checked-in goldens with a byte-equality freshness test,
and an IR-7 purity guard. Node only. No demo, no e2e row, no `@angular/core`, no
`@angular/build`, no browser lane.

Verification: `pnpm check` (with the new `tsc -p packages/frameworks/angular` pass
appended to the chain), `pnpm test` (935 tests, 85 of them new), `pnpm lint`
(0 warnings, 0 errors), goldens byte-stable across two regenerations, `pnpm e2e`
green on all four existing rows with all observations equal.

`packages/frameworks/angular/README.md` is the short version of everything below.

---

## 1. The measurements

### M1 — Angular's whitespace rule, and it REFUTES the Vue lane's answer

Measured at `@angular/compiler` 22.0.8 through `parseTemplate`, which applies the
production `preserveWhitespaces: false` default. Rows live in
`test/parse-emitted.test.ts`.

| shape | measured result |
| --- | --- |
| newline between two ELEMENTS | whitespace-only node removed |
| a bare SPACE between two elements, no newline | also removed |
| whitespace-only node at the template ROOT | removed |
| a text child on its own line | `increment` → `" increment\n"` |
| newline between an INTERPOLATION and text | `1/2` → `1\n/2` |
| **a LONE INTERPOLATION child on its own line** | **`" "` and `"\n"` both survive** |

The last row is a **refutation**. The Vue lane measured that shape SAFE at
`vue@3.5.40` and therefore recorded its (identical) inline-run rule as *merely
conservative*, saying so twice in code. Angular condenses a run of two-or-more
whitespace characters to one space and keeps a lone newline verbatim, and those
survive as LITERAL SEGMENTS of the interpolation's `BoundText` — so
`<output>{{ writes }}</output>` broken across lines renders `" 0\n"`.

**Inheriting the Vue measurement instead of re-running it would have shipped that
arm silently wrong**, in S3's `data-writes` observable, which the e2e matrix reads.
The rule is therefore REQUIRED here, not conservative. Recorded in the emitter's own
doc comment, in the README table, and as a dedicated red row in the gate test
(`rejects a LONE interpolation child on its own line - the arm Vue measured SAFE`).

This is the board's recurring fault in miniature: the S3 `value`-attribute trail
records the same inference error three times, each pass correcting the previous
one's wording while repeating its method.

### M2 — `parseTemplate` as ARBITER 1, calibrated both ways

`errors === null` on all three emitted templates, asserted as an EXACT EMPTY set
inside `emit()` and again as the gate policy `template-parse`.

Red side, four planted shapes:

| planted | error |
| --- | --- |
| `{{ count++ }}` | `Unexpected end of expression` |
| `(click)="count++"` | `Unexpected end of expression` |
| `{{ count = 1 }}` | `Bindings cannot contain assignments` |
| `{{ new Date() }}` | `Unexpected token 'Date'` |
| `@for (todo of todos)` with no `track` | `@for loop must have a "track" expression` |

**The first two are this board's whole premise, measured rather than cited.**
Angular's template expression grammar has NO `UpdateExpression` node at all, so
S1's `count++` is unexpressible at any binding site. T002 finding 3 was right that
the charter's *stated* reason (arrow functions forbidden) went stale at 22.0.8 —
`class ArrowFunction extends AST` is declared — and this is the reason that did not.

**T002 dissent 2 is CONFIRMED**: `@for`'s mandatory `track` closes the
require-each-key hole at the compiler, so the "compiles clean and is wrong" class
that earned the Vue and Svelte arbiters their keep does not exist here.

### M3 — the derived applied set, and the four rules that dissolved

T003a's ruling implemented verbatim. `meta.docs.recommended === 'recommended'` read
live off both leaf plugins: **12 of 50** TS rules, **4 of 41** template rules, plus
the **one recorded addition** `use-lifecycle-interface` (upstream publishes it in
`ts-recommended` at `warn` while its metadata flag is `undefined`). **17 applied,
zero omitted.** All four counts are pinned in `test/gate.test.ts`, and the twelve
and four rule ids are pinned as literals so a plugin dropping the metadata field is
a red test rather than a permanently green arbiter.

**Green side: 0 messages on all three shipped goldens.** The ordering is the
argument — the set was fixed by upstream's metadata before the corpus was measured.

**Red side, six planted violations across BOTH plugins**, each asserted by rule id:

| planted | rule |
| --- | --- |
| `@Input('seedAlias')` | `no-input-rename` |
| `inputs: ['seed']` metadata | `no-inputs-metadata-property` |
| `standalone: false` | `prefer-standalone` |
| `constructor(private http)` | `prefer-inject` |
| `todos.length == 0` in the template | `template/eqeqeq` |
| empty `ngOnInit() {}` | `no-empty-lifecycle-method` |
| `*ngFor` | `template/prefer-control-flow` |
| dropping `implements OnInit` | `use-lifecycle-interface` |

The `template/*` rows are load-bearing twice: they only reach an INLINE template
through `extract-inline-html`, so they also prove the processor is wired.

**The four rules that fired during T003's first attempt all dissolve**, exactly as
T003a ruled: `component-class-suffix`, `prefer-signals`, `template/button-has-type`
and `template/i18n` are all outside upstream's own recommended set. **No class was
renamed and no `type=` was added.** A dedicated row pins their absence, so a later
plugin PROMOTING one of them is a red test and a finding rather than a silent
corpus failure.

### M4 — asserted toolchain facts (assert, do not pin)

Ruling 1's mitigation applied twice more.

- `@angular/compiler` 22.0.8, `@angular-eslint/*` 22.1.0 — asserted against
  recorded literals by re-reading the resolved `package.json` files.
- **TypeScript is split, and the split is asserted.** `tsc` runs the catalog's
  **5.9.3**; `@typescript-eslint/parser` — the parser under the arbiter — resolves
  **6.0.3**, supplied **incidentally** by `demos/svelte-official`'s off-catalog
  declaration and **not catalog-governed**. In effect that is benign and slightly
  better: the gate lints emitted output, which is typechecked at T004 by `ng build`
  at TS ~6, so parsing at 6.x is closer to the truth. But if that demo drops its
  off-catalog TypeScript, the parser under this arbiter changes with **no file in
  this repo changing**. `ANGULAR_ARBITER_TOOLCHAIN` records both versions and the
  provenance; the test re-reads both and asserts they differ.
- **MEASURED: the resolved `@angular/compiler` dates nothing.** It ships
  `LICENSE`, `README.md`, `package.json`, `fesm2022/` and `types/` — no changelog,
  no `@since` tag anywhere. That is why every baseline floor reads `unverified`,
  and the row asserts it rather than asserting *about* it. The citation checker is
  calibrated in all three directions (pass / fail / throw) against the real package,
  because no entry exercises its `verified` branch today.

---

## 2. Ruling 3e as restated, and how it is calibrated

The lowered body is transplanted with **exactly one** transformation, total,
scope-aware and fail-closed. Implemented in `qualify()`.

**There is no globals allowlist.** The corpus references zero globals, so one would
be untested dead code; an unresolvable identifier is a named throw. The IR's other
statement-injecting channel (`records.persistence`, which injects
`__framelessWrite(…)`) is refused whole by `emit()`, so that identifier can never
arrive here either.

Calibration, as T003a required. Four arms are natural in the shipped corpus and two
were planted:

| arm | where | result |
| --- | --- | --- |
| member qualifies through an operator | S1 | `this.count++` |
| shorthand property loses shorthand | S1 | `{ count: this.count }` |
| body-local stays bare | S2 add | `const item` |
| lambda parameter stays bare beside a member that qualifies | S2 edit | `this.todos.find((item) => item.id === todo.id)` |
| `@for` variable stays bare | S2 edit/toggle/remove | `todo.id` |
| body-local that is ALSO a shorthand key | S2 clear | `{ count }` stays bare |
| **body-local SHADOWING a declared state name** | **planted** | `const count = 7` → `count++`, not `this.count++` |
| **unresolvable identifier** | **planted** | `Math.random()` → named throw |

The shadowing row is the one that matters: a naive name substitution passes every
natural row above and fails only that one.

---

## 3. Decision sites

Each of these is a place the emitter could have gone another way, recorded so that
changing it later is a deliberate edit.

**Component locals go to `ngOnInit`, uniformly.** A field initialiser runs at
*construction*, before Angular has written a single `@Input`, so S1's
`prefix = \`${this.label}:\`` would read `undefined` and
`this.onTrace('setup', …)` would call it. `count = 1` would have been safe as a
field initialiser and goes to `ngOnInit` anyway — splitting on "does this
initialiser read a prop?" is a discriminating predicate over expression contents
selecting between two emission shapes, which is ruling 3a's refusal. The addition
of `use-lifecycle-interface` to the applied set is what then forces `implements
OnInit`, so it is load-bearing rather than decorative. `ngOnInit` is emitted only
when there is something to run in it, because `no-empty-lifecycle-method` is also in
the applied set and `implements OnInit` without the method is a type error.

**A `computed` binding becomes a GETTER**, which Angular re-evaluates on every
change-detection pass. That is what makes IR-7 bite harder here than in Vue: an
impure getter writes on every tick.

**A STATE local's initializer comes from the BINDING record, not the local.** The
local's own `initializer` is the authored `state(1)` CALL, whose callee is a
markless primitive with no Angular counterpart. Selected on `binding.kind`, a
declared IR field.

**Everything is `: any`** — see §4.

**`_event` when the IR declares no parameter.** Ruling 3e says the method keeps the
IR's own parameter name; when there is none, the emitter invents one. It invents
`_event` so this repository's own `no-unused-vars` pass has nothing to say about
generated output (S1's increment receives `$event` it never reads, per ruling 3d).
`params.length === 0` is the handler's DECLARED SIGNATURE — the same field ruling 3e
already reads — and it selects a NAME, never an emission SHAPE. The call site is
`$event` either way. Asserted two-sided: S2's handlers keep their own `event`.

**Selector is `frameless-` + kebab(componentName).** Derived from the IR's own name
only. `component-selector` is not in the applied set, so nothing upstream constrains
the prefix; T004 may need to reconcile it with the scaffold's own `app` prefix.

**Absent by decision:** no `changeDetection` (OnPush is the Angular 22 default and
`prefer-on-push-component-change-detection` reports only an explicit opt-out — so
**emitted components are OnPush-checked**, and T004 must not assume eager checking);
no `standalone` (defaults true from 19); no `imports` (built-in control flow needs
none); no signal member anywhere.

**`@if`/`@for` rather than `*ngIf`/`*ngFor`** is not a preference:
`template/prefer-control-flow` is IN the applied set and reports the directives, and
`*ngIf` would additionally need an `imports:` entry the IR does not declare.

---

## 4. THE WRITTEN RECORD OF THE UNTYPED-PROP LIMITATION

Required by the T003 constraints so a green is not over-read. Silence was not an
option.

`PropDestructuringEntry` is `sourceName`/`localName`/`path`/`alias`/`graphNodeId`/
`defaultValue?` and carries **no type**, and `EnrichedComponent.props` adds nothing.
Any emitted type would therefore be INFERRED from what the corpus happens to do with
the member — a content-based trigger (Gate 3) that is unsound outside the exercised
subset (Gate 4). Named **IR-8**, deferred, and **out of scope for T003** by T002
ruling 5.

**So every emitted declaration reads `: any`, and this is what that costs.**
Angular's `strictTemplates` covers strictly more than `svelte-check` did — it types
`$event` at all **fifteen** lowered call sites and validates every `@for` track
expression, and both matter enormously here because fifteen lowered call sites ARE
this lane's risk surface. **It does not close the hole.** An `any` member defeats
`strictTemplates` exactly as it defeats `svelte-check`: a wrong-typed route binding
stays green. Angular closes it only if the emitter emits types.

**This is not a new discovery**, and that is the part worth carrying:
`packages/frameworks/react/test/emitted-typecheck.test.ts:14-16` already records it
as "deliberate scope, not laxity", citing `frameless-testing-ci-v1` T005. The Vue
scout, the Angular scout and the Vue judge (as IR-8) each re-derived it
independently, which T002 ruling 5 read as evidence the documentation is not
reaching the boards. **It belongs on a shared board; a fifth re-derivation is not
progress.**

The annotation is not decoration either. The scaffold's `strict` implies
`noImplicitAny`, so a bare `count;` is TS7008 and a bare `event` parameter TS7006 —
unannotated members would not survive T004's `ng build` at all. `event: Event` is
refused for the *opposite* reason: the real DOM type makes
`event.currentTarget.value` a type error, so emitting it would be the emitter
inventing a type in order to look better typed than it is.

---

## 5. The `generated/` divergence, recorded not closed

`packages/frameworks/angular/generated/**` is deliberately **outside every tsconfig
in this repository**. Emitted output imports `@angular/core`, which this package may
not depend on (it drags the `typescript >= 6` peer and the vendored vite 7.3.6), and
it is typechecked at T004 by a real `ng build` on the official scaffold — which is
strictly better evidence than an in-package `NgtscProgram` would have been.

**The consequence, stated rather than hidden:** T003 ships goldens **no Angular type
checker has seen**. `parseTemplate` covers GRAMMAR ONLY. T002's own dissent 1 says
so and calls it a genuine coverage gap between T003 and T004 rather than a solved
problem. If T004 blocks on an emitter defect, the ruled response is a T004a
emitter-repair package, not widening T004's `allowed_files`.

---

## 6. Findings

**F1 — the Vue whitespace measurement does not transfer, and it is not merely a
tightening.** See M1. A lane inheriting Vue's "conservative" framing would have
shipped a broken S3 observable.

**F2 — the arbiter independently agrees with ruling 2, by a different mechanism.**
A planted `@Output() onTrace = new EventEmitter()` draws
`@angular-eslint/no-output-on-prefix`. Ruling 2 refused `@Output` from the CORPUS
(`emit()` takes one value; `onTrace` is called with two and three positional
arguments, DOM event third). Upstream refuses the same shape from Angular's naming
guidance. Two independent authorities reaching one refusal is the strongest result a
ruling can get, and it is recorded because the ruling itself noted "the correct
answer and the cheap answer coincide here, which is worth saying because they often
do not".

**F3 — the applied arbiter is MEASURABLY SILENT on two constructs this lane must
refuse.** `seed = input()` draws ZERO messages (upstream keeps `prefer-signals` in
`all`, not `recommended`), and `[(ngModel)]="draft"` draws ZERO messages
(`banana-in-box` reports only the `([x])` misordering, never the construct). Both
measurements are asserted in the gate test. **This is why `no-signal-members` and
`no-two-way-binding` are frameless-owned policies rather than delegated ones** — and
`no-signal-members` in particular is the only thing standing between this emitter and
a pre-empted T005 ruling.

**F4 — the corpus is FIFTEEN event records, confirmed a third time.** 1 / 7 / 7,
zero natural `(hostNodeId, eventName)` collisions, four of S3's seven carrying
`syncPolicy`. Matches T002 and T003a; T001's 14 remains refuted. The emitter asserts
the template↔record join in BOTH directions, so a record no host references and an
id on two hosts are each named throws.

**F5 — the arbiter's practical yield on this corpus is near zero, and its keep is
earned by calibration.** T002's dissent 2 predicted it and the prediction holds:
`@for` closes the require-each-key hole at the compiler, and most of what
`recommended` covers (lifecycle interfaces, output naming, `inputs:` metadata,
`prefer-inject`) is machinery this emitter does not produce. Recorded so a clean
result is not read as the arbiter being pointless — and equally so nobody
manufactures a finding to justify it.

---

## 7. Flagged for T004 — measurement obligations, not conclusions

**R1 — `[value]` / `[checked]` are PROPERTY bindings and their served payload is
UNMEASURED.** The IR declares `value` and `checked` as `kind: 'property'`, so this
emitter spells them `[value]` / `[checked]`, faithfully. Whether Angular's SSR
renders a property binding into the served `value="…"` **attribute** that the other
four lanes emit is **not established**. It cannot be established from a golden —
that is precisely the inference error the board's S3 trail records three times — and
if it turns out Angular omits the attribute, S3's `served.text` observation is where
it will surface. **Do not resolve this by changing the emitter to `[attr.value]`
without a measurement**; the IR says property.

**R2 — emitted components are OnPush-checked.** Not a defect; a fact. Angular 22
scaffolds are also ZONELESS, so the change-detection notification for a state write
arrives via the **template listener**, not via a zone patch. Every write in this
corpus happens inside a lowered method invoked from a template `(event)` binding,
which is the notification path Angular documents — but that is reasoning, and T004
owes the measurement.

**R3 — the selector prefix is `frameless-`.** `ng new` scaffolds `prefix: "app"`.
`component-selector` is not in the applied set so nothing here objects, but T004 will
meet the scaffold's own lint config.

**R4 — the dev-warning sink is still owed by T004**, per T002. NG0912/NG0913
hydration-node mismatches are `console.warn`, which witness 0.7.0 cannot see, and
they only happen in the demo.

---

## 8. Deviations from the ruling text, with reasons

1. **The qualification name set includes ORDINARY COMPONENT LOCALS**, not only
   "state, props including `onTrace`, derived" as T003a's restatement enumerates.
   S1's `prefix` is an ordinary local that this emitter promotes to a class member,
   and the `derived` getter reads it; omitting it would leave `prefix` bound to
   nothing. The set is still exactly what the restatement requires it to be — a
   DECLARED IR FACT known before any body is read (`component.props.entries` ∪
   `component.locals[].names`).
2. **Method parameters are `: any`, not `event: Event`** as ruling 3d's signature
   sketch spells it. A real `Event` makes `event.currentTarget.value` a type error at
   T004, and the IR carries no type (IR-8). Read as a shape sketch, not a typing
   ruling. See §4.
3. **`_event` when the IR declares no parameter.** See §3.
4. **No `.gitignore`** was created in the package although `allowed_files` permits
   one. The Vue and Solid lanes' `.gitignore` files exist to hide vitest BROWSER
   artifacts; this package is node-only and has no browser lane, so the file would
   have had nothing to say.
5. **No `oxfmt`.** `src/format-emitted.ts` is an ASSERTION over emitted text rather
   than a rewrite, following Vue and Svelte — but for a different reason worth
   stating: `oxfmt` parses `.ts` perfectly well and the react/solid/qwik lanes use
   it, but it is not resolvable from `packages/frameworks/angular` and adding it
   would move `pnpm-lock.yaml`, which is a T003 stop_if.
