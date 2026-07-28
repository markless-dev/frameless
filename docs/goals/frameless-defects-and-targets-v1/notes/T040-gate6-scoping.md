# T040 — the tripwire measured, and Gate 6's preamble scoped to its behavioural arm

Documentation only. No gate predicate, no test assertion, no emitted output, no ruling. The Angular
emitter edit is comment-only and that was proven mechanically rather than asserted.

---

## 1. The tripwire, measured before anything was written about it

The dispatch claimed `packages/frameworks/angular/test/gate.test.ts` asserts the derived template
set equals the exact four names and that `prefer-signals` is absent, so a demotion of
`prefer-control-flow` or a promotion of `prefer-signals` goes red by name. **The claim holds.** It
was verified by reading the assertions and then by driving the two upstream moves it describes.

The two pinning rows are in `describe('third-party arbiter: @angular-eslint')`:

- `expect([...ANGULAR_ESLINT_TEMPLATE_RULES_DERIVED]).toEqual([...])` — an order-sensitive exact
  four: `banana-in-box`, `eqeqeq`, `no-negated-async`, `prefer-control-flow`.
- `for (const rule of [...]) expect(ANGULAR_ESLINT_RULES_APPLIED, rule).not.toContain(rule)` —
  `@angular-eslint/prefer-signals` is one of the four names in that loop, and the loop passes the
  rule name as the assertion label, so the failure names it.

**One precision correction to the dispatch text, in the safe direction.** The `prefer-signals`
absence is asserted against `ANGULAR_ESLINT_RULES_APPLIED` — the union of both derived sets plus the
one recorded addition — not against the template set. That is the correct set to assert it on: a
promotion of `prefer-signals` would land in the *TypeScript* derived set, which the template set
would never see. The prose written into the three sites states the sets as measured.

### The derivation is live, so the tier move actually propagates

`packages/frameworks/angular/src/gate/index.ts:110-131` derives both sets by filtering the installed
plugins' own `meta.docs.recommended === 'recommended'` at module-evaluation time. A pinned literal
would have made the assertions self-satisfying; this one reads upstream.

### Measured, not inferred

Each plugin's rule metadata was mutated **in memory** before the gate module was evaluated, and the
derived sets read back. No repo file was touched and no assertion was edited.

| probe | template derived | TS derived | applied | `prefer-signals` applied? | `prefer-control-flow` applied? |
| --- | --- | --- | --- | --- | --- |
| baseline | 4 (exact names) | 12 | 17 | no | yes |
| `prefer-control-flow` demoted out of `recommended` | **3** | 12 | **16** | no | **no** |
| `prefer-signals` promoted into `recommended` | 4 | **13** | **18** | **yes** | yes |

Every cell in bold contradicts a pinned assertion. **The tripwire is in fact broader than the
dispatch described** — seven rows fail, not two:

1. the exact-four `toEqual` (demotion)
2. `not.toContain('@angular-eslint/prefer-signals')` (promotion)
3. the TS derived-set `toEqual` list of twelve (promotion)
4. `expect(ANGULAR_ESLINT_RULES_APPLIED).toHaveLength(17)` (both directions)
5. `expect(ANGULAR_ESLINT_TS_RULES_DERIVED).toHaveLength(12)` (promotion)
6. `expect(ANGULAR_ESLINT_TEMPLATE_RULES_DERIVED).toHaveLength(4)` (demotion)
7. the baseline-floor row asserting `prefer-control-flow` is applied, and the `*ngFor` mutation row
   expecting it to report (demotion)

**Residual risk, stated so the correction does not overshoot in the other direction.** A tripwire
fires when the lockfile moves. It says nothing about an upstream release nobody has installed, and
it is a *detection*, not a defence: it converts a silent dissolution of Gate 6's deciding measurement
into a red test that forces the re-run. That is the whole claim being made for it.

---

## 2. The dispatch said three sites carried the unmitigated wording. Two did.

Measured across the three named files:

- `docs/goals/frameless-angular-v1/notes/T009-control-flow.md` §7 — **carried it.** "That is the
  single most fragile input in this ruling and it is named here so it is not discovered by accident."
- the `renderBranch` decision-site comment in `packages/frameworks/angular/src/emitter/index.ts` —
  **carried it.** "If it moves to `all`, the deciding gate loses its PASS and worked example 5 must
  be re-run. That is the single most fragile input in this ruling."
- worked example 5 in `docs/emitter-idiom-policy.md` — **did not carry it, in any form.** The entry
  carries the Gate 6 *derivation* (applied set derived from `meta.docs.recommended`,
  `prefer-control-flow` 1 of 4 of 41) but states no dependency and no re-open trigger. `fragile`,
  `loses its`, `out of recommended` and `re-open` all return nothing anywhere in that entry.

