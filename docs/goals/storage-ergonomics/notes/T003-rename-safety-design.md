# T003 — rename-safety key-manifest: design review

## Problem
Derived keys (`storage('light')` → `markless:theme`) couple a durable persistence
identity to a refactorable identifier. Renaming the binding silently changes the
key and orphans users' saved data. A stateless compiler CANNOT detect a rename
(a renamed binding is indistinguishable from a fresh one), so the only real guard
is persisted state diffed build-over-build. T005 research confirmed this is the
right mechanism and that markless — as a compiler — is uniquely able to ship it.

## Feasibility: CONFIRMED
The markless vite plugin (`packages/bundler/src/vite/index.ts`) is
`sharedDuringBuild: true` with a per-module `transform` and a build-aggregation
pattern (`bundleGraphAdders`, `api` registry). So we can:
1. During `transform`, record each compiled module's storage keys
   (`compiled.payloadArena.state.storage[].key` + graphNodeId + source identifier).
2. At a build-end hook (`buildEnd`/`closeBundle`), aggregate all keys, load the
   previous manifest, diff, and emit warnings.

## Design
- **Manifest**: `markless-storage-keys.json` — a sorted map of
  `driverKey -> { graphNodeId, identifier, derived: bool }`. Written on each
  production build.
- **Diff semantics (warn-only, never error):** for each key present in the OLD
  manifest but ABSENT from the new build, warn:
  `storage key "markless:theme" is no longer produced — did you rename a storage
  binding? Existing users' persisted data will be orphaned. If intentional, this
  warning clears on the next build. To keep the old key, pin it:
  storage('markless:theme', 'light').`
  Only DERIVED keys are diffed (explicit verbatim keys are the author's stable
  contract and are exempt). New keys are silent (adding storage is fine).
- **Warn, print old→new candidates, offer the pin remedy inline** (per T005).
- **Scope**: production build only (`command === 'build'`), not dev/HMR
  (per-module dev transforms have no whole-project view; warning on every dev
  save would be noise).

## The one genuine owner fork: manifest LOCATION
This determines WHAT the guard actually catches:
- **(A) Committed `markless-storage-keys.json` at project root (RECOMMENDED).**
  Diffs across commits and developers — catches the real footgun (dev B renames a
  binding dev A shipped). Cost: a generated file lives in the repo and shows up in
  diffs (like a lockfile). This is the only option that catches cross-developer
  renames, which is the scenario that actually loses production data.
- **(B) Gitignored `.markless/storage-keys.json` cache.** No repo file, but only
  catches renames within one developer's local build history — misses the
  cross-developer/CI case, i.e. most of the real risk. Weaker guard.

Recommendation: **(A)**. A committed manifest is the standard shape for
"durable identity the build must protect" (cf. lockfiles) and is the only version
that makes the guard meaningful.

## Proposed T004 worker contract (pending owner go + location ruling)
- allowed_files: `packages/bundler/src/vite/index.ts` (+ a small
  `storage-key-manifest.ts` helper in bundler/serializer), bundler tests.
- verify: a build that renames a storage binding emits the drift warning;
  an unchanged build is silent; adding/removing an EXPLICIT key never warns;
  node suites stay green.
- stop_if: no clean build-end aggregation hook (escalate); warning fires on
  non-rename (false positive) — tighten diff to derived-key disappearance only.

## Decision needed from owner
1. Build the guard now? (research + owner already greenlit the direction.)
2. Manifest location: committed (A, recommended) or gitignored cache (B)?
