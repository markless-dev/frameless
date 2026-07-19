import { glob, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { ESLint } from 'eslint';

const traverse = traverseModule.default ?? traverseModule;
const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);

function violation(file, policy, message, node) {
  return { file, policy, message, line: node?.loc?.start.line ?? null };
}

export async function discoverGeneratedFiles({ cwd = process.cwd(), pattern = 'generated/**/*.jsx' } = {}) {
  const files = [];
  for await (const file of glob(pattern, { cwd })) files.push(file);
  return files.sort();
}

function importedReactBindings(ast) {
  const hooks = new Map();
  traverse(ast, {
    ImportSpecifier(path) {
      if (path.parent.source.value !== 'react') return;
      const imported = path.node.imported.name ?? path.node.imported.value;
      if (typeof imported === 'string' && imported.startsWith('use')) {
        hooks.set(path.scope.getBinding(path.node.local.name), imported);
      }
    },
  });
  return hooks;
}

function containsReturn(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'ReturnStatement') return true;
  return Object.entries(node).some(([key, value]) => key !== 'loc' && key !== 'start' && key !== 'end'
    && (Array.isArray(value) ? value.some(containsReturn) : containsReturn(value)));
}

function propertyName(node) {
  if (!node) return null;
  const value = node.property ?? node.key;
  if (!node.computed && value?.type === 'Identifier') return value.name;
  return value?.type === 'StringLiteral' ? value.value : null;
}

function customPolicies(source, file) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'], attachComment: true });
  const violations = [];
  const reactHooks = importedReactBindings(ast);
  const stateSetters = new Set();

  traverse(ast, {
    VariableDeclarator(path) {
      if (path.node.id.type !== 'ArrayPattern' || path.node.init?.type !== 'CallExpression' || path.node.init.callee.type !== 'Identifier') return;
      const hookBinding = path.scope.getBinding(path.node.init.callee.name);
      if (reactHooks.get(hookBinding) !== 'useState') return;
      const setter = path.node.id.elements[1];
      if (setter?.type === 'Identifier') stateSetters.add(path.scope.getBinding(setter.name));
    },
  });

  for (const comment of ast.comments ?? []) {
    if (/^\s*eslint(?:\s|-)/.test(comment.value)) {
      violations.push(violation(file, 'eslint-directive', 'ESLint directive comments are forbidden', comment));
    }
  }

  const seenHelpers = new Set();
  function resolveCallable(calleePath, trail = new Set()) {
    if (!calleePath?.node) return null;
    if (calleePath.isIdentifier()) {
      const binding = calleePath.scope.getBinding(calleePath.node.name);
      if (!binding || trail.has(binding)) return null;
      if (stateSetters.has(binding)) return { kind: 'setter', binding };
      const hook = reactHooks.get(binding);
      if (EFFECT_HOOKS.has(hook)) return { kind: 'effect', hook };
      trail.add(binding);
      if (binding.path.isFunctionDeclaration()) return { kind: 'helper', path: binding.path };
      if (binding.path.isVariableDeclarator()) {
        const init = binding.path.get('init');
        if (init.isArrowFunctionExpression() || init.isFunctionExpression()) return { kind: 'helper', path: init };
        return resolveCallable(init, trail);
      }
      return null;
    }
    if (calleePath.isMemberExpression()) {
      const object = calleePath.get('object');
      const name = propertyName(calleePath.node);
      if (!object.isIdentifier() || name == null) return null;
      const binding = object.scope.getBinding(object.node.name);
      if (!binding?.path.isVariableDeclarator()) return null;
      const init = binding.path.get('init');
      if (!init.isObjectExpression()) return null;
      const property = init.get('properties').find((candidate) => candidate.isObjectProperty() && propertyName(candidate.node) === name);
      return property ? resolveCallable(property.get('value'), trail) : null;
    }
    return null;
  }

  function inspectExecution(functionPath, origin) {
    if (seenHelpers.has(functionPath.node)) return;
    seenHelpers.add(functionPath.node);
    functionPath.traverse({
      Function(path) { path.skip(); },
      CallExpression(path) {
        const resolved = resolveCallable(path.get('callee'));
        if (resolved?.kind === 'setter') {
          violations.push(violation(file, 'render-phase-setter', 'A useState setter is reachable during render', origin ?? path.node));
        } else if (resolved?.kind === 'effect') {
          violations.push(violation(file, 'render-phase-effect', `${resolved.hook} is forbidden by the fixture gate`, origin ?? path.node));
        } else if (resolved?.kind === 'helper') {
          inspectExecution(resolved.path, origin ?? path.node);
        }
      },
    });
  }

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== 'react') violations.push(violation(file, 'undisclosed-import', `Undisclosed import: ${path.node.source.value}`, path.node));
    },
    CallExpression(path) {
      if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'require') {
        violations.push(violation(file, 'undisclosed-import', 'CommonJS require is undisclosed', path.node));
      }
      if (path.node.callee.type === 'Import') violations.push(violation(file, 'undisclosed-import', 'Dynamic import is undisclosed', path.node));
    },
    JSXAttribute(path) {
      if (path.node.name.name !== 'key' || path.node.value?.type !== 'JSXExpressionContainer') return;
      const expression = path.get('value.expression');
      let found = false;
      const inspect = (identifier) => {
        if (found || !identifier.isIdentifier()) return;
        const binding = identifier.scope.getBinding(identifier.node.name);
        const owner = binding?.scope.path;
        if (owner?.isFunction() && owner.node.params[1] === binding.path.node) found = true;
      };
      inspect(expression);
      expression.traverse({ Identifier: inspect });
      if (found) violations.push(violation(file, 'index-key', 'A keyed repeat may not use its map index', path.node));
    },
    FunctionDeclaration(path) {
      if (!path.parentPath.isExportNamedDeclaration()) return;
      inspectExecution(path);
      const statements = path.get('body.body');
      const firstEarlyGuard = statements.findIndex((statement) => statement.isIfStatement() && containsReturn(statement.node.consequent));
      for (const statement of statements) {
        statement.traverse({
          Function(nested) { nested.skip(); },
          CallExpression(call) {
            if (!call.get('callee').isIdentifier()) return;
            const binding = call.scope.getBinding(call.node.callee.name);
            if (!reactHooks.has(binding)) return;
            const statementIndex = statements.findIndex((candidate) => candidate.node === call.getStatementParent()?.node);
            if (firstEarlyGuard >= 0 && statementIndex > firstEarlyGuard) {
              violations.push(violation(file, 'hook-after-guard', 'A React hook appears after an early-return guard', call.node));
            }
          },
        });
      }
    },
  });
  return violations;
}

