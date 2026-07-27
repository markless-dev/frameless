# T007a — the peer-resolution inventory, and the number the ruling got wrong

**Board:** `docs/goals/frameless-angular-v1/state.yaml`
**Task:** T010 (worker)
**Date:** 2026-07-27
**Implements:** `docs/goals/frameless-angular-v1/notes/T007-toolchain-leak.md` §5.3, §5.5, §6

---

## 0. What landed

`packages/compiler/test/package-inventory.test.ts` gains a third `describe` block,
`workspace peer-resolution inventory`, alongside the existing `workspace byte invariants`
block and for the same stated reason: the invariant is the workspace's, not any one
package's, and the file already reads from the workspace root. The LF/CRLF block was not
moved, duplicated or generalised.

`packages/frameworks/angular/test/toolchain.test.ts` gains a **comment-only** scope
correction at its "Why this file lives in a NODE-ONLY package" section, plus a pointer to
the new block. **No assertion in it changed.** All six of its tests still pass.

Test count: **861 → 870** (`pnpm test`, 50 files). The nine new tests are one precondition,
three assertion arms and five calibration arms.

---

## 1. The finding: the ruling's "46 atoms" is the buggy number

T007 §1.2 records *"Distinct peer atoms appearing in lockfile snapshot keys: **46 after, 40
before**"*, and the T010 card carries that figure forward as the size of the recorded list.

**It is not reproducible, and the ruling itself says why.** §5.3 warns that a naive
innermost-parens match reads `jsdom@28.1.0(@noble/hashes@2.2.0)` as `@noble/hashes` and
misses `jsdom` entirely, and states that *"that bug is live in the ruling's own throwaway
probe"*. The 46 was produced by that probe. It is the bug's output.

Measured here on the same two lockfiles the ruling compared — `git show HEAD:pnpm-lock.yaml`
versus the working tree — with three extraction readings:

| reading | before | after | finds `jsdom@28.1.0`? |
|---|---|---|---|
| naive innermost `/\(([^()]+)\)/g` | 32 | 45 | **no** |
| depth-1 groups, base before own `(` | 44 | **66** | yes |
| all nesting depths, base before own `(` | 44 | **66** | yes |

Two things follow.

**(a) The correct count is 66, not 46.** The closest reconstruction of 46 is the buggy
reading's 45 atoms plus the single opaque peer hash (`@angular/build`'s). The "40 before" is
not reconstructible under any of the three readings and appears to be a further artefact of
the throwaway probe. The recorded list in the test is the **measured 66**, because recording
the inherited 46 would have shipped an inventory that was wrong about its own subject — the
precise failure this board calls *measure, never inherit*.

**(b) The Angular lane's true peer-atom delta is +24 names and −2, not +6.** Added:
`@angular/common`, `@angular/compiler`, `@angular/core`, `@angular/platform-browser`,
`@angular/platform-server`, `@angular/router`, `@csstools/css-parser-algorithms`,
`@csstools/css-tokenizer`, `@inquirer/prompts`, `@noble/hashes`, `ajv`, `chokidar@5.0.0`,
`css-tree`, `esbuild@0.28.1`, `express@5.2.1`, `hono`, `jsdom`, `listr2`, `lru-cache`,
`prettier`, `rxjs`, `sass`, `vite@7.3.6`, `zod@4.4.2`. Removed: `chokidar@4.0.3`,
`esbuild@0.27.7`.

This does not change the T007 ruling. The six *cross-lane* moves it named are all in the
list and are all still the interesting ones; the ruling's own §1.2 correctly separates the
Angular-internal additions from the ones that reach other lanes. What it changes is the size
of the thing being recorded — and it is a fourth instance of the recurrence T007 §2.4
identifies, now inside the ruling that identified it: **the enumeration was short again.**
The instrument, not more care, is the fix; the instrument is what caught this.

**Depth-1 and all-depths agree on this lockfile** (both 66), because every nested atom also
occurs at depth 1 somewhere. The shipped reader still recurses, since that agreement is a
property of today's lockfile and not of the format.

---

## 2. What the instrument asserts

**Precondition (anti-vacuity).** `> 500` snapshot keys, `> 40` atoms, and three named atoms
from three different lanes present. Asserted *before* any equality, because an empty read
makes every equality below vacuous while still reporting green.

