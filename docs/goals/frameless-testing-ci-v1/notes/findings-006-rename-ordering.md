# Finding 006 — IR may be order-sensitive to local names (unresolved)

**Status:** open, NOT diagnosed
**Found by:** T009's generative corpus, property 3
**Severity:** unknown — this note records an observation, not a conclusion

## What was observed

`metamorphic.test.ts` asserts that an equal-length rename of a local changes the
IR's identifier strings and nothing else, and that holds exactly on all three
checked-in fixtures.

Applied generatively, the same whole-IR comparison fails. A minimal-ish
counterexample from fast-check (seed 20260726):

```
locals: epsilon9 (state), beta6 (state), gamma1 (state)
body:   a single text node
rename: epsilon9 -> zpsilon9   (equal length, no collision)
```

A single-local version of the same shape compares **identical**, so the trigger
involves multiple locals.

## The hypothesis, explicitly labelled as one

Renaming `epsilon9` to `zpsilon9` moves that name from first to last
alphabetically. If any part of the IR orders locals by name, the representation
would legitimately reorder — and the comparison would report a difference that
is not a bug.

**This was not verified.** The alternative — that declaration order is genuinely
unstable under renaming — has different and more serious implications, and the
evidence collected so far does not separate the two.

## What was done about it

Property 3 in `generative.test.ts` was narrowed to compare the **template
structure** rather than the whole IR, with a comment pointing here. This is
deliberately weaker than the fixture-level invariant in `metamorphic.test.ts`,
which still asserts exact whole-IR equality and still passes.

Narrowing rather than deleting keeps the property running; claiming the strong
version holds generatively would have been false.

## Next step

Dump both IRs for the counterexample above and diff them field by field. If the
only difference is the order of a name-keyed collection, this closes as
"legitimate, and the comparison needs an order-insensitive view of that
collection". If declaration order or cell wiring differs, it is a real compiler
finding and should be escalated as one.
