import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
	BUILD_RECEIPT_SCHEMA_VERSION,
	createBuildReceipt,
	serializeBuildReceipt,
	validateBuildReceipt,
	type BuildReceipt,
} from '../src/receipts.ts';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);

function receipt(): BuildReceipt {
	return createBuildReceipt({
		generator: { toolName: '@frameless/cli', toolVersion: '0.0.0-test' },
		input: {
			sourcePath: './fixtures/counter.tsrx',
			contentSha256: SHA_A,
			compilerPackageVersion: '0.0.0-test',
		},
		ir: { version: 'frameless-enriched-ir/1', digestSha256: SHA_B },
		targets: {
			react: {
				packageSpecifier: '@frameless/react',
				resolvedPackage: { name: '@frameless/react', version: '0.0.0-test' },
				emittedFilePath: 'generated/react/counter.tsx',
				emittedContentSha256: SHA_C,
				validation: { state: 'passed' },
				gate: {
					files: ['generated/react/counter.tsx'],
					policies: [{ id: 'component-shape', dossierRef: 'T002 ruling 10' }],
					violations: [],
				},
			},
			solid: {
				packageSpecifier: '@frameless/solid',
				resolvedPackage: { name: '@frameless/solid', version: '0.0.0-test' },
				emittedFilePath: 'generated/solid/counter.tsx',
				emittedContentSha256: SHA_A,
				validation: { state: 'failed', diagnostic: 'generated module did not parse' },
				gate: {
					files: ['generated/solid/counter.tsx'],
					policies: [{ id: 'component-shape', dossierRef: 'T003 ruling 10' }],
					violations: [
						{
							file: 'generated/solid/counter.tsx',
							policy: 'component-shape',
							dossierRef: 'T003 ruling 10',
							message: 'expected one component',
							line: 1,
						},
					],
				},
			},
		},
		equivalence: {
			state: 'delegated',
			authority: 'vitest browser lanes (react-browser, solid-browser; cross-target lane per T010)',
			command: 'pnpm test:browser',
		},
	});
}

describe('frameless-build-receipts/1', () => {
	test('round-trips through deterministic JSON and validation', () => {
		const created = receipt();
		const parsed: unknown = JSON.parse(serializeBuildReceipt(created));

		expect(validateBuildReceipt(parsed)).toEqual(created);
		expect(created.schema).toBe(BUILD_RECEIPT_SCHEMA_VERSION);
	});

	test('rejects the wrong schema tag', () => {
		expect(() => validateBuildReceipt({ ...receipt(), schema: 'frameless-receipts/1' })).toThrow(
			/BuildReceipt schema/,
		);
	});

	test('rejects unknown fields at every schema boundary', () => {
		const value = receipt();
		expect(() => validateBuildReceipt({ ...value, browserResult: 'equal' })).toThrow(
			/BuildReceipt has unknown field: browserResult/,
		);
		expect(() =>
			validateBuildReceipt({
				...value,
				generator: { ...value.generator, generatedAt: 'not part of this pure schema' },
			}),
		).toThrow(/BuildReceipt generator has unknown field: generatedAt/);
	});

	test('rejects a missing target section and an empty target map', () => {
		const { targets: _targets, ...withoutTargets } = receipt();
		expect(() => validateBuildReceipt(withoutTargets)).toThrow(/BuildReceipt is missing field: targets/);
		expect(() => validateBuildReceipt({ ...receipt(), targets: {} })).toThrow(
			/BuildReceipt targets must contain at least one target/,
		);
	});

	test('rejects a target whose resolved package name differs from its specifier', () => {
		const value = receipt();
		expect(() =>
			validateBuildReceipt({
				...value,
				targets: {
					...value.targets,
					react: {
						...value.targets.react,
						resolvedPackage: { name: '@test/fake', version: '0.0.0-test' },
					},
				},
			}),
		).toThrow(/resolvedPackage name must match packageSpecifier/);
	});

	test('rejects non-sha256-shaped hashes', () => {
		const value = receipt();
		const badHashes = [
			{
				value: { ...value, input: { ...value.input, contentSha256: 'abc123' } },
				construct: /BuildReceipt input contentSha256/,
			},
			{
				value: { ...value, ir: { ...value.ir, digestSha256: 'abc123' } },
				construct: /BuildReceipt IR identity digestSha256/,
			},
			{
				value: {
					...value,
					targets: {
						...value.targets,
						react: { ...value.targets.react, emittedContentSha256: 'abc123' },
					},
				},
				construct: /BuildReceipt target react emittedContentSha256/,
			},
		];
		for (const badHash of badHashes)
			expect(() => validateBuildReceipt(badHash.value)).toThrow(badHash.construct);
	});

	test('cannot claim browser equality and accepts only delegated equivalence', () => {
		const value = receipt();
		expect(() =>
			validateBuildReceipt({
				...value,
				equivalence: { state: 'equal', equal: true, command: 'pnpm test:browser' },
			}),
		).toThrow(/BuildReceipt equivalence state must be delegated/);
	});

	test('serializes recursively with stable keys independent of insertion order', () => {
		const value = receipt();
		const reordered = {
			equivalence: value.equivalence,
			targets: { solid: value.targets.solid, react: value.targets.react },
			ir: value.ir,
			input: value.input,
			generator: value.generator,
			schema: value.schema,
		};

		expect(serializeBuildReceipt(reordered)).toBe(serializeBuildReceipt(value));
		expect(serializeBuildReceipt(value)).toMatch(/\n$/);
	});

	test('keeps the receipt module free of Node and host-environment imports', () => {
		const source = readFileSync(new URL('../src/receipts.ts', import.meta.url), 'utf8');
		expect(source).not.toMatch(/from\s+['"]node:/);
		expect(source).not.toMatch(/from\s+['"](?:fs|fs\/promises)['"]/);
		expect(source).not.toMatch(/\bprocess\b/);
	});
});
