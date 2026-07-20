# @frameless/analyzer

Portable, framework-free behavioral equivalence analysis for Frameless. The package owns the
versioned adapter lifecycle, scenario and action data, trace serialization, exact comparison,
mutant-class data, verdicts, and deterministic `frameless-receipts/1` result rendering.

## Contracts

- Analyzer trace contract: `frameless-analyzer/1`.
- Receipt artifact contract: `frameless-receipts/1`.
- `Adapter.dispatch(handle, action)` is asynchronous-capable and is awaited before the
  `action:n:after` observation.
- Observation order is mount, before dispatch, after awaited dispatch, one additional
  microtask, then bounded framework-owned quiescence. Sleeps are forbidden.
- Normalization removes only the two framework hydration markers listed by
  `FRAMEWORK_ATTRIBUTE_ALLOWLIST`. Classes, styles, other attributes, live form properties,
  focus, selection, keyed identity, and callbacks remain observable.
- Receipt pair states are `equal`, `different`, and `blocked-by-upstream`. Blocked legs require
  finding IDs and never count as passes.

`renderResults(receipt)` deterministically generates `RESULTS.md`; callers own filesystem
placement. `scenarios`, `calibrationScenarios`, and `mutantClasses` are data exports consumed by
framework-owned browser calibration packages.

## Scope and test lane

The package has no React, Solid, browser-runner, or framework-transform dependency. Its node-only
unit tests cover serialization, comparison, contract versions, receipt validation, and result
generation:

```sh
pnpm test
```

This contract proves only the fixture- and phase-scoped client behavior exercised by consumer
receipts. It does not claim general framework equivalence, SSR or hydration, async application
semantics, composition, performance, accessibility, or production adapter support.
