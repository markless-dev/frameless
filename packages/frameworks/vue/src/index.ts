export { COMPILE_MODES, compileDiagnostics, emit, validateEnrichedIr } from './emitter/index.ts';
export { formatEmitted } from './format-emitted.ts';
export {
	BASELINE_FORM_INVENTORY,
	checkGeneratedFiles,
	checkSources,
	collectEmittedForms,
	discoverGeneratedFiles,
	VUE_ESLINT_RULES_APPLIED,
	VUE_ESLINT_RULES_OMITTED,
	VUE_ESLINT_TIERS_EXCLUDED,
	VUE_GATE_POLICIES,
} from './gate/index.ts';
export type {
	BaselineForm,
	BaselineFormKind,
	DossierRef,
	FloorEvidence,
	GatePolicy,
	GateResult,
	GateViolation,
	ObservedForm,
} from './gate/index.ts';
