# T003 — Equality matrix + automated three-way lanes (Worker)

Closes the T001 oracle gap. The "identical behavior across three frameworks" claim was previously
manual observation; it is now proven by `pnpm e2e` in a real browser.

Commits on `land/stack-and-three-way-demo`:

- `7eceb98` `demo(react,solid): run S2 and S3 from the emitted output`
- `a1a3d3c` `test(e2e): three-way witness lanes for the official react, solid and qwik demos`
- `8646c7a` `docs(goals): frameless-land-and-demo-v1 board — T002 done, T003 active`

## Design choice: URL branching, no router, no new dependency

`demos/react-official` and `demos/solid-official` are stock create-vite SSR templates with no router.
The scaffold **already** threads `req.originalUrl` into `render(url)` — the parameter existed but was
unused (`render(_url)`). That existing parameter now drives scenario selection: `App` maps the URL to a
scenario, and the client entry passes `window.location.pathname` so both halves of hydration agree.

No router, no new dependency, and `server.js`'s routing surface is unchanged.

Stacking all three scenarios on one page would have been slightly less code, but it would have broken
URL parity with the Qwik demo — and that parity is what makes the side-by-side comparison, and T005's
runner, legible.

Scenario components are **not hand-written**: each demo's `copy-emitted` now maps
S1 → `RenderOnce`, S2 → `KeyedTodo`, S3 → `EventForm` from `packages/frameworks/*/generated/`,
matching what `demos/qwik` already did. The demos run emitter output, which is the entire point.

## The 9 cells — observed by the automated lanes

| | React (hydrate) | Solid (hydrate) | Qwik (resume) |
|---|---|---|---|
| **S1** | SSR `kit:2`; after 1 click `kit:4`; 0 console errors, 0 failed requests | identical | identical |
| **S2** | SSR rows `a,b`, `1/2`; reorder → `b,a` still `1/2`; remove `b` → `a`, `0/1`; clear → empty branch, `0/0` | identical | identical |
| **S3** | SSR `hello`, writes `0`; submit → writes `2` | identical | identical |

`scripts/e2e.mjs` diffs the three lanes' recorded observations per scenario and **exits 1 on any
divergence**. It found none. This is a real equality assertion, not three independent green lanes.

Lane counts: react-official 24 assertions / 3 pages, solid-official 24 / 3, qwik 27 / 3.
`pnpm e2e` exit 0 with all pre-existing lanes unchanged; `pnpm test` 520/520.

## Findings deliberately not papered over

1. **Qwik's live `q:container` reads `resumed`, not `paused`.** The first lane asserted `paused` on the
   live DOM attribute and failed. The *served payload* is `q:container="paused"` for all three routes in
   both dev and `vite preview`. The pause assertion was moved onto the served response
   (`browser.fetch` + `expect.response.matches`), where the hydrate-vs-resume difference is actually
   observable; the live check is now just "is a Qwik container". Explained by resume — but the live
   attribute is **not** a usable pause oracle, and anything built on it later will be wrong.
2. **Qwik records 1 same-URL main-frame navigation per page; React/Solid record 0.** Not asserted by the
   lanes. Same URL, no re-navigation to a different route.
3. **`three-way-contract.ts` lives in `demos/react-official/`** and is imported by the Solid and Qwik
   boxes by relative path (following the `demos/ssr` → `demos/ui-kit/scenarios.ts` precedent). It is
   there only because `allowed_files` confined the Worker to the three demo packages. A neutral shared
   home would be better.
4. **Solid's SSR emits duplicate `value` attributes** for the S2/S3 inputs (the emitter writes both
   `value=` and `attr:value=`). Pre-existing emitter output; browsers take the first; no behavioral
   difference. Not in scope here.
5. **The lanes exercise the demos' dev-mode SSR path** — which is what the newcomer command will run.
   The express production path was verified by curl only, not by a browser lane.

## How no-new-dependency was achieved

The witness runner aliases `@async/witness` for the box files it loads
(`resolve: { alias: { "@async/witness": witnessEntryFile() } }` in its discovery path), so the official
demos run boxes without declaring the dependency, and `e2e.mjs` resolves the CLI through the copy
`demos/ssr` already installs. **`pnpm-lock.yaml` is untouched by this task.**

## Unrelated observation

`website/**` (fonts, framework logos including angular/svelte/vue, and `variant-1..3/`) appeared
untracked during this run, created the same day. Not produced by this task, outside `allowed_files`,
never staged, untouched. Almost certainly the owner's parallel design work.
