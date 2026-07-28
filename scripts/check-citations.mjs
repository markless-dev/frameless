#!/usr/bin/env node
/**
 * CITATION-ORDINAL GUARD (frameless-defects-and-targets-v1 T053).
 *
 * WHY THIS IS A CHECK AND NOT A FIFTH SWEEP. Four tasks - T012, T013, T014 and
 * T048 - hand-corrected citations in these files. T048 then MEASURED the result:
 * five of the eight ordinals it touched had ALREADY drifted, two of them since
 * the very commit that wrote them, and one sentence in the T024 note carried two
 * correct ordinals beside two wrong ones WITH NOTHING IN THE TEXT TO TELL THEM
 * APART. A reader cannot see that. A check can.
 *
 * THE RULE. A citation that points INTO THIS REPOSITORY must name the symbol it
 * means, not a line ordinal. Ordinals into first-party files rot silently because
 * nothing recompiles them; symbols move with their code or disappear loudly.
 *
 * THE EXCLUSIONS ARE RULED, NOT INCIDENTAL. Every path that this guard lets keep
 * an ordinal is listed below WITH ITS REASON. A regex that happened to miss them
 * would leave the next reader guessing which omissions were decisions; a path
 * that resolves to no repository file AND appears in no list is a FAILURE, so the
 * allowlist cannot be widened by accident.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

/**
 * RULING 1 - WATCHED. These files carry LIVE citations: a reader is expected to
 * follow them today, so an ordinal in them is a promise the file cannot keep.
 * They must contain zero first-party bare ordinals.
 */
export const WATCHED = [
	{
		path: 'docs/emitter-idiom-policy.md',
		reason:
			'The live six-gate sugar policy. Its worked examples are the argument, and every ' +
			'citation in them is meant to be followed at HEAD.',
	},
	{
		path: 'docs/goals/frameless-defects-and-targets-v1/notes/T024-corpus-breadth.md',
		reason:
			'The corpus-breadth ruling still drives queued Phase F work, so its emitter and ' +
			'schema citations are live. The T053 card names it in scope.',
	},
];

/**
 * RULING 2 - NOT YET WATCHED. Recorded rather than silently skipped. Each entry
 * says why it is out of scope; none of them is ruled correct, so promoting one is
 * a card, not a discovery. NO COUNTS ARE STATED HERE - the own-no-size pattern
 * this board ratified in T048 applies to the guard's own prose too.
 */
export const NOT_YET_WATCHED = [
	{
		path: 'docs/DEFECTS.md',
		reason:
			'Carries first-party bare ordinals (compiler build.ts, the react emitter, lane ' +
			"gate tests). Outside T053's allowed_files; needs its own card.",
	},
	{
		path: 'docs/report.md',
		reason:
			"Carries bare ordinals into markless' compiler and web packages, which are a " +
			"different repository's paths that happen to look first-party. Classifying them " +
			"needs a ruling T053 was not given; outside its allowed_files either way.",
	},
	{
		directory: 'docs/goals',
		reason:
			'Task notes and goal charters under other boards are DATED TASK RECORDS of what ' +
			'was true when they were written, the same class as the board receipts in ruling 3. ' +
			"The T024 note is the one exception the board carded into T053's scope, and it is " +
			'in WATCHED above.',
	},
];

/**
 * RULING 3 - BOARD RECEIPTS KEEP THEIR ORDINALS. Ruled by the T048 card and
 * ratified by the PM: a receipt records WHERE SOMETHING WAS on a date. It is a
 * historical record, not a live citation, and updating it would falsify it.
 */
export const EXCLUDED_FILES = [
	{
		match: /(^|\/)state\.yaml$/,
		reason:
			'GoalBuddy board receipts. Ordinals in them are dated historical records of where ' +
			'something stood, not pointers a reader should follow at HEAD.',
	},
];

/**
 * RULING 4 - THIRD-PARTY TARGETS KEEP THEIR ORDINALS. Ruled by frameless-vue-v1
 * T014 and ratified by the PM on T048: in a published build artifact or a
 * dependency's source the ordinal may be the ONLY stable handle, and the symbol
 * is not the reader's entry point. The rationale for removing ordinals does not
 * transfer there.
 *
 * Matching is on the citation's path suffix, so a citation must name enough of
 * the path to be recognised. Anything that resolves to no repository file and
 * matches nothing here FAILS as unclassified - this list cannot grow silently.
 */
