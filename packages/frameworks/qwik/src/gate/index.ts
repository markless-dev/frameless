import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import qwikPlugin from 'eslint-plugin-qwik';
import globals from 'globals';
import type { EnrichedIR } from '@frameless/compiler';
import { dirname, normalize, relative, resolve } from 'pathe';

export type DossierRef =
	| 'T002-qwik-architecture D8'
	// Qwik output previously received only generic checks while React and Solid
	// were gated by their frameworks' own eslint plugins. T003 Ruling 2 of
	// frameless-testing-ci-v1 closed that asymmetry.
	| 'frameless-testing-ci-v1 T003 ruling 2'
	// Cancellation must ride a synchronously resolvable QRL, not a lazily fetched
	// one. T015 ruling 4 of frameless-defects-and-targets-v1, implemented by that
	// goal's T003.
	| 'frameless-defects-and-targets-v1 T015 ruling 4';
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

function persistenceArtifactPolicy() {
	const policy = {
		id: 'persistence-render-lowering',
		dossierRef: 'T002-qwik-architecture D8',
	} as const;
	Object.defineProperty(policy, 'requiresArtifact', { enumerable: false, value: true });
	return policy as typeof policy & { readonly requiresArtifact: true };
}

/**
 * Qwik's own lint rules, applied to emitted output. These are a THIRD-PARTY
 * arbiter: unlike the custom policies above, they encode what the Qwik team
 * considers correct rather than what we decided. `valid-lexical-scope` is the
 * one that matters most for a resumable emitter - it catches non-serializable
 * values captured across a QRL boundary, which is the defining failure mode of
 * generated Qwik code and which nothing else in this repo checks.
 */
export const QWIK_ESLINT_RULES = {
	'qwik/use-method-usage': 'error',
	'qwik/no-react-props': 'error',
	'qwik/jsx-key': 'error',
	'qwik/jsx-no-script-url': 'error',
	'qwik/no-use-visible-task': 'error',
	'qwik/scope-use-task': 'error',
	'qwik/no-async-prevent-default': 'error',
	'qwik/prefer-classlist': 'error',
	'qwik/serializer-signal-usage': 'error',
	'qwik/unused-server': 'error',
	'qwik/jsx-img': 'error',
	'qwik/jsx-a': 'error',
} as const;

/**
 * Qwik rules that require TYPE INFORMATION and therefore cannot run against
 * plain emitted `.jsx`: they need @typescript-eslint/parser with a project.
 *
 * `valid-lexical-scope` is the costly omission - it is the rule that catches
 * non-serializable values captured across a QRL boundary, the defining failure
 * mode of generated resumable code. It is recorded here rather than silently
 * dropped so the gap is visible.
 *
 * Unblocked by T011 (per-package tsconfigs covering emitted output): once
 * emitted code is type-checkable, typed linting becomes available and these
 * two should move into QWIK_ESLINT_RULES above.
 */
export const QWIK_ESLINT_RULES_REQUIRING_TYPES = [
	'qwik/valid-lexical-scope',
	'qwik/use-async-top',
] as const;

/** A JSX event prop. The `$` suffix is deliberately not required - see below. */
const EVENT_PROP = /^on[A-Z]/;

function jsxAttributeName(name: Record<string, any> | undefined): string {
	if (!name) return '';
	if (name.type === 'JSXNamespacedName')
		return `${name.namespace?.name ?? ''}:${name.name?.name ?? ''}`;
	return typeof name.name === 'string' ? name.name : '';
}

/**
 * FRAMELESS-OWNED. Rejects `preventDefault()` inside an emitted event handler
 * unless the call sits in a `sync$()` QRL.
 *
 * WHAT IT KEYS ON: which KIND of QRL the call lands in. A `sync$()` QRL is
 * serialized inline into the HTML and the loader resolves it without a network
 * round trip, so it runs during dispatch and `preventDefault()` works. Every
 * other QRL under an event prop is fetched lazily, so by the time it runs the
 * browser has already performed the default action.
 *
 * WHAT IT DELIBERATELY DOES NOT KEY ON:
 *
 * 1. NOT `$()`. Qwik's own `no-async-prevent-default` walks ancestors for a
 *    `CallExpression` whose callee is the identifier `$`, so
 *    `onClick$={(e) => e.preventDefault()}` never trips it. Frameless emits raw
 *    handlers (frameless-idiom-policy-v1) and the optimizer turns them into
 *    QRLs regardless. See docs/goals/frameless-defects-and-targets-v1/notes/
 *    T003-upstream-eslint-qwik.md.
 * 2. NOT `async`. T002 witnessed a fully SYNCHRONOUS emitted handler -
 *    `onClick$={(event) => { event.preventDefault(); }}` - fail behaviourally,
 *    because the QRL segment carrying it was still being fetched when the
 *    browser ran the default action. `async` is not the cause and is not the
 *    test; keying on it would reproduce upstream's blind spot here.
 *
 * Both properties are pinned by mutation tests in test/gate.test.ts.
 */
