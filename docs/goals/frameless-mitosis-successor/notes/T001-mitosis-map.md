# T001 — Mitosis codebase map (Scout receipt note)

Provenance: two read-only crew units (gpt-5.6-sol, effort medium) run 2026-07-19,
run id `2026-07-19T18-58-54-847Z` (full logs in `.fable-codex/runs/`). PM synthesized;
full unit reports appended below. Repo analyzed: `/Users/jacksm5pro/dev/open-source/mitosis`
(read-only; last commit June 2026).

## PM synthesis — ranked candidate failure causes (merged from both units)

1. **The authoring language is a narrow, surprising JSX dialect.** No component-body
   locals, no early returns, no props destructuring defaults/rest, no state destructuring,
   forced `Show`/`For`, naming restrictions, `event`-named callbacks. Enforced by three
   disagreeing layers (parser pattern-matching, parser errors, ESLint plugin).
2. **The IR is a JSON template tree with code-as-strings, not a semantic AST.** No symbol
   table, scopes, closures, types, or control-flow model. Generators rewrite strings with
   regex/reparse/name substitution — the root cause of most bans and bugs.
3. **"Common" state/lifecycle semantics don't exist.** `onUpdate` maps to React `useEffect`,
   Svelte `$:`/`afterUpdate`, Angular `ngOnChanges` (input-driven!), Solid effect-only-with-deps
   (dropped otherwise), Qwik tasks. Users can't predict cross-target behavior.
4. **~18,000 lines of handwritten per-target generators, mostly string concatenation.**
   Only ~126 lines in shared generator helpers. Angular maintains parallel classic+signals
   stacks. Target breadth (22 registered) created an unmaintainable surface.
5. **Golden snapshots accepted objectively broken output.** Qwik snapshots reference
   undefined `myEvent` and call nonexistent `state.onBlur()`. 46 snapshot files, ~437K lines,
   ~10MB — too large for semantic review; multi-thousand-line mechanical diffs.
6. **Behavioral parity is asserted, not proven.** Shared Playwright e2e exists but core
   assertions are commented out, 11 target-test instances skipped, Angular's wrong
   `disabled` behavior special-cased, failure allowlist for Qwik. No differential oracle.
7. **Generated code fails the "native code you'd want to own" promise.** Dead imports/state
   across React/Vue/Svelte/Solid; Vue callbacks-instead-of-emits; unkeyed loops; Angular
   NgModule boilerplate + `[attr.*]` misuse; Qwik invalid code.
8. **Unsupported input fails inconsistently: throw, warn, or silently disappear.**
   JSX spread children silently dropped; unsupported operators TODO-only; no source
   locations in errors; no source maps from generated code back to `.lite.tsx`.
9. **Marketing overclaims vs. evidence.** "Compile to every framework", "fully functional",
   all-green test-status table — contradicted by allow-failures.json, commented-out
   assertions, empty feature-matrix draft, starter offering only 3 of 22 targets.
10. **Maintenance collapse + bus factor.** Commits: 558 (2021) → 501 (2022) → 193 (2023)
    → 118 (2025) → 8 (through June 2026). Top two contributors = 63.4% of commits. No
    feature commits after June 2025. Escape hatches (plugins mutating IR, `useTarget`,
    per-target override trees) shifted burden onto users, turning "write once" into
    "own a build platform".

Key structural facts for the successor design (T004 input):

- Pipeline: `.lite.tsx`/`.svelte` → Babel parse → `MitosisComponent` JSON IR (code as
  strings) → per-target clone → generator (string building) → Prettier.
- IR: `MitosisComponent` (state as `{code,type}` strings, hooks as code strings + dep
  strings) and `MitosisNode` (tag, string bindings, only `For`/`Show` structural).
- Generators: curried `TranspilerGenerator`, plugin hooks (pre/post JSON+code) that can
  arbitrarily mutate IR/code — load-bearing internally, invariant-destroying.
- No behavioral equivalence harness; snapshot-text testing dominates.

---

## Unit A — architecture & compiler pipeline (full report)

# 1. Repo layout

## Monorepo and pipeline at a glance

The repository is a Yarn 4 workspace spanning `packages/*`, `e2e/*`, generated e2e outputs, and examples (`package.json:3-8,53`). Nx coordinates builds/tests and Nx Cloud caching (`nx.json:3-10,17-46`); Changesets handles publishing, while TypeScript, Vitest, ESLint, Prettier, and esbuild supply compilation and validation (`package.json:13-29,35-51`).

The normal build pipeline is:

1. The CLI globs `.lite.tsx`, `.lite.jsx`, and `.svelte` component files (`packages/core/src/helpers/component-file-extensions.ts:4-25`; `packages/cli/src/build/build.ts:239-262`).
2. JSX or Svelte is parsed into `MitosisComponent`; TypeScript and JavaScript variants may be parsed separately (`packages/cli/src/build/build.ts:137-208`).
3. The IR is cloned per target, then passed to a target generator (`packages/cli/src/build/build.ts:303-325,343-399`).
4. Generators mutate a private clone, run JSON/code plugins, build source text, optionally format it with Prettier, and return a string; React is representative (`packages/core/src/generators/react/generator.ts:176-273`).
5. The CLI rewrites component/import extensions and emits target files; non-component TS/JS is separately run through esbuild as needed (`packages/cli/src/build/build.ts:394-399,467-513`; `packages/cli/src/build/helpers/transpile.ts:19-40,43-79`).

## Packages

| Package | Role | Classification |
|---|---|---|
| `packages/core` | Published `@builder.io/mitosis`. Owns all parsers, the IR, plugins, framework generators, Builder conversion, context generation, and public compile-away hook declarations. The export surface exposes virtually everything (`packages/core/src/index.ts:5-60`). | Core |
| `packages/cli` | Published `@builder.io/mitosis-cli`. Provides `mitosis build`, single-file `compile`, configuration loading, overrides, project-wide file discovery, import rewriting, and auxiliary-file transpilation (`packages/cli/package.json:2-39`; `packages/cli/src/commands/compile.ts:24-174`). | Core operational tooling |
| `packages/eslint-plugin` | Published recommended rules describing the effective authoring language and warning about constructs the parser mishandles (`packages/eslint-plugin/src/configs/recommended.ts:7-25`). | Load-bearing validation, although technically separate |
| `packages/docs` | Qwik City documentation site and current playground. Its server-side compiler dynamically imports core parsers/generators (`packages/docs/package.json:9-25`; `packages/docs/src/services/compile.ts:59-128`). | Peripheral product surface |
| `packages/fiddle` | Older private Next/React/MobX/Monaco playground, including Builder/Figma JSON upload plumbing (`packages/fiddle/package.json:1-44`; `packages/fiddle/src/functions/prompt-upload-figma-file.ts`). | Peripheral/legacy-looking duplicate |
| `packages/starter` | Published `create-mitosis` scaffolder. Copies a template and currently offers only React, Svelte, and Qwik in its target prompt (`packages/starter/package.json:2-18`; `packages/starter/script.cjs:35-39,48-114`). | Peripheral onboarding |

