import type { SemanticGraphArtifact } from '@markless/compiler';

/** Global property name for the Frameless pre-paint persistence seed container. */
export const FRAMELESS_STATE_GLOBAL = '__FRAMELESS_STATE__' as const;

export type PersistenceKey =
	| {
			readonly origin: 'derived';
			readonly sourceIdentifier: string;
			readonly literal: `markless:${string}`;
			readonly bakedAtCompileTime: true;
	  }
	| {
			readonly origin: 'explicit';
			readonly literal: string;
			readonly bakedAtCompileTime: true;
	  };

/** Vendor-facing storage fact accepted at the Frameless adapter boundary. */
export interface MarklessStorageSourceFact {
	readonly graphNodeId: string;
	readonly moduleId: string;
	readonly bindingName: string;
	readonly key: PersistenceKey;
	readonly authoredInitial: string;
	readonly writable: boolean;
}

export type PersistenceLanding =
	| {
			readonly target: 'markless';
			readonly kind: 'payload-scripts';
			readonly slotSymbolKey: 'tsrx.storage/1';
	  }
	| {
			readonly target: 'react';
			readonly kind: 'sync-read-seed-slot';
			readonly graphNodeId: string;
	  }
	| {
			readonly target: 'solid';
			readonly kind: 'sync-read-seed-slot';
			readonly graphNodeId: string;
	  };

export interface PersistenceAccess {
	readonly render: boolean;
	readonly handler: boolean;
}

/** Target-neutral persistence contract consumed by later lowering slices. */
export interface FramelessPersistenceRecord {
	readonly version: 'frameless-persistence-record/1';
	readonly graphNodeId: string;
	readonly moduleId: string;
	readonly bindingName: string;
	readonly driver: 'localStorage';
	readonly key: PersistenceKey;
	readonly authoredInitial: string;
	readonly antiFlashAttribute: string;
	readonly access: PersistenceAccess;
	readonly seed:
		| {
				readonly lowering: 'pre-paint';
				readonly readFailure: 'authored-initial';
				readonly corruptedValue: 'authored-initial';
				readonly landings: ReadonlyArray<PersistenceLanding>;
		  }
		| {
				readonly lowering: 'none';
				readonly reason: 'no-render-read';
				readonly landings: readonly [];
		  };
	readonly writeThrough: {
		readonly trigger: 'ordinary-assignment';
		readonly value: 'final-committed-string';
		readonly timing: 'commit-before-notify';
		readonly writeFailure: 'swallow';
		readonly crossTabSync: 'off';
	};
}

const SOURCE_FACT_FIELDS = [
	'graphNodeId',
	'moduleId',
	'bindingName',
	'key',
	'authoredInitial',
	'writable',
] as const;

function assertRecord(
	value: unknown,
	construct: string,
): asserts value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new TypeError(`${construct} must be an object.`);
}

function assertExactFields(
	value: Record<string, unknown>,
	fields: readonly string[],
	construct: string,
): void {
	const missing = fields.find((field) => !Object.hasOwn(value, field));
	if (missing) throw new TypeError(`${construct} is missing required field "${missing}".`);
	const unknown = Object.keys(value).find((field) => !fields.includes(field));
	if (unknown) throw new TypeError(`${construct} has unknown field "${unknown}".`);
}

function assertNonemptyString(value: unknown, field: string, construct: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new TypeError(`${construct}.${field} must be a non-empty string.`);
	return value;
}

function validateKey(value: unknown, construct: string): PersistenceKey {
	assertRecord(value, `${construct}.key`);
	if (value.origin === 'derived') {
		assertExactFields(
			value,
			['origin', 'sourceIdentifier', 'literal', 'bakedAtCompileTime'],
			`${construct}.key`,
		);
		const sourceIdentifier = assertNonemptyString(
			value.sourceIdentifier,
			'sourceIdentifier',
			`${construct}.key`,
		);
		if (
			typeof value.literal !== 'string' ||
			value.literal !== `markless:${sourceIdentifier}` ||
			value.bakedAtCompileTime !== true
		)
			throw new TypeError(`${construct}.key has malformed derived-key fields.`);
		return value as unknown as PersistenceKey;
	}
	if (value.origin === 'explicit') {
		assertExactFields(
			value,
			['origin', 'literal', 'bakedAtCompileTime'],
			`${construct}.key`,
		);
		if (typeof value.literal !== 'string' || value.bakedAtCompileTime !== true)
			throw new TypeError(`${construct}.key has malformed explicit-key fields.`);
		return value as unknown as PersistenceKey;
	}
	throw new TypeError(`${construct}.key.origin must be "derived" or "explicit".`);
}

