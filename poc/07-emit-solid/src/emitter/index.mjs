import generateModule from '@babel/generator';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { fromEstree } from './estree-to-babel.mjs';

const generate = generateModule.default ?? generateModule;
const traverse = traverseModule.default ?? traverseModule;
const VERSION = 'arcade-enriched-ir/1';
const TOP_KEYS = ['components', 'filename', 'imports', 'module', 'records', 'version'];
const COMPONENT_KEYS = ['evaluation', 'guards', 'locals', 'name', 'props', 'template'];
const RECORD_KEYS = ['aliases', 'bindings', 'events', 'stateReads', 'stateWrites'];
const LEGACY_STRING_FIELDS = new Set(['functionSource', 'handlerSources', 'valueSource']);
const NON_AST_TYPES = new Set(['constant-truthy']);
const ALLOWED_IR_FIELDS = new Set(`actions alias aliases alternate argument arguments arms assignmentOperator async asyncCapable bindings body callee children collection componentName components computed computedBindings consequent cooked declarationKind declarations dynamicBindings elements empty end entries evaluation eventIds eventName events exportedName exports expression expressions filename generator graphNodeId guards handlers hostNodeId id imports index init initialValue initializer item key kind left localName locals method module name names object operation operator optional order ordinaryLocals params path pattern prefix properties property props quasis raw reads records right row semanticRecordIds shorthand sourceName sourceSpan start stateReads stateWrites staticAttributes syncPolicy tag tail target template test type updateOperator value valueKind version via when whenTrue writable writes`.split(' '));

function keys(value) { return Object.keys(value).sort(); }
function exactKeys(value, allowed, location) {
  const unsupported = keys(value).filter((key) => !allowed.includes(key));
  if (unsupported.length) throw new Error(`Unsupported ${location} field(s): ${unsupported.join(', ')}`);
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((entry) => walk(entry, visit));
    else walk(child, visit);
  }
}

function assertArray(value, location) {
  if (!Array.isArray(value)) throw new Error(`Unsupported ${location}: expected an array`);
}

function assertString(value, location) {
  if (typeof value !== 'string') throw new Error(`Unsupported ${location}: expected a string`);
}

function validatePath(value, location) {
  assertArray(value, `${location} path`);
  if (value.some((part) => typeof part !== 'string')) throw new Error(`Unsupported ${location} path construct`);
}

function validateRead(read, location, withVia = true) {
  exactKeys(read, withVia ? ['graphNodeId', 'path', 'via'] : ['graphNodeId', 'path'], `${location} read`);
  assertString(read.graphNodeId, `${location} read graphNodeId`);
  validatePath(read.path, `${location} read`);
  if (withVia && !['direct', 'alias', 'local', 'repeat-item'].includes(read.via)) throw new Error(`Unsupported ${location} read construct: ${String(read.via)}`);
}

function validateReads(reads, location, withVia = true) {
  assertArray(reads, `${location} reads`);
  reads.forEach((read, index) => validateRead(read, `${location}.reads[${index}]`, withVia));
}

function validateExpressionSite(site, location) {
  exactKeys(site, ['expression', 'reads'], `${location} expression-site`);
  if (!site.expression) throw new Error(`Unsupported ${location} expression construct: missing AST`);
  fromEstree(site.expression);
  validateReads(site.reads, location);
}

function validateSourceSpan(span, location) {
  exactKeys(span, ['end', 'filename', 'start'], `${location} sourceSpan`);
  assertString(span.filename, `${location} sourceSpan filename`);
  if (!Number.isInteger(span.start) || !Number.isInteger(span.end)) throw new Error(`Unsupported ${location} sourceSpan construct`);
}

function validateWrite(write, location) {
  const common = ['graphNodeId', 'operation', 'path', 'sourceSpan', 'via'];
  const operationFields = write.operation === 'assign' ? ['assignmentOperator', 'value'] : write.operation === 'update' ? ['prefix', 'updateOperator'] : [];
  exactKeys(write, [...common, ...operationFields], `${location} state-write`);
  assertString(write.graphNodeId, `${location} state-write graphNodeId`);
  validatePath(write.path, `${location} state-write`);
  if (write.sourceSpan) validateSourceSpan(write.sourceSpan, location);
  if (write.operation === 'assign') fromEstree(write.value);
  const path = write.path ?? [];
  if (write.operation === 'assign' && write.via === 'direct' && path.length === 0 && write.assignmentOperator === '=') return;
  if (write.operation === 'update' && write.via === 'direct' && path.length === 0 && ['++', '--'].includes(write.updateOperator)) return;
  if (write.operation === 'assign' && write.via === 'handler-local-alias' && path.length >= 2 && path[0] === '*' && write.assignmentOperator === '=') return;
  throw new Error(`Unsupported state write construct at ${location}: ${write.operation}/${write.via}/${path.join('.')}`);
}

