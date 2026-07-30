# T001 — The data-fetching door, measured in six lanes

Probe: `probes/async-door/`. Re-run with

```
node probes/async-door/run.mjs            # the table
node probes/async-door/run.mjs --shapes   # plus every emitted byte
node probes/async-door/typecheck.mjs      # the Angular supporting arm
```

Nothing in this probe is installed, none of it is a workspace member, and it
touches no product file. Delete `probes/async-door/` and nothing changes.

---

## The one-line answer

**`computed(async …)` is closed in all six lanes, and it is closed twice before
any emitter is reached.** But **fetch, streaming and optimistic
write-then-revert are all authorable in all six lanes today** — through
`async` event handlers, which the corpus already proves at S8. The door the
board asked about is shut; a different door, next to it, is open.

---

## Three corrections to the dispatch

**1. The authoring surface is not `state`, `computed`, `element`, `shared`.**
There is a fourth template control-flow construct alongside `@if` and `@for`:
an async boundary spelled `@try` / `@pending` / `@catch`. It is not in the
charter, not in `goal.md`, and has zero instances in the corpus. The Markless
parser has it (`@tsrx/core`'s `parseTryStatement`, keyed on
`#templateControlFlowTryDepth`) and the Markless semantic compiler *demands*
it. This also answers board question (a): **`@pending` is the spinner**, a
declared template arm rather than a value derived from a nullable.

**2. The type surface already unwraps promises.** `@markless/core` declares

```ts
type AsyncComputedValue<T> = T extends Promise<infer Value> ? Awaited<Value> : T;
declare function computed<T>(derive: () => T): AsyncComputedValue<T>;
```

and `@frameless.md/core` re-exports `AsyncComputedValue` today. The vendored
`@markless/compiler` carries a whole async machine —
`PayloadAsyncBoundary`, `async-computed-runner`, `async-boundary-update`,
per-arm records. So the door is *designed upstream* and *unimplemented
downstream*. The refusal is Frameless's, not Markless's.

**3. "Zero `computed(async …)` in the corpus" is right, but the reason matters.**
It is not that nobody tried. It is that the shape cannot be represented:
`frameless-enriched-ir/2` has a closed set of template node kinds and the async
boundary is not one of them.

---

## The two gates in front of the six lanes

`buildEnrichedIr` never gets a chance to hand an async-computed template read to
an emitter, because two gates refuse first. Both are **uniform across all six
lanes** — they are compiler results, not lane results.

| gate | scenario | verbatim |
|---|---|---|
| Markless semantic compiler | `P0-bare-read` | `Markless semantic compilation failed for src/P0-bare-read.tsrx: MARKLESS_ASYNC_BOUNDARY_REQUIRED: Cannot read async computed "greeting" outside @try/@pending/@catch. Wrap the read in an async boundary.` |
| Frameless IR builder | `P1-basic` | `Unsupported template construct JSXTryExpression cannot be represented in frameless-enriched-ir/2.` |

Read together they are a closed pincer: **you may not read an async computed
without the boundary, and you may not use the boundary.** The throw site is the
final fall-through of `buildTemplateNode` in `packages/compiler/src/build.ts`,
which knows `JSXElement`, `JSXFragment`, keyed repeats, branches and
`BlockStatement`, and nothing else.

---

## THE SIX-LANE DOOR TABLE

`EMITS` means `emit(ir)` returned. `REFUSES` is verbatim below. `n/a` means the
scenario never reached an emitter.

| scenario | react | solid | qwik | svelte | vue | angular |
|---|---|---|---|---|---|---|
| `P0-bare-read` — async computed read bare | n/a | n/a | n/a | n/a | n/a | n/a |
| `P1-basic` — async computed in `@try/@pending/@catch` | n/a | n/a | n/a | n/a | n/a | n/a |
| `P2-unread` — async computed, callback prop | REFUSES | REFUSES | REFUSES\* | REFUSES | REFUSES | **MISBEHAVES** |
| `P3-handler-read` — async computed read in a handler | REFUSES | REFUSES | REFUSES\* | REFUSES | REFUSES | **MISBEHAVES** |
| `P7-promise-prop-computed` — async computed, promise prop | REFUSES | REFUSES | REFUSES | REFUSES | REFUSES | **MISBEHAVES** |
| `P4-handler-fetch` — async handler, callback prop | EMITS | EMITS | REFUSES\* | EMITS | EMITS | EMITS |
| `P5-streaming` — 3 awaits, callback prop | EMITS | EMITS | REFUSES\* | EMITS | EMITS | EMITS |
| `P6-optimistic` — write-then-revert, callback prop | EMITS | EMITS | REFUSES\* | EMITS | EMITS | EMITS |
| **`P8-promise-prop-streaming`** — 3 awaits, promise prop | **EMITS** | **EMITS** | **EMITS** | **EMITS** | **EMITS** | **EMITS** |
| **`P9-promise-prop-optimistic`** — write-then-revert, promise prop | **EMITS** | **EMITS** | **EMITS** | **EMITS** | **EMITS** | **EMITS** |
| `PA-self-contained-delay` — `new Promise` inside the handler | EMITS | EMITS | EMITS | EMITS | EMITS | REFUSES† |
| `PB-zero-prop-control` — **no async at all** | EMITS | REFUSES‡ | EMITS | EMITS | EMITS | EMITS |
| `PC-global-identifier-control` — **no async at all** | EMITS | EMITS | EMITS | EMITS | EMITS | REFUSES† |

