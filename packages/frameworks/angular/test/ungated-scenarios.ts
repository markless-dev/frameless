/**
 * THE SCENARIOS THIS LANE **EMITS** AND THEN **REFUSES AT ITS OWN GATE**, AND
 * THE ONLY PLACE THAT FACT IS DECLARED.
 *
 * This is a SECOND kind of absence, and it is deliberately NOT folded into
 * `./unbuilt-scenarios.ts`. That file's whole contract is that `emit()` THROWS -
 * `emitter.test.ts` drives every row through the real emitter and asserts the
 * throw. A scenario listed here is the opposite shape: **the emitter succeeds**,
 * produces a module this lane would be happy to ship, and the DOSSIER GATE then
 * rejects the emitted source. Putting it in the unbuilt list would make that
 * suite assert a throw that does not happen, and softening the unbuilt contract
 * to "either throws or is rejected" would let a genuine emitter regression hide
 * behind a gate diagnostic. Two lists, two assertions, no overlap.
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS MEASURED, AND WHY IT IS NOT A CODE EDIT
 *
 * `frameless-app-axes-v1` T003 measured the RECURSION axis by building the
 * Hacker News item page, whose `HnItem` component NAMES ITSELF in its own
 * template. THIS LANE LOWERS THAT: a same-module component reference emits a
 * correct recursive Angular component, `<frameless-hn-item>` inside its own
 * template, with `imports: [HnItem]` in the decorator so the selector resolves.
 * Only four of the six lanes get that far - svelte and vue refuse a same-module
 * component reference outright, because their file formats hold exactly one
 * component each.
 *
 * The `imports` entry is what the gate rejects, and S14 is the FIRST scenario in
 * the corpus with a component reference at all, so it is the first emitted
 * module in this lane ever to print the form. `BASELINE_FORM_INVENTORY` in
 * `../src/gate/index.ts` is an explicit allowlist - IR-4 is DEFERRED, so the
 * allowlist is this emitter's only discharge of the version corollary's second
 * conjunct - and it carries no component-metadata `imports`.
 *
 * ADMITTING IT IS A DOSSIER RULING, NOT A CODE EDIT. A new entry needs a version
 * FLOOR and an honest floor-EVIDENCE status, and `imports` on `@Component`
 * arrives with standalone components well above several existing entries' `2.0`
 * floors, so it would move the DERIVED `ANGULAR_BASELINE_FLOOR` for every
 * scenario in the lane at once. The card that measured this had the gate source
 * outside its write scope by construction, which is the correct place for that
 * decision to stop.
 *
 * ---------------------------------------------------------------------------
 * THE DECLARATION IS ASSERTED FROM BOTH SIDES, AND THE ASSERTION IS STRONGER
 * THAN THE UNBUILT LIST'S.
 *
 * `gate.test.ts` drives every row below through the REAL `emit()` and the REAL
 * `checkSources`, and asserts BOTH halves: that the emit SUCCEEDS, and that the
 * gate then reports exactly the recorded policy and message. Four things go red
 * rather than passing quietly:
 *
 *   - the day the emitter starts REFUSING the scenario (then it belongs in
 *     `./unbuilt-scenarios.ts` instead, and the shape of the fix is different);
 *   - the day the gate ACCEPTS it (then the inventory ruling has been made, and
 *     this row is what tells you to delete it and add the regenerate row back);
 *   - the day it is rejected by a DIFFERENT policy than recorded;
 *   - a scenario that is gate-rejected and NOT listed here, which the four
 *     inventory assertions already catch from the other side.
 */
export type UngatedScenario = {
	/** The compiler golden this lane emits and then refuses to ship. */
	readonly golden: string;
	/** The artifact that would have been written, and is deliberately absent. */
	readonly emitted: string;
	/** The gate policy that rejects the emitted source. */
	readonly policy: string;
	/**
	 * A VERBATIM substring of the diagnostic the gate actually reports, read off
	 * the REAL emitted module rather than off a probe. It is a substring because
	 * the message goes on to describe the remedy, and pinning that would make this
	 * row fail for a rewording rather than for a behaviour change.
	 */
	readonly messageContains: string;
	/** Why the emitted module carries the rejected form, in one sentence. */
	readonly reason: string;
};

export const ANGULAR_UNGATED_SCENARIOS: readonly UngatedScenario[] = [
	{
		golden: 's14-hn-item.json',
		emitted: 'S14.ts',
		policy: 'baseline-form-inventory',
		messageContains:
			'Emitted Angular source uses the component-metadata form "imports", which is not in the baseline form inventory',
		reason:
			"S14's `HnItem` names ITSELF in its own template. This emitter lowers that to a recursive standalone component whose decorator must list its own selector's provider - `imports: [HnItem]` - and `imports` is the first component-metadata form the corpus has ever reached, because S14 is the first scenario with a component reference at all. The emitter is not at fault and neither is the gate; admitting the form needs a version floor and floor evidence, which would move the derived ANGULAR_BASELINE_FLOOR.",
	},
];

const UNGATED_EMITTED = new Set(ANGULAR_UNGATED_SCENARIOS.map((entry) => entry.emitted));
const UNGATED_GOLDENS = new Set(ANGULAR_UNGATED_SCENARIOS.map((entry) => entry.golden));

/** True for a compiler golden this lane emits but will not ship. */
export function isUngatedGolden(golden: string): boolean {
	return UNGATED_GOLDENS.has(golden);
}

/**
 * True for an emitted artifact name this lane never writes because its own gate
 * rejects it. Accepts a bare `S14.ts`, a `generated/S14.ts`, or an absolute
 * path, because the four suites spell their inventories three different ways.
 */
export function isUngatedEmitted(file: string): boolean {
	return UNGATED_EMITTED.has(file.slice(file.lastIndexOf('/') + 1));
}