Within core, `src/parsers`, `src/types`, `src/generators`, `src/helpers/plugins`, and `src/modules/plugins.ts` form the compiler. `src/plugins` contains reusable IR transforms; `src/symbols` and Builder parser/generator code connect Builder content/symbols to the same IR. Tests and enormous generated snapshots live under `packages/core/src/__tests__`.

The target registry contains 22 names, including aliases such as `customElement`/`webcomponent`, and React-derived targets such as Preact, React Native, RSC, and Taro (`packages/core/src/targets.ts:1-49`).

# 2. Input parsing

## Mitosis JSX

`parseJsx()` first optionally strips TypeScript, then runs a Babel transform with TypeScript syntax enabled (`packages/core/src/parsers/jsx/jsx.ts:48-63`; `packages/core/src/parsers/jsx/helpers.ts:45-63`). During that transform it:

- initializes a `MitosisComponent`, retains imports/default export/types, captures module exports and module hooks, then deletes the original program body (`packages/core/src/parsers/jsx/jsx.ts:69-104`);
- recognizes capitalized **function declarations** as components and lowers them through `componentFunctionToJson()` (`packages/core/src/parsers/jsx/jsx.ts:105-139`);
- converts JSX elements to node-shaped object literals (`packages/core/src/parsers/jsx/jsx.ts:148-150`);
- generates source for the resulting object, reparses that source as JSON, then performs identifier/context/signal postprocessing (`packages/core/src/parsers/jsx/jsx.ts:169-245`).

This is an AST-assisted parse, but the final IR is not an AST. Most executable fragments are immediately converted back into strings with Babel generator.

### Where the restricted subset is enforced

There is no single authoritative validator. Restrictions arise from three layers:

1. Parser pattern matching, where unrecognized component-body statements are simply not copied (`packages/core/src/parsers/jsx/function-parser.ts:38-334`).
2. Explicit parser errors or lossy lowering, e.g. state-object spread errors and the first-return-only render model.
3. A separate recommended ESLint profile (`packages/eslint-plugin/src/configs/recommended.ts:7-25`).

These layers disagree. For example, the parser converts `.map()` and ternaries into `For` and `Show` (`packages/core/src/parsers/jsx/element-parser.ts:66-125,143-157`), while recommended lint warns against `.map()` and errors on JSX ternaries (`packages/eslint-plugin/src/rules/no-map-function-in-jsx-return-body.ts:17-30`; `packages/eslint-plugin/src/rules/static-control-flow.ts:25-36`). The docs tell users that lint rules are the limitations reference (`packages/docs/src/routes/docs/gotchas/index.mdx:5-7`), making this drift user-visible.

### Actual JSX authoring restrictions

Compared with normal React/TSX, authors cannot safely use the following:

- **Arrow-function or anonymous default components.** Component extraction visits `FunctionDeclaration` only and requires a capitalized name (`packages/core/src/parsers/jsx/jsx.ts:105-139`). The documented form is one default-exported function per file (`packages/docs/src/routes/docs/components/index.mdx:44-51`).
- **Arbitrary component-body computation.** Direct children of the function body are only interpreted when they are recognized hook calls, function declarations, or variable declarations initialized by `useState`, `useStore`, `useContext`, or `useRef` (`packages/core/src/parsers/jsx/function-parser.ts:38-334`). Recommended lint explicitly says other declarations and top-level assignments are ignored (`packages/eslint-plugin/src/rules/no-var-declaration-or-assignment-in-component.ts:36-103`).
- **Normal early-return or statement control flow.** The parser finds one top-level `ReturnStatement` and only accepts JSX element/fragment arguments (`packages/core/src/parsers/jsx/function-parser.ts:336-346`). A top-level `if` is rejected by lint (`packages/eslint-plugin/src/rules/no-conditional-logic-in-component-render.ts:35-55`). Rendering control flow is expected to be structural `Show`/`For`.
- **General JSX control-flow expressions.** Only `.map`, `Array.from`, `&&`, and ternaries receive structural lowering. Other logical operators have an explicit unsupported-operator TODO (`packages/core/src/parsers/jsx/element-parser.ts:66-157`). `For` callback parameters must be plain identifiers; destructuring parameters disappear from its scope (`packages/core/src/parsers/jsx/element-parser.ts:29-39`).
- **Block-bodied JSX callbacks with meaningful setup.** The parser searches only for a callback return expression; declarations preceding it are not represented (`packages/core/src/parsers/jsx/element-parser.ts:13-27`). Lint separately rejects variables in JSX as ignored (`packages/eslint-plugin/src/rules/no-var-declaration-in-jsx.ts:35-41`).
- **General props destructuring/default/rest semantics.** The compatibility pass only maps simple `{ foo }` identifiers, and only rewrites bare identifiers directly inside JSX expression containers (`packages/core/src/parsers/jsx/props.ts:5-44`). Default destructuring and `...rest` are documented as broken (`packages/docs/src/routes/docs/gotchas/index.mdx:306-369`). Props type extraction additionally assumes the parameter is literally named `props` (`packages/core/src/parsers/jsx/component-types.ts:7-38`).
- **Free local naming.** Recommended lint forbids names colliding with props, state properties, or generated setters (`packages/eslint-plugin/src/configs/recommended.ts:17,22,24`). The documented consequence can be invalid output such as `const foo = foo` (`packages/docs/src/routes/docs/gotchas/index.mdx:9-42`).
- **General state initialization.** `useStore` must be an object expression and lint requires it to be assigned to `state` (`packages/core/src/parsers/jsx/function-parser.ts:286-299`; `packages/eslint-plugin/src/rules/use-state-var-declarator.ts:45-55`). Spread members, private names, and computed/non-string keys throw (`packages/core/src/parsers/jsx/state.ts:336-359`). Docs warn that prop-derived and function-call initializers are not reliable and recommend getters or mount-time assignment (`packages/docs/src/routes/docs/gotchas/index.mdx:124-218`).
- **State destructuring.** It is forbidden because the identifier-rewrite model cannot preserve shadowing/scope reliably (`packages/eslint-plugin/src/rules/no-state-destructuring.ts:35-47`; `packages/core/src/parsers/jsx/state.ts:47-113`).
- **Async state methods under the recommended contract.** The lint profile rejects them (`packages/eslint-plugin/src/rules/no-async-methods-on-state.ts:55-76`), even though newer parser code contains special async-function conversion paths (`packages/core/src/parsers/jsx/state.ts:197-240,259-293`). This is another enforcement/version mismatch.
- **React ref semantics.** Authors use the ref value directly; `.current` is rejected (`packages/eslint-plugin/src/rules/ref-no-current.ts:35-87`). Generators later manufacture target-specific ref access.
- **Normal event callback freedom.** Recommended lint requires arrow functions and insists a callback parameter be named `event` (`packages/eslint-plugin/src/rules/jsx-callback-arrow-function.ts:38-53`; `packages/eslint-plugin/src/rules/jsx-callback-arg-name.ts:42-73`). Parser-side function binding metadata is tailored to arrow functions (`packages/core/src/parsers/jsx/element-parser.ts:294-312`).
- **Dynamic CSS values in the `css` prop.** Recommended lint requires an object and rejects identifier, ternary, and member-expression property values (`packages/eslint-plugin/src/rules/css-no-vars.ts:37-104`).
- **Arbitrary module contents.** Recommended files may contain imports, the default component, type declarations, and only selected module hooks; other module statements are rejected (`packages/eslint-plugin/src/rules/only-default-function-and-imports.ts:10-69`). The parser nevertheless has partial raw-export capture (`packages/core/src/parsers/jsx/exports.ts:9-55`), again making actual behavior less crisp than the advertised language.
- **General context patterns.** `Context.Provider` is compiled away into component context state, but `Context.Consumer` is explicitly unimplemented (`packages/core/src/parsers/jsx/context.ts:16-45`). Context files must follow a special filename/default-export convention (`packages/docs/src/routes/docs/context/index.mdx:7-12`).
- **Dynamic `useTarget` objects.** Keys must be literal valid target identifiers; spreads/references and invalid target names throw (`packages/core/src/parsers/jsx/hooks/use-target.ts:61-121`).
- **Treating children as a normal React value.** Docs explicitly forbid iterating/manipulating `props.children` because several targets cannot support it (`packages/docs/src/routes/docs/components/index.mdx:253-285`).