export const THIRD_PARTY_TARGETS = [
	{
		suffix: '_debug_node-chunk.mjs',
		reason: "Angular's published debug chunk. Minified-adjacent; no reader-facing symbol.",
	},
	{
		suffix: '_pending_tasks-chunk.mjs',
		reason:
			"Angular's published task-scheduling chunk, same class and same reason as " +
			'_debug_node-chunk.mjs above.',
	},
	{
		suffix: '_common_module-chunk.d.ts',
		reason:
			"Angular's published declaration chunk. Its names are bundler-generated, so an " +
			'ordinal is the more stable handle of the two.',
	},
	{
		suffix: 'compiler.d.ts',
		reason:
			"A dependency's published declaration bundle: one flattened file with no source " +
			'structure a reader could navigate by symbol.',
	},
	{
		suffix: 'core-internal.d.ts',
		reason:
			"A dependency's published INTERNAL declaration bundle. The API is deliberately " +
			'unnamed, so there is no symbol the citation could promise.',
	},
	{
		suffix: 'core.mjs',
		reason:
			"Qwik's published core bundle, cited for a constraint enforced inside it rather " +
			'than for an exported name.',
	},
	{
		suffix: 'runtime-dom.cjs.js',
		reason:
			"Vue's published runtime-dom bundle. Cited for the shape of a generated helper, " +
			'which is not part of its public surface.',
	},
	{
		suffix: 'runtime-core.cjs.js',
		reason:
			"Vue's published runtime-core bundle, same class and same reason as " +
			'runtime-dom.cjs.js above.',
	},
	{
		suffix: 'dist/compiler-core.cjs.js',
		reason:
			"Vue's published compiler-core bundle, cited for a normalisation that happens " +
			'at parse time inside it.',
	},
	{
		suffix: 'svelte/src/internal/client/reactivity/props.js',
		reason:
			"Svelte's own source inside the resolved package. Repo-relative in shape, third " +
			'party in fact - which is exactly why this list matches on path and not on shape.',
	},
	{
		suffix: 'src/compiler/utils/extract_svelte_ignore.js',
		reason:
			"Svelte's compiler source inside the resolved package. Cited for a single `if (runes)` " +
			'line whose enclosing function is not the point.',
	},
];

const SOURCE_EXTENSIONS = [
	'ts',
	'tsx',
	'js',
	'jsx',
	'mjs',
	'cjs',
	'vue',
	'svelte',
	'html',
	'css',
	'json',
	'md',
	'yaml',
	'yml',
];

const PATH = String.raw`(?<![\w@./-])((?:[A-Za-z0-9_@.-]+\/)*[A-Za-z0-9_@.-]+\.(?:${SOURCE_EXTENSIONS.join('|')}))`;

const PATH_CITATION = new RegExp(`${PATH}${String.raw`:(\d+(?:-\d+)?)(?![\w-]|\.\d)`}`, 'g');

// A path mentioned WITHOUT an ordinal is still the antecedent a following bare
// ordinal reads back into - "`schema.ts`, at :266" is the same citation split in
// two. Resolving only against ordinal-bearing paths would let that shape report
// as unresolvable and hide which file it actually points into.
const PATH_MENTION = new RegExp(`${PATH}(?![\\w-])`, 'g');

// A bare ordinal - `(:8590)`, `` `:642` ``, "restates it at :475". It carries no
// path of its own and INHERITS the nearest path citation before it, which is how
// a reader resolves it. The PM ratified exactly this reading of `(:8590)` on T048.
// The trailing lookahead deliberately allows a sentence-ending '.' and a '/'
// separator: ":535." and ":498/:642" are both shapes this repository actually
// contains, and a lookahead that excluded them would go quiet on them.
const BARE_ORDINAL = /(?<![\w.:-]):(\d+(?:-\d+)?)(?![\w-]|\.\d)/g;

const isExcludedFile = (relativePath) =>
	EXCLUDED_FILES.find((rule) => rule.match.test(relativePath)) ?? null;

const thirdPartyRuling = (citedPath) =>
	THIRD_PARTY_TARGETS.find(
		(rule) => citedPath === rule.suffix || citedPath.endsWith(`/${rule.suffix}`),
	) ?? null;

/**
 * FIRST-PARTY means "resolves to a file in this repository". Not "starts with
 * packages/", which would miss `generated/S2.jsx` and `S2.vue` - two shapes this
 * board actually found, both pointing at files the emitter REGENERATES.
 */
const resolvesInRepo = (citedPath) =>
	!citedPath.startsWith('/') && !citedPath.includes('node_modules/') && existsSync(resolve(root, citedPath));

/** Every citation-shaped token in `text`, with bare ordinals resolved to their antecedent. */
export const findCitations = (text) => {
	const citations = [];
	let antecedent = null;
	for (const [index, line] of text.split('\n').entries()) {
		const lineNumber = index + 1;
		// A blank line ends the paragraph a bare ordinal reads back into.
		if (line.trim() === '') antecedent = null;
		const mentions = [...line.matchAll(PATH_MENTION)].map((match) => ({
			lineNumber,
			column: match.index + 1,
			path: match[1],
		}));
		const onThisLine = [];
		for (const match of line.matchAll(PATH_CITATION))
			onThisLine.push({
				lineNumber,
				column: match.index + 1,
				raw: match[0],
				path: match[1],
				ordinal: match[2],
				inheritedFrom: null,
			});
		for (const match of line.matchAll(BARE_ORDINAL)) {
			const inside = onThisLine.some(
				(cited) =>
					cited.path !== null &&
					match.index >= cited.column - 1 &&
					match.index < cited.column - 1 + cited.raw.length,
			);
			if (inside) continue;
			const source = mentions.filter((cited) => cited.column - 1 < match.index).at(-1) ?? antecedent;
			onThisLine.push({
				lineNumber,
				column: match.index + 1,
				raw: match[0],
				path: source === null ? null : source.path,
				ordinal: match[1],
				inheritedFrom: source === null ? null : `${source.path} (line ${source.lineNumber})`,
			});
		}
		onThisLine.sort((a, b) => a.column - b.column);
		citations.push(...onThisLine);
		antecedent = mentions.at(-1) ?? antecedent;
	}
	return citations;
};

