# T004 — demos/angular-official, the sixth e2e lane

`pnpm e2e` is green with **six** rows and all S1/S2/S3 observations byte-identical.
This note carries the evidence for the five measurement obligations, the mechanical
provenance diff against the pristine scaffold, the negative arms that were actually
run, and two findings the lane produced that nobody asked for.

---

## 0. The headline

```
[e2e] three-way matrix (one IR -> 6 emitters):
  s1 angular hydrate server-rendered derived = kit:2 | after one increment click derived = kit:4 | 1 document request served this page | no console errors and no failed requests
  s2 angular hydrate server-rendered rows a,b with complete = 1/2 | after reorder rows are b,a and complete is still 1/2 | after removing b only a remains and complete = 0/1 | after clear the empty branch renders and complete = 0/0 | 1 document request served this page | no console errors and no failed requests
  s3 angular hydrate server-rendered text = hello with writes = 0 | after submit writes = 2 | after cancel-submit 1 document request served this page and writes = 2 | after conditional clicks guarded details reads open=null and unguarded details reads open="" | 1 document request served this page | no console errors and no failed requests

Three-way: 6 demos x 3 scenarios, all observations equal
```

No existing assertion was weakened. `servedClientEntry` and `expectedNavigations`
remain **total** `Readonly<Record<…>>` tables of exact literals; the Angular row was
added to each, not around them. React's, Solid's, Qwik's, Svelte's and Vue's entries
are byte-unchanged.

---

## 1. R1 — property vs attribute binding. **RESOLVED. NO DIVERGENCE. NOTHING WAS CHANGED.**

T003 carried this forward as the lane's one unmeasured, load-bearing risk: the IR
declares `value` and `checked` as PROPERTY bindings, so the emitter spells
`[value]`/`[checked]`, and S3's `text` observation reads the SERVED PAYLOAD.

**Measured, in the bytes Angular's own SSR produced**, `dist/angular-official/browser/s3/index.html`:

```html
<form data-scenario="s3" jsaction="click:;"><input data-action="text" value="hello" jsaction="input:;"><input type="checkbox" data-action="checked" jsaction="change:;">…
```

and S2, which exercises `[checked]` in both states, `.../s2/index.html`:

```html
<li data-oracle-row-key="a"><input value="one" data-edit="a" …><input type="checkbox" data-toggle="a" …>
<li data-oracle-row-key="b"><input value="two" data-edit="b" …><input type="checkbox" checked="" data-toggle="b" …>
```

- `[value]="text"` → `value="hello"` in the served attribute. Identical to the other five lanes.
- `[checked]` → the `checked` attribute present when true (row b), absent when false (row a).
  Correct HTML, and not asserted by the contract anyway.

`[value]`/`[checked]` were **NOT** changed to `[attr.value]`/`[attr.checked]`. The
inference that they needed to be — the one the Option D chain made four times — was
wrong here too. `measureServedAttribute` then asserts `value="hello"` exactly, on
Angular's own bytes, with both of its negative arms running on every call.

---

## 2. M2 — the `servedClientEntry` literal

`angular: '<script src="main.js" type="module"></script>'`

Read out of the payload `demos/angular-official` actually serves, once per scenario:

```
$ cd demos/angular-official/dist/angular-official/browser
$ for f in index.html s2/index.html s3/index.html; do grep -o '<script src="main.js" type="module"></script>' $f | wc -l; done
1
1
1
```

`calibrateServedClientEntry` is called on **every** scenario, so its two-sided arm
(delete every occurrence from the payload the server really sent; the same predicate
must reject it) runs three times per run.

**The literal is a property of the configuration the lane builds, and that is
declared rather than hidden.** `ng build --configuration development` leaves
`outputHashing` at its default `none`. The scaffold's `production` configuration
sets `outputHashing: "all"`, and the production build — run as the T004 verify
command `pnpm --dir demos/angular-official build` — emits `main-NVHO6WIY.js`
instead. There is therefore **no stable exact substring under the production
configuration**, which is exactly why the lane declares its own `build:e2e` script.
The claim was NOT relaxed to "any module script"; the contract's own comment rules
that out in those words, and it still does.

