import type * as ESTree from '@tsrx/core/types/estree';
import type { FramelessPersistenceRecord } from './persistence.ts';

/** Frameless-owned source coordinates. Filenames are normalized module-relative paths. */
export interface SourceSpan {
	readonly filename: string;
	readonly start: number;
	readonly end: number;
}

/** Structural module import contract exposed to emitters. */
export interface ModuleImport {
	readonly localName: string;
	readonly source: string;
	readonly kind: 'default' | 'named' | 'namespace';
	readonly importedName?: string;
	readonly resolvesTo?: 'tsrx-module';
}

export type GraphBindingKind = 'state' | 'computed' | 'element' | 'prop';
export type DeclarationKind = 'const' | 'let' | 'var';
export type GraphValueKind = 'scalar' | 'object' | 'array' | 'unknown';

export type SyncPolicyCondition =
	| { readonly type: 'and'; readonly conditions: ReadonlyArray<SyncPolicyCondition> }
	| { readonly type: 'or'; readonly conditions: ReadonlyArray<SyncPolicyCondition> }
	| { readonly type: 'not'; readonly condition: SyncPolicyCondition }
	| {
			readonly type: 'graph-truthy';
			readonly graphNodeId: string;
			readonly path: ReadonlyArray<string>;
	  }
	| { readonly type: 'constant-truthy'; readonly value: JsonValue }
	| { readonly type: 'event-equals'; readonly field: string; readonly value: JsonValue };
export type SyncPolicyBranch = {
	readonly when: SyncPolicyCondition;
	readonly actions: ReadonlyArray<'preventDefault' | 'stopPropagation'>;
};
export type SyncPolicy = SyncPolicyBranch | { readonly branches: ReadonlyArray<SyncPolicyBranch> };

/** Discriminator for the first serialized Frameless emitter-input contract. */
export const ENRICHED_IR_VERSION = 'frameless-enriched-ir/2' as const;

/** Values admitted by the deterministic JSON artifact. */
export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

/**
 * A cycle-free, JSON-safe copy of an @tsrx/core ESTree node.
 *
 * `metadata`, comments, and parent/path links are deliberately removed. `type`,
 * source offsets, and all syntax-bearing child fields remain, so emitters consume
 * syntax trees and never parse source snippets.
 */
export type SerializableAstNode = {
	readonly type: ESTree.Node['type'] | string;
	readonly start?: number;
	readonly end?: number;
	readonly [key: string]: JsonValue | undefined;
};

/** A graph read recovered structurally from an AST rather than a source string. */
export interface GraphReadRef {
	readonly graphNodeId: string;
	readonly path: ReadonlyArray<string>;
	readonly via: 'direct' | 'alias' | 'local' | 'repeat-item';
}

/** A real expression/function AST together with the graph nodes it observes. */
export interface ExpressionSite {
	readonly expression: SerializableAstNode;
	readonly reads: ReadonlyArray<GraphReadRef>;
}

/** Static authoring attribute. `true` represents a valueless boolean attribute. */
export interface StaticAttribute {
	readonly name: string;
	readonly value: string | true;
}

/** Dynamic host write semantics, independent of any target framework API. */
export interface DynamicBinding extends ExpressionSite {
	readonly kind: 'attribute' | 'property';
	readonly name: string;
}

/** A source-order static text node. */
export interface TemplateText {
	readonly kind: 'text';
	readonly id: string;
	readonly value: string;
}

/** A source-order dynamic text node. */
export interface TemplateDynamicText extends ExpressionSite {
	readonly kind: 'dynamic-text';
	readonly id: string;
}

/** A host element cross-linked to Markless's semantic host id. */
export interface TemplateHost {
	readonly kind: 'host';
	readonly id: string;
	readonly tag: string;
	readonly staticAttributes: ReadonlyArray<StaticAttribute>;
	readonly dynamicBindings: ReadonlyArray<DynamicBinding>;
	readonly eventIds: ReadonlyArray<string>;
	readonly children: ReadonlyArray<TemplateNode>;
}

/** One complete arm of a branch, including its nested host/repeat structure. */
export interface TemplateBranchArm {
	readonly kind: 'then' | 'else-if' | 'else';
	readonly test?: ExpressionSite;
	readonly children: ReadonlyArray<TemplateNode>;
}

/** A branch site cross-linked to its SemanticGraphArtifact record. */
export interface TemplateBranch extends ExpressionSite {
	readonly kind: 'branch';
	readonly id: string;
	readonly arms: ReadonlyArray<TemplateBranchArm>;
}

