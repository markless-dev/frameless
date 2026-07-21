# T003 — Decision-relevant probes (crew scout, executed, 2026-07-21)

EVIDENCE — Read-only T003 scout completed. All probe artifacts were confined to `/private/tmp/frameless-t003.HTpkHV`, then removed. Both the probe worktree and main checkout ended clean under `git status --short`.

## Probe 1 — Markless seed channel

EVIDENCE — Method: extracted pinned `markless-core-0.1.1.tgz` and `markless-web-0.1.1.tgz`; inspected their declarations/runtime; executed the public core runtime re-export with a minimal DOM-shaped root and valid payload scripts.

EVIDENCE — Input surface:

```text
ResumePayloadScriptsInput = {
  stateScript: string;
  viewScript: string;
  root: ResumeDomElement;
  loadSymbol: (...);
  createVisibilityObserver?: (...);
  createRemovalObserver?: (...);
  applyDomJournal?: (...);
  renderBranchHtml?: (...);
}

ResumePayloadDocumentInput =
  Omit<ResumePayloadScriptsInput, 'stateScript' | 'viewScript'> & {
    document: { querySelector(selector): PayloadScriptElement | null }
  }
```

EVIDENCE — `resumeFromPayloadDocument` reads the current text of `script[type="markless/state"]` and `script[type="markless/view"]`, then delegates to `resumeFromPayloadScripts`.

EVIDENCE — Runtime order is: decode scripts → adopt streamed patches if present → construct the graph from decoded state → create runtime → `runtime.start()` → mark the root started. State-cell precedence in the pinned implementation is event-only value → `directValue` → serialized `value`.

Verbatim empty-payload execution:

```text
before resume started=undefined
after resume started=true
decoded state cells=0
decoded view events=0
log=[]
result keys=decoded,graph,runtime
```

Verbatim seeded-cell execution:

```text
graph.read(theme-cell)=dark-from-early-script
order=["inline/early script populated strings","resume returned"]
runtimeStarted=true
```

EVIDENCE — Verdicts:

- VIABLE — The input shape permits generated code to provide complete payload-script strings directly.
- VIABLE — A cell value placed in the payload before resume is in the graph before runtime start or symbol/component wake. The executed case made no `loadSymbol` call.
- VIABLE — An earlier inline/generated bootstrap can construct or mutate the state payload before `resumeFromPayloadDocument` reads it, without modifying core. Core has no storage-specific merger, so generated integration code must perform the merge and know the graph-node identity.
- UNPROVABLE-WITHOUT-BROWSER — Actual progressive HTML/chunk ordering, streamed-patch interaction, and whether an imported early chunk always finishes before the generated resume entry executes.

EVIDENCE-LINKAGE — This strengthens the payload-channel feasibility assumed by candidates 1, 2, 4, 5, 6, and 7. It weakens claims that those candidates inherently require a core modification merely to inject an early value. The browser-order limitation remains priced for every first-paint variant.

## Probe 2 — Frameless seed consumption

EVIDENCE — React method: React/ReactDOM 19.2.3, real client reconciler, development StrictMode, `useSyncExternalStore`, and a minimal Node DOM host. The cell was initialized once outside the component from `window.__SEED__?.theme ?? initial`.

Verbatim React output:

```text
seeded mount dom=seeded-dark
seeded mount renders=["seeded-dark","seeded-dark"]
seeded mount stats={"seedReads":1,"initializations":1,"subscribeCalls":2,"unsubscribeCalls":1,"active":1,"notifyCalls":0,"driverReads":0,"writes":0,"value":"seeded-dark"}
consent-gated mount dom=light
consent-gated mount renders=["light","light"]
consent-gated mount stats={"seedReads":0,"initializations":1,"subscribeCalls":2,"unsubscribeCalls":1,"active":1,"notifyCalls":0,"driverReads":0,"writes":0,"value":"light"}
consent-gated late dom=stored-late
consent-gated late renders=["light","light","stored-late","stored-late"]
consent-gated late stats={"seedReads":0,"initializations":1,"subscribeCalls":2,"unsubscribeCalls":1,"active":1,"notifyCalls":1,"driverReads":1,"writes":1,"value":"stored-late"}
```

