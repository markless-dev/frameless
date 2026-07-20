import {
	ANALYZER_CONTRACT_VERSION,
	type CallbackRecord,
	type Observation,
	type RunTrace,
	type SerializedNode,
} from './types.ts';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Serialize a validated RunTrace with recursively sorted object keys and a trailing newline. */
export function serializeRunTrace(trace: RunTrace): string {
	validateRunTrace(trace);
	return `${JSON.stringify(sortObjectKeys(trace as unknown as JsonValue), null, 2)}\n`;
}

/** Parse and completely validate a RunTrace received through a text transport. */
export function deserializeRunTrace(text: string): RunTrace {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`RunTrace JSON is malformed: ${detail}`);
	}
	validateRunTrace(value);
	return value;
}

function validateRunTrace(value: unknown): asserts value is RunTrace {
	assertRecord(value, 'RunTrace');
	exactKeys(value, ['contract', 'scenario', 'framework', 'observations'], 'RunTrace');
	if (value.contract !== ANALYZER_CONTRACT_VERSION) {
		throw new Error(
			`RunTrace contract must be ${ANALYZER_CONTRACT_VERSION}, received ${String(value.contract)}`,
		);
	}
	assertString(value.scenario, 'RunTrace scenario');
	assertString(value.framework, 'RunTrace framework');
	assertArray(value.observations, 'RunTrace observations');
	for (const [index, observation] of value.observations.entries()) {
		validateObservation(observation, `RunTrace observations[${index}]`);
	}
}

function validateObservation(value: unknown, construct: string): asserts value is Observation {
	assertRecord(value, construct);
	exactKeys(
		value,
		[
			'phase',
			'dom',
			'focus',
			'callbacks',
			'rows',
			'identityViolations',
			'focusViolations',
		],
		construct,
	);
	assertString(value.phase, `${construct} phase`);
	assertArray(value.dom, `${construct} dom`);
	for (const [index, node] of value.dom.entries()) {
		validateSerializedNode(node, `${construct} dom[${index}]`);
	}
	validateFocus(value.focus, `${construct} focus`);
	assertArray(value.callbacks, `${construct} callbacks`);
	for (const [index, callback] of value.callbacks.entries()) {
		validateCallback(callback, `${construct} callbacks[${index}]`);
	}
	assertRecord(value.rows, `${construct} rows`);
	for (const [key, nodeId] of Object.entries(value.rows)) {
		assertFiniteNumber(nodeId, `${construct} rows ${key}`);
	}
	validateStringArray(value.identityViolations, `${construct} identityViolations`);
	validateStringArray(value.focusViolations, `${construct} focusViolations`);
}

function validateFocus(value: unknown, construct: string): void {
	if (value === null) return;
	assertRecord(value, construct);
	exactKeys(value, ['nodeId', 'path', 'selection'], construct);
	assertFiniteNumber(value.nodeId, `${construct} nodeId`);
	assertString(value.path, `${construct} path`);
	if (value.selection === null) return;
	assertTuple(value.selection, 2, `${construct} selection`);
	assertFiniteNumber(value.selection[0], `${construct} selection[0]`);
	assertFiniteNumber(value.selection[1], `${construct} selection[1]`);
}

function validateCallback(value: unknown, construct: string): asserts value is CallbackRecord {
	assertRecord(value, construct);
	exactKeys(
		value,
		['name', 'payload', 'phase', 'defaultPrevented', 'invocation'],
		construct,
	);
	assertString(value.name, `${construct} name`);
	validateJsonValue(value.payload, `${construct} payload`, new Set());
	assertString(value.phase, `${construct} phase`);
	if (value.defaultPrevented !== null && typeof value.defaultPrevented !== 'boolean') {
		throw new Error(`${construct} defaultPrevented is malformed: expected a boolean or null`);
	}
	assertFiniteNumber(value.invocation, `${construct} invocation`);
}

