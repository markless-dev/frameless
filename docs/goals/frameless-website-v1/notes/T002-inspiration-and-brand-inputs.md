# T002 — Inspiration teardown + brand inputs

Method: real Chromium (Playwright 1.58.2), 1440x900, driven interactively. Screenshots and
raw dumps in the session scratchpad under `research/`.

---

## 1. avara.xyz — the sticker popup mechanic (the primary reference)

**Verdict: fully decoded, and it maps onto Frameless almost one-to-one.**

### Idle state

- Pure black full-bleed canvas. No scroll (`body.scrollHeight === 0`); everything is
  `position: fixed`. The whole page is one viewport-locked stage.
- Four die-cut PNG stickers (`aave`, `family`, `lens`, `gho`) sit in a loose overlapping
  pile in the middle of the screen. They are *not* on a grid — they cluster and overlap.
- Markup per sticker:
  ```
  ul > li[position:absolute]
       └ button.styles_draggable__        ← hit area, larger than the art
         └ div        transform: translateY(…)   ← idle float / bob
           └ div      transform: (drag offset)
             └ div.styles_logo__  transform: rotate(…)  ← per-sticker resting tilt
               └ img
  ```
  Three nested transform layers, each animated independently — **float**, **drag**, and
  **tilt** never fight each other. `transition: all` on each.
- Measured resting tilts: `rotate(2.19°)`, `rotate(6.19°)`, `rotate(17.0°)` — deliberately
  varied, none at 0.
- Measured float offsets sampled mid-animation: `translateY(-9.56px)`, `-4.16px`,
  `-2.54px` — different phase per sticker, so the pile breathes rather than pulses.
- Hit areas are notably larger than the art (e.g. art `205x251` inside a `410x502` button),
  which makes the pile feel grabbable rather than fiddly.

### Selected state (click a sticker)

Screenshot: `research/avara-03-clicked.png`.

1. The clicked sticker **scales up hard** (roughly 2x) and settles left-of-centre.
2. Every other sticker **desaturates to a near-black silhouette** — still visible, still
   in the pile, but drained. This is the move that makes the selection read instantly.
3. A **right-hand panel slides in**: `section > div.styles_container__[fixed, full-screen]
   > div.styles_content__ [448 x 884 @ x=984, y=8]`. So: 448px wide, inset 8px from the
   viewport edges, rounded, dark charcoal on the black backdrop.
4. Panel anatomy, top to bottom:
   - large display title (`Aave Labs`)
   - a short description paragraph
   - **a spec table** — label left, value right, hairline dividers between rows:
     `Surfaces | Industry | Since | Chains | Status`. Values can be pills, icon rows, or text.
   - a gap, then social icons
   - a small muted footnote line
5. **Prev/next controls appear** at bottom centre (`div.styles_controlsContainer__` with two
   `< >` buttons) so you can cycle the pile without going back.
6. The site footer nav **fades to `opacity: 0`** while a sticker is selected — the chrome
   gets out of the way.

### Direct translation to Frameless

| avara | Frameless |
|---|---|
| Protocol sticker | Framework sticker (React / Solid / Qwik) |
| Sticker enlarges, others desaturate | Same — selected framework lights up, others go grey |
| Right panel: title + description | Framework name + one-line "how this output thinks" |
| Spec table (Surfaces/Industry/Since/Chains/Status) | **Reactivity primitive / Hydration model / Emitter status / Lines emitted / Verified by** |
| — | **The compiled output itself**, scrollable, syntax-highlighted |
| `< >` cycle controls | Cycle frameworks — this *is* the "compile once, output anywhere" story |
| Footer fades out | Same |

The `< >` cycling is the single best device to steal: flipping between React → Solid → Qwik
with the *same source* pinned is exactly the product thesis, delivered as a gesture.

---

## 2. sticker.oooo.so — the peel effect

**Title:** "Sticker Forge — Interactive Sticker Maker" (UI is in Chinese).

### Technique — confirmed, not guessed

The stage renders **nothing** under default headless Chromium. Re-running with
`--use-angle=swiftshader --enable-unsafe-swiftshader` made it appear, and the DOM revealed:

