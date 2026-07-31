// Puts the shadcn/ui token layer and this repo's Codex-clone component sheet into
// one lane's static-asset directory.
//
// SAME SHAPE AS `copy-todomvc-css.mjs`, AND FOR THE SAME MEASURED REASON. The six
// official demos serve static assets from directories they own — `public/` for five
// of them, `static/` for SvelteKit — and one of the six, angular-official, is built
// by `@angular/build` rather than by a Vite config this repo controls, so a `?url`
// import of a file outside the project root is not available in every lane. The only
// shape that works uniformly is a real file under each lane's asset root, and the
// only way to have six of those without six things to maintain is to DERIVE them.
// Delete the copies, re-run, compare digests.
//
// Everything lands under `<asset-root>/shadcn-theme/`, so every lane serves the pair
// at the identical URLs `/shadcn-theme/tokens.css` and `/shadcn-theme/codex.css`.
// The route wiring in each lane links those two paths and nothing else, which is what
// lets the pages be compared as like for like.
//
// ---------------------------------------------------------------------------
// WHY ONE FILE IS COPIED AND THE OTHER IS DERIVED, WHICH IS THE ONE PLACE THIS
// SCRIPT DEPARTS FROM ITS TodoMVC SIBLING.
//
// `todomvc-app-css@2.4.3` is a plain browser stylesheet, so vendoring it verbatim and
// linking the same bytes is both the honest move and the working one. The shadcn/ui
// default theme is NOT a browser stylesheet. Its published form — `theming-default.css`
// here, the verbatim "Default Theme CSS" block from the docs — opens with
// `@import "tailwindcss"`, declares its radius scale inside `@theme inline`, and ends
// in a `@layer base` block of `@apply` rules. A browser DROPS an unknown at-rule and
// everything inside it, so linking those bytes directly would silently define none of
// `--radius-sm/md/lg/xl` and none of the `@apply`ed base rules. The file would load,
// report no error, and be half a theme.
//
// So the upstream bytes stay VERBATIM and UNLINKED as the source of truth, and the
// linked `tokens.css` is MECHANICALLY DERIVED from them at copy time by
// `deriveTokens()` below: the `:root` and `.dark` DECLARATIONS pass through
// unchanged, THEIR TWO SELECTORS DO NOT — see the next block — and the `--radius-*`
// scale is lifted out of `@theme inline` into the root block, where a browser will
// actually honour it. The derivation is deliberately dumb — it copies declaration
// text and never computes a value — so a token whose upstream value changes cannot
// fail to move here, and `deriveTokens()` THROWS rather than emitting a partial file
// if any of the three blocks it needs is missing.
//
// ---------------------------------------------------------------------------
// AND THE TWO SELECTORS ARE RAISED TO (0,2,0), WHICH IS THE ONE PLACE THIS FILE
// STOPS BEING A PASS-THROUGH. RULED AT frameless-app-axes-v1 T019, LANDED BY T021.
//
// `:root` is emitted as `:root:root` and `.dark` as `:root.dark, :root .dark`.
// NO VALUE, NO DECLARATION AND NO UPSTREAM BYTE MOVES — the diff is those two
// lines and nothing else.
//
// WHY. The three create-vite scaffolds declare 13 custom properties of their own
// and this file emits 39; EXACTLY TWO NAMES COLLIDE, `--accent` and `--border`,
// and both sides declare them on the SAME element from a bare `:root`, which is
// (0,1,0) on both sides. Only source order can separate a tie, and no rule in a
// page sheet can reach a token it does not itself declare — which is why
// `habits.css`'s, `board.css`'s, `contacts.css`'s and `codex.css`'s `:has()`
// hardening drove /hn and /hn-item to 0 and left a residual on these four pages.
// The residual IS a selector problem; it is just not one the PAGE sheets can fix.
//
// MEASURED, T021, chromium 1440x1000, RAW differing pixels: with each lane's own
// scaffold bytes forced in as the LAST stylesheet node, /habits, /board,
// /contacts and /codex read 13498 / 27301 / 37698 / 7303 with the bare selectors
// — 13956 / 27870 / 38351 / 7343 under an OS-dark client, because the scaffold
// declares the same two names A SECOND TIME inside `@media (prefers-color-scheme:
// dark) :root` — and 0 in all 24 of those cells with these. A media query changes
// MATCHING, not specificity, which is why the answer has to be a specificity bump.
//
// BOTH BLOCKS GET IT OR NEITHER DOES. `:root` and `.dark` are both (0,1,0) —
// `:root` is a pseudo-class and counts in the class column — so `.dark` wins
// today on SOURCE ORDER ALONE. Bumping only `:root` inverts dark mode: measured,
// 30 of the 31 `.dark` tokens fall back to their light value when `.dark` sits on
// `<html>` (the 31st, `--sidebar-primary-foreground`, is declared IDENTICALLY in
// both blocks and so cannot show it), and it is UNAFFECTED on a wrapper, because
// custom properties resolve by NEAREST DECLARING ANCESTOR, not by specificity.
// Equal (0,2,0) bumps preserve the file's own `:root` -> `.dark` source-order
// precedence in BOTH placements.
//
// NOT `@layer`: layered rules LOSE to unlayered ones, so wrapping this file would
// hand the race to the scaffold rather than settle it. NOT a rename of the host's
// two tokens either: those three sheets are the untouched official scaffold these
// demos exist to prove neutrality against, and `git log --follow` gives each
// EXACTLY ONE commit, the one that created it.
//
// THIS IS HARDENING A LATENT RACE, NOT REPAIRING A LIVE DEFECT. In dev AND in a
// production build, measured, `tokens.css` loads AFTER the scaffold in all three
// lanes, so it already wins and the observable diff is 0. These bumps make the
// outcome independent of that order.
//
// The tokens are MIT, "Copyright (c) 2023 shadcn"; see `shadcn-theme/LICENSE` and
// `shadcn-theme/README.md` for the exact source URL and commit. `codex.css` is this
// repo's own and is the only editable stylesheet here.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, 'shadcn-theme');

