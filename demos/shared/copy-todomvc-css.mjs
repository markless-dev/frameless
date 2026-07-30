// Copies the TodoMVC stylesheet pair into one lane's static-asset directory.
//
// WHY A SCRIPT AND NOT SIX HAND-KEPT COPIES. The six official demos serve static
// assets from directories they own — `public/` for five of them, `static/` for
// SvelteKit — and one of the six, angular-official, is built by `@angular/build`
// rather than by a Vite config this repo controls, so a `?url` import of a file
// outside the project root is not available in every lane. The only shape that
// works uniformly is a real file under each lane's asset root, and the only way to
// have six of those without six things to maintain is to DERIVE them. This is the
// same move `copy-emitted` already makes for the emitted components, and it is
// asserted the same way: delete the copies, re-run, compare digests.
//
// Both files land under `<asset-root>/todomvc-app-css/`, so every lane serves them
// at the identical URLs `/todomvc-app-css/index.css` and
// `/todomvc-app-css/frameless-supplement.css`. The route wiring in each lane links
// those two paths and nothing else, which is what lets the six pages be compared
// as like for like.
//
// `index.css` is todomvc-app-css@2.4.3 verbatim; `frameless-supplement.css` is this
// repo's own. They are copied as a PAIR and in that order for a reason: the
// supplement overrides upstream declarations at equal specificity, so it is correct
// only while it loads second.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, 'todomvc-app-css');

/**
 * The THREE stylesheets, IN CASCADE ORDER, and the order is load-bearing at both
 * joints. `index.css` is upstream and must come first; `frameless-supplement.css`
 * overrides upstream declarations at equal specificity and is correct only while
 * it loads second; `frameless-advanced.css` overrides BOTH for the controls
 * TodoMVC Advanced adds and is correct only while it loads third.
 *
 * ALL THREE ARE COPIED INTO ALL SIX LANES, INCLUDING THE ONE THAT CANNOT LINK
 * THE THIRD. The angular lane has no `/todomvc-advanced` route at all, because
 * the angular emitter REFUSES S11 on its global-identifier ban and there is no
 * `S11.ts` to mount. Copying uniformly anyway is deliberate: this script's whole
 * contract is that the six asset roots are DERIVED and byte-identical, so that
 * `delete the copies, re-run, compare digests` stays a single check. Making one
 * lane's copy conditional would trade a real invariant for one unserved file.
 */
const stylesheets = ['index.css', 'frameless-supplement.css', 'frameless-advanced.css'];

const assetRoot = process.argv[2];
if (assetRoot === undefined) {
	throw new Error(
		'copy-todomvc-css.mjs needs the lane-relative asset root, e.g. `node ../shared/copy-todomvc-css.mjs public`.',
	);
}

const target = resolve(process.cwd(), assetRoot, 'todomvc-app-css');
mkdirSync(target, { recursive: true });
for (const name of stylesheets) {
	copyFileSync(resolve(source, name), resolve(target, name));
}
