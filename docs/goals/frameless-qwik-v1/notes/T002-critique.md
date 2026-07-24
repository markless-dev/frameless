# T002 architecture-lock critique

Scope: skeptical read-only review of `T002-qwik-architecture.md` against the cited T001 notes,
the installed `@qwik.dev/core@2.0.0-beta.38` declarations/implementation, Witness 0.7, and the
current SSR demo structure. Qwik v2 only. The concurrently changing persistence-emission
statements were not reviewed.

## 1. D6 — client-to-SSR manifest handoff: RISK

**Verdict: RISK.** The artifact order is correct and beta.38 exposes every required API, but the
lock does not yet name an executable orchestration contract.

- The client manifest really is the symbol-to-bundle authority
  (`node_modules/@qwik.dev/core/dist/optimizer.d.ts:117-159`), the SSR plugin accepts either
  `manifestInput` or `manifestInputPath` (`:497-521`), and `renderToString()` returns the required
  `.html` (`node_modules/@qwik.dev/core/dist/server.d.ts:234-256`). beta.38 also writes
  `q-manifest.json` during the client build and, for a production SSR build, tries the configured
  manifest path and then the client outDir before warning that event handlers cannot be generated
  without it (`node_modules/@qwik.dev/core/dist/optimizer.mjs:1826-1845,1915-1930`). Thus
  client -> manifest -> SSR -> prerender is correct and achievable in principle.
- The concrete Witness fallback named in the stop seam is not sufficient. `strategy:'build'`
  performs exactly one `vite.build(inline)` and records only a `client` environment
  (`node_modules/.pnpm/@async+witness@0.7.0_vite@8.0.16_@types+node@24.12.2_/node_modules/@async/witness/dist/runner-KOWah4hZ.mjs:977-1004`);
  it cannot by itself perform client build, SSR build, and post-build import/prerender. The viable
  in-Witness shape is an explicit Vite `builder.buildApp` orchestration, analogous to the current
  Solid lane but reversed (`demos/ssr/solid-app/vite.config.ts:67-108`), or an explicitly
  authorized outer build orchestrator. Merely trying an `InlineConfig` and then
  `strategy:'build'` is the wrong blocked-return boundary.
- There is an additional beta.38/Vite-Environment-API risk to spike: `qwikVite` decides its
  normalized target in its top-level `config` hook from top-level `build.ssr`/mode, while its
  environment hook only adjusts resolution
  (`node_modules/@qwik.dev/core/dist/optimizer.mjs:3248-3295,3382-3390`). A two-environment
  `createBuilder` config must demonstrate that the client and SSR environments receive correctly
  targeted optimizer state and that the SSR environment sees the just-produced client manifest;
  the declarations' “plugin will wire” statement (`optimizer.d.ts:513-521`) is not proof that one
  shared Environment-API build does so.
- Preview is feasible if the client output remains the `client` outDir: Witness preferentially
  serves `build.outDirs.client` (`runner-KOWah4hZ.mjs:1877-1897`). No QRL chunk copy should be
  needed when the client optimizer already emitted manifest and chunks there; the prerender step
  should write only route HTML into that same tree, and the disjoint SSR outDir must not empty or
  overwrite it.
- The lock needs an explicit path invariant. Vite `base`, SSR `RenderOptions.base` (which emits
  `q:base`; `server.d.ts:149-156`), the public URL of the client outDir, and preview's served outDir
  must agree. Use `qwikLoader:'module'` (the loader is required and module is the default,
  `server.d.ts:160-177`), `preloader:false`, and `statePrewarm:false`. Derive the allowed loader
  URL from `manifest.qwikLoader`, not from a filename pattern; derive app/QRL URLs from
  `manifest.mapping`/`manifest.bundles`.

