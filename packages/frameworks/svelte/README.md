# `@frameless/svelte`

Emits Svelte 5 single-file components from `frameless-enriched-ir/2`.

Landed by `docs/goals/frameless-svelte-v1` T003. The measurements every design
choice here rests on are in
`docs/goals/frameless-svelte-v1/notes/T003-svelte-emitter.md`; this file is the
short version.

```
src/emitter/    IR  ->  .svelte source
src/gate/       policies over emitted .svelte, via svelte/compiler's own parser
src/format-emitted.ts   an ASSERTION over emitted text, not a formatter
generated/      the checked-in S1/S2/S3 corpus, byte-equal to a fresh emission
```

Regenerate with `pnpm --dir packages/frameworks/svelte regenerate`; the goldens
are pinned by a byte-equality freshness test, so a stale artifact is a red test
rather than a surprise.

## What the lowering looks like

Svelte 5 runes are unusually close to the IR, so most of it is a direct mapping
with **no expression rewriting at all** — `state(1)` becomes `$state(1)`,
`computed(() => e)` becomes `$derived(e)`, and `count++` stays `count++`.

Two places are not direct:

- **`once-per-instance` locals** are wrapped in `untrack(() => …)`. The IR
  declares that lifetime; Svelte's `state_referenced_locally` warning fires on
  exactly the unwrapped shape. Same lowering the Solid emitter uses.
- **The template layout** moves every line break to just before an element's
  final `>`, so no sibling boundary carries whitespace. Svelte keeps
  inter-sibling whitespace as a single space while JSX drops it, so the naive
  layout would make emitted text content diverge from the React and Solid lanes.
  Void elements are therefore emitted as `<input>`, never `<input />`.

## What it refuses to emit

Fail-closed beats untested. Each of these throws with a message naming the
reason rather than guessing a lowering:

`stopPropagation` (IR-5 — zero corpus instances, so the `on()` path would be
untested dead code) · `bind:` / `$bindable` (IR-1, out of scope, dev-only
failure mode) · early component guards · a statement-bodied computed · a keyed
repeat with an index binding or a non-empty fallback · an `{:else if}` arm ·
prop defaults · nested prop paths · persistence-bearing IR · composition and
shared/handle constructs · any Svelte warning it does not have a sanctioned
suppression for.

## The baseline form inventory

IR-4 is deferred and the idiom policy's version corollary is **not** amended, so
this emitter discharges the corollary's second conjunct the other way: it emits
only baseline-version-safe forms. That is a claim about output, and
`BASELINE_FORM_INVENTORY` in `src/gate/index.ts` is where it is asserted rather
than assumed — an explicit allowlist of every rune name, imported `svelte` API,
template node kind, event-attribute shape and `svelte-ignore` code the emitter
may produce, each with the version floor claimed for it and an honest
`verified`/`unverified` status for that floor. Emitted output carrying a form
that is not on the list is a red gate, so `{@attach}` (5.29), `$state.raw`
(5.19), `on` from `svelte/events` or a camelCased `onClick` cannot arrive
unnoticed.

Every floor reads `unverified` today, with the reason attached. The resolved
package dates exactly the members that arrived after 5.0 — `@since 5.20.0` on
`$props.id` — and says nothing about `$state`, `$derived`, `$props` or
`untrack`; an absent tag is not a floor.

One entry is a precondition rather than a form: an emitted `svelte-ignore`
annotation in a module containing **no rune** is a violation. Measured at
5.56.8, Svelte only validates suppression codes in runes mode
(`src/compiler/utils/extract_svelte_ignore.js:38`) — in a runes-free module an
unrecognised code produces no diagnostic at all and suppresses nothing.

## Verification

`emit()` verifies its own output before returning it: the source must compile
warning-free in `client` and `server` generation at `dev: true`, **and**
compiling it with the `svelte-ignore` annotations stripped must yield exactly the
codes it chose to suppress. Svelte does not report a redundant `svelte-ignore`,
so without that second half an over-firing suppression would be invisible.

`pnpm --dir packages/frameworks/svelte test` runs the node lane: the emitter, the
gate corpus, and the `compile()` warnings oracle. Every policy carries a mutation
row proving it can reject, and every harness carries a calibration proving it can
throw.

`pnpm --dir packages/frameworks/svelte test:browser` runs the browser lane in
real Chromium, and it is also the third link in the root `pnpm test:browser`
chain. It drives the emitted components, holds the two delegation measurements as
standing checks, and — most importantly — **fails on any Svelte dev console
warning, not only errors**.

That last part is the reason this lane exists. The witness API behind `pnpm e2e`
cannot observe console warnings at all: `PageHandle` has no console accessor and
`PageOutcomeExpectation` exposes `consoleErrors` only. So the demo lane cannot
enforce the dev-warning constraint, and this is the only place that can. All 42
of Svelte's client dev diagnostics go through `console.warn`, there is no
allowlist, and the sink is calibrated three ways: it captures a planted
diagnostic, the guard is shown to throw, and a **real** Svelte
`lifecycle_double_unmount` is provoked from the real emitted component — asserted
on its dev-only message shape, which is what proves the corpus was compiled with
dev diagnostics enabled in the first place.
