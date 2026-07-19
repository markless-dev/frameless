import type { Divergence, Observation, RunTrace, Verdict } from './types';

function canonical(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map(v => canonical(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'nodeId' && k !== 'rows' && (key !== 'focus' || k !== 'nodeId')).map(([k,v]) => [k, canonical(v, k)]));
  return value;
}
function firstDiff(a: any, b: any, path = '$'): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null) return path;
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) return `${path}.length`; for (let i=0;i<a.length;i++) { const d=firstDiff(a[i],b[i],`${path}[${i}]`); if(d)return d; } return null; }
  if (typeof a === 'object') { const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].sort(); for(const k of keys){const d=firstDiff(a[k],b[k],`${path}.${k}`);if(d)return d;} return null; }
  return path;
}
function add(divs: Divergence[], channel: Divergence['channel'], phase: string, a: unknown, b: unknown) { const ca=canonical(a), cb=canonical(b); const path=firstDiff(ca,cb); if(path) divs.push({channel,phase,path,left:ca,right:cb}); }
export function compareRuns(left: RunTrace, right: RunTrace): Verdict {
  const divergences: Divergence[] = [];
  if (left.scenario !== right.scenario) add(divergences,'trace','run',left.scenario,right.scenario);
  const count=Math.max(left.observations.length,right.observations.length);
  for(let i=0;i<count;i++){
    const a=left.observations[i], b=right.observations[i], phase=a?.phase ?? b?.phase ?? `#${i}`;
    if(!a||!b){add(divergences,'trace',phase,a,b);continue;}
    add(divergences,'trace',phase,a.phase,b.phase); add(divergences,'dom',phase,a.dom,b.dom);
    add(divergences,'callback',phase,a.callbacks,b.callbacks); add(divergences,'identity',phase,a.identityViolations,b.identityViolations);
    add(divergences,'focus',phase,{focus:a.focus,violations:a.focusViolations},{focus:b.focus,violations:b.focusViolations});
  }
  return divergences.length ? { equal:false, divergences } : { equal:true, divergences:[] };
}