/** Rule one citation. `verdict` is 'allowed' or 'violation'; `reason` always says why. */
export const classify = (citation) => {
	if (citation.path === null)
		return {
			verdict: 'violation',
			kind: 'unresolvable-bare-ordinal',
			reason:
				'A bare ordinal with no path citation before it in the same paragraph. A reader ' +
				'cannot follow it at all.',
		};
	const thirdParty = thirdPartyRuling(citation.path);
	if (thirdParty)
		return { verdict: 'allowed', kind: 'third-party', reason: thirdParty.reason };
	if (citation.path.startsWith('/') || citation.path.includes('node_modules/'))
		return {
			verdict: 'allowed',
			kind: 'third-party',
			reason: 'An absolute or node_modules path: outside this repository, so ruling 4 applies.',
		};
	if (resolvesInRepo(citation.path))
		return {
			verdict: 'violation',
			kind: 'first-party-ordinal',
			reason: `${citation.path} is a file in this repository. Name the symbol, not the line.`,
		};
	return {
		verdict: 'violation',
		kind: 'unclassified-path',
		reason:
			`${citation.path} resolves to no file in this repository and matches no ruling in ` +
			'THIRD_PARTY_TARGETS. Either qualify it to a real repository path (and drop the ' +
			'ordinal), or add it to THIRD_PARTY_TARGETS WITH ITS REASON.',
	};
};

/** Violations in one file's text. Used by the repo scan and by the guard's own red-proof tests. */
export const scanText = (text, label = '<text>') =>
	findCitations(text)
		.map((citation) => ({ ...citation, ...classify(citation), file: label }))
		.filter((result) => result.verdict === 'violation');

const listDocsTopLevel = () =>
	readdirSync(resolve(root, 'docs'), { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
		.map((entry) => `docs/${entry.name}`);

/**
 * INTEGRITY. A guard whose scope can be emptied without anyone noticing is
 * decoration. These failures are as fatal as a citation violation.
 */
export const integrityProblems = () => {
	const problems = [];
	if (WATCHED.length === 0) problems.push('WATCHED is empty: the guard would pass vacuously.');
	const notWatched = new Set(NOT_YET_WATCHED.filter((entry) => entry.path).map((entry) => entry.path));
	for (const entry of WATCHED) {
		if (!existsSync(resolve(root, entry.path)))
			problems.push(`WATCHED names ${entry.path}, which does not exist.`);
		if (notWatched.has(entry.path))
			problems.push(`${entry.path} is both WATCHED and NOT_YET_WATCHED.`);
		const excluded = isExcludedFile(entry.path);
		if (excluded) problems.push(`WATCHED names ${entry.path}, which ruling 3 excludes.`);
	}
	for (const entry of NOT_YET_WATCHED) {
		if (entry.path && !existsSync(resolve(root, entry.path)))
			problems.push(`NOT_YET_WATCHED names ${entry.path}, which does not exist.`);
		if (entry.directory && !existsSync(resolve(root, entry.directory)))
			problems.push(`NOT_YET_WATCHED names directory ${entry.directory}, which does not exist.`);
	}
	// Every living top-level doc must be classified. A new one with bare ordinals
	// cannot slip in unruled, which is how this class survived four sweeps.
	const classified = new Set([...WATCHED.map((entry) => entry.path), ...notWatched]);
	for (const file of listDocsTopLevel())
		if (!classified.has(file))
			problems.push(
				`${file} is neither WATCHED nor NOT_YET_WATCHED. Rule it: watched files must be ` +
					'clean, unwatched ones must say why not.',
			);
	return problems;
};

export const scanRepository = () => {
	const violations = [];
	for (const entry of WATCHED) {
		const text = readFileSync(resolve(root, entry.path), 'utf8');
		violations.push(...scanText(text, entry.path));
	}
	return { violations, integrity: integrityProblems() };
};

const isMain =
	process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'check-citations.mjs');

if (isMain) {
	const { violations, integrity } = scanRepository();
	for (const problem of integrity) console.error(`integrity: ${problem}`);
	for (const violation of violations)
		console.error(
			`${violation.file}:${violation.lineNumber}:${violation.column}  ${violation.raw}` +
				`${violation.inheritedFrom ? ` (inherits ${violation.inheritedFrom})` : ''}\n` +
				`    ${violation.kind}: ${violation.reason}`,
		);
	const total = violations.length + integrity.length;
	if (total > 0) {
		console.error(
			`\ncheck-citations: ${total} problem(s). First-party citations must name a symbol; ` +
				'every exclusion is a ruling recorded in scripts/check-citations.mjs.',
		);
		process.exit(1);
	}
	console.log(`check-citations: clean over ${WATCHED.length} watched file(s).`);
}