/** A keyed repeat with the complete row and optional empty subtrees. */
export interface TemplateKeyedRepeat {
	readonly kind: 'keyed-repeat';
	readonly id: string;
	readonly item: string;
	readonly index?: string;
	readonly collection: ExpressionSite;
	readonly key: ExpressionSite;
	readonly row: ReadonlyArray<TemplateNode>;
	readonly empty: ReadonlyArray<TemplateNode>;
}

/** A template fragment preserves grouping without inventing a host DOM node. */
export interface TemplateFragment {
	readonly kind: 'fragment';
	readonly id: string;
	readonly children: ReadonlyArray<TemplateNode>;
}

/** One structured prop expression on a component-reference edge. */
export interface ComponentPropExpression {
	readonly name: string;
	readonly kind: 'graph-reference' | 'callback' | 'serializable' | 'opaque';
	readonly value: ExpressionSite;
	readonly graphNodeId?: string;
	readonly path?: ReadonlyArray<string>;
}

/** A framework-native component invocation joined to a Layer A edge. */
export interface TemplateComponentReference {
	readonly kind: 'component-reference';
	readonly id: string;
	readonly edgeId: string;
	readonly target: { readonly localName: string } & (
		| { readonly module: 'self' }
		| { readonly module: string; readonly exportedName: string }
	);
	readonly props: ReadonlyArray<ComponentPropExpression>;
	readonly children: ReadonlyArray<TemplateNode>;
}

/** The receiving component's opaque default-children projection site. */
export interface TemplateDefaultSlotProjection {
	readonly kind: 'default-slot-projection';
	readonly id: string;
	readonly site: ExpressionSite;
}

/** Type-only bridge removed when the separate framework /2 validator units land. */
interface VersionOneEmitterCompatibility {
	readonly item: string;
	readonly index?: string;
	readonly collection: ExpressionSite;
	readonly key: ExpressionSite;
	readonly row: ReadonlyArray<TemplateNode>;
	readonly empty: ReadonlyArray<TemplateNode>;
	readonly tag: string;
	readonly staticAttributes: ReadonlyArray<StaticAttribute>;
	readonly dynamicBindings: ReadonlyArray<DynamicBinding>;
	readonly eventIds: ReadonlyArray<string>;
	readonly children: ReadonlyArray<TemplateNode>;
}

/** Complete target-neutral template vocabulary covered by this artifact version. */
export type TemplateNode =
	| TemplateHost
	| TemplateText
	| TemplateDynamicText
	| TemplateBranch
	| TemplateKeyedRepeat
	| TemplateFragment
	| (TemplateComponentReference & VersionOneEmitterCompatibility)
	| (TemplateDefaultSlotProjection & VersionOneEmitterCompatibility);

/** A destructured prop path and its source-local spelling. */
export interface PropDestructuringEntry {
	readonly sourceName: string;
	readonly localName: string;
	readonly path: ReadonlyArray<string>;
	readonly alias: boolean;
	readonly graphNodeId: string;
	readonly defaultValue?: SerializableAstNode;
}

/** Ordered component-local declaration, including the authored binding pattern. */
export interface LocalDeclaration {
	readonly order: number;
	readonly declarationKind: 'const' | 'let' | 'var';
	readonly names: ReadonlyArray<string>;
	readonly pattern: SerializableAstNode;
	readonly initializer: SerializableAstNode | null;
	readonly reads: ReadonlyArray<GraphReadRef>;
	readonly semanticRecordIds: ReadonlyArray<string>;
}

/** Component-body lifetime rules that every target emitter must preserve. */
export interface ComponentEvaluationPolicy {
	readonly ordinaryLocals: 'once-per-instance';
	readonly computedBindings: 'reactive';
}

/** The return value selected by an early component guard. */
export type GuardResult =
	| { readonly kind: 'null' }
	| { readonly kind: 'template'; readonly children: ReadonlyArray<TemplateNode> }
	| { readonly kind: 'expression'; readonly value: ExpressionSite };

/** An early `if (...) return ...` described without target control-flow syntax. */
export interface GuardReturn {
	readonly id: string;
	readonly test: ExpressionSite;
	readonly whenTrue: GuardResult;
}