---

## 3. M3 — `expectedNavigations`. **0, and the flip was measured.**

This is the entry on that table that was least predictable. Angular is the only
hydrating lane in the repo that ships a *real router* — `provideRouter` is in the
scaffold, and all three scenarios are behind real routes in `app.routes.ts` — and it
still records **0**. Angular's initial navigation adopts the existing history entry
without writing a new one; SvelteKit's `kit.start` and Qwik's router both write one,
which is why those two record 1.

Two-sided, both arms run:

| declared | result |
|---|---|
| `angular: 1` | RED — `navigations: expected 1, observed 0` |
| `angular: 0` | green |

Never relaxed to "any number".

---

## 4. M4 — the post-activation signal. **`ApplicationRef.isStable`, chosen from data, and now asserted.**

Both candidates were instrumented **simultaneously** in the root component, each
stamping the time it fired and whether the routed scenario was in the DOM yet, and
the lane was run once with both live:

| page | `afterNextRender` | `ApplicationRef.isStable` |
|---|---|---|
| `/` (hydrating) | t=51 scenario **present** | t=62 scenario present |
| `/` with `ng-state` deleted (client render) | t=55 scenario **ABSENT** | t=62 scenario present |

Raw, off `<html>` in the witness snapshot for the client-render page:

```
data-m4-afternextrender="t=55;scenario=absent;action=absent"
data-m4-isstable="t=62;scenario=present;action=present"
```

The second row is the whole answer. When Angular cannot hydrate and must render on
the client, the ROOT component's `afterNextRender` runs after the first render pass —
the pass that renders `<router-outlet>` and nothing inside it, because the router's
initial navigation has not resolved. `isStable` is `PendingTasks`-driven and the
router's navigation is a pending task, so it cannot go true before the routed
component exists.

**Two-sided calibration, run:** with the marker moved to `afterNextRender` the lane
goes RED:

```
The activation marker for /?frameless-calibration=hydration-state-deleted was written with
scenario-absent: Angular reported the application settled while the routed scenario was not yet
in the DOM…
```

**And the choice is now a checked property, not a note about one afternoon.**
`src/app/app.ts` writes `data-frameless-activated-with` (`scenario-present` |
`scenario-absent`) immediately *before* the marker, and
`assertMarkerFollowedTheScenario` requires `scenario-present` on every page the lane
opens — the three scenarios and the calibration page. A future Angular that moves
`isStable` earlier fails the lane naming the ordering.

**No timeout was raised, and there is none in this lane to raise.** The marker is set
by an Angular signal; the only permitted repair is a stronger signal.

---

## 5. M5 — the asserted toolchain fact

`packages/frameworks/angular/test/toolchain.test.ts`, 7 tests, runs under `pnpm test`
via the node project's existing `packages/frameworks/*/test/**` glob. It imports
nothing from Angular — it resolves `package.json` files off disk — so the node-only
property of that package is intact.

Asserted, each read where it resolves rather than where it is declared:

