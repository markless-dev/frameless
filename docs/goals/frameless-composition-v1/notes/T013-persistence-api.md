# T013 — Persistence API decision (PM synthesis, 2026-07-20)

Provenance: PM design built on executed repo evidence (persistence-design-input.md:
owner-confirmed pre-paint direction, T004b transaction contract, pinned-core
signatures incl. resumeFromPayloadScripts) — the web-evidence research pass died
before completing and remains OWED; findings below marked [verify] need it.
Status: API decision recorded; T013 not closed until the evidence pass lands.

## The case: state needed on the client immediately (theme, localStorage reads at render)

## Authored surface — the whole API for the common case

```ts
import { state } from '@markless/core';

let theme = state<'light' | 'dark'>('light', {
	persist: { key: 'app.theme' },
});
```

Nothing else. No "immediate" annotation exists: IMMEDIACY IS DERIVED — a render
read of `theme` is what makes it first-paint-relevant, and the compiler sees every
render read in the IR. Handler-only persisted cells never pay any pre-paint cost
(owner's render-access rule).

Full options:

```ts
persist: {
	key: string,                       // required
	in?: 'local' | 'session',          // default 'local'; 'cookie'|'url' reserved for the SSR tranche
	serialize?: (v: T) => string,      // default JSON.stringify
	deserialize?: (raw: string) => T,  // default JSON.parse; a THROW here falls back to the initial
	sync?: boolean,                    // cross-tab storage-event subscription; default false
}
```

FALLBACK CONTRACT (load-bearing): the authored initial IS the fallback — used when
the key is absent, storage is unavailable (private mode / disabled), or
deserialize throws. A corrupted or schema-drifted stored value is silently
discarded in favor of the initial. Nothing in the persistence path may throw
pre-paint. (This is also the honest v1 answer to migration/versioning: no
migration hooks in v1; drift -> initial. Recorded boundary.)

Language-side ask (markless, gated on the fixing board): add the options bag as a
second parameter to state() — additive, mirrors shared(create, options?) exactly.
The compiler records { key, medium, serializerRef, syncFlag } per cell; everything
else is Frameless-side.

## Compiled contract — three layers

### 1. Pre-paint script (generated, one per build, read+seed ONLY)

```html
<script>/* frameless:persist — sha256 recorded in build receipts for CSP */
(function () {
	try {
		var s = (window.__FRAMELESS_STATE__ = window.__FRAMELESS_STATE__ || {});
		var r = localStorage.getItem('ui-kit:app.theme');
		if (r != null) { try { s['ui-kit:app.theme'] = JSON.parse(r); } catch (e) {} }
		/* ...one block per render-read persisted cell, statically known... */
	} catch (e) {}
})();
</script>
```

- Contains ONLY cells with render reads (derived, consolidated, statically
  closed-form: keys + deserializers known at compile time; custom deserializers
  inline if pure/self-contained, else [verify] the cell demotes to
  runtime-seeded with a build warning — no arbitrary code smuggling into <head>).
- Never touches the DOM, never throws, no framework knowledge.
- Emitted as a build artifact by the CLI with its CSP hash in the build receipt;
  the consuming app's one documented step is including it in <head>.
- WHY NO html-attribute patching in v1: this product is CSR — nothing paints
  before the framework mounts, and the framework reads the seed synchronously at
  state init, so first render is already correct. The classic anti-flash
  attribute trick is an SSR-HTML problem; the recorded SSR plan routes
  first-paint-critical state to server-readable media (persist.in cookie/url)
  when that tranche opens.

### 2. Landing slot contract

`window.__FRAMELESS_STATE__[fullKey]` — key PRESENT means "storage held a valid
value"; ABSENT means "use the authored initial". Read exactly once per cell at
state initialization, synchronously; the slot is never a live channel.

Key namespacing: fullKey = `<packageName>:<authored key>` (the CLI knows the
package); an authored key containing ':' is taken as explicit-full (escape
hatch). Deterministic, collision-safe when multiple compiled libraries share an
origin.

### 3. Framework runtime (owns everything after the seed)

- React: emitted store/hook initializes from `seed ?? initial`. WRITE-THROUGH
  rides the notification-atomic contract (T004b): storage.setItem executes in the
  post-method notification phase — assignment paths stay cheap, storage sees the
  final value once per transaction, order preserved. `sync: true` subscribes to
  the storage event (fires only in OTHER tabs — by spec) and notifies exactly the
  affected cell.
- Solid: signal/store from `seed ?? initial`; same write-through phase; storage
  event -> setter.
- markless: native — the seed rides the existing resumeFromPayloadScripts payload
  channel (script-feeds-state is already a language-runtime mechanism; no new
  slot needed).
- Qwik (future, recorded gate rule): serialized fallback + seed-slot-preferring
  reads; a storage read must NEVER lower to an eager visible task.

## The guarantee, stated once

Any persisted cell read during render is correct at first paint, with zero
flash, on every target — because its value exists before any framework does.
Theme walk-through: `state('light', { persist: { key: 'app.theme' } })` +
`<html data-theme={theme}>`-style render read -> script seeds before paint ->
first render emits the stored theme -> toggling writes through post-notification
-> other tabs update via sync: true if opted in.

## Gate rules (per target, mutation-tested when implemented)

- P-SEED1: a render-read persisted cell's initializer must consume the landing
  slot (seed ?? initial) — reject direct storage reads in component code.
- P-SEED2: handler-only persisted cells must NOT appear in the pre-paint script.
- P-WT1: write-through only in the post-method notification phase; no setItem on
  raw assignment paths.
- P-SYNC1: storage-event subscription present iff sync: true, notifying only the
  owning cell.
- P-QWK1 (future): no eager visible task for any storage read.

## Owed evidence ([verify] before implementation packet)

Qwik v2 serialized-state mechanics; inline-deserializer safety policy; CSP
hash-vs-nonce practice; paint-cost budget data for the consolidated script;
storage-event edge cases inventory. The web research pass that died must be
re-run (crew scout or direct search — NOT workflows) before the emitter packet.

---

## EVIDENCE PASS (2026-07-20, PM-executed: local qwik build/v2 corpus + web) — owed items closed

1. QWIK V2 (decisive, from /Users/jacksm5pro/dev/open-source/qwik @ build/v2):
   serialization.md states restore is LAZY BY DESIGN ("To avoid blocking the main
   thread on wake, we lazily restore the roots... a proxy deserializes properties
   on demand"); state ships in `<script type="qwik/state">`; and v2 has a NATIVE
   state-PATCH-script mechanism (process-segment-state.ts, QStatePatchAttrSelector
   — experimental/suspense-gated today). RULING: seed-slot-preferring reads are
   cleanly safe (nothing is deserialized before first access, and our script runs
   pre-paint, long before any interaction); the native patch-script channel is the
   eventual first-class landing once stable. Visible task: never needed, confirmed
   at the architecture level.
2. PRIOR ART (next-themes, verified): inline blocking head script + React
   suppressHydrationWarning are a matched pair for the SSR case; script accepts a
   CSP nonce and wraps in silent try/catch. Confirms our script rules (silent,
   never-throw) and confirms the mismatch problem is SSR-only — our CSR v1 dodges
   it entirely by seeding state instead of patching DOM.
3. SCARS ADOPTED INTO THE API:
   - zustand persist: version/migrate exists because schema drift breaks apps;
     stale persisted closures broke prod deploys. -> add `version?: number`,
     implemented as key suffix (`<pkg>:<key>@v<N>`): a bump ORPHANS old data =
     drift-to-initial by construction, zero migration machinery in v1 (recorded
     boundary; migrate hooks are a future option that the envelope-free format
     does not preclude).
   - jotai atomWithStorage: getOnInit defaults FALSE, so SPA first renders show
     the initial instead of the stored value — the exact bug class the pre-paint
     seed abolishes (our reads are always stored-value-first with no SSR cost in
     CSR).
4. CSP (web.dev strict-csp, MDN, OWASP): hashes suit stable build-generated
   scripts; nonces suit per-request content. Ours is stable per build -> sha256 in
   the build receipt (already specified) PLUS the emitted snippet documents a
   nonce attribute passthrough for apps on nonce-based CSP. Both policies work
   with 'strict-dynamic'.
5. STORAGE EVENT (MDN, verified): does NOT fire in the writing tab (by spec);
   sessionStorage's event never reaches other tabs. -> API rule: `sync: true`
   with `in: 'session'` is a contradiction and FAILS CLOSED at compile time;
   sync's same-tab consistency needs no event (the writing tab already applied
   the write through the store).

Sources: qwik build/v2 serialization.md + process-segment-state.ts (local corpus);
https://github.com/pacocoursey/next-themes; https://nextjs.org/docs/app/guides/preventing-flash-before-hydration;
https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data;
https://github.com/pmndrs/zustand/discussions/2556; https://jotai.org/docs/utilities/storage;
https://github.com/pmndrs/jotai/issues/2240; https://web.dev/articles/strict-csp;
https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event

## FINAL API (v1, evidence-complete)

```ts
let theme = state<'light' | 'dark'>('light', {
	persist: {
		key: 'app.theme',            // required; fullKey = <pkg>:<key>[@v<version>]
		in?: 'local' | 'session',    // default 'local'
		version?: number,            // key-suffix orphaning; drift -> initial
		serialize?: (v) => string,   // default JSON.stringify
		deserialize?: (raw) => v,    // default JSON.parse; throw -> initial
		sync?: boolean,              // default false; REJECTED with in:'session'
	},
});
```

Everything else unchanged from the decision above: derived immediacy (render read
-> consolidated read+seed pre-paint script; handler-only -> no script), landing
slot `window.__FRAMELESS_STATE__[fullKey]`, authored initial as the universal
fallback, write-through in the post-method notification phase, per-target
lowerings (React/Solid seed-read; markless payload channel; Qwik seed-preferring
reads now CORPUS-VERIFIED), gate rules P-SEED1/2, P-WT1, P-SYNC1 (+ new
P-SYNC2: reject sync+session), P-QWK1. T013 evidence obligations: CLOSED.
