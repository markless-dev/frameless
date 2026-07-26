# T001 — What Frameless tests today

Read-only audit. Every number below was measured in this working tree on
branch `land/stack-and-three-way-demo`.

## Scale

| Area | Test cases | Test files | Source LOC |
| --- | ---: | ---: | ---: |
| `packages/compiler` | 66 | 10 | 3,834 |
| `packages/analyzer` | 34 | 6 | 1,381 |
| `packages/core` | 3 | 1 | 55 |
| `packages/cli` | 34 | 5 | 1,109 |
| `packages/frameworks/react` | 64 | 12 | 5,658 |
| `packages/frameworks/solid` | 79 | 11 | 5,655 |
| `packages/frameworks/qwik` | **9** | **2** | 1,251 |
| `demos/` | 14 | 7 | — |
| **Total** | **303** | **54** | **~20,300** |

16 of the 54 files are browser (`*.browser.test.ts*`) lanes; the rest are Node.

`packages/compiler/src/build.ts` alone is 2,954 LOC. The React and Solid
emitters are 3,709 and 3,639 LOC. Those three files are ~50% of the source and
are the surfaces where a silent miscompile would live.

## Testing kinds present, by name

**1. Differential / behavioral equivalence testing** — the crown jewel.
`packages/analyzer/src/compare.ts` canonicalises two `RunTrace`s and diffs them
across five channels (`trace`, `dom`, `callback`, `identity`, `focus`) per
phase, reporting the first divergent path. `packages/frameworks/*/test/
emitted-smoke.browser.test.ts` and the `pnpm e2e` lanes drive React and Solid
output through identical scripted actions in a real Chromium and require the
traces to be equal. This is the technique the compiler-testing literature calls
differential testing, and almost nothing in the JS compiler ecosystem does it —
Mitosis, the closest comparable, verifies with per-target string snapshots
(`packages/core/src/__tests__/react.test.ts`, `solid.test.ts`, `qwik.test.ts`
and a shared `__snapshots__/` directory).

**2. Oracle calibration via seeded mutants** — unusual and genuinely good.
`packages/analyzer/src/mutants.ts` declares 8 mutant classes (`wrong-text`,
`wrong-live-property`, `omitted-callback`, `reordered-callback`,
`broken-key-identity`, `wrong-cancellation`, `duplicate-handler`, `timing`).
`packages/frameworks/react/test/calibration.browser.test.ts` builds each as a
*component variant* — deliberately not DOM surgery, with the reasoning recorded
in a comment — runs it against the clean reference, and asserts the comparison
reports `equal: false` **in the expected channel**. This is mutation testing
pointed at the test oracle rather than at the production code, which is the
right place for it in a compiler. It also runs each reference twice and
requires the two traces to be equal, which is a flake detector.

**3. Golden / snapshot testing with a determinism assertion.**
`packages/compiler/test/enriched-ir.test.ts:650` asserts each fixture is
"deterministic across builds and byte-equal to its checked-in golden" against
`packages/compiler/test/goldens/*.json`. Emitted `.jsx` under
`packages/frameworks/*/generated{,-composition}/` is committed and drift-tested.
Determinism is separately asserted in `packages/cli/test/persistence.test.ts:44`
("byte-deterministic, stably ordered, hashed for CSP"),
`packages/cli/test/program.test.ts:135`,
`packages/analyzer/test/trace-io.test.ts:90`, and
`packages/analyzer/test/receipts.test.ts:351`.

**4. Static-policy gate testing with external oracles.** The React gate
(`packages/frameworks/react/src/gate/index.ts`, 547 LOC + 1,364 LOC of
`custom-policies.ts`) runs *real* `eslint`, `eslint-plugin-react`, and
`eslint-plugin-react-hooks@^6` over emitted output. Solid runs real
`eslint-plugin-solid`. Every policy carries a `dossierRef` back to the ruling
that justifies it, enforced by a regex. This is the strongest kind of static
check available — a third-party arbiter of "is this idiomatic", not the
compiler grading its own homework.

**5. Fail-closed / exhaustiveness testing.**
`packages/compiler/test/unknown-template-node.test.ts` asserts that an
unrecognised template construct throws rather than degrading. Paired with
`packages/compiler/test/{behavior-input,shared-surface}-disagreement.test.ts`
and `v0-limits.test.ts`, this covers "reject what it cannot prove".

**6. Structural size comparison.** `packages/frameworks/*/test/size.test.ts`
measures emitted vs. hand-written reference bodies (physical LOC + structural
AST nodes) per scenario.

**7. End-to-end contract testing across three activation models.**
`scripts/e2e.mjs` (486 LOC) drives React, Solid, and Qwik official scaffolds
through one shared contract, diffs 3×3 measurement cells, and additionally
asserts Qwik's `paused` → `resumed` transition and on-demand QRL fetches while
asserting the matching negatives for React and Solid.

**8. Receipt-integrity testing.** `packages/{analyzer,cli}/src/receipts.ts`
(576 + 585 LOC) are validated by dedicated suites, so a green report cannot be
produced without the underlying comparison having actually passed.

That is a stronger foundation than the framing of the question implies. The
gaps below are real, but they are gaps in an already-unusual suite.

## Testing kinds absent

**A. Continuous integration — there is none.** There is no `.github/`
directory in this repository. The only automated enforcement is
`.githooks/pre-commit`, which runs `vp lint --deny-warnings` and a Ruler
staleness check — it does not run `pnpm test`, `pnpm check`, `pnpm e2e`, or the
browser lanes. Every behavioral guarantee in the README currently depends on a
human remembering to run `pnpm e2e` locally on one machine. This is the single
largest robustness gap and it makes every other gap worse, because nothing
below can be enforced without a place to enforce it.

