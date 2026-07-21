import { analyze, type Module, type Symbol as YukuSymbol } from 'yuku-analyzer';
import { parse } from 'yuku-parser';
import type { GateViolation } from './index.ts';

type Node = any;
type Violate = (file: string, policy: string, message: string, node?: Node) => GateViolation;
type Imported = { readonly source: string; readonly imported: string };
const ALLOWED_IMPORTS = new Map([
	['solid-js', new Set(['createSignal', 'untrack', 'For', 'Show'])],
	['solid-js/store', new Set(['createStore', 'produce', 'reconcile'])],
]);
const EFFECTS = new Set(['createEffect', 'createRenderEffect', 'createComputed', 'onMount']);
const is = (node: unknown, type: string, properties?: Record<string, unknown>): boolean =>
	Boolean(
		node &&
		typeof node === 'object' &&
		(node as Node).type === type &&
		(!properties ||
			Object.entries(properties).every(([key, value]) => (node as Node)[key] === value)),
	);

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
function propertyName(node: Node): string | null {
	if (!is(node, 'MemberExpression') && !is(node, 'Property')) return null;
	const value = is(node, 'MemberExpression') ? node.property : node.key;
	if (!node.computed && is(value, 'Identifier')) return value.name;
	return is(value, 'Literal') && typeof value.value === 'string' ? value.value : null;
}
function jsxName(node: Node): string {
	return is(node, 'JSXIdentifier') ? node.name : `${node.namespace.name}:${node.name.name}`;
}
function attribute(opening: Node, name: string): Node | undefined {
	return opening.attributes.find(
		(entry: Node) => is(entry, 'JSXAttribute') && jsxName(entry.name) === name,
	);
}
function expressionValue(value: Node): Node | null {
	return is(value, 'JSXExpressionContainer') && value.expression?.type !== 'JSXEmptyExpression'
		? value.expression
		: null;
}
function containsJsx(node: unknown): boolean {
	if (!node || typeof node !== 'object') return false;
	if (is(node, 'JSXElement') || is(node, 'JSXFragment')) return true;
	return Object.entries(node).some(
		([key, value]) =>
			!['start', 'end', 'loc'].includes(key) &&
			(Array.isArray(value) ? value.some(containsJsx) : containsJsx(value)),
	);
}
function equivalent(left: unknown, right: unknown): boolean {
	const ignored = new Set([
		'start',
		'end',
		'loc',
		'raw',
		'comments',
		'leadingComments',
		'trailingComments',
	]);
	const normalize = (value: any): any => {
		if (Array.isArray(value)) return value.map(normalize);
		if (!value || typeof value !== 'object') return value;
		return Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => !ignored.has(key))
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, child]) => [key, normalize(child)]),
		);
	};
	return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