JSX spread attributes are retained as a string binding, but the parser comments that ordering is inaccurate and Angular may not support the concept (`packages/core/src/parsers/jsx/element-parser.ts:411-422`). JSX spread children are dropped (`packages/core/src/parsers/jsx/element-parser.ts:165-167`).

## Other inputs

- **Svelte:** `parseSvelte()` preprocesses TypeScript, uses `svelte/compiler`, and independently maps module script, instance script, HTML, and CSS into the same IR (`packages/core/src/parsers/svelte/index.ts:16-75`). This is a partial semantic importer: HTML recognizes only elements/components, mustaches, raw HTML, `if`, `each`, fragments, slots, text, and comments; unknown node types do not gain meaningful representation (`packages/core/src/parsers/svelte/html/index.ts:41-90`). `each` records only `node.expression.name`, losing general collection expressions and index/key details (`packages/core/src/parsers/svelte/html/each.ts:9-20`). Script parsing uses a case list of imports, exports, functions, selected lifecycle/context calls, top-level variables, reactive labels, and selected statements (`packages/core/src/parsers/svelte/instance/index.ts:115-147`). Several conversions are textual replacements, e.g. `++`/`+=` and event dispatch rewriting (`packages/core/src/parsers/svelte/instance/functions.ts:17-77`).
- **Builder JSON:** `builderContentToMitosisComponent()` clones Builder content, extracts symbols as subcomponents, maps Builder blocks/bindings into the IR, validates embedded binding strings, and either drops or escapes invalid code (`packages/core/src/parsers/builder/builder.ts:1262-1311`). This path is large and product-specific rather than a generic JSON frontend.
- **Angular:** `angularToMitosisComponent()` exists as an exported, very limited importer. It finds an inline `template` in a decorated class, understands `ngIf`, `ngFor`, basic elements/inputs/outputs/text, and otherwise throws; bound text is currently emitted as static `_text` (`packages/core/src/parsers/angular.ts:53-143,146-187`). The CLI does not expose Angular as an input.
- **CLI-visible formats:** single-file `compile --from` accepts only `mitosis`, `builder`, and `svelte` (`packages/cli/src/commands/compile.ts:119-140`). Project builds automatically recognize only `.lite.tsx`, `.lite.jsx`, and `.svelte` (`packages/core/src/helpers/component-file-extensions.ts:4-25`).
- **Figma:** there is no core Figma AST/parser in this snapshot. Current docs route users through Fusion to generate Mitosis code (`packages/docs/src/routes/docs/figma/index.mdx:7-26`); the old fiddle can upload Figma/Builder-shaped JSON. Thus “Figma input” is an external/product integration, not a compiler frontend parallel to JSX/Svelte.

# 3. The intermediate representation

## `MitosisComponent`

The component IR (`packages/core/src/types/mitosis-component.ts:106-175`) contains:

- name, imports, raw exports, metadata, inputs, and subcomponents;
- state split by key into `{ code, type, typeParameter?, propertyType? }`, where type is property/function/getter/method (`:68-77`);
- context gets/sets, including imported context paths and either structured state values or raw references (`:38-49,116-119`);
- props optional/reactive metadata, refs with initializer/type argument, and signal import metadata (`:120-134`);
- lifecycle/event hooks as code strings plus dependency strings/arrays (`:51,93-104,135-144`);
- `useTarget` blocks, root children, raw type declarations, props type reference, default props, style text, plugin/build metadata, and generator-specific compile scratch state (`:145-175`).

## `MitosisNode`

A node has a tag/name, static string properties, dynamic bindings whose executable code is a string, children, scope, metadata, slots/localized values, and optional serialized block slots (`packages/core/src/types/mitosis-node.ts:34-100`). Structurally distinguished nodes are only `For` and `Show`; Fragment and Slot are names in the same base shape rather than distinct typed variants (`:102-126`). `For.scope` records at most item, index, and collection names (`:109-116`).

## What the IR loses or cannot faithfully express

- **Executable syntax and lexical scope:** expressions, functions, hooks, dependencies, exports, and types are mostly source strings. There is no executable AST, symbol table, binding identity, or capture list. A closure’s text may survive, but the IR does not know what it closes over; generator rewrites therefore operate through reparsing, regex, and name substitution.
- **General render control flow:** there is no statement graph, early return, switch, try/catch, loop body, or conditional branch model—only the `Show`/`For` tree. The parser’s first-top-level-return rule makes this an input limitation as well (`packages/core/src/parsers/jsx/function-parser.ts:336-346`).
- **Component-local variables and closures:** ordinary component-body declarations are not represented. Functions placed in state retain source text, but their environment does not. This is why naming collisions and destructuring need lint bans.
- **TypeScript semantics:** the IR stores module type declarations as generated strings, a `propsTypeRef`, and isolated state/ref type-argument strings (`packages/core/src/parsers/jsx/component-types.ts:55-80`; `packages/core/src/parsers/jsx/function-parser.ts:281-297,327-329`). It has no type AST, generic component parameters, constraints, overload relationships, conditional/mapped-type semantics, or type/value symbol links. Optional/reactive prop detection requires a separate ts-morph project (`packages/core/src/parsers/jsx/jsx.ts:198-238`).
- **Generics:** generic type text may survive in raw declarations or individual `typeParameter` fields, but component generics are not modeled in `MitosisComponent`; generators cannot reason about them structurally.
- **Async semantics:** event bindings have an `async` bit, while hook/state function bodies may contain raw async source, but there is no component-level async/suspense/resource/cancellation model. Recommended lint’s async-state prohibition exposes the gap.
- **Context semantics:** context is represented, but only as named get/set records containing state-shaped values or raw references. Provider nesting is flattened into component-level `context.set`; Consumer is absent. Identity and update/ownership semantics remain target-dependent.
- **Refs:** the IR knows a ref name, initializer string, and optional type string, but not whether it is a DOM node, mutable cell, callback ref, component instance, or ownership-sensitive handle.
- **Slots/children:** nodes support both `slots` and temporary duplicate slot bindings; comments say bindings are retained until generators migrate (`packages/core/src/parsers/jsx/element-parser.ts:313-324`). This signals an incomplete representation transition.
- **Source fidelity:** Babel parsing disables comments (`packages/core/src/parsers/jsx/helpers.ts:54-63`), and IR types have no source locations/source maps. Formatting and comments cannot round-trip reliably.
- **Target-neutral semantics:** `targetBlocks`, `pluginData`, and `compileContext` place target/build knowledge directly in the supposedly neutral component object (`packages/core/src/types/mitosis-component.ts:145-175`).