**Arm A — completeness.** `readPeerGraph(lockfile).atoms` equals the 66-entry recorded list,
exact set equality, both directions. Catches a name appearing (the event) and a name
disappearing (the same event run backwards).

**Arm A disclosure.** The set of packages whose peer suffix pnpm collapsed into an opaque
hash equals `['@angular/build']`. Not in the card; added because a peer set the reader
*cannot see* is a hole in a completeness claim, and a second package starting to hide its
peers would silently shrink Arm A's coverage. Recorded by **name only** — the hash and the
version are Angular-lane-internal facts that `toolchain.test.ts` owns, so this does not
overlap it and does not go red on Angular-internal churn.

**Arm B — identity.** For each of the ten declared shared-consumer keys (`vite@8.0.16`,
`vite@7.3.1`, `vitest@4.1.5`, `vite-plus@0.1.20`, `@vitest/browser-playwright@4.1.5`,
`@qwik.dev/core` ×2, `@markless/core`, `unstorage@2.0.0-alpha.7`, `@async/witness@0.7.0`),
the full peer-suffix key equals a recorded literal. Each recorded list is also asserted
non-empty, so emptying one to silence a red cannot pass.

**Calibration, two-sided and then some:**

| arm | plant | expected |
|---|---|---|
| extra | inject `planted-extra@9.9.9(planted-peer@0.0.0)` | Arm A red |
| missing | delete every `(sass@1.99.0)` | Arm A red, 65 atoms |
| moved | rewrite `esbuild@0.28.1` → `0.29.0` | Arm B red |
| nested | synthetic `vitest@4.1.5(jsdom@28.1.0(@noble/hashes@2.2.0))` | naive match returns `['@noble/hashes@2.2.0']`; the shipped reader returns both, outer intact |
| vacuity | no `snapshots:` / malformed key line / zero keys / unbalanced parens | throws, four distinct messages |

The nested arm **pins the ruling's own probe bug as a literal expectation**, so a future
"simplification" back to the one-line regex fails immediately and by name.

---

## 3. Known and accepted properties

- **Arm A records Angular-internal atoms** (`@angular/core@22.0.8`, `rxjs`, `ajv`,
  `listr2`…). T007 §6 says the inventory *"must NOT go red on anything confined to the
  Angular lane's own vendored toolchain"*. Exact set equality over the workspace cannot
  exclude them without becoming a judgement about which names matter — which is the exact
  failure mode the instrument exists to remove, and the same objection T007 §7 raises
  against Arm B's nine-package cut. Resolved in favour of the set: their presence is
  bookkeeping, and `toolchain.test.ts` remains the only place that *says* anything about
  them. The two files assert disjoint facts.
- **`pnpm.overrides` was not added** for `esbuild`, `sass`, `jsdom`, `prettier`, `chokidar`
  or `lru-cache`. Refused by T007 §3 on three grounds and refused again here.
- **`pnpm-lock.yaml` was not modified.** Verified byte-identical before and after
  (`sha256 f52229150e6b4b5ac98dcb3820eb1a8ceaf3857f1a704d0fb592aee3af5f96e2`). An instrument
  that reads the lockfile must never rewrite it, and nothing in this task installs.
- **The maintenance contract is written into the test file**, in T007 §5.4's terms: this is
  a **notification, not a verdict**; a red means the lockfile moved; the fix is to update
  the recorded list **in the same commit that moved `pnpm-lock.yaml`**, naming the causing
  workspace member in the message. Without that paragraph the first person to see it red
  deletes it.

---

## 4. What is still not measured

Unchanged from T007 §4, and restated so it is not read as closed: `chokidar 4 → 5` is a
**major** move under `unstorage`, `nitro`, `@markless/core` and `@markless/router`, and
**nothing in this repo exercises a file watcher or a storage backend**. This inventory
asserts that the peer graph is the one last measured. It asserts nothing about behaviour
under it. That is the proxy T007 §7 flags, accepted for the reason given there — an
inventory red routes to a human who can then measure — and the re-open trigger stands: if
anything here starts exercising markless watch/storage or `nitro`/`unstorage` at runtime,
the major move owes a measurement.
