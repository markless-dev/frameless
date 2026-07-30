# T001 — Tooling: emitter greppability, and the front door

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `3867681` · **not committed**.

Two jobs, both blocking everything after them. Both landed. Three things the dispatch
did not know are in §7 — including one that made a verification pass while measuring
almost nothing.

---

## 1. Owner fingerprint — START and FINISH, IDENTICAL

Method, as the charter mandates: **sort the whole `shasum` OUTPUT LINES.**

| path | START | FINISH | expected |
|---|---|---|---|
| `pnpm-lock.yaml` | `f326d314…` | `f326d314…` | `f326d314` ✅ |
| `pnpm-workspace.yaml` | `aeb7edc1…` | `aeb7edc1…` | `aeb7edc1` ✅ |
| `website/` (lines sorted) | `f936e169…` | `f936e169…` | `f936e169` ✅ |
| `website/` file count | 116 | 116 | 116 ✅ |

The three decoys were recomputed at FINISH to confirm they are still the wrong numbers
and that the correct method is distinguishable from them:

| method | value | board records |
|---|---|---|
| sort whole lines (**correct**) | `f936e169` | `f936e169` |
| sorted **digest column** | `feddd40b` | `feddd40b` |
| sorted by **path**, hash lines | `b1dd182a` | `b1dd182a` |
| sorted **path list** only | `ff230487` | `ff230487` |

**Correction to the charter's wording** — see §7.3. Nothing under those three paths was
read for content, moved, or written at any point.

---

## 2. Job 1 — the NUL byte

### 2.1 Before

```
$ grep -c import packages/frameworks/react/src/emitter/index.ts
                              ← no output at all
exit=1
```

Located with Python, since `grep` cannot see the file it is in:

- **1 NUL**, byte offset **83957**, **line 2261**, in the suspension-segment map key
  `` `${segmentOf.get(statement) ?? 0}\x00${variable}` `` — exactly where the card said.

A repo-wide sweep of **1162 tracked text files** found **exactly one** NUL-bearing file.
The blast radius is this file alone.

### 2.2 The fix

The separator is now the **escape** `\u0000` instead of a raw NUL byte. This is a
**source-only** distinction: the escape evaluates to the same U+0000 in the same template
literal, so the map key is character-for-character the same string at runtime.

### 2.3 After

```
$ grep -c import packages/frameworks/react/src/emitter/index.ts
44
exit=0
```

**44 is the right number, not just a number**: `git show db6e275:…/index.ts | grep -c import`
also answers **44**. Greppability is restored to the value it had before the NUL landed.

### 2.4 The emitted output did not move — and the check measured something

The risk in "byte-identical" claims is comparing two absences. So the pipeline was proved
to actually produce bytes **before** it was trusted to reproduce them:

| step | result |
|---|---|
| baseline: `shasum` of all emitted artifacts | **102 files** recorded |
| **CONTROL, pre-fix**: delete `generated/` + `generated-composition/`, six lanes | `PRESENT AFTER DELETE = 0` |
| re-run 6 × `regenerate` + 6 × `regenerate:composition` | **102/102 byte-identical**, `git status` clean |
| apply the NUL fix | — |
| **delete again**, `PRESENT AFTER DELETE = 0`, regenerate again | **102/102 BYTE-IDENTICAL** |

The pre-fix control is the part that matters: it establishes that deleting really empties
the tree and regenerating really refills it, so the post-fix run compared **100 rebuilt
files against their committed digests**, not two empty sets.

`generated-persistence/` (2 files, react + solid) is not written by `regenerate` — it is
written only under `UPDATE_GOLDENS=1`. It is covered anyway: `test/emitter.test.ts`
asserts `generated-persistence/P1.tsx` byte-equal to freshly emitted output on every run,
and `pnpm test` passes it.

### 2.5 A guard, because the difference is invisible

`packages/frameworks/react/test/emitter-source.test.ts` (new) scans every `.ts`/`.tsx`
under `src/emitter/` and fails on any NUL, reporting the byte offset.

**Mutation-tested, not assumed.** The raw NUL was reinstated exactly as it was:

- `grep -c import` → **exit 1, no output** (the defect reproduces)
- the test → **FAILS**, `nulAt: -1` expected, `nulAt: 84525` received → **mutant killed**
- source restored; NUL count back to 0.

The suite also pins that it read a **non-empty** file list including `index.ts` — a scan
over zero files would otherwise pass while measuring nothing.

### 2.6 The guard comment briefly falsified itself

The comment added beside the fix first read "`grep -c import` returns 44 either side of
the change". Measured afterwards, the file answered **45** - because that sentence
CONTAINS the string `import` and `grep -c` counts matching LINES. The comment had
moved the number it was asserting.

Reworded to name no search term, the count is **44**, equal to
`git show db6e275:.../index.ts | grep -c import`. A second term was checked as an
independent control and deliberately does NOT match - `const` reads 597 at HEAD against
572 at `db6e275`, because the file has grown by real work in the commits between. Only
the import block is unchanged, which is exactly why the card named that term.

