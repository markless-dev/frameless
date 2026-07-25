# artifacts/product

One worked surface: [`studio-inspector.html`](./studio-inspector.html).

Open it in a browser. No build step, no server.

> **Frameless Studio is not available.** That file is a static mock. It exists to show what
> the tokens do on a working tool, not to advertise a product. Nothing in it may read as
> though Studio ships — no countdown, no waitlist, no sign-up, and deliberately no call to
> action anywhere on the page.

## Why a product artifact at all

A landing page is something you *read*. This is a surface you *work in*, and the difference is
where a brand system usually falls apart. Density goes up, type goes down, state matters more
than mood, and every decorative habit that flatters a landing page starts costing something.

The spec for pages lives next door in [`../web/page-composition.md`](../web/page-composition.md);
the real pages live under `website/`. This file is the counterpart for a tool.

Four decisions carry the translation:

| On a page | In the tool |
|---|---|
| Depth from the band, the keyline, a real `drop-shadow`, rotation and overlap | The same stack, at panel scale — and reduced to one altitude. Structure comes from the `--ink` keyline and the `--surface-raised` / `--surface-sunk` pair; depth arrives once, as `--elev-card` on the window itself. There is no ladder of elevation greys, because a tool needs one cut edge you can trust rather than six |
| Lime is the poster colour | Lime is the **selection fill** — the selected row, the selected target. Same rule (a lime surface with an `--accent-ink` label at 13.08:1), different job. Never `--ink` on lime: `--ink` is cream and that pairing is 1.22:1 |
| Display steps open sections | The display steps appear **once**, in the app chrome. `--step--2` through `--step-0` do all the work |
| Nature stickers in the margins and at section seams | **No stickers at all.** A workspace is not a poster; a charming distraction is just a distraction. The page grain stays — it is material, not decoration |

Two rules survive the translation unchanged, and they are the two that matter:

- **State is never carried by colour alone.** The selected target chip takes a lime fill *and*
  loses its tilt. The selected tree row takes a fill *and* a solid keyline. Both survive a
  grayscale screenshot.
- **An empty state has no cut edge.** A target with nothing captured gets a dashed keyline and
  a word, never a dimmed one. Dimming reads as a loading skeleton; the missing die-cut edge
  reads as "not printed yet", which is this brand's own vocabulary for a thing that is not
  there.

## What is real in the mock

A mock of a verification tool that fakes its evidence would be a strange thing to build. So:

- The component under inspection is real: `RenderOnce`, from
  `packages/compiler/test/fixtures/s1-render-once.tsrx`. The props, the state, the derived
  value and the two branches are that component's actual shape.
- The filled output panes are the real emitted files, each with its path and its sha256:
  React, Solid and Qwik.
- Vue, Svelte and Angular have no captured output in this repository, so their panes are
  empty and their chips are dashed. Nothing was invented to fill them.
- The target toolbar is a real WAI-ARIA tab list — roving tabindex, arrow keys, Home and End
  — and the page checks canonical framework order and "no mark in `--accent`" in the DOM,
  logging to the console if either breaks.

What is *not* real: nothing is running. The state matrix is rendered markup, not a live
component, and the status bar says so.

## Adapting it

1. **Keep the honesty mechanics.** The dashed empty state and the provenance line under each
   code pane are the parts worth copying. A product mock that shows six confident panes when
   three of them are imaginary is exactly the failure this project is built against.
2. **Do not add a call to action.** If you find yourself wanting one, the copy is wrong before
   the design is. Approved lines are in `../../../verbal/messaging.md` under *Frameless
   Studio*.
3. **Keep the density.** If you find the display steps creeping back in, you are drifting from a
   tool toward a page.
4. **Keep the one shadow.** `--elev-card` on the window is not decoration a dense surface can
   economise on — elevation is mandatory across this kit, and a filter on a rectangle is what
   keeps a panel and a die-cut sticker agreeing about what a shadow is. Note that a `filter`
   becomes the containing block for `position: fixed` and `position: absolute` descendants; this
   page has none, and a fork that adds a floating panel has to move the filter or the panel.
