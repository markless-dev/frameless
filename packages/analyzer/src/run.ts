import { Observer } from './serialize.ts';
import {
	ANALYZER_CONTRACT_VERSION,
	type Adapter,
	type CallbackRecord,
	type RunTrace,
} from './types.ts';
import type { Scenario } from './scenarios.ts';

function normalize(value: unknown): unknown {
	if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
	if (Array.isArray(value)) return value.map(normalize);
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		return Object.fromEntries(Object.keys(record).sort().map((key) => [key, normalize(record[key])]));
	}
	return String(value);
}

export async function runScenario<Handle>(
	adapter: Adapter<Handle>,
	scenario: Scenario,
): Promise<RunTrace> {
	const host = document.createElement('div');
	document.body.append(host);
	const callbacks: CallbackRecord[] = [];
	let phase = 'mount';
	const counts = new Map<string, number>();
	const props = {
		...structuredClone(scenario.initialProps),
		onTrace: (name: string, payload: unknown, event?: Event) => {
			const invocation = (counts.get(name) ?? 0) + 1;
			counts.set(name, invocation);
			callbacks.push({
				name,
				payload: normalize(payload),
				phase,
				defaultPrevented: event?.defaultPrevented ?? null,
				invocation,
			});
		},
	};
	const handle = await adapter.mount(host, props);
	const observer = new Observer();
	const observations = [];
	const observed = adapter.host(handle);
	try {
		observations.push(observer.observe(observed, 'mount', callbacks));
		for (let index = 0; index < scenario.actions.length; index++) {
			phase = `action:${index}:before`;
			observations.push(observer.observe(observed, phase, callbacks));
			phase = `action:${index}:after`;
			await adapter.dispatch(handle, scenario.actions[index]);
			observations.push(observer.observe(observed, phase, callbacks));
			phase = `action:${index}:microtask`;
			await Promise.resolve();
			observations.push(observer.observe(observed, phase, callbacks));
			phase = `action:${index}:quiescence`;
			await adapter.settle(handle);
			observations.push(observer.observe(observed, phase, callbacks));
		}
		return {
			contract: ANALYZER_CONTRACT_VERSION,
			scenario: scenario.id,
			framework: adapter.name,
			observations,
		};
	} finally {
		await adapter.unmount(handle);
		host.remove();
	}
}
