# Frameless app fidelity: make the demos actually work like the things they copy

## What the owner asked for

The owner drove the Qwik lane and found five things wrong. Verbatim: *"Why is there nothing
interactive on like half of these? Habits? Contacts? The board doesn't allow dragging? That's the
whole point of a trello board? When I click on the links of the hackernews demo it takes me
nowhere? Clicking the chevron of a hacker news item does not disclose it?"* Then: **"Fix it all."**

I drove the same lane and confirmed. **Three of the five are real defects. Two are
discoverability failures, which is the same problem wearing a different hat.**

## The oracle hole this exists to close

Every visual check on the previous two boards asked **"do the six lanes agree with each other?"**
None asked **"does it look like the thing it copies?"**

So the HN front page ships with the rank, the upvote triangle and the title **each on its own
line** — real HN puts them inline — and **all six lanes are identically wrong**, so every
cross-lane check passed. That is the `margin: 0` trap from `frameless-real-apps-v1` T007 recurring
at a larger scale: six lanes agreeing is not six lanes being right.

**This board's oracle compares against the reference itself.**

## The five findings, measured in the Qwik lane at `268b9ae`

1. **HN layout is wrong.** Rank / triangle / title each on their own line. Cause: svelte, vue and
   angular refuse a handler-bearing element placed beside text, so every run got its own `<span>`
   and the inline layout broke. **A real visual defect currently certified as fine.**
2. **Every HN link is `href="#/…"`.** There is **no routing construct in `.tsrx` at all**, so all
   43 links are decorative. No per-item disclosure exists on the front page; collapse lives only
   on `/hn-item`.
3. **The board does not drag.** It ships ◀ ▶ arrows with a banner saying so. **Drag is not
   impossible** — four lanes complete a real end-to-end HTML5 drag with a real mouse — it costs
   `pnpm check` **267 → 280**, and the previous board forbade raising the ceiling. **That
   constraint was mine and it was the wrong call for this app.**
4. **Habits works but is undiscoverable.** The click target is the dashed circle; the emoji and
   the sidebar name do nothing. One click moves five things — if you find it.
5. **Contacts works but reads as static.** Thirteen control kinds, search and a status filter all
   function; the New Contact form is **below the fold** on first load.

## Also in scope: the reason two apps lose lanes

**Angular refuses TodoMVC Advanced and the Codex clone**, and it is **not Angular's fault**:

> `Angular emitter cannot resolve the identifier "Promise" in a transplanted body: it is neither a
> body-local binding, a function parameter, a @for variable, nor a declared component member (…).
> The emitter throws rather than guessing whether it is a global.`

Our emitter has **no allowlist of standard globals at all.** Vue *has* one — `@vue/shared`'s
`GLOBALS_ALLOWED` — carrying `Date` and `JSON` but **not** `Promise` or `setTimeout`, which is why
Vue emits `new _ctx.Promise(...)`, passes its gate, `compileScript`, `tsc` **and** `pnpm check`,
then **throws in the browser**.

Same missing concept, two maturities. **Angular's behaviour is the better of the two** — loud and
early beats silent until runtime. Closing this likely takes S11 and S12 **from 5 lanes to 6**.

## The oracle

Three parts, all required.

1. **EVERY SHIPPED APP IS COMPARED AGAINST ITS REFERENCE, NOT ONLY AGAINST ITS OTHER LANES.** For
   each app: a named reference, a **rendered capture of that reference**, and a stated,
   measured comparison of the features that define it. **"Six lanes agree" is not evidence of
   fidelity and may not be offered as any part of this oracle.** Where the reference cannot be
   matched, the gap is **recorded with its measured cause**, not smoothed.
2. **EVERY DEFECT THE OWNER FOUND IS EITHER FIXED OR REFUSED WITH A MEASURED REASON.** All five,
   named individually, each with a browser observation at HEAD **after** the change. A fix that
   cannot be driven in a browser is not a fix.
3. **NOTHING REGRESSES.** `pnpm test` at **exactly one failure** (the foreign `package-inventory`
   ARM B); `pnpm e2e` stays **6 × 9**; lint and `check:citations` clean. **`pnpm check` may RISE
   only on a card that says so, by an amount it states in advance and justifies** — the ceiling
   is a budget, not a wall, and protecting it cost this project the drag axis.

**Completion proof**: per app, the reference comparison actually run; per owner-finding, the
browser observation; per lane not shipped, the verbatim refusal; and the check budget's start and
end values with every rise attributed.

## Measured facts this board starts from

- **`pnpm check` is 251**, measured by four separate cards, while every prior card carried a 267
  ceiling. There is **16 of headroom** before the old ceiling is even reached.
- **`shasum` defaults to SHA-1.** The owner's three paths are `f326d314` / `aeb7edc1` / `f936e169`
  **with `-a 256`**, and `24edb270` / `30403cba` / `f1a06e0f` without. **Name the algorithm.**
- **Svelte, vue and angular refuse a handler-bearing element beside text** — the cause of finding 1.
- **`DEFECTS.md` 15 is REACT-ONLY**, amended. Two-word DOM events *are* produced and *do* fire in
  five lanes; react-dom alone matches by prop name.
- **No static attribute whose declared JSX prop type rejects a string** — the predicate is the
  **lane's own declared prop entry**, not the DOM type (`DEFECTS.md` 17).
- **Two foreign processes are alive**: `node` PID 64413 on 5175, PID 24931 on 5178. Never `pkill`.
- **React, solid and vue answer 200 for any path.** Hash bodies.

## Non-negotiable constraints

- **Never test a framework outside its design envelope**, or read that output as a defect.
- **Do not file anything upstream.**
- **The owner's three uncommitted paths** — `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `website/` —
  are in-flight work. Fingerprint with **`shasum -a 256`**, relative paths, sorting **whole output
  lines**, at the start and end of every task. Never modify them.
- **Never `pkill -f` on a broad pattern.** Kill by recorded PID, only PIDs you started.
- **`git diff --exit-code` is blind to untracked additions.** Pair it with `git status --short`.
- **No hand-written per-lane app code.** Everything comes out of an emitter, proved by derivation.

## Likely misfire

**Fixing the five findings and leaving the oracle hole open.** The findings are symptoms; the
cause is that nothing ever compared a shipped app to the thing it copies. A board that repairs the
HN layout without installing that comparison will ship the next app identically wrong in six lanes.
