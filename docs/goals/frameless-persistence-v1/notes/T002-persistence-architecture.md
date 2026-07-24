# T002 — persistence architecture lock (phase boundary)

PM adjudication of `notes/T001-persistence-seam.md` + the owner-locked design
(`persistence-design-input.md`) + settled ergonomics (`storage-ergonomics/goal.md`).
Every decision cites T001 (as T001 §x) or a file. Owner directives are binding.

## Stance (locked)

**Build downstream against the normalized contract now; the vendor refresh is the
switchover for real source ingestion, not permission to begin** (T001 verdict). Every
buildable-now slice consumes a Frameless-owned record fed by a FIXTURE until markless
is refreshed. Production `buildEnrichedIr` reports ZERO persistence records for pinned
0.1.1 and MUST NOT grep/reparse `storage()` (no shadow language implementation, T001 §B).

## Decision 1 — Adapter seam + record contract: ADOPT T001 §A/§B

`adaptPersistenceFacts(semanticGraph, sourceFacts) -> FramelessPersistenceRecord[]` at
the `buildSemanticGraph` boundary (`packages/compiler/src/build.ts:133-140`); the record
lands in enriched IR (`build.ts:411-450`, `schema.ts:484-499`) as the target-neutral
contract emitters consume. Record shape = T001 §A `FramelessPersistenceRecord`
(version `frameless-persistence-record/1`), fed by `MarklessStorageSourceFact`.
- **Until refresh:** `sourceFacts` is a fixture array; the adapter runs the SAME
  validation/normalization production will use; fixtures stay as compatibility tests.
- **Fail-closed:** any missing/unknown vendor field throws at the adapter — never a
  silent fallback-only application (T001 §B).

## Decision 2 — Anti-flash attribute: RATIFY `data-${resolvedKey.replaceAll(':','-')}`

Derived `markless:theme` → `data-markless-theme`; explicit `theme` → `data-theme`
(T001 §A anti-flash; `storage-ergonomics/goal.md:44-52`). The adapter carries the fully
resolved `antiFlashAttribute` literal; NO emitter recomputes it. The charter's
`data-markless-<key>` is the derived-case shorthand.

## Decision 3 — Pre-paint script generation site: CLI (closed-form, byte-deterministic)

The CLI (`packages/cli/src/node-runtime.ts:188-257`) consolidates ALL module records
into ONE closed-form script, over a stable record sort, computes content SHA-256 +
CSP `sha256-<base64>`, stages it, and describes it in the build receipt. The compiler
stays DOM/fs/framework-free (records only). Script body = baked literals + bounded ops:
`getItem(key)` in try/catch → authored-initial on miss/host-exception/decode-failure →
write to the landing slot → set the anti-flash attr. NO framework import, NO task, NO
runtime identifier discovery (T001 §A). Uniform v1 rule: ANY render access →
`seed.lowering:'pre-paint'`; handler-only → `lowering:'none'` + ordinary runtime read
(`persistence-design-input.md:82-92`).

## Decision 4 — Per-target seed slots: ADOPT T001 §C

- **React:** seed read in the lazy `useState` initializer
  (`packages/frameworks/react/src/emitter/index.ts:3120-3151`). For external stores,
  define SEPARATE hydration-safe server/client snapshot behavior — do NOT substitute the
  warm slot on only one side (`:2872-2883` currently shares the getter — the SSR hazard).
- **Solid:** seed value as the `createSignal`/`createStore` initializer (`:2992-3010`).
- **markless:** emit the write of the seed into the payload/storage slot before
  `resumeFromPayloadScripts`; REAL markless execution is **refresh-gated** (pinned 0.1.1
  has the payload channel but no storage slot protocol, T001 §A landing). Build the emit
  path; mark the markless landing behind the refresh.

## Decision 4a — seed-slot addressing protocol: ALIGN TO THE POC (owner-corrected 2026-07-23)

