// @vitest-environment node
// esbuild's TextEncoder invariant breaks under jsdom; this suite needs no DOM.
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { ESLint } from 'eslint';
import { transformWithEsbuild } from 'vite';
import { describe, expect, test } from 'vitest';

const traverse = traverseModule.default ?? traverseModule;
const files = ['generated/S1.jsx', 'generated/S2.jsx', 'generated/S3.jsx'];

function parseGenerated(source) {
  return parse(source, { sourceType: 'module', plugins: ['jsx'] });
}

describe('C8 conventionality gate', () => {
  test('Vite/esbuild compiles every React 18.3.1 component', async () => {
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const result = await transformWithEsbuild(source, file, { loader: 'jsx', jsx: 'automatic', jsxImportSource: 'react' });
      expect(result.code).toContain('react/jsx-runtime');
    }
  });

  test('React and Hooks recommended lint has zero errors and no disable comments', async () => {
    const eslint = new ESLint({ cwd: process.cwd(), useEslintrc: true });
    const results = await eslint.lintFiles(files);
    expect(results.reduce((count, result) => count + result.errorCount, 0), JSON.stringify(results.flatMap((result) => result.messages), null, 2)).toBe(0);
    for (const file of files) expect(await readFile(file, 'utf8')).not.toMatch(/eslint-(?:disable|enable)/);
  });

  test('imports, bindings, render phase, and hook sites satisfy AST policy', async () => {
    for (const file of files) {
      const ast = parseGenerated(await readFile(file, 'utf8'));
      const imports = ast.program.body.filter((node) => node.type === 'ImportDeclaration');
      expect(imports.map((node) => node.source.value)).toEqual(['react']);
      traverse(ast, {
        Program: {
          exit(path) {
            for (const [name, binding] of Object.entries(path.scope.bindings)) {
              if (binding.path.isFunctionDeclaration() && binding.path.parentPath.isExportNamedDeclaration()) continue;
              expect(binding.referenced, `${file}: unused ${name}`).toBe(true);
            }
          },
        },
        Function: {
          exit(path) {
            for (const [name, binding] of Object.entries(path.scope.bindings)) {
              expect(binding.referenced, `${file}: unused ${name}`).toBe(true);
            }
          },
        },
        CallExpression(path) {
          const isHook = path.node.callee.type === 'Identifier' && /^use[A-Z]/.test(path.node.callee.name);
          if (isHook) {
            const owner = path.getFunctionParent();
            expect(owner?.isFunctionDeclaration(), `${file}: hook outside component top level`).toBe(true);
            expect(owner.parentPath.isExportNamedDeclaration()).toBe(true);
            expect(path.getStatementParent().parentPath.node).toBe(owner.node.body);
            const firstGuard = owner.node.body.body.find((node) => node.type === 'IfStatement');
            if (firstGuard) expect(path.node.start).toBeLessThan(firstGuard.start);
          }
          if (path.getFunctionParent()?.isFunctionDeclaration() && path.node.callee.type === 'Identifier' && /^set[A-Z]/.test(path.node.callee.name)) {
            throw path.buildCodeFrameError('setState during render');
          }
          if (path.getFunctionParent()?.isFunctionDeclaration() && path.node.callee.type === 'Identifier' && /^useEffect$/.test(path.node.callee.name)) {
            throw path.buildCodeFrameError('effect during render');
          }
        },
      });
    }
  });

  test('S2 uses the IR key expression, never the map index', async () => {
    const ast = parseGenerated(await readFile('generated/S2.jsx', 'utf8'));
    const keys = [];
    traverse(ast, { JSXAttribute(path) { if (path.node.name.name === 'key') keys.push(path.node.value.expression); } });
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ type: 'MemberExpression', object: { type: 'Identifier', name: 'todo' }, property: { type: 'Identifier', name: 'id' } });
  });
});
