import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import eslintJs from '@eslint/js';
import { ESLint } from 'eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { dirname, normalize, relative, resolve } from 'pathe';

export type DossierRef = `T002 ruling ${number}`;
export type GatePolicy = {
	readonly id: string;
	readonly dossierRef: DossierRef;
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
const traverse = ((traverseModule as any).default ?? traverseModule) as typeof traverseModule;
const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);
const REACT_IMPORT_ALLOWLIST = new Set(['useState', 'useRef']);
const isPrimitiveStateLiteral = (node: t.Node | null | undefined): boolean =>
	Boolean(node && (t.isStringLiteral(node) || t.isNumericLiteral(node) || t.isBooleanLiteral(node) || t.isNullLiteral(node)));

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
	const entries = await readdir(absolute, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return [];
		throw error;
	});
	const files: string[] = [];
	for (const entry of entries) {
		const child = resolve(absolute, entry.name);
		if (entry.isDirectory()) files.push(...(await collectJsxFiles(root, relative(root, child))));
		else if (entry.isFile() && entry.name.endsWith('.jsx')) files.push(normalize(relative(root, child)));
	}
	return files;
}

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export async function discoverGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<string[]> {
	// Discovery anchors to the package, not the invoking process — the root
	// workspace runs this suite with cwd at the repo root.
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	return (await collectJsxFiles(cwd, options.directory ?? 'generated')).sort();
}

function importedReactBindings(ast: t.File): Map<unknown, string> {
	const hooks = new Map<unknown, string>();
	traverse(ast, {
		ImportSpecifier(path) {
			if (!t.isImportDeclaration(path.parent) || path.parent.source.value !== 'react') return;
			const imported = t.isIdentifier(path.node.imported)
				? path.node.imported.name
				: path.node.imported.value;
			hooks.set(path.scope.getBinding(path.node.local.name), imported);
		},
	});
	return hooks;
}

function containsReturn(node: unknown): boolean {
	if (!node || typeof node !== 'object') return false;
	if ((node as { type?: string }).type === 'ReturnStatement') return true;
	return Object.entries(node).some(
		([key, value]) =>
			!['loc', 'start', 'end'].includes(key) &&
			(Array.isArray(value) ? value.some(containsReturn) : containsReturn(value)),
	);
}

function propertyName(node: t.Node | null | undefined): string | null {
	if (!node) return null;
	if (t.isMemberExpression(node) || t.isObjectProperty(node)) {
		const value = t.isMemberExpression(node) ? node.property : node.key;
		if (!node.computed && t.isIdentifier(value)) return value.name;
		if (t.isStringLiteral(value)) return value.value;
	}
	return null;
}

type Callable =
	| { readonly kind: 'setter'; readonly binding: unknown }
	| { readonly kind: 'effect'; readonly hook: string }
	| { readonly kind: 'helper'; readonly path: NodePath<t.Function> };

