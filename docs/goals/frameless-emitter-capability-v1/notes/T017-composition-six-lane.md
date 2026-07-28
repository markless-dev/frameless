# T017 — the route ruling, and why neither route reaches six lanes from inside `allowed_files`

Measured at `98bbef2` with **zero source diff**. Every claim below is a run, not a reading.

**THE TASK ASKED ME TO RULE A ROUTE. THE RULING IS: ROUTE 1 IS THE ONLY ROUTE THAT COULD EVER
REACH SIX LANES, AND IT IS BLOCKED OUTSIDE `allowed_files`.** Route 2 — lowering `shared()` and
`handleForwards` in qwik and angular — cannot reach six lanes **even if it succeeds completely**,
and §2 is the measurement that decides it.

## 1. The per-module table reproduced, and it is right as far as it goes

Every one of the five `demos/composition-kit` modules, through `emit()` in all six lanes:

| module | react | solid | qwik | svelte | vue | angular |
|---|---|---|---|---|---|---|
| `frame.tsrx` | emits | emits | emits | emits | emits | emits |
| `dashboard.tsrx` | emits | emits | `shared` | multi-component | multi-component | `shared` |
| `status.tsrx` | emits | emits | `shared` | multi-component | multi-component | `shared` |
| `search.tsrx` | emits | emits | `handleForwards` | multi-component | multi-component | `handleForwards` |
| `page.tsrx` | emits | emits | emits | emits | emits | emits |

And the IR each module actually carries, measured through `buildEnrichedIr`:

| module | components | non-empty records |
|---|---|---|
| `frame` | `Frame` | `bindings=1 aliases=1 stateReads=1` |
| `dashboard` | `Incrementer, Reader, Dashboard` | `events=1 stateReads=2 sharedDefinitions=1 sharedInstances=2 sharedReads=2 sharedCalls=1 sharedWrites=2` |
| `status` | `StatusReader, Status` | `stateReads=1 sharedDefinitions=1 sharedInstances=1 sharedReads=1` |
| `search` | `SearchField, Search` | `bindings=2 events=1 stateReads=1 elementHandleBindings=2 handleForwards=1 behaviors=1 handleCalls=1` |
| `page` | `Page` | *(none)* |

## 2. THE FINDING: `search.tsrx` IS REFUSED BY QWIK **TWICE**, AND THE SECOND REFUSAL IS PERMANENT

The card and T007 §6 both attribute qwik's `search.tsrx` refusal to **`handleForwards`**. That is the
refusal that happens to fire *first*. It is not the only one.

`search.tsrx` carries **`behaviors=1`** — the `attach=` on `SearchField`'s `<input>`. MEASURED: with
`handleForwards` stripped to `[]` and every other record left intact, the qwik emitter refuses again:

> `Qwik emitter does not support element attach behaviors: the only Qwik construct that runs
> application code against a mounted node is the visible-lifecycle family, which this lane bans as
> eager client work, and the ref prop is applied only by the client vnode diff (never by
> dist/server.mjs) so it does not run for resumed markup`

That refusal is **T006's design-envelope ruling**, preserved deliberately by T007, and it is covered by
the owner's standing rule that a framework is not tested outside its design envelope. It is not a
lowering gap and it is not scheduled to close.

**So a complete `handleForwards` lowering still leaves qwik unable to emit `search.tsrx`.** And
`page.tsrx` imports `Search`.

### What that does to Route 2

The five-module set is capped at **THREE** lanes, not six:

| lane | ceiling on the five-module set | why |
|---|---|---|
| react, solid | 5/5 today | — |
| angular | 5/5 **if** `shared()` **and** `handleForwards` land | lowering gap, closable |
| **qwik** | **4/5, permanently** | `behaviors` refused by doctrine |
| **svelte, vue** | **2/5, permanently** | one component per file (T007 §4) |

Route 2 is worth doing on its own merits — it takes angular from 2/5 to 5/5 and qwik from 2/5 to 4/5 —
but **it cannot produce a six-lane comparison on this fixture, so it does not close this task's verify
line.** It was not attempted here, because scoping a two-lane `shared()` + `handleForwards` lowering
is a decision for the PM once the route it was meant to serve is known to be closed.

## 3. Route 1 — the two-module fixture — is the only candidate, and its blockers are runtime, not emitter

`M1-panel` / `M2-page` is one component per module and **all six lanes already emit it**:

```
react   C1..C8 M1-panel.tsx    M2-page.tsx
solid   C1..C8 M1-panel.tsx    M2-page.tsx
qwik    C1-slot M1-panel.tsx   M2-page.tsx
angular C1-slot M1-panel.ts    M2-page.ts
svelte          M1-panel.svelte M2-page.svelte
vue             M1-panel.vue    M2-page.vue
```

The emitters are not the blocker. The **oracle** is. `pnpm e2e`'s composition leg is behavioural:
`runScenario(createXAdapter(...))` in a headless-Chromium vitest browser project, compared with
`compareRuns`. Reaching six lanes needs six lanes that **run**. Measured today:

