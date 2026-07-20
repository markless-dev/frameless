# Ownership split

There is no published cross-package `FrameworkTarget` contract in v0.

- The compiler owns only enriched IR, its builder and validation, and diagnostics.
  It must not import oracle, DOM, React, Solid, Vite, filesystem, gate, dossier, or
  target types.
- The oracle owns adapter protocol, scenarios/actions, phase traces, comparison,
  verdicts, and receipt schemas. Framework-specific adapter implementations remain
  in target packages.
- Each target owns its emitter, conventionality gate, oracle adapter, idiom dossier,
  and primary/fallback framework version matrix.
- The CLI composes target exports through an internal registration. Its
  package-inventory integration test ensures every supported target is registered;
  that registration is not a public compatibility promise.

Emitters consume only `frameless-enriched-ir/1` and return generated files plus
construct-level diagnostics. Gates inspect target files. Adapters mount generated
modules and implement the oracle's lifecycle. These coincident shapes do not create
a shared compiler-owned interface.
