# T001 — Frameless pipeline map (for the marketing site)

Read-only scout. Every path below is real and was inspected. Nothing here is invented.

## 1. What Frameless is (hero paragraph)

> You write a component once, in a `.tsrx` file — HTML-like markup, plain JavaScript
> variables, ordinary reads and writes. Frameless doesn't wrap it in a runtime or ship a
> shim. It records what your component *means* — its state, its events, its updates — and
> from that record it generates real, idiomatic code for each framework you target. Solid
> output uses signals. React output uses hooks. Qwik output is resumable, with no hydration
> pass and handlers fetched on demand. Then it runs every output in a real headless browser
> against the same scripted actions and compares what actually happened — DOM, callbacks,
> list identity, focus. If they don't match, the build fails.

The inversion thesis, in the project's own framing (README "Why Not the Alternatives?"):
Mitosis translates *syntax to syntax*, so every framework gets the same
lowest-common-denominator component, verified by string snapshots. Frameless compiles a
*semantic record*, emits what each framework's own best practice calls for, refuses what it
cannot prove, and verifies **behavior** in a browser. Frameworks are explicitly not forced to
copy each other — "each framework owns its style; the tests own the proof that behavior
matches."

Source: `README.md` (lines 1–20, "Why Not the Alternatives?" table, "What It Does Not Do").

## 2. Authoring input format

`.tsrx`. It is TSX plus an `@{ }` component body and `@if/@else` template blocks. State comes
from `state()` / `computed()`.

Note the import in the real fixtures is **`@markless/core`**, not `@frameless.md/core`.
The README hero snippet uses `@frameless.md/core`; the actual committed fixtures use
`@markless/core`. Frameless is built on the Markless compiler
(`vendor/markless-compiler-0.1.1.tgz`, a `file:` dependency of `packages/compiler`) and its
components are API-compatible with Markless. **Do not put `@frameless.md/core` on the site as
if it were verified — the on-disk truth is `@markless/core`.**

Real complete example — `packages/compiler/test/fixtures/s1-render-once.tsrx`:

```tsx
import { computed, state } from '@markless/core';

export function RenderOnce({ label, multiplier, visible, onTrace }) @{
	const setup = onTrace('setup', { runs: 1 });
	let count = state(1);
	const prefix = `${label}:`;
	const derived = computed(() => `${prefix}${count * multiplier}`);

	<div data-s1-root="">
		@if (!visible) {
			<p data-branch="hidden">hidden</p>
		} @else {
			<section data-scenario="s1">
				<output data-value="derived">{derived}</output>
				<button
					data-action="increment"
					onClick={() => {
						count++;
						onTrace('change', { count });
					}}
				>increment</button>
			</section>
		}
	</div>
}
```

All fixtures: `packages/compiler/test/fixtures/` — `s1-render-once.tsrx`,
`s2-keyed-todo.tsrx`, `s3-event-form.tsrx`, plus `composition-*.tsrx` and
`alias-coverage.tsrx`.

## 3. Emitters that exist and genuinely work today

Exactly **three**. `ls packages/frameworks/` → `react`, `solid`, `qwik`. There is no vue,
svelte, or angular directory.

| Target | Package | Committed output | Proof status |
| --- | --- | --- | --- |
| React 19 | `packages/frameworks/react` (`@frameless/react`) | `generated/S1.jsx` `S2.jsx` `S3.jsx` | Proven. v0 + composition shipped and verified from fresh clone; hydrates in `demos/react-official`; three-way `pnpm e2e` lane passes. |
| Solid | `packages/frameworks/solid` (`@frameless/solid`) | `generated/S1.jsx` `S2.jsx` `S3.jsx` | Proven. Same lanes as React; hydrates in `demos/solid-official`. |
| Qwik | `packages/frameworks/qwik` (`@frameless/qwik`) | `generated/S1.jsx` `S2.jsx` `S3.jsx` | Proven, and it is the *newest*. `docs/goals/frameless-qwik-v1/state.yaml` → `goal.status: complete`. Resumes (not hydrates) in `demos/qwik`; the e2e Qwik lane asserts the `paused` → `resumed` container transition and the on-demand handler QRLs. |

Board cross-reference:
- `docs/goals/frameless-qwik-v1/state.yaml` — `status: complete`. Contains several tasks with
  `result: blocked` mid-goal (the beta.38 / hand-rolled-harness saga) that were later resolved
  by moving to official scaffolds; the goal itself closed complete.
- `docs/goals/frameless-composition-v1/state.yaml` — children, shared state, element access
  with cleanup.
