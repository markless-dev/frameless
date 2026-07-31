# T009 — RULING: does angular's `imports` form enter `BASELINE_FORM_INVENTORY`?

> **THIS FILE WAS NOT WRITTEN BY THE JUDGE.** T009's own harness contract forbids
> it writing report `.md` files, so **its receipt on the board IS the ruling
> text**, and its last recorded blocker says so:
>
> > "THE JUDGE DID NOT WRITE notes/T009-angular-imports.md - its contract forbids
> > report .md files. The receipt IS the ruling text; the worker must land it
> > verbatim."
>
> Landed here **verbatim** by **T014**, the worker card that implemented the
> ruling. Every block below is copied character-for-character out of the T009
> receipt in `docs/goals/frameless-app-axes-v1/state.yaml`. **Nothing is
> paraphrased, reordered within a field, corrected or abridged.** The only text
> that is not T009's is this header, the field labels, and the clearly-marked
> "As-landed" section at the end.
>
> Source of truth: `tasks[] → id: T009 → receipt` in the board file. If this file
> and the board ever disagree, **the board wins**.

---

## Receipt header

- `result`: done
- `decision`: approved
- `full_outcome_complete`: false
- `harness`: claude-code
- `verification_attempts`: 1
- `stopped_because`: null

---

## summary

> ADMIT component-metadata:imports at floor 14.0, evidence unverified. ANGULAR_BASELINE_FLOOR IS 19.0 TODAY AND 19.0 AFTER - IT DOES NOT MOVE, and no scenario has a per-scenario floor to move. Deciding gate: GATE 6's VERSION COROLLARY. Three brief errors refuted, ONE LOAD-BEARING: Angular 22.0.8 PROVABLY IGNORES a self-entry in imports, so NO STATIC GATE CAN WITNESS THE RECURSION and the browser drive is mandatory.

## THE_LOAD_BEARING_BRIEF_ERROR

> ungated-scenarios.ts and T003's note both say the decorator 'MUST list its own selector's provider'. MEASURED against the demo's exact tsconfig plus strictTemplates: WITH imports 0 AOT diagnostics; WITHOUT imports 0 AOT diagnostics. The compiled defineComponent carries `dependencies: [HnItem]` IN BOTH ARMS; the ONLY delta in 289 lines of emitted JS is the imports line inside the dev-mode setClassMetadata block. MECHANISM read off the shipped bundle: StandaloneComponentScopeReader seeds `new Set([clazzMeta])` and `new Set([clazz])`, then `if (seen.has(ref.node)) continue;` SKIPS a self-entry. TWO-SIDED CONTROL: a sibling selector and an unknown element BOTH draw NG-998001; the SELF selector draws nothing, and a planted unknown member draws NG2339 so the instrument goes red. This does NOT flip the ruling - it is exactly WHY imports is the wider-range spelling and therefore the baseline - but it means THE AOT LANE CANNOT WITNESS THE RECURSION.

## THE_FLOOR_CLAIM_ON_MY_CARD_WAS_FALSE_TWICE_OVER

> I wrote that admitting imports 'MAY RAISE THE DERIVED ANGULAR_BASELINE_FLOOR FOR EVERY SCENARIO AT ONCE'. THE FLOOR IS A MAX REDUCE and imports floors BELOW the existing 19.0 entry - AND THERE IS NO PER-SCENARIO FLOOR IN THE REPO AT ALL. ANGULAR_BASELINE_FLOOR is ONE lane-wide derived constant with a single pin (component-metadata:(no standalone key)). Simulated at 14.0/15.0/19.0/20.0: only 19.0 and 20.0 go red, and for different reasons. All 14 shipped scenarios stay at 19.0 and S14 joins at 19.0.

## THE_FORM_ALREADY_SHIPS_AND_THE_GATE_NEVER_SEES_IT

> packages/frameworks/angular/generated-composition/M2-page.ts:7 and C1-slot.ts:14 ALREADY PRINT `imports: [...]`. They ship UNINVENTORIED because the gate corpus is `generated/` ONLY. Run by hand, generated-composition/ draws FIVE baseline-form-inventory violations across THREE uninventoried forms. SEPARATE CARD.

## THE_DECIDING_GATE

> The six-gate sugar procedure DOES NOT APPLY to the admission - imports is a BASELINE form by the policy's own text: worked example 5's stated baseline literally contains `imports: [NgIf, NgForOf]`. The sugar question that DOES exist is the OMIT form - lean on the compiler's implicit self-scope - and it FAILS GATE 6, the version corollary: the omit-form's floor cannot be established from anything this repo ships, and NO STANDING CHECK WOULD GO RED if upstream removed the self-seed, because an AOT compile is PROVABLY BLIND TO IT.

## rationale

> Measured, not read. Floor today 19.0 with the sole 19.0 entry identified; after-floor simulated at four candidate values with the two governing test rows checked each time. Gate on S14: EXACTLY ONE violation, ONE uninventoried form, CONTROL S13 clean. Typecheck: only the expected TS2307. AOT: zero. DEFECTS.md's ChangeDetectorRef and inject are the on-the-record precedent - both entered this inventory the same way for S8, both below 19.0, floor did not move.

## UNGATED_SCENARIOS_TS_MUST_BE_DELETED

> ANGULAR_UNGATED_SCENARIOS becomes EMPTY, and gate.test.ts asserts length > 0 - so an empty list GOES RED BY CONSTRUCTION, which is the tripwire that file's own doc comment promised. Delete it and unwind all four wirings (emitter, gate, parse-emitted, emitted-typecheck).