function itemMemberPath(expression, item) {
  const path = [];
  let current = expression;
  while (current?.type === 'MemberExpression' && !current.computed && current.property?.type === 'Identifier') {
    path.unshift(current.property.name);
    current = current.object;
  }
  return current?.type === 'Identifier' && current.name === item && path.length ? path : null;
}

function validateTemplateNode(node, events, location) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error(`Unsupported template construct at ${location}: expected a template node`);
  if (node.kind === 'text') {
    exactKeys(node, ['id', 'kind', 'value'], `${location} text`);
    if (typeof node.value !== 'string') throw new Error(`Unsupported text construct at ${location}: value must be a string`);
    return;
  }
  if (node.kind === 'dynamic-text') {
    exactKeys(node, ['expression', 'id', 'kind', 'reads'], `${location} dynamic-text`);
    if (!node.expression) throw new Error(`Unsupported dynamic-text construct at ${location}: missing expression AST`);
    fromEstree(node.expression);
    validateReads(node.reads, location);
    return;
  }
  if (node.kind === 'fragment') {
    exactKeys(node, ['children', 'id', 'kind'], `${location} fragment`);
    assertArray(node.children, `${location} fragment children`);
    node.children.forEach((child, index) => validateTemplateNode(child, events, `${location}.children[${index}]`));
    return;
  }
  if (node.kind === 'branch') {
    exactKeys(node, ['arms', 'expression', 'id', 'kind', 'reads'], `${location} branch`);
    if (!node.expression || !Array.isArray(node.arms) || node.arms.length !== 2 || node.arms[0]?.kind !== 'then' || node.arms[1]?.kind !== 'else') {
      throw new Error(`Unsupported branch construct at ${location}: expected ordered then/else arms`);
    }
    fromEstree(node.expression);
    validateReads(node.reads, location);
    node.arms.forEach((arm, armIndex) => {
      exactKeys(arm, ['children', 'kind'], `${location} branch arm`);
      assertArray(arm.children, `${location} branch arm children`);
      arm.children.forEach((child, index) => validateTemplateNode(child, events, `${location}.arms[${armIndex}].children[${index}]`));
    });
    return;
  }
  if (node.kind === 'keyed-repeat') {
    exactKeys(node, ['collection', 'empty', 'id', 'index', 'item', 'key', 'kind', 'row'], `${location} keyed-repeat`);
    if (node.index != null) throw new Error(`Unsupported keyed-repeat index binding at ${location}`);
    if (!node.collection?.expression || !node.key?.expression || typeof node.item !== 'string') {
      throw new Error(`Unsupported keyed-repeat construct at ${location}: collection, item, and key expression are required`);
    }
    if (!Array.isArray(node.empty) || node.empty.length !== 0) throw new Error(`Unsupported keyed-repeat empty arm at ${location}; lower it as a branch site`);
    assertArray(node.row, `${location} keyed-repeat row`);
    validateExpressionSite(node.collection, `${location}.collection`);
    validateExpressionSite(node.key, `${location}.key`);
    node.row.forEach((child, index) => validateTemplateNode(child, events, `${location}.row[${index}]`));
    const keyPath = itemMemberPath(node.key.expression, node.item);
    const keyRead = node.key.reads?.find((read) => read.via === 'repeat-item');
    if (!keyPath || !keyRead || keyRead.path.join('/') !== keyPath.join('/')) {
      throw new Error(`Unsupported keyed-repeat key at ${location}: expected a recorded member path rooted at ${node.item}`);
    }
    for (const event of events.values()) {
      for (const handler of event.handlers) {
        const mutatesKey = handler.writes.some((write) => write.graphNodeId === keyRead.graphNodeId
          && write.via === 'handler-local-alias'
          && write.path.slice(1).join('/') === keyPath.join('/'));
        if (mutatesKey) throw new Error(`Unsupported keyed-repeat identity mutation at ${location}: ${node.item}.${keyPath.join('.')}`);
      }
    }
    return;
  }
  if (node.kind !== 'host') throw new Error(`Unsupported template construct at ${location}: ${String(node.kind)}`);
  exactKeys(node, ['children', 'dynamicBindings', 'eventIds', 'id', 'kind', 'staticAttributes', 'tag'], `${location} host`);
  if (typeof node.tag !== 'string') throw new Error(`Unsupported host construct at ${location}: tag must be a string`);
  assertArray(node.staticAttributes, `${location} staticAttributes`);
  assertArray(node.dynamicBindings, `${location} dynamicBindings`);
  assertArray(node.eventIds, `${location} eventIds`);
  assertArray(node.children, `${location} children`);
  for (const attribute of node.staticAttributes) {
    exactKeys(attribute, ['name', 'value'], `${location} static attribute`);
    if (typeof attribute.name !== 'string' || !['string', 'boolean'].includes(typeof attribute.value)) {
      throw new Error(`Unsupported static attribute construct at ${location}`);
    }
  }
  for (const binding of node.dynamicBindings) {
    exactKeys(binding, ['expression', 'kind', 'name', 'reads'], `${location} dynamic binding`);
    if (!['attribute', 'property'].includes(binding.kind) || typeof binding.name !== 'string' || !binding.expression) {
      throw new Error(`Unsupported dynamic binding construct at ${location}: ${String(binding.kind)}`);
    }
    fromEstree(binding.expression);
    validateReads(binding.reads, `${location} dynamic binding`);
  }
  for (const eventId of node.eventIds) {
    const event = events.get(eventId);
    if (!event) throw new Error(`Unsupported event reference at ${location}: ${eventId}`);
    if (event.hostNodeId !== node.id) throw new Error(`Event ${eventId} targets ${event.hostNodeId}, not host ${node.id}`);
  }
  node.children.forEach((child, index) => validateTemplateNode(child, events, `${location}.children[${index}]`));
}

