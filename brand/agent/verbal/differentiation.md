# Differentiation

> **Agents: the axis is proof.** Breadth is table stakes. What separates Frameless is whether
> the outputs are *verified* to behave the same.

## The one axis

**Everyone else optimizes for how many targets they hit. Frameless optimizes for whether the
targets provably behave the same.**

Frameless has the breadth too — that is what "output anywhere" means. Lead with the proof
anyway: breadth is a claim anyone can make, and your reader has heard it. Proof is the part
almost nobody can show.

---

## vs Mitosis

The nearest prior art, and the comparison that will be raised.

| | Mitosis | Frameless |
|---|---|---|
| Compilation | Syntax-to-syntax over a restricted JSX dialect | Semantic IR, emitted per target |
| Verification | String snapshots | Behavior, in a real browser |
| Is the checker itself tested? | No | Yes — mutation-tested |
| Activation models | Hydration-shaped | Hydration **and** resumption, verified equivalent |

### Why snapshot testing is the actual weakness

A string snapshot proves the compiler emitted *the same text as last time*. It cannot tell
you the output **works**. Two things this permitted in Mitosis, both documented in public:

- accepted Qwik snapshots containing **broken references**
- Angular output that was **sometimes behaviorally wrong**

Both would pass a snapshot suite. Both fail a browser. That is the entire argument for the
behavioral oracle — and it isn't theoretical, it's the observed failure mode of the closest
comparable tool.

### Approved comparison line

> Mitosis verifies with string snapshots — and shipped Qwik output with broken references
> and Angular output that was behaviorally wrong. Frameless checks behavior in a real
> browser, and mutation-tests the checker so a pass means something.

Do not sneer, and do not dwell. State it once, move to what Frameless does.

---

## vs writing framework-native code by hand

For a single target, hand-written wins. **Say so** — it costs nothing and buys credibility
for everything that follows.

The value appears at **two or more targets**, and compounds fast. Past that, the comparison
isn't "a compiler versus hand-written code" — it's "one component versus a set of codebases
drifting apart."

And there is exactly one thing here that hand-authoring cannot do at any price:

### Activation-neutrality

React, Vue, Svelte, Solid and Angular **hydrate**: the component tree is replayed on the
client to reattach behavior. Qwik **resumes**: nothing is replayed; execution picks up from
serialized state.

These are different architectures, not different syntax. A human porting a component to Qwik
is performing a rewrite against a different execution model — which is why such ports are
slow, and why LLM-generated ones tend to look right and activate wrong.

Frameless compiles one source to both and proves observable behavior matches. **No amount of
careful hand-authoring produces that guarantee**, because the guarantee is the verification,
not the code.

---

## vs LLM-generated per-framework ports

The comparison most teams will actually have in mind.

| | LLM port | Frameless |
|---|---|---|
| Determinism | Different output every run | Same input, same output |
| Verification | Human review, per file, per framework, per change | Automated behavioral diff |
| Silent behavior change | Very possible | Caught by the oracle |
| Review burden | Grows with targets × changes | Constant |

**The pitch is the oracle, not the codegen.** They already have codegen — it's in their
editor. What they don't have is a way to know it's right.

---

## vs web components

The honest alternative, and the one a thoughtful reader will raise.

> Web components give you one artifact that runs everywhere, at the cost of living slightly
> outside each framework's model — its own lifecycle, its own styling story, its own friction
> at the boundary. Frameless gives you *native* code per framework: real React components,
> real Svelte components. Different trade, honestly stated.

Do not claim web components are a mistake. Many teams chose them for good reasons. The
distinction is native output versus a universal artifact.

---

## vs Markless

Not a competitor. API-compatible, and a deliberate two-sided path.

> Write a component once. Run it on Markless, or compile it into your team's framework. Same
> component either way.

---

## What we never claim

- Better raw performance than hand-written framework code.
- That any framework is bad, obsolete, or should be abandoned.
- Identical *output*. Output is deliberately different per framework — that's the product.
- That one target justifies the tool. It doesn't, and admitting it is what makes the rest land.

## What we always claim

- Behavioral equivalence, verified in a real browser, on every build.
- Idiomatic output a framework's own developers would recognize.
- The only demonstrated path from one source across two different activation models.
- An oracle proven capable of failing.
- A public record of our own corrections.
