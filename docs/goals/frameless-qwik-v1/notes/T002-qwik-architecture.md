# T002 — Qwik v2 emitter architecture lock

Phase-boundary decision note. Locks the IR→Qwik-v2 emit contract, the SSR/vite lane, the
resume-witness plan, the gate/schema application, and the pin — from the T001 seam evidence
(`notes/T001-qwik-emitter-seam.md`) and the SSR resume model
(`docs/goals/frameless-ssr-v1/notes/T001-witness-ssr-evidence.md` §4). Resolves the eight
T001 Judge questions and cuts the bounded Worker slices (T003a/b/c). **Resume-not-hydrate
discipline is binding: every proof honors the six hydration-shaped assumptions that fail
under resume; any hydration-shaped assertion is rejected by name.**

## Verdict carried from T001

Buildable — no beta.38 authoring or server API hard blocker. The only genuine risk is
integration/calibration (the qwikVite client→SSR manifest handoff inside witness, QRL chunk
resolution under preview, and the DOM-node-identity proof surface). The architecture below
isolates that risk into one slice (T003b) with an explicit blocked-return seam.

## Locked decisions

### D1 — IR → Qwik v2 emit contract (target-neutral IR unchanged)

The compiler IR (`frameless-enriched-ir/2`) stays target-neutral; all Qwik decisions live in
the new `packages/frameworks/qwik` emitter, exactly as React/Solid own theirs.

| IR fact | Locked Qwik v2 emit |
| --- | --- |
| Component/module | `export const Name = component$((props) => …)`, automatic-runtime JSX for `@qwik.dev/core`. Preserve the IR export name. |
| Scalar state | `const x = useSignal(init)`; reads → `x.value`; ordered writes → `x.value = …`. A handler-only scalar is STILL a signal (serialization + later-QRL identity). |
| Object/array state | `useStore(init)`; whole-collection replacement lowers to a proxy-preserving mutation (`splice(0, len, ...next)`); an unrepresentable write is **rejected** (blocked-return), never a store rebind. |
| Computed | `useComputed$(() => expr)`, read `.value`. (A QRL, not a visible task.) |
| Dynamic text/attr/prop | Rewrite graph reads to signal/store/computed access in ordinary JSX expression containers. No printer-shortcut dependence. |
| Event | `$`-suffixed JSX prop + explicit inline QRL: `onClick$={$((event, element) => …)}`. Preserve `syncPolicy`, handler order, write order. Captures must be serializable (signals/stores/QRLs/serializable props/importable module values) — a captured local non-importable function is **rejected**. |
| Keyed `@for` | **`.map` + `key={<IR key expr>}` on the row root** (D4). |
| Conditional `@if` | **Nested JSX ternary with an explicit `null` empty arm** (D4). |
| Controlled input | **Explicit `value`/`checked` + one `onInput$`/`onChange$` QRL** using the handler's second `element` arg (D5). |
| Default children | `<Slot />` (records the seam; cross-file composition stays out of scope). |

**No render read or initializer may introduce `useVisibleTask$`, `onQVisible$`, or any
`q-e:qvisible` path.** The component may execute during SSR and wake a requested QRL after
interaction; it does zero client work merely because an element became visible.

### D2 — Callback props render to the native `$`-suffixed QRL contract

beta.38 grants QRL/plain-fn prop conversion only to prop names ending in `$`
(`dist/core-internal.d.ts:2296-2302,2505-2511`). **Decision: the Qwik target renames an
authored callback prop to its `$`-suffixed spelling** (`onTrace` → `onTrace$`), because that
is the only statically-expressible QRL-prop contract; the consuming demo's scenario adapter
maps the analyzer's target-neutral callback to the `$` prop and passes a QRL
(`onTrace$={$(() => …)}`). Rationale: emit native Qwik rather than fight serialization with
raw function props. Cross-framework equality stays **behavioral** (same scenario outcomes),
so the prop-name difference is invisible to the oracle.

### D3 — Emitter fails closed on persistence-bearing IR

`PersistenceLanding` is markless/React/Solid only (`packages/compiler/src/persistence.ts`).
**The Qwik emitter blocked-returns on any persistence-bearing IR** (no target landing yet).
v1 proves resume on the **non-persistence ui-kit corpus**. persistence-on-Qwik (a serialized-
state seed patch, not `window.__FRAMELESS_STATE__` — Qwik state lives in the DOM) is the T900
follow-on. "Gate passes" here means *no eager visible lowering and no unsupported persistence
emit*, NOT "Qwik persistence shipped."

