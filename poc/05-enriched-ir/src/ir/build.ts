import { buildSemanticGraph, lowerStateAccess } from '@markless/compiler';
import type {
	LoweredStateWrite,
	SemanticGraphAlias,
	SemanticGraphArtifact,
	StateLoweringArtifact,
} from '@markless/compiler';
import { parseModule } from '@tsrx/core';
import type { CompileError } from '@tsrx/core/types';
import {
	ENRICHED_IR_VERSION,
	type DynamicBinding,
	type EnrichedAliasRecord,
	type EnrichedComponent,
	type EnrichedEventRecord,
	type EnrichedGraphBinding,
	type EnrichedIR,
	type EventHandlerRecord,
	type ExpressionSite,
	type GraphReadRef,
	type GuardResult,
	type JsonValue,
	type LocalDeclaration,
	type PropDestructuringEntry,
	type SerializableAstNode,
	type StateReadRecord,
	type StateWriteRecord,
	type StaticAttribute,
	type TemplateBranchArm,
	type TemplateHost,
	type TemplateNode,
} from './schema';

type AnyNode = { type: string; start?: number; end?: number; [key: string]: any };

interface BuildInput {
	readonly filename: string;
	readonly source: string;
}

interface LocalInfo {
	readonly node: AnyNode;
	readonly initializer: AnyNode | null;
}

interface ReadEnvironment {
	readonly bindings: ReadonlyMap<string, { id: string }>;
	readonly aliases: ReadonlyMap<string, { graphNodeId: string; path: readonly string[] }>;
	readonly locals: ReadonlyMap<string, LocalInfo>;
	readonly repeatItems: ReadonlyMap<string, { graphNodeId: string; path: readonly string[] }>;
}

interface ComponentWork {
	readonly name: string;
	readonly fn: AnyNode;
	readonly body: AnyNode;
	readonly locals: ReadonlyMap<string, LocalInfo>;
	readonly declarations: readonly AnyNode[];
}

interface TemplateContext {
	readonly graph: SemanticGraphArtifact;
	readonly hostNodes: SemanticGraphArtifact['hostNodes'];
	readonly branchSites: SemanticGraphArtifact['branchSites'];
	readonly repeats: SemanticGraphArtifact['keyedRepeats'];
	readonly eventHandlers: Map<string, { node: AnyNode; environment: ReadEnvironment }[]>;
	hostCursor: number;
	branchCursor: number;
	repeatCursor: number;
	textCursor: number;
	fragmentCursor: number;
}

const OMITTED_AST_KEYS = new Set([
	'metadata',
	'parent',
	'path',
	'loc',
	'range',
	'leadingComments',
	'trailingComments',
	'innerComments',
]);

