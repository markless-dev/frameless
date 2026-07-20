# Frameless

Frameless is a target-neutral compiler pipeline for authoring one bounded TSRX
component and emitting conventional framework packages whose behavior is checked by
a cross-target equivalence oracle. It builds a versioned enriched IR first; React
and Solid remain independently owned targets rather than compiler runtime modes.

The product flow is reserved as:

```sh
pnpm install
pnpm e2e
```

`pnpm e2e` is an intentional failing placeholder until T010 lands the real demo and
fresh-checkout proof. It must never report a skeleton as a passing product run.

## Packages

- `packages/compiler` — source string to `frameless-enriched-ir/1`.
- `packages/oracle` — equivalence scenarios, traces, verdicts, and receipts (stub).
- `packages/target-react` — React 19 emitter, gate, adapter, and dossier (stub).
- `packages/target-solid` — Solid emitter, gate, adapter, and dossier (stub).
- `packages/cli` — build entry and internal target registration (stub).
- `demos/ui-kit` — bounded product demonstration (stub).

Read [`specs/framework-design.md`](./specs/framework-design.md) for the normative
contract index. The isolated `poc/**` packages remain historical executable evidence
and are not members of this workspace.
