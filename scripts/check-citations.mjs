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
 *
 * THE RULINGS ARE NUMBERED BY DATE, NOT BY POSITION. They accumulate as the board
 * meets a class it has not met before, so ruling 8 sits next to ruling 1 because
 * WATCHED_SOURCE belongs beside WATCHED, and ruling 9 sits with the detector it
 * changes. Reading order: 1 watched documents, 8 watched source comments, 2 the
 * recorded remainder, 3 board receipts, 4 third-party artifacts, 5 another
 * repository, 6 quoted transcripts, 7 `poc/`, 9 continued ordinal lists.
 *
 * EVERY SCOPE WIDENING HERE HAS BEEN A TIGHTENING. `.tsrx` (T054), source comments
 * and continued lists (T055) can each only find MORE citations than before; not one
 * of them relaxes what counts as first-party. That property is the reason this file
 * can grow without quietly going blind, and it is the thing to preserve.
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
	{
		path: 'docs/report.md',
		reason:
			'T055 RULED `poc/` LIVE, BY MEASUREMENT, AND THE ARCHIVE ITSELF REFUTED THE ARCHIVE ' +
			'READING - see RULING 7. Once its evidence sites are ordinary live first-party ' +
			'citations there is nothing left holding this file back: ruling 5 already accounts ' +
			'for its markless paths, and the `.tsrx` sites now name symbols like every other ' +
			'watched document. It is also the document most likely to be read by someone outside ' +
			'this repository, which is the worst possible place for a citation that no longer lands.',
	},
];

/**
 * RULING 8 - SOURCE COMMENTS ARE WATCHED; CODE IS NOT. Ruled by T055 on the
 * finding that the guard watched `.md` ONLY, while the largest citation surface in
 * the repository is prose written beside the code it cites.
 *
 * THE MEASUREMENT THAT MOTIVATED IT. `packages/frameworks/solid/src/emitter/index.ts`
 * cited a bare `:828` TWICE in one doc comment, and both were ACCURATE at HEAD.
 * That is the danger, not the reassurance: an ordinal that is right today, sitting
 * in a file nothing checks, is exactly the state the five T048 measured were in
 * before they rotted, and exactly the state the DEFECTS.md table was in before T054
 * found it wrong in both directions.
 *
 * COMMENTS, NOT CODE - AND THE SEPARATION IS LEXICAL, NOT A REGEX GUESS. A string
 * literal, an import specifier and a path built at runtime are NOT citations; only
 * a human sentence is. `commentsOnly` blanks every byte that is not inside a `//`
 * or block comment, preserving line and column geometry, so the same detector,
 * rulings and reporting run over source and over Markdown with nothing special-cased.
 *
 * WHY THIS LIST IS SHORT AND SAYS SO. Measured across every tracked JS/TS source
 * file: THIRTEEN carry citation violations in their comments. Most sit in files
 * outside this card's writ, so watching them would have meant a red guard nobody
 * could clear. The remainder is recorded in NOT_YET_WATCHED by name - a partial
 * scope with a written-down remainder, never a scope quietly narrowed to whatever
 * happened to be green.
 */
