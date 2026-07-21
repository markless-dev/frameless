# T012a gate-port probes (crew scout, executed, 2026-07-20)

Verdict: PORTABLE.

No semantic API disqualifier was found. Yuku can support both custom AST policy layers while ESLint remains unchanged. This is a substantive ESTree rewrite, not an import swap.

| Babel capability used by gates | Yuku equivalent | Executed result |
|---|---|---|
| `path.scope.getBinding(name)` and binding identity | `symbolOf(node)`, `referenceOf(node)`, `resolve(name, scopeOf(node))` | PASS on React/Solid imports, array-pattern setters, aliases, JSX imports, and shadowed bindings. |
| Binding-backed import maps | `module.imports`, keyed by `Import.local` symbol | PASS for real `useState`, `createStore`, and `<Show>` references; aliased fixture import also resolved. |
| `binding.path`, `binding.referencePaths`, `binding.scope.path` | `Symbol.declarations`, `Symbol.references`, `Symbol.scope.node`; climb declarations with `parentOf` | PASS on real imports and adversarial destructured setter declarations. |
| NodePath predicates and aliases such as `isIdentifier`, `isMemberExpression`, and `Function` visitors | ESTree `node.type`, typed Yuku visitors, and supported visitor aliases | PASS on real JSX/calls and inline-object fixture. |
| `path.get(...)`, including dotted and array child paths | Direct typed ESTree fields plus small child-navigation helpers | PASS: `attr:value`, `callee.object`, property values, component bodies, and statement arrays were reached directly. |
| `parentPath`, `findParent`, `getFunctionParent`, `getStatementParent` | `parentOf` loops or `WalkContext.ancestors()` | PASS on real namespaced JSX and fixture calls. |
| Nested/per-node `path.traverse` | `module.walk(visitors, rootNode)` | PASS on a real component subtree and fixture call subtree. |
| Visitor `return`, `skip()`, and whole-walk early termination | ordinary handler return, `WalkContext.skip()`, `WalkContext.stop()` | PASS; nested functions were pruned and traversal stopped at the first call. |
| Scope-aware callable resolution with binding trail/cycle set | `symbolOf` plus `Symbol.declarations`, `parentOf`, direct ESTree property inspection, and symbol-id trail | PASS for a real setter and adversarial direct alias, named-object property, inline object `({ run: setValue }).run(1)`, and a cycle returning `null`. |
| Closure/free-variable analysis needed for helper/event propagation | `capturesOf(functionNode)` plus resolved symbol identity | PASS on a real setter-capturing handler and lexical-shadowing fixture. |
| Generic recursive AST inspection and Babel `isNodesEquivalent` | ESTree recursion with positional/comment keys excluded | PASS for real `value`/`attr:value` equality and fixture equal/different JSX subtrees. |
| Babel comments and source locations | `module.comments`; AST `start`/`end` byte offsets | Comments PASS. Yuku has no Babel-style node `loc`; an executed offset-to-line helper derived line 16. This is adapter work, not a missing semantic capability. |

Exhaustive traversal inventory:

- React: 11 `getBinding` calls, 6 nested traversals, 4 `skip` calls, 2 `findParent`, `getFunctionParent`, `getStatementParent`, `parentPath`, `binding.path`, and `binding.referencePaths`.
- Solid: 28 `getBinding` calls, 4 nested traversals, 2 `skip` calls, 3 `findParent`, `getFunctionParent`, `parentPath`, declaration-path recursion, subtree comparison, and the more extensive callable resolver.
- Neither gate uses Babel mutation APIs such as replace/remove/insert.

Key verbatim probe output:

```text
PARSE_REAL=[{"file":"react/generated/S1.jsx","diagnostics":[],"jsx":5,"namespaced":0},{"file":"react/generated/S2.jsx","diagnostics":[],"jsx":12,"namespaced":0},{"file":"react/generated/S3.jsx","diagnostics":[],"jsx":6,"namespaced":0},{"file":"solid/generated/S1.jsx","diagnostics":[],"jsx":6,"namespaced":0},{"file":"solid/generated/S2.jsx","diagnostics":[],"jsx":14,"namespaced":2},{"file":"solid/generated/S3.jsx","diagnostics":[],"jsx":6,"namespaced":1}]
PARSE_FIXTURE={"diagnostics":[],"namespaced":["attr:value"]}
BINDING_REAL_REACT={"imported":"useState","local":"useState","declarationType":"Identifier","referenceParent":"CallExpression","symbolOfReferenceSame":true,"referenceOfSame":true,"resolveSame":true}
BINDING_REAL_SOLID={"imported":"createStore","local":"createStore","declarationType":"Identifier","referenceParent":"CallExpression","symbolOfReferenceSame":true,"referenceOfSame":true,"resolveSame":true}
BINDING_FIXTURE_SHADOW=[{"scope":"module","references":1,"declarationParent":"VariableDeclarator"},{"scope":"function","references":1,"declarationParent":"VariableDeclarator"}]
JSX_IMPORT_REAL={"symbolOfSame":true,"referenceOfName":"Show","resolveSame":true}
DECLARATOR_FIXTURE={"declarationType":"Identifier","declarationParents":["ArrayPattern","VariableDeclarator","VariableDeclaration"],"references":1,"referenceSymbolSame":true}
CALLABLE_REAL={"calleeType":"Identifier","resolved":"setDraft","scope":"function"}
CALLABLE_FIXTURE={"setterCalls":[{"calleeType":"Identifier","property":null,"resolved":"setValue"},{"calleeType":"MemberExpression","property":"run","resolved":"setValue"},{"calleeType":"MemberExpression","property":"run","resolved":"setValue"}],"cycleResult":null}
PATH_REAL={"predicate":true,"childChain":"attr:value","parentChain":["JSXOpeningElement","JSXElement","JSXElement","ReturnStatement"],"scope":"function"}
PATH_FIXTURE={"isCallExpression":true,"calleeObjectViaFields":"ObjectExpression","propertyViaFields":"run","functionAncestor":"FunctionDeclaration","statementAncestor":"ExpressionStatement"}
WALK_REAL={"subtreeRoot":"FunctionDeclaration","callsExcludingNestedFunctions":5,"skippedFunctions":7,"stoppedAt":"Identifier"}
WALK_FIXTURE={"subtreeRoot":"CallExpression","entered":8,"left":8}
WALK_CONTEXT_REAL={"scope":"function","symbol":null,"reference":null,"ancestors":["ReturnStatement","JSXElement","JSXElement","JSXOpeningElement"],"parent":"JSXOpeningElement","key":"attributes","index":2}
CAPTURES_REAL=[{"name":"setDraft","refs":1,"written":false}]
CAPTURES_FIXTURE=[["value"],["value"]]
STRUCTURE_REAL={"valueAttrEquivalent":true,"valueType":"CallExpression","attrValueType":"CallExpression"}
STRUCTURE_FIXTURE={"equalPair":true,"differentPair":false}
COMMENTS_FIXTURE={"diagnostics":[],"comments":["eslint-disable"]}
DYNAMIC_IMPORT_FIXTURE={"diagnostics":[],"types":["ImportExpression"]}
{"type":"JSXElement","start":465,"end":3525,"loc":null,"derivedLine":16,"sourcePrefix":"<section dat"}
```

ESLint boundary: confirmed clean. In both files, `customPolicies(source, file)` owns parsing and custom traversal, while ESLint independently receives the original string through `eslint.lintText(source, { filePath, ... })`. No Babel AST, NodePath, binding, or parser-services object crosses into ESLint. The flat configs and framework plugins therefore stay unchanged.

Port effort:

- React gate: medium-large. Its roughly 460-line custom-policy section needs an ESTree/Yuku adapter for predicates, declaration ownership, ancestors, line derivation, and callable traversal. The semantic queries themselves are proven. The port should extend React’s current named-object resolver to preserve the executed inline-object behavior.
- Solid gate: large. Its roughly 740-line custom layer has more recursive initializer classification, JSX structural comparison, props-read analysis, row/accessor binding checks, and helper/event propagation. Its existing inline-object callable behavior maps directly to the executed Yuku implementation.
- Shared helper extraction is strongly indicated: type predicates, property-name extraction, declaration-owner lookup, ancestors, line mapping, normalized structural equality, import maps, and callable tracing.

Important AST-shape changes include Babel literal nodes becoming ESTree `Literal`, `ObjectProperty` becoming `Property`, and dynamic import becoming `ImportExpression`. These require policy edits but no extra semantic library.

Evidence limits: probes covered all six checked-in generated files plus focused adversarial fixtures, but did not implement the production port, execute gate test suites, run ESLint, browser tests, or arbitrary emitted programs. Structural comparison was proven on representative real and adversarial nodes, not every policy mutant. Yuku’s pre-1.0 maturity risk remains unchanged.

Cleanup: all probes ran through stdin. No probe files were created. The scratchpad still contains only its pre-existing `package.json` and `package-lock.json`; both the main checkout and task worktree ended with empty `git status --short`.