**Smallest fix:** replace T003b's “try overlay, then `strategy:'build'`” language with one tiny
pre-emitter build spike that proves an explicit `builder.buildApp` sequence:
`client` -> assert/read `q-manifest.json` -> `ssr` with that exact manifest -> import SSR bundle
and prerender into `dist/client` -> assert the `q:base`/Vite base and every mapped file resolve
inside the previewed client tree. Block at the first failed boundary and record whether beta.38
requires two separate Vite invocations rather than one multi-environment builder.

## 2. D7 — resume proof without node identity: WRONG

**Verdict: WRONG.** Steps (2) and (3) prove “no eager application network before interaction” and
“a Qwik-mapped listener wakes and behaves,” but they do not by themselves prove that the server
DOM was resumed rather than rebuilt.

The lock overclaims its own assertion. Step 3 requires only “at least one” request for the clicked
listener's mapped bundle (`T002-qwik-architecture.md:102-105`), while the conclusion says
interaction loads “only the clicked QRL chunk” (`:112-115`). With the production `smart` strategy,
several symbols can map to one bundle and that bundle can have manifest-declared imports
(`optimizer.d.ts:85-100,117-159`). Network evidence cannot show which exported symbols executed.
An interaction-triggered/lazy hydration implementation could ship no application code at load,
fetch one smart bundle on first click, rebuild the tree, and pass the current network and behavior
checks. An emitted clicked QRL could likewise call a full render while still being the sole
top-level mapped request. That is hydration assumption 6 from the authoritative evidence note,
not a belt-and-suspenders distinction.

Manifest-derived classification is still the right policy, but it needs a precise definition:
allow the exact `manifest.qwikLoader` URL before interaction; forbid manifest-owned executable
bundles (including `core`/preloader when applicable) before interaction; parse the serialized
`q-e:click` reference to identify its symbol and `manifest.mapping[symbol]`; after the click allow
that bundle plus its manifest-declared dependency closure, rather than assuming one physical
request. Do not call a smart bundle “only the clicked QRL.”

**Smallest fix:** move the minimal inline, explicitly non-app identity probe into the core T003c
gate. It should capture the server root before any interaction and, after the first click, expose
whether that exact node is still connected so `expect.page.attribute` can assert preservation.
Keep T003d only for replacing that probe with a first-class Witness identity primitive. If
identity remains deferred, weaken the T003c/receipt claim to “Qwik protocol-shaped lazy
activation,” not proven `activation:'resume'`.

## 3. D2 — callback-prop rename honesty: RISK

**Verdict: RISK.** The rename is honest and the type-level reliance is correct, but the behavioral
contract omits QRL asynchrony.

`PublicProps` removes `$` props and re-adds only those names through `_Only$`, which permits the
plain-function/QRL conversion (`node_modules/@qwik.dev/core/dist/core-internal.d.ts:2296-2302,
2505-2511`). Therefore mapping target-neutral `onTrace` to Qwik-native `onTrace$` in the demo
adapter is a faithful target adapter choice; keeping the raw name would be less honest about
serialization. Payload shape and call order can remain equal.

However, invoking a QRL resolves and invokes it asynchronously: the callable QRL returns a promise
(`core-internal.d.ts:456-462,2653-2664,2741`). React/Solid receive the analyzer's synchronous
`onTrace` directly (`packages/analyzer/src/run.ts:32-44`), and callback phase is observable
(`packages/analyzer/src/types.ts:58-64,106-111`). Renaming alone therefore does not preserve
same-turn callback timing. The example's `await onTrace$?.(...)` is safe only if the emitter makes
the containing handler async and awaits every callback at its authored position; even then a
microtask boundary is introduced relative to React/Solid. A callback return value or a later
same-turn action depending on it would be a real unsupported semantic case.

**Smallest fix:** state that v1 admits only observational/void callbacks, lowers every callback
call to an awaited QRL at the authored position, and rejects callback-return-dependent synchronous
IR. Add callback name, normalized payload, invocation order, `defaultPrevented`, and phase
calibration to the first behavioral slice. The prop rename itself need not change.

