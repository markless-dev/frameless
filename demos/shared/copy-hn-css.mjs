// Copies the Hacker News stylesheet into one lane's static-asset directory.
//
// SAME SHAPE AS `copy-todomvc-css.mjs` AND `copy-shadcn-theme.mjs`, and for the
// same measured reason: the six official demos serve static assets from
// directories they own - `public/` for five of them, `static/` for SvelteKit -
// and angular-official is built by `@angular/build` rather than by a Vite config
// this repo controls, so a `?url` import of a file outside the project root is
// not available in every lane. The only shape that works uniformly is a real
// file under each lane's asset root, and the only way to have six of those
// without six things to maintain is to DERIVE them. It is asserted the same way:
// delete the copies, re-run, compare digests.
//
// The file lands at `<asset-root>/hn-css/hn.css`, so every lane serves it at the
// identical URL `/hn-css/hn.css` and the six `/hn` pages are like for like.
//
// ONE FILE, NOT A PAIR. The TodoMVC vendoring copies three sheets in cascade
// order because one of them is upstream's; `hn.css` is entirely this
// repository's own work (see ./hn-css/README.md - NOTHING was copied from
// news.ycombinator.com), so there is no upstream layer to load first and no
// cascade joint to get wrong.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, 'hn-css');

const stylesheets = ['hn.css'];

const assetRoot = process.argv[2];
if (assetRoot === undefined) {
	throw new Error(
		'copy-hn-css.mjs needs the lane-relative asset root, e.g. `node ../shared/copy-hn-css.mjs public`.',
	);
}

const target = resolve(process.cwd(), assetRoot, 'hn-css');
mkdirSync(target, { recursive: true });
for (const name of stylesheets) {
	copyFileSync(resolve(source, name), resolve(target, name));
}
