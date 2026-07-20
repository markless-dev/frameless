# Contributing to Frameless

Read `AGENTS.md`, the owning package README, and any package playbook before changing behavior.
Framework calibration references are governed by their dossier pointers and should not be rewritten
as part of wiring or relocation work.

## Package map

- `packages/compiler` owns only the enriched-IR extension pass and pass infrastructure.
- `packages/analyzer` owns portable observation, comparison, scenario, mutant, verdict, and receipt
  contracts. It has no framework or browser-runner dependencies.
- `packages/frameworks/react` owns React dependencies, adapter, handwritten reference, transform-free
  browser project, and calibration.
- `packages/frameworks/solid` owns Solid dependencies, adapter, handwritten reference, isolated Solid
  transform, browser project, and calibration.
- `packages/cli` owns the command and internal framework registration.
- `demos/ui-kit` owns the product demonstration; its verification entry is the root `pnpm e2e` command (a demo doctor script is future work).

There is no compiler-owned framework interface: compiler imports may not couple enriched IR to
analyzer, DOM, React, Solid, Vite, gate, or dossier types. Protocol and configuration facts are
imported from their owning package rather than copied.

## Local workflow

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm test:browser
```

Use `pnpm test:poc` only when the complete frozen historical evidence base is required. Never add
`poc/**` to workspace globs or root tool lanes, and never update a POC lockfile from the product
workspace. Report commands that could not run and their exact blockers; never substitute an
invented browser result.
