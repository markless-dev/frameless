import { describe, expect, test } from 'vitest';
import { compareRuns, reactAdapter, runScenario, solidAdapter } from '../src/oracle';
import { mutants } from '../src/mutants';
import { reactReferences, solidReferences } from '../src/references';
import { calibrationScenarios, scenarioById } from '../src/scenarios';

describe('calibration: handwritten native references', () => {
  for (const scenario of calibrationScenarios) test(`${scenario.id}: React and Solid are equivalent`, async () => {
    const referenceId=scenario.id.split('/')[0];
    const react=await runScenario(reactAdapter(reactReferences[referenceId]),scenario);
    const solid=await runScenario(solidAdapter(solidReferences[referenceId]),scenario);
    expect(compareRuns(react,solid)).toEqual({equal:true,divergences:[]});
    expect(react.observations.map(x=>x.phase)).toEqual(solid.observations.map(x=>x.phase));
    const records=react.observations.at(-1)!.callbacks;
    for(const shape of scenario.expectedCallbacks){const matching=records.filter(x=>x.name===shape.name);expect(matching,shape.name).toHaveLength(shape.count);expect(Object.keys(matching[0].payload as object).sort()).toEqual([...shape.fields].sort());}
    if(referenceId==='S2-keyed-todo') for(const trace of [react,solid]) { expect(trace.observations.flatMap(x=>x.identityViolations)).toEqual([]); expect(trace.observations.flatMap(x=>x.focusViolations)).toEqual([]); }
  });
});

describe('sensitivity: each deliberate defect is rejected in its channel', () => {
  for (const mutant of mutants) test(`${mutant.id} -> ${mutant.channel}`,async()=>{
    const scenario=scenarioById[mutant.scenario];
    const clean=await runScenario(reactAdapter(reactReferences[mutant.scenario]),scenario);
    const broken=await runScenario(reactAdapter(mutant.component),scenario);
    const verdict=compareRuns(clean,broken);
    expect(verdict.equal).toBe(false);
    if(!verdict.equal) expect(verdict.divergences.some(d=>d.channel===mutant.channel),JSON.stringify(verdict.divergences,null,2)).toBe(true);
  });
});

test('determinism: repeated paired runs produce byte-identical verdicts',async()=>{
  const mutant=mutants.find(x=>x.id==='broken-key-identity')!;const scenario=scenarioById[mutant.scenario];
  const pair=async()=>compareRuns(await runScenario(reactAdapter(reactReferences[mutant.scenario]),scenario),await runScenario(reactAdapter(mutant.component),scenario));
  expect(JSON.stringify(await pair())).toBe(JSON.stringify(await pair()));
});
