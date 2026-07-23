# storage-ergonomics — refine markless `storage()` + best-DX research

## What the owner asked for
"Implement everything we've talked about, and then do some research on best DX
for the ergonomic storage API where the identifier becomes the key. Maybe
there's other info that makes more sense instead."

## Interpreted outcome
Two deliverables on the markless storage API (feat/storage branch):
1. **Implement the agreed API refinements** (executed-proven), and
2. **Research best-DX for implicit-key persistence** and return a concrete,
   owner-facing recommendation (identifier-derivation may be kept, adjusted, or
   replaced — the research decides).

## Input shape
`existing_plan` (the implementation was co-designed in session — see the agreed
decisions below) **+** a genuine `research` phase whose finding could revise the
ergonomic design.

## Agreed implementation decisions (do not re-litigate the settled parts)
1. **Remove deferred consent entirely.** Delete the `storageAccess:
   'immediate'|'deferred'` render option, the runtime `enableStorage()` method,
   and the storage-slot mode marker. Storage is always immediate. This
   re-aligns with the QDS/storage-poc reference, which never had consent.
2. **Optional key.** `storage(fallback)` derives the key from the binding
   identifier, namespaced: `const theme = storage('light')` -> key
   `markless:theme`. `storage(key, fallback)` still works.
3. **Explicit key is VERBATIM** (owner ruling): `storage('theme','light')` ->
   key `theme` (no prefix) — the escape hatch for interop / deliberate sharing.
   Only the *derived* (no-key) form gets the `markless:` prefix.
4. **No-flash attribute kept, sanitized** (owner ruling): the `<html>` attribute
   becomes `data-markless-theme` (colon -> hyphen), so `html[data-markless-theme]`
   CSS still works before wake.
5. **Bake the derived key as a stable compile-time literal** so it is
   deterministic and minification-safe (never derived from a mangled name).
6. **Rename-safety guard** (the real mechanism, since a stateless compiler cannot
   detect a rename): a compiler-emitted **key manifest** diffed build-over-build.
   If a previously-produced storage key disappears (binding renamed) the build
   warns that existing users' persisted data will orphan. Validate the manifest
   approach (Judge) before building; if it proves too heavy for v1, fall back to
   stable-literal + a documented "pin the key before you ship" norm — but that is
   a Judge decision, not a silent drop.

## Goal oracle (keep pressure until BOTH are true)
- **Implementation proof (executed, not compiling):**
  - The standalone browser runner (`packages/vitest-browser/storage-runner.mjs`)
    is green on the **3 QDS cases** (cold / warm / write+remount) after the
    refactor — deferred case removed.
  - Executed proof that: `storage('light')` yields localStorage key
    `markless:theme` + attr `data-markless-theme`; `storage('theme','light')`
    yields verbatim `theme` + `data-theme`; deferred/storageAccess/enableStorage
    are gone (grep-clean across `packages/`); the derived key is a baked literal.
  - Node suites green: `pnpm test:compiler`, and
    `pnpm exec vp test packages/web/test/*.test.ts packages/runtime/test/*.test.ts`
    and serializer tests — with deferred tests removed and new key-behavior
    tests added.
  - Rename-safety: a build that renames a storage binding produces the manifest
    drift/rename warning (or the Judge-approved v1 fallback is in place).
- **Research proof:** `notes/` DX research artifact that surveys how the
  ecosystem handles implicit-key persistence (e.g. Zustand `persist`, Jotai
  `atomWithStorage`, VueUse `useStorage`, nanostores/persistent, Svelte stores,
  Solid signals, signals-based libs, ORM key conventions), evaluates
  identifier-derivation against the alternatives on real DX axes (write-time
  ergonomics, refactor-safety, discoverability, prod-safety, collision-safety),
  and ends with a **concrete recommendation** (keep / adjust / replace) plus the
  rename-footgun verdict — surfaced for the owner to rule on.

## Constraints / authority
- markless WRITE ACCESS is owner-granted for storage work — **branch only
  (feat/storage); markless main untouchable** without explicit owner confirm.
- Verify in-repo (node suites + the standalone runner). The vitest-browser lane
  deadlocks on this machine; the standalone runner is the executed browser proof.
- Keep the QDS 3-case contract and the promotion-compatible slot schema
  (`Symbol.for('tsrx.storage/1')`, `<moduleId>#<key>`, reserved suffix) intact.

## Non-goals
- Re-adding any consent/deferred surface.
- frameless consumption of storage (that is the separate markless-storage goal,
  T007+); this goal is markless-side API refinement + DX research only.
- Driver zoo / non-string values (v1 = localStorage + strings).

## Likely misfire (avoid)
Implementing the easy parts but silently skipping/weakening the rename-safety
guard; OR delivering hand-wavy research with no decision; OR breaking the QDS
3-case contract; OR letting a mangled/minified name leak into the baked key.

## Tranche
Land the agreed API refinements with executed proof, then deliver the DX
research recommendation. Judge decides whether the research revises the shipped
ergonomic design. Final audit requires executed implementation proof AND a
delivered research recommendation.
