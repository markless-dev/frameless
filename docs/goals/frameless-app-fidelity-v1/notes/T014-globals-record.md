# T014 — the globals record sweep

Board: `docs/goals/frameless-app-fidelity-v1` · HEAD `94c6d54` · record-only, nothing derives.

---

## 1. My own count: 33 claim sentences across 16 files, in TWO sub-families

T013 reported "16 claim-sites across 16 files". **The file count is right and the claim count is
low by two different mechanisms**, and the second one is a whole sub-family no sweep on this
board has ever looked at — including the sweep that named the sixth undercount.

| sub-family | what it asserts | sites | ever swept before? |
|---|---|---|---|
| **A — angular refuses S11/S12** | angular refuses at emit / has no `/todomvc-advanced` / has no `/codex` / cannot link the third sheet / "five lanes, not six" | **25** | only by T013, which named 16 |
| **B — vue's stream throws** | vue emits S11/S12 and then throws `_ctx.Promise is not a constructor` in the browser; "the two ASYNC axes throwing" | **8** | **NEVER — by any card on this board** |
| | | **33** | |

Both sub-families were closed by **one commit**: T007's two-name allowlist landed the angular
lane *and* repaired vue in the same change (`b873451`, "angular gains a sixth lane, vue repaired").
A sweep that corrects only half of one commit's consequences is the same undercount one level in.

**Why 25 and not T013's 16 for sub-family A.** T013 counted *line ranges*; several of those ranges
carry two independent false claims. `react-official/src/App.jsx:264-267` asserts both "the lane
count is FOUR" and "angular has no counterpart to this page"; `:298-306` asserts both "FOUR lanes
run it, one refuses at emit" and "ANGULAR HAS NO COUNTERPART TO THIS PAGE". Correcting a range is
not the same as correcting every claim inside it.

Three sites in sub-family A were **not in T013's list at all**:

- `svelte-official/src/routes/todomvc-advanced/+page.svelte:31` — "all **five** shipped lanes start
  from byte-identical data".
- `angular-official/src/app/habits-page.ts:7` — "the FOURTH of **four** wrapper components in this
  lane". There are eight. It was four only while this lane was missing S11, S12 and S14.
- `angular-official/src/app/habits-page.ts:17` — "THIS IS THE FOURTH APPLICATION ROUTE THIS LANE
  HAS, AND S15 IS THE SECOND CORPUS APPLICATION IT SHIPS ALONGSIDE THE OTHER FIVE LANES".

### Files (16)

Hand-edited (10): `demos/react-official/src/App.jsx`, `demos/solid-official/src/App.jsx`,
`demos/qwik/src/routes/todomvc-advanced/index.tsx`, `demos/qwik/src/routes/codex/index.tsx`,
`demos/svelte-official/src/routes/todomvc-advanced/+page.svelte`,
`demos/svelte-official/src/routes/codex/+page.svelte`,
`demos/angular-official/src/app/habits-page.ts`, `demos/shared/copy-todomvc-css.mjs`,
`demos/shared/todomvc-app-css/README.md`, `demos/shared/shadcn-theme/codex.css`.

Derived by `copy-shadcn-theme.mjs` (6): the lane copies of `shadcn-theme/codex.css`. **No lane copy
was hand-edited.** All seven share one digest afterwards:
`967335beb3ed41e72bacd0a0f1afc34dfdfa0d93ba95cb7e17cae160cf99f413`.

Left alone as already correct at HEAD, per the card: `demos/vue-official/src/App.vue`,
`demos/angular-official/src/app/hn-page.ts`, `demos/angular-official/src/app/todomvc-advanced-page.ts`.
Re-read; all three are correctly past tense. `demos/vue-official/src/App.vue` was used as the
wording model for the other lanes.

---

## 2. `shadcn-theme/codex.css:60` — RULED IN, and repaired BY TENSE, not by number

T013 left this one to T014 explicitly. **Ruling: it is a claim-site.**

It read "MEASURED HERE at 1440x1000 across the five lanes **that serve this page**, BEFORE this
block existed". The measurement is historical and its **five is the population that was actually
measured** — so the number is correct and must not be changed to six, which would claim a sweep
that never happened over a lane that was not in it. But the relative clause is in the **present
tense** and therefore states a current lane count of five, which is false.

