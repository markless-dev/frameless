import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import solidPlugin from 'eslint-plugin-solid';
import globals from 'globals';
import { dirname, normalize, relative, resolve } from 'pathe';

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
	{ id: 'structural-ternary', dossierRef: 'T003 ruling 5' },
	{ id: 'show-two-arm', dossierRef: 'T003 ruling 5' },
	{ id: 'controlled-input', dossierRef: 'T003 ruling 7' },
	{ id: 'collection-accessor-in-row', dossierRef: 'T003 ruling 3' },
	{ id: 'stop-propagation', dossierRef: 'T003 ruling 6' },
	{ id: 'props-destructure', dossierRef: 'T003 ruling 8' },
	{ id: 'untrack-once-capture', dossierRef: 'T003 ruling 8' },
	{ id: 'reconcile-key', dossierRef: 'T003 ruling 4' },
	{ id: 'react-specific-props', dossierRef: 'T003 ruling 10' },
	{ id: 'component-shape', dossierRef: 'T003 ruling 10' },
	{ id: 'index-accessor', dossierRef: 'T003 ruling 4' },
	{ id: 'map-render', dossierRef: 'T003 ruling 4' },
	{ id: 'render-phase-setter', dossierRef: 'T003 ruling 1' },
	{ id: 'render-phase-effect', dossierRef: 'T003 ruling 2' },
	{ id: 'prevent-default-event', dossierRef: 'T003 ruling 6' },
] as const satisfies readonly GatePolicy[];

const POLICIES = new Map<string, GatePolicy>(
	SOLID_GATE_POLICIES.map((policy) => [policy.id, policy]),
);
const traverse = ((traverseModule as any).default ?? traverseModule) as typeof traverseModule;
const ALLOWED_IMPORTS = new Map([
	['solid-js', new Set(['createSignal', 'untrack', 'For', 'Show'])],
	['solid-js/store', new Set(['createStore', 'produce', 'reconcile'])],
]);
const EFFECTS = new Set(['createEffect', 'createRenderEffect', 'createComputed', 'onMount']);
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

type Imported = { readonly source: string; readonly imported: string };
function importedBindings(ast: t.File): Map<unknown, Imported> {
	const bindings = new Map<unknown, Imported>();
	traverse(ast, {
		ImportSpecifier(path) {
			if (!t.isImportDeclaration(path.parent)) return;
			const imported = t.isIdentifier(path.node.imported)
				? path.node.imported.name
				: path.node.imported.value;
			bindings.set(path.scope.getBinding(path.node.local.name), {
				source: path.parent.source.value,
				imported,
			});
		},
	});
	return bindings;
}

function jsxName(node: t.JSXAttribute['name']): string {
	if (t.isJSXIdentifier(node)) return node.name;
	return `${node.namespace.name}:${node.name.name}`;
}

function attribute(opening: t.JSXOpeningElement, name: string): t.JSXAttribute | undefined {
	return opening.attributes.find(
		(entry): entry is t.JSXAttribute => t.isJSXAttribute(entry) && jsxName(entry.name) === name,
	);
}

function expressionValue(value: t.JSXAttribute['value']): t.Expression | null {
	return t.isJSXExpressionContainer(value) && t.isExpression(value.expression)
		? value.expression
		: null;
}

function containsJsx(node: unknown): boolean {
	if (!node || typeof node !== 'object') return false;
	if (t.isJSXElement(node as t.Node) || t.isJSXFragment(node as t.Node)) return true;
	return Object.entries(node).some(
		([key, child]) =>
			!['loc', 'start', 'end'].includes(key) &&
			(Array.isArray(child) ? child.some(containsJsx) : containsJsx(child)),
	);
}

function memberName(node: t.Node | null | undefined): string | null {
	if (!node || !t.isMemberExpression(node)) return null;
	if (!node.computed && t.isIdentifier(node.property)) return node.property.name;
	if (t.isStringLiteral(node.property)) return node.property.value;
	return null;
}

