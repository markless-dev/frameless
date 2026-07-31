# T007 — the globals hole, closed in both emitters with one two-name allowlist

Board: `docs/goals/frameless-app-fidelity-v1/state.yaml`. HEAD at start `c6568b6`.

Ruling landed: `frameless-app-fidelity-v1` T003 — **admit exactly `Promise` and
`setTimeout`**. Refuse `Date`, `JSON`, `Math`, `console`, `fetch`, `localStorage`,
`document`, `window`.

---

## The five predictions, stated before code and then measured

Written down before a line was edited, and every one is answered here.

| # | Prediction | Result |
| - | ---------- | ------ |
| P1 | Angular S11 and S12 both EMIT, no second refusal behind the first | **CONFIRMED, exactly.** S11 10,858 bytes, S12 10,086 — the byte counts T003 predicted |
| P2 | The lane's typecheck oracle reports **0 unexpected** diagnostics | **CONFIRMED.** S11+S12 alone: 2 diagnostics, both `TS2307 Cannot find module '@angular/core'`, 0 unexpected. Whole lane, all 17: 17 diagnostics, 0 unexpected |
| P3 | The gate reports `NOVEL: []` and the floor does not move | **CONFIRMED.** `collectEmittedForms` novel over S11+S12 `[]`, novel over the whole lane `[]`, `ANGULAR_BASELINE_FLOOR` 19.0 → 19.0, `parseTemplate` 0 errors on both new inline templates |
| P4 | `pnpm check` delta 0 by construction | **CONFIRMED.** START 251, END 251 |
| P5 | `pnpm e2e` stays 6 × 9 | **CONFIRMED.** `Three-way: 6 demos x 9 scenarios, all observations equal` |

P2 was measured with the lane's **own** compiler options read off
`emitted-typecheck.test.ts` (`strict: false`, `experimentalDecorators: true`,
`types: []`). A first pass used guessed options and reported 158 unexpected
diagnostics — all `TS7006`, all an artefact of the wrong `strict` flag. Recorded
because the wrong number is the one a careless reading produces.

---

## T003's SIXTH prediction was the one that was wrong, and only a browser found it

> "the obvious objection to a shim — unbound `setTimeout` throwing `Illegal
> invocation` — IS REFUTED IN REAL CHROMIUM: unbound `setTimeout`, unbound
> `fetch` and a strict-mode module-scope shim all returned OK. **No `.bind()`
> needed.**"

**The measurement was right and the conclusion was wrong, because it tested the
wrong call shape.**

A `<script setup>` binding is not read as a bare identifier in the emitted render
function. In **non-inline mode — which is what `@vitejs/plugin-vue` uses** — the
template compiler emits `$setup.setTimeout(...)`. That is a **method call**, so
the receiver is the setup-state object rather than the window, Web IDL checks it,
and it throws.

Measured on the served demo, first drive after the shim landed:

```
FAIL [vue] S11 optimistic toggle ADVANCES :: sync-note idle -> saving -> saving
FAIL [vue] S11 remote search ADVANCES     :: remote-status idle -> searching -> searching, hits=0
FAIL [vue] S12 streamed answer            :: 0 distinct chunk texts
PASS [vue] S11 NO _ctx runtime error      :: 0 of 2 page errors mention _ctx
     [vue] all errors: ["TypeError: Illegal invocation", "TypeError: Illegal invocation"]
```

`_ctx` was gone and the page was still dead. Stack, off the module Vite served:

```
TypeError: Illegal invocation
    at ... TodoMvcAdvanced.vue:362:17
    at new Promise (<anonymous>)
