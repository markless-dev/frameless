import { glob, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { ESLint } from 'eslint';

const traverse = traverseModule.default ?? traverseModule;
const ALLOWED_IMPORTS = new Set(['solid-js', 'solid-js/web']);
const EFFECTS = new Set(['createEffect', 'createRenderEffect', 'onMount']);
const violation = (file, policy, message, node) => ({ file, policy, message, line: node?.loc?.start.line ?? null });

export async function discoverGeneratedFiles({ cwd = process.cwd(), pattern = 'generated/**/*.jsx' } = {}) {
  const files = [];
  for await (const file of glob(pattern, { cwd })) files.push(file);
  return files.sort();
}

function customPolicies(source, file) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'], attachComment: true });
  const violations = [];
  const solidImports = new Map();
  const setters = new Set();
  traverse(ast, {
    ImportSpecifier(path) {
      if (path.parent.source.value !== 'solid-js') return;
      solidImports.set(path.scope.getBinding(path.node.local.name), path.node.imported.name);
    },
    VariableDeclarator(path) {
      if (path.node.id.type !== 'ArrayPattern' || path.node.init?.type !== 'CallExpression' || path.node.init.callee.type !== 'Identifier') return;
      if (solidImports.get(path.scope.getBinding(path.node.init.callee.name)) !== 'createSignal') return;
      const setter = path.node.id.elements[1];
      if (setter?.type === 'Identifier') setters.add(path.scope.getBinding(setter.name));
    },
  });
  for (const comment of ast.comments ?? []) if (/^\s*eslint(?:\s|-)/.test(comment.value)) violations.push(violation(file, 'eslint-directive', 'ESLint directives are forbidden', comment));
  for (const [binding, imported] of solidImports) if (binding.referencePaths.length === 0) violations.push(violation(file, 'unused-import', `Unused Solid import: ${imported}`, binding.path.node));
  traverse(ast, {
    ImportDeclaration(path) {
      if (!ALLOWED_IMPORTS.has(path.node.source.value)) violations.push(violation(file, 'undisclosed-import', `Undisclosed import: ${path.node.source.value}`, path.node));
    },
    CallExpression(path) {
      if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'require') violations.push(violation(file, 'undisclosed-import', 'CommonJS require is undisclosed', path.node));
      if (path.node.callee.type === 'Import') violations.push(violation(file, 'undisclosed-import', 'Dynamic import is undisclosed', path.node));
      if (path.node.callee.type !== 'Identifier') return;
      const binding = path.scope.getBinding(path.node.callee.name);
      if (EFFECTS.has(solidImports.get(binding))) violations.push(violation(file, 'render-phase-effect', 'Effects are forbidden in this fixture family', path.node));
      if (setters.has(binding) && path.getFunctionParent()?.parentPath?.isExportNamedDeclaration()) violations.push(violation(file, 'render-phase-setter', 'A signal setter is reachable during component setup', path.node));
    },
    FunctionDeclaration(path) {
      if (!path.parentPath.isExportNamedDeclaration()) return;
      const param = path.node.params[0];
      if (param?.type === 'ObjectPattern') violations.push(violation(file, 'reactivity-freezing-props', 'Broad Solid prop destructuring freezes reactive reads', param));
    },
    JSXElement(path) {
      const opening = path.node.openingElement;
      if (opening.name.type !== 'JSXIdentifier' || opening.name.name !== 'For') return;
      const child = path.node.children.find((entry) => entry.type === 'JSXExpressionContainer')?.expression;
      if (child?.type === 'ArrowFunctionExpression' && child.params.length > 1) violations.push(violation(file, 'index-key', 'A keyed repeat may not depend on the Solid index accessor', child.params[1]));
    },
    MemberExpression(path) {
      const owner = path.getFunctionParent();
      if (path.node.property.type === 'Identifier' && path.node.property.name === 'map' && path.findParent((parent) => parent.isJSXExpressionContainer()) && owner?.parentPath?.isExportNamedDeclaration()) violations.push(violation(file, 'index-key', 'Render repeats must use Solid For identity', path.node));
    },
  });
  return violations;
}

function makeESLint(cwd) {
  return new ESLint({ cwd, useEslintrc: false, baseConfig: {
    env: { browser: true, es2022: true }, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    extends: ['eslint:recommended'],
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^(For|Show)$' }], 'no-unused-expressions': 'error' },
  } });
}

export async function checkSources(entries, { cwd = process.cwd() } = {}) {
  const eslint = makeESLint(cwd); const violations = [];
  for (const { file, source } of entries) {
    try { violations.push(...customPolicies(source, file)); } catch (error) { violations.push(violation(file, 'parse', error.message)); }
    const [result] = await eslint.lintText(source, { filePath: resolve(cwd, file), warnIgnored: false });
    for (const message of result.messages) if (message.severity > 0) violations.push({ file, policy: `eslint:${message.ruleId ?? 'parse'}`, message: message.message, line: message.line ?? null });
  }
  return { files: entries.map((entry) => entry.file), violations };
}

export async function checkGeneratedFiles(options = {}) {
  const cwd = options.cwd ?? process.cwd(); const files = await discoverGeneratedFiles({ cwd, pattern: options.pattern });
  return checkSources(await Promise.all(files.map(async (file) => ({ file, source: await readFile(resolve(cwd, file), 'utf8') }))), { cwd });
}
