# T001 — Witness + SSR evidence map (facts and risks only; decisions belong to T003)

Discipline: every claim cites a path or command; anything unverified is marked **unknown**.
Markless repo was inspected strictly read-only.

## 1. @async/witness 0.7.0 as an external consumer

Inspected at `/Users/jacksm5pro/dev/open-source/markless/node_modules/@async/witness` (v0.7.0).

### Package facts (package.json)
- `bin.witness -> dist/witness.mjs`; exports `.` (types `dist/index.d.mts`) and `./cli`.
- Runtime deps: mitt, pathe, tinyglobby. **peerDependencies: vite ^8.0.0**; engines node >= 22.
- Frameless root has vite 8.0.16 installed (satisfies the peer range) — checked via `node_modules/vite/package.json`.
- npm: `npm view @async/witness versions dist-tags` -> versions `0.5.0, 0.6.0, 0.7.0, 0.8.0`; latest = **0.8.0** (modified 2026-07-03). The 0.7.0 pin is one release behind latest; 0.8.0 changelog **unknown** (not reviewed).

### Box API surface (full inventory from dist/index.d.mts)
- `box(run) | box(name, run) | box(options, run)` — options: `name?`, `tags?`, `modes?: ('dev'|'build'|'preview'|string)[]`, `ui?`.
- BoxContext = exactly six keys: `environment`, `browser`, `project`, `pipeline`, `expect`, `receipt`.
- `browser.visit(path, {networkConditions?}) -> PageHandle`: `reload`, `content()` (full serialized HTML), `networkRequests()`, `emulateNetwork/clearNetworkEmulation`, `click(selector,{timeoutMs})`, `trackEvents(...names)` (custom DOM events, e.g. a framework's HMR/qsymbol event).
- `pipeline.dev({config?})` (Vite createServer + inline-config overlay), `pipeline.build({config?, strategy?: 'builder'|'build'})` (createBuilder default), `pipeline.preview(build, {config?}) -> PreviewHandle` with `preview.browser.visit(path)` and browserless `preview.request(path)`.
- `project.edit(...)` (replace/function/create/remove/copyFrom + `edit.config`), auto-restored after the box; `project.read/exists`.
- `expect.edit(change, expectation)` — HMR vocabulary `accepted|full-reload|none`, `server: 'restarted'`, invalidated modules, framework hot-channel messages.
- `expect.page.*`: `text`, `bodyText({contains,notContains})`, `attribute` (incl. absence via null), `exists`, `visible`, `computedStyle`, `outcome({navigations, consoleErrors, failedRequests, events})` — all bounded waits.
- `expect.html.contains(html, fragment)` — the only server-HTML assertion primitive.
- `expect.response.matches(response, {status, ok, contentType, contains})` via `environment.<name>.fetch(path)`.
- `expect.build.environment/artifact/forbids` (forbidden-string scan over emitted artifacts); `expect.artifact.exists/text({contains,notContains})/json(predicate)`.
- `receipt.capture(label)` (screenshot+HTML snapshot), `receipt.note(text)`, `receipt.measure(label, fn)`.
- Library embedding also exported: `runBoxes(RunBoxesOptions)`, `discoverBoxes({root})`, `restorePendingEdits()`, `createFileSystem(runtime)`, plus a `witness(): Plugin` Vite plugin export (purpose **unknown** — not used in markless configs I read).

### Discovery, config, pipeline start
- Discovery: `*.box.ts` / `*.box.tsx` files under the root, loaded through Vite `runnerImport` (dist/index.d.mts, discovery section). Anonymous boxes get derived names.
- **No `witness.config*` file exists anywhere in markless** (`find` returned none). Consumers run `witness run` from a package/app dir as an npm script: `"test:boxes": "witness run"` in `markless/demos/music-player-ssr/package.json`, `demos/music-player/package.json`, `packages/bundler/package.json`, `packages/router/package.json`. Dep is declared once at markless root: `"@async/witness": "0.7.0"` (markless/package.json:25). CLI flag surface **unknown** (dist/witness.d.mts is `export {}`; README shows `witness <name-filter>` and `witness evidence '<box name>'`).
- The consumer's own `vite.config.ts` in the run root is the pipeline; boxes can point at an alternate config via the inline overlay — markless's SSR box does `pipeline.build({config: c => ({...c, configFile: 'boxes/vite.config.ts', mode: 'ssr'})})` (demos/music-player-ssr/boxes/ssr-play-branch.box.ts:58-64).
- What a repo needs to run `witness run`: dep on @async/witness, vite ^8, node >= 22, `*.box.ts(x)` files under the run root, a working vite config, and a Chromium-family browser on the machine (`WITNESS_BROWSER_PATH` override, system Chrome/Edge/Chromium, or Playwright's browser cache as fallback — README "Bring your own browser"). No playwright dependency; witness drives CDP itself.

### Receipt shape (real receipt: markless/.witness/receipts/2026-07-02T18-27-34.215Z/receipt.json)
- Run dir per runId + a `latest` pointer file (plain-text run id). Per-box subdirs (`box-4/`, `box-12/`) hold snapshots.
- Top-level keys: `asyncWitnessReceipt` (version marker; exact value not captured), `runId`, `createdAt`, `root`, `summary`, `invalidBoxFiles`, `boxes[]`.
- Box keys: `name, tags, modes, ui, file, exportName, status, error, vite, edits, builds, previews, pages, editOutcomes, assertions, captures, notes, measurements, witnesses, timeline, startedAt, finishedAt, durationMs, summary`.
- `pages[]` (PageRecord in d.mts): route, environment, surface `'dev'|'preview'`, url, **consoleMessages**, pageErrors, failedRequests, networkRequests, snapshots, navigations (empty proves no reload), trackedEvents, interactions.
- Three-witness model + `box` witness: ids `pipeline | client | driver | box`; verdicts `corroborates | contradicts | silent | not-called`; `against[]` statements with kinds `console-error | page-error | request-failed | vite-error | edit-error | restore-failed | assertion-failed | box-error`. Observed in the real receipt: `{"pipeline":{"verdict":"not-called",...},"box":{"verdict":"contradicts","statements":3,"against":[{"kind":"box-error",...}]}}`. `BoxRunResult.contested` = passed but a witness spoke against the run.

### SSR/hydration assertions in the API
- **No dedicated ssr/hydrate/mismatch API exists.** Grep of dist/index.d.mts: no `ssr`/`hydrate` identifiers beyond a build-strategy docstring. README claims "SSR renders and hydrates without console errors" as a composition of generic primitives: server HTML via `preview.request(path)` + `expect.html.contains`, then `preview.browser.visit(path)` + `expect.page.*` + `expect.page.outcome({consoleErrors: 0, failedRequests: 0})`. Console capture is per-page evidence (client witness); the receipt keeps console errors even when no assertion asked (contested passes).
- Real SSR usage pattern (markless ssr-play-branch.box.ts): build with `mode:'ssr'` overlay -> `preview.request('/')` -> string assertions on pre-activation HTML (branch anchors, rendered arm, modulepreload links) -> `preview.browser.visit('/')` -> interaction + `expect.page.text/attribute/computedStyle` -> `expect.page.outcome({consoleErrors:0, failedRequests:0})`.
- Known limitation recorded by markless: "witness currently supports one nitro preview per run: a second in-process preview reuses the first (closed) server entry module and 404s" (ssr-play-branch.box.ts:25-27 and 163-165). Whether this applies to plain static vite preview is **unknown**.

### 0.7.0 pin re-evaluation triggers (record with the dep, yuku-pin discipline)
1. A required assertion is inexpressible in 0.7.0 (T004 stop_if already frames this as product feedback to the owner, who owns witness).
2. Any witness release (0.8.0 exists now) whose changelog touches receipt schema, preview/build pipeline, or multi-preview support — re-read before adopting.
3. Vite peer-range movement (currently ^8.0.0; frameless on 8.0.16).
4. Multi-preview-per-run support landing (would lift the one-preview constraint noted above).

## 2. SSR/activation toolchain facts per framework (frameless repo)

### React
- Pinned: `react 19.2.3`, `react-dom 19.2.3` in `packages/frameworks/react/package.json:37-38` (not hoisted to repo root).
- Installed `@types/react-dom/server.d.ts:114`: `renderToString(element, options?: ServerOptions): string` (docstring: hydrateRoot on the server markup makes it interactive). Streaming/static also present: `static.d.ts:104 prerender`, `:122 prerenderToNodeStream`; runtime entries `server.browser/server.node/server.edge`, `static.*` exist in the installed react-dom package.
- `@types/react-dom/client.d.ts:101`: `hydrateRoot(container, children, options?)`.
- React 19 hydration-mismatch reporting shape (single diff-style console.error) — **unknown/not verified in this pass**; must be confirmed during T005 calibration (intentionally broken hydration).

### Solid (v1 pin)
- Pinned: `solid-js 1.8.22` (`packages/frameworks/solid/package.json:36`), `vite-plugin-solid 2.11.10` (`:45`).
- Server API (installed `solid-js/web/types/server.d.ts`): `renderToString` (:1), `renderToStringAsync` (:9), `renderToStream` (:19), `generateHydrationScript` (:55). Client hydrate: `web/types/client.d.ts:57 hydrate(...)`. Dist ships separate `server.js` / `web.js` builds selected by export conditions.
- vite-plugin-solid options (installed `dist/types/src/index.d.ts`): `ssr?: boolean` (:32), `solid.generate?: 'ssr' | 'dom' | 'universal'` (:97 — "'ssr' is for server side rendering of strings"), `solid.hydratable?: boolean` (:99-103), and the `babel` option receives an `ssr` flag per file (:53).
- Current browser lane is dom-generate only: `packages/frameworks/solid/vitest.config.ts` uses `solid({ include: /...generated...\.jsx|test\/.*\.solid\.tsx$/ })` with `resolve.conditions: ['development','browser']` — an SSR lane is a NEW vite lane needing `ssr: true` + hydratable markers + server-side resolve conditions so `solid-js/web` resolves the server build.
- solid2-blocker: actual path `packages/frameworks/solid/test/solid2-blocker.test.ts` (goal/board cite `test/solid2-blocker.test.ts` — path drift, see contradictions). It proves: Solid 2.0.0-beta.9 does NOT export `./web` or `./store` (`ERR_PACKAGE_PATH_NOT_EXPORTED`, lines 79-87 = the overturn trigger), while the v1 toolchain emits `solid-js/web` imports. Since `renderToString`/`hydrate` also live in `solid-js/web`, the blocker applies identically to SSR: **SSR entry stays on the 1.8.22 pin** — confirmed.

## 3. Demo-app shape witness requires

### How output is built and mounted today
- `scripts/e2e.mjs`: CLI builds authored `.tsrx` (`packages/cli/src/node.ts build --target react --target solid --out-dir demos/<demo>/dist/...`), then vitest **browser-mode library mounts** (`demos/ui-kit/test/{react,solid}` + capture.ts) record traces, `@frameless/analyzer` `evaluateExpectations` + `compareRuns` produce `frameless-receipts.json` (RECEIPT_SCHEMA_VERSION). The library-mount lane is exactly what the SSR lane must NOT reuse (goal.md misfire list).
- Scenario expectation kinds `dom-text | dom-present | dom-path` are implemented in `packages/analyzer/src/expectations.ts` (:62, :71, :81) and evaluated against captured run traces; scenarios with `initialProps` live in `demos/ui-kit/scenarios.ts` and `demos/composition-kit/scenarios.ts`.

### What witness needs instead (facts, not the T003 decision)
- Witness runs a **real Vite app root**: `browser.visit('/route')` requires an app with routes served by the consumer's own vite config; boxes live under that root as `*.box.ts`. So each framework needs a small SSR demo app whose source imports **CLI-built emitted output from dist/** (never authored .tsrx), with a server-render entry (React: `renderToString` + `hydrateRoot` client entry; Solid: `generate:'ssr'`-compiled server entry + `hydrate`).
- **SSR serving gap (key fact):** `pipeline.preview` is Vite's preview of built output. Markless previews are SSR-capable only because markless's own plugin brings a server (nitro). Frameless demo apps have no server integration; witness's API has no "run my node SSR server" primitive (EnvironmentHandle.import exists for runnable environments in dev mode). Candidate shapes visible in the evidence — (a) dev-mode SSR through Vite environments, (b) build-time prerender: build emits server bundle, a build step runs renderToString and writes the pre-rendered index.html that preview then serves alongside the hydrate entry. Choosing is T003's job.
- Pre-activation evaluation: witness exposes server HTML as a **string** (`preview.request(path)` / `environment.fetch`), asserted via `expect.html.contains` — there is no server-side DOM query API. Evaluating dom-text/dom-present/dom-path expectations pre-activation therefore needs either in-box DOM parsing of the fetched HTML, or reuse of `evaluateExpectations` against a DOM constructed inside the box (analyzer is workspace code). Post-activation: `preview.browser.visit` + `expect.page.text/exists/attribute` + scripted scenario interactions via `page.click`, with `expect.page.outcome({consoleErrors: 0, failedRequests: 0})` as the clean-activation assertion — matches the markless SSR box pattern exactly.
- Two parallel apps: witness has no two-app-roots concept in one box; a run is rooted (`RunBoxesOptions.root`, receipts under `<root>/.witness/receipts/`). Options in evidence: separate `witness run` per demo dir (two receipts, like markless's per-package `test:boxes`), or one root whose boxes build different apps via the `configFile` overlay. The one-preview-per-run note (nitro context) is a risk for a single-root two-preview design.
- Browser/CDP: no playwright dep; needs system Chrome/Edge/Chromium or the Playwright cache fallback. Frameless already uses `@vitest/browser-playwright` (chromium instances in vitest configs), so a Playwright chromium cache is plausibly present on dev machines; fresh-clone CI must guarantee a browser.

## 4. Qwik v2 resume model (docs-level ONLY; v2 sources ONLY — QwikDev/qwik main + @qwik.dev/core 2.0.0-beta line)

Registry: `npm view @qwik.dev/core dist-tags` -> `latest = beta = 2.0.0-beta.38` (matches the directive's beta.38). Sources below are main-branch **source files** (the .mdx docs on main carry stale v1-era examples, e.g. `q:version="1.9.0"` in containers/index.mdx — source is the authority).

### What v2 serializes into HTML
- State: an array of "roots"; even indices are TypeIds, odd are encoded values; RootRef back-references and ForwardRefs for promises; restore is **lazy** — "a proxy gets the raw data and returns an array that deserializes properties on demand and caches them" to avoid blocking the main thread on wake (`packages/qwik/src/core/shared/serdes/serialization.md`).
- The state script the loader looks for is `<script type="qwik/json">` (`packages/qwik/src/qwikloader.ts:108`). vNodeData is serialized into its own script tag by the SSR container (`packages/qwik/src/server/ssr-container.ts`, `$emitVNodeData` region); inline `qFuncs_<instance>` arrays hold serialized functions (`qwikloader.ts:193`).
- Container attributes (`packages/qwik/src/core/shared/utils/markers.ts`): `q:container` (value `paused` pre-resume), `q:render`, `q:runtime`, `q:version`, `q:base`, `q:locale`, `q:manifest-hash`, `q:instance`, `q:prewarm`, plus vnode refs `q:id/q:key/q:props/q:seq` and container-island markers.
- Listeners are serialized as element attributes `q-<scope>:<event>` (qwikloader.ts:313 reads `'q-' + scopedKebabName`), e.g. `q-e:click`, with special lifecycle attrs `q-d:qinit`, `q-d:qidle`, and `q-e:qvisible` (IntersectionObserver-driven visible tasks, qwikloader.ts:479-525).

### How interactivity happens without a hydrate step
- The qwikloader installs a few **global** document listeners (no per-element attach), requiring the container `q:container="paused"` (qwikloader.ts:125-136). On an interaction it reads the element's `q-*` attribute -> chunk URL + symbol -> downloads/executes just that QRL. No component-tree re-execution, no eager application code at load; the docs frame this as "pause on the server, resume on the client" (`packages/docs/.../concepts/resumable/index.mdx`).

### What "clean activation" means for a resuming target
- At load: only the loader runs; zero framework/app chunks execute; console clean. `q-e:qvisible` tasks fire on intersection — an eagerly-visible task would execute app code before any user interaction, which is exactly the no-eager-visible-task gate rule (frameless-composition-v1 persistence-design-input note).
- At wake (first interaction): the interacted QRL executes, state roots deserialize lazily, correct behavior results, console stays clean. There is no global "activation finished" moment — activation is per-interaction and permanently partial.

### Hydration-shaped assumptions a naive SSR test design would break on
1. "`hydrateRoot`/`hydrate` was called" — no such call exists; nothing framework-global runs at load.
2. "Hydration completed" lifecycle event / single activation timestamp — none exists; wake is per-interaction and lazy.
3. Mismatch-warning grep / `hydrationMismatches: 0` fields — v2 performs no reconciliation walk over server DOM, so mismatch warnings don't exist as a category; such a field is vacuous and hydration-only.
4. "Framework runtime loaded before scenarios run" — inverted for Qwik: eager chunk execution before interaction is a FAILURE signal (cf. markless's zero-cold-click doctrine).
5. "Post-activation = after the hydrate promise resolves, then interact" — for resume, the scenario's first interaction IS the activation; pre/post-activation must be split by first interaction, not by a hydrate barrier.
6. Asserting on a client-side re-render of the full tree (e.g. waiting for a wholesale DOM replacement) — resumed DOM is the server DOM; it is never rebuilt.

## Open risks
1. **SSR serving strategy unresolved**: witness preview serves built output; frameless demos have no server integration (markless leaned on nitro). Dev-mode SSR environments vs build-time prerender is an open T003 decision; witness may need product feedback (T004 stop_if) if neither fits.
2. **One preview per run** (markless box comment, nitro context) — unverified for plain vite preview; a single-root design running React + Solid previews in one run may collide. Two per-demo `witness run` roots produce two receipt trees that the documented command must aggregate.
3. **Pre-activation DOM assertions**: only string-level `expect.html.contains` exists; mapping dom-text/dom-present/dom-path onto server HTML needs in-box DOM parsing or analyzer reuse — and in a live browser, scripts execute on visit, so true pre-activation state is only observable via the fetched HTML string (or by breaking/deferring the client entry).
4. **witness 0.8.0 already published**; 0.7.0 pin is one behind with an unreviewed changelog.
5. **Browser provisioning on fresh clone/CI**: witness needs a system Chromium-family browser or Playwright cache; T999 runs from a fresh clone.
6. **React 19 mismatch console shape unverified** — calibration (intentionally broken hydration) must confirm mismatch warnings actually land in `consoleMessages` as errors for both frameworks before the clean-activation box is trusted.
7. **Path drift**: goal.md/board cite `test/solid2-blocker.test.ts`; the file lives at `packages/frameworks/solid/test/solid2-blocker.test.ts`.
8. **Receipt version marker value** (`asyncWitnessReceipt`) not captured; schema-consuming code should read it from a live receipt rather than assume.