/**
 * Lifts the browser-honourable parts of the upstream theme out of its Tailwind
 * wrapper. Returns plain CSS: one root block carrying upstream's own `:root`
 * DECLARATIONS PLUS the `--radius-*` scale that upstream declares inside
 * `@theme inline`, then upstream's `.dark` DECLARATIONS.
 *
 * THE DECLARATIONS PASS THROUGH UNCHANGED; THE TWO SELECTORS DO NOT. `:root` is
 * emitted as `:root:root` and `.dark` as `:root.dark, :root .dark` — both (0,2,0),
 * both raised EQUALLY so this file's own `:root` -> `.dark` source-order precedence
 * survives, and bumping only one of them is a measured dark-mode inversion. The
 * long comment at the top of this file carries the numbers.
 *
 * THROWS on a missing block rather than emitting what it found. A partial theme is
 * the failure mode this whole file exists to avoid, and it is invisible in a browser.
 *
 * @param {string} upstream the verbatim contents of `theming-default.css`
 * @returns {string}
 */
export function deriveTokens(upstream) {
	/** @param {string} opener */
	const blockAfter = (opener) => {
		const start = upstream.indexOf(opener);
		if (start === -1) throw new Error(`shadcn theme: no ${JSON.stringify(opener)} block found`);
		const open = upstream.indexOf('{', start);
		const close = upstream.indexOf('}', open);
		if (open === -1 || close === -1)
			throw new Error(`shadcn theme: ${JSON.stringify(opener)} block is not closed`);
		return upstream.slice(open + 1, close).replace(/^\n|\s+$/g, '');
	};

	const rootDeclarations = blockAfter(':root {');
	const darkDeclarations = blockAfter('.dark {');
	const radiusScale = blockAfter('@theme inline {')
		.split('\n')
		.filter((line) => /^\s*--radius-/.test(line))
		.join('\n');
	if (radiusScale === '')
		throw new Error('shadcn theme: @theme inline declares no --radius-* tokens');

	return [
		'/* DERIVED, DO NOT EDIT. Written by demos/shared/copy-shadcn-theme.mjs from',
		' * demos/shared/shadcn-theme/theming-default.css, which is the verbatim',
		' * "Default Theme CSS" block from the shadcn/ui theming docs. MIT,',
		' * Copyright (c) 2023 shadcn. See demos/shared/shadcn-theme/README.md.',
		' *',
		' * The only transformation is structural: the --radius-* scale below is',
		' * declared by upstream inside `@theme inline`, which is an at-rule no',
		' * browser understands, so it is lifted into :root here. No VALUE is',
		' * computed, rewritten or reformatted anywhere in this file. */',
		':root:root {',
		rootDeclarations,
		'',
		'\t/* lifted verbatim out of upstream\'s `@theme inline` */',
		radiusScale,
		'}',
		'',
		':root.dark, :root .dark {',
		darkDeclarations,
		'}',
		'',
	].join('\n');
}

const assetRoot = process.argv[2];
if (assetRoot === undefined) {
	throw new Error(
		'copy-shadcn-theme.mjs needs the lane-relative asset root, e.g. `node ../shared/copy-shadcn-theme.mjs public`.',
	);
}

const target = resolve(process.cwd(), assetRoot, 'shadcn-theme');
mkdirSync(target, { recursive: true });
writeFileSync(
	resolve(target, 'tokens.css'),
	deriveTokens(readFileSync(resolve(source, 'theming-default.css'), 'utf8')),
);
copyFileSync(resolve(source, 'codex.css'), resolve(target, 'codex.css'));
