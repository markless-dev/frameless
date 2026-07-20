import { execFileSync } from 'node:child_process';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { formatEmitted } from '../src/format-emitted.ts';

const workspaceRoot = resolve(import.meta.dirname, '../../../..');

describe('Solid emitted artifact formatting', () => {
	test('matches the repository vp fmt configuration', async () => {
		const source =
			'import value from "package";export function Sample(){if(true){const alias=collection.find((item)=>item.identity===currentItem.identity);return <div title="text"><span>{value}</span>{alias.title}</div>}}';
		const cliOutput = execFileSync(
			'npx',
			[
				'vp',
				'fmt',
				'--stdin-filepath',
				'packages/frameworks/solid/generated/S2.jsx',
			],
			{ cwd: workspaceRoot, encoding: 'utf8', input: source },
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
