import {
	ENRICHED_IR_VERSION as COMPILER_ENRICHED_IR_VERSION,
	type PersistenceLanding,
} from '@frameless/compiler';

export const BUILD_RECEIPT_SCHEMA_VERSION = 'frameless-build-receipts/2' as const;
export const ENRICHED_IR_VERSION = COMPILER_ENRICHED_IR_VERSION;
export const BUILD_EQUIVALENCE_AUTHORITY =
	'vitest browser lanes (react-browser, solid-browser; cross-target lane per T010)' as const;

export type GeneratorInfo = {
	readonly toolName: string;
	readonly toolVersion: string;
};

export type BuildInputRecord = {
	readonly sourcePath: string;
	readonly contentSha256: string;
	readonly compilerPackageVersion: string;
};

export type IrIdentity = {
	readonly version: typeof ENRICHED_IR_VERSION;
	readonly digestSha256: string;
};

/** Minimal structural copy of the GateResult contract owned by @frameless/react and @frameless/solid. */
export type GateResult = {
	readonly files: readonly string[];
	readonly policies: readonly GatePolicy[];
	readonly violations: readonly GateViolation[];
	readonly unevaluated: readonly GateUnevaluated[];
};

export type GateUnevaluated = {
	readonly policy: string;
	readonly reason: 'requires-artifact';
};

export type GatePolicy = {
	readonly id: string;
	readonly dossierRef: string;
};

export type GateViolation = {
	readonly file: string;
	readonly policy: string;
	readonly dossierRef: string;
	readonly message: string;
	readonly line: number | null;
};

export type ValidationOutcome =
	| { readonly state: 'passed' }
	| { readonly state: 'failed'; readonly diagnostic: string };

export type ResolvedPackage = {
	readonly name: string;
	readonly version: string;
};

export type TargetBuildReceipt = {
	readonly packageSpecifier: string;
	readonly resolvedPackage: ResolvedPackage;
	readonly emittedFilePath: string;
	readonly emittedContentSha256: string;
	readonly validation: ValidationOutcome;
	readonly gate: GateResult;
	readonly modules: readonly TargetModuleBuildReceipt[];
};

export type TargetModuleBuildReceipt = {
	readonly moduleId: string;
	readonly emittedFilePath: string;
	readonly emittedContentSha256: string;
	readonly validation: ValidationOutcome;
	readonly gate: GateResult;
	readonly provenance: {
		readonly artifactSupplied: true;
		readonly allPoliciesEvaluated: true;
	};
};

export type BuildModuleRecord = {
	readonly moduleId: string;
	readonly sourcePath: string;
	readonly contentSha256: string;
	readonly emittedFilename: string;
	readonly ir: IrIdentity;
};

export type LinkTableSummary = {
	readonly moduleCount: number;
	readonly referenceCount: number;
	readonly modules: ReadonlyArray<{
		readonly moduleId: string;
		readonly references: ReadonlyArray<{
			readonly nodeId: string;
			readonly targetModuleId: string;
			readonly exportedName: string;
		}>;
	}>;
};

export type EquivalenceDelegation = {
	readonly state: 'delegated';
	readonly authority: typeof BUILD_EQUIVALENCE_AUTHORITY;
	readonly command: string;
};

export type PersistenceArtifactRecord = {
	readonly graphNodeId: string;
	readonly moduleId: string;
	readonly resolvedKey: string;
	readonly landings: readonly PersistenceLanding[];
};

export type PersistenceBuildArtifact = {
	readonly scriptPath: string;
	readonly contentSha256: string;
	readonly cspHash: string;
	readonly records: readonly PersistenceArtifactRecord[];
	readonly placement: 'head-before-framework';
};

