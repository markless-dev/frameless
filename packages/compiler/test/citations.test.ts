import { describe, expect, test } from 'vitest';
import {
	EXCLUDED_FILES,
	NOT_YET_WATCHED,
	THIRD_PARTY_TARGETS,
	WATCHED,
	classify,
	findCitations,
	integrityProblems,
	scanRepository,
	scanText,
} from '../../../scripts/check-citations.mjs';

/**
 * T053 — the citation-ordinal guard's own suite.
 *
 * Four tasks hand-corrected citations in these files before this check existed,
 * and T048 measured that five of the eight ordinals it touched had ALREADY
 * drifted. So the substantive assertion here is not "the docs are clean today" —
 * a sweep can buy that — it is that a check exists which SAYS SO EVERY RUN, and
 * which is calibrated to go red when it should.
 */
describe('T053 citation-ordinal guard', () => {
	test('the watched documentation carries no first-party bare ordinals', () => {
		const { violations, integrity } = scanRepository();
		expect(integrity).toEqual([]);
		expect(
			violations.map((v) => `${v.file}:${v.lineNumber} ${v.raw} — ${v.kind}`),
		).toEqual([]);
	});

	test('every ruling carries a reason, so an exclusion is never an unexplained omission', () => {
		const listed = [...WATCHED, ...NOT_YET_WATCHED, ...EXCLUDED_FILES, ...THIRD_PARTY_TARGETS];
		expect(listed.length).toBeGreaterThan(0);
		for (const entry of listed) expect(entry.reason.length).toBeGreaterThan(40);
	});

	/**
	 * RED CALIBRATION. Each case is a shape this repository actually contained
	 * before T053 cleared it. A guard that cannot name them is decoration.
	 */
	describe('goes red on a planted first-party ordinal', () => {
		test('a path citation into a repository file', () => {
			const found = scanText('`StateWriteRecord` (`packages/compiler/src/schema.ts:266`) records');
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('first-party-ordinal');
			expect(found[0].path).toBe('packages/compiler/src/schema.ts');
		});

		test('a bare ordinal, attributed to the path it inherits', () => {
			const found = scanText('the rule in `packages/compiler/src/build.ts`, at :420, lands it');
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('first-party-ordinal');
			expect(found[0].inheritedFrom).toContain('packages/compiler/src/build.ts');
		});

		test('a bare ordinal inheriting across lines within one paragraph', () => {
			const found = scanText(
				'`packages/frameworks/qwik/src/emitter/index.ts:498`\nand `:642` throw the same error.',
			);
			expect(found.map((v) => v.raw)).toEqual([
				'packages/frameworks/qwik/src/emitter/index.ts:498',
				':642',
			]);
			expect(found[1].inheritedFrom).toContain('qwik/src/emitter/index.ts');
		});

		test('a sentence-final ordinal and a slash-joined pair — the two shapes a naive lookahead drops', () => {
			expect(scanText('restates it at `scripts/e2e.mjs`, lines :475 and :535.')).toHaveLength(2);
			expect(scanText('the throw at `scripts/e2e.mjs` :498/:642 is live')).toHaveLength(2);
		});

		test('an unqualified emitted-output path, which points at a file the emitter regenerates', () => {
			const found = scanText('eight shipped instances: `S2.vue:14`, `generated/S2.jsx:42`');
			expect(found.map((v) => v.kind)).toEqual(['unclassified-path', 'unclassified-path']);
		});

		test('a bare ordinal with nothing to inherit from', () => {
			const found = scanText('the throw at :498 is a live possibility');
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('unresolvable-bare-ordinal');
		});

		test('a blank line ends the paragraph, so inheritance cannot reach across it', () => {
			const found = scanText('see `packages/compiler/src/build.ts`\n\nand the throw at :420');
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('unresolvable-bare-ordinal');
		});
	});

	/**
	 * THE EXCLUSIONS ARE RULINGS, AND THEY ARE LOAD-BEARING. Each one is exercised
	 * here rather than left to a regex that happens to miss it.
	 */
	describe('stays green where the board has ruled the ordinal correct', () => {
		test('third-party build artifacts keep their ordinals, with the reason attached', () => {
			for (const target of THIRD_PARTY_TARGETS) {
				const verdict = classify({ path: target.suffix, ordinal: '1', inheritedFrom: null });
				expect(verdict.verdict).toBe('allowed');
				expect(verdict.reason).toBe(target.reason);
			}
		});

		test("Angular's `_debug_node-chunk.mjs` and the bare ordinal that inherits it", () => {
			// The exact shape the PM ratified on T048: `(:8590)` carries no file of its
			// own, so it IS the `_debug_node-chunk.mjs` citation before it.
			expect(scanText('`_debug_node-chunk.mjs:8516` and `outputBinding` (:8590)')).toEqual([]);
		});

		test('paths outside the repository', () => {
			expect(scanText('`/Users/someone/elsewhere/packages/compiler/src/build.ts:420`')).toEqual([]);
			expect(scanText('`node_modules/vue/dist/some-internal.js:12`')).toEqual([]);
		});

		test('board receipts in state.yaml are dated historical records', () => {
			const rule = EXCLUDED_FILES.find((entry) =>
				entry.match.test('docs/goals/frameless-defects-and-targets-v1/state.yaml'),
			);
			expect(rule).toBeDefined();
			expect(WATCHED.map((entry) => entry.path)).not.toContain(
				'docs/goals/frameless-defects-and-targets-v1/state.yaml',
			);
		});

		test('a repository path with no ordinal at all is not a citation defect', () => {
			expect(scanText('`persistenceStatements()` in `packages/compiler/src/build.ts`')).toEqual([]);
		});

		test('shapes that merely look like ordinals', () => {
			expect(scanText('served from `scripts/e2e.mjs` at http://localhost:5173 in 12:30')).toEqual([]);
			expect(scanText('`vue@3.5.40` is in the lockfile at two importers')).toEqual([]);
		});
	});

	/**
	 * A guard whose scope can be quietly emptied is not a guard. These are the
	 * failures that fire when the check itself is neutered rather than the docs.
	 */
	describe('integrity of its own scope', () => {
		test('the live top-level docs are all classified, and every named file exists', () => {
			expect(integrityProblems()).toEqual([]);
			expect(WATCHED.length).toBeGreaterThan(0);
		});

		test('a citation is found at all — the detector is not silently matching nothing', () => {
			expect(
				findCitations('`packages/compiler/src/schema.ts:266` and `runtime-dom.cjs.js:1515`'),
			).toHaveLength(2);
		});
	});
});
