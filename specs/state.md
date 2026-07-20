# Implementation state

This ledger records current worktree progress; the framework specs remain normative.

| Slice | Status | Evidence |
| --- | --- | --- |
| T004 scaffold and compiler | implemented; code lanes green, frozen install sandbox-blocked | Root workspace, vendored Markless artifacts, `@frameless/compiler`, 23 root tests, 18 unchanged POC 05 tests, byte-identical `/1` goldens, pack output with no declarations |
| Oracle | stub | Scheduled T007 |
| React target | stub | Scheduled T005 |
| Solid target | stub | Scheduled T006 |
| CLI build entry | stub | Scheduled T008 |
| Demo and fresh-checkout e2e | stub | Scheduled T010 |

Known open gaps are declarations/type preservation, sourcemaps, composition,
framework emitters, browser oracle integration, CLI atomic output, and the demo.
GitHub Actions is deferred; the intended CI contract is `pnpm e2e` plus
`pnpm test:poc`.

The T004 sandbox could resolve and write the frozen lockfile but could not complete
installation: registry DNS was unavailable, the sandbox-local pnpm store lacked
tarballs, and sandbox permissions prevented pnpm from registering the worktree in
the populated global store. Verification used the same exact pinned dependency tree
already installed in the read-only checkout; a clean-environment frozen install
remains a PM reproduction step.
