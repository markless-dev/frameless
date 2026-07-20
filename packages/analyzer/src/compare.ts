import type { Divergence, RunTrace, Verdict } from './types.ts';

function canonical(value: unknown, key = ''): unknown {
	if (Array.isArray(value)) return value.map((item) => canonical(item));
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.filter(
					([field]) =>
						field !== 'nodeId' && field !== 'rows' && (key !== 'focus' || field !== 'nodeId'),
				)
				.map(([field, item]) => [field, canonical(item, field)]),
		);
	}
	return value;
}

function firstDiff(left: unknown, right: unknown, path = '$'): string | null {
	if (Object.is(left, right)) return null;
	if (typeof left !== typeof right || left === null || right === null) return path;
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) return `${path}.length`;
		for (let index = 0; index < left.length; index++) {
			const difference = firstDiff(left[index], right[index], `${path}[${index}]`);
			if (difference) return difference;
		}
		return null;
	}
	if (typeof left === 'object') {
		const leftRecord = left as Record<string, unknown>;
		const rightRecord = right as Record<string, unknown>;
		const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort();
		for (const key of keys) {
			const difference = firstDiff(leftRecord[key], rightRecord[key], `${path}.${key}`);
			if (difference) return difference;
		}
		return null;
	}
	return path;
}

function add(
	divergences: Divergence[],
	channel: Divergence['channel'],
	phase: string,
	left: unknown,
	right: unknown,
): void {
	const canonicalLeft = canonical(left);
	const canonicalRight = canonical(right);
	const path = firstDiff(canonicalLeft, canonicalRight);
	if (path) divergences.push({ channel, phase, path, left: canonicalLeft, right: canonicalRight });
}

export function compareRuns(left: RunTrace, right: RunTrace): Verdict {
	const divergences: Divergence[] = [];
	if (left.scenario !== right.scenario) {
		add(divergences, 'trace', 'run', left.scenario, right.scenario);
	}
	const count = Math.max(left.observations.length, right.observations.length);
	for (let index = 0; index < count; index++) {
		const leftObservation = left.observations[index];
		const rightObservation = right.observations[index];
		const phase = leftObservation?.phase ?? rightObservation?.phase ?? `#${index}`;
		if (!leftObservation || !rightObservation) {
			add(divergences, 'trace', phase, leftObservation, rightObservation);
			continue;
		}
		add(divergences, 'trace', phase, leftObservation.phase, rightObservation.phase);
		add(divergences, 'dom', phase, leftObservation.dom, rightObservation.dom);
		add(divergences, 'callback', phase, leftObservation.callbacks, rightObservation.callbacks);
		add(
			divergences,
			'identity',
			phase,
			leftObservation.identityViolations,
			rightObservation.identityViolations,
		);
		add(
			divergences,
			'focus',
			phase,
			{ focus: leftObservation.focus, violations: leftObservation.focusViolations },
			{ focus: rightObservation.focus, violations: rightObservation.focusViolations },
		);
	}
	return divergences.length ? { equal: false, divergences } : { equal: true, divergences: [] };
}