function syncActions(event) {
  if (!event.syncPolicy) return [];
  if (event.syncPolicy.branches) throw new Error(`Unsupported sync-policy branches in ${event.id}`);
  if (event.syncPolicy.when?.type !== 'constant-truthy' || event.syncPolicy.when.value !== true) {
    throw new Error(`Unsupported sync-policy condition in ${event.id}: ${String(event.syncPolicy.when?.type)}`);
  }
  const actions = event.syncPolicy.actions ?? [];
  for (const action of actions) if (action !== 'preventDefault') throw new Error(`Unsupported sync-policy action in ${event.id}: ${action}`);
  if (new Set(actions).size !== actions.length) throw new Error(`Unsupported duplicate sync-policy action in ${event.id}`);
  return actions;
}

export function validateEnrichedIR(ir) {
  exactKeys(ir, TOP_KEYS, 'IR');
  if (ir.version !== VERSION) throw new Error(`Expected ${VERSION}, received ${String(ir.version)}`);
  assertString(ir.filename, 'IR filename');
  if (!Array.isArray(ir.components) || ir.components.length !== 1) throw new Error('Fixture emitter requires exactly one component');
  const component = ir.components[0];
  exactKeys(component, COMPONENT_KEYS, 'component');
  exactKeys(ir.records, RECORD_KEYS, 'records');
  if (typeof component.name !== 'string' || !t.isValidIdentifier(component.name)) throw new Error(`Unsupported component name: ${String(component.name)}`);
  exactKeys(component.evaluation, ['computedBindings', 'ordinaryLocals'], `${component.name} evaluation`);
  if (component.evaluation.ordinaryLocals !== 'once-per-instance' || component.evaluation.computedBindings !== 'reactive') {
    throw new Error(`Unsupported evaluation policy for ${component.name}`);
  }
  assertArray(ir.imports, 'imports');
  if (ir.imports.length) throw new Error('Fixture-family Solid emitter has no disclosed author import mapping');
  exactKeys(ir.module, ['exports'], 'module');
  assertArray(ir.module.exports, 'module exports');
  ir.module.exports.forEach((entry, index) => exactKeys(entry, ['componentName', 'exportedName', 'kind'], `module export[${index}]`));
  const exported = ir.module.exports.find((entry) => entry.componentName === component.name);
  if (!exported || exported.kind !== 'named' || exported.exportedName !== component.name) throw new Error(`A same-name named export is required for ${component.name}`);
  if (ir.module.exports.length !== 1) throw new Error(`Unsupported module export construct: expected only ${component.name}`);
  exactKeys(component.props, ['entries', 'graphNodeId'], `${component.name} props`);
  assertString(component.props.graphNodeId, `${component.name} props graphNodeId`);
  assertArray(component.props.entries, `${component.name} props entries`);
  for (const prop of component.props.entries) {
    exactKeys(prop, ['alias', 'graphNodeId', 'localName', 'path', 'sourceName'], `prop ${String(prop.localName)}`);
    if (prop.alias !== (prop.localName !== prop.sourceName)) throw new Error(`Unsupported prop alias construct: ${String(prop.localName)}`);
    validatePath(prop.path, `prop ${prop.localName}`);
    const alias = ir.records.aliases.find((entry) => entry.name === prop.localName);
    if (!alias || alias.graphNodeId !== prop.graphNodeId || alias.path.join('/') !== prop.path.join('/')) throw new Error(`Unresolved prop alias: ${prop.localName}`);
  }
  assertArray(component.locals, `${component.name} locals`);
  for (const local of component.locals) {
    exactKeys(local, ['declarationKind', 'initializer', 'names', 'order', 'pattern', 'reads', 'semanticRecordIds'], `local ${local.names?.join(',') ?? '<unknown>'}`);
    validateReads(local.reads, `local ${local.names?.join(',') ?? '<unknown>'}`);
    assertArray(local.semanticRecordIds, `local ${local.names?.join(',') ?? '<unknown>'} semanticRecordIds`);
    if (local.initializer) fromEstree(local.initializer);
    fromEstree(local.pattern);
    if (!['const', 'let'].includes(local.declarationKind)
      || local.names.length !== 1
      || local.pattern?.type !== 'Identifier'
      || local.pattern.name !== local.names[0]
      || !Number.isInteger(local.order)) {
      throw new Error(`Unsupported local declaration construct: ${local.names?.join(',') ?? '<unknown>'}`);
    }
  }
  for (const collection of ['aliases', 'bindings', 'events', 'stateReads', 'stateWrites']) assertArray(ir.records[collection], `records.${collection}`);
  for (const [index, alias] of ir.records.aliases.entries()) {
    exactKeys(alias, ['declarationKind', 'graphNodeId', 'id', 'name', 'path', 'sourceSpan', 'target'], `alias record[${index}]`);
    if (!['const', 'let', 'var'].includes(alias.declarationKind)) throw new Error(`Unsupported alias declaration construct: ${String(alias.declarationKind)}`);
    for (const field of ['graphNodeId', 'id', 'name', 'target']) assertString(alias[field], `alias record[${index}] ${field}`);
    validatePath(alias.path, `alias record[${index}]`);
    if (alias.sourceSpan) validateSourceSpan(alias.sourceSpan, `alias record[${index}]`);
  }
  ir.records.stateReads.forEach((read, index) => validateRead(read, `records.stateReads[${index}]`, false));
  ir.records.stateWrites.forEach((write, index) => validateWrite(write, `records.stateWrites[${index}]`));
  walk(ir, (node) => {
    for (const field of LEGACY_STRING_FIELDS) if (field in node) throw new Error(`Legacy source-string field is forbidden: ${field}`);
    const unsupported = Object.keys(node).filter((field) => !ALLOWED_IR_FIELDS.has(field));
    if (unsupported.length) throw new Error(`Unsupported IR field(s): ${unsupported.join(', ')}`);
    if (Array.isArray(node.path) && node.path.some((part) => /[()=>]/.test(part))) throw new Error(`Degraded path is forbidden: ${node.path.join(' / ')}`);
    if (typeof node.type === 'string' && !NON_AST_TYPES.has(node.type)) fromEstree(node);
  });

  const supportedBindings = new Set(['prop', 'state', 'computed']);
  for (const binding of ir.records.bindings) {
    if (!supportedBindings.has(binding.kind)) throw new Error(`Unsupported binding construct: ${binding.kind}`);
    const bindingFields = binding.kind === 'computed'
      ? ['async', 'asyncCapable', 'computed', 'declarationKind', 'id', 'kind', 'name', 'reads', 'writable', 'writes']
      : binding.kind === 'state'
        ? ['async', 'asyncCapable', 'declarationKind', 'id', 'initialValue', 'initializer', 'kind', 'name', 'reads', 'valueKind', 'writable', 'writes']
        : ['declarationKind', 'id', 'kind', 'name', 'reads', 'valueKind', 'writable', 'writes'];
    exactKeys(binding, bindingFields, `${binding.kind} binding ${String(binding.id)}`);
    if (binding.async === true || binding.asyncCapable === true) throw new Error(`Unsupported async state construct in ${binding.kind} binding ${binding.id}`);
    if (binding.async != null && binding.async !== false) throw new Error(`Unsupported async state marker in ${binding.kind} binding ${binding.id}`);
    if (binding.asyncCapable != null && binding.asyncCapable !== false) throw new Error(`Unsupported async-capable state marker in ${binding.kind} binding ${binding.id}`);
    if (!['const', 'let'].includes(binding.declarationKind) || typeof binding.writable !== 'boolean') throw new Error(`Unsupported ${binding.kind} binding metadata: ${binding.id}`);
    validateReads(binding.reads, `${binding.kind} binding ${binding.id}`, false);
    assertArray(binding.writes, `${binding.kind} binding ${binding.id} writes`);
    binding.writes.forEach((write, index) => validateWrite(write, `${binding.id}.writes[${index}]`));
    if (binding.kind === 'state') {
      if (!binding.initializer) throw new Error(`State ${binding.id} is missing an initializer AST`);
      if (!['scalar', 'object', 'array', 'unknown'].includes(binding.valueKind)) throw new Error(`Unsupported state valueKind for ${binding.id}: ${String(binding.valueKind)}`);
      fromEstree(binding.initializer);
    }
    if (binding.kind === 'computed') {
      validateExpressionSite(binding.computed, `computed binding ${binding.id}`);
      const expression = fromEstree(binding.computed?.expression);
      if (!t.isArrowFunctionExpression(expression) || expression.async || expression.params.length !== 0) throw new Error(`Unsupported computed construct ${binding.id}: expected a synchronous zero-argument arrow`);
    }
  }
  const bindingIds = new Set(ir.records.bindings.map((binding) => binding.id));
  for (const local of component.locals) for (const id of local.semanticRecordIds) {
    if (!bindingIds.has(id)) throw new Error(`Unsupported dangling semanticRecordId in local ${local.names.join(',')}: ${id}`);
  }
  const events = new Map(ir.records.events.map((event) => [event.id, event]));
  if (events.size !== ir.records.events.length) throw new Error('Unsupported duplicate event id');
  for (const event of ir.records.events) {
    exactKeys(event, ['eventName', 'handlers', 'hostNodeId', 'id', 'syncPolicy'], `event ${String(event.id)}`);
    for (const field of ['eventName', 'hostNodeId', 'id']) assertString(event[field], `event ${String(event.id)} ${field}`);
    assertArray(event.handlers, `event ${event.id} handlers`);
    if (!event.handlers.length) throw new Error(`Event ${event.id} has no handlers`);
    if (event.syncPolicy) {
      exactKeys(event.syncPolicy, ['actions', 'when'], `event ${event.id} sync-policy`);
      exactKeys(event.syncPolicy.when, ['type', 'value'], `event ${event.id} sync-policy condition`);
    }
    syncActions(event);
    event.handlers.forEach((handler, handlerIndex) => {
      exactKeys(handler, ['expression', 'reads', 'writes'], `${event.id}.handlers[${handlerIndex}]`);
      validateReads(handler.reads, `${event.id}.handlers[${handlerIndex}]`);
      assertArray(handler.writes, `${event.id}.handlers[${handlerIndex}] writes`);
      const expression = fromEstree(handler.expression);
      if (!t.isArrowFunctionExpression(expression) || expression.async) throw new Error(`Unsupported event handler construct at ${event.id}.handlers[${handlerIndex}]: expected a synchronous arrow`);
      handler.writes.forEach((write, writeIndex) => validateWrite(write, `${event.id}.handlers[${handlerIndex}].writes[${writeIndex}]`));
    });
  }
  assertArray(component.guards, `${component.name} guards`);
  component.guards.forEach((guard, index) => {
    const location = `guard[${index}]`;
    exactKeys(guard, ['id', 'test', 'whenTrue'], location);
    validateExpressionSite(guard.test, `${location}.test`);
    if (!guard.whenTrue || typeof guard.whenTrue !== 'object') throw new Error(`Unsupported guard result construct at ${location}: missing result`);
    if (guard.whenTrue.kind === 'null') exactKeys(guard.whenTrue, ['kind'], `${location} null result`);
    else if (guard.whenTrue.kind === 'expression') {
      exactKeys(guard.whenTrue, ['kind', 'value'], `${location} expression result`);
      validateExpressionSite(guard.whenTrue.value, `${location}.whenTrue.value`);
    } else if (guard.whenTrue.kind === 'template') {
      exactKeys(guard.whenTrue, ['children', 'kind'], `${location} template result`);
      assertArray(guard.whenTrue.children, `${location} template result children`);
      guard.whenTrue.children.forEach((node, nodeIndex) => validateTemplateNode(node, events, `${location}.whenTrue.children[${nodeIndex}]`));
    } else throw new Error(`Unsupported guard result construct at ${location}: ${String(guard.whenTrue.kind)}`);
  });
  assertArray(component.template, `${component.name} template`);
  component.template.forEach((node, index) => validateTemplateNode(node, events, `template[${index}]`));
  return component;
}

