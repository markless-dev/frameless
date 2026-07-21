# Yuku parity evaluation (crew scout, executed, 2026-07-20)

VERDICT: FAIL.

Yuku does not meet the owner’s four-need parity gate. The make-or-break print bar failed for all six goldens, and the installed traversal API lacks binding resolution required by both emitters and gates. No semantic source change was observed in the six round-trips, but post-oxfmt byte equality was explicitly the acceptance bar, and the result was 0/6.

### 1. Print fidelity — FAIL

| Golden | Raw bytes equal | Post-oxfmt equal | Reparsed AST equal | Classification |
|---|---:|---:|---:|---|
| React S1 | No | No | Yes | formatting-only diff |
| React S2 | No | No | Yes | formatting-only diff |
| React S3 | No | No | Yes | formatting-only diff |
| Solid S1 | No | No | Yes | formatting-only diff |
| Solid S2 | No | No | Yes | formatting-only diff |
| Solid S3 | No | No | Yes | formatting-only diff |

Every parse, generate, and generated-source reparse returned zero diagnostics/errors. Structural AST comparison after removing spans/raw data and parsing with `preserveParens: false` passed for all six, so there is no semantic diff to quote. The surviving post-oxfmt differences were layout choices such as:

- React S1: multiline `onTrace('setup', {\n\truns: 1,\n});` became `onTrace('setup', { runs: 1 });`.
- React S2: multiline `({\n\t...todo,\n})` became `({ ...todo })`.
- React/Solid S3: multiline callback arguments and `{ source: 'form' }` became one line.

This is still a strict parity failure: running oxfmt 0.46.0 with the repository’s exact options on both inputs did not converge. Default, `indent: 4`, `quotes: 'single'`, both combined, and compact generation all remained 0/6.

Construction fidelity itself passed. A JSX string attribute must use the ESTree shape:

`{ type: 'Literal', value: 'count', raw: '"count"', start: 0, end: 0 }`

Results:

- That exact shape printed `<div data-cell="count" />` and reparsed cleanly.
- Single-quoted `raw: "'count'"` also worked.
- Babel `{ type: 'StringLiteral', value: 'count' }` threw `unsupported ESTree node type: StringLiteral`.
- Omitting `raw` reproduced `<div data-cell= />;` with an empty `errors` array, followed by a parser error. The missing `raw` violates Yuku’s declared `StringLiteral` type, so the original attribute issue is primarily a shape-contract mismatch. The generator’s failure to diagnose the malformed AST is nevertheless a file-able robustness bug.

One explicit hand-built ESTree Program combined nested arrows, template literals, optional chaining, `attr:value`, a string JSX attribute, and JSX spread props. It generated:

`const f = (x) => (y) => \`${x}:${y}\`;\nconst z = obj?.a?.(x);\nconst el = <input attr:value={x} data-cell="count" {...props} />;`

It reparsed with zero diagnostics and deep-compared equal ignoring spans. Inventory of the actual goldens found JSX, template literals, arrows, object spreads, and three namespaced attributes, but no optional chains or JSX spread attributes; those two were covered only by the adversarial hand-built probe.

### 2. Transform and scope safety — FAIL for the installed APIs

The lexical-shadowing fixture had an outer `count`, an inner arrow parameter named `count`, and closures referring to each. At all five `count` visits:

- `ctx.scope`, `ctx.binding`, `ctx.symbol`, and `ctx.reference` were absent.
- `WalkContext.prototype` contained only tree-position and mutation methods: `parent`, `key`, `index`, `ancestors`, `replace`, `remove`, `insertBefore`, `insertAfter`, `skip`, and `stop`.

A spelling-based rename produced the wrong result:

`const inner = (total) => () => total;`

The required binding-safe result was:

`const inner = (count) => () => count;`

`semanticErrors: true` successfully reported a duplicate `let`, but attached no scope, symbol, binding, or reference data to the Program or identifiers. `@yuku-toolchain/types@0.7.0` and `yuku-ast@0.7.0` expose no semantic model; implementing safe renaming with them requires hand-rolled scope tracking, which is disqualifying under the stated critique history.

