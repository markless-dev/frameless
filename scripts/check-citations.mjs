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
	{
		path: 'docs/DEFECTS.md',
		reason:
			'T054 RULED IT LIVE, BY MEASUREMENT, AGAINST THE OPPOSITE HYPOTHESIS. The card asked ' +
			'whether the ledger is a DATED RECORD - citing code as it stood when a defect was ' +
			'filed, like the receipts in ruling 3 - and it is not. It is the ledger a reader ' +
			'reaches for when chasing a citation, entries are filed OPEN against code that is ' +
			'still wrong, and it is edited whenever an entry moves. The decisive evidence is that ' +
			'it had ALREADY ROTTED IN BOTH DIRECTIONS: its determinism table cited a sort site ' +
			'and QUOTED THE LINE IT EXPECTED THERE - `const writes = sortWrites(...)` - which is ' +
			'not what that line says, while in the same document the analyzer cancellation ' +
			'citation still matched its quoted code verbatim. A dated record cannot be wrong ' +
			'about its own date; this one was wrong about HEAD, which is the class it belongs to.',
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
		path: 'docs/report.md',
		reason:
			"T054 RULED ON ITS MARKLESS PATHS AND FOUND A SECOND, LARGER REASON IT IS NOT READY. " +
			'The markless citations that blocked T053 are now ruled in RULING 5, so they are no ' +
			'longer what holds this file back. What does: its findings rest on `.tsrx` evidence ' +
			'sites under `poc/`, and those ARE files in this repository. Watching this file today ' +
			'would report a green covering the citations nobody has ruled on. `poc/` is a THIRD ' +
			'class - archived experiment records whose fixtures are the evidence a recorded result ' +
			'was produced from - and it is neither ruling 3 nor ruling 5. It needs a card, and ' +
			'THIS entry is the record that it does, not an exemption.',
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

/**
 * RULING 5 - ANOTHER REPOSITORY'S PATHS. Ruled by T054 on docs/report.md, whose
 * markless findings cite markless' OWN repository-relative paths.
 *
 * THE CARD PREDICTED THESE RESOLVE HERE AND LOOK FIRST-PARTY. MEASURED: THEY DO
 * NOT. `packages/web/` and `packages/compiler/src/passes/` exist in markless and
 * in NEITHER case in this repository, so today the guard already refuses them -
 * as `unclassified-path`, which is the right verdict for the wrong reason. It
 * says "qualify it to a real repository path", and there is no such path to
 * qualify it to. This list gives the correct reason instead.
 *
 * WHY A SEPARATE LIST AND NOT `THIRD_PARTY_TARGETS`. Ruling 4 covers PUBLISHED
 * BUILD ARTIFACTS, where the argument is that no reader-facing symbol exists.
 * markless has ordinary source with ordinary symbols; the argument here is
 * different and weaker - we cannot see that repository from this one, so we can
 * neither name its symbols nor notice when they move. The ordinal is what the
 * finding was filed against, and it is all this repository can honestly carry.
 *
 * IT DOES NOT LOOSEN THE RESOLVER, AND THAT IS ENFORCED TWICE. The match is on
 * the WHOLE path, never a suffix - an abbreviated foreign citation still fails as
 * unclassified until someone qualifies it. And `classify` consults this list only
 * AFTER `resolvesInRepo`, so if a path here ever comes to exist in this repository
 * the local file wins and the citation is a violation. `integrityProblems` fails
 * on that collision as well, so the shadowing cannot pass silently.
 */
export const FOREIGN_REPOSITORY_TARGETS = [
	{
		path: 'packages/web/src/render.ts',
		repository: '@markless/web',
		reason:
			"markless' own `packages/web`, cited by finding 3 for a `renderCsr()` call site. " +
			'Repo-relative in shape, another project in fact; this repository has no ' +
			'`packages/web` and cannot follow the symbol if it moves.',
	},
	{
		path: 'packages/compiler/src/passes/public-render/template.ts',
		repository: '@markless/compiler',
		reason:
			"markless' public-render pass, cited by finding 5 for the empty-static-HTML return. " +
			'This repository\'s `packages/compiler/src` is flat and has no `passes/` directory, ' +
			'so the collision is in the prefix only.',
	},
	{
		path: 'packages/compiler/src/passes/public-render/shared.ts',
		repository: '@markless/compiler',
		reason:
			"markless' public-render shared pass, cited by finding 6 for aliased prop " +
			'destructuring. Same repository and same reason as template.ts above.',
	},
];

/**
 * RULING 6 - VERBATIM QUOTED OUTPUT KEEPS ITS ORDINALS. Ruled by T054 on
 * docs/DEFECTS.md entry 12.1, which prints a stack trace under the heading "THE
 * WITNESSED RED, verbatim".
 *
 * A stack trace is not a citation an author composed. It is EVIDENCE, quoted, and
 * its ordinals are part of what was observed - rewriting them to today's line
 * numbers would forge the transcript, and naming symbols instead would mean the
 * document no longer shows what the tool printed. Entry 12.1's four frames are
 * all stale against HEAD right now, and that is the correct state for a record of
 * a run.
 *
 * THIS IS A CONTEXT EXCLUSION, NOT A PATH ONE - which is exactly why it is narrow
 * enough to be safe. It suspends the check only inside fenced blocks, where the
 * content is code or tool output by construction. Measured before it was added:
 * ZERO citations of any kind sit inside a fence in either previously watched file,
 * so it unwatches nothing that T053 cleared, and the prose of every watched
 * document - which is where citations actually live - is untouched by it.
 */
const FENCE = /^\s*(`{3,}|~{3,})/;

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
	// This repository's own authoring extension. Its absence was a BLIND SPOT, not
	// a ruling: measured on docs/report.md, which carries `.tsrx` citations into
	// real `poc/` files that the detector could not see at all. Adding it can only
	// find MORE citations, and it finds none in either previously watched file.
	'tsrx',
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

/** Whole-path match only - see ruling 5 on why a suffix match would be a hole. */
const foreignRepositoryRuling = (citedPath) =>
	FOREIGN_REPOSITORY_TARGETS.find((rule) => citedPath === rule.path) ?? null;

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
	let fence = null;
	for (const [index, line] of text.split('\n').entries()) {
		const lineNumber = index + 1;
		// RULING 6. A fenced block is quoted code or tool output, so nothing inside it
		// is read as a citation - and the block ENDS the paragraph, exactly as a blank
		// line does. That second half matters: without it a bare ordinal in the prose
		// AFTER a fence could inherit a path from before it, which would let the
		// exclusion change a verdict outside the block it governs.
		const fenceMarker = FENCE.exec(line)?.[1];
		if (fence === null) {
			if (fenceMarker !== undefined) {
				fence = fenceMarker;
				antecedent = null;
				continue;
			}
		} else {
			if (
				fenceMarker !== undefined &&
				fenceMarker[0] === fence[0] &&
				fenceMarker.length >= fence.length
			)
				fence = null;
			continue;
		}
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
	// DELIBERATELY BEFORE RULING 5: a path that exists HERE is first-party no matter
	// what any list says, so ruling 5 can never unwatch a real repository file.
	if (resolvesInRepo(citation.path))
		return {
			verdict: 'violation',
			kind: 'first-party-ordinal',
			reason: `${citation.path} is a file in this repository. Name the symbol, not the line.`,
		};
	const foreign = foreignRepositoryRuling(citation.path);
	if (foreign)
		return { verdict: 'allowed', kind: 'foreign-repository', reason: foreign.reason };
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
 * RULING 5 CANNOT SHADOW A REAL FILE. If one of those paths ever comes to exist
 * here, the exclusion has silently stopped meaning "another repository's file"
 * and must be re-ruled. `classify` already prefers the local file, so the citation
 * would be reported anyway; this makes the collision LOUD rather than merely
 * harmless, because a stale entry in the list is a hole waiting to be reopened.
 *
 * Takes its list as an argument so the suite can hand it a colliding entry and
 * watch this fire. A collision check that has never been seen to fire is exactly
 * the decoration this file's header warns about.
 */
export const foreignShadowProblems = (entries = FOREIGN_REPOSITORY_TARGETS) =>
	entries
		.filter((entry) => existsSync(resolve(root, entry.path)))
		.map(
			(entry) =>
				`FOREIGN_REPOSITORY_TARGETS names ${entry.path} as ${entry.repository}, but that ` +
				'path now exists in THIS repository. Re-rule it: the citation is first-party now.',
		);

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
	problems.push(...foreignShadowProblems());
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
