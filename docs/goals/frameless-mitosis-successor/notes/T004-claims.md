# T004 — Canonical claim list & POC plan (Judge decision)

Status: DRAFT by PM, pending high-effort crew critique (fable policy: nontrivial plans
receive plan critique before packet-cutting). Inputs: T001 (mitosis map), T002 (markless
map + gaps), T003 (adoption evidence).

## Thesis validation verdict

The successor thesis survives the evidence with one reframe. Mitosis failed on
**execution** (string IR, string-concat generators, no equivalence oracle, restrictive
dialect, DX) and **ownership** (single vendor, bus factor 1, strategic pivot) in a
**real but niche** market. External evidence does not prove the category impossible —
but it does prove the market is small (teams shipping 3+ framework targets) and that
web components already absorbed most of the demand. Therefore: the *technical* claims
below are provable; the *adoption* claims are strategic bets and must be labeled as such
in the report. The report's credibility rests on never mixing the two.

## Equivalence standard (used by all "works the same" claims)

Two compiled outputs of the same source component are **behaviorally equivalent** iff,
given the same initial props and the same scripted sequence of user events, they produce:

1. the same rendered DOM after each step — compared as a normalized serialization
   (tag structure, attributes minus framework-internal ones, text content, input
   element live state: value/checked/disabled/focus);
2. the same observable event side effects (callback-prop invocations, in order,
   with equivalent payloads);
3. equivalence is asserted after each framework's own scheduler settles ("settle then
   compare") — internal scheduling/batching differences are explicitly out of scope,
   final observable state is in scope.

The oracle must be validated by mutation testing: a deliberately introduced divergence
must cause a failure. An oracle that cannot fail is not evidence.

## Claims

### Part 1 — Postmortem claims (provable against @builder.io/mitosis from npm)

- **C1 [POC]** Mitosis silently discards ordinary component code: local variables and
  derived expressions in the component body are absent from emitted output, with no
  error or warning.
  *Proof sketch:* compile a `.lite.tsx` with a component-body local used in JSX via
  `parseJsx`+`componentToReact`; assert the local's computation is missing/broken in
  output while compile reports success. Verify: vitest run in `poc/01-mitosis-postmortem`.
- **C2 [POC]** Mitosis's string-based identifier rewriting produces syntactically or
  semantically invalid JavaScript from reasonable input (documented `const foo = foo`
  self-reference class of bugs).
  *Proof sketch:* compile a fixture where a local name collides with a state key or a
  destructured prop; parse emitted output with a real JS parser and assert the invalid
  binding (self-reference / TDZ / undefined identifier) is present.
- **C3 [POC]** Mitosis's own golden-snapshot pipeline accepts broken output: the Qwik
  generator emits references to undefined identifiers (`myEvent`) for basic fixtures.
  *Proof sketch:* run `componentToQwik` on the upstream Basic fixture; scope-analyze
  the emitted module (acorn + scope walk) and assert an unresolved reference exists.
- **C4 [POC]** The same Mitosis source produces observably different runtime behavior
  across targets (no common semantics): e.g. `onUpdate` without dependencies runs in
  React output but is silently dropped in Solid output.
  *Proof sketch:* compile one fixture to React and Solid; mount both (vitest + jsdom or
  playwright); drive the same interaction; assert the observable divergence. This is
  the "Mitosis has no equivalence contract" proof.
- **C5 [evidence, no POC needed]** Adoption facts: stars-vs-downloads gap, two verified
  adopters, maintenance collapse timeline, Voorhoede/SAP verdicts. Already sourced in
  notes/T003; the report cites sources directly. POC not applicable (external facts).

### Part 2 — Successor claims (provable with local markless dist + new POC code)

- **C6 [POC]** The component shapes Mitosis drops or bans compile without loss in
  markless `.tsrx`: component-body locals, closures over locals, destructuring,
  ordinary assignment/mutation, guard return.
  *Proof sketch:* author the same semantics as C1/C2 fixtures in `.tsrx`; run the
  markless compiler pass pipeline (from `packages/compiler` dist); assert zero
  diagnostics and that the semantic graph contains records for the constructs.
- **C7 [POC]** Markless's `SemanticGraphArtifact` captures, as typed records rather
  than strings, the semantics Mitosis's IR loses: path-level state reads/writes,
  computed dependencies, branch sites, keyed repeats, event sync policy, aliases.
  *Proof sketch:* dump the artifact for a todo-list fixture; assert the specific
  records exist and reference each other by id (state→computed→template read chain).