const setterName = (name) => `set${name[0].toUpperCase()}${name.slice(1)}`;
const member = (object, property) => t.memberExpression(object, t.identifier(property));

function pathMember(root, path) {
  return path.reduce((object, property) => member(object, property), root);
}

function referencedGraphIds(component, records) {
  const ids = new Set();
  walk({ guards: component.guards, template: component.template }, (node) => {
    if (typeof node.graphNodeId === 'string') ids.add(node.graphNodeId);
  });
  for (const binding of records.bindings) {
    if (binding.kind === 'computed') for (const read of binding.computed?.reads ?? []) ids.add(read.graphNodeId);
  }
  return ids;
}

function identifierIsUsed(ir, name) {
  let used = false;
  walk({ guards: ir.components[0].guards, template: ir.components[0].template, events: ir.records.events, bindings: ir.records.bindings }, (node) => {
    if (node.type === 'Identifier' && node.name === name) used = true;
  });
  return used;
}

function rewriteEstree(node, context) {
  const result = fromEstree(node);
  const wrapper = t.file(t.program([t.expressionStatement(result)]));
  traverse(wrapper, {
    AssignmentExpression: {
      exit(path) {
        if (!t.isIdentifier(path.node.left) || path.scope.hasBinding(path.node.left.name)) return;
        const state = context.statesByName.get(path.node.left.name);
        if (!state || state.storage === 'local') return;
        if (path.node.operator !== '=') throw path.buildCodeFrameError(`Unsupported signal assignment operator: ${path.node.operator}`);
        path.replaceWith(t.callExpression(t.identifier(setterName(state.name)), [path.node.right]));
        path.skip();
      },
    },
    UpdateExpression: {
      exit(path) {
        if (!t.isIdentifier(path.node.argument) || path.scope.hasBinding(path.node.argument.name)) return;
        const state = context.statesByName.get(path.node.argument.name);
        if (!state || state.storage === 'local') return;
        if (!path.parentPath.isExpressionStatement()) throw new Error(`Unsupported value-observed signal update: ${state.name}${path.node.operator}`);
        const operator = path.node.operator === '++' ? '+' : '-';
        const next = t.binaryExpression(operator, t.callExpression(t.identifier(state.name), []), t.numericLiteral(1));
        path.replaceWith(t.callExpression(t.identifier(setterName(state.name)), [next]));
        path.skip();
      },
    },
    Identifier(path) {
      const name = path.node.name;
      const isWriteTarget = (path.parentPath.isAssignmentExpression() && path.key === 'left') || (path.parentPath.isUpdateExpression() && path.key === 'argument');
      if (isWriteTarget || !path.isReferencedIdentifier() || path.scope.hasBinding(name)) return;
      const prop = context.propsByLocal.get(name);
      const state = context.statesByName.get(name);
      const computed = context.computedByName.get(name);
      let replacement = null;
      if (prop) replacement = pathMember(t.identifier('props'), prop.path);
      else if (state?.storage === 'signal') replacement = t.callExpression(t.identifier(name), []);
      else if (computed) replacement = t.callExpression(t.identifier(name), []);
      if (!replacement) return;
      path.replaceWith(replacement);
      if (path.parentPath.isObjectProperty() && path.parent.shorthand) path.parent.shorthand = false;
      path.skip();
    },
  });
  return wrapper.program.body[0].expression;
}

