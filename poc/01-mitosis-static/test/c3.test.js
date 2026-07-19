import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { componentToQwik, parseJsx } from './mitosis.js';
import { parseModule, unresolvedReferences } from './scope.js';

const defaultMitosisRepo = '/Users/jacksm5pro/dev/open-source/mitosis';
const mitosisRepo = process.env.MITOSIS_REPO || defaultMitosisRepo;
const fixtureRelativePath = 'packages/core/src/__tests__/data/basic.raw.tsx';
const snapshotRelativePath = 'packages/core/src/__tests__/__snapshots__/qwik.test.ts.snap';
const upstreamGeneratorPath = 'src/__tests__/./data/basic.raw.tsx';

describe('C3: the accepted Qwik golden contains the regenerated unresolved myEvent defect', () => {
  test('npm 0.13.2 output and the upstream Basic snapshot both leave myEvent unbound', async () => {
    const source = await readFile(path.join(mitosisRepo, fixtureRelativePath), 'utf8');
    const snapshot = await readFile(path.join(mitosisRepo, snapshotRelativePath), 'utf8');
    const component = parseJsx(source, { typescript: false, filePath: upstreamGeneratorPath });
    const output = componentToQwik({ typescript: false })({
      component,
      path: upstreamGeneratorPath,
    });

    expect(() => parseModule(output)).not.toThrow();
    expect(unresolvedReferences(output, 'myEvent').length).toBeGreaterThan(0);

    const generatedDefect = 'state.name = myEvent.target.value';
    expect(output).toContain(generatedDefect);
    expect(snapshot).toContain(generatedDefect);
    expect(snapshot).toContain('exports[`qwik > jsx > Javascript Test > Basic 1`]');

    const snapshotBasic = snapshot.match(
      /exports\[`qwik > jsx > Javascript Test > Basic 1`\] = `\n"([\s\S]*?)"\n`;/,
    );
    expect(snapshotBasic, 'the committed Javascript Basic golden must be present').not.toBeNull();
    const snapshotOutput = snapshotBasic[1]
      .replaceAll('\\\\"', '"')
      .replaceAll('\\`', '`');
    expect(snapshotOutput).toBe(output);
    expect(() => parseModule(snapshotOutput)).not.toThrow();
    expect(unresolvedReferences(snapshotOutput, 'myEvent').length).toBeGreaterThan(0);
  });
});
