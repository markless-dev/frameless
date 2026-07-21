# Frameless React target agent playbook

Use this file as guidance for the installed `@frameless/react` version. The package consumes
`frameless-enriched-ir/2`, emits automatic-runtime JSX, checks generated React conventionality,
and supplies the browser analyzer adapter.

## Target boundaries

1. Import the analyzer lifecycle from `@frameless/react/adapter` in browser projects. That
   subpath contains only the adapter and its browser/runtime dependencies.
2. Keep compiler-enriched IR target-neutral. React lowering, ESTree/Yuku generation, ESLint policy,
   and browser transforms belong in this package.
3. Treat generated JSX as output. Change the enriched IR emitter or gate and regenerate; do not
   hand-edit generated component behavior.

## Conventionality and verification

- Follow the React idiom dossier referenced by each gate policy. Do not suppress the gate with
  ESLint directives or bypass it through helper calls.
- Run `pnpm --dir packages/frameworks/react test` for the offline emitter and gate lanes.
- Run `npx vitest run --project react-browser` for adapter calibration and emitted oracle smoke.
- A package-only pass is not evidence for a consuming application known to be affected.
