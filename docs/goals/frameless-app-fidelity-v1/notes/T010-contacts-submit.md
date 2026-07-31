# T010 — the live silent submit dead-end on /contacts is closed

Owner decision OD2, verbatim: **"Fix the placeholder"**.

One string changed in one fixture. `type="url"` stays, no hint text was added, no DOM
was added, and no other behaviour moved.

```
packages/compiler/test/fixtures/s17-contacts.tsrx:1018
-  placeholder="example.com"
+  placeholder="https://example.com"
```

Everything else in this card is derivation and proof.

---

## 1. The mechanism, reproduced in a browser at HEAD — without re-breaking the fixture

T005 diagnosed this and T999 reproduced it in react and qwik. The card told me not to
re-measure the before-arm by reverting the fixture, and I did not. Instead I set the
live input's `value` to each candidate string **in the running page** and read the
browser's own verdict off `checkValidity()` / `validationMessage`. Identical in both
lanes:

| value assigned to `#cs-site` | `checkValidity()` | `validity.typeMismatch` | `validationMessage` |
| --- | --- | --- | --- |
| `example.com` — **the old placeholder** | `false` | `true` | `Please enter a URL.` |
| `not a url` — the negative control | `false` | `true` | `Please enter a URL.` |
| `https://example.com` — **the new placeholder** | `true` | `false` | *(empty)* |

That is the whole defect in one row: the field's own placeholder was a value the
field's own `type="url"` rejected.

**Why it read as silent, measured rather than assumed.** The page's only in-DOM
advisory is `[data-hint="blocked"]` — *"First name, last name and email are
required."* — and with the three required fields filled it is **not** hidden but it is
also not about the URL. Chromium's `Please enter a URL.` is a native validation
bubble: **browser chrome, not page DOM**. So T005's wording — *"NOTHING ON THE PAGE
SAYS SO"* — is precisely and literally correct, and I am recording that it was correct
rather than softening it.

## 2. The after-arm — the oracle is the browser, not the emitted source

Playwright 1.58.2, real Chromium, at HEAD after the change. **The value typed into the
Website field was read from the live `placeholder` attribute in the DOM, never
hardcoded** — the card's requirement is to type what the placeholder *now shows*, so
the driver types whatever the page teaches.

Two lanes × two viewports. 1200px is included deliberately: it is where T005 and T999
measured, and it is where the contacts rail media query does **not** apply, so the fold
cannot be confounding the result.

| lane | viewport | `type` attr | typed | site valid | form valid | **submit events** | cards |
| --- | --- | --- | --- | --- | --- | --- | --- |
| react | 1440×900 | `url` | `https://example.com` | true | true | **1** | **9 → 10** |
| react | 1200×900 | `url` | `https://example.com` | true | true | **1** | **9 → 10** |
| qwik | 1440×900 | `url` | `https://example.com` | true | true | **1** | **9 → 10** |
| qwik | 1200×900 | `url` | `https://example.com` | true | true | **1** | **9 → 10** |

Zero console errors in every run. The submit event is counted by a capture-phase
listener installed before the click, so "the card count rose" and "the submit event
actually fired" are two separate observations, not one restated.

### The negative control, and what it is for

Same form, same three required fields, Website set to `not a url`:

| lane | viewport | site valid | form valid | **submit events** | cards |
| --- | --- | --- | --- | --- | --- |
| react | 1440×900 | false | false | **0** | 9 → 9 |
| react | 1200×900 | false | false | **0** | 9 → 9 |
| qwik | 1440×900 | false | false | **0** | 9 → 9 |
| qwik | 1200×900 | false | false | **0** | 9 → 9 |

This does two jobs. It proves the assertion **can** fail — a 9 → 10 that cannot fail
would be worth nothing. And it proves the fix did **not** buy the submit by weakening
validation: the field is still `type="url"` (asserted from the DOM, not from source)
and it still refuses a non-URL. That refusal is the point. Thirteen control kinds still
ship; none was reduced to twelve.

**"Six lanes agree" is not offered here as evidence of anything.** All six lanes were
re-derived, but the claim that the dead end is closed rests on the two driven browsers
above and nowhere else.

Body hashes, never HTTP 200 — react answers `200` for a nonsense path:

| url | code | bytes | sha256 |
| --- | --- | --- | --- |
| react `/contacts` | 200 | 24,297 | `a9f256d635a7` |
| react `/definitely-not-a-real-route-zzz` | **200** | 796 | `2540b92adb0b` |
| qwik `/contacts/` | 200 | 153,889 | `d2e7d29dc749` |
| qwik `/definitely-not-a-real-route-zzz/` | 404 | 36,735 | `d61d53d69353` |

The served react body carries `placeholder="https://example.com"`.

## 3. Derivation — regenerated, never hand-edited

`UPDATE_GOLDENS=1 pnpm test`, then six `regenerate`, then six `copy-emitted`, each
driven from a shell array whose length was asserted `-ne 6` before the loop ran, because
zsh does not word-split and that has made four cards' proofs vacuously true.