/** Everything an emitter needs from one component body and render tree. */
export interface EnrichedComponent {
	readonly id: string;
	readonly name: string;
	readonly evaluation: ComponentEvaluationPolicy;
	readonly props: {
		readonly graphNodeId: string;
		readonly entries: ReadonlyArray<PropDestructuringEntry>;
	};
	readonly locals: ReadonlyArray<LocalDeclaration>;
	readonly guards: ReadonlyArray<GuardReturn>;
	readonly template: ReadonlyArray<TemplateNode>;
}

/** Path-level state read copied from Markless's lowering artifact. */
export interface StateReadRecord {
	readonly componentId: string;
	readonly graphNodeId: string;
	readonly path: ReadonlyArray<string>;
}

/** Path-level state write with AST values/arguments, never reparsable snippets. */
export interface StateWriteRecord {
	readonly componentId: string;
	readonly graphNodeId: string;
	readonly path: ReadonlyArray<string>;
	readonly operation: 'assign' | 'update' | 'call' | 'delete';
	readonly assignmentOperator?: string;
	readonly updateOperator?: '++' | '--';
	readonly prefix?: boolean;
	readonly method?: string;
	readonly value?: SerializableAstNode;
	readonly arguments?: ReadonlyArray<SerializableAstNode>;
	readonly sourceSpan?: SourceSpan;
	/** Present when a handler-local alias mutation is projected back to state. */
	readonly via?: 'direct' | 'handler-local-alias';
}

/** State, computed, element, and props records retained under compiler ids. */
export interface EnrichedGraphBinding {
	readonly componentId: string;
	readonly id: string;
	readonly name: string;
	readonly kind: GraphBindingKind;
	readonly declarationKind?: DeclarationKind;
	readonly writable: boolean;
	readonly valueKind?: GraphValueKind;
	readonly async?: boolean;
	readonly asyncCapable?: boolean;
	readonly initialValue?: JsonValue;
	readonly initializer?: SerializableAstNode;
	readonly computed?: ExpressionSite;
	readonly reads: ReadonlyArray<StateReadRecord>;
	readonly writes: ReadonlyArray<StateWriteRecord>;
}

/** Alias record with a deterministic Frameless id and resolved graph/path target. */
export interface EnrichedAliasRecord {
	readonly componentId: string;
	readonly id: string;
	readonly name: string;
	readonly target: string;
	readonly graphNodeId: string;
	readonly path: ReadonlyArray<string>;
	readonly declarationKind?: DeclarationKind;
	readonly sourceSpan?: SourceSpan;
}

/** One event handler function and its graph/path effects. */
export interface EventHandlerRecord extends ExpressionSite {
	readonly writes: ReadonlyArray<StateWriteRecord>;
}

/** Event semantics retained under the Markless event id and host id. */
export interface EnrichedEventRecord {
	readonly componentId: string;
	readonly id: string;
	readonly hostNodeId: string;
	readonly eventName: string;
	readonly syncPolicy?: SyncPolicy;
	readonly handlers: ReadonlyArray<EventHandlerRecord>;
}

export type SharedDefinitionCell =
	| {
			readonly kind: 'state';
			readonly name: string;
			readonly graphNodeId: string;
			readonly valueKind: GraphValueKind;
			readonly initializer: SerializableAstNode;
	  }
	| {
			readonly kind: 'computed';
			readonly name: string;
			readonly graphNodeId: string;
			readonly expression: SerializableAstNode;
			readonly dependencies: ReadonlyArray<string>;
	  };

export interface SharedDefinitionMethod {
	readonly name: string;
	readonly site: SerializableAstNode;
	readonly writes: ReadonlyArray<SharedWrite>;
}

export type SharedReturnProperty =
	| {
			readonly kind: 'graph';
			readonly name: string;
			readonly graphNodeId: string;
			readonly path: ReadonlyArray<string>;
	  }
	| { readonly kind: 'method'; readonly name: string };

export interface SharedDependency {
	readonly definitionId: string;
	readonly definitionName: string;
}

/**
 * A module-owned shared factory and every semantic member it defines.
 * `name`, cell initializers, and method-owned writes were added before the first /2 consumer
 * shipped, so these additive contract corrections deliberately keep the
 * `frameless-enriched-ir/2` version tag.
 */
export interface SharedDefinition {
	readonly id: string;
	/** The authored identifier bound to the shared factory declarator. */
	readonly name: string;
	readonly scope: 'request' | 'container' | 'page';
	readonly cells: ReadonlyArray<SharedDefinitionCell>;
	readonly methods: ReadonlyArray<SharedDefinitionMethod>;
	readonly graphBindings: ReadonlyArray<string>;
	readonly returnProperties: ReadonlyArray<SharedReturnProperty>;
	readonly dependencies: ReadonlyArray<SharedDependency>;
}

