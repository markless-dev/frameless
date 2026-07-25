# Messaging

> **Agents: this is production copy, not guidance about copy.** Lift these lines directly.
> Where you must write something new, match the shape of what's here and obey
> [`voice.md`](./voice.md).

## Hero

**The headline is fixed. Do not rewrite it, do not "improve" it, do not A/B it.**

> # Compile once, output anywhere.

That is the line. It is on the concept art, it is the brand's whole promise, and it is what
every hero — landing page, OG card, deck, poster, ad — leads with. Set in Que Grotesque Black,
die-cut, with depth.

### Never count the targets

Do not write "Ship six", "One source. Six outputs.", "six frameworks", or any variant that
turns the promise into an inventory.

Counting makes it sound conditional and small — as if the answer to "does it work with mine?"
is a list you have to check. *Output anywhere* is the claim, and it is the easy, confident
version of the same fact. Name individual frameworks when a specific reader needs to see their
own on the page; never as a total.

### Approved subheads beneath it

> Write your component once. It compiles to real, idiomatic framework code — and the outputs
> are proven to behave the same in a real browser.

> One source in. Framework-native code out. No runtime, no wrapper, no lock-in.

> Not a runtime. Not a wrapper. A compiler with a test suite that can fail.

## Subheads

- "One `.tsrx` file in. Framework-native code out."
- "Not a runtime. Not a wrapper. A compiler with a test suite that can fail."
- "The output is code your team would have written — and it's yours to keep."

## The three-beat explainer

Use in this order on a landing page. It is the whole argument.

**1. Write it once.**
> One component, in `.tsrx`. State, markup, composition — the parts you'd write anyway.

**2. Compile it out.**
> Frameless compiles to a semantic representation first, then emits per framework. Each
> target gets code that reads like it was written for that framework, because it was.

**3. Prove it matches.**
> Every build diffs behavior across every target in a real browser. The checker is itself
> mutation-tested, so a pass actually means something.

## Feature copy

### Activation-neutrality *(lead with this technically)*
> React, Vue, Svelte, Solid and Angular hydrate. Qwik resumes. These are architecturally
> different ways to bring a page to life, and porting between them by hand is a rewrite.
> Frameless compiles one source to both models and proves the observable behavior is the
> same.

### The oracle
> An equivalence check that can't fail proves nothing. Ours is mutation-tested: we
> deliberately break the compiler and confirm the tests catch it.

### Idiomatic output
> No lowest-common-denominator shape. No wrapper components. The React output uses React
> patterns; the Svelte output uses Svelte patterns. Because the compiler works from meaning,
> not syntax.

### Ejectable by design
> There's no Frameless runtime in your bundle. Delete the compiler tomorrow and the code
> keeps working. That's the entire exit plan, and it's deliberate.

### Composition
> Children, shared state, and direct element access with proper cleanup — across every
> target.

## Framework list — canonical order

When frameworks are shown individually (badges, a compatibility row, a switcher), order them:

**React, Vue, Svelte, Solid, Angular, Qwik.**

Opens on the most recognized, closes on the one that makes the technical point.

Show them so a reader can find their own. Never total them up — see "Never count the targets"
above.

## Frameless Studio

Studio is the one thing that genuinely isn't out yet. Never imply availability, and never
manufacture urgency — no countdown, no waitlist pressure.

> **Frameless Studio** — coming soon
>
> See your components in every state, in every framework you compile to. A simpler
> Storybook that works wherever your code does.

Approved alternates:
- "Studio is coming. Nothing to sign up for yet."
- "A quieter way to see your components. In progress."

## Objection handling

| They say | You say |
|---|---|
| "I've seen this before and the output was unusable." | "Fair — that's usually syntax-to-syntax translation. Frameless compiles to a semantic IR and emits per target, so the output reads native. Look at it before deciding." |
| "What about lock-in?" | "There's no Frameless runtime in your bundle. Delete the compiler and keep the code." |
| "How do I know the outputs really match?" | "Behavior is diffed in a real browser on every build, and the checker is mutation-tested. We break it on purpose to confirm it catches things." |
| "Does Qwik really work the same?" | "Qwik resumes rather than hydrates — a different activation model entirely. Same source, and the observable behavior is verified identical." |
| "Why would I not just write the framework code?" | "For one target, do. The value starts the moment there are two — it's the difference between one component and a set of them drifting apart." |

## CTAs

Primary: **"Run the demo"** · **"See the output"** · **"Get started"**
Secondary: "Read the proof" · "Browse the source"

## Lines that are always wrong

- "Zero runtime." → use **"No Frameless runtime."** The output still needs the framework's
  own runtime.
- "Guaranteed identical output." → **behavior** is verified identical; the output is
  deliberately different per framework.
- "Replaces your framework." → it emits *into* frameworks and depends on them being good.
