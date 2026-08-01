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
 * changes. Reading order: 1 watched documents, 8 watched source comments, 2 what
 * is exempt and why, 3 board receipts, 4 third-party artifacts, 5 another
 * repository, 6 quoted transcripts, 7 `poc/`, 9 continued ordinal lists, 10 the
 * sweep over everything else.
 *
 * EVERY SCOPE WIDENING HERE HAS BEEN A TIGHTENING. `.tsrx` (T054), source comments
 * and continued lists (T055), and the sweep (T056) can each only find MORE
 * citations than before; not one of them relaxes what counts as first-party. That
 * property is the reason this file can grow without quietly going blind, and it is
 * the thing to preserve.
 *
 * THE CLASS IS CLOSED, WHICH CHANGES WHAT THIS FILE IS FOR. Through T055 the guard
 * watched a NAMED SET and recorded what it could not reach. Ruling 10 inverts that:
 * every tracked source file is checked unless a ruling excuses it by name, so the
 * lists below no longer decide what is seen. The next person here is adding a
 * reason, not a scope - and if they find themselves adding a `directory` entry to
 * widen an exemption, that is the one move this file has never made.
 */

import { execFileSync } from 'node:child_process';
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
 * THE LIST WAS SHORT AND SAID SO; T056 CLOSED IT. T055 watched seven files and
 * recorded the rest by name: ten more files carrying forty-seven violations. T056
 * re-measured that remainder independently, found it exact, cleared all forty-seven
 * and added those ten below. Every one was RED at the commit before it was cleared,
 * per file - the calibration each previous scope also did on real content.
 *
 * WATCHING BY NAME IS NOW THE INNER RING, NOT THE WHOLE GUARD. Ruling 10 sweeps
 * every tracked source file, so this list no longer decides what is seen; it
 * decides what carries a written reason and what is protected against being
 * emptied. A file here must have prose in it, which the integrity check enforces.
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
	{
		path: 'packages/compiler/test/metamorphic.test.ts',
		reason:
			'THE DENSEST CITATION TABLE IN THE REPOSITORY, AND IT HAD ALREADY ROTTED. Its ' +
			'order-insensitive view is applied BY CITATION - seven included collections and four ' +
			'excluded ones, each naming the build.ts site whose comparator justifies it. Every ' +
			'one of those seventeen ordinals was WRONG at HEAD when T056 measured them: `:428` ' +
			'was cited as the `records.bindings` comparator and pointed at an alias-map write. ' +
			'A view that says it is justified by a citation, resting on citations that no longer ' +
			'land, is the exact instrument fault defect 6 was. Now named by symbol and watched.',
	},
	{
		path: 'packages/compiler/test/generative.test.ts',
		reason:
			'The second copy of that table, kept deliberately duplicated because importing one ' +
			'test file from another would register its suites twice. Duplication is the reason ' +
			'it must be watched: two copies drift independently, and the comment that tells you ' +
			'to change both cannot enforce it. Same twelve rows, same rot, now the same symbols.',
	},
	{
		path: 'packages/frameworks/react/test/emitter.test.ts',
		reason:
			'A lane test suite. Its comments carry the WITNESSED RED for defect 12 and the ' +
			"conditional-cancellation pinning, both arguing from the emitter's code - the class " +
			'of prose that is worthless the moment its pointers stop landing.',
	},
	{
		path: 'packages/frameworks/react/test/gate.test.ts',
		reason:
			'The largest gate corpus. Rows rewritten by T021 justify themselves by naming the ' +
			'exact custom-policies branch no other row reaches, so a citation that drifts turns ' +
			'a deliberate coverage argument back into the near-duplicate it replaced.',
	},
	{
		path: 'packages/frameworks/solid/test/emitter.test.ts',
		reason:
			'A lane test suite, same reason as react above. It records the async-handler ' +
			'refusal T046 removed, which means it cites a site that no longer exists at all.',
	},
	{
		path: 'packages/frameworks/solid/test/gate.test.ts',
		reason:
			"A gate corpus carrying the mutation-no-op guard's rationale, one of three copies " +
			'that all cited the same wrong ordinal - see the react gate entry above.',
	},
	{
		path: 'packages/frameworks/qwik/test/gate.test.ts',
		reason:
			'The third copy of that guard, over the most exposed corpus of the three: its ' +
			'mutants are built from emitted files the emitter is free to reshape.',
	},
	{
		path: 'packages/frameworks/angular/src/gate/index.ts',
		reason:
			'A GATE, NOT A TEST - and its citation was load-bearing for a claim about ANOTHER ' +
			"lane. It justified Angular's zero-omissions discipline by pointing at the qwik " +
			'gate dropping two rules unrecorded. The qwik gate stopped doing that; the ordinal ' +
			'landed on the very comment that says so, and the sentence around it stayed false.',
	},
	{
		path: 'packages/frameworks/vue/test/emitted-smoke.browser.test.ts',
		reason:
			"Carries the lane's most surprising measured finding - Vue's `createInvoker` " +
			'timestamp guard - argued from a published bundle. Ruling 4 governs the ordinals; ' +
			'watching it is what forces the path to stay qualified enough to be recognised.',
	},
	{
		path: 'demos/angular-official/scenarios.box.ts',
		reason:
			'THE ONLY WATCHED FILE OUTSIDE `packages/`, and the one a newcomer meets first. It ' +
			"cites @angular/ssr's published bundle to explain why the demo sets an env var " +
			'instead of editing the scaffold - an argument that has to be checkable, because ' +
			'its whole point is that the scaffold was left byte-identical.',
	},
];

