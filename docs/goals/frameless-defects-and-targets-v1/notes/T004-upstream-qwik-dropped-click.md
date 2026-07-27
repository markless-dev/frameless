# T004 — Defect 2 is upstream Qwik. Report for filing against `@qwik.dev/core`

**Verdict: UPSTREAM.** Defect 2 reproduces exactly on an untouched
`pnpm create qwik` app containing a hand-written counter and no frameless
involvement of any kind. It is not a frameless defect, and no frameless change
is required to close it.

The mechanism was isolated rather than inferred, and it is a **default
configuration** in `@qwik.dev/core`: the Qwik Loader — the script that installs
the event listeners — ships as an **async external module**, so on a slow link
there is a multi-hundred-millisecond window in which the page is painted,
visibly interactive, and has **no event listeners attached at all**. Clicks in
that window hit nothing and are discarded without a trace. Setting the already
documented `qwikLoader: "inline"` render option makes the same page, under the
same throttle, pass every check.

Versions are identical on both sides, so no version caveat applies.

| | frameless `demos/qwik` | untouched scaffold |
| --- | --- | --- |
| `@qwik.dev/core` | 2.0.0-beta.38 | 2.0.0-beta.38 |
| `@qwik.dev/router` | 2.0.0-beta.38 | 2.0.0-beta.38 |
| `vite` | 7.3.1 | 7.3.1 |

The scaffold was created with `pnpm create qwik@2.0.0-beta.38 empty`, pinned
deliberately: `create-qwik@latest` is `1.20.0`, which would have scaffolded the
Qwik 1 line under `@builder.io/qwik` and made the comparison meaningless.

---

## 1. What was run

Everything below is a **production** build (`vite build` + `vite build --ssr`)
served by `vite preview`. Dev-bundle size was already ruled out by
`findings-007` and is not revisited.

The driver is the repo's existing harness, `demos/qwik/throttled-resume.mjs`,
**unchanged**. It already accepts `QWIK_URL` and `QWIK_THROTTLE`, so pointing it
at an external app needed no edit. Throttling is CDP
`Network.emulateNetworkConditions` at 300ms latency / 400 kbit/s, and the click
is dispatched as soon as `domcontentloaded` fires.

The scaffold's only edit is `src/routes/index.tsx`, replaced with a plain
component. Nothing else in the scaffold was touched for the main result:

```tsx
export default component$(() => {
  const count = useSignal(1);
  const derived = useComputed$(() => `kit:${count.value * 2}`);
  return (
    <section data-scenario="upstream">
      <output data-value="derived">{derived.value}</output>
      <button data-action="increment" onClick$={() => { count.value += 1; }}>
        increment
      </button>
    </section>
  );
});
```

The selectors and the `kit:2 → kit:4 → kit:6` sequence are borrowed from the
frameless demo **only so the existing harness drives it unchanged**. The
component is hand-written idiomatic Qwik; no emitted output is involved.

## 2. Results

| App | Condition | Result |
| --- | --- | --- |
| frameless `demos/qwik` | unthrottled | **all 4 checks pass** (instrument control) |
| frameless `demos/qwik` | 300ms / 400 kbit/s | **fails** — value never leaves `kit:2` |
| untouched scaffold | unthrottled | **all 4 checks pass** |
| untouched scaffold | 300ms / 400 kbit/s | **fails** — `page.waitForFunction: Timeout 30000ms exceeded` |
| untouched scaffold, `qwikLoader: "inline"` | 300ms / 400 kbit/s | **all 4 checks pass** |

The unthrottled control passed on both apps, so the instrument, selectors and
expectations are sound and the only variable that changed is the connection.

## 3. The click is dropped, not delayed — and the proof is stronger than "no requests"

`findings-007` recorded "zero network requests are issued after the click". That
is true of the **handler QRL** and remains the right conclusion, but the raw
statement needs one correction: responses *do* arrive after the click, because
Qwik's preloader has already issued those requests *before* it. Nothing is
requested *because of* the click.

The decisive observation is a different one. Instrumenting the run to keep
waiting shows that **everything arrives, the container reaches `resumed`, and
the value still never changes**:

```
--- CLICK dispatched at t=434ms ---            (container attr at click time: paused)
  ... all bundles land, last at t=2087ms ...
value 8000ms after click: kit:2                (container attr after wait: resumed)
```

So this is not a slow fetch. The handler's code was resident and the container
was live within ~1.7s, and the click had still produced nothing 8s later.

To separate *dropped* from *queued*, a second click was dispatched onto the
now-resumed container:

```
value after a SECOND click on the resumed container: kit:4
  => first click was DROPPED (counter went 1 -> 2, not 1 -> 3)
```

