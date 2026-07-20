# T004 — Composition architecture lock (Judge receipt note)

Provenance: goal-judge, high reasoning, 2026-07-20. Read-only. Inputs: T001/T002/T003 notes in full, v0 board + adjudicated v0 T001 architecture note (all addenda), owner decision of 2026-07-20 (tiered record-driven React shared lowering, binding), live contract sources verified (`packages/compiler/src/schema.ts`, `build.ts:141/147/588`, `packages/analyzer/src/types.ts`, `scenarios.ts`). Second-model critique mandatory before packet P1 dispatch (architecture package, charter rule).

## 1. ENRICHED-IR/2 CONTRACT

### 1.1 Versioning and migration — single-version cutover

`ENRICHED_IR_VERSION` becomes `frameless-enriched-ir/2`. **One live version**: the compiler emits /2 only; both emitter validators bump to require exactly /2 and reject /1 and unknown versions fail-closed. Rationale: nothing external consumes /1 (nothing published; poc/ carries its own frozen copies and stays byte-untouched per v0 discipline); dual emission creates silent-downgrade paths that violate the fail-closed charter constraint; two live versions double every gate path. Migration = one coordinated cutover package (P1, §6) in which compiler /2 lands together with mechanical emitter version-validation bumps and golden regeneration, so every v0 lane is green at the merge boundary. Emitters fail closed with construct-level diagnostics on any /2 construct they do not yet lower (component-reference, slot projection, shared records, handle records) — this is what lets P1 merge before the emitter packets land.

### 1.2 Component ownership (repairs T001's name-keyed-env finding)