**SUPERSEDES the earlier `Symbol.for` + module-path slotKey ruling** (owner: "I thought the
read on render was going to be script injection? We have a whole POC for it… the update
happens before the runtime, which is the benefit"). The established mechanism is
`poc/09-storage/core/{seed.js,storage.js}`:
- The pre-paint script reads the driver, sets `data-<key>` on `<html>`, and leaves the
  values in **`window.__FRAMELESS_STATE__`** — a plain named global object keyed by the
  **storage KEY** (`slot['theme']=v`). "Update before the runtime" = the slot is populated
  by the `<head>` script before any framework loads.
- The runtime reads `window.__FRAMELESS_STATE__[key]` on first read (zero second driver
  read), else lazily reads the driver; `set()` persists + updates the attr + notifies.

My earlier ruling OVER-ENGINEERED this (owner flagged the emitted `globalThis[Symbol.for(
'frameless.persistence.seed/1')]?.['src/…#state:draft']` as weird). Corrected ruling:

- **Owning package: `@frameless/compiler`** EXPORTS `FRAMELESS_STATE_GLOBAL = '__FRAMELESS_STATE__'`
  (the POC's `window` property name). CLI (W3) + emitters (W4/W5) IMPORT it; none restate it.
- **DROP the module-path `slotKey`.** The slot is keyed by the **resolved storage key**
  (`markless:draft` derived / verbatim explicit) — already globally unique (that is the point
  of `markless:<id>` namespacing). No `${moduleId}#${graphNodeId}` — the cross-module
  collision worry was moot; remove that machinery from the record/adapter.
- **Seed container** = `window.__FRAMELESS_STATE__`, a plain object `{ [storageKey]: string }`.
- **Pre-paint script (W3), baked literals:** `(window.__FRAMELESS_STATE__??={})['<key>']=v;` then set the anti-flash attr (still `data-${key.replaceAll(':','-')}`, Decision 2).
- **Emitter read (W4/W5):** React `useState(() => window.__FRAMELESS_STATE__?.['<key>'] ?? '<authoredInitial>')`; Solid `createSignal(...)` analogously. Synchronous read at init — the value was materialized by the pre-paint script BEFORE the framework ran (the benefit). The framework NEVER reads the driver itself (Qwik-safe / no eager task — the whole point).

## Decision 5 — Write-through timing: commit-before-notify, same lowered commit (T001 §D)

`compute next values → commit framework state → setItem(final) in try/catch → set
anti-flash attr in try/catch → notify`. For the React shared store, the persist hook
sits BETWEEN the all-writes phase (`:2495-2722`) and the notify phase (`:2723-2768`),
writing each changed persisted cell ONCE at its final value (preserves the store's
notification-atomic contract). Ordinary React state: persist beside the final-sync SSA
(`:1727-1839`). Solid: persist in the setter/commit wrapper (`:1773-1819`). NEVER via a
reactive effect / subscription / onMount (breaks atomicity AND fails the gate, Decision
6). A failed persist side effect never cancels the state commit or its notifications.

## Decision 6 — Qwik-safe gate policy + mutation: ADOPT T001 §E

Add an artifact-required policy `persistence-render-lowering` to BOTH gate suites
(`packages/frameworks/{react,solid}/src/gate/index.ts`). For each `records.persistence`
render-access entry: assert `seed.lowering==='pre-paint'` && `seed.landings` contains
the target && NO lowering/task record is visible/eager/effect/mount; and reject emitted
target code that moves the seed read into a React effect / Solid `createEffect`/`onMount`.
**Mutation test:** start from a valid fixture artifact, flip exactly one render-reachable
record to `{ seed:{ lowering:'eager-visible-task', ... } }` (or drop the pre-paint
landing) → the policy id MUST appear in `violations`; the valid artifact MUST pass
(`react/test/gate.test.ts:556-609`, solid equiv). Add the persistence dossier-reference
to the `DossierRef` type deliberately (`gate/index.ts:15-20`), never mislabel. This is
the Qwik-safety guarantee recorded now — record/lowering based, not fake Qwik syntax.

## Decision 7 — Corrupted-value: unreadable/undecodable ONLY (v1)

"Corrupt" = getItem host exception OR a decode failure for a declared
serialize/deserialize. For the v1 string driver, an arbitrary string ("garbage") is a
VALID string value, NOT corrupt. Pre-paint read NEVER throws → authored-initial on
absence / host-exception / decode-failure (T001 §G.2). Richer validators are future-additive.

## Decision 8 — Derived-key collisions: documented v1 constraint

Derived `markless:theme` is minification-safe but NOT library-scoped. v1: derived keys
are NOT auto-namespaced; DOCUMENT that separately-compiled libraries sharing a derived
identifier share the localStorage driver key — use an explicit verbatim key for
deliberate isolation OR sharing (the interop escape hatch). The slot `<moduleId>#<key>`
prevents in-build landing-slot collisions, not cross-library driver-key collisions
(T001 §G.3). Package/build namespacing is a future option gated on receipts showing need.

## Decision 9 — React SSR *body* no-flash: DEFERRED (owner-aligned), pre-paint seed proven

Per owner: "React SSR hydration-match is the hard one — do not corner the design; SSR
next tranche" (`persistence-design-input.md`). An inline `<head>` script seeds `<html>`
attrs + JS slots but CANNOT patch un-parsed body DOM (T001 §F limitation). Therefore v1
proves the **pre-paint SEED MECHANISM** — the persisted value materializes into the slot
+ anti-flash attr BEFORE framework activation (client-side no-flash) — via an
**activation-barrier** witness scenario (seed pre-paint into the root/slot; a probe
observes the seeded value + attr while the activation marker is absent; then release
activation). The React `useSyncExternalStore` server/client snapshots must be seeded
CONSISTENTLY so the barrier scenario has no mismatch. The full SSR-server-body-vs-client
value-landing (a parser-time serialized-state patch) is a **gated follow-on card (T901)**,
NOT this tranche's blocker. The no-flash CLAIM stays honest: client pre-paint no-flash
proven; SSR-body no-flash explicitly out of scope + carded.

## Decision 10 — CSP + receipts: deliberate exact-key schema bumps

- **Build receipt** (`packages/cli/src/receipts.ts`): add a persistence artifact record
  — script path, content SHA-256, CSP `sha256-<base64>`, ordered record/slot identities,
  head-before-framework placement. ONE build-level script artifact (default; per-target
  byte-identical copy only if a target demands it).
- **Analyzer receipt** (`packages/analyzer/src/receipts.ts`): add an OPTIONAL
  `persistence` section (pre-activation seed / no-flash, write-through, equality,
  calibration) via a deliberate exact-key version bump (mirror the SSR `ssr` entry
  precedent — `frameless-receipts/2` → `/3`), validated (positive + negative tests).

## Decision 11 — Rename manifest: markless-side; frameless carries through

The compiler-emitted rename manifest is markless-side (`storage-ergonomics/goal.md:36-42`).
Frameless receipts carry it through IF present in refreshed output; frameless does NOT
implement a second manifest. Refresh-gated for real data.

## Resumability / activation-neutrality fitness (PASS)

The record's `seed.lowering:'pre-paint'|'none'` + landing-per-target + the gate rule
"render read never lowers to an eager visible task" map cleanly onto the future Qwik
serialized-state patch (pre-resume, zero tasks) — same neutrality discipline the SSR
tranche used. No hydrate-only assumption in the record or receipt.

## Worker packages

### W1 — record contract + adapter + enriched IR + fixtures (T003; DISPATCH FIRST)
Largest safe foundation; fully node-verifiable (no browser, no vendor, no framework
runtime). Build `FramelessPersistenceRecord` + `MarklessStorageSourceFact` types, the
`adaptPersistenceFacts` adapter (fail-closed validation + normalization: key origin,
resolved anti-flash attr, render/handler access split, seed lowering, write-through
policy), thread `records.persistence` through enriched IR (`build.ts:411-450`,
`schema.ts`), and a fixture corpus (derived + explicit key; render vs handler; cold/warm)
with unit tests incl. NEGATIVE controls (fail-closed on missing vendor field; wrong-shape
rejected). Production path emits ZERO persistence records for pinned 0.1.1.
- **allowed_files:** `packages/compiler/src/**`, `packages/compiler/test/**`
- **verify:** `pnpm check && pnpm lint && pnpm test && pnpm build`; `git diff --stat -- poc/` empty
- **stop_if:** need files outside contract; the enriched-IR record can't be threaded
  without a markless-side change → blocked-return (do NOT touch markless); verify fails twice.

### W2 — Qwik-safe gate policy + mutation test (both suites)
Consumes W1's record. Add the `persistence-render-lowering` artifact-required policy +
DossierRef + mutation tests to react & solid gate suites. Node-verifiable.
- **allowed_files:** `packages/frameworks/{react,solid}/src/gate/**`, `.../test/gate.test.ts`

### W3 — CLI closed-form pre-paint script + CSP hash + build-receipt persistence artifact
Consumes W1. Script planner/generator (byte-deterministic), SHA-256 + CSP, build-receipt
schema bump. Node-verifiable (assert emitted script bytes + receipt).
- **allowed_files:** `packages/cli/src/**`, `packages/cli/test/**`

### W4 — React seed-slot init + write-through lowering
Emitter changes (Decision 4/5). Node-verifiable via emitter golden + a targeted browser
lane later.
- **allowed_files:** `packages/frameworks/react/src/emitter/**`, `.../test/**`, `.../generated*/**`

### W5 — Solid seed-slot init + write-through lowering
Symmetric to W4.
- **allowed_files:** `packages/frameworks/solid/src/emitter/**`, `.../test/**`, `.../generated*/**`

### W6 — witness lane `demos/persistence/` + analyzer receipt + e2e fold
The behavioral proof (activation-barrier no-flash + write-through + equality + broken-seed
calibration, Decision 9/10), analyzer `persistence` receipt bump, `pnpm e2e` fold. PM runs
witness (browser+loopback). Depends on W3+W4+W5.
- **allowed_files:** `demos/persistence/**`, `packages/analyzer/src/**`, `.../test/**`, `scripts/e2e.mjs`, `package.json`, `pnpm-lock.yaml`

### Gated cards (do not start)
- **T900** Qwik emitter — this tranche builds only the gate policy (W2).
- **T901** React SSR-body value-landing (parser-time serialized-state patch) — Decision 9 follow-on.
- **Refresh switchover** — real `storage()` source ingestion + markless payload execution
  land when the markless vendor refresh arrives; W1's adapter makes it a `sourceFacts` swap.

## Critique gate
W1 (data contract, node-verifiable, reversible) is low-risk → dispatch without pre-critique.
Run second-model critique before W3 (receipt-compat), W4/W6 (React SSR landing / compiler
emit), per the fable critique triggers.
