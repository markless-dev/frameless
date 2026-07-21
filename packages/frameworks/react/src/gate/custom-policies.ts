import { analyze, type Module, type Symbol as YukuSymbol } from 'yuku-analyzer';
import { parse } from 'yuku-parser';
import type { GateViolation } from './index.ts';

type Node = any;
type Violate = (file: string, policy: string, message: string, node?: Node) => GateViolation;
const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);
const REACT_IMPORT_ALLOWLIST = new Set(['useState', 'useRef']);
const is = (node: unknown, type: string, properties?: Record<string, unknown>): boolean =>
	Boolean(
		node &&
		typeof node === 'object' &&
		(node as Node).type === type &&
		(!properties ||
			Object.entries(properties).every(([key, value]) => (node as Node)[key] === value)),
	);
const primitive = (node: Node): boolean =>
	(is(node, 'Literal') && ['string', 'number', 'boolean'].includes(typeof node.value)) ||
	(is(node, 'Literal') && node.value === null);

function propertyName(node: Node): string | null {
	if (!is(node, 'MemberExpression') && !is(node, 'Property')) return null;
	const value = is(node, 'MemberExpression') ? node.property : node.key;
	if (!node.computed && is(value, 'Identifier')) return value.name;
	return is(value, 'Literal') && typeof value.value === 'string' ? value.value : null;
}

function ancestors(module: Module, node: Node): Node[] {
	const result: Node[] = [];
	for (let parent = module.parentOf(node); parent; parent = module.parentOf(parent))
		result.push(parent);
	return result;
}

function functionParent(module: Module, node: Node): Node | null {
	return (
		ancestors(module, node).find((parent) =>
			['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(
				parent.type,
			),
		) ?? null
	);
}

function statementParent(module: Module, node: Node): Node | null {
	return (
		ancestors(module, node).find(
			(parent) => parent.type.endsWith('Statement') || parent.type.endsWith('Declaration'),
		) ?? null
	);
}

function containsReturn(node: Node): boolean {
	if (!node || typeof node !== 'object') return false;
	if (node.type === 'ReturnStatement') return true;
	return Object.entries(node).some(
		([key, value]) =>
			!['start', 'end', 'loc'].includes(key) &&
			(Array.isArray(value) ? value.some(containsReturn) : containsReturn(value)),
	);
}

type Callable =
	| { kind: 'setter'; symbol: YukuSymbol }
	| { kind: 'effect'; hook: string }
	| { kind: 'helper'; node: Node };

