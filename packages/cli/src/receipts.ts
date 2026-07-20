export const BUILD_RECEIPT_SCHEMA_VERSION = 'frameless-build-receipts/1' as const;
export const ENRICHED_IR_VERSION = 'frameless-enriched-ir/1' as const;
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
};

export type EquivalenceDelegation = {
	readonly state: 'delegated';
	readonly authority: typeof BUILD_EQUIVALENCE_AUTHORITY;
	readonly command: string;
};

export type BuildReceipt = {
	readonly schema: typeof BUILD_RECEIPT_SCHEMA_VERSION;
	readonly generator: GeneratorInfo;
	readonly input: BuildInputRecord;
	readonly ir: IrIdentity;
	readonly targets: Readonly<Record<string, TargetBuildReceipt>>;
	readonly equivalence: EquivalenceDelegation;
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
	exactKeys(value, ['schema', 'generator', 'input', 'ir', 'targets', 'equivalence'], 'BuildReceipt');

	validateGenerator(value.generator);
	validateInput(value.input);
	validateIr(value.ir);
	validateTargets(value.targets);
	validateEquivalence(value.equivalence);
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
	exactKeys(value, ['files', 'policies', 'violations'], construct);
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

function assertRecord(value: unknown, construct: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`${construct} is malformed: expected an object`);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], construct: string): void {
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