- `docs/goals/frameless-ssr-v1/state.yaml` — SSR proven behaviorally via witness.
- `docs/goals/frameless-land-and-demo-v1/state.yaml` — `status: active`; T002/T003/T004/T007
  done with pass receipts (three-way witness lanes, measured diff); later tasks still `queued`.

## 4. How to produce per-framework output programmatically — the exact path

The pipeline is two hops:

```
.tsrx source  --buildEnrichedIr()-->  EnrichedIR (JSON)  --emit()/formatEmitted()-->  .jsx
```

### Hop 1 — source → IR

`packages/compiler/src/build.ts:139`

```ts
export async function buildEnrichedIr(input: BuildInput): Promise<EnrichedIR>
// BuildInput: { filename: string; source: string }
```

Used exactly this way in `packages/compiler/test/enriched-ir.test.ts:41-45`:

```ts
const source = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
return buildEnrichedIr({ filename: `src/fixtures/${file}`, source });
```

Imported from `@frameless/compiler` (exports `.` → `./src/index.ts`).

### Hop 2 — IR → framework code

Every one of the three framework packages exports the identical pair:

```ts
import { emit, formatEmitted } from '@frameless/react';  // or /solid, or /qwik
const code: string = await formatEmitted(emit(ir));
```

Verbatim from `packages/frameworks/qwik/scripts/regenerate.ts` (react/solid are the same
shape):

```ts
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
await writeFile(resolve(root, 'generated', output), await formatEmitted(emit(ir)));
```

`emit` and `formatEmitted` are public exports — `packages/frameworks/react/src/index.ts:2-3`.

### One source → three frameworks, as a script

```js
import { buildEnrichedIr } from '@frameless/compiler';
import * as react from '@frameless/react';
import * as solid from '@frameless/solid';
import * as qwik from '@frameless/qwik';

const ir = await buildEnrichedIr({ filename: 'src/Counter.tsrx', source });
const outputs = {
  react: await react.formatEmitted(react.emit(ir)),
  solid: await solid.formatEmitted(solid.emit(ir)),
  qwik:  await qwik.formatEmitted(qwik.emit(ir)),
};
```

There is no single `compile(source, { target })` helper. The two-hop call above is the API.

### The CLI (limited — read this before advertising it)

`packages/cli` ships bin `frameless`:

```
frameless build <input.tsrx> [input.tsrx ...] --target <name> [--target <name>] --out-dir <dir>
```

**The CLI only supports react and solid.** `packages/cli/src/program.ts:6-10`:

```ts
export const TARGET_INVENTORY = [
	{ name: 'react', packageSpecifier: '@frameless/react' },
	{ name: 'solid', packageSpecifier: '@frameless/solid' },
] as const;
```

Qwik is reachable only through the library API / its regenerate script, not `frameless build`.
That is a real gap and a real honesty trap.

### Existing golden / snapshot fixtures — the gold you asked for

Input → IR → output triples, all committed:

| Scenario | `.tsrx` source | IR golden | React | Solid | Qwik |
| --- | --- | --- | --- | --- | --- |
| S1 counter | `packages/compiler/test/fixtures/s1-render-once.tsrx` | `packages/compiler/test/goldens/s1-render-once.json` | `packages/frameworks/react/generated/S1.jsx` | `packages/frameworks/solid/generated/S1.jsx` | `packages/frameworks/qwik/generated/S1.jsx` |
| S2 keyed to-do | `.../s2-keyed-todo.tsrx` | `.../goldens/s2-keyed-todo.json` | `.../react/generated/S2.jsx` | `.../solid/generated/S2.jsx` | `.../qwik/generated/S2.jsx` |
| S3 event form | `.../s3-event-form.tsrx` | `.../goldens/s3-event-form.json` | `.../react/generated/S3.jsx` | `.../solid/generated/S3.jsx` | `.../qwik/generated/S3.jsx` |

Regenerate commands (each package has a `regenerate` script):

```sh
node packages/frameworks/react/scripts/regenerate.ts
node packages/frameworks/solid/scripts/regenerate.ts
node packages/frameworks/qwik/scripts/regenerate.ts
UPDATE_GOLDENS=1 pnpm test   # refreshes the IR goldens (enriched-ir.test.ts:657)
```

Demo copies of the same emitted files (nicer names, already framework-ready):
`demos/{react-official,solid-official,qwik}/src/emitted/{RenderOnce,KeyedTodo,EventForm}.jsx`.

## 5. Can the website generate output at build time?

**Yes — and pre-capturing is also trivially available. Recommend pre-capture.**

Reasons:

- Packages are **source-only in dev**: every `exports` field points at raw `.ts`
  (`"." : "./src/index.ts"`), with a separate `publishConfig.exports` pointing at `./dist/*`.
  So importing `@frameless/compiler` from a website build means your bundler must transpile
  workspace TypeScript, including `.ts` extension specifiers in relative imports
  (`from './build.ts'`). Vite handles this, but it is a real constraint.
