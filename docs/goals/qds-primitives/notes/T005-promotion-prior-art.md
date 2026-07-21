# T005 — Promotion prior art: constraint model + ecosystem track record

EVIDENCE note (crew half cited file:line to the local qwik checkout; web half
cited by URL). No design verdicts here — T007 synthesizes.

## Half A (crew): Qwik's $ serialization contract (qwik 2.0.0-beta.37, local)

Full report banked from scout receipt; load-bearing facts:

1. CAPTURE DISCOVERY IS SYNTACTIC: the Rust optimizer intersects identifiers
   used by the $ expression with enclosing scopes (transform.rs:982-1012);
   type/serializability checking is a SEPARATE type-aware ESLint rule
   (validLexicalScope.ts) plus dev-runtime verification plus serializer hard
   errors. Five distinct error layers exist: type-aware lint -> optimizer
   structural (C02/C03) -> dev QRL-construction throw ("Captured variable in
   the closure can not be serialized") -> SSR serializer errors -> resume
   missing-container errors. noSerialize() is the escape hatch (value lost
   to undefined on resume).
2. WHAT CROSSES THE BOUNDARY: primitives, dense/cyclic plain objects,
   framework objects (signals/stores/QRLs/promises/JSX), listed built-ins,
   and SSR-identified element refs. NOT: arbitrary functions, symbols, class
   instances, arbitrary live DOM nodes (element identity requires explicit
   SSR/VNode identity + container ownership, serialize.ts:607-612).
3. EXTRACTION MECHANICS: $ segments become separate modules with positional
   capture arrays restored through the container object table; SWC
   simplification/DCE applies, final minification is the bundler's.
4. QWIK RUNS NO USER CODE AT PARSE TIME: qwikloader (inline, 5.2kb minified,
   Terser + top-level mangle — same recipe as QDS's script) installs
   delegated listeners and observers only; user QRLs are event/idle/
   visible/init-triggered (qinit waits for readyState interactive). Precedent
   exists for SERIALIZED sync functions installed (not invoked) via inline
   script: document.qFuncs_<instance> (ssr-container.ts:1341-1368).
5. State ships as inert <script type="qwik/state">/"qwik/vnode"> data.

Constraint readings for promotion (facts, not verdicts):
- A promotion system does NOT need Qwik's value-serialization generality:
  promotion refuses non-static inputs (demotes to runtime attach) instead of
  needing to ship live values across a boundary. Qwik errors hard because $
  is semantic — the code MUST cross; promotion may always decline.
- Element identity, Qwik's hardest serialization problem, is trivial in the
  promoted-script channel: document.currentScript adjacency (the QDS
  carousel technique, executed in our T006 probe) — no VNode numbering.
- Qwik's livability came from LAYERED VISIBILITY (visible $ naming +
  type-aware lint + structural diagnostics). An implicit system keeps the
  need for the diagnostic layer even though its failures are benign.

## Half B (web): implicit vs explicit compiler boundaries — track record

- MARKO (closest prior art): automatic partial hydration by cross-template
  analysis — compiler decides what ships/hydrates, zero author directives;
  fine-grained pruning via dependency graph. Advocacy sources report no
  downside discussion; adoption remained niche (weak evidence of harm,
  strong evidence of feasibility).
- SVELTE 4 -> 5: retreated FROM implicit reactivity TO explicit runes —
  implicit *semantics* (what code MEANS depends on compiler inference) broke
  predictability at scale ("reactive values became stale when logic moved to
  a function"). Explicitness won where inference changed MEANING.
- REACT COMPILER (stable 2025, Meta-proven): implicit *optimization*
  succeeded in production — auto-memoization with silent bailouts. The
  managed cost matches promotion's exactly: "a bailout isn't a bug report —
  the compiler declining to optimize... it fails silently by design" and
  regressions surface later; ecosystem answer = build-time rules
  enforcement, tooling to inspect decisions, and a per-function opt-out
  ("use no memo"). Real production wins (Sanity ~20-30% render time).
- Synthesis-relevant distinction (for T007): implicit SEMANTICS failed
  (Svelte); implicit OPTIMIZATION shipped and won (React Compiler, Marko).

Sources:
[Marko team overview](https://dev.to/ryansolid/what-has-the-marko-team-been-doing-all-these-years-1cf6),
[Marko reactivity Q&A](https://www.infoq.com/articles/ebay-marko-performance-reactivity-model/),
[Svelte 5 runes guide](https://fullstacksveltekit.com/blog/svelte-5-runes),
[runes rewrite analysis](https://botmonster.com/web-dev/svelte-5-runes-reactivity-rewrite/),
[React Compiler v1.0](https://react.dev/blog/2025/04/21/react-compiler-rc),
[Compiler 18-month review](https://saschb2b.com/blog/react-compiler-year-in-review),
[what broke in practice](https://blog.logrocket.com/react-compiler-memoization-what-actually-broke/),
[bailout debugging](https://nerdleveltech.com/react-compiler-not-memoizing-component).