## 4. Resume discipline and fail-closed baseline: SOUND

**Verdict: SOUND.** D3 is correctly fail-closed: `PersistenceLanding` has only markless, React,
and Solid variants (`packages/compiler/src/persistence.ts:29-44,175-193`), so emitting Qwik for a
persistence-bearing artifact would invent an unowned landing. Rejecting it is the correct v1
boundary. The Qwik gate should test that rejection and independently forbid visible-task source;
it should not imply that a Qwik persistence artifact passed a pre-paint landing policy.

D4 and D5 are also the right conservative baseline. Ordinary keyed `.map`/`key`, ternary/null,
and an explicit controlled-input QRL avoid beta-only experimental `Each`/`Show` and avoid an
unproven implicit-bind listener order. Calibrating row identity and input/callback ordering before
adopting those conveniences is appropriate.

The assertions rejecting hydrate calls, a global completion event, mismatch counts, eager runtime
loading, a pre-interaction activation barrier, and expected full-tree replacement correctly avoid
all six hydration-shaped assumptions. The one discipline defect is D7's attempt to infer absence
of full-tree replacement from network topology; fixing D7 removes it.

**Smallest fix:** clarify D8 as two separate checks: persistence-bearing IR is rejected before
Qwik emission, while emitted non-persistence Qwik source independently forbids eager/visible
tasks. No D3/D4/D5 architecture change is needed.

## 5. Slice sizing and sequencing: WRONG

**Verdict: WRONG.** None of T003a/b/c is credibly a sub-15-minute medium-effort unit as written.

- T003a combines dependency relocation/lockfile work, workspace/build registration, a new package
  surface, validation/emission/format/gate conventions, and a golden test. Split package
  scaffold/registration from the single-component emitter/golden.
- T003b combines the riskiest beta.38/Vite integration, a new SSR app, client manifest capture,
  SSR build, SSR-bundle import, multi-route prerender, artifact classification, and build tests.
  Split the handwritten one-button optimizer/manifest handoff spike from demo-route/CLI-output
  integration and from prerender artifact tests.
- T003c combines four Witness boxes, a deliberate mutation with restoration, network
  classification, cross-framework scenario execution, receipt/schema integration, and
  `scripts/e2e.mjs` wiring. Split classifier + one-route clean wake, eager-visible calibration,
  full scenario/cross-framework expansion, and receipt/e2e aggregation.

The risky D6 handoff should be the first implementation spike, using a handwritten minimal Qwik
root and no emitter/CLI dependency. It can invalidate or refine the package/build assumptions
cheaply. Package scaffold and simplest emission should follow once the build seam is known.

**Smallest fix:** recut as (1) D6 one-route build seam, (2) package scaffold/pin, (3) simplest
emitter/golden with the restricted D2 callback, (4) Qwik demo + prerender/classifier, (5) one-route
Witness proof including identity, (6) calibration/full-corpus/receipt expansion.

## Blocking before T003a is cut

1. Correct D7: either make node-identity preservation part of the core resume gate or weaken the
   claim/receipt so it does not assert proven resume. The current network-only inference is not
   sufficient.
2. Recut sequencing so the minimal D6 build/manifest handoff spike precedes package/emitter work,
   and replace `strategy:'build'` as the proposed fallback with an explicit orchestration seam.
3. Bound D2 to awaited observational/void QRL callbacks (and reject synchronous return-dependent
   callbacks) before the first emitter golden fixes the contract.

## Non-blocking improvements

- Specify the exact manifest-derived URL classifier, including the loader and clicked bundle's
  dependency closure.
- Record `base`, emitted `q:base`, client outDir, SSR outDir, manifest path/hash, and preview outDir
  in the build receipt.
- Keep the non-experimental D4/D5 choices and persistence fail-closed rule unchanged.

**Go/no-go:** **NO-GO for cutting the current T003a**; fix the three lock issues above and cut the
minimal D6 seam spike first.
