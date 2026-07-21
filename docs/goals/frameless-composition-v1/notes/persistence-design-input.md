# Persistence / external-state design input (OWNER, 2026-07-20 — binding for the dossier)

Owner constraint, verbatim intent: "It's really important we get localStorage and
other cases like that on render right. In markless it's no issue waking up the one
chunk that does that on render, but for Qwik in visible task it's a big issue."

Design consequence: storage-on-render is granularity-relative. Markless resumes the
one owning chunk (cheap, correct). Qwik's resumability makes render-time reads the
EXPENSIVE path — a naive lowering lands on useVisibleTask$ (eager wake-up, the
documented Qwik anti-pattern). Therefore the markless persistence primitive must
record WHEN the value is needed, not only what is read:

- needed-at: first-paint | visible-patchable | interaction
  * first-paint (theme/locale): no lazy option exists anywhere — blocking inline
    pre-paint read or server-serialized value; Qwik: serialize, NEVER visible task.
  * visible-patchable (draft restore): authored fallback renders, value patches;
    React uSES + fallback snapshot; Qwik: serialized fallback + patch on
    interaction/idle; markless: chunk wake.
  * interaction: lazy everywhere; Qwik's best case (pure listener resume).
- record shape sketch: { storageKey, neededAt, fallback (authored), writePolicy },
  extending the shared({scope}) scope-semantics family.
- GATE RULE (future Qwik target, recorded now): a storage read must never lower to
  an eager visible task; per-tier lowering enforced by policy + mutation test.

Sequencing (owner-aligned): persistence dossier BEFORE any Qwik target work —
Qwik's serialization boundaries must consume settled external-state semantics.
Dossier is read-only (markless repo untouched; fixing board owns it); language
implementation waits for that board.

## Owner idea 2 (2026-07-20): render-time storage reads lower to a generated pre-paint script

Owner: "what about the idea of localStorage access on render always creating a
script tag somehow?" PM synthesis (for T013 to evidence, leading candidate):

- The generated inline pre-paint script generalizes the anti-flash trick: values
  materialize BEFORE any framework exists client-side — markless: no chunk wake
  needed; React: state slot seeded pre-mount; Qwik: serialized state patched
  before resume (state lives in the DOM — a pre-paint rewrite is resumability-
  perfect, zero tasks). Only a compiler with semantic records can do this
  generally and correctly.
- REFINEMENT replacing 'always': the compiler DERIVES the tier via template
  reachability over read records — storage read reachable at first paint ->
  consolidated pre-paint script; behind interaction/visibility -> lazy lowering.
  needed-at becomes an analysis, not an author annotation (markless philosophy).
- Landmines to design, not discover: value-landing channel per target (React SSR
  hydration-match is the hard one — do not corner the design; SSR next tranche);
  ONE consolidated script with a paint budget (+ inlining pure derivations whose
  inputs are static — the ASTs are recorded); CSP hash/nonce emitted with build
  receipts; writes remain runtime write-through.
- T013 must evidence: Qwik serialized-state patching feasibility (docs/corpus),
  React seed-slot pattern vs uSES interplay, real-world anti-flash inventories,
  paint-cost data for blocking inline scripts.

## API sketch (PM, owner-reviewed direction, 2026-07-20)

Authored surface — an option, not a primitive; no annotations, ordinary writes:

    let theme = state<'light'|'dark'>('light', { persist: { key: 'theme' } });

- initial value IS the pre-storage fallback (no extra concept)
- options minimal: { key, serialize?, deserialize?, sync? } (sync: cross-tab
  storage-event subscription, opt-in)
- family generalization later: persist.in: 'local'|'session'|'cookie'|'url' —
  cookie/url are server-readable, future-proofing SSR tiering
- compiler derives: storage-cell record, first-paint reachability per read,
  consolidated pre-paint script per build (landing slot per target: markless
  none-needed, React sync-read seed slot, Qwik pre-resume serialized-state
  patch), write-through on assignment, gate policies (Qwik: never eager task)
- integration seam (honest): compiled-library model emits the script as a build
  artifact + CSP hash in receipts; consuming app includes it in <head> — one
  documented manual step
- ecosystem comparison anchoring 'why compiler-layer': next-themes (hand script +
  suppressHydrationWarning, one hardcoded case), Qwik (no general answer),
  Remix/RSC (routes around via cookies) — none can see the template graph.
