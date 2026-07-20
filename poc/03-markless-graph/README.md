# Markless 0.1.1 semantic-graph proofs (C6, C7, C11)

This self-contained POC proves the version-pinned, fixture-scoped claims C6, C7, and C11 (as reworded in the T004 critique adjudication) against the **local markless checkout at v0.1.1**, consumed exclusively through vendored tarballs in `../vendor/`. It is part of the Frameless evidence base: the same component shapes that Mitosis 0.13.2 silently mangles (proven in `poc/01-mitosis-static`) compile, mount, and behave correctly in markless — and the shapes markless does *not* support fail loudly with actionable diagnostics instead of silently dropping code.

## Claims and how they are proven

**C6 (behavioral)** — `browser/c6-behavior.test.ts`. Five `.tsrx` fixtures mirror exactly the shapes Mitosis mangles: (a) `fixtures/c6a-local.tsrx` component-body locals used in the template (C1 mirror); (b) `fixtures/c6b-collision.tsrx` handler locals named after the state properties they read — `const open = menu.open` — the legal spelling of the shape whose Mitosis rewrite emits the `const foo = foo` TDZ self-reference (C2 mirror); (c) `fixtures/c6c-props.tsrx` + `c6c-badge.tsrx` props destructuring in a child fed live parent state; (d) `fixtures/c6d-mutation.tsrx` ordinary deep state mutation (nested assign, nested `++`, in-place `push`); (e) `fixtures/c6e-guard.tsrx` a guard `if (hidden) return null;` before the template root. Each fixture is compiled by the real markless vite plugin (`markless()` from `@markless/core/vite`), mounted in **headless Chromium** through `@markless/web`'s public `render()` (the same pattern as markless's own `packages/vitest-browser` project), and asserted on initial DOM plus one state-changing interaction. The guard-hidden case is asserted as the compiled artifact's `renderCsr(props) => null` contract because a null root has nothing to mount (see Findings).

**C7 (structural)** — `test/c7-semantic-graph.test.ts`. `fixtures/todo-list.tsrx` (state array, computed count, `@if`, keyed `@for`, event handlers, destructuring alias) is compiled with `compileTsrxModule({ filename, source, symbols: [], buildId, resolverId })`. The tests assert typed records, cross-referenced **by id**, not by string matching: state bindings with `valueKind`/`writable`; lowered reads/writes with `graphNodeId` + property `path` (e.g. `{ graphNodeId: 'state:settings', path: ['title'] }`, `push` as `operation: 'call', method: 'push'`); the full state → computed → template-read chain (`computed.dependencies[].graphNodeId === state.id`, and a `payloadArena.view.domUpdates` record with `graphNodeId === computed.id` whose `hostNodeId` resolves to the `<output>` host record); a `branchSites` record for the `@if`; a `keyedRepeats` record with `collectionGraphNodeId`, `keyPath: ['id']`, and parent/row host ids resolving to `ul`/`li`; event records with handler counts, spans, and parameter lists whose host ids resolve to real host nodes; and an alias record for the destructuring. The claim's honest caveat is itself asserted: expression-level fields (`functionSource`, `handlerSources`, `valueSource`, `testSource`) remain **source strings** inside those typed records.

**C11 (diagnostics)** — `test/c11-diagnostics.test.ts`. Three genuinely unsupported shapes (event spread `{...handlers}`, object-valued `style={{ … }}`, unkeyed `@for`) each produce an error diagnostic carrying a file, a span that points at the offending source text, a human message, a `why`, suggestions, and a docs URL — the direct contrast to C1's silent drop. A fourth test shows the C1-mirror shape compiles with zero diagnostics. One diagnostic verbatim (markless 0.1.1, `MARKLESS_EVENT_SPREAD_UNSUPPORTED`):

> **Event handlers cannot be spread onto an element** — "{...handlers} spreads `onClick` onto an element. Events compile to static view records, so handlers inside a spread would be discarded." (why: "The compiler owns event discovery so the browser can resume without scanning markup; a runtime spread hides which events exist from the compiler." span: `src/EventSpread.tsrx` 161–169, suggestion: "Write event props directly, for example `<input onClick={handlers.onClick} onInput={handlers.onInput} />`, and keep spreads for plain static attributes.")

## Findings (markless 0.1.1 capability gaps and surprises)