This is small, but it is the same failure shape the board keeps finding: a measurement
that perturbs what it measures, recorded as if it had not.

While writing that test the `Write` tool **itself emitted a raw NUL** into the new file
(`grep` went blind to it immediately). Caught by scanning, fixed via Python. That is a
live demonstration that this defect is trivially reintroduced by ordinary tooling, and it
is why the guard is a test rather than a comment.

---

## 3. Job 2 — the front door, measured before it was rewritten

`scripts/demo.mjs` listed **3 of 6 lanes** and **3 of 12 scenarios**, as the card said.
The mechanism was structural, not an omission: `announce()` read `demo.routes[0]`,
`[1]`, `[2]` and nothing else, so a fourth scenario could not have been shown even if the
array had held one.

**It was also simply broken on this machine — see §7.1.**

### 3.1 Route inventory, read off the six demos rather than inherited

| lane | source of truth | routes |
|---|---|---|
| react / solid | `src/App.jsx` `scenarioFor` chain | 12 |
| vue | `src/App.vue` | 12 |
| qwik | `src/routes/*/index.tsx` | 12 |
| svelte | `src/routes/*/+page.svelte` | 12 |
| angular | `src/app/app.routes.ts` | **10** — no `todomvc-advanced`, no `codex` |

Angular's `copy-emitted` script stops at `S10`, matching its two recorded refusals.

### 3.2 How each lane takes a port — all six measured

| lane | form | note |
|---|---|---|
| react / solid / vue | `PORT=<n>` env | all three read `process.env.PORT \|\| 5173`, so all three default to the **same** port |
| qwik | `pnpm --dir demos/qwik dev --port <n>` | script is pinned `vite --port 5175 --strictPort`; **the appended `--port` wins** — verified live, `ps` shows `--port 5175 --strictPort --port 5176` serving on 5176 |
| svelte | `pnpm --dir … dev --port <n>` | ends in `vite dev` |
| angular | `pnpm start --port <n>` | **`start`, not `dev`**; the `--` form fails on a collision |

Because the appended `--port` wins for qwik, the runner still boots **every lane through
its own official dev script** — the file's founding constraint is intact, and the
`npx vite …` re-implementation recorded in `T006 §8.1` was not needed.

### 3.3 What `pnpm demo` prints now

All six lanes, all twelve scenarios, wrapped three to a row, qwik with trailing slashes,
angular's two absences stated rather than omitted:

```
  qwik    (resumes)  http://localhost:5176/
                   S1 /                      S2 /s2/                   S3 /s3/
                   …
                   S10 /todomvc/             S11 /todomvc-advanced/    S12 /codex/

  angular (hydrates) http://localhost:5180/
                   …
                   S10 /todomvc
                   S11 —  not served (emitter refuses: cannot name the global `Promise`)
                   S12 —  not served (emitter refuses: cannot name the global `Promise`)
```

Adding an app is now **one row in `SCENARIOS`**, plus an `unbuilt` entry for any lane that
refuses it. T002–T006 append there.

---

## 4. The launch verification — all six lanes, driven

`pnpm demo` was run; every route it printed was fetched.

**70 announced routes → 70 × HTTP 200. 0 non-200.** Plus angular's 2 recorded absences =
72 cells.

| lane | port | result |
|---|---|---|
| react | 5173 | S1–S12 all 200 |
| solid | 5174 | S1–S12 all 200 |
| qwik | 5176 | S1–S12 all 200 **on the slashed forms** |
| svelte | 5177 | S1–S12 all 200 |
| vue | 5179 | S1–S12 all 200 |
| angular | 5180 | S1–S10 all 200; **S11/S12 404**, recorded |

### 4.1 Negative controls — and the one that fired

A 200 sweep that cannot fail proves nothing, so three controls ran:

- **A — angular's absence is real.** `/todomvc-advanced` **404**, `/codex` **404**, while
  `/todomvc` on the same server is **200**. The absence is S12/S11-specific, not a dead site.
