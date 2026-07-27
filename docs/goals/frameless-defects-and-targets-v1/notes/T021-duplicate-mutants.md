# T021/T023 — the three duplicate React mutation rows, and what the invariant found

T021 (Judge) adjudicated the three duplicated rows T018 left in place. T023
(Worker) executed the rewrites and converted T021's one inferred claim into
evidence. This note records the evidence and the **two collisions that block the
invariant**, which T021 did not rule on.

## 1. The rewrites — all three verified, all three landed

Probed by calling `checkSources` directly against each mutant and reading the
whole violation object, not just the policy id.

| Row | Mutant | Branch it draws | Observed |
| --- | --- | --- | --- |
| `forEach-hidden notify-per-write shared tear` | `countListeners.forEach((listener) => listener());` before `changed.add('count')` | `invokesListenerSet`'s `.forEach(cb)` arm, `custom-policies.ts:1133-1152`, incl. recursion into the callback | `R-SH3`, line 20 |
| `identifier-object computed-member setter` | `const updates = { run: setValue }; const key = 'run'; updates[key](1);` | identifier-object resolution `:199-204` **combined with** a `constantString`-folded computed key `:154-171` | `render-phase-setter`, line 6 |
| `default React import` | `import React, { useState }` | the `!imported` arm of the react import allowlist, `:284-294` | `react-import-allowlist`, line 1 |

### The check T021 could not run

T021 inferred the forEach routing from `writeCount` being an arrow in a
`VariableDeclarator` and flagged it as missing evidence. Run:

```
message: "Store writes must use Object.is and defer listener notification until method completion"
```

verbatim — `custom-policies.ts:1208`, the same message the existing for-of twin
produces. **The inference holds.** The row does exercise the forEach branch: it
is the only route to `invokes = true` for that mutant, since the arrow contains
no `ForOfStatement`, calls no tainted identifier, and `resolveCallable` cannot
resolve `countListeners.forEach` (its object's declarator initialiser is
`new Set()`, not an `ObjectExpression`).

A **negative control** confirms the recursion is what fires, not the mere
presence of `.forEach` on a listener set:
`countListeners.forEach((listener) => { void listener; })` produces `[]`.

With this row the R-SH3 notify family maps 1:1 onto the detector's four arms —
for-of, forEach, helper-forwarding, member-method helper.

## 2. Two collisions block the no-duplicate invariant

The invariant was written, run in-tree against all four real tables under the
**strictest** keying (bare mutant, plus name), calibrated four-sided against a
synthetic table, and then **withheld** — landing it green requires an act T023's
card forbids. Both **Solid** tables are clean under that strictest keying, and so
is React's composition table. React's `mutationCases` reports two collisions
after the three rewrites:

**(a) `dynamic computed-member setter` × 2 — a NAME collision with distinct
mutants.** `gate.test.ts:264` uses `({ [key]: setValue })[key](1)`;
`gate.test.ts:287` uses `({ run: setValue })[key](1)`; both with
`const key = items[0]`. Same name, same policy, distinct text. Because
`test.each(...)('rejects the %s bypass mutation')` makes the name the vitest
title, these are two identically titled verdicts and a red is unattributable.

T021 **named this pair** (`fourth_instance_of_the_recurring_pattern`) but ruled
only on the other three rows, and recorded in `missing_evidence` that both
probably fall to the same null-name fallback loop at `:212-216` — i.e. textually
distinct, **branch-identical**. That is unresolved, and resolving it is a
coverage decision:

- *Rename one* — forbidden by the card, and wrong on the merits: if the pair is
  branch-identical, renaming locks in the weakest option and hides a redundant
  row behind a distinct name, which is the very "copied and half-edited"
  mechanism T021 diagnosed.
- *Rewrite one's mutant* — the right shape of answer, but it is a fourth rewrite
  and needs a named target branch, which nobody has ruled.
- *Delete one* — rejected for the other three; needs its own ruling here.

**(b) `index key AST` / `index key plugin` — the same mutant asserted against
two different policies.** This is **deliberate and legitimate**: one bypass
shape, two independent detectors (`index-key` and
`eslint:react/no-array-index-key`), and dropping either loses a detector
assertion. It is a fire of the *instrument*, not a defect in the table.

The fix is in the key, not in an exemption: **key the mutant dimension on
(mutant, policy) as one composite.** That still catches every half-finished copy
— a copied row copies its policy too, and all three T018 duplicates were caught
by it — while a bare-mutant key would fire on a legitimate row and force the
suppression list T021 explicitly rejected. It also reconciles with T018's own
arithmetic: 47 rows, 44 distinct, exactly three duplicates. Under a bare-mutant
key T018 would have reported four.

That is a refinement of T021's "keyed on both name and mutant" and is recorded
here rather than applied unilaterally.

## 3. The invariant, ready to land once (a) is ruled

Module scope, beside the mutation constructors, in each corpus that has a table:

```ts
type TableRow = readonly [string, string, string, ...unknown[]];

function duplicateRows(table: readonly TableRow[]): {
	readonly names: readonly string[];
	readonly mutants: readonly string[];
} {
	const byName = new Map<string, string[]>();
	const byMutant = new Map<string, string[]>();
	for (const [name, source, policy] of table) {
		byName.set(name, [...(byName.get(name) ?? []), name]);
		const key = `${policy} ${source}`;
		byMutant.set(key, [...(byMutant.get(key) ?? []), name]);
	}
	const collisions = (index: Map<string, string[]>): string[] =>
		[...index.values()].filter((rows) => rows.length > 1).map((rows) => rows.join(' | '));
	return { names: collisions(byName), mutants: collisions(byMutant) };
}
```

Two tests: the assertion, and the calibration that proves it can fire.

```ts
test('no mutation row duplicates another row name or mutant', () => {
	expect(duplicateRows(mutationCases)).toEqual({ names: [], mutants: [] });
	expect(duplicateRows(compositionMutationCases)).toEqual({ names: [], mutants: [] });
});

// CALIBRATION - on a healthy table the assertion above is green forever, so the
// instrument must be proved against a known member. Four sides: the two it must
// catch, the clean control, and the same-mutant/different-policy pair it must
// deliberately NOT catch.
test('CALIBRATION: the duplicate-row invariant fires on a name and on a mutant collision', () => {
	const row = (name: string, source: string, policy: string) => [name, source, policy] as const;
	expect(duplicateRows([row('first', 'let a = 1;', 'p'), row('second', 'let b = 2;', 'p')]))
		.toEqual({ names: [], mutants: [] });
	expect(duplicateRows([row('first', 'let a = 1;', 'p'), row('first', 'let b = 2;', 'p')]))
		.toEqual({ names: ['first | first'], mutants: [] });
	expect(duplicateRows([row('first', 'let a = 1;', 'p'), row('second', 'let a = 1;', 'p')]))
		.toEqual({ names: [], mutants: ['first | second'] });
	expect(duplicateRows([row('first', 'let a = 1;', 'p'), row('second', 'let a = 1;', 'q')]))
		.toEqual({ names: [], mutants: [] });
});
```

All four calibration sides were run and observed to behave exactly as asserted.
Against the real tables, Solid's two and React's composition table are green
today; React's `mutationCases` is green on the mutant key and red on the name key
for collision (a).

## 4. What is landed and what is not

- **Landed:** the three rewrites, plus rule 5 in
  `T018-mutation-no-op-audit.md` §5 — the durable carrier that reaches Vue and
  Angular, since neither Svelte nor Qwik has a mutation table.
- **Not landed:** the invariant itself, on either corpus. It is ready and
  calibrated; it cannot be green on React's `mutationCases` until (a) is ruled.
