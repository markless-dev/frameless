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

## OWNER-CONFIRMED DIRECTION (2026-07-20, ~9:55pm): the persistence API is settled in shape

Owner, verbatim intent: the framework needs a persistence API; compiling to
Qwik/React/etc., localStorage access ON RENDER compiles to an inline script — the
initial state is already known — and THE REST IS DONE FROM THE FRAMEWORK.

Locked split (supersedes 'candidate' status):
- RULE (v1, owner's simplification adopted over reachability tiers): any RENDER
  access -> consolidated pre-paint script (read + seed ONLY); any handler access
  -> plain runtime read. Uniform no-flash semantics; reachability analysis is a
  future size optimization if receipts show need, not day-one complexity.
- Script = closed-form compile artifact (keys, authored-initial fallbacks,
  landing slots statically known). Framework runtime owns everything after the
  seed: render from seeded value, ordinary-assignment write-through, opt-in sync.
- Division of labor across repos: markless only ACCEPTS + RECORDS
  persist:{key,...} on state() (small language addition behind the fixing-board
  gate); Frameless owns script generation, landing slots, write-through, gates.
T013 dossier now evidences SPECIFICS (not candidates): corrupted-storage fallback
(never throw pre-paint), key namespacing across compiled libraries, per-target
seed-slot contract, write-through timing vs the notification-atomic store
contract, script-artifact seam (head include + CSP hash in build receipts), Qwik
serialized-state patch mechanics.

## Repo-side evidence (PM, 2026-07-20, read from pinned markless-core 0.1.1 d.ts)

- Pinned signatures: `state<T>(initial: T): T` (NO options today);
  `shared<T>(create, options?: SharedOptions)` (options-bag precedent exists).
  => the language ask is an ADDITIVE second parameter on state() mirroring
  shared()'s existing style — signature-compatible, small.
- The pinned core ALREADY exports `resumeFromPayloadScripts` /
  `ResumePayloadScriptsInput` / `ResumePayloadDocumentInput`: markless has a
  script-fed resume-payload mechanism in the language runtime TODAY. The
  persistence pre-paint script may land its seed through existing payload
  machinery on markless targets (script-feeds-state is native to the language,
  not an add-on) — T013 dossier should verify the payload-scripts contract as
  the markless-side landing slot.
