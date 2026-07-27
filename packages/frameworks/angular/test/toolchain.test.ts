import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';
import { describe, expect, test } from 'vitest';

/**
 * THE ASSERTED TOOLCHAIN FACT frameless-angular-v1 T002 ruling 1 requires.
 *
 * ## What is being mitigated
 *
 * `@angular/build` lists `vite` as an EXACT DEPENDENCY, not a peer dependency.
 * The workspace catalog (`pnpm-workspace.yaml`) pins `vite: ^8.0.16` for every
 * other lane in this repo, and that pin CANNOT REACH THE ANGULAR LANE EVEN IN
 * PRINCIPLE — there is no shared surface to pin, because Angular vendors its own
 * copy. T002 accepted that on the ground that a vendored Vite is what official
 * Angular tooling IS, and blocking on it would be blocking on the scaffold being
 * official. It named three things the repo gives up in exchange:
 *
 *   (a) a Vite CVE or bugfix bump in the catalog never reaches the Angular lane;
 *   (b) the lane's Vite version is invisible at `pnpm-workspace.yaml`, so a
 *       reader of the catalog will believe the repo is on Vite 8 everywhere;
 *   (c) an `@angular/build` patch can move Vite under the lane with NO FILE IN
 *       THIS REPO CHANGING.
 *
 * (c) is the one a test can do something about, and this is that test: the
 * divergence becomes a declared entry something re-reads on every `pnpm test`,
 * so it goes RED on drift instead of drifting silently. It is the
 * baseline-form-inventory discipline applied to the toolchain.
 *
 * EXPLICITLY REFUSED by the same ruling, and still refused: a `pnpm.overrides`
 * entry forcing the Angular lane onto catalog Vite. That is a hand-rolled build
 * harness by another name — it would replace the Vite version Angular tested
 * against with one it did not.
 *
 * ## Why this file lives in a NODE-ONLY package that never imports Angular
 *
 * `packages/frameworks/angular` is deliberately free of `@angular/core`,
 * `@angular/build` and the vendored Vite — that structural separation is what
 * GUARANTEES Vite 7 and Vite 8 never meet in one package. Nothing below imports
 * any of them. It resolves package.json files off disk and reads version
 * strings, which is a filesystem observation, not a dependency.
 *
 * SCOPE CORRECTION (T007). The sentence above is true as literally written and
 * it was cited as the STRUCTURAL DISCHARGE of ruling 1. IT DISCHARGES ONLY THE
 * VITE-MEETS-VITE HAZARD. It says nothing about the hazard that actually
 * occurred, which runs the OTHER WAY: in a pnpm workspace, this lane's
 * dependency closure becomes a candidate PROVIDER for every other lane's
 * UNSATISFIED OPTIONAL PEERS. Landing the Angular lane moved `esbuild`, `sass`,
 * `jsdom`, `prettier`, `chokidar` (a MAJOR, 4 → 5) and `lru-cache` into peer
 * slots the other five lanes left open, changing the peer-resolution identity
 * of twenty-five packages including `@async/witness` — the e2e instrument
 * itself. The lane is exempt from the catalog AND is a provider into the peer
 * graph the catalog governs: two relationships, opposite directions, and
 * ruling 1 examined one of them.
 *
 * EVERY TEST IN THIS FILE WAS GREEN THROUGHOUT THAT EVENT, and would be again.
 * It asserts version literals for names it already knows; the failure mode was
 * an UNLISTED NAME APPEARING. That is not a defect in these assertions — they
 * are all still true and are all still worth keeping — it is a statement of
 * what they do not cover.
 *
 * THE OTHER DIRECTION IS ASSERTED IN
 * `packages/compiler/test/package-inventory.test.ts`,
 * `describe('workspace peer-resolution inventory')`, which asserts the SET of
 * workspace peer atoms rather than the versions of known ones. The two must not
 * overlap: Angular-lane-internal toolchain facts live here, the cross-lane peer
 * graph lives there, or one will be maintained and the other rotted.
 * Measurement and ruling:
 * `docs/goals/frameless-angular-v1/notes/T007-toolchain-leak.md`.
 *
 * The versions are read where they actually resolve, not where they are
 * declared: `@angular/build`'s own `require` is what decides which Vite
 * `ng build` loads, so that is the require used.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const DEMO_PACKAGE = resolve(REPO_ROOT, 'demos/angular-official/package.json');
const ROOT_PACKAGE = resolve(REPO_ROOT, 'package.json');

const demoRequire = createRequire(DEMO_PACKAGE);
const rootRequire = createRequire(ROOT_PACKAGE);

function versionOf(require_: NodeJS.Require, packageName: string): string {
	const manifest = require_(`${packageName}/package.json`) as { version: string };
	return manifest.version;
}

/** `@angular/build`'s own resolution — the one `ng build` runs against. */
const angularBuildManifestPath = demoRequire.resolve('@angular/build/package.json');
const angularBuildRequire = createRequire(angularBuildManifestPath);
const angularBuildManifest = demoRequire('@angular/build/package.json') as {
	version: string;
	dependencies: Record<string, string>;
};

