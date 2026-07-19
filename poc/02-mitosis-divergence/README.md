# Mitosis React/Solid `onUpdate` divergence (C4)

This POC is designed to prove the amended, fixture-scoped C4: for the single dependency-free
`onUpdate` fixture in `src/update-probe.lite.tsx`, `@builder.io/mitosis@0.13.2`
emits React and Solid components that both mount and respond to the same click, but
have observably different callback behavior. React calls the probe after mount and
after the update; Solid never calls it.

## How the proof works

Vitest setup recompiles the same source with `parseJsx`, `componentToReact`, and
`componentToSolid`, then byte-compares the results with the checked-in, clearly
generated artifacts under `generated/`. The runtime test mounts both recorded
outputs in one jsdom environment, observes the callback trace after mount, performs
the same button click, and observes both the updated DOM and callback trace again.
Both outputs must mount and their counters must change from `0` to `1`; a mount
failure is not bypassed.

The Solid generator's reason for omitting this hook is visible in the read-only
Mitosis reference repository at
`packages/core/src/generators/solid/index.ts:204-208`: its explicit TODO says to
support `onUpdate` without `deps`, followed by `if (!hook.deps) return ''`.

`vite-plugin-solid` is restricted to `generated/update-probe.solid.jsx` and compiles
that emitted Solid JSX during the Vitest/Vite run. Vite's esbuild JSX transform
compiles the emitted React JSX.

## Verify

From this directory:

```sh
pnpm install
pnpm test
```

Regenerate the recorded compiler artifacts after an intentional fixture change with
`pnpm generate`, then review their diff and rerun the test.

## Recorded versions

- Node.js used for static checks: `24.15.0` (package minimum: `>=20`)
- pnpm: `9.15.4`
- `@builder.io/mitosis`: `0.13.2`
- React / React DOM: `18.3.1`
- Solid: `1.8.22`
- Vitest: `2.1.9`
- Vite: `5.4.11`
- vite-plugin-solid: `2.11.0`
- jsdom: `25.0.1`

## Findings

The recorded React output maps the dependency-free hook to `useEffect` without a
dependency argument, while the recorded Solid output contains no corresponding
callback. The runtime test requires the resulting traces to differ despite
identical source and interaction.

Verification in the authoring sandbox was blocked before test execution because
outbound DNS could not resolve `registry.npmjs.org`; `pnpm install` ended with
`ERR_PNPM_META_FETCH_FAIL`. This is an environment limitation, not a substituted
runtime result. The committed setup-time artifact checks and mount assertions must
pass via the verify commands above before C4 is treated as proven.

## What this does not prove

When verified, this proves only CSR behavior of this fixture under these exact versions. It does
not establish behavior for other hooks, dependency-bearing `onUpdate`, other
components or targets, framework-version ranges, SSR/hydration/resume, async
semantics, cleanup/attach, slots/children/context composition, styling,
multi-module builds, performance/bundle size, accessibility, HMR, type-preserving
emission, or generated-code debugging. It does not prove a universal absence of
cross-target semantics beyond the observed version-pinned divergence.

## Finding: Solid v2 incompatibility (added after review)

Mitosis 0.13.2's Solid output targets Solid v1 (`solid-js@1.8.22` here). Against
`solid-js@2.0.0-experimental.16` the output cannot even be bundled: it relies on the
`solid-js/web` entry point, which Solid v2 no longer exports
(`test/solid2-compat.test.ts` proves this). Mitosis exposes no way to target a
framework major version — the "no control over versioning" complaint from the
Voorhoede report, made machine-checkable. Arcade-side emitters in this repo target
Solid v2 and Qwik v2 (`@qwik.dev/core`) by decision (2026-07-19).
