import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import * as tsParser from '@typescript-eslint/parser';
import type { EnrichedIR } from '@frameless/compiler';
import { emit } from '../emitter/index.ts';
import { formatEmitted } from '../format-emitted.ts';
import { parse } from 'yuku-parser';
import { dirname, normalize, relative, resolve } from 'pathe';
import { customPolicies } from './custom-policies.ts';

export type DossierRef =
	| `T002 ruling ${number}`
	| `T004 §3.1 ${`R-${string}`}`
	| 'T002-persistence-architecture Decision 6';
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

function persistenceArtifactPolicy() {
	const policy = {
		id: 'persistence-render-lowering',
		dossierRef: 'T002-persistence-architecture Decision 6',
	} as const;
	Object.defineProperty(policy, 'requiresArtifact', { enumerable: false, value: true });
	return policy as typeof policy & { readonly requiresArtifact: true };
}

export const REACT_GATE_POLICIES = [
	{ id: 'eslint-directive', dossierRef: 'T002 ruling 10' },
	// Always evaluated (requiresArtifact is false): only a recorded relative-import
	// acceptance branch consults the optional artifact.
	{ id: 'undisclosed-import', dossierRef: 'T002 ruling 10' },
	{ id: 'react-import-allowlist', dossierRef: 'T002 ruling 2' },
	{ id: 'no-forwardRef', dossierRef: 'T002 ruling 8' },
	{ id: 'component-shape', dossierRef: 'T002 ruling 10' },
	{ id: 'explicit-static-attribute-value', dossierRef: 'T002 ruling 10' },
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
	persistenceArtifactPolicy(),
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
		else if (entry.isFile() && entry.name.endsWith('.tsx'))
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
	// `tsx`, NOT `jsx`. This gate reads EMITTED `.tsx`, which carries an IR-8 props
	// type annotation from `frameless-emitter-capability-v1` T014 onward. Measured
	// at yuku-parser/yuku-analyzer 0.7.0: `jsx` reports "Expected ')' to close
	// parameter list, but found ':'" on a typed props parameter, so a stale `jsx`
	// here turns VALID emitted output into a `component-shape` violation. T004
	// measured this refusal in both lanes; T005 repaired the qwik twin and carried
	// react and solid here.
	const parsed = parse(source, {
		lang: 'tsx',
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

function recordedRelativeImportSpecifiers(artifact: EnrichedIR | undefined): Set<string> {
	if (!artifact) return new Set();
	const externalTargets = new Set<string>();
	const inspect = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		const record = value as Record<string, unknown>;
		if (record.kind === 'component-reference') {
			const target = record.target as Record<string, unknown> | undefined;
			if (target && target.module !== 'self' && typeof target.module === 'string')
				externalTargets.add(target.module);
		}
		for (const child of Object.values(record)) {
			if (Array.isArray(child)) child.forEach(inspect);
			else inspect(child);
		}
	};
	inspect(artifact.components);
	return new Set(
		artifact.imports.flatMap((imported) => {
			if (
				imported.resolvesTo !== 'tsrx-module' ||
				!externalTargets.has(imported.source) ||
				!imported.source.startsWith('./') ||
				imported.source.includes('\\') ||
				!imported.source.endsWith('.tsrx')
			)
				return [];
			const basename = imported.source.slice(imported.source.lastIndexOf('/') + 1);
			// `.jsx`, NOT `.tsx`, and the emitted file it names is `X.tsx`. That is
			// deliberate and it is the TypeScript idiom, not a leftover: a specifier
			// ending `.tsx` is a hard error (TS5097) unless the CONSUMER enables
			// `allowImportingTsExtensions`, which also forces `noEmit`. A `.jsx`
			// specifier resolves to `X.tsx` under every module resolution this repo
			// or its consumers use - TypeScript substitutes the TS extension for the
			// JS one, and Vite does the same (`knownTsOutputRE` covers `.jsx`,
			// measured at vite 7.3.1, 7.3.6 and 8.0.16). Emitting `.jsx` therefore
			// keeps the output importable by a plain `tsc` consumer with no extra
			// flag. Mirrored in the emitter at src/emitter/index.ts.
			return [`./${basename.slice(0, -'.tsrx'.length)}.jsx`];
		}),
	);
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

const FORBIDDEN_PERSISTENCE_TASK_MARKER = /(?:visible|eager|effect|mount)/i;

function hasForbiddenPersistenceTaskMarker(value: unknown, path: readonly string[] = []): boolean {
	if (!value || typeof value !== 'object') return false;
	for (const [key, child] of Object.entries(value)) {
		const childPath = [...path, key];
		const markerPath = childPath.some((part) => /(?:lowering|task)/i.test(part));
		if (
			markerPath &&
			((typeof child === 'string' && FORBIDDEN_PERSISTENCE_TASK_MARKER.test(child)) ||
				(child === true && FORBIDDEN_PERSISTENCE_TASK_MARKER.test(key)))
		)
			return true;
		if (hasForbiddenPersistenceTaskMarker(child, childPath)) return true;
	}
	return false;
}

function persistenceLoweringViolations(
	file: string,
	artifact: EnrichedIR,
): GateViolation[] | undefined {
	const persistence = (artifact.records as { readonly persistence?: unknown }).persistence;
	if (!Array.isArray(persistence)) return undefined;
	const violations: GateViolation[] = [];
	for (const record of persistence) {
		if (!record || typeof record !== 'object') continue;
		const entry = record as Record<string, any>;
		if (entry.access?.render !== true) continue;
		const validPrePaintSeed =
			entry.seed?.lowering === 'pre-paint' &&
			Array.isArray(entry.seed.landings) &&
			entry.seed.landings.some((landing: unknown) => {
				const candidate = landing as Record<string, unknown> | null;
				return candidate?.target === 'react';
			});
		if (!validPrePaintSeed || hasForbiddenPersistenceTaskMarker(entry))
			violations.push(
				violation(
					file,
					'persistence-render-lowering',
					'Render-access persistence must use a React pre-paint seed landing and must not use an eager/visible/effect/mount task',
				),
			);
	}
	return violations;
}

function persistenceEffectViolations(source: string, file: string): GateViolation[] {
	const violations: GateViolation[] = [];
	const seedMarker = /(?=.*(?:persist|storage))(?=.*seed)/i;
	walkAst(parseModule(source), (node) => {
		if (
			node.type !== 'CallExpression' ||
			node.callee?.type !== 'Identifier' ||
			!['useEffect', 'useLayoutEffect'].includes(node.callee.name)
		)
			return;
		let readsPersistence = false;
		walkAst(node.arguments?.[0], (child) => {
			if (
				(child.type === 'CallExpression' &&
					child.callee?.type === 'MemberExpression' &&
					(child.callee.property?.name === 'getItem' ||
						child.callee.property?.value === 'getItem')) ||
				(child.type === 'Identifier' && seedMarker.test(child.name)) ||
				((child.type === 'Literal' || child.type === 'StringLiteral') &&
					typeof child.value === 'string' &&
					seedMarker.test(child.value))
			)
				readsPersistence = true;
		});
		if (readsPersistence)
			violations.push(
				violation(
					file,
					'persistence-render-lowering',
					'Persistence seed reads must not run in useEffect or useLayoutEffect',
					node,
				),
			);
	});
	return violations;
}

export async function discoverGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<string[]> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	return (await collectJsxFiles(cwd, options.directory ?? 'generated')).sort();
}

/**
 * `no-unused-vars` STAYS ON, AND THIS SUPPRESSES EXACTLY ONE PARSER ARTIFACT.
 *
 * MEASURED at eslint 9.39.5 with `@typescript-eslint/parser` 8.65.0. The parser's
 * scope manager registers the PARAMETER NAMES OF A FUNCTION TYPE as variables:
 * in `onTrace: (name: string, detail: Record<string, unknown>) => void` - the type
 * this lane prints from `frameless-emitter-capability-v1` T014 onward, read
 * straight from the authored annotation - `name` and `detail` are reported "is
 * defined but never used". THEY ARE NOT BINDINGS AT ALL. They are documentation
 * inside a type, they cannot be referenced, and TypeScript's own grammar has no
 * way to write that type without them.
 *
 * THE OBVIOUS KNOBS WERE MEASURED AND ALL OF THEM WEAKEN THE RULE. `args: 'none'`
 * silences the artifact AND a genuinely dead emitted parameter in the same
 * breath - measured on a probe carrying both, where it dropped the real report
 * too. `argsIgnorePattern` cannot be written: the pattern would have to match
 * every parameter name an author might ever write in a type.
 *
 * THE CORRECT INSTRUMENT IS `@typescript-eslint/no-unused-vars`, which exists
 * precisely because the base rule is not TypeScript-aware. It lives in
 * `@typescript-eslint/eslint-plugin`, WHICH RESOLVES FROM NO PACKAGE IN THIS
 * WORKSPACE - verified from all five framework lanes - so it is a new dependency
 * and a lockfile move, and that is recorded rather than taken.
 *
 * So this filter re-parses the SAME SOURCE WITH THE SAME PARSER, collects the
 * EXACT source positions of every function-type parameter name, and drops a
 * `no-unused-vars` message only when its position is one of them. It is a
 * position-exact match against the parser's own tree, not a message-text or
 * name-shaped heuristic: a real unused binding cannot occupy the same position
 * as a type parameter. `test/gate.test.ts` CALIBRATES it - a genuinely dead
 * emitted argument still reports - so this cannot silently become an off switch.
 */
function typeOnlyParameterPositions(source: string): Set<string> {
	const positions = new Set<string>();
	let tree: unknown;
	try {
		tree = (tsParser as unknown as { parse: (code: string, options: unknown) => unknown }).parse(
			source,
			{ ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module', loc: true },
		);
	} catch {
		// A source this parser cannot read is already an `eslint:parse` violation;
		// suppressing nothing is the fail-closed answer.
		return positions;
	}
	const TYPE_ONLY_SIGNATURES = new Set([
		'TSCallSignatureDeclaration',
		'TSConstructSignatureDeclaration',
		'TSConstructorType',
		'TSDeclareFunction',
		'TSEmptyBodyFunctionExpression',
		'TSFunctionType',
		'TSMethodSignature',
	]);
	const record = (parameter: unknown): void => {
		if (!parameter || typeof parameter !== 'object') return;
		const entry = parameter as Record<string, any>;
		if (entry.type === 'AssignmentPattern') return record(entry.left);
		if (entry.type === 'RestElement') return record(entry.argument);
		if (entry.type === 'ObjectPattern')
			return (entry.properties as unknown[]).forEach((property) =>
				record((property as Record<string, any>).value ?? property),
			);
		if (entry.type === 'ArrayPattern')
			return (entry.elements as unknown[]).forEach(record);
		if (entry.type === 'Identifier' && entry.loc?.start)
			positions.add(`${entry.loc.start.line}:${entry.loc.start.column + 1}`);
	};
	const visit = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) return value.forEach(visit);
		const node = value as Record<string, any>;
		if (TYPE_ONLY_SIGNATURES.has(String(node.type)) && Array.isArray(node.params))
			node.params.forEach(record);
		for (const [key, child] of Object.entries(node)) {
			if (key === 'parent' || key === 'loc' || key === 'range') continue;
			visit(child);
		}
	};
	visit(tree);
	return positions;
}

/** Drop the one `no-unused-vars` artifact described above; keep everything else. */
export function withoutTypeOnlyParameterReports<
	T extends { readonly ruleId?: string | null; readonly line?: number; readonly column?: number },
>(messages: readonly T[], source: string): T[] {
	if (!messages.some((message) => message.ruleId === 'no-unused-vars')) return [...messages];
	const positions = typeOnlyParameterPositions(source);
	if (positions.size === 0) return [...messages];
	return messages.filter(
		(message) =>
			message.ruleId !== 'no-unused-vars' ||
			!positions.has(`${message.line}:${message.column}`),
	);
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
				// MUST track the extension `discoverGeneratedFiles` collects. Flat
				// config lints only `**/*.{js,mjs,cjs}` unless a config entry names
				// another extension, so a stale glob here does not fail loudly - it
				// silently drops the parser options, globals and every rule below.
				files: ['**/*.tsx'],
				languageOptions: {
					// `@typescript-eslint/parser`, NOT espree, AND THE DEFAULT WAS
					// MEASURED REFUSING VALID OUTPUT. espree has no TypeScript
					// grammar at all: on the IR-8-typed props parameter this lane
					// prints from `frameless-emitter-capability-v1` T014 onward it
					// reports `eslint:parse` "Unexpected token :", so every rule
					// below would sit behind a parse failure. T004 measured that
					// refusal in this lane and stopped on it, because the parser was
					// not a dependency here; the owner authorised adding it at T014.
					//
					// NO `parserOptions.project`. This gate lints emitted output that
					// is deliberately outside every tsconfig in the repo, so a typed
					// rule would be silent by construction rather than by verdict -
					// the class the qwik gate's *_REQUIRING_TYPES list already
					// records. Parsing is all that is needed and all that is claimed.
					parser: tsParser as never,
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
			violations.push(
				...customPolicies(
					source,
					file,
					violation,
					recordedRelativeImportSpecifiers(artifact),
				),
			);
		} catch (error) {
			violations.push(violation(file, 'component-shape', (error as Error).message));
		}
		try {
			violations.push(...persistenceEffectViolations(source, file));
		} catch {
			// The main parser/custom-policy path reports malformed source.
		}
		if (artifact) {
			const persistenceViolations = persistenceLoweringViolations(file, artifact);
			if (persistenceViolations) violations.push(...persistenceViolations);
			else unevaluatedPolicies.add('persistence-render-lowering');
			violations.push(...(await provenanceViolations(source, file, artifact)));
		} else {
			// An artifact-less relative import is present but unverifiable. That is a
			// violation, not unevaluated: undisclosed-import itself always ran above.
			for (const policy of REACT_GATE_POLICIES)
				if ('requiresArtifact' in policy && policy.requiresArtifact)
					unevaluatedPolicies.add(policy.id);
		}
		const [result] = await eslint.lintText(source, {
			filePath: resolve(cwd, file),
			warnIgnored: false,
		});
		for (const message of withoutTypeOnlyParameterReports(result?.messages ?? [], source)) {
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