The result is less a semantic compiler IR than a JSON template tree decorated with code snippets.

# 4. Generator architecture

Every generator conforms to a curried `TranspilerGenerator(options) -> ({ component, path }) -> output` contract (`packages/core/src/types/transpiler.ts:4-16`). The registry maps targets to these factories (`packages/core/src/targets.ts:27-49`).

The intended architecture is explicitly `componentTo<framework>` plus `blockTo<framework>`: the former renders the whole file and the latter recursively renders nodes (`developer/generators.md:5-33`). In practice each major target owns its own component and block emitter:

- React: `packages/core/src/generators/react/generator.ts`, `blocks.ts`
- Vue: `packages/core/src/generators/vue/vue.ts`, `blocks.ts`, separate Options/Composition API emitters
- Svelte: `packages/core/src/generators/svelte/svelte.ts`, `blocks.ts`
- Solid: `packages/core/src/generators/solid/index.ts`, `blocks.ts`, three state strategies
- Angular: separate classic and signals component/block/plugin stacks under `packages/core/src/generators/angular/classic` and `signals`
- Qwik: its own source/file builder, component generator, JSX emitter, directives, handlers, state, and serialization helpers
- Stencil, Lit, Marko, Swift, Alpine, Liquid, HTML/custom element, Builder, and Template each have independent emitters.

A static line count of non-test generator TypeScript in this checkout is roughly 18,000 lines. The largest target areas are Angular (~3,623), Qwik (~2,376), HTML/custom element (~1,531), React (~1,377), Vue (~1,330), and Swift (~1,187). Only 126 lines sit in the explicitly cross-target `generators/helpers` directory, though another roughly 4,200 lines of generic helpers under `core/src/helpers` are shared by parsers and generators. This is not proof of literal copy/paste, but the architecture strongly favors repeated target-specific implementations of state, hooks, blocks, attributes, styles, slots, imports, and formatting.

There is selective reuse:

- Preact is a React option (`packages/core/src/generators/react/generator.ts:168-174`).
- React Native and Taro preprocess the IR through plugins, then call React generation (`packages/core/src/generators/react-native/index.ts:273-295`; `packages/core/src/generators/taro/generator.ts:163-177`).
- RSC removes hooks/refs/context through a plugin and delegates to React (`packages/core/src/generators/rsc/generator.ts:12-58,61-87`).
- Angular classic versus signals largely duplicate the component/block pipeline instead of sharing a common Angular semantic backend.

## Output construction

Output is overwhelmingly source-string construction: template literals, `dedent`, recursive `blockTo*`, and `str +=`. React’s node emitter is illustrative (`packages/core/src/generators/react/blocks.ts:187-391`). Babel is used to transform individual code fragments, not to build a complete output AST. Prettier is then used as a parser/formatter and can turn malformed concatenation into a hard generation error (`packages/core/src/generators/react/generator.ts:243-268`).

Qwik is the main variation: it uses custom `File`, `SrcBuilder`, and emitter abstractions (`packages/core/src/generators/qwik/component-generator.ts`), but this is still a source builder, not a typed Qwik/TypeScript AST. Builder output is naturally JSON-shaped.

## Plugins

A plugin factory can provide ordered pre/post hooks for build, JSON, and code (`packages/core/src/types/plugins.ts:4-30`). Generator code runs:

- pre-JSON before built-in mutation,
- post-JSON after generator-specific preparation,
- pre-code before formatting,
- post-code after formatting (`packages/core/src/modules/plugins.ts:6-83`).

The CLI additionally runs async pre/post build hooks and sorts plugins by numeric order (`packages/cli/src/build/build.ts:53-57,283-300`). Plugins are load-bearing internal machinery—React Native, RSC, target-block processing, signal processing, event lowering, and Angular code processing use them—not merely user extensions. Since JSON hooks can mutate or replace the entire IR and code hooks receive arbitrary strings, the contract provides power at the expense of invariants. The generator guide explicitly warns that order matters because helper functions mutate JSON (`developer/generators.md:11-25`).

# 5. State/reactivity model

## Source model

Mitosis presents two primary authoring styles:

- `useStore({ ... })`: a mutable `state.foo` object with properties, methods, and getters.
- React-like `useState`, immediately rewritten to the same `state.foo` assignment model (`packages/core/src/parsers/jsx/state.ts:47-113`; `packages/core/src/parsers/jsx/function-parser.ts:236-299`).

Props remain `props.*`; refs are direct values; contexts are explicit get/set records; lifecycle consists of `onInit`, `onMount`, `onUpdate`, `onUnMount`, and event hooks (`packages/core/src/index.ts:72-119`).

## Target mappings

- **React/Preact/RN/Taro/RSC:** default React state is per-property `useState`; getters become functions and assignments are rewritten to setters (`packages/core/src/generators/react/generator.ts:191-229,318-352`; `packages/core/src/generators/react/helpers/state.ts:66-104`). Options also support MobX, Valtio, Solid, Builder, or plain variables (`packages/core/src/generators/react/types.ts:13`). Mount/update/unmount all become `useEffect`, while init uses a render-time ref guard (`packages/core/src/generators/react/helpers/hooks.ts:6-94`). Refs are rewritten to `.current` internally (`packages/core/src/generators/react/generator.ts:332-335`). Context maps to `useContext`/provider logic.
- **Vue:** supports both Options and Composition APIs. Composition state properties become `ref`, getters become `computed`, context becomes `inject`/`provide`, lifecycle maps to `onMounted`, `onUnmounted`, `onUpdated`, and dependency-based `watch` (`packages/core/src/generators/vue/compositionApi.ts:46-151`; `packages/core/src/generators/vue/vue.ts:218-287`). Options API synthesizes computed/watch/provide/inject sections separately.
- **Svelte:** state can be variables, proxies via `on-change`, or writable stores. Props become `export let`; refs become `let`; context uses Svelte `getContext`/`setContext` (`packages/core/src/generators/svelte/svelte.ts:277-370`). Mount/destroy map directly, no-dependency update uses `afterUpdate`, and dependency updates synthesize `$:` statements plus special store-dependency aliases (`:373-424`).
- **Solid:** state is divided between signals and stores, with getters represented through memos (`packages/core/src/generators/solid/state/state.ts:1-83`). Context uses `useContext`; mount maps directly. `onUpdate` synthesizes memos/effects, but hooks without dependencies are explicitly dropped (`packages/core/src/generators/solid/index.ts:195-235`).
- **Angular classic:** props/events become `@Input`/`@Output` (`packages/core/src/generators/angular/helpers/get-inputs.ts`; `get-outputs.ts`). Init and mount are combined into `ngOnInit`; update code is placed in `ngOnChanges`; teardown becomes `ngOnDestroy` (`packages/core/src/generators/angular/classic/component.ts:351-425`). This means state-driven updates are not naturally equivalent to React effects because `ngOnChanges` is driven by input changes.
- **Angular signals:** properties/getters are lowered to signals/computed values and update hooks to effects, with generated dummy reads/workarounds to force tracking (`packages/core/src/generators/angular/signals/component.ts:390-413`). It also carries Angular-version-specific `allowSignalWrites` behavior.
- **Qwik:** state uses Qwik `useStore`/`useSignal`; browser mount uses `useVisibleTask$`, SSR mount/init uses `useTask$`, and dependency updates emit `track(() => dep)` calls (`packages/core/src/generators/qwik/component-generator.ts:196-229,258-340`). Context functions can cause a hard error because they are not serializable (`packages/core/src/generators/qwik/component-generator.ts:276`).

