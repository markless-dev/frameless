# T007 — Hardening the resume oracle (Worker)

Acts on `notes/T004-phase-gate.md`. Files touched: `demos/react-official/three-way-contract.ts`
and the three `scenarios.box.ts` lanes.

## Verdict: the resume claim is now affirmatively evidenced

Before this task the entire published claim "Qwik resumes rather than hydrates" rested on
`q:container="paused"` appearing in the served payload — a substring every Qwik SSR page emits
whether or not resumption works. It now rests on the handler QRLs the clicks actually pulled,
named, counted, and recorded.

`qsymbol` fires in dev. No proxy was substituted.

## What each new assertion proves

### Qwik lane (27 → 36 assertions)

| Assertion | Proves |
| --- | --- |
| `page.trackEvents('qsymbol')` before the first click, then `expect.page.outcome(page, { events: { qsymbol: { atLeast, detailIncludes } } })` | The clicked handler's QRL was **imported on demand**. qwikloader resolves a handler only from a dispatched event, so a symbol observed after tracking started was pulled *by the click*. |
| `expect.page.attribute(page, 'html', 'q:container', 'resumed')` | The **resume transition, observed**: served `paused` → live `resumed`. T003 read this backwards as noise; asserting both ends is strictly stronger than asserting either. |
| `expect.response.matches(served, { contains: 'q-e:click="' })` | The served markup already **names its handlers as QRLs** with nothing to run. |
| `expect.page.outcome(page, { navigations: 1 })` | The known 1-vs-0 difference is now declared per framework instead of left silent. |

The per-scenario `detailIncludes` substrings are hash-free structural prefixes, so they survive an
emitter re-hash but still identify *which* element's handler was pulled:

- `s1` → `_component_div_section_button_q_e_click_`, at least 1 (the increment button)
- `s2` → `_button_q_e_click_`, at least 3 (reorder, per-row remove, clear)
- `s3` → `_component_form_button_q_e_click_`, at least 1 (submit)

Observed symbols, recorded as `evidence.handlerSegments` in each qwik receipt:

```
s1  RenderOnce.jsx_RenderOnce_component_div_section_button_q_e_click_9Q3eIyNu4eE.js
s2  KeyedTodo.jsx_KeyedTodo_component_section_button_q_e_click_1_gtBXfYo06RE.js
    KeyedTodo.jsx_KeyedTodo_component_section_ul_li_button_q_e_click_00NTa8mDu4Q.js
    KeyedTodo.jsx_KeyedTodo_component_section_button_q_e_click_2_Wn0X9ewBsx0.js
s3  EventForm.jsx_EventForm_component_form_q_e_click_10g1S3uH4Bs.js
    EventForm.jsx_EventForm_component_form_button_q_e_click_oSBi1pK7YKw.js
```

**The sharpest single fact in the run:** S2's served payload carries **5** `q-e:click` QRL
attributes but only **3** handler segments were ever fetched. The `add` button was never clicked,
so its handler was never downloaded. That is on-demand loading demonstrated by absence, not by
assertion.

### React and Solid lanes (24 → 33 assertions each)

| Assertion | Proves |
| --- | --- |
| `forbidInServedPayload(served, ['q:container', 'data-frameless-activated'])` | The served payload is **inert**: no Qwik container, and no activation marker — the marker only ever appears once `hydrateRoot` / `onMount` has run. |
| `expect.response.matches(served, { contains: '/src/entry-client.jsx' })` | The page ships a **client entry module that must run before anything reacts** — the positive counterpart of Qwik's serialized QRLs. |
| `expect.page.attribute(page, 'html', 'q:container', null)` | A hydrating framework never grows a Qwik container, live or served. |
| `expect.page.outcome(page, { navigations: 0 })` | No reload, no history entry. |

## `navigations`, resolved

Every page in **all three** frameworks issues exactly one `resourceType: 'Document'` request; the
contract now asserts that and throws with the observed count if it is ever not 1. Qwik's extra
`navigations: 1` is therefore the Qwik router pushing a same-URL history entry, **not a reload** —
the T004 finding, now machine-checked rather than checked once by hand.

## The equality diff is no longer tautological

`scripts/e2e.mjs:438-467` diffs `JSON.stringify(observed)` across the three lanes. Those arrays
previously held hardcoded literals pushed next to each assertion, so the diff compared constants to
themselves. Every entry is now interpolated from a value read back out of the live DOM through
`page.content()` — a different read path from `expect.page.text`, which compares the browser's own
trimmed `textContent`. `measureText` / `measureAttribute` / `measureRowKeys` strip the frameworks'
own hydration bookkeeping (React's `<!--$-->` boundaries, split interpolation comment nodes) so that
`1<!--x-->/<!--x-->2` and `1/2` measure the same, and nothing else.

`scripts/e2e.mjs` was **not** in `allowed_files` and was not touched; this was done entirely from
the contract side. Its printed matrix is unchanged in shape — nine rows, all equal — plus one new
measured column (`1 document request served this page`).

## Negative control — the harness can fail

The T004 gate noted the failure mode had never been exercised. Three deliberate breaks, each
reverted:

1. `resumeSymbols.s1.includes` → `_component_div_section_button_q_e_dblclick_` (a symbol nothing
   pulls). Full `pnpm e2e` **exit 1**:
   `events.qsymbol: expected at least 1 event(s) with detail containing "..._q_e_dblclick_", observed 0 within 5000ms`
2. Live container expectation `resumed` → `paused`. Qwik lane **exit 1**:
   `expected 'html' attribute 'q:container' to be "paused", but it was "resumed"`
3. `entry-client` added to React's served-payload forbid list. React lane **exit 1** with the
   helper's message.

## Correction for T005's README, and a documentation defect it must not repeat

T004's binding README text (step 3) tells newcomers that the served Qwik payload shows
`on:click` QRL attributes. **It does not.** In `@qwik.dev/core` 2.0.0-beta.38 the serialized
handler attribute is `q-e:click`, and in dev its value is an indirection
(`q-e:click="/@qwik-handlers#_run#4"`), not the segment path. The real segment URL — the thing the
DevTools Network walkthrough tells the newcomer to look for — appears only as the lazily imported
script, e.g.

```
/src/emitted/RenderOnce.jsx_RenderOnce_component_div_section_button_q_e_click_9Q3eIyNu4eE.js
```

The `_component_div_section_button_q_e_click_` fragment T004 names for the Network filter is
correct. `curl -s localhost:5175/ | grep -o 'q:container="[^"]*"'` printing `paused` is also
correct. Only `on:click` is wrong and must be written as `q-e:click`.

## Scope not taken

- `three-way-contract.ts` stays in `demos/react-official/` per the T004 ruling.
- No new dependency.
- The lanes still exercise the dev-mode SSR path only; the express production path remains
  curl-verified. T005 still owns saying so in the README.
