import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import {
	FRAMELESS_STATE_GLOBAL,
	adaptPersistenceFacts,
	type MarklessStorageSourceFact,
} from '@frameless/compiler';
import { describe, expect, test } from 'vitest';
import { generatePrePaintPersistenceScript } from '../src/persistence.ts';

const SOURCE_FACTS = [
	{
		graphNodeId: 'state:theme',
		moduleId: 'src/z-settings.tsrx',
		bindingName: 'theme',
		key: {
			origin: 'derived',
			sourceIdentifier: 'theme',
			literal: 'markless:theme',
			bakedAtCompileTime: true,
		},
		authoredInitial: 'light',
		writable: true,
	},
	{
		graphNodeId: 'state:locale',
		moduleId: 'src/a-account.tsrx',
		bindingName: 'locale',
		key: {
			origin: 'explicit',
			literal: 'preferences:locale',
			bakedAtCompileTime: true,
		},
		authoredInitial: 'en',
		writable: true,
	},
] as const satisfies readonly MarklessStorageSourceFact[];

function renderRecords() {
	return adaptPersistenceFacts(SOURCE_FACTS, () => ({ render: true, handler: false }));
}

describe('pre-paint persistence script', () => {
	test('is byte-deterministic, stably ordered, hashed for CSP, and closed-form', () => {
		const records = renderRecords();
		const generated = generatePrePaintPersistenceScript(records);
		const repeated = generatePrePaintPersistenceScript([...records].reverse());
		if (!generated || !repeated) throw new Error('Expected a generated script.');

		expect(repeated).toEqual(generated);
		expect(generated.records.map(({ moduleId }) => moduleId)).toEqual([
			'src/a-account.tsrx',
			'src/z-settings.tsrx',
		]);
		const digest = createHash('sha256').update(generated.content).digest();
		expect(generated.contentSha256).toBe(digest.toString('hex'));
		expect(generated.cspHash).toBe(`sha256-${digest.toString('base64')}`);
		expect(generated.content).toContain(`(globalThis.${FRAMELESS_STATE_GLOBAL}??={});`);
		for (const record of generated.records) {
			expect(generated.content).toContain(
				`globalThis.${FRAMELESS_STATE_GLOBAL}[${JSON.stringify(record.resolvedKey)}]=v`,
			);
			const source = records.find(
				(candidate) =>
					candidate.moduleId === record.moduleId &&
					candidate.graphNodeId === record.graphNodeId,
			)!;
			expect(generated.content).toContain(
				`document.documentElement.setAttribute(${JSON.stringify(source.antiFlashAttribute)},v)`,
			);
		}
		expect(generated.content).not.toMatch(/try\{document\.documentElement\.setAttribute/);
		expect(generated.content).not.toMatch(/@frameless\/(?:react|solid)/);
		expect(generated.content).not.toContain('setTimeout');
		expect(generated.content).not.toContain('requestIdleCallback');

		const attributes = new Map<string, string>();
		const sandbox: Record<PropertyKey, unknown> = {
			localStorage: {
				getItem: (key: string) => (key === 'markless:theme' ? 'dark' : null),
			},
			document: {
				documentElement: {
					setAttribute: (name: string, value: string) => attributes.set(name, value),
				},
			},
		};
		runInNewContext(generated.content, sandbox);
		const seeded = runInNewContext(`globalThis.${FRAMELESS_STATE_GLOBAL}`, sandbox);
		expect(seeded).toEqual({
			'preferences:locale': 'en',
			'markless:theme': 'dark',
		});
		expect(attributes).toEqual(
			new Map([
				['data-preferences-locale', 'en'],
				['data-markless-theme', 'dark'],
			]),
		);
	});

	test('emits no script for zero pre-paint records', () => {
		const handlerOnly = adaptPersistenceFacts(SOURCE_FACTS, () => ({
			render: false,
			handler: true,
		}));
		expect(generatePrePaintPersistenceScript(handlerOnly)).toBeUndefined();
		expect(generatePrePaintPersistenceScript([])).toBeUndefined();
	});
});
