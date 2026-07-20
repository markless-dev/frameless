# Frameless v0 product contract

Frameless compiles a deliberately bounded TSRX component surface into conventional
framework packages and proves generated targets behaviorally equivalent. The v0
product command will build the demo into React 19 and Solid outputs, run each
target's dossier-derived conventionality gate, and write oracle receipts.

## Package map

- `@frameless/compiler` owns source parsing, semantic-graph joining, enriched IR,
  validation, and compiler diagnostics.
- `@frameless/oracle` owns scenarios, adapters' common protocol, observation traces,
  verdicts, and `frameless-receipts/1` schemas.
- `@frameless/target-react` and `@frameless/target-solid` independently own their
  emitter, gate, framework adapter, idiom dossier, and version matrix.
- `@frameless/cli` owns the build entry and internal target registration.
- `demos/ui-kit` owns the bounded demonstration library, doctor, and receipt suite.

There is intentionally no published unified Target interface, standalone gate or
dossier package, Vite plugin, declarations pipeline, or sourcemap pipeline in v0.
`poc/**` remains an isolated evidence base with package-local lockfiles.

## Pipeline

1. Source to `frameless-enriched-ir/1` uses `@tsrx/core` parsing and vendored
   `@markless/compiler` semantic graphs. It does not invoke `@markless/core/vite`,
   `@markless/bundler`, or Markless public-render/runtime work.
2. IR to generated JS/JSX belongs to targets and uses no Markless package.
3. Generated JSX to executable browser modules belongs to oracle-owned,
   framework-specific Vite/Babel transforms.

The normative limits and ownership details live in the numbered specs in this
directory. [`specs/state.md`](../state.md) records implementation progress only.