\* Qwik's refusal on the callback-prop rows is **not about async** — see
"confounds", below. † Angular's refusal is **not about async** — `PC` is
synchronous and refuses identically. ‡ Solid's refusal is **not about async** —
`PB` is synchronous and refuses identically.

### Verbatim refusals — async computed (P7, the confound-free row)

- **react** — `Emitted React module failed collision verification: 'await' is reserved in an async/module context and cannot be used as an identifier; Expected a semicolon or an implicit semicolon after a statement, but found 'ready'`
- **solid** — `Unsupported async state construct in computed binding computed:greeting`
- **qwik** — `Emitted Qwik module failed output verification: 'await' is reserved in an async/module context and cannot be used as an identifier; Expected ')' after function arguments, but found 'props'`
- **svelte** — `Cannot use \`await\` in deriveds and template expressions, or at the top level of a component, unless the \`experimental.async\` compiler option is \`true\`` followed by `https://svelte.dev/e/experimental_async`
- **vue** — `Emitted Vue module P7PromisePropComputed.vue did not compile with an empty diagnostic set: compileScript(ssr=false, prod=false): [vue/compiler-sfc] Unexpected reserved word 'await'. (4:33)` — repeated for all four `ssr`/`prod` modes
- **angular** — *does not refuse.* See below.

On `P2`/`P3` (callback prop) qwik instead says `Qwik computed greeting cannot
invoke a callback prop`, and react/vue name `load` where P7 names `ready`.
Everything else is identical.

### Angular is EMITS-BUT-MISBEHAVES, and it is the only one

Angular emits this for `P7`:

```ts
export class P7PromisePropComputed {
	@Input() ready!: Promise<string>;
	get greeting(): any {
		return await this.ready;
	}
}
```

A **non-`async` getter containing `await`**. That is not valid TypeScript.
`probes/async-door/typecheck.mjs` writes every Angular emission out and runs
`tsc` over it:

```
probes/async-door/emitted/P2-unread.ts(13,10):               error TS1308: 'await' expressions are only allowed within async functions and at the top levels of modules.
probes/async-door/emitted/P3-handler-read.ts(14,10):         error TS1308: ...
probes/async-door/emitted/P7-promise-prop-computed.ts(13,10): error TS1308: ...
```

TS1308 lands on **exactly the three async-computed scenarios and on none of the
five async-handler ones** — a difference the constant per-file TS2792 noise
cannot fake.

**Why Angular alone.** Five of the six emitters verify their own bytes before
returning: react re-analyzes (`reanalyzeFunction`), solid re-analyzes
(`reanalyzeExpression`) *and* carries an explicit guard, qwik re-analyzes, vue
runs `compileScript` in all four ssr/prod modes, svelte runs `compile(`. The
Angular emitter has **no output-verification step at all**. Its `EMITS` is not a
capability — it is an unchecked lane. Solid's guard is worth quoting because it
is the only *intentional* refusal of the six, inside `validateEnrichedIr` in
`packages/frameworks/solid/src/emitter/index.ts`:

```ts
if (binding.async || binding.asyncCapable)
    throw new Error(`Unsupported async state construct in ${binding.kind} binding ${binding.id}`);
```

React, by contrast, accepts `async`/`asyncCapable` as known keys in its
validator and has **no guard** — it produces `const greeting = await load();` in
a non-async component function and is saved only by re-analysis downstream.

---

## Confounds found and removed

This probe refuted three of its own readings. Each would have been reported as a
sixth async refusal.

