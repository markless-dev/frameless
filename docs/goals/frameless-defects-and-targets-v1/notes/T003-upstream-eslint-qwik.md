# Upstream reports for Qwik, from T003

Two findings for the owner to file. Both were measured against the exact versions
in this repo's lockfile — `eslint-plugin-qwik@2.0.0-beta.38` and
`@qwik.dev/core@2.0.0-beta.38` — not read from documentation.

Report 1 is the one T003 was asked to write. Report 2 was found while measuring
the replacement lowering and is arguably the more serious of the two, because it
fails silently.

---

## Report 1 — `no-async-prevent-default` misses the JSX-prop form, and its name is wrong

**Package:** `eslint-plugin-qwik@2.0.0-beta.38`
**Rule:** `qwik/no-async-prevent-default`

### The rule as shipped

From `dist/index.js`, in full:

```js
"CallExpression[callee.property.name='preventDefault']"(e){
  let t=e.parent;
  for(;t;){
    if(t.type==="CallExpression"&&t.callee&&t.callee.type==="Identifier"&&t.callee.name==="$"){
      r.report({node:e,messageId:"noAsyncPreventDefault"});break
    }
    t=t.parent
  }
}
```

### Two defects, both visible in those nine lines

**1. It detects QRL-ness only through an explicit `$()` wrapper.** The rule walks
ancestors looking for a `CallExpression` whose callee is the identifier `$`. But
the optimizer turns a bare function given to a `$`-suffixed JSX event prop into a
QRL too — that is the documented, idiomatic spelling. So this fires:

```jsx
onClick$={$(async (event) => { event.preventDefault(); })}   // reported
```

and this, which is the same QRL with the same problem, does not:

```jsx
onClick$={async (event) => { event.preventDefault(); }}      // NOT reported
```

The rule's _intent_ — "preventDefault inside a QRL" — is right. Its
_implementation_ covers one of the two spellings of a QRL.

**2. It never inspects `async` at all**, despite the rule name
(`no-async-prevent-default`) and the message ("This is an asynchronous function
and does not support preventDefault"). There is no check for the `async` keyword
anywhere in the rule. So it also reports a synchronous `$()`-wrapped handler.

That second point is not merely cosmetic, because **the name describes the wrong
cause**. We witnessed the failure behaviourally, on the official Qwik Router
scaffold at this version, with a fully synchronous handler:

```jsx
<button type="submit" onClick$={(event) => { event.preventDefault(); }}>
```

No `async`, no `await`, nothing to await. Clicking it still let the form's
default GET reach the network: two `Document` requests where there should be one.
CDP timing from that run, as offsets from the page's own Document request — the
QRL segment carrying the handler started at +111.4ms and finished at +112.7ms;
the form's Document GET for `/s3/?` started at +118.2ms. The click was dispatched
roughly 58ms before the handler's code existed in the page.

The cause is **QRL laziness**, not asynchrony. A QRL's segment is not resident
when the event fires, and fetching it costs a network round trip; the browser
performs the default action immediately after dispatch either way. `async` is
correlated with the bug in the common case and is not what produces it.

### Suggested change

- Match the JSX-prop form as well as `$()`: report a `preventDefault()` call
  whose nearest enclosing JSX attribute is a `$`-suffixed event prop, whatever
  wrapper is or is not between them.
- Do not report when the call is inside a `sync$()` QRL — that is the supported
  channel and it works, because a sync QRL is serialized inline and runs during
  dispatch.
- Rename, or at least reword the message. `no-async-prevent-default` names a
  cause that the rule does not test and that is not the real one. Something like
  `no-lazy-prevent-default`, with a message pointing at `sync$()`, would describe
  what actually happens.

### What frameless did in the meantime

Not revert to `$(handler)` to satisfy the rule — that would let an upstream
heuristic dictate emitted output. Instead: a frameless-owned gate policy,
`frameless/no-handler-prevent-default` in
`packages/frameworks/qwik/src/gate/index.ts`, which keys on **which kind of QRL
the call lands in** — rejecting it in a lazily fetched QRL, allowing it in a
`sync$()` one — and never looks at `$()` or at `async`. It is mutation-tested
against all four shapes in `packages/frameworks/qwik/test/gate.test.ts`.

---

## Report 2 — a non-QRL element in a QRL array is silently dropped from `q-e:*`

**Package:** `@qwik.dev/core@2.0.0-beta.38`
**Severity:** the handler disappears at runtime, with no diagnostic at build time,
at SSR time, or in the browser console.

### What we measured

Qwik event props accept an array of QRLs, run in order. Writing the first element
as `sync$(...)` and the second as a bare arrow function looks like the natural
extension of the documented rule that the optimizer wraps a bare handler given to
a `$`-suffixed prop:

```jsx
<button
  type="submit"
  onClick$={[
    sync$((event) => { event.preventDefault(); }),
    async (event) => { writes.value = 2; await props.onTrace$('submit', …); },
  ]}
>
```

The optimizer **does not extract array elements**. Measured on a real
`pnpm build` of an official Qwik Router scaffold:

- `sync$(...)` was rewritten correctly to
  `_qrlSync(e => {e.preventDefault()}, "event=>{event.preventDefault();}")`.
- The bare `async` arrow stayed an inline closure in the component chunk. It
  never became a segment: `dist/q-manifest.json` contains **no** symbol for it,
  while the sibling handlers on the same component
  (`EventForm.jsx_EventForm_component_form_q_e_click` and the two input handlers)
  are all present.
- At SSR the element rendered as
  `<button q-e:click="#0" type="button" data-action="submit">` — only the sync
  QRL. **The async half of the handler is simply gone.** No build warning, no
  SSR error, no console error. The button silently does nothing.

Wrapping the second element in `$()` fixes it: the segment appears in the
manifest (`ctxKind: "function"`, `ctxName: "$"`, `captures: true`) and the
element renders as `q-e:click="#0|q-wOvRpCvR.js#_run#7"`, both halves present, in
both dev and production builds.

### Why this is worth filing even though there is a workaround

The failure mode is silence. A developer following the "the optimizer wraps it
for you" rule — which is correct for a bare handler passed directly to the prop —
gets a button that renders, resumes, and does nothing, with no signal anywhere in
the toolchain. Either the optimizer should extract array elements the same way it
extracts a direct prop value, or a non-QRL element in an event-prop array should
be a build error.

### Reproduction

Any official scaffold at `@qwik.dev/core@2.0.0-beta.38`; render the element
above, run `pnpm build`, and compare `dist/q-manifest.json` and the served
`q-e:click` attribute with and without `$()` around the second element.