/**
 * RULING 2 - NOT YET WATCHED. Recorded rather than silently skipped. Each entry
 * says why it is out of scope; none of them is ruled correct, so promoting one is
 * a card, not a discovery. NO COUNTS ARE STATED HERE - the own-no-size pattern
 * this board ratified in T048 applies to the guard's own prose too.
 *
 * THE THREE `MEASURED REMAINDER` DIRECTORY ENTRIES ARE GONE, AND THEIR ABSENCE IS
 * THE POINT. T055 recorded `packages/frameworks`, `packages/compiler/test` and
 * `demos` here because each still held unwatched comment citations it could not
 * clear. T056 cleared every one and ruling 10 now sweeps all three directories, so
 * leaving the entries would have been worse than useless: a directory named here
 * is a directory the sweep must skip, which would have re-blinded the guard to the
 * exact files this card was written to watch. What remains is only the specimen
 * text below and `docs/goals`, which the sweep does not reach because it is prose.
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

/**
 * RULING 10 - EVERY TRACKED LEXABLE SOURCE FILE IS SWEPT. Ruled by T056, the card
 * that CONVERGED this class OVER LEXABLE SOURCE instead of widening it a fourth time.
 *
 * WHY A SWEEP AND NOT A LONGER LIST. T053, T054 and T055 each widened the guard by
 * name and each ended with a recorded remainder, which is a pattern that terminates
 * only if someone eventually stops naming files. T056 cleared the last of the
 * measured remainder - ten files, forty-seven violations - so the honest end state
 * is not "seventeen files are watched" but "NO LEXABLE SOURCE FILE CARRIES AN UNRULED
 * CITATION". The first is a snapshot that rots the moment a file is added. The second
 * is a property, and a property is what a check can hold.
 *
 * THAT QUALIFIER IS LOAD-BEARING, AND IT WAS PUT BACK BY REFUTATION RATHER THAN BY
 * EDIT. T056's receipt dropped it and claimed the class CONVERGED outright - that
 * "nothing carries an unruled citation" was the property this file holds. IT IS NOT
 * THAT PROPERTY. The final audit (T999) refuted the claim by running this file's OWN
 * `scanText` over `docs/goals/frameless-defects-and-targets-v1/notes/` and finding
 * 216 VIOLATIONS ACROSS 30 OF ITS 38 MARKDOWN FILES, including first-party ordinals
 * into live code. T057 re-measured it independently at HEAD, per file, and got the
 * same 216 across the same 30. Two structural reasons, both visible in this file:
 *
 *   - THE SWEEP IS JS/TS ONLY. `SWEPT_SOURCE_EXTENSIONS` below is
 *     /\.(?:ts|tsx|js|jsx|mjs|cjs)$/, so Markdown reaches the detector ONLY through
 *     the hand-named `WATCHED` list - four documents, chosen one card at a time.
 *   - THE MARKDOWN COMPLETENESS CHECK DOES NOT RECURSE. `listDocsTopLevel` calls
 *     `readdirSync` on `docs/` and filters `isFile()`, so it sees the three top-level
 *     documents and NOTHING beneath them. A new unruled document under `docs/goals/`
 *     raises no integrity problem at all; it is covered only by RULING 2's `docs/goals`
 *     DIRECTORY entry, which excuses the archive as dated task records - a reason, but
 *     not a reading. Nothing measures whether that reason still fits what is in there.
 *
 * THE UNSWEPT CONTAINERS, MEASURED RATHER THAN LISTED FROM MEMORY. T056's receipt
 * disclosed `.vue`/`.svelte` only, which is true and is the SMALLEST of them. T057
 * scanned every tracked file of each extension below with this file's own `scanText`
 * over RAW TEXT. Raw text is an UPPER BOUND, not a violation count: none of these has
 * a comment lexer here, so code, data and prose are all read alike.
 *
 *   .vue/.svelte   43 files, ZERO - the disclosure below, re-measured, still true
 *   .tsrx          62 files, ZERO
 *   .html          13 files, ZERO
 *   .yaml/.yml     11 non-board files carry ONE, and it is in
 *                  `.github/workflows/ci.yml` where it is QUOTED SPECIMEN TEXT: a
 *                  correction block reciting the false comment it replaced. The other
 *                  20 tracked `.yaml` files are GoalBuddy `state.yaml` boards carrying
 *                  561 between them - which RULING 3 has already ruled are dated
 *                  records that KEEP their ordinals.
 *   .json          5 files carry 62 - two witness-receipt fixtures (recorded tool
 *                  output), a tsconfig, a package.json and a `poc/` results file.
 *   .md            93 of 200 tracked files carry 1214, of which 1198 are under
 *                  `docs/goals/`.
 *
 * SO THE LARGEST UNSWEPT SURFACE IS THE ADJUDICATION ARCHIVE - the same place T056
 * found the born-wrong citation it was cleaning up after.
 *
 * WIDENING IS A SUCCESSOR'S CARD, AND THOSE READINGS ARE THE ARGUMENT FOR WHY IT IS
 * NOT A ONE-LINE PATCH. T057 was scoped to correct the CLAIM, not the SCOPE, because
 * adding an extension here without a ruling behind it turns a large surface red with
 * nobody assigned to clear it. The `.yaml` and `.json` readings show the shape of the
 * work: raw text cannot tell a live citation from RULING 3's dated receipt, from
 * recorded tool output, or from specimen text quoted in order to correct it. Each
 * container needs its own ruling and its own lexer first - which is exactly the
 * argument RULING 8 made when it separated comments from code.
 *
 * IT IS A TIGHTENING, LIKE EVERY WIDENING BEFORE IT. `.tsrx` (T054), source
 * comments and continued lists (T055) could each only find MORE; so can this. It
 * adds files to the scan and relaxes nothing: `classify` is untouched, no exclusion
 * is added, and the two files it skips are skipped because RULING 2 already names
 * them by path.
 *
 * THE SKIP LIST IS BY PATH ONLY, DELIBERATELY. A NOT_YET_WATCHED entry with a
 * `directory` no longer suppresses anything here. If directories could suppress the
 * sweep, then `packages/frameworks` - one of the three entries T055 recorded - would
 * have exempted six lanes from the check written to cover them, and the guard would
 * have read green over the largest surface it has. Only `path` entries exempt, so
 * an exemption is always one named file with one written reason.
 *
 * SCOPED TO JS/TS BECAUSE `commentsOnly` IS A JS LEXER, AND THE LIMIT IS MEASURED
 * RATHER THAN ASSUMED. `.vue` and `.svelte` files have their own grammars around
 * their script blocks, so running this lexer over them whole would be a guess. All
 * 43 tracked `.vue`/`.svelte` files were scanned anyway when this ruling was
 * written: ZERO carry a comment citation of any kind, so nothing is being hidden by
 * the scope - it is a limit on the instrument, recorded, not a silent exclusion.
 *
 * TRACKED, NOT PRESENT. The list comes from `git ls-files`, so a scratch file, a
 * build output or an untracked worktree cannot turn the guard red, and a file
 * cannot escape it by being ignored either - if it is checked in, it is swept.
 */