1. **Qwik on `P2`–`P6` is a callback-prop rule, not async.**
   `Qwik computed greeting cannot invoke a callback prop` comes from
   `callbackCalls(computedExpression, callbacks).length` — it fires on any
   callback-prop call in a computed, sync or not.
   `Qwik v1 callbacks must be observational expression statements in event:0`
   fires because `const next = await load();` is a *declaration*, not an
   expression statement. S8 dodges both by typing its prop as a promise-**valued**
   `ready: Promise<string>`. `P7`/`P8`/`P9` copy that shape — and with the
   confound gone **Qwik emits streaming and optimistic updates**, and refuses the
   async computed for a genuinely async reason.

2. **Solid on `PA` is a zero-prop defect, not async.**
   `ComponentProps has dangling graph record id: prop:props` reproduces on `PB`,
   a component with one state cell, one synchronous handler and **no props and no
   async whatsoever**. Standing Solid-lane defect, unrelated to this board, and
   it lands on the Codex clone: prop-less components are ordinary.

3. **Angular on `PA` is a global-identifier rule, not async.**
   Measured across six globals — every one refuses:

   | identifier | angular |
   |---|---|
   | `setTimeout` | REFUSES |
   | `new Promise` | REFUSES |
   | `Promise.resolve` | REFUSES |
   | `fetch` | REFUSES |
   | `JSON.parse` | REFUSES |
   | `Date.now` | REFUSES |

   Verbatim: `Angular emitter cannot resolve the identifier "Date" in a
   transplanted body: it is neither a body-local binding, a function parameter, a
   @for variable, nor a declared component member (label, stamp). The emitter
   throws rather than guessing whether it is a global`. `PC` is fully
   synchronous and refuses identically. **This is the widest-blast-radius finding
   on the board**: every primitive data fetching is made of is a global, so in
   the Angular lane async work must arrive through a prop or a declared member.
   That is precisely why `P8`/`P9` emit there and `PA` does not.

---

## The three questions the apps need

**(a) Can the resolved value be read, and is a pending state observable?**
Not through `computed(async …)` — the read is refused before any emitter
(P0/P1), and P3 shows that even a *handler-side* read of an async computed is
refused in five lanes and miscompiled in the sixth. `@pending` is the intended
spinner and is unrepresentable in `frameless-enriched-ir/2`.
**But a pending state is trivially observable without it**: a `state` cell
flipped `true` before the `await` and `false` after. All six lanes emit that
(`P8`), and it drives `disabled={pending}` as an ordinary dynamic attribute.

**(b) Does a second resolution update the view? — YES, in all six lanes.**
`P8` awaits three times, writes after each, and every lane emits. React's
lowering is the interesting one, because DEFECTS 12.2(a) is exactly the hazard:

```jsx
const first = await chunk;
const nextTranscript2 = nextTranscript + first;
setTranscript(nextTranscript2);
const second = await chunk;
const nextTranscript3 = nextTranscript2 + second;
setTranscript(nextTranscript3);
```

Each post-`await` read chains off the previous local, never off the stale render
closure. Qwik reads `transcript.value` live. **Streaming, as repeated resolution
driving repeated view updates, is authorable in all six lanes today.**

**(c) Is an optimistic write-then-revert expressible? — YES, in all six lanes.**
`P9` emits everywhere: capture previous, write optimistic, `await`, then
`title = ok ? title : previousTitle`. Every conditional is an **expression** and
every write is top-level and unconditional, per DEFECTS 8.1. The array case
(`rows.map(...)` with a keyed repeat over it) emits too.

---

## Lane limits recorded, not chased

- **Qwik SSR serializer awaits promises.** `P8`/`P9` pass a promise-**valued**
  prop, which is a value an SSR serializer would await — the S8 click-armed-gate
  story. `PA` removes it by creating the promise inside the handler, and Qwik
  emits that too. Not chased further; this probe measures emission, not SSR.
- **Angular's global ban** (above). A lane limit with a workaround shape, not a
  defect to fix here.
- **Solid's zero-prop refusal** (above).
- No emitter, no IR and no authoring-surface file was modified. Measuring was the
  whole task.

---

## What this leaves for T002

Buildable in all six lanes today: fetch-on-interaction, an observable pending
state, repeated resolution (streaming), optimistic write-then-revert, and
local filtering. **Not buildable in any lane: fetch-on-render** — there is no
lifecycle hook and `computed(async …)` is closed, so nothing can start a fetch
without a user action. Any app spec that says "loads its data when it appears"
must be narrowed to "loads its data when the user asks", or the IR must grow a
template node kind — which is out of this board's scope.

Angular additionally cannot call any global from a handler, so its async source
must be a prop or a declared member.
