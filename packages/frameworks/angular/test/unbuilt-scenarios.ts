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
 * WHY A SUBTRACTION AND NOT A FIXED EMITTER
 *
 * `frameless-app-suite-v1` T001 measured the Angular emitter's standing
 * global-identifier ban: every `Identifier` in a TRANSPLANTED body must resolve
 * to lexical scope, a function parameter, a `@for` variable, or a declared
 * component member, and the emitter THROWS rather than guessing whether the name
 * is a global. `Promise`, `setTimeout`, `fetch`, `Date` and `JSON` are all
 * globals. That was measured on `probes/async-door` PC, a FULLY SYNCHRONOUS
 * control module - so the ban is NOT an async limit, and calling it one would be
 * the third false lane limit that probe run caught.
 *
 * S11 (TodoMVC ADVANCED) is the first corpus scenario the ban actually reaches,
 * because the artificial delay this repo's owner accepted as a stand-in for a
 * real remote is `new Promise` + `setTimeout` created inside a handler.
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

export const ANGULAR_UNBUILT_SCENARIOS: readonly UnbuiltScenario[] = [
	{
		golden: 's11-todomvc-advanced.json',
		emitted: 'S11.ts',
		refusalContains:
			'Angular emitter cannot resolve the identifier "Promise" in a transplanted body',
		reason:
			"S11's remote query and optimistic revert both create their own promise with `new Promise` + `setTimeout`, and this lane cannot NAME a global inside a transplanted body. Measured on a fully synchronous control (probes/async-door PC), so it is a global-identifier ban and not an async limit.",
	},
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
