# Frameless: ship the framework code before the framework wins

New frameworks usually die of cold-start. A library author will not support a framework with few users, and users will not adopt a framework with few libraries. Frameless inverts that loop: write a component once in TSRX, ship ordinary React and Solid packages now, and attach machine-checkable receipts showing that the packages behave the same. A library can reach established ecosystems before markless itself has meaningful market share. If the framework never wins, consumers still own framework-native source. That compile-out exit hatch reverses the usual lock-in fear. [strategic bet]

Markless is the framework and semantic model. TSRX is its native component syntax. Frameless is a separate portability compiler, oracle, and receipt format. An **oracle** is a checker that sends the same interactions to two components and compares what a user can observe. Frameless components are written in TSRX, but Frameless is its own brand and its output does not require a markless runtime.

There are two broad ways to enter an existing ecosystem. A compat-in runtime accepts existing React code, which makes migration easy but also accepts React's semantic ceiling. A compile-out tool starts from a cleaner source model and turns new components and libraries into React, Solid, and eventually other native targets. Frameless takes the second path and makes the translation testable.

The market has already confessed the pain. [TanStack Query](https://github.com/TanStack/query/releases) publishes separate React, Solid, Vue, Svelte, Angular, Lit, and Preact integrations in one release train. [Zag](https://github.com/chakra-ui/zag/tree/main/packages/frameworks) maintains framework adapters. Prime maintains separate [React](https://github.com/primefaces/primereact), [Vue](https://github.com/primefaces/primevue), and [Angular](https://github.com/primefaces/primeng) implementations. These are successful, rational workarounds. They also show that multi-framework maintenance is endemic: teams trusted hand-maintained adapters more than compile-to-framework output. Mitosis did not lose because the pain was imaginary. It lost because it did not produce trustworthy receipts. [opinion]

This report asks two separate questions:

1. Did the proof-of-concept compiler preserve behavior for its tested surface?
2. Will that surface become a successful product and market?

The first has test evidence. The second remains a set of explicit bets.

## Why Mitosis failed

Mitosis tried to let authors write one JSX-like component and generate many frameworks. The idea attracted attention, but its compiler model made ordinary code lossy, target behavior divergent, and generated failures hard to trust. The adoption evidence is consistent with a real but niche market and an execution-and-ownership failure. It does not prove that cross-framework compilation is impossible. [POC: poc/01-mitosis-static] [POC: poc/02-mitosis-divergence]

### The compiler forgot JavaScript structure

Mitosis 0.13.2 parses JSX with Babel, but then stores component behavior mainly as strings inside a JSON template tree. Its intermediate representation, or **IR**, is the compiler's internal description of a program. Mitosis's IR has no complete symbol table, lexical scope model, closure model, or general statement control flow. Target generators recover meaning by reparsing and rewriting snippets, regexes, and names. Its major targets occupy roughly 18,000 lines of target-specific generator code, while output is assembled mainly by string concatenation and then handed to Prettier. [evidence: docs/goals/frameless-mitosis-successor/notes/T001-mitosis-map.md]

That architecture explains a surprising authoring dialect. Ordinary component-body locals, early returns, state destructuring, general prop defaults/rest, and several normal JSX control-flow forms are missing, banned, or lossy. Validation is split among parser pattern matching, explicit parser errors, and a separate lint preset; the three do not always agree. [POC: poc/01-mitosis-static]

Here is the smallest failure:

```tsx
export default function Greeting(props) {
  const greeting = `Hello, ${props.name}!`;
  return <div>{greeting}</div>;
}
```

Mitosis reports success and prints a React component that still reads `greeting`, but the declaration is gone. The proof captures every standard console method and observes no error or warning. Babel scope analysis then proves that the remaining read is unbound. **C1:** for this fixture and Mitosis 0.13.2, an ordinary component-body local is silently discarded while its use survives. [POC: poc/01-mitosis-static]

Name rewriting can fail in the opposite direction. This reasonable state method:

```tsx
const state = useStore({
  foo: 'outer value',
  doSomething() {
    const foo = state.foo;
    console.log(foo);
  },
});
```

contains the collision class documented in Mitosis's own gotchas. The emitted construct is:

```js
const foo = foo;
```

The right-hand `foo` resolves to the binding being declared, so JavaScript throws a temporal-dead-zone `ReferenceError`. **C2:** for this fixture and Mitosis 0.13.2, string-based identifier rewriting produces a semantically invalid self-reference from reasonable input. [POC: poc/01-mitosis-static]

The snapshot suite did not protect users from that class of defect. Regenerating Mitosis's upstream `Basic` fixture for Qwik produces this handler:

```tsx
onChange$={$((event) => (state.name = myEvent.target.value))}
```

`myEvent` is unbound. The regenerated bytes equal the repository's committed golden snapshot, and Babel scope analysis finds the same unresolved identifier in both. **C3:** Mitosis 0.13.2 emits unresolved `myEvent`, and the repository's accepted golden snapshot contains the same defect. [POC: poc/01-mitosis-static]

This was not an isolated testing philosophy. The repository contained 46 core snapshot files totaling about 437,000 lines and 10 MB. Shared browser tests existed, but central todo-list count assertions were commented out; known target cases were skipped; and Angular's wrong `disabled` behavior was special-cased rather than rejected. Those observations are architecture evidence, not a claim that every Mitosis output is broken. [evidence: docs/goals/frameless-mitosis-successor/notes/T001-mitosis-map.md] [POC: poc/02-mitosis-divergence]

### One source did not mean one behavior

Mitosis exposed common lifecycle names without a common observable contract. A dependency-free `onUpdate` becomes a React `useEffect`, while the Solid generator has an explicit `if (!hook.deps) return ''`. The same source therefore emits:

```jsx
// React 18.3.1 output
useEffect(() => {
  props.onProbe?.('update');
});
```

and:

```jsx
// Solid 1.8.22 output
// no corresponding update callback
```

The runtime proof mounts both outputs, observes mount, clicks the same increment button, and checks both DOMs. Both counters move from `0` to `1`; React calls the probe after mount and update, while Solid never calls it. **C4:** for this dependency-free `onUpdate` fixture under the pinned toolchains, the React and Solid outputs have observably different callback behavior. No broader lifecycle claim is implied. [POC: poc/02-mitosis-divergence]

Mitosis 0.13.2 also emits Solid v1 imports that Solid 2 no longer exports, and it exposes no framework-major targeting option. That makes the external complaint about version control concrete for this output and these versions. [POC: poc/02-mitosis-divergence]

### Attention did not become a healthy ecosystem

**C5 is a set of date-stamped sourced facts, not a POC.** Research performed on 2026-07-19 identified 13,895 GitHub stars but about 7,600 weekly downloads for `@builder.io/mitosis` during July 12–18, 2026. For the same week, Stencil had about 1.27 million downloads and Lit about 6.22 million. These numbers are consistent with cross-framework demand flowing mostly to web components; they do not measure unique production users. [GitHub](https://api.github.com/repos/BuilderIO/mitosis), [npm Mitosis](https://api.npmjs.org/downloads/point/2026-07-12:2026-07-18/@builder.io/mitosis), [npm Stencil](https://api.npmjs.org/downloads/point/2026-07-12:2026-07-18/@stencil/core), [npm Lit](https://api.npmjs.org/downloads/point/2026-07-12:2026-07-18/lit). [POC: not applicable; date-stamped source evidence]

The same research identified two verified production adopters: Builder.io's own generated SDKs and Deutsche Bahn's DB UX design system. It did not verify the often-repeated AWS Amplify adoption. Amplify's public RFC instead chose hand-written framework implementations because it wanted each framework's components to feel native to that framework. [Builder SDK](https://www.npmjs.com/package/@builder.io/sdk-qwik), [DB UX](https://github.com/db-ux-design-system/core-web), [Amplify RFC #3933](https://github.com/aws-amplify/amplify-ui/issues/3933). **C5** does not claim that no other private adopters exist. [POC: not applicable; date-stamped source evidence]

Maintenance also contracted. Local history counted 558 commits in 2021, 501 in 2022, 118 in 2025, and eight through June 5, 2026; the last substantial feature for primary framework outputs was recorded in 2025. The top two contributor names accounted for 63.4% of commits. Builder later shifted its public strategy toward Qwik governance and Fusion, but no source says it formally deprecated Mitosis, so the connection is an inference rather than an announced cause. [Qwik governance](https://www.builder.io/blog/qwik-next-leap), [Fusion launch](https://www.builder.io/blog/fusion). [evidence: docs/goals/frameless-mitosis-successor/notes/T001-mitosis-map.md]

The strongest field report came from Voorhoede in September 2024. It described testing and debugging as painful, reported stripped logs, no generated-output validation, and no framework-version targeting, and recommended against making Mitosis the foundation of a design system. SAP Fundamental Library's 2022 evaluation liked the concept but said the development experience was not ready. These reports support an execution problem; neither proves the category cannot work. [Voorhoede](https://www.voorhoede.nl/en/blog/write-components-once-run-everywhere-with-mitosis-a-beautiful-dream-or-reality/), [SAP Fundamental Library](https://medium.com/fundamental-library/exploring-cross-framework-development-2bdcb26fe6a). **C5** is limited to those sourced observations. [POC: not applicable; date-stamped source evidence]

## What Frameless does differently

Frameless treats trustworthy translation as a chain of evidence:

```text
TSRX source
  -> markless semantic graph
  -> Frameless enriched IR
  -> framework AST emitter
  -> React / Solid source
  -> same-scenario equivalence oracle
  -> receipt
```

A semantic graph records identities and relationships: this state path was read, that handler wrote it, this computed value depends on it, and this keyed row owns these nodes. The **enriched IR** joins those records to the missing program structure: initializer expressions, complete template trees, branch arms, ordered children, attributes, and handler syntax. An **AST**, or abstract syntax tree, is code represented as structured nodes rather than a pasted string. Frameless's emitters build framework ASTs and print them. They do not use string templates for program logic. [POC: poc/03-markless-graph] [POC: poc/05-enriched-ir]

### A concrete source-to-output example

This TSRX source has ordinary locals, mutable state, a computed value, a structural branch, and a callback:

```tsx
export function RenderOnce({ label, multiplier, visible, onTrace }) @{
  const setup = onTrace('setup', { runs: 1 });
  let count = state(1);
  const prefix = `${label}:`;
  const derived = computed(() => `${prefix}${count * multiplier}`);

  <div>
    @if (!visible) { <p>hidden</p> }
    @else {
      <section>
        <output>{derived}</output>
        <button onClick={() => { count++; onTrace('change', { count }); }}>
          increment
        </button>
      </section>
    }
  </div>
}
```

Frameless's React output maps visible state to `useState`, captures the render-once local once, and derives the cheap value during render:

```jsx
const didRunSetup = useRef(false);
if (!didRunSetup.current) {
  didRunSetup.current = true;
  onTrace('setup', { runs: 1 });
}
const [count, setCount] = useState(() => 1);
const [prefix] = useState(() => `${label}:`);
const derived = `${prefix}${count * multiplier}`;
```

Its Solid output uses setup-once execution and signals:

```jsx
props.onTrace('setup', { runs: 1 });
const [count, setCount] = createSignal(1);
const prefix = `${props.label}:`;
const derived = () => `${prefix}${count() * props.multiplier}`;
```

Those fragments are not asserted equivalent because they look similar. The oracle drives the completed components and compares observations. [POC: poc/06-emit-react] [POC: poc/07-emit-solid] [POC: poc/08-equivalence-results]

### What the graph and compiler prove

**C6:** under markless 0.1.1, five fixture shapes that mirror Mitosis's failure surface compile and preserve their tested client-side rendering behavior in headless Chromium: component-body locals, a closure with a colliding local name, prop destructuring, ordinary deep assignment/mutation, and `return null` before the template root. This is fixture-scoped; it is not a promise about every JavaScript construct. [POC: poc/03-markless-graph]

**C7:** for the todo fixture, `SemanticGraphArtifact` stores typed, ID-linked records for writable state, path-level reads and writes, computed dependencies, branch sites, keyed repeats, events, and destructuring aliases. It correctly links state to computed data and computed data to a host update. Expression bodies still contain source-string fields; the proof explicitly tests and discloses that limitation. [POC: poc/03-markless-graph]

The semantic graph alone is not enough to recreate a component. It lacks full host-tree structure, static text and attributes, branch-arm templates, local initializers, and structured expressions. Frameless therefore builds `frameless-enriched-ir/1` from the TSRX syntax tree plus semantic records. The artifact is versioned and serializable, and its tests prove closure of graph IDs and coverage of every host shape for S1–S3. [POC: poc/05-enriched-ir]

**C8:** for the S1–S3 fixture family, that enriched IR is sufficient input for real React and Solid AST emitters. React is the primary evidence: its emitter is structural, survived a fixture contract change without modification, passes strict type/build checks, React and Hooks lint, and AST policies that reject unused code, unstable keys, render-phase setters/effects, invalid hook sites, undisclosed imports, and bypass attempts. Solid is secondary evidence that `frameless-enriched-ir/1` is consumable by a second, paradigm-different backend for the fixture family. Its adversarially established generality boundary is explicit: keyed-repeat keys are validated but not lowered, row reactivity relies on the fixtures' in-place mutation plus array refresh, and constructs outside the supported vocabulary fail closed—they are rejected instead of guessed at. This is not a production-general Solid emitter. [POC: poc/05-enriched-ir] [POC: poc/06-emit-react] [POC: poc/07-emit-solid]

The gate is a published, machine-checkable **conventionality gate**, not a claim that generated style is subjectively perfect. React S2 is 2.10 times the handwritten baseline's nonblank lines, although its AST node count is 1.11 times the baseline. Solid S2 is 1.67 times the handwritten lines. Size is reported, not hidden or passed by redefining the metric. [POC: poc/06-emit-react] [POC: poc/07-emit-solid]

**C11:** for three unsupported fixtures—event spread, object-valued `style`, and an unkeyed `@for`—markless 0.1.1 emits an error with file, exact source span, message, reason, suggested rewrite, and documentation URL. The C1-mirror local fixture emits no diagnostic because it is supported. This is a fixture-scoped compile-time result. Runtime source maps remain open. [POC: poc/03-markless-graph]

### Effects are not an authoring primitive

Markless deliberately has no author-facing effect primitive. That is load-bearing, not an omission to paper over. The tested React outputs for S1–S3 contain zero `useEffect` calls. Pure derived values compute during render, so authors do not write dependency arrays and the compiler does not create synchronization work that the component never needed. [POC: poc/06-emit-react]

There are still real lifecycle needs. They fall into four buckets:

- **Derivation:** use `computed`, not an effect.
- **Element lifecycle:** use `attach`, with owner-scoped cleanup.
- **Data coming in:** use async computed values or events.
- **State going out:** the design direction is a declared one-way sink.

A sink would read the graph but could not write it, so sinks could not cascade into each other. React could receive a generated effect or external-store adapter; Solid could receive `createEffect`. In either case, exact dependencies would come from typed path-level graph records, not from author-maintained arrays or Mitosis's comma-split dependency strings. This sink is a stated direction, not a current capability, and no fixture in this report exercises it. [opinion]

Where attach behavior or async work genuinely requires React effects, Frameless's intended rule is compiler-derived exact dependencies. Under that design, authors cannot omit a dependency or hand the compiler a stale list; that footgun is removed at the language level. This has not yet been proved for attach or async output. Passive-versus-layout timing is target-specific, and attach mapping must get its own oracle round before any equivalence claim. [strategic bet]

### The oracle, in plain language

The oracle sends the same clicks and inputs to each implementation. After mount, immediately before and after every event, after one microtask, and at bounded quiescence—the point where observable output stops changing—it asks: did the DOM look the same, did live form values match, did focus and selection stay put, did keyed rows keep the same node identity, and did callbacks occur in the same order with the same payload and cancellation state? **CSR**, or client-side rendering, means this run happens in the browser rather than on the server. [POC: poc/04-equivalence-oracle]

Normalization is allowlist-only. The checker removes known framework-owned markers; it does not erase arbitrary `data-*`, classes, styles, or unknown attributes until two outputs look equal. Settlement has a 500 ms bound and uses no sleeps. [POC: poc/04-equivalence-oracle]

Most importantly, the checker is tested against lies. Calibration mutants produce wrong text, a wrong live input property, missing and reordered callbacks, a remounted keyed row, wrong `preventDefault`, a duplicate handler call, and a microtask-delayed update. Every mutant must be rejected in the expected observation channel. The final C9 run repeats representative DOM, callback, identity, cancellation, and multiplicity mutants in Chromium. [POC: poc/04-equivalence-oracle] [POC: poc/08-equivalence-results]

**C9:** for S1–S3, Frameless-emitted React and Solid are behaviorally equivalent to each other and to handwritten React and Solid references under the calibrated oracle. All five emitted/handwritten cross-pairs per scenario pass, for 15 passing pairs. The markless-native leg is blocked by enumerated markless 0.1.1 composition gaps, findings #3, #5, #6, #7, and #8. S1's DOM channel passed fully against both handwritten references before the callback channel blocked; that is partial evidence, not a whole-pair pass. [POC: poc/08-equivalence-results]

Condensed from the machine-generated receipt:

| Scenario | Emitted React ↔ handwritten React | Emitted Solid ↔ handwritten Solid | Cross-framework emitted/reference pairs | Emitted React ↔ emitted Solid | Markless-native pairs |
| --- | --- | --- | --- | --- | --- |
| S1 render-once locals | equal | equal | 2 equal | equal | blocked upstream; 2 DOM-only partials |
| S2 keyed todo | equal | equal | 2 equal | equal | blocked upstream |
| S3 event form | equal | equal | 2 equal | equal | blocked upstream |

[POC: poc/08-equivalence-results]

### Claim map

| ID | Final status and boundary | Receipt |
| --- | --- | --- |
| **C1** | Proven for one local-variable fixture on Mitosis 0.13.2; silent drop leaves an unbound read. | [POC: poc/01-mitosis-static] |
| **C2** | Proven for one documented collision fixture on Mitosis 0.13.2; output contains a TDZ self-reference. | [POC: poc/01-mitosis-static] |
| **C3** | Proven for the upstream Basic/Qwik fixture; unresolved `myEvent` is also in the accepted golden. | [POC: poc/01-mitosis-static] |
| **C4** | Proven dependency-free `onUpdate` React/Solid callback divergence under pinned versions. | [POC: poc/02-mitosis-divergence] |
| **C5** | Date-stamped adoption and maintenance facts; research identified two adopters and does not claim exhaustiveness. | [POC: not applicable; linked source evidence] |
| **C6** | Proven markless 0.1.1 acceptance and tested CSR behavior for five fixture shapes. | [POC: poc/03-markless-graph] |
| **C7** | Proven typed, ID-linked graph records for the todo fixture, with source-string caveat. | [POC: poc/03-markless-graph] |
| **C8** | Proven fixture-family enriched-IR sufficiency; React is primary evidence, Solid is scoped secondary evidence with an explicit generality boundary. | [POC: poc/05-enriched-ir] [POC: poc/06-emit-react] [POC: poc/07-emit-solid] |
| **C9** | Proven 15-pair emitted/handwritten equivalence and mutant rejection; markless-native is blocked upstream. | [POC: poc/08-equivalence-results] |
| **C10** | Not a claim. It is the authoring comparison below. | [POC: poc/01-mitosis-static] [POC: poc/03-markless-graph] |
| **C11** | Proven actionable file/span/message diagnostics for three unsupported markless fixtures. | [POC: poc/03-markless-graph] |

### C10: an authoring comparison, not a claim

| Common need | Naive Mitosis spelling/result | TSRX spelling/result |
| --- | --- | --- |
| Component local used by markup | Ordinary `const` disappears; use remains unbound in the C1 fixture. | Ordinary `const` compiles and renders in C6a. |
| Local named like state | Rewrite produces `const foo = foo` in the C2 fixture. | Handler local `const open = menu.open` compiles and behaves in C6b. |
| Props destructuring | Restricted and rewrite-sensitive. | Plain destructuring works in the tested C6c path; aliased child composition has an honest markless 0.1.1 gap. |
| Deep mutation | Requires Mitosis-specific state conventions and generator rewrites. | Nested assignment, `++`, and `push` behave in C6d. |
| Guard before markup | General early-return control flow is not represented. | `if (hidden) return null` works in C6e; returning an element exposes finding #1 below. |

[POC: poc/01-mitosis-static] [POC: poc/03-markless-graph]

## The honesty chapter: the harness caught the reference implementation

The markless-native failures are not an embarrassing appendix. They are the strongest evidence for Frameless's method. The same harness intended to certify generated targets caught the reference framework itself. A tool that had normalized these differences away could have printed a clean matrix and shipped bugs. Receipts turned them into a concrete pre-launch roadmap. [opinion]

These are the eight findings, at verbatim-level specificity:

1. **Guard-returning-an-element is accepted semantically but emitted as invalid JavaScript.** `if (!visible) return <p>hidden</p>` passes the semantic compiler, but the bundler client transform leaves raw JSX in the output and Vite rejects it. The runtime fixture moved to root-level `@if/@else`; `return null` remains proven separately. What it means: the compiler and bundler disagree, so this shape must be lowered or rejected with a diagnostic. [POC: poc/05-enriched-ir] [POC: poc/08-equivalence-results]

2. **Authored template whitespace is preserved as real text nodes.** Multiline fixture text produced a DOM difference; the fixture was changed to single-line text. The oracle did not discard the whitespace. What it means: whitespace needs a specified source contract or intentional lowering rule, not a normalization loophole. [POC: poc/08-equivalence-results]

3. **“Root props.”** In `@markless/web`, `packages/web/src/render.ts:71` calls `component.renderCsr()` with no props even though `CsrRenderArtifact` advertises `renderCsr(props?: unknown)` at line 25. What it means: public CSR mount cannot supply the scenario's root props, forcing zero-prop wrapper components. [POC: poc/08-equivalence-results]

4. **Object-literal callback payload production-symbol parsing breaks.** Lazy-symbol lowering rewrites reads inside payload objects into invalid property syntax. For example, `onTrace('change', { count })` becomes an object containing `context.graph.read(...)` where a property is required; Rolldown reports `Expected ',' or '}' but found '.'`. Evidence sites are `src/fixtures/s1-render-once.tsrx:19` and `src/fixtures/s3-event-form.tsrx:30,40`. What it means: production bundling can fail before browser execution even when the development path proceeds. [POC: poc/08-equivalence-results]

5. **“Bare component at template root CSR-renders empty, silently.”** Markless `packages/compiler/src/passes/public-render/template.ts:164-170` returns empty static HTML when that component root is unavailable. The workaround is visible at `poc/08-equivalence-results/src/wrappers/s1-visible.app.tsrx:5-12`; the adapter observes inside the added host. What it means: basic child composition needs a host wrapper today, and silence makes the failure dangerous. [POC: poc/08-equivalence-results]

6. **“Aliased prop destructuring — `{ label: displayLabel }` — arrives undefined in child-component composition; plain destructuring works, c6c.”** `packages/compiler/src/passes/public-render/shared.ts:218-232` collects the local alias, while lines 49–50 destructure that local name from props and lose the authored key. The compile-only repro is `poc/05-enriched-ir/src/fixtures/alias-coverage.tsrx`. What it means: the semantic alias exists, but runtime child composition does not preserve it. [POC: poc/05-enriched-ir] [POC: poc/08-equivalence-results]

7. **“Multi-parameter callback props: lazy-symbol codegen references unbound parameters — `payload is not defined` in wrapper callback symbol.”** Evidence is in `poc/08-equivalence-results/src/wrappers/s1-visible.app.tsrx:10`, `s1-hidden.app.tsrx:10`, `s2.app.tsrx:11`, and `s3.app.tsrx:8`. What it means: callback composition cannot carry the oracle payload reliably. It blocked S1's callback channel after its DOM channel had passed. [POC: poc/08-equivalence-results]

8. **“Prop-derived state in child components never wires into the runtime graph: S2 child handlers crash on null graph reads while mount DOM renders.”** Prop-derived state starts at `poc/08-equivalence-results/src/fixtures/s2-keyed-todo.tsrx:4`; the S2 action sequence reproduces the crash. What it means: a component can look correct at mount and still have unusable interactions—the exact reason a click-by-click receipt matters. [POC: poc/08-equivalence-results]

Findings #3, #5, #6, #7, and #8 are the sanctioned blockers on every markless-native C9 pair. Findings #1, #2, and #4 remain real roadmap evidence but are not listed as blockers for those final pair records. [POC: poc/08-equivalence-results]

### The Solid boundary is real

The Solid emitter passed S1–S3 and consumes the enriched IR structurally. It also passed bounded repairs that reject unconsumed fields, dangling semantic IDs, async state, unsupported guards, and other unknown constructs. But adversarial review showed that schema-valid extensions could still lower incorrectly outside this family. The emitter validates a keyed-repeat key without emitting that key; Solid's `<For>` uses row-object identity and depends on the fixtures' mutation discipline. Other row reads, immutable row replacement, broader branch/list combinations, or a bypassed gate are not covered. [POC: poc/07-emit-solid]

That limitation changes the roadmap, not the recorded pass. React remains the primary C8 evidence. Solid shows that a second and very different reactive backend can consume the IR for this family. It does not establish a general Solid compiler. [POC: poc/07-emit-solid]

Solid version evidence is also bounded. Frameless intends to target Solid 2, but `solid-js@2.0.0-experimental.16` has no `./web` export and the available `vite-plugin-solid@2.11.0` toolchain is Solid 1-oriented. Runtime receipts therefore use the explicitly labeled Solid 1.8.22 fallback. No Solid 2 runtime-equivalence claim is made. [POC: poc/04-equivalence-oracle] [POC: poc/07-emit-solid] [POC: poc/08-equivalence-results]

### What remains out of scope

The current receipts do **not** cover:

- async semantics, cancellation, pending/error arms, or async settlement;
- cleanup or `attach` timing;
- slots, children, context, or richer component composition;
- styling and dynamic style objects;
- multi-module builds or custom components;
- performance or bundle size as a gate;
- accessibility behavior;
- framework-version ranges, including Solid 2 runtime validation;
- server-side rendering, hydration, or resume behavior;
- hot-module replacement;
- type-preserving emission;
- source maps and generated-code debugging;
- SVG/MathML and broader namespace coverage;
- production-grade emitters or targets beyond the fixture family.
- integration of markless Analyzer/Witness into the oracle; the current harness is purpose-built.

[POC: poc/03-markless-graph] [POC: poc/05-enriched-ir] [POC: poc/06-emit-react] [POC: poc/07-emit-solid] [POC: poc/08-equivalence-results]

Generated-code debugging deserves special emphasis. It was the number-one external Mitosis complaint in the available field evidence, and it remains open for both tools. Mitosis has no generated-component source-map implementation in the examined code. Markless's production transform returns `map: null`. Frameless has not solved that. [Voorhoede](https://www.voorhoede.nl/en/blog/write-components-once-run-everywhere-with-mitosis-a-beautiful-dream-or-reality/) [POC: poc/03-markless-graph]

The five composition blockers in C9, plus guard-element lowering, are markless 0.1.1's immediate pre-launch roadmap. This is not ancillary cleanup. Composition is the unlock for design systems, the market Frameless is supposed to serve.

## Strategic bets

### B1 — Frameless creates a two-sided funnel [strategic bet]

Frameless is the front door. A React-focused library author can adopt TSRX to generate React today, then add Solid without rewriting the source. Because TSRX is markless's native language, the same source can later run natively in markless. In the other direction, a markless library author can emit packages for ecosystems that already have users. More syntax users create more markless-ready libraries; more markless libraries become available to established frameworks through Frameless. The POCs show that this loop is technically possible for S1–S3. They do not prove adoption.

> **How the funnel works technically**
>
> The npm package name is TBD. The eventual Frameless package should re-export the `@markless/core` authoring API. Markless's semantic collectors currently recognize APIs by import source and reject aliases, so the compiler needs a configurable accepted-import-source list containing `@markless/core` and the eventual Frameless package specifier. That is one configuration-level change, not a second semantic model. Then one file can go through Frameless's emitters or markless's native compiler with no source rewrite. This accepted-source change belongs in the markless repository and is outside the current goal. [strategic bet]

### B2 — design systems are the right wedge [strategic bet]

Library and design-system teams feel multi-framework cost directly. TanStack, Zag, Prime, Deutsche Bahn, Builder's SDKs, and Amplify's framework-specific RFC all point at that burden. They also show the trust barrier: teams would rather staff multiple adapters than accept unverifiable generated code. Frameless's answer is not “trust the compiler.” It is “run the same public scenarios and inspect the receipts.” The addressable group is probably small; the evidence is consistent with a niche, not a mass-market replacement for application frameworks.

### B3 — graph plus AST emitters plus oracle can contain maintenance [strategic bet]

Mitosis accumulated roughly 18,000 lines of target-specific generators around a string-heavy IR and validated much of the result through enormous snapshots. Frameless bets that explicit semantic records, a versioned enriched IR, AST emitters, fail-closed gates, and target-neutral behavior checks make each backend tractable. The React POC and bounded Solid POC are supporting evidence, not proof of long-term maintenance cost.

### B4 — AI makes receipts more valuable [opinion]

AI can produce a plausible framework port cheaply. It cannot make that port behaviorally trustworthy merely by producing it. An oracle that compares DOM, identity, form state, callbacks, and timing can judge human- or AI-written backends the same way. In that world the compiler is replaceable implementation work; the semantic contract, adversarial scenarios, and receipts are the moat.

## What would change our minds

Frameless should be abandoned or materially redesigned if any of these happen:

- A representative design-system composition suite cannot fit one target-neutral observable contract without pervasive target escape hatches.
- Production React and Solid emitters require target-specific source forks for ordinary components rather than bounded adapters.
- Mutation testing finds important differences that the oracle cannot observe without framework internals.
- The composition surface—children, slots, context, callback props, and prop-derived state—cannot pass across markless, React, and Solid after the upstream gaps are fixed.
- Generated output repeatedly fails the published conventionality gates or becomes materially harder to maintain than hand-written adapters.
- Design-system maintainers try the receipt workflow and still prefer separate implementations because the authoring or debugging cost is higher.
- Source maps and error localization prove infeasible across the source-to-enriched-IR-to-target-AST chain.

Those are falsifiable product and engineering tests, not goals Frameless can declare complete by adding more targets. [opinion]

## Re-run every receipt

Each POC is self-contained. Install steps may need registry access; tests themselves are designed to be deterministic and network-free.

```sh
# C1, C2, C3
cd poc/01-mitosis-static
MITOSIS_REPO=/Users/jacksm5pro/dev/open-source/mitosis pnpm install
MITOSIS_REPO=/Users/jacksm5pro/dev/open-source/mitosis pnpm test

# C4
cd ../02-mitosis-divergence
pnpm install
pnpm test

# C6, C7, C11
cd ../03-markless-graph
pnpm install
pnpm test

# Oracle calibration and mutant corpus
cd ../04-equivalence-oracle
pnpm install
pnpm test

# Enriched IR
cd ../05-enriched-ir
pnpm install --frozen-lockfile --prefer-offline
pnpm test

# React emitter and conventionality gate
cd ../06-emit-react
pnpm install
pnpm test

# Solid emitter, regeneration, and bounded gate
cd ../07-emit-solid
pnpm run regenerate && pnpm test

# Final Chromium cross-matrix and verdict artifacts
cd ../08-equivalence-results
pnpm install --offline
pnpm test
```

[POC: poc/01-mitosis-static] [POC: poc/02-mitosis-divergence] [POC: poc/03-markless-graph] [POC: poc/04-equivalence-oracle] [POC: poc/05-enriched-ir] [POC: poc/06-emit-react] [POC: poc/07-emit-solid] [POC: poc/08-equivalence-results]

## The next tranche

First, fix markless composition: root props, component roots, prop aliases, callback symbols, and prop-derived child state. Then add children/slots/context semantics and scenarios. That composition surface is the unlock for the design-system market. Every repair must enter the oracle as a regression scenario.

Second, turn the React backend into a production emitter: multi-component and multi-module builds, type-bearing output, source maps, styling, accessibility checks, version policy, and robust diagnostics. Expand the Solid backend only against the adversarial synthetic-runtime acceptance list; do not infer generality from S1–S3. Add `attach`, declared sinks, and async behavior one semantic bucket and one oracle round at a time.

Third, earn each new target. Vue, Svelte, Angular, Qwik, server rendering, hydration, and resume are roadmap items, not conclusions hidden inside “write once.” A target ships when its supported semantic surface, conventionality gate, mutants, framework versions, and blocked cases are public receipts.

Frameless's thesis is therefore narrower—and stronger—than “compile to every framework.” It is: define a semantic surface, emit code people can leave with, and prove the tested behavior before asking anyone to trust the translation. [opinion]
