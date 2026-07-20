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
browser.