- **B — qwik's trailing slash is load-bearing.** On the live demo port: `/codex` → **301**
  `location: /codex/`; `/codex/` → **200`. Same for `/s2`. A browser follows it silently;
  `curl`/`fetch` sees the 301 and reads zero bytes.
- **C — can the probe fail at all?** `/no-such-route`: svelte **404**, dead port **ERR** —
  but **react and vue answered 200**. ⚠ See §7.2.

### 4.2 Content distinctness — because status codes were not enough

Since three lanes answer 200 for *any* path, each announced route's body was hashed:

| lane | distinct bodies | bogus route falls through to S1? |
|---|---|---|
| react | **12/12** | yes (by design) |
| solid | **12/12** | yes |
| qwik | **12/12** | no |
| svelte | **12/12** | no |
| vue | **12/12** | yes |
| angular | **10/10** | no |

Every announced route serves a **distinct** document. **No printed route is a fallback.**

### 4.3 Process hygiene

Ports were confirmed free before use. All six servers were stopped **by recorded PID**
(67947–67952, each identified by `ps` command line *and* `lsof` working directory before
being signalled), and all six ports confirmed free afterwards. **`pkill -f` was never
used.** Both foreign PIDs were verified still listening at the end.

---

## 5. Baselines — none moved

| check | result | gate |
|---|---|---|
| `pnpm test` | **exactly 1** failure — `package-inventory` ARM B, foreign / **1284 passed** | exactly 1 ✅ |
| `pnpm check` | **267** `error TS` lines | must not rise above 267 ✅ |
| `pnpm e2e` | **PASS** — `Three-way: 6 demos x 9 scenarios, all observations equal` | 6 × 9 ✅ |
| `pnpm lint` | 0 warnings, 0 errors, 480 files | clean ✅ |
| `pnpm check:citations` | clean — 4 documents, 17 watched sources, 547 swept | clean ✅ |

`1284 passed` is `1281 + 3`: the three new greppability tests.

`docs/emitter-idiom-policy.md` was **not touched**. The `+7` comment lines shift every
ordinal after line 2260 in the emitter, but that document cites the file by **symbol**
(`persistenceStatements()`) and by comment convention, never by line number, so nothing
rotted — confirmed by `check:citations`. No census needed re-deriving or softening.

### 5.1 `git diff` paired with `git status`

```
$ git diff --exit-code -- 'packages/frameworks/*/generated' \
      'packages/frameworks/*/generated-composition' 'packages/frameworks/*/generated-persistence'
exit 0

$ git status --short
 M packages/frameworks/react/src/emitter/index.ts
 M scripts/demo.mjs
?? packages/frameworks/react/test/emitter-source.test.ts
 M pnpm-lock.yaml          ← owner's, untouched
 M pnpm-workspace.yaml     ← owner's, untouched
?? website/                ← owner's, untouched
```

The pairing earns its keep here: the diff is clean, and the **only** untracked addition is
the new test — which the diff alone could never have shown. `demos/` is also clean after
the demo run re-ran every `copy-emitted`.

---

## 6. Files changed

| file | change |
|---|---|
| `packages/frameworks/react/src/emitter/index.ts` | raw NUL → `\u0000` escape; 7-line comment recording why |
| `packages/frameworks/react/test/emitter-source.test.ts` | **new** — greppability guard, mutation-tested |
| `scripts/demo.mjs` | rewritten: 6 lanes, 12 scenarios, port preflight, recorded absences |
| `docs/goals/frameless-app-axes-v1/notes/T001-tooling.md` | this note |

---

## 7. What the dispatch did not know

### 7.1 `pnpm demo` was not stale — it was DEAD, and it lied on the way down

The card describes an under-listing problem. Measured, the old runner **exited 1** and
served nothing:

```
[qwik] Error: Port 5175 is already in use
pnpm demo: qwik (demos/qwik) exited while serving (code 1, signal null).
EXIT=1
```

It had qwik **hardcoded** to 5175 — the port the board itself records as foreign-held.

**The worse half:** it printed the complete "here are your URLs" banner *first*, qwik
included, and died afterwards. `waitForAll()` decides a lane is ready when its port
answers 200 — and **the foreign server on 5175 answered 200**. The runner advertised a
URL that served a stranger's application. A liveness check on a *port* is not a readiness
check on the *process you started*.

Both are fixed: ports are confirmed **empty before spawn** (which is what makes a later
200 attributable to us), occupied ports are skipped with the holder reported, and
**nothing is ever killed**.

### 7.2 A second foreign process, not on the board

The board records one: `node` **PID 64413** on **5175** (running since Jul 27). There is
another: `node` **PID 24931** on **5178** (since Jul 30 15:55), which is the port this
rewrite would otherwise have handed to vue.

Both were **recorded, routed around, and left running** — confirmed still listening at
the end. The new preflight is what surfaced the second one rather than colliding with it.

### 7.3 The charter's `feddd40b` is the **sorted** digest column

`goal.md` says "the bare **digest column** gives `feddd40b`". Taking the digest column
bare — `… | awk '{print $1}' | shasum` — gives neither `feddd40b` nor a stable value. Two
consecutive runs of the identical command produced **`990e3330`** and **`d6faf15e`**.

`feddd40b` requires a **sort**: `… | awk '{print $1}' | sort | shasum` → `feddd40b`,
reproducibly.

This is consistent with the charter's own next sentence ("with no sort the value is not
deterministic — `find`'s traversal order alone — so record no expected value for it"); it
is the label "bare digest column" that is under-specified. **The decoy is real and worth
keeping** — it just needs "sorted" in its name. The correct method and its `f936e169` are
unaffected.

### 7.4 Three lanes answer 200 for any path

react, solid and vue route through a `scenarioFor` chain that **falls through to S1** on
an unknown path, so `/no-such-route` returns **200**. The card's verify — "confirm the URL
it printed actually answers 200" — is therefore satisfiable in those lanes by a route that
does not exist. §4.2 closes it by hashing bodies: all 12 are distinct in every lane.

**Later cards should not read a 200 in react/solid/vue as proof a page exists.**
`svelte`, `qwik` and `angular` do 404 correctly.
