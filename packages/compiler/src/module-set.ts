import {
	ENRICHED_IR_VERSION,
	type ComponentExport,
	type EnrichedIR,
	type ModuleImport,
	type TemplateComponentReference,
	type TemplateNode,
} from './schema.ts';

export interface ModuleSetInput {
	readonly moduleId: string;
	readonly artifact: EnrichedIR;
}

export interface ModuleSetReferenceLink {
	readonly nodeId: string;
	readonly targetModuleId: string;
	readonly exportedName: string;
}

export interface ModuleSetModuleLinks {
	readonly moduleId: string;
	readonly references: ReadonlyArray<ModuleSetReferenceLink>;
}

/** Sorted by canonical module id, with each module's references sorted by node id. */
export type ModuleSetLinkTable = ReadonlyArray<ModuleSetModuleLinks>;

type CanonicalModule = {
	readonly moduleId: string;
	readonly artifact: EnrichedIR;
	readonly componentNames: ReadonlySet<string>;
	readonly exportsByName: ReadonlyMap<string, ComponentExport>;
	readonly exportsByComponent: ReadonlyMap<string, ComponentExport>;
	readonly imports: ReadonlyArray<ModuleImport>;
};

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

function exactKeys(value: object, allowed: readonly string[], construct: string): void {
	const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
	if (unknown.length) throw new Error(`${construct} has unknown semantic field: ${unknown[0]}`);
}

function assertRecord(value: unknown, construct: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`${construct} has malformed construct`);
}

function assertArray(value: unknown, construct: string): asserts value is unknown[] {
	if (!Array.isArray(value)) throw new Error(`${construct} has malformed construct`);
}

function normalizeRelativePath(value: string, construct: string): string {
	if (!value || value.startsWith('/') || value.includes('\\'))
		throw new Error(`${construct} must be a POSIX path relative to the build invocation root`);
	const parts: string[] = [];
	for (const part of value.split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') {
			if (!parts.length)
				throw new Error(`${construct} escapes the build invocation root: ${value}`);
			parts.pop();
			continue;
		}
		parts.push(part);
	}
	const normalized = parts.join('/');
	if (!normalized.endsWith('.tsrx'))
		throw new Error(`${construct} must use an explicit .tsrx extension: ${value}`);
	return normalized;
}

function directory(moduleId: string): string {
	const slash = moduleId.lastIndexOf('/');
	return slash === -1 ? '' : moduleId.slice(0, slash);
}

function resolveSpecifier(moduleId: string, specifier: string, construct: string): string {
	if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
		if (specifier.endsWith('.tsrx'))
			throw new Error(
				`${construct} must use a relative ./ or ../ .tsrx specifier: ${specifier}`,
			);
		throw new Error(`${construct} must use an explicit .tsrx extension`);
	}
	if (!specifier.endsWith('.tsrx'))
		throw new Error(`${construct} must use an explicit .tsrx extension`);
	return normalizeRelativePath(
		directory(moduleId) ? `${directory(moduleId)}/${specifier}` : specifier,
		construct,
	);
}

function validateImport(value: unknown, moduleId: string): ModuleImport {
	assertRecord(value, 'ModuleImport');
	exactKeys(value, ['localName', 'source', 'kind', 'importedName', 'resolvesTo'], 'ModuleImport');
	if (
		typeof value.localName !== 'string' ||
		typeof value.source !== 'string' ||
		!['default', 'named', 'namespace'].includes(String(value.kind)) ||
		(value.importedName !== undefined && typeof value.importedName !== 'string') ||
		(value.resolvesTo !== undefined && value.resolvesTo !== 'tsrx-module')
	)
		throw new Error(`ModuleImport in ${moduleId} has malformed construct`);
	return value as unknown as ModuleImport;
}

