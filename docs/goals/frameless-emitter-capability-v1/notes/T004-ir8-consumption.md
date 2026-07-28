# T004 - Step 2, IR-8 consumption: one lane landed, five lanes blocked on measurement

Status: **partial delivery, then STOP.** Angular prints IR-8 prop types and its Step 0
oracle reproduces against **emitted** output. React, Solid, Qwik, Svelte and Vue cannot
print a type today, and the reasons were measured rather than reasoned about.

## 1. The oracle, against emitted output

The card's oracle is Step 0's instrument re-run against output the emitter actually
printed. The angular arm was rebuilt from `probes/ir8-falsification/angular` with
`src/Child.ts` replaced by `packages/frameworks/angular/generated/S1.ts` **verbatim**,
and the control arm using `git show HEAD:…/generated/S1.ts` - the untyped emitted shape -
with the *same* wrong-typed call site. Three arms, `ng build` with AOT and
`strictTemplates`, `@angular/compiler-cli` 22.0.8:

| arm | child | call site | result |
| --- | --- | --- | --- |
| control | HEAD's **untyped** emitted `S1.ts` | `[multiplier]="'3'"` | **GREEN**, exit 0 |
| negative | T004's **typed** emitted `S1.ts` | `[multiplier]="'3'"` | **RED** `TS2322: Type 'string' is not assignable to type 'number'.` `negative/Parent.ts:8:48`, exit 1 |
| positive | T004's **typed** emitted `S1.ts` | `[multiplier]="3"` | **GREEN**, exit 0 |

That matches T001's hand-written angular row exactly, and the control arm keeps the
measurement causal: the annotation is the only variable. The probe rig was staged
outside the repo, because `probes/` is not in this card's `allowed_files`.

## 2. What Angular now prints

```ts
export class RenderOnce implements OnInit {
	@Input() label!: string;
	@Input() multiplier!: number;
	@Input() visible!: boolean;
	@Input() onTrace!: (name: string, detail: Record<string, unknown>) => void;
	setup: any;
	count: any;
	prefix: any;
```

Only `@Input()` members move. Locals, getters and every `$event` parameter stay `: any`,
because IR-8 supplies **prop** types only - a green here must not be read as "the emitted
class is typed".

`!` is load-bearing and was measured, not assumed: dropping it from `label` and running
the real `demos/angular-official` build reports
`TS2564: Property 'label' has no initializer and is not definitely assigned in the constructor`.
It is a definite-assignment assertion to TypeScript and is erased before Angular sees the
class, so it asserts no requiredness the IR does not carry.

## 3. The silent-garbage hazard this step nearly shipped

`PropDestructuringEntry.type` is in the dialect `@tsrx/core` (oxc) produces.
`yuku-codegen` prints the ESTree/typescript-eslint dialect. **They disagree on
`TSFunctionType`, and the disagreement is silent.** Measured at yuku-codegen 0.7.0,
handing the corpus's own `onTrace` node straight to `generate()`:

```
const x: () => ;      errors: []
```

Malformed text, zero errors. T002 flagged printing a function type as this step's real
risk and it was right for a sharper reason than it knew: a `structuredClone`-and-hope
converter - which is exactly what the emitters legitimately use for **value** nodes -
would have shipped that into emitted output with every instrument green, because no
instrument in this lane reads a type it did not itself print.

The converter is therefore total and fail-closed: every accepted node kind is named,
every forwarded field is copied by name, anything else throws. The accepted set is
exactly what the corpus authors (`TSStringKeyword`, `TSNumberKeyword`,
`TSBooleanKeyword`, `TSVoidKeyword`, `TSUnknownKeyword`, `TSTypeReference`,
`TSFunctionType`), so there is no branch nothing exercises.

Watched going red: removing **only** the `parameters`→`params` / `typeAnnotation`→
`returnType` rename regenerates `@Input() onTrace!: () => ;` and turns **20 tests** red
across `emitted-typecheck.test.ts`, `gate.test.ts` and `emitter.test.ts`. Removing the
type printing entirely turns 6 red.

## 4. A test that went vacuous the moment IR-8 landed, and passed while doing so

`angular/test/emitter.test.ts` carried
`test('every emitted declaration is ": any", which is IR-8 recorded not closed')`.
After the emitter started printing types **the title became false and the test stayed
green**: its count arm (`matchAll(/…: any;/gm).length > 2`) still saw
`setup`/`count`/`prefix`, and both anti-vacuity arms were aimed at *unannotated* members,
which `label!: string;` is not. The arms were one axis away from the question that
mattered.