/** Build the target-neutral emitter artifact from author source and semantic records. */
export async function buildEnrichedIr({ filename, source }: BuildInput): Promise<EnrichedIR> {
	const parseErrors: CompileError[] = [];
	const program = parseModule(source, filename, { collect: true, errors: parseErrors }) as AnyNode;
	if (parseErrors.length > 0) {
		throw new Error(`TSRX parse failed for ${filename}: ${String(parseErrors[0])}`);
	}

	// Deliberately stop after semantic graph + state lowering. Payload, public-render,
	// locator, resume, and symbol passes are neither requested nor consumed here.
	const semanticGraph = await buildSemanticGraph({ filename, source });
	const stateLowering = lowerStateAccess({ semanticGraph });
	const errors = [...semanticGraph.diagnostics, ...stateLowering.diagnostics].filter(
		(diagnostic) => diagnostic.severity === 'error',
	);
	if (errors.length > 0) {
		throw new Error(
			`Markless semantic compilation failed for ${filename}: ${errors
				.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
				.join('; ')}`,
		);
	}

	const components = findComponents(program);
	const bindingsByName = new Map(
		semanticGraph.graphBindings.map((binding) => [binding.name, { id: binding.id }]),
	);
	const aliases = resolveAliases(semanticGraph, components);
	const aliasesByName = new Map(
		aliases.map((alias) => [alias.name, { graphNodeId: alias.graphNodeId, path: alias.path }]),
	);
	const allNodes = collectAstNodes(program);
	const writes = stateLowering.writes.map((write) => enrichWrite(write, allNodes));
	const reads = dedupeStateReads(stateLowering);
	const aliasIds = new Map(aliases.map((alias) => [alias.name, alias.id]));

	const templateContext: TemplateContext = {
		graph: semanticGraph,
		hostNodes: semanticGraph.hostNodes,
		branchSites: semanticGraph.branchSites,
		repeats: semanticGraph.keyedRepeats,
		eventHandlers: new Map(),
		hostCursor: 0,
		branchCursor: 0,
		repeatCursor: 0,
		textCursor: 0,
		fragmentCursor: 0,
	};

	const enrichedComponents = components.map((component) => {
		const environment: ReadEnvironment = {
			bindings: bindingsByName,
			aliases: aliasesByName,
			locals: component.locals,
			repeatItems: new Map(),
		};
		return enrichComponent(
			component,
			environment,
			templateContext,
			semanticGraph,
			aliasIds,
		);
	});

	assertFullyConsumed(templateContext);

	const events: EnrichedEventRecord[] = semanticGraph.events.map((event) => {
		const handlers = templateContext.eventHandlers.get(event.id) ?? [];
		if (handlers.length !== event.handlerCount) {
			throw new Error(
				`Event ${event.id} expected ${event.handlerCount} handler AST(s), found ${handlers.length}.`,
			);
		}
		return {
			id: event.id,
			hostNodeId: event.hostNodeId,
			eventName: event.eventName,
			...(event.syncPolicy ? { syncPolicy: event.syncPolicy } : {}),
			handlers: handlers.map(({ node, environment }): EventHandlerRecord => ({
				expression: serializeAst(node),
				reads: deriveReads(node, environment),
				writes: writes.filter((write) => spanInside(write.sourceSpan, node)),
			})),
		};
	});

	const bindings = semanticGraph.graphBindings.map((binding): EnrichedGraphBinding => {
		const owner = components.find((component) => component.locals.has(binding.name));
		const local = owner?.locals.get(binding.name);
		const environment: ReadEnvironment = {
			bindings: bindingsByName,
			aliases: aliasesByName,
			locals: owner?.locals ?? new Map(),
			repeatItems: new Map(),
		};
		const helperArgument = helperCallArgument(local?.initializer, binding.kind);
		const computed = binding.kind === 'computed' && helperArgument
			? expressionSite(helperArgument, environment)
			: undefined;

		return compactObject({
			id: binding.id,
			name: binding.name,
			kind: binding.kind,
			declarationKind: binding.declarationKind,
			writable: binding.writable,
			valueKind: binding.valueKind,
			async: binding.async,
			asyncCapable: binding.asyncCapable,
			initialValue: toJsonValue(binding.initialValue),
			initializer:
				binding.kind === 'state' && helperArgument ? serializeAst(helperArgument) : undefined,
			computed,
			reads: reads.filter((read) => read.graphNodeId === binding.id),
			writes: writes.filter((write) => write.graphNodeId === binding.id),
		}) as unknown as EnrichedGraphBinding;
	});

	return {
		version: ENRICHED_IR_VERSION,
		filename,
		imports: [...semanticGraph.moduleImports],
		components: enrichedComponents,
		records: {
			bindings,
			aliases,
			events,
			stateReads: reads,
			stateWrites: writes,
		},
	};
}

function findComponents(program: AnyNode): ComponentWork[] {
	const found: ComponentWork[] = [];
	for (const statement of program.body ?? []) {
		const candidate =
			statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
				? statement.declaration
				: statement;
		if (candidate?.type !== 'FunctionDeclaration' || candidate.body?.type !== 'JSXCodeBlock') {
			continue;
		}
		const declarations = (candidate.body.body ?? []).filter(
			(node: AnyNode) => node.type === 'VariableDeclaration',
		);
		const locals = new Map<string, LocalInfo>();
		for (const declaration of declarations) {
			for (const declarator of declaration.declarations ?? []) {
				for (const name of patternNames(declarator.id)) {
					locals.set(name, { node: declarator, initializer: declarator.init ?? null });
				}
			}
		}
		found.push({
			name: candidate.id?.name ?? 'default',
			fn: candidate,
			body: candidate.body,
			locals,
			declarations,
		});
	}
	if (found.length === 0) throw new Error('No TSRX component function was found.');
	return found;
}

