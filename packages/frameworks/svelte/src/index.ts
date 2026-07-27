export { emit, SANCTIONED_SVELTE_IGNORE_CODES, validateEnrichedIr } from './emitter/index.ts';
export { formatEmitted } from './format-emitted.ts';
export {
	checkGeneratedFiles,
	checkSources,
	discoverGeneratedFiles,
	SVELTE_GATE_POLICIES,
} from './gate/index.ts';
export type { DossierRef, GatePolicy, GateResult, GateViolation } from './gate/index.ts';