function validateSourceFact(value: unknown, index: number): MarklessStorageSourceFact {
	const construct = `MarklessStorageSourceFact[${index}]`;
	assertRecord(value, construct);
	assertExactFields(value, SOURCE_FACT_FIELDS, construct);
	assertNonemptyString(value.graphNodeId, 'graphNodeId', construct);
	assertNonemptyString(value.moduleId, 'moduleId', construct);
	assertNonemptyString(value.bindingName, 'bindingName', construct);
	validateKey(value.key, construct);
	if (typeof value.authoredInitial !== 'string')
		throw new TypeError(`${construct}.authoredInitial must be a string.`);
	if (typeof value.writable !== 'boolean')
		throw new TypeError(`${construct}.writable must be a boolean.`);
	return value as unknown as MarklessStorageSourceFact;
}

function validateAccess(value: unknown, graphNodeId: string): PersistenceAccess {
	const construct = `Persistence access for graph node "${graphNodeId}"`;
	assertRecord(value, construct);
	assertExactFields(value, ['render', 'handler'], construct);
	if (typeof value.render !== 'boolean' || typeof value.handler !== 'boolean')
		throw new TypeError(`${construct} must contain boolean render and handler fields.`);
	return value as unknown as PersistenceAccess;
}

function landingsFor(fact: MarklessStorageSourceFact): PersistenceLanding[] {
	return [
		{
			target: 'markless',
			kind: 'payload-scripts',
			slotSymbolKey: 'tsrx.storage/1',
		},
		{
			target: 'react',
			kind: 'sync-read-seed-slot',
			graphNodeId: fact.graphNodeId,
		},
		{
			target: 'solid',
			kind: 'sync-read-seed-slot',
			graphNodeId: fact.graphNodeId,
		},
	];
}

/**
 * Validate and normalize vendor storage facts into the Frameless-owned record.
 *
 * Validation is intentionally runtime-exact: callers cannot bypass the fail-closed
 * boundary by casting malformed or future-shaped vendor data.
 */
export function adaptPersistenceFacts(
	sourceFacts: readonly MarklessStorageSourceFact[],
	access: (graphNodeId: string) => PersistenceAccess,
): FramelessPersistenceRecord[] {
	if (!Array.isArray(sourceFacts))
		throw new TypeError('Markless storage source facts must be an array.');
	if (typeof access !== 'function')
		throw new TypeError('Persistence access correlation must be a function.');

	const seenRecordIds = new Set<string>();
	return sourceFacts
		.map((candidate, index): FramelessPersistenceRecord => {
			const fact = validateSourceFact(candidate, index);
			const recordId = `${fact.moduleId}\0${fact.graphNodeId}`;
			if (seenRecordIds.has(recordId))
				throw new TypeError(
					`MarklessStorageSourceFact has duplicate graphNodeId "${fact.graphNodeId}" in module "${fact.moduleId}".`,
				);
			seenRecordIds.add(recordId);
			const correlatedAccess = validateAccess(access(fact.graphNodeId), fact.graphNodeId);
			return {
				version: 'frameless-persistence-record/1',
				graphNodeId: fact.graphNodeId,
				moduleId: fact.moduleId,
				bindingName: fact.bindingName,
				driver: 'localStorage',
				key: fact.key,
				authoredInitial: fact.authoredInitial,
				antiFlashAttribute: `data-${fact.key.literal.replaceAll(':', '-')}`,
				access: correlatedAccess,
				seed: correlatedAccess.render
					? {
							lowering: 'pre-paint',
							readFailure: 'authored-initial',
							corruptedValue: 'authored-initial',
							landings: landingsFor(fact),
						}
					: {
							lowering: 'none',
							reason: 'no-render-read',
							landings: [],
						},
				writeThrough: {
					trigger: 'ordinary-assignment',
					value: 'final-committed-string',
					timing: 'commit-before-notify',
					writeFailure: 'swallow',
					crossTabSync: 'off',
				},
			};
		})
		.sort(
			(left, right) =>
				(left.moduleId < right.moduleId ? -1 : left.moduleId > right.moduleId ? 1 : 0) ||
				(left.graphNodeId < right.graphNodeId
					? -1
					: left.graphNodeId > right.graphNodeId
						? 1
						: 0),
		);
}

/**
 * Read storage facts only from the semantic graph boundary. Pinned Markless
 * 0.1.1 has no `binding.storage`, so this returns an empty array without
 * inspecting or reparsing author source.
 */
export function extractPersistenceSourceFacts(
	semanticGraph: SemanticGraphArtifact,
): MarklessStorageSourceFact[] {
	const facts: MarklessStorageSourceFact[] = [];
	for (const binding of semanticGraph.graphBindings) {
		const defensiveBinding = binding as typeof binding & Record<string, unknown>;
		if (!Object.hasOwn(defensiveBinding, 'storage')) continue;
		const construct = `Semantic graph binding "${binding.id}".storage`;
		const storage = defensiveBinding.storage;
		assertRecord(storage, construct);
		assertExactFields(storage, ['key'], construct);
		facts.push(
			validateSourceFact(
				{
					graphNodeId: binding.id,
					moduleId: semanticGraph.filename,
					bindingName: binding.name,
					key: storage.key,
					authoredInitial: binding.initialValue,
					writable: binding.writable,
				},
				facts.length,
			),
		);
	}
	return facts;
}
