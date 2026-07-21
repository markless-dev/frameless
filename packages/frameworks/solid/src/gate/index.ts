import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import solidPlugin from 'eslint-plugin-solid';
import globals from 'globals';
import { dirname, normalize, relative, resolve } from 'pathe';
import { customPolicies } from './custom-policies.ts';

export type DossierRef = `T003 ruling ${number}`;
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

export const SOLID_GATE_POLICIES = [
	{ id: 'eslint-directive', dossierRef: 'T003 ruling 10' },
	{ id: 'undisclosed-import', dossierRef: 'T003 ruling 10' },
	{ id: 'solid-import-allowlist', dossierRef: 'T003 ruling 10' },
	{ id: 'cell-type', dossierRef: 'T003 ruling 1' },
	{ id: 'signal-write-shape', dossierRef: 'T003 ruling 1' },
	{ id: 'store-write-shape', dossierRef: 'T003 ruling 1' },
	{ id: 'structural-ternary', dossierRef: 'T003 ruling 5' },
	{ id: 'show-two-arm', dossierRef: 'T003 ruling 5' },
	{ id: 'controlled-input', dossierRef: 'T003 ruling 7' },
	{ id: 'collection-accessor-in-row', dossierRef: 'T003 ruling 3' },
	{ id: 'stop-propagation', dossierRef: 'T003 ruling 6' },
	{ id: 'props-destructure', dossierRef: 'T003 ruling 8' },
	{ id: 'untrack-once-capture', dossierRef: 'T003 ruling 8' },
	{ id: 'untrack-capture-shape', dossierRef: 'T003 ruling 8' },
	{ id: 'reconcile-key', dossierRef: 'T003 ruling 4' },
	{ id: 'react-specific-props', dossierRef: 'T003 ruling 10' },
	{ id: 'component-shape', dossierRef: 'T003 ruling 10' },
	{ id: 'index-accessor', dossierRef: 'T003 ruling 4' },
	{ id: 'map-render', dossierRef: 'T003 ruling 4' },
	{ id: 'render-phase-setter', dossierRef: 'T003 ruling 1' },
	{ id: 'render-phase-effect', dossierRef: 'T003 ruling 2' },
	{ id: 'prevent-default-event', dossierRef: 'T003 ruling 6' },
	{ id: 'leaf-event-target', dossierRef: 'T003 ruling 7' },
	{ id: 'eslint:no-unused-vars', dossierRef: 'T003 ruling 10' },
	{ id: 'eslint:no-unused-expressions', dossierRef: 'T003 ruling 9' },
	{ id: 'eslint:no-unreachable', dossierRef: 'T003 ruling 9' },
] as const satisfies readonly GatePolicy[];

const POLICIES = new Map<string, GatePolicy>(
	SOLID_GATE_POLICIES.map((policy) => [policy.id, policy]),
);
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function dossierRefFor(policy: string): DossierRef {
	const direct = POLICIES.get(policy)?.dossierRef;
	if (direct) return direct;
	if (policy === 'eslint:solid/no-destructure' || policy === 'eslint:solid/reactivity')
		return 'T003 ruling 8';
	if (policy === 'eslint:solid/prefer-for') return 'T003 ruling 4';
	if (policy === 'eslint:solid/components-return-once' || policy === 'eslint:solid/prefer-show')
		return 'T003 ruling 5';
	if (policy === 'eslint:solid/no-react-specific-props') return 'T003 ruling 10';
	return 'T003 ruling 10';
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

export async function discoverGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<string[]> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	return (await collectJsxFiles(cwd, options.directory ?? 'generated')).sort();
}

function makeEslint(cwd: string): ESLint {
	const plugin = solidPlugin as unknown as {
		configs?: Record<string, any>;
		default?: { configs?: Record<string, any> };
	};
	const recommended = (plugin.configs ?? plugin.default?.configs)?.['flat/recommended'];
	if (!recommended) throw new Error('eslint-plugin-solid flat recommended config is unavailable');
	return new ESLint({
		cwd,
		overrideConfigFile: true,
		allowInlineConfig: false,
		overrideConfig: [
			eslintJs.configs.recommended,
			...(Array.isArray(recommended) ? recommended : [recommended]),
			{
				files: ['**/*.jsx'],
				languageOptions: {
					ecmaVersion: 'latest',
					sourceType: 'module',
					parserOptions: { ecmaFeatures: { jsx: true } },
					globals: globals.browser,
				},
				rules: {
					'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
					'no-unused-expressions': 'error',
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
	return { files: entries.map((entry) => entry.file), policies: SOLID_GATE_POLICIES, violations };
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