Repaired by tense: "the five lanes THAT SERVED THIS PAGE AT THE TIME", plus an explicit note that
the five is left standing deliberately, that six lanes serve `/codex` today, and that **the
43/13/4 divergence counts below it describe five lanes and have never been re-run over six**. That
last sentence is a new, small recorded gap that the old wording concealed.

---

## 3. The citation to an empty list — and one that was worse than dangling

Both qwik's and svelte's `todomvc-advanced` comments cited
`packages/frameworks/angular/test/unbuilt-scenarios.ts` as "the record of the refusal".
`ANGULAR_UNBUILT_SCENARIOS` there is `[]` at line 84. Both re-pointed at
`TRANSPLANTED_GLOBALS` in `packages/frameworks/angular/src/emitter/index.ts` (the live record),
with the file kept as the reference for the *history*, which its own header now carries.

**`svelte-official/src/routes/codex/+page.svelte:19-20` was not merely dangling — it was inverted.**
It said the file "drives the real `emit()` and asserts it **throws** with that message". At HEAD
that lane's `emitter.test.ts` drives both formerly-refused goldens through the real `emit()` and
**requires them to succeed**, keeping a separate `Math` row as the live negative control. A reader
following that citation would have found the exact opposite of what was promised.

`check-citations.mjs` passed clean over both, at every commit, for the whole life of this board —
it validates first-party *line ordinals* and never that a cited path still supports the claim.
That is T012's unowned finding, reproduced here with a second, sharper instance.

---

## 4. Measurement: angular serving BOTH routes, by body hash, at HEAD

Booted alone: `pnpm --dir demos/angular-official start --port 5190` (no `--` separator; the `--`
form fails exactly as `scripts/demo.mjs:477-479` documents). All eight application routes measured,
not just the two:

| route | HTTP | bytes | sha256 (12) | `app-root` |
|---|---|---|---|---|
| `/todomvc` | 200 | 3,583 | `8f49d470ef73` | yes |
| `/todomvc-advanced` | 200 | **5,049** | `7eab74b98b38` | yes |
| `/codex` | 200 | **5,356** | `e8de62d5e800` | yes |
| `/hn` | 200 | 18,103 | `fc4578509121` | yes |
| `/hn-item` | 200 | 34,026 | `fea784703358` | yes |
| `/habits` | 200 | 13,511 | `231147140a15` | yes |
| `/board` | 200 | 19,512 | `92a7aca74f04` | yes |
| `/contacts` | 200 | 26,764 | `cd7d12e93052` | yes |
| `/definitely-not-a-real-route-xyz` | **404** | **170** | `bca042b1e8d8` | **zero** |

Eight distinct digests. Content markers confirmed: `/todomvc-advanced` carries "What needs to be
done" ×1, "todoapp" ×2 and a **linked** `<link rel="stylesheet" href="/todomvc-app-css/frameless-advanced.css">`;
`/codex` carries "composer" ×5 and "thread" ×12. **This lane has no absences left.**

### FINDING: the body hash is a BUILD hash, not a COMMIT hash

T013 measured the same commit on the same port and reported `/todomvc-advanced` **5,049 B hash
`d4b1fa42e144`** and `/codex` **5,358 B hash `e33705868cba`**. I get the same 5,049 bytes with a
**different digest**, and 5,356 rather than 5,358 bytes on `/codex`. My own bodies are byte-stable
across repeated fetches within one server (`cmp` identical), so this is not flakiness.

Cause, located: each SSR body embeds one per-build Angular component id inside its hydration
payload — `<script id="ng-state">…{"i":"c2347178594"}` on `/todomvc-advanced` and `"c3645144048"`
on `/codex`. The id is regenerated per build, and **its digit count varies**, which explains both
the equal-length/different-digest case and the 2-byte case. Masking it
(`sed -E 's/"c[0-9]+"/"cID"/g'`) gives stable digests: `a0a94f395a4e` and `016df73fc7c8`.

**Consequence for this board's instrument:** "measure it by body hash, never by HTTP 200" is right
about HTTP 200 and wrong to expect a *reproducible* digest across runs for the angular lane. The
load-bearing evidence is the **404/170 B/zero-`app-root` negative control plus the content markers**,
not digest equality with a predecessor. A future card that treats a digest mismatch here as a
regression will be chasing a build id. The 170 B vs T013's 169 B on the control is the same class
of artefact (trailing newline in a captured file vs command substitution).

---

## 5. `copy-todomvc-css.mjs` and `todomvc-app-css/README.md`

