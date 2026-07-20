import { calibrationScenarios, compareRuns, runScenario } from '@frameless/analyzer';
import { createSolidAdapter } from '@frameless/solid/adapter';
import { describe, expect, test } from 'vitest';
import { RenderOnce } from '../generated/S1.jsx';
import { KeyedTodo } from '../generated/S2.jsx';
import { EventForm } from '../generated/S3.jsx';
import { solidReferences } from './reference.solid.tsx';

const emitted = {
	'S1-render-once-locals': RenderOnce,
	'S2-keyed-todo': KeyedTodo,
	'S3-event-form': EventForm,
};

describe('emitted Solid fallback components against calibrated references', () => {
	for (const scenario of calibrationScenarios) {
		test(scenario.id, async () => {
			const componentId = scenario.id.split('/')[0]! as keyof typeof emitted;
			const reference = await runScenario(
				createSolidAdapter(solidReferences[componentId]),
				scenario,
			);
			const generated = await runScenario(createSolidAdapter(emitted[componentId]), scenario);
			expect(compareRuns(reference, generated)).toEqual({ equal: true, divergences: [] });
		});
	}

	test('produce updates one store row through a reused For row and input node', async () => {
		const host = document.createElement('div');
		document.body.append(host);
		const adapter = createSolidAdapter(KeyedTodo);
		const handle = await adapter.mount(host, {
			seed: [
				{ id: 'a', title: 'Alpha', done: false },
				{ id: 'b', title: 'Beta', done: false },
			],
			onTrace() {},
		});
		try {
			const row = host.querySelector('[data-oracle-row-key="b"]');
			const input = host.querySelector<HTMLInputElement>('[data-edit="b"]')!;
			await adapter.dispatch(handle, {
				type: 'input',
				target: '[data-edit="b"]',
				value: 'Beta!',
			});
			expect(host.querySelector('[data-oracle-row-key="b"]')).toBe(row);
			expect(host.querySelector('[data-edit="b"]')).toBe(input);
			expect(input.getAttribute('value')).toBe('Beta!');
		} finally {
			await adapter.unmount(handle);
			host.remove();
		}
	});
});
