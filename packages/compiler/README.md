# @frameless/compiler

Compiler extension over `@markless/compiler`. It reimplements nothing from Markless: the
convenience `buildEnrichedIr` wrapper parses author source with `@tsrx/core`, asks the vendored
Markless compiler for its semantic graph, and runs the Frameless extension pass.

## Pass and artifact contract

Passes declare `consumes` and `produces`, are registered in a topologically validated DAG, and
may emit deterministic diagnostic dumps. The `enriched-ir` pass consumes
`tsrx-semantic-graph` and produces `frameless-enriched-ir`.

The output artifact version is `frameless-enriched-ir/2`. Its pipeline boundary is deliberately
three-way: Markless owns parsing semantics and the semantic graph; this package owns only the
AST-to-semantic-record join and enriched IR; future framework packages own emission, gates, and
runtime calibration.

## Composition contract

Version 2 assigns module-stable component IDs, accepts exported and local components, preserves
relative TSRX imports and component-reference child subtrees, and records default projections,
same-module shared state, element handles, behaviors, and imperative handle calls. Ownership joins
fail closed when the pinned Layer A graph cannot identify exactly one component. Output remains
JavaScript-only; declaration generation and sourcemaps are deferred. The pass does not run Markless
payload, public-render, locator, resume, or symbol passes.

`dumpEnrichedIr` recursively sorts object keys while preserving semantic array order and adds one
trailing newline, keeping checked-in goldens byte-identical.
