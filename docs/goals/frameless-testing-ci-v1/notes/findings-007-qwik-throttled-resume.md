# Finding 007 — Qwik resumption does not complete under a throttled connection

**Status:** open, DIAGNOSED — the click is lost, not slow
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

## Diagnosis (both next steps from the original note were run)

**Step 1 — production build.** Rebuilt (`pnpm --dir demos/qwik build`) and served
via `vite preview`. Container still `paused`, SSR value still `kit:2`, and the
throttled click **still times out**. Production QRL segments are small, and 30s
at 400 kbit/s is roughly a 1.5 MB budget, so bundle size does not explain it.
This substantially weakens reading 1 below.

**Step 2 — network log at click time.** With request logging enabled:

```
value after 20s: kit:2
requests issued AFTER click:   (none)
```

**Zero network requests are issued after the click.** The handler QRL is never
even requested. So the click is **lost, not delayed** — which is a materially
different and more serious thing than "resumption is slow on a bad connection".

The most likely mechanism: the click lands before Qwik's bootstrap listener is
installed over the throttled link, and is dropped rather than queued. Queuing
pre-resume interaction is precisely what a resumable framework claims to do, so
this is worth someone's attention.

**Caveat, stated plainly:** the script clicks as soon as `domcontentloaded`
fires, which is aggressive. But it is not unfair — "interactive immediately,
before any hydration" is the claim resumability is sold on, and a real user on a
slow connection can absolutely tap a visible button before a background script
finishes downloading.

## The original two readings, for the record

1. **A harness artifact.** ~~Dev-mode bundles are large.~~ **Ruled out by step 1:
   the production build fails identically.**
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

## Next step

Both diagnostic steps are done. What remains is a decision that is not a testing
task's to make:

1. Confirm against an untouched `pnpm create qwik` app that this is Qwik's
   behavior rather than something about the emitted components. That separates
   "upstream Qwik issue" from "Frameless emitter issue" — and given the emitted
   output carries no bootstrap logic of its own, upstream looks more likely.
2. If it reproduces upstream, it is worth an issue against Qwik, not a change
   here.
3. Only wire this lane into CI once the expected behavior is settled. Until then
   it would make CI red on an open question.
