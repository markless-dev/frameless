// Copies the task-board stylesheet into one lane's static-asset directory.
//
// SAME SHAPE AS `copy-habit-css.mjs`, `copy-hn-css.mjs`, `copy-todomvc-css.mjs`
// and `copy-shadcn-theme.mjs`, and for the same measured reason: the six
// official demos serve static assets from directories they own - `public/` for
// five of them, `static/` for SvelteKit - and angular-official is built by
// `@angular/build` rather than by a Vite config this repo controls, so a `?url`
// import of a file outside the project root is not available in every lane. The
// only shape that works uniformly is a real file under each lane's asset root,
// and the only way to have six of those without six things to maintain is to
// DERIVE them. It is asserted the same way: delete the copies, re-run, compare
// digests.
//
// The file lands at `<asset-root>/board-css/board.css`, so every lane serves it
// at the identical URL `/board-css/board.css` and the six `/board` pages are
// like for like.
//
// ONE FILE, NOT A PAIR - BUT IT IS ONE HALF OF A PAIR AT LINK TIME. `board.css`
// is entirely this repository's own work (see ./board-css/README.md - NOTHING
// was copied from the Square UI template, whose licence forbids derivatives in
// any repository), so there is no upstream layer to copy alongside it. Its
// COLOURS, however, are all `var(--...)` tokens from the vendored MIT shadcn
// default theme, which `copy-shadcn-theme.mjs` writes to
// `<asset-root>/shadcn-theme/tokens.css`. Every lane's `/board` route therefore
// links BOTH, tokens FIRST. Each lane already runs `copy-shadcn-theme` for the
// `/codex` and `/habits` routes, so no lane gains a second dependency here.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, 'board-css');

const stylesheets = ['board.css'];

const assetRoot = process.argv[2];
if (assetRoot === undefined) {
	throw new Error(
		'copy-board-css.mjs needs the lane-relative asset root, e.g. `node ../shared/copy-board-css.mjs public`.',
	);
}

const target = resolve(process.cwd(), assetRoot, 'board-css');
mkdirSync(target, { recursive: true });
for (const name of stylesheets) {
	copyFileSync(resolve(source, name), resolve(target, name));
}