export type BuildReceipt = {
	readonly schema: typeof BUILD_RECEIPT_SCHEMA_VERSION;
	readonly generator: GeneratorInfo;
	readonly input: BuildInputRecord;
	readonly ir: IrIdentity;
	readonly modules: readonly BuildModuleRecord[];
	readonly linkTable: LinkTableSummary;
	readonly targets: Readonly<Record<string, TargetBuildReceipt>>;
	readonly equivalence: EquivalenceDelegation;
	readonly persistence?: PersistenceBuildArtifact;
};

export type BuildReceiptInput = Omit<BuildReceipt, 'schema'>;

export function createBuildReceipt(input: BuildReceiptInput): BuildReceipt {
	return validateBuildReceipt({ ...input, schema: BUILD_RECEIPT_SCHEMA_VERSION });
}

export function validateBuildReceipt(value: unknown): BuildReceipt {
	assertRecord(value, 'BuildReceipt');
	if (value.schema !== BUILD_RECEIPT_SCHEMA_VERSION) {
		throw new Error(
			`BuildReceipt schema must be ${BUILD_RECEIPT_SCHEMA_VERSION}, received ${String(value.schema)}`,
		);
	}
	const keys = [
		'schema',
		'generator',
		'input',
		'ir',
		'modules',
		'linkTable',
		'targets',
		'equivalence',
	] as const;
	exactKeys(
		value,
		Object.hasOwn(value, 'persistence') ? [...keys, 'persistence'] : keys,
		'BuildReceipt',
	);

	validateGenerator(value.generator);
	validateInput(value.input);
	validateIr(value.ir);
	validateModules(value.modules);
	validateLinkTable(value.linkTable);
	validateTargets(value.targets);
	validateEquivalence(value.equivalence);
	if (Object.hasOwn(value, 'persistence')) validatePersistenceArtifact(value.persistence);
	validateReceiptConsistency(value as unknown as BuildReceipt);
	return value as BuildReceipt;
}

/** Recursively sorts object keys while preserving semantic array order. */
export function serializeBuildReceipt(receipt: BuildReceipt): string {
	const valid = validateBuildReceipt(receipt);
	return `${JSON.stringify(sortObjectKeys(valid as unknown as JsonValue), null, 2)}\n`;
}

function validateGenerator(value: unknown): asserts value is GeneratorInfo {
	assertRecord(value, 'BuildReceipt generator');
	exactKeys(value, ['toolName', 'toolVersion'], 'BuildReceipt generator');
	assertNonEmptyString(value.toolName, 'BuildReceipt generator toolName');
	assertNonEmptyString(value.toolVersion, 'BuildReceipt generator toolVersion');
}

function validateInput(value: unknown): asserts value is BuildInputRecord {
	assertRecord(value, 'BuildReceipt input');
	exactKeys(
		value,
		['sourcePath', 'contentSha256', 'compilerPackageVersion'],
		'BuildReceipt input',
	);
	assertNonEmptyString(value.sourcePath, 'BuildReceipt input sourcePath');
	assertSha256(value.contentSha256, 'BuildReceipt input contentSha256');
	assertNonEmptyString(value.compilerPackageVersion, 'BuildReceipt input compilerPackageVersion');
}

function validateIr(value: unknown): asserts value is IrIdentity {
	assertRecord(value, 'BuildReceipt IR identity');
	exactKeys(value, ['version', 'digestSha256'], 'BuildReceipt IR identity');
	if (value.version !== ENRICHED_IR_VERSION) {
		throw new Error(`BuildReceipt IR identity version must be ${ENRICHED_IR_VERSION}`);
	}
	assertSha256(value.digestSha256, 'BuildReceipt IR identity digestSha256');
}

function validateTargets(
	value: unknown,
): asserts value is Readonly<Record<string, TargetBuildReceipt>> {
	assertRecord(value, 'BuildReceipt targets');
	const targets = Object.entries(value);
	if (!targets.length) throw new Error('BuildReceipt targets must contain at least one target');
	for (const [name, target] of targets) {
		if (!name.length) throw new Error('BuildReceipt target name must not be empty');
		validateTarget(target, `BuildReceipt target ${name}`);
	}
}

