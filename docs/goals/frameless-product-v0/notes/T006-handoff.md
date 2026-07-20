# T006 re-entry handoff (2026-07-20, session cutover)

State: solid-gate-fix + solid-emitter-fix MERGED (bypass families closed, fail-closed
validation + binding-kind semantics landed). PM adjudication applied: completely
empty branch arms are sanctioned (S2's @else{}) and lower to <Show when> WITHOUT a
fallback attribute; element-less-but-nonempty arms still fail closed.

Immediate next steps (small, in order):
1. showNode (src/emitter/index.ts ~858): emit the fallback attribute ONLY when
   node.arms[1].children is non-empty; empty else -> <Show when={...}>{then}</Show>.
2. pnpm vitest run --config vitest.node.config.ts (in packages/frameworks/solid) —
   expect 21/21 after the fix (was 20/21, blocked on S2 golden freshness).
3. Regenerate generated/ if output changed; freshness + solid-browser lane (17/17)
   + react lane unaffected.
4. Second small batch (2-wide, medium): coherent metamorphics (key-rename runs
   through gate; opaque graph-ID rename; store-shadow fixture) + beta.9 blocker
   contract test vs /Users/jacksm5pro/dev/open-source/solid branch next.
5. Critique re-check against the T006 rejection list, then T006 receipt + close.
Then: T008 (CLI, both-target inventory per critique instructions in the T006
critique tail), T010 (demo + fresh-checkout e2e), T009, T999.

Process rules in force (orchestrator.md 2026-07-20): medium default everywhere,
high needs effortJustification; <15-min units; 2-wide parallel for disjoint work;
partial = re-cut smaller, never inflate.
