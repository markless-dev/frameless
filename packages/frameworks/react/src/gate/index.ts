import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import type { EnrichedIR } from '@frameless/compiler';
import { emit } from '../emitter/index.ts';
import { formatEmitted } from '../format-emitted.ts';
import { parse } from 'yuku-parser';
import { dirname, normalize, relative, resolve } from 'pathe';
import { customPolicies } from './custom-policies.ts';

export type DossierRef = `T002 ruling ${number}` | `T004 §3.1 ${`R-${string}`}`;
export type GatePolicy = {
	readonly id: string;
	readonly dossierRef: DossierRef;
	readonly requiresArtifact?: true;
};
export type GateViolation = {
	readonly file: string;
	readonly policy: string;
	readonly dossierRef: DossierRef;
	readonly message: string;
	readonly line: number | null;
};
export type GateResult = {
	readonly files: readonly string[];
	readonly policies: readonly GatePolicy[];
	readonly violations: readonly GateViolation[];
	readonly unevaluated: ReadonlyArray<{
		readonly policy: string;
		readonly reason: 'requires-artifact';
	}>;
};

function artifactPolicy<const Id extends 'R-SH4' | 'R-CH2'>(id: Id) {
	const policy = { id, dossierRef: `T004 §3.1 ${id}` as const };
	Object.defineProperty(policy, 'requiresArtifact', { enumerable: false, value: true });
	return policy as typeof policy & { readonly requiresArtifact: true };
}

export const REACT_GATE_POLICIES = [
	{ id: 'eslint-directive', dossierRef: 'T002 ruling 10' },
	{ id: 'undisclosed-import', dossierRef: 'T002 ruling 10' },
	{ id: 'react-import-allowlist', dossierRef: 'T002 ruling 2' },
	{ id: 'no-forwardRef', dossierRef: 'T002 ruling 8' },
	{ id: 'component-shape', dossierRef: 'T002 ruling 10' },
	{ id: 'controlled-input', dossierRef: 'T002 ruling 9' },
	{ id: 'on-input', dossierRef: 'T002 ruling 9' },
	{ id: 'leaf-event-target', dossierRef: 'T002 ruling 9' },
	{ id: 'const-only-handlers', dossierRef: 'T002 ruling 5' },
	{ id: 'one-call-per-setter', dossierRef: 'T002 ruling 5' },
	{ id: 'ref-guard-shape', dossierRef: 'T002 ruling 3' },
	{ id: 'ref-visibility', dossierRef: 'T002 ruling 4' },
	{ id: 'key-required', dossierRef: 'T002 ruling 6' },
	{ id: 'index-key', dossierRef: 'T002 ruling 6' },
	{ id: 'hook-after-guard', dossierRef: 'T002 ruling 7' },
	{ id: 'render-phase-setter', dossierRef: 'T002 ruling 1' },
	{ id: 'render-phase-effect', dossierRef: 'T002 ruling 2' },
	{ id: 'prevent-default-event', dossierRef: 'T002 ruling 5' },
	{ id: 'use-state-initializer', dossierRef: 'T002 ruling 1' },
	{ id: 'R-SH1', dossierRef: 'T004 §3.1 R-SH1' },
	{ id: 'R-SH2', dossierRef: 'T004 §3.1 R-SH2' },
	{ id: 'R-SH3', dossierRef: 'T004 §3.1 R-SH3' },
	artifactPolicy('R-SH4'),
	{ id: 'R-SH5', dossierRef: 'T004 §3.1 R-SH5' },
	{ id: 'R-CH1', dossierRef: 'T004 §3.1 R-CH1' },
	artifactPolicy('R-CH2'),
	{ id: 'R-RF1', dossierRef: 'T004 §3.1 R-RF1' },
	{ id: 'R-RF2', dossierRef: 'T004 §3.1 R-RF2' },
	{ id: 'R-RF3', dossierRef: 'T004 §3.1 R-RF3' },
	{ id: 'R-RF4', dossierRef: 'T004 §3.1 R-RF4' },
	{ id: 'R-CP1', dossierRef: 'T004 §3.1 R-CP1' },
] as const satisfies readonly GatePolicy[];

const POLICIES = new Map<string, GatePolicy>(
	REACT_GATE_POLICIES.map((policy) => [policy.id, policy]),
);