export function customPolicies(
	source: string,
	file: string,
	makeViolation: Violate,
): GateViolation[] {
	const parsed = parse(source, {
		lang: 'jsx',
		sourceType: 'module',
		preserveParens: false,
		attachComments: true,
	});
	if (parsed.diagnostics.length)
		throw new Error(parsed.diagnostics.map((entry) => entry.message).join('; '));
	const module = analyze(source, {
		lang: 'jsx',
		sourceType: 'module',
		preserveParens: false,
		attachComments: true,
	});
	if (module.diagnostics.length)
		throw new Error(module.diagnostics.map((entry) => entry.message).join('; '));
	const violations: GateViolation[] = [];
	const violation: Violate = (entryFile, policy, message, node) => ({
		...makeViolation(entryFile, policy, message),
		line:
			typeof node?.start === 'number' ? source.slice(0, node.start).split('\n').length : null,
	});
	const reactBindings = new Map<YukuSymbol, string>();
	for (const imported of module.imports) {
		if (imported.specifier === 'react' && imported.local && imported.name)
			reactBindings.set(imported.local, imported.name);
	}
	const stateSetters = new Set<YukuSymbol>();
	const refs = new Map<YukuSymbol, { name: string; initial: Node }>();
	module.walk({
		VariableDeclarator(node: Node) {
			if (!is(node.init, 'CallExpression') || !is(node.init.callee, 'Identifier')) return;
			const hook = reactBindings.get(module.symbolOf(node.init.callee)!);
			if (
				hook === 'useState' &&
				is(node.id, 'ArrayPattern') &&
				is(node.id.elements[1], 'Identifier')
			) {
				const symbol = module.symbolOf(node.id.elements[1]);
				if (symbol) stateSetters.add(symbol);
			}
			if (hook === 'useRef' && is(node.id, 'Identifier')) {
				const symbol = module.symbolOf(node.id);
				if (symbol)
					refs.set(symbol, {
						name: node.id.name,
						initial: node.init.arguments[0] ?? null,
					});
			}
		},
	});

	for (const comment of module.comments)
		if (/^\s*eslint(?:\s|-)/.test(comment.value))
			violations.push(
				violation(
					file,
					'eslint-directive',
					'ESLint directive comments are forbidden',
					comment,
				),
			);

	function declarationOwner(symbol: YukuSymbol): Node | null {
		for (const declaration of symbol.declarations) {
			const owner = [declaration, ...ancestors(module, declaration)].find((node) =>
				['VariableDeclarator', 'FunctionDeclaration'].includes(node.type),
			);
			if (owner) return owner;
		}
		return null;
	}

	function constantString(node: Node, trail = new Set<YukuSymbol>()): string | null {
		if (is(node, 'Literal') && typeof node.value === 'string') return node.value;
		if (!is(node, 'Identifier')) return null;
		const symbol = module.symbolOf(node);
		if (!symbol || trail.has(symbol)) return null;
		trail.add(symbol);
		const owner = declarationOwner(symbol);
		const declaration = owner ? module.parentOf(owner) : null;
		return is(owner, 'VariableDeclarator') &&
			is(declaration, 'VariableDeclaration', { kind: 'const' })
			? constantString(owner.init, trail)
			: null;
	}

	function callablePropertyName(node: Node): string | null {
		if (!is(node, 'MemberExpression') && !is(node, 'Property')) return null;
		const key = is(node, 'MemberExpression') ? node.property : node.key;
		return node.computed ? constantString(key) : propertyName(node);
	}

	function resolveCallable(callee: Node, trail = new Set<YukuSymbol>()): Callable | null {
		if (is(callee, 'Identifier')) {
			const symbol = module.symbolOf(callee);
			if (!symbol || trail.has(symbol)) return null;
			if (stateSetters.has(symbol)) return { kind: 'setter', symbol };
			const hook = reactBindings.get(symbol);
			if (hook && EFFECT_HOOKS.has(hook)) return { kind: 'effect', hook };
			trail.add(symbol);
			const owner = declarationOwner(symbol);
			if (is(owner, 'FunctionDeclaration')) return { kind: 'helper', node: owner };
			if (is(owner, 'VariableDeclarator')) {
				if (
					is(owner.init, 'ArrowFunctionExpression') ||
					is(owner.init, 'FunctionExpression')
				)
					return { kind: 'helper', node: owner.init };
				return resolveCallable(owner.init, trail);
			}
			return null;
		}
		if (is(callee, 'MemberExpression')) {
			const name = callablePropertyName(callee);
			let object = callee.object;
			if (is(object, 'Identifier')) {
				const symbol = module.symbolOf(object);
				const owner = symbol ? declarationOwner(symbol) : null;
				if (!is(owner, 'VariableDeclarator')) return null;
				object = owner.init;
			}
			if (!is(object, 'ObjectExpression')) return null;
			if (name != null) {
				const property = object.properties.find(
					(entry: Node) =>
						is(entry, 'Property') && callablePropertyName(entry) === name,
				);
				return property ? resolveCallable(property.value, trail) : null;
			}
			for (const property of object.properties) {
				if (!is(property, 'Property')) continue;
				const resolved = resolveCallable(property.value, new Set(trail));
				if (resolved?.kind === 'setter') return resolved;
			}
		}
		return null;
	}

	const seenExecution = new Set<Node>();
	function inspectExecution(fn: Node, origin?: Node): void {
		if (seenExecution.has(fn)) return;
		seenExecution.add(fn);
		module.walk(
			{
				enter(node: Node, context: any) {
					if (
						node !== fn &&
						[
							'FunctionDeclaration',
							'FunctionExpression',
							'ArrowFunctionExpression',
						].includes(node.type)
					)
						context.skip();
				},
				CallExpression(node: Node) {
					const resolved = resolveCallable(node.callee);
					if (resolved?.kind === 'setter')
						violations.push(
							violation(
								file,
								'render-phase-setter',
								'A useState setter is reachable during render',
								origin ?? node,
							),
						);
					else if (resolved?.kind === 'effect')
						violations.push(
							violation(
								file,
								'render-phase-effect',
								`${resolved.hook} is forbidden by the fixture-family gate`,
								origin ?? node,
							),
						);
					else if (resolved?.kind === 'helper')
						inspectExecution(resolved.node, origin ?? node);
				},
			},
			fn,
		);
	}

	const exportedComponents: Node[] = [];
	module.walk({
		ImportDeclaration(node: Node) {
			if (node.source.value !== 'react')
				violations.push(
					violation(
						file,
						'undisclosed-import',
						`Undisclosed import: ${node.source.value}`,
						node,
					),
				);
			else
				for (const specifier of node.specifiers) {
					const imported = is(specifier, 'ImportSpecifier')
						? (specifier.imported.name ?? specifier.imported.value)
						: null;
					if (!imported || !REACT_IMPORT_ALLOWLIST.has(imported))
						violations.push(
							violation(
								file,
								imported === 'forwardRef'
									? 'no-forwardRef'
									: 'react-import-allowlist',
								`React import is not allowed: ${imported ?? specifier.type}`,
								specifier,
							),
						);
				}
		},
		ImportExpression(node: Node) {
			violations.push(
				violation(file, 'undisclosed-import', 'Dynamic import is undisclosed', node),
			);
		},
		CallExpression(node: Node) {
			if (is(node.callee, 'Identifier', { name: 'require' }))
				violations.push(
					violation(file, 'undisclosed-import', 'CommonJS require is undisclosed', node),
				);
			if (is(node.callee, 'MemberExpression') && propertyName(node.callee) === 'map') {
				const callback = node.arguments[0];
				if (
					is(callback, 'ArrowFunctionExpression') &&
					is(callback.body, 'JSXElement') &&
					!callback.body.openingElement.attributes.some(
						(attribute: Node) =>
							is(attribute, 'JSXAttribute') &&
							is(attribute.name, 'JSXIdentifier', { name: 'key' }),
					)
				)
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
		MemberExpression(node: Node) {
			if (propertyName(node) === 'forwardRef')
				violations.push(
					violation(
						file,
						'no-forwardRef',
						'React.forwardRef is forbidden under React 19',
						node,
					),
				);
		},
		AssignmentExpression(node: Node) {
			if (
				is(node.left, 'MemberExpression') &&
				['propTypes', 'defaultProps'].includes(propertyName(node.left) ?? '')
			)
				violations.push(
					violation(
						file,
						'component-shape',
						'propTypes/defaultProps assignments are forbidden',
						node,
					),
				);
		},
		JSXOpeningElement(node: Node) {
			if (
				!is(node.name, 'JSXIdentifier') ||
				!['input', 'textarea', 'select'].includes(node.name.name)
			)
				return;
			const names = new Set(
				node.attributes
					.filter((entry: Node) => is(entry, 'JSXAttribute'))
					.map((entry: Node) => (is(entry.name, 'JSXIdentifier') ? entry.name.name : '')),
			);
			if ((names.has('value') || names.has('checked')) && !names.has('onChange'))
				violations.push(
					violation(
						file,
						'controlled-input',
						'Controlled value/checked requires a sibling onChange',
						node,
					),
				);
		},
		JSXAttribute(node: Node) {
			const name = is(node.name, 'JSXIdentifier') ? node.name.name : '';
			if (name === 'onInput')
				violations.push(
					violation(
						file,
						'on-input',
						'Leaf controls must use onChange; onInput is forbidden',
						node,
					),
				);
			if (name === 'ref' && is(node.value, 'Literal') && typeof node.value.value === 'string')
				violations.push(
					violation(file, 'no-forwardRef', 'String refs are forbidden', node),
				);
			if (name === 'key' && is(node.value, 'JSXExpressionContainer')) {
				let found = false;
				module.walk(
					{
						Identifier(identifier: Node) {
							const symbol = module.symbolOf(identifier);
							const fn = symbol
								? ancestors(module, symbol.declarations[0]).find((entry) =>
										is(entry, 'ArrowFunctionExpression'),
									)
								: null;
							if (symbol && fn?.params[1] === symbol.declarations[0]) found = true;
						},
					},
					node.value.expression,
				);
				if (found)
					violations.push(
						violation(
							file,
							'index-key',
							'A keyed repeat may not use its map index',
							node,
						),
					);
			}
			if (
				!is(node.value, 'JSXExpressionContainer') ||
				!['ArrowFunctionExpression', 'FunctionExpression'].includes(
					node.value.expression?.type,
				)
			)
				return;
			const handler = node.value.expression;
			const setterCalls = new Map<YukuSymbol, number>();
			const invoked = new Set<Node>();
			const opening = ancestors(module, node).find((entry) => is(entry, 'JSXOpeningElement'));
			const leaf =
				is(opening?.name, 'JSXIdentifier') &&
				['input', 'textarea', 'select'].includes(opening.name.name);
			const inspectHandler = (fn: Node): void => {
				if (invoked.has(fn)) return;
				invoked.add(fn);
				module.walk(
					{
						enter(child: Node, context: any) {
							if (
								child !== fn &&
								[
									'FunctionDeclaration',
									'FunctionExpression',
									'ArrowFunctionExpression',
								].includes(child.type)
							)
								context.skip();
						},
						VariableDeclaration(declaration: Node) {
							if (declaration.kind !== 'const')
								violations.push(
									violation(
										file,
										'const-only-handlers',
										'JSX attribute handlers may declare only const bindings',
										declaration,
									),
								);
						},
						MemberExpression(member: Node) {
							if (leaf && propertyName(member) === 'currentTarget')
								violations.push(
									violation(
										file,
										'leaf-event-target',
										'Leaf controls must read event.target, not event.currentTarget',
										member,
									),
								);
						},
						CallExpression(call: Node) {
							const resolved = resolveCallable(call.callee);
							if (resolved?.kind === 'setter')
								setterCalls.set(
									resolved.symbol,
									(setterCalls.get(resolved.symbol) ?? 0) + 1,
								);
							else if (resolved?.kind === 'helper') inspectHandler(resolved.node);
							if (
								is(call.callee, 'MemberExpression') &&
								propertyName(call.callee) === 'preventDefault'
							) {
								const event = handler.params[0];
								if (
									!is(event, 'Identifier') ||
									!is(call.callee.object, 'Identifier') ||
									module.symbolOf(event) !== module.symbolOf(call.callee.object)
								)
									violations.push(
										violation(
											file,
											'prevent-default-event',
											'preventDefault must be called on the handler event parameter',
											call,
										),
									);
							}
						},
					},
					fn,
				);
			};
			inspectHandler(handler);
			if ([...setterCalls.values()].some((count) => count > 1))
				violations.push(
					violation(
						file,
						'one-call-per-setter',
						'A handler may call each state setter at most once',
						handler,
					),
				);
		},
		JSXExpressionContainer(node: Node) {
			module.walk(
				{
					enter(child: Node, context: any) {
						if (
							[
								'FunctionDeclaration',
								'FunctionExpression',
								'ArrowFunctionExpression',
							].includes(child.type)
						)
							context.skip();
					},
					Identifier(identifier: Node) {
						if (refs.has(module.symbolOf(identifier)!))
							violations.push(
								violation(
									file,
									'ref-visibility',
									'useRef-bound values may not be rendered in JSX',
									identifier,
								),
							);
					},
				},
				node.expression,
			);
		},
		FunctionDeclaration(node: Node) {
			const parent = module.parentOf(node);
			if (!is(parent, 'ExportNamedDeclaration')) return;
			exportedComponents.push(node);
			if (
				!node.id ||
				!/^\p{Lu}/u.test(node.id.name) ||
				node.params.length !== 1 ||
				!is(node.params[0], 'ObjectPattern')
			)
				violations.push(
					violation(
						file,
						'component-shape',
						'Exported component must be one PascalCase function with one destructured-props parameter',
						node,
					),
				);
			inspectExecution(node);
			const statements = node.body.body;
			const firstGuard = statements.findIndex(
				(statement: Node) =>
					is(statement, 'IfStatement') && containsReturn(statement.consequent),
			);
			module.walk(
				{
					CallExpression(call: Node) {
						if (functionParent(module, call) !== node || !is(call.callee, 'Identifier'))
							return;
						const hook = reactBindings.get(module.symbolOf(call.callee)!);
						if (!hook) return;
						const statement = statementParent(module, call);
						const index = statements.indexOf(statement);
						if (firstGuard >= 0 && index > firstGuard)
							violations.push(
								violation(
									file,
									'hook-after-guard',
									'A React hook appears after an early-return guard',
									call,
								),
							);
						if (hook === 'useState') {
							const initial = call.arguments[0];
							if (
								initial &&
								!primitive(initial) &&
								!is(initial, 'ArrowFunctionExpression')
							)
								violations.push(
									violation(
										file,
										'use-state-initializer',
										'useState initializer must be a literal or lazy arrow',
										call,
									),
								);
							if (is(initial, 'ArrowFunctionExpression')) {
								const returned = is(initial.body, 'BlockStatement')
									? initial.body.body.find((entry: Node) =>
											is(entry, 'ReturnStatement'),
										)?.argument
									: initial.body;
								if (primitive(returned))
									violations.push(
										violation(
											file,
											'use-state-initializer',
											'Literal useState initializers must not use a lazy wrapper',
											initial,
										),
									);
							}
						}
					},
				},
				node,
			);
		},
	});

	if (exportedComponents.length !== 1)
		violations.push(
			violation(
				file,
				'component-shape',
				`Expected exactly one exported function component; found ${exportedComponents.length}`,
			),
		);
	for (const [symbol, ref] of refs) {
		for (const reference of symbol.references) {
			const fn = functionParent(module, reference.node);
			const componentRender =
				is(fn, 'FunctionDeclaration') && is(module.parentOf(fn), 'ExportNamedDeclaration');
			const setupGuard = ancestors(module, reference.node).some(
				(entry) =>
					is(entry, 'IfStatement') &&
					entry.alternate == null &&
					is(entry.test, 'BinaryExpression', { operator: '===' }) &&
					is(entry.test.left, 'MemberExpression') &&
					module.symbolOf(entry.test.left.object) === symbol &&
					propertyName(entry.test.left) === 'current' &&
					primitive(entry.test.right) &&
					entry.test.right.value === null,
			);
			if (componentRender && !setupGuard)
				violations.push(
					violation(
						file,
						'ref-visibility',
						`${ref.name}.current is allowed only in its setup guard or a handler`,
						reference.node,
					),
				);
		}
		if (!is(ref.initial, 'Literal') || ref.initial.value !== null) continue;
		const guarded = symbol.references.some((reference) =>
			ancestors(module, reference.node).some((guard) => {
				if (
					!is(guard, 'IfStatement') ||
					!is(guard.test, 'BinaryExpression', { operator: '===' }) ||
					!is(guard.test.left, 'MemberExpression') ||
					module.symbolOf(guard.test.left.object) !== symbol ||
					propertyName(guard.test.left) !== 'current' ||
					guard.test.right?.value !== null
				)
					return false;
				let flips = false;
				module.walk(
					{
						AssignmentExpression(node: Node) {
							if (
								is(node.left, 'MemberExpression') &&
								module.symbolOf(node.left.object) === symbol &&
								propertyName(node.left) === 'current' &&
								node.right?.value !== null
							)
								flips = true;
						},
					},
					guard.consequent,
				);
				return flips;
			}),
		);
		if (!guarded)
			violations.push(
				violation(
					file,
					'ref-guard-shape',
					`${ref.name} must use if (${ref.name}.current === null)`,
				),
			);
	}
	return violations;
}