const SWEPT_SOURCE_EXTENSIONS = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;

export const listTrackedSourceFiles = () =>
	execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
		.split('\0')
		.filter(
			(path) =>
				path !== '' &&
				SWEPT_SOURCE_EXTENSIONS.test(path) &&
				!path.includes('node_modules/') &&
				existsSync(resolve(root, path)),
		);

/**
 * Ruling 10's anti-vacuity check, and it takes its list as an argument for the same
 * reason `foreignShadowProblems` and `emitterClassificationProblems` do: so the
 * suite can hand it an empty sweep and WATCH IT FIRE. If `git ls-files` ever fails
 * softly - a detached checkout, an export without a `.git` - the sweep would find
 * nothing and every unlisted file would read green, which is precisely the vacuous
 * pass this guard's header warns about. The threshold is a floor, not a count: this
 * repository tracks several hundred source files, so anything under a hundred means
 * the enumeration broke rather than that the repository shrank.
 */
/**
 * The sweep's actual scope: tracked, lexable, not already scanned by name, and not
 * exempted BY PATH under ruling 2. Exported so the suite can assert what it covers
 * rather than infer it from a green run.
 */
export const sweptSourceFiles = (files = listTrackedSourceFiles()) => {
	const ruledByPath = new Set([
		...WATCHED_SOURCE.map((entry) => entry.path),
		...NOT_YET_WATCHED.filter((entry) => entry.path).map((entry) => entry.path),
	]);
	return files.filter((path) => !ruledByPath.has(path));
};

export const sweepProblems = (files = listTrackedSourceFiles()) =>
	files.length < 100
		? [
				`RULING 10's sweep enumerated only ${files.length} tracked source file(s). That is ` +
					'too few for this repository, so `git ls-files` failed rather than the repository ' +
					'shrinking - and every unswept file would have passed vacuously.',
			]
		: [];

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