function jsxAttribute(name, value) {
  return t.jsxAttribute(t.jsxIdentifier(name), value === true ? null : typeof value === 'string' ? t.stringLiteral(value) : t.jsxExpressionContainer(value));
}

function eventAttributeName(name) { return `on${name[0].toUpperCase()}${name.slice(1)}`; }

function expressionFromNodes(nodes, context) {
  const children = templateChildren(nodes, context);
  if (children.length === 0) return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), []);
  if (children.length === 1 && (t.isJSXElement(children[0]) || t.isJSXFragment(children[0]))) return children[0];
  return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), children);
}

function branchNode(node, context, continuation = []) {
  return t.jsxExpressionContainer(t.conditionalExpression(
    rewriteEstree(node.expression, context),
    expressionFromNodes([...node.arms[0].children, ...continuation], context),
    expressionFromNodes([...node.arms[1].children, ...continuation], context),
  ));
}

function repeatNode(node, context) {
  context.imports.add('For');
  const repeatContext = { ...context, repeat: { collection: node.collection, item: node.item, key: node.key } };
  const row = expressionFromNodes(node.row, repeatContext);
  const callback = t.arrowFunctionExpression([t.identifier(node.item)], row);
  const name = t.jsxIdentifier('For');
  return t.jsxElement(
    t.jsxOpeningElement(name, [jsxAttribute('each', rewriteEstree(node.collection.expression, context))], false),
    t.jsxClosingElement(t.jsxIdentifier('For')),
    [t.jsxExpressionContainer(callback)],
    false,
  );
}

