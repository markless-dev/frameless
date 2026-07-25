# Reference study — what I should have done first

Studied interactively in a real browser, 2026-07-24, after the owner pointed out I had never
opened any of them.

---

## 1. avara.xyz — the sticker → detail mechanic

**Owner's ask:** *"we want something exactly like this but with the frameworks so people can
see each output."*

### The interaction, precisely

**Rest state.** Black background (`#000`). Four die-cut stickers in a horizontal row,
overlapping slightly, all full-colour, medium size, centred. Nothing else on the page except a
mute toggle top-left and a small footer.

**On select** (click, or arrow keys):

1. The selected sticker **scales up dramatically** — roughly 2× — and moves toward the left
   third of the viewport.
2. **Every other sticker desaturates to a dark grey silhouette.** They keep only a faint trace
   of their keyline hue. They do not merely dim — they lose colour entirely, which is what
   makes the selected one read as *lit*.
3. A small **label chip** appears above the selected sticker (rounded, dark grey, e.g.
   "Aave Labs") slightly before the panel arrives.
4. A **detail panel slides in from the right**, roughly 430px wide, full height, a very dark
   card with a subtle lighter border and generous padding.
5. **Prev / next chevrons** appear bottom-centre as a visible affordance.

**Panel contents,** top to bottom:
- Large title (~40px, light weight)
- Short description paragraph, 3–4 lines, muted
- A **spec table**: label left, value right, hairline rule between rows —
  `Surfaces` (pill tags) · `Industry` · `Since` · `Chains` (stacked circular icons) · `Status`
- Social icon row at the bottom
- A small footnote line under it

### Keyboard — the Nintendo Switch carousel

Arrow keys do nothing at rest. Once something is selected, **← / → move between items** and
the whole thing behaves like the Switch home row:

- The **focal position is fixed**. The row slides beneath it rather than the selection marker
  moving along a static row.
- The newly selected item **colourises and scales up** as it arrives; the previous one
  **desaturates and shrinks** as it leaves.
- The panel content **swaps in place** — the panel itself does not re-animate, only its content.
- Transitions are quick and eased, and everything moves together as one gesture.

This is the whole navigation model. It should be Frameless's too.

### Sticker construction (zoomed inspection)

Not what I built. Three concentric layers:

1. **Outer die-cut band — TINTED AND GRADIENT.** For the ghost it is lavender, lighter at
   top-left, more saturated toward bottom-right. It is *not* flat cream. Each sticker's band is
   tinted to its own hue family.
2. **Keyline — dark but TINTED, not black.** The ghost's is a deep purple. It reads as the
   dark end of the sticker's own hue rather than as a neutral outline.
3. **Fill** — near-white with soft tinted shading inside; interior line work in the same
   tinted dark.

Band is thick, roughly 6–8% of the sticker's width — considerably chunkier than the ~3% I
measured off the flat PNGs and enshrined as law.

### Direct translation to Frameless

Each framework is a sticker in **its own brand colour**. Select one → it scales up, the others
go grey, and the panel shows that framework's **compiled output** plus a spec table:
activation model (hydrates / resumes), output path, line count, hash. Arrow keys carousel
between frameworks. That is the owner's ask, almost literally.

---

## 2. sticker.oooo.so — Sticker Forge (the peel and the elevation)

An interactive sticker maker, and it exposes its parameters as labelled sliders — so these are
real numbers rather than my guesses.

| Parameter | Value shown |
|---|---|
| Stroke width (描边宽度) | **18px** |
| Overall tilt (整体倾斜) | **−3.0°** |
| Curl radius (卷曲半径) | **0.120** |
| Sticker stiffness (贴纸硬度) | **72%** |
| Wind (风动) | **0.25** |
| Peel volume (撕开音量) | 68% |
| Material & shadow (材质与阴影) | **Light** |

**The sticker sits ON the page with a real soft drop shadow beneath it.** It is *elevated*.
That single quality is what makes it read as a physical object, and it is precisely what I
banned kit-wide after measuring four flat vector PNGs.

Also note: white band, mid-weight; slight constant tilt at rest; and the shadow is soft and
offset downward rather than a hard edge.

---

## 3. Corrections this forces on the kit

| Kit said | Reality |
|---|---|
| `box-shadow` **forbidden kit-wide** | Elevation is the whole point. Stickers need a real soft shadow. |
| Die-cut band is flat cream `#fdf8e4` | Band is **tinted to the sticker's hue**, and **gradient**. |
| Keyline is neutral `#11160f` | Keyline is the **dark end of the sticker's own hue**. |
| Band ≈ 3.2% of longest edge | Closer to **6–8%** of width. Chunky. |
| Stickers rest at a tilt (kept) | Correct — Forge confirms a constant small tilt (−3°). |
| Desaturated "aged print" palette | avara is **saturated and vivid on near-black**. The concept art is vivid too. |
| No stated selection model | **Switch-style carousel**: fixed focal point, others desaturate to grey. |

---

## 4. react.gg — the energy

Near-black page with a **faint grid texture** ruled over it — the background is never a flat
fill. That is the closest existing example of the "a little noise/texture everywhere" the owner
asked for.

**What it does that we need:**

- **Cards are stickers.** Testimonials and content blocks are saturated colour rectangles with
  a **thick cream/white border and a hard offset shadow**. They read as trading cards or
  stickers laid on the page — chunky, elevated, physical. Exactly the depth the concept art has
  and my kit lacked.
- **Colour is used in confident blocks** — green, pink, orange, red, purple, yellow — all
  saturated, all on near-black. No timidity, no desaturation.
- **Display type is heavy condensed uppercase**, cream with a saturated accent colour on the
  emphasised line ("WE GET IT, / **LEARNING REACT SUCKS**" — second line in yellow).
- **CTA is a solid saturated pill** (yellow, dark label), high contrast against the dark bed.
- The hero artwork is itself a **card with a cream border and a shadow**, floated on the grid.

**Structure:** hero (headline + sub + CTA left, sticker-card art right) → logo wall → social
proof cards → long-form problem section. Multi-section, varied, dense with colour.

---

## 5. The combined direction

All three references plus the concept art agree with each other and disagree with what I built:

- **Dark, textured background** — never flat. Grid (react.gg) plus noise/grain (owner's ask).
- **Saturated colour**, used in confident blocks. Not aged, not desaturated.
- **Everything is a sticker**: thick light band, tinted dark keyline, and a **real shadow**
  giving elevation.
- **Selection = Switch carousel**: chosen item large and vivid, everything else grey.
- Heavy display type with an accent-coloured emphasis line.
- Slight constant tilt at rest on stickers (−3°).

---

## The lesson

Every one of the corrections above was available in ten minutes of looking. I spent a whole
session building a system on measurements taken from the wrong image, while three URLs sat
in the brief unopened.

**Open the references before designing. They are instructions, not inspiration.**