Had the click been queued and replayed, the counter would have advanced twice
and read `kit:6`. It read `kit:4`. **The first interaction is silently lost.**

Identical output on both apps.

## 4. The mechanism, isolated

The served markup contains a synchronous inline script that records *which*
event types the container needs — but installs no listener:

```html
<script>(window._qwikEv||(window._qwikEv=[])).push("e:click","d:qcinit","d:qinit","d:qrouterpopstate",0,"6gelzk")</script>
```

The code that actually calls `addEventListener` lives in the Qwik Loader, which
is delivered as an **async external module**:

```html
<script async type="module" src="/build/q-fkfGnddn.js"></script>
```

That bundle reads the array and only then registers anything
(`dist/build/q-fkfGnddn.js`):

```js
const U = A._qwikEv;
U?.roots || (Array.isArray(U) ? x(...U) : x("e:click","e:input"),
             A._qwikEv = { events: q, roots: E, push: x }, S(p, J, F), F());
```

`x` → `S` → `addEventListener(t, r, {capture:n, passive:o})`. There is **no
replay path**: nothing inspects events dispatched before this ran.

**That bundle is byte-identical in both apps.** Same content hash, same
filename, produced independently by two separate builds:

```
8175c89b...a643d2  demos/qwik/dist/build/q-fkfGnddn.js
8175c89b...a643d2  upstream-qwik/dist/build/q-fkfGnddn.js
```

The code responsible for losing the click is `@qwik.dev/core`'s own, bit for
bit, in the frameless demo and in the untouched scaffold alike.

### The window, measured

Instrumenting the page to timestamp `DOMContentLoaded` against the moment
`window._qwikEv` becomes the live registry (the same tick listeners are
installed):

| App | Condition | DCL | listeners installed | **drop window** |
| --- | --- | --- | --- | --- |
| scaffold | unthrottled | 18ms | 26ms | **8ms** |
| frameless demo | unthrottled | 5ms | 15ms | **10ms** |
| scaffold | throttled | 415ms | 821ms | **406ms** |
| frameless demo | throttled | 416ms | 865ms | **449ms** |
| scaffold, `qwikLoader: "inline"` | throttled | 545ms | 573ms | **28ms** |

Unthrottled the window is ~10ms, which is why no other lane has ever seen this.
Throttled it is ~400ms of a painted, visibly interactive page with no listeners.
The frameless demo's window is marginally larger only because its document is
slightly bigger — the difference is document size, not emitted code.

### Confirming the cause

`@qwik.dev/core`'s `RenderOptions` already exposes the knob
(`dist/server.d.ts:138,177`):

```ts
export declare type QwikLoaderOptions = 'module' | 'inline' | 'never' | {...};
```

> `module`: Use a `<script>` tag to load the Qwik Loader. …
> `inline`: This embeds the Qwik Loader script directly in the document. This
> adds about 3kB before compression, which typically is reduced to about 1.6kB
> with gzip.
> **Defaults to `module`.**

Setting `qwikLoader: "inline"` in the scaffold's `entry.ssr.tsx` — changing
nothing else — removes the external script and makes the same page, same
production build, same 300ms/400 kbit/s throttle, same harness, pass all four
checks. The click that previously vanished now works while the container is
still `paused`, with the handler QRL fetched over the throttled link
afterwards:

```
--- CLICK dispatched at t=552ms ---    (container attr at click time: paused)
value 8000ms after click: kit:4        (reached kit:4: true)
```

This is the resumability claim working exactly as advertised. The framework
handles a pre-resume click perfectly well. **What loses it is purely the
delivery mode of the loader**, and the losing mode is the default.

---

## 5. The issue to file against Qwik

**Title:** Default `qwikLoader: "module"` silently drops all interaction until
the loader module arrives (~400ms on a 3G-class link)

**Affected:** `@qwik.dev/core@2.0.0-beta.38` (Qwik 2 beta line), reproduced with
`@qwik.dev/router@2.0.0-beta.38` and `vite@7.3.1`.

**Summary.** With the default `qwikLoader: "module"`, the Qwik Loader is
delivered as `<script async type="module" src="...">`. Between paint and that
module executing, the document has no Qwik event listeners, and no mechanism
captures or replays events dispatched in the interval. On a link with 300ms
latency and 400 kbit/s throughput, that interval is ~400ms, during which every
click on a fully painted, visually complete page is silently discarded. The
container later resumes normally, so there is no error, no failed request, and
no console output — the interaction simply never happened.

**Reproduce.**