function customPolicies(source: string, file: string): GateViolation[] {
	const ast = parse(source, {
		sourceType: 'module',
		plugins: ['jsx'],
		attachComment: true,
	});
	const violations: GateViolation[] = [];
	const reactBindings = importedReactBindings(ast);
	const stateSetters = new Set<unknown>();
	const refs = new Map<unknown, { name: string; initial: t.Expression | t.SpreadElement | t.JSXNamespacedName | t.ArgumentPlaceholder | null }>();

	traverse(ast, {
		VariableDeclarator(path) {
			if (!t.isCallExpression(path.node.init) || !t.isIdentifier(path.node.init.callee)) return;
			const hookBinding = path.scope.getBinding(path.node.init.callee.name);
			const hook = reactBindings.get(hookBinding);
			if (hook === 'useState' && t.isArrayPattern(path.node.id)) {
				const setter = path.node.id.elements[1];
				if (t.isIdentifier(setter)) stateSetters.add(path.scope.getBinding(setter.name));
			}
			if (hook === 'useRef' && t.isIdentifier(path.node.id)) {
				refs.set(path.scope.getBinding(path.node.id.name), {
					name: path.node.id.name,
					initial: path.node.init.arguments[0] ?? null,
				});
			}
		},
	});

	for (const comment of ast.comments ?? []) {
		if (/^\s*eslint(?:\s|-)/.test(comment.value)) {
			violations.push(
				violation(file, 'eslint-directive', 'ESLint directive comments are forbidden', comment),
			);
		}
	}

	const seenHelpers = new Set<t.Node>();
	function resolveCallable(calleePath: NodePath, trail = new Set<unknown>()): Callable | null {
		if (!calleePath.node) return null;
		if (calleePath.isIdentifier()) {
			const binding = calleePath.scope.getBinding(calleePath.node.name);
			if (!binding || trail.has(binding)) return null;
			if (stateSetters.has(binding)) return { kind: 'setter', binding };
			const hook = reactBindings.get(binding);
			if (hook && EFFECT_HOOKS.has(hook)) return { kind: 'effect', hook };
			trail.add(binding);
			if (binding.path.isFunctionDeclaration()) {
				return { kind: 'helper', path: binding.path as NodePath<t.Function> };
			}
			if (binding.path.isVariableDeclarator()) {
				const init = binding.path.get('init');
				if (init.isArrowFunctionExpression() || init.isFunctionExpression()) {
					return { kind: 'helper', path: init as NodePath<t.Function> };
				}
				return resolveCallable(init as NodePath, trail);
			}
			return null;
		}
		if (calleePath.isMemberExpression()) {
			const object = calleePath.get('object');
			const name = propertyName(calleePath.node);
			if (!object.isIdentifier() || name == null) return null;
			const binding = object.scope.getBinding(object.node.name);
			if (!binding?.path.isVariableDeclarator()) return null;
			const init = binding.path.get('init');
			if (!init.isObjectExpression()) return null;
			const properties = init.get('properties');
			const candidate = properties.find(
				(entry) => entry.isObjectProperty() && propertyName(entry.node) === name,
			);
			return candidate?.isObjectProperty()
				? resolveCallable(candidate.get('value') as NodePath, trail)
				: null;
		}
		return null;
	}

	function inspectExecution(functionPath: NodePath<t.Function>, origin?: t.Node): void {
		if (seenHelpers.has(functionPath.node)) return;
		seenHelpers.add(functionPath.node);
		functionPath.traverse({
			Function(path) {
				path.skip();
			},
			CallExpression(path) {
				const resolved = resolveCallable(path.get('callee') as NodePath);
				if (resolved?.kind === 'setter') {
					violations.push(
						violation(
							file,
							'render-phase-setter',
							'A useState setter is reachable during render',
							origin ?? path.node,
						),
					);
				} else if (resolved?.kind === 'effect') {
					violations.push(
						violation(
							file,
							'render-phase-effect',
							`${resolved.hook} is forbidden by the fixture-family gate`,
							origin ?? path.node,
						),
					);
				} else if (resolved?.kind === 'helper') {
					inspectExecution(resolved.path, origin ?? path.node);
				}
			},
		});
	}

	const exportedComponents: NodePath<t.FunctionDeclaration>[] = [];
	traverse(ast, {
		ImportDeclaration(path) {
			if (path.node.source.value !== 'react') {
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
				if (!imported || !REACT_IMPORT_ALLOWLIST.has(imported)) {
					violations.push(
						violation(
							file,
							imported === 'forwardRef' ? 'no-forwardRef' : 'react-import-allowlist',
							`React import is not allowed: ${imported ?? specifier.type}`,
							specifier,
						),
					);
				}
			}
		},
		CallExpression: {
			enter(path) {
				if (t.isIdentifier(path.node.callee, { name: 'require' })) {
					violations.push(
						violation(file, 'undisclosed-import', 'CommonJS require is undisclosed', path.node),
					);
				}
				if (t.isImport(path.node.callee)) {
					violations.push(
						violation(file, 'undisclosed-import', 'Dynamic import is undisclosed', path.node),
					);
				}
			},
			exit(path) {
				if (
					!t.isMemberExpression(path.node.callee) ||
					!t.isIdentifier(path.node.callee.property, { name: 'map' })
				) {
					return;
				}
				const callback = path.node.arguments[0];
				if (!t.isArrowFunctionExpression(callback) || !t.isJSXElement(callback.body)) return;
				const hasKey = callback.body.openingElement.attributes.some(
					(attribute) =>
						t.isJSXAttribute(attribute) &&
						t.isJSXIdentifier(attribute.name, { name: 'key' }),
				);
				if (!hasKey) {
					violations.push(
						violation(
							file,
							'key-required',
							'A map-returned element requires a data-derived key',
							callback.body,
						),
					);
				}
			},
		},
		MemberExpression(path) {
			if (propertyName(path.node) === 'forwardRef') {
				violations.push(
					violation(file, 'no-forwardRef', 'React.forwardRef is forbidden under React 19', path.node),
				);
			}
		},
		AssignmentExpression(path) {
			if (
				t.isMemberExpression(path.node.left) &&
				['propTypes', 'defaultProps'].includes(propertyName(path.node.left) ?? '')
			) {
				violations.push(
					violation(file, 'component-shape', 'propTypes/defaultProps assignments are forbidden', path.node),
				);
			}
		},
		JSXAttribute(path) {
			const name = t.isJSXIdentifier(path.node.name) ? path.node.name.name : '';
			if (name === 'onInput') {
				violations.push(
					violation(file, 'on-input', 'Leaf controls must use onChange; onInput is forbidden', path.node),
				);
			}
			if (name === 'ref' && t.isStringLiteral(path.node.value)) {
				violations.push(violation(file, 'no-forwardRef', 'String refs are forbidden', path.node));
			}
			if (name === 'key' && t.isJSXExpressionContainer(path.node.value)) {
				const expressionPath = path.get('value.expression') as NodePath;
				let found = false;
				const inspect = (identifier: NodePath<t.Identifier>): void => {
					if (found) return;
					const binding = identifier.scope.getBinding(identifier.node.name);
					const owner = binding?.scope.path;
					if (binding && owner?.isFunction() && owner.node.params[1] === binding.path.node) {
						found = true;
					}
				};
				if (expressionPath.isIdentifier()) inspect(expressionPath as NodePath<t.Identifier>);
				expressionPath.traverse({ Identifier: inspect });
				if (found) {
					violations.push(
						violation(file, 'index-key', 'A keyed repeat may not use its map index', path.node),
					);
				}
			}

			if (!t.isJSXExpressionContainer(path.node.value)) return;
			const handler = path.get('value.expression') as NodePath;
			if (!handler.isArrowFunctionExpression() && !handler.isFunctionExpression()) return;
			const setterCalls = new Map<unknown, number>();
			const invokedHelpers = new Set<t.Node>();
			const inspectHandlerExecution = (functionPath: NodePath<t.Function>): void => {
				if (invokedHelpers.has(functionPath.node)) return;
				invokedHelpers.add(functionPath.node);
				functionPath.traverse({
					Function(nested) { nested.skip(); },
					VariableDeclaration(declaration) {
						if (declaration.node.kind !== 'const') {
							violations.push(violation(file, 'const-only-handlers', 'JSX attribute handlers may declare only const bindings', declaration.node));
						}
					},
					MemberExpression(memberPath) {
						const opening = path.findParent((parent) => parent.isJSXOpeningElement());
						const leaf = opening?.isJSXOpeningElement() && t.isJSXIdentifier(opening.node.name) && ['input', 'textarea', 'select'].includes(opening.node.name.name);
						if (leaf && propertyName(memberPath.node) === 'currentTarget') {
							violations.push(violation(file, 'leaf-event-target', 'Leaf controls must read event.target, not event.currentTarget', memberPath.node));
						}
					},
					CallExpression(call) {
						const resolved = resolveCallable(call.get('callee') as NodePath);
						if (resolved?.kind === 'setter') setterCalls.set(resolved.binding, (setterCalls.get(resolved.binding) ?? 0) + 1);
						else if (resolved?.kind === 'helper') inspectHandlerExecution(resolved.path);
						if (t.isMemberExpression(call.node.callee) && propertyName(call.node.callee) === 'preventDefault') {
							const eventParam = handler.node.params[0];
							const object = call.get('callee.object') as NodePath;
							const parameterBinding = t.isIdentifier(eventParam) ? handler.scope.getBinding(eventParam.name) : null;
							const objectBinding = object.isIdentifier() ? object.scope.getBinding(object.node.name) : null;
							if (!parameterBinding || objectBinding !== parameterBinding) {
								violations.push(violation(file, 'prevent-default-event', 'preventDefault must be called on the handler event parameter', call.node));
							}
						}
					},
				});
			};
			inspectHandlerExecution(handler as NodePath<t.Function>);
			for (const count of setterCalls.values()) {
				if (count > 1) {
					violations.push(
						violation(
							file,
							'one-call-per-setter',
							'A handler may call each state setter at most once',
							handler.node,
						),
					);
				}
			}
		},
		JSXOpeningElement(path) {
			if (!t.isJSXIdentifier(path.node.name) || !['input', 'textarea', 'select'].includes(path.node.name.name)) {
				return;
			}
			const names = new Set(
				path.node.attributes
					.filter((attribute): attribute is t.JSXAttribute => t.isJSXAttribute(attribute))
					.map((attribute) => (t.isJSXIdentifier(attribute.name) ? attribute.name.name : '')),
			);
			if ((names.has('value') || names.has('checked')) && !names.has('onChange')) {
				violations.push(
					violation(
						file,
						'controlled-input',
						'Controlled value/checked requires a sibling onChange',
						path.node,
					),
				);
			}
		},
		JSXExpressionContainer(path) {
			path.traverse({
				Function(handler) {
					handler.skip();
				},
				Identifier(identifier) {
					const binding = identifier.scope.getBinding(identifier.node.name);
					if (refs.has(binding)) {
						violations.push(
							violation(file, 'ref-visibility', 'useRef-bound values may not be rendered in JSX', identifier.node),
						);
					}
				},
			});
		},
		FunctionDeclaration(path) {
			if (!path.parentPath.isExportNamedDeclaration()) return;
			exportedComponents.push(path);
			if (
				!path.node.id ||
				!/^\p{Lu}/u.test(path.node.id.name) ||
				path.node.params.length !== 1 ||
				!t.isObjectPattern(path.node.params[0])
			) {
				violations.push(
					violation(
						file,
						'component-shape',
						'Exported component must be one PascalCase function with one destructured-props parameter',
						path.node,
					),
				);
			}
			inspectExecution(path as NodePath<t.Function>);
			const statements = path.get('body.body');
			const firstEarlyGuard = statements.findIndex(
				(statement) => statement.isIfStatement() && containsReturn(statement.node.consequent),
			);
			for (const statement of statements) {
				statement.traverse({
					Function(nested) {
						nested.skip();
					},
					CallExpression(call) {
						if (!call.get('callee').isIdentifier()) return;
						const callee = call.node.callee as t.Identifier;
						const binding = call.scope.getBinding(callee.name);
						const hook = reactBindings.get(binding);
						if (!hook) return;
						const statementIndex = statements.findIndex(
							(candidate) => candidate.node === call.getStatementParent()?.node,
						);
						if (firstEarlyGuard >= 0 && statementIndex > firstEarlyGuard) {
							violations.push(
								violation(file, 'hook-after-guard', 'A React hook appears after an early-return guard', call.node),
							);
						}
						if (hook === 'useState') {
							const initial = call.node.arguments[0];
							if (
								initial &&
								!isPrimitiveStateLiteral(initial) &&
								!t.isArrowFunctionExpression(initial)
							) {
								violations.push(
									violation(
										file,
										'use-state-initializer',
										'useState initializer must be a literal or lazy arrow',
										call.node,
									),
								);
							}
							if (t.isArrowFunctionExpression(initial)) {
								const returned = t.isBlockStatement(initial.body)
									? initial.body.body.find((entry): entry is t.ReturnStatement => t.isReturnStatement(entry))?.argument
									: initial.body;
								if (isPrimitiveStateLiteral(returned)) violations.push(violation(file, 'use-state-initializer', 'Literal useState initializers must not use a lazy wrapper', initial));
							}
						}
					},
				});
			}
		},
	});

	if (exportedComponents.length !== 1) {
		violations.push(
			violation(
				file,
				'component-shape',
				`Expected exactly one exported function component; found ${exportedComponents.length}`,
			),
		);
	}

	for (const [binding, ref] of refs) {
		const babelBinding = binding as { referencePaths?: NodePath<t.Identifier>[] };
		for (const reference of babelBinding.referencePaths ?? []) {
			const functionParent = reference.getFunctionParent();
			const isComponentRender =
				functionParent?.isFunctionDeclaration() &&
				functionParent.parentPath.isExportNamedDeclaration();
			const isSetupGuard = Boolean(
				reference.findParent(
					(ancestor) =>
						ancestor.isIfStatement() &&
						ancestor.node.alternate == null &&
						t.isBinaryExpression(ancestor.node.test, { operator: '===' }) &&
						t.isMemberExpression(ancestor.node.test.left) &&
						t.isIdentifier(ancestor.node.test.left.object, { name: ref.name }) &&
						propertyName(ancestor.node.test.left) === 'current' &&
						t.isNullLiteral(ancestor.node.test.right),
				),
			);
			if (isComponentRender && !isSetupGuard) {
				violations.push(
					violation(
						file,
						'ref-visibility',
						`${ref.name}.current is allowed only in its setup guard or a handler`,
						reference.node,
					),
				);
			}
		}
		if (!t.isNullLiteral(ref.initial)) {
			continue;
		}
		const guarded = (babelBinding.referencePaths ?? []).some((reference) => {
			const memberPath = reference.parentPath;
			const comparison = memberPath.parentPath;
			if (!comparison) return false;
			const guard = comparison.parentPath;
			if (!guard || !(
				memberPath.isMemberExpression() &&
				propertyName(memberPath.node) === 'current' &&
				comparison.isBinaryExpression({ operator: '===' }) &&
				t.isNullLiteral(comparison.node.right) &&
				guard.isIfStatement({ test: comparison.node })
			)) return false;
			let flips = false;
			guard.get('consequent').traverse({
				AssignmentExpression(assignment) {
					if (t.isMemberExpression(assignment.node.left) && t.isIdentifier(assignment.node.left.object, { name: ref.name }) && propertyName(assignment.node.left) === 'current' && !t.isNullLiteral(assignment.node.right)) flips = true;
				},
			});
			return flips;
		});
		if (!guarded) {
			violations.push(
				violation(
					file,
					'ref-guard-shape',
					`${ref.name} must use if (${ref.name}.current === null)`,
				),
			);
		}
	}
	return violations;
}

