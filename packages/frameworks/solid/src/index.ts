export { createSolidAdapter } from './adapter.ts';
export { emit, validateEnrichedIr } from './emitter/index.ts';
export { formatEmitted } from './format-emitted.ts';
export {
	checkGeneratedFiles,
	checkSources,
	discoverGeneratedFiles,
	SOLID_GATE_POLICIES,
} from './gate/index.ts';
export type { DossierRef, GatePolicy, GateResult, GateViolation } from './gate/index.ts';
