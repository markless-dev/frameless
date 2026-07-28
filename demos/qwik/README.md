# demos/qwik — the resume half of the three-way comparison

An unmodified `pnpm create qwik` app that imports the Frameless-emitted Qwik
output and nothing else. It is the third lane of the activation-neutrality
proof: React hydrates, Solid hydrates, **Qwik resumes**, same observable
behavior. See the walkthrough in the [root README](../../README.md#see-it-yourself-hydrate-hydrate-resume).

```sh
pnpm --dir demos/qwik dev      # http://localhost:5175/ (also booted by `pnpm demo`)
pnpm --dir demos/qwik preview   # production build, served by vite preview
```

Routes: `/` (S1, render-once counter), `/s2/` (S2, keyed to-do), `/s3/` (S3,
event form). The Qwik router normalises the nested routes to a trailing slash.

| Path                | What it is                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/emitted/*.tsx` | Copied verbatim from `packages/frameworks/qwik/generated/` by `copy-emitted`. Never edited by hand.                    |
| `src/routes/**`     | Scaffold route files that do nothing but render the emitted component.                                                 |
| `vite.config.ts`    | Exactly what `pnpm create qwik` produced: `qwikRouter()` + `qwikVite()`.                                               |
| `scenarios.box.ts`  | The `@async/witness` lane run by `pnpm e2e`, driving the shared contract in `../react-official/three-way-contract.ts`. |

## Why vite is pinned to 7.3.1

`devDependencies.vite` here is an exact `7.3.1`, not the workspace `catalog:`
that every other package uses. The reason on record is narrow and worth stating
precisely:

**7.3.1 is the version the official `pnpm create qwik` scaffold produced for
`@qwik.dev/core` 2.0.0-beta.38.** That is the entire justification. It is
recorded at `docs/goals/frameless-qwik-v1/state.yaml:421` — "vite 7.3.1 per the
pnpm-create-qwik scaffold."

**There is no evidence that vite 8 breaks Qwik.** It has not been tried, so no
incompatibility is claimed here. 7.3.1 coexists fine with the root catalog's
vite 8 — pnpm installs both, and the rest of the workspace is unaffected.

Moving this to `catalog:` is therefore _unverified_, not _forbidden_. If you
want to do it, treat it as a real change: bump it, then require a green
`pnpm e2e` — specifically the qwik three-way lane, which asserts the resume
behavior (`q:container` transition and on-demand handler QRL fetches) that a
build-tooling regression would be most likely to disturb. Do not bump it on the
strength of "it installed."

## Build output

`server/`, `.qwik/`, `tmp/` and `dist/` are generated and gitignored. `pnpm
build` regenerates them; a fresh clone does not need them.