Both said angular "**cannot link the third**" sheet and, in the `.mjs`, that "there is no `S11.ts`
to mount". Both halves false at HEAD: `packages/frameworks/angular/generated/S11.ts` is 10,858 B
and `frameless-advanced.css` is **linked in the body angular actually serves** (measured above).

**The reasoning was corrected and the invariant kept.** The uniform copy never rested on that
argument: the contract is that the six asset roots are derived and byte-identical so that "delete
the copies, re-run, compare digests" stays one check. `const stylesheets = [...]` and every line of
logic in the `.mjs` are **untouched** — the diff there is comment-only.

---

## 6. A SEVENTH population, discovered and DELIBERATELY NOT CORRECTED

The six-lane **ordinal chain** in the demo lanes is stale for exactly the reason this card exists,
and it is a different population from mine.

`scripts/demo.mjs` was corrected by T012 and now reads, authoritatively: seven application rows
carry no `unbuilt` entry in any lane, and **"THE ORDER IS S10, S11, S12, S13, S15, S16, S17"**, with
S13 fourth, S15 fifth, S16 sixth, S17 seventh. The six demo lanes still carry the **pre-correction**
ordinals — "the first one in this corpus that SIX lanes emit", "the SECOND scenario in this corpus
that all six lanes emit and ship, after S13", "the THIRD … after S13 and S15":

```
demos/angular-official/src/app/contacts-page.ts:10
demos/qwik/src/routes/board/index.tsx:5
demos/qwik/src/routes/contacts/index.tsx:5
demos/qwik/src/routes/habits/index.tsx:5
demos/react-official/src/App.jsx:469, :512, :586
demos/solid-official/src/App.jsx:324, :365, :415
demos/svelte-official/src/routes/board/+page.svelte:8
demos/svelte-official/src/routes/contacts/+page.svelte:8
demos/svelte-official/src/routes/habits/+page.svelte:8
demos/vue-official/src/App.vue:347, :400
```

**15 sites across 12 files. Nine are outside `allowed_files`.** Correcting the six that are inside
would half-close a population across lanes — this board's signature failure mode — so none was
touched. Note also that `demos/vue-official/src/App.vue` carries two of them while being the file
T013 ruled "already right at HEAD": T013 read that file and did not treat the ordinal chain as part
of this family, which is the clearest evidence it is a separate population needing its own card.

---

## 7. Verification

| command | result |
|---|---|
| `pnpm check` **START** (T014 edits stashed by explicit path, owner dirt untouched) | **261** `error TS` lines |
| `pnpm check` **END** | **261** — delta **0**, as predicted |
| `pnpm test` | **1 failed / 1412 passed**, 1 failed / 64 passed files — the foreign `package-inventory` ARM B, exactly 1 |
| `pnpm e2e` (run alone, ports 5173-5195 confirmed free first) | **PASS** — "Three-way: 6 demos x 9 scenarios, all observations equal", six per-lane receipts |
| `pnpm lint` | 0 warnings / 0 errors over 558 files (run twice) |
| `pnpm check:citations` | clean over 4 watched docs, 17 watched sources, 610 swept (run twice) |
| derivation over **13 explicit paths**, shell array, **no wildcard** | `git diff --exit-code` rc=**0** and `git status --short` **empty**, before and after e2e |

Derived-path inventory, each asserted to exist and be non-empty **before** the diff:
17/17/17/16/16/17 generated (react/solid/qwik/svelte/vue/angular), 17 goldens,
17/17/17/16/17 emitted, 16 svelte `lib/emitted`. Identical to T013's.

**Negative control on the pathspec itself**: `git ls-files -- "${derived[@]}"` returns **217**
tracked files, so the clean result is a real clean and not the silent under-match T012 reproduced
with `git diff -- 'demos/*/src/emitted'`. Proven twice: after re-running all six `regenerate` steps
and all six `copy-emitted` steps by hand, and again after `pnpm e2e` re-ran them itself.

Owner fingerprints, `shasum -a 256`, sorting whole output LINES — **identical at START and FINISH**:
`f326d314…` `pnpm-lock.yaml` · `aeb7edc1…` `pnpm-workspace.yaml` · `f936e169…` over `website/`,
**116 files**. Never staged, never cleaned, never committed.

Processes: three PIDs started for the angular measurement (**42062** pnpm wrapper, **42077**,
**42264** the node child actually holding 5190) and **all three stopped by recorded PID**. The child
does survive SIGINT to the wrapper alone, exactly as T013 warned. `pkill` never run.
