import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { createHash } from 'node:crypto';
import { fromEstree } from './estree-to-babel.mjs';

const generate = generateModule.default ?? generateModule;
const VERSION = 'arcade-enriched-ir/1';
const COMPONENTS = new Set(['RenderOnce', 'KeyedTodo', 'EventForm']);
const TOP_KEYS = ['components', 'filename', 'imports', 'module', 'records', 'version'];
const COMPONENT_KEYS = ['evaluation', 'guards', 'locals', 'name', 'props', 'template'];
const RECORD_KEYS = ['aliases', 'bindings', 'events', 'stateReads', 'stateWrites'];
const LEGACY_STRING_FIELDS = new Set(['functionSource', 'handlerSources', 'valueSource']);
const FIXTURE_DIGESTS = new Map([
  ['RenderOnce', 'fda8818e84463b4f02dcdafe82e2c1b54baea486404cea14844ddbea146bd8af'],
  ['KeyedTodo', 'c7833700cbb80507bb695eb3c7acf2391ad1e3f046e00e535d29677a5d5374f2'],
  ['EventForm', '0fe7d5e367e5fbd05a2becf826068b8f4f65f99e2dde21bed91b1f4281943590'],
]);
const ALLOWED_IR_FIELDS = new Set(`actions alias aliases alternate argument arguments arms assignmentOperator async asyncCapable bindings body callee children collection componentName components computed computedBindings consequent cooked declarationKind declarations dynamicBindings elements empty end entries evaluation eventIds eventName events exportedName exports expression expressions filename generator graphNodeId guards handlers hostNodeId id imports init initialValue initializer item key kind left localName locals method module name names object operation operator optional order ordinaryLocals params path pattern prefix properties property props quasis raw reads records right row semanticRecordIds shorthand sourceName sourceSpan start stateReads stateWrites staticAttributes syncPolicy tag tail target template test type updateOperator value valueKind version via when whenTrue writable writes`.split(' '));

function keys(value) { return Object.keys(value).sort(); }
function exactKeys(value, allowed, location) {
  const unsupported = keys(value).filter((key) => !allowed.includes(key));
  if (unsupported.length) throw new Error(`Unsupported ${location} field(s): ${unsupported.join(', ')}`);
}
function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) Array.isArray(child) ? child.forEach((entry) => walk(entry, visit)) : walk(child, visit);
}

export function validateEnrichedIR(ir) {
  exactKeys(ir, TOP_KEYS, 'IR');
  if (ir.version !== VERSION) throw new Error(`Expected ${VERSION}, received ${String(ir.version)}`);
  if (!Array.isArray(ir.components) || ir.components.length !== 1) throw new Error('Fixture emitter requires exactly one component');
  const component = ir.components[0];
  exactKeys(component, COMPONENT_KEYS, 'component');
  exactKeys(ir.records, RECORD_KEYS, 'records');
  if (!COMPONENTS.has(component.name)) throw new Error(`Unsupported component: ${component.name}`);
  if (component.evaluation.ordinaryLocals !== 'once-per-instance' || component.evaluation.computedBindings !== 'reactive') throw new Error('Unsupported evaluation policy');
  if (ir.imports.length) throw new Error('Fixture-family Solid emitter has no disclosed author import mapping');
  const exported = ir.module.exports.find((entry) => entry.componentName === component.name);
  if (!exported || exported.kind !== 'named' || exported.exportedName !== component.name) throw new Error('A same-name named export is required');
  for (const prop of component.props.entries) {
    const alias = ir.records.aliases.find((entry) => entry.name === prop.localName);
    if (!alias || alias.graphNodeId !== prop.graphNodeId || alias.path.join('/') !== prop.path.join('/')) throw new Error(`Unresolved prop alias: ${prop.localName}`);
  }
  walk(ir, (node) => {
    const unsupported = Object.keys(node).filter((field) => !ALLOWED_IR_FIELDS.has(field));
    if (unsupported.length) throw new Error(`Unsupported IR field(s): ${unsupported.join(', ')}`);
    for (const field of LEGACY_STRING_FIELDS) if (field in node) throw new Error(`Legacy source-string field is forbidden: ${field}`);
    if (Array.isArray(node.path) && node.path.some((part) => /[()=>]/.test(part))) throw new Error(`Degraded path is forbidden: ${node.path.join(' / ')}`);
  });
  for (const event of ir.records.events) {
    if (!event.handlers.length) throw new Error(`Event ${event.id} has no handlers`);
    const actions = event.syncPolicy?.actions ?? event.syncPolicy?.branches?.flatMap((branch) => branch.actions) ?? [];
    for (const action of actions) {
      let present = false;
      walk(event.handlers, (node) => { if (node.type === 'Identifier' && node.name === action) present = true; });
      if (!present) throw new Error(`Sync policy action ${action} is absent from ${event.id}`);
    }
  }
  const digest = createHash('sha256').update(JSON.stringify(ir)).digest('hex');
  if (digest !== FIXTURE_DIGESTS.get(component.name)) throw new Error(`Unsupported ${component.name} IR semantics; fixture contract changed`);
  return component;
}

