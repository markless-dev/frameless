import { describe, expect, test } from 'vitest';
import { emitTrace, registerTrace } from '../src/support/trace-bridge.ts';

describe('Markless trace bridge', () => {
  test('routes mount and action emissions into the registered run recorder with its current phase', () => {
    let phase = 'mount';
    const calls: Array<{ name: string; phase: string }> = [];
    const release = registerTrace((name) => calls.push({ name, phase }));

    emitTrace('setup', { runs: 1 });
    phase = 'action:0:after';
    emitTrace('change', { count: 2 });
    release();
    emitTrace('ignored-after-release', null);

    expect(calls).toEqual([
      { name: 'setup', phase: 'mount' },
      { name: 'change', phase: 'action:0:after' },
    ]);
  });

  test('an older run cannot release a newer run recorder', () => {
    const calls: string[] = [];
    const releaseOld = registerTrace((name) => calls.push(`old:${name}`));
    const releaseCurrent = registerTrace((name) => calls.push(`current:${name}`));

    releaseOld();
    emitTrace('setup', null);
    releaseCurrent();

    expect(calls).toEqual(['current:setup']);
  });
});