- `packages/cli` and `packages/frameworks/*` are `"private": true`. `@frameless/compiler` is
  public but depends on `@markless/compiler` via a `file:` tarball in `vendor/`.
- Everything is `"type": "module"`; no CJS concerns.
- The website is currently an **empty `website/` directory** (untracked, no files yet), and
  `.gitignore`/lint already exclude it (commit `7f4c04d` "ignore website/ in the monorepo lint
  pass"). So it is outside the workspace lint/type pass — it will not inherit tooling.
- Root scripts: `build` (`vp pack`), `check`, `test`, `test:browser`, `lint`, `fmt`, `e2e`,
  `demo`. There is no `dist/` produced by default in a fresh checkout, so a build-time import
  path must consume `src/`, not `dist/`.

**Recommendation:** read the already-committed `generated/*.jsx` and `fixtures/*.tsrx` files
at build time with plain `fs`. They are committed precisely so "you can read them before you
run anything" (README). That is honest — it is real compiler output, byte for byte — and it
avoids making the marketing site depend on the compiler toolchain. Optionally add a CI check
that the site's copies match the repo's.

## 6. Concrete showcase candidate — S1 `RenderOnce`

This is the right one. It has state, a derived value, a conditional, a click handler, and a
callback — and the three outputs diverge in genuinely interesting, framework-idiomatic ways.
Source is in section 2 above. Real emitted output, quoted verbatim from the repo:

**React** — `packages/frameworks/react/generated/S1.jsx`

```jsx
// @generated by @frameless/react; do not edit.
import { useRef, useState } from 'react';

export function RenderOnce({ label, multiplier, visible, onTrace }) {
	const setupDone = useRef(null);
	if (setupDone.current === null) {
		setupDone.current = true;
		onTrace('setup', { runs: 1 });
	}
	const [count, setCount] = useState(1);
	const [prefix] = useState(() => `${label}:`);
	const derived = `${prefix}${count * multiplier}`;
	return (
		<div data-s1-root="">
			{!visible ? (
				<p data-branch="hidden">hidden</p>
			) : (
				<section data-scenario="s1">
					<output data-value="derived">{derived}</output>
					<button
						data-action="increment"
						onClick={() => {
							const nextCount = count + 1;
							setCount(nextCount);
							onTrace('change', { count: nextCount });
						}}
					>
						increment
					</button>
				</section>
			)}
		</div>
	);
}
```

**Solid** — `packages/frameworks/solid/generated/S1.jsx`

```jsx
// @generated by @frameless/solid; do not edit.
import { createSignal, untrack, Show } from 'solid-js';

export function RenderOnce(props) {
	untrack(() => props.onTrace('setup', { runs: 1 }));
	const [count, setCount] = createSignal(1);
	const prefix = untrack(() => `${props.label}:`);
	const derived = () => `${prefix}${count() * props.multiplier}`;
	return (
		<div data-s1-root="">
			<Show
				when={!props.visible}
				fallback={
					<section data-scenario="s1">
						<output data-value="derived">{derived()}</output>
						<button
							data-action="increment"
							onClick={() => {
								setCount(count() + 1);
								props.onTrace('change', { count: count() });
							}}
						>
							increment
						</button>
					</section>
				}
			>
				<p data-branch="hidden">hidden</p>
			</Show>
		</div>
	);
}
```

**Qwik** — `packages/frameworks/qwik/generated/S1.jsx`

```jsx
// @generated by @frameless/qwik; do not edit.
import { $, component$, useComputed$, useSignal, useTask$ } from '@qwik.dev/core';

export const RenderOnce = component$((props) => {
	useTask$(async () => {
		await props.onTrace$('setup', { runs: 1 });
	});
	const count = useSignal(1);
	const prefix = useSignal(() => `${props.label}:`);
	const derived = useComputed$(() => `${prefix.value}${count.value * props.multiplier}`);
	return (
		<div data-s1-root="">
			{!props.visible ? (
				<p data-branch="hidden">hidden</p>
			) : (
				<section data-scenario="s1">
					<output data-value="derived">{derived.value}</output>
					<button
						data-action="increment"
						onClick$={$(async () => {
							count.value += 1;
							await props.onTrace$('change', { count: count.value });
						})}
					>
						increment
					</button>
				</section>
			)}
		</div>
	);
});
```

Why this is a great sticker demo — the differences are *substantive*, not cosmetic:
- React destructures props; Solid keeps `props.x` (reactivity); Qwik keeps `props.x` and
  renames the callback `onTrace$` (serializable QRL).
- React guards run-once setup with a `useRef` latch; Solid uses `untrack`; Qwik uses
  `useTask$`.
- Derived value: React computes inline per render; Solid makes it a thunk; Qwik uses
  `useComputed$`.
- Conditional: React and Qwik use a ternary; **Solid uses `<Show>` with `fallback`** — proof
  the compiler emits each framework's own idiom rather than one shared shape.
- The handler: React reads `nextCount` because `count` is stale in closure; Solid calls
  `count()`; Qwik mutates `.value` and `await`s the QRL.

If you want a second, simpler sticker, S3 `EventForm` is smaller; S2 `KeyedTodo` best shows
list-keying differences.

## 7. Honesty check — claims that would be FALSE or overstated

1. **"Compiles to any framework" / "8 frameworks."** Only **three** emitters exist: react,
   solid, qwik. Angular/Vue/Svelte are listed as **Planned** in the README status table. Do
   not show logos for them as if supported.
2. **"`frameless build --target qwik`."** False. The CLI's `TARGET_INVENTORY` is react and
   solid only (`packages/cli/src/program.ts:6-10`). Qwik goes through the library API.
3. **`import { state } from '@frameless.md/core'`.** The README hero uses this, but every real
   fixture on disk imports from `@markless/core`. Verify before printing it as the install
   story.
4. **"Frameless Studio."** It does **not** exist in the codebase. The only occurrences of
   "studio" anywhere are inside `docs/goals/frameless-website-v1/state.yaml` — i.e. this very
   website goal, which itself specifies "Frameless Studio = simpler Storybook (components +
   states, works everywhere), **coming soon, not shipped**." Must be labeled coming-soon.
