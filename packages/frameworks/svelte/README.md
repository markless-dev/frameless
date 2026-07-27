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

## Known gap

There is **no browser lane yet**. Vitest browser mode needs
`@vitest/browser-playwright` and `playwright`, neither of which resolves from
this package, and adding them moves `pnpm-lock.yaml`. That lane is the sole
enforcement point for Svelte's dev-only console warnings — the witness API used
by `pnpm e2e` cannot observe console warnings at all — so until it lands, the
dev-warning evidence in the T003 note is a measurement rather than a standing
check.