function dossierRefFor(policy: string): DossierRef {
	const direct = POLICIES.get(policy)?.dossierRef;
	if (direct) return direct;
	if (policy === 'eslint:react/jsx-no-leaked-render') return 'T002 ruling 7';
	if (policy === 'eslint:react/no-array-index-key') return 'T002 ruling 6';
	if (policy.startsWith('eslint:react-hooks/refs')) return 'T002 ruling 3';
	if (policy.startsWith('eslint:react-hooks/')) return 'T002 ruling 1';
	if (policy.startsWith('eslint:react/')) return 'T002 ruling 10';
	return 'T002 ruling 10';
}

function violation(
	file: string,
	policy: string,
	message: string,
	node?: { loc?: { start: { line: number } } | null },
): GateViolation {
	return {
		file,
		policy,
		dossierRef: dossierRefFor(policy),
		message,
		line: node?.loc?.start.line ?? null,
	};
}

async function collectJsxFiles(root: string, directory: string): Promise<string[]> {
	const absolute = resolve(root, directory);
	const entries = await readdir(absolute, { withFileTypes: true }).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		},
	);
	const files: string[] = [];
	for (const entry of entries) {
		const child = resolve(absolute, entry.name);
		if (entry.isDirectory())
			files.push(...(await collectJsxFiles(root, relative(root, child))));
		else if (entry.isFile() && entry.name.endsWith('.jsx'))
			files.push(normalize(relative(root, child)));
	}
	return files;
}

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

type AstNode = Record<string, any>;

function walkAst(value: unknown, visit: (node: AstNode) => void): void {
	if (!value || typeof value !== 'object') return;
	const node = value as AstNode;
	if (typeof node.type === 'string') visit(node);
	for (const [key, child] of Object.entries(node)) {
		if (
			['start', 'end', 'loc', 'comments', 'leadingComments', 'trailingComments'].includes(key)
		)
			continue;
		if (Array.isArray(child)) child.forEach((entry) => walkAst(entry, visit));
		else walkAst(child, visit);
	}
}

function normalizedAst(value: unknown): unknown {
	if (Array.isArray(value))
		return value
			.filter(
				(entry) =>
					!(
						entry &&
						typeof entry === 'object' &&
						(entry as AstNode).type === 'JSXText' &&
						/^\s*$/.test((entry as AstNode).value)
					),
			)
			.map(normalizedAst);
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value as AstNode)
			.filter(
				([key]) =>
					![
						'start',
						'end',
						'loc',
						'raw',
						'comments',
						'leadingComments',
						'trailingComments',
					].includes(key),
			)
			.map(([key, child]) => [key, normalizedAst(child)]),
	);
}

function parseModule(source: string): AstNode {
	const parsed = parse(source, {
		lang: 'jsx',
		sourceType: 'module',
		preserveParens: false,
		attachComments: true,
	});
	if (parsed.diagnostics.length)
		throw new Error(parsed.diagnostics.map((entry) => entry.message).join('; '));
	return parsed.program as unknown as AstNode;
}

function jsxSignatures(source: string): string[] {
	const signatures: string[] = [];
	walkAst(parseModule(source), (node) => {
		if (node.type === 'JSXElement' || node.type === 'JSXFragment')
			signatures.push(JSON.stringify(normalizedAst(node)));
	});
	return signatures.sort();
}

function moduleStoreCount(source: string): number {
	const program = parseModule(source);
	const creators = new Set<string>();
	for (const statement of program.body ?? []) {
		if (statement.type !== 'FunctionDeclaration' || statement.id?.type !== 'Identifier')
			continue;
		let storeReturn = false;
		walkAst(statement.body, (node) => {
			if (
				node.type === 'ReturnStatement' &&
				node.argument?.type === 'ObjectExpression' &&
				node.argument.properties.some(
					(property: AstNode) =>
						property.type === 'Property' &&
						property.value?.type === 'ArrowFunctionExpression' &&
						property.value.params.length === 1,
				)
			)
				storeReturn = true;
		});
		if (storeReturn) creators.add(statement.id.name);
	}
	let count = 0;
	for (const statement of program.body ?? []) {
		if (statement.type !== 'VariableDeclaration') continue;
		for (const declaration of statement.declarations ?? [])
			if (
				declaration.init?.type === 'CallExpression' &&
				declaration.init.callee?.type === 'Identifier' &&
				creators.has(declaration.init.callee.name)
			)
				count += 1;
	}
	return count;
}

function hasProjectionProvenance(artifact: EnrichedIR): boolean {
	let found = false;
	const inspect = (value: unknown): void => {
		if (!value || typeof value !== 'object' || found) return;
		const record = value as Record<string, unknown>;
		if (record.kind === 'component-reference' || record.kind === 'default-slot-projection') {
			found = true;
			return;
		}
		for (const child of Object.values(record)) {
			if (Array.isArray(child)) child.forEach(inspect);
			else inspect(child);
		}
	};
	inspect(artifact.components);
	return found;
}

