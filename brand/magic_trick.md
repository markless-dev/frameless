# magic_trick.md

> Everything else in this kit is a system. This file is the part the system can't do.

## What this file is for

The rest of `/agent` will reliably produce work that is correct, on-brand, accessible, and
shippable. It will also drift toward **the median of what the inputs allowed** — that's what
a well-built system does. Correctness and originality are not the same thing.

Somewhere near the end of any piece of work built from this kit, things start converging
toward the middle, exactly when they should be doing the opposite. That's the moment a human
walks back in with an idea that couldn't have been predicted from the inputs.

**A note on the honesty of this file:** it was drafted by an agent, which is a little like
asking the system to describe its own blind spot. What follows are provocations and seeded
starting points, not the trick itself. The trick has to come from someone who has been
awake at 2am with this compiler. Treat everything below as a floor to beat.

---

## The most important observation

The single strangest, most specific thing about Frameless is this:

> **The whole claim is that you can't tell the outputs apart.**

Every other project in this space asks you to admire the code it generated. Frameless's
actual claim is that its three outputs are behaviorally indistinguishable — including across
two architecturally different activation models.

That is a claim with a natural *dare* built into it. Most technical claims can only be
asserted. This one can be **tested by the reader, live, in a way they'll remember.**

That observation is the door. Here are some things behind it.

---

## Seeded deep cuts

### 1. The blind test

Put six panels on the page. Each is the same component, live, compiled to a different
framework. Five hydrate. One — Qwik — **resumes**.

Don't label them.

> **Which one is Qwik?**

Let them poke at all three. Let them open devtools. Let them be certain. Then reveal.

Why this is the strongest candidate: it converts the product's central claim from an
assertion into an **experience of being unable to tell** — which is precisely the claim.
Nobody forgets a demo that beat them. And it's honest: if a visitor *can* reliably spot the
Qwik one, that's a real bug report, and the demo becomes a test suite the public runs for
free.

The failure mode to design against: making it a gimmick quiz. It should feel like a magic
trick performed by someone who genuinely wants you to catch them.

### 2. The lighthouse is the build status

The lighthouse in the concept art is not decoration — it's the equivalence oracle.

Wire it up literally. The light is lit when the behavioral equivalence suite is green. It
goes **dark** when the suite fails, in public, on the homepage.

Almost nobody will do this, because it means publishing your own red builds on your marketing
site. Which is exactly why it lands for a correctness tool. The brand's entire credibility
argument is "we publish the times we were wrong" — this makes that structural instead of
rhetorical.

### 3. The sticker sheet

Ship real, physical die-cut sticker sheets. All six frameworks, one sheet, properly printed
and cut.

Nothing else in developer tooling is a physical object you want. A laptop lid is the only
advertising surface engineers voluntarily maintain, and they're ruthless about what earns a
spot. A sheet good enough that people use the stickers is a distribution channel that costs
almost nothing and runs for years.

The deeper move: give away the sheet, but make **one** sticker genuinely hard to get. Earned
by shipping something with Frameless, or by finding a real bug in the oracle. A set that can
be completed, but not just by asking.

### 4. Field notes, printed

The `docs/goals/` trail contains something genuinely rare: a full record of a project's wrong
answers. The broken test harness that produced a false verdict. The rsync audit that masked a
fresh-clone gap.

Set it as a naturalist's field notebook. Publish it as a small print run. Do not clean it up.

The move here is refusing to present the work as inevitable. Everyone else ships the polished
conclusion; this ships the crossings-out.

### 5. Two ways to wake up

A single interaction that shows hydration and resumption side by side at the moment of
activation — the replay versus the pick-up-where-it-left-off. Slowed down enough to *see* the
difference in mechanism, while the observable behavior stays identical.

This is the most technically beautiful thing Frameless has and currently the least visible.

---

## Where these are likely to be beaten

Be honest about the ceiling of the list above: every one of those ideas is derived from
material already in this kit. They're recombinations — good ones, but recombinations. The
real trick usually comes from somewhere with **no connection to the product at all**:

- something seen in a museum vitrine about taxonomy and mislabeled specimens
- the particular way old Ordnance Survey maps mark "position approximate"
- a printing error someone kept because it was better than the correct version
- an argument had at 1am about whether resumability is actually a lie

The kit cannot get you there. It can only make sure that when you *do* get there, everything
around the idea is already built, coherent, and won't fall over.

## The rule

**System thinking and original thinking. One hand washes the other.**

Ship something correct that nobody remembers, or something memorable with no system beneath
it — both fail. The kit handles the first half so there's room and budget left for the
second.

Leave room for the trick. Don't leave home without it.
