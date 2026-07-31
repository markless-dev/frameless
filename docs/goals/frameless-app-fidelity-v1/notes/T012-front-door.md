# T012 — the front door, swept

Card: close the twentieth claim-site (`scripts/demo.mjs:122`, which T011 correctly
refused as out of scope) and sweep all of `scripts/` for the claim.

## The count: SEVEN claim-sites, all in `scripts/demo.mjs`

The card predicted one. I found **seven**, in three families. Zero in
`e2e.mjs`, `check-citations.mjs` and `corpus-mutation.mjs` — and that is a
measured zero, not an unchecked one: those three files contain **0 occurrences**
of `S10`–`S17` between them, so they make no claim about any shipped application
at all. `e2e.mjs` pins the literal `['s1'..'s9']` (`threeWayScenarios`) and
`corpus-mutation.mjs`'s `SCENARIO_FILES` stops at `s9`.

### Family A — the twentieth site, the one the card named (1 site)

`demo.mjs:121-122` read:

> S17 IS THE FOURTH ROW WITH NO `unbuilt` ENTRY IN ANY LANE, AND THE FIRST
> APPLICATION ROW SINCE S15 WHOSE AXIS IS ACTUALLY ON THE PAGE.

The second clause asserts S16's axis is not on its page. FALSE at HEAD — and it
**contradicted its own file twice over**: the S16 row 20 lines above already said
"IT DRAGS NOW", and `announce()` already printed "S16 is the DRAG page AND IT
DRAGS". The front door was arguing with itself in two directions.

### Family B — the ordinal chain, wrong at HEAD *and* wrong when written (4 sites)

`demo.mjs` hand-writes each application's ordinal among "rows with no `unbuilt`
entry in any lane". Measured at HEAD by importing the real `SCENARIOS`/`DEMOS`
tables (not by reading the prose):

| row | comment said | measured at HEAD |
| --- | ------------ | ---------------- |
| S13 | FIRST        | **4th** of 7     |
| S15 | SECOND       | **5th** of 7     |
| S16 | THIRD        | **6th** of 7     |
| S17 | FOURTH       | **7th** of 7     |

True order at HEAD: **S10, S11, S12, S13, S15, S16, S17** — seven of the eight
applications, S14 being the only row with an `unbuilt` entry (svelte, vue).

**The root is older than this board.** "S13 WAS THE FIRST APPLICATION IN THIS
TABLE WITH NO `unbuilt` ENTRY IN ANY LANE" was false *on the day it was written*.
I read every one of the nine historical revisions of `demo.mjs`: in `c50595f`,
the very commit that added the S13 row, `S10` TodoMVC already carried no
`unbuilt` entry in any lane — and `S10` has never carried one in any revision.
S13 was the *second*, never the first. Every later ordinal counted off that
off-by-one, and then drifted further when T007's two-name allowlist gave S11 and
S12 their sixth lane.

The runtime output has been printing the correct answer the whole time. The
banner derives `Of those, S10, S11, S12, S13, S15, S16, S17 are the 7 that all
SIX lanes serve` from the tables, thirty lines below comments that hand-wrote a
different answer.

### Family C — the stale application enumeration (2 sites)

- `:42` "the applications ride ordinal slots (S10, S11, S12, S13, S14)"
- `:47` "S10-S14 are the applications"

There are **eight**, S10–S17. Both ranges were written when S14 was the last row
and neither was extended when S15, S16 and S17 landed.

## Measurements I made at HEAD (nothing inherited from T011's receipt)

**The drag, re-driven myself, all six lanes, real native HTML5 drag.** My first
harness used raw `page.mouse.down/move/up` and reported *nothing moved in any
lane* — including lanes that do drag. That was my instrument, not the app;
Chromium does not synthesise the HTML5 drag protocol from raw mouse events. Redone
with Playwright's `locator.dragTo`, measuring column occupancy before/after:

| lane | column sizes | dragged? |
| --- | --- | --- |
| react | 3/3/2/1 → 3/3/2/1 | **NO** — 3 `Invalid event handler property` errors |
| solid | 3/3/2/1 → 2/3/3/1 | yes |
| qwik | 3/3/2/1 → 2/3/3/1 | yes |
| svelte | 3/3/2/1 → 2/3/3/1 | yes |
| vue | 3/3/2/1 → 2/3/3/1 | yes |
| angular | 3/3/2/1 → 2/3/3/1 | yes |

