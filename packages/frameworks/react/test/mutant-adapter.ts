import type { Adapter, MutantClass } from '@frameless/analyzer';

type Trace = (name: string, payload: unknown, event?: Event) => void;

export function withMutant<Handle>(base: Adapter<Handle>, mutant: MutantClass): Adapter<Handle> {
	let delayed: Parameters<Trace> | null = null;
	return {
		...base,
		mount(host, props) {
			const original = props.onTrace as Trace;
			const onTrace: Trace = (name, payload, event) => {
				if (mutant.id === 'omitted-callback' && name === 'checked') return;
				if (mutant.id === 'duplicate-handler' && name === 'toggle') {
					original(name, payload, event);
					original(name, payload, event);
					return;
				}
				if (mutant.id === 'reordered-callback' && name === 'submit') {
					delayed = [name, payload, event];
					return;
				}
				if (mutant.id === 'reordered-callback' && name === 'bubble' && delayed) {
					original(name, payload, event);
					original(...delayed);
					delayed = null;
					return;
				}
				original(name, payload, mutant.id === 'wrong-cancellation' && name === 'submit' ? undefined : event);
			};
			return base.mount(host, { ...props, onTrace });
		},
		async dispatch(handle, action) {
			await base.dispatch(handle, action);
			mutateDom(base.host(handle), action.target, mutant.id);
		},
	};
}

function mutateDom(host: HTMLElement, target: string, mutantId: MutantClass['id']): void {
	if (mutantId === 'wrong-text') {
		host.querySelector('[data-count="complete"]')?.replaceChildren('mutant');
	}
	if (mutantId === 'wrong-live-property') {
		const input = host.querySelector<HTMLInputElement>('[data-action="text"]');
		if (input) input.value = `${input.value}!`;
	}
	if (mutantId === 'broken-key-identity' && target.includes('reorder')) {
		const row = host.querySelector('[data-oracle-row-key]');
		if (row) row.replaceWith(row.cloneNode(true));
	}
	if (mutantId === 'timing' && target.includes('submit')) {
		host.querySelector('[data-writes="true"]')?.replaceChildren('timing');
	}
}
