# @frameless/compiler

Builds the target-neutral `frameless-enriched-ir/1` artifact from one exported
`.tsrx` component. It parses source with `@tsrx/core`, joins the result to the
vendored Markless semantic graph, and does not run Markless rendering or runtime
pipelines.

See [`specs/framework/01-enriched-ir.md`](../../specs/framework/01-enriched-ir.md)
for the normative contract and v0 limits.