function hasPropsRead(path: NodePath, binding: unknown): boolean {
	let found = false;
	path.traverse({
		Identifier(candidate) {
			if (candidate.scope.getBinding(candidate.node.name) === binding) found = true;
		},
	});
	return found;
}

function customPolicies(source: string, file: string): GateViolation[] {
	const ast = parse(source, { sourceType: 'module', plugins: ['jsx'], attachComment: true });
	const violations: GateViolation[] = [];
	const imports = importedBindings(ast);
	const setters = new Set<unknown>();
	const getters = new Set<unknown>();
	const reconcileKeys: string[] = [];
	const rowProperties = new Set<string>();

	for (const comment of ast.comments ?? [])
		if (/^\s*eslint(?:\s|-)/.test(comment.value))
			violations.push(
				violation(
					file,
					'eslint-directive',
					'ESLint directive comments are forbidden',
					comment,
				),
			);

	traverse(ast, {
		VariableDeclarator(path) {
			if (
				!t.isArrayPattern(path.node.id) ||
				!t.isCallExpression(path.node.init) ||
				!t.isIdentifier(path.node.init.callee)
			)
				return;
			const primitive = imports.get(path.scope.getBinding(path.node.init.callee.name));
			if (!primitive || !['createSignal', 'createStore'].includes(primitive.imported)) return;
			const getter = path.node.id.elements[0];
			const setter = path.node.id.elements[1];
			if (t.isIdentifier(getter)) getters.add(path.scope.getBinding(getter.name));
			if (t.isIdentifier(setter)) setters.add(path.scope.getBinding(setter.name));
			const initial = path.node.init.arguments[0];
			if (
				primitive.imported === 'createSignal' &&
				(t.isArrayExpression(initial) || t.isObjectExpression(initial))
			)
				violations.push(
					violation(
						file,
						'cell-type',
						'Object/array cells must use createStore',
						path.node,
					),
				);
			if (
				primitive.imported === 'createStore' &&
				initial &&
				(t.isStringLiteral(initial) ||
					t.isNumericLiteral(initial) ||
					t.isBooleanLiteral(initial) ||
					t.isNullLiteral(initial))
			)
				violations.push(
					violation(file, 'cell-type', 'Scalar cells must use createSignal', path.node),
				);
		},
	});

	const callable = (
		callee: NodePath,
	): { kind: 'setter' | 'effect' | 'helper'; path?: NodePath<t.Function> } | null => {
		if (!callee.isIdentifier()) return null;
		const binding = callee.scope.getBinding(callee.node.name);
		if (!binding) return null;
		if (setters.has(binding)) return { kind: 'setter' };
		const imported = imports.get(binding);
		if (imported && EFFECTS.has(imported.imported)) return { kind: 'effect' };
		if (binding.path.isFunctionDeclaration())
			return { kind: 'helper', path: binding.path as NodePath<t.Function> };
		if (binding.path.isVariableDeclarator()) {
			const init = binding.path.get('init');
			if (init.isArrowFunctionExpression() || init.isFunctionExpression())
				return { kind: 'helper', path: init as NodePath<t.Function> };
		}
		return null;
	};

	const exported: NodePath<t.FunctionDeclaration>[] = [];
	traverse(ast, {
		ImportDeclaration(path) {
			const allowed = ALLOWED_IMPORTS.get(path.node.source.value);
			if (!allowed) {
				violations.push(
					violation(
						file,
						'undisclosed-import',
						`Undisclosed import: ${path.node.source.value}`,
						path.node,
					),
				);
				return;
			}
			for (const specifier of path.node.specifiers) {
				const imported = t.isImportSpecifier(specifier)
					? t.isIdentifier(specifier.imported)
						? specifier.imported.name
						: specifier.imported.value
					: null;
				if (!imported || !allowed.has(imported))
					violations.push(
						violation(
							file,
							'solid-import-allowlist',
							`Solid import is not allowed: ${imported ?? specifier.type}`,
							specifier,
						),
					);
			}
		},
		CallExpression(path) {
			if (t.isIdentifier(path.node.callee, { name: 'require' }))
				violations.push(
					violation(
						file,
						'undisclosed-import',
						'CommonJS require is undisclosed',
						path.node,
					),
				);
			if (t.isImport(path.node.callee))
				violations.push(
					violation(
						file,
						'undisclosed-import',
						'Dynamic import is undisclosed',
						path.node,
					),
				);
			if (
				t.isMemberExpression(path.node.callee) &&
				memberName(path.node.callee) === 'stopPropagation'
			)
				violations.push(
					violation(
						file,
						'stop-propagation',
						'stopPropagation is forbidden for delegated handlers',
						path.node,
					),
				);
			if (t.isIdentifier(path.node.callee)) {
				const imported = imports.get(path.scope.getBinding(path.node.callee.name));
				if (imported?.imported === 'reconcile') {
					const options = path.node.arguments[1];
					const key = t.isObjectExpression(options)
						? options.properties.find(
								(entry): entry is t.ObjectProperty =>
									t.isObjectProperty(entry) &&
									((t.isIdentifier(entry.key) && entry.key.name === 'key') ||
										(t.isStringLiteral(entry.key) &&
											entry.key.value === 'key')),
							)
						: undefined;
					if (!key || !t.isStringLiteral(key.value))
						violations.push(
							violation(
								file,
								'reconcile-key',
								'Keyed structural reconciliation requires a literal key option',
								path.node,
							),
						);
					else reconcileKeys.push(key.value.value);
				}
			}
		},
		ConditionalExpression(path) {
			if (
				path.findParent((parent) => parent.isJSXExpressionContainer()) &&
				(containsJsx(path.node.consequent) || containsJsx(path.node.alternate))
			)
				violations.push(
					violation(
						file,
						'structural-ternary',
						'Structural JSX branches must use Show',
						path.node,
					),
				);
		},
		JSXAttribute(path) {
			const name = jsxName(path.node.name);
			if (name === 'className' || name === 'htmlFor')
				violations.push(
					violation(
						file,
						'react-specific-props',
						`${name} is a React-specific prop`,
						path.node,
					),
				);
			if (!t.isJSXExpressionContainer(path.node.value)) return;
			const handler = path.get('value.expression') as NodePath;
			if (!handler.isArrowFunctionExpression() && !handler.isFunctionExpression()) return;
			handler.traverse({
				Function(nested) {
					nested.skip();
				},
				CallExpression(call) {
					if (
						!t.isMemberExpression(call.node.callee) ||
						memberName(call.node.callee) !== 'preventDefault'
					)
						return;
					const parameter = handler.node.params[0];
					const object = call.get('callee.object') as NodePath;
					const parameterBinding = t.isIdentifier(parameter)
						? handler.scope.getBinding(parameter.name)
						: null;
					const objectBinding = object.isIdentifier()
						? object.scope.getBinding(object.node.name)
						: null;
					if (!parameterBinding || parameterBinding !== objectBinding)
						violations.push(
							violation(
								file,
								'prevent-default-event',
								'preventDefault must be called on the handler event parameter',
								call.node,
							),
						);
				},
			});
		},
		JSXOpeningElement(path) {
			if (!t.isJSXIdentifier(path.node.name)) return;
			const primitive = imports.get(path.scope.getBinding(path.node.name.name))?.imported;
			if (primitive === 'Show') {
				if (!attribute(path.node, 'when') || !attribute(path.node, 'fallback'))
					violations.push(
						violation(
							file,
							'show-two-arm',
							'Show requires explicit when and fallback arms',
							path.node,
						),
					);
			}
			if (['input', 'textarea', 'select'].includes(path.node.name.name)) {
				const value = attribute(path.node, 'value');
				const attrValue = attribute(path.node, 'attr:value');
				const onInput = attribute(path.node, 'onInput');
				const onChange = attribute(path.node, 'onChange');
				const checked = attribute(path.node, 'checked');
				const liveExpression = value ? expressionValue(value.value) : null;
				const attributeExpression = attrValue ? expressionValue(attrValue.value) : null;
				if (
					value &&
					(!onInput ||
						!attrValue ||
						!liveExpression ||
						!attributeExpression ||
						!t.isNodesEquivalent(liveExpression, attributeExpression))
				)
					violations.push(
						violation(
							file,
							'controlled-input',
							'Controlled text value requires onInput and an identical attr:value pair',
							path.node,
						),
					);
				if (value && onChange)
					violations.push(
						violation(
							file,
							'controlled-input',
							'Controlled text inputs must not use React onChange semantics',
							path.node,
						),
					);
				if (attrValue && !value)
					violations.push(
						violation(
							file,
							'controlled-input',
							'attr:value requires its live value pair',
							path.node,
						),
					);
				if (checked && !onChange)
					violations.push(
						violation(
							file,
							'controlled-input',
							'Controlled checked requires onChange',
							path.node,
						),
					);
			}
			if (primitive !== 'For') return;
			const each = attribute(path.node, 'each');
			const eachExpression = each ? expressionValue(each.value) : null;
			const collectionBinding = t.isIdentifier(eachExpression)
				? path.scope.getBinding(eachExpression.name)
				: t.isCallExpression(eachExpression) && t.isIdentifier(eachExpression.callee)
					? path.scope.getBinding(eachExpression.callee.name)
					: null;
			const childPath = path.parentPath
				.get('children')
				.find((entry) => entry.isJSXExpressionContainer()) as
				| NodePath<t.JSXExpressionContainer>
				| undefined;
			const child = childPath?.get('expression');
			if (!child?.isArrowFunctionExpression()) return;
			if (child.node.params.length > 1)
				violations.push(
					violation(
						file,
						'index-accessor',
						'For rows may not consume the index accessor',
						child.node.params[1],
					),
				);
			const row = child.node.params[0];
			const rowBinding = t.isIdentifier(row) ? child.scope.getBinding(row.name) : null;
			child.traverse({
				MemberExpression(memberPath) {
					if (
						!t.isIdentifier(memberPath.node.object) ||
						memberPath.scope.getBinding(memberPath.node.object.name) !== rowBinding
					)
						return;
					const name = memberName(memberPath.node);
					if (name) rowProperties.add(name);
				},
				CallExpression(call) {
					if (!t.isIdentifier(call.node.callee) || call.node.arguments.length !== 0)
						return;
					const binding = call.scope.getBinding(call.node.callee.name);
					if (binding === collectionBinding && getters.has(binding))
						violations.push(
							violation(
								file,
								'collection-accessor-in-row',
								'A For row binding may not refresh through a whole-collection accessor',
								call.node,
							),
						);
				},
			});
		},
		MemberExpression(path) {
			const owner = path.getFunctionParent();
			if (
				memberName(path.node) === 'map' &&
				path.findParent((parent) => parent.isJSXExpressionContainer()) &&
				owner?.isFunctionDeclaration() &&
				owner.parentPath.isExportNamedDeclaration()
			)
				violations.push(
					violation(
						file,
						'map-render',
						'Rendered collections must use For, not map',
						path.node,
					),
				);
		},
		FunctionDeclaration(path) {
			if (!path.parentPath.isExportNamedDeclaration()) return;
			exported.push(path);
			if (
				!path.node.id ||
				!/^\p{Lu}/u.test(path.node.id.name) ||
				path.node.params.length !== 1 ||
				!t.isIdentifier(path.node.params[0])
			)
				violations.push(
					violation(
						file,
						'component-shape',
						'Exported component must be one PascalCase function with one props identifier',
						path.node,
					),
				);
			const parameter = path.node.params[0];
			if (!t.isIdentifier(parameter)) return;
			const propsBinding = path.scope.getBinding(parameter.name);
			for (const statement of path.get('body.body')) {
				if (statement.isVariableDeclaration()) {
					for (const declaration of statement.get('declarations')) {
						const id = declaration.get('id');
						const init = declaration.get('init');
						if (
							(id.isObjectPattern() || id.isArrayPattern()) &&
							init.isIdentifier() &&
							init.scope.getBinding(init.node.name) === propsBinding
						)
							violations.push(
								violation(
									file,
									'props-destructure',
									'Solid props may not be destructured',
									declaration.node,
								),
							);
						if (!init.node || !hasPropsRead(init as NodePath, propsBinding)) continue;
						if (init.isArrowFunctionExpression()) continue;
						const isUntrack =
							init.isCallExpression() &&
							init.get('callee').isIdentifier() &&
							imports.get(
								init.scope.getBinding((init.node.callee as t.Identifier).name),
							)?.imported === 'untrack';
						const wrappedPrimitive =
							init.isCallExpression() &&
							init.get('callee').isIdentifier() &&
							['createSignal', 'createStore'].includes(
								imports.get(
									init.scope.getBinding((init.node.callee as t.Identifier).name),
								)?.imported ?? '',
							) &&
							init.node.arguments.some(
								(argument) =>
									t.isCallExpression(argument) &&
									t.isIdentifier(argument.callee) &&
									imports.get(init.scope.getBinding(argument.callee.name))
										?.imported === 'untrack',
							);
						if (!isUntrack && !wrappedPrimitive)
							violations.push(
								violation(
									file,
									'untrack-once-capture',
									'Prop-reading setup initializers must be wrapped in untrack',
									init.node,
								),
							);
					}
				} else if (
					statement.isExpressionStatement() &&
					hasPropsRead(statement as NodePath, propsBinding)
				) {
					const value = statement.get('expression');
					const isUntrack =
						value.isCallExpression() &&
						value.get('callee').isIdentifier() &&
						imports.get(
							value.scope.getBinding((value.node.callee as t.Identifier).name),
						)?.imported === 'untrack';
					if (!isUntrack)
						violations.push(
							violation(
								file,
								'untrack-once-capture',
								'Prop-reading setup expressions must be wrapped in untrack',
								statement.node,
							),
						);
				}
			}
			const seen = new Set<t.Node>();
			const inspect = (owner: NodePath<t.Function>): void => {
				if (seen.has(owner.node)) return;
				seen.add(owner.node);
				owner.traverse({
					Function(nested) {
						nested.skip();
					},
					CallExpression(call) {
						const resolved = callable(call.get('callee') as NodePath);
						if (resolved?.kind === 'setter')
							violations.push(
								violation(
									file,
									'render-phase-setter',
									'A state setter is reachable during component setup',
									call.node,
								),
							);
						else if (resolved?.kind === 'effect')
							violations.push(
								violation(
									file,
									'render-phase-effect',
									'Effects are forbidden in this fixture family',
									call.node,
								),
							);
						else if (resolved?.kind === 'helper' && resolved.path)
							inspect(resolved.path);
					},
				});
			};
			inspect(path as NodePath<t.Function>);
		},
	});

	if (exported.length !== 1)
		violations.push(
			violation(
				file,
				'component-shape',
				`Expected exactly one exported function component; found ${exported.length}`,
			),
		);
	for (const key of reconcileKeys)
		if (!rowProperties.has(key))
			violations.push(
				violation(
					file,
					'reconcile-key',
					`Reconcile key ${key} is not represented by the corresponding For row`,
				),
			);
	return violations;
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
			violations.push(...customPolicies(source, file));
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
