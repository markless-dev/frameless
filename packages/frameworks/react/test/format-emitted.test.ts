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

describe('React emitted artifact formatting', () => {
	test('matches the repository vp fmt configuration', async () => {
		const source =
			'import value from "package";export function Sample(){if(true){const alias=collection.find((item)=>item.identity===currentItem.identity);return <div title="text"><span>{value}</span>{alias.title}</div>}}';
		const cliOutput = execFileSync(
			npx,
			[
				'vp',
				'fmt',
				'--stdin-filepath',
				'packages/frameworks/react/generated/S2.jsx',
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