function validateSerializedNode(value: unknown, construct: string): asserts value is SerializedNode {
	assertRecord(value, construct);
	if (value.nodeType === 'text') {
		exactKeys(value, ['nodeType', 'text', 'nodeId'], construct);
		assertString(value.text, `${construct} text`);
		assertFiniteNumber(value.nodeId, `${construct} nodeId`);
		return;
	}
	if (value.nodeType !== 'element') {
		throw new Error(`${construct} nodeType must be element or text`);
	}
	exactKeys(
		value,
		['nodeType', 'tag', 'attributes', 'properties', 'children', 'nodeId'],
		construct,
		['nodeType', 'namespace', 'tag', 'attributes', 'properties', 'children', 'nodeId'],
	);
	if (Object.hasOwn(value, 'namespace')) {
		if (value.namespace !== null && typeof value.namespace !== 'string') {
			throw new Error(`${construct} namespace is malformed: expected a string or null`);
		}
	}
	assertString(value.tag, `${construct} tag`);
	assertArray(value.attributes, `${construct} attributes`);
	for (const [index, attribute] of value.attributes.entries()) {
		const attributeConstruct = `${construct} attributes[${index}]`;
		assertTuple(attribute, 2, attributeConstruct);
		assertString(attribute[0], `${attributeConstruct}[0]`);
		assertString(attribute[1], `${attributeConstruct}[1]`);
	}
	assertRecord(value.properties, `${construct} properties`);
	validateJsonValue(value.properties, `${construct} properties`, new Set());
	assertArray(value.children, `${construct} children`);
	for (const [index, child] of value.children.entries()) {
		validateSerializedNode(child, `${construct} children[${index}]`);
	}
	assertFiniteNumber(value.nodeId, `${construct} nodeId`);
}

function validateStringArray(value: unknown, construct: string): void {
	assertArray(value, construct);
	for (const [index, item] of value.entries()) assertString(item, `${construct}[${index}]`);
}

function validateJsonValue(value: unknown, construct: string, active: Set<object>): void {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
	if (typeof value === 'number') {
		assertFiniteNumber(value, construct);
		return;
	}
	if (typeof value !== 'object') {
		throw new Error(`${construct} is not JSON-representable: received ${typeof value}`);
	}
	if (active.has(value)) throw new Error(`${construct} is not JSON-representable: cycle detected`);
	active.add(value);
	try {
		if (Array.isArray(value)) {
			if (Object.getOwnPropertySymbols(value).length) {
				throw new Error(`${construct} is not JSON-representable: symbol keys are unsupported`);
			}
			const extraKey = Object.getOwnPropertyNames(value).find((key) => {
				if (key === 'length') return false;
				const index = Number(key);
				return !Number.isInteger(index) || index < 0 || String(index) !== key || index >= value.length;
			});
			if (extraKey) {
				throw new Error(`${construct} is not JSON-representable: array has property ${extraKey}`);
			}
			for (let index = 0; index < value.length; index++) {
				if (!Object.hasOwn(value, index)) {
					throw new Error(`${construct}[${index}] is not JSON-representable: missing array entry`);
				}
				const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
				if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
					throw new Error(
						`${construct}[${index}] is not JSON-representable: expected a data property`,
					);
				}
				validateJsonValue(descriptor.value, `${construct}[${index}]`, active);
			}
			return;
		}
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) {
			throw new Error(`${construct} is not JSON-representable: expected a plain object`);
		}
		if (Object.getOwnPropertySymbols(value).length) {
			throw new Error(`${construct} is not JSON-representable: symbol keys are unsupported`);
		}
		for (const key of Object.getOwnPropertyNames(value)) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
				throw new Error(`${construct} ${key} is not JSON-representable: expected a data property`);
			}
			validateJsonValue(descriptor.value, `${construct} ${key}`, active);
		}
	} finally {
		active.delete(value);
	}
}

function assertRecord(value: unknown, construct: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${construct} is malformed: expected an object`);
	}
}

function exactKeys(
	value: Record<string, unknown>,
	required: readonly string[],
	construct: string,
	allowed: readonly string[] = required,
): void {
	const missing = required.find((key) => !Object.hasOwn(value, key));
	if (missing) throw new Error(`${construct} is missing field: ${missing}`);
	const unknown = Object.getOwnPropertyNames(value).find((key) => !allowed.includes(key));
	if (unknown) throw new Error(`${construct} has unknown field: ${unknown}`);
	const symbol = Object.getOwnPropertySymbols(value)[0];
	if (symbol) throw new Error(`${construct} has unknown field: ${String(symbol)}`);
}

function assertArray(value: unknown, construct: string): asserts value is unknown[] {
	if (!Array.isArray(value)) throw new Error(`${construct} is malformed: expected an array`);
}

function assertTuple(
	value: unknown,
	length: number,
	construct: string,
): asserts value is unknown[] {
	assertArray(value, construct);
	if (value.length !== length) {
		throw new Error(`${construct} is malformed: expected ${length} entries`);
	}
}

function assertString(value: unknown, construct: string): asserts value is string {
	if (typeof value !== 'string') throw new Error(`${construct} is malformed: expected a string`);
}

function assertFiniteNumber(value: unknown, construct: string): asserts value is number {
	if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0)) {
		throw new Error(`${construct} is malformed: expected a JSON-safe number`);
	}
}

function sortObjectKeys(value: JsonValue): JsonValue {
	if (Array.isArray(value)) return value.map(sortObjectKeys);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
				.map(([key, child]) => [key, sortObjectKeys(child)]),
		);
	}
	return value;
}
