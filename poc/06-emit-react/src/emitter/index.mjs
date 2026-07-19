import generateModule from '@babel/generator';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { fromEstree } from './estree-to-babel.mjs';

const generate = generateModule.default ?? generateModule;
const traverse = traverseModule.default ?? traverseModule;
const VERSION = 'arcade-enriched-ir/1';
const LEGACY_STRING_FIELDS = new Set(['functionSource', 'handlerSources', 'valueSource']);

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((entry) => walk(entry, visit));
    else walk(child, visit);
  }
}

export function validateEnrichedIR(ir) {
  if (ir.version !== VERSION) throw new Error(`Expected ${VERSION}, received ${String(ir.version)}`);
  if (ir.components.length !== 1) throw new Error('Fixture emitter requires exactly one component per golden');
  const component = ir.components[0];
  if (component.evaluation.ordinaryLocals !== 'once-per-instance' || component.evaluation.computedBindings !== 'reactive') {
    throw new Error(`Unsupported evaluation policy for ${component.name}`);
  }
  const exported = ir.module.exports.find((entry) => entry.componentName === component.name);
  if (!exported || exported.kind !== 'named' || exported.exportedName !== component.name) {
    throw new Error(`Fixture emitter requires a same-name named export for ${component.name}`);
  }
  for (const entry of component.props.entries) {
    const alias = ir.records.aliases.find((record) => record.name === entry.localName);
    if (!alias || alias.graphNodeId !== entry.graphNodeId || alias.path.join('/') !== entry.path.join('/')) {
      throw new Error(`Prop alias map does not resolve ${entry.localName}`);
    }
  }
  walk(ir, (node) => {
    for (const field of LEGACY_STRING_FIELDS) if (field in node) throw new Error(`Legacy source-string field is forbidden: ${field}`);
    if (Array.isArray(node.path) && node.path.some((part) => /[()=>]/.test(part))) {
      throw new Error(`Degraded read/write path is forbidden: ${node.path.join(' / ')}`);
    }
  });
  for (const imported of ir.imports) {
    if (imported.source.startsWith('@markless/') || imported.source.startsWith('@tsrx/')) {
      throw new Error(`Target-coupled runtime import is forbidden: ${imported.source}`);
    }
  }
  if (ir.imports.length !== 0) throw new Error('Fixture-family React emitter has no disclosed author-module import mapping');
}

const setterName = (name) => `set${name[0].toUpperCase()}${name.slice(1)}`;
const nextName = (name) => `next${name[0].toUpperCase()}${name.slice(1)}`;
const member = (object, property) => t.memberExpression(object, t.identifier(property));

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

function unwrapComputed(binding) {
  const fn = fromEstree(binding.computed.expression);
  if (!t.isArrowFunctionExpression(fn) || fn.params.length !== 0) throw new Error(`Computed ${binding.id} must be a zero-argument arrow`);
  if (t.isBlockStatement(fn.body)) {
    const returns = fn.body.body.filter(t.isReturnStatement);
    if (returns.length !== 1 || !returns[0].argument) throw new Error(`Computed ${binding.id} needs one returned expression`);
    return returns[0].argument;
  }
  return fn.body;
}

function makeLazyInitializer(initializer) {
  const body = [t.returnStatement(initializer)];
  return t.arrowFunctionExpression([], t.blockStatement(body));
}

function emitOnceGuard(expressions, body, usedHooks) {
  if (expressions.length === 0) return;
  usedHooks.add('useRef');
  const ref = t.identifier('didRunSetup');
  body.push(t.variableDeclaration('const', [
    t.variableDeclarator(ref, t.callExpression(t.identifier('useRef'), [t.booleanLiteral(false)])),
  ]));
  body.push(t.ifStatement(
    t.unaryExpression('!', member(t.cloneNode(ref), 'current')),
    t.blockStatement([
      t.expressionStatement(t.assignmentExpression('=', member(t.cloneNode(ref), 'current'), t.booleanLiteral(true))),
      ...expressions.map((expression) => t.expressionStatement(expression)),
    ]),
  ));
}

function jsxName(name) {
  if (name === 'class') return 'className';
  if (name === 'for') return 'htmlFor';
  return name;
}

function eventProp(name) {
  return `on${name[0].toUpperCase()}${name.slice(1)}`;
}

function expressionFromChildren(children, context) {
  const rendered = children.map((child) => templateNode(child, context));
  if (rendered.length === 0) return t.nullLiteral();
  if (rendered.length === 1) return rendered[0];
  return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), rendered);
}

function branchExpression(node, context) {
  let alternate = t.nullLiteral();
  for (let index = node.arms.length - 1; index >= 0; index -= 1) {
    const arm = node.arms[index];
    const result = expressionFromChildren(arm.children, context);
    if (arm.kind === 'else') alternate = result;
    else alternate = t.conditionalExpression(fromEstree(arm.test?.expression ?? node.expression), result, alternate);
  }
  return alternate;
}

