# @frameless.md/core

The Frameless authoring surface. This package makes the README hero import real:

```ts
import { state } from '@frameless.md/core';
```

It re-exports the compile-time authoring constructs (`state`, `computed`, `element`, `shared`)
and their types from `@markless/core`, the canonical authoring package the `.tsrx` compiler
recognizes. The compiler rewrites every recognized call before runtime, so these functions never
execute in compiled output; calling one from plain runtime JavaScript throws
`FrameworkApiRuntimeError` with a diagnostic explaining that the file must be compiled first.

## Surface contract

The export list is derived from the compiler's recognized authoring constructs and held closed in
both directions:

- `src/surface-contract.ts` fails `pnpm check` if the compiler's `GraphBindingKind` union grows an
  importable construct this package does not export.
- `test/authoring-surface.test.ts` re-derives the construct list from the compiler's own source
  structurally at test time and fails if the surfaces drift.

Publishing to npm is deliberately out of scope for this package right now; it exists so the
specifier resolves inside the workspace exactly as written.
