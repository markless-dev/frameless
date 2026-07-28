import { execFileSync } from 'node:child_process';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { formatEmitted } from '../src/format-emitted.ts';

const workspaceRoot = resolve(import.meta.dirname, '../../../..');

// WINDOWS PORTABILITY (defects-and-targets defect 3, cause A - the one cause that
// has nothing to do with line endings). On Windows `npx` is `npx.cmd`, which
// `execFileSync` cannot resolve on its own: without a shell it reports ENOENT, and
// since the CVE-2024-27980 hardening Node refuses to spawn `.cmd`/`.bat` directly
// even when named in full, throwing EINVAL. Routing through the shell on win32 only
// is the portable form. The argument vector is entirely static and contains no
// spaces or shell metacharacters, so shell interpretation is inert here.
const onWindows = process.platform === 'win32';
const npx = onWindows ? 'npx.cmd' : 'npx';

// WINDOWS TIMEOUT, SET FROM MEASUREMENT (defects-and-targets T009 + T022). Cause
// A's fix above is functionally correct but timing-marginal: routing through
// cmd.exe adds a shell process to every spawn, and this test spawns `npx`, which
// then resolves and spawns `vp`. On `windows-latest` / node 24 that chain ran
// close to vitest's 5000 ms default, and the cell flipped on nothing else.
//
// MEASURED - all eight samples, read out of the `windows-latest` / node 24 logs
// of four consecutive post-fix runs in which neither this file nor its React
// twin changed at all (React duration first, Solid second):
//
//   e04b823  RED    6747 ms  7143 ms
//   dfa9350  green  4139 ms  4339 ms
//   0cf937b  RED    5150 ms  5214 ms
//   39c8a6d  green  4504 ms  4706 ms
//
// The cell was a COIN FLIP - 2 green, 2 red - and the ONLY discriminator was
// whether both tests beat vitest's 5000 ms default. The best green cleared it by
// 5.9%; the narrower red missed it by 3.0%. macOS on this tree runs the same
// test in 605 ms (Solid) and 602 ms (React), so Windows costs 6.9-11.9x and the
// run-to-run spread on Windows alone is 1.73x. This copy is the slower of the
// two in all four runs.
//
// Note what the log shape shows about the old bound: 6747 and 7143 ms were
// REPORTED, so the deadline never truncated the work - `execFileSync` blocks the
// thread and the verdict lands after it returns. 5000 was therefore not a
// runaway guard at all; it was an unstated claim about how long a Windows spawn
// takes, and the claim was wrong by up to 43%.
//
// 30 s is chosen against those numbers rather than picked: 4.2x the worst
// observed sample, above worst-observed x observed-spread (7143 x 1.73 =
// 12.3 s) with room left for a cold or contended runner, and ~50x the macOS
// sample. It remains a real guard - a genuinely stuck toolchain still fails the
// test - and sits far inside the job's 15-minute budget. It bounds a subprocess
// spawn, which IS a wall-clock quantity; unlike finding 4's quiescence loop
// there is no frame-gated quantity being proxied here, so raising it is not the
// move finding 4 rejected.
const SPAWN_TIMEOUT_MS = 30_000;

describe('Solid emitted artifact formatting', () => {
	test('matches the repository vp fmt configuration', { timeout: SPAWN_TIMEOUT_MS }, async () => {
		const source =
			'import value from "package";export function Sample(){if(true){const alias=collection.find((item)=>item.identity===currentItem.identity);return <div title="text"><span>{value}</span>{alias.title}</div>}}';
		const cliOutput = execFileSync(
			npx,
			[
				'vp',
				'fmt',
				'--stdin-filepath',
				'packages/frameworks/solid/generated/S2.tsx',
			],
			{ cwd: workspaceRoot, encoding: 'utf8', input: source, shell: onWindows },
		);

		expect(await formatEmitted(source)).toBe(cliOutput);
		expect(cliOutput).toContain("from 'package'");
		expect(cliOutput).toContain('\n\tif (true)');
		expect(cliOutput).toContain(
			'collection.find((item) => item.identity === currentItem.identity)',
		);
	});

	test('throws with oxfmt parse error details', async () => {
		await expect(formatEmitted('export function Broken( {')).rejects.toThrow(
			/Expected `}` but found `EOF`/,
		);
	});
});