- **Destructuring defaults are rejected, including on props.** `({ hidden = false })` fails with `MARKLESS_STATE_DESTRUCTURE_DEFAULT_UNSUPPORTED` (actionable, with a suggested rewrite). The C6 fixtures had to drop defaults. Notably, markless's own guard-clause compiler test uses the defaulted form and still renders — the error diagnostic is produced but that upstream test never asserts diagnostics, so CSR rendering proceeds despite an error-severity diagnostic being present.
- **Destructured aliases cannot be read from templates.** The alias record exists in the graph (asserted in C7), but a template read of `boardTitle` (alias of `settings.title`) is rejected at public-render with `MARKLESS_TEMPLATE_READ_UNDECLARED`. Aliases are currently graph records, not render-scope declarations.
- **JSX comments inside a template are parsed as template expressions.** A `{/* … */}` comment produced a `MARKLESS_TEMPLATE_EXPRESSION_STATIC` warning naming an identifier that only occurred inside the comment text.
- **Computed dependency `path` arrays degrade on composite expressions.** For `todos.filter((todo) => !todo.done).length` the dependency record is correctly id-linked (`graphNodeId: 'state:todos'`) but its `path` is a naive split: `['filter((todo) => !todo', 'done)', 'length']`. Path records are reliable for plain member chains only.
- **A guard-hidden root cannot be mounted.** `renderCsr(props)` returns `null` (the documented compile-time contract) and `@markless/web` `render()` throws on a null output, so the hidden case is asserted at the artifact contract level, not as a mounted empty container.
- **The vite plugin's client transform exposes only the default export.** `import { App } from './x.tsrx'` fails in this pipeline ("does not provide an export named 'App'"); compiled modules must be consumed via the default `marklessCompiledApp` artifact — which is what markless's own browser fixtures do.
- **Render-once body locals are render-once.** A body local derived from state (`const initial = \`start:${count}\``) renders its initial value and never updates — documented markless semantics, asserted in C6a rather than hidden.
- Runtime **source maps remain an open gap** for both Mitosis and markless (markless's production transform returns `map: null`); nothing in this POC changes that.

## Vendored markless tarballs

Produced by running `pnpm pack --pack-destination <this-repo>/poc/vendor/` inside `$MARKLESS_REPO/packages/{serializer,runtime,compiler,web,bundler,router,core}` at markless v0.1.1 (`MARKLESS_REPO` defaults to `/Users/jacksm5pro/dev/open-source/markless`; the checkout is never modified). All `@markless/*` specifiers, including transitive ones, are forced to these tarballs via `pnpm.overrides`. SHA-256:

```
c8058867e5814bf4912033cdd7bdeab79f66e187319e923c78e54e19a8b25253  markless-bundler-0.1.1.tgz
bc0f573b765e2cd3c2e5d546314acd347938ddc99fc05c276f30bf4fe0c800ad  markless-compiler-0.1.1.tgz
9b7a627ec8367dc2f2591564ff441a66173dbc96cee1a2200616eaa8002bd3cc  markless-core-0.1.1.tgz
afc0369273952d6fe05c9d7c2fbdb0ff0a6bf4032fd87d1313369b656c8f61cd  markless-router-0.1.1.tgz
6a4644113cd8bbbfcb56a7d8e82bb687b2625c09d38fbc5744f79198ce076117  markless-runtime-0.1.1.tgz
0fd0cab793da0b520d49fc1b9e8f187c92fbb66f4b851e8fef143056374bb5db  markless-serializer-0.1.1.tgz
3b399e06577b184f08517c12594fd766fadca16a9664770a6e8efee67cfee37a  markless-web-0.1.1.tgz
```

## What this does not prove

These tests do not generalize beyond markless 0.1.1 and these fixtures. C6 proves CSR behavior in headless Chromium only — no SSR, streaming, hydration/resume, HMR, async boundaries, cleanup/attach, slots/children/context, styling, performance, accessibility, or other browsers. C7 proves the semantic graph *records* this semantics as typed, id-linked data; it does **not** prove the graph is sufficient input for emitting other frameworks (host structure, branch arms, and expressions-as-strings are exactly why the adjudicated plan adds the W-C0 enriched IR), and it does not claim expression-level semantics are structured (the string caveat is part of the claim). C11 covers three unsupported shapes, not the full diagnostic surface, and says nothing about runtime debugging or source maps (an open gap for both tools). Cross-framework behavioral equivalence is C9's job (`poc/04+`), not this POC's.

## Verification

```sh
cd poc/03-markless-graph
pnpm install
pnpm test
```

Tests perform no network access (the browser project talks only to vitest's local dev server). `pnpm install` is the only network-dependent step (registry deps; `@markless/*` come from `../vendor`). The browser project needs Playwright's Chromium for playwright-core 1.58.2 (revision 1208); it was already present in `~/Library/Caches/ms-playwright` here — if missing, `npx playwright install chromium` once (network) before `pnpm test`.

## Recorded versions

- Node.js: 24.15.0 · pnpm: 10.33.2
- `@markless/*` (compiler, core, web, bundler, serializer, runtime, router): 0.1.1 (vendored tarballs above)
- `@tsrx/core`: 0.1.32 (pinned via override to markless's own lockfile resolution)
- Vitest: 4.1.5 · `@vitest/browser-playwright`: 4.1.5 · Vite: 8.0.16 · Rolldown: 1.0.3
- Playwright: 1.58.2 (Chromium revision 1208, headless)
