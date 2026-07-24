# T001 — Qwik v2 emitter seam

Scope: evidence and contract map only. This note uses the installed
`@qwik.dev/core@2.0.0-beta.38` public declarations and the existing Frameless
compiler/framework/demo code. It does not re-derive the resume protocol: the authority for
serialization, `qwikloader`, `q:container="paused"`, `q-e:*`, per-interaction wake, and the six
hydration-shaped assumptions that fail is
`docs/goals/frameless-ssr-v1/notes/T001-witness-ssr-evidence.md` §4.

## Verdict

The first emitter slice is **buildable; there is no beta.38 authoring or server API hard
blocker**. `component$`, `$`, `useSignal`, `useStore`, `useComputed$`, `Slot`,
`renderToString`/`renderToStream`, and `qwikVite` are all exported by the installed package
(`node_modules/@qwik.dev/core/public.d.ts:1-98`,
`node_modules/@qwik.dev/core/server.d.ts:1-18`,
`node_modules/@qwik.dev/core/optimizer.d.ts:1-2`). The non-negotiable seam is that emitted code
must be optimizer input, not an already-bundled ordinary JSX library: the optimizer extracts
QRL symbols/chunks, and SSR needs the resulting client manifest to serialize resolvable listener
URLs.

The remaining uncertainty is integration/calibration, not missing core API: Witness must drive a
Qwik-aware client-then-SSR build, preview must serve every manifest-mapped QRL chunk, and the
current Witness page surface cannot directly compare DOM node identity.

## A. `frameless-enriched-ir/2` to a Qwik component

The compiler contract remains target-neutral. `EnrichedGraphBinding`, path-level reads/writes,
events, and template nodes are the inputs (`packages/compiler/src/schema.ts`); Qwik state,
QRLs, JSX conventions, and optimizer constraints belong in the Qwik package, just as React and
Solid make those decisions in their own emitters.

| Enriched IR fact | Qwik v2 emit contract |
| --- | --- |
| Component/module | Emit a named exported const initialized by `component$((props) => …)`. Preserve the IR export name and emit automatic-runtime JSX for `@qwik.dev/core`. |
| Scalar state | Emit `const x = useSignal(init)`. Every read becomes `x.value`; ordered writes become assignments/updates of `x.value`. Unlike the React/Solid visibility optimization, a handler-only mutable scalar must still be a signal so its value and identity survive serialization and later QRL invocations. |
| Object/array state | Emit `useStore(init)` so nested reads/writes are tracked and serializable. Whole-collection replacement must lower to a deterministic proxy-preserving mutation (for example `splice(0, length, ...next)`) or another beta.38-proven store shape; reject an unrepresentable write rather than rebinding the store local. |
| Computed binding | Emit `useComputed$(() => expression)` and read `.value`, or inline a cheap derived expression when calibration proves identical tracking. The former is the explicit reactive contract; it is a QRL extracted by the optimizer, not a visible task. |
| Dynamic text/attribute/property | Rewrite graph reads to signal/store/computed access and emit ordinary JSX expression containers. Direct signal propagation may be optimized by Qwik, but the emitter must not depend on an unproven printer shortcut. |
| Event | Emit the Qwik `$`-suffixed JSX property and an explicit inline QRL, for example `onClick$={$((event, element) => …)}`. Preserve `syncPolicy`, handler order, and write order. Captures may only be serializable signals/stores/QRLs, serializable props, or importable module values; beta.38 explicitly says local non-importable functions fail serialization (`dist/core-internal.d.ts:52-83`). |
| Keyed `@for` | Baseline: render the store array with `.map`, place the IR key expression in `key={…}` on the row root, and preserve the item/index lexical scope. `key` is public JSX/component surface (`dist/core-internal.d.ts:602-610`). Beta.38 also exports experimental `Each` with QRL `item$` and `key$` (`:1393-1402`), but adopting it would add `experimental: ['each']` and beta churn; it is a Judge choice, not required for the first baseline. |
| Conditional `@if` | Emit nested JSX conditional expressions with an explicit `null` empty arm. Beta.38's `Show` is explicitly experimental and takes `when$`/`then$`/`else$` QRLs (`:3470-3481`), so the baseline should not require it. |
| Controlled input | A scalar can use beta.38's typed `bind:value={signal}` / `bind:checked={signal}` (`:3658-3670`, `:4901-4927`). Where an authored event also has ordered writes/callbacks, the safer first lowering is explicit `value`/`checked` plus one `onInput$`/`onChange$` QRL using the handler's second `element` argument; this avoids depending on the ordering of an implicit bind listener and the authored handler. Calibrate that choice against the S2/S3 controls. |
| Default children projection | Emit `<Slot />`; beta.38 restricts `Slot` to a `component$` context (`:3547-3556`). This records the seam, although cross-file composition remains outside this tranche. |