function addKeyToRow(expression, key) {
  if (!t.isJSXElement(expression)) throw new Error('A keyed repeat row must have one host root in this fixture contract');
  expression.openingElement.attributes.unshift(t.jsxAttribute(t.jsxIdentifier('key'), t.jsxExpressionContainer(key)));
  return expression;
}

function templateNode(node, context) {
  if (node.kind === 'text') return t.jsxText(node.value);
  if (node.kind === 'dynamic-text') return t.jsxExpressionContainer(fromEstree(node.expression));
  if (node.kind === 'fragment') return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), node.children.map((child) => templateNode(child, context)));
  if (node.kind === 'branch') return t.jsxExpressionContainer(branchExpression(node, context));
  if (node.kind === 'keyed-repeat') {
    const params = [t.identifier(node.item)];
    if (node.index) params.push(t.identifier(node.index));
    const row = addKeyToRow(expressionFromChildren(node.row, context), fromEstree(node.key.expression));
    const map = t.callExpression(member(fromEstree(node.collection.expression), 'map'), [t.arrowFunctionExpression(params, row)]);
    return t.jsxExpressionContainer(map);
  }
  if (node.kind !== 'host') throw new Error(`Unsupported template node: ${node.kind}`);

  const attributes = [];
  for (const attribute of node.staticAttributes) {
    attributes.push(t.jsxAttribute(t.jsxIdentifier(jsxName(attribute.name)), attribute.value === true ? null : t.stringLiteral(attribute.value)));
  }
  for (const binding of node.dynamicBindings) {
    attributes.push(t.jsxAttribute(t.jsxIdentifier(jsxName(binding.name)), t.jsxExpressionContainer(fromEstree(binding.expression))));
  }
  for (const eventId of node.eventIds) {
    const event = context.events.get(eventId);
    if (!event) throw new Error(`Unknown event record: ${eventId}`);
    attributes.push(t.jsxAttribute(t.jsxIdentifier(eventProp(event.eventName)), t.jsxExpressionContainer(emitEvent(event, context))));
  }
  const name = t.jsxIdentifier(node.tag);
  const children = node.children.map((child) => templateNode(child, context));
  return t.jsxElement(t.jsxOpeningElement(name, attributes, children.length === 0), children.length === 0 ? null : t.jsxClosingElement(t.jsxIdentifier(node.tag)), children, children.length === 0);
}

function containsCall(fn, methodName) {
  let found = false;
  const file = t.file(t.program([t.expressionStatement(t.cloneNode(fn, true))]));
  traverse(file, { CallExpression(path) { if (t.isMemberExpression(path.node.callee) && t.isIdentifier(path.node.callee.property, { name: methodName })) found = true; } });
  return found;
}

function deepWritePlans(fn, event, context) {
  const plans = new Map();
  const deepWrites = event.handlers.flatMap((handler) => handler.writes).filter((write) => write.via === 'handler-local-alias');
  if (deepWrites.length === 0) return plans;
  const file = t.file(t.program([t.expressionStatement(fn)]));
  traverse(file, {
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !t.isCallExpression(path.node.init) || !t.isMemberExpression(path.node.init.callee)) return;
      if (!t.isIdentifier(path.node.init.callee.property, { name: 'find' })) return;
      const predicate = path.node.init.arguments[0];
      if (!t.isArrowFunctionExpression(predicate)) return;
      const receiver = path.node.init.callee.object;
      if (!t.isIdentifier(receiver)) return;
      const declarationPath = path.parentPath;
      const assignment = declarationPath.getSibling(declarationPath.key + 1)?.node;
      if (!t.isExpressionStatement(assignment) || !t.isAssignmentExpression(assignment.expression) || !t.isMemberExpression(assignment.expression.left)) return;
      if (!t.isIdentifier(assignment.expression.left.object, { name: path.node.id.name })) return;
      const leaf = t.isIdentifier(assignment.expression.left.property) ? assignment.expression.left.property.name : null;
      const write = deepWrites.find((candidate) => candidate.path.at(-1) === leaf);
      if (!write) return;
      const state = context.statesById.get(write.graphNodeId);
      plans.set(path.node.id.name, { aliasDeclaration: declarationPath.node, assignment, predicate, receiver: receiver.name, state, write });
    },
  });
  if (plans.size !== deepWrites.length) throw new Error(`Could not structurally lower every deep write in ${event.id}`);
  return plans;
}

function immutablePatch(base, path, value) {
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  const current = member(t.cloneNode(base), head);
  return t.objectExpression([
    t.spreadElement(t.cloneNode(base)),
    t.objectProperty(t.identifier(head), immutablePatch(current, tail, value)),
  ]);
}

