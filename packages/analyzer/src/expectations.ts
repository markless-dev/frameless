import type { Expectation, ExpectationResult, RunTrace, SerializedNode } from './types.ts';

type ParsedSelector = { tag?: string; attribute?: string; value?: string };

const NAME = '[A-Za-z_:][A-Za-z0-9_.:-]*';
const TAG = '[A-Za-z][A-Za-z0-9-]*';
const SELECTOR = new RegExp(
	`^(?:(${TAG}))?(?:\\[(${NAME})(?:=(?:"([^"]*)"|'([^']*)'|([^\\s"'=\\]]+)))?\\])?$`,
);

function parseSelector(selector: string): ParsedSelector {
	const match = SELECTOR.exec(selector);
	if (!match || (!match[1] && !match[2])) {
		throw new Error(
			`Unsupported expectation selector ${JSON.stringify(selector)}; supported grammar is tag, [attr], [attr=value], tag[attr], or tag[attr=value]`,
		);
	}
	return {
		tag: match[1],
		attribute: match[2],
		value: match[3] ?? match[4] ?? match[5],
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
	value: Record<string, unknown>,
	required: readonly string[],
	allowed: readonly string[] = required,
): boolean {
	return (
		required.every((key) => Object.hasOwn(value, key)) &&
		Object.getOwnPropertyNames(value).every((key) => allowed.includes(key)) &&
		Object.getOwnPropertySymbols(value).length === 0
	);
}

function isSelection(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		value.every((item) => Number.isInteger(item) && item >= 0)
	);
}

/** Strictly validate an expectation and its deliberately small selector grammar. */
export function assertValidExpectation(value: unknown): asserts value is Expectation {
	if (!isRecord(value) || typeof value.phase !== 'string' || typeof value.selector !== 'string') {
		throw new Error('Expectation is malformed');
	}
	if (
		value.phase !== 'mount' &&
		value.phase !== 'unmount' &&
		!/^action:\d+:(?:before|after|microtask|quiescence)$/.test(value.phase)
	) {
		throw new Error(`Expectation phase is unsupported: ${value.phase}`);
	}
	parseSelector(value.selector);
	if (value.kind === 'dom-text') {
		if (
			!exactKeys(value, ['kind', 'phase', 'selector', 'text']) ||
			typeof value.text !== 'string'
		) {
			throw new Error('dom-text expectation is malformed');
		}
		return;
	}
	if (value.kind === 'dom-present') {
		if (
			!exactKeys(value, ['kind', 'phase', 'selector', 'count']) ||
			!Number.isInteger(value.count) ||
			(value.count as number) < 0
		) {
			throw new Error('dom-present expectation is malformed');
		}
		return;
	}
	if (value.kind === 'dom-path') {
		if (
			!exactKeys(value, ['kind', 'phase', 'selector', 'parentTags']) ||
			!Array.isArray(value.parentTags) ||
			!value.parentTags.every(
				(tag) => typeof tag === 'string' && /^[a-z][a-z0-9-]*$/.test(tag),
			)
		) {
			throw new Error('dom-path expectation is malformed');
		}
		return;
	}
	if (value.kind === 'focus') {
		if (
			!exactKeys(
				value,
				['kind', 'phase', 'selector'],
				['kind', 'phase', 'selector', 'selection'],
			) ||
			(Object.hasOwn(value, 'selection') && !isSelection(value.selection))
		) {
			throw new Error('focus expectation is malformed');
		}
		return;
	}
	throw new Error(`Expectation kind is unsupported: ${String(value.kind)}`);
}

type SerializedElement = { node: SerializedNode; parentTags: string[] };

function elements(
	nodes: readonly SerializedNode[],
	parentTags: readonly string[] = [],
): SerializedElement[] {
	const found: SerializedElement[] = [];
	for (const node of nodes) {
		if (node.nodeType !== 'element') continue;
		found.push(
			{ node, parentTags: [...parentTags] },
			...elements(node.children ?? [], [...parentTags, node.tag ?? '']),
		);
	}
	return found;
}

function matches(node: SerializedNode, selector: ParsedSelector): boolean {
	if (selector.tag && node.tag !== selector.tag) return false;
	if (!selector.attribute) return true;
	const attribute = node.attributes?.find(([name]) => name === selector.attribute);
	if (!attribute) return false;
	return selector.value === undefined || attribute[1] === selector.value;
}

function textContent(node: SerializedNode): string {
	if (node.nodeType === 'text') return node.text ?? '';
	return (node.children ?? []).map(textContent).join('');
}

/** Evaluate scenario assertions against serialized observations, never the live DOM. */
export function evaluateExpectations(
	trace: RunTrace,
	expectations: readonly Expectation[],
): ExpectationResult[] {
	const phases = new Set(trace.observations.map(({ phase }) => phase));
	return expectations.map((expectation) => {
		assertValidExpectation(expectation);
		if (!phases.has(expectation.phase)) {
			if (expectation.kind === 'dom-text') {
				return { expectation, phase: expectation.phase, outcome: 'fail', observed: null };
			}
			if (expectation.kind === 'dom-present') {
				return { expectation, phase: expectation.phase, outcome: 'fail', observed: 0 };
			}
			if (expectation.kind === 'dom-path') {
				return { expectation, phase: expectation.phase, outcome: 'fail', observed: null };
			}
			return {
				expectation,
				phase: expectation.phase,
				outcome: 'fail',
				observed: { focused: false, selection: null },
			};
		}
		const selector = parseSelector(expectation.selector);
		const observation = trace.observations.find(({ phase }) => phase === expectation.phase);
		const selected = observation
			? elements(observation.dom).filter(({ node }) => matches(node, selector))
			: [];
		if (expectation.kind === 'dom-text') {
			const observed = selected[0] ? textContent(selected[0].node) : null;
			return observed === expectation.text
				? { expectation, phase: expectation.phase, outcome: 'pass' }
				: { expectation, phase: expectation.phase, outcome: 'fail', observed };
		}
		if (expectation.kind === 'dom-present') {
			return selected.length === expectation.count
				? { expectation, phase: expectation.phase, outcome: 'pass' }
				: {
						expectation,
						phase: expectation.phase,
						outcome: 'fail',
						observed: selected.length,
					};
		}
		if (expectation.kind === 'dom-path') {
			const observed = selected[0]?.parentTags ?? null;
			const matchesPath =
				observed !== null &&
				observed.length === expectation.parentTags.length &&
				observed.every((tag, index) => tag === expectation.parentTags[index]);
			return matchesPath
				? { expectation, phase: expectation.phase, outcome: 'pass' }
				: { expectation, phase: expectation.phase, outcome: 'fail', observed };
		}
		const focused = selected.some(
			({ node: { nodeId } }) => nodeId === observation?.focus?.nodeId,
		);
		const observed = { focused, selection: observation?.focus?.selection ?? null };
		const selectionMatches =
			expectation.selection === undefined ||
			(observed.selection !== null &&
				expectation.selection[0] === observed.selection[0] &&
				expectation.selection[1] === observed.selection[1]);
		return focused && selectionMatches
			? { expectation, phase: expectation.phase, outcome: 'pass' }
			: { expectation, phase: expectation.phase, outcome: 'fail', observed };
	});
}