export interface SharedInstance {
	readonly definitionId: string;
	readonly componentId: string;
	readonly localName: string;
}

export interface SharedRead {
	readonly definitionId: string;
	readonly propertyName: string;
	readonly path: ReadonlyArray<string>;
	readonly componentId: string;
	readonly site: ExpressionSite;
}

export interface SharedCall {
	readonly definitionId: string;
	readonly methodName: string;
	readonly arguments: ReadonlyArray<SerializableAstNode>;
	readonly componentId: string;
	readonly eventId?: string;
	readonly site: ExpressionSite;
	readonly order: number;
}

/** A definition-owned mutation inside a shared factory method. */
export interface SharedWrite {
	readonly definitionId: string;
	readonly graphNodeId: string;
	readonly path: ReadonlyArray<string>;
	readonly operation: 'assign' | 'update' | 'call' | 'delete';
	readonly assignmentOperator?: string;
	readonly updateOperator?: '++' | '--';
	readonly prefix?: boolean;
	readonly method?: string;
	readonly value?: SerializableAstNode;
	readonly arguments?: ReadonlyArray<SerializableAstNode>;
	readonly sourceSpan: SourceSpan;
	readonly order: number;
}

export interface ElementHandleBinding {
	readonly id: string;
	readonly handleName: string;
	readonly componentId: string;
	readonly hostNodeId: string;
}

export interface HandleForwardRecord {
	readonly handleBindingId: string;
	readonly edgeId: string;
	readonly childComponentId: string;
	readonly childHostNodeId: string;
}

export interface BehaviorInput extends GraphReadRef {
	readonly provenance: 'layer-a' | 'derived-from-ast';
}

export interface BehaviorRecord {
	readonly id: string;
	readonly hostNodeId: string;
	readonly componentId: string;
	readonly behavior: SerializableAstNode;
	readonly inputs: ReadonlyArray<BehaviorInput>;
	readonly returnsCleanup: boolean;
	readonly order: number;
}

export interface HandleCallRecord {
	readonly handleBindingId: string;
	readonly componentId: string;
	readonly method: string;
	readonly arguments: ReadonlyArray<SerializableAstNode>;
	readonly optional: boolean;
	readonly eventId?: string;
	readonly site: ExpressionSite;
	readonly order: number;
}

/** All id-addressable semantic records available to a framework emitter. */
export interface EnrichedRecordTable {
	readonly bindings: ReadonlyArray<EnrichedGraphBinding>;
	readonly aliases: ReadonlyArray<EnrichedAliasRecord>;
	readonly events: ReadonlyArray<EnrichedEventRecord>;
	readonly stateReads: ReadonlyArray<StateReadRecord>;
	readonly stateWrites: ReadonlyArray<StateWriteRecord>;
	readonly sharedDefinitions: ReadonlyArray<SharedDefinition>;
	readonly sharedInstances: ReadonlyArray<SharedInstance>;
	readonly sharedReads: ReadonlyArray<SharedRead>;
	readonly sharedCalls: ReadonlyArray<SharedCall>;
	readonly sharedWrites: ReadonlyArray<SharedWrite>;
	readonly elementHandleBindings: ReadonlyArray<ElementHandleBinding>;
	readonly handleForwards: ReadonlyArray<HandleForwardRecord>;
	readonly behaviors: ReadonlyArray<BehaviorRecord>;
	readonly handleCalls: ReadonlyArray<HandleCallRecord>;
	readonly persistence: ReadonlyArray<FramelessPersistenceRecord>;
}

/** One authored component export in the module's public shape. */
export interface ComponentExport {
	readonly kind: 'default' | 'named';
	readonly componentName: string;
	readonly exportedName: string;
}

/**
 * Serializable output of the TSRX-AST + Markless semantic-record join.
 *
 * This contract intentionally has no payload arena, symbol module, locator,
 * resume, hydration, or public-render-plan field. Those belong to individual
 * targets; this artifact is the common input to all emitters.
 */
export interface EnrichedIR {
	readonly version: typeof ENRICHED_IR_VERSION;
	readonly filename: string;
	/** Authored module imports retained as module semantics, not source text. */
	readonly imports: ReadonlyArray<ModuleImport>;
	readonly module: { readonly exports: ReadonlyArray<ComponentExport> };
	readonly components: ReadonlyArray<EnrichedComponent>;
	readonly records: EnrichedRecordTable;
}
