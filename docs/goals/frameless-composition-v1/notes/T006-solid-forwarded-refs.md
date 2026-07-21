# T006 Solid same-module forwarded refs addendum (crew scout, 2026-07-20)

## Solid forwarded-handle addendum — same-module only

### Ruling

Emit a callback prop on the explicitly linked component edge. The parent retains the plain `T | undefined` handle variable; the child invokes the callback when its resolved host is created and registers host-owner cleanup that sends `undefined` when that host is disposed.

```jsx
import { onCleanup } from "solid-js";

function Field(props) {
  return (
    <input
      ref={node => {
        props.input(node);
        onCleanup(() => props.input(undefined));
      }}
    />
  );
}

export function App() {
  let input;

  return (
    <>
      <Field input={node => (input = node)} />
      <button onClick={() => input?.focus()}>Focus</button>
    </>
  );
}
```

This is a narrowly authorized setter form for forwarded handles. It is callback transport, not reactive state: do not emit `createSignal`, and retain T003’s lvalue `ref={input}` form for direct same-component handles.

### Candidate decision

- **Plain value prop rejected for Solid 1.8.22.** Executing the checkout’s Babel transform produced `inputRef: input` in the parent and, in the child, `typeof _ref$ === "function" ? use(_ref$, element) : props.inputRef = element`. With `input` initially `undefined`, assigning `props.inputRef` mutates only the component props object; it cannot update the parent lexical.
- **Callback prop selected.** The executed callback case produced `input: node => input = node` on `createComponent` and invoked that function through Solid’s host-ref helper.
- **Library idiom is compatible but incomplete for Markless.** Solid 1.8.22’s own `Portal` calls `props.ref(container)`, supporting callback transport, but its cleanup only removes the container and does not null the ref ([installed web runtime](/Users/jacksm5pro/dev/open-source/frameless/node_modules/.pnpm/solid-js@1.8.22/node_modules/solid-js/web/dist/web.js:626)). No local Kobalte or Solid UI checkout was present.

Current live Solid documentation describes component refs as callback-forwarded and shows `ref={props.ref}` ([Solid refs](https://docs.solidjs.com/concepts/refs), [JSX ref reference](https://docs.solidjs.com/reference/jsx-attributes/ref)). That documented intent supports callback forwarding, but its direct `<Child ref={variable}>` example must not override the executed fallback transform, which did not synthesize a parent setter.

### Cleanup and ownership

Markless requires an element handle to read `undefined` before creation and after removal, and defines it as a non-reactive locator bound to exactly one live host ([Markless handle contract](/Users/jacksm5pro/dev/open-source/markless/specs/framework/04-events-symbols-behaviors.md:5)). Solid 1.8.22 native refs do not invoke callbacks with `null` or `undefined` on unmount, so generated cleanup is required.

Storage and imperative reads remain parent-owned. Setting and clearing are child-host-owned because the child’s owner knows when the resolved host is disposed. The pinned `use` helper invokes the callback inside `untrack` ([web runtime](/Users/jacksm5pro/dev/open-source/frameless/node_modules/.pnpm/solid-js@1.8.22/node_modules/solid-js/web/dist/web.js:234)), while `onCleanup` registers against the current owner ([Solid runtime](/Users/jacksm5pro/dev/open-source/frameless/node_modules/.pnpm/solid-js@1.8.22/node_modules/solid-js/dist/solid.js:465)). An executed runtime probe observed `[host]` before disposal and `[host, undefined]` immediately after disposal.

Imperative calls remain null-guarded—`input?.focus()`—in accordance with the `T | undefined` contract. No selector lookup, DOM rediscovery, or non-null assertion is admissible.

### S-RF gate extension

- A forwarded handle must originate from a `graph-reference` prop on one explicit `component-reference.edgeId`; the edge prop’s semantic identity must be consumed directly ([component prop/edge schema](/Users/jacksm5pro/dev/open-source/frameless/.fable-codex/runs/2026-07-21T00-11-15-807Z/units/a2-solid-forwarded-refs/worktree/packages/compiler/src/schema.ts:148)).
- Require the parent to declare one plain handle variable and pass one callback on that exact recorded prop. Reject value snapshots such as `<Field input={input}>`.
- Require the child callback to bind the linked `ElementHandleBinding` to exactly its recorded `hostNodeId`; reject zero hosts, multiple hosts, spreads, nested-object transport, or selector-based reconstruction ([binding schema](/Users/jacksm5pro/dev/open-source/frameless/.fable-codex/runs/2026-07-21T00-11-15-807Z/units/a2-solid-forwarded-refs/worktree/packages/compiler/src/schema.ts:401)).
- Require host-owner cleanup to assign `undefined` synchronously on disposal. Reject relying on Solid to null native refs.
- Permit callback/setter emission only for this explicit forwarded-handle transport. Continue rejecting signal setters unless IR separately declares reactive handle identity.
- Require every structured handle call to preserve its recorded optionality, arguments, event association, and order.
- Remain fail-closed for cross-file forwarding.

The upstream same-module corpus confirms the edge prop is a graph-reference to the parent element graph node and the child host binding is resolved ([semantic test](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/test/semantic-graph.test.ts:530)); T001 records the pinned success and cross-file limitation ([T001](/Users/jacksm5pro/dev/open-source/frameless/.fable-codex/runs/2026-07-21T00-11-15-807Z/units/a2-solid-forwarded-refs/worktree/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:31)).

### Overturn triggers

Revisit this ruling if browser calibration disproves cleanup ordering; the fallback transform begins synthesizing a true parent setter for component variable refs; `/2` introduces reactive handle identity; or the target moves to Solid 2. Solid `next` at `b59584be993219ac94f37f1da07e2d7d13dcc9e3` makes callback refs ownerless, so the pinned callback-local `onCleanup` pattern cannot be carried forward mechanically.

### Evidence limits and verification receipt

- **Passed:** three executed Babel compilations—plain prop, callback prop, and `ref`-named callback—plus the recommended cleanup form.
- **Passed:** Solid 1.8.22 owner/disposal probe; cleanup delivered `undefined` synchronously.
- **Passed:** read-only searches of Solid `v1.8.22`, Solid `next`, and `/Users/jacksm5pro/dev/open-source` for Solid UI/Kobalte corpora.
- **Unrun:** browser mount/unmount calibration, SSR, hydration, and cross-file forwarding.
- The project-local `@markless/core` package was not installed/resolvable, so its managed skill playbook could not be loaded. Evidence instead came from the supplied dossiers, `/2` schema, vendored protocol findings, and read-only Markless corpus.
- No repository or temporary files were created or changed. The worktree, main Frameless checkout, and Solid checkout remained clean.