function emitSingleHandler(handler, event, context) {
  const fn = fromEstree(handler.expression);
  if (!t.isArrowFunctionExpression(fn)) throw new Error(`Event handler ${event.id} is not an arrow function`);
  if (!t.isBlockStatement(fn.body)) fn.body = t.blockStatement([t.expressionStatement(fn.body)]);

  const deepPlans = deepWritePlans(fn, { ...event, handlers: [handler] }, context);
  const removedDeclarations = new Set();
  const removedAssignments = new Set();
  for (const plan of deepPlans.values()) {
    removedDeclarations.add(plan.aliasDeclaration);
    const copyDeclaration = fn.body.body.find((statement) => t.isVariableDeclaration(statement)
      && statement.declarations.some((declaration) => t.isIdentifier(declaration.id, { name: plan.receiver })
        && t.isCallExpression(declaration.init) && t.isMemberExpression(declaration.init.callee)
        && t.isIdentifier(declaration.init.callee.property, { name: 'slice' })));
    if (copyDeclaration) removedDeclarations.add(copyDeclaration);
    const redundantRoot = fn.body.body.find((statement) => t.isExpressionStatement(statement)
      && t.isAssignmentExpression(statement.expression)
      && t.isIdentifier(statement.expression.left, { name: plan.state.name }));
    if (redundantRoot) removedAssignments.add(redundantRoot);
  }

  const writable = new Map();
  for (const write of handler.writes) {
    const state = context.statesById.get(write.graphNodeId);
    if (!state) throw new Error(`Write refers to unknown state: ${write.graphNodeId}`);
    writable.set(state.name, state);
  }

  const nextByState = new Map([...writable.values()].map((state) => [state.name, nextName(state.name)]));
  const wrapper = t.file(t.program([t.expressionStatement(fn)]));
  traverse(wrapper, {
    Identifier(path) {
      const replacement = nextByState.get(path.node.name);
      if (!replacement) return;
      const isWriteTarget = (path.parentPath.isAssignmentExpression() && path.key === 'left') || (path.parentPath.isUpdateExpression() && path.key === 'argument');
      if (!path.isReferencedIdentifier() && !isWriteTarget) return;
      path.replaceWith(t.identifier(replacement));
      if (path.parentPath.isObjectProperty() && path.parent.shorthand) path.parent.shorthand = false;
    },
  });

  const syncStatement = (state) => state.storage === 'ref'
    ? t.expressionStatement(t.assignmentExpression('=', member(t.identifier(state.name), 'current'), t.identifier(nextName(state.name))))
    : t.expressionStatement(t.callExpression(t.identifier(setterName(state.name)), [t.identifier(nextName(state.name))]));

  const body = [];
  for (const state of writable.values()) {
    const initial = state.storage === 'ref' ? member(t.identifier(state.name), 'current') : t.identifier(state.name);
    body.push(t.variableDeclaration('let', [t.variableDeclarator(t.identifier(nextName(state.name)), initial)]));
  }
  for (const statement of fn.body.body) {
    if (removedDeclarations.has(statement) || removedAssignments.has(statement)) continue;
    let replacedDeep = false;
    for (const plan of deepPlans.values()) {
      if (statement !== plan.assignment) continue;
      const item = plan.predicate.params[0];
      if (!t.isIdentifier(item)) throw new Error('Deep row selector requires an identifier parameter');
      const leafPath = plan.write.path.slice(1);
      const updatedItem = immutablePatch(t.identifier(item.name), leafPath, fromEstree(plan.write.value));
      const mapped = t.callExpression(member(t.identifier(nextName(plan.state.name)), 'map'), [
        t.arrowFunctionExpression([t.identifier(item.name)], t.conditionalExpression(t.cloneNode(plan.predicate.body, true), updatedItem, t.identifier(item.name))),
      ]);
      body.push(t.expressionStatement(t.assignmentExpression('=', t.identifier(nextName(plan.state.name)), mapped)));
      body.push(syncStatement(plan.state));
      replacedDeep = true;
    }
    if (replacedDeep) continue;
    body.push(statement);
    if (t.isExpressionStatement(statement) && (t.isAssignmentExpression(statement.expression) || t.isUpdateExpression(statement.expression))) {
      const target = t.isAssignmentExpression(statement.expression) ? statement.expression.left : statement.expression.argument;
      if (t.isIdentifier(target)) {
        const state = [...writable.values()].find((candidate) => nextName(candidate.name) === target.name);
        if (state) body.push(syncStatement(state));
      }
    }
  }
  fn.body.body = body;
  return fn;
}