```html
<div class="sticker-host" data-testid="sticker-stage" role="group"
     aria-label="可以从轮廓边缘拖拽撕起的交互贴纸">
  <canvas data-engine="three.js r185"
          role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
          aria-valuetext="0% peeled"
          aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft Space"
          aria-label="Interactive sticker. Drag a visible edge, or use arrow keys to preview the peel."
          style="touch-action: none">
</div>
```

So the real thing is a **three.js r185 WebGL mesh peel** — vertex displacement on a
subdivided plane, backing material on the reverse face. It is GPU-dependent and ships a
~600KB dependency.

### The parameter model (read straight off their controls panel)

This is the most useful artifact from this site — it tells us exactly which knobs matter:

**轮廓与姿态 / Surface**
- 描边宽度 — die-cut stroke width — `18px`
- 整体倾斜 — overall tilt — `-3.0°`
- 描边 — stroke colour
- 背胶 — backing/adhesive colour

**撕起手感 / Peel physics**
- 卷曲半径 — **curl radius** — `0.120`
- 贴纸硬度 — **sticker stiffness** — `72%`
- 风动 — **wind** — `0.25`
- 撕开音量 — peel sound volume — `68%`

Curl radius + stiffness + wind is a complete, implementable model. Note they also ship a
**peel sound**, which is a large part of why it feels physical.

### Two accessibility details worth stealing outright

1. `role="slider"` + `aria-valuenow` = **percent peeled**. The peel state is exposed as a
   number in the accessibility tree.
2. Arrow keys and Space drive the peel, not just the pointer.

Both matter for us beyond a11y: they make the peel **deterministically assertable by
Playwright** (`expect(peel).toHaveAttribute('aria-valuenow', …)` after a drag), which is
what the interaction contract needs. A pure-visual peel would be untestable.

### Recommendation for our build

Do **not** ship three.js for one section of a landing page. A CSS/SVG peel can hit the same
feeling at zero dependency cost:

- two stacked layers — sticker face, and the backing/adhesive underside;
- a **fold line** derived from pointer position;
- `clip-path: polygon(...)` splits the face at the fold; the flap is a second copy
  reflected about the fold axis and rotated with `rotate3d` under `perspective`;
- a linear-gradient overlay along the fold for the curl highlight, and a `drop-shadow`
  that grows with peel distance;
- expose `--peel` (0→1) as a CSS custom property, mirrored to `aria-valuenow`.

If Judge decides the CSS approximation can't carry the section, three.js is the fallback —
but it should be lazy-loaded and confined to that one section.

---

## 3. react.gg — pacing and delight devices

`document.body.scrollHeight === 11898` — a long single-page scroll. Fonts: **Paytone One**
for display, **Outfit** for body. No `<video>`, no `<canvas>` — the energy is entirely
type, colour, and illustration.

Three devices worth taking:

1. **The fanned card deck.** The hero art is one purple card with ~8 more cards fanned out
   behind it at increasing rotation, each with a thin cream die-cut border. It reads as a
   physical stack you could riffle. Directly reusable as "one source → many outputs": one
   `.tsrx` card in front, framework cards fanned behind it.
2. **Near-black + fine grid backdrop.** `#0e0d0c`-ish with a low-contrast graph-paper grid,
   which gives every sticker something to sit *on* and makes cream/lime pop violently.
3. **Cream-on-black type at scale + one saturated CTA.** Huge condensed display heading, a
   single yellow pill button, and a greyscale logo wall. The restraint is what makes the
   stickers feel special.

Also: the copy is conversational and long, broken into short paragraphs with bolded
punchlines. Worth echoing in tone, not length.

---

## 4. Brand inputs

### Reference image — `/Users/jacksm5pro/Downloads/image (3).png` (1456x1092)

It is close to a finished key art for the page, and effectively specifies the direction:

- **Background:** vintage travel-poster coastal cliff — lighthouse top-left, ocean right,
  wildflower meadow foreground, cumulus sky. Visible paper grain / halftone texture over
  the whole thing. Reads as WPA national-park poster crossed with Ghibli.