function dynamicExpression(binding, context) {
  const value = rewriteEstree(binding.expression, context);
  if (!context.repeat || binding.kind !== 'property') return value;
  const collectionRead = binding.reads?.find((read) => read.via === 'repeat-item');
  const state = collectionRead && context.statesById.get(collectionRead.graphNodeId);
  if (!state || state.storage !== 'signal') return value;
  return t.logicalExpression('&&', t.callExpression(t.identifier(state.name), []), value);
}

function templateNode(node, context) {
  if (node.kind === 'text') return t.jsxText(node.value);
  if (node.kind === 'dynamic-text') return t.jsxExpressionContainer(rewriteEstree(node.expression, context));
  if (node.kind === 'fragment') return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), templateChildren(node.children, context));
  if (node.kind === 'branch') return branchNode(node, context);
  if (node.kind === 'keyed-repeat') return repeatNode(node, context);

  const attributes = node.staticAttributes.map((attribute) => jsxAttribute(attribute.name, attribute.value));
  for (const binding of node.dynamicBindings) {
    const value = dynamicExpression(binding, context);
    attributes.push(jsxAttribute(binding.name, value));
    if (binding.kind === 'property' && binding.name === 'value') attributes.push(jsxAttribute('attr:value', t.cloneNode(value, true)));
  }
  for (const eventId of node.eventIds) {
    const event = context.events.get(eventId);
    attributes.push(jsxAttribute(eventAttributeName(event.eventName), emitEvent(event, context)));
  }
  const name = t.jsxIdentifier(node.tag);
  const children = templateChildren(node.children, context);
  return t.jsxElement(
    t.jsxOpeningElement(name, attributes, children.length === 0),
    children.length === 0 ? null : t.jsxClosingElement(t.jsxIdentifier(node.tag)),
    children,
    children.length === 0,
  );
}

