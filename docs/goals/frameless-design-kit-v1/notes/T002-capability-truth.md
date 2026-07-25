# T002 — What Frameless can honestly claim

Scout receipt, condensed to what the kit must obey. Full citations in the task receipt.

## The headline collision

**The concept art is itself an overclaim.** It shows six framework badges — React, Vue,
Svelte, Solid, Angular, Qwik — under the line "Compile once, output anywhere."

Three of those six have **zero lines of implementation**. The only reference to Vue in the
entire repo is a CLI test asserting that Vue is *rejected*:

```text
packages/cli/test/program.test.ts:125
  'Unknown target vue (known: react, solid)'
```

This is the single most consequential finding on the board. The brand's hero image encodes
the #1 entry on the false-claims list. If the kit ships as-is, every downstream generation
inherits a six-framework promise the compiler cannot keep. Requires an owner ruling —
see OWNER DECISION 1 below.

## Capability map

| Capability | Status |
|---|---|
| `.tsrx` authoring → semantic IR (not syntax-to-syntax) | **PROVEN** |
| React 19 emitter — CLI target, composition, persistence, SSR | **PROVEN** |
| Solid emitter — CLI target, composition, persistence, SSR | **PROVEN** |
| Qwik emitter | **PROVEN BUT NARROW** — S1/S2/S3 only |
| Activation-neutrality: React/Solid hydrate, Qwik resumes, identical behavior | **PROVEN on official scaffolds** |
| Three-way behavioral equality, machine-diffed across 9 cells | **PROVEN** |
| Mutation-validated equivalence oracle | **PROVEN** |
| Vue, Svelte, Angular | **ASPIRATIONAL — zero code** |
| Shared state across files, named slots | **ASPIRATIONAL** |
| Accessibility, performance | **ASPIRATIONAL — explicitly unproven** |

Qwik's narrowness matters and must not be smoothed over: it is **not a CLI target**, has no
composition output, no persistence output, and no SSR witness lane. React and Solid are the
product path. Qwik is a proven emitter without product plumbing, on a beta dependency.

## Claims the kit may never make

1. "Six frameworks" / naming Vue, Svelte, or Angular as targets.
2. "Compile to any framework" — currently the README's own banner. Means "any of three."
3. "Three first-class targets" — Qwik is not CLI-plumbed. Not first-class yet.
4. "SSR proven across React, Solid and Qwik" — Qwik has no SSR lane.
5. "Composition works everywhere" — React/Solid only.
6. "Persistence works everywhere" — React/Solid only.
7. "Production ready" / "1.0" / "battle-tested" — everything is `0.0.0`, `private: true`,
   unpublished, on an unmerged branch, Qwik on `2.0.0-beta.38`.
8. "Zero runtime" — the honest claim is *no Frameless runtime shim*. Output still depends
   fully on the framework runtimes.
9. "Proven equivalent for any component" — proven for scripted scenarios only.
10. "Production builds verified" — curl-verified, never browser-verified.
11. "Beats Mitosis on breadth" — Mitosis has more targets and the README says so.
12. "Accessible / fast by construction" — explicitly unproven.

## What is genuinely defensible — the real story

The differentiator is **not breadth**. It is **proof method**, and one unique capability:

- **Activation-neutrality.** One source hydrates in React and Solid and *resumes* in Qwik,
  with identical observed behavior, verified on three untouched official scaffolds.
  Hydration and resumability are architecturally different activation models — a human
  port to Qwik is a rewrite, not a translation. No hand-written port gives you this.
- **A behavioral oracle that can fail.** Frameless verifies behavior in a real browser and
  mutation-tests its own oracle. The project's standard: *"an oracle that cannot fail is
  not evidence."* Mitosis verifies string snapshots — and shipped Qwik snapshots containing
  broken references, and Angular output that was sometimes behaviorally wrong. That is
  precisely the failure class a behavioral oracle catches.
- **A published failure trail.** The project's own audits caught and recorded its mistakes:
  a self-inflicted broken Qwik harness that produced a wrong "blocked" verdict, and a
  fresh-clone gap masked by an rsync audit. That trail under `docs/goals/` is an asset, not
  an embarrassment. The voice should be confident enough to keep it.

## Audience

1. Design-system / component-library authors shipping 3+ targets. *Labeled a strategic
   bet, not proven.* Respect the counter-evidence: this budget largely went to web
   components (Lit ~6.2M/wk vs Mitosis ~7.6k/wk).
2. Teams evaluating Qwik's resumability without committing to a rewrite. Strongest
   evidence-backed pitch.
3. Teams burned by AI-generated per-framework ports. The pitch is the oracle, not codegen.
4. Markless adopters — API-compatible, two-sided funnel.
5. Eject-anxious teams — output is real idiomatic code; start from it and leave.

## The one-sentence truth

> Frameless compiles one `.tsrx` component into idiomatic React 19, Solid, and Qwik code —
> and proves the three behave identically in a real browser, including across two different
> activation models — with React and Solid as the complete product path and Qwik proven
> today on three scenarios.

## OWNER DECISIONS

**OWNER DECISION 1 — the six badges.** The concept art promises six frameworks; three
exist. Options: (a) kit ships three badges only; (b) kit ships six badges with an explicit
shipped/planned state axis, so "planned" is visually unmistakable; (c) keep six unqualified
and accept the overclaim. Recommendation: **(b)** — it preserves the concept art's visual
richness, and turns the problem into a *system feature* by making the framework badge a
stateful component. Option (c) would poison every downstream generation.

**OWNER DECISION 2 — maturity label.** "Proven early-stage" vs "alpha" vs "research
preview". Evidence supports unusually strong verification rigor alongside zero published
packages. Recommendation: lead with the rigor, label the maturity honestly.

**OWNER DECISION 3 — two live README overclaims.** `README.md:197-198` (SSR "CLI-emitted
… Qwik") and `README.md:238` (unqualified Composition row) are both false, and the second
was already flagged by the project's own judge and never corrected. The kit will amplify
whatever it inherits. Recommend correcting them — but that is a write outside this goal's
scope, so it needs owner sign-off.