```

```js
await new $setup.Promise((settle) => {
  $setup.setTimeout(() => settle(true), 600);   // <- Illegal invocation
});
```

**This is exactly the trap the card names.** A grep for `_ctx` — even the correct
one, off `compileTemplate` with `bindingMetadata` — reported **zero hits on
output that does not work.** T003's own `missing_evidence` predicted it: "the vue
shim was proven AT THE COMPILER LEVEL but NOT end-to-end through
`@vitejs/plugin-vue` in the served demo. THAT IS THE LOAD-BEARING STEP."

### Eight arms in chromium settle the repair

| arm | expression | result |
| --- | ---------- | ------ |
| A | `new ({P: globalThis.Promise}).P(fn)` | **OK** — `new` has no receiver to check |
| B | `({s: globalThis.setTimeout}).s(fn,0)` | **THREW `Illegal invocation`** — the defect, reproduced in one line |
| C | `({s: globalThis.setTimeout.bind(globalThis)}).s(fn,0)` | **OK**, returns a timer id |
| D | `new (globalThis.Promise.bind(globalThis))(fn)` | **OK** |
| E | `globalThis.Promise.bind(globalThis).resolve` | **`undefined`** |
| F | `globalThis.Promise.resolve` | `function` |
| G | `new (bound Promise)(fn) instanceof Promise` | **true** |
| H | bound `setTimeout` + bound `clearTimeout` round trip | **OK** |

So **every shim is `globalThis.X.bind(globalThis)`, uniformly.** Binding only the
names that need it would be a discriminating predicate over what each body does
with each global — the shape Ruling 3a refused in the Angular lane — and it would
be re-derived wrongly the first time a third name arrived.

**E is the cost, and it is refused rather than left to bite.** A bound function
drops its target's static properties, so a shimmed global is a **callable, not a
namespace**. `assertNamesResolve` therefore throws on any member read of an
allowlisted global:

> Vue emitter cannot read the member "now" off the allowlisted global "Promise"
> in the click handler event:0: the global is reached through a bound
> `<script setup>` shim, and a bound function does not carry its target's static
> properties, so the read would be undefined at runtime. The emitter refuses
> rather than emitting it

The corpus has zero such reads. The day one arrives it is a loud refusal.

---

## The driven browser, which is the only thing that closed this

Both lanes, at HEAD after the change, real chromium at 1440×1000, handlers fired
with a real mouse.

```
PASS [vue]     S11 optimistic toggle ADVANCES :: sync-note idle -> saving -> saved
PASS [vue]     S11 remote search ADVANCES     :: remote-status idle -> searching -> done, hits=1
PASS [vue]     S11 NO _ctx runtime error      :: 0 page errors
PASS [vue]     S12 streamed answer ADVANCES THROUGH THREE CHUNKS
                 :: status idle -> streaming -> idle; 3 distinct chunk texts, lengths 34,63,89
PASS [vue]     S12 NO _ctx runtime error      :: 0 page errors
PASS [angular] S11 optimistic toggle ADVANCES :: sync-note idle -> saving -> saved
PASS [angular] S11 remote search ADVANCES     :: remote-status idle -> searching -> done, hits=1
PASS [angular] S12 streamed answer ADVANCES THROUGH THREE CHUNKS
                 :: 3 distinct chunk texts, lengths 34,63,89
SUMMARY 10/10 passed
```

The stream assertion is that the answer text **grows** — 34 → 63 → 89 characters,
three distinct readings ending on the fixture's full sentence — not that an
answer appeared. A single-shot append would report one reading and fail.

### Negative control, driven, three arms plus a restore

The emitted SFC was rewritten in place, driven, and restored.

| arm | emission | `sync-note` after click | page errors |
| --- | -------- | ----------------------- | ----------- |
| 0 | AT HEAD, bound shim | **saved** | none |
| 1 | PRE-FIX, no shim at all | stuck at **saving** | **`_ctx.Promise is not a constructor`** |
| 2 | INTERMEDIATE, unbound shim | stuck at **saving** | **`Illegal invocation`** |
| 3 | RESTORED | **saved** | none |

`de9fb3336a84` before, `de9fb3336a84` after, byte-identical. Both mutations were
guarded — a replacement that left the source unchanged aborts.

**Both broken arms hang at `saving`, not at `idle`**, because the write happens
before the `new Promise` that throws. A page that is completely dead still shows
the first step of the interaction. That is precisely why a mount is not the
proof.

### In-repo, permanent

`packages/frameworks/vue/test/compile-emitted.test.ts` now compiles every emitted
SFC through `compileTemplate` **with `bindingMetadata`** and asserts zero `_ctx.`
member reads, with a calibration that deletes the shim consts and requires
`['_ctx.Promise','_ctx.setTimeout']` to come straight back. The same row also
asserts the emitted `.vue` **contains no `_ctx` at all** — the reading that proves
a source-grep is worthless.

---

## Oracle Part 1 — against the reference, never against another lane

### S11 vs todomvc.com — MET

Reference **captured rendered** at 1440×1000 (108,093-byte screenshot) and
**driven**: three todos typed in, the first toggled, so the comparison is not made
on an empty app.

| feature | reference | ours (each lane measured separately) |
| ------- | --------- | ------------------------------------ |
| header `h1` | `todos` | `todos` — MATCH |
| new-todo placeholder | `What needs to be done?` | identical — MATCH |
| toggle-all | present | present — MATCH |
| filters | `All`, `Active`, `Completed` | same, same order — MATCH |
| filter hrefs | `#/`, `#/active`, `#/completed` | identical — MATCH |
| clear-completed | present | present — MATCH |
| row height | 60px | 60px — **EXACT** |
| toggle box | 40×40 | 40×40 — **EXACT** |
| completed row class | `completed` | `completed` — MATCH |
| per-row controls | toggle, destroy | toggle, **todo-title**, destroy |
| counter text | **`2 items left!`** | **`2 items left`** — **DIVERGES** |

