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
