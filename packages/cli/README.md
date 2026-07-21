# @frameless/cli

The CLI compiles one or more `.tsrx` inputs independently to enriched IR, validates the complete
module set with `resolveModuleSet`, then asks each selected framework package to validate, emit,
format, and gate every module. Relative recorded `.tsrx` imports become same-basename `.jsx`
specifiers in each target directory. Single-input builds remain valid.

```sh
frameless build frame.tsrx page.tsrx --target react --target solid --out-dir generated
```

Module identity is the POSIX-normalized input path relative to the build invocation directory.
Relative TSRX imports require an explicit `.tsrx` extension. Missing modules, unresolved exports,
duplicate modules, and import cycles surface the compiler resolver's diagnostic without CLI
rewriting. Inputs that share a basename are rejected because the locked output mapping would place
both at the same `<out-dir>/<target>/<basename>.jsx` path.

The CLI supplies the originating enriched-IR artifact to every target's `checkSources` call. A gate
violation fails the build, and so does any non-empty `unevaluated` list: provenance-dependent
policies must run at full strength in this path.

The build writes one shared `frameless-build-receipt.json` at the output-directory root. That
receipt covers every selected target, records input and emitted-content SHA-256 hashes, and
delegates cross-target behavioral equivalence to `pnpm test:browser`; the CLI does not run a
browser. Each target section also records `resolvedPackage: { name, version }`, read from the
package metadata beside the module entry that Node actually resolved. Receipt validation requires
that resolved package name to match the target's requested package specifier.

The `frameless-build-receipts/1` shape retains the first-input `input`, `ir`, and first-output target
fields for additive single-input compatibility. It also records the complete `modules` list, a
link-table summary with validated references, and each target's per-module validation, gate, hash,
and provenance confirmation. The exact validator requires `artifactSupplied: true`,
`allPoliciesEvaluated: true`, and an empty per-module `gate.unevaluated` list.

Outputs for every target are staged in UUID-suffixed temporary directories beneath the output
directory before any live target directory changes. If staging any target fails, all staged
directories are removed and prior target outputs and receipts remain untouched. Once all staging
succeeds, a rebuild replaces each prior `<out-dir>/<target>/` directory and writes the receipt
last. Replacement has the honest per-target POSIX window: the prior directory is removed
immediately before its staged replacement is renamed into place, so targets are swapped one at a
time rather than as one filesystem-wide atomic operation.
