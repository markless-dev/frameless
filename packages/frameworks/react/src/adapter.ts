import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Action, Adapter } from '@frameless/analyzer';

type ReactHandle = { readonly host: HTMLElement; readonly root: Root };

export function createReactAdapter(
	component: React.ComponentType<any>,
): Adapter<ReactHandle> {
	return {
		name: 'react-19.2.3',
		host: (handle) => handle.host,
		async mount(host, props) {
			const root = createRoot(host);
			await act(async () => root.render(React.createElement(component, props)));
			return { host, root };
		},
		async dispatch(handle, action) {
			await act(async () => dispatchDomAction(handle.host, action));
		},
		settle(handle) {
			return boundedQuiescence(handle.host, async () => {
				await act(async () => Promise.resolve());
			});
		},
		async unmount(handle) {
			await act(async () => handle.root.unmount());
		},
	};
}

function dispatchDomAction(host: HTMLElement, action: Action): void {
	const target = host.querySelector<HTMLElement>(action.target);
	if (!target) throw new Error(`Action target not found: ${action.target}`);
	if (action.type === 'focus') {
		target.focus();
		if (action.selection && target instanceof HTMLInputElement) {
			target.setSelectionRange(...action.selection);
		}
		return;
	}
	if (action.type === 'input') {
		const input = target as HTMLInputElement | HTMLTextAreaElement;
		const prototype =
			input instanceof HTMLTextAreaElement
				? HTMLTextAreaElement.prototype
				: HTMLInputElement.prototype;
		const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!;
		setValue.call(input, action.value);
		if (action.selection) input.setSelectionRange(...action.selection);
		input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: action.value }));
		return;
	}
	if (action.type === 'check') {
		const input = target as HTMLInputElement;
		// Seed React's tracker with the inverse; native click activation then toggles the live
		// property to the requested value before React observes the change event.
		input.checked = !action.checked;
		input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		return;
	}
	target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

async function boundedQuiescence(host: HTMLElement, flush: () => Promise<void>): Promise<void> {
	const deadline = performance.now() + 500;
	let previous = '';
	let stable = 0;
	while (performance.now() < deadline) {
		await flush();
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		const current = host.innerHTML;
		stable = current === previous ? stable + 1 : 0;
		previous = current;
		if (stable >= 2) return;
	}
	throw new Error('Observable DOM did not quiesce within 500ms');
}