function enrichComponent(
	component: ComponentWork,
	environment: ReadEnvironment,
	context: TemplateContext,
	graph: SemanticGraphArtifact,
	aliasIds: ReadonlyMap<string, string>,
): EnrichedComponent {
	let declarationOrder = 0;
	const locals: LocalDeclaration[] = [];
	for (const declaration of component.declarations) {
		for (const declarator of declaration.declarations ?? []) {
			const names = patternNames(declarator.id);
			locals.push({
				order: declarationOrder++,
				declarationKind: declaration.kind,
				names,
				pattern: serializeAst(declarator.id),
				initializer: declarator.init ? serializeAst(declarator.init) : null,
				reads: declarator.init ? deriveReads(declarator.init, environment) : [],
				semanticRecordIds: names
					.flatMap((name) => [
						...graph.graphBindings.filter((binding) => binding.name === name).map((binding) => binding.id),
						...(aliasIds.has(name) ? [aliasIds.get(name)!] : []),
					])
					.sort(),
			});
		}
	}

	const guards = (component.body.body ?? [])
		.map((statement: AnyNode, index: number) => {
			const returned = guardReturn(statement);
			if (!returned) return null;
			return {
				id: `guard:${component.name}:${index}`,
				test: expressionSite(statement.test, environment),
				whenTrue: guardResult(returned.argument, environment, context),
			};
		})
		.filter(Boolean) as EnrichedComponent['guards'];

	const template = component.body.render
		? buildTemplateNode(component.body.render, environment, context)
		: [];
	return {
		name: component.name,
		props: {
			graphNodeId: graph.graphBindings.find((binding) => binding.kind === 'prop')?.id ?? 'prop:props',
			entries: propsEntries(component.fn.params?.[0], graph),
		},
		locals,
		guards,
		template,
	};
}

function guardReturn(statement: AnyNode): AnyNode | null {
	if (statement?.type !== 'IfStatement') return null;
	if (statement.consequent?.type === 'ReturnStatement') return statement.consequent;
	if (statement.consequent?.type === 'BlockStatement') {
		return statement.consequent.body?.find((node: AnyNode) => node.type === 'ReturnStatement') ?? null;
	}
	return null;
}

function guardResult(
	argument: AnyNode | null,
	environment: ReadEnvironment,
	context: TemplateContext,
): GuardResult {
	if (!argument || (argument.type === 'Literal' && argument.value === null)) return { kind: 'null' };
	if (isTemplateNode(argument)) {
		return { kind: 'template', children: buildTemplateNode(argument, environment, context) };
	}
	return { kind: 'expression', value: expressionSite(argument, environment) };
}

function propsEntries(parameter: AnyNode | undefined, graph: SemanticGraphArtifact): PropDestructuringEntry[] {
	const propBinding = graph.graphBindings.find((binding) => binding.kind === 'prop');
	if (!parameter || parameter.type !== 'ObjectPattern' || !propBinding) return [];
	const entries: PropDestructuringEntry[] = [];
	for (const property of parameter.properties ?? []) {
		if (property.type === 'RestElement') {
			entries.push({
				sourceName: '*',
				localName: property.argument.name,
				path: [],
				alias: true,
				graphNodeId: propBinding.id,
			});
			continue;
		}
		const sourceName = staticPropertyName(property.key);
		const value = property.value?.type === 'AssignmentPattern' ? property.value.left : property.value;
		const localName = value?.name ?? sourceName;
		entries.push(compactObject({
			sourceName,
			localName,
			path: [sourceName],
			alias: sourceName !== localName,
			graphNodeId: propBinding.id,
			defaultValue:
				property.value?.type === 'AssignmentPattern'
					? serializeAst(property.value.right)
					: undefined,
		}) as unknown as PropDestructuringEntry);
	}
	return entries;
}