## Leaks and approximations

- Lifecycle names suggest shared semantics, but mappings differ materially: React `useEffect`, Svelte `afterUpdate`/reactive labels, Angular input-driven `ngOnChanges`, Solid dependency-only effects, and Qwik visibility/resumability tasks are not equivalent scheduling models.
- Dependency arrays are stored both as raw strings and shallow identifier/member lists (`packages/core/src/parsers/jsx/function-parser.ts:153-186`). Svelte and Solid then split the raw string on commas (`packages/core/src/generators/svelte/svelte.ts:382-399`; `packages/core/src/generators/solid/index.ts:210-231`), which is not a syntax-safe dependency analysis.
- React must decompose mutable-object state into setters and rewrite assignments; Svelte/Angular/Solid/Qwik need different tracking mechanics. Nested mutation, object identity, getter caching, and batching therefore cannot be uniformly preserved.
- Context update ownership and serializability vary radically. RSC simply removes lifecycle, refs, and context for server components (`packages/core/src/generators/rsc/generator.ts:19-51`).
- Ref semantics are invented late by each generator rather than captured in the IR.
- Target-specific escape hatches (`useTarget`, generator options, per-target overrides, JSON/code plugins) are admissions that the common semantics are insufficient.

The e2e suite confirms practical divergence: default props are skipped for Qwik/Solid, script tags for six targets, styles for Angular, updates for Solid, and typed event behavior for Qwik (`e2e/e2e-app/tests/main.spec.ts:9-20,62-95,119-147`). Angular disabled attributes even have a documented generated-behavior exception (`:97-116`).

# 6. Everything else load-bearing

## CLI and project integration

`mitosis build` reads a config, merges CLI targets, discovers all component and auxiliary files, optionally creates a ts-morph project, produces JS/TS IR variants, runs every target concurrently, and writes a parallel output tree (`packages/cli/src/commands/build.ts:1-54`; `packages/cli/src/build/build.ts:137-208,303-337`).

Important integration mechanisms include:

- target-specific output extensions and import rewriting (`packages/core/src/helpers/component-file-extensions.ts:42-180`);
- ordinary JS/TS copying/transpilation and Mitosis import removal (`packages/cli/src/build/build.ts:467-513`);
- special `.context.lite.ts` generation (`:438-462,497-500`);
- per-target override trees that completely replace generated components/files (`:356-386,476-495`);
- custom parsers, generators, target paths, common options, and per-target options in `MitosisConfig` (`packages/core/src/types/config.ts:33-105`).

These features make real projects possible, but they also turn Mitosis into a multi-tree build system rather than merely a component compiler.

## Docs and playgrounds

The current docs are a Qwik City app under `packages/docs/src/routes/docs`, with MDX sections for overview, quickstart, components, hooks, context, configuration, customization, libraries, CLI, Figma, and gotchas. The root `docs/*.md` files are mostly older redirects or drafts; `docs/feature-matrix-draft.md` is effectively empty (`docs/feature-matrix-draft.md:1-18`).

The current playground supports JSX/Svelte input and 16 output choices by invoking core server-side (`packages/docs/src/services/compile.ts:4-40,59-128`). The repository also retains an older independent Next/React/MobX fiddle in `packages/fiddle`, so interactive tooling has two implementations and two UI/framework stacks.

The scaffolder copies a comparatively large template but only offers three target choices (`packages/starter/script.cjs:35-39`). That contrasts with the 22-target compiler registry and raises an onboarding gap between advertised breadth and maintained starter paths.

## Examples

- `examples/basic`: broad configuration/override example.
- `examples/todo`: small component library using Mitosis and Svelte input.
- `examples/metdata`: metadata/plugin-oriented example; the directory name itself is misspelled.

The starter template is more significant than these examples because it includes generated library packages and test apps for selected targets.

## Unit and e2e testing

Core uses Vitest and large per-target snapshots under `packages/core/src/__tests__`; most generator behavior is verified textually. Nx requires core builds before tests because signal tests consume built output (`packages/core/project.json:5-10`; `nx.json:31-45`).

Browser e2e infrastructure includes host projects for Alpine, Angular, Qwik City, React, Solid, Stencil, Svelte, and Vue 3, plus generated output packages (`e2e/*`). The orchestration script builds targets, tolerates build and Playwright failures long enough to collect results, and compares failures against an allowlist (`e2e/e2e-app/e2e.ts:77-93,96-147`). Only two scenario groups are enabled there and the types case is commented out (`:12-16`). `allow-failures.json` explicitly permits Qwik’s two-component failure. The main Playwright file contains several target-specific skips and commented-out assertions, limiting confidence that snapshot-valid code is behaviorally equivalent.

# Candidate design-level failure causes

1. **The authoring language is a narrow, surprising JSX dialect.** Normal component locals, early returns, props defaults/rest, state destructuring, ordinary refs, free callback naming, and several dynamic expressions are invalid or lossy (`packages/eslint-plugin/src/configs/recommended.ts:7-25`; `packages/core/src/parsers/jsx/function-parser.ts:336-346`). Teams must relearn “JSX” while giving up patterns they already use.

2. **The IR is stringly typed below the template tree.** Bindings, state, hooks, dependencies, types, and exports are source strings rather than a semantic AST (`packages/core/src/types/mitosis-component.ts:51-77`; `packages/core/src/types/mitosis-node.ts:63-78`). That forces fragile name/regex rewriting and makes closures, scopes, types, nested mutation, and async behavior difficult to preserve.

3. **The promised common state/lifecycle model has no truly common semantics.** A single `onUpdate` can mean React effect, Svelte reactive statement, Angular `ngOnChanges`, Solid effect only when deps exist, or a Qwik task (`packages/core/src/generators/react/helpers/hooks.ts:63-77`; `packages/core/src/generators/solid/index.ts:204-208`; `packages/core/src/generators/angular/classic/component.ts:401-411`). Users cannot confidently predict behavior across targets.