| requirement | status |
|---|---|
| adapter (`src/adapter.ts`) | react ✅ solid ✅ qwik ✅ — **svelte ✗ vue ✗ angular ✗** |
| `demos/composition-kit` resolves `vue` / `svelte` / `@angular/core` / `@qwik.dev/core` / `@vitejs/plugin-vue` / `@sveltejs/vite-plugin-svelte` | **all six FAIL** (re-measured from its own directory with `import.meta.resolve`) |
| `@angular/core` resolvable anywhere in the repo | **only from `demos/angular-official`** — FAILs from the repo root, from `packages/frameworks/angular`, from `demos/composition-kit` and from `demos/react-official` |
| CLI can load a non-react/solid emitter | **no** — see §4 |

`packages/frameworks/{svelte,vue}/src/**` *is* in `allowed_files`, so their adapters could be written
here; `packages/frameworks/angular/src/**` is too, but **angular has no runtime to write an adapter
against** — `@angular/core` is not a dependency of that package (only `@angular/compiler` is), and
adding it needs its `package.json`, which is not in `allowed_files`, plus an install.

## 4. THE CARD'S "THREE FILES T007 COULD NOT REACH" IS WRONG IN TWO WAYS

**One of the three is already reachable.** `vite.config.ts` — where the composition browser projects
are registered — **is in T017's `allowed_files`**. That blocker is closed by this card's own scope.

**And `packages/cli/src/program.ts` is not sufficient for the CLI.** Extending `TARGET_INVENTORY` does
not make the CLI able to build a non-react/solid target:

1. `importFrameworkTarget` in `packages/cli/src/node-runtime.ts` resolves `packageSpecifier` with
   `createRequire(import.meta.url).resolve(...)` from `packages/cli/src/`. `packages/cli/node_modules/@frameless`
   contains **exactly `compiler`, `react`, `solid`** — measured. Adding the other four needs
   `packages/cli/package.json`, which is **not** in `allowed_files`, plus an install.
2. `emittedFilenameFor` in `program.ts` maps **every** `.tsrx` to `.tsx`, unconditionally and with no
   target parameter. Svelte emits `.svelte`, Vue emits `.vue`, Angular emits `.ts`. So even with
   resolution fixed, three lanes would be written to filenames their own toolchains cannot load.

So the out-of-scope set is at least **five**, not three: `packages/cli/package.json`,
`demos/*-official/**`, `pnpm-lock.yaml`, plus `demos/composition-kit`'s dependency graph and the
missing angular runtime.

`scripts/e2e.mjs` *is* in `allowed_files` and could import the six emitters directly, bypassing the
CLI. That was considered and rejected as pointless: it removes the *emission* blocker, which was never
the binding one, and leaves the runtime and adapter blockers exactly where they are.

## 5. "The same oracle the S-scenarios use" is out of reach for a second reason

The S-scenarios (`s1`–`s9`) are compared by the three-way matrix over `demos/*-official`, whose
`scenarios.box.ts`, `three-way-contract.ts` and `copy-emitted` scripts are all outside
`allowed_files` — and whose `copy-emitted` copies `packages/frameworks/*/generated/`, which is also
outside `allowed_files` (only `generated-composition/**` is in). Composition cannot join that oracle
from here at all.

## 6. WHAT THE FIVE-MODULE SET COVERS THAT `M1`/`M2` DOES NOT

The card asked for this to be stated plainly, so that a narrower comparison is never read as an equal
one. `M2-page` imports `M1-panel`, passes **one string-literal prop**, and projects children. That is
the whole of it.

Present in the five-module set, **absent** from `M1`/`M2`:

- the entire `shared()` family — `sharedDefinitions`, `sharedInstances`, `sharedReads`, `sharedCalls`,
  `sharedWrites` (`dashboard`, `status`)
- `elementHandleBindings`, `handleForwards`, `handleCalls` (`search`)
- `behaviors` / `attach=` (`search`)
- `events` and any state at all — `M1`/`M2` have **no reactivity of any kind**
- a **multi-component module** (3 components in `dashboard`, 2 each in `status` and `search`) and with
  it every `component-reference` whose `target.module === 'self'`
- a module importing **three** sibling modules at once (`page`)
- a non-literal prop across a module boundary — already recorded by T007 as having no fixture

Of the four e2e composition scenarios, only **`composition-kit/slot-rendering`** has an `M1`/`M2`
counterpart. `shared-dashboard`, `status-tier` and `search-focus-cleanup` would have **no six-lane
counterpart whatsoever**. A six-lane comparison on `M1`/`M2` would compare *structural composition
only*: one import, one reference, one static prop, one projection.

## 7. Baselines re-measured at zero diff

| command | result |
|---|---|
| `pnpm test` | **1235 passed / 1 failed (1236)**; the 1 is `packages/compiler/test/package-inventory.test.ts` "ARM B" — foreign, still exactly 1 |
| `pnpm check` | RED at **exactly 73**, list byte-identical |
| `pnpm lint` | 0 warnings, 0 errors over 426 files |
| `pnpm check:citations` | clean; 4 documents, 17 watched, **508** swept (T007 recorded 490 — the sweep count grew with the tree, not a defect) |
| `pnpm e2e` | **PASS**, and prints `composition-kit react=4, solid=4`. **Six lanes not reached, unchanged from T007.** Three-way: 6 demos × 8 scenarios, all equal |
| all three regeneration tiers, then `git diff --exit-code` | **exit 0.** Proved real first: junk into `generated-composition/M2-page` in all six lanes, restored by the six tier-2 scripts. Tier count **6 / 6 / 0** confirmed |
| `git status --short` | exactly the three foreign entries; `HEAD` unchanged at `98bbef2`; nothing committed |

No repo file was modified by this task except this note.
