import type { Divergence, RunTrace, Verdict } from './types.ts';

function canonical(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((item) => canonical(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([field]) => field !== 'nodeId' && field !== 'rows' && (key !== 'focus' || field !== 'nodeId'))
    .map(([field, item]) => [field, canonical(item, field)]));
  return value;
}
function firstDiff(a: any, b: any, path = '$'): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null) return path;
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) return `${path}.length`; for (let index = 0; index < a.length; index++) { const diff = firstDiff(a[index], b[index], `${path}[${index}]`); if (diff) return diff; } return null; }
  if (typeof a === 'object') { const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(); for (const field of keys) { const diff = firstDiff(a[field], b[field], `${path}.${field}`); if (diff) return diff; } return null; }
  return path;
}
function add(divergences: Divergence[], channel: Divergence['channel'], phase: string, left: unknown, right: unknown) { const a = canonical(left); const b = canonical(right); const path = firstDiff(a, b); if (path) divergences.push({ channel, phase, path, left: a, right: b }); }

export function compareRuns(left: RunTrace, right: RunTrace): Verdict {
  const divergences: Divergence[] = [];
  if (left.scenario !== right.scenario) add(divergences, 'trace', 'run', left.scenario, right.scenario);
  const count = Math.max(left.observations.length, right.observations.length);
  for (let index = 0; index < count; index++) {
    const a = left.observations[index]; const b = right.observations[index]; const phase = a?.phase ?? b?.phase ?? `#${index}`;
    if (!a || !b) { add(divergences, 'trace', phase, a, b); continue; }
    add(divergences, 'trace', phase, a.phase, b.phase); add(divergences, 'dom', phase, a.dom, b.dom);
    add(divergences, 'callback', phase, a.callbacks, b.callbacks); add(divergences, 'identity', phase, a.identityViolations, b.identityViolations);
    add(divergences, 'focus', phase, { focus: a.focus, violations: a.focusViolations }, { focus: b.focus, violations: b.focusViolations });
  }
  return divergences.length ? { equal: false, divergences } : { equal: true, divergences: [] };
}
