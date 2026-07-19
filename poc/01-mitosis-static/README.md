# Mitosis 0.13.2 static-failure proofs

This self-contained POC proves the version-pinned, fixture-scoped C1, C2, and C3 claims against the npm release `@builder.io/mitosis@0.13.2`.

## Claims and findings

**C1.** `fixtures/c1-local.lite.tsx` declares an ordinary component-body `const greeting` and uses it in returned JSX. The test drives `parseJsx` and `componentToReact()({ component, path })`, captures every standard console method, and proves generation returns normally with no console output. Babel parsing and traversal then prove that the declaration disappeared while the generated JSX still references an unbound `greeting` identifier.

**C2.** `fixtures/c2-collision.lite.tsx` instantiates the state/local-name collision class documented in Mitosis's gotchas. Babel binding analysis proves the emitted `foo` initializer resolves to its own `const foo` binding, which is a temporal-dead-zone self-reference. A minimal strict `Function` execution independently confirms that exact emitted construct throws `ReferenceError`.

**C3.** The test reads upstream's `Basic` fixture and committed Qwik snapshot from the read-only Mitosis checkout, regenerates the fixture with npm Mitosis 0.13.2 using the upstream JavaScript-test options, and uses Babel scope analysis to prove `myEvent` is unresolved. It extracts and decodes the committed JavaScript `Basic` golden, asserts that the full regenerated output equals it, parses it, and proves the same unresolved binding there. This is the surprising finding: the repository's accepted golden records the broken output.

## What this does not prove

These tests do not generalize beyond Mitosis 0.13.2, the three fixtures, React generation for C1/C2, or Qwik generation for C3. They do not prove that every ordinary local is dropped, every collision form breaks, that emitted components fail at module load, or that all target generators share these defects. C2's runtime check executes the isolated TDZ construct, not a mounted React component. C3 proves acceptance by the committed golden snapshot, not that upstream CI currently passes or that a Qwik application reaches the broken handler. This POC does not address runtime cross-target equivalence, async behavior, cleanup/attach, slots/children/context, styling, multi-module builds, performance, bundle size, accessibility, other framework versions, SSR/hydration/resume, HMR, type-preserving emission, or source-map debugging.

## Verification

The checkout defaults to `/Users/jacksm5pro/dev/open-source/mitosis`. Override it without changing committed files when needed:

```sh
cd poc/01-mitosis-static
MITOSIS_REPO=/Users/jacksm5pro/dev/open-source/mitosis pnpm install
MITOSIS_REPO=/Users/jacksm5pro/dev/open-source/mitosis pnpm test
```

Tests perform no network access. `pnpm install` is the only network-dependent step.

## Recorded versions

- Node.js: 24.15.0
- pnpm: 10.33.2
- `@builder.io/mitosis`: 0.13.2
- `@babel/parser`: 7.28.4
- `@babel/traverse`: 7.28.4
- Vitest: 3.2.4