Every record in `EnrichedRecordTable` — bindings, aliases, events, stateReads, stateWrites — plus every new record class gains a required `componentId` (Frameless-owned, deterministic, derived from the component's export identity and ordinal). The name-keyed `bindingsByName`/`aliasesByName` maps (build.ts:147-153) are replaced by `(componentId, name)` scoping. T001: "Binding environments are keyed only by binding name, which is unsafe once components may reuse local names" (T001 §Layer B limits, build.ts:147). The pin lacks upstream 767f5c0's explicit `componentId`/`bindingId`, so ownership is **derived by the compiler** from source spans + host/event associations, which T001's inference finds sufficient for the executed probes — locked contractually: attribution is a compiler responsibility; any record that cannot be attributed to exactly one component is a fail-closed diagnostic; **emitters never rediscover ownership from source** (T001 shared-row requirement; T002 §1 gate sketch; T003 §2 "not source reconstruction"). Overturn trigger: when the gated vendor refresh delivers explicit binding identity, derivation is replaced by record consumption as its own verified change.

### 1.3 New template nodes

Two new `TemplateNode` kinds (schema.ts currently has host/text/dynamic-text/branch/keyed-repeat/fragment only — T001, schema.ts:143):

- **`component-reference`**: `{ kind, id, edgeId, target: { localName } & ({ module: 'self' } | { module: <specifier>, exportedName }), props: ReadonlyArray<ComponentPropExpression>, children: ReadonlyArray<TemplateNode> }`. Props are structured `ExpressionSite`-based records (never string snippets); the authored child subtree is **preserved in full**, not `childCount` (T001 cross-file row and children row: "Preserve the authored subtree, not only Layer A's count"). Keyed to the Layer A component edge, which /1 currently drops entirely (T001, build.ts:248).
- **`default-slot-projection`**: a distinct node in the receiving component marking where `children` is projected. `{children}` must not lower as an ordinary dynamic-text node (T001 children row; T002 §2 gate; T003 §1 gate).

Named/capture slots get **no** node kinds in /2: the capture-slot/passthrough ABI is upstream-only (767f5c0/61e4634/b8844a6/1c2ce1a per T001) and /2 must later consume vendor records rather than reproduce that analysis. Recorded, gated.

### 1.4 Shared-state records

Adopt T003 §2's record shapes verbatim as the /2 contract (they are the convergence point of T001's requirement row and T002's consumption contract):

- `SharedDefinition { id, scope: 'request'|'container'|'page', cells (name + valueKind), methods, graphBindings, returnProperties, dependencies }`
- `SharedInstance { definitionId, componentId, localName }`
- `SharedRead { definitionId, propertyName, path, componentId, site }`
- `SharedCall { definitionId, methodName, arguments (AST), componentId, event/site, order }`
- `SharedWrite { definitionId, graphNodeId, path, operation, value/arguments (AST), order }`

Fail-closed rules: a Layer A graph containing shared semantics that the builder cannot fully map to these records is a **diagnostic, never a silent drop** — this repairs the /1 debt T001 proved (shared semantics present in Layer A, silently absent from /1). Scope is preserved verbatim including `request` (T003 §4: never silently rewritten to `container`).

### 1.5 Element-handle, behavior, and handle-call records

- `ElementHandleBinding { id, handleName, componentId, hostNodeId }` (matches the Layer A record T001 observed).
- `BehaviorRecord { id, hostNodeId, componentId, behavior (AST), inputs: GraphReadRef[], returnsCleanup: boolean, order }` — install order and reverse cleanup order per the Markless behavior contract cited in T003 §3.
- `HandleCallRecord { handleBindingId, method, arguments (AST), optional (?.), site/event linkage }` — structured imperative calls (`input?.focus()`), never selector or spelling rediscovery.
- **Fail-closed repair**: `el`/`attach` must never appear as `DynamicBinding` attributes. The /2 builder either emits the records above or errors; the /1 behavior (mangling both to plain attrs, dropping behaviors and giving the focus handler no reads — T001 direct-ref row) is a named regression class with a contract test.

### 1.6 Module/export linkage and the multi-module compilation model

Within the ONE-FILE-AT-A-TIME pin: `buildEnrichedIr` stays a per-file pass (not-a-compiler directive, v0 addendum 1 — no reimplementation of markless analysis). /2 adds:

- The relative-import guard (build.ts:141) is removed; `.tsrx` relative imports are retained as resolved `ModuleImport` records with `resolvesTo: 'tsrx-module'` marking.
- A new pure **module-set resolver** exported by `@frameless/compiler`: given a set of per-file /2 artifacts, it validates that every `component-reference` with an external target resolves to a compiled sibling module's exported component, fails closed on missing modules, unresolved exports, and **import cycles** (diagnostic, not support). The CLI orchestrates: compile each file independently, then module-set-validate, then emit per module with relative import specifiers rewritten to generated extensions.
- **v1-tranche answer to T001's needs-decision (cross-component ref forwarding): DEFER the module-link phase entirely.** Rationale weighed against the vendor-refresh gate: (a) child-side `el={props.x}` is rejected by **Layer A itself** on the pin (`MARKLESS_ELEMENT_HANDLE_PROP_UNSUPPORTED`), so any link phase built now would have to pre-empt or reimplement vendor semantic analysis that upstream 943dcfd already implements — a direct not-a-compiler violation and throwaway work once the refresh lands; (b) T001 is explicit that "a vendor refresh alone does not define how buildEnrichedIr supplies incoming-edge context," so this is a post-refresh design task with real vendor records in hand; (c) the goal oracle's ref requirement ("ref-driven focus") is satisfiable without it (§2). Not cheap, not safe → OUT, recorded on the vendor-refresh gate list.
- Other /1 fail-closed repairs land in /2: the `return []` unknown-template-node fallback (build.ts:588; T001 cites 587 — same fallback, line drifted by one in current source) becomes an exhaustive diagnostic; `findComponents` (build.ts:274) drops the exactly-one guard and instead requires every top-level TSRX component to be attributable and every exported one to appear in `module.exports`.

## 2. SURFACE DEFINITION (this tranche)

**IN — all five T001 buildable-on-pin verdicts, nothing more:**

1. Multi-component `.tsrx` modules (exported and local child components).
2. Cross-file component references (framework-native JSX composition via module-set resolution, §1.6).
3. Default children projection (ordinary `children` authoring → component-reference child subtree + default-slot-projection node).
4. Same-module `shared()` — all three recorded scopes, with the honesty limits of §4/§5.
5. Direct refs/attach: `element()` handles, behaviors with cleanup, structured handle calls, within the owning component.

**OUT — recorded and gated, not improvised:**

- Cross-file imported `shared()` — Layer A rejects on the pin (`MARKLESS_STATE_HELPER_RETURN_UNSUPPORTED`; upstream de15cdf). **Blocked on vendor-refresh gate.**
- Typed capture slots / named slots / passthrough ABI — upstream-only. **Blocked on vendor-refresh gate.**
- Ref forwarding across independently compiled modules — deferred per §1.6. **Blocked on vendor refresh + post-refresh link design.**
- SSR, Solid 2 runtime, Qwik, vendor refresh itself — charter gates, unchanged.

**CONDITIONAL (Flag F1):** goal.md says refs mean "element access across component boundaries." Same-module parent→child handle forwarding is buildable-on-pin (T001 same-module probe) and T002 §3 has an evidenced React ruling; but **T003 excluded all forwarded refs** — no Solid evidence. Per the no-taste-call rule, same-module ref forwarding enters the surface **only after a Solid dossier addendum** (scout A2, §6); otherwise the tranche ships direct refs, which fully satisfy the binding state.yaml oracle ("ref-driven focus"). state.yaml wins over goal.md prose; trim recorded for owner visibility.

Honesty note: the oracle's "shares state between components" is satisfied by same-module multi-component shared() (distinct components, one file); "composes components across files" by children/slots + component references. Cross-**file** shared state is not claimed anywhere in this tranche's receipts.

## 3. LOWERING CONTRACTS

### 3.1 React (T002 + OWNER DECISION, binding)

**shared():** tiered, record-driven — the emitter switches on `SharedDefinition`/`SharedRead`/`SharedCall` shapes, never on source spelling:

- General case (≥2 cells with differing per-component read sets, or any method): **provider-scoped store + per-cell `useSyncExternalStore` subscriptions, wrapped in ONE emitted hook named after the authored factory** (`useCounter()`), so components read like hand-written React. Notifications wired from `SharedWrite`/`SharedCall` records to exactly the affected cell subscriptions (T002 executed evidence: provider_store B=0; context B=1 with and without React Compiler).
- Prop threading: only when exactly one scalar cell, no methods, and every reader/writer is a direct child of the composite root.
- Scalar context: one scalar cell, no methods, deeper fan-out — also wrapped in the emitted authored-name hook (internally `useContext`); props tier alone cannot take the hook form and is recorded as such.
- Object context: only when every consumer's recorded read set equals the complete cell set.
- Module store: only for explicit recorded `scope: 'page'`, single page instance, client-only. Never inferred from module placement.
- Missing/ambiguous shared records → emission stops (fail-closed).

**children:** opaque `ReactNode` prop, direct `{children}` projection; component-reference emits authored nested JSX. Forbidden: `Children.*`, `cloneElement`, render props, string synthesis.

**refs:** `useRef(null)` per `ElementHandleBinding`; imperative calls only from recorded handlers/behaviors with the null guard; React 19 ref-as-prop only under the F1-conditional forwarding surface; `forwardRef`, string refs, `useImperativeHandle` rejected.

**attach/behaviors — Flag F2, dossier gap:** T002 contains **no ruling** for lowering `BehaviorRecord`s in React (setup/cleanup, input-change reinstall, reverse-order cleanup). Candidates (React 19 ref-callback cleanup returns vs `useEffect` groups) must be decided by a **dossier addendum (scout A1)** before the React emitter packet. Not taste-called here.

**React Compiler:** neither required nor assumed; uncompiled generated JSX is the correctness authority; optional additive compiled lane must produce equivalent observations; gate rejects emitted directives/compiler-runtime imports; no perf claim may rely on compiler-only memoization.

**React gate policies:** R-SH1 shared lowering requires complete record set — reject otherwise; R-SH2 context only under one-cell or full-read-set conditions, memoized provider value, no method-bearing object; R-SH3 store lowering requires stable store identity, per-cell subscribe/getSnapshot, notifications exactly matching write records; R-SH4 module store requires recorded page scope; R-SH5 idiom selection by IR records only; R-CH1 distinct component-reference + slot-projection nodes required; R-CH2 projected subtree preserved exactly once; R-RF1 `useRef` only for a handle record; R-RF2 ref target must be the resolved host (or F1 edge-linked child host); R-RF3 imperative access only from recorded sites with null guard; R-RF4 reject forwardRef/string refs/uIH; R-CP1 no compiler directives/runtime imports.

### 3.2 Solid (T003, binding rulings)

**children:** plain `{props.children}` for single opaque projection; `children(() => props.children)` only for multi-read/inspect/iterate, exactly one component-local binding, all uses through it; `props.children()` rejected absent a function-child construct.

**shared():** scope-switched, exhaustive, fail-closed on unknown scope: `page` → module-scope signal/store singleton with stable actions, no owner-dependent primitives; `container` and CSR `request` → constructed once in the generated composite root, exposed via generated `createContext` provider with a referentially stable value carrying accessors/store/actions (never snapshots); `request` tag preserved in metadata though observationally equal to container in CSR. Cell lowering by recorded `valueKind`: scalar → signal, object/array → store. Props threading only under explicit edge/route records. Module singleton for container scope rejected.

**refs/attach:** `let` variable + native `ref` attribute; setter refs only under an explicit reactive-handle record (none in /2 → rejected by default); `attach` lowered to named `use:` directives per host behavior group, consuming behavior AST/input/cleanup records, explicit `onCleanup` registration, cleanup-before-reinstall on tracked input change, authored install order and reverse cleanup order. Solid 2 ledger recorded (use: removal, ownerless callback refs) — overturn trigger only.

**Solid gate policies:** S-CH1..S-CH5 (component-reference subtree ownership; single-projection `props.children`; multi-read via one `children()` binding; reject `props.children()`; reject dropped/duplicated/dynamic-text-lowered projections; one composite root); S-SH1..S-SH7 (record-resolved reads/calls/writes via preserved `sharedDefinitionId`; valueKind lowering; page = exactly one module instance; container/request = no module reactive state + one provider enclosing all recorded consumers; stable provider value; no owner-dependent primitives in page singletons; every recorded write/call emitted exactly once in authored order); S-RF1..S-RF7 (handle → exactly one native host ref; `el`/`attach` never emitted as DOM attributes; plain assignment; structured calls with optionality preserved; directive consumes all behavior/cleanup records; reinstall + reverse-order rules).

Both gates keep the v0 pattern: per-policy bypass-mutation tests, e2e discovery tests, dossierRef traceability.

## 4. ORACLE EXTENSION

- `Scenario` gains an optional `expectations` array — kinds: `dom-text { phase, selector, text }`, `dom-present { phase, selector, present }`, `focus { phase, selector | path, selection? }`. Each framework's RunTrace must satisfy them **independently, in addition to** cross-target equality — closing T001 Layer C's hole. Action vocabulary unchanged.
- Versioning: no serialized-shape change without a deliberate fail-closed version decision (exact choice delegated to P2's critiqued packet — Flag F4). Expectation failures surface as a first-class channel in verdict/receipts.
- Composition mutant classes (calibrated per framework before emitted output is judged): M-SLOT-OMIT, M-SLOT-DUP, M-SHARED-DESYNC, M-SHARED-STALE, M-REF-FOCUS-OMIT, M-ATTACH-CLEANUP-OMIT, M-METHOD-ORDER. Calibration must reject every class in both frameworks.
- Mounting: one generated composite root through the existing single-root adapters. Page-vs-container isolation cannot be proven single-root: add a two-mount browser test per framework calibration lane. Until it exists, no receipt claims scope isolation (Flag F5).

## 5. DEMO SHAPE

New package **`demos/composition-kit`** (do not extend `demos/ui-kit` — v0's demo is the regression baseline). Files: `src/frame.tsrx` (Frame with default-slot projection, imported cross-file), `src/dashboard.tsrx` (multi-component: shared() with ≥2 cells + method → store tier + emitted hook; Incrementer + Reader; container scope), `src/status.tsrx` (trivial single-scalar shared → props/scalar-context tier, proving tiering is real), `src/search.tsrx` (element() + attach with cleanup + focus trigger), `src/page.tsrx` (cross-file imports + projected children). Scenarios: C1 slot rendering, C2 shared propagation, C3 ref-driven focus — all with expectations. Page scope exercised in framework-lane two-mount tests, not claimed by demo receipts. `pnpm e2e` extends to composition-kit alongside ui-kit.

## 6. WORKER PACKAGE CUT

Order (oracle-machinery-before-emitters; every merge keeps all v0 lanes green):

- **A1 (scout, parallel to P1):** React attach/behavior lowering addendum to T002 (ref-callback cleanup vs effect groups; reinstall; reverse-order cleanup). Hard prerequisite of P3.
- **A2 (scout, optional per F1):** Solid same-module forwarded-handle addendum to T003.
- **P1 — enriched-ir/2 cutover:** compiler /2 + mechanical emitter version bumps + golden regeneration. allowed: packages/compiler/**, frameworks validator+goldens only. Critique MANDATORY.
- **P2 — analyzer composition extension + calibration:** expectations vocabulary + version decision; C1-C3 scenarios; handwritten composition references; seven mutant classes calibrated; composite-root pattern; two-mount scope test. Critique MANDATORY.
- **P3 — React composition emitter + gate** (requires A1). Critique MANDATORY.
- **P4 — Solid composition emitter + gate.** Sequential-preferred after P3. Critique MANDATORY.
- **P5 — composition demo + CLI module-set orchestration + e2e extension + docs.** Fresh-clone verification mandatory (v0 T011 lesson).
- Then T998 boundary review, T999 final audit.

## Flags

- **F1** — same-module ref forwarding surface: conditional on scout A2 (owner decision).
- **F2** — React attach/behavior lowering: scout A1 hard prerequisite of P3.
- **F3** — cross-module ref forwarding module-link phase: DEFERRED (not-a-compiler + vendor gate).
- **F4** — analyzer/receipts version choice delegated to P2 under critique; fail-closed bump rule locked.
- **F5** — page-scope isolation unprovable single-root; no claim until the two-mount test exists.
- **F6** — T001's build.ts:587 citation is line 588 in current source (same defect, verified).
- No T001 finding gates the whole tranche on the vendor refresh: the buildable-on-pin surface covers every element of the oracle signal.

---

## PM ADJUDICATION of the lock critique (2026-07-20, verdict: reject — all five amendments accepted)

The second-model critique rejected the first lock draft on five findings. Adjudications:

1. **Ownership (blocker) — accepted in full.** `EnrichedComponent` gains a module-stable
   `id` (module-relative ordinal + name, export-independent so unexported local children
   are owned). Records split into COMPONENT-OWNED (bindings, aliases, events, reads,
   writes, instances, handle bindings, behaviors, SharedRead/Call) vs MODULE-OWNED
   (SharedDefinition, definition-level factory writes) — the universal-componentId claim
   is withdrawn. The attribution algorithm + ambiguity diagnostics must be DESIGNED FROM
   EXECUTED EVIDENCE: scout probes commissioned (duplicate local names, unexported
   children, factory-owned writes, nested hosts, events) BEFORE the compiler unit is cut.
   If attribution is unprovable for a record class, that construct is trimmed or
   vendor-gated — recorded, not guessed.
2. **Shared-method transaction semantics (high) — accepted.** Dossier addendum
   commissioned with executed probes: multi-cell method atomicity, notification ordering,
   intermediate-snapshot visibility, cross-target observation order. The tier decision
   stands (owner); the transaction contract is added evidence-first.
3. **P1 packaging (high) — accepted.** P1 becomes an atomic integration MILESTONE of
   three transcribed crew units: P1a compiler (/2 schema+build+resolver), P1b React
   validator, P1c Solid validator + coordinated golden regeneration with REVIEWED JSON
   diffs, an explicit BYTE-IDENTICAL emitted-JSX negative control for S1-S3, exact verify
   commands (the charter lanes verbatim), and stop_if for unexplained legacy drift or any
   framework change beyond validation. The milestone merges as one PM-reviewed boundary.
4. **Oracle observability (high) — accepted.** M-ATTACH-CLEANUP-OMIT: `runScenario` gains
   an optional post-unmount observation of a caller-provided witness OUTSIDE the host
   (document-level selector observed after unmount, before host removal) — exact
   mechanism and versioning decided inside P2 under its mandatory critique, but the
   observability REQUIREMENT is locked: no cleanup mutant may be claimed rejected without
   a post-unmount witness. `dom-present` gains count semantics (`count: n` replaces
   boolean presence where cardinality matters — M-SLOT-DUP asserts count 1). M-METHOD-ORDER
   scenario must be noncommutative by construction (e.g. append-then-clear vs
   clear-then-append distinguishable states).
5. **Module-set resolver contract (medium) — accepted.** Locked here: canonical module
   identity = POSIX-normalized path relative to the build invocation root, extensions
   explicit (`./x.tsrx` only; no extensionless/index resolution — fail closed); duplicate
   module = diagnostic; resolver input = `ReadonlyArray<{ moduleId, artifact }>`, output =
   validated link table `{ moduleId, references: [{ nodeId, targetModuleId, exportedName }] }`
   or construct-named diagnostics (missing module, unresolved export, cycle with the cycle
   path); generated filename mapping = same basename, `.jsx`, per-target directory (v0 CLI
   convention); CLI transition = `build` accepts MULTIPLE .tsrx inputs (repeated
   positionals), compiles each, module-set-validates, emits per module — single-input
   invocations remain valid and receipt-compatible (additive build-receipts change under
   its own review in P5).

Baseline note: the critique's sandbox `pnpm test` failure (vite-temp EPERM, 2
formatting-test fallout) is a sandbox artifact, not a repo regression — PM re-verifies
the green baseline at the P1a merge.

Flags added: F7 ownership-attribution feasibility (scout-gated), F8 legacy golden/emitted
byte-stability controls (P1 milestone), F9 shared transaction semantics (addendum-gated),
F10 module-set/CLI mapping (locked above), F11 cleanup observability (P2 requirement).

---

## PM ADJUDICATION 2: probe results folded in (2026-07-20)

**F7 RESOLVED (ownership, notes/T004a-ownership-probes.md):** the attribution algorithm
is locked exactly as the probe evidence supports — span ownership from component AST
ranges (single-candidate joins only), explicit coordinates preferred and cross-checked
(componentName, sharedDefinitionId, edge names, hostNodeId), hosts by the executed
source-order cursor join with host-linked records inheriting ownership, shared
definitions/returned-properties/helper-writes MODULE-OWNED. TRIM (fail-closed, this
pin): two components in one module declaring the SAME local binding name is a
construct-named diagnostic (probe 1 proved no distinguishing coordinate exists;
vendor identity refresh is the recorded path to lifting it). Never a module-global
name-map fallback. Record classes not collision-probed (aliases, branch sites,
keyed-repeat ownership in multi-component modules) attribute only via
single-candidate joins and otherwise fail closed.

**F9 RESOLVED (transactions, notes/T004b-shared-transactions.md):** the emitted React
store contract is NOTIFICATION-ATOMIC — synchronous write-through in authored order
inside methods (later statements read earlier writes), notifications suppressed
during the method, ONE post-method notification phase notifying only cells whose
final value changed (Object.is), version-cached snapshots (identical object for
unchanged version — probes showed the per-read-rebuild failure mode: React cache
warning, 54 renders, update-depth crash). Executed proof that React automatic
batching is NOT sufficient (inline subscribers observed A-new/B-old under
notify-per-write). Cross-target: Solid's synchronous batch within the event yields
the same post-dispatch observation; the oracle's post-dispatch window sees final
state in both frameworks — traces stay equal. Gate rules: R-SH3 extends to require
deferred-notification + version-cached snapshots; mutant M-SHARED-TEAR (notify-per-
write exposing intermediate state to a subscriber-driven observer) joins the
calibration classes.
