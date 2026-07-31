# `hn-css` — the Hacker News front-page look, reproduced

`hn.css` is **this repository's own work**. Nothing here was copied from
`news.ycombinator.com`: not a byte of `news.css`, not a rule, not an image.
The reference was read for its **measured geometry** — background colours, the
Verdana 10pt/8pt/7pt type scale, the orange masthead, the rank/vote/title/
subtext row — and reproduced against the class names the frameless emitters
print from `packages/compiler/test/fixtures/s13-hn-front.tsrx`.

It is licensed with the rest of this repository (MIT).

## Why the layout is `flex` and not inline text

The reference separates its subtext links with **literal `" | "` text nodes**.
That spelling is unauthorable in this corpus:

- the Angular emitter's `escapeText` refuses a template text node whose own
  edges are whitespace, and the Vue gate rejects the emitted result;
- the six emitters print sibling elements with **different** inter-element
  whitespace — JSX drops a whitespace-only line, `@vue/compiler-sfc` condenses
  it, Angular's `preserveWhitespaces: false` removes it, Svelte keeps it — so
  **no rule that depends on formatting whitespace is portable across the six**.

So every separator is its own `<span class="hn-bar">|</span>` host, and the
spacing is supplied here by `display: flex` + `gap`. A flex container discards
whitespace-only anonymous boxes in every engine, which is what makes the six
lanes render **identically** whatever whitespace their emitter chose to print.

That is the only structural difference from the reference, and it is visible
nowhere on the rendered page.

## Cascade

One file. It is linked **only** by the `/hn` route in each lane, never
globally, for the reason the TodoMVC and shadcn sheets record: it restyles
`body`, and a global link would move the geometry of the nine `s1`–`s9`
scenarios that `pnpm e2e` compares byte for byte across six lanes.