describe('the Angular lane vendors its own Vite, and that is asserted rather than assumed', () => {
	// The recorded literals. Every one of these was READ, not predicted, and a
	// drift in any of them is meant to fail this file loudly.
	const VENDORED_VITE = '7.3.6';
	const CATALOG_VITE = '8.0.16';
	const ANGULAR = '22.0.8';

	test('@angular/build declares vite as an EXACT version, so the catalog cannot reach it', () => {
		// This is the whole reason the mitigation exists. A range here would mean
		// the catalog could in principle influence the resolution and the ruling's
		// premise would have changed.
		expect(angularBuildManifest.dependencies['vite']).toBe(VENDORED_VITE);
		expect(angularBuildManifest.dependencies['vite']).not.toMatch(/[\^~*x<>|]/);
	});

	test('the Vite @angular/build actually resolves is the recorded one', () => {
		expect(versionOf(angularBuildRequire, 'vite')).toBe(VENDORED_VITE);
	});

	test('the workspace catalog resolves a DIFFERENT Vite, so the divergence is real', () => {
		// If these two ever coincide the divergence has closed, and this test
		// failing is the notification. A green here would otherwise be ambiguous
		// between "the mitigation works" and "there was nothing to mitigate".
		expect(versionOf(rootRequire, 'vite')).toBe(CATALOG_VITE);
		expect(versionOf(rootRequire, 'vite')).not.toBe(versionOf(angularBuildRequire, 'vite'));
	});

	test('the Angular packages the lane is proven against are the recorded ones', () => {
		// The e2e activation-neutrality claim is made AT A VERSION. IR-4 and the
		// idiom policy's Gate 6 deferral are both scoped to "a lane landed at a
		// pinned lockfile version", so the version has to be readable from a test
		// rather than from a lockfile diff.
		expect(angularBuildManifest.version).toBe(ANGULAR);
		expect(versionOf(demoRequire, '@angular/cli')).toBe(ANGULAR);
		expect(versionOf(demoRequire, '@angular/core')).toBe(ANGULAR);
		expect(versionOf(demoRequire, '@angular/ssr')).toBe(ANGULAR);
	});

	test('the TypeScript split T003a ruled ASSERT-DO-NOT-PIN is where it was measured', () => {
		// Measured by T003a: `pnpm check` runs the catalog's TypeScript while the
		// Angular demo (and, through it, the lint arbiter's parser) resolves 6.0.3
		// off-catalog. That was ruled benign and deliberately NOT pinned — but it
		// arrives incidentally, so a change in it must be visible rather than
		// silent. Same class as the Vite fact, same reason.
		expect(versionOf(rootRequire, 'typescript')).toBe('5.9.3');
		expect(versionOf(demoRequire, 'typescript')).toBe('6.0.3');
	});

	// INSTRUMENT RULE 3, two-sided. An assertion never observed failing is not an
	// assertion, and every check above is an equality against a literal — the
	// shape most likely to rot into a tautology if the reader ever stops
	// returning a real value. These two arms prove the reader distinguishes.
	describe('calibration: the reads above can go red', () => {
		test('a wrong expected version fails', () => {
			expect(() =>
				expect(versionOf(angularBuildRequire, 'vite')).toBe('0.0.0-not-a-real-version'),
			).toThrow();
		});

		test('a version that is not there fails to resolve rather than reading as absent', () => {
			// The vacuity guard: if `versionOf` ever started returning undefined for
			// a missing package, every equality above would still be comparing
			// something, and a missing @angular/build would read as a pass at the
			// moment the whole premise vanished.
			expect(() => versionOf(angularBuildRequire, '@frameless/not-installed')).toThrow();
		});
	});
});