function validateExport(value: unknown, moduleId: string): ComponentExport {
	assertRecord(value, 'ComponentExport');
	exactKeys(value, ['kind', 'componentName', 'exportedName'], 'ComponentExport');
	if (
		!['default', 'named'].includes(String(value.kind)) ||
		typeof value.componentName !== 'string' ||
		typeof value.exportedName !== 'string'
	)
		throw new Error(`ComponentExport in ${moduleId} has malformed construct`);
	return value as unknown as ComponentExport;
}

function validateArtifact(value: unknown, moduleId: string): EnrichedIR {
	assertRecord(value, `EnrichedIR for module ${moduleId}`);
	exactKeys(
		value,
		['version', 'filename', 'imports', 'module', 'components', 'records'],
		'EnrichedIR',
	);
	if (value.version !== ENRICHED_IR_VERSION)
		throw new Error(
			`EnrichedIR for module ${moduleId} has invalid artifact version: expected ${ENRICHED_IR_VERSION}, received ${String(value.version)}`,
		);
	if (typeof value.filename !== 'string')
		throw new Error(`EnrichedIR for module ${moduleId} has malformed filename`);
	assertArray(value.imports, `EnrichedIR imports for module ${moduleId}`);
	assertArray(value.components, `EnrichedIR components for module ${moduleId}`);
	assertRecord(value.module, 'ModuleRecord');
	exactKeys(value.module, ['exports'], 'ModuleRecord');
	assertArray(value.module.exports, `ModuleRecord exports for module ${moduleId}`);
	assertRecord(value.records, 'EnrichedRecordTable');
	return value as unknown as EnrichedIR;
}

function validateTarget(
	value: unknown,
	nodeId: string,
	moduleId: string,
): TemplateComponentReference['target'] {
	assertRecord(value, 'TemplateComponentReference target');
	const self = value.module === 'self';
	exactKeys(
		value,
		self ? ['localName', 'module'] : ['localName', 'module', 'exportedName'],
		'TemplateComponentReference target',
	);
	if (
		typeof value.localName !== 'string' ||
		typeof value.module !== 'string' ||
		(!self && typeof value.exportedName !== 'string')
	)
		throw new Error(`TemplateComponentReference ${nodeId} in ${moduleId} has malformed target`);
	return value as TemplateComponentReference['target'];
}

