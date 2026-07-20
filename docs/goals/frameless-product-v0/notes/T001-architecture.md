# T001 — Architecture lock (Judge receipt note)

Provenance: goal-judge agent, high reasoning, 2026-07-19; read the markless checkout
(read-only), the prior goal's adjudications, and poc/04-08. PM-transcribed; pending
crew second-model critique per charter (architecture packages always get one).

## A. Monorepo layout (mirrored from markless; divergences recorded)

Conventions derived and mirrored: pnpm-workspace (`packages/*`, `demos/*`, `docs` +
catalogs.default), private root `frameless-workspace` with markless script lanes
(build=vp pack, check, lint, fmt, test, rules, prepare) + added `e2e` and `test:poc`;
vite-plus single root vite.config.ts (per-package pack buildOrder, src->dist ESM+dts,
node + browser test projects); package manifests with dev exports -> ./src/*.ts and
publishConfig -> ./dist, files:["dist"], sideEffects:false, workspace:*/catalog:
deps; root tsconfig noEmit/Bundler excluding dist+poc+tests; specs/framework/NN-*.md
+ specs/framework-design.md index; CONTRIBUTING package map with "intentionally no X"
notes; agent playbook at packages/cli/agent/frameless.md; .ruler/ + .githooks.

**Load-bearing:** `poc/` stays OUT of workspace globs (markless excludes poc from
tsconfig too). Product lane = vitest 4/vite 8/vp; POC evidence pins vitest 2/vite 5.
Workspace hoisting into poc/ would silently break the evidence base.

Packages (flat, per markless convention — no nested dirs):
- packages/compiler  @frameless/compiler   — enriched-IR pass (migrates poc/05); also
  exports ./target (Target interface + gate/receipt types; protocol-with-producer rule)
- packages/oracle    @frameless/oracle     — oracle contract, scenarios/mutants,
  verdict/receipt schema, browser harness (migrates poc/04 core + poc/08)
- packages/target-react @frameless/target-react — React 19 backend (migrates poc/06
  + React adapter from poc/04)
- packages/target-solid @frameless/target-solid — Solid backend (migrates poc/07)
- packages/cli       @frameless/cli        — `frameless build`; hosts agent playbook
- demos/ui-kit       private               — real demo TSRX library, proven surface
  only; owns its doctor script + receipt suite
- vendor/            pinned markless tarballs (poc/vendor promoted; sha256 receipts)

Divergences (charter requires rationale): (1) flat target packages, not literal
`targets/` nesting — org-convention constraint outranks the earlier phrasing; the
"targets architecture" survives as the FrameworkTarget contract. (2) vendor/ top-level
(markless has no vendored deps). (3) no docs app in v0.

## B. Target interface (exported from @frameless/compiler/target)