function buildTemplateNode(
	node: AnyNode,
	environment: ReadEnvironment,
	context: TemplateContext,
): TemplateNode[] {
	if (!node) return [];
	if (node.type === 'JSXElement' || node.type === 'TSRXJSXElement') {
		const tag = jsxName(node.openingElement?.name);
		if (!tag || /^[A-Z]/.test(tag)) {
			throw new Error(`Component template nodes are outside this fixture-scoped IR: ${tag || node.type}`);
		}
		const semanticHost = context.hostNodes[context.hostCursor++];
		if (!semanticHost || semanticHost.tagName !== tag) {
			throw new Error(
				`Host join mismatch at <${tag}>: expected ${semanticHost?.tagName ?? 'end of host records'}.`,
			);
		}
		const staticAttributes: StaticAttribute[] = [];
		const dynamicBindings: DynamicBinding[] = [];
		const eventIds: string[] = [];
		for (const attribute of node.openingElement.attributes ?? []) {
			if (attribute.type !== 'JSXAttribute') {
				throw new Error('Spread attributes are not representable in arcade-enriched-ir/1.');
			}
			const name = jsxName(attribute.name);
			if (!name) continue;
			const eventName = jsxEventName(name);
			if (eventName) {
				const event = context.graph.events.find(
					(candidate) =>
						candidate.hostNodeId === semanticHost.id && candidate.eventName === eventName,
				);
				if (!event || attribute.value?.type !== 'JSXExpressionContainer') {
					throw new Error(`Could not join ${name} on ${semanticHost.id} to a semantic event.`);
				}
				eventIds.push(event.id);
				const existing = context.eventHandlers.get(event.id) ?? [];
				existing.push({ node: attribute.value.expression, environment });
				context.eventHandlers.set(event.id, existing);
				continue;
			}
			if (attribute.value === null) {
				staticAttributes.push({ name, value: true });
			} else if (attribute.value.type === 'Literal') {
				staticAttributes.push({ name, value: String(attribute.value.value) });
			} else if (attribute.value.type === 'JSXExpressionContainer') {
				const expression = attribute.value.expression;
				const semanticRead = context.graph.templateReads.find(
					(read) =>
						read.hostNodeId === semanticHost.id &&
						read.sourceSpan?.start === expression.start &&
						read.sourceSpan?.end === expression.end,
				);
				const target = semanticRead?.target;
				dynamicBindings.push({
					kind: target?.kind === 'property' ? 'property' : 'attribute',
					name:
						target && 'name' in target && typeof target.name === 'string' ? target.name : name,
					expression: serializeAst(expression),
					reads: deriveReads(expression, environment),
				});
			}
		}
		const children = (node.children ?? []).flatMap((child: AnyNode) =>
			buildTemplateNode(child, environment, context),
		);
		const host: TemplateHost = {
			kind: 'host',
			id: semanticHost.id,
			tag,
			staticAttributes,
			dynamicBindings,
			eventIds,
			children,
		};
		return [host];
	}

	if (node.type === 'JSXText') {
		const value = normalizeJsxText(String(node.value ?? ''));
		return value ? [{ kind: 'text', id: `text:${context.textCursor++}`, value }] : [];
	}

	if (node.type === 'JSXExpressionContainer') {
		if (!node.expression || node.expression.type === 'JSXEmptyExpression') return [];
		return [{
			kind: 'dynamic-text',
			id: `text:${context.textCursor++}`,
			...expressionSite(node.expression, environment),
		}];
	}

	if (node.type === 'JSXIfExpression') {
		const site = context.branchSites[context.branchCursor++];
		if (!site) throw new Error('A TSRX branch has no SemanticGraphArtifact branch record.');
		const arms: TemplateBranchArm[] = [{
			kind: 'then',
			children: blockTemplate(node.consequent, environment, context),
		}];
		if (node.alternate) {
			if (node.alternate.type === 'JSXIfExpression') {
				arms.push({
					kind: 'else-if',
					test: expressionSite(node.alternate.test, environment),
					children: blockTemplate(node.alternate.consequent, environment, context),
				});
			} else {
				arms.push({
					kind: 'else',
					children: blockTemplate(node.alternate, environment, context),
				});
			}
		}
		return [{
			kind: 'branch',
			id: site.id,
			...expressionSite(node.test, environment),
			arms,
		}];
	}

	if (node.type === 'JSXForExpression') {
		const repeat = context.repeats[context.repeatCursor++];
		if (!repeat) throw new Error('A TSRX repeat has no SemanticGraphArtifact repeat record.');
		const collection = expressionSite(node.right, environment);
		const repeatItems = new Map(environment.repeatItems);
		if (repeat.collectionGraphNodeId) {
			repeatItems.set(repeat.itemName, {
				graphNodeId: repeat.collectionGraphNodeId,
				path: repeat.collectionPath,
			});
		}
		const rowEnvironment = { ...environment, repeatItems };
		return [{
			kind: 'keyed-repeat',
			id: repeat.id,
			item: repeat.itemName,
			...(repeat.indexName ? { index: repeat.indexName } : {}),
			collection,
			key: expressionSite(node.key, rowEnvironment),
			row: blockTemplate(node.body, rowEnvironment, context),
			empty: node.empty ? blockTemplate(node.empty, environment, context) : [],
		}];
	}

	if (node.type === 'JSXFragment' || node.type === 'TSRXJSXFragment') {
		return [{
			kind: 'fragment',
			id: `fragment:${context.fragmentCursor++}`,
			children: (node.children ?? []).flatMap((child: AnyNode) =>
				buildTemplateNode(child, environment, context),
			),
		}];
	}

	if (node.type === 'BlockStatement') return blockTemplate(node, environment, context);
	return [];
}