Two measured gaps, neither closable inside this card's `allowed_files`:

1. **The counter is missing the reference's exclamation mark.** `2 items left!`
   there, `2 items left` here.
2. **The row title is a `<label>` on the reference and a `.todo-title` element
   here.** `document.querySelector('.todo-list li label')` is `null` on ours.

Both live in `packages/compiler/test/fixtures/s11-todomvc-advanced.tsrx`, which is
not in this card's write scope. Recorded, not fixed.

Beyond the reference and by design — S11 is a declared strict superset — ours adds
3 pending affordances, 1 search input and 3 status regions. The reference has none
of the three (`hasPendingAffordance: false`, `hasSearch: false`,
`hasSyncNote: false`).

### S12 vs the Codex UI — PARTIAL, and the reason is measured

Reference named: `https://chatgpt.com/codex`. **First two attempts returned HTTP
403 with an empty body**; with a real browser user agent both it and
`https://openai.com/codex/` return **200**, so the 403 was user-agent blocking and
not authentication — recording the wrong reason here would have been the easy
error.

Captured **rendered** at 1440×1000: **374,278-byte screenshot**. But the public
surface is a **marketing page**, not the running product: `h1`s are "Choose a
ChatGPT plan to get started" and "What builders are saying". The live app is
behind a login this card has no authority to create.

What the reference page's own image alt text names, against what ours renders:

| reference alt text | ours |
| ------------------ | ---- |
| "inbox panel" | sidebar, 4 thread entries + **New chat** — present |
| "engineering task with progress details" | composer status `idle` → `streaming` — present |
| "changed-files review panel" | right pane tabs **Details / Files** — present |
| "supporting panels" | bottom pane tabs **Terminal / Diff** — present |

**Oracle Part 1 for S12 is therefore PARTIAL and is flagged for T999.** Cross-lane
agreement was **not** offered in its place, and the two lanes' identical readings
are recorded as data, never as fidelity evidence.

---

## The empty-list trap

Deleting both rows leaves `ANGULAR_UNBUILT_SCENARIOS` as `[]`, and four suites
iterate it. Three things now carry what the loop no longer can:

1. `expect(ANGULAR_UNBUILT_SCENARIOS).toEqual([])` — the emptiness is a **literal
   expectation**, not an unwatched default. The old guard was
   `expect(length).toBeGreaterThan(0)`, which would now FAIL rather than go
   quiet; deleting it alone would have left four suites asserting nothing.
2. A new row drives both formerly-refused goldens through the real `emit()` and
   requires them to **succeed** and to be on disk. Without it, "the list is
   empty" and "nobody ever populated the list" are the same green.
3. **The surviving negative control, proved still red-capable**: the `Math` row in
   `emitter.test.ts` still throws `cannot resolve the identifier "Math"`. Four
   more were added on the Vue side — `Date`, `JSON`, `Math` and `console` are each
   refused **even though `@vue/shared`'s `GLOBALS_ALLOWED` accepts all four**,
   which is the asymmetry the whole ruling exists to remove.

The loop itself is kept, not deleted, so the next refusal is a one-row edit.

---

## Derivation proof, with a shell ARRAY

zsh does not word-split; an unquoted `$PATHS` made T001's first attempt
vacuously true.

```
N=8
PRESENT BEFORE            = 8
PRESENT AFTER DELETE      = 0     <- ASSERTED BEFORE ANY REBUILD
REBUILT PRESENT           = 8 of 8
DERIVATION PROOF: 8 -> 0 asserted -> 8 REBUILT BYTE-IDENTICAL
```

`shasum -a 256`, whole lines, `LC_ALL=C sort`. The generated and copied artifacts
hash pairwise equal, which is the copy step proved rather than assumed:

```
3c7f39d1…  demos/angular-official/src/emitted/TodoMvcAdvanced.ts
3c7f39d1…  packages/frameworks/angular/generated/S11.ts
917e1f24…  demos/vue-official/src/emitted/CodexClone.vue
917e1f24…  packages/frameworks/vue/generated/S12.vue
de9fb333…  demos/vue-official/src/emitted/TodoMvcAdvanced.vue
de9fb333…  packages/frameworks/vue/generated/S11.vue
e9ef0720…  demos/angular-official/src/emitted/CodexClone.ts
e9ef0720…  packages/frameworks/angular/generated/S12.ts
```

---

## Serving proof — body hashes, never HTTP 200

| lane | path | status | body sha256/12 | emitted markers |
| ---- | ---- | ------ | -------------- | --------------- |
| angular | `/todomvc-advanced` | 200 | `7eab74b98b38` | `frameless-todo-mvc-advanced`, `todo-list`, `remote-status` |
| angular | `/codex` | 200 | `e8de62d5e800` | `frameless-codex-clone`, `composer`, `composer-status` |
| angular | `/hn` | 200 | `6961c0206598` | — |
| angular | bogus path | 404 | `511badbdebf9` | — |
| vue | `/todomvc-advanced` | 200 | `74f48d7b4c50` | `todo-list`, `remote-status` |
| vue | `/codex` | 200 | `331eb3614d2c` | `composer`, `composer-status` |
| vue | `/hn` | 200 | `cabd2fb67e78` | — |
| vue | bogus path | **200** | `a3e791c7f8f6` | — |

All eight bodies distinct. Vue answers **200 for a path that does not exist**,
exactly as the board warned — the hash and the marker set are what separate the
real pages from it.

Angular's AOT build is green with the two new routes: **17 static routes
prerendered**, up from 15. That closes T003's `missing_evidence` — AOT was never
run on the candidate S11/S12 because the package deliberately has no
`@angular/core`.

---

## Everything else

- `pnpm check`: **START 251 → END 251.** Predicted 0 by construction; the angular
  and vue tsconfigs do not include `generated/**`. Nothing to attribute.
- `pnpm test`: **1 failed / 1410 passed** — exactly `ARM B: every shared consumer
  resolves to its recorded peer-suffix key`, the foreign package-inventory row.
- `pnpm e2e`: `6 demos x 9 scenarios, all observations equal`.
- `pnpm lint`: 0 warnings, 0 errors over 558 files.
- `pnpm check:citations`: clean.
- Owner paths, `shasum -a 256`, relative, whole lines, START **and** FINISH:
  `f326d314` / `aeb7edc1` / `f936e169`, website 116 files. Identical. The three
  dirty paths were **not touched** and not committed.
- Foreign PIDs **64413** (5175) and **24931** (5178) confirmed alive at exit. Two
  further foreign listeners were seen and left alone: 31456 on 5180 and 51893 on
  4173. `pkill` never run — the two demos this card booted were on 5191 and 5192
  and were stopped by recorded PID.

---

## Open, and for a successor

1. **`scripts/demo.mjs` STILL REPORTS THE ANGULAR LANE AS REFUSING S11 AND S12.**
   Line 291 carries `unbuilt: { S11: ANGULAR_REFUSAL, S12: ANGULAR_REFUSAL }` and
   line 146 defines `ANGULAR_REFUSAL = 'emitter refuses: cannot name the global
   \`Promise\`'`. `routeFor` returns `null` for an unbuilt scenario, so **the front
   door will not print `/todomvc-advanced` or `/codex` for angular**, will print a
   refusal that is now false, and will drop both from the derived "all six lanes
   serve" count. **This is executable, not prose**, and the file is outside this
   card's `allowed_files`. It is a one-line deletion plus a comment.
2. `demos/vue-official/src/App.vue` carries three now-false blocks stating that
   S11 and S12 throw `_ctx.Promise is not a constructor` here. Outside
   `allowed_files`.
3. The S11/S12 fixture headers in `packages/compiler/test/fixtures/` state the
   angular refusal and the vue `GLOBALS_ALLOWED` gap as live. Outside
   `allowed_files`.
4. **S11 fidelity gaps**, both in the fixture: the counter is missing the
   reference's `!`, and the row title is not a `<label>`.
5. **Oracle Part 1 for S12 is PARTIAL** — the reference's live UI is behind a
   login. Needs an owner decision, not a worker's.
6. Inherited and still open: `hn.css`'s stale Angular claim, the shared-sheet
   cascade sweep, the HN domain `<span>` vs anchor, and the seventeen
   destination-less stubs.
