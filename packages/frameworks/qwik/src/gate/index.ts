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
	| 'frameless-defects-and-targets-v1 T015 ruling 4'
	// A sync$() QRL may close over NOTHING. T011 §4.2 of
	// frameless-defects-and-targets-v1 ruled this must be PROVED by scope
	// analysis rather than sniffed for by name, and §4.1 hardened the sibling
	// rule to direct-position sync$ and to both declared action names.
	| 'frameless-defects-and-targets-v1 T011 ruling 4';
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
 *
 * THIS SET IS NOW TOTAL over `configs.recommended`: every rule upstream
 * recommends is either applied here or named in
 * `QWIK_ESLINT_RULES_REQUIRING_TYPES` below with the reason it cannot run.
 * `test/gate.test.ts` asserts that in BOTH directions - see
 * `QWIK_ESLINT_RECOMMENDED_RULES`.
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
	// ADDED BY T029, and they are an ADDITIONS-ONLY delta on purpose: a change
	// that only adds arbiter rules cannot be used to make a corpus green.
	//
	// Both sat in `configs.recommended` and in NEITHER list below it - dropped
	// with no recorded reason, which is precisely what the omission list exists to
	// make impossible. Found by the Angular T003a Judge while ruling on arbiter
	// independence.
	//
	// MEASURED BEFORE APPLYING, per the charter's proof-before-fix. Both are
	// PURELY SYNTACTIC at 2.0.0-beta.38 - no type information, no `@qwik.dev/router`
	// dependency, no Qwik City app - so the "cannot run" reason that covers the two
	// rules below does not cover these. `loader-location` keys on a callee name in
	// {loader$, routeLoader$, routeAction$, routeHandler$, action$, globalAction$}
	// plus a path test against `routesDir`; `no-await-navigate-in-use-task` keys on
	// `await <binding>()` inside a `useTask$`/`useTaskQrl` body where the binding
	// came from `useNavigate()`, unless that task opted out with
	// `{ deferUpdates: false }`. Both report ZERO messages across the entire shipped
	// `generated/` corpus, and both go RED on a planted violation - watched in
	// "MUTATION: Qwik lint policies reject violating emitted source". Silent but
	// CAPABLE is a reason to apply, not a reason to omit.
	//
	// `loader-location` earns its keep here specifically: emitted components are
	// library modules, never route boundary files, so a `routeLoader$` reaching
	// emitted output would ALWAYS be misplaced - and this emitter fails closed on
	// persistence-bearing IR rather than emitting one today.
	'qwik/loader-location': 'error',
	'qwik/no-await-navigate-in-use-task': 'error',
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

/**
 * UPSTREAM'S OWN INVENTORY, read off the plugin at runtime rather than
 * transcribed. Transcribing would freeze the set at the version that was read,
 * which is the same failure the omission list prevents, one level up.
 *
 * `eslint-plugin-qwik` PUBLISHES `configs.recommended`, so unlike the Angular
 * lane - which must derive its applied set from per-rule
 * `meta.docs.recommended` because `@angular-eslint` ships no configs at all -
 * there is a third-party-authored list here to measure against directly.
 *
 * DO NOT SUBSTITUTE per-rule `meta.docs.recommended` FOR THIS. Measured at
 * 2.0.0-beta.38 it carries six different shapes across the 16 rules - `true`,
 * `'recommended'`, `'warn'`, `'error'`, `false` and `undefined` - and two rules
 * that ARE in `configs.recommended` (`prefer-classlist`, `use-async-top`)
 * declare `recommended: false`. A metadata derivation would therefore drop rules
 * upstream recommends. The published config is the only coherent source here,
 * and the Angular precedent transfers as a PRINCIPLE (measure against something
 * upstream authored) rather than as a mechanism.
 *
 * WHY THE APPLIED SET IS STILL A LITERAL RATHER THAN DERIVED FROM THIS.
 * Deriving it would let a rule added in a future plugin release enter this gate
 * UNMEASURED - proof-before-fix inverted. A new upstream rule must be run
 * against the corpus first, then applied, or omitted with its reason recorded.
 * So the literal stays, and `test/gate.test.ts` asserts that applied plus
 * omitted equals this list in BOTH directions. A plugin upgrade that adds or
 * removes a rule then turns that test RED and forces the measurement, instead of
 * diverging in silence - which is exactly how the two rules T029 recovered went
 * missing in the first place.
 */
export const QWIK_ESLINT_RECOMMENDED_RULES: readonly string[] = (() => {
	const configs = (qwikPlugin as { readonly configs?: Readonly<Record<string, unknown>> })
		?.configs;
	const recommended = configs?.recommended as
		| { readonly rules?: Readonly<Record<string, unknown>> }
		| undefined;
	const ids = Object.keys(recommended?.rules ?? {});
	// Fail LOUD rather than returning []. An empty inventory would make the
	// divergence assertion agree with ANY applied set at all - the one way this
	// check could end up weaker than having no check.
	if (ids.length === 0)
		throw new Error(
			'eslint-plugin-qwik exposed no configs.recommended.rules, so the upstream inventory ' +
				"that this gate's applied set and omission list are measured against has moved",
		);
	return ids;
})();

