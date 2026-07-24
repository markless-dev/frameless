# T001 — Landing map (Scout)

Read-only survey of the Frameless working tree, produced to shape the landing changesets.
Nothing was staged, committed, stashed, cleaned, or edited.

## Verification status (run, not asserted)

| Command | Exit | Result |
|---|---|---|
| `pnpm e2e` | 0 | ui-kit react 3 / solid 3; composition-kit react 4 / solid 4; trace pairs equal. SSR 13 witness boxes pass, 0 fail. Persistence 7 witness boxes pass, 0 fail. ~15s. |
| `pnpm test` | 0 | 35 files, 520/520. Confirms the owner's figure. |

Not run: `pnpm build`, `pnpm check`, `pnpm test:browser`.

**Coverage gap:** `scripts/e2e.mjs` knows only `demos/{ui-kit,composition-kit,ssr,persistence}`. The three
new demos (`qwik`, `react-official`, `solid-official`) have **no automated lane**. The "all three show
kit:2 → kit:4" claim is real but manual-observation-only and not reproducible by any repo command.
This matters directly to the goal oracle.

## Stream seams

The tree splits into three streams, and the modified tracked files split along the same seams —
with one exception.

- Every modified tracked file except `package.json` and `pnpm-lock.yaml` is **persistence** work.
  Every hunk references persistence / `FramelessPersistenceRecord` / `__framelessWrite`.
- **Zero** modified tracked files mention Qwik. The Qwik emitter is purely additive.
- `package.json` is a whitespace-only reformat of the `engines` block — a formatter artifact,
  unrelated to any stream.
- `pnpm-lock.yaml` (+3115/−158) is the only genuinely cross-stream file: persistence deps,
  `@qwik.dev/core`, and express/sirv/compression for the official demos, all in one blob.

**Correction to the intake:** `__framelessWrite` is not a separate fix. It lives in the react/solid
emitters and their goldens, entirely inside the persistence changeset, and cannot be split out.

**Correction to the intake:** "~40 uncommitted paths" counts directories. `git status -uall` expands
to 26 modified tracked files plus ~85 untracked files across 8 directory groups.

## Proposed changesets

1. **`feat(persistence): render-time localStorage reads with pre-paint seed and write-through`**
   All 27 persistence paths: `packages/compiler/src/persistence.ts` (new), `artifacts.ts`, `build.ts`,
   `index.ts`, `schema.ts`, `test/persistence.test.ts` (new), `test/fixtures/persistence-facts.ts` (new),
   the three goldens, `packages/analyzer/src/receipts.ts` + test, `packages/cli/src/persistence.ts` (new),
   `index.ts`, `node-runtime.ts`, `receipts.ts` + three tests, and both `packages/frameworks/{react,solid}`
   emitter + gate sources and tests.
   *Why one commit:* `compiler/src/persistence.ts` exports `MarklessStorageSourceFact` +
   `FramelessPersistenceRecord`, consumed by `artifacts.ts`, `schema.ts`, `cli/receipts.ts`, and both
   emitters. Splitting compiler from emitters yields a non-compiling intermediate commit. Goldens gained
   `"persistence": []` in the same hunk that added the schema field, so they cannot lag.

2. **`feat(persistence): checked-in P1 emitter goldens for react and solid`**
   `packages/frameworks/{react,solid}/generated-persistence/P1.jsx`. Mirrors the already-tracked
   `generated/*.jsx` precedent. Foldable into 1.

3. **`test(persistence): witness demo and e2e persistence lane`**
   All 24 files of `demos/persistence/`, plus `scripts/e2e.mjs` and `README.md`.
   *Why coupled:* `scripts/e2e.mjs:16` hard-imports `buildPersistenceEntry` / `getPersistenceLaneVerdict`
   from `../demos/persistence/src/persistence-receipt.ts`. Landing `e2e.mjs` without the demo makes
   `pnpm e2e` throw at import.

4. **`docs(goals): frameless-persistence-v1 board`** — 6 files. Gate `dossierRefs` in commit 1 cite
   `T002-persistence-architecture Decision 6`, so this should precede or accompany commit 1.

5. **`feat(qwik): @frameless/qwik emitter and gate`** — 13 files under `packages/frameworks/qwik/`.
   Self-contained new workspace package. Already covered by the root test glob
   `packages/frameworks/*/test/**/*.test.ts`, so it joins the 520 with no wiring.
   `generated/{S1,S2,S3}.jsx` must ship because `demos/qwik` reads them by relative path.

6. **`demo(qwik): official pnpm-create-qwik app proving resume neutrality`** — 10 files.
   `demos/qwik/server/**` deliberately excluded (see rulings).

7. **`docs(goals): frameless-qwik-v1 board`** — 6 files.

8. **`demo(react,solid): official vite SSR scaffolds proving activation neutrality`** — 9 files each.
   Both are the same create-vite SSR template consuming already-tracked
   `packages/frameworks/{react,solid}/generated/S1.jsx`. Neither depends on the persistence or Qwik streams.

9. **`chore: lockfile for persistence, qwik and official demo workspaces`** — `pnpm-lock.yaml`.

### Bisectability warning

`demos/*` are pnpm workspace members. Commits 3, 6 and 8 each add a new importer (lock lines 83, 129,
142, 170). Any commit that adds a demo `package.json` without the matching lock importer leaves that
commit failing `pnpm install --frozen-lockfile`. The lock is a single file and cannot be partially
committed without hand-editing.

