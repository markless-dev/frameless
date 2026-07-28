# T042 — two records S7 measured out of date, re-measured before correction

Worker, 2026-07-28. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Both records were reported by T030 from outside its own `allowed_files`; both had
gone from "incomplete" to **false**. Documentation only. Neither ruling changed;
the solid-js upstream draft stays drafted and unsent.

## 0. Filename correction, made before touching content

The card's `allowed_files` names
`docs/goals/frameless-defects-and-targets-v1/notes/T008-solid-attr-namespace.md`.
No such file exists anywhere in this repo's history (`git log --all
--diff-filter=A --name-only` was checked). The T008 note that actually carries
"section 3" and the `InputHTMLAttributes` upstream draft is
`docs/goals/frameless-defects-and-targets-v1/notes/T008-portability-and-attr.md`
— the only T008 note in this goal mentioning `InputHTMLAttributes` at all, and
its §3 heading is literally "Defect 5 — measured, then decided". Edited that
file. This is recorded as a deviation, not treated as "a file outside
`allowed_files`": the content match is exact and singular, and the alternative
reading — that a real, different file was meant and should be left alone — has
no file to point to.

## 1. Re-measuring record (1): the `checked` latent twin

**Claim to check:** T006's note said Svelte's `remove_input_defaults` on
`checked` has "no impact today" because S3's checkbox binding is unasserted.
**Brief's own caution:** S9 also binds boolean attributes, so the stated count
of three `checked` bindings (from S7) might already be stale upward.

**Re-derived directly from generated output, not from either report:**

```
$ grep -c 'checked=' packages/frameworks/svelte/generated/S*.svelte
S1: 0   S2: 1   S3: 1   S4: 0   S5: 0   S6: 0   S7: 3   S9: 0
```

S9 (`AttrBoard`) binds `disabled` and `required` — booleans, but not `checked`
— in all six generated lanes (checked via `grep -rn checked
packages/frameworks/*/generated/S9.*`, zero hits). **The three-binding count
in T030's note is still accurate at HEAD; S9 does not add a fourth.** The
brief's caution was worth checking and turned out not to apply — recorded
here rather than silently dropped, per the instruction to say when a figure in
the dispatch is wrong.

**What was actually false in T006's note:** not the count, but the verdict
"no impact." T030 §4.1 measured S7's three `checked` bindings across a real
browser, on the served payload and the live DOM, in all six lanes, and found a
four-way split — Svelte is the lane that serves `checked` and then deletes it
at hydration. That is exactly the "latent twin" T006 flagged, now measured
end to end rather than theoretical. What remains true and is preserved in the
correction: `checked` itself still never enters the cross-lane **observation
string** (same trade as `value` in S3 — behaviour is witnessed through
`picked`/`chosen` instead), so "not asserted" survives; "no impact" does not.

**Correction applied** to
`docs/goals/frameless-svelte-v1/notes/T006-value-attribute-ruling.md`'s
"Latent twin" paragraph. T006's Option D ruling is untouched — this paragraph
sits below the ruling, records a fact about current behaviour, and is the
only part of the note this task touched.

## 2. Re-deriving record (2): the `attr:*` typing-gap scope

**Claim to check:** T008 §3's unsent upstream draft scopes the `attr:*`
typing gap to `InputHTMLAttributes`. Brief says S7 measured it firing for
`<select>` and `<textarea>` too, and solid-js declares `attr:*` on neither, so
the draft's scope must widen.

**Re-derived from two independent sources, not taken on trust:**

1. **T030's own measurement** (`notes/T030-corpus-s7-form-controls.md` §4.3):
   running the shipped emitter rule
   (`packages/frameworks/solid/src/emitter/index.ts:2158`, which adds
   `attr:value` for every `kind: 'property'` binding named `value`
   unconditionally) against S7's IR reproduced, verbatim:
   ```
   generated/S7.jsx: TS2322 … 'SelectHTMLAttributes<HTMLSelectElement>' …
   generated/S7.jsx: TS2322 … 'TextareaHTMLAttributes<HTMLTextAreaElement>' …
   ```
   The `value` bindings were then pulled back out of the shipped S7 fixture
   (confirmed: `packages/frameworks/solid/generated/S7.jsx` at HEAD has no
   `attr:value` on its `<select>` or `<textarea>` — it uses `data-size={size()}`
   / `data-notes={notes()}` instead), so this is a **measured, not shipped**
   finding — consistent with the brief's "measured... firing for" phrasing
   rather than "ships."

2. **Independent read of solid-js 1.8.22's own `types/jsx.d.ts`**
   (`node_modules/.pnpm/solid-js@1.8.22/node_modules/solid-js/types/jsx.d.ts`):
   `InputHTMLAttributes`, `SelectHTMLAttributes` and `TextareaHTMLAttributes`
   all `extend HTMLAttributes<T>`; `HTMLAttributes<T> extends AriaAttributes,
   DOMAttributes<T>`; `DOMAttributes<T> extends CustomAttributes<T>` (line 181).
   `CustomAttributes<T>` (line 130) is the base interface and declares no
   `attr:${string}` index signature — it is only ever widened by a *consumer's*
   module augmentation (the draft's own "Workaround in the wild" snippet).
   **46 interfaces in this file `extend HTMLAttributes<T>`** (counted by
   `grep -c 'extends HTMLAttributes<T>'`), so the gap is not particular to
   form controls at all — it is universal to every element-specific JSX
   attribute interface solid-js declares, because they all share the one
   unwidened base. The brief's "every interface accepting `CustomAttributes`"
   phrasing is correct, and if anything is the precise scope rather than an
   approximation.

**Correction applied:** widened the draft's "Title" and "What happens"
sections in `notes/T008-portability-and-attr.md` §3 to state the general
scope and reproduce the select/textarea diagnostics, and added a dated
correction paragraph immediately above the draft explaining what changed and
why. The draft's own "Ask" paragraph already read generally ("the JSX
attribute interfaces that already accept `CustomAttributes`") and needed no
edit — only the framing above it undersold what the Ask already asked for.
T008's upstream reading and this card's decision (`attr:` stays required, the
emitter stays untouched) are **unchanged**. The report stays **unsent**.

## 3. What did not change

- Neither T006's Option D ruling nor T008's "divergent behaviour → `attr:` is
  required" decision was touched, reopened or re-scored.
- No emitted output, golden, fixture, test or emitter source moved.
- The upstream report remains drafted material only; nothing was sent.
- No new literal count was introduced that this task doesn't already justify
  measuring: the "three" `checked` bindings figure is scenario-scoped (S7
  specifically) and re-derived above rather than copied; the "~46" interfaces
  figure is a measured fact about one pinned version of one file
  (`solid-js@1.8.22`'s `types/jsx.d.ts`), not a claim about the corpus, and is
  stated because the scope correction requires saying *how* general the gap
  is, not merely that it is "general."