**B. No matrix testing on any axis.**

- *Framework versions*: exactly one version each is pinned everywhere —
  `react`/`react-dom` `19.2.3`, `solid-js` `1.8.22`, `@qwik.dev/core`
  `2.0.0-beta.38`. There is a `packages/frameworks/solid/test/
  solid2-blocker.test.ts`, which acknowledges Solid 2 exists, but nothing runs
  the suite against it.
- *Node versions*: no `engines` field on any workspace package (only the root's
  `>=20`); nothing runs on more than the developer's local Node.
- *OS*: untested outside macOS (`darwin`).
- *Browser engines*: `chromium` only, hard-coded in all four browser vitest
  configs (`packages/frameworks/{react,solid}/vitest.config.ts`,
  `demos/{ui-kit,composition-kit}/test/*/vitest.config.ts`).
- *Build mode*: everything runs in dev. The README already concedes the express
  production build is "verified by `curl` only, not by a browser lane". No
  `NODE_ENV=production` or minified path appears anywhere in
  `packages/`, `scripts/`, or the demo test configs.
- *Framework config flags*: React's emitted output is never exercised under
  `StrictMode` in a test. `StrictMode` appears only in demo entry files
  (`demos/ssr/react-app/src/*.tsx`, `demos/react-official/src/entry-*.jsx`),
  never in `packages/frameworks/react/test/`. React 19 double-invokes effects
  under `StrictMode`; scenario S1 asserts `setup` runs exactly **once**
  (`packages/analyzer/src/scenarios.ts`). Whether the emitter is correct under
  double-invocation is currently unproven at the unit level.

**C. No generative / property-based testing.** Zero hits for `fast-check`,
`jsverify`, `fuzz`, or `arbitrary` across the workspace. The entire input
corpus is 3 scenarios (`S1`, `S2`, `S3` + one guard variant), 8 composition
fixtures (`C1`–`C8`), and a handful of `.tsrx` files under
`packages/compiler/test/fixtures/`. Meanwhile the IR grammar in
`packages/compiler/src/schema.ts` is small and closed — roughly ten template
node kinds (`text`, `dynamic-text`, `host`, `branch`, `keyed-repeat`,
`fragment`, `component-reference`, `default-slot-projection`, plus
attribute/property and prop kinds) and three cell kinds (`state`, `computed`,
`graph`). A closed grammar of that size is close to an ideal target for
generative testing, and nothing currently generates against it. Coverage of the
*grammar* is unmeasured; coverage of the *corpus* is total.

**D. No coverage measurement of any kind.** No `coverage` key in any vitest
config, no threshold, no report. There is no way to answer "which of the 2,954
lines of `build.ts` has never executed under test".

**E. Root type-checking excludes the tests and the output.** `tsconfig.json`
sets `"exclude": ["dist", "node_modules", "poc", "packages/*/test", "tests"]`
and includes only `packages/*/src/**` plus two config files. So `pnpm check`
does not type-check test files, `demos/`, or `scripts/`. Separately, all
emitted output is `.jsx`, not `.tsx` — meaning the generated code is never
type-checked at all. `tsc` over emitted output would be a powerful independent
oracle that costs nothing to run, and it is currently unused.

**F. The Qwik lane is structurally weaker than the other two.** 9 test cases
across 2 files, against React's 64 and Solid's 79. `packages/frameworks/qwik/`
has only a `vitest.node.config.ts` — no browser project exists, and it is
absent from the `test.projects` list in the root `vite.config.ts`. Its gate is
163 LOC against React's 547 and Solid's 713, and its `package.json` carries
`eslint` and `@eslint/js` but **no `eslint-plugin-qwik`** — so Qwik output gets
generic JS linting where React and Solid get framework-native rules. Qwik is
also the only target using the hardest activation model (resumption) and the
only one pinned to a pre-release (`2.0.0-beta.38`). It has the least coverage
and the most risk.

**G. No error-message or diagnostic testing.** Frameless's contract is "reject
what it cannot prove", which makes rejection messages part of the public
surface. Svelte maintains dedicated `compiler-errors/` and `validator/`
suites for exactly this. Frameless asserts one specific throw string in
`unknown-template-node.test.ts` and otherwise does not test what a user sees
when compilation fails.

**H. No sourcemap testing.** Svelte has a whole `sourcemaps/` suite. Frameless
emits code a user will debug in a browser; nothing verifies that mapping back
to `.tsrx` works, or that sourcemaps exist.

**I. No accessibility assertions.** Zero hits for `axe` or accessibility
tooling. The README states this openly. Relevant because the emitters make
independent per-framework decisions about attributes and element structure —
which is precisely where a11y divergence between targets could hide inside an
otherwise "equal" DOM comparison.

**J. No downstream/consumer testing.** No equivalent of the
`ecosystem-ci-trigger.yml` that both `sveltejs/svelte` and `vuejs/core` run, and
no per-PR installable preview build (Vue publishes one on every PR via
`pkg-pr-new`). For a compiler whose entire value proposition is that its output
drops into someone else's React or Solid app, "does the output still work in a
real consumer project" is the most on-point integration signal available, and
it is not being collected.

**K. No performance or bundle-size regression tracking.** `size.test.ts`
asserts exact hard-coded equality on LOC and node counts, which fails on any
change rather than reporting a trend. `vuejs/core` runs `size-data.yml` and
`size-report.yml` to post size deltas on PRs. Nothing measures runtime
performance of emitted output at all.

## One structural observation

The suite's strength is concentrated in *verifying a fixed corpus very
rigorously*. Its weakness is *the corpus is fixed*. The oracle can detect eight
classes of behavioral divergence with proven sensitivity — but only on the
three programs it is pointed at. Every gap in section C, and much of B, is a
restatement of that one fact.