Replaced with an expectation **derived from the golden**: every `@Input()` whose IR entry
has a `type` must print it with `!` and must not contain `any`; every entry without one
must print exactly `: any`. A final row pins `{ typedInputsSeen: 4, untypedInputsSeen: 15 }`,
so a corpus that lost its one annotated fixture - or annotated all of them - fails
instead of quietly making an arm vacuous.

## 5. The control arm is intact

T003 annotated `s1-render-once.tsrx` and nothing else. **No fixture was annotated by this
task.** Seven of the eight angular scenarios still carry zero prop types and their emitted
bytes did not move (`git diff --exit-code` over S2-S7, S9: exit 0). That absence is what
proves the four printed types came from source rather than being synthesized.

## 6. Why the other five lanes are blocked

Each lane's **real** `checkSources` was fed the emitted S1 with the type printed into it,
in the shape T001's probe proved that lane's checker accepts:

| lane | violations | owning file |
| --- | --- | --- |
| react | `component-shape` (yuku-parser `lang:'jsx'`), `eslint:parse` "Unexpected token :" | `react/src/gate/index.ts` |
| solid | `component-shape`, `eslint:parse` "Unexpected token :" | `solid/src/gate/index.ts` |
| qwik | `eslint:parse` "Unexpected token :" | `qwik/src/gate/index.ts` |
| svelte | `eslint:parse` "Complex binding patterns require an initialization value" | `svelte/src/gate/index.ts` |
| vue | `no-typed-props`, `eslint:parse` "Unexpected token ;" | `vue/src/gate/index.ts` |
| angular | **none** | - |

`packages/frameworks/*/src/gate/index.ts` is not in this card's `allowed_files`, and each
lane's `gate.test.ts` asserts `result.violations` is `[]` over `generated/`. Weakening
that assertion from inside `test/` - which *is* in scope - would be manufacturing the
vacuous-pass this project keeps catching, so it was not done.

**And the mechanical half is worse than a scope widening.** The four JS-parsing gates lint
with eslint's default parser (espree), which cannot parse any TypeScript annotation, so
they need `@typescript-eslint/parser`. Measured with `createRequire` from each gate:

```
react: NOT RESOLVABLE   solid: NOT RESOLVABLE   qwik: NOT RESOLVABLE   svelte: NOT RESOLVABLE
```

Only the angular package has it - which is exactly why angular is the lane that works.
Adding it means four `package.json` edits **and a lockfile move**, and `pnpm-lock.yaml` is
currently one of the three foreign dirty files this task was told not to touch.

## 7. Vue is blocked on a ruling, and `pnpm e2e` cannot discharge it

Vue's block is not a parser. `no-typed-props` fires on `node.typeParameters ||
node.typeArguments`, and `defineProps<T>()` is the **only** channel that types a Vue call
site - a cast of the return value types the local `props` variable and nothing about the
component's public props, and the runtime object form changes runtime harder, not less.

T010's Gate 5 basis was re-measured here rather than inherited, at vue@3.5.40, and it
reproduces exactly. Compiled props options:

```
array    => ['label','multiplier','visible','onTrace']
type-arg => { label: {type:String,required:true}, …, visible: {type:Boolean,required:true}, … }
```

Rendered:

| form | `visible` absent | `visible=""` |
| --- | --- | --- |
| array | `undefined` → FALSY | `""` → **FALSY** |
| type-arg | `false` → FALSY | `true` → **TRUTHY** |

plus a `[Vue warn] Missing required prop: "visible"` the baseline never emits. A
falsy→truthy flip is a rendering change, and it lands on the one corpus component that
could take the sugar.

**The brief named `pnpm e2e` as the instrument for showing the behaviour is unchanged.
That instrument is structurally incapable of seeing this.** Every demo binds
`visible={true}` explicitly - react, solid, qwik, svelte, vue and angular all do - so
neither the absent case nor the empty-string case exists anywhere e2e drives. A green
`pnpm e2e` on the type-argument form would have been true and would have proved nothing,
and reading it as the required proof would have shipped the rendering change under a
passing oracle.

## 8. What did not move

`pnpm check` is still **RED at 73**, unchanged, and this task could not move it. All 73
are in `packages/frameworks/react/generated/`, and angular's emitted output is in no
`pnpm check` project at all (`angular/tsconfig.json` includes `src/**`, `test/**`,
`scripts/**` only). The 40 implicit-any errors T012 measured are deleted by **react**
printing types, which is blocked above. No compiler option was reached for.