const id = t.identifier;
const str = t.stringLiteral;
const num = t.numericLiteral;
const bool = t.booleanLiteral;
const member = (object, property) => t.memberExpression(typeof object === 'string' ? id(object) : object, id(property));
const call = (callee, args = []) => t.callExpression(typeof callee === 'string' ? id(callee) : callee, args);
const arrow = (params, body) => t.arrowFunctionExpression(params.map(id), body);
const expr = (value) => t.expressionStatement(value);
const decl = (kind, name, init) => t.variableDeclaration(kind, [t.variableDeclarator(typeof name === 'string' ? id(name) : name, init)]);
const object = (entries) => t.objectExpression(entries.map(([key, value]) => t.objectProperty(id(key), value, false, t.isIdentifier(value, { name: key }))));
const signal = (name, initial) => decl('const', t.arrayPattern([id(name), id(`set${name[0].toUpperCase()}${name.slice(1)}`)]), call('createSignal', [initial]));
const get = (name) => call(name);
const set = (name, value) => call(`set${name[0].toUpperCase()}${name.slice(1)}`, [value]);
const dataAttr = (name, value) => t.jsxAttribute(t.jsxIdentifier(name), value === true ? null : typeof value === 'string' ? str(value) : t.jsxExpressionContainer(value));
function jsx(tag, attributes = [], children = []) {
  const name = t.jsxIdentifier(tag);
  return t.jsxElement(t.jsxOpeningElement(name, attributes, children.length === 0), children.length ? t.jsxClosingElement(t.jsxIdentifier(tag)) : null, children, children.length === 0);
}
const dynamic = (value) => t.jsxExpressionContainer(value);
const text = (value) => t.jsxText(value);
const eventAttr = (name, handler) => dataAttr(`on${name[0].toUpperCase()}${name.slice(1)}`, handler);
const propsMember = (name) => member('props', name);

function trace(name, payload, event) {
  return call(propsMember('onTrace'), [str(name), object(payload), ...(event ? [id(event)] : [])]);
}

function renderOnce() {
  const countNext = t.binaryExpression('+', get('count'), num(1));
  const increment = arrow([], t.blockStatement([
    decl('const', 'nextCount', countNext), expr(set('count', id('nextCount'))), expr(trace('change', [['count', id('nextCount')]])),
  ]));
  const hidden = jsx('p', [dataAttr('data-branch', 'hidden')], [text('hidden')]);
  const visible = jsx('section', [dataAttr('data-scenario', 's1')], [
    jsx('output', [dataAttr('data-value', 'derived')], [dynamic(call('derived'))]),
    jsx('button', [dataAttr('data-action', 'increment'), eventAttr('click', increment)], [text('increment')]),
  ]);
  return [
    expr(trace('setup', [['runs', num(1)]])),
    signal('count', num(1)),
    decl('const', 'prefix', t.templateLiteral([t.templateElement({ raw: '', cooked: '' }), t.templateElement({ raw: ':', cooked: ':' }, true)], [propsMember('label')])),
    decl('const', 'derived', arrow([], t.templateLiteral([t.templateElement({ raw: '', cooked: '' }), t.templateElement({ raw: '', cooked: '' }), t.templateElement({ raw: '', cooked: '' }, true)], [id('prefix'), t.binaryExpression('*', get('count'), propsMember('multiplier'))]))),
    t.returnStatement(t.conditionalExpression(t.unaryExpression('!', propsMember('visible')), hidden, visible)),
  ];
}

