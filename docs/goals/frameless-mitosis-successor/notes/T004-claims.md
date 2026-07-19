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

---

# Critique adjudication (PM, final) — supersedes conflicting text above

Crew critique (gpt-5.6-sol, high effort, run 2026-07-19T19-28-45-467Z) reviewed this
plan. PM accepts the following amendments; where the draft above conflicts, this
section wins.

## Accepted amendments

1. **C8 restructured.** `SemanticGraphArtifact` alone cannot reconstruct components
   (host records lack structure/attrs; branch arms, locals' initializers, template
   tree absent; expressions remain strings). New package **W-C0** builds an
   **enriched IR** (TSRX AST + semantic records, dumped as an artifact) and C8 claims
   only fixture-family sufficiency of that enriched IR. "Idiomatic" is replaced
   throughout by a published, machine-checkable **conventionality gate**: pinned
   builds + strict typecheck, recommended framework lint (incl. React Hooks rules),
   AST policies (stable keys, no render-phase setters/effects, no unused/dead code,
   hooks at valid sites, disclosed adapters only), plus size/complexity comparison
   against the hand-written reference implementations from W-D0.
2. **Targets: React + Solid** (not Vue). Rationale: Solid is semantically closest to
   markless (fine-grained), React is farthest (rerender model), and the pair closes
   the loop with C4's proven React/Solid divergence in Mitosis. Vue moves to
   out-of-scope with no inference claimed.
3. **Oracle-first sequencing.** W-D0 (observation model, hand-written React+Solid
   reference implementations of the fixture family, mutant corpus) lands before any
   emitter work. Emitters are then judged by a pre-validated oracle.
4. **Equivalence standard tightened** (C9): observations at mount / before+after each
   dispatch / after one microtask / at bounded quiescence (timeout = failure, no
   sleeps); allowlist-only normalization (never blanket-strip data-*/classes);
   compare namespaces, ordered children, semantic attrs, live properties (value,
   checked, selected, disabled, focus, selection range), DOM-node identity and focus
   preservation across keyed reorder/remove; callback order, payload fields, phase,
   defaultPrevented, handler multiplicity; **mutant classes per observation channel**
   (wrong text/property, omitted/reordered callback, broken key identity, wrong
   cancellation, duplicate handler). Claim is explicitly fixture- and phase-scoped
   CSR equivalence.
5. **Claim rewordings accepted as proposed** for C1, C2, C4, C5, C7 (version-pinned,
   fixture-scoped, no generalization beyond what the POC shows; C5 becomes
   date-stamped atomic evidence claims with "research identified" phrasing).
   **C3** becomes: 0.13.2 emits unresolved `myEvent` AND the same defect appears in
   the repo's accepted golden snapshot (regenerate + scope-check + snapshot compare).
   **C6** upgraded to behavioral proof: markless 0.1.1 accepts AND preserves
   observable CSR behavior of the fixture family (full CSR execution against the
   scenario oracle, not just zero diagnostics). **C10 dropped** as a claim; retained
   as a non-claim comparison table fed by C1/C2/C6.
6. **C11 added (scoped):** for the C1-class inputs Mitosis silently mangles, the
   markless compiler emits actionable compile-time diagnostics (file/span/message) —
   proven in W-B. Runtime **source maps remain an honest open gap for both mitosis
   and markless** (markless production transform returns map:null) and the report
   must say so prominently, since debugging was the #1 external complaint.
7. **Hermeticity:** POCs consume markless via `pnpm pack --pack-destination` vendored
   tarballs (checksums recorded in receipts) — no `file:` links to src exports, no
   machine-specific absolute paths committed. Mitosis pinned at 0.13.2. Babel parser
   + scope analysis (not bare acorn) for scope proofs. Toolchain versions recorded.
8. **Scope-honesty additions:** out-of-scope now also names async semantics, cleanup/
   attach, slots/children/context composition, styling, multi-module builds,
   performance/bundle size, accessibility, framework-version ranges, SSR/hydration/
   resume, HMR, type-preserving emission, and generated-code debugging. Market-size
   statements phrased as "evidence is consistent with", adopter counts as "research
   identified".