function validateTarget(value: unknown, construct: string): asserts value is TargetBuildReceipt {
	assertRecord(value, construct);
	exactKeys(
		value,
		[
			'packageSpecifier',
			'resolvedPackage',
			'emittedFilePath',
			'emittedContentSha256',
			'validation',
			'gate',
			'modules',
		],
		construct,
	);
	assertNonEmptyString(value.packageSpecifier, `${construct} packageSpecifier`);
	validateResolvedPackage(value.resolvedPackage, `${construct} resolvedPackage`);
	if (value.resolvedPackage.name !== value.packageSpecifier) {
		throw new Error(`${construct} resolvedPackage name must match packageSpecifier`);
	}
	assertNonEmptyString(value.emittedFilePath, `${construct} emittedFilePath`);
	assertSha256(value.emittedContentSha256, `${construct} emittedContentSha256`);
	validateOutcome(value.validation, `${construct} validation`);
	validateGateResult(value.gate, `${construct} GateResult`);
	assertArray(value.modules, `${construct} modules`);
	if (!value.modules.length) throw new Error(`${construct} modules must not be empty`);
	for (const [index, module] of value.modules.entries())
		validateTargetModule(module, `${construct} modules[${index}]`);
}

function validateTargetModule(
	value: unknown,
	construct: string,
): asserts value is TargetModuleBuildReceipt {
	assertRecord(value, construct);
	exactKeys(
		value,
		['moduleId', 'emittedFilePath', 'emittedContentSha256', 'validation', 'gate', 'provenance'],
		construct,
	);
	assertNonEmptyString(value.moduleId, `${construct} moduleId`);
	assertNonEmptyString(value.emittedFilePath, `${construct} emittedFilePath`);
	assertSha256(value.emittedContentSha256, `${construct} emittedContentSha256`);
	validateOutcome(value.validation, `${construct} validation`);
	validateGateResult(value.gate, `${construct} GateResult`);
	assertRecord(value.provenance, `${construct} provenance`);
	exactKeys(
		value.provenance,
		['artifactSupplied', 'allPoliciesEvaluated'],
		`${construct} provenance`,
	);
	if (value.provenance.artifactSupplied !== true)
		throw new Error(`${construct} provenance artifactSupplied must be true`);
	if (value.provenance.allPoliciesEvaluated !== true)
		throw new Error(`${construct} provenance allPoliciesEvaluated must be true`);
	if (value.gate.unevaluated.length)
		throw new Error(`${construct} cannot confirm provenance with unevaluated gate policies`);
}

function validateModules(value: unknown): asserts value is readonly BuildModuleRecord[] {
	assertArray(value, 'BuildReceipt modules');
	if (!value.length) throw new Error('BuildReceipt modules must not be empty');
	const moduleIds = new Set<string>();
	for (const [index, module] of value.entries()) {
		const construct = `BuildReceipt modules[${index}]`;
		assertRecord(module, construct);
		exactKeys(
			module,
			['moduleId', 'sourcePath', 'contentSha256', 'emittedFilename', 'ir'],
			construct,
		);
		assertNonEmptyString(module.moduleId, `${construct} moduleId`);
		if (moduleIds.has(module.moduleId))
			throw new Error(`BuildReceipt duplicate module ${module.moduleId}`);
		moduleIds.add(module.moduleId);
		assertNonEmptyString(module.sourcePath, `${construct} sourcePath`);
		assertSha256(module.contentSha256, `${construct} contentSha256`);
		assertNonEmptyString(module.emittedFilename, `${construct} emittedFilename`);
		validateIr(module.ir);
	}
}