1. `pnpm create qwik@2.0.0-beta.38 empty repro && cd repro && pnpm install`
2. Replace `src/routes/index.tsx` with the counter above.
3. `pnpm build.client && pnpm build.preview && pnpm exec vite preview`
4. Drive with Playwright: CDP `Network.emulateNetworkConditions`
   `{latency: 300, downloadThroughput: 400*1024/8}`, `page.goto(url, {waitUntil:
   'domcontentloaded'})`, then `page.click('[data-action="increment"]')`.
5. The counter never advances. Wait for the container to reach `resumed` and
   click again: it advances by **one**, proving the first click was lost rather
   than queued.
6. Set `qwikLoader: "inline"` in `src/entry.ssr.tsx`, rebuild, repeat: passes.

**Why this is worth fixing rather than documenting.** Resumability is sold on
being interactive before hydration. Under the default configuration the page is
*less* forgiving of an early tap than a hydrating framework that at least
replays or blocks — here the event is neither handled nor deferred, and the user
gets no feedback of any kind. A user on a slow connection tapping a visible
button is the ordinary case, not an adversarial one.

**Suggested directions, in the reporter's order of preference.**

1. **Register listeners from the inline script.** The synchronous
   `window._qwikEv.push(...)` script already runs at the right moment and
   already knows the event names. Having it attach a tiny capture-phase stub
   that records events until the loader arrives would close the window without
   inlining the full ~1.6kB gzipped loader.
2. **Replay captured events** once the loader installs, rather than discarding
   them.
3. **Reconsider the default.** If neither of the above is wanted, `inline`
   defends the common case for ~1.6kB gzipped, and `module`'s benefit
   (cross-page caching) applies only from the *second* page load — while the
   cost falls hardest on the first, which is exactly when a visitor is least
   likely to wait.

At minimum the tradeoff deserves to be explicit in the `qwikLoader` docs: the
current text describes caching behaviour and byte cost but does not mention that
`module` opens an interaction-dropping window proportional to connection
latency.

**Second, smaller observation.** `findings-007`'s original phrasing — "zero
network requests are issued after the click" — is a symptom worth stating
precisely in the issue, since maintainers may reasonably observe requests in the
log. Requests *do* continue to arrive after the click; they were all issued
beforehand by the preloader. What never happens is a request *caused by* the
click.

---

## 6. Consequences for this repo

**Defect 2 is closed for `frameless-defects-and-targets-v1` as upstream.** No
frameless code is implicated: the loader bundle is byte-identical, the scaffold
reproduces with a hand-written component, and the frameless demo's drop window
differs only by the ~40ms its slightly larger document costs.

Two follow-ups are **noted, not taken** — both are the PM's call, and neither is
in this task's scope:

1. **`demos/qwik` could set `qwikLoader: "inline"`.** It is a one-line change to
   the demo's `entry.ssr.tsx` and it demonstrably fixes the throttled lane. But
   it changes what the demo measures: the demo currently reflects what a default
   `pnpm create qwik` app does, and departing from the default is exactly the
   kind of divergence `frameless-qwik-v1` was created to stop. If the throttled
   lane is meant to hold upstream's feet to the fire, it should keep failing on
   the default.
2. **The `qwik-throttled` CI job's `continue-on-error` on the throttled step.**
   The goal oracle requires every such flag to be removed or to carry a
   justifying receipt. This note is the material for that receipt: the flag now
   guards a *decided, upstream* question rather than an undiagnosed one. Whether
   it stays, becomes an expected-failure assertion that would go red if upstream
   fixes it, or is dropped along with the step, is a board decision.

The unthrottled control must stay non-`continue-on-error` regardless — it passed
on both apps here and is what makes any throttled result interpretable.

---

## 7. Artifacts

The scaffold and logs live outside the repo, in the session scratchpad, so no
workspace `package.json`, lockfile or workspace glob was touched:

```
<scratchpad>/upstream-qwik/                  the untouched pnpm create qwik app
<scratchpad>/instrumented-resume.mjs         harness + request log + second-click probe
<scratchpad>/measure-window.mjs              DCL -> listeners-installed measurement
<scratchpad>/control-unthrottled.log         demos/qwik unthrottled (instrument control)
<scratchpad>/demo-throttled-2.log            demos/qwik throttled, dropped-click proof
<scratchpad>/upstream-unthrottled.log        scaffold unthrottled
<scratchpad>/upstream-throttled-harness.log  scaffold throttled, repo harness verbatim
<scratchpad>/upstream-throttled.log          scaffold throttled, instrumented
<scratchpad>/upstream-inline-throttled.log   scaffold throttled with qwikLoader inline
<scratchpad>/drop-window.log                 the four drop-window measurements
```

`demos/qwik/throttled-resume.mjs` was **not modified**. It already parameterises
on `QWIK_URL` and `QWIK_THROTTLE`, which was sufficient to drive an external app.
