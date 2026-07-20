# @frameless/solid

Solid 1.8.22 adapter and framework-owned browser calibration for Frameless. The handwritten
references are moved without semantic rewrites; emitter idiom work remains owned by the later
Solid target task.

Calibration consumes scenarios and mutant-class data from `@frameless/analyzer`. Every clean
reference must be trace-stable for every scenario and every declared mutant class must diverge
in its expected channel. The package-local project uses cached headless Chromium and restricts
the Solid transform to the `.solid.tsx` calibration reference.

The normative idiom input is
`docs/goals/frameless-product-v0/notes/T003-solid-idioms.md`. This package does not duplicate the
dossier.