function validateLinkTable(value: unknown): asserts value is LinkTableSummary {
	const construct = 'BuildReceipt linkTable';
	assertRecord(value, construct);
	exactKeys(value, ['moduleCount', 'referenceCount', 'modules'], construct);
	assertNonNegativeInteger(value.moduleCount, `${construct} moduleCount`);
	assertNonNegativeInteger(value.referenceCount, `${construct} referenceCount`);
	assertArray(value.modules, `${construct} modules`);
	if (value.modules.length !== value.moduleCount)
		throw new Error(`${construct} moduleCount must match modules length`);
	let referenceCount = 0;
	for (const [index, module] of value.modules.entries()) {
		const moduleConstruct = `${construct} modules[${index}]`;
		assertRecord(module, moduleConstruct);
		exactKeys(module, ['moduleId', 'references'], moduleConstruct);
		assertNonEmptyString(module.moduleId, `${moduleConstruct} moduleId`);
		assertArray(module.references, `${moduleConstruct} references`);
		referenceCount += module.references.length;
		for (const [referenceIndex, reference] of module.references.entries()) {
			const referenceConstruct = `${moduleConstruct} references[${referenceIndex}]`;
			assertRecord(reference, referenceConstruct);
			exactKeys(reference, ['nodeId', 'targetModuleId', 'exportedName'], referenceConstruct);
			assertNonEmptyString(reference.nodeId, `${referenceConstruct} nodeId`);
			assertNonEmptyString(reference.targetModuleId, `${referenceConstruct} targetModuleId`);
			assertNonEmptyString(reference.exportedName, `${referenceConstruct} exportedName`);
		}
	}
	if (referenceCount !== value.referenceCount)
		throw new Error(`${construct} referenceCount must match references length`);
}

function validateResolvedPackage(
	value: unknown,
	construct: string,
): asserts value is ResolvedPackage {
	assertRecord(value, construct);
	exactKeys(value, ['name', 'version'], construct);
	assertNonEmptyString(value.name, `${construct} name`);
	assertNonEmptyString(value.version, `${construct} version`);
}

function validateOutcome(value: unknown, construct: string): asserts value is ValidationOutcome {
	assertRecord(value, construct);
	if (value.state === 'passed') {
		exactKeys(value, ['state'], construct);
		return;
	}
	if (value.state === 'failed') {
		exactKeys(value, ['state', 'diagnostic'], construct);
		assertNonEmptyString(value.diagnostic, `${construct} diagnostic`);
		return;
	}
	throw new Error(`${construct} state must be passed or failed`);
}

function validateGateResult(value: unknown, construct: string): asserts value is GateResult {
	assertRecord(value, construct);
	exactKeys(value, ['files', 'policies', 'violations', 'unevaluated'], construct);
	assertArray(value.files, `${construct} files`);
	for (const [index, file] of value.files.entries())
		assertNonEmptyString(file, `${construct} files[${index}]`);
	assertArray(value.policies, `${construct} policies`);
	for (const [index, policy] of value.policies.entries()) {
		const policyConstruct = `${construct} policies[${index}]`;
		assertRecord(policy, policyConstruct);
		exactKeys(policy, ['id', 'dossierRef'], policyConstruct);
		assertNonEmptyString(policy.id, `${policyConstruct} id`);
		assertNonEmptyString(policy.dossierRef, `${policyConstruct} dossierRef`);
	}
	assertArray(value.violations, `${construct} violations`);
	for (const [index, violation] of value.violations.entries()) {
		const violationConstruct = `${construct} violations[${index}]`;
		assertRecord(violation, violationConstruct);
		exactKeys(
			violation,
			['file', 'policy', 'dossierRef', 'message', 'line'],
			violationConstruct,
		);
		assertNonEmptyString(violation.file, `${violationConstruct} file`);
		assertNonEmptyString(violation.policy, `${violationConstruct} policy`);
		assertNonEmptyString(violation.dossierRef, `${violationConstruct} dossierRef`);
		assertNonEmptyString(violation.message, `${violationConstruct} message`);
		if (
			violation.line !== null &&
			(typeof violation.line !== 'number' ||
				!Number.isInteger(violation.line) ||
				violation.line < 1)
		)
			throw new Error(`${violationConstruct} line must be a positive integer or null`);
	}
	assertArray(value.unevaluated, `${construct} unevaluated`);
	for (const [index, unevaluated] of value.unevaluated.entries()) {
		const unevaluatedConstruct = `${construct} unevaluated[${index}]`;
		assertRecord(unevaluated, unevaluatedConstruct);
		exactKeys(unevaluated, ['policy', 'reason'], unevaluatedConstruct);
		assertNonEmptyString(unevaluated.policy, `${unevaluatedConstruct} policy`);
		if (unevaluated.reason !== 'requires-artifact')
			throw new Error(`${unevaluatedConstruct} reason must be requires-artifact`);
	}
}

