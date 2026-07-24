# T002a — alignment check: shipped markless storage() vs our contract (2026-07-22)

Owner FYI: the markless storage-ergonomics goal is DONE. Checked the shipped design
(`docs/goals/storage-ergonomics/state.yaml` receipts + markless `feat/storage` read-only)
to confirm our persistence tranche builds against the RIGHT contract.

## What shipped (markless feat/storage, storage-ergonomics = done)

- **Derived key kept** (DX research verdict = KEEP, not replace): `storage(fallback)` →
  `derivedStorageKey(identifier) = `markless:${identifier}`` — a compile-time BAKED
  LITERAL (`collect-storage.ts:13-14`). Arity dispatch: `explicit = args.length >= 2`;
  `storage(key, fallback)` uses `key` VERBATIM, fallback = args[1]; `storage(fallback)`
  derives, fallback = args[0] (`collect-storage.ts:25-29`).
- **Semantic-graph record is LEAN:** `SemanticGraphBinding.storage?: { readonly key: string }`
  (`artifacts.ts:90`) — JUST the resolved key. The **fallback becomes the binding's
  `initialValue`** (`collect-storage.ts:58`), NOT a field on the storage record. **Origin
  (derived vs explicit) is NOT emitted** — it's computed during collection and discarded.
- No-flash attr: `data-markless-<id>` (derived, colon→hyphen) / `data-<key>` (explicit).
- Rename-safety: a committed `markless-storage-keys.json` manifest (markless-side).
- v1 = string values + localStorage; consent surface removed.

## Alignment verdict: our goal IS doing the right thing ✅

| Our decision | Shipped markless | Match? |
|---|---|---|
| Derived key `markless:<id>`, baked literal | `derivedStorageKey` baked literal | ✅ |
| Explicit key verbatim | args.length>=2 → verbatim | ✅ |
| Anti-flash `data-${key.replaceAll(':','-')}` (Decision 2) | `data-markless-<id>`/`data-<key>` | ✅ (origin-independent — derives from the RESOLVED KEY, so it's correct even though markless doesn't emit origin) |
| authoredInitial = the fallback | fallback → binding `initialValue` | ✅ (switchover maps it) |
| Rename manifest = markless-side, frameless carries through (Decision 11) | committed `markless-storage-keys.json` | ✅ |
| v1 string + localStorage (Decision 7/8) | string + localStorage | ✅ |

## The one switchover refinement (T001 already flagged this — record for the vendor swap)

The vendor emits **only `{ storage: { key } }` + `initialValue`** — NOT the richer
`MarklessStorageSourceFact` our fixtures use. So the **switchover extraction** (when
frameless vendors the refreshed markless) maps:
- `sourceFact.key.literal` ← `binding.storage.key`
- `sourceFact.authoredInitial` ← `binding.initialValue`
- `sourceFact.key.origin` = **UNAVAILABLE** — do NOT infer from the string (an explicit
  key may legitimately be `markless:theme`, the interop escape hatch). Origin/manifest
  provenance is markless-side; frameless derives everything it needs (anti-flash attr,
  seed, write) from the RESOLVED KEY + initialValue alone. (T001 §A flagged exactly this.)

**Action for the switchover task (not now):** relax the adapter's source-fact `origin`
from required to optional/'unavailable', mapping the lean vendor shape. Our FRAMELESS-owned
`FramelessPersistenceRecord`, seed protocol (Decision 4a), CLI script, gate, and witness
proof are UNAFFECTED — they consume the normalized record, not the vendor shape.

## Vendor status unchanged (build-against-fixtures stance holds)

The storage() work is on markless `feat/storage` (HEAD ~259f89c/de7a5fd), NOT merged to
main, NOT released, NOT vendored into frameless (which still pins `markless-*-0.1.1.tgz`).
So the vendor refresh is still a FUTURE step; our fixture-fed machinery + the switchover
seam remain the correct approach. No change to the running tranche (W1/W2 done; W3b in
flight builds the frameless-owned protocol + script — independent of the vendor shape).
