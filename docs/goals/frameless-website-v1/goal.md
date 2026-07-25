# Goal: Frameless homepage — interactive nature-sticker landing

## Original request

> We're going to work on the website for frameless. It has a nature-like sticker theme...
> I want you to make 2-3 variants but we want things to be interactive and fun, so it is
> very interactive focused... Basically the landing page should feel very interactive,
> unique, and overall leave an impression.

Full brief preserved at repo root: `frameless-website-prompt.md`.

## Interpreted outcome

A Frameless **homepage only**, built in plain HTML/CSS/JS (no framework), delivered as
**2–3 variants of a scrolling landing page**. Every variant carries the same brand:
nature-like sticker theme, Que Grotesque typography, framework logos as stickers that open
to reveal *that framework's real compiled output* from this repo's emitters, one section
with a physical peeling-sticker effect, and a "Frameless Studio — coming soon" moment.

## ⚠️ Course correction — 2026-07-24, owner directive

The first build read the avara.xyz reference too literally and produced a **fixed,
non-scrolling, single-viewport stage** — the whole page was one screen. The owner rejected
this outright: *"These one full page heroes look terrible, you're supposed to do a landing
page, I have no idea what this is."*

The correction:

- The deliverable is a **real scrolling landing page** with distinct sections — hero, the
  problem, the source, the framework showcase, the proof-of-divergence, the peel section,
  the Studio teaser, and a CTA/footer. react.gg (~12,000px of scroll) is the structural
  reference, not avara.
- **The avara sticker-popup mechanic is ONE SECTION of that page**, not the page itself.
  The owner's "exactly like this" referred to how the framework popups behave, not to
  avara's one-screen architecture.
- Consequently the three variants can no longer be distinguished by "core interaction
  mechanic" alone, because they now share a page structure. They differ as **landing page
  designs**. The interaction set is shared and consistent across them.

Three static structure mockups were produced for the owner to choose from, at
`website/mockups/{a-poster,b-fieldguide,c-trail}/`. They carry no interactivity — they
exist only to settle page shape before rebuilding.

What survives the correction unchanged: the emitter-output capture and its provenance gate,
the 23-assertion interaction contract, the CSS peel, the two-tier honest sticker board, the
art kit, and the font pipeline. Only the page architecture was wrong.

## Input shape

`existing_plan` — the owner supplied a detailed brief with named references, an asset
path, a font path, and explicit inspiration sites. The plan is preserved as facts below
and must be validated, not rediscovered.

## Goal oracle

The signal that keeps pressure on this goal, chosen by the owner:

1. **Interaction contract passes.** A written per-variant checklist, verified by Playwright
   against each variant running locally:
   - framework stickers open and close a popup;
   - the popup shows that framework's compiled output;
   - the peel-sticker section responds to pointer input;
   - Que Grotesque is actually loaded and applied (not a fallback);
   - "Frameless Studio — coming soon" is present and legible;
   - the page holds up at mobile widths.
2. **Real Frameless output, not lorem.** The code shown in framework popups is produced
   by this repo's actual React / Solid / Qwik emitters — captured from the real pipeline,
   never hand-written to look plausible.

Both must hold for every shipped variant before the tranche can be called complete.

## Constraints (non-negotiable)

- Homepage only. No routing, no additional pages, no CMS.
- Plain HTML / CSS / JS. No React, Solid, Qwik, Vite app, or build framework for the site
  itself. A small build/asset script is acceptable; a component framework is not.
- Que Grotesque is a **purchased, licensed** font. Use the local WOFF/WOFF2 files. Do not
  commit the OTF/TTF/Variable source, do not upload it anywhere, do not hotlink it, and
  keep the EULA in mind — self-host subset web fonts only.
- Frameless Studio is **not shipped**. It must read as "coming soon" and must not imply
  availability or link to a live product.
- Site lives under `website/` at the repo root. Do not touch `packages/`, `demos/`, or
  `poc/` except to *read* emitter output.
- The previous `website/` attempt was rejected wholesale by the owner and removed. Do not
  resurrect it, reference it, or copy its structure.

## Existing plan facts (owner-supplied, preserve)

- Theme reference image: `/Users/jacksm5pro/Downloads/image (3).png` (verified present).
- Font: `/Users/jacksm5pro/Downloads/Que_Grotesque_Professional_License_typeberka.com`
  (verified; contains `OTF/`, `TTF/`, `Variable/`, `WOFF/`, plus EULA PDFs).
- Inspiration — sticker popups: <https://avara.xyz/>. Owner explicitly asked for the
  sticker-popup mechanic to be studied *interactively* (Playwright), and wants "exactly
  like this but with the frameworks so people can see each output."
- Inspiration — overall energy: <https://react.gg/>.
- Peeling sticker effect: <https://sticker.oooo.so/> — must appear in one section.
- Icons: Game Icons via <https://icon-sets.iconify.design/game-icons/> (owner preference).
- Asset generation: codex CLI has image gen; use it when a needed asset doesn't exist.
- Frameless Studio: a lighter, simpler Storybook — view components and their states,
  works everywhere. Coming soon.

## Approach decisions (owner-selected during intake)

- **Variants differ by interaction concept**, not by skin. Each variant is a different way
  to explore framework output. Same brand, different core mechanic.
- **Research before code.** Scout studies the inspiration sites with a real browser, reads
  the Frameless pipeline to learn what output is worth showing, and inventories the font
  and reference image. Assets are generated only where a real one is missing.

## Likely misfire

The highest-probability failure is **three pretty static pages**. A model can produce a
nature-sticker landing page with hand-written code snippets, hover states, and a CSS
"peel" that doesn't respond to the pointer, then declare victory. Guard rails:

- fake snippets fail the oracle — output must come from the emitters;
- a decorative peel fails the oracle — it must react to pointer position;
- three variants that share one mechanic fail the owner's stated intent;
- a font fallback that "looks close" fails the oracle — computed font-family is checked.

Second misfire: burning the whole tranche on asset generation and never shipping a working
interaction. Research is bounded; the first Worker slice must produce something running.

## Non-goals

- Docs site, blog, pricing, examples gallery, or any page other than `/`.
- Shipping Frameless Studio, or any Studio UI beyond a teaser.
- Deploying, buying a domain, or configuring hosting.
- Refactoring `packages/` or the demo apps.
- Analytics, cookie banners, SEO campaigns.

## What counts as enough for this tranche

2–3 **scrolling landing page** variants under `website/`, each runnable locally, each
passing the interaction contract, each showing real emitter output in its framework
showcase section, each with the peel section and the Studio teaser — plus a short
comparison note so the owner can pick a direction.

Superseded: the earlier requirement that each variant use a "genuinely different core
interaction mechanic". That framing came from the pre-correction reading where each variant
was a single-screen toy. Variants are now landing page designs sharing one interaction set.

## Authority

`requested` — owner directly asked for this work and authorized removal of the prior
`website/` attempt. Local, non-destructive, branch-scoped work only.
