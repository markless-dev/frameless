# Frameless UI kit demo

This demo is a small component library authored in TSRX and compiled by `@frameless/cli` into
React 19 and Solid JSX packages. It supplies portable analyzer scenarios for the later browser
equivalence lanes; generated files belong in `dist/` and are ignored by Git.

The three components deliberately stay inside the compiler's proven construct surface:

- `PricingCard` exercises destructured props, a scalar `state(...)` cell, a `computed(...)` price,
  dynamic text, an `@if/@else` visibility branch, a synchronous write, and a callback payload.
- `TaskList` exercises a controlled draft, a computed open count, keyed object rows, immutable
  collection replacement, per-row edit/toggle/remove controls, clearing, and callback payloads.
- `NewsletterForm` exercises two controlled text inputs, a controlled checkbox, synchronous
  callback traces, and ordered submit writes (`submitting` followed by `subscribed`).

There are no children or slots, context, refs, async work, effects, cross-file TSRX imports, or
custom components in templates. The demo uses clearing rather than reordering for the TaskList's
final collection action. No construct had to be trimmed in response to a compiler diagnostic.