## Final package plan (sequential crew runs; PM diff-review each; critique mandatory for high-effort packets)

- **W-A** (`poc/01-mitosis-postmortem`, medium): unit A1 static failures C1+C2+C3;
  unit A2 runtime divergence C4.
- **W-B** (`poc/02-markless-graph`, medium): C6 (behavioral), C7 (reworded), C11.
- **W-D0** (`poc/03-equivalence-oracle`, medium): observation model + hand-written
  React/Solid references + mutant corpus; oracle validated before emitters exist.
- **W-C0** (`poc/04-enriched-ir`, high — named judgment: designing the enriched IR
  that closes the semantic-graph→template gap): enriched IR builder + dump.
- **W-C1** (`poc/05-emit-react`, high — named judgment: React mapping for
  render-once graph semantics that passes the oracle while staying conventional).
- **W-C2** (`poc/06-emit-solid`, medium).
- **W-D1** (`poc/07-equivalence-results`, medium): generated outputs into the oracle;
  C9 verdicts + conventionality-gate results.
- **W-E** (`docs/report.md`, medium): report with claim→POC map + PM claim audit.

## Decision

APPROVED with the amendments above. Claims C1–C9 (as reworded) + C11 are the
canonical provable set; B1–B4 strategic bets unchanged; C10 demoted to comparison
table. Dispatch W-A first.

---

# Naming addendum (2026-07-19, user decision)

The successor tool is named **Arcade** (user owns the `arcade` npm package). "Frameless"
was the working title; the goal slug/directory stays as-is for board continuity, but all
public-facing artifacts (docs/report.md, POC READMEs' framing, emitter package naming in
W-C0/W-C1/W-C2/W-D1/W-E packets) use Arcade. Strategic bet B1 restated: **Arcade is the
front door — using Arcade naturally means using markless** (same syntax/semantics;
Arcade compiles it to other frameworks, markless runs it natively).

# Framework-version addendum (2026-07-19, user decision)

Arcade-side POCs target **Solid v2** (`solid-js@2.0.0-experimental.16` — latest
available; no stable 2.0 yet) and **Qwik v2** (`@qwik.dev/core@2.0.0-beta.38`) wherever
those frameworks appear. Mitosis-output POCs stay on the versions mitosis's generated
code actually supports (Solid 1.x), with the v2 incompatibility recorded as a finding
(poc/02 test/solid2-compat.test.ts): mitosis emits `solid-js/web` imports that Solid v2
no longer exports and offers no version targeting. W-C2 (poc/07-emit-solid) must emit
Solid v2 idioms; if its toolchain (babel-preset-solid v2 line) blocks testing, record
findings rather than silently falling back to v1.

# Effect-model addendum (2026-07-19, user design direction)

Markless deliberately has no author-facing effect primitive; the report must present
this as a load-bearing design argument, evidence-backed:
- The emitted React for S1-S3 contains ZERO useEffect: derived values compute in
  render ("You Might Not Need an Effect", enforced by construction). Cite poc/06.
- Where effects are genuinely required in React output (attach behaviors, async),
  the compiler synthesizes them with exact dependency arrays derived from typed
  path-level graph records — vs Mitosis's comma-split dep strings (T001 evidence).
  Authors never write dep arrays; the stale-closure/missing-dep footgun class is
  eliminated at the language level.
- Honest caveat: React effect timing (passive vs layout) is target-specific;
  attach-behavior mapping is future work outside the current fixture family and
  must get its own oracle round before being claimed.

# Sink-model addendum (2026-07-19, design discussion, direction not decided API)

User direction: markless needs no effects; the only residual class is state->external
sink (localStorage persistence etc.). PM-endorsed framing for the report's successor
design section: markless's four effect buckets each have a principled home — computed
(derivation), attach (element lifecycle), async computed/events (data in) — and the
remaining bucket is best served by a DECLARED one-way sink primitive (reads graph,
cannot write it, owner-scoped cleanup) rather than handler-scattered writes. Sinks
cannot cascade by construction and are provably emittable (React useEffect with
machine-derived exact deps / useSyncExternalStore; Solid createEffect), oracle-checkable
like callback traces. Present as stated direction, not a claim; nothing in the current
fixture family exercises it.
