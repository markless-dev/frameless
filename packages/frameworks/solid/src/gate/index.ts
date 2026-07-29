import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import solidPlugin from 'eslint-plugin-solid';
import globals from 'globals';
import * as tsParser from '@typescript-eslint/parser';
import type { EnrichedIR } from '@frameless/compiler';
import { emit } from '../emitter/index.ts';
import { formatEmitted } from '../format-emitted.ts';
import { parse } from 'yuku-parser';
import { dirname, normalize, relative, resolve } from 'pathe';
import { customPolicies } from './custom-policies.ts';

export type DossierRef =
	| `T003 ruling ${number}`
	| `T004 §3.2 ${`S-${string}`}`
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

function artifactPolicy<const Id extends 'S-CH5' | 'S-SH3' | 'S-SH4' | 'S-SH7' | 'S-RF5' | 'S-RF7'>(
	id: Id,
) {
	const policy = { id, dossierRef: `T004 §3.2 ${id}` as const };
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

/**
 * WHY THERE IS NO WHITESPACE POLICY IN THIS LIST. A RECORDED MEASUREMENT, NOT AN
 * OVERSIGHT. T038 ruling §4; T039 re-derived every number below at this tree.
 *
 * Its Vue and Angular siblings each carry a written whitespace policy, and this
 * file carried nothing - `grep -c -i whitespace` was 0 here and in
 * `custom-policies.ts`. The reader's natural inference from that silence is that
 * Solid is safe by analogy to React. THAT INFERENCE IS BACKWARDS. Solid is the
 * MOST aggressive of the six lanes, not the safest:
 *
 *   `one` U+0020 U+0020 `two`  ->  `one` U+0020 `two`   the run is condensed
 *   `one` U+00A0 `two`         ->  `one` U+0020 `two`   THE CHARACTER IS REWRITTEN
 *   `one` U+2009 `two`         ->  `one` U+0020 `two`   thin space, same
 *   `one` U+3000 `two`         ->  `one` U+0020 `two`   ideographic space, same
 *   `one` U+2007 `two`         ->  `one` U+0020 `two`   figure space, same
 *   `one` U+200B `two`         ->  U+200B SURVIVES      not `\s`; see below
 *
 * Measured through `babel-preset-solid` 1.9.12 at `generate: 'ssr'`, inputs built
 * with `String.fromCharCode` so nothing depends on what a shell did to a literal.
 *
 * READ THE LAST ROW CAREFULLY IF YOU RE-RUN THE PROBE. Solid emits U+200B into
 * the generated template literal as a six-character BACKSLASH-u ESCAPE rather
 * than as a raw character, so a byte comparison of the GENERATED SOURCE reports
 * a difference. It is a spelling of the same character, not a
 * rewrite: the literal evaluates back to U+200B. The four rows above are real
 * character substitutions in the same generated source, which is the difference
 * that matters. U+200B is not matched by `\s`, and the compiler rule does not
 * refuse it.
 *
 * The first row is the 3-3 split that vue and angular also sit on. The second is
 * a 5-1 split with SOLID ALONE: react, qwik, svelte, vue and angular all preserve
 * U+00A0 byte-for-byte, and solid substitutes a different character with different
 * semantics - the author's non-breaking guarantee is silently deleted. Vue and
 * Angular, the two lanes that DO condense runs, both preserve it.
 *
 * NO PREDICATE IS ADDED HERE, AND THAT IS THE RULING RATHER THAN A SHORTCUT.
 * The construct is refused UPSTREAM, at `packages/compiler/src/build.ts` in
 * `assertPortableInteriorWhitespace`, which rejects any static IR text node
 * containing two adjacent whitespace characters or any whitespace character that
 * is not U+0020. Stating the rule once at the single layer that sees the input to
 * all six lanes is what stops six gates re-deriving it six ways - and the two
 * gates that DID state it read already-condensed ASTs, so a widened predicate
 * there would not even fire. Adding one here would be a fourth restatement of a
 * rule the compiler now enforces for every lane including this one.
 *
 * The existing edge-whitespace policies elsewhere are correct and unaffected:
 * they guard a text node whose OWN EDGES are whitespace, which Solid does
 * preserve, and which the compiler deliberately does not refuse.
 *
 * Ledger: `docs/DEFECTS.md` entry 7 (OPEN), with the lift trigger and the
 * registered six-lane matrix test that re-opens the ruling if any lane moves.
 */
export const SOLID_GATE_POLICIES = [
	{ id: 'eslint-directive', dossierRef: 'T003 ruling 10' },
	// Always evaluated (requiresArtifact is false): only a recorded relative-import
	// acceptance branch consults the optional artifact.
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
	persistenceArtifactPolicy(),
	{ id: 'S-CH1', dossierRef: 'T004 §3.2 S-CH1' },
	{ id: 'S-CH2', dossierRef: 'T004 §3.2 S-CH2' },
	{ id: 'S-CH3', dossierRef: 'T004 §3.2 S-CH3' },
	{ id: 'S-CH4', dossierRef: 'T004 §3.2 S-CH4' },
	artifactPolicy('S-CH5'),
	{ id: 'S-SH1', dossierRef: 'T004 §3.2 S-SH1' },
	{ id: 'S-SH2', dossierRef: 'T004 §3.2 S-SH2' },
	artifactPolicy('S-SH3'),
	artifactPolicy('S-SH4'),
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

type AliasValue = {
	readonly constructsShared: boolean;
	readonly factory: boolean;
	readonly callable?: AstNode;
	readonly properties?: ReadonlyMap<string, AliasValue>;
};
const EMPTY_ALIAS: AliasValue = { constructsShared: false, factory: false };

function containerCreatorNames(program: AstNode): Set<string> {
	const functionNames = new Set<string>();
	for (const statement of program.body ?? []) {
		const declaration =
			statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
		if (declaration?.type !== 'FunctionDeclaration' || !declaration.id?.name) continue;
		let provider = false;
		walkAst(declaration.body, (node) => {
			if (
				node.type === 'JSXMemberExpression' &&
				node.property?.type === 'JSXIdentifier' &&
				node.property.name === 'Provider'
			)
				provider = true;
		});
		if (!provider) continue;
		walkAst(declaration.body, (node) => {
			if (
				node.type === 'CallExpression' &&
				node.callee?.type === 'Identifier' &&
				/^create.+Shared\d*$/.test(node.callee.name)
			)
				functionNames.add(node.callee.name);
		});
	}
	return functionNames;
}

function providerCount(program: AstNode): number {
	let count = 0;
	walkAst(program, (node) => {
		if (
			node.type === 'JSXMemberExpression' &&
			node.property?.type === 'JSXIdentifier' &&
			node.property.name === 'Provider'
		)
			count += 1;
	});
	return count;
}

function moduleConstructsShared(program: AstNode, creators: ReadonlySet<string>): boolean {
	const environment = new Map<string, AliasValue>(
		[...creators].map((name) => [name, { constructsShared: false, factory: true }]),
	);
	const evaluate = (
		node: AstNode | null | undefined,
		scope: ReadonlyMap<string, AliasValue>,
		depth = 0,
	): AliasValue => {
		if (!node || depth > 24) return EMPTY_ALIAS;
		if (node.type === 'Identifier') return scope.get(node.name) ?? EMPTY_ALIAS;
		if (node.type === 'ObjectExpression') {
			const properties = new Map<string, AliasValue>();
			let constructsShared = false;
			for (const property of node.properties ?? []) {
				if (property.type !== 'Property' || property.computed) continue;
				const name = property.key?.name ?? property.key?.value;
				if (typeof name !== 'string') continue;
				const value = evaluate(property.value, scope, depth + 1);
				properties.set(name, value);
				constructsShared ||= value.constructsShared;
			}
			return { constructsShared, factory: false, properties };
		}
		if (node.type === 'MemberExpression' && !node.computed) {
			const owner = evaluate(node.object, scope, depth + 1);
			const name = node.property?.name;
			const member = typeof name === 'string' ? owner.properties?.get(name) : undefined;
			return member
				? { ...member, constructsShared: owner.constructsShared || member.constructsShared }
				: { ...EMPTY_ALIAS, constructsShared: owner.constructsShared };
		}
		if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression')
			return { constructsShared: false, factory: false, callable: node };
		if (node.type === 'CallExpression') {
			const callee = evaluate(node.callee, scope, depth + 1);
			const arguments_ = (node.arguments ?? []).map((argument: AstNode) =>
				evaluate(argument, scope, depth + 1),
			);
			const argumentConstruction = arguments_.some(
				(value: AliasValue) => value.constructsShared,
			);
			if (callee.factory) return { constructsShared: true, factory: false };
			if (callee.callable) {
				const callScope = new Map(scope);
				for (const [index, parameter] of (callee.callable.params ?? []).entries())
					if (parameter.type === 'Identifier')
						callScope.set(parameter.name, arguments_[index] ?? EMPTY_ALIAS);
				const body = callee.callable.body;
				const returned =
					body.type === 'BlockStatement'
						? body.body.find(
								(statement: AstNode) => statement.type === 'ReturnStatement',
							)?.argument
						: body;
				const result = evaluate(returned, callScope, depth + 1);
				return {
					...result,
					constructsShared:
						callee.constructsShared || argumentConstruction || result.constructsShared,
				};
			}
			return {
				constructsShared: callee.constructsShared || argumentConstruction,
				factory: false,
			};
		}
		return EMPTY_ALIAS;
	};
	for (const statement of program.body ?? []) {
		const declaration =
			statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
		if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name) {
			if (!creators.has(declaration.id.name))
				environment.set(declaration.id.name, {
					constructsShared: false,
					factory: false,
					callable: declaration,
				});
			continue;
		}
		if (declaration?.type !== 'VariableDeclaration') continue;
		for (const variable of declaration.declarations ?? []) {
			if (variable.id?.type !== 'Identifier') continue;
			const value = evaluate(variable.init, environment);
			environment.set(variable.id.name, value);
			if (value.constructsShared) return true;
		}
	}
	return false;
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
			// `.jsx`, NOT `.tsx`, and the emitted file it names is `X.tsx`. Same
			// ruling as the React gate: a `.tsx` specifier is TS5097 unless the
			// CONSUMER turns on `allowImportingTsExtensions`, while a `.jsx`
			// specifier resolves to `X.tsx` under TypeScript's JS-to-TS extension
			// substitution and under Vite's (`knownTsOutputRE` covers `.jsx` at
			// 7.3.1, 7.3.6 and 8.0.16). Mirrored in src/emitter/index.ts.
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
	const actualProgram = parseModule(actual);
	const expectedProgram = parseModule(expected);
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
	if (artifact.records.sharedDefinitions.some((entry) => entry.scope !== 'page')) {
		const creators = containerCreatorNames(expectedProgram);
		if (
			providerCount(actualProgram) !== providerCount(expectedProgram) ||
			moduleConstructsShared(actualProgram, creators)
		)
			violations.push(
				violation(
					file,
					'S-SH4',
					'Container/request shared construction must remain provider-owned and below module scope',
				),
			);
	}
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
				return candidate?.target === 'solid';
			});
		if (!validPrePaintSeed || hasForbiddenPersistenceTaskMarker(entry))
			violations.push(
				violation(
					file,
					'persistence-render-lowering',
					'Render-access persistence must use a Solid pre-paint seed landing and must not use an eager/visible/effect/mount task',
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
			!['createEffect', 'onMount'].includes(node.callee.name)
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
					'Persistence seed reads must not run in createEffect or onMount',
					node,
				),
			);
	});
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
		else if (entry.isFile() && entry.name.endsWith('.tsx'))
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
		}
		else {
			// An artifact-less relative import is present but unverifiable. That is a
			// violation, not unevaluated: undisclosed-import itself always ran above.
			for (const policy of SOLID_GATE_POLICIES)
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
