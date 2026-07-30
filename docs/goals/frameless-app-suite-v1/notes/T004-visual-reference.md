# T004 visual reference — Square UI, QA'd live

Recorded by the PM with a browser, 2026-07-30, at 1440×900. The owner named
<https://square.lndevui.com/> and <https://square-ui-chat.vercel.app/> and asked for a
QA pass over the demos rather than a look at the screenshots.

## 1. Licence — settled before anything else

The repo is **`zerostaticthemes/square-ui`** (the `ln-dev7` path redirects). GitHub classifies
it **`NOASSERTION`**, not MIT. It ships a bespoke **"ln-dev UI License", © 2026 lndev**, which
grants use and derivative works in personal and commercial projects but forbids, verbatim:

- "Redistribute, share, or publish the Components or Templates (or any derivatives) as standalone resources"
- "Make the Components or Templates available in any repository, marketplace, or website (free or paid)"
- "Create or distribute a UI kit, component library, template collection, or design system based on these Components or Templates"

Frameless is a public repo, so committing copied layouts would publish derivatives in a
repository. **Owner ruled: reference only, build on MIT.** Square UI is itself built on
shadcn/ui, so the token layer we do vendor is the MIT one already recorded on T004.

**Nothing from the repo is cloned, copied, or vendored.** What follows is observation of
rendered public pages.

## 2. The interactivity census — the reason the QA pass was worth doing

These demos are **layout-first**. State is present in some and absent in others, and the split
does not follow what the screenshots suggest.

| demo | interaction tested | result |
| --- | --- | --- |
| chat | Enter in composer | **sends** — the primary send path is a keydown |
| chat | Send button | sends |
| chat | 2nd user message | **no assistant reply at all** — one canned response, then nothing |
| chat | theme toggle | real, full dark repaint |
| task-management | Filter popover | **opens** with Priority/Assignee/Clear-all |
| task-management | selecting "Urgent" | **does not filter** — board unchanged |
| task-management | "Add task" | **inert** |
| task-management | dragging a card | **no DnD** — the drag selected text |
| emails | clicking another mail | **stateful** — pane swaps, counter `1 from 20` → `2 from 20` |
| files | grid/list toggle | **stateful** — list re-renders as cards |
| habit-tracker | toggling a habit | **fully stateful, five derived updates** |
| calendar / habit-tracker | dates shown | **real current dates** (`JULY 30, 2026`, `Jul 27 – Aug 02 2026`) |

## 3. Three findings that change the build

**(a) The chat reference does not demonstrate streaming.** One canned reply to the first
message and silence thereafter. So Square UI's chat gives us a **look**, not a behaviour spec —
and streaming, the headline ask, is unreferenced. Our own T001/T002 rulings remain the only
authority on it.

**(b) Enter-to-send is the reference's primary interaction, and it is the one thing we cannot
spell.** `DEFECTS.md` entry 15: two-word DOM events are unspellable in every lane, `onKeyDown`
cannot be produced and `onKeydown` never fires. The demo also ships a **Send button**, which
*is* a plain click and *is* spellable — so the narrowing is: **click-to-send only, Enter
unavailable**, recorded rather than faked.

**(c) The habit tracker is the best behavioural reference in the whole collection**, and it is
not the one the owner pointed at. **One click fans out to five observable updates**: the
checkbox fills, the title strikes through, the header counter goes `0/6 → 1/6`, the sidebar
badge follows, the progress bar advances, and the encouragement line changes from
"Let's make today count!" to "Good start! Stay consistent."

That is **pure synchronous derived state** — exactly what `computed` is for, no async door
needed — so unlike everything else in this tranche it is reachable in **all six lanes**, and it
exercises fan-out far harder than TodoMVC Advanced does. **Recorded as a strong successor
candidate.**

## 4. The one that bites Angular

`calendar` and `habit-tracker` both render **live dates**. Angular refuses every global
identifier in a transplanted body — `Date` included — so any date-driven app is **unbuildable
in the Angular lane** for a reason that has nothing to do with async. Same root cause as the
refusal T003 expects.

## 5. What this means for the reference stack

Unchanged from what T004 already records, and now corroborated: **vendor shadcn/ui's MIT
tokens, hand-write component CSS against those token names, compare against a screenshot.**
Square UI's contribution is layout proportion and composition, observed above — sidebar rail
~255px with search / nav / recents / archived, main column on a dot-grid field, composer
centred at ~635px that migrates from vertical-centre to pinned-bottom on first send, user
messages as dark right-aligned pills with the avatar outside, assistant messages as light
left-aligned rounded blocks with a square logo mark.

**Our demos will be more functional than the reference**, not less. That is worth stating
plainly in the final report, because a visual match against a static demo is not evidence of
behavioural parity and must not be presented as one.