EVIDENCE — React first committed the seeded value. StrictMode rendered each snapshot twice but did not double-read or initialize the seed. After its deliberate unsubscribe/resubscribe cycle, one subscription remained active. Late enablement performed exactly one driver read, write, and subscriber notification; StrictMode then rendered the resulting snapshot twice without divergence.

EVIDENCE — Solid method: Solid 1.8.22 under Node with the browser-conditioned reactive core, testing both `createSignal` and `createStore` with `createRenderEffect`. Solid has no React-style StrictMode double-invocation mode.

Verbatim Solid output:

```text
seeded signal init value=seeded-dark
seeded signal init stats={"seedReads":1,"initializations":1,"driverReads":0,"setCalls":0,"observations":["seeded-dark"]}
consent-gated signal init value=light
consent-gated signal init stats={"seedReads":0,"initializations":1,"driverReads":0,"setCalls":0,"observations":["light"]}
consent-gated signal late value=stored-late
consent-gated signal late stats={"seedReads":0,"initializations":1,"driverReads":1,"setCalls":1,"observations":["light","stored-late"]}
seeded store init value=seeded-dark
seeded store init stats={"seedReads":1,"initializations":1,"driverReads":0,"setCalls":0,"observations":["seeded-dark"]}
consent-gated store init value=light
consent-gated store init stats={"seedReads":0,"initializations":1,"driverReads":0,"setCalls":0,"observations":["light"]}
consent-gated store late value=stored-late
consent-gated store late stats={"seedReads":0,"initializations":1,"driverReads":1,"setCalls":1,"observations":["light","stored-late"]}
```

EVIDENCE-LINKAGE — Seed-first initialization and graceful late updates strengthen the target-runtime feasibility of candidates 1–8. They particularly support the fallback-then-patch semantics in candidate 3 and C-REFRAME/candidate 4, while also showing that C-SPLIT candidates can safely downgrade to late enablement when an app withholds pre-paint permission. This evidence does not prove no-flash browser paint or hydration behavior.

## Probe 3 — Late-enablement semantics

EVIDENCE — The executed lifecycle is precisely:

```text
authored initial
→ first render/observation
→ app grants consent and enables driver
→ driver reads once
→ value is compared and committed once
→ active React uSES subscriber is notified once / Solid setter runs once
→ subscribed UI observes the stored value
```

EVIDENCE — No surviving candidate requires pre-paint storage access for reactive-cell correctness if its contract permits fallback-then-patch. Pre-paint access is required only for the stronger observable promise that the stored value appears on the initial paint.

EVIDENCE-LINKAGE — For C-SPLIT variants (candidates 1, 2, 5, 6, and 7), app-gated late enablement remains operational but necessarily forfeits no-flash initial paint. For C-REFRAME/candidate 4, the base persisted-cell semantic remains correct and the compiled pre-paint path is an upgrade. Candidate 3 explicitly occupies the graceful-upgrade-only position. Candidate 8 must expose readiness or tolerate the same transition.

## Probe 4 — Blocking-script cost

EVIDENCE — Method: generated consolidated scripts that read namespaced keys, JSON-decode present values, and populate `window.__SEED__`. The workload mixed a six-byte theme with approximately 100–700-byte preference, draft, and table-layout values. Each measured iteration used unique source text to avoid V8 source-cache reuse. `vm.compileFunction` plus execution was measured over 2,000 runs.

Verbatim output:

```text
{"keys":1,"scriptBytes":153,"storedValueBytes":6,"runs":2000,"uniqueSourceEachRun":true,"meanMs":0.0058,"medianMs":0.005,"p95Ms":0.0067}
{"keys":10,"scriptBytes":1269,"storedValueBytes":2270,"runs":2000,"uniqueSourceEachRun":true,"meanMs":0.0221,"medianMs":0.0213,"p95Ms":0.0243}
{"keys":50,"scriptBytes":6309,"storedValueBytes":12805,"runs":2000,"uniqueSourceEachRun":true,"meanMs":0.094,"medianMs":0.0913,"p95Ms":0.1028}
```

EVIDENCE — Order-of-magnitude statement: parse plus mocked execution was comfortably sub-millisecond at 10 keys and remained about one-tenth of a millisecond at 50 keys in Node V8.

EVIDENCE-LINKAGE — This strengthens the plausibility of consolidated seed artifacts in candidates 1, 2, 4, 5, 6, and 7 at tens—not hundreds or thousands—of small device-state keys. It does not distinguish their authorization or authoring surfaces.

## Probe 5 — Facade recognition

EVIDENCE — Method: loaded the product compiler’s `buildEnrichedIr` from `packages/compiler`, compiled the working `s1-render-once.tsrx` fixture unchanged, then changed only the import specifier from `@markless/core` to `@frameless/authoring`. The unchanged control completed with one component.

Verbatim control:

```text
control: PASS components=1
control keys=components,filename,imports,module,records,version
```

Verbatim facade diagnostic:

```text
Markless semantic compilation failed for src/fixtures/s1-render-once.tsrx: MARKLESS_FRAMEWORK_IMPORT_REQUIRED: Cannot use state() until it is imported from markless.; MARKLESS_FRAMEWORK_IMPORT_REQUIRED: Cannot use computed() until it is imported from markless.
```

EVIDENCE — Verdict: a non-`@markless` facade is not an accepted authoring source on today’s pin. Before Layer A, Frameless must either rewrite the facade import to the recognized Markless source or Markless’s semantic compiler must gain accepted-import-source configuration. The current product compiler does neither.

EVIDENCE-LINKAGE — This weakens present-day, zero-integration-cost claims for every candidate whose Frameless surface imports `@frameless/authoring`—candidates 1–7 and the app-authored side of candidate 8. It strengthens source import-rewrite as the available Frameless-side mechanism today; accepted-source registration remains a Markless-side change, not current behavior.

## Evidence limits

EVIDENCE — No browser was used. Still priced for a possible browser round: HTML parser/module ordering, actual first paint and flash, hydration, real synchronous `localStorage` cost, CSP nonce/hash behavior, streamed Markless patches, real progressive chunks, React’s rendered-script warning, Solid DOM rendering, and duplicate bundles.

EVIDENCE — The Markless execution used a valid crafted payload with one `directValue` cell and no symbols. It proves public API acceptance and graph timing, not generated-application chunk scheduling.

EVIDENCE — The React probe used the real reconciler but a minimal DOM host; SSR, hydration, Suspense, transitions, browser event delegation, and concurrent interruption were outside scope. The Solid probe exercised its reactive client core in Node, not its DOM renderer or SSR hydration.

EVIDENCE — The timing probe used Node V8 and an in-memory `localStorage` mock. Browser storage IPC, slower devices, parsing contention, paint blocking, and security policy can dominate these figures; therefore the result is a rough budget only.

EVIDENCE — Implementation-phase unknowns intentionally remain priced rather than probed: stable package/key identity across aliases and versions, SQLite/native driver lifecycle, cross-tab and malformed-value handling, manifest discovery, directive tooling, needed-at reachability, schema/migration compatibility, and a neutral cross-framework cell type.

EVIDENCE — The compiler harness’s Vite loader attempted to start a sandbox-blocked WebSocket listener and printed `listen EPERM`; module loading and both compiler calls nevertheless completed. The diagnostic above came from `buildEnrichedIr`, not from that listener failure.