function makeESLint(cwd) {
  return new ESLint({
    cwd,
    useEslintrc: false,
    baseConfig: {
      env: { browser: true, es2022: true },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
      plugins: ['react', 'react-hooks'],
      extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended'],
      settings: { react: { version: '18.3' } },
      rules: {
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'no-unused-expressions': 'error',
        'react/prop-types': ['error', { skipUndeclared: true }],
      },
    },
  });
}

export async function checkSources(entries, { cwd = process.cwd() } = {}) {
  const eslint = makeESLint(cwd);
  const violations = [];
  for (const { file, source } of entries) {
    let astViolations = [];
    try {
      astViolations = customPolicies(source, file);
    } catch (error) {
      astViolations.push(violation(file, 'parse', error.message));
    }
    violations.push(...astViolations);
    const [result] = await eslint.lintText(source, { filePath: resolve(cwd, file), warnIgnored: false });
    for (const message of result.messages) {
      if (message.severity > 0) violations.push({ file, policy: `eslint:${message.ruleId ?? 'parse'}`, message: message.message, line: message.line ?? null });
    }
  }
  return { files: entries.map((entry) => entry.file), violations };
}

export async function checkGeneratedFiles(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const files = await discoverGeneratedFiles({ cwd, pattern: options.pattern });
  const entries = await Promise.all(files.map(async (file) => ({ file, source: await readFile(resolve(cwd, file), 'utf8') })));
  return checkSources(entries, { cwd });
}
