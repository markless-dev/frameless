import { render } from 'solid-js/web';
import type { Action, Adapter } from '@frameless/analyzer';

type SolidHandle = { readonly host: HTMLElement; readonly dispose: () => void };

export function createSolidAdapter(component: (props: any) => unknown): Adapter<SolidHandle> {
	return {
		name: 'solid-1.8.22-fallback',
		host: (handle) => handle.host,
		mount(host, props) {
			return { host, dispose: render(() => component(props) as never, host) };
		},
		dispatch(handle, action) {
			dispatchDomAction(handle.host, action);
		},
		settle(handle) {
			return boundedQuiescence(handle.host);
		},
		unmount(handle) {
			handle.dispose();
		},
	};
}

function dispatchDomAction(host: HTMLElement, action: Action): void {
	const target = host.querySelector<HTMLElement>(action.target);
	if (!target) throw new Error(`Action target not found: ${action.target}`);
	if (action.type === 'focus') {
		target.focus();
		if (action.selection && target instanceof HTMLInputElement)
			target.setSelectionRange(...action.selection);
		return;
	}
	if (action.type === 'input') {
		const input = target as HTMLInputElement;
		input.value = action.value;
		if (action.selection) input.setSelectionRange(...action.selection);
		input.dispatchEvent(
			new InputEvent('input', { bubbles: true, inputType: 'insertText', data: action.value }),
		);
		return;
	}
	if (action.type === 'check') {
		const input = target as HTMLInputElement;
		input.checked = !action.checked;
		input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		return;
	}
	target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

async function boundedQuiescence(host: HTMLElement): Promise<void> {
	const deadline = performance.now() + 500;
	let previous = '';
	let stable = 0;
	while (performance.now() < deadline) {
		await Promise.resolve();
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		const current = host.innerHTML;
		stable = current === previous ? stable + 1 : 0;
		previous = current;
		if (stable >= 2) return;
	}
	throw new Error('Observable DOM did not quiesce within 500ms');
}
