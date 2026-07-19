import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { componentToReact, parseJsx } from './mitosis.js';
import { parseModule, selfReferentialBindings } from './scope.js';

const fixturePath = fileURLToPath(new URL('../fixtures/c2-collision.lite.tsx', import.meta.url));

describe('C2: identifier rewriting creates a TDZ self-reference', () => {
  test('the emitted local foo binding resolves its initializer reference to itself', async () => {
    const source = await readFile(fixturePath, 'utf8');
    const component = parseJsx(source, { filePath: 'fixtures/c2-collision.lite.tsx' });
    const output = componentToReact()({ component, path: 'fixtures/c2-collision.lite.tsx' });

    expect(() => parseModule(output)).not.toThrow();
    expect(selfReferentialBindings(output, 'foo')).toHaveLength(1);

    const executeCollision = Function(`"use strict"; return () => { const foo = foo; return foo; };`)();
    expect(executeCollision).toThrow(ReferenceError);
  });
});
