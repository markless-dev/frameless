# @frameless/cli

The CLI compiles one `.tsrx` input to enriched IR, then asks each selected framework package to
validate that IR, emit its own JSX, and gate that emitted source. Target output is written beneath
`<out-dir>/<target>/` only after every selected target passes validation and its gate.

```sh
frameless build component.tsrx --target react --target solid --out-dir generated
```

The build writes one shared `frameless-build-receipt.json` at the output-directory root. That
receipt covers every selected target, records input and emitted-content SHA-256 hashes, and
delegates cross-target behavioral equivalence to `pnpm test:browser`; the CLI does not run a
browser. Each target section also records `resolvedPackage: { name, version }`, read from the
package metadata beside the module entry that Node actually resolved. Receipt validation requires
that resolved package name to match the target's requested package specifier.

Outputs for every target are staged in UUID-suffixed temporary directories beneath the output
directory before any live target directory changes. If staging any target fails, all staged
directories are removed and prior target outputs and receipts remain untouched. Once all staging
succeeds, a rebuild replaces each prior `<out-dir>/<target>/` directory and writes the receipt
last. Replacement has the honest per-target POSIX window: the prior directory is removed
immediately before its staged replacement is renamed into place, so targets are swapped one at a
time rather than as one filesystem-wide atomic operation.
