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

`serializeRunTrace(trace)` writes deterministic, newline-terminated JSON, and
`deserializeRunTrace(text)` validates the complete analyzer contract on load. Trace files are the
transport used to carry browser-captured runs into cross-target comparison.

## Substrate split

Shared from `@markless/analyzer`:

- `AnalyzerInvariantResult` is the portable result contract. Frameless pair results become
  `MLA-EXT-FRAMELESS-EQUIVALENCE` entries and mutant checks become
  `MLA-EXT-FRAMELESS-MUTANT` entries.
- `createVerdictReport` owns report schema versioning, invariant validation, combination, and the
  aggregate pass/fail bit. `createReceiptVerdictReport` exposes the composable Markless report,
  while `createReceiptSummary` maps it to the compatible `frameless-receipts/1` summary.

Kept local:

- Equivalence engine (`Adapter`, multi-phase observation, serialization, comparison): Markless
  analyzes browser invariants, not cross-framework trace equivalence.
- Scenario, mutant, divergence, and per-pair receipt structures: these encode Frameless-specific
  calibration evidence and the `blocked-by-upstream` state.
- `RESULTS.md` rendering: Markless supplies the validated report contract, but not this
  Frameless-specific scenario/mutant presentation.
- Witness adaptation: `createWitnessVerdict` requires a receipt path, while this package is
  filesystem-free and intentionally leaves receipt placement to callers. Adding a path shim here
  would force a false abstraction.

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
