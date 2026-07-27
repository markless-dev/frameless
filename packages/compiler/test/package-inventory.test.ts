import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const readJson = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as {
	name?: string;
	private?: boolean;
	files?: string[];
};

describe('T004 package inventory', () => {
	test('contains the compiler, analyzer, framework packages, and CLI', () => {
		const packages = [
			'packages/compiler',
			'packages/analyzer',
			'packages/frameworks/react',
			'packages/frameworks/solid',
			'packages/cli',
		];
		expect(packages.map((path) => readJson(`${path}/package.json`).name)).toEqual([
			'@frameless/compiler',
			'@frameless/analyzer',
			'@frameless/react',
			'@frameless/solid',
			'@frameless/cli',
		]);
		expect(readJson('packages/compiler/package.json').files).toEqual(['agent', 'dist']);
		expect(readJson('demos/ui-kit/package.json')).toMatchObject({
			name: '@frameless/demo-ui-kit',
			private: true,
		});
	});

	test('keeps the compiler source free of cross-package and platform imports', () => {
		const sources = [
			'artifacts.ts',
			'build.ts',
			'dump.ts',
			'index.ts',
			'pass-graph.ts',
			'pass-pipeline.ts',
			'pass-registry.ts',
			'schema.ts',
		]
			.map((file) => readFileSync(resolve(root, 'packages/compiler/src', file), 'utf8'))
			.join('\n');
		expect(sources).not.toMatch(
			/from ['"](?:@frameless\/analyzer|react|solid-js|vite|node:fs|@frameless\/(?:react|solid|cli))/,
		);
	});
});

// LF IS A REPO-WIDE BYTE INVARIANT, AND UNTIL NOW IT WAS ONLY EVER ASSUMED.
//
// `.gitattributes` now pins it (`* text=auto eol=lf`), but a declaration is not an
// assertion. Three of defect 3's four Windows causes were this assumption breaking
// silently on a CRLF checkout - a gate mutation literal that stopped matching, goldens
// whose baked AST byte offsets no longer described the file, and emitter freshness
// tests comparing bytes against an emitter that hard-codes `endOfLine: 'lf'`. In every
// case the instrument reported a defect somewhere else instead of reporting its own
// broken precondition (defects-and-targets T007 §5.2).
//
// This lives here rather than in a framework package because the invariant is the
// workspace's, not any one package's, and this file already reads from the workspace
// root. It is deliberately the loudest possible form: on a CRLF checkout it fails
// first and by name, which makes every downstream CRLF failure attributable instead of
// mysterious.
describe('workspace byte invariants', () => {
	test('no tracked text file contains a carriage return', () => {
		let listing: string;
		try {
			listing = execFileSync('git', ['ls-files', '-z'], {
				cwd: root,
				encoding: 'utf8',
				maxBuffer: 32 * 1024 * 1024,
			});
		} catch (error) {
			// Deliberately not a silent skip. "Tracked" is a git word; without git
			// this assertion cannot be made, and a precondition that cannot be
			// checked must say so rather than pass by default.
			throw new Error(
				`cannot enumerate tracked files - git is required to assert the LF invariant: ${String(error)}`,
			);
		}

		const tracked = listing.split('\0').filter(Boolean);
		expect(tracked.length).toBeGreaterThan(100);

		const offenders: string[] = [];
		for (const path of tracked) {
			let bytes: Buffer;
			try {
				bytes = readFileSync(resolve(root, path));
			} catch {
				// A tracked path absent from the working tree (sparse checkout,
				// mid-rebase) carries no bytes to judge.
				continue;
			}
			// git's own binary heuristic: a NUL in the first 8000 bytes. `text=auto`
			// uses the same rule, so this skips exactly what .gitattributes skips.
			if (bytes.subarray(0, 8000).includes(0x00)) continue;
			if (bytes.includes(0x0d)) offenders.push(path);
		}

		expect(offenders, 'CRLF (or a stray CR) in tracked text files').toEqual([]);
	});

	test('CALIBRATION: the CR scan can actually see a carriage return', () => {
		// The scan above is a search that returns nothing on a healthy tree, which is
		// indistinguishable from a search that looks at nothing. These pin the two
		// discriminations it makes.
		expect(Buffer.from('a\r\nb', 'utf8').includes(0x0d)).toBe(true);
		expect(Buffer.from('a\nb', 'utf8').includes(0x0d)).toBe(false);
		// ...and that it does not walk into binary blobs, where 0x0d is just data.
		const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]);
		expect(binary.subarray(0, 8000).includes(0x00)).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE PEER-RESOLUTION INVENTORY
//
// ## The event this exists to catch
//
// Adding the Angular lane silently moved SIX optional peers and changed the
// peer-resolution identity of TWENTY-FIVE packages: the whole SvelteKit stack,
// `@qwik.dev/core` and `@qwik.dev/router`, `@markless/core` and
// `@markless/router`, and `@async/witness` — the e2e instrument itself. The
// largest single item went unnamed by three separate human reviews: `chokidar`
// crossed a MAJOR boundary, 4.0.3 → 5.0.0, under `unstorage`, `nitro` and both
// `@markless/*` packages. Full measurement:
// `docs/goals/frameless-angular-v1/notes/T007-toolchain-leak.md`.
//
// The mechanism is NOT "Angular pins exactly". Four of the six arrived on
// ordinary caret ranges and two of those are the ng-new scaffold's own
// `devDependencies`. The mechanism is WORKSPACE MEMBERSHIP: in a pnpm
// workspace, any member's dependency closure becomes a candidate provider for
// every other member's UNSATISFIED OPTIONAL PEERS. This is not an Angular
// property. Angular was merely the first member whose closure was big enough
// (+3918 lockfile lines) to be visible to someone reading a diff.
//
// ## Why an inventory, and why it asserts the SET rather than the members
//
// `packages/frameworks/angular/test/toolchain.test.ts` was GREEN THROUGHOUT
// this entire event, and so would be any test built the same way. It asserts
// version LITERALS for names it ALREADY KNOWS, and every one of those
// assertions was correct the whole time. The failure mode was an UNLISTED NAME
// APPEARING — `sass`, `jsdom`, `prettier` and `lru-cache` all went from
// unresolved to resolved — and no equality-against-a-literal can see a name it
// was never given.
//
//     AN INVENTORY INSTRUMENT MUST ASSERT THE SET, NOT THE MEMBERS.
//
// Two arms:
//   ARM A (completeness) — the set of distinct `name@version` peer atoms
//     appearing in `snapshots:` keys equals a recorded sorted list. This is the
//     arm that goes red on the event that actually happened.
//   ARM B (identity) — for the shared consumers more than one lane depends on,
//     the FULL peer-suffix key equals a recorded literal. Arm A misses a pure
//     version move that adds no new name; Arm B catches it and localises WHICH
//     consumer moved.
//
// ## THE MAINTENANCE CONTRACT — read this before deleting the block
//
// THIS IS A NOTIFICATION, NOT A VERDICT. A red here does not mean anything is
// broken. It means THE LOCKFILE MOVED. `pnpm-lock.yaml` is committed and this
// instrument reads the lockfile, so it can only go red inside a commit that is
// already changing dependencies — never spontaneously, and never on a clean
// `pnpm install`.
//
// THE FIX IS TO UPDATE THE RECORDED LIST IN THE SAME COMMIT THAT MOVED
// `pnpm-lock.yaml`, NAMING THE CAUSING WORKSPACE MEMBER IN THE COMMIT MESSAGE.
// That is the whole maintenance burden, and it is deliberately paid at the
// moment a human is already looking at dependency changes. Deleting the block
// instead restores the exact condition that let six peers and twenty-five
// packages move unremarked.
//
// A green here does NOT mean "the toolchain is fine". It means "the peer graph
// is the one that was last measured".
//
// ## Scope, and what must NOT be duplicated here
//
// Angular-lane-internal toolchain facts (which Vite `@angular/build` resolves,
// which TypeScript the demo uses) belong to `toolchain.test.ts` and are asserted
// there. This block deliberately does not restate them. Arm A does record
// Angular-internal atoms — `@angular/core@22.0.8`, `rxjs`, `ajv`, `listr2` and
// friends — because exact set equality over the workspace cannot exclude them
// without becoming a judgement about which names matter, which is the failure
// this instrument exists to remove. Their presence in the list is bookkeeping;
// `toolchain.test.ts` remains the place that says anything about them.
//
// ## Placement
//
// Same reason as the byte invariant above: the invariant is the WORKSPACE's,
// not any one package's, and this file already reads from the workspace root.
// Scoping it to `packages/frameworks/angular` would guarantee the next lane's
// author never finds it — and "the next lane" is precisely who this is for.
// ─────────────────────────────────────────────────────────────────────────────

const lockfilePath = resolve(root, 'pnpm-lock.yaml');
const lockfile = readFileSync(lockfilePath, 'utf8');

/**
 * The `snapshots:` keys, verbatim and unquoted.
 *
 * THROWS rather than returning `[]` when the section is absent or a key line is
 * shaped unexpectedly. An inventory that silently parses to nothing compares
 * nothing and passes forever; that is the specific way this instrument would
 * rot, so the reader is built to fail loudly instead of quietly.
 */
function snapshotKeys(lockfileText: string): string[] {
	const lines = lockfileText.split('\n');
	const start = lines.indexOf('snapshots:');
	if (start === -1) {
		throw new Error("pnpm-lock.yaml has no 'snapshots:' section - the reader's premise is gone");
	}
	const keys: string[] = [];
	for (let index = start + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		if (line.trim() === '') continue;
		// A non-indented line ends the section; a deeper indent is a key's body.
		if (!line.startsWith('  ')) break;
		if (line.startsWith('   ')) continue;
		const raw = line.slice(2);
		const body = raw.endsWith(' {}') ? raw.slice(0, -3) : raw;
		if (!body.endsWith(':')) {
			throw new Error(`unparseable pnpm-lock.yaml snapshot key line: ${JSON.stringify(line)}`);
		}
		const key = body.slice(0, -1);
		keys.push(key.startsWith("'") && key.endsWith("'") ? key.slice(1, -1) : key);
	}
	if (keys.length === 0) throw new Error("pnpm-lock.yaml 'snapshots:' section parsed to zero keys");
	return keys;
}

/**
 * The TOP-LEVEL parenthesised groups of a peer suffix, by depth counting.
 *
 * NESTED ATOMS ARE REAL. `jsdom@28.1.0(@noble/hashes@2.2.0)` is ONE atom with
 * another one inside it, and the obvious `/\(([^()]+)\)/g` match reads it as
 * `@noble/hashes@2.2.0` and MISSES `jsdom` ENTIRELY. That bug was live in the
 * throwaway probe used to measure the original event, which is why the reader
 * counts depth and why the calibration block below pins the difference.
 */
function topLevelPeerGroups(suffix: string): string[] {
	const groups: string[] = [];
	let depth = 0;
	let openedAt = -1;
	for (let index = 0; index < suffix.length; index += 1) {
		const char = suffix[index];
		if (char === '(') {
			if (depth === 0) openedAt = index + 1;
			depth += 1;
		} else if (char === ')') {
			depth -= 1;
			if (depth < 0) throw new Error(`unbalanced peer suffix: ${suffix}`);
			if (depth === 0) groups.push(suffix.slice(openedAt, index));
		}
	}
	if (depth !== 0) throw new Error(`unbalanced peer suffix: ${suffix}`);
	return groups;
}

interface PeerGraph {
	/** Every distinct `name@version` peer atom, at every nesting depth, sorted. */
	atoms: string[];
	/**
	 * Packages whose peer set pnpm collapsed into an opaque hash rather than
	 * spelling out. Recorded by NAME ONLY: the hash and the version are
	 * Angular-lane-internal facts that `toolchain.test.ts` owns, but a peer set
	 * this reader cannot see must be disclosed rather than silently dropped.
	 */
	opaquePeerSetOwners: string[];
}

function readPeerGraph(lockfileText: string): PeerGraph {
	const atoms = new Set<string>();
	const opaquePeerSetOwners = new Set<string>();

	const walk = (suffix: string, owner: string): void => {
		for (const group of topLevelPeerGroups(suffix)) {
			const nested = group.indexOf('(');
			const atom = nested === -1 ? group : group.slice(0, nested);
			// A scoped name starts with '@', so a real atom's version separator is
			// an '@' at some index > 0. Anything else is pnpm's opaque peer hash.
			if (atom.lastIndexOf('@') > 0) atoms.add(atom);
			else opaquePeerSetOwners.add(owner);
			if (nested !== -1) walk(group.slice(nested), owner);
		}
	};

	for (const key of snapshotKeys(lockfileText)) {
		const suffixAt = key.indexOf('(');
		if (suffixAt === -1) continue;
		const owner = key.slice(0, suffixAt).replace(/@[^@]*$/, '');
		walk(key.slice(suffixAt), owner);
	}

	return {
		atoms: [...atoms].sort(),
		opaquePeerSetOwners: [...opaquePeerSetOwners].sort(),
	};
}

/** Every `snapshots:` key whose base `name@version` is exactly `id`, sorted. */
function snapshotKeysFor(lockfileText: string, id: string): string[] {
	return snapshotKeys(lockfileText)
		.filter((key) => {
			const suffixAt = key.indexOf('(');
			return suffixAt !== -1 && key.slice(0, suffixAt) === id;
		})
		.sort();
}

// ARM A. MEASURED off this lockfile, not predicted. 66 entries.
//
// ON THE NUMBER: the T007 ruling recorded "46". That figure is NOT reproducible
// under a nesting-correct read and the ruling's own §5.3 says its probe carried
// the innermost-parens bug described above. The closest reproduction of 46 is
// the buggy reading — 45 atoms plus the one opaque hash. Under a correct read
// this lockfile has 66 peer atoms, and the same reader on `HEAD`'s lockfile
// gives 44, so the Angular lane's true delta is +24 names and −2, not +6.
// Recording the smaller inherited number would have shipped an inventory that
// was wrong about its own subject.
const PEER_ATOMS = [
	'@angular-eslint/template-parser@22.1.0',
	'@angular/common@22.0.8',
	'@angular/compiler@22.0.8',
	'@angular/core@22.0.8',
	'@angular/platform-browser@22.0.8',
	'@angular/platform-server@22.0.8',
	'@angular/router@22.0.8',
	'@babel/core@7.29.7',
	'@csstools/css-parser-algorithms@4.0.0',
	'@csstools/css-tokenizer@4.0.0',
	'@emnapi/core@1.10.0',
	'@emnapi/core@1.9.1',
	'@emnapi/runtime@1.10.0',
	'@emnapi/runtime@1.9.1',
	'@inquirer/prompts@8.4.2',
	'@noble/hashes@2.2.0',
	'@qwik.dev/core@2.0.0-beta.38',
	'@sveltejs/kit@2.70.1',
	'@sveltejs/vite-plugin-svelte@7.2.0',
	'@types/node@24.12.2',
	'@types/react@19.2.14',
	'@typescript-eslint/parser@8.65.0',
	'@typescript-eslint/types@8.65.0',
	'@typescript-eslint/utils@8.65.0',
	'@vitest/browser-playwright@4.1.5',
	'acorn@8.17.0',
	'ajv@8.20.0',
	'browserslist@4.28.6',
	// chokidar crossed a MAJOR boundary, 4.0.3 -> 5.0.0, when the Angular lane
	// landed. Nothing named it for three review passes. This line is why.
	'chokidar@5.0.0',
	'crossws@0.4.10',
	'css-tree@3.2.1',
	'db0@0.3.4',
	'esbuild@0.28.1',
	'eslint@9.39.5',
	'express@5.2.1',
	'hono@4.12.32',
	'jsdom@28.1.0',
	'lightningcss@1.32.0',
	'listr2@10.2.1',
	'lru-cache@11.5.2',
	'ofetch@2.0.0-alpha.3',
	'oxlint-tsgolint@0.22.0',
	'picomatch@4.0.5',
	'playwright@1.58.2',
	'postcss@8.5.20',
	'prettier@3.9.6',
	'react@19.2.3',
	'rolldown@1.0.3',
	'rollup@4.62.2',
	'rxjs@7.8.2',
	'sass@1.99.0',
	'seroval@1.5.6',
	'solid-js@1.8.22',
	'srvx@0.11.22',
	'svelte@5.56.8',
	'typescript@5.9.3',
	'typescript@6.0.3',
	'vite@7.3.1',
	'vite@7.3.6',
	'vite@8.0.16',
	'vitest@4.1.5',
	'vue-eslint-parser@10.4.1',
	'vue@3.5.40',
	'yaml@2.9.0',
	'zod@4.4.2',
	'zod@4.4.3',
];

// ARM B. The shared consumers — packages more than one lane depends on, plus the
// instrument that measures them. Each entry is [base id, every snapshot key with
// that base]. `@qwik.dev/core` legitimately has two, one per Vite it is built
// against; the pair IS the fact, so the list form is what is asserted.
const SHARED_CONSUMER_KEYS: ReadonlyArray<readonly [string, readonly string[]]> = [
	[
		'vite@8.0.16',
		['vite@8.0.16(@types/node@24.12.2)(esbuild@0.28.1)(sass@1.99.0)(yaml@2.9.0)'],
	],
	[
		'vite@7.3.1',
		['vite@7.3.1(@types/node@24.12.2)(lightningcss@1.32.0)(sass@1.99.0)(yaml@2.9.0)'],
	],
	[
		'vitest@4.1.5',
		[
			'vitest@4.1.5(@types/node@24.12.2)(@vitest/browser-playwright@4.1.5)(jsdom@28.1.0(@noble/hashes@2.2.0))(vite@8.0.16(@types/node@24.12.2)(esbuild@0.28.1)(sass@1.99.0)(yaml@2.9.0))',
		],
	],
	[
		'vite-plus@0.1.20',
		[
			'vite-plus@0.1.20(@types/node@24.12.2)(esbuild@0.28.1)(jsdom@28.1.0(@noble/hashes@2.2.0))(sass@1.99.0)(typescript@5.9.3)(vite@8.0.16(@types/node@24.12.2)(esbuild@0.28.1)(sass@1.99.0)(yaml@2.9.0))(yaml@2.9.0)',
		],
	],
	[
		'@vitest/browser-playwright@4.1.5',
		[
			'@vitest/browser-playwright@4.1.5(playwright@1.58.2)(vite@8.0.16(@types/node@24.12.2)(esbuild@0.28.1)(sass@1.99.0)(yaml@2.9.0))(vitest@4.1.5)',
		],
	],
	[
		'@qwik.dev/core@2.0.0-beta.38',
		[
			'@qwik.dev/core@2.0.0-beta.38(prettier@3.9.6)(vite@7.3.1(@types/node@24.12.2)(lightningcss@1.32.0)(sass@1.99.0)(yaml@2.9.0))(vitest@4.1.5(@types/node@24.12.2)(@vitest/browser-playwright@4.1.5)(jsdom@28.1.0(@noble/hashes@2.2.0))(vite@8.0.16(@types/node@24.12.2)(esbuild@0.28.1)(sass@1.99.0)(yaml@2.9.0)))',
			'@qwik.dev/core@2.0.0-beta.38(prettier@3.9.6)(vite@8.0.16(@types/node@24.12.2)(esbuild@0.28.1)(sass@1.99.0)(yaml@2.9.0))(vitest@4.1.5)',
		],
	],
	[
		'@markless/core@file:vendor/markless-core-0.1.1.tgz',
		[
			'@markless/core@file:vendor/markless-core-0.1.1.tgz(@typescript-eslint/types@8.65.0)(chokidar@5.0.0)(lru-cache@11.5.2)(rolldown@1.0.3)(rollup@4.62.2)(vite@8.0.16(@types/node@24.12.2)(esbuild@0.28.1)(sass@1.99.0)(yaml@2.9.0))',
		],
	],
	[
		'unstorage@2.0.0-alpha.7',
		['unstorage@2.0.0-alpha.7(chokidar@5.0.0)(db0@0.3.4)(lru-cache@11.5.2)(ofetch@2.0.0-alpha.3)'],
	],
	[
		'@async/witness@0.7.0',
		[
			'@async/witness@0.7.0(vite@8.0.16(@types/node@24.12.2)(esbuild@0.28.1)(sass@1.99.0)(yaml@2.9.0))',
		],
	],
];

describe('workspace peer-resolution inventory', () => {
	test('PRECONDITION: the reader returns a NON-EMPTY graph on the real lockfile', () => {
		// Asserted before anything is compared. An empty read makes every equality
		// below vacuous while still reporting green, and this instrument's whole
		// subject is a check that could not fail.
		const graph = readPeerGraph(lockfile);
		expect(snapshotKeys(lockfile).length).toBeGreaterThan(500);
		expect(graph.atoms.length).toBeGreaterThan(40);
		// Spot names from three different lanes, so a graph that parsed but read
		// only one corner of the file is also excluded.
		expect(graph.atoms).toContain('vite@8.0.16');
		expect(graph.atoms).toContain('jsdom@28.1.0');
		expect(graph.atoms).toContain('svelte@5.56.8');
	});

	test('ARM A: the SET of workspace peer atoms is exactly the recorded set', () => {
		// EXACT SET EQUALITY, both directions. A NAME APPEARING is the event this
		// board actually suffered; a name DISAPPEARING is the same move run
		// backwards - a lane removal restoring some other lane's peer slot to
		// unresolved is equally a cross-lane toolchain change.
		expect(readPeerGraph(lockfile).atoms).toEqual(PEER_ATOMS);
	});

	test('ARM A: the only collapsed, unreadable peer set belongs to @angular/build', () => {
		// pnpm replaces a long peer suffix with an opaque hash. Those atoms are
		// invisible to the reader above, so the set of packages that have one is
		// recorded: if a SECOND package starts hiding its peers, Arm A quietly
		// stops covering it, and that must be a red rather than a shrug.
		expect(readPeerGraph(lockfile).opaquePeerSetOwners).toEqual(['@angular/build']);
	});

	test('ARM B: every shared consumer resolves to its recorded peer-suffix key', () => {
		// Localises the cause. Arm A cannot see a pure version move that introduces
		// no new name; these can, and they name which consumer moved.
		for (const [id, expected] of SHARED_CONSUMER_KEYS) {
			// Guards the degenerate case where a recorded list is emptied to make a
			// red go away: [] === [] would then pass at the moment the consumer
			// vanished from the workspace.
			expect(expected.length).toBeGreaterThan(0);
			expect(snapshotKeysFor(lockfile, id), `peer-suffix key(s) for ${id}`).toEqual([...expected]);
		}
	});

	// INSTRUMENT RULE 3, two-sided, and the anti-vacuity arm is the load-bearing
	// one. Every assertion above is an equality against a recorded literal, which
	// is the shape most likely to rot into a tautology if the reader ever stops
	// returning a real value.
	describe('CALIBRATION: this inventory can go red, in both directions', () => {
		test('a PLANTED EXTRA peer atom fails Arm A', () => {
			const planted = lockfile.replace(
				'snapshots:\n',
				'snapshots:\n\n  planted-extra@9.9.9(planted-peer@0.0.0): {}\n',
			);
			const atoms = readPeerGraph(planted).atoms;
			expect(atoms).toContain('planted-peer@0.0.0');
			expect(() => expect(atoms).toEqual(PEER_ATOMS)).toThrow();
		});

		test('a PLANTED MISSING peer atom fails Arm A', () => {
			// `sass` is one of the six that moved, and it is exactly the shape of
			// the reverse event: a peer slot returning to unresolved.
			const planted = lockfile.split('(sass@1.99.0)').join('');
			const atoms = readPeerGraph(planted).atoms;
			expect(atoms).not.toContain('sass@1.99.0');
			expect(atoms.length).toBe(PEER_ATOMS.length - 1);
			expect(() => expect(atoms).toEqual(PEER_ATOMS)).toThrow();
		});

		test('a MOVED shared-consumer key fails Arm B', () => {
			const planted = lockfile.split('esbuild@0.28.1').join('esbuild@0.29.0');
			const [id, expected] = SHARED_CONSUMER_KEYS[0] as readonly [string, readonly string[]];
			expect(() => expect(snapshotKeysFor(planted, id)).toEqual([...expected])).toThrow();
		});

		test('NESTED atoms are read as the OUTER package, not the inner one', () => {
			const synthetic = 'snapshots:\n\n  vitest@4.1.5(jsdom@28.1.0(@noble/hashes@2.2.0)): {}\n';

			// THE BUG, PINNED SO IT CANNOT COME BACK. The obvious innermost-parens
			// match reads this key as `@noble/hashes` and loses `jsdom` completely -
			// and `jsdom` is one of the four names whose appearance is the whole
			// reason this file has a third describe block.
			const naive = [...synthetic.matchAll(/\(([^()]+)\)/g)].map((match) => match[1]);
			expect(naive).toEqual(['@noble/hashes@2.2.0']);

			// The depth-counting reader finds BOTH, with the outer one intact.
			expect(readPeerGraph(synthetic).atoms).toEqual(['@noble/hashes@2.2.0', 'jsdom@28.1.0']);
		});

		test('an unreadable lockfile THROWS rather than comparing an empty set', () => {
			// The specific way this instrument would rot: a lockfile format change
			// makes the reader return nothing, every equality above compares nothing
			// to nothing, and the block passes forever while asserting zero facts.
			expect(() => readPeerGraph('packages:\n  left-pad@1.0.0: {}\n')).toThrow(/snapshots/);
			expect(() => readPeerGraph('snapshots:\n\n  not a key line\n')).toThrow(/unparseable/);
			expect(() => readPeerGraph('snapshots:\n')).toThrow(/zero keys/);
			expect(() => readPeerGraph('snapshots:\n\n  a@1(b@2: {}\n')).toThrow(/unbalanced/);
		});
	});
});