function collectReferences(
	nodes: readonly TemplateNode[],
	moduleId: string,
	result: TemplateComponentReference[],
): void {
	for (const node of nodes) {
		assertRecord(node, 'TemplateNode');
		if (typeof node.kind !== 'string' || typeof node.id !== 'string')
			throw new Error(`TemplateNode in ${moduleId} has malformed construct`);
		const nodeKind: string = node.kind;
		switch (nodeKind) {
			case 'component-reference':
				exactKeys(
					node,
					['kind', 'id', 'edgeId', 'target', 'props', 'children'],
					'TemplateComponentReference',
				);
				if (typeof node.edgeId !== 'string')
					throw new Error(
						`TemplateComponentReference ${node.id} in ${moduleId} has malformed construct`,
					);
				validateTarget(node.target, node.id, moduleId);
				assertArray(node.props, `TemplateComponentReference ${node.id} props`);
				assertArray(node.children, `TemplateComponentReference ${node.id} children`);
				result.push(node as unknown as TemplateComponentReference);
				collectReferences(node.children as TemplateNode[], moduleId, result);
				break;
			case 'host':
				exactKeys(
					node,
					[
						'kind',
						'id',
						'tag',
						'staticAttributes',
						'dynamicBindings',
						'eventIds',
						'children',
					],
					'TemplateHost',
				);
				assertArray(node.children, `TemplateHost ${node.id} children`);
				collectReferences(node.children as TemplateNode[], moduleId, result);
				break;
			case 'fragment':
				exactKeys(node, ['kind', 'id', 'children'], 'TemplateFragment');
				assertArray(node.children, `TemplateFragment ${node.id} children`);
				collectReferences(node.children as TemplateNode[], moduleId, result);
				break;
			case 'branch':
				exactKeys(node, ['kind', 'id', 'expression', 'reads', 'arms'], 'TemplateBranch');
				assertArray(node.arms, `TemplateBranch ${node.id} arms`);
				for (const arm of node.arms) {
					assertRecord(arm, 'TemplateBranchArm');
					exactKeys(
						arm,
						arm.kind === 'else' ? ['kind', 'children'] : ['kind', 'test', 'children'],
						'TemplateBranchArm',
					);
					assertArray(arm.children, `TemplateBranchArm in ${node.id} children`);
					collectReferences(arm.children as TemplateNode[], moduleId, result);
				}
				break;
			case 'keyed-repeat':
				exactKeys(
					node,
					['kind', 'id', 'item', 'index', 'collection', 'key', 'row', 'empty'],
					'TemplateKeyedRepeat',
				);
				assertArray(node.row, `TemplateKeyedRepeat ${node.id} row`);
				assertArray(node.empty, `TemplateKeyedRepeat ${node.id} empty`);
				collectReferences(node.row as TemplateNode[], moduleId, result);
				collectReferences(node.empty as TemplateNode[], moduleId, result);
				break;
			case 'text':
				exactKeys(node, ['kind', 'id', 'value'], 'TemplateText');
				break;
			case 'dynamic-text':
				exactKeys(node, ['kind', 'id', 'expression', 'reads'], 'TemplateDynamicText');
				break;
			case 'default-slot-projection':
				exactKeys(node, ['kind', 'id', 'site'], 'TemplateDefaultSlotProjection');
				break;
			default:
				throw new Error(
					`TemplateNode in ${moduleId} has unsupported construct: ${nodeKind}`,
				);
		}
	}
}

function canonicalModules(modules: ReadonlyArray<ModuleSetInput>): CanonicalModule[] {
	if (!Array.isArray(modules)) throw new Error('ModuleSet input has malformed construct');
	const seen = new Set<string>();
	const canonical: CanonicalModule[] = [];
	for (const input of modules as readonly unknown[]) {
		assertRecord(input, 'ModuleSetInput');
		exactKeys(input, ['moduleId', 'artifact'], 'ModuleSetInput');
		if (typeof input.moduleId !== 'string')
			throw new Error('ModuleSetInput has malformed moduleId');
		const moduleId = normalizeRelativePath(input.moduleId, 'ModuleSetInput moduleId');
		if (seen.has(moduleId)) throw new Error(`ModuleSet has duplicate moduleId: ${moduleId}`);
		seen.add(moduleId);
		const artifact = validateArtifact(input.artifact, moduleId);
		const imports = artifact.imports.map((entry) => validateImport(entry, moduleId));
		const exports = artifact.module.exports.map((entry) => validateExport(entry, moduleId));
		canonical.push({
			moduleId,
			artifact,
			imports,
			componentNames: new Set(artifact.components.map((component) => component.name)),
			exportsByName: new Map(exports.map((entry) => [entry.exportedName, entry])),
			exportsByComponent: new Map(
				[...exports]
					.sort((left, right) => compareText(left.exportedName, right.exportedName))
					.map((entry) => [entry.componentName, entry]),
			),
		});
	}
	return canonical.sort((left, right) => compareText(left.moduleId, right.moduleId));
}

function assertNoCycles(
	edges: ReadonlyMap<string, ReadonlyArray<string>>,
	moduleIds: readonly string[],
): void {
	const visited = new Set<string>();
	const active = new Map<string, number>();
	const path: string[] = [];
	const visit = (moduleId: string): void => {
		const cycleStart = active.get(moduleId);
		if (cycleStart !== undefined) {
			throw new Error(
				`Component-reference cycle: ${[...path.slice(cycleStart), moduleId].join(' -> ')}`,
			);
		}
		if (visited.has(moduleId)) return;
		active.set(moduleId, path.length);
		path.push(moduleId);
		for (const target of edges.get(moduleId) ?? []) visit(target);
		path.pop();
		active.delete(moduleId);
		visited.add(moduleId);
	};
	for (const moduleId of moduleIds) visit(moduleId);
}