/**
 * RULING 11 - A COUNT COPIED OUT OF A TABLE ROTS EXACTLY LIKE A LINE ORDINAL, SO IT
 * GETS EXACTLY THE SAME TREATMENT. Ruled by the owner on `frameless-app-fidelity-v1`
 * OD3, verbatim: "Make it a check".
 *
 * WHAT WAS MEASURED FIRST. T015 swept NINE families of hand-written counts across
 * this repository and answered the convergence question with NOT CONVERGING: every
 * one of them is a number DERIVED FROM A TABLE AT AUTHORING TIME and then written
 * into prose that nothing recompiles. That is the generator this file already broke
 * once, for citation ordinals, after four hand-correction cards re-drifted. The
 * smallest complete family is this one - the angular demo lane's claims about its
 * own wrapper components - and it had rotted into SELF-CONTRADICTION inside a single
 * directory: `contacts-page.ts` said "the SIXTH of six wrapper components in this
 * lane" while `habits-page.ts`, four files away, said "the SIXTH of EIGHT". Same
 * lane, same subject, same ordinal, different denominators, and NOTHING IN THE TEXT
 * TO TELL A READER WHICH - the identical failure T048 recorded for the ordinals.
 *
 * AND BOTH OF THEM WERE WRONG, WHICH IS WHAT DECIDED THE SHAPE OF THIS RULING. NINE
 * wrapper components exist in that lane, not six and not eight, because
 * `./async-gate.ts` is one - and the lane's OWN route table is what says so: "S8 is
 * the one route with a WRAPPER component", and /todomvc is "the SECOND OF TWO ROUTES
 * HERE THAT GO THROUGH A WRAPPER". `todomvc-page.ts` names it "the precedent for a
 * wrapper in this lane". The denominators had drifted apart because THE POPULATION
 * HAD NEVER BEEN DEFINED ANYWHERE A MACHINE COULD READ IT. So this ruling defines it
 * in code and derives it, which is the only version of the fix that survives S18.
 *
 * TWO RULES, BECAUSE THE OWNER'S RULING HAS TWO HALVES.
 *
 *   (1) A POSITION AMONG THE WRAPPER COMPONENTS MAY NOT BE STATED AT ALL. It is the
 *       half of the claim this repository CANNOT derive. Those ordinals were written
 *       in ARRIVAL order, which lives in git history and not on disk, and ROUTE order
 *       - the only order a file can be read for - disagrees with every single one of
 *       them. A check that recomputed a position would be GUESSING A BASIS and would
 *       silently rewrite what the author meant, so the position goes and the sentence
 *       states the fact instead. That is OD3's first half, enforced rather than swept.
 *
 *   (2) A COUNT MAY BE STATED, AND THEN IT IS RECOMPILED HERE. Each subject below
 *       carries a derivation that reads the real source AT CHECK TIME. Nothing in
 *       this file stores the number: `angularWrapperComponents` enumerates the
 *       directory and `angularApplicationRoutes` parses the lane's own route table.
 *       The day a tenth wrapper lands, prose that says nine goes red by itself.
 *
 * POSITION IS FORBIDDEN FOR WRAPPERS AND NOT FOR ROUTES, AND THE ASYMMETRY IS A
 * MEASUREMENT. `hn-page.ts` records "THIS WAS THE THIRD APPLICATION ROUTE THIS LANE
 * HAD" - past tense, a dated record of the sort ruling 3 protects - and this guard
 * has no instrument that can tell a past-tense record from a live claim. Forbidding
 * route positions would therefore demand the "correction" of a true sentence, which
 * is the one thing ruling 6 was written to stop. Wrapper positions carry no such
 * survivor, so they are refused outright.
 *
 * A QUOTATION IS A RECITATION, NOT A CLAIM - the same reading ruling 6 gives a fenced
 * block. `habits-page.ts` records what its own first line USED to say, in quotes, and
 * that sentence is CORRECT AS IT STANDS: it is the evidence of what rotted, and a
 * check that demanded it be "fixed" would be destroying the record of its own reason
 * to exist. So a match inside a pair of double quotes is exempt. THE HOLE THAT LEAVES
 * IS WRITTEN DOWN RATHER THAN GLOSSED, exactly as ruling 9 wrote down its spaced
 * variant: someone can hide a LIVE stale count by quoting it. BACKTICKS DELIBERATELY
 * DO NOT EXEMPT - this codebase spells paths and identifiers in them constantly, and
 * a rule that went blind wherever a backtick appears would be the vacuous pass this
 * file's header warns about. Both failure modes of the quote lexer - an unpaired
 * quote, and a pair longer than `QUOTATION_LIMIT` - drop the exemption rather than
 * widening it, so the instrument fails TOWARDS red.
 *
 * THE SCOPE IS THE DIRECTORY MINUS NAMED EXEMPTIONS, NOT A LIST OF FILES - ruling
 * 10's inversion applied to a much smaller surface. A new wrapper page in that lane
 * is scanned the day it lands and does not have to be added anywhere. T018 emptied
 * the exemption list, so the scope is now the whole directory.
 *
 * WHAT THIS RULE STILL CANNOT SEE, WRITTEN DOWN RATHER THAN GLOSSED - the same
 * treatment ruling 9 gave its spaced variant. Both holes were MEASURED by T018 while
 * correcting the last six sites of this family, and neither can be closed by widening
 * a regex without breaking something that works:
 *
 *   A COUNT OF SOMETHING ELSE THAT IMPLIES A COUNT OF THESE. `async-gate.ts` called
 *   itself "the ONE route in this lane that needs a wrapper component at all" and the
 *   route table called /s8 "the one route with a WRAPPER component". The number there
 *   attaches to ROUTES, not to the noun this subject derives, so the rule reads past
 *   it. Letting the number float up to 40 characters away from the noun - the licence
 *   the POSITION rule takes - would fire on "one of this lane's wrapper components",
 *   which is the exact sentence T017 wrote into five files AS THE FIX. The looser rule
 *   would therefore red-flag its own remedy, so the tight one stands and the hole is
 *   recorded.
 *
 *   A COUNT OF ZERO SPELLED IN ENGLISH. The same file said route `data` "is what keeps
 *   this lane free of wrappers". That is a claim that the count is nought, it was false
 *   by nine, and no number word appears in it at all.
 *
 * BOTH SHAPES WERE FOUND BY READING THE FILES, NOT BY RUNNING THE CHECK, which is the
 * honest statement of what this instrument is: it makes a stated NUMBER re-derivable,
 * and it does not make prose true.
 *
 * A SECOND FAMILY WAS ADOPTED BY T019 - THE SIX-LANE CHAIN - AND IT ADDED A THIRD HOLE
 * BEFORE IT ADDED A SUBJECT. The 53 sites T015 swept never once wrote a NUMBER: they
 * wrote "the THIRD scenario all six lanes emit and ship, after S13 and S15". There is
 * no count in that sentence for the rule above to recompile and no `of` for the
 * position rule to hinge on, so RULING 11 COULD NOT SEE ONE SITE OF THAT FAMILY AT
 * HEAD. That is the third measured limit, and it decided the shape of the fix: OD3's
 * first half - REMOVE THE POSITION - had to close the family by hand, and the second
 * half could only be applied where the corrected sentence names a class this file can
 * count. See `COUNTED_CORPUS_SUBJECTS`.
 *
 * A FOURTH LIMIT IS STRUCTURAL AND IS NOT THIS RULE'S TO FIX. Ruling 10's sweep is
 * scoped to JS/TS because `commentsOnly` is a JS lexer, so the vue lane's `App.vue`
 * and the svelte lane's `+page.svelte` route prose - TWO OF THE SIX LANES - cannot be
 * scanned at all. Their sentences were corrected by hand and deliberately state NO
 * count, because a number written where no check can read it looks guarded and is not.
 */
const ANGULAR_LANE_DIR = 'demos/angular-official/src/app';

/**
 * RULING 11's RECORDED REMAINDER, AND IT IS NOW EMPTY. T017 - the card that built this
 * rule - could not write to `app.routes.ts`, `app.config.ts` or `async-gate.ts`, so it
 * recorded all three here rather than skipping them silently. T018 corrected them and
 * DELETED THE EXEMPTIONS, so the whole lane is scanned and this list is the shape an
 * exemption list should end in.
 *
 * THE LIST STAYS, EMPTY, FOR TWO REASONS. It is the seam a future card re-opens if a
 * file in that lane has to stop being scanned, and it must then carry a written reason
 * like every other ruling in this file. And `angularCountIntegrityProblems` still
 * checks every entry for existence, so an exemption that points at a renamed file can
 * never silently unwatch it - a check the suite exercises by handing that function a
 * synthetic entry and watching it fire, because a check that has only ever been seen to
 * pass over an EMPTY list is decoration.
 */
/** @type {{ path: string, reason: string }[]} */
export const ANGULAR_COUNT_NOT_SCANNED = [];

/**
 * The prose scanned by ruling 11: every tracked-shaped `.ts` file in that lane except
 * the recorded remainder. Exported so the suite can assert what it covers rather than
 * infer it from a green run - the same reason `sweptSourceFiles` is exported. Takes
 * both its directory and its exemptions as arguments so the suite can point it at a
 * synthetic lane instead of at repository prose, which would otherwise make these
 * tests break the day a card corrects a comment.
 */
