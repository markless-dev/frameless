# T010 — Landing rulings (Judge)

Ruling on the 11 open questions from `notes/T001-landing-map.md`. Read-only; nothing staged or edited.

Rulings favour **fresh-clone reproducibility** over repo tidiness, because the goal oracle is a
newcomer running the demo from a clone. Landing is package 1 of 3, so scope is held to what a
runnable landed branch requires.

## Corrections to the Scout survey

Three of Scout's premises were wrong, verified directly:

1. **Q3** — react and solid *do* have regenerate scripts: `packages/frameworks/{react,solid}/scripts/regenerate.ts`
   and `regenerate-composition.ts`. Only a persistence-specific one is missing. Pre-existing tidy, not a blocker.
2. **Q4** — `oxfmt` is a *correct* runtime dependency: `packages/frameworks/qwik/src/format-emitted.ts`
   imports `{ format }` from it at runtime. Only `eslint`, `@eslint/js`, and `globals` are scaffold
   leakage (referenced nowhere in src, scripts, or test).
3. **Q8** — Scout's suggested serve path `node server/entry.preview.js` is wrong.
   `entry.preview.tsx` default-exports `createQwikRouter` middleware, which does not self-listen.
   The `frameless-qwik-v1` T999 audit records **vite-preview** as the proven serving mechanism.

## The 11 rulings

| # | Question | Ruling | Rationale |
|---|---|---|---|
| 1 | `demos/qwik/server/**` (260K) | **Gitignore** via new `demos/qwik/.gitignore` (`server/`, `.qwik/`, `tmp/`). Files stay on disk. Do NOT restructure to `dist/`. | Decisive: the client build `demos/qwik/dist/` is *already* gitignored by root `.gitignore:8`, so committing `server/` alone still cannot serve — zero fresh-clone value, high churn. Restructuring means editing a config whose own comment says "exactly what `pnpm create qwik` produces" — the hand-rolling trap. |
| 2 | Five `src/emitted/*.jsx` copies | **Commit all five.** | Verified byte-identical to their goldens (`cmp`). Committing makes a fresh clone work with no build step, self-heals the qwik `mkdirSync` gap, and directly satisfies the oracle's "three emitted outputs visible from the walkthrough." `copy-emitted` overwrites on each run, so drift self-heals and shows in `git status`. |
| 3 | `generated-persistence/P1.jsx` | **Commit — confirmed goldens.** | `git ls-files` shows sibling `generated/*.jsx` and `generated-composition/C1-C8.jsx` all tracked; no ignore rule matches. Scout's "no regenerate script" premise was wrong (see corrections). |
| 4 | qwik runtime `dependencies` hygiene | **Land as-is. Out of tranche.** | The package is `private: true` and absent from `pack`, so nothing publishes and no consumer is harmed. Fixing it rewrites the lock importer, forcing a lockfile regeneration mid-landing on the single riskiest file. Cost exceeds benefit. |
| 5 | `@frameless/qwik` missing from `pack` | **Out of tranche.** | Private package consumed via source `exports` (`./src/index.ts`); the demo reads `generated/*.jsx` by relative path. No dist is needed anywhere on the oracle path. |
| 6 | Lockfile strategy | **One `chore(deps)` commit, second-to-last. Accept non-installable intermediates.** | See below. Front-loading was evaluated and rejected. |
| 7 | e2e lanes gate landing? | **No.** → T003. | Gating package 1 on package 2's automation inverts the owner's order. `scripts/e2e.mjs` is already in T003's `allowed_files`; the lanes belong with the S2/S3 wiring they assert. |
| 8 | No dev/preview/start script | **Fix in T002** — add stock `"preview": "pnpm build && vite preview"`. | Coupled to Q1: once `server/` is ignored, a fresh clone has *no* way to reach the qwik demo. Smallest change that makes the landed branch runnable, on the officially scaffolded path. |
| 9 | `package.json` whitespace reformat | **Commit**, folded into `chore(deps)`. | The charter forbids discarding working-tree changes to make a changeset clean; a revert is exactly that. Harmless, and `vp fmt` would reintroduce it. |
| 10 | README | **Commit the existing persistence-row diff with its stream. Add nothing about Qwik.** → T005. | Writing Qwik claims before the three-way demo exists is precisely the recorded likely misfire. T005's walkthrough rewrites that section anyway; a briefly stale row on an unmerged branch is acceptable. |
| 11 | This goal's own board | **Land continuously**, as T002's last commit; later tasks commit their own updates. | The board is the adjudication trail justifying every commit in the push. Leaving it uncommitted means the pushed branch cannot explain itself, and T006's fresh clone would lack it. |

## Final commit list

Branch cut from `main` at `869ea33`; suggested name `land/stack-and-three-way-demo`.

