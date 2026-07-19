# Frameless POC workflow guidance

Conventions for every package under `poc/` in this repo. Workers follow these exactly.

## Purpose discipline

Each `poc/NN-name/` directory proves specific numbered claims from
`docs/goals/frameless-mitosis-successor/notes/T004-claims.md` (final amended section).
A POC that passes without proving its claim as worded is a failure. If the claim is
unprovable as worded, return `blocked` with the evidence — never weaken a test to pass.

## Package shape

- Self-contained pnpm package: own `package.json`, `pnpm-lock.yaml` may be generated;
  installs must not modify anything outside the POC directory.
- `README.md` at the POC root: which claims it proves, how (one paragraph per claim),
  exact verify command, and recorded toolchain/dependency versions.
- Tests via `vitest` unless the packet says otherwise; `pnpm test` must be the single
  verify entry point and must be deterministic (no network at test time, no sleeps —
  bounded polling/timeouts only).
- Pin exact dependency versions (no `^`/`~`). Mitosis: `@builder.io/mitosis@0.13.2`.

## Reference repos are read-only

`/Users/jacksm5pro/dev/open-source/mitosis` and `/Users/jacksm5pro/dev/open-source/markless`
must never be modified. Consume markless via vendored tarballs: run
`pnpm pack --pack-destination <this-repo>/poc/vendor/` inside the needed
`markless/packages/*` directories, install from the tarball, and record each tarball's
sha256 in the POC README. Never commit machine-specific absolute paths in source files;
test fixtures/scripts may reference the reference repos only through an env var
(`MITOSIS_REPO`, `MARKLESS_REPO`) with the default documented in the README.

## Proof quality

- Scope/binding proofs use `@babel/parser` + `@babel/traverse` (or eslint-scope), not
  regex or bare acorn.
- Runtime proofs assert observable behavior (DOM, callback logs), not internals.
- Anything comparing outputs follows the equivalence standard in T004-claims.md
  (amended section): multi-phase observation, allowlist normalization, node identity,
  callback traces, mutant validation.
- Console output claims capture the console; "no warning" means asserted-empty capture.

## Honesty rules

- Record negative/surprising results in the README under "Findings" — they feed the
  report; hiding them corrupts the goal.
- A markless capability gap is a finding, not something to patch in the markless repo.
- Every README states what the POC does NOT prove.