`useSignal` returns a serializable reactive `.value` cell and accepts a value or lazy initializer
(`dist/core-internal.d.ts:4884-4932`). `useStore` returns a deep reactive proxy by default
(`:4934-5007`). These are not merely idioms: they are what makes event captures resumable.
Emitting a plain mutable closure variable for state would make separate QRL invocations lose the
shared cell or fail serialization.

### Simplest ui-kit shape

The pricing-card slice (one scalar state binding, one rendered read, one click) should have this
shape after target lowering:

```jsx
// @generated by @frameless/qwik; do not edit.
import { $, component$, useSignal } from '@qwik.dev/core';

export const PricingCard = component$(
	({ basePrice, multiplier, onTrace$ }) => {
		const seats = useSignal(1);

		return (
			<article data-component="pricing-card">
				<span data-seat-count>{seats.value}</span>
				<output data-price-total>
					{`$${basePrice * multiplier * seats.value}`}
				</output>
				<button
					data-action="add-seat"
					onClick$={$(
						async (event) => {
							seats.value += 1;
							await onTrace$?.('seat-added', { seats: seats.value }, event);
						},
					)}
				>
					Add seat
				</button>
			</article>
		);
	},
);
```

The callback is deliberately shown as `onTrace$`: beta.38 public props only grant QRL/plain
function conversion to prop names ending in `$`
(`dist/core-internal.d.ts:2296-2302,2505-2511`). The consuming Qwik demo must therefore pass a
QRL, for example `onTrace$={$(() => {})}`. Whether the generated target publicly renames authored
`onTrace` to `onTrace$`, or keeps the authored spelling while requiring a QRL value, is a Judge
decision. The `$`-suffixed form is the native, statically expressible contract; the demo scenario
adapter can map the analyzer's target-neutral callback to it.

This source must go through `qwikVite`. `$` is the optimizer marker for extracting a lazy symbol;
the public `QRL` declaration describes the symbol/chunk/capture contract and says application code
must not emit `qrl(...)` itself (`dist/core-internal.d.ts:2653-2678`). The emitter therefore emits
authoring-level `$`, never guessed chunk URLs or symbols.

No render read or initializer may introduce `useVisibleTask$`, `onQVisible$`, or another
`q-e:qvisible` path. The generated component can execute during SSR and wake a requested QRL after
interaction; it must do no client work merely because the element became visible.

## B. SSR container and the new Vite lane

The installed server API is:

- `renderToString(jsx, options?) -> Promise<{ html, timing, isStatic, manifest? }>`
  (`node_modules/@qwik.dev/core/dist/server.d.ts:234-256`);
- `renderToStream(jsx, { stream, ...options })` with flush/size/timing results (`:206-231`);
- `RenderOptions` defaults `snapshot` to true, accepts `base`, loader mode, preloader control,
  `statePrewarm`, and container options (`:149-198`);
- SSR accepts a Qwik manifest/symbol mapper (`:259-273`). `snapshotResult` remains declared but is
  deprecated and “not longer used in v2” (`:199-203`), so the witness must inspect HTML rather
  than rely on that result field.

The Qwik demo needs a third real-app root beside `react-app` and `solid-app`. Its app source imports
only CLI-built Qwik output such as
`demos/ssr/dist/PricingCard/qwik/PricingCard.jsx`; no app source imports authored `.tsrx`.
An app/root component selects the route and supplies serializable primitive props plus QRL callback
props. Its SSR entry exports the `render()` expected by `qwikVite` and calls
`renderToString(<App … />, { manifest, base: '/', qwikLoader: 'module', preloader: false,
statePrewarm: false })`. Disabling the preloader and state prewarm is a witness control for the
strict no-eager-request doctrine, not a substitute for checking it.

`qwikVite` is a pair of Vite plugins (`dist/optimizer.d.ts:342-359`). Its public options expose:

- client input/output plus `manifestOutput` (`:469-493`);
- SSR input/output plus `manifestInput`/`manifestInputPath` (`:497-522`);
- production entry strategy and `srcDir` (`:376-396`);
- a plugin API exposing the optimizer and manifest (`:361-370`).

The manifest records QRL symbols and symbol-to-bundle mappings
(`dist/optimizer.d.ts:113-159`). Therefore the production build sequence is:

1. run the Qwik **client** optimizer build over the CLI-emitted component imports;
2. retain its manifest and QRL chunks;
3. run the Qwik **SSR** build with that exact manifest;
4. import the SSR bundle in a post-build prerender step and write the full
   `renderToString(...).html` for each scenario route into the client output;
5. let Witness preview serve that client output, including the loader and all manifest-mapped
   chunks.

This is analogous to the Solid `generate:'ssr'` lane only in ownership: it is a separate
framework-aware server/client lane. Its ordering differs from the current Solid config
(`demos/ssr/solid-app/vite.config.ts` builds SSR before client): Qwik's client manifest must exist
before SSR serializes QRL listener locations.

A plain JSX transform or unit-test import is insufficient resume evidence. The optimizer must run a
real build so `$` boundaries become chunks and the symbol manifest is available to SSR. Production
defaults to a smart entry strategy; forcing `segment` for deterministic tests is possible in the
installed optimizer types, but changes chunk topology and should be a Judge decision. Assertions
should derive the set of application QRL URLs from the build manifest/artifacts, never bake guessed
chunk names into the witness.

## C. Resume witness plan

Extend the existing box pattern: `pipeline.build` with a Qwik config/root,
`preview.request(path)` for inert server HTML, `preview.browser.visit(path)` for the browser,
`expect.page.*` for behavior, `page.networkRequests()` for loading, and `project.edit` for
calibration. Witness 0.7 records URL/resource type/timestamps/status for each request and exposes
the request list on `PageHandle`
(`node_modules/.pnpm/@async+witness@0.7.0_*/node_modules/@async/witness/dist/index.d.mts:89-102,163-180`).

### 1. Pre-interaction HTML

For every route, fetch with `preview.request(path)` and assert the returned HTML contains:

- `<script type="qwik/json">`;
- the container with `q:container="paused"`;
- the expected interaction attribute, such as `q-e:click`;
- no `q-e:qvisible`.

Then run the existing pre-activation behavioral expectations against the server markup, as
`claim-a-preactivation-*.box.ts` already does. These are string/parsed-HTML assertions; visiting a
browser is not the pre-activation boundary.

### 2. Load-time zero-eager proof

Visit the route and wait only for the server-rendered scenario root. Before any `page.click`:

1. snapshot `const loadRequests = await page.networkRequests()`;
2. classify URLs using the Qwik build manifest and build artifact inventory;
3. allow the document/static assets and the Qwik loader;
4. assert **zero manifest-mapped application/framework/QRL chunk requests**;
5. assert `expect.page.outcome(page, { consoleErrors: 0, failedRequests: 0 })`.

The assertion is “no eager app/framework chunk,” never “hydrate was called.” It must distinguish
the loader from application QRL chunks by owned build facts rather than a filename regex. If
preloading causes an application chunk request, this lane fails even if the chunk has not executed:
the goal's stronger no-eager-network doctrine intentionally treats it as eager work.

### 3. First-interaction wake

Take the pre-click request snapshot, then make the scenario's first `page.click`. That click is the
activation boundary. Assert:

- at least one new request resolves to the clicked listener's manifest-mapped QRL chunk;
- the first scenario action has the expected `expect.page.text`/attribute/existence outcome;
- remaining click-expressible actions pass;
- console errors and failed requests remain zero;
- the page record has no navigation/reload.

There is no preceding hydrate barrier, hydration-complete event, mismatch assertion, or expected
full-tree render. Cross-framework comparison remains behavioral: compare the same scenario
outcomes, while the Qwik receipt entry uses `activation: 'resume'`.

“The resumed DOM is the server DOM” needs an identity-sensitive check in addition to unchanged
markup. `PageHandle.content()` cannot prove node identity, and Witness 0.7 does not expose
`evaluate()` through `PageHandle`. The bounded options are: (a) an explicitly classified inline
witness probe that retains the server root and reports replacement without loading any
app/framework chunk, or (b) a Witness page-identity primitive/product change. Merely comparing
HTML before/after is not sufficient. This is a proof-surface risk, not a Qwik API blocker.

### 4. Eager-wake calibration first

Use `project.edit` before the build to add one deliberate `useVisibleTask$`/visible QRL to an
emitted fixture. Build it through the same optimizer and prove the broken output has
`q-e:qvisible`. On browser visit without interaction, assert a manifest-mapped eager chunk request
appears (and optionally a calibration marker changes). The calibration box stays green by
asserting that the broken signal **was detected**. Restore the edit automatically, then run the
clean box and require the opposite.