The card first moves out of column 1 into column 3 and **stays there** — re-read
1.3 s after the drop. **Five lanes drag, react alone is inert.**

React's three errors, captured verbatim through `pnpm demo`'s own streamed log:

```
Invalid event handler property `onDragstart`. Did you mean `onDragStart`?
Invalid event handler property `onDragend`.   Did you mean `onDragEnd`?
Invalid event handler property `onDragover`.  Did you mean `onDragOver`?
```

That independently confirms `demo.mjs:105`'s specific claim that react's
`onDragover` never fires — it is one of the three.

**The tables, measured not read.** Stripped the `main()` invocation from a
scratchpad copy of `demo.mjs`, imported the real `SCENARIOS` and `DEMOS`, and
computed the ordinals. `unbuilt` at HEAD: react `[]`, solid `[]`, qwik `[]`,
svelte `["S14"]`, vue `["S14"]`, angular `[]`.

## The citation guard IS red-capable over this file — and its coverage is narrower than it looks

I did not edit `check-citations.mjs`, so the card's "prove it still catches a
planted bad citation" clause did not bind. I proved it anyway, and the first
attempt found something worth recording:

1. Planted a **non-existent path** (`s17-contacts-NOPE.tsrx`) in a `demo.mjs`
   comment → guard reported **CLEAN**. `scripts/demo.mjs` is in the 610 *swept*
   files, not in `WATCHED_SOURCE` (17 files, all emitters/compiler/tests).
2. Planted a **first-party line ordinal** (`s17-contacts.tsrx:99999`) → guard went
   **RED** at exactly `scripts/demo.mjs:156:6`, rule `first-party-ordinal`,
   "Name the symbol, not the line."

So the sweep enforces *no first-party line ordinals*; it does **not** verify that
a cited path exists. A bogus path in a comment in this file passes silently.
Restored byte-identically both times (`cb452208…`), guard clean afterwards.

## The wildcard hazard — my first calibration was the wrong shape

The card warns that `git diff -- 'demos/*/src/emitted'` matches nothing and exits
clean. My first calibration used `'scripts/*.mjs'`, which returned 1, not 0 — it
did **not** reproduce the hazard, because that wildcard matches the file path
directly. The hazard is specifically about *leading-directory* matching.

Reproduced properly on real data, over `8b321af` (a commit that did move those trees):

```
explicit paths                    → 2 files
'demos/*/src/emitted'             → 0 files      <= FALSE PASS
'demos/*/src/emitted/*'           → 5 files
git diff --exit-code, wildcard    → rc=0         <= exits clean over a real change
git diff --exit-code, explicit    → rc=1         <= correct
```

The proof below used the 13 explicit paths, each asserted to exist and be
non-empty first.

## Verification

| gate | result |
| --- | --- |
| owner fingerprint START / FINISH | `f326d314` / `aeb7edc1` / `f936e169`, 116 files — both ends |
| sweep | 7 claim-sites, all in `demo.mjs`; 0 in the other three scripts |
| drag re-driven at HEAD | 6 lanes, native drag: 5 drag, react inert |
| `pnpm demo` still runs | run #2 booted all six, S16/S17 rows render, banner byte-identical to run #1 |
| derivation proof | 13 explicit paths, `--exit-code` rc=0, before **and** after `pnpm e2e` |
| `pnpm check` | START **261** → END **261**, delta 0 as predicted |
| `pnpm test` | exactly 1 failure — foreign `package-inventory` ARM B |
| `pnpm e2e` | PASS, `6 demos x 9 scenarios, all observations equal` |
| `pnpm lint` | 0 warnings, 0 errors, 558 files |
| `pnpm check:citations` | clean after every edit; proven red-capable |

Demos stopped by recorded PID only — run #1 node `32780`, run #2 node `34915`.
`pkill` never run in any form. The four PIDs earlier cards recited (64413, 24931,
31456, 51893) were re-measured at the start of this card: **all four dead**.

## Left uncorrected, deliberately

`demo.mjs:82` "S14 IS THE RECURSION MEASUREMENT, and FOUR of the six lanes serve
it" is consistent with the `unbuilt` table and with the banner's derived
`4 lanes serve it and 2 refuse`. I did not re-hash the six `/hn-item` bodies
myself, so I neither corrected it nor claim to have re-verified it — it is
structurally derived from the same table I did measure.
