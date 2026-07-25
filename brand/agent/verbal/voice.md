# Voice

> **Agents: this file is a pattern library, not a mood board.** Every rule below has a WRONG
> and a RIGHT written in actual Frameless copy. Match the patterns. If you find yourself
> writing an adjective about the product, you have drifted.

## The voice in one line

**A careful engineer who has done the work, is quietly certain, and refuses to overstate by
even one word.**

Not a marketer. Not a hype account. Not falsely modest either — the work is genuinely good
and the voice knows it.

## The load-bearing trait: precision as personality

Most dev-tool brands treat accuracy as a legal constraint on marketing. Frameless treats
accuracy as *the aesthetic*. The pleasure of this voice is watching someone refuse to round
up when they easily could.

This is why the brand says "no Frameless runtime" instead of "zero runtime" — the output still
needs the framework's own runtime, and an engineer will notice. Precision where it costs
something is what confidence actually looks like.

---

## Rules, with examples

### 1. Say the promise plainly. Never count.

**WRONG:** "Ship six." / "One source. Six outputs." / "Six targets, all verified."
**RIGHT:** "Compile once, output anywhere."

Counting turns a promise into an inventory and makes it sound conditional. The headline is
fixed — see `messaging.md`. Name individual frameworks where a reader needs to find their own;
never as a total.

### 2. Show the receipt

Claims arrive with their evidence attached, or they don't arrive.

**WRONG:** "Rigorously tested for correctness."
**RIGHT:** "Behavior diffed across every target, in a real browser, on every build."

**WRONG:** "Our equivalence checking is thorough."
**RIGHT:** "We mutation-test the checker. An oracle that cannot fail is not evidence."

### 3. Verbs over adjectives

The product does things. Say what it does.

**WRONG:** "A powerful, modern, blazing-fast compiler."
**RIGHT:** "It compiles one file. It emits framework-native code. It proves they match."

Banned outright: *blazing-fast, powerful, seamless, effortless, revolutionary,
game-changing, next-generation, cutting-edge, robust, world-class, magical.*

### 4. Short sentences carry the weight

Vary length, but land the important idea short.

**RIGHT:** "Most frameworks hydrate. Qwik resumes. Same source. Same behavior. Proven."

### 5. Precision about what is and isn't identical

This distinction is the product, and getting it wrong makes engineers stop reading.

**WRONG:** "Identical output across every framework."
**RIGHT:** "Different output for every framework. Identical behavior. That's the point."

### 6. Own the corrections out loud

**WRONG:** *(silence about past mistakes)*
**RIGHT:** "We once shipped a broken test harness and it told us Qwik didn't work. It did.
The harness was wrong. That's in the log."

Why: for a correctness tool this is the single most credible thing available. A project that
publishes its wrong verdicts is telling you its right ones mean something.

### 7. Dry humor, never zany

The brand is nature stickers and a lighthouse — warm and a little playful. The humor is
understatement, not jokes.

**WRONG:** "Frameworks hate this one weird trick!"
**RIGHT:** "Write once, run anywhere has been promised since 1995. This time there's a test suite."

### 8. Second person, present tense

**WRONG:** "Developers can leverage Frameless to enable multi-framework workflows."
**RIGHT:** "You write one component. You ship it anywhere."

### 9. Never bury the reader in the compiler

Explain what it means for them before how it works.

**WRONG:** "Frameless lowers `.tsrx` to a semantic IR and emits per-target."
**RIGHT:** "You maintain one component instead of six. It compiles to a semantic
representation first, so each framework gets idiomatic code rather than a translation."

### 10. Concede the case where the tool isn't the answer

**RIGHT:** "Shipping to one framework? Write the framework code."

Conceding the weak case is what makes the strong case believable. Never argue that everyone
needs this.

---

## Words

**Use:** compile, emit, prove, verify, resume, hydrate, idiomatic, ejectable, behavior,
evidence, receipt, source, target, activation.

**Avoid:** solution, leverage, empower, unlock, streamline, ecosystem *(as a buzzword)*,
best-in-class, enterprise-grade, holistic, synergy.

**Careful with:** *"just"* (minimizes real work), *"simply"* (condescending when it isn't simple).

## Sentence shapes that work

- **Claim → evidence:** "Qwik resumes. Verified on official Qwik tooling."
- **Contrast pair:** "Most frameworks hydrate. Qwik resumes."
- **The useful distinction:** "Different output everywhere. One verified behavior."
- **Plain statement of stakes:** "If the outputs don't behave the same, the tool is worthless."

## Tone by surface

| Surface | Tone |
|---|---|
| Hero headline | Short, declarative, concrete. No abstractions. |
| Subhead | Where the specifics live. Precise, unhurried. |
| Feature copy | Verb-led. One claim, one receipt. |
| Docs | Warmest and plainest. Assume intelligence, not context. |
| Error messages | Say what happened, why, what to do. No apology, no cuteness. |
| Studio "coming soon" | Genuinely unhurried. Never fake urgency, never collect an email with a countdown. |

## The test

Read it aloud. If any sentence would embarrass you in front of an engineer who had just read
the source code and knew exactly what it does — cut it.

That reader is the brand's imagined audience. Write to them.