4. **Target breadth created a handwritten maintenance surface larger than the semantic core.** Roughly 18,000 generator lines independently implement framework syntax and edge cases; Angular alone has parallel classic/signals stacks. Explicit reuse is largely confined to React variants (`packages/core/src/targets.ts:27-49`; `packages/core/src/generators/react-native/index.ts:279-295`; `packages/core/src/generators/rsc/generator.ts:61-87`).

5. **Validation is fragmented and contradictory.** Parser behavior, docs, and recommended lint disagree on ternaries, maps, module exports, and async state; some invalid constructs throw while others are silently ignored or serialized as opaque text (`packages/core/src/parsers/jsx/element-parser.ts:66-157`; `packages/eslint-plugin/src/rules/static-control-flow.ts:25-36`). This makes failures appear late, target-specific, or nondeterministic.

6. **Correctness evidence is uneven across advertised targets.** Browser tests contain target skips, commented assertions, tolerated build/test failures, and an explicit failure allowlist (`e2e/e2e-app/e2e.ts:77-93,114-146`; `e2e/e2e-app/tests/main.spec.ts:9-147`). A design-system team would bear the cost of validating generated behavior in every framework itself.

7. **Escape hatches turn adoption into build-platform ownership.** Plugins may arbitrarily mutate IR/code, `useTarget` embeds framework branches, and override directories replace generated files (`packages/core/src/types/plugins.ts:4-30`; `packages/cli/src/build/build.ts:356-386`). These solve edge cases by moving users away from “write once” toward maintaining compiler configuration and target forks.

8. **Onboarding surfaces do not match the product’s scope or maturity.** The compiler advertises 22 targets, but the starter offers three; docs include stale redirects and an empty feature matrix; two separate playgrounds remain (`packages/starter/script.cjs:35-39`; `docs/feature-matrix-draft.md:1-18`; `packages/docs/src/services/compile.ts:20-40`). That architecture communicates experimentation and uneven support rather than a stable cross-framework contract.

---

## Unit B — output quality, tests, maintenance (full report)

# 1. Generated-output quality per target

Overall: simple templates are usually recognizable, but accepted snapshots contain dead declarations, unnecessary wrappers, obsolete idioms, and—in Qwik—apparently invalid generated code. This does not consistently resemble polished framework-native source.

## React — recognizable, but mechanically generated and sometimes unsafe

Evidence: `packages/core/src/__tests__/__snapshots__/react.test.ts.snap`.

- Duplicate-style imports and dead state in `Basic 1`:

  ```tsx
  import * as React from "react";
  import { useState } from "react";
  const [age, setAge] = useState(() => 1);
  const [sports, setSports] = useState(() => [""]);
  ```

  `React` itself, `age`, `setAge`, `sports`, `setSports`, and `underscore_fn_name` are unused.

- `Basic OnMount Update 1` performs a state update during render:

  ```tsx
  if (!hasInitialized.current) {
    setName("PatrickJS onInit" + props.hi);
    hasInitialized.current = true;
  }
  ```

  Even with the ref guard, a native React author would normally initialize state from props or use an effect; render-phase state updates are fragile under modern/strict rendering.

- `BasicRefAssignment 1` adds needless async machinery:

  ```tsx
  <button onClick={async (evt) => await handlerClick(evt)}>Click</button>
  ```

Verdict: plausible React surface syntax, but visibly generated. Dead hooks, fragments used solely to carry `<style jsx>`, redundant imports, and render-time mutation reduce trust.

## Vue — mostly valid Composition API, but verbose and misses idioms

Evidence: `packages/core/src/__tests__/__snapshots__/vue-composition.test.ts.snap`.

- `Basic 1` turns a synchronous assignment into an async inline template expression:

  ```vue
  @change="async (myEvent) => (name = myEvent.target.value)"
  ```

  A Vue author would commonly use `v-model`, or at least a named synchronous handler.

- `Basic 2` uses nested template wrappers:

  ```vue
  <template :key="index" v-for="(person, index) in names">
    <template v-if="person === name">
  ```

  This is legal but compiler-shaped; the generated `index` exists only for the key.

- `Basic Outputs 1` models outputs as callback props:

  ```js
  const props = defineProps(["onMessageChange", "onEvent", "message"]);
  props.onMessageChange(name.value);
  ```

  That bypasses Vue’s native `defineEmits`/`emit` idiom.

Verdict: generally usable, but not what an experienced Vue 3 author would naturally write. Excess inline handlers, wrapper templates, callback props, and unused refs/state expose the translation layer.

## Svelte — comparatively readable, but legacy and formatting quality varies

Evidence: `packages/core/src/__tests__/__snapshots__/svelte.test.ts.snap`.

- `Basic 1` carries dead declarations and avoids Svelte binding syntax:

  ```svelte
  let age = 1;
  let sports = [""];
  <input value={DEFAULT_VALUES.name || name} on:change={(myEvent) => {
    name = myEvent.target.value;
  }} />
  ```

- `BasicFor 1` emits an unkeyed loop:

  ```svelte
  {#each names as person}
  ```

  This loses identity semantics when the source has or could have a key.

- `BasicRef 1` has conspicuously poor formatting:

  ```svelte
  <select name="cars" id="cars"
    ><option value="supra">GR Supra</option>...
    ></select
  >
  ```

Verdict: among the better targets for simple components, but the output is based on Svelte 3-era `on:` syntax and contains dead declarations, missed `bind:value` opportunities, and occasional machine-like formatting.

## Solid — uses Solid primitives, but bloated and semantically noisy

Evidence: `packages/core/src/__tests__/__snapshots__/solid.test.ts.snap`.

- `Basic 1` imports and creates unused reactive machinery:

  ```tsx
  import { createSignal, createMemo } from "solid-js";
  const [age, setAge] = createSignal(1);
  const [sports, setSports] = createSignal([""]);
  ```

  `createMemo` is unused throughout this example.

- `Basic 2` manufactures an unused index:

  ```tsx
  {(person, _index) => {
    const index = _index();
    return <Show when={person === name()}>
  ```

- `BasicFor 1` wraps the component and every loop body in fragments despite having no structural need:

  ```tsx
  return (
    <>
      <div>
        <For ...>{... return (<>...</>);}</For>
  ```

Verdict: framework-aware but clearly compiler output. It understands signals, `<For>`, and `<Show>`, yet unused imports/setters, eager index reads, and redundant fragments are not polished Solid style.

## Angular — heavily mechanical and sometimes behaviorally wrong

Evidence: `packages/core/src/__tests__/__snapshots__/angular.test.ts.snap`.

- `Basic 1` duplicates imports from the same package:

  ```ts
  import { NgModule } from "@angular/core";
  import { Component } from "@angular/core";
  ```

- `Basic 2` produces difficult-to-maintain template formatting:

  ```html
  <ng-container *ngFor="let person of names"
    ><ng-container *ngIf="person === name"
      ><input ... /></ng-container></ng-container
  >
  ```

