# frameless-qwik-v1 — Qwik v2 emitter: the resumable target (validates activation-neutrality)

## Original ask

Owner (2026-07-23): after SSR + persistence shipped, "where's Qwik v2 as a framework?
… v2 beta 38 … wouldn't it be better to now start doing all the other frameworks?"
Resolved after intake: **Qwik v2 FIRST** (depth over breadth). Qwik is the only
**resumable** target — the entire activation-neutral design of the last two tranches
(SSR's `activation: hydrate|resume`, the `persistence-render-lowering` no-eager-task
gate) was built *for* it. Its two gate triggers are now satisfied (state semantics
settled by persistence; the Qwik-safe gate policy built + mutation-tested), so the
emitter is contract-ready. Angular/Vue/Svelte (all hydration-based; POC evidence in
`poc/09-storage/`) are the breadth follow-on.

## Interpreted outcome

A Qwik **v2** emitter (`packages/frameworks/qwik`, `@qwik.dev/core` **2.0.0-beta.38** —
NEVER v1/`@builder.io/qwik`) that compiles the frameless enriched IR to Qwik v2
**resumable** components, proven **behaviorally** (witness discipline, same as SSR) to:
1. **Resume** correctly — server output carries `qwik/json` serialized state,
   `q:container="paused"`, `q-e:*` listener attrs; at load ONLY the qwikloader runs
   (ZERO app/framework chunks execute — no eager wake); on the first interaction the
   scenario wakes lazily and behaves correctly.
2. Pass the scripted scenarios **post-wake** (first interaction IS activation).
3. Match React/Solid **behavior** (cross-framework equality over the same scenario
   corpus — behavioral, not markup).
4. Be **Qwik-safe** — no render-time work lowers to an eager visible task
   (`q-e:qvisible`); the `persistence-render-lowering` gate passes; the
   no-eager-chunk-at-load doctrine holds.
Green from a fresh clone. This **validates the activation-model-neutral contract for
real** (not "on paper") — the SSR `activation:resume` discriminant and the no-eager-task
gate get a real resuming target.

## Input shape

`existing_plan` — the Qwik v2 resume model + the neutrality contract are already
documented and locked: `docs/goals/frameless-ssr-v1/notes/T001-witness-ssr-evidence.md`
**§4 (Qwik v2 resume model, v2 sources only)**; the SSR `activation: hydrate|resume`
schema; the `persistence-render-lowering` Qwik-safe gate (already built + mutation-tested);
`persistence-design-input.md` (the no-eager-visible-task rule). Preserve these as facts;
validate the emitter seam, don't re-derive the resume model.

## Goal oracle

`pnpm e2e` extended with a Qwik lane, via `@async/witness` with receipts:
- The Qwik-emitted ui-kit output **server-renders** with `qwik/json` serialized state +
  `q:container="paused"` + `q-e:*` listeners (asserted on the pre-activation HTML).
- **At load, ZERO app/framework chunks execute** (only the qwikloader) — the
  no-eager-chunk / no-eager-`q-e:qvisible` assertion (`networkRequests()` shows no eager
  app chunk; console clean). This is the resume proof + the Qwik-safety proof.
- **On first interaction** (which IS activation for resume), the scripted scenario wakes
  and behaves correctly (`expect.page.*` post-wake); no wholesale DOM rebuild (resumed
  DOM is the server DOM).
- **Cross-framework equality**: the same scenario outcomes as React/Solid.
- The `persistence-render-lowering` gate passes on the Qwik emit.
- Calibrated FIRST against an intentionally **eager-wake** break (a `q-e:qvisible` /
  eager chunk load must be DETECTED as a failure). Final audit (T999) from a fresh clone
  records `full_outcome_complete`.

## Existing plan facts (preserve; validate, don't rediscover)

- **Qwik v2 ONLY** (owner directive, standing): `@qwik.dev/core` 2.0.0-beta.38 line;
  QwikDev/qwik **main-branch source** is the authority (the .mdx docs carry stale v1-era
  examples). v1/`@builder.io/qwik` is NEVER a target — v2 changed serialization/resume
  internals, so v1 facts are actively misleading.