function emitEvent(event, context) {
  const requiredActions = event.syncPolicy?.actions ?? event.syncPolicy?.branches?.flatMap((branch) => branch.actions) ?? [];
  for (const action of requiredActions) {
    if (!containsCall(fromEstree(event.handlers[0].expression), action)) throw new Error(`Sync policy ${action} is absent from ${event.id}'s handler AST`);
  }
  const handlers = event.handlers.map((handler) => emitSingleHandler(handler, event, context));
  if (handlers.length === 1) return handlers[0];
  const eventParam = t.identifier('event');
  return t.arrowFunctionExpression([eventParam], t.blockStatement(handlers.map((handler) => t.expressionStatement(t.callExpression(handler, [t.identifier('event')])))));
}

function componentFunction(ir, component, context, usedHooks) {
  const props = component.props.entries.map((entry) => {
    const key = t.identifier(entry.sourceName);
    let value = t.identifier(entry.localName);
    if (entry.defaultValue) value = t.assignmentPattern(value, fromEstree(entry.defaultValue));
    return t.objectProperty(key, value, false, entry.sourceName === entry.localName && !entry.defaultValue);
  });
  const body = [];
  const pendingInitializers = [];
  const bindingById = new Map(ir.records.bindings.map((binding) => [binding.id, binding]));

  for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
    const semantic = local.semanticRecordIds.map((id) => bindingById.get(id)).filter(Boolean);
    const state = semantic.find((binding) => binding.kind === 'state');
    const computed = semantic.find((binding) => binding.kind === 'computed');
    if (state) {
      const mapped = context.statesById.get(state.id);
      const initializer = fromEstree(state.initializer);
      emitOnceGuard(pendingInitializers.splice(0), body, usedHooks);
      if (mapped.storage === 'ref') {
        usedHooks.add('useRef');
        body.push(t.variableDeclaration('const', [t.variableDeclarator(t.identifier(state.name), t.callExpression(t.identifier('useRef'), [initializer]))]));
      } else {
        usedHooks.add('useState');
        const hook = t.callExpression(t.identifier('useState'), [makeLazyInitializer(initializer)]);
        body.push(t.variableDeclaration('const', [t.variableDeclarator(t.arrayPattern([t.identifier(state.name), t.identifier(setterName(state.name))]), hook)]));
      }
      continue;
    }
    if (computed) {
      body.push(t.variableDeclaration('const', [t.variableDeclarator(t.identifier(computed.name), unwrapComputed(computed))]));
      continue;
    }
    const initializer = fromEstree(local.initializer);
    if (!initializer) throw new Error(`Ordinary local ${local.names.join(',')} has no initializer`);
    if (!local.names.some((name) => identifierIsUsed(ir, name))) {
      pendingInitializers.push(initializer);
      continue;
    }
    usedHooks.add('useState');
    const pattern = fromEstree(local.pattern);
    body.push(t.variableDeclaration('const', [t.variableDeclarator(t.arrayPattern([pattern]), t.callExpression(t.identifier('useState'), [t.arrowFunctionExpression([], initializer)]))]));
  }
  if (pendingInitializers.length) throw new Error('A side-effectful once-local could not be folded into a following state initializer');

  for (const guard of component.guards) {
    let result;
    if (guard.whenTrue.kind === 'null') result = t.nullLiteral();
    else if (guard.whenTrue.kind === 'expression') result = fromEstree(guard.whenTrue.value.expression);
    else result = expressionFromChildren(guard.whenTrue.children, context);
    body.push(t.ifStatement(fromEstree(guard.test.expression), t.returnStatement(result)));
  }
  const rendered = component.template.length === 1 && component.template[0].kind === 'branch'
    ? branchExpression(component.template[0], context)
    : expressionFromChildren(component.template, context);
  body.push(t.returnStatement(rendered));
  const fn = t.functionDeclaration(t.identifier(component.name), [t.objectPattern(props)], t.blockStatement(body));
  return t.exportNamedDeclaration(fn);
}

export function emitReact(ir) {
  validateEnrichedIR(ir);
  const component = ir.components[0];
  const visible = referencedGraphIds(component, ir.records);
  const statesById = new Map();
  for (const binding of ir.records.bindings.filter((entry) => entry.kind === 'state')) {
    statesById.set(binding.id, { ...binding, storage: visible.has(binding.id) ? 'state' : 'ref' });
  }
  const context = { statesById, events: new Map(ir.records.events.map((event) => [event.id, event])) };
  const hooks = new Set();
  const exported = componentFunction(ir, component, context, hooks);
  const imports = t.importDeclaration([...hooks].sort().map((hook) => t.importSpecifier(t.identifier(hook), t.identifier(hook))), t.stringLiteral('react'));
  imports.leadingComments = [{ type: 'CommentLine', value: ' @generated by arcade-poc-06-emit-react; do not edit.' }];
  const program = t.program([imports, exported], [], 'module');
  const source = generate(program, { comments: true, jsescOption: { minimal: true } }).code;
  return `${source}\n`;
}
