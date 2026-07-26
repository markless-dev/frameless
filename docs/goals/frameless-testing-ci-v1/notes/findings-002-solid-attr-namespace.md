# Finding 002 — emitted Solid uses `attr:value`, which solid-js's own types reject

**Status:** open, recorded not fixed
**Found by:** T005's emitted-output type-check lane (audit item 2), on its first run
**Severity:** medium — user-facing for anyone consuming Solid output in TypeScript
**Not an inference artifact.** Unlike the other accepted diagnostics in that lane,
this one is not a limitation of type-checking untyped JS.

## What the lane reports

Three diagnostics, in `generated/S2.jsx` (×2) and `generated/S3.jsx` (×1):

```
TS2322 Type '{ "data-action": string; value: string; "attr:value": string;
  onInput: (event: InputEvent & { currentTarget: HTMLInputElement; ... }) => void; }'
  is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.
  Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.
```

The React lane produces no equivalent — this is specific to the Solid emitter.

## Why it is not a runtime bug

`attr:` is Solid's namespace prefix forcing a value to be set as an HTML
*attribute* rather than a DOM *property*. Solid's compiler handles it at build
time. The emitted components run correctly: `pnpm e2e` passes all nine three-way
cells, and the Solid browser lane passes 44/44, both of which exercise these
exact files.

So nothing is broken today.

## Why it still matters

Frameless's pitch is that its output is idiomatic code that drops into your
existing app. For a Solid user on TypeScript, it currently does not — not
cleanly. Copying `S2.jsx` or `S3.jsx` into a typed Solid project and renaming it
`.tsx` produces three type errors, in code they did not write and cannot
reasonably be expected to debug.

That is exactly the seam the audit's item 2 was meant to expose, and it took the
lane one run to find it. It is also the kind of defect no existing check in this
repo could have caught: the gate enforces rules we wrote, the browser lanes check
behavior, and `pnpm check` never looked at emitted output at all. Only a
third-party type-checker sees it.

## Open questions for whoever fixes it

Deliberately not answered here — this needs a decision, not a patch:

1. **Is `attr:value` necessary?** The emitter chose it over plain `value` for a
   reason (forcing attribute semantics on a controlled input). Whether plain
   `value` would preserve the behavior the S2/S3 scenarios assert is a
   compiler-behavior question, and this goal's charter forbids changing emitter
   behavior from a testing task.
2. **Or is this solid-js's typing gap?** Solid supports `attr:*` generically, so
   arguably `InputHTMLAttributes` should admit it. If so the right move is
   upstream, and the local action is documentation rather than emitter change.

## Status in the test suite

Per T003 Ruling 5, the case is **not** deleted and the lane is **not** weakened.
The three diagnostics sit in the Solid lane's `ACCEPTED` list, each labelled
`OPEN FINDING 002` with a pointer to this note, and the assertion is exact
equality — so if the emitter changes and they disappear, the lane fails and
forces this note to be revisited deliberately.
