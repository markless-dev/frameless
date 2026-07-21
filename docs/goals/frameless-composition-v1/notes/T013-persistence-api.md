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

---

## OWNER AMENDMENT (2026-07-20): surface collapsed — derived keys, options cut

Owner: key shouldn't be required (derive from the var — the compiler has the
name); the options bag was too big. Adopted:

```ts
persist: true                    // 90% case — key DERIVED from /2 ownership
                                 // records: <pkg>:<component|factory>.<varName>
persist: 'stable.key'            // explicit key: data that must survive renames
persist: { key?, in?, sync? }    // rare full form (3 options total)
```

- Derived-key trade RECORDED: renaming the var/component orphans stored data ->
  falls back to authored initial (safe-but-lossy; correct for prefs-shaped
  state; opt into a string key for refactor-surviving data).
- CUT `version`: explicit keys are free-form — bump the string itself. Same
  orphaning semantics, zero API.
- CUT `serialize`/`deserialize` from v1: values must be JSON-serializable,
  fail-closed diagnostic otherwise. Also eliminates user code in the pre-paint
  script entirely (the inline-deserializer safety question dissolves).
  Overturn trigger: a real non-JSON need (Date/Map-heavy state) reopens this as
  a recorded decision.
- KEPT `sync` (intent, not derivable) and `in` (object form only).
- Key note: the key is NOT framework-specific — it is the cross-target contract
  (same stored data under React and Solid); it is simply DERIVABLE.

---

## OWNER AMENDMENT 2 (2026-07-20): dedicated primitive, not a state() option — FINAL SURFACE

Owner: "shouldn't it just be a storage function?" Adopted — it matches the
language's own grain (each semantic kind is a named primitive: shared/computed/
element are not state() options; a persisted cell is a distinct kind: external
identity, session-outliving, pre-paint-seeded).

```ts
let theme = storage('light');                                // key derived
let draft = storage('', { key: 'compose.draft' });           // rename-surviving
let tab   = storage('a', { key: 'ui.tab', in: 'session' });  // full form
// options: { key?: string, in?: 'local'|'session', sync?: boolean }
```

- Signature `storage(initial, options?)` mirrors the pinned `shared(create,
  options?)` exactly; markless ask shrinks further: ONE new export, state()
  untouched.
- Flatter than the persist-option form (wrapper layer gone).
- Compiler detection = the proven shared() pattern (import-tracked call sites ->
  distinct record kind) — cleaner than statically analyzing an options object on
  state().
- Reads/writes stay ordinary assignment; composes inside shared() unchanged.
- ALL downstream contracts unchanged (derived immediacy, read+seed script,
  landing slot, T004b write-through, gate rules P-SEED/P-WT/P-SYNC/P-QWK) — they
  were never coupled to surface syntax.
- The persist: option design above is superseded by this section.

---

## OWNER DESIGN SESSION (2026-07-20 evening, Slack w/ Patrick Stapleton) — SUPERSEDING DECISIONS

1. storage() CONFIRMED as the primitive — but it moves OUT of core:
   `@markless/storage`, a separate first-party package like the router.
   Rationale (Patrick, adopted by owner): don't mix sync storage into the
   signal layer; storage() USES signals but is its own layer — correct
   separation; "adapter-like: create storage, platform functions for get/set;
   too much magic isn't great"; if it needs that machinery it doesn't belong in
   the framework. DRIVER/REPOSITORY pattern for platform backends: web ->
   localStorage/cookie, native -> SQLite (goal is multi-platform within
   reason; webview-first native with selective native-view upgrades discussed).
2. SURFACE (owner's current sketch, supersedes derived-key-default):
   `const theme = storage('theme', 'light')` — EXPLICIT key first, initial
   second. "Similar to state in feeling but clearer that what's happening is
   reads and writes to the storage layer, not your state layer." (The derived-
   key idea from earlier today is superseded unless owner revives it; the
   rename-orphan trade it carried disappears with explicit keys.)
3. SCOPE CHARTER (owner's engineer-lens list, adopted): SOLVE DEVICE STATE,
   NOT DATA. Device state (theme/prefs/drafts) has a built-in fallback — the
   default value — safe to own. Data needs sync + conflict resolution — a
   separate system, never this package. Old frameworks died on data; new ones
   shipped nothing; the line goes in the docs in one sentence.
4. DELIVERY MECHANISM REFRAMED — progressive runtime execution: "only the
   possible functions you need at runtime... basically the same as a script
   tag performance-wise but readable." For MARKLESS the pre-paint seed rides
   the chunked runtime / payload-script machinery (native to the language) —
   persistence is A PROPERTY ON THE DATAFLOW GRAPH, explicitly NOT an effect.
   For FRAMELESS TARGETS (React/Solid, monolithic runtimes) the generated
   read+seed script + landing slot remains the lowering — the graph property
   is what makes both derivable. All T013 lowering contracts (seed slot,
   T004b write-through, gate rules, Qwik never-visible-task) stand.
5. NEW DESIGN THREAD OPENED (future tranche input): the compiler EXTENSION
   surface — how first/third parties hook the semantic graph (vite-plugin
   layer exposure, no internals reliance, "don't expose too much power").
   Discovery method (Patrick, adopted): build the ROUTER and STORAGE packages
   first-party and let their DX needs define the API — "if a first-party
   package can't reach the DX you want, it's cooked." Code-splitting/placement
   answer recorded: the compiler decides render-phase vs interaction-phase and
   what-runs-where AT COMPILE TIME and writes decisions as metadata; every
   platform is a translation layer from metadata to action (explicit contrast
   with NativeScript, which crosses the whole platform over the boundary —
   markless crosses only application metadata).

Open for the spec update the owner is writing: exact @markless/storage API
(driver registration shape, get/set contract, sync/async story for SQLite),
whether frameless targets consume storage() via the same compiler records
(they must — the graph property is the cross-target contract), cookie/maxAge
option shape for the server-readable case.

## RESOLUTION (owner + PM, 2026-07-20): package boundary != semantics boundary

Owner: "frameless has this exact same concept — people are definitely going to
want storage." Resolved: @markless/storage is a DISTRIBUTION boundary only. The
SEMANTICS live in the graph, and the graph is what Frameless consumes:
1. The compiler blesses @markless/storage as a semantic import (same import-
   tracking mechanism that recognizes state/shared/element today — the blessed
   list grows from one package to two). storage() calls produce TARGET-AGNOSTIC
   records: { key, initial, medium hint, sync }.
2. Frameless emitters lower from records, never from the package runtime —
   all T013 lowering contracts apply unchanged (seed slot, script, write-
   through, gates). No markless runtime ever ships in compiled output.
3. Driver pattern splits by consumption mode: markless apps = RUNTIME drivers
   (dynamic, platform-configured, SQLite on native); frameless targets =
   COMPILE-TIME driver selection per target. Same records, two translators —
   the metadata thesis applied.
4. Storage is thereby the FORCING FUNCTION for the compiler extension API:
   the first non-core package producing graph semantics; its blessing
   mechanism seeds the extension surface (router next, per the discovery plan).
