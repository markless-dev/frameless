# @frameless/react

React 19 adapter and framework-owned browser calibration for Frameless. The handwritten
references are moved without semantic rewrites; emitter idiom work remains owned by the later
React target task.

Calibration consumes scenarios and mutant-class data from `@frameless/analyzer`. Every clean
reference must be trace-stable for every scenario and every declared mutant class must diverge
in its expected channel. The browser project uses locally cached headless Chromium, asynchronous
`act`, and `IS_REACT_ACT_ENVIRONMENT`.

The normative idiom input is
`docs/goals/frameless-product-v0/notes/T002-react-idioms.md`. This package does not duplicate the
dossier.
