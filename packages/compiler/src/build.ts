import { basename, isAbsolute, normalize } from 'pathe';
import { buildSemanticGraph } from '@markless/compiler';
import type { SemanticGraphAlias, SemanticGraphArtifact } from '@markless/compiler';
import { parseModule } from '@tsrx/core';
import type { CompileError } from '@tsrx/core/types';
import type { TsrxSemanticGraphArtifact } from './artifacts.ts';
import { runCompilerPassPipeline } from './pass-pipeline.ts';
import { enrichedIrPassDefinition } from './pass-registry.ts';
import {
	ENRICHED_IR_VERSION,
	type DynamicBinding,
	type BehaviorRecord,
	type ComponentPropExpression,
	type ElementHandleBinding,
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
	type HandleCallRecord,
	type LocalDeclaration,
	type ModuleImport,
	type PropDestructuringEntry,
	type SerializableAstNode,
	type SharedCall,
	type SharedDefinition,
	type SharedInstance,
	type SharedRead,
	type SharedWrite,
	type StateReadRecord,
	type StateWriteRecord,
	type StaticAttribute,
	type SyncPolicy,
	type TemplateBranchArm,
	type TemplateHost,
	type TemplateNode,
} from './schema.ts';

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
	readonly componentId: string;
	readonly filename: string;
	readonly bindings: ReadonlyMap<string, { id: string }>;
	readonly aliases: ReadonlyMap<string, { graphNodeId: string; path: readonly string[] }>;
	readonly locals: ReadonlyMap<string, LocalInfo>;
	readonly repeatItems: ReadonlyMap<string, { graphNodeId: string; path: readonly string[] }>;
	readonly sharedInstances: ReadonlyMap<
		string,
		{
			definitionId: string;
			properties: ReadonlyMap<string, { graphNodeId: string; path: readonly string[] }>;
		}
	>;
}

interface ComponentWork {
	readonly id: string;
	readonly name: string;
	readonly exportKind?: 'default' | 'named';
	readonly exportedName?: string;
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
	readonly hostOwners: Map<string, string>;
	readonly behaviorNodes: Map<
		string,
		{ node: AnyNode; environment: ReadEnvironment; order: number }[]
	>;
	readonly edges: SemanticGraphArtifact['componentEdges'];
	currentComponent: ComponentWork | null;
	hostCursor: number;
	branchCursor: number;
	repeatCursor: number;
	textCursor: number;
	fragmentCursor: number;
}

