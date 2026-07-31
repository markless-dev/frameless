/**
 * THE SCENARIOS THIS LANE CANNOT EMIT, AND THE ONLY PLACE THAT FACT IS DECLARED.
 *
 * Four suites in this package derive their `generated/` inventory INDEPENDENTLY
 * from `/^s(\d+)-[\w-]+\.json$/` over the compiler goldens - `emitter.test.ts`,
 * `gate.test.ts`, `parse-emitted.test.ts` and `emitted-typecheck.test.ts` - and
 * every one of them asserts the inventory EXACTLY, in both directions. That is
 * the property that makes a differently-named artifact impossible, and it is
 * worth keeping. It also means that a scenario the emitter REFUSES has to be
 * subtracted in four places at once, and a subtraction copied four times is a
 * subtraction that will drift.
 *
 * So it is declared ONCE, here, and the four suites import it.
 *
 * ---------------------------------------------------------------------------
 * THE LIST IS EMPTY TODAY, AND THAT IS A RESULT RATHER THAN A DEFAULT.
 *
 * It carried exactly two rows for its whole life - S11 (TodoMVC ADVANCED) and
 * S12 (the CODEX CLONE) - subtracted on the Angular emitter's standing
 * global-identifier ban, which `frameless-app-suite-v1` T001 measured: every
 * `Identifier` in a TRANSPLANTED body had to resolve to lexical scope, a function
 * parameter, a `@for` variable, or a declared component member, and the emitter
 * THREW rather than guessing whether the name was a global. The artificial delay
 * this repo's owner accepted as a stand-in for a real remote is `new Promise` +
 * `setTimeout` created inside a handler, and neither name could be spelled here.
 *
 * The ban was NEVER an async limit, and that correction is worth keeping: it was
 * reproduced on `probes/async-door` PC, a FULLY SYNCHRONOUS control module, so
 * calling it one would have been the third false lane limit that probe run caught.
 *
 * `frameless-app-fidelity-v1` T003 ruled the hole closed with a TWO-NAME
 * ALLOWLIST - `Promise` and `setTimeout`, nothing else - and T007 landed it, so
 * both rows were deleted and this lane now emits all 17 scenarios.
 * `TRANSPLANTED_GLOBALS` in src/emitter/index.ts is where the two names live and
 * where the argument for keeping the list at two is recorded.
 *
 * AN EMPTY LIST IS A HAZARD, NOT A CLEAN SLATE. Four suites ITERATE this array,
 * and an empty iteration asserts nothing at all - so `emitter.test.ts` asserts the
 * emptiness EXACTLY, drives both formerly-refused goldens through the real
 * `emit()` and requires them to SUCCEED, and keeps a separate `Math` row as the
 * live negative control proving the fail-closed arm still fires. Read those three
 * together; no one of them carries the load alone.
 *
 * ---------------------------------------------------------------------------
 * THE SUBTRACTION IS ASSERTED, NOT ASSUMED - AND THAT IS THE WHOLE POINT.
 *
 * A list of "scenarios we do not emit" is, by itself, indistinguishable from a
 * skip list: it would silently swallow a lane that started refusing for a
 * completely different reason, or one that was never wired up at all. So
 * `emitter.test.ts` drives EVERY entry below through the real `emit()` and
 * asserts that it throws, and that the message it throws CONTAINS the recorded
 * `refusalContains`. Three things then go red rather than passing quietly:
 *
 *   - a scenario listed here that the emitter has started to EMIT (the day the
 *     ban is lifted, this file is what tells you to delete the row);
 *   - a scenario listed here that refuses for a DIFFERENT reason than recorded;
 *   - a scenario that refuses and is NOT listed here, which the four inventory
 *     assertions already catch from the other side.
 */
export type UnbuiltScenario = {
	/** The compiler golden the emitter refuses, as it is named on disk. */
	readonly golden: string;
	/** The artifact that would have been written, and is deliberately absent. */
	readonly emitted: string;
	/**
	 * A VERBATIM substring of the message `emit()` actually throws, read off the
	 * REAL module rather than off a probe. It is a substring rather than the whole
	 * message because the emitter appends the component's full declared-member
	 * list, which grows whenever the scenario grows a binding - and pinning that
	 * would make this row fail for a reason that has nothing to do with the ban.
	 */
	readonly refusalContains: string;
	/** Why this lane cannot express the scenario, in one sentence. */
	readonly reason: string;
};

/**
 * EMPTY, AND ASSERTED EMPTY. See the header: the two rows this list used to carry
 * were deleted by `frameless-app-fidelity-v1` T007 when the two-name globals
 * allowlist landed. The type, the helpers and the four consuming suites stay
 * exactly as they were, so the next refusal this lane records is a one-row edit
 * rather than a rebuild - which is the whole reason the mechanism is kept.
 */
export const ANGULAR_UNBUILT_SCENARIOS: readonly UnbuiltScenario[] = [];

/**
 * THE ROWS THAT WERE DELETED, AND THE GOLDENS THAT PROVE THE DELETION WAS EARNED.
 *
 * `emitter.test.ts` drives both of these through the real `emit()` and requires
 * them to SUCCEED. Without this the empty array above would be indistinguishable
 * from a list nobody ever populated, and the four inventory derivations would
 * agree with it in silence.
 */
export const ANGULAR_FORMERLY_UNBUILT: readonly { golden: string; emitted: string }[] = [
	{ golden: 's11-todomvc-advanced.json', emitted: 'S11.ts' },
	{ golden: 's12-codex-clone.json', emitted: 'S12.ts' },
];

const UNBUILT_GOLDENS = new Set(ANGULAR_UNBUILT_SCENARIOS.map((entry) => entry.golden));
const UNBUILT_EMITTED = new Set(ANGULAR_UNBUILT_SCENARIOS.map((entry) => entry.emitted));

/** True for a compiler golden this lane refuses, keyed as it is named on disk. */
export function isUnbuiltGolden(golden: string): boolean {
	return UNBUILT_GOLDENS.has(golden);
}

/**
 * True for an emitted artifact name this lane never writes. Accepts a bare
 * `S11.ts`, a `generated/S11.ts`, or an absolute path, because the four suites
 * spell their inventories three different ways.
 */
export function isUnbuiltEmitted(file: string): boolean {
	return UNBUILT_EMITTED.has(file.slice(file.lastIndexOf('/') + 1));
}
