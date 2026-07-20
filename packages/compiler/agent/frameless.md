# Frameless agent playbook

Use this file as guidance for the installed `@frameless/compiler` version.
Frameless compiles `.tsrx` authoring into a target-neutral enriched IR and then
lets separately owned target packages emit framework code.

## Authoring

- Keep components in `.tsrx` files and export exactly one component per file.
- Do not import components across TSRX modules in v0.
- Stay inside the documented fixture-family surface. Composition, declarations,
  sourcemaps, and generated-code debugging are open /2 work, not implicit v0 features.
- Prefer compiler diagnostics over suppressions or source-string recovery.

## Pipeline boundaries

1. Source to enriched IR uses `@tsrx/core` plus vendored Markless compiler and
   serializer artifacts, stopping at `buildSemanticGraph()`.
2. Enriched IR to generated JSX belongs exclusively to each target emitter and
   uses no Markless render/runtime pipeline.
3. Generated JSX to browser modules belongs to the oracle's per-framework
   Vite/Babel transforms.

## Run the project doctor

Run the consuming demo's `doctor` script first for environment, dependency, and
production-build failures. The reference doctor lives in `demos/ui-kit`; compiler
tests alone do not prove that a generated application works.