/**
 * Validates and links independently built enriched-IR modules without filesystem access.
 * Input order is intentionally erased so diagnostics and output are deterministic.
 */
export function resolveModuleSet(modules: ReadonlyArray<ModuleSetInput>): ModuleSetLinkTable {
	const canonical = canonicalModules(modules);
	const byId = new Map(canonical.map((module) => [module.moduleId, module]));
	const edges = new Map<string, string[]>();
	const table: ModuleSetModuleLinks[] = [];

	for (const module of canonical) {
		const references: TemplateComponentReference[] = [];
		for (const component of module.artifact.components) {
			assertRecord(component, 'EnrichedComponent');
			exactKeys(
				component,
				['id', 'name', 'evaluation', 'props', 'locals', 'guards', 'template'],
				'EnrichedComponent',
			);
			assertArray(component.template, `EnrichedComponent template in ${module.moduleId}`);
			assertArray(component.guards, `EnrichedComponent guards in ${module.moduleId}`);
			collectReferences(component.template as TemplateNode[], module.moduleId, references);
			for (const guard of component.guards) {
				if (guard.whenTrue.kind === 'template')
					collectReferences(guard.whenTrue.children, module.moduleId, references);
			}
		}

		const links: ModuleSetReferenceLink[] = [];
		const externalTargets = new Set<string>();
		for (const reference of references) {
			const target = validateTarget(reference.target, reference.id, module.moduleId);
			if (target.module === 'self') {
				if (!module.componentNames.has(target.localName))
					throw new Error(
						`TemplateComponentReference ${reference.id} in ${module.moduleId} has unresolved component "${target.localName}" in module ${module.moduleId}`,
					);
				links.push({
					nodeId: reference.id,
					targetModuleId: module.moduleId,
					exportedName:
						module.exportsByComponent.get(target.localName)?.exportedName ??
						target.localName,
				});
				continue;
			}

			const exportedName = (target as { readonly exportedName: string }).exportedName;
			const matchingImport = module.imports.find(
				(entry) =>
					entry.source === target.module &&
					entry.localName === target.localName &&
					(entry.kind === 'default'
						? exportedName === 'default'
						: entry.importedName === exportedName),
			);
			const importConstruct = `ModuleImport "${target.module}" in ${module.moduleId}`;
			const targetModuleId = resolveSpecifier(
				module.moduleId,
				target.module,
				importConstruct,
			);
			if (!matchingImport)
				throw new Error(
					`TemplateComponentReference ${reference.id} in ${module.moduleId} has no matching ModuleImport record`,
				);
			const targetModule = byId.get(targetModuleId);
			if (!targetModule)
				throw new Error(
					`TemplateComponentReference ${reference.id} in ${module.moduleId} has missing module: ${targetModuleId}`,
				);
			if (!targetModule.exportsByName.has(exportedName))
				throw new Error(
					`TemplateComponentReference ${reference.id} in ${module.moduleId} has unresolved export "${exportedName}" in module ${targetModuleId}`,
				);
			externalTargets.add(targetModuleId);
			links.push({
				nodeId: reference.id,
				targetModuleId,
				exportedName,
			});
		}
		edges.set(module.moduleId, [...externalTargets].sort(compareText));
		table.push({
			moduleId: module.moduleId,
			references: links.sort(
				(left, right) =>
					compareText(left.nodeId, right.nodeId) ||
					compareText(left.targetModuleId, right.targetModuleId) ||
					compareText(left.exportedName, right.exportedName),
			),
		});
	}

	assertNoCycles(
		edges,
		canonical.map((module) => module.moduleId),
	);
	return table;
}
