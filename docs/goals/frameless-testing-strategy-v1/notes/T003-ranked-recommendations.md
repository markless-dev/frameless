# T003 — Ranked recommendations

Ranked by *how much each one reduces the chance of silently emitting wrong
code*, not by effort. Each entry states what it catches that nothing currently
in the repo can catch, so the list can be cut from the bottom.

The organising judgment: Frameless's oracle is already excellent and its corpus
is tiny. Tier 1 makes the existing oracle enforceable and closes an asymmetry;
Tier 2 makes the corpus stop being tiny. Tier 2 is where the actual correctness
yield is. Tier 1 is first only because Tier 2 is worthless if nobody runs it.

---

## Tier 1 — before anyone compiles with this

### 1. Continuous integration

**Catches:** everything already tested, on a machine that is not the author's.
There is no `.github/` directory; `.githooks/pre-commit` runs `vp lint` only.
Today a commit can break `pnpm e2e` and nothing notices.

**Shape:** one workflow running `pnpm check`, `pnpm lint`, `pnpm test`,
`pnpm test:browser`, `pnpm e2e`. Fresh-checkout install, Playwright Chromium
provisioned in CI.

**Cost:** low. **This gates every other item on this list.**

### 2. Type-check the emitted output

**Catches:** an entire class of miscompile — undefined identifiers, wrong arity,
props that don't exist, misuse of a framework API — with a third-party checker,
for near-zero marginal effort. Currently *all* emitted output is `.jsx`
(`packages/frameworks/*/generated{,-composition}/`) and is never type-checked.
Root `tsconfig.json` additionally excludes `packages/*/test`, `demos/`, and
`scripts/`, so `pnpm check` covers only `packages/*/src`.

**Shape:** run `tsc` over emitted output against `@types/react` / `solid-js`'s
JSX types — either by emitting `.tsx` or via `checkJs` on the existing `.jsx`.
Separately, widen the root `tsconfig` include set.

**Cost:** low. **Highest correctness-per-hour on this list.** It is the same
category of win as the eslint gate: an independent arbiter Frameless does not
have to write or maintain.

### 3. Framework-version matrix

**Catches:** the risk that is unique to Frameless and shared by no framework it
competes with. Every dependency is pinned to exactly one version — `react`
`19.2.3`, `solid-js` `1.8.22`, `@qwik.dev/core` `2.0.0-beta.38`. A user on React
19.0 or Solid 1.9 is running an untested configuration. Qwik is pinned to a
*pre-release*, and `packages/frameworks/solid/test/solid2-blocker.test.ts`
acknowledges Solid 2 exists without testing against it.

**Shape:** re-run the browser differential lanes against a small version set per
target (oldest supported, current, next/beta). Start with two versions per
framework; the axis matters far more than its depth.

**Cost:** medium — needs install strategy (pnpm overrides, as
`vuejs/ecosystem-ci` does) and CI minutes. Do it after #1.

### 4. Bring the Qwik lane to parity

**Catches:** the gap between what the README claims for Qwik and what is
actually verified. Qwik has 9 test cases to React's 64 and Solid's 79; its gate
is 163 LOC to React's 547 and Solid's 713; it has **no browser test project at
all** (only `vitest.node.config.ts`, and it is absent from `test.projects` in
the root `vite.config.ts`); and its `package.json` has `eslint` but **no
`eslint-plugin-qwik`**, so Qwik output receives generic JS linting where the
other two get framework-native rules. Qwik output is behaviorally verified only
through `pnpm e2e`'s three-way contract — never by the unit browser lane that
guards React and Solid.

**Shape:** add the browser project, register it in `vite.config.ts`, adopt
`eslint-plugin-qwik` in the gate, and extend the gate policy set toward parity.

**Cost:** medium. Rank is high because this is the target with the *most* risk
(resumption, pre-release dependency) and the *least* coverage.

---

## Tier 2 — the actual correctness upside

### 5. Generative `.tsrx` / IR corpus feeding the existing oracle

**Catches:** miscompiles in the ~90% of `build.ts` (2,954 LOC) and the emitters
(3,709 / 3,639 / 960 LOC) that three scenarios and eight composition fixtures
never reach. This is Csmith's missing half — Frameless has the comparison,
not the generator.

**Why this is unusually tractable here:** the IR grammar in
`packages/compiler/src/schema.ts` is small and closed — about ten template node
kinds (`text`, `dynamic-text`, `host`, `branch`, `keyed-repeat`, `fragment`,
`component-reference`, `default-slot-projection`, attribute/property, prop
kinds) and three cell kinds (`state`, `computed`, `graph`). A `fast-check`
arbitrary over that grammar is a bounded, finite piece of work, and every
generated program flows straight into the differential comparison that already
exists. Shrinking gives a minimal reproducing `.tsrx` for free.

**Cost:** high (the generator is real work). **Highest correctness yield on the
list by a wide margin.** Everything in Tier 1 protects what is already tested;
this is the only item that meaningfully expands *what* is tested.

