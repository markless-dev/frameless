# Build entry

The v0 entry is CLI-first:

```text
frameless build [--config frameless.config.ts] [--target react --target solid] [--no-gate]
```

`defineConfig()` accepts an entry, named target output directories, gate severity
(`error` by default), and a receipts directory (`receipts/` by default). The CLI
loads its internal target registry, compiles every accepted input directly through
Frameless, emits each selected target, runs gates unless disabled, and then invokes
oracle verification where configured. It never production-builds authored TSRX
through the Markless Vite or public-render pipeline.

## Diagnostics and exits

Diagnostics contain a stable code, `error` or `warning` severity, phase (`config`,
`parse`, `semantic`, `emit`, `gate`, `oracle`, or `write`), message, and optional
file/span, target, construct, policy id, and dossier reference. Human output goes to
stderr; machine receipts remain files.

- exit 0: requested outputs, gates, and receipts completed without errors;
- exit 1: authored input, semantic, emitter, gate, or oracle failure;
- exit 2: invalid CLI arguments or configuration;
- exit 3: infrastructure or atomic-write failure.

Warnings do not change the exit status unless configuration promotes them. `--no-gate`
is explicit receipt metadata and cannot be reported as a gated pass.

## Atomic output and receipts

Each target is written to a fresh sibling temporary directory. Only after compile
and gate success does the CLI atomically swap it into the configured output path;
on failure it removes the temporary directory and leaves the last good output
untouched. Cross-target publication completes only when every selected target is
ready, preventing mixed-version output.

Build evidence is written under `receipts/` using the oracle-owned
`frameless-receipts/1` schema. A receipt records normalized inputs, exact tool and
framework versions, targets, diagnostics, gate policies with dossier references,
oracle verdicts, skipped/blocked states, and content digests. Receipt writing follows
the same temporary-write-and-rename rule.
