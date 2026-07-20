# Contributing to Frameless

Read `AGENTS.md`, `specs/framework-design.md`, `specs/framework/00-overview.md`, the
narrow owning spec, and `specs/state.md` before changing behavior.

## Package map

- `packages/compiler` is the public enriched-IR compiler boundary.
- `packages/oracle` owns common behavioral observation and receipt contracts.
- `packages/target-react` and `packages/target-solid` each own their emitter, gate,
  adapter, dossier, and framework version matrix.
- `packages/cli` owns the command and internal target registration.
- `demos/ui-kit` owns the product demonstration and its doctor.

There is intentionally no compiler-owned Target interface: compiler imports may not
couple IR to oracle, DOM, framework, gate, or dossier types. There is intentionally
no standalone gate, dossier, protocol, or test-utils package. There is intentionally
no Vite plugin in v0. There are intentionally no declarations or sourcemaps until
the enriched-IR version decision is reopened.

## Local workflow

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Use `pnpm test:poc` only when the whole frozen POC evidence base is required. Never
add `poc/**` to workspace globs or root tool lanes, and never update a POC lockfile
from the product workspace.