interface SharedFactoryDeclarator {
	readonly name: string;
	readonly callStart: number;
	readonly callEnd: number;
	readonly factory: AnyNode;
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
export async function buildEnrichedIr(input: BuildInput): Promise<EnrichedIR> {
	const filename = normalizeFilename(input.filename);
	const semanticGraph = await buildSemanticGraph({ filename, source: input.source });
	const initialArtifact: TsrxSemanticGraphArtifact = {
		filename,
		source: input.source,
		semanticGraph,
	};
	const result = await runCompilerPassPipeline({
		initialArtifacts: { 'tsrx-semantic-graph': initialArtifact },
		passes: [
			{
				...enrichedIrPassDefinition,
				run: async (artifacts) => ({
					'frameless-enriched-ir': await buildEnrichedIrArtifact(
						artifacts['tsrx-semantic-graph'] as TsrxSemanticGraphArtifact,
					),
				}),
			},
		],
	});
	return result.artifacts['frameless-enriched-ir'] as EnrichedIR;
}

async function buildEnrichedIrArtifact({
	filename,
	source,
	semanticGraph,
}: TsrxSemanticGraphArtifact): Promise<EnrichedIR> {
	filename = normalizeFilename(filename);
	const parseErrors: CompileError[] = [];
	const program = parseModule(source, filename, {
		collect: true,
		errors: parseErrors,
	}) as AnyNode;
	if (parseErrors.length > 0) {
		throw new Error(`TSRX parse failed for ${filename}: ${String(parseErrors[0])}`);
	}
	const sharedFactoryDeclarators = findSharedFactoryDeclarators(program, filename);
	const components = findComponents(program);

	// Deliberately stop after the semantic graph. Payload, public-render,
	// locator, resume, and symbol passes are neither requested nor consumed here.
	const errors = semanticGraph.diagnostics.filter(
		(diagnostic) => diagnostic.severity === 'error',
	);
	if (errors.length > 0) {
		throw new Error(
			`Markless semantic compilation failed for ${filename}: ${errors
				.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
				.join('; ')}`,
		);
	}

	assertSemanticComponents(components, semanticGraph);
	if (components.length > 1 && semanticGraph.branchSites.length > 0) {
		throw new Error(
			'Branch-site ownership in a multi-component module has no single-candidate Layer A join; this construct is blocked by the vendor identity refresh gate.',
		);
	}
	const bindingOwners = attributeGraphBindings(semanticGraph, components);
	const bindingsByComponent = new Map(
		components.map((component) => [component.id, new Map<string, { id: string }>()]),
	);
	for (const binding of semanticGraph.graphBindings) {
		if (binding.sharedDefinitionId) continue;
		const owner = bindingOwners.get(binding);
		if (!owner) throw new Error(`Graph binding ${binding.id} has no component owner.`);
		bindingsByComponent.get(owner.id)!.set(binding.name, { id: binding.id });
	}
	const aliases = resolveAliases(semanticGraph, components, bindingOwners);
	const aliasesByComponent = new Map(
		components.map((component) => [
			component.id,
			new Map<string, { graphNodeId: string; path: readonly string[] }>(),
		]),
	);
	for (const alias of aliases) {
		aliasesByComponent
			.get(alias.componentId)!
			.set(alias.name, { graphNodeId: alias.graphNodeId, path: alias.path });
	}
	const aliasIds = new Map(
		aliases.map((alias) => [`${alias.componentId}\0${alias.name}`, alias.id]),
	);
	const sharedInstances = buildSharedInstances(semanticGraph, components);
	const sharedProperties = sharedPropertyMaps(semanticGraph);
	const sharedInstancesByComponent = new Map(
		components.map((component) => [
			component.id,
			new Map<
				string,
				{
					definitionId: string;
					properties: ReadonlyMap<
						string,
						{ graphNodeId: string; path: readonly string[] }
					>;
				}
			>(),
		]),
	);
	for (const instance of sharedInstances) {
		sharedInstancesByComponent.get(instance.componentId)!.set(instance.localName, {
			definitionId: instance.definitionId,
			properties: sharedProperties.get(instance.definitionId) ?? new Map(),
		});
	}

	const templateContext: TemplateContext = {
		graph: semanticGraph,
		hostNodes: semanticGraph.hostNodes,
		branchSites: semanticGraph.branchSites,
		repeats: semanticGraph.keyedRepeats,
		eventHandlers: new Map(),
		hostOwners: new Map(),
		behaviorNodes: new Map(),
		edges: semanticGraph.componentEdges,
		currentComponent: null,
		hostCursor: 0,
		branchCursor: 0,
		repeatCursor: 0,
		textCursor: 0,
		fragmentCursor: 0,
	};

	const enrichedComponents = components.map((component) => {
		templateContext.currentComponent = component;
		const environment: ReadEnvironment = {
			componentId: component.id,
			filename,
			bindings: bindingsByComponent.get(component.id)!,
			aliases: aliasesByComponent.get(component.id)!,
			locals: component.locals,
			repeatItems: new Map(),
			sharedInstances: sharedInstancesByComponent.get(component.id)!,
		};
		return enrichComponent(component, environment, templateContext, semanticGraph, aliasIds);
	});
	templateContext.currentComponent = null;

	assertFullyConsumed(templateContext);

	const events: EnrichedEventRecord[] = semanticGraph.events.map((event) => {
		const componentId = ownerForHostLinked(
			'Event',
			event.hostNodeId,
			templateContext.hostOwners,
		);
		const handlers = templateContext.eventHandlers.get(event.id) ?? [];
		if (handlers.length !== event.handlerCount) {
			throw new Error(
				`Event ${event.id} expected ${event.handlerCount} handler AST(s), found ${handlers.length}.`,
			);
		}
		const enrichedHandlers = handlers
			.map(({ node, environment }): EventHandlerRecord => {
				if (environment.componentId !== componentId) {
					throw new Error(
						`Event ${event.id} host ownership disagrees with its handler span ownership.`,
					);
				}
				assertNoInlineSharedFactoryCall(
					node,
					environment,
					semanticGraph,
					'handler expression',
				);
				const effects = deriveHandlerEffects(node, environment);
				return {
					expression: serializeAst(node),
					reads: effects.reads,
					writes: effects.writes,
				};
			})
			.sort(
				(left, right) =>
					Number(left.expression.start ?? -1) - Number(right.expression.start ?? -1) ||
					Number(left.expression.end ?? -1) - Number(right.expression.end ?? -1),
			);
		return {
			componentId,
			id: event.id,
			hostNodeId: event.hostNodeId,
			eventName: event.eventName,
			...(event.syncPolicy
				? { syncPolicy: serializeUnknown(event.syncPolicy) as unknown as SyncPolicy }
				: {}),
			handlers: enrichedHandlers,
		};
	});
	const writes = sortWrites(
		events.flatMap((event) => event.handlers.flatMap((handler) => handler.writes)),
	);
	validateStateWriteAttribution(semanticGraph, components, bindingOwners, writes);

	const bindings = semanticGraph.graphBindings
		.filter((binding) => !binding.sharedDefinitionId)
		.map((binding): EnrichedGraphBinding => {
			const owner = bindingOwners.get(binding)!;
			const local = owner?.locals.get(binding.name);
			const environment: ReadEnvironment = {
				componentId: owner.id,
				filename,
				bindings: bindingsByComponent.get(owner.id)!,
				aliases: aliasesByComponent.get(owner.id)!,
				locals: owner?.locals ?? new Map(),
				repeatItems: new Map(),
				sharedInstances: sharedInstancesByComponent.get(owner.id)!,
			};
			const helperArgument = helperCallArgument(local?.initializer, binding.kind);
			const computed =
				binding.kind === 'computed' && helperArgument
					? expressionSite(helperArgument, environment)
					: undefined;
			const initializerReads =
				binding.kind === 'state' && helperArgument
					? deriveReads(helperArgument, environment)
					: [];

			return compactObject({
				componentId: owner.id,
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
					binding.kind === 'state' && helperArgument
						? serializeAst(helperArgument)
						: undefined,
				computed,
				reads: toStateReads(computed?.reads ?? initializerReads, owner.id),
				writes: writes.filter((write) => write.graphNodeId === binding.id),
			}) as unknown as EnrichedGraphBinding;
		});

	const sharedWrites = buildSharedWrites(program, semanticGraph);
	const sharedDefinitions = buildSharedDefinitions(
		program,
		semanticGraph,
		sharedFactoryDeclarators,
		sharedWrites,
	);
	const sharedReads = buildSharedReads(
		program,
		semanticGraph,
		components,
		sharedInstances,
		sharedProperties,
	);
	const sharedCalls = buildSharedCalls(semanticGraph, events, sharedInstances, components);
	const elementHandleBindings = buildElementHandleBindings(
		semanticGraph,
		components,
		templateContext.hostOwners,
	);
	const behaviors = buildBehaviors(semanticGraph, templateContext);
	const handleCalls = buildHandleCalls(events, elementHandleBindings);
	const records = {
		bindings: [...bindings].sort((left, right) => compareText(left.id, right.id)),
		aliases: [...aliases].sort((left, right) => compareText(left.id, right.id)),
		events: [...events].sort((left, right) => compareText(left.id, right.id)),
		stateReads: collectCanonicalReads(enrichedComponents, bindings, events),
		stateWrites: writes,
		sharedDefinitions,
		sharedInstances,
		sharedReads,
		sharedCalls,
		sharedWrites,
		elementHandleBindings,
		behaviors,
		handleCalls,
	};

	return {
		version: ENRICHED_IR_VERSION,
		filename,
		imports: semanticGraph.moduleImports.map(
			(entry): ModuleImport => ({
				...entry,
				...(entry.source.startsWith('.') && entry.source.endsWith('.tsrx')
					? { resolvesTo: 'tsrx-module' as const }
					: {}),
			}),
		),
		module: {
			exports: components
				.filter((component) => component.exportKind && component.exportedName)
				.map((component) => ({
					kind: component.exportKind!,
					componentName: component.name,
					exportedName: component.exportedName!,
				}))
				.sort((left, right) => compareText(left.exportedName, right.exportedName)),
		},
		components: enrichedComponents,
		records,
	};
}

function findComponents(program: AnyNode): ComponentWork[] {
	const found: ComponentWork[] = [];
	const namedExports = new Map<string, string>();
	let defaultExportLocal: string | undefined;
	for (const statement of program.body ?? []) {
		if (statement.type === 'ExportNamedDeclaration') {
			for (const specifier of statement.specifiers ?? []) {
				const localName = staticPropertyName(specifier.local);
				const exportedName = staticPropertyName(specifier.exported);
				if (localName && exportedName) namedExports.set(localName, exportedName);
			}
		}
		if (
			statement.type === 'ExportDefaultDeclaration' &&
			statement.declaration?.type === 'Identifier'
		) {
			defaultExportLocal = statement.declaration.name;
		}
	}
	for (const statement of program.body ?? []) {
		const candidate =
			statement.type === 'ExportNamedDeclaration' ||
			statement.type === 'ExportDefaultDeclaration'
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
		const name = candidate.id?.name ?? 'default';
		const indirectNamedExport = namedExports.get(name);
		found.push({
			id: `component:${found.length}:${name}`,
			name,
			...(statement.type === 'ExportDefaultDeclaration'
				? { exportKind: 'default' as const, exportedName: 'default' }
				: statement.type === 'ExportNamedDeclaration'
					? {
							exportKind: 'named' as const,
							exportedName: candidate.id?.name ?? 'default',
						}
					: defaultExportLocal === name
						? { exportKind: 'default' as const, exportedName: 'default' }
						: indirectNamedExport
							? { exportKind: 'named' as const, exportedName: indirectNamedExport }
							: {}),
			fn: candidate,
			body: candidate.body,
			locals,
			declarations,
		});
	}
	if (found.length === 0)
		throw new Error('TSRX component discovery found no top-level component functions.');
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
						...(environment.bindings.has(name)
							? [environment.bindings.get(name)!.id]
							: []),
						...(aliasIds.has(`${component.id}\0${name}`)
							? [aliasIds.get(`${component.id}\0${name}`)!]
							: []),
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
		id: component.id,
		name: component.name,
		evaluation: {
			ordinaryLocals: 'once-per-instance',
			computedBindings: 'reactive',
		},
		props: {
			graphNodeId:
				[...environment.bindings.values()].find((binding) => binding.id.startsWith('prop:'))
					?.id ?? 'prop:props',
			entries: propsEntries(component.fn.params?.[0], graph, environment),
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
		return (
			statement.consequent.body?.find((node: AnyNode) => node.type === 'ReturnStatement') ??
			null
		);
	}
	return null;
}

function guardResult(
	argument: AnyNode | null,
	environment: ReadEnvironment,
	context: TemplateContext,
): GuardResult {
	if (!argument || (argument.type === 'Literal' && argument.value === null))
		return { kind: 'null' };
	if (isTemplateNode(argument)) {
		return { kind: 'template', children: buildTemplateNode(argument, environment, context) };
	}
	return { kind: 'expression', value: expressionSite(argument, environment) };
}

function propsEntries(
	parameter: AnyNode | undefined,
	graph: SemanticGraphArtifact,
	environment: ReadEnvironment,
): PropDestructuringEntry[] {
	const propBinding = graph.graphBindings.find(
		(binding) =>
			binding.kind === 'prop' && environment.bindings.get(binding.name)?.id === binding.id,
	);
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
		const value =
			property.value?.type === 'AssignmentPattern' ? property.value.left : property.value;
		const localName = value?.name ?? sourceName;
		entries.push(
			compactObject({
				sourceName,
				localName,
				path: [sourceName],
				alias: sourceName !== localName,
				graphNodeId: propBinding.id,
				defaultValue:
					property.value?.type === 'AssignmentPattern'
						? serializeAst(property.value.right)
						: undefined,
			}) as unknown as PropDestructuringEntry,
		);
	}
	return entries;
}

