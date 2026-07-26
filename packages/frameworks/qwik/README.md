
## Why there is no Qwik browser test project

React and Solid each have a browser test project that runs their emitted output
in a real Chromium and compares behavior. Qwik does not. This is deliberate and
upstream-blocked, not an oversight.

`@qwik.dev/core@2.0.0-beta.38` declares:

```json
"peerDependencies": { "vite": ">=6 <9", "vitest": ">=2 <4" }
```

This workspace runs **vitest 4.1.5**, which is outside that range. (Vite is not
the obstacle — the root resolves Vite 8.0.16, comfortably inside Qwik's range.)

The reason for not adding the project anyway is **interpretability**, not
caution. Running Qwik outside the support window its own maintainers declare
means that when a lane goes red, we cannot tell whether our emitter is wrong or
the unsupported runner is. A test whose failures cannot be attributed is not a
test.

**Unblock condition:** a `@qwik.dev/core` release whose `peerDependencies.vitest`
admits 4.x. As of this writing `@qwik.dev/core@latest` *is* `2.0.0-beta.38`, so
there is no newer release to move to.

**What covers Qwik in the meantime:**

- `pnpm e2e` runs the emitted Qwik components through the official Qwik scaffold
  in a real browser, asserting the `paused` → `resumed` transition and on-demand
  handler QRL fetches, alongside identical React and Solid measurements.
- The gate (`src/gate/`) runs Qwik's own `eslint-plugin-qwik` rules over emitted
  output, the same third-party-arbiter approach React and Solid use.

**What is still missing:** unit-level browser calibration. The analyzer's mutant
classes — including `wrong-cancellation` — are only proven to be *detectable* in
the React and Solid lanes. That gap is not theoretical: it is how
`findings-003-qwik-async-preventdefault.md` went unnoticed until Qwik's lint
rules were added.