- `Basic 1` uses attribute binding for a live input property:

  ```html
  [attr.value]="DEFAULT_VALUES.name || name"
  ```

  The same strategy causes a documented runtime discrepancy: `e2e/e2e-app/tests/main.spec.ts:105-112` says Angular generates `[attr.disabled]`, producing a string that is always truthy; the test special-cases Angular rather than requiring parity.

Every component also receives `:host { display: contents; }`, and non-standalone mode emits a one-component `NgModule`, adding structural weight.

Verdict: unmistakably generated. It preserves Angular syntax but emits duplicate imports, legacy module boilerplate, formatting artifacts, generic `ng-container` layers, and at least one acknowledged semantic mismatch.

## Qwik — accepted snapshots include broken references

Evidence: `packages/core/src/__tests__/__snapshots__/qwik.test.ts.snap`.

- `Basic 1` renames the handler parameter but not its use:

  ```tsx
  onChange$={$((event) => (state.name = myEvent.target.value))}
  ```

  `myEvent` is undefined.

- `BasicRef 1` emits `onBlur` as a standalone export but calls a nonexistent store method:

  ```tsx
  export const onBlur = function onBlur(props, state, inputRef, inputNoArgRef) { ... };
  ...
  onBlur$={$((event) => state.onBlur())}
  ```

- `BasicFor 1` uses an unkeyed JavaScript `.map()` and `<Fragment>`:

  ```tsx
  {(state.names || []).map((person) => {
    return <Fragment>...</Fragment>;
  })}
  ```

  Imports such as `h` and sometimes `Fragment` are also unused.

Verdict: the weakest major target. The code looks translation-oriented rather than native Qwik, relies broadly on `useVisibleTask$`, and current golden snapshots approve unresolved identifiers and nonexistent method calls.

# 2. Cross-target behavioral parity

There **is runtime cross-target infrastructure**, so the repository is not snapshot-only. However, coverage is shallow and explicitly tolerates parity gaps.

- `e2e/e2e-app/playwright.config.ts` runs one shared Playwright suite against Angular, Qwik, React, Solid, Stencil, Svelte, and Vue 3. Alpine is present but commented out.
- `e2e/e2e-app/tests/main.spec.ts` asserts common behavior such as default props, `<For>/<Show>` rendering, styles, disabled inputs, update hooks, and click-driven text changes.
- `.github/workflows/checks.yml` has a dedicated `yarn ci:e2e` job, so this suite is intended to run in CI.

Important limitations:

- Both todo-list tests perform clicks and input but have their actual count assertions commented out:

  ```ts
  // await expect(page.locator('li')).toHaveCount(2);
  ...
  // await expect(page.locator('li')).toHaveCount(3);
  ```

  These tests can pass without the list changing.
- Five conditional `test.skip()` sites exclude known target/feature combinations. Across the configured seven-target matrix, they produce 11 skipped project-test instances: default props (Qwik/Solid), script tags (six targets), styles (Angular), updates (Solid), and outside-type events (Qwik).
- Angular’s disabled-input difference is accepted in the assertion rather than treated as a parity failure.
- This is not a differential oracle comparing DOM/state across outputs. It is a small shared suite with per-target branches.
- `e2e/e2e-app/results.json` is stale: it embeds `/Users/kcordes/projects/Qwik/mitosis`, refers to `example.spec.ts`, and records an old Qwik list-update failure.

Conclusion: behavioral equivalence is tested in principle, not merely snapshot text, but only across a narrow set of cases; some central interaction assertions are disabled and known divergences are skipped or normalized.

# 3. Test/snapshot health

## Skips and todos

Read-only `rg` results over test sources:

- 8 `test.skip()` callsites total.
  - 5 conditional sites in `e2e/e2e-app/tests/main.spec.ts`.
  - 2 skipped Builder regeneration tests in `packages/core/src/__tests__/builder/builder.test.ts:444,472`.
  - 1 skipped local-file test in `packages/core/src/__tests__/local.test.ts:15`.
- 0 `test.todo()`/`it.todo()` callsites.
- Effective standard-matrix skips: 11 Playwright project-test instances plus 3 unit tests = 14.

The Builder skip comments are substantive: “fix divs and CoreFragment” and “don't add extra divs… don't break layout.”

## Snapshot scale and churn

Commands over `packages/core/src/**/__snapshots__` found:

- 46 snapshot files.
- 437,214 lines.
- Approximately 10 MB.
- 570 commits have touched the core snapshot directories.

Major single files include Angular at 33,939 lines, Solid at 19,327, React at 18,097, Qwik at 11,909, and Vue at 10,308.

Churn is extreme:

- `8ad66fd6` (“Feat angular signals”) changed 30 snapshot files: 31,887 insertions and 769 deletions, including a new 28,654-line Angular Signals snapshot.
- `3ac5f630` changed the Angular Signals snapshots by 4,982 insertions/17,978 deletions.
- `072c095d` later changed 29 snapshot files by 6,949 insertions/8,059 deletions.
- A small event-binding fix, `de198af1`, mechanically updated 28 target snapshots.

This breadth makes meaningful review difficult: a golden-text suite can preserve broken output—as the Qwik examples demonstrate—while producing enormous diffs for formatting or generator-wide transformations.

## TODO/FIXME/HACK density

Case-insensitive counts in all of `packages/core`:

- TODO: 169
- FIXME: 0
- HACK: 7

Excluding `__tests__`, 303 TypeScript source files contain 118 TODO and 6 HACK markers across 30,701 lines: 124 markers, approximately **4.0 per KLOC**.

Notable examples:

- `packages/core/src/parsers/jsx/element-parser.ts:141`: “TODO: good warning system for unsupported operators”; JSX spread children are silently returned as `null` at line 166.
- `packages/core/src/generators/qwik/helpers/state.ts:51`: creates a fake `state` variable “even though it is never read.”
- `packages/core/src/generators/qwik/jsx.ts:84`: hard-codes `./med.js`, explicitly “not right.”
- `packages/core/src/generators/react/generator.ts:106`: prop-drilled context refs unsupported, with the author “unclear how to support them.”
- `packages/core/src/generators/svelte/blocks.ts:230`: quoted event-handler values are unhandled.
- `packages/core/src/generators/solid/blocks.ts:103`: style transformation supports only top-level object forms.
- `packages/core/src/generators/angular/classic/blocks.ts:177,203`: regex/text transformations stand in for proper Babel transforms.

# 4. Maintenance signals from git history

## Cadence

`git rev-list --count HEAD` reports **1,904 commits**.

| Year | Commits |
|---|---:|
| 2020 | 257 |
| 2021 | 558 |
| 2022 | 501 |
| 2023 | 193 |
| 2024 | 269 |
| 2025 | 118 |
| 2026 through June 5 | 8 |

Activity peaked in 2021–2022, then contracted sharply. After July 1, 2025, history contains 11 commits: no `feat:` commits, six fixes, four publish commits, and one Builder-symbol change.

The last commit is `a2434f96`, June 5, 2026, an automated package publish. The last clearly substantial feature was `7ca7290d`, June 24, 2025, adding circular-reference removal to the **Builder JSON** generator. For the primary framework outputs, the last substantial feature was Angular Signals work (`3ac5f630`, May 27, 2025); React’s last feature was a style-tag placement option (`d3502a70`, April 4, 2025).

