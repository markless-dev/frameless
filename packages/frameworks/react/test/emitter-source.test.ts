import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';

const emitterRoot = resolve(import.meta.dirname, '../src/emitter');

/**
 * GREPPABILITY, AS A TEST RATHER THAN A CONVENTION.
 *
 * `packages/frameworks/react/src/emitter/index.ts` carried ONE literal NUL byte, in
 * the suspension-segment map key. That single byte makes `grep` classify the whole
 * file as binary, so it exits 1 with NO OUTPUT AT ALL - and a sweep that reports "no
 * matches" is indistinguishable from one that means "NOT SEARCHED". A prior card read
 * a false zero off exactly that, and the traced numbers are unambiguous: at db6e275
 * the file held 0 NULs and `grep -c import` answered 44; at 61a6779 it held 1 and
 * grep answered nothing at all.
 *
 * The separator is spelled `\u0000` instead, which is the SAME runtime string - the
 * distinction is source-only, and no emitted byte moves. Nothing but a test keeps it
 * that way, because the difference is invisible in every editor and in every diff.
 *
 * The check is byte-absence rather than a spawned `grep`: NUL is the actual cause,
 * and `grep` is not portably available on the Windows runner this suite already
 * accommodates elsewhere (see format-emitted.test.ts).
 */
describe('emitter source stays greppable', () => {
	const sources = readdirSync(emitterRoot, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
		.map((entry) => resolve(entry.parentPath, entry.name));

	// A test that scanned an EMPTY file list would pass while measuring nothing - the
	// exact failure mode this board keeps finding. Pin the corpus it actually read.
	test('the scan reads a non-empty source list that includes the emitter entry', () => {
		expect(sources.length).toBeGreaterThan(0);
		expect(sources).toContain(resolve(emitterRoot, 'index.ts'));
	});

	test.each(sources.map((path) => [path]))('%s contains no NUL byte', (path) => {
		const bytes = readFileSync(path);
		// Report the offset, not just a boolean: a bare `toBe(0)` on a 150 kB file
		// leaves the next reader running the same Python one-liner from scratch.
		expect({ path, nulAt: bytes.indexOf(0), nulCount: bytes.filter((b) => b === 0).length }).toEqual(
			{ path, nulAt: -1, nulCount: 0 },
		);
	});
});
