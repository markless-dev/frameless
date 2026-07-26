# T006 — cold-agent transferability test

The second half of this goal's oracle. Half (1) proves the code change; this proves the *rule* is
usable by someone who was not in the room when it was written.

**Result: PASS.** The cold agent's verdict matched the PM's pre-registered derivation exactly,
including which gates were decisive. It also found two genuine defects in the policy, recorded at
the bottom.

---

## Protocol

Designed so a pass could not be manufactured after the fact:

1. **The PM derived the answer first** and wrote it to a scratchpad file *outside the repository*,
   before the agent was dispatched. Pre-registering it removes the option of reading the agent's
   answer and then deciding that was what the policy meant all along. The scoring bands — including
   a PARTIAL band for reaching the right verdict on the weakest grounds — were fixed in the same
   file, in advance.
2. **The agent received the policy and nothing else.** `docs/emitter-idiom-policy.md` was copied to
   an isolated scratch directory. The agent was instructed not to read any other file, not to open
   the repository, not to run `git`, and not to search the web. Its transcript shows exactly one
   tool call: reading that copied policy file.
3. **The expected answer existed nowhere it could reach.** T004 deliberately recorded no expected
   answer in any repo file, and T005's contamination guard kept `docs/emitter-idiom-policy.md` from
   naming Angular's `input()`, `output()`, `@Input()`, `@Output()`, `EventEmitter`, or the
   decorator-versus-signal choice in any form. Verified by a term-by-term scan before dispatch.
4. **The prompt did not signal a preferred answer.** It supplied the Angular facts neutrally,
   including facts pointing both ways, and told the agent that if it needed something the policy
   did not give it, that absence was itself something the policy explains how to handle.

## The held-out case (H3)

Angular's whole-component member-declaration form choice: decorator-based `@Input()`/`@Output()`
(Form A, valid Angular 2 → current) versus signal-based `input()`/`output()` (Form B, from
17.1/17.2, described by Angular's docs as recommended for new projects while the decorator form
remains fully supported).

T003 nominated it as the trap: it is **rhetorically identical** to the Qwik `$`-prop case — the
framework sanctions both spellings and prefers one — and **structurally a different granularity**.
An agent reciting the Qwik outcome, or reasoning from "the framework sanctions it and recommends
it", lands on *sugar*. Running the procedure does not.

The agent was also told, truthfully, that frameless has no Angular emitter, no Angular lockfile
entry, no Angular scaffold, and no target-framework-version field in `EnrichedIR`.

---

## PM pre-registration (written before dispatch)

Baseline = decorators (widest version range). Candidate sugar = the signal form.

| Gate | Pre-registered | Cold agent | Match |
|---|---|---|---|
| G1 sanctioned and measured | **FAIL** — no Angular in the lockfile, so evidence is necessarily documentary | **FAIL** — same reasoning | yes |
| G2 locality | PASS — parent binds identically either way | PASS — same | yes |
| G3 declared trigger | PASS — driven by declared IR facts, no content inspection | PASS — same | yes |
| G4 totality | PASS, with a caveat about `@Input()` setters the IR does not express | PASS "provisionally" | yes |
| G5 behavioral neutrality | **FAIL** — reactivity depth and throw behavior both differ | **FAIL** — cites both, verbatim against the gate's enumerated conditions | yes |
| G6 standing check | DEFERRED — no Angular lane; version corollary compounds it | DEFERRED — plus the version corollary, unprompted | yes |
| **Ruling** | **no-sugar**, denied rather than deferred | **no-sugar**, and explicitly *not* the "deferred, not denied" branch | yes |

Both derivations independently noted the same subtlety: because G1 and G5 are hard FAILs and not
merely a DEFERRED, this is **denied, not deferred** — it does not become sugar the moment an
Angular lane lands. G5 would still have to be answered.

The agent even flagged the same uncertainty the PM did, unprompted: whether G1 is properly `FAIL`
or `UNKNOWN` when the framework is absent from the repo entirely, correctly noting the policy
collapses both to the same ruling.

## Scoring

Against the bands fixed in advance:

- no-sugar on substantially G1 and/or G5 grounds → **PASS**
- no-sugar via G6/DEFERRED reasoning only → PARTIAL
- sugar → FAIL
- hedged or no clear verdict → FAIL

The agent ruled no-sugar, named **G5 as the strongest and least ambiguous failure** and G1 as an
independent one, and treated G6 as moot. That is the PASS band, on the strongest available grounds,
with no hedging.

**Oracle half (2): satisfied.**

---

## Two real defects the test found

A test that only ever confirms is not a test. These are genuine, and neither was visible to anyone
who already knew what the policy meant.

### Defect 1 — the policy's own worked examples score Gate 1 inconsistently

Worked example 5 (Angular `@if`/`@for`) records **G1 PASS**, and worked example 4 (two-way binding)
skips Gate 1 entirely — yet Angular has exactly the same lockfile-absence problem as the held-out
case, where the same gate was scored FAIL. Gate 1's FAIL conditions are written as though a
measurement was attempted against *some* build; they do not cover "no build of this framework
exists in this repo at all".

This matters beyond tidiness: the T007 expansion boards will each cite this policy, and Vue,
Angular and Svelte are *all* currently absent from the lockfile. Every sugar question those boards
raise hits this gap immediately.

### Defect 2 — Gate 4 is undefined for an emitter that does not exist yet

Gate 4 requires the domain to be stated "in terms of the emitter's own code — which function, which
construct". For a framework with no emitter, it is unstated whether that should be scored against a
hypothetical future domain, or marked `UNKNOWN` (which the procedure would convert to no-sugar, a
much stronger consequence than intended).

It did not change this ruling — G5 fails regardless — but it would be decisive for any future case
resting on Gate 4 for a not-yet-built emitter, which describes most of the expansion work.

Both defects are queued as a follow-up ruling rather than patched here. The gates are ratified;
amending them is a Judge decision, not a note-writer's.
