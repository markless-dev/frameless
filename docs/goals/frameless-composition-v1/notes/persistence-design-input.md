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