function blockTemplate(
	block: AnyNode,
	environment: ReadEnvironment,
	context: TemplateContext,
): TemplateNode[] {
	return (block.body ?? []).flatMap((child: AnyNode) =>
		buildTemplateNode(child, environment, context),
	);
}

function expressionSite(node: AnyNode, environment: ReadEnvironment): ExpressionSite {
	return { expression: serializeAst(node), reads: deriveReads(node, environment) };
}

function deriveReads(node: AnyNode, environment: ReadEnvironment): GraphReadRef[] {
	const reads: GraphReadRef[] = [];
	const expanding = new Set<string>();

	const addResolved = (name: string, path: readonly string[], bound: ReadonlySet<string>): boolean => {
		if (bound.has(name)) return false;
		const direct = environment.bindings.get(name);
		if (direct) {
			reads.push({ graphNodeId: direct.id, path: [...path], via: 'direct' });
			return true;
		}
		const alias = environment.aliases.get(name);
		if (alias) {
			reads.push({
				graphNodeId: alias.graphNodeId,
				path: [...alias.path, ...path],
				via: 'alias',
			});
			return true;
		}
		const repeat = environment.repeatItems.get(name);
		if (repeat) {
			reads.push({
				graphNodeId: repeat.graphNodeId,
				path: [...repeat.path, ...path],
				via: 'repeat-item',
			});
			return true;
		}
		const local = environment.locals.get(name);
		if (local?.initializer && !expanding.has(name)) {
			expanding.add(name);
			for (const read of deriveReads(local.initializer, environment)) {
				reads.push({ ...read, via: 'local' });
			}
			expanding.delete(name);
			return true;
		}
		return false;
	};

	const visit = (current: AnyNode | null | undefined, bound: ReadonlySet<string>): void => {
		if (!current || typeof current !== 'object') return;
		if (current.type === 'Identifier') {
			addResolved(current.name, [], bound);
			return;
		}
		if (isFunctionNode(current)) {
			const nextBound = new Set(bound);
			for (const parameter of current.params ?? []) {
				for (const name of patternNames(parameter)) nextBound.add(name);
			}
			visit(current.body, nextBound);
			return;
		}
		if (current.type === 'BlockStatement') {
			const nextBound = new Set(bound);
			for (const statement of current.body ?? []) {
				if (statement.type === 'VariableDeclaration') {
					for (const declaration of statement.declarations ?? []) {
						for (const name of patternNames(declaration.id)) nextBound.add(name);
					}
				}
				if (statement.type === 'FunctionDeclaration' && statement.id?.name) {
					nextBound.add(statement.id.name);
				}
			}
			for (const statement of current.body ?? []) visit(statement, nextBound);
			return;
		}
		if (current.type === 'VariableDeclarator') {
			visit(current.init, bound);
			return;
		}
		if (current.type === 'MemberExpression' || current.type === 'ChainExpression') {
			const unwrapped = current.type === 'ChainExpression' ? current.expression : current;
			const chain = memberChain(unwrapped);
			if (chain && addResolved(chain.root, chain.path, bound)) {
				for (const computed of chain.computed) visit(computed, bound);
				return;
			}
			visit(unwrapped.object, bound);
			if (unwrapped.computed) visit(unwrapped.property, bound);
			return;
		}
		if (current.type === 'CallExpression' || current.type === 'NewExpression') {
			if (current.callee?.type === 'MemberExpression') {
				const chain = memberChain(current.callee);
				if (chain && addResolved(chain.root, chain.path.slice(0, -1), bound)) {
					for (const computed of chain.computed) visit(computed, bound);
				} else {
					visit(current.callee, bound);
				}
			} else {
				visit(current.callee, bound);
			}
			for (const argument of current.arguments ?? []) visit(argument, bound);
			return;
		}
		if (current.type === 'Property') {
			if (current.computed) visit(current.key, bound);
			visit(current.value, bound);
			return;
		}
		if (current.type === 'AssignmentExpression') {
			if (current.operator !== '=') visit(current.left, bound);
			visit(current.right, bound);
			return;
		}
		if (current.type === 'UpdateExpression') {
			visit(current.argument, bound);
			return;
		}
		for (const [key, value] of Object.entries(current)) {
			if (OMITTED_AST_KEYS.has(key) || key === 'type' || key === 'start' || key === 'end') continue;
			if (Array.isArray(value)) {
				for (const child of value) if (isNode(child)) visit(child, bound);
			} else if (isNode(value)) {
				visit(value, bound);
			}
		}
	};

	visit(node, new Set());
	return dedupeReads(reads);
}

