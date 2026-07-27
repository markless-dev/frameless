# `@frameless/angular`

Emits Angular 22 standalone single-file components from `frameless-enriched-ir/2`.

Landed by `docs/goals/frameless-angular-v1` T003. The measurements every design
choice here rests on are in
`docs/goals/frameless-angular-v1/notes/T003-angular-emitter.md`; this file is the
short version.

```
src/emitter/    IR  ->  .ts source (one @Component class per module)
src/gate/       policies over emitted .ts, via @angular/compiler's own
                parseTemplate AND @angular-eslint, the framework's own arbiter
src/format-emitted.ts   an ASSERTION over emitted text, not a formatter
generated/      the checked-in S1/S2/S3 corpus, byte-equal to a fresh emission
```

Regenerate with `pnpm --dir packages/frameworks/angular regenerate`; the goldens
are pinned by a byte-equality freshness test, so a stale artifact is a red test
rather than a surprise.

**This package is NODE ONLY.** No browser lane, no playwright, no
`vitest.config.ts`, and no `@angular/core` / `@angular/build` / `@angular/cli`
dependency. `@angular/build` lists `vite: 7.3.6` as an **exact** dependency while
this workspace is pinned to vite 8, so keeping the Angular *build* entirely out of
this package is what guarantees the two vites never meet — `frameless-angular-v1`
T002 discharged that structurally rather than by policy.

## Forced lowering is the defining constraint, and it is measured

For react, solid, qwik, svelte and vue the emitter picks a handler **shape**. For
Angular it must **transform**: Angular's template expression grammar has **no
`UpdateExpression` node at all**, so S1's `count++` is unexpressible at any binding
site. `test/parse-emitted.test.ts` measures that against `parseTemplate` rather
than citing it — and it also records that the charter's *stated* reason (that
arrow functions are forbidden) went stale at 22.0.8, where
`class ArrowFunction extends AST` is declared.

**All fifteen event records are lowered to class methods, unconditionally.** T001
counted 2 of its 14 inlinable and the Judge counted 6 of the real 15; that
disagreement *is* the ruling, because a judgement call about a grammar boundary
inside an emitter is drift. Uniform lowering deletes the question.

- **Name:** `on<HostNodeId><EventName>`, upper-camelled from declared IR fields
  (`h7` + `input` → `onH7Input`). Never the IR id `event:N`, never a counter — an
  index would rewrite every downstream name when a handler is inserted upstream.
  A collision **throws**; a planted-duplicate row proves it fires.
- **Signature:** every enclosing `@for` variable outermost-first, then the event —
  **always**, whether or not the body reads them. S1's increment never touches its
  event and still receives `$event`. The method keeps the IR's own parameter name;
  when the IR declares none (S1) the emitter invents `_event`, which is a choice of
  *name* driven by the handler's declared signature, not a choice of *shape* driven
  by its contents — and it keeps this repository's own `no-unused-vars` pass quiet
  on generated output.
- **Body:** transplanted with **exactly one** transformation.

## The one transformation, and why it is not a content trigger

Every free identifier that resolves — under ordinary lexical scoping, with
body-locals, lambda parameters and `@for` variables shadowing — to a name in the
component's **declared binding set** is qualified as `this.<name>`. Operators are
untouched (`next++` → `this.next++`). Nothing else moves: not `event`, not
body-local `const`, not lambda parameters, not `@for` variables.

Ruling 3a's forbidden content trigger was a *discriminating predicate over body
contents selecting between two emission shapes*. This is a **total function**
applied identically to every handler, over a name set that is a declared IR fact
known before any body is read. Same admissibility ground as ruling 3d's `@for`
variables.

**There is no globals allowlist.** The corpus references zero globals, so one
would be untested dead code; an unresolvable identifier is a named throw, proven
by a planted `Math.random()`. The IR's other statement-injecting channel
(`records.persistence`, which injects `__framelessWrite(…)`) is refused whole, so
that identifier can never arrive either.

## The emitted shape

```ts
@Component({ selector: 'frameless-render-once', template: `…` })
export class RenderOnce implements OnInit { … }
```

What is **deliberately absent** from the metadata, because the absence is the
decision:

- **No `changeDetection`.** At Angular 22 **OnPush is the default** and
  `prefer-on-push-component-change-detection` — which **is** in the applied set —
  reports only an explicit opt-out. **Emitted components are OnPush-checked**; a
  downstream lane must not assume eager change detection.
- **No `standalone`.** It defaults to `true` from Angular 19. This is the entry
  that sets `ANGULAR_BASELINE_FLOOR`.
- **No `imports`.** Built-in control flow needs none — a second reason `@if`/`@for`
  beat `*ngIf`/`*ngFor`, the first being that `prefer-control-flow` is in the
  applied set and reports the directives directly.
- **No signal member anywhere.** `input()`/`output()`/`signal()` were ruled
  NO-SUGAR twice independently and T005 re-runs the six gates against this landed
  lane; shipping one would hand T005 a fact to ratify. The applied arbiter is
  **measurably silent** here (`prefer-signals` lives in upstream's `all`, not
  `recommended`), so `no-signal-members` is a frameless-owned policy.

**Component locals are initialised in `ngOnInit`, never as field initialisers.** A
field initialiser runs at *construction*, before Angular has written a single
`@Input`, so `prefix = \`${this.label}:\`` would read `undefined` and
`this.onTrace('setup', …)` would call it. Every local goes there **uniformly**,
including `count = 1` which would have been safe — splitting on "does this
initialiser read a prop?" is ruling 3a's refusal. A `computed` binding becomes a
**getter** instead, which Angular re-evaluates on every change-detection pass.

