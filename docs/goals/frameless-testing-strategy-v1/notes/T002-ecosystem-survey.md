# T002 — What comparable projects actually do

Research method disclosure: the `grep` MCP server was **not available** in this
environment (both global and project `mcpServers` are empty in
`~/.claude.json`). Substituted `gh api` / `gh search code` against the real
repositories named below, plus web research. Every repo-structure claim was
read from the live GitHub API during this run.

## Reference point 1 — Svelte (`sveltejs/svelte`)

The most instructive comparison, because Svelte is also a compiler whose output
runs in a browser. Its test tree (`packages/svelte/tests/`) is organised by
*lane*, not by module:

```
compiler-errors  css  css-parse  hydration  migrate  motion  parser-legacy
parser-modern  preprocess  print  runtime-browser  runtime-legacy
runtime-production  runtime-runes  runtime-xhtml  server-side-rendering
signals  snapshot  sourcemaps  store  types  validator
```

Five things there that Frameless has no analogue for:

- **`runtime-production`** — the same runtime suite re-run against a production
  build. Frameless tests dev mode only.
- **`sourcemaps`** — a dedicated suite with its own `helpers.js` and `samples/`.
- **`compiler-errors` + `validator`** — error and rejection messages treated as
  a tested public surface.
- **`types`** — the emitted/declared types are themselves checked.
- **`runtime-legacy` / `runtime-runes` / `runtime-xhtml`** — the same behavioral
  suite re-run under different *compilation modes*. This is matrix testing
  applied to the compiler's own configuration space, not to dependency versions.

Svelte's CI (`.github/workflows/ci.yml`) adds three more axes:

- an OS × Node matrix: Node 20 on windows/macOS/ubuntu, plus Node 22 and 24 on
  ubuntu;
- a `TestNoAsync` job that re-runs `runtime-runes` with `SVELTE_NO_ASYNC=true` —
  a *feature-flag lane*, proving the suite passes with a major behavior toggled;
- a `TSGo` job that type-checks under an alternative TypeScript implementation.

And `ecosystem-ci-trigger.yml`, covered below.

## Reference point 2 — Vue (`vuejs/core`)

Vue's compiler tests (`packages/compiler-core/__tests__/`) are conventional —
`parse.spec.ts`, `transform.spec.ts`, `codegen.spec.ts`, `compile.spec.ts` plus
`__snapshots__/`. The interesting parts are in CI:

- **`size-data.yml` / `size-report.yml`** — bundle size is measured per PR and
  reported as a delta, not asserted as an exact constant.
- **`ecosystem-ci-trigger.yml`** — see below.
- **`continuous-release`** — every PR publishes an installable preview package
  via `pkg-pr-new`. Anyone can `npm i` the exact build from a PR and try it in a
  real app before it merges. For a code generator, this converts "does the
  output work in someone's project" from a hope into a one-command check.

## Reference point 3 — ecosystem CI

`vuejs/ecosystem-ci` (and the Vite original it derives from) uses pnpm
`overrides` to force downstream projects onto an unreleased build of the
framework and then runs *their* test suites. Where a prebuilt package can't be
used, it builds from the branch and publishes to a local Verdaccio registry.

This is the single most on-point pattern for Frameless. Frameless's whole claim
is that its output is idiomatic code that drops into an existing React or Solid
codebase. The corresponding test is: take a real consumer project, swap in
freshly-emitted components, run that project's own test suite. Nothing
currently does this.

## Reference point 4 — Mitosis (`BuilderIO/mitosis`)

The direct competitor, and the cautionary tale. Its
`packages/core/src/__tests__/` is one `<target>.test.ts` per target — `react`,
`solid`, `qwik`, `svelte`, `angular*` (seven separate Angular files), `vue`,
`lit`, `marko`, `stencil`, `alpine`, `swift`, `react-native`, `rsc`, `liquid`,
`html`, `preact` — each backed by `__snapshots__/`.

The design consequence is exactly what the Frameless README asserts: breadth of
targets, verified by string comparison. A snapshot proves the output did not
*change*; it never proves the output is *correct*, and it certainly never
proves two targets *agree*. Frameless's differential browser comparison is
strictly stronger. **Any recommendation that pushes Frameless toward
snapshot-count-as-coverage is a regression, not an improvement.**

## Reference point 5 — the compiler-testing literature

The academic consensus (see *A Survey of Modern Compiler Fuzzing*,
arXiv:2306.06884) is that compiler correctness rests on three oracle families:

1. **Differential testing** — run the same input through two implementations,
   require agreement. Csmith generated random C programs and found 325+
   previously-unknown compiler bugs this way. **Frameless already does this**,
   and does it at the behavioral level rather than the output-text level, which
   is the harder and better version. What Frameless lacks is Csmith's other
   half: *random program generation*. Csmith's power came from the generator,
   not the comparison.

2. **Metamorphic testing / EMI** (Equivalence Modulo Inputs) — transform a
   program into one that must behave identically, and require the compiler to
   agree with itself. Reported to find bugs faster than Csmith-style
   differential testing. The Frameless analogues are concrete and cheap:
   renaming every identifier, reordering independent sibling elements,
   extracting a subtree into a child component, wrapping a body in an
   always-true branch, or splitting one `.tsrx` file into two with an import —
   all must produce byte-identical IR (modulo names) and identical traces.

3. **Fail-closed exhaustiveness** — every construct is either handled or
   rejected loudly. Frameless has this
   (`packages/compiler/test/unknown-template-node.test.ts`).

## On the two techniques named in the request

**Matrix testing** — real, standard, and entirely absent here. The axes that
matter for Frameless, in rough order: framework version (React 19.x/20,
Solid 1.8/2.0, Qwik beta churn) > build mode (dev/production) > framework
config (`StrictMode`, concurrent features) > Node version > browser engine >
OS. Svelte runs OS × Node; Vue runs downstream projects; neither runs a
*framework-version* matrix because they *are* the framework. Frameless is
downstream of three frameworks at once, which makes the version axis its most
important one and its most distinctive risk.

**"Jitter testing"** — this is not standard terminology in compiler or frontend
testing. In systems and SRE work, jitter means unpredictable variance in event
timing, and jitter injection is a chaos-engineering technique for validating
resilience to that variance. There is no established "jitter testing" practice
for compilers. But the underlying instinct maps onto three things that *are*
real and *are* relevant here:

1. **Timing/scheduling nondeterminism.** Frameless already has a `timing` mutant
   class in `packages/analyzer/src/mutants.ts`, so the oracle can detect timing
   divergence. What is untested is whether React's concurrent scheduler,
   Solid's synchronous scheduler, and Qwik's on-demand handler fetch stay in
   agreement when timing shifts. The Qwik lane is the one that actually depends
   on network timing — a handler QRL is fetched *at click time*.
2. **Action-order fuzzing.** The scenarios drive a fixed action sequence. Many
   of S2's actions (add/edit/toggle/reorder/remove) are order-independent in
   principle. Randomising the order and requiring both targets to still agree is
   a cheap, high-yield variant of what already exists.
3. **Flake detection.** Already partly handled — the calibration tests run each
   reference twice and require the traces to be equal.

Recommendation: retire the word "jitter", keep the instinct, and implement it as
(1) network-throttled Qwik resumption, (2) randomised action ordering, and
(3) a `StrictMode` lane. All three are matrix/generative work, not a separate
discipline.

## On mutation testing as a tool (Stryker)

Worth naming because it is the obvious suggestion and it is the wrong one here,
in its usual form. Stryker mutates production source and measures how many
mutants the suite kills. For a 20K-LOC compiler with browser tests in the loop
it would be slow and, more importantly, redundant: Frameless already does
mutation testing *where it counts*, on the oracle, via
`packages/analyzer/src/mutants.ts` and the calibration suites. Killing a mutant
in `build.ts` that no scenario reaches tells you the scenario corpus is thin —
which section C of T001 already establishes for free. Expand the corpus first;
mutation-score the compiler only if the corpus expansion stalls.

## Sources

- [sveltejs/svelte tests + CI](https://github.com/sveltejs/svelte/tree/main/packages/svelte/tests) (read via GitHub API)
- [vuejs/core CI workflows](https://github.com/vuejs/core/tree/main/.github/workflows) (read via GitHub API)
- [vuejs/ecosystem-ci](https://github.com/vuejs/ecosystem-ci)
- [BuilderIO/mitosis core tests](https://github.com/BuilderIO/mitosis/tree/main/packages/core/src/__tests__) (read via GitHub API)
- [A Survey of Modern Compiler Fuzzing](https://arxiv.org/pdf/2306.06884)
- [Metamorphic Testing for (Graphics) Compilers](https://www.doc.ic.ac.uk/~afd/homepages/papers/pdfs/2016/MET.pdf)
- [fast-check](https://github.com/dubzzz/fast-check)
- [StrykerJS mutation testing guide](https://qaskills.sh/blog/mutation-testing-stryker-guide-2026)
- [What is jitter (SRE definition)](https://sreschool.com/blog/jitter/)