### D4 — Keyed = `.map`+`key`; conditional = ternary+`null` (no experimental primitives)

Baseline uses non-experimental JSX. beta.38's `Each` (`item$`/`key$`) and `Show`
(`when$`/`then$`/`else$`) are experimental (would add `experimental:[…]` + beta churn). Adopt
`Each` ONLY if the ordinary keyed lane cannot satisfy the row-identity oracle under
reorder/remove (revisit as a scoped decision, not in v1's first slice).

### D5 — Controlled input = explicit `value`/`checked` + one `onInput$`/`onChange$` QRL

`bind:value`/`bind:checked` exist but couple an implicit listener's ordering to the authored
handler's ordered writes/callbacks. Lock the explicit form for v1 (deterministic authored
order + payloads). Revisit `bind:*` only after S2/S3 order calibration proves equivalence.

### D6 — SSR/vite lane: qwikVite, **client→SSR** build order, manifest-derived assertions

Qwik serves via `renderToString`/`renderToStream` (`@qwik.dev/core/server`) through a
**separate** framework-aware vite lane (`qwikVite`, a two-plugin pair). Build order is
**client optimizer build → retain manifest + QRL chunks → SSR build with that exact manifest →
post-build prerender writing `renderToString(...).html` per scenario route into the client
outDir → witness preview serves that outDir incl. loader + all manifest-mapped chunks.** This
is the **opposite order** of the current Solid SSR-first config — Qwik's client manifest must
exist before SSR can serialize resolvable QRL listener URLs. SSR entry disables preloader +
`statePrewarm` (`preloader: false, statePrewarm: false`) as a no-eager control (not a
substitute for asserting it). **Witness request classification derives the app/QRL chunk set
from the build manifest/artifacts — never a baked chunk name or filename regex.** Because
classification is manifest-derived, we do **not** force `segment` entry strategy (keep the
real production topology). `snapshotResult` is deprecated in v2 — inspect HTML, not that field.

### D7 — Resume witness plan (core proof first; DOM-identity deferred)

The four-part plan from T001 §C, with the identity sub-proof explicitly deferred:

1. **Pre-activation HTML** (`preview.request`, string/parsed assertions): contains
   `<script type="qwik/json">`, `q:container="paused"`, the expected `q-e:click`, and **no
   `q-e:qvisible`**; then the existing pre-activation behavioral expectations on server markup.