function validateEquivalence(value: unknown): asserts value is EquivalenceDelegation {
	const construct = 'BuildReceipt equivalence';
	assertRecord(value, construct);
	if (value.state !== 'delegated') throw new Error(`${construct} state must be delegated`);
	exactKeys(value, ['state', 'authority', 'command'], construct);
	if (value.authority !== BUILD_EQUIVALENCE_AUTHORITY)
		throw new Error(`${construct} authority must name the adjudicated vitest browser lanes`);
	assertNonEmptyString(value.command, `${construct} command`);
}

function validatePersistenceArtifact(
	value: unknown,
): asserts value is PersistenceBuildArtifact {
	const construct = 'BuildReceipt persistence';
	assertRecord(value, construct);
	exactKeys(
		value,
		['scriptPath', 'contentSha256', 'cspHash', 'records', 'placement'],
		construct,
	);
	assertNonEmptyString(value.scriptPath, `${construct} scriptPath`);
	assertSha256(value.contentSha256, `${construct} contentSha256`);
	if (
		typeof value.cspHash !== 'string' ||
		!/^sha256-[A-Za-z\d+/]{43}=$/.test(value.cspHash)
	)
		throw new Error(`${construct} cspHash must be a base64 sha256 CSP hash`);
	if (value.placement !== 'head-before-framework')
		throw new Error(`${construct} placement must be head-before-framework`);
	assertArray(value.records, `${construct} records`);
	if (!value.records.length) throw new Error(`${construct} records must not be empty`);
	let previous: { readonly moduleId: string; readonly resolvedKey: string } | undefined;
	for (const [index, record] of value.records.entries()) {
		const recordConstruct = `${construct} records[${index}]`;
		assertRecord(record, recordConstruct);
		exactKeys(
			record,
			['graphNodeId', 'moduleId', 'resolvedKey', 'landings'],
			recordConstruct,
		);
		assertNonEmptyString(record.graphNodeId, `${recordConstruct} graphNodeId`);
		assertNonEmptyString(record.moduleId, `${recordConstruct} moduleId`);
		if (typeof record.resolvedKey !== 'string')
			throw new Error(`${recordConstruct} resolvedKey must be a string`);
		validatePersistenceLandings(record.landings, recordConstruct);
		if (
			previous &&
			(previous.moduleId > record.moduleId ||
				(previous.moduleId === record.moduleId &&
					previous.resolvedKey > record.resolvedKey))
		)
			throw new Error(`${construct} records must be ordered by moduleId then resolvedKey`);
		previous = record as unknown as {
			readonly moduleId: string;
			readonly resolvedKey: string;
		};
	}
}