export const angularLaneFiles = (dir = ANGULAR_LANE_DIR, exemptions = ANGULAR_COUNT_NOT_SCANNED) => {
	const exempt = new Set(exemptions.map((entry) => entry.path));
	return readdirSync(resolve(root, dir), { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
		.map((entry) => `${dir}/${entry.name}`)
		.filter((path) => !exempt.has(path))
		.sort();
};

/**
 * THE DERIVATION, AND IT IS A DEFINITION THE PROSE NEVER HAD. A wrapper component in
 * this lane is a HAND-WRITTEN component that mounts an EMITTED one: `@Component` in
 * the file and an import out of `../emitted/`. That admits `async-gate.ts` and the
 * eight `*-page.ts` files, and excludes `app.ts` - the router shell, which declares a
 * component but mounts no emitted output - and `app.routes.ts`, which imports the
 * emitted components but declares none. Read at check time, never stored.
 */
export const angularWrapperComponents = (dir = ANGULAR_LANE_DIR) =>
	readdirSync(resolve(root, dir), { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
		.map((entry) => `${dir}/${entry.name}`)
		.filter((path) => {
			const text = readFileSync(resolve(root, path), 'utf8');
			return /@Component\s*\(/.test(text) && text.includes("from '../emitted/");
		})
		.sort();

/**
 * The lane's APPLICATION routes, parsed out of its own route table: every `path`
 * entry that is not the three-way contract. `''` is s1 and `s2`-`s9` are the rest of
 * it - `scripts/e2e.mjs` pins that contract to the literal ['s1'..'s9'] - so what is
 * left is exactly the corpus applications this lane serves.
 */
export const angularApplicationRoutes = (file = `${ANGULAR_LANE_DIR}/app.routes.ts`) =>
	[...readFileSync(resolve(root, file), 'utf8').matchAll(/\bpath:\s*'([^']*)'/g)]
		.map((match) => match[1])
		.filter((path) => path !== '' && !/^s\d+$/.test(path));

const NUMBER_WORDS = new Map([
	['one', 1],
	['two', 2],
	['three', 3],
	['four', 4],
	['five', 5],
	['six', 6],
	['seven', 7],
	['eight', 8],
	['nine', 9],
	['ten', 10],
	['eleven', 11],
	['twelve', 12],
	['thirteen', 13],
	['fourteen', 14],
	['fifteen', 15],
	['sixteen', 16],
	['seventeen', 17],
	['eighteen', 18],
	['nineteen', 19],
	['twenty', 20],
]);

const ORDINAL_WORDS = [
	'first',
	'second',
	'third',
	'fourth',
	'fifth',
	'sixth',
	'seventh',
	'eighth',
	'ninth',
	'tenth',
	'eleventh',
	'twelfth',
	'thirteenth',
	'fourteenth',
	'fifteenth',
	'sixteenth',
	'seventeenth',
	'eighteenth',
	'nineteenth',
	'twentieth',
];

/**
 * RULING 11's SECOND FAMILY - THE SIX-LANE CHAIN - AND WHY IT NEEDED NEW DERIVATIONS
 * RATHER THAN A NEW NOUN. T015 swept 53 sites across 21 files that all state the same
 * kind of claim: WHERE a corpus application sits in the sequence of applications that
 * ALL SIX LANES emit. Every one of them counted from S13, because S13's own comment
 * once claimed to be the first - and that was wrong ON THE DAY IT WAS WRITTEN. S10 has
 * carried no `unbuilt` entry in any revision of `scripts/demo.mjs`, so it was always
 * first; S11 and S12 then joined when `frameless-app-fidelity-v1` T007 closed the
 * angular global-identifier hole. The whole family was short by three names.
 *
 * THE POPULATION IS DEFINED WHERE THE PROGRAM ALREADY DEFINES IT. `announce()` in
 * `scripts/demo.mjs` computes this exact set to print it - applications are the rows
 * whose id is not `S1`-`S9`, and the chain is the applications with no `unbuilt` entry
 * in ANY lane. The prose paraphrased that computation by hand. These derivations read
 * the SAME two tables out of the SAME file at check time, so the day an S18 lands, or
 * a lane records a new refusal, every stated count moves with it.
 *
 * THE TABLES ARE SLICED, NOT EVALUATED. Importing `scripts/demo.mjs` would RUN it -
 * it is a CLI that boots six dev servers - so the two array literals are cut out
 * between their `const NAME = [` opener and the `];` that closes them at column zero,
 * and read with the narrowest regexes that answer the question. A slice that fails
 * yields nothing, which is why `corpusChainIntegrityProblems` puts a floor under all
 * three derivations.
 */
const CORPUS_TABLE_FILE = 'scripts/demo.mjs';

const corpusTableBlock = (name, file = CORPUS_TABLE_FILE) => {
	const text = readFileSync(resolve(root, file), 'utf8');
	const opener = `\nconst ${name} = [\n`;
	const start = text.indexOf(opener);
	if (start < 0) return '';
	const end = text.indexOf('\n];\n', start);
	if (end < 0) return '';
	return text.slice(start + opener.length, end);
};

/** The lanes, in table order. `react, solid, qwik, svelte, vue, angular` today. */
export const corpusLanes = (file = CORPUS_TABLE_FILE) =>
	[...corpusTableBlock('DEMOS', file).matchAll(/^\t\tname:\s*'([^']+)'/gm)].map((match) => match[1]);

/**
 * The corpus APPLICATIONS: every scenario row whose id is not in the `['s1'..'s9']`
 * three-way contract. `announce()` spells that predicate `!/^S[1-9]$/`, and this is
 * the same predicate over the same rows.
 */
export const corpusApplications = (file = CORPUS_TABLE_FILE) =>
	[...corpusTableBlock('SCENARIOS', file).matchAll(/^\t\{\s*id:\s*'([^']+)'|^\t\tid:\s*'([^']+)'/gm)]
		.map((match) => match[1] ?? match[2])
		.filter((id) => !/^S[1-9]$/.test(id));

/**
 * THE CHAIN ITSELF: the applications with no `unbuilt` entry in any lane. Every
 * `unbuilt` map in the DEMOS block is read and its scenario keys removed from the
 * application list, which is `announce()`'s own predicate spelled against the text.
 */
export const sixLaneApplications = (file = CORPUS_TABLE_FILE) => {
	const absent = new Set(
		[...corpusTableBlock('DEMOS', file).matchAll(/unbuilt:\s*\{([^}]*)\}/g)].flatMap((match) =>
			[...match[1].matchAll(/\bS\d+\b/g)].map((key) => key[0]),
		),
	);
	return corpusApplications(file).filter((id) => !absent.has(id));
};

/**
 * THE SUBJECTS OF THE SIX-LANE CHAIN, SCANNED REPOSITORY-WIDE RATHER THAN IN ONE
 * DIRECTORY. Family eight lived in a single lane, so its scope is that lane's
 * directory. This family is spread across all six demo lanes AND the six
 * `scripts/regenerate.ts` tables the demo wording is paraphrased from, so its scope is
 * ruling 10's sweep - every tracked, lexable source file - and there is no list to
 * keep and nothing to exempt.
 *
 * WHAT THAT SCOPE DOES NOT REACH, MEASURED AND WRITTEN DOWN. Ruling 10 is scoped to
 * JS/TS because `commentsOnly` is a JS lexer, so `demos/vue-official/src/App.vue` and
 * the four `+page.svelte` route files under `demos/svelte-official/src/routes` - two
 * of the six lanes - ARE STRUCTURALLY INVISIBLE HERE. Their prose was corrected and
 * carries no stated count for that reason: a number written where the guard cannot
 * read it is worse than no number, because it looks checked. THAT LIMIT IS ALSO WHY
 * THIS DOC COMMENT NAMES NO GLOB - a `+page.svelte` path written with a star closes
 * the block comment on its own slash, which is how this very paragraph first broke.
 */
export const COUNTED_CORPUS_SUBJECTS = [
	{
		subject: 'six-lane applications',
		// A NOUN THIS REPOSITORY DID NOT HAVE, WHICH IS THE POINT. The family's own
		// spellings - "scenario in this corpus that all six lanes emit", "corpus
		// application this lane ships alongside the other five" - are sentences, not
		// nouns, and no tight rule can read a number out of them. So the fix names the
		// class once and the guard checks THAT name. It appears nowhere in this
		// repository except where a card has stated the count deliberately.
		noun: String.raw`six-lane applications?`,
		positionIsDerivable: false,
		// THIS FAMILY NEVER WROTE "of", WHICH IS WHY THE BRIDGE IS ITS OWN. Family eight
		// said "the FIFTH of five wrapper components"; family seven said "the THIRD
		// scenario all six lanes emit". Requiring `of` would leave the position half of
		// OD3's ruling unenforced for the family it was written for. Widening the SHARED
		// pattern instead would fire on "THE EIGHTH APPLICATION", which is correct prose
		// derived from the same table, so the licence is taken per subject and only for
		// a noun no correct sentence uses with an ordinal.
		positionBridge: String.raw`(?:\s+of\b[^.]{0,40}?|\s+)`,
		derive: () => sixLaneApplications(),
		derivedFrom:
			"the SCENARIOS rows in scripts/demo.mjs with no `unbuilt` entry in any DEMOS lane",
	},
	{
		subject: 'corpus applications',
		noun: String.raw`corpus applications?`,
		// POSITION IS ALLOWED HERE, AND THE ASYMMETRY IS THE SAME MEASUREMENT RULING 11
		// ALREADY MADE FOR ROUTES. An application's position is its ORDINAL SLOT - S10 is
		// the first, S17 the eighth - and the slots are handed out in table order with no
		// second basis to guess at. "THE EIGHTH APPLICATION - CONTACTS" is true, stable
		// and derivable, so forbidding it would demand the correction of correct prose.
		// The chain above has no such stable basis: S11 and S12 entered it years after
		// S13 did, so its ARRIVAL order and its TABLE order disagree.
		positionIsDerivable: true,
		derive: () => corpusApplications(),
		derivedFrom: 'the SCENARIOS rows in scripts/demo.mjs outside the s1-s9 contract',
	},
];

export const COUNTED_ANGULAR_SUBJECTS = [
	{
		subject: 'wrapper components',
		// THE NOUN IS SPELLED THE WAY THE FAMILY SPELLS IT, WHICH IS A MEASUREMENT AND NOT
		// A GUESS. T018 deleted the three exemptions above and found that the detector
		// reached only TWO of the six stale sites behind them, because this lane calls the
		// same thing "a WRAPPER" as often as "a wrapper component" - "THE SECOND OF TWO
		// ROUTES HERE THAT GO THROUGH A WRAPPER" is the sentence T017 cited as the EVIDENCE
		// that the denominator was nine, and the guard could not see it. Admitting the bare
		// noun catches it and was measured to add ZERO false positives across all 15 files
		// of the lane. The `components?` half stays optional rather than being dropped: a
		// bare-word rule alone would not read "wrapper components" as this subject at all.
		noun: String.raw`wrappers?(?:\s+components?)?`,
		positionIsDerivable: false,
		derive: () => angularWrapperComponents(),
		derivedFrom:
			'`@Component` declarations in that directory that mount an emitted component',
	},
	{
		subject: 'application routes',
		noun: String.raw`application routes?`,
		positionIsDerivable: true,
		derive: () => angularApplicationRoutes(),
		derivedFrom: "the non-contract `path` entries in that lane's own app.routes.ts",
	},
];

/**
 * A sentence that wraps across comment lines is ONE sentence, and a per-line detector
 * would go quiet on exactly the claims an author reflowed. This joins the comment
 * stream - decoration blanked, newlines turned into spaces - while keeping, for every
 * character, the line and column it came from, so a match still reports where a reader
 * will find it. Same idea as `commentsOnly`: preserve the geometry, change the view.
 */
const proseStream = (text) => {
	const characters = [];
	const positions = [];
	for (const [index, line] of text.split('\n').entries()) {
		const decoration = /^\s*(?:\/\*+|\*+\/|\*|\/\/)/.exec(line);
		for (let column = decoration === null ? 0 : decoration[0].length; column < line.length; column += 1) {
			characters.push(line[column]);
			positions.push({ lineNumber: index + 1, column: column + 1 });
		}
		characters.push(' ');
		positions.push({ lineNumber: index + 1, column: line.length + 1 });
	}
	return { prose: characters.join(''), positions };
};

/**
 * A quotation longer than this is not the recitation the exemption exists for, so the
 * pair is discarded and the text inside it stays checked. Dropping the span fails
 * TOWARDS red, which is the direction an exemption must fail in.
 */
const QUOTATION_LIMIT = 200;

const quotedSpans = (prose) => {
	const spans = [];
	let open = null;
	for (let index = 0; index < prose.length; index += 1) {
		if (prose[index] === '\\') {
			index += 1;
			continue;
		}
		if (prose[index] !== '"') continue;
		if (open === null) open = index;
		else {
			if (index - open <= QUOTATION_LIMIT) spans.push([open, index]);
			open = null;
		}
	}
	return spans;
};

/**
 * RULING 11's detector. Returns violations in the SAME shape the citation detector
 * does, so `scanRepository` and the reporter treat them identically - one guard, one
 * output format, one exit code.
 */
export const scanCountedSubjects = (text, label = '<text>', subjects = COUNTED_ANGULAR_SUBJECTS) => {
	const { prose, positions } = proseStream(text);
	const quoted = quotedSpans(prose);
	const isQuoted = (index) => quoted.some(([from, to]) => index > from && index < to);
	const at = (index) => positions[index] ?? positions.at(-1) ?? { lineNumber: 1, column: 1 };
	const violations = [];
	for (const subject of subjects) {
		const derived = subject.derive();
		if (!subject.positionIsDerivable) {
			// THE BRIDGE BETWEEN THE ORDINAL AND THE NOUN IS PER SUBJECT, AND ITS DEFAULT IS
			// THE ONLY SHAPE T017 AND T018 MEASURED. Family eight always wrote "the Nth OF
			// M wrapper components", and T018 measured that widening the licence this rule
			// takes would fire on "one of this lane's wrapper components" - the exact
			// sentence T017 wrote into five files AS THE FIX. So the default still demands
			// `of`, and a subject that needs a looser bridge states one and owns its own
			// blast radius.
			const position = new RegExp(
				String.raw`\b(${ORDINAL_WORDS.join('|')})${subject.positionBridge ?? String.raw`\s+of\b[^.]{0,40}?`}\b${subject.noun}\b`,
				'gi',
			);
			for (const match of prose.matchAll(position)) {
				if (isQuoted(match.index)) continue;
				violations.push({
					...at(match.index),
					file: label,
					raw: match[0].replaceAll(/\s+/g, ' '),
					inheritedFrom: null,
					verdict: 'violation',
					kind: 'underivable-position',
					reason:
						`A position among this lane's ${subject.subject} is NOT DERIVABLE from the ` +
						'source: the ordinals here were written in arrival order, which is in git ' +
						'history and not on disk, and route order disagrees with all of them. State ' +
						'the fact without the position - name the sibling components instead. ' +
						'RULING 11 in scripts/check-citations.mjs.',
				});
			}
		}
		const stated = new RegExp(
			String.raw`\b(${[...NUMBER_WORDS.keys()].join('|')}|\d+)\s+${subject.noun}\b`,
			'gi',
		);
		for (const match of prose.matchAll(stated)) {
			if (isQuoted(match.index)) continue;
			const claimed = NUMBER_WORDS.get(match[1].toLowerCase()) ?? Number(match[1]);
			if (claimed === derived.length) continue;
			violations.push({
				...at(match.index),
				file: label,
				raw: match[0].replaceAll(/\s+/g, ' '),
				inheritedFrom: null,
				verdict: 'violation',
				kind: 'stale-derived-count',
				reason:
					`This prose says ${claimed} ${subject.subject}; the source has ${derived.length}, ` +
					`derived at check time from ${subject.derivedFrom}: ${derived.join(', ')}. ` +
					'RULING 11 in scripts/check-citations.mjs.',
			});
		}
	}
	return violations;
};

/**
 * RULING 11's ANTI-VACUITY CHECK. A derivation that quietly returns nothing would let
 * every count in that lane read green - the exact failure this file's header calls
 * decoration - so the enumerations have floors, and the recorded remainder is checked
 * for existence so a renamed file cannot silently unwatch itself.
 *
 * IT TAKES ITS LANE AND ITS EXEMPTIONS AS ARGUMENTS for the reason `foreignShadowProblems`
 * and `emitterClassificationProblems` do: so the suite can hand it an emptied lane and a
 * dangling exemption AND WATCH EACH BRANCH FIRE. Since T018 the exemption list is empty,
 * so its existence loop would otherwise be a branch that never runs over anything.
 */
export const angularCountIntegrityProblems = (
	dir = ANGULAR_LANE_DIR,
	exemptions = ANGULAR_COUNT_NOT_SCANNED,
	subjects = COUNTED_ANGULAR_SUBJECTS,
) => {
	const problems = [];
	if (!existsSync(resolve(root, dir))) {
		problems.push(
			`RULING 11 names ${dir}, which does not exist. The lane moved or the ` +
				'rule is dead; either way every count in it would pass vacuously.',
		);
		return problems;
	}
	const scanned = angularLaneFiles(dir, exemptions);
	if (scanned.length < 4)
		problems.push(
			`RULING 11's scan enumerated only ${scanned.length} file(s) in ${dir}. ` +
				'That is too few for this lane, so the enumeration broke rather than the lane ' +
				'shrinking - and every unscanned claim would have passed vacuously.',
		);
	for (const entry of exemptions)
		if (!existsSync(resolve(root, entry.path)))
			problems.push(
				`ANGULAR_COUNT_NOT_SCANNED names ${entry.path}, which does not exist. Re-rule it: ` +
					'an exemption that points at nothing is a hole with a reason attached.',
			);
	for (const subject of subjects) {
		const derived = subject.derive();
		if (derived.length < 2)
			problems.push(
				`RULING 11's derivation of ${subject.subject} found ${derived.length}, from ` +
					`${subject.derivedFrom}. A count that recompiles to nothing agrees with ` +
					'nothing, so every claim about it would read green.',
			);
	}
	return problems;
};

/**
 * THE SAME ANTI-VACUITY CHECK FOR THE SIX-LANE CHAIN, AND IT HAS MORE TO CATCH THAN
 * ITS SIBLING. Family eight's derivations read a DIRECTORY, which either exists or
 * does not. These read TWO ARRAY LITERALS OUT OF A TEXT FILE, so they can fail three
 * quieter ways: the file moves, a table is renamed, or a reformat breaks the slice.
 * Every one of those yields an EMPTY derivation, and an empty derivation agrees with
 * nothing - so every stated count in the repository would read green at once. Floors
 * on all three, an existence check on the file, and the structural invariant that the
 * chain is a subset of the applications.
 *
 * IT TAKES ITS FILE AND ITS SUBJECTS AS ARGUMENTS for the reason every other integrity
 * function here does: so the suite can hand it a gutted table AND WATCH EACH BRANCH
 * FIRE, rather than watching a green run over the real one and calling that a test.
 */
export const corpusChainIntegrityProblems = (
	file = CORPUS_TABLE_FILE,
	subjects = COUNTED_CORPUS_SUBJECTS,
) => {
	const problems = [];
	if (!existsSync(resolve(root, file))) {
		problems.push(
			`RULING 11's six-lane chain names ${file}, which does not exist. The corpus table ` +
				'moved or the rule is dead; either way every count derived from it would pass ' +
				'vacuously.',
		);
		return problems;
	}
	const lanes = corpusLanes(file);
	if (lanes.length < 2)
		problems.push(
			`RULING 11's derivation of the lanes found ${lanes.length} in ${file}'s DEMOS table. ` +
				'That is too few for this corpus, so the slice broke rather than the corpus ' +
				'shrinking, and the chain below is derived from nothing.',
		);
	// THE SHAPE CHECK EARNS ITS PLACE AND A SUBSET CHECK WOULD NOT. `sixLaneApplications`
	// filters `corpusApplications`, so "the chain is a subset" is true by construction -
	// a branch that cannot fire is the decoration this file's header warns about. What
	// CAN fire is the slice capturing the wrong thing: these rows are matched by a regex
	// over text, and a reformat that moved `path` in front of `id` would yield a list of
	// ROUTES which the `S1`-`S9` filter would happily pass through.
	const malformed = corpusApplications(file).filter((id) => !/^S\d+$/.test(id));
	if (malformed.length > 0)
		problems.push(
			`RULING 11's slice of ${file} read ${malformed.join(', ')} as a scenario id. Those ` +
				'are not ids, so the slice captured the wrong field and both counts below are ' +
				'counting something else.',
		);
	for (const subject of subjects) {
		const derived = subject.derive();
		if (derived.length < 2)
			problems.push(
				`RULING 11's derivation of ${subject.subject} found ${derived.length}, from ` +
					`${subject.derivedFrom}. A count that recompiles to nothing agrees with ` +
					'nothing, so every claim about it would read green.',
			);
	}
	return problems;
};

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
	problems.push(...sweepProblems());
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
	// RULING 11's equivalent for the derived counts: a derivation that returns nothing
	// is a green run over an unread source.
	problems.push(...angularCountIntegrityProblems());
	// And the same for the six-lane chain, whose derivations read a text file rather
	// than a directory and can therefore fail more quietly.
	problems.push(...corpusChainIntegrityProblems());
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
	// RULING 10. Everything else that is checked in and lexable, minus the files
	// ruling 2 exempts BY PATH. Same detector, same rulings, same reporting again -
	// a file needs no entry anywhere to be checked, only to be excused.
	for (const path of sweptSourceFiles()) {
		const text = readFileSync(resolve(root, path), 'utf8');
		const comments = commentsOnly(text);
		violations.push(...scanText(comments, path));
		// RULING 11's SIX-LANE CHAIN. A THIRD DETECTOR OVER THE PROSE THIS LOOP HAS
		// ALREADY READ, not a third sweep: the file count above is unchanged and these
		// counts are asked of every swept file, because this family is spread over all
		// six lanes and both layers rather than living in one directory.
		violations.push(...scanCountedSubjects(comments, path, COUNTED_CORPUS_SUBJECTS));
	}
	// RULING 11. A SECOND DETECTOR OVER THE SAME PROSE, NOT A SECOND SWEEP: these files
	// are already inside ruling 10's sweep above and are counted there, so this adds a
	// question rather than a surface. Same comment lexer, same violation shape, same
	// reporter, same exit code.
	for (const path of angularLaneFiles()) {
		const text = readFileSync(resolve(root, path), 'utf8');
		violations.push(...scanCountedSubjects(commentsOnly(text), path));
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
		`check-citations: clean over ${WATCHED.length} watched document(s), ` +
			`${WATCHED_SOURCE.length} watched source file(s) and ${sweptSourceFiles().length} ` +
			'swept source file(s) (comments only).',
	);
	console.log(
		`check-citations: ruling 11 recompiled ${COUNTED_ANGULAR_SUBJECTS.map(
			(subject) => `${subject.derive().length} ${subject.subject}`,
		).join(' and ')} and agreed with the prose in ${angularLaneFiles().length} file(s).`,
	);
	console.log(
		`check-citations: ruling 11 recompiled ${COUNTED_CORPUS_SUBJECTS.map(
			(subject) => `${subject.derive().length} ${subject.subject}`,
		).join(' and ')} across ${corpusLanes().length} lanes and agreed with the prose in ` +
			`${sweptSourceFiles().length} swept file(s).`,
	);
}
