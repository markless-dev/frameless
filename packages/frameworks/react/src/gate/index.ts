import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { dirname, normalize, relative, resolve } from 'pathe';
import { customPolicies } from './custom-policies.ts';

export type DossierRef = `T002 ruling ${number}`;
export type GatePolicy = { readonly id: string; readonly dossierRef: DossierRef };
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
};

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
	entries: ReadonlyArray<{ readonly file: string; readonly source: string }>,
	options: { readonly cwd?: string } = {},
): Promise<GateResult> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	const eslint = makeEslint(cwd);
	const violations: GateViolation[] = [];
	for (const { file, source } of entries) {
		try {
			violations.push(...customPolicies(source, file, violation));
		} catch (error) {
			violations.push(violation(file, 'component-shape', (error as Error).message));
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
	return { files: entries.map((entry) => entry.file), policies: REACT_GATE_POLICIES, violations };
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
