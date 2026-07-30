import { analyze, type Module, type Symbol as YukuSymbol } from 'yuku-analyzer';
import { parse } from 'yuku-parser';
import type { GateViolation } from './index.ts';

type Node = any;
type Violate = (file: string, policy: string, message: string, node?: Node) => GateViolation;
const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);
const REACT_IMPORT_ALLOWLIST = new Set([
	'createContext',
	'useCallback',
	'useContext',
	'useRef',
	'useState',
	'useSyncExternalStore',
]);
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
	recordedRelativeImports: ReadonlySet<string> = new Set(),
): GateViolation[] {
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
	const module = analyze(source, {
		lang: 'tsx',
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
		if (is(callee, 'ArrowFunctionExpression') || is(callee, 'FunctionExpression'))
			return { kind: 'helper', node: callee };
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
					(entry: Node) => is(entry, 'Property') && callablePropertyName(entry) === name,
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
			if (recordedRelativeImports.has(node.source.value)) return;
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
			if (node.value == null)
				violations.push(
					violation(
						file,
						'explicit-static-attribute-value',
						'Static attributes must have an explicit value',
						node,
					),
				);
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
			// SCOPED TO ONE SUSPENSION SEGMENT, not to the whole handler.
			//
			// T002 ruling 5 reads "at most one call per setter per handler", and it
			// was written when no handler in this repo could contain `await` at all:
			// the React emitter's final-sync retention collapsed every write to a
			// cell into ONE setter call, so a second call could only be an emitter
			// fault. `docs/DEFECTS.md` 12.2 (b) is that collapse being WRONG across a
			// suspending boundary - a write before the `await` has to render before
			// the continuation runs - and T003 segmented the retention to close it.
			// The emitted S8 handler therefore calls `setPhase` twice on purpose,
			// once either side of the boundary.
			//
			// So the count is keyed by (suspension segment, setter). Inside any one
			// segment nothing can render in between and the ruling's original force
			// is unchanged; ACROSS a boundary two calls are the repair. `await` is
			// counted only where this walk already looks - the handler's own body and
			// the helpers it calls - because nested functions are skipped above.
			const setterCalls = new Map<YukuSymbol, number>();
			let repeatedSetter = false;
			/** Close the current suspension segment and start a fresh count. */
			const endSegment = (): void => {
				if ([...setterCalls.values()].some((count) => count > 1)) repeatedSetter = true;
				setterCalls.clear();
			};
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
						AwaitExpression() {
							endSegment();
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
			endSegment();
			if (repeatedSetter)
				violations.push(
					violation(
						file,
						'one-call-per-setter',
						'A handler may call each state setter at most once between suspension points',
						handler,
					),
				);
		},
		JSXExpressionContainer(node: Node) {
			const attribute = module.parentOf(node);
			if (
				is(attribute, 'JSXAttribute') &&
				is((attribute as Node).name, 'JSXIdentifier', { name: 'ref' })
			)
				return;
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
				node.params.length > 1 ||
				(node.params.length === 1 && !is(node.params[0], 'ObjectPattern'))
			)
				violations.push(
					violation(
						file,
						'component-shape',
						'Exported component must be one PascalCase function with zero parameters or one destructured-props parameter',
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
							const initialOwner = is(initial, 'Identifier')
								? declarationOwner(module.symbolOf(initial)!)
								: null;
							if (
								initial &&
								!primitive(initial) &&
								!is(initial, 'ArrowFunctionExpression') &&
								!is(initialOwner, 'FunctionDeclaration')
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

	const structural = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(structural);
		if (!value || typeof value !== 'object') return value;
		return Object.fromEntries(
			Object.entries(value as Node)
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
				.map(([key, child]) => [key, structural(child)]),
		);
	};
	const equivalent = (left: unknown, right: unknown): boolean =>
		JSON.stringify(structural(left)) === JSON.stringify(structural(right));
	const keyName = (node: Node): string | null => {
		if (!node) return null;
		if (is(node, 'Identifier')) return node.name;
		if (is(node, 'Literal') && typeof node.value === 'string') return node.value;
		return null;
	};
	const callUsesReact = (node: Node, hook: string): boolean =>
		is(node, 'CallExpression') &&
		is(node.callee, 'Identifier') &&
		reactBindings.get(module.symbolOf(node.callee)!) === hook;
	const returnedObjects: Array<{ fn: Node; object: Node }> = [];
	const contextSymbols = new Set<YukuSymbol>();
	const reactNamespaceSymbols = new Set<YukuSymbol>();
	for (const imported of module.imports)
		if (
			imported.specifier === 'react' &&
			imported.local &&
			(imported.name === 'default' || imported.name === '*')
		)
			reactNamespaceSymbols.add(imported.local);
	module.walk({
		VariableDeclarator(node: Node) {
			if (!is(node.id, 'Identifier') || !callUsesReact(node.init, 'createContext')) return;
			const symbol = module.symbolOf(node.id);
			if (symbol) contextSymbols.add(symbol);
			if (!/Context\d*$/.test(node.id.name))
				violations.push(
					violation(
						file,
						'R-SH5',
						'Emitted shared context names must end in Context',
						node.id,
					),
				);
		},
		FunctionDeclaration(node: Node) {
			let usesSharedHook = false;
			module.walk(
				{
					CallExpression(call: Node) {
						if (
							callUsesReact(call, 'useContext') ||
							callUsesReact(call, 'useSyncExternalStore')
						)
							usesSharedHook = true;
					},
					ReturnStatement(statement: Node) {
						if (is(statement.argument, 'ObjectExpression'))
							returnedObjects.push({ fn: node, object: statement.argument });
					},
				},
				node.body,
			);
			if (usesSharedHook && (!node.id || !/^use\p{Lu}/u.test(node.id.name)))
				violations.push(
					violation(
						file,
						'R-SH5',
						'Emitted shared hooks must retain the authored useName',
						node,
					),
				);
		},
		CallExpression(node: Node) {
			if (callUsesReact(node, 'useSyncExternalStore')) {
				const owner = functionParent(module, node);
				if (
					!is(owner, 'FunctionDeclaration') ||
					owner.params.length !== 1 ||
					!is(owner.params[0], 'Identifier') ||
					node.arguments.length !== 3 ||
					!equivalent(node.arguments[1], node.arguments[2])
				)
					violations.push(
						violation(
							file,
							'R-SH1',
							'useSyncExternalStore must appear in the complete emitted store-hook shape',
							node,
						),
					);
			}
			if (
				is(node.callee, 'MemberExpression') &&
				is(node.callee.object, 'Identifier') &&
				reactNamespaceSymbols.has(module.symbolOf(node.callee.object)!) &&
				['cloneElement', 'Children'].includes(propertyName(node.callee) ?? '')
			)
				violations.push(
					violation(file, 'R-CH1', 'React child traversal or cloning is forbidden', node),
				);
			if (
				is(node.callee, 'Identifier') &&
				ancestors(module, node.callee).some((parent) => {
					if (!is(parent, 'FunctionDeclaration')) return false;
					const parameter = parent.params[0];
					if (!is(parameter, 'ObjectPattern')) return false;
					return parameter.properties.some(
						(property: Node) =>
							is(property, 'Property') &&
							keyName(property.key) === 'children' &&
							is(property.value, 'Identifier') &&
							module.symbolOf(property.value) === module.symbolOf(node.callee),
					);
				})
			)
				violations.push(
					violation(
						file,
						'R-CH1',
						'Default-slot children may not be invoked as a render prop',
						node,
					),
				);
		},
		ImportDeclaration(node: Node) {
			const specifier = String(node.source.value);
			if (/react(?:-compiler|\/compiler)|compiler-runtime/.test(specifier))
				violations.push(
					violation(file, 'R-CP1', 'React Compiler runtime imports are forbidden', node),
				);
			if (specifier !== 'react') return;
			for (const item of node.specifiers) {
				const imported = is(item, 'ImportSpecifier')
					? (item.imported.name ?? item.imported.value)
					: null;
				if (['Children', 'cloneElement'].includes(imported))
					violations.push(
						violation(file, 'R-CH1', `React ${imported} synthesis is forbidden`, item),
					);
				if (['forwardRef', 'useImperativeHandle'].includes(imported))
					violations.push(
						violation(file, 'R-RF4', `React ${imported} is forbidden`, item),
					);
			}
		},
		ExpressionStatement(node: Node) {
			if (
				is(node.expression, 'Literal') &&
				['use memo', 'use no memo'].includes(node.expression.value)
			)
				violations.push(
					violation(file, 'R-CP1', 'React Compiler directives are forbidden', node),
				);
		},
		JSXAttribute(node: Node) {
			const name = is(node.name, 'JSXIdentifier') ? node.name.name : null;
			if (name === 'ref' && is(node.value, 'Literal') && typeof node.value.value === 'string')
				violations.push(violation(file, 'R-RF4', 'String refs are forbidden', node));
			if (name !== 'ref' || !is(node.value, 'JSXExpressionContainer')) return;
			const value = node.value.expression;
			if (!is(value, 'Identifier'))
				violations.push(
					violation(
						file,
						'R-RF2',
						'Emitted refs must resolve directly to a recorded handle or callback binding',
						node,
					),
				);
		},
		JSXOpeningElement(node: Node) {
			if (!is(node.name, 'JSXIdentifier')) return;
			const context = module.symbolOf(node.name);
			if (!contextSymbols.has(context!)) return;
			const value = node.attributes.find(
				(attribute: Node) =>
					is(attribute, 'JSXAttribute') &&
					is(attribute.name, 'JSXIdentifier', { name: 'value' }),
			)?.value?.expression;
			if (is(value, 'ObjectExpression'))
				violations.push(
					violation(
						file,
						'R-SH2',
						'Context provider object values must be memoized and method-free',
						node,
					),
				);
		},
		MemberExpression(node: Node) {
			if (
				propertyName(node) === 'Children' &&
				is(node.object, 'Identifier') &&
				reactNamespaceSymbols.has(module.symbolOf(node.object)!)
			)
				violations.push(
					violation(file, 'R-CH1', 'React.Children traversal is forbidden', node),
				);
			if (
				is(node.object, 'Identifier') &&
				reactNamespaceSymbols.has(module.symbolOf(node.object)!) &&
				['forwardRef', 'useImperativeHandle'].includes(propertyName(node) ?? '')
			)
				violations.push(
					violation(
						file,
						'R-RF4',
						'Legacy or imperative React ref APIs are forbidden',
						node,
					),
				);
		},
	});
	for (const component of exportedComponents) {
		let providesContext = false;
		module.walk(
			{
				JSXOpeningElement(node: Node) {
					if (
						is(node.name, 'JSXIdentifier') &&
						contextSymbols.has(module.symbolOf(node.name)!)
					)
						providesContext = true;
				},
			},
			component.body,
		);
		if (providesContext && !/Provider\d*$/.test(component.id?.name ?? ''))
			violations.push(
				violation(
					file,
					'R-SH5',
					'Emitted shared provider names must retain the factory-derived Provider suffix',
					component,
				),
			);
	}
	for (const context of contextSymbols) {
		let reads = 0;
		let providers = 0;
		module.walk({
			CallExpression(node: Node) {
				if (
					callUsesReact(node, 'useContext') &&
					is(node.arguments[0], 'Identifier') &&
					module.symbolOf(node.arguments[0]) === context
				)
					reads += 1;
			},
			JSXOpeningElement(node: Node) {
				if (is(node.name, 'JSXIdentifier') && module.symbolOf(node.name) === context)
					providers += 1;
			},
		});
		if (reads !== 1 || providers !== 1)
			violations.push(
				violation(
					file,
					'R-SH1',
					'Context lowering requires exactly one emitted hook read and one provider shape',
				),
			);
	}

	const listenerSets = new Set<YukuSymbol>();
	for (const { fn, object } of returnedObjects) {
		const properties = new Map<string, Node>();
		for (const property of object.properties)
			if (is(property, 'Property') && keyName(property.key))
				properties.set(keyName(property.key)!, property);
		const subscriptions = [...properties].filter(([name]) => /^subscribe\p{Lu}/u.test(name));
		if (subscriptions.length === 0) continue;
		for (const [name, property] of subscriptions) {
			const suffix = name.slice('subscribe'.length);
			if (!properties.has(`get${suffix}`))
				violations.push(
					violation(
						file,
						'R-SH1',
						`Store subscription ${name} has no matching snapshot getter`,
						property,
					),
				);
			let adds = 0;
			let deletes = 0;
			module.walk(
				{
					CallExpression(call: Node) {
						if (!is(call.callee, 'MemberExpression')) return;
						if (propertyName(call.callee) === 'add') {
							adds += 1;
							if (is(call.callee.object, 'Identifier')) {
								const symbol = module.symbolOf(call.callee.object);
								if (symbol) listenerSets.add(symbol);
							}
						}
						if (propertyName(call.callee) === 'delete') deletes += 1;
					},
				},
				property.value,
			);
			if (adds === 0 || deletes === 0)
				violations.push(
					violation(
						file,
						'R-SH3',
						`${name} must add and remove its per-cell listener`,
						property,
					),
				);
		}
		for (const [name, property] of properties) {
			if (!/^get\p{Lu}/u.test(name) || !is(property.value, 'ArrowFunctionExpression'))
				continue;
			if (!is(property.value.body, 'BlockStatement')) continue;
			const returned = property.value.body.body.find((entry: Node) =>
				is(entry, 'ReturnStatement'),
			);
			const versionGuard = property.value.body.body.some((entry: Node) =>
				is(entry, 'IfStatement'),
			);
			if (!versionGuard || !is(returned?.argument, 'Identifier'))
				violations.push(
					violation(
						file,
						'R-SH3',
						`${name} must return a version-cached snapshot identity`,
						property,
					),
				);
		}
		for (const property of object.properties) {
			if (!is(property, 'Property') || !property.method) continue;
			const statements = property.value.body?.body ?? [];
			const notification = statements.findIndex((entry: Node) => is(entry, 'ForOfStatement'));
			const changed = statements.find(
				(entry: Node) =>
					is(entry, 'VariableDeclaration') &&
					entry.declarations.some(
						(declaration: Node) =>
							is(declaration.init, 'NewExpression') &&
							is(declaration.init.callee, 'Identifier', { name: 'Set' }),
					),
			);
			let guardedNotification = false;
			let listenerCall = false;
			if (notification >= 0)
				module.walk(
					{
						CallExpression(call: Node) {
							if (
								is(call.callee, 'MemberExpression') &&
								propertyName(call.callee) === 'is' &&
								is(call.callee.object, 'Identifier', { name: 'Object' })
							)
								guardedNotification = true;
							if (is(call.callee, 'Identifier') && call.arguments.length === 0)
								listenerCall = true;
						},
					},
					statements[notification],
				);
			if (
				!changed ||
				notification < 0 ||
				notification !== statements.length - 1 ||
				!guardedNotification ||
				!listenerCall
			)
				violations.push(
					violation(
						file,
						'R-SH3',
						'Shared methods require one deferred post-method notification phase',
						property,
					),
				);
		}
		if (!fn.id)
			violations.push(
				violation(file, 'R-SH1', 'Store creation must have stable module identity', fn),
			);
		else {
			const creator = module.symbolOf(fn.id);
			const aliases = new Set<YukuSymbol>();
			const pending = creator ? [creator] : [];
			let hasOnceLatchedConstruction = false;
			while (pending.length > 0) {
				const symbol = pending.pop()!;
				if (aliases.has(symbol)) continue;
				aliases.add(symbol);
				for (const reference of symbol.references) {
					const parent: Node = module.parentOf(reference.node);
					if (is(parent, 'VariableDeclarator') && parent.init === reference.node) {
						if (is(parent.id, 'Identifier')) {
							const alias = module.symbolOf(parent.id);
							if (alias) pending.push(alias);
						}
						continue;
					}
					if (
						is(parent, 'CallExpression') &&
						parent.arguments[0] === reference.node &&
						callUsesReact(parent, 'useState')
					) {
						hasOnceLatchedConstruction = true;
						continue;
					}
					if (!is(parent, 'CallExpression') || parent.callee !== reference.node) continue;
					const owner = functionParent(module, parent);
					const ownerCall: Node = owner ? module.parentOf(owner) : null;
					const isUseStateLazyCall =
						is(owner, 'ArrowFunctionExpression') &&
						owner.params.length === 0 &&
						is(ownerCall, 'CallExpression') &&
						ownerCall.arguments[0] === owner &&
						callUsesReact(ownerCall, 'useState');
					if (owner === null || isUseStateLazyCall) hasOnceLatchedConstruction = true;
					else
						violations.push(
							violation(
								file,
								'R-SH3',
								'Store construction must use a once-latched creator path',
								parent,
							),
						);
				}
			}
			if (!hasOnceLatchedConstruction)
				violations.push(
					violation(
						file,
						'R-SH3',
						'Store provider initializer must resolve to its once-latched creator',
						fn,
					),
				);
		}
	}

	function invokesListenerSet(
		fn: Node,
		tainted = new Set<YukuSymbol>(),
		visiting = new Set<Node>(),
	): boolean {
		if (visiting.has(fn)) return false;
		visiting.add(fn);
		let invokes = false;
		const reachesSet = (node: Node): boolean => {
			if (!is(node, 'Identifier')) return false;
			const symbol = module.symbolOf(node);
			return Boolean(symbol && (listenerSets.has(symbol) || tainted.has(symbol)));
		};
		module.walk(
			{
				enter(node: Node, context: any) {
					if (
						node !== fn &&
						['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(
							node.type,
						)
					)
						context.skip();
				},
				ForOfStatement(statement: Node) {
					if (!reachesSet(statement.right)) return;
					const declaration = statement.left?.declarations?.[0];
					if (is(declaration?.id, 'Identifier')) {
						const symbol = module.symbolOf(declaration.id);
						if (symbol) tainted.add(symbol);
					}
				},
				CallExpression(call: Node) {
					if (invokes) return;
					if (is(call.callee, 'Identifier')) {
						const symbol = module.symbolOf(call.callee);
						if (symbol && tainted.has(symbol)) {
							invokes = true;
							return;
						}
					}
					if (
						is(call.callee, 'MemberExpression') &&
						propertyName(call.callee) === 'forEach' &&
						reachesSet(call.callee.object)
					) {
						const callback = call.arguments[0];
						if (
							(is(callback, 'ArrowFunctionExpression') ||
								is(callback, 'FunctionExpression')) &&
							is(callback.params[0], 'Identifier')
						) {
							const parameter = module.symbolOf(callback.params[0]);
							if (
								parameter &&
								invokesListenerSet(callback, new Set([parameter]), visiting)
							)
								invokes = true;
						}
						return;
					}
					const resolved = resolveCallable(call.callee);
					if (resolved?.kind !== 'helper') return;
					const forwarded = new Set<YukuSymbol>();
					for (let index = 0; index < resolved.node.params.length; index += 1) {
						if (!reachesSet(call.arguments[index])) continue;
						const parameter = resolved.node.params[index];
						if (is(parameter, 'Identifier')) {
							const symbol = module.symbolOf(parameter);
							if (symbol) forwarded.add(symbol);
						}
					}
					if (invokesListenerSet(resolved.node, forwarded, visiting)) invokes = true;
				},
			},
			fn,
		);
		visiting.delete(fn);
		return invokes;
	}

	module.walk({
		VariableDeclarator(node: Node) {
			if (
				!is(node.init, 'ArrowFunctionExpression') ||
				node.init.params.length !== 2 ||
				!is(node.init.params[1], 'Identifier')
			)
				return;
			const changed = module.symbolOf(node.init.params[1]);
			let recordsChange = false;
			let equalityGuard = false;
			module.walk(
				{
					CallExpression(call: Node) {
						if (
							is(call.callee, 'MemberExpression') &&
							module.symbolOf(call.callee.object) === changed &&
							propertyName(call.callee) === 'add'
						)
							recordsChange = true;
						if (
							is(call.callee, 'MemberExpression') &&
							propertyName(call.callee) === 'is' &&
							is(call.callee.object, 'Identifier', { name: 'Object' })
						)
							equalityGuard = true;
					},
				},
				node.init.body,
			);
			if (recordsChange && (!equalityGuard || invokesListenerSet(node.init)))
				violations.push(
					violation(
						file,
						'R-SH3',
						'Store writes must use Object.is and defer listener notification until method completion',
						node,
					),
				);
		},
	});

	for (const [symbol, ref] of refs) {
		const jsxRef = symbol.references.some((reference) => {
			const expression = module.parentOf(reference.node);
			const attribute = expression ? module.parentOf(expression) : null;
			return (
				is(expression, 'JSXExpressionContainer') &&
				is(attribute, 'JSXAttribute') &&
				is((attribute as Node).name, 'JSXIdentifier', { name: 'ref' })
			);
		});
		const handlerUse = symbol.references.some((reference) => {
			const fn = functionParent(module, reference.node);
			return is(fn, 'ArrowFunctionExpression') || is(fn, 'FunctionExpression');
		});
		const setupUse = symbol.references.some((reference) =>
			ancestors(module, reference.node).some(
				(parent) => is(parent, 'IfStatement') && is(parent.test, 'BinaryExpression'),
			),
		);
		if (!jsxRef && !handlerUse && !setupUse)
			violations.push(
				violation(
					file,
					'R-RF1',
					`${ref.name} is not backed by an emitted handle or setup record`,
				),
			);
		for (const reference of symbol.references) {
			const current = module.parentOf(reference.node);
			const memberCall = current ? module.parentOf(current) : null;
			const call = memberCall ? module.parentOf(memberCall) : null;
			if (
				!is(current, 'MemberExpression') ||
				propertyName(current) !== 'current' ||
				!is(memberCall, 'MemberExpression') ||
				!is(call, 'CallExpression') ||
				(call as Node).callee !== memberCall
			)
				continue;
			const guarded = ancestors(module, call).some(
				(parent) =>
					is(parent, 'IfStatement') &&
					is(parent.test, 'BinaryExpression', { operator: '!==' }) &&
					is(parent.test.left, 'MemberExpression') &&
					module.symbolOf(parent.test.left.object) === symbol &&
					propertyName(parent.test.left) === 'current' &&
					parent.test.right?.value === null,
			);
			if (!guarded)
				violations.push(
					violation(
						file,
						'R-RF3',
						'Imperative handle access requires a null guard',
						call,
					),
				);
		}
	}

	if (exportedComponents.length < 1)
		violations.push(
			violation(
				file,
				'component-shape',
				`Expected at least one exported function component; found ${exportedComponents.length}`,
			),
		);
	for (const [symbol, ref] of refs) {
		const usedAsJsxRef = symbol.references.some((reference) => {
			const expression = module.parentOf(reference.node);
			const attribute = expression ? module.parentOf(expression) : null;
			return (
				is(expression, 'JSXExpressionContainer') &&
				is(attribute, 'JSXAttribute') &&
				is((attribute as Node).name, 'JSXIdentifier', { name: 'ref' })
			);
		});
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
			const expression = module.parentOf(reference.node);
			const attribute = expression ? module.parentOf(expression) : null;
			const jsxRef =
				is(expression, 'JSXExpressionContainer') &&
				is(attribute, 'JSXAttribute') &&
				is((attribute as Node).name, 'JSXIdentifier', { name: 'ref' });
			if (componentRender && !setupGuard && !jsxRef)
				violations.push(
					violation(
						file,
						'ref-visibility',
						`${ref.name}.current is allowed only in its setup guard or a handler`,
						reference.node,
					),
				);
		}
		if (usedAsJsxRef || !is(ref.initial, 'Literal') || ref.initial.value !== null) continue;
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