function templateChildren(nodes, context) {
  const children = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.kind === 'branch') {
      children.push(branchNode(node, context, nodes.slice(index + 1)));
      break;
    }
    children.push(templateNode(node, context));
  }
  return children;
}

function isPreventDefaultStatement(statement, parameterName) {
  return t.isExpressionStatement(statement)
    && t.isCallExpression(statement.expression)
    && statement.expression.arguments.length === 0
    && t.isMemberExpression(statement.expression.callee)
    && !statement.expression.callee.computed
    && t.isIdentifier(statement.expression.callee.object, { name: parameterName })
    && t.isIdentifier(statement.expression.callee.property, { name: 'preventDefault' });
}

function normalizeHandler(event, handler, context, declaredActions) {
  const fn = rewriteEstree(handler.expression, context);
  if (!t.isArrowFunctionExpression(fn)) throw new Error(`Event handler ${event.id} is not an arrow function`);
  if (!t.isBlockStatement(fn.body)) fn.body = t.blockStatement([t.returnStatement(fn.body)]);
  const parameter = fn.params[0];
  if (declaredActions.length && !t.isIdentifier(parameter)) throw new Error(`Sync policy ${event.id} requires an identifier event parameter`);
  const retained = [];
  let authoredPreventDefault = false;
  for (const statement of fn.body.body) {
    if (t.isIdentifier(parameter) && isPreventDefaultStatement(statement, parameter.name)) {
      authoredPreventDefault = true;
      continue;
    }
    retained.push(statement);
  }
  if (authoredPreventDefault && !declaredActions.includes('preventDefault')) {
    throw new Error(`Undeclared preventDefault synchronization in ${event.id}`);
  }
  fn.body.body = retained;
  return fn;
}

function policyStatements(actions, parameterName) {
  return actions.map((action) => {
    if (action === 'preventDefault') return t.expressionStatement(t.callExpression(member(t.identifier(parameterName), 'preventDefault'), []));
    throw new Error(`Unsupported sync-policy action: ${action}`);
  });
}

function emitEvent(event, context) {
  const actions = syncActions(event);
  const handlers = event.handlers.map((handler) => normalizeHandler(event, handler, context, actions));
  if (handlers.length === 1) {
    const fn = handlers[0];
    if (actions.length) fn.body.body.unshift(...policyStatements(actions, fn.params[0].name));
    return fn;
  }
  const eventParameter = t.identifier('event');
  const body = [
    ...policyStatements(actions, eventParameter.name),
    ...handlers.map((handler) => t.expressionStatement(t.callExpression(handler, [t.cloneNode(eventParameter)]))),
  ];
  return t.arrowFunctionExpression([eventParameter], t.blockStatement(body));
}

