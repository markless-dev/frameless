import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { componentToReact, parseJsx } from './mitosis.js';
import { parseModule, unresolvedReferences } from './scope.js';

const fixturePath = fileURLToPath(new URL('../fixtures/c1-local.lite.tsx', import.meta.url));

afterEach(() => vi.restoreAllMocks());

describe('C1: ordinary component-body declarations are silently discarded', () => {
  test('React generation succeeds but leaves the used local unresolved', async () => {
    const source = await readFile(fixturePath, 'utf8');
    const captured = [];
    for (const method of ['warn', 'error', 'log', 'info', 'debug']) {
      vi.spyOn(console, method).mockImplementation((...args) => captured.push([method, ...args]));
    }

    const component = parseJsx(source, { filePath: 'fixtures/c1-local.lite.tsx' });
    let output;
    expect(() => {
      output = componentToReact()({ component, path: 'fixtures/c1-local.lite.tsx' });
    }).not.toThrow();

    expect(captured).toEqual([]);
    expect(output).toBeTypeOf('string');
    expect(output).not.toContain('const greeting');
    expect(unresolvedReferences(output, 'greeting')).toHaveLength(1);
    expect(() => parseModule(output)).not.toThrow();
  });
});