**Twelve lane artifacts: 12 files changed, 12 insertions, 12 deletions. Every single
changed line is the placeholder string.** The full `git diff` was read, not just the
diffstat. Nothing else moved under `generated/` or `emitted/`.

### The golden does not behave the way the card predicted, and the reason is sound

The card's derivation proof says to assert *"the ONLY changed lines are the placeholder
string"*. That is true of the twelve lane artifacts. **It is not true of the golden, and
it should not be.** `packages/compiler/test/goldens/s17-contacts.json` moved **973
lines**:

- **1** line is the placeholder value.
- **972** lines are AST `start` / `end` source offsets — and **every one of them shifted
  by exactly +8**, which is `len("https://")`. Distinct delta set computed over all 972
  pairs: `[8]`. Not "mostly 8". Exactly one value.

The enriched IR stores byte offsets into the fixture, so lengthening a string literal
necessarily renumbers everything after it. This is the clearest possible demonstration of
why the golden had to be regenerated rather than hand-edited: a hand edit of line 17586
would have left 972 offsets silently wrong and `enriched-ir.test.ts` would have caught
it — or worse, someone would have "fixed" the test.

## 4. Gates

| gate | result |
| --- | --- |
| `pnpm check` | **START 261 → END 261**, predicted delta 0. Not merely the same count — `diff` over the two full `error TS` line sets is **empty**, so the identical errors are identical. |
| `pnpm test` | 1 failed / 1412 passed — exactly the foreign `package-inventory` ARM B. Run **clean**, without `UPDATE_GOLDENS`, so the regenerated golden is asserted byte-equal by the real gate. |
| `pnpm e2e` | PASS — *"Three-way: 6 demos x 9 scenarios, all observations equal"*. **Run alone**, before any demo was started and after all regeneration finished. |
| `pnpm lint` | 0 warnings / 0 errors over 558 files |
| `pnpm check:citations` | clean over 4 watched documents, 17 watched source files, 610 swept |
| owner fingerprints | `f326d314` / `aeb7edc1` / `f936e169`, website 116 files — identical at START and FINISH |

## 5. Boundaries honoured

- `s17-contacts.tsrx:12` — the stale S16 drag prose — **is untouched**. It is T011's.
  Line 1018 was mine. The fixture diff is one line and confirms it.
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` and `website/` were already dirty before this
  card and are untouched. No `git add -A` was run; nothing was committed.
- T005's and T999's receipts and notes were read and **not edited**.
  `notes/T005-discoverability.md:242` still quotes the old `example.com` placeholder.
  That is history describing the state at the time it was written, and it stays.
- `type="url"` unchanged, no hint text, no new DOM.

## 6. Findings and residuals

- **The board card's own artifact count is wrong, in both directions.** T010's
  `objective` says *"RE-DERIVE all twelve artifacts"*; T009's scope audit says
  *"FOURTEEN DERIVED ARTIFACTS IS THE RIGHT NUMBER"*. Measured: **13 artifacts are
  derived** (1 golden + 6 `generated/` + 6 `emitted/`) and **14 files change**, the
  fourteenth being the hand-edited fixture, which is the *source*, not a derived
  artifact. Twelve omits the golden — in a card whose next paragraph exists solely to
  insist the golden is part of the derived corpus. Fourteen counts the source as
  derived. Neither is fatal; both were followed correctly because `allowed_files`
  enumerates the paths explicitly.
- **The four "alive" foreign PIDs are not alive.** The card names 64413, 24931, 31456
  and 51893 as live processes to route around. At HEAD **none of the four exists**, and
  nothing was listening on 5173–5181 before I started. The safety rule was honoured
  regardless — `pkill` was never run in any form, and the two servers I started were
  stopped by their six recorded PIDs. But the stated fact is stale, and a successor card
  should re-measure rather than inherit it.
- **`git diff -- 'demos/*/src/emitted'` silently matches nothing.** My first derivation
  proof used wildcard pathspecs and reported *one* changed file when twelve had changed.
  Git disables leading-directory matching once a pathspec contains a wildcard, so
  `demos/*/src/emitted` only matches a path that *ends* there. `demos/svelte-official/src/lib/emitted`
  has no wildcard, so it matched — which is exactly what made the wrong answer look
  plausible. Redone with an explicit twelve-path array, length-asserted and
  existence-checked. **This is the same class as the zsh non-splitting trap the card
  warns about, in a different tool**, and it would have produced a confidently wrong
  "only one file moved" claim.
- **Residual, unowned and out of scope here:** an invalid URL still fails with browser
  chrome only. Nothing in the page's DOM reports it, because OD2 ruled out hint text and
  new DOM by name. The dead end the owner hit is closed — the placeholder no longer
  teaches a rejected value — but a user who types their own bare host still gets a
  refusal the page itself does not narrate. Recorded, not fixed.