/** A JSX event prop. The `$` suffix is deliberately not required - see below. */
const EVENT_PROP = /^on[A-Z]/;

function jsxAttributeName(name: Record<string, any> | undefined): string {
	if (!name) return '';
	if (name.type === 'JSXNamespacedName')
		return `${name.namespace?.name ?? ''}:${name.name?.name ?? ''}`;
	return typeof name.name === 'string' ? name.name : '';
}

function isSyncQrlCall(node: Record<string, any> | undefined): boolean {
	return Boolean(
		node &&
			node.type === 'CallExpression' &&
			node.callee?.type === 'Identifier' &&
			node.callee.name === 'sync$',
	);
}

/**
 * Is the `sync$()` call at `ancestors[index]` in DIRECT position under a JSX
 * event prop - either the value of the prop's expression container, or a direct
 * element of the array that is that value?
 *
 * This is the T005 hardening item, ruled on in T011 §4.1. The previous walk
 * asked only "is there a sync$ between the call and the prop", which ALLOWED a
 * `sync$()` created INSIDE a lazily fetched QRL. Such a sync$ is constructed
 * long after dispatch, so its `preventDefault()` is exactly as ineffective as
 * the shape this rule exists to reject. Both shapes were measured silent before
 * this change.
 */
function syncQrlIsDirect(ancestors: Array<Record<string, any>>, index: number): boolean {
	const parent = ancestors[index - 1];
	const grandparent = ancestors[index - 2];
	const greatGrandparent = ancestors[index - 3];
	const isEventProp = (node: Record<string, any> | undefined): boolean =>
		Boolean(node && node.type === 'JSXAttribute' && EVENT_PROP.test(jsxAttributeName(node.name)));
	if (parent?.type === 'JSXExpressionContainer') return isEventProp(grandparent);
	if (parent?.type === 'ArrayExpression' && grandparent?.type === 'JSXExpressionContainer')
		return isEventProp(greatGrandparent);
	return false;
}

/**
 * FRAMELESS-OWNED, two rules.
 *
 * `no-handler-sync-action` rejects a declared sync action - `preventDefault()`
 * or `stopPropagation()` - inside an emitted event handler unless the call sits
 * in a DIRECT-position `sync$()` QRL.
 *
 * It was named `no-handler-prevent-default` until T011 §4.1. That name became a
 * lie the moment `stopPropagation` entered scope: `SyncPolicy.actions` has
 * always admitted it, an authored top-level `event.stopPropagation()` has always
 * reached the emitter, and the resulting lazily fetched QRL runs long after
 * propagation has completed. Measured before this change: both the conditional
 * and the unconditional `stopPropagation` shapes drew ZERO violations from any
 * rule, ours or upstream's.
 *
 * WHAT IT KEYS ON: which KIND of QRL the call lands in. A `sync$()` QRL is
 * serialized inline into the HTML and the loader resolves it without a network
 * round trip, so it runs during dispatch. Every other QRL under an event prop is
 * fetched lazily, so by the time it runs the browser has already performed the
 * default action or finished bubbling.
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
 * `sync-qrl-must-be-closed` PROVES, rather than sniffs for, the constraint that
 * makes the lowering above legal. See its own comment below.
 *
 * Every property named here is pinned by mutation tests in test/gate.test.ts.
 */
