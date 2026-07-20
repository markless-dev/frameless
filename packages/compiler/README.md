# @frameless/compiler

Compiler extension over `@markless/compiler`. It reimplements nothing from Markless: the
convenience `buildEnrichedIr` wrapper parses author source with `@tsrx/core`, asks the vendored
Markless compiler for its semantic graph, and runs the Frameless extension pass.

## Pass and artifact contract

Passes declare `consumes` and `produces`, are registered in a topologically validated DAG, and
may emit deterministic diagnostic dumps. The `enriched-ir` pass consumes
`tsrx-semantic-graph` and produces `frameless-enriched-ir`.

The output artifact version is `frameless-enriched-ir/1`. Its pipeline boundary is deliberately
three-way: Markless owns parsing semantics and the semantic graph; this package owns only the
AST-to-semantic-record join and enriched IR; future framework packages own emission, gates, and
runtime calibration.

## v0 limits

Version 1 accepts exactly one exported component per `.tsrx` file and rejects cross-file relative
component imports and unsupported component template nodes. Output is JavaScript-only: declaration
generation and sourcemaps are deferred until the version decision is reopened. It does not run
Markless payload, public-render, locator, resume, or symbol passes.

`dumpEnrichedIr` recursively sorts object keys while preserving semantic array order and adds one
trailing newline, keeping checked-in goldens byte-identical.