## Everything is `: any`, and that is IR-8 recorded, not closed

`PropDestructuringEntry` carries no type, so any emitted type would be inferred
from what the corpus happens to do with the member — a content trigger (Gate 3),
unsound outside the exercised subset (Gate 4). **So a green here must not be
over-read:** `strictTemplates` types `$event` at all fifteen lowered call sites and
validates every `@for` track expression, and an `any` member defeats it exactly as
it defeats `svelte-check`. The annotation is not decoration either — the scaffold's
`strict` implies `noImplicitAny`, and a bare `count;` is TS7008. `event: Event` is
refused for the opposite reason: the real DOM type makes `event.currentTarget.value`
a type error, so emitting it would be the emitter inventing a type to look better
typed than it is.

`generated/` is deliberately **outside every tsconfig here**. Emitted output
imports `@angular/core`, and it is typechecked at T004 by a real `ng build`.

## Whitespace is measured, and Vue's answer does **not** transfer

Angular's `preserveWhitespaces: false` default drops whitespace-only text nodes and
collapses runs of **two or more** whitespace characters to one space — but a lone
newline survives verbatim. Measured at 22.0.8 through `parseTemplate`:

| shape | result |
| --- | --- |
| newline (or a bare space) between two ELEMENTS | removed |
| a text child on its own line | `increment` becomes **`" increment\n"`** |
| newline between an INTERPOLATION and text | `1/2` becomes **`1\n/2`** |
| a **lone interpolation** child on its own line | **both edges survive** |

That last row **refutes the Vue lane's measurement**, which found the same shape
safe and therefore recorded its identical inline rule as merely conservative. Here
the rule is *required*. Inheriting Vue's answer instead of re-running it would have
shipped that arm silently wrong.

So the emitter breaks a run of children across lines only when **every** child
renders as an element or a control-flow block, and inlines the whole run otherwise.
`whitespace-stable-text` in the gate re-checks the *result* off Angular's own
parsed template, covering plain `Text` and interpolation literal segments alike.

## The arbiters

**Compiler first.** `@angular/compiler`'s `parseTemplate` runs inside `emit()` and
again as a gate policy, asserted as an **exactly empty** error set over all three
templates. It answers this board's central question directly: did forced lowering
produce a template Angular accepts?

**`@angular-eslint` second**, and its applied set is **derived, not hand-picked**.
Neither leaf plugin publishes a config — `@angular-eslint/eslint-plugin` exports
only `rules` (50) and `@angular-eslint/eslint-plugin-template` only `processors`
and `rules` (41), which **refuted T002 ruling 4's premise**. The presets live only
in the meta package, which is forbidden here for a measured reason (its base
entries carry only `parser` and `plugins`, and it drags `@angular/cli >=22 <23`).

The set is therefore derived from `meta.docs.recommended === 'recommended'` — the
**same metadata upstream's own generator reads**, whose output header says
`DO NOT EDIT THIS FILE`. 12 of 50 TS rules, 4 of 41 template rules.

The **one** frameless-authored delta is an **addition**:
`use-lifecycle-interface`, which upstream publishes in `ts-recommended` at `warn`
while its metadata carries no flag. **Zero omissions.** An additions-only delta
cannot be used to make a corpus green, which is what preserves independence — and
the ordering is the argument: the set was fixed by upstream's metadata *before* the
corpus was measured, and the measurement came back clean.

The four rules that fired during T003's first attempt (`component-class-suffix`,
`prefer-signals`, `template/button-has-type`, `template/i18n`) are all **outside**
that set and dissolve. No class was renamed and no `type=` was added.

**Its practical yield on this corpus is near zero**, and that is recorded rather
than hidden: `@for` makes `track` syntactically mandatory, so the "compiles clean
and is wrong" class that earned the Vue and Svelte arbiters their keep is closed at
the *compiler* here. This arbiter's keep is earned by its planted-violation
calibration — six of them, across both plugins.

## What it refuses to emit

Fail-closed beats untested. Each throws with a message naming the construct and the
reason:

- persistence-bearing IR, composition/shared/handle constructs, more than one
  component per artifact, an export that is not the component's own name
- an early component guard — a component class has no return statement to guard
- an **aliased prop**: the only Angular spelling is `@Input('alias')`, which
  `no-input-rename` — a rule *inside* the applied set — reports
- a declared `stopPropagation`, a declared unconditional `preventDefault` the body
  does not spell, a prop default, a multi-segment prop path
- a `@for` index binding or empty fallback, a control-flow block whose children are
  not all block level
- an event record no host references, an event id on two hosts, a lowered method
  name a member already owns
- template text or an expression carrying a backtick, `${`, `{{` or a backslash —
  all of which would break out of the TypeScript template literal the inline
  template lives in
- an identifier it cannot resolve, and any AST node the qualifier has not been
  taught
- output of its own whose template `parseTemplate` does not accept with an empty
  error set

## What T003 did NOT do

No demo, no e2e row, no scaffold, and **no Angular type check has seen this
output** — `demos/angular-official`, the sixth e2e row and `ng build` are all T004's.
T002 records that gap in its own dissent: `parseTemplate` covers **grammar only**,
which is strictly weaker than the Svelte lane's `compile()`. If T004 finds an
emitter defect, the ruled response is a T004a emitter-repair package, not widening
T004's `allowed_files`.

One flagged risk for T004, recorded here rather than left to be discovered: the IR
declares `value` and `checked` as **property** bindings, so this emitter spells them
`[value]` / `[checked]`. Whether Angular's SSR renders a property binding into the
served `value="…"` **attribute** the other four lanes emit is **unmeasured** and
belongs to a browser, not to a golden — the exact inference error the board's own
S3 trail records three times.