export const WATCHED_SOURCE = [
	{
		path: 'packages/compiler/src/build.ts',
		reason:
			'The compiler core. It is the single most-cited file in the repository - the ' +
			'DEFECTS.md determinism table, the idiom policy and the generative and metamorphic ' +
			'suites all point into it - so its own comments are read by everyone chasing those.',
	},
	{
		path: 'packages/frameworks/react/src/emitter/index.ts',
		reason:
			'A lane emitter. Emitter doc comments explain WHY an emission is shaped the way it ' +
			'is, and they argue it by pointing at other code; that is a live citation by ' +
			'construction, and the reader is standing in the file when they follow it.',
	},
	{
		path: 'packages/frameworks/solid/src/emitter/index.ts',
		reason:
			'THE FILE THAT PROVED THE CLASS. Its "ASYNC HANDLERS ARE ACCEPTED" comment carried ' +
			'the bare `:828` twice, correct at HEAD and watched by nothing. Same lane-emitter ' +
			'reason as react above; this one also carries the measurement.',
	},
	{
		path: 'packages/frameworks/qwik/src/emitter/index.ts',
		reason:
			'A lane emitter, same reason as react above. Qwik is the lane whose comments carry ' +
			'the most upstream argument, so its pointers are the most load-bearing.',
	},
	{
		path: 'packages/frameworks/svelte/src/emitter/index.ts',
		reason:
			'A lane emitter, same reason as react above. It owns IR-4 under the idiom policy, ' +
			'so its comments cite the policy and the compiler together.',
	},
	{
		path: 'packages/frameworks/vue/src/emitter/index.ts',
		reason:
			'A lane emitter, same reason as react above. Its comments cite third-party Vue ' +
			'bundles as well, which ruling 4 already governs.',
	},
	{
		path: 'packages/frameworks/angular/src/emitter/index.ts',
		reason:
			'A lane emitter, same reason as react above. The newest lane, and the one whose ' +
			'comments are most likely to be written while the cited code is still moving.',
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
		path: 'scripts/check-citations.mjs',
		reason:
			'THIS FILE, AND IT IS A GENUINELY DIFFERENT CLASS - SPECIMEN TEXT. Its comments ' +
			'QUOTE citation shapes in order to define them: `(:8590)`, ":535." and ":498/:642" ' +
			'are the detector\'s specification, not pointers to anywhere. Clearing them would ' +
			'mean deleting the description of what the detector matches, which is a worse ' +
			'document for a better number. That is a ruling nobody has been asked for, so it is ' +
			'recorded here rather than invented - the same refusal T054 made about `poc/`.',
	},
	{
		path: 'packages/compiler/test/citations.test.ts',
		reason:
			"The guard's own suite, and specimen text for the same reason as check-citations.mjs " +
			'above: every planted ordinal in it exists precisely to be matched. A red-calibration ' +
			'test that could not contain the shape it calibrates against would be no test.',
	},
	{
		directory: 'packages/frameworks',
		reason:
			'THE MEASURED REMAINDER, NAMED SO IT CANNOT BE MISTAKEN FOR A CLEAN SWEEP. Beyond ' +
			'the emitters in WATCHED_SOURCE, comment citations survive in the react, solid and ' +
			"qwik test suites, the angular gate, and vue's browser smoke test - mostly ABBREVIATED " +
			'paths like `custom-policies.ts:199-204` that resolve to no file and would report as ' +
			'unclassified. Two of them (`packages/frameworks/qwik/src/gate/index.ts` cited from ' +
			'the angular gate, and `packages/compiler/test/metamorphic.test.ts` cited from three ' +
			'gate suites) are outright first-party ordinals. They are out of T055\'s writ, not ' +
			'out of scope forever.',
	},
	{
		directory: 'packages/compiler/test',
		reason:
			'THE MEASURED REMAINDER, PART TWO. `generative.test.ts` and `metamorphic.test.ts` ' +
			'carry the densest comment citations in the repository - both tabulate `build.ts` ' +
			'sites by ordinal, abbreviated to the bare filename. That is the highest-value ' +
			'promotion left and it is a card, because clearing it means naming a symbol for ' +
			'every row of two tables.',
	},
	{
		directory: 'demos',
		reason:
			'THE MEASURED REMAINDER, PART THREE. The demos cite published framework chunks by ' +
			'ordinal, which ruling 4 would mostly allow once the citations are qualified enough ' +
			'to be recognised; today they are abbreviated and would report as unclassified.',
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

/**
 * RULING 7 - `poc/` IS FIRST-PARTY AND LIVE. THERE IS NO EXCLUSION HERE, AND THAT
 * IS THE RULING. Asked by T055, deferred by T054, and it needed a decision because
 * `poc/` is a third class: archived experiment records whose fixtures are the
 * evidence a recorded finding was produced from. Are they dated, like the board
 * receipts of ruling 3, or live, like the ledger of ruling 1?
 *
 * THE ARCHIVE REFUTED THE ARCHIVE READING. docs/report.md's findings 5, 7 and 8
 * cited `poc/08-equivalence-results` fixtures by ordinal, written on 2026-07-19.
 * `src/wrappers/s1-visible.app.tsrx` was then edited TWICE after that date - by the
 * Arcade-to-Frameless rename, and again by the c9-flip commit that repointed its
 * import at `s1-render-once-plain.tsrx`. The ordinals still landed at HEAD when
 * T054 measured them, but ONLY BECAUSE BOTH EDITS HAPPENED TO BE SAME-LINE
 * SUBSTITUTIONS. That is not a frozen record; that is a live file that has not yet
 * been unlucky. A dated record cannot be edited after its date - this one was.
 *
 * AND THE CITING SENTENCES READ AS LIVE, NOT AS HISTORY. "Evidence sites are...",
 * "The workaround is visible at...", "Prop-derived state starts at..." all invite
 * the reader to go and look NOW. Ruling 3 protects text that says where something
 * STOOD; nothing in these findings says that.
 *
 * SO THE ORDINARY RULE APPLIES, UNMODIFIED. `poc/` fixtures are ordinary source
 * with ordinary symbols - `App`, `RenderOnce`, `KeyedTodo`, named handlers - so
 * the reason for naming a symbol transfers intact, unlike ruling 4's minified
 * bundles or ruling 5's unreachable foreign repository. The consequence is that
 * docs/report.md is now WATCHED rather than NOT_YET_WATCHED.
 */

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

/**
 * RULING 9 - A CONTINUED ORDINAL LIST IS SEVERAL CITATIONS, AND ONLY THE FIRST WAS
 * BEING SEEN. T054 measured the hole and declined to patch it: in
 * `react/test/emitter.test.ts:133-134,141,150` the guard reported `:133-134` and
 * went silent on 141 and 150, so a citation could rot in the tail of a list the
 * guard had already looked at and passed.
 *
 * IT DECLINED BECAUSE THE OBVIOUS WIDENING IS WORSE THAN THE GAP. A rule that
 * matches "a comma then a number" fires on "in 2026, 141 tests passed", and a guard
 * that cries wolf on ordinary prose gets switched off - which loses every citation
 * it was catching, not just the ones it missed.
 *
 * WHAT CLOSES IT WITHOUT THAT RISK: ADJACENCY TO AN ORDINAL ALREADY MATCHED. A
 * continuation is recognised ONLY when `,<digits>` abuts, with ZERO intervening
 * whitespace, the exact end of a citation this pass has already accepted. Both
 * halves of that are load-bearing. The antecedent must be a real ordinal - which
 * requires a `:` that is itself not preceded by a word character, so "12:30," never
 * qualifies and neither does "2026,". And the zero-whitespace requirement is what
 * makes it impossible to reach prose: no English sentence continues a line-number
 * citation with no space after the comma. It is a TIGHTENING, like every widening
 * on this guard so far - it can only find MORE, never unwatch anything.
 *
 * THE SHAPE THAT STILL ESCAPES, WRITTEN DOWN RATHER THAN GLOSSED: the SPACED
 * variant, `emitter.test.ts:133-134, 141`. It is deliberately not matched, because
 * it is not distinguishable from "at `build.ts:12`, 141 tests passed" - same bytes,
 * different meaning, and only the author knows which. Anyone writing a list must
 * therefore close it up or name symbols; the guard cannot tell them apart and does
 * not pretend to.
 *
 * MEASURED BEFORE IT WAS ADDED: exactly ONE comma-continued ordinal exists in the
 * watched set, in docs/report.md finding 4 (`s3-event-form.tsrx:30,40`) - a real
 * live citation whose second half no previous version of this guard could see.
 */
const CONTINUED_ORDINAL = /^,(\d+(?:-\d+)?)(?![\w-]|\.\d)/;

/**
 * RULING 8's SEPARATOR. Blanks every byte of `text` that is not inside a `//` or
 * `/* *\/` comment, replacing it with a space and leaving newlines alone, so line
 * and column numbers are identical to the original file. That is what lets the
 * SAME detector, the SAME rulings and the SAME reporting run over source.
 *
 * WHY A LEXER AND NOT A REGEX. The separation has to be exact in one direction: a
 * string literal, an import specifier or a URL must NEVER be read as prose. So this
 * walks the text tracking string, template and regular-expression literals, and
 * only text it is standing inside a comment for is kept. A `//` inside `'http://'`
 * or inside a template literal is skipped for the same reason a reader skips it.
 *
 * VALIDATED BY MEASUREMENT ACROSS EVERY TRACKED SOURCE FILE, IN BOTH DIRECTIONS.
 * No line it retains fails to begin with `//`, `/*` or `*` - so no code leaks into
 * the prose stream. And of the comment-shaped lines in those files it drops exactly
 * two, both inside a template literal in a `poc/` probe that BUILDS JavaScript
 * source as a string; those are comments in generated output, not in this file, and
 * dropping them is correct.
 */
export const commentsOnly = (text) => {
	const out = [...text].map((character) => (character === '\n' ? '\n' : ' '));
	const keep = (from, to) => {
		for (let index = from; index < to; index += 1)
			if (text[index] !== '\n') out[index] = text[index];
	};
	// The previous significant character, which is how a lexer without a parser tells
	// a regular-expression literal from a division: `/` after an operator or an
	// opening bracket starts a regex, `/` after a value divides it.
	let previous = '';
	let index = 0;
	const skipTemplate = (start) => {
		let cursor = start;
		while (cursor < text.length) {
			if (text[cursor] === '\\') {
				cursor += 2;
				continue;
			}
			if (text[cursor] === '`') break;
			if (text[cursor] === '$' && text[cursor + 1] === '{') {
				// An interpolation is code again, but nothing in this repository writes a
				// comment inside one, so it is skipped whole by brace balance.
				let depth = 1;
				cursor += 2;
				while (cursor < text.length && depth > 0) {
					if (text[cursor] === '{') depth += 1;
					else if (text[cursor] === '}') depth -= 1;
					else if (text[cursor] === '`') cursor = skipTemplate(cursor + 1);
					cursor += 1;
				}
				continue;
			}
			cursor += 1;
		}
		return cursor;
	};
	while (index < text.length) {
		const character = text[index];
		const next = text[index + 1];
		if (character === '/' && next === '/') {
			let end = index;
			while (end < text.length && text[end] !== '\n') end += 1;
			keep(index, end);
			index = end;
			continue;
		}
		if (character === '/' && next === '*') {
			const close = text.indexOf('*/', index + 2);
			const end = close === -1 ? text.length : close + 2;
			keep(index, end);
			index = end;
			continue;
		}
		if (character === "'" || character === '"') {
			let end = index + 1;
			while (end < text.length) {
				if (text[end] === '\\') {
					end += 2;
					continue;
				}
				if (text[end] === character || text[end] === '\n') break;
				end += 1;
			}
			index = end + 1;
			previous = 'x';
			continue;
		}
		if (character === '`') {
			index = skipTemplate(index + 1) + 1;
			previous = 'x';
			continue;
		}
		if (character === '/') {
			if (previous === '' || /[=(,:[!&|?{};+\-*%<>~^]/.test(previous)) {
				let end = index + 1;
				let inCharacterClass = false;
				while (end < text.length) {
					if (text[end] === '\\') {
						end += 2;
						continue;
					}
					if (text[end] === '[') inCharacterClass = true;
					else if (text[end] === ']') inCharacterClass = false;
					else if (text[end] === '/' && !inCharacterClass) break;
					else if (text[end] === '\n') {
						// An unterminated regex on one line was a division after all.
						end = index;
						break;
					}
					end += 1;
				}
				if (end > index) {
					index = end + 1;
					previous = 'x';
					continue;
				}
			}
			previous = '/';
			index += 1;
			continue;
		}
		if (!/\s/.test(character)) previous = character;
		index += 1;
	}
	return out.join('');
};

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
		// RULING 9. A `,141` that abuts the end of a citation already accepted on this
		// line continues it, and inherits its path. Iterated, so `:133-134,141,150`
		// yields both tail entries rather than only the first.
		const continuations = [];
		for (const cited of onThisLine) {
			let end = cited.column - 1 + cited.raw.length;
			for (;;) {
				const continued = CONTINUED_ORDINAL.exec(line.slice(end));
				if (continued === null) break;
				continuations.push({
					lineNumber,
					column: end + 1,
					raw: continued[0],
					path: cited.path,
					ordinal: continued[1],
					inheritedFrom:
						cited.path === null ? null : `${cited.path} (line ${lineNumber}, continued list)`,
				});
				end += continued[0].length;
			}
		}
		onThisLine.push(...continuations);
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
 * RULING 8's ANTI-DRIFT COUNTERPART TO `listDocsTopLevel`. Six lanes exist today
 * and the board keeps adding them; a seventh emitter must not be able to arrive
 * unruled, which is precisely how source comments stayed unwatched through four
 * hand-sweeps in the first place.
 */
const listEmitterSources = () =>
	readdirSync(resolve(root, 'packages/frameworks'), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => `packages/frameworks/${entry.name}/src/emitter/index.ts`)
		.filter((path) => existsSync(resolve(root, path)));

/**
 * Takes its list as an argument for the same reason `foreignShadowProblems` does:
 * so the suite can hand it a seventh lane that nobody has ruled and WATCH IT FIRE.
 * A drift check that has only ever been seen to pass is decoration.
 */
export const emitterClassificationProblems = (
	classified,
	emitters = listEmitterSources(),
) =>
	emitters
		.filter((path) => !classified.has(path))
		.map(
			(path) =>
				`${path} is a lane emitter that is neither WATCHED_SOURCE nor NOT_YET_WATCHED. ` +
				'Rule its comments: ruling 8 watches every emitter, so a new lane must say why not.',
		);

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
	for (const entry of WATCHED_SOURCE) {
		if (!existsSync(resolve(root, entry.path))) {
			problems.push(`WATCHED_SOURCE names ${entry.path}, which does not exist.`);
			continue;
		}
		if (notWatched.has(entry.path))
			problems.push(`${entry.path} is both WATCHED_SOURCE and NOT_YET_WATCHED.`);
		// RULING 8 CANNOT BE EMPTIED BY BREAKING ITS SEPARATOR. If `commentsOnly` ever
		// returns blanks - a lexer bug, a new syntax it mis-tracks - every watched source
		// file would pass vacuously and read as green. A watched source file with no
		// prose in it is not a clean file; it is a broken check.
		const comments = commentsOnly(readFileSync(resolve(root, entry.path), 'utf8'));
		if (comments.replaceAll(/\s/g, '').length < 200)
			problems.push(
				`WATCHED_SOURCE names ${entry.path}, but commentsOnly finds almost no comment text ` +
					'in it. Either the file lost its doc comments or the separator is broken; either ' +
					'way the guard would pass it vacuously.',
			);
	}
	problems.push(...foreignShadowProblems());
	// Every living top-level doc must be classified. A new one with bare ordinals
	// cannot slip in unruled, which is how this class survived four sweeps.
	const classified = new Set([
		...WATCHED.map((entry) => entry.path),
		...WATCHED_SOURCE.map((entry) => entry.path),
		...notWatched,
	]);
	for (const file of listDocsTopLevel())
		if (!classified.has(file))
			problems.push(
				`${file} is neither WATCHED nor NOT_YET_WATCHED. Rule it: watched files must be ` +
					'clean, unwatched ones must say why not.',
			);
	// RULING 8's equivalent for the lanes: a seventh emitter cannot arrive unruled.
	problems.push(...emitterClassificationProblems(classified));
	return problems;
};

export const scanRepository = () => {
	const violations = [];
	for (const entry of WATCHED) {
		const text = readFileSync(resolve(root, entry.path), 'utf8');
		violations.push(...scanText(text, entry.path));
	}
	// RULING 8. Same detector, same rulings, same reporting - the only difference is
	// that everything which is not a comment has been blanked out first.
	for (const entry of WATCHED_SOURCE) {
		const text = readFileSync(resolve(root, entry.path), 'utf8');
		violations.push(...scanText(commentsOnly(text), entry.path));
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
	console.log(
		`check-citations: clean over ${WATCHED.length} watched document(s) and ` +
			`${WATCHED_SOURCE.length} watched source file(s) (comments only).`,
	);
}