## evidence

> - BASELINE_FORM_INVENTORY 31 entries; ANGULAR_BASELINE_FLOOR is a MAX reduce. MEASURED floor = 19.0, sole 19.0 entry = component-metadata:(no standalone key)
> - Real emit + real checkSources on s14: 28 distinct forms, EXACTLY ONE uninventoried, EXACTLY ONE violation; CONTROL S13 = 0
> - typescript 5.9.3 at the lane's own emitted-typecheck options: exactly 1 diagnostic, TS2307. NO TS2449 - experimentalDecorators is what makes the self-reference legal
> - @angular/compiler-cli@22.0.8 performCompilation at the demo's exact tsconfig + strictTemplates: 0 diagnostics WITH imports and 0 WITHOUT; dependencies: [HnItem] in BOTH arms
> - MECHANISM: StandaloneComponentScopeReader seeds its own scope then `if (seen.has(ref.node)) continue;` skips a self-entry
> - CALIBRATED TWO-SIDED CONTROL: sibling selector and unknown element BOTH draw NG-998001; SELF draws nothing; planted unknown member draws NG2339
> - generated-composition/M2-page.ts:7 and C1-slot.ts:14 already print the form; gate run by hand there = 5 violations, 3 uninventoried forms
> - gate.test.ts: expects '19.0', expects the 19.0 tier to be exactly ['(no standalone key)'], and expects ANGULAR_UNGATED_SCENARIOS.length > 0
> - docs/emitter-idiom-policy.md worked example 5's stated BASELINE contains `imports: [NgIf, NgForOf]`
> - docs/DEFECTS.md: ChangeDetectorRef (2.0) and inject (14.0) entered the same way for S8, both below 19.0, floor did not move

## missing_evidence

> - NO BROWSER OBSERVATION EXISTS for angular S14. Every static layer is green AND PROVABLY BLIND: the AOT compile is BYTE-INDIFFERENT to imports: [HnItem]. Until demos/angular-official is driven at /hn-item, 'angular emits a CORRECT recursive component' IS A STATIC CLAIM, NOT A LANE VERDICT.
> - The version at which Angular's StandaloneComponentScopeReader began self-seeding is UNMEASURABLE in this repo. That UNKNOWN is exactly what makes imports the wider-range spelling - and why the omit-form FAILS Gate 6.

## remaining_blockers

> - SEPARATE CARD, NEWLY MEASURED: generated-composition/ IS NEVER GATE-CHECKED. Three committed artifacts carry three uninventoried forms drawing five violations when the gate is pointed at them by hand. Admitting imports here retires ONE of the three.
> - Three prose sites go stale the moment this lands and NONE IS DERIVED: angular/README.md ('No `imports`'), scripts/demo.mjs's ANGULAR_IMPORTS_REFUSAL block, and three demo App comments citing ungated-scenarios.ts.
> - notes/T003-hn-item.md records the 'moves the floor for every scenario' claim THIS RULING REFUTES; the board's own record should carry the correction.
> - THE JUDGE DID NOT WRITE notes/T009-angular-imports.md - its contract forbids report .md files. The receipt IS the ruling text; the worker must land it verbatim.

---

## As-landed (T014) — NOT part of the ruling

This section is **T014's**, not T009's, and is separated so nothing above is
contaminated. Full detail is in `notes/T014-angular-s14.md`.

**Every one of T009's checkable numbers was re-measured independently before the
edit and every one reproduced**: floor `19.0` with the 19.0 tier exactly
`['(no standalone key)']`, inventory 31 entries, S14 through the real emitter and
the real `checkSources` at **28 distinct forms / exactly 1 uninventoried
(`component-metadata:imports`) / exactly 1 violation**, control S13 at **0**.

Landed, in T009's own words where it specified an action:

| Ruling item | Landed as |
| --- | --- |
| ADMIT `component-metadata:imports`, floor `14.0`, evidence `unverified` | `BASELINE_FORM_INVENTORY` in `packages/frameworks/angular/src/gate/index.ts` — inventory 31 → 32 entries |
| `ANGULAR_BASELINE_FLOOR` does not move | measured `19.0` before and `19.0` after; 19.0 tier still exactly `['(no standalone key)']` |
| "Delete it and unwind all four wirings" | `test/ungated-scenarios.ts` **deleted** (not emptied); `gate.test.ts`, `emitter.test.ts`, `parse-emitted.test.ts`, `emitted-typecheck.test.ts` unwound; the `regenerate.ts` prose too |
| The three stale prose sites | `angular/README.md`, `scripts/demo.mjs` (`ANGULAR_IMPORTS_REFUSAL` removed), and the three demo App comments |
| `generated-composition/` | **NOT touched** — T015 owns it. This admission retires **one** of its three uninventoried forms |
| "the browser drive is mandatory" | run; **the ruling's own `missing_evidence` is discharged** — see `notes/T014-angular-s14.md` |

**T009's own correction to `notes/T003-hn-item.md` could not be applied**: that
file was outside T014's `allowed_files`. The correction is recorded in
`notes/T014-angular-s14.md` instead, and **the claim is repeated here so it is
findable from the ruling**: T003's note and the deleted `ungated-scenarios.ts`
both stated that the decorator **"must list its own selector's provider"**, and
**that is false at Angular 22.0.8** — the compile is byte-indifferent to the
self-entry.
