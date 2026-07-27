# T005 — the file the T005 receipt cites, and what is actually in it

**Read this paragraph first.** The T005 receipt in `state.yaml` cites
`notes/T005-svelte-sugar.md`. **The note was never written.** This file is not
that note and does not reconstruct it: writing the Judge's reasoning after the
fact would be manufacturing evidence, which is exactly what this board did *not*
do when the same thing happened to T001 — there the citation was withdrawn
rather than back-filled. The board-level record of the T005 ruling is the inline
receipt in `state.yaml`; that receipt's `note:` field should be withdrawn the
same way T001's was.

What follows is written by **T008**, the Worker that implemented the ruling, and
is limited to what T008 itself measured and changed.

## What T008 changed

| Change | Where |
| --- | --- |
| Worked example 6 rewritten as **denied** (six outcomes, not amended) | `docs/emitter-idiom-policy.md` |
| Worked example 7 rewritten; its first G5 limb corrected as measured-false | `docs/emitter-idiom-policy.md` |
| New section: the baseline form inventory, and the `svelte-ignore` measurement | `docs/emitter-idiom-policy.md` |
| Decision-site comments at `syncPolicyGuard()` and `propsDeclaration()` | `packages/frameworks/svelte/src/emitter/index.ts` |
| `BASELINE_FORM_INVENTORY` + the `baseline-form-inventory` gate policy | `packages/frameworks/svelte/src/gate/index.ts` |
| Eight rows, one anti-vacuity row, one two-sided calibration | `packages/frameworks/svelte/test/gate.test.ts` |

Emitted output does not move. This package rewrites a ruling and adds a check.

## Measurements T008 took, at `svelte@5.56.8`

All through the resolved package's own `svelte/compiler`, both `generate` modes
and both `dev` settings unless noted.

| Question | Result |
| --- | --- |
| `on:click` in a runes component | warns `event_directive_deprecated` |
| `on:click` + `onclick` in one component | **throws** `mixed_event_handler_syntaxes` |
| `on()` + `onclick` in one component | compiles clean — the compiler cannot see the mix |
| `use:` action calling `on()` from `svelte/events` | empty warning set |
| `{@attach}` calling `on()` from `svelte/events` | empty warning set |
| `let { label } = $props()` | `$.template_effect(() => $.set_text(text, $$props.label))` — a **live** read |
| `let { config = { open: false } } = $props()` | `$.prop($$props, 'config', 23, () => ({ open: false }))`, no `proxy()` anywhere |

The first two are why `onname=` is the baseline. The third is why worked example
6 fails Gate 5 rather than being caught by the compiler. The fourth and fifth are
why Gate 1 is a `FAIL` and not a `DEFERRED`: the `on()` arm could have been
measured at Svelte 5.0 baseline at any point, so **IR-4 was never its blocker**.
The last two are worked example 7's corrected G5.

## The `svelte-ignore` measurement — both earlier reports were partly right

T005 reported that an unrecognised `<!-- svelte-ignore code -->` **warns**
`unknown_code`. A later re-measurement reported that it is **silent** and merely
fails to suppress. T008 reproduced **both**, and neither report named the
variable that decides it.

| Component | Unrecognised code | Svelte 4 dash-case code | Suppresses? |
| --- | --- | --- | --- |
| runes (`$props`/`$state`) | warns `unknown_code` | warns `legacy_code` | no |
| runes-free (`export let`) | **no diagnostic at all** | no diagnostic | no |
| no `<script>` at all | **no diagnostic at all** | no diagnostic | no |

Invariant across `client`/`server` and `dev`/`prod`. The deciding line is
`if (runes)` at `svelte/src/compiler/utils/extract_svelte_ignore.js:38`: in runes
mode an unrecognised code is reported, in legacy mode it is pushed onto the
ignore list unreported, where it matches nothing.

Consequences, which is where this stops being trivia:

1. **In this repo both arms are loud.** `assertCompilesClean` fails on any
   warning, and an unsuppressed a11y code is a warning — so a renamed code
   breaks emission here, in either mode.
2. **At a consumer's version nothing runs that check**, and on a minor where one
   of these codes was renamed the consumer gets the a11y noise with no
   diagnostic naming the cause. In a runes-free emitted module, not even the
   rename is reported.
3. The emitter never asserts that the modules it annotates are in runes mode. It
   happens to be true of S1/S2/S3 and is not a property of the emitter, so the
   inventory now refuses a `svelte-ignore` in a module containing no rune.

T005's conclusion — that the suppression codes are an unasserted precondition
over a growing set — therefore **stands and is sharper**, and the inventory is
more justified rather than less.

## Why every recorded floor says `unverified`

The resolved package carries `@since` tags for exactly the members that arrived
after 5.0 (`@since 5.20.0` on `$props.id`, `@since 5.36` on `settled`) and none
at all on `$state`, `$derived`, `$props` or `untrack`, and it ships no changelog.
An absent tag is equally consistent with "5.0" and with "nobody wrote one down",
so `5.0` is recorded as a **claim** from T001's version-boundary table with the
reason it could not be checked. The `verified` arm is not decoration: a verified
entry must cite a file and verbatim text inside the resolved package, the gate
test re-reads every citation, and — since no real entry exercises that branch
today — a calibration plants both a citation that holds and two that do not.

## Carried forward

- The T005 receipt's `note:` citation should be **withdrawn**, as T001's was.
- The lint-arbiter gap (T009) is untouched by this package and still open.
- The inventory reads emitted text, so it catches a new form arriving
  unannounced and **not** a form whose meaning changed under a fixed spelling.
  `onclick={…}` parses in Svelte 4 and means a string attribute there. That is
  what the floor column is for, and nothing in this repo can currently verify a
  floor without network access.