function memberChain(node: AnyNode): { root: string; path: string[]; computed: AnyNode[] } | null {
	if (node.type === 'Identifier') return { root: node.name, path: [], computed: [] };
	if (node.type !== 'MemberExpression') return null;
	const parent = memberChain(node.object);
	if (!parent) return null;
	if (!node.computed && node.property?.type === 'Identifier') {
		return { ...parent, path: [...parent.path, node.property.name] };
	}
	if (node.computed && node.property?.type === 'Literal') {
		return { ...parent, path: [...parent.path, String(node.property.value)] };
	}
	return { ...parent, path: [...parent.path, '*'], computed: [...parent.computed, node.property] };
}

function resolveAliases(
	graph: SemanticGraphArtifact,
	components: readonly ComponentWork[],
): EnrichedAliasRecord[] {
	return graph.aliases.map((alias: SemanticGraphAlias) => {
		const [root, ...path] = alias.target.split('.');
		const binding = graph.graphBindings.find((candidate) => candidate.name === root);
		if (!binding) throw new Error(`Alias ${alias.name} targets unresolved graph root ${root}.`);
		const owner = components.find(
			(component) =>
				alias.sourceSpan &&
				(component.fn.start ?? -1) <= alias.sourceSpan.start &&
				(component.fn.end ?? -1) >= alias.sourceSpan.end,
		);
		return compactObject({
			id: `alias:${owner?.name ?? 'module'}:${alias.name}`,
			name: alias.name,
			target: alias.target,
			graphNodeId: binding.id,
			path,
			declarationKind: alias.declarationKind,
			sourceSpan: alias.sourceSpan,
		}) as unknown as EnrichedAliasRecord;
	});
}

function dedupeStateReads(stateLowering: StateLoweringArtifact): StateReadRecord[] {
	return dedupeBy(
		stateLowering.reads.map((read) => ({ graphNodeId: read.graphNodeId, path: [...read.path] })),
		(read) => `${read.graphNodeId}:${read.path.join('.')}`,
	);
}