const framelessQwikPlugin = {
	rules: {
		'no-handler-prevent-default': {
			meta: {
				type: 'problem',
				schema: [],
				messages: {
					noHandlerPreventDefault:
						'Emitted Qwik event handler {{attribute}} calls preventDefault() outside a sync$() QRL. A lazily fetched QRL runs after the browser has already performed the default action - regardless of whether the handler is async or wrapped in $(). Split the cancellation into a leading sync$() QRL, which is serialized inline and runs during dispatch.',
				},
			},
			create(context: Record<string, any>) {
				return {
					"CallExpression[callee.type='MemberExpression'][callee.property.name='preventDefault']"(
						node: Record<string, any>,
					) {
						const ancestors: Array<Record<string, any>> =
							context.sourceCode.getAncestors(node);
						for (let index = ancestors.length - 1; index >= 0; index -= 1) {
							const ancestor = ancestors[index]!;
							// A sync$() QRL between the call and the event prop is the
							// supported, synchronous channel. Stop: this call is fine.
							if (
								ancestor.type === 'CallExpression' &&
								ancestor.callee?.type === 'Identifier' &&
								ancestor.callee.name === 'sync$'
							)
								return;
							if (ancestor.type !== 'JSXAttribute') continue;
							const attribute = jsxAttributeName(ancestor.name);
							if (!EVENT_PROP.test(attribute)) return;
							context.report({
								node,
								messageId: 'noHandlerPreventDefault',
								data: { attribute },
							});
							return;
						}
					},
				};
			},
		},
	},
};

export const FRAMELESS_ESLINT_RULES = {
	'frameless/no-handler-prevent-default': 'error',
} as const;

const ESLINT_POLICIES = Object.keys(QWIK_ESLINT_RULES).map((rule) => ({
	id: `eslint:${rule}`,
	dossierRef: 'frameless-testing-ci-v1 T003 ruling 2' as const,
}));

export const QWIK_GATE_POLICIES = [
	{ id: 'no-visible-task', dossierRef: 'T002-qwik-architecture D8' },
	persistenceArtifactPolicy(),
	{
		id: 'frameless/no-handler-prevent-default',
		dossierRef: 'frameless-defects-and-targets-v1 T015 ruling 4',
	},
	...ESLINT_POLICIES,
] as const satisfies readonly GatePolicy[];

let cachedEslint: ESLint | undefined;
function makeEslint(): ESLint {
	cachedEslint ??= new ESLint({
		overrideConfigFile: true,
		allowInlineConfig: false,
		overrideConfig: [
			eslintJs.configs.recommended,
			{
				files: ['**/*.jsx'],
				plugins: {
					qwik: qwikPlugin as never,
					frameless: framelessQwikPlugin as never,
				},
				languageOptions: {
					ecmaVersion: 'latest',
					sourceType: 'module',
					parserOptions: { ecmaFeatures: { jsx: true } },
					globals: globals.browser,
				},
				rules: { ...QWIK_ESLINT_RULES, ...FRAMELESS_ESLINT_RULES } as never,
			},
		],
	});
	return cachedEslint;
}

/**
 * `eslint:` marks a THIRD-PARTY arbiter. Frameless-owned rules run through the
 * same parser but keep their own id so the distinction survives in the report.
 */
function eslintPolicyId(ruleId: string | null | undefined): string {
	if (ruleId?.startsWith('frameless/')) return ruleId;
	return `eslint:${ruleId ?? 'parse'}`;
}

async function eslintViolations(file: string, source: string): Promise<GateViolation[]> {
	const [result] = await makeEslint().lintText(source, { filePath: resolve(PACKAGE_ROOT, file) });
	return (result?.messages ?? []).map((message) =>
		violation(file, eslintPolicyId(message.ruleId), message.message, message.line ?? null),
	);
}

const POLICIES = new Map<string, GatePolicy>(
	QWIK_GATE_POLICIES.map((policy) => [policy.id, policy]),
);

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const VISIBLE_LIFECYCLE_MARKER =
	/\buseVisibleTask\$(?![\w$])|\bonQVisible\$(?![\w$])|q-e:qvisible|on:qvisible/g;

function violation(
	file: string,
	policy: string,
	message: string,
	line: number | null = null,
): GateViolation {
	return {
		file,
		policy,
		dossierRef: POLICIES.get(policy)?.dossierRef ?? 'T002-qwik-architecture D8',
		message,
		line,
	};
}

function visibleTaskViolations(file: string, source: string): GateViolation[] {
	return [...source.matchAll(VISIBLE_LIFECYCLE_MARKER)].map((match) =>
		violation(
			file,
			'no-visible-task',
			`Emitted Qwik source must not contain the eager visible-lifecycle marker ${JSON.stringify(match[0])}`,
			source.slice(0, match.index).split('\n').length,
		),
	);
}

function persistenceViolations(
	file: string,
	artifact: EnrichedIR,
): GateViolation[] | undefined {
	const persistence = (artifact.records as { readonly persistence?: unknown }).persistence;
	if (!Array.isArray(persistence)) return undefined;
	if (persistence.length === 0) return [];
	return [
		violation(
			file,
			'persistence-render-lowering',
			'Qwik v2 emission fails closed on persistence-bearing IR because Qwik has no PersistenceLanding',
		),
	];
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

export async function checkSources(
	entries: ReadonlyArray<{
		readonly file: string;
		readonly source: string;
		readonly artifact?: EnrichedIR;
	}>,
	_options: { readonly cwd?: string } = {},
): Promise<GateResult> {
	const violations: GateViolation[] = [];
	const unevaluatedPolicies = new Set<string>();
	for (const { file, source, artifact } of entries) {
		violations.push(...visibleTaskViolations(file, source));
		violations.push(...(await eslintViolations(file, source)));
		if (artifact) {
			const artifactViolations = persistenceViolations(file, artifact);
			if (artifactViolations) violations.push(...artifactViolations);
			else unevaluatedPolicies.add('persistence-render-lowering');
		} else {
			unevaluatedPolicies.add('persistence-render-lowering');
		}
	}
	const result = {
		files: entries.map((entry) => entry.file),
		policies: QWIK_GATE_POLICIES,
		violations,
	} as unknown as GateResult;
	Object.defineProperty(result, 'unevaluated', {
		enumerable: false,
		value: [...unevaluatedPolicies].map((policy) => ({
			policy,
			reason: 'requires-artifact',
		})),
	});
	return result;
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