const framelessQwikPlugin = {
	rules: {
		'no-handler-sync-action': {
			meta: {
				type: 'problem',
				schema: [],
				messages: {
					noHandlerSyncAction:
						'Emitted Qwik event handler {{attribute}} calls {{action}}() outside a sync$() QRL. A lazily fetched QRL runs after the browser has already performed the default action and finished bubbling - regardless of whether the handler is async or wrapped in $(). Split the action into a leading sync$() QRL, which is serialized inline and runs during dispatch.',
					indirectSyncQrl:
						'Emitted Qwik source calls {{action}}() inside a sync$() QRL that is not a direct value or array element of a JSX event prop. A sync$() constructed inside a lazily fetched QRL is created long after dispatch, so the action is exactly as ineffective as calling it in the lazy QRL directly.',
				},
			},
			create(context: Record<string, any>) {
				return {
					"CallExpression[callee.type='MemberExpression'][callee.property.name='preventDefault'], CallExpression[callee.type='MemberExpression'][callee.property.name='stopPropagation']"(
						node: Record<string, any>,
					) {
						const action = node.callee?.property?.name;
						const ancestors: Array<Record<string, any>> =
							context.sourceCode.getAncestors(node);
						// Walking OUTWARD, the FIRST ancestor that is either a sync$()
						// call or a JSX event attribute decides. Nothing beyond it is
						// consulted, so a sync$() nested in a lazy QRL cannot launder a
						// call that the event prop above it would have rejected.
						for (let index = ancestors.length - 1; index >= 0; index -= 1) {
							const ancestor = ancestors[index]!;
							if (isSyncQrlCall(ancestor)) {
								if (syncQrlIsDirect(ancestors, index)) return;
								context.report({
									node,
									messageId: 'indirectSyncQrl',
									data: { action },
								});
								return;
							}
							if (ancestor.type !== 'JSXAttribute') continue;
							const attribute = jsxAttributeName(ancestor.name);
							if (!EVENT_PROP.test(attribute)) return;
							context.report({
								node,
								messageId: 'noHandlerSyncAction',
								data: { attribute, action },
							});
							return;
						}
					},
				};
			},
		},
		/**
		 * FRAMELESS-OWNED. Proves that the function handed to `sync$()` references
		 * NO binding other than its own parameters.
		 *
		 * This is Qwik's own invariant, not ours: @qwik.dev/core core.mjs:15905 -
		 * "Synchronous QRLs functions can't close over any variables, including
		 * exports" - and in dev Qwik enforces it by round-tripping the function
		 * through `new Function('return ' + fn.toString())()`, which turns a
		 * captured reference into a ReferenceError at dispatch.
		 *
		 * WHY IT DOES NOT LOOK FOR SIGNALS. "Is this a signal" is undecidable and
		 * any `.value`- or name-based test would be a heuristic wearing a proof's
		 * clothes: it would miss a store member, a renamed signal, or a captured
		 * helper, and it would be wrong the first time an emitter changed its
		 * naming. Closure freedom is strictly stronger AND decidable, and it
		 * implies "no reactive state" rather than trying to detect it.
		 *
		 * IT IS AN ALLOWLIST. A reference is accepted only when scope analysis
		 * resolves it to a variable declared inside the function itself. Anything
		 * else - outer scope, module scope, a browser global, or a name that
		 * resolves to nothing at all - is reported, so an unforeseen construct
		 * fails CLOSED instead of slipping through a denylist that never heard of
		 * it. A `sync$()` argument that is not a function literal cannot be
		 * analysed at all, and is reported for that reason.
		 */
		'sync-qrl-must-be-closed': {
			meta: {
				type: 'problem',
				schema: [],
				messages: {
					notAFunctionLiteral:
						'sync$() must receive a function literal so scope analysis can prove it closes over nothing; frameless cannot prove that of {{received}}.',
					closesOverBinding:
						'Emitted sync$() QRL references `{{name}}`, which is declared outside the function. A synchronous QRL is serialized inline and re-created with `new Function`, so any binding but its own parameters is a ReferenceError at dispatch (@qwik.dev/core core.mjs:15905). Synthesize the body from the declared SyncPolicy instead of lifting authored source.',
					unresolvedReference:
						'Emitted sync$() QRL references `{{name}}`, which resolves to no binding inside the function - a global or an undeclared name. A synchronous QRL may reference nothing but its own parameters.',
				},
			},
			create(context: Record<string, any>) {
				return {
					"CallExpression[callee.type='Identifier'][callee.name='sync$']"(
						node: Record<string, any>,
					) {
						const fn = node.arguments?.[0];
						if (
							!fn ||
							(fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')
						) {
							context.report({
								node,
								messageId: 'notAFunctionLiteral',
								data: { received: fn?.type ?? 'no argument' },
							});
							return;
						}
						const functionScope = context.sourceCode.getScope(fn);
						const declaredInside = (scope: Record<string, any> | null): boolean => {
							for (let current = scope; current; current = current.upper)
								if (current === functionScope) return true;
							return false;
						};
						const visit = (scope: Record<string, any>): void => {
							for (const reference of scope.references) {
								const name = reference.identifier?.name;
								if (!reference.resolved) {
									context.report({
										node: reference.identifier,
										messageId: 'unresolvedReference',
										data: { name },
									});
									continue;
								}
								if (!declaredInside(reference.resolved.scope))
									context.report({
										node: reference.identifier,
										messageId: 'closesOverBinding',
										data: { name: reference.resolved.name },
									});
							}
							scope.childScopes.forEach(visit);
						};
						visit(functionScope);
					},
				};
			},
		},
	},
};

export const FRAMELESS_ESLINT_RULES = {
	'frameless/no-handler-sync-action': 'error',
	'frameless/sync-qrl-must-be-closed': 'error',
} as const;

const ESLINT_POLICIES = Object.keys(QWIK_ESLINT_RULES).map((rule) => ({
	id: `eslint:${rule}`,
	dossierRef: 'frameless-testing-ci-v1 T003 ruling 2' as const,
}));

export const QWIK_GATE_POLICIES = [
	{ id: 'no-visible-task', dossierRef: 'T002-qwik-architecture D8' },
	persistenceArtifactPolicy(),
	{
		id: 'frameless/no-handler-sync-action',
		dossierRef: 'frameless-defects-and-targets-v1 T015 ruling 4',
	},
	{
		id: 'frameless/sync-qrl-must-be-closed',
		dossierRef: 'frameless-defects-and-targets-v1 T011 ruling 4',
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