export function buildTemplateNode(
	node: AnyNode,
	environment: ReadEnvironment,
	context: TemplateContext,
): TemplateNode[] {
	if (!node) return [];
	if (node.type === 'JSXElement' || node.type === 'TSRXJSXElement') {
		const tag = jsxName(node.openingElement?.name);
		if (!tag)
			throw new Error(`Template element construct ${node.type} has no static tag name.`);
		if (/^[A-Z]/.test(tag)) return buildComponentReference(node, tag, environment, context);
		const semanticHost = context.hostNodes[context.hostCursor++];
		if (!semanticHost || semanticHost.tagName !== tag) {
			throw new Error(
				`Host join mismatch at <${tag}>: expected ${semanticHost?.tagName ?? 'end of host records'}.`,
			);
		}
		if (!context.currentComponent)
			throw new Error(`Host ${semanticHost.id} has no active component owner.`);
		context.hostOwners.set(semanticHost.id, context.currentComponent.id);
		const staticAttributes: StaticAttribute[] = [];
		const dynamicBindings: DynamicBinding[] = [];
		const eventIds: string[] = [];
		for (const attribute of node.openingElement.attributes ?? []) {
			if (attribute.type !== 'JSXAttribute') {
				throw new Error(
					'Spread attributes are not representable in frameless-enriched-ir/1.',
				);
			}
			const name = jsxName(attribute.name);
			if (!name) continue;
			if (name === 'el') continue;
			if (name === 'attach') {
				if (attribute.value?.type !== 'JSXExpressionContainer') {
					throw new Error(
						`Behavior attach on ${semanticHost.id} must contain an expression.`,
					);
				}
				assertNoInlineSharedFactoryCall(
					attribute.value.expression,
					environment,
					context.graph,
					'template expression',
				);
				const existing = context.behaviorNodes.get(semanticHost.id) ?? [];
				existing.push({
					node: attribute.value.expression,
					environment,
					order: existing.length,
				});
				context.behaviorNodes.set(semanticHost.id, existing);
				continue;
			}
			const eventName = jsxEventName(name);
			if (eventName) {
				const event = context.graph.events.find(
					(candidate) =>
						candidate.hostNodeId === semanticHost.id &&
						candidate.eventName === eventName,
				);
				if (!event || attribute.value?.type !== 'JSXExpressionContainer') {
					throw new Error(
						`Could not join ${name} on ${semanticHost.id} to a semantic event.`,
					);
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
				assertNoInlineSharedFactoryCall(
					expression,
					environment,
					context.graph,
					'template expression',
				);
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
						target && 'name' in target && typeof target.name === 'string'
							? target.name
							: name,
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
		assertNoInlineSharedFactoryCall(
			node.expression,
			environment,
			context.graph,
			'template expression',
		);
		const site = expressionSite(node.expression, environment);
		if (
			site.reads.length === 1 &&
			site.reads[0]!.graphNodeId.startsWith('prop:') &&
			site.reads[0]!.path.join('.') === 'children'
		) {
			return [
				{
					kind: 'default-slot-projection',
					id: `slot:${environment.componentId}:${node.expression.start ?? context.textCursor++}`,
					site,
				} as unknown as TemplateNode,
			];
		}
		const chain = memberChain(node.expression);
		if (
			site.reads.some(
				(read) => read.graphNodeId.startsWith('prop:') && read.path[0] === 'children',
			) ||
			(node.expression.type === 'Identifier' && node.expression.name === 'children') ||
			(chain?.root === 'props' && chain.path[0] === 'children')
		) {
			throw new Error(
				`DefaultSlotProjection children read ${chain ? `${chain.root}.${chain.path.join('.')}` : 'children'} in ${environment.componentId} cannot be mapped to the props children graph binding.`,
			);
		}
		return [
			{
				kind: 'dynamic-text',
				id: `text:${context.textCursor++}`,
				...site,
			},
		];
	}

	if (node.type === 'JSXIfExpression') {
		const site = context.branchSites[context.branchCursor++];
		if (!site) throw new Error('A TSRX branch has no SemanticGraphArtifact branch record.');
		assertNoInlineSharedFactoryCall(
			node.test,
			environment,
			context.graph,
			'template expression',
		);
		const arms: TemplateBranchArm[] = [
			{
				kind: 'then',
				children: blockTemplate(node.consequent, environment, context),
			},
		];
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
		return [
			{
				kind: 'branch',
				id: site.id,
				...expressionSite(node.test, environment),
				arms,
			},
		];
	}

	if (node.type === 'JSXForExpression') {
		const repeat = context.repeats[context.repeatCursor++];
		if (!repeat) throw new Error('A TSRX repeat has no SemanticGraphArtifact repeat record.');
		if (
			ownerForHostLinked('Keyed repeat', repeat.parentHostNodeId, context.hostOwners) !==
			environment.componentId
		) {
			throw new Error(
				`Keyed repeat ${repeat.id} host ownership disagrees with its AST component.`,
			);
		}
		assertNoInlineSharedFactoryCall(
			node.right,
			environment,
			context.graph,
			'template expression',
		);
		assertNoInlineSharedFactoryCall(
			node.key,
			environment,
			context.graph,
			'template expression',
		);
		const collection = expressionSite(node.right, environment);
		const repeatItems = new Map(environment.repeatItems);
		if (repeat.collectionGraphNodeId) {
			repeatItems.set(repeat.itemName, {
				graphNodeId: repeat.collectionGraphNodeId,
				path: repeat.collectionPath,
			});
		}
		const rowEnvironment = { ...environment, repeatItems };
		return [
			{
				kind: 'keyed-repeat',
				id: repeat.id,
				item: repeat.itemName,
				...(repeat.indexName ? { index: repeat.indexName } : {}),
				collection,
				key: expressionSite(node.key, rowEnvironment),
				row: blockTemplate(node.body, rowEnvironment, context),
				empty: node.empty ? blockTemplate(node.empty, environment, context) : [],
			},
		];
	}

	if (node.type === 'JSXFragment' || node.type === 'TSRXJSXFragment') {
		return [
			{
				kind: 'fragment',
				id: `fragment:${context.fragmentCursor++}`,
				children: (node.children ?? []).flatMap((child: AnyNode) =>
					buildTemplateNode(child, environment, context),
				),
			},
		];
	}

	if (node.type === 'BlockStatement') return blockTemplate(node, environment, context);
	throw new Error(
		`Unsupported template construct ${node.type} cannot be represented in frameless-enriched-ir/2.`,
	);
}

function buildComponentReference(
	node: AnyNode,
	tag: string,
	environment: ReadEnvironment,
	context: TemplateContext,
): TemplateNode[] {
	const component = context.currentComponent;
	if (!component) throw new Error(`Component reference <${tag}> has no active component owner.`);
	const candidates = context.edges.filter(
		(edge) =>
			edge.parentComponentName === component.name &&
			edge.childComponentName === tag &&
			edge.sourceSpan?.start === node.start &&
			edge.sourceSpan?.end === node.end,
	);
	if (candidates.length !== 1) {
		throw new Error(
			`Component reference <${tag}> in ${component.name} joined ${candidates.length} Layer A edges; expected exactly one.`,
		);
	}
	const edge = candidates[0]!;
	const authoredChildren = (node.children ?? []).filter(
		(child: AnyNode) => child.type !== 'JSXText' || normalizeJsxText(String(child.value ?? '')),
	);
	if (authoredChildren.length !== edge.children.childCount) {
		throw new Error(
			`Component reference ${edge.id} child-count disagreement: AST has ${authoredChildren.length}, Layer A has ${edge.children.childCount}.`,
		);
	}
	if (
		!edge.importSource &&
		context.graph.components.filter((candidate) => candidate.name === edge.childComponentName)
			.length !== 1
	) {
		throw new Error(
			`Component reference ${edge.id} has no unique same-module target ${edge.childComponentName}.`,
		);
	}
	const props: ComponentPropExpression[] = edge.props.map((prop) => {
		const attribute = (node.openingElement.attributes ?? []).find(
			(candidate: AnyNode) =>
				candidate.type === 'JSXAttribute' && jsxName(candidate.name) === prop.name,
		);
		if (!attribute)
			throw new Error(
				`Component prop ${prop.name} on ${edge.id} has no authored AST attribute.`,
			);
		const expression =
			attribute.value?.type === 'JSXExpressionContainer'
				? attribute.value.expression
				: attribute.value?.type === 'Literal'
					? attribute.value
					: { type: 'Literal', value: true, start: attribute.start, end: attribute.end };
		assertNoInlineSharedFactoryCall(
			expression,
			environment,
			context.graph,
			'template expression',
		);
		if (
			prop.sourceSpan &&
			(expression.start !== prop.sourceSpan.start || expression.end !== prop.sourceSpan.end)
		) {
			throw new Error(
				`Component prop ${prop.name} on ${edge.id} disagrees between AST and Layer A coordinates.`,
			);
		}
		return compactObject({
			name: prop.name,
			kind: prop.kind,
			value: expressionSite(expression, environment),
			graphNodeId: 'graphNodeId' in prop ? prop.graphNodeId : undefined,
			path: 'path' in prop ? prop.path : undefined,
		}) as unknown as ComponentPropExpression;
	});
	return [
		{
			kind: 'component-reference',
			id: `component-reference:${edge.id}`,
			edgeId: edge.id,
			target: edge.importSource
				? {
						localName: tag,
						module: edge.importSource,
						exportedName: edge.importedName ?? tag,
					}
				: { localName: tag, module: 'self' },
			props,
			children: (node.children ?? []).flatMap((child: AnyNode) =>
				buildTemplateNode(child, environment, context),
			),
		} as unknown as TemplateNode,
	];
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

function assertNoInlineSharedFactoryCall(
	node: AnyNode,
	environment: ReadEnvironment,
	graph: SemanticGraphArtifact,
	construct: 'template expression' | 'handler expression',
): void {
	const factories = new Set(graph.sharedDefinitions.map((definition) => definition.name));
	if (factories.size === 0) return;

	const resolvesToFactory = (name: string, bound: ReadonlySet<string>): boolean =>
		factories.has(name) &&
		!bound.has(name) &&
		!environment.bindings.has(name) &&
		!environment.aliases.has(name) &&
		!environment.locals.has(name) &&
		!environment.repeatItems.has(name) &&
		!environment.sharedInstances.has(name);

	const failForCall = (
		call: AnyNode | undefined,
		propertyName: string,
		bound: ReadonlySet<string>,
	): void => {
		if (call?.callee?.type !== 'Identifier' || !resolvesToFactory(call.callee.name, bound))
			return;
		throw new Error(
			`Shared factory ${call.callee.name} is called inline in a ${construct}; bind the instance to a local first, or the property ${propertyName} is unmapped.`,
		);
	};

	const visit = (current: AnyNode | null | undefined, bound: ReadonlySet<string>): void => {
		if (!current || typeof current !== 'object') return;
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
				if (statement.type === 'FunctionDeclaration' && statement.id?.name)
					nextBound.add(statement.id.name);
			}
			for (const statement of current.body ?? []) visit(statement, nextBound);
			return;
		}
		const unwrapped = current.type === 'ChainExpression' ? current.expression : current;
		if (unwrapped.type === 'MemberExpression') {
			failForCall(
				unwrapCall(unwrapped.object),
				staticPropertyName(unwrapped.property) || '<computed>',
				bound,
			);
		}
		if (unwrapped.type === 'CallExpression') {
			failForCall(unwrapped, '<result>', bound);
		}
		for (const [key, value] of Object.entries(unwrapped)) {
			if (OMITTED_AST_KEYS.has(key) || key === 'type' || key === 'start' || key === 'end')
				continue;
			if (Array.isArray(value)) {
				for (const child of value) if (isNode(child)) visit(child, bound);
			} else if (isNode(value)) visit(value, bound);
		}
	};

	visit(node, new Set());
}

function deriveReads(node: AnyNode, environment: ReadEnvironment): GraphReadRef[] {
	const reads: GraphReadRef[] = [];
	const expanding = new Set<string>();

	const addResolved = (
		name: string,
		path: readonly string[],
		bound: ReadonlySet<string>,
	): boolean => {
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
		const shared = environment.sharedInstances.get(name);
		if (shared && path.length > 0) {
			const property = shared.properties.get(path[0]!);
			if (property) {
				reads.push({
					graphNodeId: property.graphNodeId,
					path: [...property.path, ...path.slice(1)],
					via: 'direct',
				});
				return true;
			}
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
			if (OMITTED_AST_KEYS.has(key) || key === 'type' || key === 'start' || key === 'end')
				continue;
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
	return {
		...parent,
		path: [...parent.path, '*'],
		computed: [...parent.computed, node.property],
	};
}

function assertSemanticComponents(
	components: readonly ComponentWork[],
	graph: SemanticGraphArtifact,
): void {
	const astNames = components.map((component) => component.name);
	const graphNames = graph.components.map((component) => component.name);
	if (
		astNames.length !== graphNames.length ||
		astNames.some((name, index) => name !== graphNames[index])
	) {
		throw new Error(
			`Component attribution disagreement between TSRX AST (${astNames.join(', ')}) and Layer A (${graphNames.join(', ')}).`,
		);
	}
}

function componentForSpan(
	construct: string,
	span: { start: number; end: number } | undefined,
	components: readonly ComponentWork[],
): ComponentWork {
	if (!span) throw new Error(`${construct} has no source span for component attribution.`);
	const candidates = components.filter(
		(component) =>
			(component.fn.start ?? -1) <= span.start && (component.fn.end ?? -1) >= span.end,
	);
	if (candidates.length !== 1) {
		throw new Error(
			`${construct} source span ${span.start}..${span.end} joined ${candidates.length} components; expected exactly one.`,
		);
	}
	return candidates[0]!;
}

function attributeGraphBindings(
	graph: SemanticGraphArtifact,
	components: readonly ComponentWork[],
): Map<SemanticGraphArtifact['graphBindings'][number], ComponentWork> {
	const owners = new Map<SemanticGraphArtifact['graphBindings'][number], ComponentWork>();
	for (const binding of graph.graphBindings) {
		if (binding.sharedDefinitionId) continue;
		const explicitNames = new Set(
			graph.localDeclarations
				.filter(
					(declaration) =>
						declaration.scope === 'component' &&
						declaration.name === binding.name &&
						declaration.componentName,
				)
				.map((declaration) => declaration.componentName!),
		);
		const astCandidates = components.filter(
			(component) =>
				component.locals.has(binding.name) ||
				(binding.kind === 'prop' && Boolean(component.fn.params?.[0])),
		);
		let candidates =
			explicitNames.size > 0
				? components.filter((component) => explicitNames.has(component.name))
				: astCandidates;
		if (explicitNames.size === 1 && astCandidates.length > 0) {
			const explicit = candidates[0]!;
			if (!astCandidates.includes(explicit)) {
				throw new Error(
					`Graph binding ${binding.id} explicit component coordinate disagrees with its AST declaration.`,
				);
			}
		}
		if (candidates.length === 0 && components.length === 1) candidates = [components[0]!];
		if (candidates.length > 1) {
			throw new Error(
				`Graph binding ownership collision for "${binding.name}" between components "${candidates[0]!.name}" and "${candidates[1]!.name}"; this construct is blocked by the vendor identity refresh gate.`,
			);
		}
		if (candidates.length !== 1) {
			throw new Error(`Graph binding ${binding.id} has no single-candidate component join.`);
		}
		owners.set(binding, candidates[0]!);
	}
	return owners;
}

function ownerForHostLinked(
	construct: string,
	hostNodeId: string,
	hostOwners: ReadonlyMap<string, string>,
): string {
	const owner = hostOwners.get(hostNodeId);
	if (!owner) throw new Error(`${construct} references unowned host ${hostNodeId}.`);
	return owner;
}

function validateStateWriteAttribution(
	graph: SemanticGraphArtifact,
	components: readonly ComponentWork[],
	bindingOwners: ReadonlyMap<SemanticGraphArtifact['graphBindings'][number], ComponentWork>,
	writes: readonly StateWriteRecord[],
): void {
	for (const write of graph.stateWrites) {
		if (write.sharedDefinitionId) continue;
		const spanOwner = componentForSpan(
			`State write ${write.target}`,
			write.targetSpan,
			components,
		);
		if (write.componentName && write.componentName !== spanOwner.name) {
			throw new Error(
				`State write ${write.target} componentName disagrees with its source-span owner.`,
			);
		}
		// Layer A reports mutations of temporary call receivers (for example
		// todos.slice().reverse()); /1 intentionally proved these are not graph writes.
		if (write.target.includes('(')) continue;
		const root = write.target.split('.')[0]!;
		const binding = graph.graphBindings.find(
			(candidate) =>
				candidate.name === root && bindingOwners.get(candidate)?.id === spanOwner.id,
		);
		if (!binding) continue;
		const joined = writes.filter(
			(candidate) =>
				candidate.componentId === spanOwner.id &&
				candidate.graphNodeId === binding.id &&
				candidate.sourceSpan?.start === write.targetSpan?.start &&
				candidate.sourceSpan?.end === write.targetSpan?.end,
		);
		if (joined.length !== 1) {
			throw new Error(
				`State write ${write.target} joined ${joined.length} component-owned enriched writes; expected exactly one.`,
			);
		}
	}
}

function buildSharedInstances(
	graph: SemanticGraphArtifact,
	components: readonly ComponentWork[],
): SharedInstance[] {
	return graph.sharedInstances.map((instance) => {
		const component = componentForSpan(
			`Shared instance ${instance.localName}`,
			instance.sourceSpan,
			components,
		);
		const explicit = graph.localDeclarations.filter(
			(declaration) => declaration.name === instance.localName && declaration.componentName,
		);
		if (
			explicit.length > 0 &&
			!explicit.some((declaration) => declaration.componentName === component.name)
		) {
			throw new Error(
				`Shared instance ${instance.localName} span ownership disagrees with componentName.`,
			);
		}
		return {
			definitionId: instance.definitionId,
			componentId: component.id,
			localName: instance.localName,
		};
	});
}

function sharedPropertyMaps(
	graph: SemanticGraphArtifact,
): Map<string, Map<string, { graphNodeId: string; path: readonly string[] }>> {
	return new Map(
		graph.sharedDefinitions.map((definition) => [
			definition.id,
			new Map(
				(definition.returnProperties ?? [])
					.filter((property) => property.kind === 'graph')
					.map((property) => [
						property.name,
						{ graphNodeId: property.graphNodeId, path: property.path },
					]),
			),
		]),
	);
}

function buildSharedDefinitions(
	program: AnyNode,
	graph: SemanticGraphArtifact,
	declarators: readonly SharedFactoryDeclarator[],
	sharedWrites: readonly SharedWrite[],
): SharedDefinition[] {
	return graph.sharedDefinitions.map((definition) => {
		const declarator = declarators.find(
			(candidate) =>
				candidate.callStart === definition.sourceSpan?.start &&
				candidate.callEnd === definition.sourceSpan?.end,
		);
		if (!declarator) {
			throw new Error(
				`Shared definition ${definition.id} has no identifier declarator binding.`,
			);
		}
		if (typeof definition.name !== 'string' || definition.name !== declarator.name) {
			throw new Error(
				`Shared definition ${definition.id} declarator binding disagrees with Layer A.`,
			);
		}
		const graphBindings = graph.graphBindings.filter(
			(binding) => binding.sharedDefinitionId === definition.id,
		);
		const cells = (definition.returnProperties ?? [])
			.filter((property) => property.kind === 'graph')
			.map((property) => {
				const binding = graphBindings.find(
					(candidate) => candidate.id === property.graphNodeId,
				);
				if (!binding?.valueKind)
					throw new Error(
						`Shared definition ${definition.id} cell ${property.name} has no valueKind.`,
					);
				return {
					name: property.name,
					graphNodeId: property.graphNodeId,
					valueKind: binding.valueKind,
					initializer: sharedBindingInitializer(
						definition.id,
						binding.name,
						binding.kind,
						declarator.factory,
					),
				};
			});
		const methods = (definition.returnProperties ?? [])
			.filter((property) => property.kind === 'method')
			.map((property) => {
				const node = findNodeBySpan(program, property.sourceSpan);
				if (!node)
					throw new Error(
						`Shared definition ${definition.id} method ${property.name} has no AST site.`,
					);
				const writes = sharedWrites.filter(
					(write) =>
						write.definitionId === definition.id &&
						write.sourceSpan.start >= (node.start ?? Infinity) &&
						write.sourceSpan.end <= (node.end ?? -Infinity),
				);
				return { name: property.name, site: serializeAst(node), writes };
			});
		return {
			id: definition.id,
			name: declarator.name,
			scope: definition.scope ?? 'request',
			cells,
			methods,
			graphBindings: graphBindings.map((binding) => binding.id),
			returnProperties: (definition.returnProperties ?? []).map((property) =>
				property.kind === 'graph'
					? {
							kind: 'graph' as const,
							name: property.name,
							graphNodeId: property.graphNodeId,
							path: property.path,
						}
					: { kind: 'method' as const, name: property.name },
			),
			dependencies: (definition.dependencies ?? []).map(
				({ definitionId, definitionName }) => ({ definitionId, definitionName }),
			),
		};
	});
}

function findSharedFactoryDeclarators(
	program: AnyNode,
	filename: string,
): SharedFactoryDeclarator[] {
	const sharedImports = new Set<string>();
	const declaratorsByInitializer = new Map<AnyNode, AnyNode>();
	walkAst(program, (node) => {
		if (node.type === 'ImportDeclaration' && node.source?.value === '@markless/core') {
			for (const specifier of node.specifiers ?? []) {
				if (
					specifier.type === 'ImportSpecifier' &&
					(specifier.imported?.name ?? specifier.imported?.value) === 'shared' &&
					typeof specifier.local?.name === 'string'
				) {
					sharedImports.add(specifier.local.name);
				}
			}
		}
		if (node.type === 'VariableDeclarator' && node.init) {
			declaratorsByInitializer.set(node.init, node);
		}
	});

	const output: SharedFactoryDeclarator[] = [];
	walkAst(program, (node) => {
		if (
			node.type !== 'CallExpression' ||
			node.callee?.type !== 'Identifier' ||
			!sharedImports.has(node.callee.name)
		)
			return;
		const declarator = declaratorsByInitializer.get(node);
		if (declarator?.id?.type !== 'Identifier') {
			let nestedInFunction = false;
			walkAst(program, (candidate) => {
				if (
					isFunctionNode(candidate) &&
					(candidate.start ?? Infinity) < (node.start ?? -Infinity) &&
					(candidate.end ?? -Infinity) > (node.end ?? Infinity)
				) {
					nestedInFunction = true;
				}
			});
			if (nestedInFunction) return;
			throw new Error(`Shared factory in ${filename} has no identifier declarator binding.`);
		}
		if (typeof node.start !== 'number' || typeof node.end !== 'number') {
			throw new Error(
				`Shared factory ${declarator.id.name} in ${filename} has no mappable factory span.`,
			);
		}
		output.push({
			name: declarator.id.name,
			callStart: node.start,
			callEnd: node.end,
			factory: node.arguments?.[0],
		});
	});
	return output;
}

function sharedBindingInitializer(
	definitionId: string,
	bindingName: string,
	bindingKind: string,
	factory: AnyNode | undefined,
): SerializableAstNode {
	const candidates: AnyNode[] = [];
	if (factory) {
		walkAst(factory.body ?? factory, (node) => {
			if (
				node.type === 'VariableDeclarator' &&
				node.id?.type === 'Identifier' &&
				node.id.name === bindingName &&
				node.init?.type === 'CallExpression' &&
				node.init.callee?.type === 'Identifier' &&
				node.init.callee.name === bindingKind &&
				node.init.arguments?.[0]?.type
			) {
				candidates.push(node.init.arguments[0]);
			}
		});
	}
	if (candidates.length !== 1) {
		throw new Error(
			`Shared definition ${definitionId} cell ${bindingName} has no mappable ${bindingKind} initializer AST.`,
		);
	}
	return serializeAst(candidates[0]!);
}

function buildSharedReads(
	program: AnyNode,
	graph: SemanticGraphArtifact,
	components: readonly ComponentWork[],
	instances: readonly SharedInstance[],
	properties: ReadonlyMap<
		string,
		ReadonlyMap<string, { graphNodeId: string; path: readonly string[] }>
	>,
): SharedRead[] {
	const candidates = [
		...graph.templateReads,
		...graph.stateReads.filter((read) => !read.sharedDefinitionId),
	];
	const output: SharedRead[] = [];
	for (const read of candidates) {
		const [localName, propertyName, ...path] = read.source.replace(/\?\./g, '.').split('.');
		if (!read.sourceSpan) {
			if (instances.some((candidate) => candidate.localName === localName)) {
				throw new Error(
					`Shared read ${read.source} has no source span for definition/property attribution.`,
				);
			}
			continue;
		}
		const component = componentForSpan(
			`Shared read ${read.source}`,
			read.sourceSpan,
			components,
		);
		const instance = instances.find(
			(candidate) =>
				candidate.componentId === component.id && candidate.localName === localName,
		);
		if (!instance) continue;
		if (!propertyName || !properties.get(instance.definitionId)?.has(propertyName)) {
			let isCallCallee = false;
			walkAst(program, (node) => {
				const call = unwrapCall(node);
				const callee = call?.callee;
				if (
					callee?.start === read.sourceSpan?.start &&
					callee.end === read.sourceSpan?.end
				) {
					isCallCallee = true;
				}
			});
			if (isCallCallee) continue;
			throw new Error(
				`Shared read ${read.source} for definition ${instance.definitionId} has unmapped property ${propertyName ?? '<missing>'}.`,
			);
		}
		const node = findNodeBySpan(program, read.sourceSpan);
		if (!node) throw new Error(`Shared read ${read.source} has no AST site.`);
		const graphProperty = properties.get(instance.definitionId)!.get(propertyName)!;
		output.push({
			definitionId: instance.definitionId,
			propertyName,
			path: [...graphProperty.path, ...path],
			componentId: component.id,
			site: {
				expression: serializeAst(node),
				reads: [
					{
						graphNodeId: graphProperty.graphNodeId,
						path: [...graphProperty.path, ...path],
						via: 'direct',
					},
				],
			},
		});
	}
	return dedupeBy(
		output,
		(read) =>
			`${read.componentId}\0${read.definitionId}\0${read.propertyName}\0${String(read.site.expression.start)}`,
	);
}

function buildSharedCalls(
	graph: SemanticGraphArtifact,
	events: readonly EnrichedEventRecord[],
	instances: readonly SharedInstance[],
	components: readonly ComponentWork[],
): SharedCall[] {
	const methods = new Map(
		graph.sharedDefinitions.map((definition) => [
			definition.id,
			new Set(
				(definition.returnProperties ?? [])
					.filter((property) => property.kind === 'method')
					.map((property) => property.name),
			),
		]),
	);
	const output: SharedCall[] = [];
	let order = 0;
	for (const event of events) {
		const component = components.find((candidate) => candidate.id === event.componentId)!;
		for (const handler of event.handlers)
			walkAst(handler.expression as AnyNode, (node) => {
				const call = unwrapCall(node);
				if (!call || call.callee?.type !== 'MemberExpression') return;
				const chain = memberChain(call.callee);
				if (!chain) return;
				const instance = instances.find(
					(candidate) =>
						candidate.componentId === component.id &&
						candidate.localName === chain.root,
				);
				if (!instance) return;
				const propertyName = chain.path[0] ?? '<missing>';
				if (
					chain.path.length !== 1 ||
					!methods.get(instance.definitionId)?.has(propertyName)
				) {
					throw new Error(
						`Shared call ${chain.root}.${chain.path.join('.')} for definition ${instance.definitionId} has unmapped property ${propertyName}.`,
					);
				}
				output.push({
					definitionId: instance.definitionId,
					methodName: propertyName,
					arguments: (call.arguments ?? []).map((argument: AnyNode) =>
						serializeAst(argument),
					),
					componentId: component.id,
					eventId: event.id,
					site: { expression: serializeAst(node), reads: handler.reads },
					order: order++,
				});
			});
	}
	return output;
}

function buildSharedWrites(program: AnyNode, graph: SemanticGraphArtifact): SharedWrite[] {
	return graph.stateWrites
		.filter((write) => write.sharedDefinitionId)
		.sort(
			(left, right) =>
				(left.targetSpan?.start ?? Infinity) - (right.targetSpan?.start ?? Infinity),
		)
		.map((write, order) => {
			if (!write.targetSpan) {
				throw new Error(
					`Shared write ${write.target} has no source span for method attribution.`,
				);
			}
			const binding = graph.graphBindings.find(
				(candidate) =>
					candidate.sharedDefinitionId === write.sharedDefinitionId &&
					candidate.name === write.target.split('.')[0],
			);
			if (!binding)
				throw new Error(`Shared write ${write.target} has no definition graph binding.`);
			const operation = findOperationForSpan(program, write.targetSpan);
			return compactObject({
				definitionId: write.sharedDefinitionId!,
				graphNodeId: binding.id,
				path: write.target.split('.').slice(1),
				operation: write.operation,
				assignmentOperator: write.assignmentOperator,
				updateOperator: write.updateOperator,
				prefix: write.prefix,
				method: write.method,
				value:
					operation?.type === 'AssignmentExpression'
						? serializeAst(operation.right)
						: undefined,
				arguments:
					operation?.type === 'CallExpression'
						? (operation.arguments ?? []).map((argument: AnyNode) =>
								serializeAst(argument),
							)
						: undefined,
				sourceSpan: {
					...write.targetSpan,
					filename: normalizeFilename(write.targetSpan.filename),
				},
				order,
			}) as unknown as SharedWrite;
		});
}

function buildElementHandleBindings(
	graph: SemanticGraphArtifact,
	components: readonly ComponentWork[],
	hostOwners: ReadonlyMap<string, string>,
): ElementHandleBinding[] {
	return graph.elementHandleBindings.map((binding) => {
		const componentId = ownerForHostLinked(
			'Element handle binding',
			binding.hostNodeId,
			hostOwners,
		);
		if (
			binding.componentName &&
			components.find((component) => component.id === componentId)?.name !==
				binding.componentName
		) {
			throw new Error(
				`Element handle ${binding.handleName} componentName disagrees with host ownership.`,
			);
		}
		if (
			binding.sourceSpan &&
			componentForSpan(`Element handle ${binding.handleName}`, binding.sourceSpan, components)
				.id !== componentId
		) {
			throw new Error(
				`Element handle ${binding.handleName} span ownership disagrees with host ownership.`,
			);
		}
		return {
			id: `element-handle:${binding.hostNodeId}:${binding.handleName}`,
			handleName: binding.handleName,
			componentId,
			hostNodeId: binding.hostNodeId,
		};
	});
}

function buildBehaviors(graph: SemanticGraphArtifact, context: TemplateContext): BehaviorRecord[] {
	const used = new Map<string, number>();
	const records = graph.behaviors.map((behavior, order) => {
		const index = used.get(behavior.hostNodeId) ?? 0;
		used.set(behavior.hostNodeId, index + 1);
		const authored = context.behaviorNodes.get(behavior.hostNodeId)?.[index];
		if (!authored)
			throw new Error(
				`Behavior ${order} on ${behavior.hostNodeId} has no authored attach AST.`,
			);
		const inputs = deriveReads(authored.node, authored.environment);
		if (inputs.length !== behavior.inputSources.length) {
			throw new Error(
				`Behavior ${order} on ${behavior.hostNodeId} input mapping is incomplete (${inputs.length}/${behavior.inputSources.length}).`,
			);
		}
		return {
			id: `behavior:${order}`,
			hostNodeId: behavior.hostNodeId,
			componentId: ownerForHostLinked('Behavior', behavior.hostNodeId, context.hostOwners),
			behavior: serializeAst(authored.node),
			inputs,
			returnsCleanup: functionReturnsCleanup(authored.node),
			order: authored.order,
		};
	});
	for (const [hostNodeId, nodes] of context.behaviorNodes) {
		if ((used.get(hostNodeId) ?? 0) !== nodes.length)
			throw new Error(`Attach behavior on ${hostNodeId} was not represented by Layer A.`);
	}
	return records;
}

function buildHandleCalls(
	events: readonly EnrichedEventRecord[],
	bindings: readonly ElementHandleBinding[],
): HandleCallRecord[] {
	const output: HandleCallRecord[] = [];
	let order = 0;
	for (const event of events)
		for (const handler of event.handlers) {
			walkAst(handler.expression as AnyNode, (node) => {
				const call = unwrapCall(node);
				if (!call || call.callee?.type !== 'MemberExpression') return;
				const chain = memberChain(call.callee);
				if (!chain || chain.path.length !== 1) return;
				const binding = bindings.find(
					(candidate) =>
						candidate.componentId === event.componentId &&
						candidate.handleName === chain.root,
				);
				if (!binding) return;
				output.push({
					handleBindingId: binding.id,
					componentId: event.componentId,
					method: chain.path[0]!,
					arguments: (call.arguments ?? []).map((argument: AnyNode) =>
						serializeAst(argument),
					),
					optional: Boolean(
						call.optional || call.callee.optional || node.type === 'ChainExpression',
					),
					eventId: event.id,
					site: { expression: serializeAst(node), reads: handler.reads },
					order: order++,
				});
			});
		}
	return dedupeBy(
		output,
		(record) =>
			`${record.handleBindingId}\0${String(record.site.expression.start)}\0${String(record.site.expression.end)}`,
	).map((record, index) => ({ ...record, order: index }));
}

function findNodeBySpan(
	root: AnyNode,
	span: { start: number; end: number } | undefined,
): AnyNode | undefined {
	if (!span) return undefined;
	let found: AnyNode | undefined;
	walkAst(root, (node) => {
		if (node.start === span.start && node.end === span.end) found = node;
	});
	return found;
}

function findOperationForSpan(
	root: AnyNode,
	span: { start: number; end: number } | undefined,
): AnyNode | undefined {
	if (!span) return undefined;
	let found: AnyNode | undefined;
	walkAst(root, (node) => {
		if (
			![
				'AssignmentExpression',
				'UpdateExpression',
				'UnaryExpression',
				'CallExpression',
			].includes(node.type)
		)
			return;
		if ((node.start ?? Infinity) <= span.start && (node.end ?? -Infinity) >= span.end) {
			if (!found || node.end! - node.start! < found.end! - found.start!) found = node;
		}
	});
	return found;
}

function walkAst(root: AnyNode, visit: (node: AnyNode) => void): void {
	const seen = new Set<object>();
	const walk = (node: AnyNode | null | undefined): void => {
		if (!node || typeof node !== 'object' || seen.has(node)) return;
		seen.add(node);
		visit(node);
		for (const [key, value] of Object.entries(node)) {
			if (OMITTED_AST_KEYS.has(key) || key === 'type' || key === 'start' || key === 'end')
				continue;
			if (Array.isArray(value)) {
				for (const child of value) if (isNode(child)) walk(child);
			} else if (isNode(value)) walk(value);
		}
	};
	walk(root);
}

function unwrapCall(node: AnyNode): AnyNode | undefined {
	const unwrapped = node.type === 'ChainExpression' ? node.expression : node;
	return unwrapped?.type === 'CallExpression' ? unwrapped : undefined;
}

function functionReturnsCleanup(node: AnyNode): boolean {
	let returns = false;
	walkAst(node.body ?? node, (candidate) => {
		if (candidate.type === 'ReturnStatement' && isFunctionNode(candidate.argument))
			returns = true;
	});
	return returns;
}

function resolveAliases(
	graph: SemanticGraphArtifact,
	components: readonly ComponentWork[],
	bindingOwners: ReadonlyMap<SemanticGraphArtifact['graphBindings'][number], ComponentWork>,
): EnrichedAliasRecord[] {
	return graph.aliases.map((alias: SemanticGraphAlias) => {
		const [root, ...path] = alias.target.split('.');
		const owner = componentForSpan(`Alias ${alias.name}`, alias.sourceSpan, components);
		const binding = graph.graphBindings.find(
			(candidate) => candidate.name === root && bindingOwners.get(candidate)?.id === owner.id,
		);
		if (!binding)
			throw new Error(`Alias ${alias.name} targets unresolved component graph root ${root}.`);
		return compactObject({
			componentId: owner.id,
			id: `alias:${owner.name}:${alias.name}`,
			name: alias.name,
			target: alias.target,
			graphNodeId: binding.id,
			path,
			declarationKind: alias.declarationKind,
			sourceSpan: alias.sourceSpan
				? { ...alias.sourceSpan, filename: normalizeFilename(alias.sourceSpan.filename) }
				: undefined,
		}) as unknown as EnrichedAliasRecord;
	});
}

interface StateProvenance {
	readonly graphNodeId: string;
	readonly path: readonly string[];
	readonly receiverAliasesState: boolean;
	readonly elementsAliasState: boolean;
	readonly viaLocal: boolean;
}

const MUTATING_METHODS = new Set([
	'copyWithin',
	'fill',
	'pop',
	'push',
	'reverse',
	'shift',
	'sort',
	'splice',
	'unshift',
]);
const ROW_SELECTING_METHODS = new Set(['at', 'find']);
const SHALLOW_COLLECTION_METHODS = new Set(['concat', 'filter', 'map', 'slice']);

/**
 * Derive writes from assignment/update/delete targets and the actual call receiver.
 * A local produced by `state.find(...)` aliases a state row and its member writes
 * project to `state / * / member`. A shallow copied container does not alias the
 * state container, although rows selected from it still alias the original rows.
 */
function deriveHandlerEffects(
	node: AnyNode,
	environment: ReadEnvironment,
): { reads: GraphReadRef[]; writes: StateWriteRecord[] } {
	const localProvenance = new Map<string, StateProvenance>();
	const writes: StateWriteRecord[] = [];

	const directState = (name: string): StateProvenance | undefined => {
		const binding = environment.bindings.get(name);
		return binding?.id.startsWith('state:')
			? {
					graphNodeId: binding.id,
					path: [],
					receiverAliasesState: true,
					elementsAliasState: true,
					viaLocal: false,
				}
			: undefined;
	};

	const provenance = (expression: AnyNode | null | undefined): StateProvenance | undefined => {
		if (!expression) return undefined;
		if (expression.type === 'Identifier')
			return localProvenance.get(expression.name) ?? directState(expression.name);
		if (expression.type === 'ChainExpression') return provenance(expression.expression);
		if (expression.type === 'MemberExpression') {
			const base = provenance(expression.object);
			if (!base) return undefined;
			const part = expression.computed
				? expression.property?.type === 'Literal'
					? String(expression.property.value)
					: '*'
				: staticPropertyName(expression.property);
			return { ...base, path: [...base.path, part] };
		}
		if (
			expression.type === 'CallExpression' &&
			expression.callee?.type === 'MemberExpression'
		) {
			const base = provenance(expression.callee.object);
			if (!base) return undefined;
			const method = staticPropertyName(expression.callee.property);
			if (ROW_SELECTING_METHODS.has(method)) {
				return {
					...base,
					path: [...base.path, '*'],
					receiverAliasesState: base.elementsAliasState,
					viaLocal: true,
				};
			}
			if (SHALLOW_COLLECTION_METHODS.has(method)) {
				return {
					...base,
					receiverAliasesState: false,
					elementsAliasState: base.elementsAliasState,
					viaLocal: true,
				};
			}
			return { ...base, viaLocal: true };
		}
		return undefined;
	};

	const span = (target: AnyNode) =>
		target.start === undefined || target.end === undefined
			? undefined
			: { filename: environment.filename, start: target.start, end: target.end };
	const target = (left: AnyNode): { provenance: StateProvenance; path: string[] } | undefined => {
		if (left.type === 'Identifier') {
			const found = directState(left.name);
			return found ? { provenance: found, path: [...found.path] } : undefined;
		}
		if (left.type === 'MemberExpression') {
			const found = provenance(left.object);
			if (!found?.receiverAliasesState) return undefined;
			const part = left.computed
				? left.property?.type === 'Literal'
					? String(left.property.value)
					: '*'
				: staticPropertyName(left.property);
			return { provenance: found, path: [...found.path, part] };
		}
		return undefined;
	};
	const addWrite = (record: StateWriteRecord): void => {
		writes.push(record);
	};

	const visit = (current: AnyNode | null | undefined): void => {
		if (!current || typeof current !== 'object') return;
		if (current.type === 'BlockStatement') {
			for (const statement of current.body ?? []) visit(statement);
			return;
		}
		if (current.type === 'VariableDeclaration') {
			for (const declarator of current.declarations ?? []) {
				visit(declarator.init);
				const found = provenance(declarator.init);
				if (found)
					for (const name of patternNames(declarator.id))
						localProvenance.set(name, { ...found, viaLocal: true });
			}
			return;
		}
		if (current.type === 'AssignmentExpression') {
			const found = target(current.left);
			if (found)
				addWrite(
					compactObject({
						componentId: environment.componentId,
						graphNodeId: found.provenance.graphNodeId,
						path: found.path,
						operation: 'assign',
						assignmentOperator: current.operator,
						value: serializeAst(current.right),
						sourceSpan: span(current.left),
						via: found.provenance.viaLocal ? 'handler-local-alias' : 'direct',
					}) as StateWriteRecord,
				);
			visit(current.right);
			if (current.left.computed) visit(current.left.property);
			return;
		}
		if (current.type === 'UpdateExpression') {
			const found = target(current.argument);
			if (found)
				addWrite(
					compactObject({
						componentId: environment.componentId,
						graphNodeId: found.provenance.graphNodeId,
						path: found.path,
						operation: 'update',
						updateOperator: current.operator,
						prefix: current.prefix,
						sourceSpan: span(current.argument),
						via: found.provenance.viaLocal ? 'handler-local-alias' : 'direct',
					}) as StateWriteRecord,
				);
			return;
		}
		if (current.type === 'UnaryExpression' && current.operator === 'delete') {
			const found = target(current.argument);
			if (found)
				addWrite(
					compactObject({
						componentId: environment.componentId,
						graphNodeId: found.provenance.graphNodeId,
						path: found.path,
						operation: 'delete',
						sourceSpan: span(current.argument),
						via: found.provenance.viaLocal ? 'handler-local-alias' : 'direct',
					}) as StateWriteRecord,
				);
			return;
		}
		if (current.type === 'CallExpression') {
			if (current.callee?.type === 'MemberExpression') {
				const receiver = provenance(current.callee.object);
				const method = staticPropertyName(current.callee.property);
				if (receiver?.receiverAliasesState && MUTATING_METHODS.has(method))
					addWrite(
						compactObject({
							componentId: environment.componentId,
							graphNodeId: receiver.graphNodeId,
							path: [...receiver.path],
							operation: 'call',
							method,
							arguments: (current.arguments ?? []).map((argument: AnyNode) =>
								serializeAst(argument),
							),
							sourceSpan: span(current.callee),
							via: receiver.viaLocal ? 'handler-local-alias' : 'direct',
						}) as StateWriteRecord,
					);
				visit(current.callee.object);
				if (current.callee.computed) visit(current.callee.property);
			} else visit(current.callee);
			for (const argument of current.arguments ?? []) visit(argument);
			return;
		}
		for (const [key, value] of Object.entries(current)) {
			if (OMITTED_AST_KEYS.has(key) || key === 'type' || key === 'start' || key === 'end')
				continue;
			if (Array.isArray(value)) {
				for (const child of value) if (isNode(child)) visit(child);
			} else if (isNode(value)) visit(value);
		}
	};

	visit(node.body ?? node);
	return { reads: deriveReads(node, environment), writes: sortWrites(writes) };
}

function helperCallArgument(
	initializer: AnyNode | null | undefined,
	kind: string,
): AnyNode | undefined {
	if (!initializer || initializer.type !== 'CallExpression') return undefined;
	if (initializer.callee?.type !== 'Identifier' || initializer.callee.name !== kind)
		return undefined;
	return initializer.arguments?.[0];
}

function toStateReads(reads: readonly GraphReadRef[], componentId: string): StateReadRecord[] {
	return dedupeBy(
		reads.map((read) => ({ componentId, graphNodeId: read.graphNodeId, path: [...read.path] })),
		(read) => `${read.graphNodeId}\u0000${read.path.join('\u0000')}`,
	).sort(compareReads);
}

function collectCanonicalReads(
	components: readonly EnrichedComponent[],
	bindings: readonly EnrichedGraphBinding[],
	events: readonly EnrichedEventRecord[],
): StateReadRecord[] {
	const gathered: StateReadRecord[] = [];
	const visit = (value: unknown, componentId: string): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) return void value.forEach((child) => visit(child, componentId));
		for (const [key, child] of Object.entries(value)) {
			if (key === 'reads' && Array.isArray(child)) {
				for (const read of child) {
					if (
						read &&
						typeof read === 'object' &&
						'graphNodeId' in read &&
						'path' in read
					) {
						gathered.push({
							componentId,
							graphNodeId: (read as GraphReadRef).graphNodeId,
							path: [...(read as GraphReadRef).path],
						});
					}
				}
			} else visit(child, componentId);
		}
	};
	for (const component of components) visit(component, component.id);
	for (const binding of bindings) visit(binding, binding.componentId);
	for (const event of events) visit(event, event.componentId);
	return dedupeBy(
		gathered,
		(read) => `${read.componentId}\0${read.graphNodeId}\0${read.path.join('\0')}`,
	).sort(compareReads);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function compareReads(left: StateReadRecord, right: StateReadRecord): number {
	return (
		compareText(left.componentId, right.componentId) ||
		compareText(left.graphNodeId, right.graphNodeId) ||
		compareText(left.path.join('\u0000'), right.path.join('\u0000'))
	);
}

function sortWrites(writes: readonly StateWriteRecord[]): StateWriteRecord[] {
	return [...writes].sort(
		(left, right) =>
			compareText(left.componentId, right.componentId) ||
			compareText(left.graphNodeId, right.graphNodeId) ||
			compareText(left.path.join('\u0000'), right.path.join('\u0000')) ||
			compareText(left.operation, right.operation) ||
			compareText(left.method ?? '', right.method ?? '') ||
			(left.sourceSpan?.start ?? -1) - (right.sourceSpan?.start ?? -1) ||
			(left.sourceSpan?.end ?? -1) - (right.sourceSpan?.end ?? -1),
	);
}

function normalizeFilename(filename: string): string {
	const normalized = normalize(filename);
	if (!isAbsolute(normalized)) {
		return normalized.startsWith('./') ? normalized.slice(2) : normalized;
	}
	// Absolute inputs must not leak machine-specific prefixes into artifacts:
	// keep the repo-meaningful tail (src/fixtures/...) or the basename.
	const fixtureIndex = normalized.lastIndexOf('/src/fixtures/');
	if (fixtureIndex >= 0) return normalized.slice(fixtureIndex + 1);
	return basename(normalized);
}

function assertFullyConsumed(context: TemplateContext): void {
	if (context.hostCursor !== context.hostNodes.length) {
		throw new Error(
			`Only joined ${context.hostCursor}/${context.hostNodes.length} semantic hosts.`,
		);
	}
	if (context.branchCursor !== context.branchSites.length) {
		throw new Error(
			`Only joined ${context.branchCursor}/${context.branchSites.length} branch sites.`,
		);
	}
	if (context.repeatCursor !== context.repeats.length) {
		throw new Error(
			`Only joined ${context.repeatCursor}/${context.repeats.length} keyed repeats.`,
		);
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
			property.type === 'RestElement'
				? patternNames(property.argument)
				: patternNames(property.value),
		);
	}
	return [];
}

/** Exported for tests and downstream tooling that validates AST-derived dependencies. */
export function collectGraphReads(
	expression: SerializableAstNode,
	bindings: ReadonlyArray<{ id: string; name: string }>,
): ReadonlyArray<GraphReadRef> {
	const bindingsByName = new Map<string, { id: string; name: string }>();
	for (const binding of bindings) {
		const existing = bindingsByName.get(binding.name);
		if (existing) {
			throw new Error(
				`GraphRead binding name collision for "${binding.name}" between "${existing.id}" and "${binding.id}"; component ownership is required.`,
			);
		}
		bindingsByName.set(binding.name, binding);
	}
	return deriveReads(expression as AnyNode, {
		componentId: '',
		filename: '',
		bindings: bindingsByName,
		aliases: new Map(),
		locals: new Map(),
		repeatItems: new Map(),
		sharedInstances: new Map(),
	});
}

export function serializeAst(node: AnyNode): SerializableAstNode {
	const clone = (value: unknown): JsonValue | undefined => {
		if (value === undefined || typeof value === 'function' || typeof value === 'symbol')
			return undefined;
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
			compareText(left.graphNodeId, right.graphNodeId) ||
			compareText(left.path.join('\u0000'), right.path.join('\u0000')) ||
			compareText(left.via, right.via),
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
	if (node.type === 'JSXNamespacedName')
		return `${jsxName(node.namespace)}:${jsxName(node.name)}`;
	if (node.type === 'JSXMemberExpression')
		return `${jsxName(node.object)}.${jsxName(node.property)}`;
	return '';
}

function jsxEventName(name: string): string | null {
	if (!/^on[A-Z]/.test(name)) return null;
	return name.slice(2).toLowerCase();
}

function isNode(value: unknown): value is AnyNode {
	return Boolean(
		value && typeof value === 'object' && typeof (value as AnyNode).type === 'string',
	);
}

function isFunctionNode(node: AnyNode): boolean {
	return (
		node.type === 'ArrowFunctionExpression' ||
		node.type === 'FunctionExpression' ||
		node.type === 'FunctionDeclaration'
	);
}

function isTemplateNode(node: AnyNode): boolean {
	return (
		node.type === 'JSXElement' ||
		node.type === 'TSRXJSXElement' ||
		node.type === 'JSXFragment' ||
		node.type === 'TSRXJSXFragment'
	);
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
	return Object.fromEntries(
		Object.entries(value).filter(([, child]) => child !== undefined),
	) as Partial<T>;
}