## Contributor concentration

Top author-name counts:

- Steve Sewell: 721 (37.9%)
- Sami Jaber: 487 (25.6%)
- Dylan Kendal: 84
- builderio-bot: 54
- Miško Hevery: 48, plus 26 under “Misko Hevery”

The top two names account for **63.4%** of all commits; the top five displayed identities account for **73.2%**. Alias consolidation would make concentration slightly higher. This is a bus-factor and continuity risk given the later cadence collapse.

## Stale or half-finished work

- `docs/feature-matrix-draft.md`, introduced in May 2022 as “the bone of feature matrix draft,” remains a nearly empty React-only table.
- `packages/docs/src/routes/playground-old/` coexists with the current playground.
- `e2e/e2e-app/e2e.ts` and the `e2e-old` package script remain beside the current Playwright path; the old orchestration catches build/Playwright failures and proceeds.
- `e2e/e2e-app/results.json` is committed stale output containing another developer’s absolute paths.
- Stale, unmerged remote branches include `origin/pr-qwik-upgrade` (April 2023), `origin/docs` (May 2024), `origin/aws-amplify` (June 2024), and `origin/selector-template` (September 2024). `git merge-base --is-ancestor <branch> main` returned 1 for each checked branch. This does not prove abandonment, but their age and lack of merge are strong abandonment signals.

# 5. Feature-support matrix honesty

There is no credible current feature matrix. The repository instead combines broad marketing claims, a skeletal draft, and a stale pass/fail table.

1. **“Compile to every framework” / “fully functional” outputs.** `README.MD:11,26` and `packages/docs/src/routes/docs/overview/index.mdx:9` claim broad functional output for React, Vue, Angular, Qwik, Svelte, Solid, and others. The accepted Qwik snapshots contradict “fully functional”: `Basic 1` references undefined `myEvent`, while `BasicRef 1` calls nonexistent `state.onBlur()`. Generator source also throws `Qwik: Functions are not supported in context` in `packages/core/src/generators/qwik/component-generator.ts:276`.

2. **All-green E2E matrix.** `docs/test-status.md` marks Qwik multiple components and Alpine green. Yet `e2e/e2e-app/allow-failures.json` explicitly allows Qwik’s `02-two-components` failure, and Alpine is commented out of the current `playwright.config.ts`. The current todo-list assertions are commented out. The table was generated by the now-legacy `e2e.ts` path, not the current suite, so the green checks overstate present evidence.

3. **“These same steps work for any other output frameworks.”** `packages/docs/src/routes/docs/quickstart/index.mdx:97` makes this universal claim. Actual generators expose target-specific holes: React prop-drilled context refs are TODO/unsupported (`react/generator.ts:106`); Solid style handling supports only limited expression shapes (`solid/blocks.ts:103`); Svelte event values do not handle quotes (`svelte/blocks.ts:230`); Angular explicitly uses helper rewrites because templates cannot represent general JS (`angular/classic/blocks.ts:156`). The docs do not surface these qualifications near the claim.

The most candid artifact is accidentally the source itself. The public-facing matrix does not enumerate unsupported hooks, expressions, context values, spreads, styles, refs, or target-specific runtime exceptions.

# 6. Developer experience surface

## Error-message quality

There are a few actionable messages:

- `packages/core/src/parsers/jsx/hooks/use-target.ts:81`: `ERROR Parsing useTarget(): properties cannot be spread or references`.
- The same file validates identifier keys and names the invalid target.
- `packages/core/src/parsers/jsx/state.ts:343`: `Parse Error: Mitosis cannot consume spread element in state object`.
- `packages/core/src/generators/qwik/component-generator.ts:276`: `Qwik: Functions are not supported in context`.

But the broader story is poor:

- Unsupported logical operators have only a TODO and no warning (`element-parser.ts:141`).
- JSX spread children are silently dropped with `return null` (`element-parser.ts:166`).
- `onEvent` errors merely `console.warn` and skip the hook (`function-parser.ts:108-128`).
- Invalid Builder bindings can be dropped with warnings (`parsers/builder/builder.ts:135,736,1305`).
- Invalid Mitosis attributes are skipped (`generators/mitosis/generator.ts:177-208`).
- One Builder path throws a bare string, `throw 'unsupported style'` (`generators/builder/generator.ts:625`).
- Generic failures such as `Could not parse JSX` and `Unexpected state value type` do not include source file, line, or target context.
- Formatting failures often print the entire generated string or JSON, creating noise rather than a localized diagnostic.

Thus unsupported input may fail loudly, warn and continue with missing behavior, or disappear silently depending on the construct.

## Source maps and debugging

A repository-wide search found no generated-component source-map implementation or generator option. The only relevant configuration is `packages/cli/tsconfig.json:7` with `inlineSourceMap: true`, which maps the CLI’s own compiled JavaScript—not generated framework components back to `.lite.tsx` sources.

Generators return formatted strings; snapshots contain no mapping metadata or source annotations. Consequently:

- Framework compiler errors point at generated output.
- Runtime stack traces point at generated React/Vue/Svelte/etc. files.
- Authors must manually relate generated code back to the Mitosis source.
- Formatting and identifier-rewrite bugs, such as Qwik’s `myEvent`, have no origin mapping to aid diagnosis.

Playwright enables traces and screenshots, which helps reproduce runtime failures but does not solve source-level debugging.

# Candidate quality/maintenance failure causes

1. **Golden snapshots accepted objectively broken output.** Qwik snapshots approve undefined `myEvent` and nonexistent `state.onBlur()`. A 437K-line golden corpus is too large for reliable semantic review.

2. **The cross-framework abstraction does not deliver strong parity.** Shared E2E coverage exists, but central list assertions are commented out; 11 target-test instances are skipped; Angular’s incorrect disabled behavior is explicitly accepted.

3. **Generated code often fails the “native code” promise.** Dead state/imports appear across React, Vue, Svelte, and Solid; Angular has wrapper/import/attribute artifacts; Qwik output is translation-shaped and sometimes invalid. Consumers inherit code they may be reluctant to own.

4. **Unsupported constructs fail inconsistently and can be silently removed.** Hooks, attributes, bindings, JSX spreads, and operators may throw, warn, or disappear. This makes correctness depend on knowing undocumented compiler boundaries.

5. **The support story is materially more confident than the evidence.** “Every framework,” “fully functional,” “any other output,” and an all-green E2E table obscure generator TODOs, runtime exceptions, skipped targets, and allowed failures.

6. **Snapshot scale creates high review and maintenance cost.** Forty-six files/10 MB/437K lines and multi-thousand-line mechanical diffs make regressions easy to miss and every cross-cutting change expensive to validate.

7. **Maintenance and ownership contracted sharply.** Commits fell from 558/501 in 2021/2022 to 118 in 2025 and eight through June 2026; no feature-prefixed commit landed after June 2025. Two contributors authored 63.4% of history.

8. **Debugging generated failures is expensive.** There are no generated-code source maps, errors rarely contain source locations, and committed stale test artifacts/legacy paths complicate understanding which validation story is authoritative.