| fact | value |
|---|---|
| `@angular/build` `dependencies.vite`, and that it carries no range characters | `7.3.6` |
| the Vite `@angular/build`'s **own** `require` resolves | `7.3.6` |
| the Vite the workspace root resolves | `8.0.16`, and asserted **different** |
| `@angular/build` / `cli` / `core` / `ssr` | `22.0.8` |
| TypeScript at the root vs at the demo (T003a's ASSERT-DO-NOT-PIN) | `5.9.3` vs `6.0.3` |

Plus two calibration arms: a wrong expected version must throw, and a package that is
not installed must throw rather than reading as absent — the vacuity guard, because
every check in the file is an equality against a literal and the failure mode of that
shape is a reader that quietly stops returning a real value.

---

## 6. Provenance — mechanical per-file diff against the pristine scaffold

Scaffolded outside the workspace with

```
npx -y @angular/cli@22.0.8 new angular-official --ssr --style=css --skip-install --skip-git \
  --ai-config none --package-manager pnpm --defaults
```

and hashed before anything was touched. Diff of the demo against that tree
(excluding `dist/`, `.angular/`, `.witness/`, `node_modules/`):

**17 BYTE-IDENTICAL** — `.editorconfig`, `.prettierrc`, `.vscode/*` (3),
`README.md`, **`angular.json`**, `public/favicon.ico`,
`src/app/app.config.server.ts`, `src/app/app.css`, `src/app/app.routes.server.ts`,
**`src/index.html`**, **`src/main.server.ts`**, **`src/server.ts`**,
`src/styles.css`, `tsconfig.json`, `tsconfig.spec.json`.

The bolded ones are the point: **the entire build configuration, the SSR entry, the
server, the index template and the server route config are untouched.** Nothing in
this repo renders Angular or builds Angular.

**8 MODIFIED**

| file | delta | why |
|---|---|---|
| `package.json` | name → `@frameless/demo-angular-official`; added `copy-emitted` and `build:e2e`; `build`/`start` prefixed with `copy-emitted`; `@types/node` → `catalog:` | workspace identity, the shared emitted-output refresh every lane has, and one `@types/node` copy instead of two. Dependency versions are otherwise the scaffold's own. |
| `.gitignore` | `+ .witness/` | receipts, as all five incumbent lanes do |
| `tsconfig.app.json` | `+ "noImplicitAny": false` | see §7 — this is the one that needed a measurement |
| `src/main.ts` | `+ import './dev-sink'` at the top | required by T002 ruling 4 |
| `src/app/app.ts` | template → `<router-outlet />`, class sets the activation marker | M4 |
| `src/app/app.html` | → `<router-outlet />` | the scaffold's 20 kB welcome page is demo content |
| `src/app/app.routes.ts` | three routes | wiring the emitted components |
| `src/app/app.config.ts` | `+ withComponentInputBinding()` | lets routes hand the emitted components their props without three wrapper components. The ONLY provider added. `provideClientHydration()` is the scaffold's own and **`withIncrementalHydration()` is NOT enabled** — ruled off by T002. |

**1 DROPPED** — `src/app/app.spec.ts`, which asserts `Hello, angular-official` from
the welcome page that was replaced. Same class Vue T004 dropped: template demo
content. `ng test` is not run by any lane.

**6 ADDED** — `scenarios.box.ts`, `src/dev-sink.ts`,
`src/app/scenario-props.ts`, and the three `src/emitted/*.ts` that `copy-emitted`
writes.

---

## 7. FINDING — the first real `ng build` over emitted Angular output

T003 shipped its goldens deliberately without any Angular type checker having seen
them. This is that check, and the result is worth recording precisely because it is
narrow.

With the scaffold **completely untouched**, `ng build` reports **exactly six
diagnostics, all TS7006, all in `src/emitted/KeyedTodo.ts`**:

```
TS7006: Parameter 'todo' implicitly has an 'any' type.   x3
TS7006: Parameter 'item' implicitly has an 'any' type.   x3
```

Every one is a lambda parameter inside a transplanted handler body —
`(todo) => todo.done`, `(item) => item.id === todo.id`, and so on. **Zero template
diagnostics. Zero AOT diagnostics. Zero diagnostics in the demo's own hand-written
files.** All 15 lowered `(click)="onH7Click(todo, $event)"` call sites type-check,
every `@for` `track` expression validates, and the whole corpus compiles ahead of
time — including under the `production` configuration with the optimizer on, which
the `pnpm --dir demos/angular-official build` verify command runs.

Angular 22 scaffolds no longer spell `"strict": true`; TypeScript 6.0.3 defaults it
on, and that is what enables `noImplicitAny`.

**This was classified as the known IR-8 gap, not as an emitter defect, and the
emitter was not touched.** The repo already ruled this exact class, in code:
`packages/frameworks/react/test/emitted-typecheck.test.ts:14-16` type-checks emitted
output with `strict: false` and records the reason verbatim as "deliberate scope, not
laxity", citing `docs/goals/frameless-testing-ci-v1/notes/T005-emitted-typecheck.md`.
The solid, svelte and vue lanes do the same. So `tsconfig.app.json` sets
`noImplicitAny: false` — and nothing else. `strictNullChecks` and the rest of the
`strict` family stay on, and Angular's `strictTemplates` keys off TypeScript's
`strict` rather than off `noImplicitAny`, so the template coverage T001 and T002 said
Angular adds over the other lanes is fully intact.

The relaxation is **provably consumed entirely by emitted output**: the measurement
above is the proof, since every suppressed diagnostic is in `src/emitted/`.

Narrower alternatives do not exist. TypeScript has no per-directory
`compilerOptions`, and editing the copied output under `src/emitted/` would mean
editing the artifact under test.

**Routing note:** this is the *fourth* independent re-derivation of IR-8 (Vue scout,
Angular scout, Vue judge, and now a real `ng build`). T002 ruling 5 already said
"route to a shared board; do not re-derive a fourth time." This one is a
*measurement* rather than a re-derivation, and it is the first evidence of the gap
from a compiler rather than from reading a golden — but the conclusion is unchanged
and it belongs on the shared IR-8 board, not here.

---

## 8. FINDING — `@angular/platform-server` cannot share a process with the browser driver

The first shape tried was the Vue lane's: import the built server bundle and mount
its `reqHandler` as connect middleware inside the witness dev server. It renders
correctly, and then kills the run:

```
uncaughtException TypeError [ERR_INVALID_ARG_TYPE]: The "event" argument must be an
instance of Event. Received an instance of Event
    at WebSocket.dispatchEvent (node:internal/event_target:771:13)
```

**Measured, at `@angular/platform-server` 22.0.8** — the *first SSR render*, not the
import, replaces two process globals:

```
Event         same after import: true    same after render: FALSE
CustomEvent   same after import: true    same after render: FALSE
WebSocket     same after import: true    same after render: true
EventTarget   same after import: true    same after render: true
```

`WebSocket` and `EventTarget` are left alone, so Node's undici `WebSocket` — which is
how `@async/witness` talks CDP to Chromium — starts rejecting its own events against
a foreign `Event` constructor, and the browser connection dies mid-run.

Nothing here is Angular misbehaving. `platform-server` is designed to own the process
it renders in, and this lane was asking it to share one with a browser driver. It is
recorded because it is not discoverable from any document and because the symptom
("Received an instance of Event") is maximally unhelpful.

**So the Angular server runs in its own process**, started exactly the way the
scaffold starts it — `node dist/angular-official/server/server.mjs`, which is what
`pnpm --dir demos/angular-official serve:ssr:angular-official` runs, taking its port
from `PORT` through the scaffold's own `src/server.ts` — and the witness dev server
proxies to it verbatim (method, path, headers including the original `Host`, body).

That also discharges T002 ruling 1 **structurally**: `@angular/build`'s vendored Vite
7.3.6 and the workspace's Vite 8.0.16 never share a process at all.

### 8a. `security.allowedHosts: []` means the built server rejects everything

The scaffold ships `"security": { "allowedHosts": [] }` in `angular.json`. Measured
on the pristine build: the built server answers **400** to `localhost`, to
`127.0.0.1` and to an arbitrary host alike — static assets pass, because those are
`express.static`, but every rendered route is refused.

That is the scaffold behaving as designed; the list names the origin the app is
served from and a deployment fills it in. The lane uses Angular's own documented
runtime configuration point — `NG_ALLOWED_HOSTS`, read by `AngularNodeAppEngine`'s
constructor via `getAllowedHostsFromEnv()` (`@angular/ssr` 22.0.8
`fesm2022/node.mjs:10` and `:286`) — set on the child process's environment. **`angular.json`
is byte-identical to the scaffold.**

---

## 9. The dev-warning sink, and the known member it was calibrated against

T002 ruling 4 requires it and forbids pushing it down to T003, because NG-code
hydration diagnostics only happen in a demo.

**Which diagnostic, measured in the shipped bundle rather than from docs.**
`@angular/core` 22.0.8 `fesm2022/core.mjs:594`, inside `withDomHydration()`:

```js
} else if (typeof ngDevMode !== 'undefined' && ngDevMode && !isClientRenderModeEnabled(doc)) {
  const console = inject(Console);
  const message = formatRuntimeError(-505, 'Angular hydration was requested on the client, but there was no '
    + 'serialized information present in the server response, thus hydration was not enabled. …');
  console.warn(message);
}
```

`Console` is Angular's own one-line wrapper over `globalThis.console`, so **NG0505
lands on `console.warn` and nowhere else**, and `@async/witness` 0.7.0 exposes
`consoleErrors` only. What NG0505 means is the failure this lane could not otherwise
see at all: the client decided the server sent no hydration annotations, threw the
server markup away, and rendered from scratch. **Every observation in the shared
contract still passes in that state** — a settled client-rendered Angular page is
indistinguishable from a hydrated one, and the served-payload negatives are
unaffected because the server did nothing wrong. Without the sink, "Angular hydrated"
would rest on nothing.

**Instrument rule 4 — the known member.** `/?frameless-calibration=hydration-state-deleted`
re-requests `/` from the real server over a real socket and deletes Angular's own
`<script id="ng-state" type="application/json">…</script>` before serving it. The
box then requires: at least one diagnostic; the first one warn-level and naming
`NG0505`; and the page still reading `kit:2` afterwards (the demonstration that the
page *looks* correct, which is why the console channel is the one that must be
watched). Captured, verbatim off `<html>`:

```
data-frameless-dev-sink="calibrated"
data-frameless-dev-diagnostics="1"
data-frameless-dev-diagnostic-1st="warn: NG0505: Angular hydration was requested on the client,
  but there was no serialized information present in the server response, thus hydration was not
  enabled. Make sure the `provideClientHydrati"
```

**A control that is not the thing it claims to be proves nothing**, so the box
`browser.fetch`es the calibration path and asserts the payload really lacks
`ng-state` and really carries the calibration meta *before* it visits it in a browser.

**The path had to be a QUERY on `/`, and that was found by measurement.** The first
attempt used `/__frameless-hydration-state-deleted`; the router matched no route and
`<app-root>` came back holding an empty `<router-outlet>`, so every downstream arm
would have been asserting against a blank page. Recorded because it is the same class
of fault this board keeps finding: a control that ran and established nothing.

---

## 10. Negative arms — every one of them actually run

"A mutation that does not mutate is not a mutation." Each of these was executed and
its failure text is the one quoted.

| arm | result |
|---|---|
| `expectedNavigations.angular = 1` | RED — `navigations: expected 1, observed 0` |
| marker on `afterNextRender` instead of `isStable` | RED — `…written with scenario-absent…` |
| dev-sink imported *after* `bootstrapApplication` (`.then(() => import('./dev-sink'))`) | RED — `The dev-diagnostic sink captured 0 diagnostics on a page whose serialized hydration state was deliberately deleted.` |
| `src/` newer than the built server bundle | RED — `demos/angular-official/src is newer than its built server bundle…` |
| `calibrateServedClientEntry` payload-deletion arm | runs on all 3 scenarios, every run |
| `measureServedAttribute` payload-wide + scoped arms | run on every S3 call |
| `toolchain.test.ts` wrong-version and missing-package arms | in the suite |

The dev-sink arm needed `export {}` appended to `dev-sink.ts` for the duration, since
a side-effect-only module cannot be `import()`ed dynamically (`TS2306: File … is not
a module`). That addition does not change install timing, which is the variable under
test. All three temporarily-edited files were restored and the mechanical scaffold
diff in §6 was taken afterwards.

**A NOTE ON WHAT WAS *NOT* SHOWN.** The `main.ts` comment claims only what was run:
that a *deferred* import goes red. Moving the static `import './dev-sink'` below the
`bootstrapApplication` call is a NO-OP because ESM hoists — the Vue lane caught
exactly that as an invalid negative arm, and this lane inherits the wording rather
than re-deriving it.

**An honest gap:** Angular ships **event replay** by default at v22
(`jsaction="click:;"` attributes plus the `ng-event-dispatch-contract` script are in
every served payload), so a click landing *before* hydration is buffered and
replayed. That means "marker set far too early" is NOT reliably discriminated by the
scenario assertions themselves, which is precisely why M4 is enforced by the
`data-frameless-activated-with` assertion rather than by hoping a premature click
fails.

---

## 11. Deviation — `pnpm-lock.yaml`, and a leak in the direction T002 did not anticipate

The lockfile moved (+3918 / -160). **Zero pre-existing resolutions were lost** —
mechanically checked, every package/version pair present at HEAD is still present.
The bulk is the Angular toolchain arriving.

But it is **not purely additive**, and the part that is not is worth the board's
attention.

`vite@8.0.16` declares `esbuild` and `sass` as **optional peer dependencies**
(`esbuild: "^0.27.0 || ^0.28.0"`). Nothing in this workspace declares esbuild
directly. `@angular/build@22.0.8` depends on `esbuild@0.28.1` and on `sass`, exactly,
and pnpm now satisfies vite 8's optional peers with them:

```
root vite            8.0.16   (unchanged)
esbuild under it     0.27.7 -> 0.28.1
sass under it        (unsatisfied) -> 1.99.0
rollup under it      4.62.2   (unchanged)
```

T002 ruling 1 established that the catalog **cannot reach the Angular lane**. That
remains true. **The converse is not true**: the Angular lane's exact toolchain pins
reach every other lane in this repo, through Vite's optional peers. Both esbuild
versions are inside vite's own declared supported range, `pnpm check`, `pnpm test`,
`pnpm lint` and `pnpm e2e` are all green, and all five incumbent lanes' observations
are byte-identical to their pre-change values. But ruling 1's cost list — (a), (b),
(c) — has a fourth entry it did not name, and this is it.

No repair was attempted here. The obvious one is a `pnpm.overrides` entry, and
ruling 1 refuses those in those words; the file it would live in is also outside
this task's `allowed_files`.

---

## 12. Left standing, deliberately

- **`scenarios.box.ts` is not type-checked**, consistent with all five incumbent
  lanes. Covering it needs `@async/witness` as a dependency the demo deliberately
  lacks.
- **`modes: ['dev']`**, consistent with every other lane. The Angular lane's "dev"
  is Angular's `development` build configuration served by Angular's own server,
  which is where `ngDevMode` lives and therefore where NG0505 exists at all. The
  `production` configuration is exercised, but only as a build gate
  (`pnpm --dir demos/angular-official build`), never as a served lane.
- **`tsconfig.spec.json`** is kept byte-identical although `app.spec.ts` was dropped,
  so its `include` now matches nothing. It is used only by `ng test`, which no lane
  runs. Keeping it is the smaller delta.
- **`vitest`, `jsdom` and `prettier`** stay in the demo's devDependencies although
  nothing here uses them, for the same reason: the scaffold's dependency list is left
  alone except for the one `@types/node` catalog pin.