function enrichWrite(write: LoweredStateWrite, nodes: readonly AnyNode[]): StateWriteRecord {
	const matching = findWriteNode(write, nodes);
	const value = matching?.type === 'AssignmentExpression' ? matching.right : undefined;
	const arguments_ = matching?.type === 'CallExpression' ? matching.arguments : undefined;
	return compactObject({
		graphNodeId: write.graphNodeId,
		path: [...write.path],
		operation: write.operation,
		assignmentOperator: write.assignmentOperator,
		updateOperator: write.updateOperator,
		prefix: write.prefix,
		method: write.method,
		value: value ? serializeAst(value) : undefined,
		arguments: arguments_?.map((argument: AnyNode) => serializeAst(argument)),
		sourceSpan: write.sourceSpan,
	}) as unknown as StateWriteRecord;
}

function findWriteNode(write: LoweredStateWrite, nodes: readonly AnyNode[]): AnyNode | undefined {
	const span = write.sourceSpan;
	if (!span) return undefined;
	if (write.operation === 'assign') {
		return nodes.find(
			(node) =>
				node.type === 'AssignmentExpression' &&
				node.left?.start === span.start &&
				node.left?.end === span.end,
		);
	}
	if (write.operation === 'update') {
		return nodes.find(
			(node) =>
				node.type === 'UpdateExpression' &&
				node.argument?.start === span.start &&
				node.argument?.end === span.end,
		);
	}
	if (write.operation === 'call') {
		return nodes
			.filter(
				(node) =>
					node.type === 'CallExpression' &&
					(node.start ?? Infinity) <= span.start &&
					(node.end ?? -Infinity) >= span.end &&
					(!write.method || staticPropertyName(node.callee?.property) === write.method),
			)
			.sort((left, right) => (left.end! - left.start!) - (right.end! - right.start!))[0];
	}
	return undefined;
}

function helperCallArgument(initializer: AnyNode | null | undefined, kind: string): AnyNode | undefined {
	if (!initializer || initializer.type !== 'CallExpression') return undefined;
	if (initializer.callee?.type !== 'Identifier' || initializer.callee.name !== kind) return undefined;
	return initializer.arguments?.[0];
}

function spanInside(span: { start: number; end: number } | undefined, node: AnyNode): boolean {
	return Boolean(
		span && node.start !== undefined && node.end !== undefined && span.start >= node.start && span.end <= node.end,
	);
}

function assertFullyConsumed(context: TemplateContext): void {
	if (context.hostCursor !== context.hostNodes.length) {
		throw new Error(`Only joined ${context.hostCursor}/${context.hostNodes.length} semantic hosts.`);
	}
	if (context.branchCursor !== context.branchSites.length) {
		throw new Error(`Only joined ${context.branchCursor}/${context.branchSites.length} branch sites.`);
	}
	if (context.repeatCursor !== context.repeats.length) {
		throw new Error(`Only joined ${context.repeatCursor}/${context.repeats.length} keyed repeats.`);
	}
}

function patternNames(pattern: AnyNode | null | undefined): string[] {
	if (!pattern) return [];
	if (pattern.type === 'Identifier') return [pattern.name];
	if (pattern.type === 'AssignmentPattern') return patternNames(pattern.left);
	if (pattern.type === 'RestElement') return patternNames(pattern.argument);
	if (pattern.type === 'ArrayPattern') return (pattern.elements ?? []).flatMap(patternNames);
	if (pattern.type === 'ObjectPattern') {
		return (pattern.properties ?? []).flatMap((property: AnyNode) =>
			property.type === 'RestElement' ? patternNames(property.argument) : patternNames(property.value),
		);
	}
	return [];
}

function collectAstNodes(root: AnyNode): AnyNode[] {
	const nodes: AnyNode[] = [];
	const visit = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			for (const child of value) visit(child);
			return;
		}
		const node = value as AnyNode;
		if (typeof node.type === 'string') nodes.push(node);
		for (const [key, child] of Object.entries(node)) {
			if (!OMITTED_AST_KEYS.has(key)) visit(child);
		}
	};
	visit(root);
	return nodes;
}