async function provenanceViolations(
	source: string,
	file: string,
	artifact: EnrichedIR,
): Promise<GateViolation[]> {
	const [actual, expected] = await Promise.all([
		formatEmitted(source),
		formatEmitted(emit(artifact)),
	]);
	const violations: GateViolation[] = [];
	if (moduleStoreCount(actual) !== moduleStoreCount(expected))
		violations.push(
			violation(
				file,
				'R-SH4',
				'Module-store lowering does not match the artifact-recorded shared scope',
			),
		);
	if (
		hasProjectionProvenance(artifact) &&
		jsxSignatures(actual).join('\0') !== jsxSignatures(expected).join('\0')
	)
		violations.push(
			violation(
				file,
				'R-CH2',
				'Authored component-reference or slot projection differs from the artifact',
			),
		);
	return violations;
}

export async function discoverGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<string[]> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	return (await collectJsxFiles(cwd, options.directory ?? 'generated')).sort();
}

function makeEslint(cwd: string): ESLint {
	const hooksModule = reactHooksPlugin as unknown as {
		default?: { configs?: Record<string, any> };
		configs?: Record<string, any>;
	};
	const hooksConfigs = hooksModule.configs ?? hooksModule.default?.configs ?? {};
	const recommendedHooks = hooksConfigs['flat/recommended'] ?? hooksConfigs['recommended-latest'];
	if (!recommendedHooks)
		throw new Error('eslint-plugin-react-hooks ^6 flat recommended config is unavailable');
	return new ESLint({
		cwd,
		overrideConfigFile: true,
		allowInlineConfig: false,
		overrideConfig: [
			eslintJs.configs.recommended,
			(reactPlugin.configs as Record<string, any>).flat.recommended,
			(reactPlugin.configs as Record<string, any>).flat['jsx-runtime'],
			...(Array.isArray(recommendedHooks) ? recommendedHooks : [recommendedHooks]),
			{
				files: ['**/*.jsx'],
				languageOptions: {
					ecmaVersion: 'latest',
					sourceType: 'module',
					parserOptions: { ecmaFeatures: { jsx: true } },
					globals: globals.browser,
				},
				settings: { react: { version: '19' } },
				rules: {
					'no-empty-pattern': 'off',
					'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
					'no-unused-expressions': 'error',
					'react/prop-types': ['error', { skipUndeclared: true }],
					'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary'] }],
					'react/no-array-index-key': 'error',
				},
			},
		] as any,
	});
}

export async function checkSources(
	entries: ReadonlyArray<{
		readonly file: string;
		readonly source: string;
		readonly artifact?: EnrichedIR;
	}>,
	options: { readonly cwd?: string } = {},
): Promise<GateResult> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	const eslint = makeEslint(cwd);
	const violations: GateViolation[] = [];
	const unevaluatedPolicies = new Set<string>();
	for (const { file, source, artifact } of entries) {
		try {
			violations.push(...customPolicies(source, file, violation));
		} catch (error) {
			violations.push(violation(file, 'component-shape', (error as Error).message));
		}
		if (artifact) {
			violations.push(...(await provenanceViolations(source, file, artifact)));
		} else {
			for (const policy of REACT_GATE_POLICIES)
				if ('requiresArtifact' in policy && policy.requiresArtifact)
					unevaluatedPolicies.add(policy.id);
		}
		const [result] = await eslint.lintText(source, {
			filePath: resolve(cwd, file),
			warnIgnored: false,
		});
		for (const message of result?.messages ?? []) {
			if ((message.severity as number) === 0) continue;
			const policy = `eslint:${message.ruleId ?? 'parse'}`;
			violations.push({
				file,
				policy,
				dossierRef: dossierRefFor(policy),
				message: message.message,
				line: message.line ?? null,
			});
		}
	}
	const gateResult = {
		files: entries.map((entry) => entry.file),
		policies: REACT_GATE_POLICIES,
		violations,
	} as unknown as GateResult;
	Object.defineProperty(gateResult, 'unevaluated', {
		enumerable: false,
		value: [...unevaluatedPolicies].map((policy) => ({
			policy,
			reason: 'requires-artifact',
		})),
	});
	return gateResult;
}

export async function checkGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<GateResult> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	const files = await discoverGeneratedFiles({ cwd, directory: options.directory });
	const entries = await Promise.all(
		files.map(async (file) => ({ file, source: await readFile(resolve(cwd, file), 'utf8') })),
	);
	return checkSources(entries, { cwd });
}