1. `docs(goals): frameless-persistence-v1 board` — 6 files. *First, because commit 2's gate `dossierRefs` cite `T002-persistence-architecture Decision 6`.*
2. `feat(persistence): render-time localStorage reads with pre-paint seed and write-through` — the 7 new persistence files (incl. both `generated-persistence/P1.jsx`) + 20 modified. *Scout's commits 1+2 merged; splitting the shared `FramelessPersistenceRecord` type from its consumers yields a non-compiling intermediate.*
3. `test(persistence): witness demo and e2e persistence lane` — all 24 files of `demos/persistence/`, plus `scripts/e2e.mjs`, `README.md`. *`e2e.mjs:16` hard-imports from the demo.*
4. `docs(goals): frameless-qwik-v1 board` — 6 files.
5. `feat(qwik): @frameless/qwik emitter, gate, and checked-in S1/S2/S3 goldens` — 13 files.
6. `demo(qwik): official pnpm-create-qwik app proving resume neutrality` — 10 files + `.gitignore` (F1) + `package.json` (F2, F3) + 3 `src/emitted/*.jsx`. **Excludes `server/**`, gitignored, left on disk.**
7. `demo(react,solid): official vite SSR scaffolds proving hydrate neutrality` — 9 paths each.
8. `chore(deps): lockfile for the persistence, qwik and official-demo workspaces` — `pnpm-lock.yaml`, `package.json`.
9. `docs(goals): frameless-land-and-demo-v1 board` — `goal.md`, `state.yaml`, `notes/`.

Then `git push -u origin <branch>`. No merge, no PR.

**Every path is accounted for:** 26 modified → commits 2, 3, 8. 85 untracked → commits 1–7, 9, except
`demos/qwik/server/**` (8 paths), which is gitignored, left on disk, never deleted.

## Lockfile strategy

- `pnpm-lock.yaml` lands **whole, once, in commit 8**. Never hand-edited, never partially staged.
- **Commits 1–7 are knowingly not installable** with `--frozen-lockfile`. Stated in commit 8's body:
  *"The branch is installable at HEAD. Intermediate commits add workspace importers ahead of the lock;
  bisect with `--no-frozen-lockfile`."*
- **Rejected:** front-loading the lock into commit 1 fails identically (importers point at demo
  manifests that don't exist yet) while destroying reviewability. Collapsing to 3 stream commits still
  leaves 2 broken middles and loses the seams.
- **On failure:** intermediate `--frozen-lockfile` failure is expected — ignore. Failure at **HEAD** →
  **STOP**; do not regenerate or hand-edit. That means the tree's lock already disagrees with its
  manifests: a pre-existing defect to adjudicate, not paper over.
- **Never run `pnpm install` during the landing sequence** — it would mutate the lock mid-run and
  invalidate the pre-landing green `pnpm e2e`.

## Authorised pre-landing fixes

Exactly three, all inside commit 6, each a prerequisite for a runnable fresh clone:

- **F1** — new `demos/qwik/.gitignore` containing `server/`, `.qwik/`, `tmp/`.
- **F2** — `demos/qwik/package.json`: add `mkdirSync('src/emitted',{recursive:true})` to `copy-emitted`,
  verbatim from the react-official/solid-official form.
- **F3** — `demos/qwik/package.json`: add `"preview": "pnpm build && vite preview"`.

**Nothing else.** No dep moves, no `pack` edits, no README additions, no `vite.config.ts` changes, no e2e lanes.

## Deferred, with named targets

| Item | Target |
|---|---|
| e2e lanes for `demos/{react-official,solid-official,qwik}` (the T001 oracle gap) | **T003** |
| README: Qwik row, "More frameworks" row, three-way walkthrough | **T005** |
| Document *why* `demos/qwik` pins vite 7.3.1 (guards a silent catalog bump) | **T005** |
| Ports for the one-command runner; a `dev` script for demos/qwik if needed | **T005** |
| Move `eslint`/`@eslint/js`/`globals` to devDeps; `@qwik.dev/core` to a peer (keep `oxfmt` runtime) | out of tranche |
| Add `@frameless/qwik` to the `pack` array | out of tranche |
| `scripts/regenerate-persistence.ts` for the react/solid P1 goldens | out of tranche |

## Owner question (non-blocking)

`@frameless/qwik` packaging hygiene before the branch becomes public: it ships `eslint`, `@eslint/js`,
`globals` under runtime `dependencies` (unused), `@qwik.dev/core` as a hard dep rather than a peer, and
is absent from `pack` despite declaring `publishConfig` exports at `./dist`. It is `private: true`, so
nothing publishes and the oracle is unaffected — but fixing it forces a lockfile regeneration.

- **(a)** Land as-is; fix out-of-tranche after the demo ships. *(default — T002 proceeds on this)*
- **(b)** Insert a chore commit before the lock commit, accepting a lock regeneration plus a mid-landing `pnpm e2e` re-run.