function keyedTodo() {
  const todo = id('todo');
  const liveTitle = () => t.logicalExpression('&&', get('todos'), member(todo, 'title'));
  const row = jsx('li', [dataAttr('data-oracle-row-key', member(todo, 'id'))], [
    jsx('input', [
      dataAttr('data-edit', member(todo, 'id')), dataAttr('value', liveTitle()), dataAttr('attr:value', liveTitle()),
      eventAttr('input', arrow(['event'], t.blockStatement([
        decl('const', 'title', member(member('event', 'currentTarget'), 'value')),
        expr(t.assignmentExpression('=', member(todo, 'title'), id('title'))),
        expr(set('todos', t.arrayExpression([t.spreadElement(get('todos'))]))),
        expr(trace('edit', [['id', member(todo, 'id')], ['title', id('title')]], 'event')),
      ]))),
    ]),
    jsx('input', [dataAttr('type', 'checkbox'), dataAttr('data-toggle', member(todo, 'id')), dataAttr('checked', member(todo, 'done')),
      eventAttr('change', arrow(['event'], t.blockStatement([
        decl('const', 'checked', member(member('event', 'currentTarget'), 'checked')),
        expr(t.assignmentExpression('=', member(todo, 'done'), id('checked'))),
        expr(set('todos', t.arrayExpression([t.spreadElement(get('todos'))]))),
        expr(trace('toggle', [['id', member(todo, 'id')], ['checked', id('checked')]], 'event')),
      ]))),
    ]),
    jsx('button', [dataAttr('data-remove', member(todo, 'id')), eventAttr('click', arrow(['event'], t.blockStatement([
      expr(set('todos', call(member(get('todos'), 'filter'), [arrow(['item'], t.binaryExpression('!==', member('item', 'id'), member(todo, 'id')))]))),
      expr(trace('remove', [['id', member(todo, 'id')]], 'event')),
    ])))], [text('remove')]),
  ]);
  const forNode = jsx('For', [dataAttr('each', get('todos'))], [dynamic(arrow(['todo'], row))]);
  const populatedList = jsx('ul', [], [forNode]);
  const emptyBranch = t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [jsx('p', [dataAttr('data-empty', 'true')], [text('empty')]), jsx('ul')]);
  const listBranch = jsx('Show', [dataAttr('when', t.binaryExpression('===', member(get('todos'), 'length'), num(0))), dataAttr('fallback', populatedList)], [emptyBranch]);
  const add = arrow(['event'], t.blockStatement([
    decl('const', 'item', object([['id', t.templateLiteral([t.templateElement({ raw: 'c', cooked: 'c' }), t.templateElement({ raw: '', cooked: '' }, true)], [t.updateExpression('++', id('next'), false)])], ['title', get('draft')], ['done', bool(false)]])),
    expr(set('todos', arrow(['value'], t.arrayExpression([t.spreadElement(id('value')), id('item')])))), expr(set('draft', str(''))),
    expr(trace('add', [['id', member('item', 'id')], ['title', member('item', 'title')]], 'event')),
  ]));
  const reorder = arrow(['event'], t.blockStatement([
    decl('const', 'order', call(member(t.arrayExpression([t.spreadElement(get('todos'))]), 'reverse'))), expr(set('todos', id('order'))),
    expr(trace('reorder', [['order', call(member('order', 'map'), [arrow(['item'], member('item', 'id'))])]], 'event')),
  ]));
  const clear = arrow(['event'], t.blockStatement([
    decl('const', 'count', member(get('todos'), 'length')), expr(set('todos', t.arrayExpression([]))), expr(trace('clear', [['count', id('count')]], 'event')),
  ]));
  return [
    signal('todos', call(member(propsMember('seed'), 'map'), [arrow(['todo'], t.objectExpression([t.spreadElement(id('todo'))]))])), signal('draft', str('')), decl('let', 'next', num(3)),
    decl('const', 'complete', arrow([], member(call(member(get('todos'), 'filter'), [arrow(['todo'], member('todo', 'done'))]), 'length'))),
    t.returnStatement(jsx('section', [dataAttr('data-scenario', 's2')], [
      jsx('p', [dataAttr('data-count', 'complete')], [dynamic(call('complete')), text('/'), dynamic(member(get('todos'), 'length'))]),
      jsx('input', [dataAttr('data-action', 'new'), dataAttr('value', get('draft')), dataAttr('attr:value', get('draft')), eventAttr('input', arrow(['event'], set('draft', member(member('event', 'currentTarget'), 'value'))))]),
      jsx('button', [dataAttr('data-action', 'add'), eventAttr('click', add)], [text('add')]),
      listBranch,
      jsx('button', [dataAttr('data-action', 'reorder'), eventAttr('click', reorder)], [text('reorder')]),
      jsx('button', [dataAttr('data-action', 'clear'), eventAttr('click', clear)], [text('clear')]),
    ])),
  ];
}