function makeEslint(cwd: string): ESLint {
	// eslint-plugin-react-hooks ^6 ships flat configs at runtime but not in its
	// types, keyed as 'flat/recommended' (and interop may nest under default).
	const hooksModule = reactHooksPlugin as unknown as {
		default?: { configs?: Record<string, any> };
		configs?: Record<string, any>;
	};
	const hooksConfigs = hooksModule.configs ?? hooksModule.default?.configs ?? {};
	const recommendedHooks = hooksConfigs['flat/recommended'] ?? hooksConfigs['recommended-latest'];
	if (!recommendedHooks) throw new Error('eslint-plugin-react-hooks ^6 flat recommended config is unavailable');
	return new ESLint({
		cwd,
		overrideConfigFile: true,
		allowInlineConfig: false,
		overrideConfig: [
			eslintJs.configs.recommended,
			(reactPlugin.configs as Record<string, any>).flat.recommended,
			(reactPlugin.configs as Record<string, any>).flat['jsx-runtime'],
			// 'flat/recommended' is an ARRAY of flat config entries — spread it.
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
	// Discovery anchors to the package, not the invoking process — the root
	// workspace runs this suite with cwd at the repo root.
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
	return { files: entries.map((entry) => entry.file), policies: REACT_GATE_POLICIES, violations };
}

export async function checkGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<GateResult> {
	// Discovery anchors to the package, not the invoking process — the root
	// workspace runs this suite with cwd at the repo root.
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	const files = await discoverGeneratedFiles({ cwd, directory: options.directory });
	const entries = await Promise.all(
		files.map(async (file) => ({ file, source: await readFile(resolve(cwd, file), 'utf8') })),
	);
	return checkSources(entries, { cwd });
}
