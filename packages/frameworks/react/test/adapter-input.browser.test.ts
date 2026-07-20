import { runScenario, type Scenario, type SerializedNode } from '@frameless/analyzer';
import { createReactAdapter } from '@frameless/react/adapter';
import React, { useState } from 'react';
import { expect, test } from 'vitest';

function ControlledInput({ onTrace }: { onTrace: (name: string, payload: unknown) => void }) {
	const [value, setValue] = useState('');
	return React.createElement('input', {
		'data-action': 'type',
		value,
		onChange(event: React.ChangeEvent<HTMLInputElement>) {
			setValue(event.currentTarget.value);
			onTrace('change', { value: event.currentTarget.value });
		},
	});
}

const scenario: Scenario = {
	id: 'react-controlled-input',
	purpose: 'React controlled input dispatch reaches onChange and commits the typed value',
	initialProps: {},
	actions: [{ type: 'input', target: '[data-action="type"]', value: 'typed' }],
	expectedCallbacks: [{ name: 'change', fields: ['value'], count: 1 }],
};

function findInput(nodes: SerializedNode[]): SerializedNode | undefined {
	for (const node of nodes) {
		if (node.tag === 'input') return node;
		const nested = findInput(node.children ?? []);
		if (nested) return nested;
	}
}

test('dispatches analyzer input actions through React controlled inputs', async () => {
	const trace = await runScenario(createReactAdapter(ControlledInput), scenario);
	const finalObservation = trace.observations.at(-1)!;

	expect(finalObservation.callbacks).toEqual([
		expect.objectContaining({ name: 'change', payload: { value: 'typed' }, invocation: 1 }),
	]);
	expect(findInput(finalObservation.dom)?.properties?.value).toBe('typed');
});
