# frameless-persistence-v1 — render-time persistence via pre-paint seed script (Qwik-safe)

## Original ask

Owner (this session, 2026-07-22): "let's start the next steps right now… you said
other stuff like the Qwik / Solid 2 tranche so let's get on it." Resolved after
intake: Solid 2 is toolchain-gated (solid2-blocker red at beta.9) and Qwik is gated
behind settled persistence semantics — so the buildable next tranche, and the one
that **unblocks Qwik**, is **frameless persistence**. Owner also: markless is doing
"last ergonomic changes to storage() API but don't let that block you," and pointed
at `docs/goals/storage-ergonomics/goal.md` as the other agent's reference board.

## Interpreted outcome

Frameless compiles render-time persistence reads (the markless `storage()` /
`state(init, {persist})` surface) into a **consolidated closed-form pre-paint seed
script** so the persisted value materializes **before any framework exists
client-side** (no flash), with **per-target landing slots** (markless payload-scripts,
React seed-slot, Solid seed-slot) and **runtime write-through** on ordinary
assignment. The contract is made **Qwik-safe now** — a render-reachable storage read
must never lower to an eager visible task — enforced by a **gate policy + mutation
test**, even though no Qwik emitter is built this tranche. Proven **behaviorally**
(witness discipline, same as SSR), green from a fresh clone. Frameless consumes the
**settled** markless `storage()` contract **without touching the markless repo**.

## Input shape

`existing_plan` — the persistence design is **owner-locked** (see
`docs/goals/frameless-composition-v1/notes/persistence-design-input.md`, "OWNER-
CONFIRMED DIRECTION 2026-07-20"), and the markless-side `storage()` ergonomics are
**settled in shape** (see `docs/goals/storage-ergonomics/goal.md`). Preserve these as
facts; validate the implementation seam, don't re-litigate the design.

## Goal oracle

A documented command (extending `pnpm e2e`, or a sibling persistence lane) that, for
the React and Solid emitted output, via `@async/witness` boxes with receipts:
1. **Pre-paint seed / no-flash:** a persisted value (e.g. a theme) seeded into
   localStorage renders correctly from the **pre-paint script** — the value is present
   in the served/pre-activation DOM **before** framework activation (no fallback flash),
   asserted behaviorally against the served HTML + the anti-flash attribute.
2. **Write-through:** an ordinary assignment to the persisted binding writes through to
   localStorage (asserted post-activation).
3. **Cross-framework equality:** identical behavior React vs Solid over the same corpus.
4. **Qwik-safe gate policy:** a **mutation/policy test** proves a render-reachable
   storage read lowers to the pre-paint seed, **never** an eager visible task (the
   future-Qwik gate rule), and fails if a mutant makes it eager.
5. **Artifact seam:** the pre-paint script is a **closed-form build artifact** with a
   **CSP hash recorded in the build receipts**.
Boxes calibrated against an intentionally broken seed first (must be able to fail).
Final audit (T999) runs from a fresh clone and records `full_outcome_complete`.

## Existing plan facts (preserve; validate, don't rediscover)

- **Owner-locked division of labor:** markless only ACCEPTS + RECORDS `persist:{key,…}`
  on `state()` (and the `storage()` records) — a small language addition on the
  markless side. **Frameless owns** script generation, landing slots, write-through,
  and gate policies. This tranche is **frameless-side only**.
- **v1 lowering rule (owner simplification, adopted over reachability tiers):** ANY
  render access → consolidated pre-paint script (read + seed ONLY); ANY handler access
  → plain runtime read. Uniform no-flash semantics. Reachability tiering (needed-at:
  first-paint / visible-patchable / interaction) is a **future size optimization**, not
  day-one complexity.
- **Script = closed-form compile artifact:** keys, authored-initial fallbacks, and
  landing slots are statically known; the framework runtime owns everything after the
  seed (render from seeded value, ordinary-assignment write-through, opt-in cross-tab
  sync).
- **Settled markless `storage()` ergonomics (from storage-ergonomics; consume by
  contract):** `storage(fallback)` derives a namespaced key `markless:<identifier>`;
  `storage(key, fallback)` and `storage('theme','light')` use the **verbatim** key `theme`
  (no prefix) as the interop escape hatch; the no-flash `<html>` attribute is
  `data-markless-<key>` (colon→hyphen); the derived key is a **baked compile-time
  literal** (never a mangled/minified name); rename-safety is a markless-side manifest.
- **Markless landing slot:** the pinned markless core already exports
  `resumeFromPayloadScripts` / `ResumePayloadScriptsInput` — the pre-paint seed may land
  through existing payload-scripts machinery on markless targets (verify as the
  markless-side landing slot).
- **Per-target seed channel (design, not yet built):** markless = payload-scripts (no
  chunk wake); React = sync-read seed slot before mount (interplay with useSyncExternalStore);
  Solid = seed slot; Qwik (future) = pre-resume serialized-state patch. React SSR
  hydration-match is the hard value-landing case — **do not corner the design**.
- **Corrupted-storage:** the pre-paint read must NEVER throw (fall back to the authored
  initial). **Key namespacing** must be safe across compiled libraries.

## Hard constraints

- The markless repo (`/Users/jacksm5pro/dev/open-source/markless`) is **read-only and
  off-limits** — a separate agent is finalizing `storage()` ergonomics there. Consume
  the `storage()` records/contract as emitted output only; never modify markless.
- **Don't block on the final storage() ergonomic touches**, but pin to the **settled
  contract behind a thin adapter seam** so a late key-derivation/attr tweak is a
  one-file change, not churn.
- **Behavioral-not-structural** (witness discipline, same as frameless-ssr-v1): assert
  behavior (seeded render, no-flash, write-through), not tree shape; frameworks aren't
  forced to identical markup.
- **No Qwik emitter this tranche** — only the gate policy + mutation test that makes the
  contract Qwik-safe. Qwik emitter stays gated (frameless-ssr-v1 T901).
- **Solid stays on the v1 pin** (Solid 2 gated on the solid2-blocker overturn).
- `poc/**` read-only; F8 byte-stability control untouched.
- Push to main only on explicit owner directive per changeset (AGENTS.md).

## Non-goals

- Any markless-side `storage()` / language change (the storage-ergonomics agent owns it).
- Qwik emitter implementation (gate policy only).
- Non-string values or `session`/`cookie`/`url` drivers (v1 = localStorage + strings).
- needed-at reachability tiering (v1 is uniform no-flash; tiering is a later optimization).
- npm publishing.

## Likely misfire

Building the pre-paint seed but silently skipping/weakening the **Qwik-safe gate policy**
(the design's whole point is Qwik-safety recorded now); hardcoding the single theme case
instead of the general compiler-derived script; testing structurally instead of
behaviorally; shipping an actual flash (fallback renders before the seed); letting a
mangled/minified name leak into the baked key; cornering the React SSR hydration-match
value-landing; or touching the markless repo.

## Enough for this tranche

Pre-paint seed + write-through **behaviorally proven** for React and Solid via witness,
**green from a fresh clone**; the Qwik-safe gate policy tested (mutation-proof); the
pre-paint script is a closed-form artifact with a CSP hash in build receipts; docs
honest (only what's proven — not Qwik, not publish); markless repo untouched.