- **Resume model (T001 §4):** state = array of "roots" (TypeIds/encoded values,
  RootRef/ForwardRef, **lazy** proxy deserialization); the loader reads
  `<script type="qwik/json">` (`qwikloader.ts:108`); vNodeData serialized by the SSR
  container (`server/ssr-container.ts`); listeners = `q-<scope>:<event>` attrs (e.g.
  `q-e:click`), lifecycle `q-d:qinit`/`q-d:qidle`, and `q-e:qvisible` (the eager-wake
  anti-pattern). The qwikloader installs a few **global** listeners; on interaction it
  reads `q-*` → chunk URL + symbol → executes just that QRL. **No hydrate call, no
  hydration-complete event, no reconciliation walk, no full-tree re-render.**
- **The 6 hydration-shaped assumptions that BREAK under resume (T001 §4):** (1) no
  `hydrate`/`hydrateRoot` call; (2) no hydration-complete event/timestamp; (3) mismatch
  warnings don't exist (vacuous); (4) eager chunk execution before interaction is a
  FAILURE, not "runtime loaded"; (5) pre/post-activation split by FIRST INTERACTION, not
  a hydrate barrier; (6) never assert a client-side full-tree re-render. The witness
  proof MUST honor these — it is the SSR activation-neutral discipline made real.
- **Contract already built & Qwik-safe:** the SSR receipt's `activation: hydrate|resume`
  discriminant (Qwik = `resume`); the `persistence-render-lowering` gate (render storage
  read → pre-paint seed, never eager visible task). Qwik must SATISFY these, not redefine.
- **SSR container / render:** Qwik v2 serves via `renderToStream`/`renderToString` from
  `@qwik.dev/core` (its own SSR) — a NEW vite lane (the Qwik optimizer / `@qwik.dev/core`
  vite plugin), analogous to the Solid `generate:'ssr'` lane. Emitted output consumes the
  CLI-built emitted `.jsx`/Qwik output, never authored `.tsrx`.

## Hard constraints

- **Qwik v2 ONLY** — pin `@qwik.dev/core` 2.0.0-beta.38; record re-eval triggers (beta
  churn: re-read on each beta touching serialization/qwikloader/container attrs). Never v1.
- **Resume-not-hydrate witness discipline** — the proof must not assume a hydrate step
  (honor the 6 broken assumptions); pre/post split by first interaction; the load-time
  proof is ZERO eager app chunks + clean console, never "hydrate called."
- **Behavioral-not-structural** — Qwik's markup differs wildly (q:* attrs, serialized
  state); assert scenario BEHAVIOR + resume properties, never tree equality with React/Solid.
- Emitted apps consume **CLI-built emitted output**, never authored `.tsrx` (charter misfire).
- The markless repo is read-only/off-limits; `poc/**` read-only; Solid stays v1; push to
  main only on explicit owner directive per changeset (AGENTS.md).

## Non-goals

- Qwik v1 (`@builder.io/qwik`) — never.
- Full persistence-on-Qwik serialized-state-patch seed (the Qwik landing for the
  pre-paint value is a **follow-on** — v1 proves resume + the gate holds; the Qwik seed
  channel is scoped after).
- Cross-file composition on Qwik (follow-on; v1 = the ui-kit single-component corpus).
- Angular/Vue/Svelte (the breadth follow-on).
- npm publish; chasing beta churn beyond the pinned beta.38.

## Likely misfire

A **hydration-shaped** Qwik proof (asserting a hydrate call / hydration-complete event /
mismatch warnings / "framework loaded at load" / a full-tree client re-render — all WRONG
for resume); using Qwik v1 or citing v1 resume facts; a render-time read lowering to an
eager `q-e:qvisible` (fails the gate + the no-eager doctrine); structural (markup) equality
instead of behavioral; demo apps importing authored `.tsrx`; touching markless.

## Enough for this tranche

The Qwik v2 emitter resumes the ui-kit scenarios correctly (serialized state, per-
interaction wake, ZERO eager chunks at load), matches React/Solid behaviorally, and is
Qwik-safe (the `persistence-render-lowering` gate + no-eager doctrine), proven via witness
GREEN from a fresh clone; docs honest (Qwik v2 resumable target proven; not persistence-
on-Qwik, not composition-on-Qwik, not v1); markless untouched; breadth cards recorded.