5. **"Fully verified / proven everywhere."** README's own "What It Does Not Do": browser tests
   cover the scripted demo scenarios, not every program. Accessibility and performance are
   **not** proven. The express **production** build of the React and Solid demos is verified by
   `curl` only, not a browser lane — `pnpm demo` / `pnpm e2e` exercise the **dev-mode SSR path**.
6. **"Production ready" / "npm install frameless."** Every package is `version: 0.0.0`;
   `@frameless/cli`, `/react`, `/solid`, `/qwik` are all `"private": true`. Nothing is
   published. `packages/compiler` depends on a vendored tarball.
7. **Persistence / saved state.** Proven for **React and Solid** only — the board and README
   both scope it that way. Not claimed for Qwik.
8. **"Shared state across files, named slots."** README status: **Planned**, not shipped.
9. **Independence from Markless.** Frameless *is built on* the Markless compiler and vendors
   it. Positioning it as a fully standalone stack would be overstated.
10. **The land-and-demo goal is still `status: active`** with queued tasks. Do not imply the
    demo tranche is fully closed.

Safe, defensible claims: "one `.tsrx` source → React, Solid, and Qwik"; "two activation
models, hydration and resumability, from the same component"; "output is committed, so you can
read it before running anything"; "behavior compared in a real browser across all three, nine
cells, or the build fails."

## 8. Framework logo list, ordered by actual support

1. **React 19** — full emitter, style gate, hydrates, e2e lane, persistence, composition.
2. **Solid** — same tier as React (full emitter, gate, hydrates, e2e lane, persistence).
3. **Qwik** — full emitter + gate + e2e lane + resumability proof; goal `complete`. One tier
   down only because it is newest, is not in the CLI target inventory, and is not covered by
   the persistence proof.
4. **Markless** — not a "target" but genuinely real: the compiler Frameless is built on, and
   components are API-compatible. Worth a logo as the sibling runtime, framed correctly.
5. **Angular / Vue / Svelte** — **Planned only.** If shown, they must be visually and textually
   marked as not-yet-supported (greyed sticker, "coming soon"). This is also the natural home
   for the "peel-sticker" moment the goal board describes.

## Appendix — copy-pasteable commands

```sh
pnpm install
pnpm demo   # boots React :5173 (hydrates), Solid :5174 (hydrates), Qwik :5175 (resumes)
pnpm e2e    # 3 frameworks x 3 scenarios, diffed in a real browser; non-zero on mismatch
pnpm test && pnpm check && pnpm lint

# regenerate emitted output from the IR goldens
node packages/frameworks/react/scripts/regenerate.ts
node packages/frameworks/solid/scripts/regenerate.ts
node packages/frameworks/qwik/scripts/regenerate.ts

# the resumability proof, straight off the wire
curl -s localhost:5175/ | grep -o 'q:container="[^"]*"'   # q:container="paused"
curl -s localhost:5173/ | grep -o 'q:container="[^"]*"'   # nothing
```