/** Exported for tests and downstream tooling that validates AST-derived dependencies. */
export function collectGraphReads(
	expression: SerializableAstNode,
	bindings: ReadonlyArray<{ id: string; name: string }>,
): ReadonlyArray<GraphReadRef> {
	return deriveReads(expression as AnyNode, {
		bindings: new Map(bindings.map((binding) => [binding.name, binding])),
		aliases: new Map(),
		locals: new Map(),
		repeatItems: new Map(),
	});
}

export function serializeAst(node: AnyNode): SerializableAstNode {
	const clone = (value: unknown): JsonValue | undefined => {
		if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
		if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
		if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
		if (typeof value === 'bigint') return value.toString();
		if (Array.isArray(value)) {
			return value.map((item) => clone(item) ?? null);
		}
		if (typeof value === 'object') {
			const output: Record<string, JsonValue> = {};
			for (const [key, child] of Object.entries(value)) {
				if (OMITTED_AST_KEYS.has(key)) continue;
				const cloned = clone(child);
				if (cloned !== undefined) output[key] = cloned;
			}
			return output;
		}
		return undefined;
	};
	return clone(node) as SerializableAstNode;
}

function normalizeJsxText(value: string): string {
	const lines = value.replace(/\r/g, '').split('\n');
	let result = '';
	for (let index = 0; index < lines.length; index++) {
		let line = lines[index]!.replace(/\t/g, ' ');
		if (index !== 0) line = line.replace(/^ +/, '');
		if (index !== lines.length - 1) line = line.replace(/ +$/, '');
		if (!line) continue;
		result += line;
		if (index !== lines.length - 1 && lines.slice(index + 1).some((next) => next.trim())) {
			result += ' ';
		}
	}
	return result;
}

function dedupeReads(reads: readonly GraphReadRef[]): GraphReadRef[] {
	return dedupeBy(reads, (read) => `${read.graphNodeId}:${read.path.join('.')}:${read.via}`).sort(
		(left, right) =>
			left.graphNodeId.localeCompare(right.graphNodeId) ||
			left.path.join('.').localeCompare(right.path.join('.')) ||
			left.via.localeCompare(right.via),
	);
}

function dedupeBy<T>(values: readonly T[], key: (value: T) => string): T[] {
	const seen = new Set<string>();
	return values.filter((value) => {
		const id = key(value);
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
}

function staticPropertyName(node: AnyNode | undefined): string {
	if (!node) return '';
	if (node.type === 'Identifier' || node.type === 'JSXIdentifier') return node.name;
	if (node.type === 'Literal') return String(node.value);
	return '';
}

function jsxName(node: AnyNode | undefined): string {
	if (!node) return '';
	if (node.type === 'JSXIdentifier' || node.type === 'Identifier') return node.name;
	if (node.type === 'JSXNamespacedName') return `${jsxName(node.namespace)}:${jsxName(node.name)}`;
	if (node.type === 'JSXMemberExpression') return `${jsxName(node.object)}.${jsxName(node.property)}`;
	return '';
}

function jsxEventName(name: string): string | null {
	if (!/^on[A-Z]/.test(name)) return null;
	return name.slice(2).toLowerCase();
}

function isNode(value: unknown): value is AnyNode {
	return Boolean(value && typeof value === 'object' && typeof (value as AnyNode).type === 'string');
}

function isFunctionNode(node: AnyNode): boolean {
	return node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration';
}

function isTemplateNode(node: AnyNode): boolean {
	return node.type === 'JSXElement' || node.type === 'TSRXJSXElement' || node.type === 'JSXFragment' || node.type === 'TSRXJSXFragment';
}

function toJsonValue(value: unknown): JsonValue | undefined {
	if (value === undefined) return undefined;
	return serializeUnknown(value);
}

function serializeUnknown(value: unknown): JsonValue {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
	if (typeof value === 'bigint') return value.toString();
	if (Array.isArray(value)) return value.map(serializeUnknown);
	if (typeof value === 'object') {
		const output: Record<string, JsonValue> = {};
		for (const [key, child] of Object.entries(value)) {
			if (child !== undefined) output[key] = serializeUnknown(child);
		}
		return output;
	}
	return String(value);
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
	return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined)) as Partial<T>;
}