function validatePersistenceLandings(
	value: unknown,
	construct: string,
): asserts value is readonly PersistenceLanding[] {
	assertArray(value, `${construct} landings`);
	if (!value.length) throw new Error(`${construct} landings must not be empty`);
	let react = false;
	let solid = false;
	for (const [index, landing] of value.entries()) {
		const landingConstruct = `${construct} landings[${index}]`;
		assertRecord(landing, landingConstruct);
		if (landing.target === 'markless') {
			exactKeys(landing, ['target', 'kind', 'slotSymbolKey'], landingConstruct);
			if (
				landing.kind !== 'payload-scripts' ||
				landing.slotSymbolKey !== 'tsrx.storage/1'
			)
				throw new Error(`${landingConstruct} is not a valid markless landing`);
			continue;
		}
		if (landing.target === 'react' || landing.target === 'solid') {
			exactKeys(landing, ['target', 'kind', 'graphNodeId'], landingConstruct);
			if (landing.kind !== 'sync-read-seed-slot')
				throw new Error(`${landingConstruct} kind must be sync-read-seed-slot`);
			assertNonEmptyString(landing.graphNodeId, `${landingConstruct} graphNodeId`);
			if (landing.target === 'react') react = true;
			else solid = true;
			continue;
		}
		throw new Error(`${landingConstruct} target is unknown`);
	}
	if (!react || !solid)
		throw new Error(`${construct} landings must contain React and Solid seed slots`);
}

function validateReceiptConsistency(value: BuildReceipt): void {
	const firstModule = value.modules[0]!;
	if (
		value.input.sourcePath !== firstModule.sourcePath ||
		value.input.contentSha256 !== firstModule.contentSha256
	)
		throw new Error('BuildReceipt input must alias the first modules entry');
	if (
		value.ir.version !== firstModule.ir.version ||
		value.ir.digestSha256 !== firstModule.ir.digestSha256
	)
		throw new Error('BuildReceipt IR identity must alias the first modules entry');
	const moduleIds = value.modules.map(({ moduleId }) => moduleId);
	const linkedModuleIds = value.linkTable.modules.map(({ moduleId }) => moduleId);
	if (
		moduleIds.length !== linkedModuleIds.length ||
		moduleIds.some((moduleId) => !linkedModuleIds.includes(moduleId))
	)
		throw new Error('BuildReceipt linkTable modules must match modules');
	for (const [targetName, target] of Object.entries(value.targets)) {
		const targetModuleIds = target.modules.map(({ moduleId }) => moduleId);
		if (
			moduleIds.length !== targetModuleIds.length ||
			moduleIds.some((moduleId, index) => targetModuleIds[index] !== moduleId)
		)
			throw new Error(
				`BuildReceipt target ${targetName} modules must match modules in order`,
			);
		const firstTargetModule = target.modules[0]!;
		if (
			target.emittedFilePath !== firstTargetModule.emittedFilePath ||
			target.emittedContentSha256 !== firstTargetModule.emittedContentSha256
		)
			throw new Error(`BuildReceipt target ${targetName} output must alias its first module`);
	}
}

function assertRecord(value: unknown, construct: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`${construct} is malformed: expected an object`);
}

function exactKeys(
	value: Record<string, unknown>,
	allowed: readonly string[],
	construct: string,
): void {
	const missing = allowed.find((key) => !Object.hasOwn(value, key));
	if (missing) throw new Error(`${construct} is missing field: ${missing}`);
	const unknown = Object.keys(value).find((key) => !allowed.includes(key));
	if (unknown) throw new Error(`${construct} has unknown field: ${unknown}`);
}

function assertArray(value: unknown, construct: string): asserts value is unknown[] {
	if (!Array.isArray(value)) throw new Error(`${construct} is malformed: expected an array`);
}

function assertNonEmptyString(value: unknown, construct: string): asserts value is string {
	if (typeof value !== 'string' || !value.length)
		throw new Error(`${construct} is malformed: expected a non-empty string`);
}

function assertSha256(value: unknown, construct: string): asserts value is string {
	if (typeof value !== 'string' || !/^[a-f\d]{64}$/i.test(value))
		throw new Error(`${construct} must be a 64-character hexadecimal sha256`);
}

function assertNonNegativeInteger(value: unknown, construct: string): asserts value is number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
		throw new Error(`${construct} must be a non-negative integer`);
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

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