function componentFunction(ir, component, context) {
  const body = [];
  const bindingById = new Map(ir.records.bindings.map((binding) => [binding.id, binding]));
  for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
    const semantic = local.semanticRecordIds.map((id) => bindingById.get(id)).filter(Boolean);
    const state = semantic.find((binding) => binding.kind === 'state');
    const computed = semantic.find((binding) => binding.kind === 'computed');
    if (semantic.length > 1) throw new Error(`Unsupported multi-semantic local construct: ${local.names.join(',')}`);
    if (state) {
      const mapped = context.statesById.get(state.id);
      const initializer = rewriteEstree(state.initializer, context);
      if (mapped.storage === 'signal') {
        const pattern = t.arrayPattern([t.identifier(state.name), t.identifier(setterName(state.name))]);
        body.push(t.variableDeclaration('const', [t.variableDeclarator(pattern, t.callExpression(t.identifier('createSignal'), [initializer]))]));
      } else {
        body.push(t.variableDeclaration('let', [t.variableDeclarator(t.identifier(state.name), initializer)]));
      }
      continue;
    }
    if (computed) {
      body.push(t.variableDeclaration('const', [t.variableDeclarator(t.identifier(computed.name), rewriteEstree(computed.computed.expression, context))]));
      continue;
    }
    const initializer = rewriteEstree(local.initializer, context);
    if (identifierIsUsed(ir, local.names[0])) {
      body.push(t.variableDeclaration(local.declarationKind, [t.variableDeclarator(fromEstree(local.pattern), initializer)]));
    } else {
      body.push(t.expressionStatement(t.isCallExpression(initializer) ? initializer : t.unaryExpression('void', initializer)));
    }
  }
  for (const guard of component.guards) {
    let result;
    if (guard.whenTrue.kind === 'null') result = t.nullLiteral();
    else if (guard.whenTrue.kind === 'expression') result = rewriteEstree(guard.whenTrue.value.expression, context);
    else if (guard.whenTrue.kind === 'template') result = expressionFromNodes(guard.whenTrue.children, context);
    else throw new Error(`Unsupported guard result construct: ${String(guard.whenTrue.kind)}`);
    body.push(t.ifStatement(rewriteEstree(guard.test.expression, context), t.returnStatement(result)));
  }
  body.push(t.returnStatement(expressionFromNodes(component.template, context)));
  return t.exportNamedDeclaration(t.functionDeclaration(t.identifier(component.name), [t.identifier('props')], t.blockStatement(body)));
}

export function emitSolid(ir) {
  const component = validateEnrichedIR(ir);
  const visible = referencedGraphIds(component, ir.records);
  const statesById = new Map();
  const statesByName = new Map();
  const computedByName = new Map();
  for (const binding of ir.records.bindings) {
    if (binding.kind === 'state') {
      const mapped = { ...binding, storage: visible.has(binding.id) ? 'signal' : 'local' };
      statesById.set(binding.id, mapped);
      statesByName.set(binding.name, mapped);
    } else if (binding.kind === 'computed') {
      computedByName.set(binding.name, binding);
    }
  }
  const context = {
    computedByName,
    events: new Map(ir.records.events.map((event) => [event.id, event])),
    imports: new Set(statesById.values().some((state) => state.storage === 'signal') ? ['createSignal'] : []),
    propsByLocal: new Map(component.props.entries.map((entry) => [entry.localName, entry])),
    statesById,
    statesByName,
  };
  const exported = componentFunction(ir, component, context);
  const importOrder = new Map(['createSignal', 'For'].map((name, index) => [name, index]));
  const importNames = [...context.imports].sort((left, right) => importOrder.get(left) - importOrder.get(right));
  const program = [];
  if (importNames.length) {
    const imports = t.importDeclaration(importNames.map((name) => t.importSpecifier(t.identifier(name), t.identifier(name))), t.stringLiteral('solid-js'));
    imports.leadingComments = [{ type: 'CommentLine', value: ' @generated by arcade-poc-07-emit-solid; do not edit.' }];
    program.push(imports);
  } else {
    exported.leadingComments = [{ type: 'CommentLine', value: ' @generated by arcade-poc-07-emit-solid; do not edit.' }];
  }
  program.push(exported);
  const source = generate(t.program(program, [], 'module'), { comments: true, jsescOption: { minimal: true } }).code;
  return `${source}\n`;
}
