# Enriched IR contract

`frameless-enriched-ir/1` is the target-neutral, deterministic JSON input to
framework emitters. The TypeScript schema in `packages/compiler/src/schema.ts` is
the executable authority; this document defines its meaning.

## Construction boundary

`buildEnrichedIr({ filename, source })` parses the source string with
`@tsrx/core.parseModule()`, calls only `@markless/compiler.buildSemanticGraph()`,
and joins the syntax tree to semantic identities. It must not request payload,
public-render, DOM, symbol-module, locator, resume, hydration, gate, dossier, or
framework artifacts. Filenames are normalized to module-relative slash paths.

## Module and component views

`version` is exactly `frameless-enriched-ir/1`. `imports` preserves semantic import
shape: local name, source, default/named/namespace kind, and optional imported name.
`module.exports` records default or named component exports. `components` preserves
source order and carries props destructuring, local declarations with initializer
ASTs, early guards, complete template trees, and the evaluation rule that ordinary
locals run once per instance while computed bindings remain reactive.

The template vocabulary is host, static text, dynamic text, branch with complete
arms, keyed repeat with row/empty subtrees, and fragment. Hosts retain Markless host
ids, tag, static attributes, dynamic attribute/property bindings, event ids, and
ordered children. Keyed repeats retain item/index names, collection and key
expressions, and complete row structure.

## Semantic records

`records.bindings` retains state, computed, element, and prop identities, declaration
and value kinds, initializer or computed ASTs, reads, and writes. `records.aliases`
uses deterministic `alias:<component>:<name>` ids because Markless aliases have no
ids, while preserving target, graph node, path, declaration kind, and span.
`records.events` retains event/host identity, sync policy, handler ASTs, reads, and
writes. Canonical read/write tables close every referenced graph id.

Reads and writes are structurally recovered from AST nodes, never parsed from
`functionSource`, handler strings, value strings, or snippets. A handler-local row
alias write projects to its state root using `*` in the row path and
`via: handler-local-alias`. Mutation of a copied temporary container is not a state
write.

## Serializable syntax and deterministic bytes

Every expression is a cycle-free, JSON-safe ESTree copy. Syntax-bearing fields,
node type, and source offsets remain; metadata, comments, locations, ranges,
parents, and paths are removed. `dumpEnrichedIr()` recursively sorts object keys,
preserves semantic array order, and appends one newline. Record arrays use stable,
locale-independent structural ordering. The S1–S3 `/1` goldens are byte contracts
and must not be regenerated merely for path movement.

## v0 limits

Input is exactly one exported component per `.tsrx` file. The compiler fails closed
for zero, unexported, or multiple components and for relative imports, because v0
does not support cross-TSRX component imports. The supported language is the proven
S1–S3 fixture family plus compile-only prop-alias coverage.

Generated output is JS/JSX only. v0 has no `.d.ts`, sourcemaps, composition,
children/slots/context, refs, custom components, async semantics, cleanup/attach,
styling, SVG/MathML, SSR/hydration/resume, HMR, or generated-code debugging. If
declarations, type-preserving output, or sourcemaps become required, the `/1` and
`/2` composition-tranche decision must be reopened before implementation.