### 6. Metamorphic invariants

**Catches:** compiler bugs without needing a second implementation to compare
against — reported in the literature to find bugs faster than differential
testing alone. Concrete invariants for Frameless, each cheap:

- rename every identifier → identical traces, IR identical modulo names;
- reorder independent sibling elements → correspondingly reordered DOM, same
  callbacks;
- extract a subtree into a child component → identical traces;
- split one `.tsrx` into two files with an import → identical traces;
- wrap a body in an always-true branch → identical traces.

**Cost:** low-to-medium, and it composes with #5 — apply the transforms to
generated programs and the yield multiplies.

### 7. Production-build and `StrictMode` lanes

**Catches:** two config-matrix holes with known sharp edges. Everything runs in
dev; the README already concedes the express production build is "verified by
`curl` only". And `StrictMode` appears only in demo entry files, never in
`packages/frameworks/react/test/` — while scenario S1 asserts `setup` runs
exactly **once** (`packages/analyzer/src/scenarios.ts`) and React 19
double-invokes effects under `StrictMode`. Whether the React emitter is correct
under double-invocation is currently unproven at the unit level.

Svelte runs precisely these lanes: `tests/runtime-production`, and a
`TestNoAsync` CI job re-running the suite with a major behavior toggled.

**Cost:** low-to-medium. Mostly re-running existing lanes under different flags.

---

## Tier 3 — worth doing, in this order

### 8. Downstream / consumer testing

The `ecosystem-ci-trigger.yml` pattern both `sveltejs/svelte` and `vuejs/core`
run: force a real consumer project onto the unreleased build and run *its* test
suite. For a code generator whose pitch is "drops into your existing app", this
is the most on-point integration signal available. Vue's `pkg-pr-new`
continuous-release job is the cheap first step — an installable preview package
per PR. **Cost:** medium-high; needs a consumer project to exist first.

### 9. Coverage measurement — as a diagnostic, not a gate

No vitest config sets `coverage`. Right now nobody can answer "which lines of
`build.ts` have never executed under test". Turn it on to *steer* the corpus
work in #5; do not set a threshold. A coverage number on a compiler with a
fixed corpus measures the corpus, not the tests. **Cost:** very low.

### 10. Error-message / rejection suite

"Reject what it cannot prove" makes rejection messages a public surface. Svelte
maintains `compiler-errors/` and `validator/` suites; Frameless asserts one
throw string in `unknown-template-node.test.ts`. **Cost:** low-medium.

### 11. Randomised action ordering + network-throttled Qwik

The concrete, useful version of "jitter testing" (see T002 — the term is not
standard, but the instinct is sound). Many of S2's actions are order-independent
in principle; randomise and require the targets to still agree. Separately,
Qwik fetches a handler QRL *at click time*, so throttled-network resumption is a
real untested path. **Cost:** low, and it rides on #5's infrastructure.

### 12. Sourcemaps

Users will debug emitted code in a browser and need to land back in `.tsrx`.
Svelte has a dedicated `sourcemaps/` suite; Frameless has none. Rank reflects
that this is a DX guarantee, not a correctness one. **Cost:** medium.

### 13. Accessibility differential

Nothing references `axe`; the README concedes it. Sharper than it looks: the
emitters make *independent* per-framework decisions about attributes and element
structure, which is exactly where a11y divergence could hide inside a DOM
comparison that still reports "equal". Running an a11y audit per target and
diffing the results reuses the existing differential machinery. **Cost:** low.

### 14. Cross-engine browser matrix

All four browser configs hard-code `chromium`. Firefox and WebKit differ in
focus handling, form behavior, and event ordering — three of the five channels
`compare.ts` diffs. **Cost:** medium; CI-minute heavy. Lower rank because the
compiler emits standard framework code, so engine bugs are mostly the
frameworks' problem, not Frameless's.

### 15. Size and performance as trends, not assertions

`packages/frameworks/*/test/size.test.ts` asserts exact hard-coded LOC and node
counts, which fails on *any* change instead of reporting one. Vue's
`size-data.yml` / `size-report.yml` post per-PR deltas instead. No runtime
performance of emitted output is measured at all. **Cost:** low-medium.

---

## Explicitly not recommended

- **Stryker mutation testing on the compiler source.** Frameless already does
  mutation testing where it counts — on the *oracle*, via
  `packages/analyzer/src/mutants.ts` and the calibration suites. Mutating
  `build.ts` would mostly rediscover that the scenario corpus is thin, which
  T001 §C establishes for free. Revisit only if #5 stalls.
- **More snapshot tests per target.** That is the Mitosis model the README
  correctly argues against. Snapshots prove output did not change; they never
  prove it is correct, and never prove two targets agree.
- **A coverage threshold in CI.** See #9.

## If only three things get done

#1 (CI), #2 (type-check emitted output), #5 (generative corpus). The first
makes the suite real, the second is the cheapest independent oracle available,
and the third is the only item that materially widens what is being proven.