## Generated vs. authored

**Checked-in goldens (commit them).** `packages/frameworks/{react,solid}/generated-persistence/P1.jsx`
— the sibling `generated/{S1,S2,S3}.jsx` are already tracked (`git ls-files`) and neither directory is
matched by any ignore rule. `packages/frameworks/qwik/generated/{S1,S2,S3}.jsx` — regenerated by
`scripts/regenerate.ts`; must be committed because `demos/qwik` reads them by relative path.

**Redundant copies.** The five `src/emitted/*.jsx` under `demos/qwik` (×3), `demos/react-official` (×1),
`demos/solid-official` (×1) are byte copies produced by each demo's `copy-emitted` script.

**Build output.** `demos/qwik/server/` — 260K of content-hashed Qwik symbol chunks
(`build/q-*.js` ×6, `entry.preview.js`, a `{"type":"module"}` stub) produced by
`vite build --ssr src/entry.preview.tsx`. **Not currently gitignored** — `demos/qwik` has no
`.gitignore` and the root only ignores `dist/`.

**Scaffolded.** `demos/qwik/vite.config.ts` carries a verbatim comment: *"This is exactly what
`pnpm create qwik` produces."* The react/solid official demos are stock create-vite SSR templates
(express/sirv/compression, no semicolons, 2-space vs. the repo's tabs).

**Already correctly ignored.** `demos/persistence/.gitignore` covers `dist/`, `receipts/`, `.witness/`,
a 145K compiler artifact, the pre-paint script, and the generated `PersistedApp.jsx`. This is the model
the other three demos lack.

## The demos, in detail

| | workspace member | own lockfile | own .gitignore | node_modules | references frameless via |
|---|---|---|---|---|---|
| `demos/persistence` | yes (lock:83) | no | **yes** | 20K | `workspace:*` devDeps, runs the real compiler |
| `demos/qwik` | yes (lock:129) | no | no | 28K | relative copy from `packages/frameworks/qwik/generated/` |
| `demos/react-official` | yes (lock:142) | no | no | 2.5M | relative copy from `packages/frameworks/react/generated/S1.jsx` |
| `demos/solid-official` | yes (lock:170) | no | no | 356K | relative copy from `packages/frameworks/solid/generated/S1.jsx` |

None of the four demo roots is gitignored. All `node_modules/` are pnpm symlink farms, gitignored, and
pose no commit risk. `pnpm-workspace.yaml` declares `demos/*`, so all four resolve through the single
root lock.

### Fresh-clone behavior

- **`demos/react-official`** — works today. `pnpm install; pnpm --dir demos/react-official dev` runs
  `copy-emitted` then `node server` on :5173. No frameless build step needed because
  `packages/frameworks/react/generated/S1.jsx` is already tracked.
- **`demos/solid-official`** — identical.
- **`demos/persistence`** — covered end-to-end by `pnpm e2e`. Needs `@async/witness` 0.7.0 installable.
- **`demos/qwik`** — **broken from a fresh clone, two ways.**
  1. Its `copy-emitted` copies *into* `src/emitted/` **without `mkdirSync`**, unlike the other two
     demos. If those files are gitignored, the directory won't exist and `copyFileSync` throws ENOENT.
  2. Its `package.json` has **no `dev`, `preview`, or `start` script** — only `build.client`,
     `build.preview`, `build`, `copy-emitted`. Running it requires `pnpm --dir demos/qwik build` then
     manually `node demos/qwik/server/entry.preview.js`.

### The vite 7.3.1 pin

**Survives a fresh clone.** `demos/qwik/package.json` pins `"vite": "7.3.1"` exactly — *not* `catalog:`,
unlike every other demo (which resolve to `^8.0.16`). `pnpm-lock.yaml:139` records
`specifier: 7.3.1`, with a resolved `vite@7.3.1` entry at line 4310 and `@qwik.dev/{core,router}@2.0.0-beta.38`
peer-resolved against it (lines 5295–5346). Root and the other demos keep vite 8.0.16; the two coexist
without an override.

**Caveat:** the pin is invisible from the root `package.json` and nothing documents *why* 7.3.1 is
required. A future catalog bump could silently break Qwik.

## Open questions carried to the ruling task

1. `demos/qwik/server/**` — commit / gitignore / restructure to `dist/`.
2. The five `src/emitted/*.jsx` copies — commit or ignore (interacts with the missing `mkdirSync`).
3. `generated-persistence/P1.jsx` — confirm intended goldens; react/solid have no `regenerate.ts`.
4. `packages/frameworks/qwik/package.json` lists `@eslint/js`, `eslint`, `globals`, `oxfmt` under
   **`dependencies`** (runtime), and `@qwik.dev/core` as a hard dep rather than a peer. Scaffold leakage.
5. `@frameless/qwik` is absent from the `pack` array in `vite.config.ts` despite declaring
   `publishConfig` exports at `./dist` — `pnpm build` would silently produce no dist for it.
6. Lockfile strategy vs. commit granularity (see bisectability warning).
7. Whether landing is gated on adding e2e lanes for the three new demos.
8. `demos/qwik` has no dev/preview/start script.
9. `package.json` whitespace-only `engines` reformat — revert or fold into a chore commit.
10. `README.md` flips the localStorage row to "Proven" but says nothing about Qwik, and its
    "More frameworks: Planned" row is now stale.
11. `docs/goals/frameless-land-and-demo-v1/` is this goal's own live board — land last, continuously,
    or leave uncommitted.
