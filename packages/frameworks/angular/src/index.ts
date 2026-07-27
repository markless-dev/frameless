export {
	componentSelector,
	emit,
	templateDiagnostics,
	validateEnrichedIr,
} from './emitter/index.ts';
export { formatEmitted } from './format-emitted.ts';
export {
	ANGULAR_ARBITER_TOOLCHAIN,
	ANGULAR_BASELINE_FLOOR,
	ANGULAR_ESLINT_RULES_ADDED,
	ANGULAR_ESLINT_RULES_APPLIED,
	ANGULAR_ESLINT_RULES_OMITTED,
	ANGULAR_ESLINT_TEMPLATE_RULES_DERIVED,
	ANGULAR_ESLINT_TS_RULES_DERIVED,
	ANGULAR_GATE_POLICIES,
	BASELINE_FORM_INVENTORY,
	checkGeneratedFiles,
	checkSources,
	collectEmittedForms,
	discoverGeneratedFiles,
	WHY_THE_META_PACKAGE_IS_NOT_USED,
} from './gate/index.ts';
export type {
	AddedEslintRule,
	BaselineForm,
	BaselineFormKind,
	DossierRef,
	FloorEvidence,
	GatePolicy,
	GateResult,
	GateViolation,
	ObservedForm,
} from './gate/index.ts';