This calibrates the exact failure channel. A generic console-error mutant would not prove the
no-eager-chunk assertion can detect Qwik's eager-wake anti-pattern.

## D. Gate and receipt schema

The SSR receipt already admits `activation: 'hydrate' | 'resume'`
(`packages/analyzer/src/receipts.ts:52-67,348-376`). React/Solid continue to report `hydrate`;
the new Qwik framework entry reports `resume`. No extra hydration-mismatch field should be added:
T001 §4 explains why that category is vacuous for resume.

The existing React/Solid `persistence-render-lowering` policies establish two reusable rules:

1. a render-access persistence record must have `seed.lowering === 'pre-paint'`;
2. any lowering/task marker containing visible/eager/effect/mount fails
   (`packages/frameworks/react/src/gate/index.ts:333-410`,
   `packages/frameworks/solid/src/gate/index.ts:458-535`).

The Qwik gate should apply the same artifact rule and add a source check forbidding persistence
seed reads in `useVisibleTask$`, `onQVisible$`, or equivalent eager lifecycle QRLs. Independently,
the emitted ui-kit source should forbid any visible task because this tranche's resume oracle is
stricter than persistence alone.

There is an important current-schema boundary: `PersistenceLanding` contains only markless,
React, and Solid (`packages/compiler/src/persistence.ts:29-44,175-193`). This tranche explicitly
does not implement persistence-on-Qwik. Therefore:

- the non-persistence ui-kit corpus can exercise the Qwik policy and resume proof;
- a Qwik emitter must fail closed on a persistence-bearing IR that would require a target landing;
- adding a Qwik serialized-state landing is follow-on schema work, not something this emitter
  should improvise;
- passing the policy now means “no eager visible lowering and no unsupported persistence emit,”
  not “Qwik persistence has shipped.”

## E. Risks and Judge questions

1. **Witness/Qwik Vite orchestration — material, not yet a blocker.** Witness's default
   `pipeline.build` uses Vite `createBuilder`; it can overlay any `InlineConfig`, but no existing box
   has run the beta.38 Qwik plugin. Confirm that one Qwik config can enforce client-then-SSR order
   and return a previewable client outDir. If the plugin starts its own build orchestration that
   conflicts with the environment builder, try Witness's `strategy: 'build'`; if neither preserves
   the manifest handoff, stop for a Witness/config design decision.
2. **QRL resolution under preview.** The client manifest, SSR `base`, emitted `q:base`, preview
   outDir, and copied chunks must agree. A server HTML pass with a first-click 404 is not resume
   evidence. The first-interaction request must resolve to a manifest-owned artifact.
3. **Callback props.** Decide whether target output renames callback props to the idiomatic
   `$` suffix. Raw function props are unsafe across serialization; the app must supply QRLs.
4. **Keyed list primitive.** Prefer non-experimental `.map` plus the IR key for the baseline, then
   calibrate reorder/remove row identity. Adopt experimental `Each` only if the ordinary keyed JSX
   lane cannot satisfy the identity oracle.
5. **Controlled input ordering.** Choose explicit QRL control updates or `bind:*` only after S2/S3
   calibration proves authored handler order and callback payloads.
6. **DOM identity proof.** Decide between the minimal non-app inline identity probe and a Witness
   API extension. HTML equality plus no navigation is supporting evidence, not identity proof.
7. **Beta surface churn.** `Each` and `Show` are marked experimental; `snapshotResult` is already
   deprecated. Re-read beta.38 replacements before any pin change touching component authoring,
   serialization, container attributes, loader events, optimizer manifests, or SSR results.
8. **Installed dependency skew.** `@qwik.dev/core@2.0.0-beta.38` itself depends on
   `@qwik.dev/optimizer@2.1.0-beta.5`
   (`node_modules/@qwik.dev/core/package.json:4,10-16`). Treat that exact installed pair as the pin.
   The core peer range accepts Vite 8 but declares optional Vitest `<4`, while the repo has Vitest
   4.1.5 (`package.json:28-33`, core package.json `:162-170`); keep the resume proof in the Vite
   build/Witness lane unless a Qwik testing import is separately validated.

**Hard-blocker verdict:** none for the emitter's simplest component or for
`renderToString`/optimizer design. The work should stop, rather than fall back to any other Qwik
generation, only if the real beta.38 build cannot hand the client manifest to SSR, preview cannot
serve its mapped QRL chunks, or the required identity/no-eager proof cannot be expressed after the
bounded Witness alternatives above.