function jsxSubtreeStructures(value: unknown): Set<string> {
	const structures = new Set<string>();
	const ignored = new Set([
		'start',
		'end',
		'loc',
		'raw',
		'comments',
		'leadingComments',
		'trailingComments',
	]);
	const normalize = (node: any): any => {
		if (Array.isArray(node)) return node.map(normalize);
		if (!node || typeof node !== 'object') return node;
		return Object.fromEntries(
			Object.entries(node)
				.filter(([key]) => !ignored.has(key))
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, child]) => [key, normalize(child)]),
		);
	};
	const visit = (node: any): void => {
		if (!node || typeof node !== 'object') return;
		if (node.type === 'JSXElement') structures.add(JSON.stringify(normalize(node)));
		for (const [key, child] of Object.entries(node)) {
			if (ignored.has(key)) continue;
			if (Array.isArray(child)) child.forEach(visit);
			else visit(child);
		}
	};
	visit(value);
	return structures;
}

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
	const imports = new Map<YukuSymbol, Imported>();
	for (const imported of module.imports)
		if (imported.local && imported.name)
			imports.set(imported.local, { source: imported.specifier, imported: imported.name });
	const signalSetters = new Set<YukuSymbol>();
	const storeSetters = new Set<YukuSymbol>();
	const getters = new Set<YukuSymbol>();
	const reconcileKeys: string[] = [];
	const rowProperties = new Set<string>();

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
	type InitialKind = 'scalar' | 'aggregate' | 'unknown';
	function initialKind(node: Node, seen = new Set<YukuSymbol>()): InitialKind {
		if (!node) return 'unknown';
		if (is(node, 'ArrayExpression') || is(node, 'ObjectExpression')) return 'aggregate';
		if (
			is(node, 'Literal') &&
			(node.value === null || ['string', 'number', 'boolean'].includes(typeof node.value))
		)
			return 'scalar';
		if (is(node, 'Identifier')) {
			const symbol = module.symbolOf(node);
			if (!symbol || seen.has(symbol)) return 'unknown';
			seen.add(symbol);
			const owner = declarationOwner(symbol);
			return is(owner, 'VariableDeclarator') ? initialKind(owner.init, seen) : 'unknown';
		}
		if (
			['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(
				node.type,
			)
		) {
			if (!is(node.body, 'BlockStatement')) return initialKind(node.body, seen);
			const returns = node.body.body.filter((statement: Node) =>
				is(statement, 'ReturnStatement'),
			);
			return returns.length === 1 ? initialKind(returns[0].argument, seen) : 'unknown';
		}
		if (is(node, 'CallExpression')) {
			if (is(node.callee, 'Identifier')) {
				const symbol = module.symbolOf(node.callee);
				if (symbol && imports.get(symbol)?.imported === 'untrack')
					return initialKind(node.arguments[0], seen);
				if (!symbol || seen.has(symbol)) return 'unknown';
				seen.add(symbol);
				const owner = declarationOwner(symbol);
				if (is(owner, 'FunctionDeclaration')) return initialKind(owner, seen);
				if (is(owner, 'VariableDeclarator')) return initialKind(owner.init, seen);
			}
			if (is(node.callee, 'MemberExpression')) {
				const method = propertyName(node.callee);
				if (method === 'map' || method === 'filter') return 'aggregate';
				if (is(node.callee.object, 'Identifier', { name: 'Array' }) && method === 'from')
					return 'aggregate';
			}
		}
		if (is(node, 'ConditionalExpression')) {
			const consequent = initialKind(node.consequent, new Set(seen));
			const alternate = initialKind(node.alternate, new Set(seen));
			return consequent === alternate ? consequent : 'unknown';
		}
		if (is(node, 'SequenceExpression'))
			return node.expressions.length ? initialKind(node.expressions.at(-1), seen) : 'unknown';
		return 'unknown';
	}

	module.walk({
		VariableDeclarator(node: Node) {
			if (
				!is(node.id, 'ArrayPattern') ||
				!is(node.init, 'CallExpression') ||
				!is(node.init.callee, 'Identifier')
			)
				return;
			const primitive = imports.get(module.symbolOf(node.init.callee)!);
			if (!primitive || !['createSignal', 'createStore'].includes(primitive.imported)) return;
			const getter = node.id.elements[0];
			const setter = node.id.elements[1];
			const getterSymbol = is(getter, 'Identifier') ? module.symbolOf(getter) : null;
			const setterSymbol = is(setter, 'Identifier') ? module.symbolOf(setter) : null;
			if (getterSymbol) getters.add(getterSymbol);
			if (setterSymbol)
				(primitive.imported === 'createSignal' ? signalSetters : storeSetters).add(
					setterSymbol,
				);
			const kind = initialKind(node.init.arguments[0]);
			if (primitive.imported === 'createSignal' && kind === 'aggregate')
				violations.push(
					violation(file, 'cell-type', 'Object/array cells must use createStore', node),
				);
			if (primitive.imported === 'createStore' && kind === 'scalar')
				violations.push(
					violation(file, 'cell-type', 'Scalar cells must use createSignal', node),
				);
		},
	});

	type Callable =
		| { kind: 'signal-setter' | 'store-setter' | 'effect' }
		| { kind: 'helper'; node: Node };
	function callable(callee: Node, trail = new Set<YukuSymbol>()): Callable | null {
		if (!callee) return null;
		if (is(callee, 'ArrowFunctionExpression') || is(callee, 'FunctionExpression'))
			return { kind: 'helper', node: callee };
		if (is(callee, 'Identifier')) {
			const symbol = module.symbolOf(callee);
			if (!symbol || trail.has(symbol)) return null;
			if (signalSetters.has(symbol)) return { kind: 'signal-setter' };
			if (storeSetters.has(symbol)) return { kind: 'store-setter' };
			if (EFFECTS.has(imports.get(symbol)?.imported ?? '')) return { kind: 'effect' };
			trail.add(symbol);
			const owner = declarationOwner(symbol);
			if (is(owner, 'FunctionDeclaration')) return { kind: 'helper', node: owner };
			if (is(owner, 'VariableDeclarator')) {
				if (
					is(owner.init, 'ArrowFunctionExpression') ||
					is(owner.init, 'FunctionExpression')
				)
					return { kind: 'helper', node: owner.init };
				return callable(owner.init, trail);
			}
			return null;
		}
		if (is(callee, 'MemberExpression')) {
			const name = callablePropertyName(callee);
			let object = callee.object;
			if (is(object, 'Identifier')) {
				const symbol = module.symbolOf(object);
				const owner = symbol ? declarationOwner(symbol) : null;
				if (!symbol || trail.has(symbol) || !is(owner, 'VariableDeclarator')) return null;
				trail.add(symbol);
				object = owner.init;
			}
			if (!is(object, 'ObjectExpression')) return null;
			if (name != null) {
				for (const property of object.properties)
					if (is(property, 'Property') && callablePropertyName(property) === name) {
						const resolved = callable(property.value, new Set(trail));
						if (resolved) return resolved;
					}
				return null;
			}
			for (const property of object.properties) {
				if (!is(property, 'Property')) continue;
				const resolved = callable(property.value, new Set(trail));
				if (
					resolved?.kind === 'signal-setter' ||
					resolved?.kind === 'store-setter'
				)
					return resolved;
			}
		}
		return null;
	}

	function hasSymbolRead(root: Node, symbol: YukuSymbol): boolean {
		let found = false;
		module.walk(
			{
				Identifier(node: Node) {
					if (module.symbolOf(node) === symbol) found = true;
				},
			},
			root,
		);
		return found;
	}
	function inspectHandler(
		fn: Node,
		eventSymbols: ReadonlySet<YukuSymbol>,
		leaf: boolean,
		inspecting = new Set<Node>(),
	): void {
		if (inspecting.has(fn)) return;
		inspecting.add(fn);
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
				MemberExpression(node: Node) {
					if (!leaf || propertyName(node) !== 'target' || !is(node.object, 'Identifier'))
						return;
					const symbol = module.symbolOf(node.object);
					if (symbol && eventSymbols.has(symbol))
						violations.push(
							violation(
								file,
								'leaf-event-target',
								'Leaf controls must read event.currentTarget, not event.target',
								node,
							),
						);
				},
				CallExpression(node: Node) {
					const resolved = callable(node.callee);
					if (resolved?.kind === 'signal-setter' && node.arguments.length !== 1)
						violations.push(
							violation(
								file,
								'signal-write-shape',
								'Signal setters require exactly one authored value',
								node,
							),
						);
					if (resolved?.kind === 'store-setter') {
						const write = node.arguments[0];
						const primitive =
							is(write, 'CallExpression') && is(write.callee, 'Identifier')
								? imports.get(module.symbolOf(write.callee)!)?.imported
								: null;
						if (
							node.arguments.length !== 1 ||
							!primitive ||
							!['produce', 'reconcile'].includes(primitive)
						)
							violations.push(
								violation(
									file,
									'store-write-shape',
									'Store writes require one produce or reconcile operation',
									node,
								),
							);
					}
					if (resolved?.kind === 'helper') {
						const helperEvents = new Set(eventSymbols);
						for (const [index, argument] of node.arguments.entries())
							if (is(argument, 'Identifier')) {
								const argumentSymbol = module.symbolOf(argument);
								const parameter = resolved.node.params[index];
								const parameterSymbol = is(parameter, 'Identifier')
									? module.symbolOf(parameter)
									: null;
								if (
									argumentSymbol &&
									eventSymbols.has(argumentSymbol) &&
									parameterSymbol
								)
									helperEvents.add(parameterSymbol);
							}
						inspectHandler(resolved.node, helperEvents, leaf, inspecting);
					}
					if (
						is(node.callee, 'MemberExpression') &&
						propertyName(node.callee) === 'preventDefault'
					) {
						const object = node.callee.object;
						const symbol = is(object, 'Identifier') ? module.symbolOf(object) : null;
						if (!symbol || !eventSymbols.has(symbol))
							violations.push(
								violation(
									file,
									'prevent-default-event',
									'preventDefault must be called on the handler event parameter',
									node,
								),
							);
					}
				},
			},
			fn,
		);
		inspecting.delete(fn);
	}

	const exported: Node[] = [];
	module.walk({
		ImportDeclaration(node: Node) {
			const allowed = ALLOWED_IMPORTS.get(node.source.value);
			if (!allowed) {
				violations.push(
					violation(
						file,
						'undisclosed-import',
						`Undisclosed import: ${node.source.value}`,
						node,
					),
				);
				return;
			}
			for (const specifier of node.specifiers) {
				const imported = is(specifier, 'ImportSpecifier')
					? (specifier.imported.name ?? specifier.imported.value)
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
			if (
				is(node.callee, 'MemberExpression') &&
				propertyName(node.callee) === 'stopPropagation'
			)
				violations.push(
					violation(
						file,
						'stop-propagation',
						'stopPropagation is forbidden for delegated handlers',
						node,
					),
				);
			if (!is(node.callee, 'Identifier')) return;
			const imported = imports.get(module.symbolOf(node.callee)!);
			if (imported?.imported === 'untrack') {
				const capture = node.arguments[0];
				if (
					node.arguments.length !== 1 ||
					!is(capture, 'ArrowFunctionExpression') ||
					capture.async ||
					capture.params.length !== 0 ||
					is(capture.body, 'BlockStatement')
				)
					violations.push(
						violation(
							file,
							'untrack-capture-shape',
							'untrack once-captures require one synchronous zero-argument function',
							node,
						),
					);
			}
			if (imported?.imported === 'reconcile') {
				const options = node.arguments[1];
				const key = is(options, 'ObjectExpression')
					? options.properties.find(
							(entry: Node) => is(entry, 'Property') && propertyName(entry) === 'key',
						)
					: null;
				if (!key || !is(key.value, 'Literal') || typeof key.value.value !== 'string')
					violations.push(
						violation(
							file,
							'reconcile-key',
							'Keyed structural reconciliation requires a literal key option',
							node,
						),
					);
				else reconcileKeys.push(key.value.value);
			}
		},
		ConditionalExpression(node: Node) {
			if (
				ancestors(module, node).some((parent) => is(parent, 'JSXExpressionContainer')) &&
				(containsJsx(node.consequent) || containsJsx(node.alternate))
			)
				violations.push(
					violation(
						file,
						'structural-ternary',
						'Structural JSX branches must use Show',
						node,
					),
				);
		},
		JSXAttribute(node: Node) {
			const name = jsxName(node.name);
			if (name === 'className' || name === 'htmlFor')
				violations.push(
					violation(
						file,
						'react-specific-props',
						`${name} is a React-specific prop`,
						node,
					),
				);
			const handler = expressionValue(node.value);
			if (!is(handler, 'ArrowFunctionExpression') && !is(handler, 'FunctionExpression'))
				return;
			const opening = ancestors(module, node).find((parent) =>
				is(parent, 'JSXOpeningElement'),
			);
			const leaf = Boolean(
				opening &&
				is(opening.name, 'JSXIdentifier') &&
				['input', 'textarea', 'select'].includes(opening.name.name),
			);
			const parameter = handler.params[0];
			const eventSymbol = is(parameter, 'Identifier') ? module.symbolOf(parameter) : null;
			inspectHandler(handler, new Set(eventSymbol ? [eventSymbol] : []), leaf);
		},
		JSXOpeningElement(node: Node) {
			if (!is(node.name, 'JSXIdentifier')) return;
			const primitive = imports.get(module.symbolOf(node.name)!)?.imported;
			if (primitive === 'Show') {
				const fallback = attribute(node, 'fallback');
				const fallbackValue = fallback?.value;
				const emptyFallback =
					is(fallbackValue, 'JSXExpressionContainer') &&
					is(fallbackValue.expression, 'JSXFragment') &&
					fallbackValue.expression.children.length === 0;
				if (!attribute(node, 'when') || emptyFallback)
					violations.push(
						violation(
							file,
							'show-two-arm',
							'Show requires explicit when; empty-fragment fallback is forbidden',
							node,
						),
					);
				const show = module.parentOf(node) as Node;
				const fallbackExpression = fallbackValue ? expressionValue(fallbackValue) : null;
				if (is(show, 'JSXElement') && fallbackExpression) {
					const children = jsxSubtreeStructures(show.children);
					const fallbacks = jsxSubtreeStructures(fallbackExpression);
					if ([...children].some((structure) => fallbacks.has(structure)))
						violations.push(
							violation(
								file,
								'show-two-arm',
								'Show contains duplicated-arm element content; hoist shared content outside the branch',
								node,
							),
						);
				}
			}
			if (['input', 'textarea', 'select'].includes(node.name.name)) {
				const value = attribute(node, 'value');
				const attrValue = attribute(node, 'attr:value');
				const onInput = attribute(node, 'onInput');
				const onChange = attribute(node, 'onChange');
				const checked = attribute(node, 'checked');
				const live = value ? expressionValue(value.value) : null;
				const attr = attrValue ? expressionValue(attrValue.value) : null;
				if (value && (!onInput || !attrValue || !live || !attr || !equivalent(live, attr)))
					violations.push(
						violation(
							file,
							'controlled-input',
							'Controlled text value requires onInput and an identical attr:value pair',
							node,
						),
					);
				if (value && onChange)
					violations.push(
						violation(
							file,
							'controlled-input',
							'Controlled text inputs must not use React onChange semantics',
							node,
						),
					);
				if (attrValue && !value)
					violations.push(
						violation(
							file,
							'controlled-input',
							'attr:value requires its live value pair',
							node,
						),
					);
				if (checked && !onChange)
					violations.push(
						violation(
							file,
							'controlled-input',
							'Controlled checked requires onChange',
							node,
						),
					);
			}
			if (primitive !== 'For') return;
			const each = attribute(node, 'each');
			const eachExpression = each ? expressionValue(each.value) : null;
			const collectionSymbol = is(eachExpression, 'Identifier')
				? module.symbolOf(eachExpression)
				: is(eachExpression, 'CallExpression') && is(eachExpression.callee, 'Identifier')
					? module.symbolOf(eachExpression.callee)
					: null;
			const show = module.parentOf(node) as Node;
			const container = show.children.find((child: Node) =>
				is(child, 'JSXExpressionContainer'),
			);
			const child = container?.expression;
			if (!is(child, 'ArrowFunctionExpression')) return;
			if (child.params.length > 1)
				violations.push(
					violation(
						file,
						'index-accessor',
						'For rows may not consume the index accessor',
						child.params[1],
					),
				);
			const rowSymbol = is(child.params[0], 'Identifier')
				? module.symbolOf(child.params[0])
				: null;
			module.walk(
				{
					MemberExpression(member: Node) {
						if (
							is(member.object, 'Identifier') &&
							module.symbolOf(member.object) === rowSymbol
						) {
							const name = propertyName(member);
							if (name) rowProperties.add(name);
						}
					},
					CallExpression(call: Node) {
						if (is(call.callee, 'Identifier') && call.arguments.length === 0) {
							const symbol = module.symbolOf(call.callee);
							if (symbol === collectionSymbol && symbol && getters.has(symbol))
								violations.push(
									violation(
										file,
										'collection-accessor-in-row',
										'A For row binding may not refresh through a whole-collection accessor',
										call,
									),
								);
						}
					},
				},
				child,
			);
		},
		MemberExpression(node: Node) {
			const owner = functionParent(module, node);
			if (
				propertyName(node) === 'map' &&
				ancestors(module, node).some((parent) => is(parent, 'JSXExpressionContainer')) &&
				is(owner, 'FunctionDeclaration') &&
				is(module.parentOf(owner), 'ExportNamedDeclaration')
			)
				violations.push(
					violation(
						file,
						'map-render',
						'Rendered collections must use For, not map',
						node,
					),
				);
		},
		FunctionDeclaration(node: Node) {
			if (!is(module.parentOf(node), 'ExportNamedDeclaration')) return;
			exported.push(node);
			if (
				!node.id ||
				!/^\p{Lu}/u.test(node.id.name) ||
				node.params.length !== 1 ||
				!is(node.params[0], 'Identifier')
			)
				violations.push(
					violation(
						file,
						'component-shape',
						'Exported component must be one PascalCase function with one props identifier',
						node,
					),
				);
			const parameter = node.params[0];
			if (!is(parameter, 'Identifier')) return;
			const propsSymbol = module.symbolOf(parameter);
			if (!propsSymbol) return;
			for (const statement of node.body.body) {
				if (is(statement, 'VariableDeclaration'))
					for (const declaration of statement.declarations) {
						if (
							(is(declaration.id, 'ObjectPattern') ||
								is(declaration.id, 'ArrayPattern')) &&
							is(declaration.init, 'Identifier') &&
							module.symbolOf(declaration.init) === propsSymbol
						)
							violations.push(
								violation(
									file,
									'props-destructure',
									'Solid props may not be destructured',
									declaration,
								),
							);
						const init = declaration.init;
						if (
							!init ||
							!hasSymbolRead(init, propsSymbol) ||
							is(init, 'ArrowFunctionExpression')
						)
							continue;
						const imported =
							is(init, 'CallExpression') && is(init.callee, 'Identifier')
								? imports.get(module.symbolOf(init.callee)!)?.imported
								: null;
						const wrapped =
							['createSignal', 'createStore'].includes(imported ?? '') &&
							init.arguments.some(
								(argument: Node) =>
									is(argument, 'CallExpression') &&
									is(argument.callee, 'Identifier') &&
									imports.get(module.symbolOf(argument.callee)!)?.imported ===
										'untrack',
							);
						if (imported !== 'untrack' && !wrapped)
							violations.push(
								violation(
									file,
									'untrack-once-capture',
									'Prop-reading setup initializers must be wrapped in untrack',
									init,
								),
							);
					}
				else if (
					is(statement, 'ExpressionStatement') &&
					hasSymbolRead(statement, propsSymbol)
				) {
					const value = statement.expression;
					const imported =
						is(value, 'CallExpression') && is(value.callee, 'Identifier')
							? imports.get(module.symbolOf(value.callee)!)?.imported
							: null;
					if (imported !== 'untrack')
						violations.push(
							violation(
								file,
								'untrack-once-capture',
								'Prop-reading setup expressions must be wrapped in untrack',
								statement,
							),
						);
				}
			}
			const seen = new Set<Node>();
			const inspect = (owner: Node): void => {
				if (seen.has(owner)) return;
				seen.add(owner);
				module.walk(
					{
						enter(candidate: Node, context: any) {
							if (
								candidate !== owner &&
								[
									'FunctionDeclaration',
									'FunctionExpression',
									'ArrowFunctionExpression',
								].includes(candidate.type)
							)
								context.skip();
						},
						CallExpression(call: Node) {
							const resolved = callable(call.callee);
							if (
								resolved?.kind === 'signal-setter' ||
								resolved?.kind === 'store-setter'
							)
								violations.push(
									violation(
										file,
										'render-phase-setter',
										'A state setter is reachable during component setup',
										call,
									),
								);
							else if (resolved?.kind === 'effect')
								violations.push(
									violation(
										file,
										'render-phase-effect',
										'Effects are forbidden in this fixture family',
										call,
									),
								);
							else if (resolved?.kind === 'helper') inspect(resolved.node);
						},
					},
					owner,
				);
			};
			inspect(node);
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
