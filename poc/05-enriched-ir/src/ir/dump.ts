import type { EnrichedIR, JsonValue } from './schema';

/**
 * Serialize an EnrichedIR with recursively sorted object keys and preserved
 * semantic array order. The trailing newline makes checked-in goldens byte-stable.
 */
export function dumpEnrichedIr(ir: EnrichedIR): string {
	return `${JSON.stringify(sortObjectKeys(ir as unknown as JsonValue), null, 2)}\n`;
}

function sortObjectKeys(value: JsonValue): JsonValue {
	if (Array.isArray(value)) return value.map(sortObjectKeys);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, sortObjectKeys(child)]),
		);
	}
	return value;
}