FrameworkTarget: { name; ir: 'frameless-enriched-ir/1'; versionMatrix (primary|
fallback + notes); emit(ir) -> {files, diagnostics} — Babel-AST, fail-closed with
construct-level diagnostics (W-C2 stance); gate(files) -> GateResult where every
policy carries a dossierRef (dossier -> gate traceability, per the idiom-dossier
constraint); adapter(mod) -> oracle Adapter (mount/dispatch/settle/unmount);
docs: { idiomDossier: path (contract-tested), generalityBoundary? (required for
solid) }. A compiler-package contract test validates every registered target.

## C. IR: keep frameless-enriched-ir/1 for v0

Schema already encodes sibling-vs-arm branch structure (schema.ts:111-150); poc/07's
S2 whole-arm duplication is an emitter lowering choice, fixable in target-solid.
Cutting /2 now = regenerate goldens + rev both emitters + re-run all evidence for a
problem one emitter owns. /2 is the composition tranche's vehicle. Guard: if the
branch-lowering fix hits true IR insufficiency, T006 stops and records a /2
requirement — no hacking /1.

## D. Build entry: CLI-first

`frameless build [--config frameless.config.ts] [--target react --target solid]
[--no-gate]`; defineConfig({ entry, targets: {react:{outDir}, solid:{outDir}},
gate: 'error', receipts: 'receipts/' }). The oracle's "one documented command" =
`pnpm install && pnpm e2e` (vp pack -> demo build -> gates -> browser matrix ->
verdicts). Vite plugin wraps the same pipeline in a later tranche.

## E. React 19 plan

Bump only target-react + demo lanes (POC evidence stays 18.3.1). poc/04 adapter is
already 19-shaped (act from 'react', createRoot, testing-library-free) — migrate
as-is, name 'react-19.x'. Proven surface emits no refs, so v0 emission unaffected;
T002 dossier records ref-as-prop and the gate rejects forwardRef (dead API in 19).
Risks: IS_REACT_ACT_ENVIRONMENT in browser mode; hooks-lint plugin >=5; scheduling
shifts. Validation order: contract tests -> goldens/gate under 19 -> ORACLE
RE-CALIBRATION INCLUDING FULL MUTANT CORPUS under 19 -> cross-target matrix. Version
matrix records 19.x primary with the validation receipt.

## F. Migration map

poc/04 -> oracle (adapters split OUT to target packages); poc/05 -> compiler
(src/ir -> src, goldens -> test; schema docblocks lifted to specs/framework/
01-enriched-ir.md); poc/06 -> target-react (regenerate.mjs becomes emit; React 19
here; dossier-driven changes only); poc/07 -> target-solid (S2 sibling-duplication
FIXED here per T003 evidence; ternary-vs-Show + todos()&& + attr:value decided by
T003; key-expression/row-reactivity generality stays documented boundary); poc/08 ->
oracle (verdict schema keeps blocked-by-upstream; markless-native leg re-enters after
the fixing board). poc/01-08 stay byte-untouched; suites re-run green at T009/T999.

## G. Worker cuts + resequencing

ORDER: T004 (scaffold+compiler) -> T007 (oracle) -> T005 (target-react) -> T006
(target-solid) -> T008 (cli+demo+e2e). Oracle-before-emitters per the prior goal's
canonical lesson; T005/T006 sequential (shared root config surface). Full
allowed_files/verify/stop_if per the receipt (transcribed into the board).

## Top-5 risks

1. React 19 recalibration (mutants must be re-proven under 19 before emitter verdicts).
2. Toolchain-split leakage into poc/ (workspace globs are load-bearing).
3. Solid branch-lowering fix vs the empty-anchor calibration issue (IR-escalation stop_if).
4. Demo scope creep toward composition (trim rule on board).
5. Fresh-checkout hermeticity (playwright provisioning, vendored tarballs) — pnpm e2e
   must document prerequisites or T999 fails on infrastructure.

## Flags (charter frictions, resolved not absorbed)

1. Flat packages/target-* vs literal targets/ nesting — convention constraint wins.
2. "doctor-script pattern" is a demo/app convention in markless, not a root lane —
   doctor lives in demos/ui-kit + playbook.
3. Board had oracle (T007) after emitters — resequenced before them.
4. Stale pre-rename install dir in poc/06 node_modules — T999 must verify poc suites
   from fresh installs.

---

# Critique adjudication (PM, final) — supersedes conflicting text above

Crew critique (high effort) verdict: REJECT as locked. PM accepts all amendments:

1. OWNERSHIP SPLIT (replaces the compiler-owned FrameworkTarget): @frameless/compiler
   owns EnrichedIR + builder + validation + diagnostics ONLY — it must not import
   oracle/DOM/React/Solid/gate/dossier types. @frameless/oracle owns Adapter,
   scenarios, traces, verdicts, receipt schemas. Each target package owns emitter +
   gate + adapter + dossier + version matrix as its own exports. @frameless/cli
   composes an INTERNAL registration (no published unified Target contract in v0;
   a package-inventory integration test in the CLI validates registrations).
2. CONVENTION CORRECTIONS: workspace globs include packages/*/fixtures/*; agent
   playbook ships from the PUBLIC CORE-equivalent package (packages/compiler/agent/
   frameless.md, files: ["agent","dist"]) mirroring markless/core, not cli;
   files/sideEffects are per-package choices, not universal; doctor = chosen app
   convention in demos/ui-kit (not claimed as mirrored); "protocol-with-producer"
   claim dropped; POC pins are MIXED (04/06/07 = vitest2/vite5, 05/08 = vitest4/vite8)
   — isolation rationale restated as lock-ownership, not version-hoisting fear.
3. POC ISOLATION: workspace exclusion + tsconfig exclusion + EXPLICIT poc/** excludes
   in every root tool lane (vite test projects, lint, fmt, hooks). Fresh-checkout
   proof requires explicit per-POC frozen installs: root e2e gains a test:poc script
   that iterates poc/* with `pnpm install --frozen-lockfile && pnpm test`.
4. V0 LIMITS RECORDED (the /1 deferral's price, decided now): exactly one exported
   component per .tsrx file, fail closed otherwise; no cross-TSRX component imports;
   generated output is JS/JSX only — NO .d.ts, NO sourcemaps in v0 (recorded as the
   top items of the /2 composition-tranche list and named in the report-facing docs
   as open gaps, consistent with the prior goal's honesty stance). Emitted extension
   + JSX runtime decided per-target by the idiom dossiers.
5. PIPELINE TRICHOTOMY stated: (a) source->EnrichedIR = @tsrx/core + vendored
   @markless/compiler(+serializer) only; (b) IR->generated JSX = target emitters, no
   markless anything; (c) generated JSX->browser modules = per-framework vite/babel
   transforms owned by the oracle harness. The v0 demo is compiled by Frameless
   directly — NOT production-built through @markless/core/vite.
6. REACT 19: adapter migrates with a T005 DECISION POINT on sync-vs-async act
   (dispatch may widen to void|Promise<void> with phase-semantics recalibration);
   full mutant corpus re-proven under exact 19 pins before any emitter verdict.
7. TASK RESHAPE: T004 narrowed (scaffold + vendor receipts + compiler migration +
   specs; NO cross-package contract work). T008 split: T008 = CLI + output-package
   format integration; NEW T010 = demo library + e2e + fresh-checkout proof.
   Order: T004 -> T007 -> T005 -> T006 -> T008 -> T010 -> T009 -> T999.
   T002/T003 dossiers run before their targets (research, read-only).
8. ADDITIONAL LOCKS: MIT license + repo metadata in T004; receipts schema versioned
   frameless-receipts/1 owned by oracle, written under receipts/ per build; atomic
   output (write temp dir, swap) in CLI; diagnostics/exit-code contract in
   specs/framework/05-build-entry.md; README per package (markless style); CI = the
   documented pnpm e2e + test:poc scripts (GH Actions workflow deferred, recorded);
   .gitignore extended for generated demo output.
9. T004 packet carries the critique's verbatim instruction block.
