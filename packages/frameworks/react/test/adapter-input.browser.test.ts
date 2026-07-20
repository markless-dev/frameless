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

function ControlledTextarea({ onTrace }: { onTrace: (name: string, payload: unknown) => void }) {
	const [value, setValue] = useState('');
	return React.createElement('textarea', {
		'data-action': 'type',
		value,
		onChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
			setValue(event.currentTarget.value);
			onTrace('change', { value: event.currentTarget.value });
		},
	});
}

function ControlledCheckbox({ onTrace }: { onTrace: (name: string, payload: unknown) => void }) {
	const [checked, setChecked] = useState(false);
	return React.createElement('input', {
		'data-action': 'check',
		type: 'checkbox',
		checked,
		onChange(event: React.ChangeEvent<HTMLInputElement>) {
			setChecked(event.currentTarget.checked);
			onTrace('change', { checked: event.currentTarget.checked });
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

const textareaScenario: Scenario = {
	id: 'react-controlled-textarea',
	purpose: 'React controlled textarea dispatch reaches onChange and commits the typed value',
	initialProps: {},
	actions: [{ type: 'input', target: '[data-action="type"]', value: 'typed' }],
	expectedCallbacks: [{ name: 'change', fields: ['value'], count: 1 }],
};

const checkboxScenario: Scenario = {
	id: 'react-controlled-checkbox',
	purpose: 'React controlled checkbox dispatch reaches onChange and commits the checked state',
	initialProps: {},
	actions: [{ type: 'check', target: '[data-action="check"]', checked: true }],
	expectedCallbacks: [{ name: 'change', fields: ['checked'], count: 1 }],
};

function findInput(nodes: SerializedNode[]): SerializedNode | undefined {
	for (const node of nodes) {
		if (node.tag === 'input') return node;
		const nested = findInput(node.children ?? []);
		if (nested) return nested;
	}
}

function findTextarea(nodes: SerializedNode[]): SerializedNode | undefined {
	for (const node of nodes) {
		if (node.tag === 'textarea') return node;
		const nested = findTextarea(node.children ?? []);
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

test('dispatches analyzer input actions through React controlled textareas', async () => {
	const trace = await runScenario(createReactAdapter(ControlledTextarea), textareaScenario);
	const finalObservation = trace.observations.at(-1)!;

	expect(finalObservation.callbacks).toEqual([
		expect.objectContaining({ name: 'change', payload: { value: 'typed' }, invocation: 1 }),
	]);
	expect(findTextarea(finalObservation.dom)?.properties?.value).toBe('typed');
});

test('dispatches analyzer check actions through React controlled checkboxes', async () => {
	const trace = await runScenario(createReactAdapter(ControlledCheckbox), checkboxScenario);
	const finalObservation = trace.observations.at(-1)!;

	expect(finalObservation.callbacks).toEqual([
		expect.objectContaining({ name: 'change', payload: { checked: true }, invocation: 1 }),
	]);
	expect(findInput(finalObservation.dom)?.properties?.checked).toBe(true);
});
