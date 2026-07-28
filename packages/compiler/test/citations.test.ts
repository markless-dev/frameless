import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
	EXCLUDED_FILES,
	FOREIGN_REPOSITORY_TARGETS,
	NOT_YET_WATCHED,
	THIRD_PARTY_TARGETS,
	WATCHED,
	WATCHED_SOURCE,
	classify,
	commentsOnly,
	emitterClassificationProblems,
	findCitations,
	foreignShadowProblems,
	integrityProblems,
	listTrackedSourceFiles,
	scanRepository,
	scanText,
	sweepProblems,
	sweptSourceFiles,
} from '../../../scripts/check-citations.mjs';

const repoRoot = resolve(import.meta.dirname, '../../..');
const readDoc = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

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
		const listed = [
			...WATCHED,
			...WATCHED_SOURCE,
			...NOT_YET_WATCHED,
			...EXCLUDED_FILES,
			...THIRD_PARTY_TARGETS,
			...FOREIGN_REPOSITORY_TARGETS,
		];
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
	 * T054 — THE TWO NEW EXCLUSIONS, EACH PROVED STILL RED IN THE VERY DOCUMENT IT
	 * EXCLUDES. An exclusion that switches the check off for a whole file is not an
	 * exclusion, it is a hole, so each of these is exercised against the real
	 * document's real bytes with ONE first-party ordinal added.
	 */
	describe('T054 ruling 5 — another repository is not this repository', () => {
		test("markless' own paths keep their ordinals, with the reason attached", () => {
			for (const target of FOREIGN_REPOSITORY_TARGETS) {
				const verdict = classify({ path: target.path, ordinal: '1', inheritedFrom: null });
				expect(verdict.verdict).toBe('allowed');
				expect(verdict.kind).toBe('foreign-repository');
				expect(verdict.reason).toBe(target.reason);
			}
		});

		test("docs/report.md's markless citations are ruled, and the document is now clean", () => {
			// THE EXCLUSION DID NOT SILENCE THE DOCUMENT. T054 wrote this test to pin the
			// `poc/` residue that kept report.md out of WATCHED, saying the blocker could
			// not evaporate without a test going red. T055's RULING 7 resolved it - so the
			// tripwire fired exactly as designed, and what replaces it is the stronger
			// property: the file is clean AND ruling 5 still accounts for markless.
			const found = scanText(readDoc('docs/report.md'), 'docs/report.md');
			expect(found).toEqual([]);
			expect(WATCHED.map((entry) => entry.path)).toContain('docs/report.md');
			expect(NOT_YET_WATCHED.map((entry) => entry.path)).not.toContain('docs/report.md');
			// The markless paths are ALLOWED, not absent - the document still cites them.
			expect(readDoc('docs/report.md')).toContain('packages/web/src/render.ts:71');
		});

		test('AND IT IS STILL RED on a first-party ordinal in that same document', () => {
			const original = readDoc('docs/report.md');
			const planted = `${original}\n\nSee \`packages/compiler/src/build.ts:342\`.`;
			const added = scanText(planted, 'docs/report.md').filter(
				(violation) => violation.path === 'packages/compiler/src/build.ts',
			);
			expect(added).toHaveLength(1);
			expect(added[0].kind).toBe('first-party-ordinal');
			expect(scanText(original, 'docs/report.md')).toHaveLength(
				scanText(planted, 'docs/report.md').length - 1,
			);
		});

		test('the match is on the WHOLE path — an abbreviated foreign citation still fails', () => {
			const found = scanText('markless returns empty static HTML at `public-render/template.ts:164`');
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('unclassified-path');
		});

		test('a real repository file beats the list, so ruling 5 can never unwatch a live site', () => {
			// The ordering property in `classify`, stated as a test rather than a comment.
			expect(foreignShadowProblems()).toEqual([]);
			expect(
				foreignShadowProblems([
					{ path: 'packages/compiler/src/build.ts', repository: '@markless/compiler' },
				]),
			).toHaveLength(1);
			expect(
				classify({ path: 'packages/compiler/src/build.ts', ordinal: '342', inheritedFrom: null })
					.verdict,
			).toBe('violation');
		});
	});

	describe('T054 ruling 6 — a quoted transcript is evidence, not a citation', () => {
		test('an ordinal inside a fenced block is quoted output', () => {
			expect(
				scanText('```\n    at reanalyzeFunction (react/src/emitter/index.ts:150)\n```'),
			).toEqual([]);
		});

		test('AND THE SAME ORDINAL IN PROSE, one line later, is still red', () => {
			const found = scanText(
				'```\n    at reanalyzeFunction (react/src/emitter/index.ts:150)\n```\n' +
					'The throw is at `packages/frameworks/react/src/emitter/index.ts:150`.',
			);
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('first-party-ordinal');
			expect(found[0].lineNumber).toBe(4);
		});

		test('docs/DEFECTS.md is still red on a first-party ordinal planted in its prose', () => {
			// The document ruling 6 was written for, with its verbatim stack trace intact.
			const planted = `${readDoc('docs/DEFECTS.md')}\n\nSee \`packages/compiler/src/build.ts:342\`.`;
			const found = scanText(planted, 'docs/DEFECTS.md');
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('first-party-ordinal');
		});

		test('a fence ends the paragraph, so inheritance cannot tunnel through it', () => {
			const found = scanText('see `packages/compiler/src/build.ts`\n```\ncode\n```\nthe throw at :342');
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('unresolvable-bare-ordinal');
		});

		test('a tilde fence, and a longer closing fence, both close', () => {
			expect(scanText('~~~\n`packages/compiler/src/build.ts:342`\n~~~')).toEqual([]);
			expect(scanText('```\n`packages/compiler/src/build.ts:342`\n````')).toEqual([]);
		});
	});

	test('T054 — `.tsrx` is a citable extension, which it was not before', () => {
		// Measured on docs/report.md: its `poc/` evidence sites were invisible to the
		// detector entirely, which is why that file is NOT_YET_WATCHED rather than green.
		const found = scanText('the fixture at `poc/08-equivalence-results/src/fixtures/s2-keyed-todo.tsrx:4`');
		expect(found).toHaveLength(1);
		expect(found[0].kind).toBe('first-party-ordinal');
	});

	/**
	 * T055 RULING 7 — `poc/` IS FIRST-PARTY AND LIVE. There is no exclusion to
	 * exercise here, and that IS the ruling: the ordinary first-party rule applies
	 * to archived experiment fixtures unmodified, because the archive turned out to
	 * be edited after the citations into it were written.
	 */
	describe('T055 ruling 7 — an archived experiment record is not a dated record', () => {
		test('a `poc/` ordinal is an ordinary first-party violation, not an exemption', () => {
			const found = scanText(
				'the workaround at `poc/08-equivalence-results/src/wrappers/s1-visible.app.tsrx:5-12`',
			);
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('first-party-ordinal');
		});

		test('no ruling anywhere quietly exempts `poc/`', () => {
			// The ruling is the ABSENCE of an exclusion, so the thing to pin is that none
			// crept in. A `poc/` entry in any list would silently undo it.
			const paths = [
				...THIRD_PARTY_TARGETS.map((entry) => entry.suffix),
				...FOREIGN_REPOSITORY_TARGETS.map((entry) => entry.path),
				...NOT_YET_WATCHED.map((entry) => entry.path ?? entry.directory),
			];
			expect(paths.filter((path) => path.includes('poc/'))).toEqual([]);
			expect(EXCLUDED_FILES.some((rule) => rule.match.test('poc/08/src/a.tsrx'))).toBe(false);
		});

		test('the evidence for the ruling is still on disk: the cited fixtures exist', () => {
			// If these ever stop existing, `classify` silently downgrades them from
			// first-party-ordinal to unclassified-path — a different verdict for the same
			// text. Ruling 7 rests on them resolving, so it is asserted rather than assumed.
			for (const path of [
				'poc/08-equivalence-results/src/wrappers/s1-visible.app.tsrx',
				'poc/08-equivalence-results/src/fixtures/s2-keyed-todo.tsrx',
				'poc/08-equivalence-results/src/fixtures/s3-event-form.tsrx',
			])
				expect(
					classify({ path, ordinal: '4', inheritedFrom: null }).kind,
				).toBe('first-party-ordinal');
		});
	});

	/**
	 * T055 RULING 8 — SOURCE COMMENTS ARE WATCHED, CODE IS NOT. The separation is
	 * the whole safety argument: if a string literal or an import specifier could be
	 * read as a citation, the guard would go red on things that are not claims at
	 * all and get switched off. So it is exercised in BOTH directions.
	 */
	describe('T055 ruling 8 — comments are prose, code is not', () => {
		test('a citation in a line comment is found', () => {
			const found = scanText(commentsOnly('// see packages/compiler/src/build.ts:342\n'));
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('first-party-ordinal');
		});

		test('a citation in a doc comment is found, at its true line and column', () => {
			const source = 'const a = 1;\n/**\n * see `packages/compiler/src/build.ts:342` here\n */\n';
			const found = scanText(commentsOnly(source));
			expect(found).toHaveLength(1);
			expect(found[0].lineNumber).toBe(3);
			expect(found[0].column).toBe(source.split('\n')[2].indexOf('packages/') + 1);
		});

		test('A STRING LITERAL IS NOT A CITATION', () => {
			expect(scanText(commentsOnly("const p = 'packages/compiler/src/build.ts:342';\n"))).toEqual([]);
			expect(scanText(commentsOnly('const p = "packages/compiler/src/build.ts:342";\n'))).toEqual([]);
			expect(scanText(commentsOnly('const p = `packages/compiler/src/build.ts:342`;\n'))).toEqual([]);
		});

		test('an import specifier is not a citation', () => {
			expect(scanText(commentsOnly("import { build } from './build.ts:342';\n"))).toEqual([]);
		});

		test('a `//` inside a URL string does not open a comment and swallow the line', () => {
			const source = "fetch('https://example.com/x'); const q = 'packages/compiler/src/build.ts:342';\n";
			expect(scanText(commentsOnly(source))).toEqual([]);
		});

		test('a regex literal containing a slash does not desynchronise the lexer', () => {
			const source = 'const r = /a\\/\\/b/g;\nconst p = "packages/compiler/src/build.ts:342";\n';
			expect(scanText(commentsOnly(source))).toEqual([]);
		});

		test('an interpolation inside a template literal is still not prose', () => {
			const source = 'const t = `x ${cite("packages/compiler/src/build.ts:342")} y`;\n';
			expect(scanText(commentsOnly(source))).toEqual([]);
		});

		test('code and comment on the SAME line are separated, not the line dropped', () => {
			const source = "const p = 'src/a.ts:1'; // and packages/compiler/src/build.ts:342\n";
			const found = scanText(commentsOnly(source));
			expect(found).toHaveLength(1);
			expect(found[0].path).toBe('packages/compiler/src/build.ts');
		});

		test('geometry is preserved exactly, so reported line and column are the file’s', () => {
			const source = 'const a = 1;\n// b\n\n/* c */\n';
			expect(commentsOnly(source)).toHaveLength(source.length);
			expect(commentsOnly(source).split('\n')).toHaveLength(source.split('\n').length);
		});

		test('AND IT IS STILL RED on a planted ordinal in a real watched source file', () => {
			// The bar T054 set, applied to the newly watched file type: the scope is only
			// real if the guard still fires INSIDE one of the files it now watches.
			const original = readDoc('packages/frameworks/solid/src/emitter/index.ts');
			expect(scanText(commentsOnly(original))).toEqual([]);
			const planted = `${original}\n// See packages/compiler/src/build.ts:342.\n`;
			const found = scanText(commentsOnly(planted));
			expect(found).toHaveLength(1);
			expect(found[0].kind).toBe('first-party-ordinal');
			expect(found[0].path).toBe('packages/compiler/src/build.ts');
		});

		test('planting it in CODE in that same file changes nothing — the separation is the point', () => {
			const original = readDoc('packages/frameworks/solid/src/emitter/index.ts');
			const planted = `${original}\nconst where = 'packages/compiler/src/build.ts:342';\n`;
			expect(scanText(commentsOnly(planted))).toEqual([]);
		});

		test('every lane emitter is watched, and a seventh lane cannot arrive unruled', () => {
			const classified = new Set([
				...WATCHED.map((entry) => entry.path),
				...WATCHED_SOURCE.map((entry) => entry.path),
			]);
			expect(emitterClassificationProblems(classified)).toEqual([]);
			expect(
				emitterClassificationProblems(classified, [
					'packages/frameworks/newlang/src/emitter/index.ts',
				]),
			).toHaveLength(1);
			for (const lane of ['react', 'solid', 'qwik', 'svelte', 'vue', 'angular'])
				expect(WATCHED_SOURCE.map((entry) => entry.path)).toContain(
					`packages/frameworks/${lane}/src/emitter/index.ts`,
				);
		});

		test('the scope cannot be emptied by breaking the separator', () => {
			// ANTI-VACUITY. A watched source file whose comments vanish reads as green, so
			// `integrityProblems` refuses it. Both halves are pinned: a file with no prose
			// produces nothing (the shape that trips it), and every file actually watched
			// today carries far more than the threshold.
			expect(commentsOnly('const a = 1;\nexport { a };\n').trim()).toBe('');
			for (const entry of WATCHED_SOURCE)
				expect(
					commentsOnly(readDoc(entry.path)).replaceAll(/\s/g, '').length,
				).toBeGreaterThan(200);
		});
	});

	/**
	 * T055 RULING 9 — CONTINUED ORDINAL LISTS. T054 measured the hole and declined
	 * to patch it because the obvious widening fires on prose. What is asserted here
	 * is BOTH halves: the shape it now catches, and the prose it must never catch.
	 */
	describe('T055 ruling 9 — a comma-continued list is several citations', () => {
		test('the exact shape T054 measured and could not see', () => {
			const found = scanText(
				'the assertion at `packages/frameworks/react/test/emitter.test.ts:133-134,141,150`',
			);
			expect(found.map((violation) => violation.raw)).toEqual([
				'packages/frameworks/react/test/emitter.test.ts:133-134',
				',141',
				',150',
			]);
			for (const violation of found)
				expect(violation.path).toBe('packages/frameworks/react/test/emitter.test.ts');
		});

		test('IT MUST NOT FIRE ON PROSE NUMERALS — the reason T054 left it open', () => {
			expect(scanText('in 2026, 141 tests passed in `packages/compiler/src/build.ts`')).toEqual([]);
			expect(scanText('we ran 1,055 tests over `packages/compiler/src/build.ts`')).toEqual([]);
			expect(scanText('at 12:30, 141 tests passed')).toEqual([]);
		});

		test('THE SPACED VARIANT IS THE GAP THAT STANDS, and this is it written down', () => {
			// `build.ts:12, 141` and "at `build.ts:12`, 141 tests passed" are the same
			// bytes with different meanings, so the guard reports the first citation only.
			// Recorded as a test rather than a comment so the decision cannot be mistaken
			// for an oversight by whoever next widens this.
			const found = scanText('see `packages/compiler/src/build.ts:12, 141` for both');
			expect(found).toHaveLength(1);
			expect(found[0].raw).toBe('packages/compiler/src/build.ts:12');
		});

		test('a continuation of a BARE ordinal inherits the same antecedent', () => {
			const found = scanText('`packages/compiler/src/build.ts`, at :420,431 and later');
			expect(found.map((violation) => violation.raw)).toEqual([':420', ',431']);
			expect(found[1].inheritedFrom).toContain('packages/compiler/src/build.ts');
		});

		test('a continuation cannot cross a fence or resurrect an allowed ruling', () => {
			expect(scanText('```\n`packages/compiler/src/build.ts:12,141`\n```')).toEqual([]);
			expect(scanText('`_debug_node-chunk.mjs:8516,8590` is the same chunk')).toEqual([]);
		});

		test('ADJACENCY IS REQUIRED IN BOTH DIRECTIONS, which is what keeps it off prose', () => {
			// A comma that does not abut the ordinal, and a comma not followed by digits,
			// are both ordinary punctuation. Only `:<digits>,<digits>` continues.
			expect(scanText('see `packages/compiler/src/build.ts:12` ,141 later')).toHaveLength(1);
			expect(scanText('see `packages/compiler/src/build.ts:12,and` later')).toHaveLength(1);
			expect(scanText('see `packages/compiler/src/build.ts:12,141`')).toHaveLength(2);
		});
	});

	/**
	 * T056 RULING 10 — THE SWEEP, which is what CLOSED this class rather than
	 * widening it a fourth time. T053, T054 and T055 each watched a longer named set
	 * and each left a recorded remainder. What is asserted here is the property that
	 * replaced the list: a tracked source file is checked because it is checked in,
	 * not because someone remembered to name it.
	 */
	describe('T056 ruling 10 — every tracked source file is swept', () => {
		test('a file in no list at all is still covered', () => {
			// The plant that proved this ran against `packages/compiler/src/dump.ts`, a
			// file named in NO ruling: the guard reported both the path citation and the
			// bare ordinal that inherits it, then exited 1. Pinned here as membership so
			// it cannot quietly fall out of scope.
			const swept = sweptSourceFiles();
			expect(swept).toContain('packages/compiler/src/dump.ts');
			expect(swept).toContain('packages/compiler/src/schema.ts');
			expect(
				scanText(
					commentsOnly('// see `packages/compiler/src/build.ts:428`, and also :429 nearby.\n'),
				).map((violation) => violation.raw),
			).toEqual(['packages/compiler/src/build.ts:428', ':429']);
		});

		test('ONLY A `path` RULING EXEMPTS — a `directory` one cannot re-blind the sweep', () => {
			// This is the whole safety property. T055 recorded `packages/frameworks`,
			// `packages/compiler/test` and `demos` as directory-shaped remainders; if a
			// directory entry suppressed the sweep, re-adding one would silently exempt
			// six lanes from the check written to cover them. So the exempted set is
			// asserted to be EXACTLY the by-path rulings, with nothing else in it.
			const tracked = listTrackedSourceFiles();
			const swept = new Set(sweptSourceFiles());
			const exempt = tracked.filter((path) => !swept.has(path));
			const byPath = new Set([
				...WATCHED_SOURCE.map((entry) => entry.path),
				...NOT_YET_WATCHED.filter((entry) => entry.path).map((entry) => entry.path),
			]);
			expect(exempt.filter((path) => !byPath.has(path))).toEqual([]);
			// And the same property stated from the directory side: living under a
			// NOT_YET_WATCHED directory exempts nothing. Every tracked source file below
			// one is still swept unless it is ALSO ruled by its own path.
			for (const entry of NOT_YET_WATCHED) {
				if (!entry.directory) continue;
				const under = tracked.filter((path) => path.startsWith(`${entry.directory}/`));
				for (const path of under) if (!byPath.has(path)) expect(swept.has(path)).toBe(true);
			}
		});

		test('the specimen text stays exempt, and it is the ONLY thing that is', () => {
			// T055's ruling stands: these two files QUOTE citation shapes in order to
			// define them. Everything else that is checked in is checked.
			const exemptSpecimens = NOT_YET_WATCHED.filter((entry) => entry.path).map(
				(entry) => entry.path,
			);
			expect(exemptSpecimens).toEqual([
				'scripts/check-citations.mjs',
				'packages/compiler/test/citations.test.ts',
			]);
			const swept = new Set(sweptSourceFiles());
			for (const path of exemptSpecimens) expect(swept.has(path)).toBe(false);
		});

		test('the ten files T056 cleared are watched BY NAME, not merely swept', () => {
			// Being swept is the floor. These ten each carry a written reason because each
			// was measured RED before it was cleared, and a reason is what stops the next
			// reader assuming the ordinals were never there.
			for (const path of [
				'packages/compiler/test/metamorphic.test.ts',
				'packages/compiler/test/generative.test.ts',
				'packages/frameworks/react/test/emitter.test.ts',
				'packages/frameworks/react/test/gate.test.ts',
				'packages/frameworks/solid/test/emitter.test.ts',
				'packages/frameworks/solid/test/gate.test.ts',
				'packages/frameworks/qwik/test/gate.test.ts',
				'packages/frameworks/angular/src/gate/index.ts',
				'packages/frameworks/vue/test/emitted-smoke.browser.test.ts',
				'demos/angular-official/scenarios.box.ts',
			])
				expect(WATCHED_SOURCE.map((entry) => entry.path)).toContain(path);
		});

		test('THE SWEEP CANNOT PASS VACUOUSLY — watched firing, not merely defined', () => {
			// If `git ls-files` ever fails softly the sweep finds nothing and every
			// unlisted file reads green. Both halves are pinned: the real enumeration is
			// plausible, and a broken one is refused.
			expect(sweepProblems()).toEqual([]);
			expect(listTrackedSourceFiles().length).toBeGreaterThan(100);
			expect(sweepProblems([])).toHaveLength(1);
			expect(sweepProblems(['a.ts', 'b.ts'])[0]).toContain('only 2 tracked source file(s)');
		});

		test('`.vue`/`.svelte` are out of the lexer, and that limit is MEASURED not assumed', () => {
			// Ruling 10 scopes to JS/TS because `commentsOnly` is a JS lexer. The honest
			// version of that limit is a measurement: no tracked `.vue`/`.svelte` file
			// carries a comment citation, so the scope hides nothing today.
			const markup = execFileSync('git', ['ls-files', '-z'], {
				cwd: repoRoot,
				encoding: 'utf8',
				maxBuffer: 1 << 28,
			})
				.split('\0')
				.filter((path) => /\.(vue|svelte)$/.test(path));
			expect(markup.length).toBeGreaterThan(0);
			for (const path of markup)
				expect(scanText(commentsOnly(readDoc(path)), path)).toEqual([]);
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
