import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	ANGULAR_COUNT_NOT_SCANNED,
	COUNTED_ANGULAR_SUBJECTS,
	COUNTED_CORPUS_SUBJECTS,
	EXCLUDED_FILES,
	FOREIGN_REPOSITORY_TARGETS,
	NOT_YET_WATCHED,
	THIRD_PARTY_TARGETS,
	WATCHED,
	WATCHED_SOURCE,
	angularApplicationRoutes,
	angularCountIntegrityProblems,
	angularLaneFiles,
	angularWrapperComponents,
	classify,
	commentsOnly,
	corpusApplications,
	corpusChainIntegrityProblems,
	corpusLanes,
	emitterClassificationProblems,
	findCitations,
	foreignShadowProblems,
	integrityProblems,
	listTrackedSourceFiles,
	scanCountedSubjects,
	scanRepository,
	scanText,
	sixLaneApplications,
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

	/**
	 * T018 RULING 11 — THE COUNT GUARD, AND THE REASON THIS BLOCK EXISTS AT ALL.
	 *
	 * T017 built ruling 11 and proved it red against the six real stale sites it then
	 * corrected. THAT PROOF WAS REAL AND IT WAS ALSO ONE-TIME: it lived in a note, and
	 * nothing re-ran it, so the detector could be neutered by a later edit and would
	 * then certify the very rot it was written to catch — while `scanRepository()`
	 * carried on reporting a clean tree. Every plant T017 ran by hand is re-run here.
	 *
	 * TWO PROPERTIES DECIDE THE SHAPE OF THESE TESTS.
	 *
	 *   NOT ONE OF THEM MAY ASSERT ONLY THAT THE GUARD EXITS 0. A green run over a
	 *   clean tree is exactly what a broken detector also produces. Every plant below
	 *   asserts the FIRING SITE — file, line and kind — so deleting the detector's body
	 *   fails them.
	 *
	 *   AND NOT ONE OF THEM MAY READ REPOSITORY PROSE. The stale wording is built here
	 *   as a fixture and the NUMBERS come from a SYNTHETIC LANE in a temp directory, so
	 *   the day a card corrects a comment in `demos/angular-official`, or adds a tenth
	 *   wrapper, none of this moves. A suite that goes red when a future card fixes a
	 *   sentence is a trap, and it is the reason T017 proved liveness against a COPY of
	 *   the lane rather than against the lane.
	 */
	describe('T018 ruling 11 — the count guard is re-proved every run', () => {
		// A synthetic lane, built once: NINE wrapper components (`@Component` plus an
		// import out of `../emitted/`), the two decoys the real derivation has to reject,
		// and a route table carrying the nine-scenario contract plus EIGHT applications.
		// Those are the same two numbers the real lane derives today, which is what lets
		// the historical wordings be planted verbatim — but they are OURS, so the real
		// lane is free to change without touching a line of this file.
		const lane = mkdtempSync(join(tmpdir(), 'ruling11-lane-'));
		const wrapper = (name: string) =>
			writeFileSync(
				join(lane, name),
				`import { Component } from '@angular/core';\n` +
					`import { Thing } from '../emitted/Thing';\n` +
					`@Component({ selector: 'x', template: '<thing />' })\nexport class X {}\n`,
			);
		const routeTable = (applications: string[]) =>
			`import { Thing } from '../emitted/Thing';\nexport const routes = [\n` +
			["''", 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']
				.map((path) => `  { path: ${path === "''" ? path : `'${path}'`} },\n`)
				.join('') +
			applications.map((path) => `  { path: '${path}' },\n`).join('') +
			'];\n';

		beforeAll(() => {
			for (const name of [
				'async-gate.ts',
				'board-page.ts',
				'codex-page.ts',
				'contacts-page.ts',
				'habits-page.ts',
				'hn-item-page.ts',
				'hn-page.ts',
				'todomvc-advanced-page.ts',
				'todomvc-page.ts',
			])
				wrapper(name);
			// The two decoys, both of which the real lane contains and the real derivation
			// must reject: the router shell DECLARES a component but mounts no emitted one,
			// and the route table IMPORTS emitted components but declares none. If either
			// slipped in, the derivation would be counting `@Component` or counting imports
			// rather than counting wrappers.
			writeFileSync(
				join(lane, 'app.ts'),
				`import { Component } from '@angular/core';\n@Component({ selector: 'app-root' })\nexport class App {}\n`,
			);
			writeFileSync(
				join(lane, 'app.routes.ts'),
				routeTable(['todomvc', 'todomvc-advanced', 'codex', 'hn', 'hn-item', 'habits', 'board', 'contacts']),
			);
			writeFileSync(join(lane, 'app.css'), 'body { margin: 0; }\n');
		});
		afterAll(() => rmSync(lane, { recursive: true, force: true }));

		// The shipped subjects — shipped nouns, shipped position/count rules — with only
		// the DERIVATION repointed at the synthetic lane. Overriding the regexes instead
		// would test a copy of the guard rather than the guard.
		const subjectsFor = (dir: string) =>
			COUNTED_ANGULAR_SUBJECTS.map((subject) =>
				subject.positionIsDerivable
					? { ...subject, derive: () => angularApplicationRoutes(join(dir, 'app.routes.ts')) }
					: { ...subject, derive: () => angularWrapperComponents(dir) },
			);

		/**
		 * A claim always lands on LINE 6 of this fixture, inside a doc comment, with code
		 * above and below it — the geometry the real files have. The line is asserted, not
		 * computed from the fixture, so a detector that reported everything at 1:1 fails.
		 */
		const planted = (claim: string) =>
			[
				"import { Component } from '@angular/core';",
				'',
				"import { TaskBoard } from '../emitted/TaskBoard';",
				'',
				'/**',
				` * The /board route, and ${claim}.`,
				' *',
				' * It exists to link stylesheets on this route and no other.',
				' */',
				"@Component({ selector: 'app-board', template: '<task-board />' })",
				'export class BoardPage {}',
			].join('\n');

		const scanPlant = (claim: string, file: string) =>
			scanCountedSubjects(commentsOnly(planted(claim)), file, subjectsFor(lane));

		const siteOf = (violations: ReturnType<typeof scanCountedSubjects>) =>
			violations.map((v) => `${v.file}:${v.lineNumber} ${v.kind}`);

		/**
		 * THE SIX REAL SITES. Every wording here is what the file named beside it ACTUALLY
		 * CONTAINED at `20738a6`, the commit before T017 corrected it — recorded in
		 * docs/goals/frameless-app-fidelity-v1/notes/T017-count-guard.md. They are fixtures
		 * now, so correcting the lane again cannot silently disarm them.
		 */
		describe('goes red on the six wordings this lane really carried', () => {
			for (const [name, claim] of [
				['board-page.ts', 'the FIFTH of five wrapper components in this lane'],
				['contacts-page.ts', 'the SIXTH of six wrapper components in this lane'],
				['habits-page.ts', 'the SIXTH of EIGHT wrapper components in this lane'],
				['hn-page.ts', 'the THIRD of three wrapper components in this lane'],
				['todomvc-page.ts', 'the SECOND of two wrapper components in this lane'],
			])
				test(`${name} — "${claim}"`, () => {
					const file = `demos/angular-official/src/app/${name}`;
					const found = scanPlant(claim, file);
					// BOTH halves of the ruling fire on these: the position cannot be derived at
					// all, and the denominator disagrees with the nine the lane really has.
					expect(siteOf(found)).toEqual([
						`${file}:6 underivable-position`,
						`${file}:6 stale-derived-count`,
					]);
					expect(found[1].reason).toContain('the source has 9');
				});

			test('a position with NO denominator still fires — the count rule cannot carry it', () => {
				// `hn-item-page.ts` said "the FOURTH of the wrapper components in this lane".
				// There is no number to recompile, so only the position rule can catch it, and
				// a guard that only checked numbers would have read this one as clean.
				const file = 'demos/angular-official/src/app/hn-item-page.ts';
				const found = scanPlant('the FOURTH of the wrapper components in this lane', file);
				expect(siteOf(found)).toEqual([`${file}:6 underivable-position`]);
				expect(found[0].raw).toBe('FOURTH of the wrapper components');
			});

			test('a stale APPLICATION-ROUTE count fires, and the position beside it does NOT', () => {
				// The asymmetry ruling 11 argues for, asserted rather than described: route
				// POSITIONS are left alone because `hn-page.ts` records a true past-tense one
				// and no instrument here can tell a dated record from a live claim, while the
				// route COUNT is recompiled. Both halves are in this one fixture.
				const file = 'demos/angular-official/src/app/habits-page.ts';
				const found = scanPlant(
					'the THIRD of this lane’s SEVEN application routes',
					file,
				);
				expect(siteOf(found)).toEqual([`${file}:6 stale-derived-count`]);
				expect(found[0].reason).toContain('the source has 8');
			});
		});

		/**
		 * THE NEGATIVE CONTROLS. Each one is a sentence that MUST stay green, and each is
		 * paired with the near-identical sentence that must not — otherwise a rule that
		 * simply failed to match anything would pass this block.
		 */
		describe('stays green where the sentence is correct', () => {
			test('THE QUOTED HISTORICAL — and the exemption is what does it, not a missed match', () => {
				// `habits-page.ts` records what its own first line USED to say. The identical
				// claim unquoted goes red; quoted it is a recitation and stays green. Asserting
				// the PAIR is the point: green alone would also be produced by a dead detector.
				const file = 'demos/angular-official/src/app/habits-page.ts';
				const historical = 'It first read "the FOURTH of four wrapper components", true only then';
				expect(scanPlant(historical, file)).toEqual([]);
				expect(
					siteOf(scanPlant('It first read the FOURTH of four wrapper components, true only then', file)),
				).toEqual([`${file}:6 underivable-position`, `${file}:6 stale-derived-count`]);
			});

			test('a claim wrapped across two comment lines is ONE sentence and is still caught', () => {
				// The quoted historical in the real file spans a line break, so this geometry
				// is load-bearing for the control above. A per-line detector goes quiet here.
				const file = 'demos/angular-official/src/app/habits-page.ts';
				const wrapped = ['/**', ' * It was corrected to the SIXTH of', ' * EIGHT wrapper components.', ' */'].join('\n');
				const found = scanCountedSubjects(commentsOnly(wrapped), file, subjectsFor(lane));
				expect(siteOf(found)).toEqual([`${file}:2 underivable-position`, `${file}:3 stale-derived-count`]);
			});

			test('THE CORRECT COUNTS DO NOT FIRE — nine wrappers and eight routes', () => {
				const file = 'demos/angular-official/src/app/habits-page.ts';
				expect(scanPlant('there are NINE wrapper components in this lane', file)).toEqual([]);
				expect(scanPlant('one of this lane’s EIGHT application routes', file)).toEqual([]);
			});

			test("T017's REMEDY TEXT must never fire — the guard cannot red-flag its own fix", () => {
				// Five files now open "one of this lane's wrapper components". If the count rule
				// ever let its number float away from the noun, that sentence would read as a
				// claim of ONE and every corrected file would go red. This is the test that
				// pins the tight spacing, and it is why the blind spot below is a blind spot.
				const file = 'demos/angular-official/src/app/board-page.ts';
				expect(scanPlant("one of this lane’s wrapper components", file)).toEqual([]);
				expect(scanPlant('one of the wrapper components here', file)).toEqual([]);
			});

			test('family seven is NOT this rule — the six-lane chain stays untouched', () => {
				// T019 owns those 53 sites. If ruling 11 started firing on them, this card
				// would have silently widened into another card's population.
				const file = 'demos/angular-official/src/app/contacts-page.ts';
				expect(scanPlant('THE EIGHTH APPLICATION, and the FOURTH scenario this lane ships', file)).toEqual([]);
				expect(scanPlant('THE THIRD CORPUS APPLICATION THIS LANE SHIPS', file)).toEqual([]);
			});
		});

		/**
		 * T018 DELETED THE THREE `ANGULAR_COUNT_NOT_SCANNED` EXEMPTIONS, and found the
		 * detector reached only TWO of the six stale sites behind them. These pin the
		 * widening that fixed one of them AND the two holes that remain — recorded as
		 * failing tests would be, so nobody can mistake them for an oversight.
		 */
		describe('the wordings behind the deleted exemptions', () => {
			test('the whole lane is scanned now, and the exemption list is empty', () => {
				expect(ANGULAR_COUNT_NOT_SCANNED).toEqual([]);
				for (const name of ['app.routes.ts', 'app.config.ts', 'async-gate.ts'])
					expect(angularLaneFiles()).toContain(`demos/angular-official/src/app/${name}`);
			});

			test('THE BARE NOUN IS CAUGHT — the sentence T017 cited as evidence for NINE', () => {
				// `app.routes.ts` called /todomvc "the SECOND OF TWO ROUTES HERE THAT GO THROUGH
				// A WRAPPER" — the sentence whose own numerator proves `async-gate.ts` counts.
				// At T017's spelling the noun had to be "wrapper component", so the guard could
				// not see the sentence its own reasoning rested on.
				const file = 'demos/angular-official/src/app/app.routes.ts';
				const found = scanPlant('THE SECOND OF TWO ROUTES HERE THAT GO THROUGH A WRAPPER', file);
				expect(siteOf(found)).toEqual([`${file}:6 underivable-position`]);
			});

			test('and the widened noun still reads the plain spelling as the same subject', () => {
				const file = 'demos/angular-official/src/app/app.config.ts';
				const found = scanPlant('their props instead of through three wrapper components', file);
				expect(siteOf(found)).toEqual([`${file}:6 stale-derived-count`]);
				expect(found[0].raw).toBe('three wrapper components');
			});

			test('RECORDED HOLE 1 — a number attached to ROUTES cannot be read as a number of WRAPPERS', () => {
				// `app.routes.ts` said "S8 is the one route with a WRAPPER component" and
				// `async-gate.ts` said "the ONE route in this lane that needs a wrapper component
				// at all". Both were stale by nine and BOTH ARE INVISIBLE HERE, because the
				// number attaches to `route`. The widening that would catch them is the one the
				// remedy-text test above forbids. Corrected by hand; pinned here as a hole.
				const file = 'demos/angular-official/src/app/app.routes.ts';
				expect(scanPlant('S8 is the one route with a WRAPPER component', file)).toEqual([]);
				expect(
					scanPlant('the ONE route in this lane that needs a wrapper component at all', file),
				).toEqual([]);
			});

			test('RECORDED HOLE 2 — a count of ZERO spelled in English is not a number', () => {
				// `async-gate.ts` said route `data` "is what keeps this lane free of wrappers".
				// That asserts the count is nought, it was wrong by nine, and there is no
				// numeral in it for any version of this rule to recompile.
				const file = 'demos/angular-official/src/app/async-gate.ts';
				expect(scanPlant('which is what keeps this lane free of wrappers', file)).toEqual([]);
			});
		});

		/**
		 * THE DERIVATION IS LIVE, NOT STORED. T017 proved this by hand against a copied
		 * lane. Here it is a test: the SAME green prose goes red the moment the SOURCE
		 * changes underneath it, which a guard carrying its own copy of the number could
		 * not do — and which is the entire reason OD3 chose a check over a sweep.
		 */
		describe('the numbers are recompiled from the source, never stored', () => {
			test('adding a tenth wrapper and a ninth route turns green prose red', () => {
				const file = 'demos/angular-official/src/app/habits-page.ts';
				const prose = planted('there are NINE wrapper components and EIGHT application routes here');
				expect(scanCountedSubjects(commentsOnly(prose), file, subjectsFor(lane))).toEqual([]);

				const grown = mkdtempSync(join(tmpdir(), 'ruling11-grown-'));
				try {
					for (const name of readdirSync(lane)) copyFileSync(join(lane, name), join(grown, name));
					writeFileSync(
						join(grown, 'settings-page.ts'),
						`import { Component } from '@angular/core';\nimport { Thing } from '../emitted/Thing';\n@Component({ selector: 'y', template: '' })\nexport class Y {}\n`,
					);
					writeFileSync(
						join(grown, 'app.routes.ts'),
						routeTable(['todomvc', 'todomvc-advanced', 'codex', 'hn', 'hn-item', 'habits', 'board', 'contacts', 'settings']),
					);
					expect(angularWrapperComponents(grown)).toHaveLength(10);
					expect(angularApplicationRoutes(join(grown, 'app.routes.ts'))).toHaveLength(9);
					const found = scanCountedSubjects(commentsOnly(prose), file, subjectsFor(grown));
					expect(siteOf(found)).toEqual([
						`${file}:6 stale-derived-count`,
						`${file}:6 stale-derived-count`,
					]);
					expect(found.map((v) => v.raw)).toEqual(['NINE wrapper components', 'EIGHT application routes']);
				} finally {
					rmSync(grown, { recursive: true, force: true });
				}
			});

			test('THE DEFINITION IS A DEFINITION — the two decoys the real lane contains are rejected', () => {
				// A component that mounts nothing emitted is not a wrapper, and a file that
				// imports emitted components without declaring one is not either. Getting this
				// wrong is how the denominators drifted in the first place.
				expect(angularWrapperComponents(lane).map((path) => basename(path))).toEqual([
					'async-gate.ts',
					'board-page.ts',
					'codex-page.ts',
					'contacts-page.ts',
					'habits-page.ts',
					'hn-item-page.ts',
					'hn-page.ts',
					'todomvc-advanced-page.ts',
					'todomvc-page.ts',
				]);
				// And the route derivation drops the nine-scenario three-way contract, which is
				// what `scripts/e2e.mjs` pins to the literal ['s1'..'s9'].
				expect(angularApplicationRoutes(join(lane, 'app.routes.ts'))).toEqual([
					'todomvc',
					'todomvc-advanced',
					'codex',
					'hn',
					'hn-item',
					'habits',
					'board',
					'contacts',
				]);
			});
		});

		/**
		 * ANTI-VACUITY. Every branch of ruling 11's integrity check is watched FIRING
		 * here, not merely watched passing — the exemption loop especially, because T018
		 * emptied the list it walks and a loop over nothing passes forever.
		 */
		describe('cannot be emptied without saying so', () => {
			test('the real lane is clean, and an EMPTIED one is refused three times over', () => {
				expect(angularCountIntegrityProblems()).toEqual([]);
				// A lane stripped to a route table with nothing but the three-way contract in
				// it: no wrapper survives the definition and no application route survives the
				// filter. Every claim in such a lane would read GREEN against zero, which is
				// the failure this block exists for.
				const empty = mkdtempSync(join(tmpdir(), 'ruling11-empty-'));
				try {
					writeFileSync(join(empty, 'app.routes.ts'), routeTable([]));
					const problems = angularCountIntegrityProblems(empty, [], subjectsFor(empty));
					expect(problems).toHaveLength(3);
					expect(problems[0]).toContain('enumerated only 1 file(s)');
					expect(problems[1]).toContain('wrapper components found 0');
					expect(problems[2]).toContain('application routes found 0');
				} finally {
					rmSync(empty, { recursive: true, force: true });
				}
			});

			test('a lane that has MOVED is refused rather than passing over nothing', () => {
				const problems = angularCountIntegrityProblems('demos/angular-official/src/nowhere');
				expect(problems).toHaveLength(1);
				expect(problems[0]).toContain('which does not exist');
			});

			test('AN EXEMPTION POINTING AT NOTHING FIRES — the branch the empty list no longer walks', () => {
				const problems = angularCountIntegrityProblems(undefined, [
					{ path: 'demos/angular-official/src/app/renamed-away.ts', reason: 'synthetic' },
				]);
				expect(problems).toHaveLength(1);
				expect(problems[0]).toContain('renamed-away.ts');
			});

			test('the quotation exemption fails TOWARDS red, in both of its lexer failure modes', () => {
				// An unpaired quote and an over-long pair both DROP the exemption rather than
				// widening it. A hole that failed the other way could hide a live stale count
				// behind one stray `"`.
				const file = 'demos/angular-official/src/app/habits-page.ts';
				expect(siteOf(scanPlant('it read "the FOURTH of four wrapper components', file))).toEqual([
					`${file}:6 underivable-position`,
					`${file}:6 stale-derived-count`,
				]);
				const padded = `"${'x'.repeat(240)} the FOURTH of four wrapper components"`;
				expect(siteOf(scanPlant(padded, file))).toEqual([
					`${file}:6 underivable-position`,
					`${file}:6 stale-derived-count`,
				]);
			});
		});
	});

	/**
	 * T019 RULING 11'S SECOND FAMILY — THE SIX-LANE CHAIN, AND THE HOLE IT MEASURED
	 * BEFORE IT ADDED A SUBJECT.
	 *
	 * T015 swept 53 sites across 21 files stating WHERE a corpus application sits in
	 * the sequence every lane emits, and T019 found 55 across 22. Not one of them
	 * contained a NUMBER: they said "the THIRD scenario all six lanes emit, after S13
	 * and S15". The count rule had nothing to recompile and the position rule had no
	 * `of` to hinge on, SO RULING 11 COULD NOT SEE A SINGLE SITE OF THAT FAMILY. The
	 * first three tests here pin that limit with the real pre-fix wordings, because a
	 * limit nobody re-runs is a limit that quietly becomes a claim of coverage.
	 *
	 * WHAT IS GUARDED IS THE CLASS THE FIX NAMES. Removing the position left sentences
	 * that name "the SIX-LANE APPLICATIONS", and seven of them state the count. That
	 * noun is recompiled from the SAME two tables `announce()` in scripts/demo.mjs
	 * reads, so an S18, or a lane recording a refusal, moves it.
	 *
	 * THE NUMBERS BELOW ARE 3 / 5 / 3 AND THE REPOSITORY'S ARE 6 / 8 / 7, DELIBERATELY.
	 * Every derivation here is repointed at a SYNTHETIC corpus table in a temp dir whose
	 * answers differ from the real one in all three positions, so a test that leaked
	 * into repository prose fails instead of passing by coincidence.
	 */
	describe('T019 ruling 11 — the six-lane chain is recompiled, not recited', () => {
		const dir = mkdtempSync(join(tmpdir(), 'ruling11-corpus-'));
		const table = join(dir, 'demo.mjs');
		const grown = join(dir, 'demo-grown.mjs');

		/** A `scripts/demo.mjs`-shaped table: the slice anchors on the tabs and the `];`. */
		const corpusTable = (refusals: Record<string, string>) =>
			'// synthetic corpus table\n' +
			'const SCENARIOS = [\n' +
			["S1", "S2", "S3"].map((id) => `\t{ id: '${id}', path: '/${id}', title: 'contract' },\n`).join('') +
			["S10", "S11", "S12", "S13"].map((id) => `\t{ id: '${id}', path: '/${id}', title: 'app' },\n`).join('') +
			`\t{\n\t\tid: 'S14',\n\t\tpath: '/S14',\n\t\ttitle: 'the multi-line row shape the real table also has',\n\t},\n` +
			'];\n\n' +
			'const DEMOS = [\n' +
			Object.entries(refusals)
				.map(([name, absent]) => `\t{\n\t\tname: '${name}',\n\t\tunbuilt: ${absent},\n\t},\n`)
				.join('') +
			'];\n';

		beforeAll(() => {
			// 3 lanes, 5 applications, and TWO of them refused somewhere -> a chain of 3.
			writeFileSync(table, corpusTable({ alpha: '{}', beta: '{ S12: REFUSAL }', gamma: '{ S14: REFUSAL }' }));
			// The same table with beta's refusal closed, exactly the way T007 closed
			// angular's: the chain becomes 4 WITHOUT A ROW BEING ADDED.
			writeFileSync(grown, corpusTable({ alpha: '{}', beta: '{}', gamma: '{ S14: REFUSAL }' }));
		});
		afterAll(() => rmSync(dir, { recursive: true, force: true }));

		// The SHIPPED subjects — shipped nouns, shipped position and count rules — with
		// only the derivation repointed. Overriding a regex would test a copy of the guard.
		const subjectsFor = (file: string) =>
			COUNTED_CORPUS_SUBJECTS.map((subject) =>
				subject.positionIsDerivable
					? { ...subject, derive: () => corpusApplications(file) }
					: { ...subject, derive: () => sixLaneApplications(file) },
			);

		/** The claim always lands on LINE 6, inside a doc comment, with code either side. */
		const planted = (claim: string) =>
			[
				"import { TaskBoard } from '../emitted/TaskBoard';",
				'',
				'export const noTrace = () => {};',
				'',
				'/**',
				` * The /board route, and ${claim}.`,
				' *',
				' * It exists to link stylesheets on this route and no other.',
				' */',
				'export const BoardPage = () => <TaskBoard onTrace={noTrace} />;',
			].join('\n');

		const file = 'demos/react-official/src/App.jsx';
		const scanPlant = (claim: string, source = table) =>
			scanCountedSubjects(commentsOnly(planted(claim)), file, subjectsFor(source));
		const siteOf = (violations: ReturnType<typeof scanCountedSubjects>) =>
			violations.map((v) => `${v.file}:${v.lineNumber} ${v.kind}`);

		/**
		 * THE MEASURED HOLE. Every wording here is what the file named beside it ACTUALLY
		 * CONTAINED at `eeaed45`, the commit before T019 corrected it. All three are GREEN,
		 * and that is the finding: OD3's first half had to be applied BY HAND because no
		 * tight rule can read a number out of a sentence that contains none.
		 */
		describe('CANNOT see the family it was pointed at, which is why the fix removed the position', () => {
			for (const [where, claim] of [
				['regenerate.ts / S16', 'it is the THIRD scenario all six lanes emit, after S13 and S15'],
				['App.jsx / S13', 'the FIRST in this corpus that all SIX lanes emit'],
				['app.routes.ts / S15', 'THE SECOND CORPUS APPLICATION THIS LANE SHIPS ALONGSIDE THE OTHER FIVE'],
			])
				test(`${where} — "${claim}" is invisible`, () => {
					expect(scanPlant(claim)).toEqual([]);
				});
		});

		describe('goes red on the class the fix names', () => {
			test('a stale count fires, with its site and its recompiled reason', () => {
				const found = scanPlant('one of the SEVEN six-lane applications');
				expect(siteOf(found)).toEqual([`${file}:6 stale-derived-count`]);
				expect(found[0].reason).toContain('This prose says 7 six-lane applications; the source has 3');
				// The reason NAMES them, so a reader is never left to re-derive it by hand.
				expect(found[0].reason).toContain('S10, S11, S13');
			});

			test('the correct count is GREEN, so the rule is not merely allergic to numbers', () => {
				expect(scanPlant('one of the THREE six-lane applications')).toEqual([]);
			});

			test('A BARE ORDINAL FIRES — the licence family eight does not take', () => {
				// Family eight always wrote "the Nth OF M"; family seven never wrote `of` at
				// all, so this subject carries its own bridge. That is the whole reason the
				// position half is enforceable here.
				expect(siteOf(scanPlant('the THIRD six-lane application'))).toEqual([
					`${file}:6 underivable-position`,
				]);
			});

			test('the "Nth of M" spelling fires BOTH halves at once', () => {
				expect(siteOf(scanPlant('the FIFTH of the seven six-lane applications'))).toEqual([
					`${file}:6 underivable-position`,
					`${file}:6 stale-derived-count`,
				]);
			});

			test('a claim reflowed across two comment lines is still ONE claim, reported where a reader finds it', () => {
				const wrapped = ['/**', ' * The /board route, and it is the', ' * THIRD six-lane application here.', ' */'].join('\n');
				const found = scanCountedSubjects(commentsOnly(wrapped), file, subjectsFor(table));
				expect(siteOf(found)).toEqual([`${file}:3 underivable-position`]);
			});

			test('THE SHIPPED REMEDY TEXT STAYS GREEN — the rule must not red-flag its own fix', () => {
				// This is the sentence T019 wrote into twenty-one files. A looser bridge that
				// caught "the FOURTH APPLICATION - ... - and one of the SIX-LANE APPLICATIONS"
				// would have turned the whole corrected corpus red.
				expect(
					scanPlant('one of the SIX-LANE APPLICATIONS, the corpus rows every lane emits'),
				).toEqual([]);
				expect(scanPlant('a SIX-LANE APPLICATION for the same reason S15 is')).toEqual([]);
			});
		});

		describe('a quotation is a recitation, and the exemption is doing the work', () => {
			test('the quoted historical is GREEN and its unquoted twin is RED', () => {
				const quoted = 'this line used to read "the THIRD six-lane application" and it was wrong';
				const bare = 'this line used to read the THIRD six-lane application and it was wrong';
				expect(scanPlant(quoted)).toEqual([]);
				expect(siteOf(scanPlant(bare))).toEqual([`${file}:6 underivable-position`]);
			});
		});

		describe('the corpus-application subject, and the asymmetry it is allowed', () => {
			test('a stale count of the applications fires', () => {
				const found = scanPlant('this corpus has NINE corpus applications');
				expect(siteOf(found)).toEqual([`${file}:6 stale-derived-count`]);
				expect(found[0].reason).toContain('says 9 corpus applications; the source has 5');
			});

			test('the correct count is GREEN', () => {
				expect(scanPlant('this corpus has FIVE corpus applications')).toEqual([]);
			});

			test('A POSITION AMONG THE APPLICATIONS IS ALLOWED, and that is a measurement', () => {
				// "THE EIGHTH APPLICATION - CONTACTS" is true, stable and derivable: the slots
				// are handed out in table order with no second basis. Forbidding it would demand
				// the correction of correct prose, which is what ruling 6 exists to stop.
				expect(scanPlant('THE EIGHTH corpus application - CONTACTS')).toEqual([]);
			});
		});

		/**
		 * THE DERIVATION IS LIVE, NOT STORED. A guard carrying its own copy of "seven"
		 * passes every test above and still certifies a stale tree the day the table moves.
		 */
		describe('recompiles from the table it is given', () => {
			test('the real table and the synthetic one disagree in all three positions', () => {
				expect([corpusLanes().length, corpusApplications().length, sixLaneApplications().length]).toEqual([6, 8, 7]);
				expect([corpusLanes(table).length, corpusApplications(table).length, sixLaneApplications(table).length]).toEqual([3, 5, 3]);
			});

			test('CLOSING A REFUSAL MOVES THE CHAIN, and byte-identical green prose goes red', () => {
				// No row is added: beta simply stops refusing S12, exactly as the angular lane
				// stopped refusing S11 and S12 at T007 — the event that made this whole family
				// stale in the first place.
				expect(sixLaneApplications(grown)).toEqual(['S10', 'S11', 'S12', 'S13']);
				const prose = 'one of the THREE six-lane applications';
				expect(scanPlant(prose, table)).toEqual([]);
				const found = scanPlant(prose, grown);
				expect(siteOf(found)).toEqual([`${file}:6 stale-derived-count`]);
				expect(found[0].reason).toContain('the source has 4');
			});

			test('the real repository derivation reproduces announce()s own chain, in order', () => {
				// Not a coincidence check: this is the sequence every corrected sentence in the
				// corpus now declines to number, and S13 sits FOURTH in it rather than first.
				expect(sixLaneApplications()).toEqual(['S10', 'S11', 'S12', 'S13', 'S15', 'S16', 'S17']);
			});
		});

		/**
		 * ANTI-VACUITY. These derivations read TWO ARRAY LITERALS OUT OF A TEXT FILE, so
		 * they can fail three quieter ways than a directory listing can. Every branch is
		 * watched FIRING.
		 */
		describe('cannot be emptied without saying so', () => {
			test('the real table is clean', () => {
				expect(corpusChainIntegrityProblems()).toEqual([]);
			});

			test('a table whose slice finds NOTHING is refused under both floors', () => {
				const gutted = join(dir, 'demo-gutted.mjs');
				writeFileSync(gutted, '// the tables were renamed\nconst ROWS = [\n];\n');
				const problems = corpusChainIntegrityProblems(gutted, subjectsFor(gutted));
				expect(problems).toHaveLength(3);
				expect(problems[0]).toContain('derivation of the lanes found 0');
				expect(problems[1]).toContain('six-lane applications found 0');
				expect(problems[2]).toContain('corpus applications found 0');
			});

			test('a table that has MOVED is refused rather than passing over nothing', () => {
				const problems = corpusChainIntegrityProblems('scripts/nowhere.mjs');
				expect(problems).toHaveLength(1);
				expect(problems[0]).toContain('which does not exist');
			});

			test('A SLICE THAT CAPTURED THE WRONG FIELD FIRES — the branch a subset check could not', () => {
				// The rows are matched by a regex over text. If a reformat put `path` where
				// `id` is, the applications would come back as ROUTES and the `S1`-`S9` filter
				// would pass them straight through, so the shape is asserted rather than assumed.
				const shuffled = join(dir, 'demo-shuffled.mjs');
				writeFileSync(
					shuffled,
					'// paths captured as ids\nconst SCENARIOS = [\n' +
						"\t{ id: 'todomvc', path: '/todomvc', title: 'a' },\n" +
						"\t{ id: 'codex', path: '/codex', title: 'b' },\n];\n\n" +
						"const DEMOS = [\n\t{\n\t\tname: 'alpha',\n\t\tunbuilt: {},\n\t},\n\t{\n\t\tname: 'beta',\n\t\tunbuilt: {},\n\t},\n];\n",
				);
				const problems = corpusChainIntegrityProblems(shuffled, subjectsFor(shuffled));
				expect(problems).toHaveLength(1);
				expect(problems[0]).toContain('read todomvc, codex as a scenario id');
			});
		});

		/**
		 * THE SHIPPED PATH, EXERCISED BY IDENTITY — AND THIS BLOCK EXISTS BECAUSE THE
		 * SUITE ABOVE MISSED A MUTATION.
		 *
		 * Every test above repoints the derivations, which means it hands
		 * `scanCountedSubjects` a NEW array built by `.map` rather than the shipped
		 * `COUNTED_CORPUS_SUBJECTS`. Measured while proving this card: a mutation that
		 * short-circuits the detector FOR THE SHIPPED ARRAY left `pnpm check:citations`
		 * clean AND all of those tests green, because not one of them travelled the path
		 * `scanRepository` actually takes. So these two hand it the shipped array itself.
		 *
		 * The PROSE is still synthetic and the assertions still avoid the real numbers: a
		 * numeral no corpus will reach, and a position that is refused whatever the count.
		 */
		describe('the SHIPPED subject list is what scanRepository walks', () => {
			test('a stale count fires through the shipped array, not a repointed copy', () => {
				const found = scanCountedSubjects(
					commentsOnly(planted('one of the 99 six-lane applications')),
					file,
					COUNTED_CORPUS_SUBJECTS,
				);
				expect(siteOf(found)).toEqual([`${file}:6 stale-derived-count`]);
				expect(found[0].reason).toContain(`the source has ${sixLaneApplications().length}`);
			});

			test('a position fires through the shipped array whatever the count happens to be', () => {
				expect(
					siteOf(
						scanCountedSubjects(
							commentsOnly(planted('the THIRD six-lane application')),
							file,
							COUNTED_CORPUS_SUBJECTS,
						),
					),
				).toEqual([`${file}:6 underivable-position`]);
			});
		});

		/**
		 * T019 ADDED A PER-SUBJECT POSITION BRIDGE. This block exists to prove it changed
		 * NOTHING for family eight, because T018 measured that widening the shared pattern
		 * would fire on "one of this lane's wrapper components" — the sentence T017 wrote
		 * into five files AS THE FIX.
		 */
		describe('family eight is untouched by the bridge that family seven needed', () => {
			test('"the SECOND of two wrapper components" still fires both halves', () => {
				const found = scanCountedSubjects(
					commentsOnly('/**\n * the SECOND of two wrapper components in this lane\n */'),
					'demos/angular-official/src/app/todomvc-page.ts',
					COUNTED_ANGULAR_SUBJECTS,
				);
				expect(found.map((v) => v.kind)).toEqual(['underivable-position', 'stale-derived-count']);
			});

			test('A BARE ORDINAL STILL DOES NOT FIRE THERE, which is the licence T019 did not take', () => {
				expect(
					scanCountedSubjects(
						commentsOnly('/**\n * the SECOND wrapper component in this lane\n */'),
						'demos/angular-official/src/app/todomvc-page.ts',
						COUNTED_ANGULAR_SUBJECTS,
					),
				).toEqual([]);
			});
		});
	});
});
