# Finding 007 — Qwik resumption does not complete under a throttled connection

**Status:** open, two readings not yet separated
**Found by:** T013's throttled-resumption lane, audit item 11's third strand
**Severity:** unknown, potentially high — this is Qwik's central claim

## The measurement

`demos/qwik/throttled-resume.mjs` drives the Qwik demo through Playwright with
CDP network emulation, then clicks the increment button.

| Condition | Result |
| --- | --- |
| **Unthrottled** (latency 0, throughput unlimited) | **all 4 checks pass** — `paused` container, `kit:2` server-rendered, `kit:4` after one click, `kit:6` after a second |
| **Throttled** (300ms latency, 400 kbit/s) | **times out after 30s** waiting for `kit:4` |

The unthrottled run is what makes this interesting: it proves the selectors,
the expectations and the whole instrument are correct. The only variable that
changed is the connection.

## Two readings, and I could not separate them

1. **A harness artifact.** This runs the demo in **dev mode**, where Vite serves
   large unminified modules. 400 kbit/s may simply be too slow to fetch a
   dev-mode QRL segment within 30 seconds, in which case the throttle is
   unrealistic rather than the code being wrong. A production build would settle
   this.
2. **A real defect.** Qwik's entire proposition is that a handler is fetched at
   click time. If a slow connection loses the click rather than merely delaying
   it, that is a serious behavioral gap — and it is exactly the risk the audit
   flagged when it noted Qwik is the one target whose activation genuinely
   depends on network timing.

Raising the timeout or loosening the throttle would make the symptom vanish
under either reading, which is why neither was done.

## Why it matters that nothing else could see this

Every other lane runs on a fast local connection where the click-time fetch is
invisible. `pnpm e2e` asserts the QRL is fetched and the container transitions
`paused` → `resumed`, but on a link where that always succeeds immediately. This
is the first time anything in the repo has asked what happens when it does not.

## Status in the repo

The script is committed and **works** — the unthrottled run proves it. It is
deliberately **not wired into CI**, because doing so would make CI red on an
undiagnosed question rather than a decided one.

## Next step, in order

1. Re-run against a **production** Qwik build (`pnpm --dir demos/qwik build` then
   preview). If it passes, this is reading 1: the dev bundle was the problem, and
   the lane should target production and then be wired into CI.
2. If it still fails, capture the network log at click time — was the QRL request
   even issued? That distinguishes "slow" from "lost" and turns this into a
   proper bug report.
