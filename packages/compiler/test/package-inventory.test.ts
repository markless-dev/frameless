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