A separate `yuku-analyzer` package does exist: npm search describes scopes, symbols, resolved references, and closures, and Yuku advertises it from the parser documentation. However, it was not installed in the supplied probe. A bounded `npm install --no-save --package-lock=false yuku-analyzer@0.7.0` attempt failed with `ENOTFOUND registry.npmjs.org` and installed nothing. Therefore its JavaScript API and shadowing behavior are unexecuted and cannot rescue this verdict. [npm package evidence](https://www.npmjs.com/search?q=keywords%3Aanalyzer), [Yuku semantic traversal documentation](https://yuku.fyi/parser/traverse/).

### 3. Gate analysis — FAIL with `walk`; analyzer parity unproven

Executed repository inspection counted:

- React gate: 11 `getBinding` calls.
- Solid gate: 28 `getBinding` calls.
- Total: 39, plus binding-identity maps, declaration-path queries, nested traversals, and scope ownership checks.

The installed Yuku walker cannot answer those queries. Replacing only parse/traversal would either retain Babel traversal as a hybrid or require the unexecuted analyzer package and a substantial gate rewrite. A hybrid might reduce parser/code-generator use but is not Yuku capability parity.

### 4. Toolchain risk — HIGH

- `yuku-parser@0.7.0` was published two days before this evaluation and npm reports 66 versions. A cached npm page from only days earlier showed 0.5.44, 50 versions, and dozens of releases within roughly two months—very high pre-1.0 churn. [Current npm package](https://www.npmjs.com/package/yuku-parser), [captured version history](https://www.npmjs.com/package/yuku-parser?activeTab=versions).
- The parser’s bundled `walk` is already deprecated in favor of `yuku-ast` and documented for removal in the next major version.
- npm identifies `arshadyaseen` as the collaborator; a third-party repository snapshot reports two contributors. That suggests approximately one core-maintainer bus factor, but commit-share data was unavailable, so this is a risk signal rather than a proven exact bus factor. [Repository snapshot](https://trendshift.io/repositories/29565).
- Yuku claims full ESTree/Oxc-compatible JavaScript and JSX AST output and production-ready parsing. The six executed parse/reparse probes support AST coverage for this fixture family, while the strict printer-byte results do not support emitter fidelity. [Yuku overview](https://yuku.fyi/), [parser claims](https://www.npmjs.com/package/yuku-parser).
- JSX coverage looked functionally promising: all six files parsed/generated/reparsed and the hand-built JSX cases passed. The malformed-Literal silent output and 0/6 formatting convergence still indicate immature integration edges.
- TypeScript syntax is not a current Frameless emitter requirement because artifacts are `.jsx`; Yuku’s TS support therefore does not offset either disqualifier.

### Executed command/output ledger

- `git status`, golden discovery, README/formatter inspection: six files found; formatter options matched; main checkout initially clean.
- Package/type inspection and `npm ls`: `yuku-parser@0.7.0`, `yuku-codegen@0.7.0`, pre-existing `yuku@0.2.12`; transitive `yuku-ast@0.7.0` and `@yuku-toolchain/types@0.7.0`.
- Six parse → generate → oxfmt comparisons: zero diagnostics/errors; raw 0/6; post-oxfmt 0/6.
- Six generated-source reparses and normalized deep comparisons: 6/6 structurally equal.
- Five generator-option variants across six files: every post-oxfmt comparison remained unequal.
- JSX attribute matrix: missing `raw` emitted invalid empty value; valid `Literal.raw` variants passed; Babel `StringLiteral` threw.
- Combined hand-built construct probe: zero errors; parse-back deep equality passed.
- Golden construct inventory: JSX/template/arrows/object spreads/namespaced attributes observed; optional chains and JSX spread props absent from goldens.
- Shadowing rename probe: no semantic context properties; spelling rename failed expected output.
- `semanticErrors` duplicate-declaration probe: diagnostic emitted, no semantic fields attached.
- Type-definition/runtime export inspection: no semantic surfaces in installed parser/walker/types packages.
- Repository `rg` counts: 39 gate `getBinding` calls.
- Direct npm metadata/search commands: retried and failed with registry DNS `ENOTFOUND`; offline metadata was not cached.
- Current web npm/project searches: confirmed `yuku-analyzer` publication and current Yuku release/risk facts.
- Analyzer install attempt: failed with `ENOTFOUND`; no package installed.
- Final cleanup/status: no probe source/output files were created—all scripts ran through stdin. Scratch `package.json`, lockfiles, and their timestamps remained unchanged; `yuku-analyzer` was absent; main checkout and evaluation worktree ended clean. The evaluation worktree had unrelated modifications during initial inventory that disappeared externally; no action here modified or reverted them.

Evidence limits: this proves behavior only for the six checked-in goldens and explicit adversarial fixtures. It does not execute `yuku-analyzer`, arbitrary JSX/ECMAScript corpora, browser behavior, sourcemaps, or framework suites. No successful package installation occurred.

---

## PM ADDENDUM (2026-07-20, executed with network): need-2 verdict OVERTURNED

The crew FAIL verdict was environment-limited: yuku-analyzer@0.7.0 could not be
installed in its sandbox (ENOTFOUND). PM installed it and executed the decisive
probe. API: analyze(source,{lang}) -> Module with mutable AST + scopes/symbols/
references, symbolOf/referenceOf/scopeOf/resolve(name,scope,space)/capturesOf
(shadowing-correct free variables), designed per its own docs for
analyze->transform->print with yuku-codegen. EXECUTED binding-safe rename on the
shadowing fixture: outer count -> total, inner shadowing param + closure untouched:

  const total = 1;
  const inner = (count) => () => count;
  const outer = () => total;

Revised parity: need 1 print = semantic fidelity 6/6 (byte-parity vs the OLD
printer is formatting-only 0/6 — under migration the goldens regenerate once with
a reviewed diff, then freshness is self-consistent; the original bar was
over-strict); need 2 scope-safe transform = PASS (executed above); need 3 gate
queries = likely-pass, gate-specific probes not yet run; need 4 risk = REAL
(0.7.0 days old, single maintainer, JSX attr requires raw per its StringLiteral
type + one file-able codegen robustness bug). Verdict moves FAIL -> PARTIAL
(owner decision per the directive).