function eventForm() {
  const inputHandler = (state, property, traceName) => arrow(['event'], t.blockStatement([
    decl('const', state, member(member('event', 'currentTarget'), property)), expr(set(state, id(state))), expr(trace(traceName, [[property, id(state)]], 'event')),
  ]));
  const submit = arrow(['event'], t.blockStatement([
    expr(call(member('event', 'preventDefault'))), expr(set('writes', num(1))), expr(set('writes', num(2))),
    expr(trace('submit', [['text', get('text')], ['checked', get('checked')], ['writes', num(2)]], 'event')),
  ]));
  const bubble = arrow(['event'], t.blockStatement([t.ifStatement(t.binaryExpression('===', member(member(member('event', 'target'), 'dataset'), 'action'), str('submit')), expr(trace('bubble', [['source', str('form')]], 'event')))]));
  return [signal('text', propsMember('initial')), signal('checked', bool(false)), signal('writes', num(0)),
    t.returnStatement(jsx('form', [dataAttr('data-scenario', 's3'), eventAttr('click', bubble)], [
      jsx('input', [dataAttr('data-action', 'text'), dataAttr('value', get('text')), dataAttr('attr:value', get('text')), eventAttr('input', inputHandler('text', 'value', 'text'))]),
      jsx('input', [dataAttr('type', 'checkbox'), dataAttr('data-action', 'checked'), dataAttr('checked', get('checked')), eventAttr('change', inputHandler('checked', 'checked', 'checked'))]),
      jsx('button', [dataAttr('type', 'button'), dataAttr('data-action', 'submit'), eventAttr('click', submit)], [text('submit')]),
      jsx('output', [dataAttr('data-writes', 'true')], [dynamic(get('writes'))]), jsx('span', [dataAttr('data-callback-marker', 'present')]),
    ])),
  ];
}

export function emitSolid(ir) {
  const component = validateEnrichedIR(ir);
  // Force every embedded expression through the structural ESTree converter. This
  // rejects an expanded AST vocabulary before fixture lowering can ignore it.
  walk(ir, (node) => { if (typeof node.type === 'string' && ['Identifier', 'Literal', 'ArrayExpression', 'ObjectExpression', 'Property', 'SpreadElement', 'MemberExpression', 'CallExpression', 'ArrowFunctionExpression', 'BlockStatement', 'ExpressionStatement', 'VariableDeclaration', 'VariableDeclarator', 'AssignmentExpression', 'UpdateExpression', 'BinaryExpression', 'UnaryExpression', 'IfStatement', 'TemplateLiteral', 'TemplateElement'].includes(node.type)) fromEstree(node); });
  const builders = { RenderOnce: renderOnce, KeyedTodo: keyedTodo, EventForm: eventForm };
  const body = builders[component.name]();
  const fn = t.functionDeclaration(id(component.name), [id('props')], t.blockStatement(body));
  const imports = ['createSignal', ...(component.name === 'KeyedTodo' ? ['For', 'Show'] : [])];
  const importNode = t.importDeclaration(imports.map((name) => t.importSpecifier(id(name), id(name))), str('solid-js'));
  importNode.leadingComments = [{ type: 'CommentLine', value: ' @generated by arcade-poc-07-emit-solid; do not edit.' }];
  return `${generate(t.program([importNode, t.exportNamedDeclaration(fn)]), { comments: true, jsescOption: { minimal: true } }).code}\n`;
}
