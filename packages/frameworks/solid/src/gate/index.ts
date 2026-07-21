import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import solidPlugin from 'eslint-plugin-solid';
import globals from 'globals';
import type { EnrichedIR } from '@frameless/compiler';
import { emit } from '../emitter/index.ts';
import { formatEmitted } from '../format-emitted.ts';
import { parse } from 'yuku-parser';
import { dirname, normalize, relative, resolve } from 'pathe';
import { customPolicies } from './custom-policies.ts';

export type DossierRef = `T003 ruling ${number}` | `T004 §3.2 ${`S-${string}`}`;
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

function artifactPolicy<const Id extends 'S-CH5' | 'S-SH3' | 'S-SH7' | 'S-RF5' | 'S-RF7'>(id: Id) {
	const policy = { id, dossierRef: `T004 §3.2 ${id}` as const };
	Object.defineProperty(policy, 'requiresArtifact', { enumerable: false, value: true });
	return policy as typeof policy & { readonly requiresArtifact: true };
}

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
	{ id: 'S-CH1', dossierRef: 'T004 §3.2 S-CH1' },
	{ id: 'S-CH2', dossierRef: 'T004 §3.2 S-CH2' },
	{ id: 'S-CH3', dossierRef: 'T004 §3.2 S-CH3' },
	{ id: 'S-CH4', dossierRef: 'T004 §3.2 S-CH4' },
	artifactPolicy('S-CH5'),
	{ id: 'S-SH1', dossierRef: 'T004 §3.2 S-SH1' },
	{ id: 'S-SH2', dossierRef: 'T004 §3.2 S-SH2' },
	artifactPolicy('S-SH3'),
	{ id: 'S-SH4', dossierRef: 'T004 §3.2 S-SH4' },
	{ id: 'S-SH5', dossierRef: 'T004 §3.2 S-SH5' },
	{ id: 'S-SH6', dossierRef: 'T004 §3.2 S-SH6' },
	artifactPolicy('S-SH7'),
	{ id: 'S-RF1', dossierRef: 'T004 §3.2 S-RF1' },
	{ id: 'S-RF2', dossierRef: 'T004 §3.2 S-RF2' },
	{ id: 'S-RF3', dossierRef: 'T004 §3.2 S-RF3' },
	{ id: 'S-RF4', dossierRef: 'T004 §3.2 S-RF4' },
	artifactPolicy('S-RF5'),
	{ id: 'S-RF6', dossierRef: 'T004 §3.2 S-RF6' },
	artifactPolicy('S-RF7'),
	{ id: 'eslint:no-unused-vars', dossierRef: 'T003 ruling 10' },
	{ id: 'eslint:no-unused-expressions', dossierRef: 'T003 ruling 9' },
	{ id: 'eslint:no-unreachable', dossierRef: 'T003 ruling 9' },
] as const satisfies readonly GatePolicy[];

const POLICIES = new Map<string, GatePolicy>(
	SOLID_GATE_POLICIES.map((policy) => [policy.id, policy]),
);
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
			.filter((entry) => !(entry?.type === 'JSXText' && /^\s*$/.test(entry.value)))
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
function moduleSharedCount(source: string): number {
	const program = parseModule(source);
	const creators = new Set<string>();
	for (const statement of program.body ?? [])
		if (
			statement.type === 'FunctionDeclaration' &&
			/^create.+Shared\d*$/.test(statement.id?.name ?? '')
		)
			creators.add(statement.id.name);
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
		if (record.kind === 'component-reference' || record.kind === 'default-slot-projection')
			found = true;
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
	if (
		artifact.records.sharedDefinitions.some((entry) => entry.scope === 'page') &&
		moduleSharedCount(actual) !== moduleSharedCount(expected)
	)
		violations.push(
			violation(
				file,
				'S-SH3',
				'Page shared lowering does not match the artifact-recorded module singleton',
			),
		);
	if (
		hasProjectionProvenance(artifact) &&
		jsxSignatures(actual).join('\0') !== jsxSignatures(expected).join('\0')
	)
		violations.push(
			violation(
				file,
				'S-CH5',
				'Component-reference or projection output differs from the artifact',
			),
		);
	if (
		artifact.records.sharedWrites.length + artifact.records.sharedCalls.length > 0 &&
		actual !== expected
	)
		violations.push(
			violation(
				file,
				'S-SH7',
				'Shared writes or calls differ from the artifact-recorded authored sequence',
			),
		);
	if (artifact.records.behaviors.length > 0 && actual !== expected) {
		violations.push(
			violation(
				file,
				'S-RF5',
				'Emitted directives do not completely consume the artifact behavior records',
			),
		);
		violations.push(
			violation(
				file,
				'S-RF7',
				'Directive cleanup order differs from the artifact-recorded reverse order',
			),
		);
	}
	return violations;
}

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
					'no-unused-vars': [
						'error',
						{
							argsIgnorePattern: '^(?:_|props\\d*$)',
							varsIgnorePattern: '^(?:_|set\\p{Lu})',
						},
					],
					'no-unused-expressions': 'error',
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
		if (artifact) violations.push(...(await provenanceViolations(source, file, artifact)));
		else
			for (const policy of SOLID_GATE_POLICIES)
				if ('requiresArtifact' in policy && policy.requiresArtifact)
					unevaluatedPolicies.add(policy.id);
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
		policies: SOLID_GATE_POLICIES,
		violations,
	} as unknown as GateResult;
	Object.defineProperty(gateResult, 'unevaluated', {
		enumerable: false,
		value: [...unevaluatedPolicies].map((policy) => ({ policy, reason: 'requires-artifact' })),
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
