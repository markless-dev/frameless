# Finding 004 — the test suite does not run on Windows

**Status:** open, recorded not fixed
**Found by:** T007's OS matrix, the first time anything in this repo ran on Windows
**Severity:** medium — blocks Windows contributors entirely
**Two independent defects, neither introduced by this goal.**

## Defect A — `format-emitted.test.ts` spawns `npx` unportably

```
Error: spawnSync npx ENOENT
  at packages/frameworks/solid/test/format-emitted.test.ts:12:21
  spawnargs: [ 'vp', 'fmt', '--stdin-filepath', 'packages/frameworks/solid/generated/S2.jsx' ]
```

The test shells out with `execFileSync('npx', ...)`. On Windows `npx` is
`npx.cmd`, and `execFileSync` without `shell: true` cannot resolve it. Affects
both the React and Solid copies of this test.

## Defect B — a Solid gate assertion fails on Windows

```
AssertionError: expected [] to include 'S-SH7'
  at packages/frameworks/solid/test/gate.test.ts:610:45
```

An expected identifier is absent from the gate's output. Not diagnosed further
here. The most likely cause is line endings: Windows checks out CRLF by default,
and any hashing or line-splitting over emitted source will produce different
results than LF. That is a guess and is labelled as one — it needs confirming
before anyone writes a fix.

## Why it was never seen

Nothing in this repository had ever run on Windows. Every prior verification
happened on the author's macOS machine, and until this goal there was no CI at
all. macOS on Node 24 passes cleanly in the same matrix run, so this is
specifically a Windows portability gap, not general breakage.

## Status in CI

The Windows cell is marked `continue-on-error` with a pointer to this note. It
is deliberately **not deleted**: the cell keeps running and its log stays
visible, so the defects remain in view and the fix can be verified when someone
takes it. Remove `continue-on-error` once both defects are closed.

Deleting the cell would have been the tempting move and would have made the
matrix a liar.
