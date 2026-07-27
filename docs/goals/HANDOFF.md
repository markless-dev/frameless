# Handoff — 2026-07-27, end of session

**Nothing is running.** Every dispatched agent has returned. All four boards are idle.

## Boards and their exact next task

| Board | `active_task` | What it is |
|---|---|---|
| `frameless-angular-v1` | **T004** (queued) | **CRITICAL PATH.** Stand up `demos/angular-official`, add the SIXTH e2e row. Serialization hold is CLEAR — Vue T004 landed the shared contract edits. |
| `frameless-vue-v1` | **T005** (active) | Judge. Re-run the six idiom gates on Vue's flagship sugar now a lane exists. Worked example 2 (`v-bind:`/`v-on:` shorthands) is the designated question. |
| `frameless-svelte-v1` | **T999** (active) | Re-audit. T011 landed after the last audit; the board has NOT been re-certified since. |
| `frameless-defects-and-targets-v1` | **T999** (active) | Umbrella. Also carries queued T013/T014 (adapter rollups) and **Phase F** T024–T028 (corpus breadth, 3 scenarios → 12). |

## State as of HEAD

- `pnpm e2e` green with **FIVE** rows (react, solid, qwik, svelte, vue), all observations equal
- `pnpm test` 850 tests / 49 files; `pnpm test:browser` react 60, solid 49, svelte 13, vue 18
- `pnpm lint` 0/0 on 312 files; `pnpm check` six tsc passes
- Last commit `d9dd70b`. Everything committed locally, **nothing pushed**.

## Angular T004 — what it must carry in

Read the **T003 receipt** on that board first. Two things matter:

1. **R1, deliberately unmeasured.** The IR declares `value`/`checked` as **property** bindings, so the emitter spells `[value]`/`[checked]`. Whether Angular's SSR writes those into the served `value="…"` **attribute** the other five lanes emit **cannot be decided from a golden**. S3's `text` observation reads the SERVED PAYLOAD under Option D, so this is load-bearing. **Do NOT "fix" it to `[attr.value]` without a browser measurement** — that is the exact inference error the Option D chain made four times.
2. **The build story.** `@angular/build` vendors `vite 7.3.6` as an EXACT dependency, so the root catalog cannot reach that lane even in principle. T002 ruled this acceptable but requires T004 to ship an **asserted toolchain fact**: read the resolved vendored vite version and assert it against a recorded literal, so it goes red on drift.

Also owed by Angular T004, all ruled and recorded on the board: `withIncrementalHydration()` stays OFF; the post-activation signal (`afterNextRender` vs `ApplicationRef.isStable` under zoneless) is a **measurement obligation with two-sided calibration** — raising a timeout is forbidden; the dev-warning sink installs at the top of `src/main.ts` before `bootstrapApplication` (NG0912/NG0913 are `console.warn`, which witness 0.7.0 cannot see).

## Standing rules that have repeatedly paid off

1. **Measure, never inherit.** A measurement is valid for the framework it was taken on and nowhere else. This session: the Option D lane attribution was wrong three times in a row (`no lane` → `Solid only` → `Solid+React` → finally **React only**, measured), and the Angular lane refuted the Vue lane's whitespace result an hour after it landed.
2. **Every instrument asserts its own preconditions**, and a mutation that does not mutate is not a mutation. Vue T004 caught its own invalid negative arm this way (ESM hoists static imports).
3. **An instrument that establishes a SET or issues a VERDICT must be calibrated against a known member.**
4. A finding that reproduces on a stock official scaffold with none of our code is evidence the **test** is unfair, not that the framework is broken. Never test a framework outside its design envelope.

## Two PM defects from this session, do not repeat

- A card was shipped with `allowed_files: []` and `verify: []` (Vue T004). A card with empty `allowed_files` enforces nothing.
- Board YAML was edited by chaining asserts with a single write at the end, so a late failure silently dropped earlier edits — and one script appended text into the wrong `signal` field. **Edit board YAML one change per write, and re-parse after each.**

## Filed upward, not on any board

`packages/frameworks/qwik/src/gate/index.ts:64` silently drops `qwik/loader-location` and `qwik/no-await-navigate-in-use-task` from `configs.recommended` with **no recorded reason** — the exact failure the omission-list discipline exists to prevent, live in a shipped gate.