- **C8 [POC]** The semantic graph is sufficient input to emit *idiomatic* framework
  code: a POC emitter (graph → framework AST → printed source, no string templates for
  logic) produces React (hooks) and Vue 3 (script setup) components that real-framework
  toolchains accept and that pass an idiom gate: zero unused imports/variables, zero
  dead state, framework ESLint presets clean, and — the honest version of "idiomatic" —
  readable enough to hand-maintain.
  *Proof sketch:* `poc/03-frameless-emitter` consumes the dumped graph artifact for the
  fixture family (counter; keyed todo with @if/@for; computed; events) and emits both
  targets; verify = framework build + eslint + no-dead-code assertions.
  *Named judgment (high effort):* choosing the React mapping for markless's render-once
  graph semantics (component body must not re-execute observable work per render:
  useState + derived-in-render vs useSyncExternalStore vs useReducer) — the emitter must
  pick per-construct mappings that keep C9 passable while staying recognizably React.
- **C9 [POC]** Behavioral equivalence across targets is machine-checkable: a paired-run
  harness (per the equivalence standard above) passes for markless-web, POC-React, and
  POC-Vue outputs of the fixture family, and mutation testing proves the harness can
  fail.
  *Proof sketch:* `poc/04-equivalence-harness` mounts all three outputs, drives a
  scripted event sequence, compares normalized DOM traces + callback logs after settle;
  a seeded wrong-emit variant must be rejected. This is the direct answer to Mitosis's
  commented-out e2e assertions.
- **C10 [POC]** Mitosis cannot express what the fixture family expresses without
  rewriting: side-by-side authoring comparison (the C6 fixture in Mitosis-legal form
  requires restructuring; the naive form breaks per C1/C2).
  *Proof sketch:* falls out of C1/C2/C6 fixtures; presented as a table in the report.

### Part 3 — Strategic bets (labeled, argued, NOT POC-provable)

- **B1 [strategic bet]** Shared syntax creates a two-sided adoption funnel for
  markless (syntax users → markless-as-framework; markless library authors → all
  frameworks supported). Market outcome; POCs show feasibility only.
- **B2 [strategic bet]** Library/design-system authors are the right wedge (supported
  by T003: they bear the multi-framework cost; Amplify's RFC shows they also fear
  code-gen — the oracle is the counter-argument).
- **B3 [strategic bet]** A semantic graph + AST emitters + equivalence oracle keeps
  the per-target maintenance surface tractable where Mitosis's 18K string-concat lines
  were not. POC emitter size/structure is supporting evidence, not proof.
- **B4 [opinion]** In an AI-porting era, a compiler with an equivalence oracle becomes
  more valuable, not less: AI ports lack behavioral guarantees; receipts are the moat.

## Out of scope (recorded so the report can say so honestly)

- Production-grade emitters (only fixture-family coverage), Svelte/Solid/Angular
  targets, SSR/resumability preservation in emitted targets, type-preserving emission
  (noted as markless gap), analyzer/Witness integration into the harness (harness is
  purpose-built; analyzer receipts pattern is cited as design direction).

## Worker packages (proposed)

Sequential crew runs (dependency-installing verify ⇒ no parallel worktrees), each
diff-reviewed by PM before merge:

- **W-A** `poc/01-mitosis-postmortem` — C1, C2, C3, C4. Deps: @builder.io/mitosis
  (npm), react, react-dom, solid-js, vitest, jsdom, acorn. Effort medium.
- **W-B** `poc/02-markless-graph` — C6, C7. Deps: markless dist via file: links.
  Effort medium.
- **W-C** `poc/03-frameless-emitter` — C8. Effort high (named judgment above) ⇒
  mandatory second-model branch critique at merge.
- **W-D** `poc/04-equivalence-harness` — C9 (+C10 table data). Effort medium-high;
  depends on W-B/W-C outputs.
- **W-E** `docs/report.md` (T006) — the easy-to-understand report, claims tagged
  `[POC: poc/…]` / `[strategic bet]`. Effort medium. PM verifies claim-map completeness.

stop_if (all packages): need files outside allowed_files; claim unprovable as stated
(return blocked — Judge rewords, never fake); verification fails twice; markless
capability gap blocks a POC (record as finding).

## Decision (pending critique)

Approve claims C1–C10/B1–B4, equivalence standard, and W-A…W-E sequencing; dispatch
W-A first.