2. **Load-time zero-eager** (`page.networkRequests()` before any click): allow document/static
   + the qwikloader; **assert zero manifest-mapped app/framework/QRL chunk requests**;
   `expect.page.outcome(page, { consoleErrors: 0, failedRequests: 0 })`. A *preload* request of
   an app chunk is a FAILURE even unexecuted (the goal's stricter no-eager-network doctrine).
   The assertion is "no eager app chunk," never "hydrate was called."
3. **First-interaction wake**: the first `page.click` IS the activation boundary — at least one
   new request resolves to the clicked listener's manifest-mapped QRL chunk; the scenario
   actions pass (`expect.page.*`); console/failed-request stay zero; no navigation/reload. No
   preceding hydrate barrier / complete-event / mismatch / full-tree-render assertion.
4. **Eager-wake calibration FIRST** (`project.edit`): inject one `useVisibleTask$`/visible QRL
   into an emitted fixture, build through the same optimizer, prove the broken output carries
   `q-e:qvisible` and that a browser visit **without interaction** produces a manifest-mapped
   eager chunk request — i.e. the no-eager channel **detects** the anti-pattern. Auto-restore,
   then require the opposite on the clean box.

**DOM-node-identity ("resumed DOM is the server DOM") is a deferred belt-and-suspenders slice,
not a gate on the first proof.** The core resume claim is already carried by (2)+(3): nothing
runs before interaction, and interaction loads *only the clicked QRL chunk* — not a whole-app
bootstrap (which is exactly how resume differs from hydrate). `PageHandle.content()` cannot
prove node identity and witness 0.7 exposes no `evaluate()` on `PageHandle`; the identity proof
therefore needs either (a) an explicitly-classified inline **non-app** probe that captures the
server root at load and surfaces preserved/replaced via a DOM attribute `expect.page.attribute`
can read (loading no app/framework chunk), or (b) a witness page-identity primitive. Pick (a)
first; escalate to (b) only if (a) can't be expressed — as its own slice (T003d, queued), so it
never blocks the core resume proof.

### D8 — Gate + receipt

Reuse the React/Solid `persistence-render-lowering` rules (render-access persistence record
must be `seed.lowering === 'pre-paint'`; any visible/eager/effect/mount marker fails) and add a
Qwik **source** check forbidding persistence seed reads in `useVisibleTask$`/`onQVisible$`/
equivalent eager QRLs. Independently, the emitted ui-kit source forbids **any** visible task
(this tranche's resume oracle is stricter than persistence alone). Receipt uses the existing
`activation: 'resume'` discriminant (`packages/analyzer/src/receipts.ts`) — no hydration-
mismatch field (vacuous for resume, per §4).

### D9 — Pin + dependency discipline

Pin `@qwik.dev/core@2.0.0-beta.38` + its `@qwik.dev/optimizer@2.1.0-beta.5` (the installed
pair). **T003a moves the dep from the root `package.json` (where the PM pre-installed it for
the scout) into `packages/frameworks/qwik`.** Keep the resume proof in the Vite build + witness
lane — do **not** import `@qwik.dev/core/testing` (repo Vitest 4.1.5 vs qwik's optional peer
`<4`). Re-eval triggers: re-read beta.38 sources before any pin bump touching component
authoring, serialization, container attrs, loader events, optimizer manifest, or SSR results.

## Worker slices (bounded; largest-safe-reversible toward the resume oracle)

Sequenced so the one integration risk (D6 handoff) lands in its own slice with a blocked-return
seam, and the browser proof (PM-run) lands last.

### T003a — Qwik package scaffold + simplest-component emitter + unit golden (no browser)
- **Do:** create `packages/frameworks/qwik` (package.json declaring the D9 pin + moving the dep
  off root; tsconfig; build wiring mirroring react/solid). Emit the **simplest ui-kit scenario**
  (one scalar state + one rendered read + one click) to the D1/D2 shape — the T001 §"Simplest
  ui-kit shape" `component$`/`useSignal`/`onClick$={$(…)}` component, **no visible task**. A unit
  **golden** test asserts the emitted source (like `generated-persistence/P1.jsx`).
- **allowed_files:** `packages/frameworks/qwik/**`; root `package.json` + `pnpm-lock.yaml`
  (ONLY to move the qwik dep off root); `pnpm-workspace`/tsconfig references only if required to
  register the package.
- **verify:** `pnpm check && pnpm lint && pnpm test && pnpm build`; the qwik golden matches; the
  emitted component imports only `@qwik.dev/core`.
- **stop_if:** a required beta.38 authoring API differs from D1 (blocked-return the exact gap —
  Qwik v2 only, never v1); a render construct can't avoid an eager visible task; needs files
  outside the contract; verify fails twice.

### T003b — Qwik SSR/vite lane + manifest handoff + prerender HTML (the integration spike; no browser)
- **Do:** the D6 lane — client optimizer build → manifest → SSR build → post-build prerender
  writing `renderToString(...).html` per scenario route; a **build-level** test (no browser)
  asserting the prerendered HTML carries `qwik/json` + `q:container="paused"` + `q-e:click` +
  **no `q-e:qvisible`**, and that the manifest + QRL chunks exist and the app-chunk set is
  derivable from the manifest. A Qwik demo root consuming **CLI-built Qwik output only** (never
  `.tsrx`), passing serializable primitive props + a QRL callback (D2).
- **allowed_files:** `packages/frameworks/qwik/**`; a new `demos/ssr/qwik-app/**` (or the demo
  location the worker confirms mirrors react-app/solid-app); `demos/ssr` build wiring **for the
  qwik lane only** — do NOT touch the react/solid/SSR-existing lanes.
- **verify:** the build succeeds; the HTML/manifest build-test passes; `pnpm check/lint/test/
  build`; `git diff --stat` shows no change to the existing react/solid SSR lanes.
- **stop_if (the flagged risk):** the qwikVite client→SSR manifest handoff cannot be made to
  work inside witness `pipeline.build` (after trying an overlay `InlineConfig` and
  `strategy:'build'`) — **blocked-return with the exact seam** (a witness/config design decision
  for the PM); do NOT fall back to non-optimizer Qwik generation. Also blocked if preview cannot
  serve the mapped QRL chunks (a first-click 404 is not resume evidence).

### T003c — Resume witness boxes + eager-wake calibration, folded into `pnpm e2e` (PM runs the browser lane)
- **Do:** the D7 boxes (1)-(4) — pre-activation HTML, load-time zero-eager, first-interaction
  wake, and the calibration-first eager-wake box — plus the Qwik `activation:'resume'` receipt
  entry (D8) and the qwik lane in `scripts/e2e.mjs`. The Worker authors the boxes + lane;
  **the PM runs `pnpm e2e`** (browser + loopback are host-only).
- **verify:** PM-run `pnpm e2e` qwik lane green (calibration detects the eager-wake break; the
  clean corpus resumes with zero eager chunks + first-interaction wake + passing scenarios);
  cross-framework behavioral equality with react/solid.
- **stop_if:** the core resume proof can't be expressed with witness 0.7 primitives (blocked-
  return; DOM-identity is already deferred to T003d and must not be conflated with this).

### T003d — DOM-node-identity proof (queued; deferred per D7)
Inline classified non-app probe (D7 option a) OR a witness page-identity primitive (option b).
Queued behind T003c; never gates the core proof.

## Plan-critique gate

This is a nontrivial plan (new framework emitter + novel client→SSR optimizer lane + a resume
proof surface). Per the orchestration model it receives a second-model plan critique before
T003a packet-cutting — targeted at: the D6 build-order/manifest-handoff feasibility, the D7
core-vs-identity split (is (2)+(3) truly sufficient resume evidence without identity?), and the
D2 callback-rename honesty. Critique findings fold into this note before T003a dispatches.

---

## Critique resolutions (post `notes/T002-critique.md`; these AMEND the decisions above)

The second-model critique returned **NO-GO** on the original T003a with three blocking fixes.
Adjudicated below — these amendments are the as-built contract; the slice plan above is
**superseded** by the recut in §"Recut slices".

### D6′ — the build handoff is a spike-FIRST explicit `builder.buildApp` seam (was RISK)

Critique confirmed the artifact order is right and beta.38 exposes every API (client build writes
`q-manifest.json`; SSR plugin accepts `manifestInput`/`manifestInputPath`; SSR warns it cannot
generate handlers without the manifest — `optimizer.mjs:1826-1845,1915-1930`), but my named
fallback was wrong and the orchestration was unproven:

- **`strategy:'build'` is NOT a valid fallback** — witness's `strategy:'build'` does exactly one
  `vite.build` recording only a `client` environment (`runner-*.mjs:977-1004`); it cannot do
  client+SSR+prerender. **Removed.** The viable shape is an explicit Vite `builder.buildApp`
  two-environment orchestration (like the Solid lane but reversed) or an authorized outer
  orchestrator.
- **Environment-API risk to prove, not assume:** `qwikVite` fixes its normalized target in the
  top-level `config` hook from `build.ssr`/mode; the environment hook only adjusts resolution
  (`optimizer.mjs:3248-3295,3382-3390`). A two-environment `createBuilder` must **demonstrate**
  each environment gets correctly-targeted optimizer state AND the SSR env sees the just-built
  client manifest — the "plugin will wire" declaration is not proof.
- **Preview/path invariant (now explicit):** keep client output as the `client` outDir (witness
  serves `build.outDirs.client` — `runner-*.mjs:1877-1897`); the prerender writes route HTML
  **into that same tree**; the SSR outDir is disjoint and must not overwrite it. Vite `base` ≡ SSR
  `RenderOptions.base` (emits `q:base`) ≡ client-outDir public URL ≡ preview-served outDir must
  all agree. Use `qwikLoader:'module'`, `preloader:false`, `statePrewarm:false`. Derive the
  allowed loader URL from `manifest.qwikLoader` and app/QRL URLs from
  `manifest.mapping`/`manifest.bundles` — never a filename pattern.
- **Blocked-return boundary redrawn:** block iff the explicit `builder.buildApp` sequence cannot
  hand the client manifest to the SSR environment, or preview cannot serve the mapped chunks —
  recording whether beta.38 needs **two separate Vite invocations** vs one multi-environment
  builder. Never fall back to non-optimizer Qwik generation.

### D7′ — node-identity is in the CORE resume gate; network topology alone is insufficient (was WRONG)

The critique is correct and this was the key defect. Steps (2)+(3) prove "no eager app network
before interaction" and "a mapped listener wakes + behaves" — but with the `smart` strategy many
symbols map to one bundle with manifest-declared imports, and **network evidence cannot show which
symbols executed**. A lazy-hydration implementation could ship nothing at load, fetch one bundle
on click, **rebuild the tree**, and pass both checks (that is hydration assumption #6 un-excluded).
Amendments:

- **The inline non-app DOM-node-identity probe moves into the core one-route resume proof** (recut
  slice 5), NOT deferred. Mechanism: an explicitly-classified inline probe (loads no app/framework
  chunk) captures the server root before any interaction and, after the first click, surfaces
  whether that **exact node is still connected** via a DOM attribute `expect.page.attribute` reads.
- **T003d is downgraded** to "optionally replace the inline probe with a first-class witness
  identity primitive" — hardening only.
- **If identity is ever dropped, the receipt claim weakens** to `Qwik protocol-shaped lazy
  activation`, NOT proven `activation:'resume'`.
- **Classifier made precise:** pre-interaction allow ONLY the exact `manifest.qwikLoader` URL and
  forbid every manifest-owned executable bundle (incl. `core`/preloader); parse the serialized
  `q-e:click` reference → its symbol → `manifest.mapping[symbol]`; after the click allow that
  bundle **plus its manifest-declared dependency closure** (not "one physical request"). Do not
  describe a smart bundle as "only the clicked QRL."

### D2′ — v1 callbacks are awaited observational/void QRLs; return-dependent IR is rejected (was RISK)

Rename `onTrace`→`onTrace$` stands (type-faithful: `PublicProps`/`_Only$` permit the conversion —
`core-internal.d.ts:2296-2302,2505-2511`), but a QRL invocation is **async** (returns a promise —
`:456-462,2653-2664`), while React/Solid receive the analyzer's synchronous callback and its phase
is observable. So:

- v1 admits **only observational/void callbacks**; every callback call lowers to an **awaited QRL
  at its authored position** (the containing handler becomes `async`); IR whose control flow
  depends on a callback **return value** or a same-turn synchronous post-callback action is
  **rejected** (blocked-return).
- The first behavioral slice **calibrates** callback name, normalized payload, invocation order,
  `defaultPrevented`, and phase against React/Solid (a microtask boundary is acknowledged; it must
  not change observable ordering/payloads).

### D8′ — two independent gate checks (clarification; SOUND)

(a) persistence-bearing IR is **rejected before** Qwik emission (fail-closed — `PersistenceLanding`
is markless/React/Solid only); (b) emitted **non-persistence** Qwik source independently forbids
eager/visible tasks. Passing (b) never implies a Qwik persistence artifact cleared a pre-paint
policy. D3/D4/D5 unchanged (critique: SOUND).

### Recut slices (SUPERSEDES T003a/b/c above — spike-first, each a <~15-min unit)

1. **QK-S1 — D6 build-seam spike (FIRST).** A **handwritten minimal Qwik v2 root** (one signal +
   one `onClick$`), **no emitter/CLI dependency**, in an isolated spike dir. Prove the explicit
   `builder.buildApp` sequence: client build → read/assert `q-manifest.json` → SSR build with that
   exact manifest → import SSR bundle + prerender route HTML into `dist/client` → assert the
   `base`/`q:base`/client-outDir/preview-outDir invariant and that every mapped file (loader via
   `manifest.qwikLoader`, app via `manifest.mapping`) resolves inside the previewed client tree.
   Block at the first failed boundary; record one-builder-vs-two-invocations. (No browser — build +
   manifest + HTML string assertions.) *This can cheaply invalidate the package/build assumptions.*
2. **QK-S2 — package scaffold + pin.** `packages/frameworks/qwik` skeleton; move the dep off root;
   workspace/build registration. (Depends on S1's recipe.)
3. **QK-S3 — simplest emitter + golden** with the restricted D2′ callback contract.
4. **QK-S4 — Qwik demo (consuming CLI-built output) + prerender + the manifest-derived classifier.**
5. **QK-S5 — one-route witness resume proof INCLUDING the node-identity probe** (pre-activation
   HTML; zero-eager-at-load via the precise classifier; first-interaction wake; node-identity
   preserved). PM-run browser.
6. **QK-S6 — eager-wake calibration + full-corpus/cross-framework expansion + receipt/e2e wiring.**

Non-blocking improvements folded: record `base`/`q:base`/client+SSR outDirs/manifest path+hash/
preview outDir in the build receipt; keep D4/D5 + fail-closed unchanged.