- **Wordmark:** `frameless` set enormous in a heavy rounded grotesque, **lime green fill**,
  thick **black offset shadow**, wrapped in a **cream die-cut sticker border** with a
  crinkled-paper texture inside the letterforms.
- **Tagline above:** `Compile once, output anywhere` in dark green, bold, flanked by small
  green sparkle/speed marks.
- **Badge:** `COMPILED OUTPUTS` — dark green pill with cream die-cut border.
- **Dashed arrows** fan down from the badge to six framework stickers — the arrows are the
  compile step made visible.
- **Six framework stickers**, each cream-bordered die-cut with a coloured field, logo, and
  name: React, Vue, Svelte, Solid, Angular, Qwik.

**Extracted palette (sampled):**

| Role | Hex |
|---|---|
| Lime (wordmark, accent) | `#C3D93A` |
| Deep green (text, badges) | `#173A22` |
| Cream (sticker border, paper) | `#F5EFDD` |
| Ink / outline | `#12100E` |
| Sky | `#A6CDE0` |
| Ocean teal | `#3B8CA0` |
| Cliff green | `#6E9B4E` |
| Sand | `#D9C9A3` |
| Flower pink | `#E8A0B4` |
| Flower yellow | `#F2D14E` |

**Sticker language:** cream die-cut border ~10–14px, black outline inside it, soft drop
shadow, paper-crinkle texture overlay, every sticker rotated a few degrees off-axis.

> ⚠️ **Conflict with T001.** The reference art shows **six** frameworks. Only **three**
> emitters exist (React, Solid, Qwik); Vue, Svelte and Angular are README-status *Planned*.
> This is a T003 decision. Strong candidate resolution: the three real frameworks are full
> colour and clickable; **Vue / Svelte / Angular are the peel stickers** — peel one back and
> the adhesive underside reads "COMING SOON". That turns the honesty problem into the most
> memorable interaction on the page.

### Font — Que Grotesque

Path: `/Users/jacksm5pro/Downloads/Que_Grotesque_Professional_License_typeberka.com`

- `WOFF/` — **9 weights × woff + woff2** (Thin, ExtraLight, Light, Regular, Medium,
  SemiBold, Bold, ExtraBold, Black). Web-ready, no conversion needed.
- `Variable/Que Grotesque-VF.ttf` — single variable file.
- `OTF/`, `TTF/` — desktop formats.
- `Professional License - TypeBerka Font Studio.pdf`, `TypeBerka Font Studio - EULA.pdf`.

**Plan:** copy only the needed `.woff2` files (realistically Black + Bold + Medium +
Regular — the wordmark wants Black) into `website/assets/fonts/`. Do not commit OTF/TTF/
Variable. Do not use the variable font on the web (whole-family exposure). The EULA PDFs
were not parsed — worth a human skim before publishing, but self-hosting a subset for a
first-party site is the normal grant in a Professional licence.

### Icons — Game Icons

Iconify set `game-icons`, ~4000 icons, CC BY 3.0 (**attribution required** — needs a
credit line in the footer). Nature-themed candidates that fit the theme: `game-icons:pine-tree`,
`:oak-leaf`, `:acorn`, `:mushroom-gills`, `:butterfly`, `:seagull`, `:lighthouse`,
`:wave-surfer`, `:hummingbird`, `:sprout`, `:stone-path`, `:compass`. Best pulled as raw
SVG at build time and inlined — no runtime Iconify dependency.

### Asset gaps (need generating via codex CLI)

1. Coastal/meadow poster background — ideally as separable parallax layers (sky, sea,
   cliff, foreground flowers) rather than one flat image.
2. `frameless` lime wordmark sticker (or build it live in CSS from Que Grotesque Black,
   which is better — it stays crisp and themeable).
3. Six framework die-cut sticker plates — coloured field + cream border + crinkle texture.
   Framework logos themselves are established marks; use official SVGs.
4. Paper-grain / crinkle texture tile for the sticker fill.
5. Peel backing texture — the adhesive underside (matte, slightly warm grey-white).
6. A few loose nature stickers for the pile — leaf, mushroom, seagull, wildflower.
7. Optional: a short peel sound (`.mp3`/`.ogg`) — sticker.oooo.so proves it carries a lot
   of the physicality.