This also **falsifies a claim in `T009-control-flow.md` §8**, which records that T011 put the two
carry-forwards at "three sites — this note, worked example 5, and the `renderBranch` comment". Only
§6's text was folded into the policy verbatim; §7, which is where the re-open trigger lives, was
not. So the third site was never created.

**Handling.** The two sites that carried the false wording were rewritten. The third site was
*created*, saying the tripwired version — that is what the task's own purpose requires (an auditor
should meet the correct statement wherever they enter), and leaving example 5 silent would have left
§8's claim false in the opposite direction. §8's sentence is left standing as the record of what
T011 believed it had done, with the correction recorded in the new §9 rather than by rewriting it.

---

## 3. Gate 6's preamble, scoped to the behavioural arm

The contradiction, stated exactly:

> The check must exercise the target lane — the framework's own official scaffold — at the exact
> framework version in the lockfile, and assert observable behavior.
>
> - `PASS` — such a check exists, **or the sugar's claimed benefit is itself asserted by one.**

Read as governing both arms, the second arm is unreachable: a benefit that is not behavioural cannot
be asserted by a check that asserts observable behaviour. And Gate 5 *routes* non-behavioural
reasons here explicitly — they "may be the reason to adopt a sugar, and as such they are adjudicated
by Gate 6, which requires them to be measured" — so the undivided reading leaves that routing with
nowhere to land.

The preamble now splits the `PASS` into a **behavioural arm**, which keeps the lane-and-version-and-
behaviour requirement whole, and a **claimed-benefit arm**, which does not carry it.

**This is a scoping and not a relaxation.** Nothing that fails Gate 6 today passes under the new
text. The claimed-benefit arm's substance is unchanged — it is the existing clause, verbatim — and
three conditions that were already latent in the surrounding text are now written down, all of which
*tighten* rather than loosen:

- the asserting check must be **standing**, not a one-off probe (worked example 10 already draws
  exactly this distinction against its own G1 probe);
- it must be **calibrated red**, since a check that cannot fail is not a check;
- it must run against a toolchain this repo ships (this was already the `FAIL` clause, restated on
  the arm it governs);
- and an entry carried by this arm must **state what behavioural coverage it lacks**, so the `PASS`
  is never read as a behavioural proof.

**Both entries that turn on the arm already satisfy all four**, which is why nothing is re-scored:

- **worked example 10** (Qwik forced lowering, shipped): three standing checks each shipping a case
  that watches the refusal fire, mutant-calibrated, and a paragraph headed "What G6 does NOT yet
  cover" saying outright that no behavioural three-way scenario exists.
- **worked example 5** (Angular `@if`/`@for`): a third-party-authored standing arbiter, calibrated
  by a planted `([ngModel])` drawing `banana-in-box`, with the negative result stated in the entry —
  `pnpm e2e` would not go red on a competent switch to the baseline.

**Neither verdict was revisited.** Per `frameless-angular-v1` T999, example 5's reading holds on
example 10's precedent, and example 5's evidence is the stronger of the two because its arbiter is
third-party-derived rather than frameless-authored. This task scoped a preamble; it did not re-score
a gate.

---

## 4. What was changed, and what was deliberately not

Changed:

- `docs/emitter-idiom-policy.md` — Gate 6 preamble split into the two arms; worked example 5's G6
  bullet gains the tripwire statement and names the test; example 5's contestable-reading paragraph
  records the contest as settled by the scoping rather than left open; example 10's existing
  disclosure paragraph names the arm it is the precedent for.
- `docs/goals/frameless-angular-v1/notes/T009-control-flow.md` — §7's re-open trigger rewritten as
  tripwired with the measurement recorded; new §9 addendum carrying both corrections.
- `packages/frameworks/angular/src/emitter/index.ts` — the `renderBranch` decision-site comment's
  two "must not rediscover as a surprise" items, both now closed. **Comment-only, proven
  mechanically**: the added-lines diff filtered of comment and blank lines is empty, and
  `scripts/regenerate.ts` run twice moves no byte of `packages/frameworks/angular/generated`.

Deliberately not changed:

- **`gate.test.ts` and the gate predicates.** The tripwire already exists; that is the entire point
  of part 1. Not one assertion moved.
- **Any gate outcome, ruling or verdict**, in either worked example.
- **`T009-control-flow.md` §6**, which is the as-folded record of the text that went into the policy.
  The policy document is the live copy; §6 is history and rewriting it would misrepresent what T011
  actually folded. The divergence is recorded in §9 rather than papered over.
- **§8's "three sites" sentence**, left standing with its correction recorded in §9, for the same
  reason.
