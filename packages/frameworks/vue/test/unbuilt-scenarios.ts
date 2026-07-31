/**
 * THE SCENARIOS THIS LANE CANNOT EMIT, AND THE ONLY PLACE THAT FACT IS DECLARED.
 *
 * Four suites in this package derive their `generated/` inventory INDEPENDENTLY
 * from `/^s(\d+)-[\w-]+\.json$/` over the compiler goldens - `emitter.test.ts`,
 * `gate.test.ts`, `compile-emitted.test.ts` and `emitted-smoke.browser.test.ts` -
 * and every one of them asserts the inventory EXACTLY, in both directions. That
 * is the property that makes a differently-named artifact impossible, and it is
 * worth keeping. It also means that a scenario the emitter REFUSES has to be
 * subtracted in four places at once, and a subtraction copied four times is a
 * subtraction that will drift.
 *
 * So it is declared ONCE, here, and the four suites import it. THE SHAPE IS
 * COPIED FROM `packages/frameworks/angular/test/unbuilt-scenarios.ts`, which is
 * the lane that reached this problem first (S11 and S12, on its global-identifier
 * ban); this is the SECOND and THIRD lane to need it, and the first for a
 * STRUCTURAL rather than an identifier-resolution limit.
 *
 * ---------------------------------------------------------------------------
 * WHY A SUBTRACTION AND NOT A FIXED EMITTER
 *
 * `frameless-app-axes-v1` T003 measured the RECURSION axis by building the
 * Hacker News item page, whose `HnItem` component NAMES ITSELF in its own
 * template. That is a `TemplateComponentReference` whose target module is
 * `self`, and this emitter refuses it by name: a `.vue` SFC declares exactly one
 * component.
 *
 * THIS IS NOT A VERDICT ON RECURSION IN THIS LANE, and the difference was
 * MEASURED rather than assumed. Spelled the way Vue spells recursion
 * NATIVELY - the module importing ITSELF under an alias - THIS EMITTER TAKES IT.
 * Three things then close that route instead, none of them in this package:
 *
 *   - `resolveModuleSet` throws `Component-reference cycle: src/comment.tsrx ->
 *     src/comment.tsrx`, so the linker the CLI runs rejects it;
 *   - the emitted import specifier is DERIVED from the `.tsrx` specifier, so a
 *     module built from `s14-hn-item.tsrx` would import `./s14-hn-item.vue`
 *     while the artifact on disk is `generated/S14.vue`;
 *   - un-aliased it never reaches either, because `import { Comment } from
 *     './comment.tsrx'` beside `export function Comment` is
 *     `Identifier 'Comment' has already been declared`.
 *
 * Two-module mutual reference (A -> B -> A) was measured too: ALL SIX emitters
 * emit both modules and the same linker refuses the pair. So S14 ships on the
 * same-module spelling, which react, solid, qwik and angular all take, and this
 * lane is left UNBUILT WITH A RECORDED REFUSAL - an outcome that board's oracle
 * names as legitimate.
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
 *     limit is lifted, this file is what tells you to delete the row);
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
	 * REAL module rather than off a probe.
	 */
	readonly refusalContains: string;
	/** Why this lane cannot express the scenario, in one sentence. */
	readonly reason: string;
};

export const VUE_UNBUILT_SCENARIOS: readonly UnbuiltScenario[] = [
	{
		golden: 's14-hn-item.json',
		emitted: 'S14.vue',
		refusalContains:
			'Vue emitter has no lowering for a same-module component reference (HnItem)',
		reason:
			"S14's `HnItem` names ITSELF in its own template, and a .vue SFC declares exactly one component. `refusalContains` stops before the trailing clause so the row does not go red if that clause is reworded. THE NATIVE VUE SPELLING - the module importing itself under an alias - IS ACCEPTED BY THIS EMITTER and refused by `resolveModuleSet` instead (`Component-reference cycle`), and would in any case import `./s14-hn-item.vue` while the artifact on disk is `generated/S14.vue`.",
	},
];

const UNBUILT_GOLDENS = new Set(VUE_UNBUILT_SCENARIOS.map((entry) => entry.golden));
const UNBUILT_EMITTED = new Set(VUE_UNBUILT_SCENARIOS.map((entry) => entry.emitted));

/** True for a compiler golden this lane refuses, keyed as it is named on disk. */
export function isUnbuiltGolden(golden: string): boolean {
	return UNBUILT_GOLDENS.has(golden);
}

/**
 * True for an emitted artifact name this lane never writes. Accepts a bare
 * `S14.vue`, a `generated/S14.vue`, or an absolute path, because the four
 * suites spell their inventories three different ways.
 */
export function isUnbuiltEmitted(file: string): boolean {
	return UNBUILT_EMITTED.has(file.slice(file.lastIndexOf('/') + 1));
}
