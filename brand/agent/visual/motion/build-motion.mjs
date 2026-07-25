#!/usr/bin/env node
/* Frameless — motion generator
 * ============================================================================
 * motion.json is the SOURCE OF TRUTH. This script is the only thing that may
 * write motion.css and specimen.html.
 *
 *     node brand/agent/visual/motion/build-motion.mjs
 *     node brand/agent/visual/motion/build-motion.mjs --check
 *
 * --check regenerates in memory and exits non-zero if either output on disk has
 * drifted from the JSON. That is the "motion CSS values match the JSON exactly"
 * verification, done as a byte comparison rather than as a claim.
 *
 * Node stdlib only. No dependencies, no network.
 * ============================================================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(here, 'motion.json');
const cssPath = resolve(here, 'motion.css');
const specimenPath = resolve(here, 'specimen.html');

const raw = readFileSync(jsonPath, 'utf8');
const motion = JSON.parse(raw);

const names = Object.keys(motion.easings);
const ms = (n) => `${n}ms`;

/* ── motion.css ──────────────────────────────────────────────────────────── */

const banner = `/* Frameless — motion
 * ============================================================================
 * GENERATED FILE. DO NOT EDIT.
 *   source:    ./motion.json
 *   generator: ./build-motion.mjs
 *   regenerate: node brand/agent/visual/motion/build-motion.mjs
 *
 * Edits made here are lost the next time the generator runs, and the --check
 * mode will fail in the meantime. Change motion.json instead.
 *
 * ── THE GOVERNING IDEA ──────────────────────────────────────────────────────
 * ${wrap(motion.meta.governing_idea, 74, ' * ')}
 *
 * ── HARD RULES ──────────────────────────────────────────────────────────────
${motion.meta.hard_rules.map((r, i) => ` * ${i + 1}. ${wrap(r, 74, ' *    ')}`).join('\n *\n')}
 * ============================================================================ */
`;

/* Soft-wrap `text` to `width` columns, joining continuation lines with
   `continuation`. The caller owns the comment prefix so the same helper works
   inside a `/* *\/` banner and inside a `:root` block. */
function wrap(text, width, continuation) {
	const words = text.split(' ');
	const lines = [];
	let line = '';
	for (const word of words) {
		if (line && `${line} ${word}`.length > width) {
			lines.push(line);
			line = word;
		} else {
			line = line ? `${line} ${word}` : word;
		}
	}
	if (line) lines.push(line);
	return lines.join(`\n${continuation}`);
}

const tokenBlock = names
	.map((name) => {
		const e = motion.easings[name];
		return [
			`  /* ${e.for}`,
			`     ${wrap(e.why, 70, '     ')}`,
			e.pairs_with ? `     Pairs with: --motion-${e.pairs_with}.` : null,
			`     Use for: ${e.use_for.join(', ')}. */`,
			`  --ease-${name}: ${e.css_timing_function};`,
			`  --duration-${name}: ${ms(e.duration_ms)};`,
			`  --motion-${name}: var(--duration-${name}) var(--ease-${name});`,
		]
			.filter(Boolean)
			.join('\n');
	})
	.join('\n\n');

const transformBlock = [
	`  /* ${motion.transforms.peel.for}`,
	`     ${wrap(motion.transforms.peel.notes, 70, '     ')} */`,
	`  --transform-peel: ${motion.transforms.peel.css};`,
	``,
	`  /* ${motion.transforms.press.for}`,
	`     ${wrap(motion.transforms.press.notes, 70, '     ')} */`,
	`  --transform-press: ${motion.transforms.press.css};`,
	``,
	`  /* ${motion.transforms.rest.for}`,
	`     ${wrap(motion.transforms.rest.notes, 70, '     ')} */`,
	`  --transform-rest: ${motion.transforms.rest.css};`,
	``,
	`  /* Ceiling for the one thing that may still move under reduced motion.`,
	`     ${wrap(motion.reduced_motion.rationale, 70, '     ')} */`,
	`  --motion-fade-max: ${ms(motion.reduced_motion.opacity_fade_max_ms)};`,
].join('\n');

const reducedOverrides = [
	...names.map(
		(name) =>
			`  --ease-${name}: ${motion.reduced_motion.timing_function};\n  --duration-${name}: ${ms(motion.reduced_motion.durations_ms)};`,
	),
	`  --transform-peel: ${motion.reduced_motion.transforms};`,
	`  --transform-press: ${motion.reduced_motion.transforms};`,
	`  --transform-rest: ${motion.reduced_motion.transforms};`,
].join('\n');

const css = `${banner}
:root {
${tokenBlock}

${transformBlock}
}

/* ============================================================================
 * UTILITIES — one per curve
 *
 * Each sets a transition; none of them sets a transform. The transform is the
 * component's business, the timing is this file's. That separation is why a
 * button and a sticker can share a curve without sharing a shape.
 * ============================================================================ */

${names
	.map((name) => {
		const e = motion.easings[name];
		if (name === 'instant') {
			return `.motion-instant {\n  transition: none;\n}`;
		}
		return `.motion-${name} {\n  transition: transform var(--motion-${name}), opacity var(--motion-${name}), filter var(--motion-${name});\n}`;
	})
	.join('\n\n')}

/* Opacity only, and the one utility that survives reduced motion.
   Everything else collapses to 0ms; this one is capped at ${ms(motion.reduced_motion.opacity_fade_max_ms)}. */
.motion-fade {
  transition: opacity var(--motion-slide);
}

/* ============================================================================
 * THE TWO PHYSICAL STATES
 *
 * .pressable — down fast, up gentle. The asymmetry is the whole point: one
 * curve in both directions reads as a state toggle, not as a thumb.
 *
 * .peelable  — a die-cut corner lifting off the page.
 * ============================================================================ */

.pressable {
  transition: transform var(--motion-release);
}

.pressable:active {
  transition: transform var(--motion-press);
  transform: var(--transform-press);
}

.peelable {
  transition: transform var(--motion-release), filter var(--motion-release);
}

/* THE PEEL STATE — reachable three ways. It raises the object one step on the
   elevation scale, from --elev-sticker to --elev-lifted (../tokens/elevation.css).
   --shadow-peel is a stacked drop-shadow() filter, never a box-shadow, because
   it has to follow the die-cut silhouette rather than the element's bounding
   box. Every object here already casts a shadow at rest; the peel makes it
   bigger, which is the part the eye reads as lift. */
.is-peeling,
.peelable:hover,
.peelable:focus-visible {
  transition: transform var(--motion-peel), filter var(--motion-peel);
  transform: var(--transform-peel);
  filter: var(--shadow-peel);
}

/* ============================================================================
 * REDUCED MOTION — MANDATORY
 *
 * ${wrap(motion.reduced_motion.rationale, 74, ' * ')}
 *
 * Two selectors, one body. The media query is the real rule; the attribute is
 * an authoring and test hook so the fallback can be felt (and asserted) without
 * changing an operating-system setting.
 * ============================================================================ */

@media ${motion.reduced_motion.media_query} {
  :root {
${reducedOverrides}
  }

  /* Belt and braces: a component that hardcoded a duration instead of using a
     token still stops moving. Opacity is exempt and capped. */
  *,
  *::before,
  *::after {
    animation-duration: ${ms(motion.reduced_motion.durations_ms)} !important;
    animation-iteration-count: 1 !important;
    transition-duration: ${ms(motion.reduced_motion.durations_ms)} !important;
    scroll-behavior: auto !important;
  }

  .motion-fade {
    transition-duration: var(--motion-fade-max) !important;
    transition-property: opacity !important;
  }

  .is-peeling,
  .peelable:hover,
  .peelable:focus-visible {
    transform: none;
    filter: none;
  }
}

[data-motion="reduced"] {
${reducedOverrides}
}

[data-motion="reduced"] *,
[data-motion="reduced"] *::before,
[data-motion="reduced"] *::after {
  animation-duration: ${ms(motion.reduced_motion.durations_ms)} !important;
  animation-iteration-count: 1 !important;
  transition-duration: ${ms(motion.reduced_motion.durations_ms)} !important;
}

[data-motion="reduced"] .motion-fade {
  transition-duration: var(--motion-fade-max) !important;
  transition-property: opacity !important;
}

[data-motion="reduced"] .is-peeling,
[data-motion="reduced"] .peelable:hover,
[data-motion="reduced"] .peelable:focus-visible {
  transform: none;
  filter: none;
}
`;

/* ── specimen.html ───────────────────────────────────────────────────────── */

const curveCards = names
	.map((name) => {
		const e = motion.easings[name];
		return `        <article class="curve" data-curve="${name}">
          <header class="curve__head">
            <h3 class="curve__name">${name}</h3>
            <p class="curve__meta"><code>${e.css_timing_function}</code> · <strong>${e.duration_ms}ms</strong></p>
          </header>
          <div class="curve__plot" aria-hidden="true"></div>
          <p class="curve__for">${e.for}</p>
          <div class="track" aria-hidden="true"><span class="track__chip" data-chip="${name}"></span></div>
          <button type="button" class="btn btn--ghost pressable" data-play="${name}">Play ${name}</button>
          <p class="curve__why">${e.why}</p>
        </article>`;
	})
	.join('\n');

const specimen = `<!doctype html>
<html lang="en" data-motion="system">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Frameless — motion specimen</title>
<!-- GENERATED FILE. DO NOT EDIT. source: ./motion.json · generator: ./build-motion.mjs -->
<link rel="stylesheet" href="../colors_and_type.css">
<link rel="stylesheet" href="./motion.css">
<style>
  body { padding: var(--space-l) var(--space-m) var(--space-3xl); }
  .wrap { max-width: 78rem; margin-inline: auto; }
  .intro { max-width: 60ch; }
  .lede { font-size: var(--step-2); font-weight: 500; line-height: 1.35; max-width: 46ch; }

  .rule { border: 0; border-top: 2px solid var(--ink); margin-block: var(--space-xl); opacity: 0.16; }

  /* Die-cut chrome. Halo + keyline, no shadow anywhere. */
  .cut {
    background: var(--halo);
    border: var(--sticker-keyline, 2px) solid var(--ink);
    padding: var(--sticker-halo-fixed);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
    gap: var(--space-m);
  }

  .curve { padding: var(--space-s); background: var(--halo); border: var(--sticker-keyline, 2px) solid var(--ink); }
  .curve__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2xs); flex-wrap: wrap; }
  .curve__name { font-size: var(--step-3); font-weight: 700; line-height: 1.1; margin: 0; }
  .curve__meta { font-size: var(--step--2); color: var(--ink-muted); margin: 0; }
  .curve__meta code { font-family: var(--font-mono); }
  .curve__for { font-size: var(--step--1); font-weight: 500; margin-block: var(--space-2xs) var(--space-xs); max-width: none; }
  .curve__why { font-size: var(--step--2); color: var(--ink-muted); margin-block: var(--space-xs) 0; max-width: none; }
  .curve__plot { margin-block: var(--space-xs); }
  .curve__plot svg { display: block; width: 100%; height: auto; }

  .track {
    position: relative;
    height: 3rem;
    margin-block: var(--space-2xs);
    border-top: 2px dashed color-mix(in srgb, var(--ink) 25%, transparent);
    border-bottom: 2px dashed color-mix(in srgb, var(--ink) 25%, transparent);
  }
  .track__chip {
    position: absolute;
    inset-block: 0.5rem;
    left: 0.25rem;
    width: 2rem;
    background: var(--accent);
    border: var(--sticker-keyline, 2px) solid var(--ink);
    rotate: var(--tilt-2);
    translate: 0 0;
  }

  .btn {
    font-family: inherit;
    font-weight: 700;
    font-size: var(--step--1);
    line-height: 1;
    padding: 0.7em 1.1em;
    background: var(--accent);
    color: var(--ink);
    border: var(--sticker-keyline, 2px) solid var(--ink);
    cursor: pointer;
  }
  .btn--ghost { background: transparent; }
  .btn--deep { background: var(--surface-deep); color: var(--halo); border-color: var(--ink); }

  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: var(--space-m); }
  .pad { display: grid; place-items: center; height: 9rem; background: var(--halo); border: var(--sticker-keyline, 2px) solid var(--ink); }
  .pad__label { font-size: var(--step--2); text-transform: uppercase; letter-spacing: var(--tracking-caps); font-weight: 700; }

  .sticker-demo { width: 9rem; aspect-ratio: 3 / 4; background: var(--halo); border: var(--sticker-keyline, 2px) solid var(--ink); display: grid; place-items: center; rotate: var(--tilt-1); font-weight: 900; font-size: var(--step-2); }

  /* The wrong/right press pair. .press-both deliberately uses one curve in both
     directions so the asymmetry can be FELT rather than described. */
  .press-both { transition: transform var(--motion-press); }
  .press-both:active { transform: var(--transform-press); }

  .swap { position: relative; height: 8rem; overflow: hidden; background: var(--halo); border: var(--sticker-keyline, 2px) solid var(--ink); }
  .swap__panel { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 900; font-size: var(--step-3); background: var(--halo); }
  .swap__panel[data-panel="b"] { background: var(--surface-deep); color: var(--accent); }
  .swap__panel { transition: transform var(--motion-slide); }
  .swap[data-showing="a"] .swap__panel[data-panel="a"] { transform: translateX(0); }
  .swap[data-showing="a"] .swap__panel[data-panel="b"] { transform: translateX(100%); }
  .swap[data-showing="b"] .swap__panel[data-panel="a"] { transform: translateX(-100%); }
  .swap[data-showing="b"] .swap__panel[data-panel="b"] { transform: translateX(0); }

  .settle-demo { transition: transform var(--motion-settle), opacity var(--motion-settle); }
  .settle-demo[data-state="out"] { transform: translateY(-2rem); opacity: 0; }

  .status { display: inline-flex; align-items: center; gap: var(--space-2xs); font-size: var(--step--1); font-weight: 700; padding: 0.4em 0.8em; background: var(--halo); border: var(--sticker-keyline, 2px) solid var(--ink); }
  .status[data-on="true"] { background: var(--accent); }

  .deep { background: var(--surface-deep); color: var(--halo); padding: var(--space-l) var(--space-m); margin-block: var(--space-xl); }
  .deep h2 { color: var(--accent); }

  table { border-collapse: collapse; width: 100%; font-size: var(--step--1); }
  th, td { text-align: left; padding: 0.5em 0.7em; border-bottom: 1px solid color-mix(in srgb, var(--ink) 20%, transparent); vertical-align: top; }
  th { font-weight: 700; }
  td code { font-family: var(--font-mono); font-size: 0.95em; }
</style>
</head>
<body>
<div class="wrap">

  <header class="intro">
    <p class="text-caption">Frameless · motion specimen · generated from <code>motion.json</code></p>
    <h1>Motion you can feel</h1>
    <p class="lede">${motion.meta.governing_idea}</p>
    <p class="text-body">Every value on this page was read out of <code>motion.json</code> at build time. Nothing here is hand-typed, so if a curve on screen disagrees with the JSON, the generator is broken — not the documentation.</p>
    <p>
      <span class="status" id="rm-status" data-on="false">prefers-reduced-motion: <span id="rm-value">no-preference</span></span>
      <button type="button" class="btn btn--ghost pressable" id="rm-toggle">Simulate reduced motion</button>
    </p>
  </header>

  <hr class="rule">

  <section>
    <h2>The six curves</h2>
    <p class="text-body">Six is the whole vocabulary. If a motion does not fit one of them, the motion is wrong.</p>
    <div class="grid">
${curveCards}
    </div>
  </section>

  <hr class="rule">

  <section>
    <h2>Press and release are not the same curve</h2>
    <p class="text-body">Hold each pad down for a second and let go. The left one uses <code>press</code> in both directions — it reads as a state toggle. The right one presses on <code>press</code> and returns on <code>release</code> — it reads as a thumb coming off vinyl. This asymmetry is the single most load-bearing decision in the motion system, and it only exists to be felt.</p>
    <div class="pair">
      <div>
        <div class="pad"><span class="sticker-demo press-both">hold</span></div>
        <p class="text-caption">One curve both ways — <code>press</code> / <code>press</code>. Wrong.</p>
      </div>
      <div>
        <div class="pad"><span class="sticker-demo pressable">hold</span></div>
        <p class="text-caption">Asymmetric — <code>press</code> down, <code>release</code> up. Right.</p>
      </div>
    </div>
  </section>

  <hr class="rule">

  <section>
    <h2>Peel</h2>
    <p class="text-body">Hover it, or tab to it and it lifts on focus. <code>peel</code> is the only curve that overshoots, and the peel state is where the elevation scale steps up — <code>--shadow-peel</code>, a stacked <code>drop-shadow()</code> that follows the die-cut silhouette. Every die-cut object already casts <code>--elev-sticker</code> at rest; the peel raises it to <code>--elev-lifted</code>. <strong>box-shadow is not used in this system — a filter follows the alpha silhouette, a box-shadow follows the box.</strong></p>
    <div class="pad">
      <button type="button" class="sticker-demo peelable" style="cursor:pointer">peel me</button>
    </div>
  </section>

  <hr class="rule">

  <section>
    <h2>Slide — the A to B swap</h2>
    <p class="text-body">This is the curve the <code>output-switcher</code> runs on, which makes it the most-seen motion in the brand. Symmetric, because a swap has no privileged direction.</p>
    <div class="swap" id="swap" data-showing="a">
      <div class="swap__panel" data-panel="a">React</div>
      <div class="swap__panel" data-panel="b">Solid</div>
    </div>
    <p><button type="button" class="btn pressable" id="swap-btn">Swap</button></p>
  </section>

  <hr class="rule">

  <section>
    <h2>Settle</h2>
    <p class="text-body">Long tail, and it never passes its target. A settling object that bounces reads as a bug.</p>
    <div class="pad"><span class="sticker-demo settle-demo" id="settle" data-state="in">placed</span></div>
    <p><button type="button" class="btn pressable" id="settle-btn">Drop it in</button></p>
  </section>

  <div class="deep">
    <h2>Reduced motion is mandatory</h2>
    <p>Under <code>${motion.reduced_motion.media_query}</code> every duration collapses to <strong>${motion.reduced_motion.durations_ms}ms</strong>, every easing becomes <strong>${motion.reduced_motion.timing_function}</strong>, every transform token becomes <strong>${motion.reduced_motion.transforms}</strong>, and the only motion left is an opacity fade capped at <strong>${motion.reduced_motion.opacity_fade_max_ms}ms</strong>.</p>
    <p>${motion.reduced_motion.rationale}</p>
    <p>Press <em>Simulate reduced motion</em> at the top of the page and play the curves again. Everything on this page still works; nothing on it moves.</p>
  </div>

  <section>
    <h2>Reference</h2>
    <table>
      <thead><tr><th>Name</th><th>CSS variable</th><th>Timing function</th><th>Duration</th><th>For</th></tr></thead>
      <tbody>
${names
	.map((name) => {
		const e = motion.easings[name];
		return `        <tr><td><strong>${name}</strong></td><td><code>--motion-${name}</code></td><td><code>${e.css_timing_function}</code></td><td><code>${e.duration_ms}ms</code></td><td>${e.for}</td></tr>`;
	})
	.join('\n')}
      </tbody>
    </table>
  </section>

</div>

<script type="application/json" id="motion-data">
${JSON.stringify({ easings: motion.easings, transforms: motion.transforms, reduced_motion: motion.reduced_motion }, null, 2)}
</script>
<script>
  // Everything below reads the inlined motion.json payload. The specimen cannot
  // drift from the source of truth because it has no values of its own.
  const DATA = JSON.parse(document.getElementById('motion-data').textContent);

  /* ── Bezier plots, drawn from the coefficients ──────────────────────────── */
  const S = 132, PAD = 14;
  for (const [name, easing] of Object.entries(DATA.easings)) {
    const host = document.querySelector('.curve[data-curve="' + name + '"] .curve__plot');
    if (!host) continue;
    const c = easing.cubic_bezier;
    const x = (t) => PAD + t * (S - 2 * PAD);
    const y = (v) => S - PAD - v * (S - 2 * PAD);
    const path = c
      ? 'M ' + x(0) + ' ' + y(0) + ' C ' + x(c[0]) + ' ' + y(c[1]) + ', ' + x(c[2]) + ' ' + y(c[3]) + ', ' + x(1) + ' ' + y(1)
      : 'M ' + x(0) + ' ' + y(0) + ' L ' + x(1) + ' ' + y(1);
    host.innerHTML =
      '<svg viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="' + name + ' easing curve">' +
      '<rect x="' + PAD + '" y="' + PAD + '" width="' + (S - 2 * PAD) + '" height="' + (S - 2 * PAD) + '" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-width="1"/>' +
      '<path d="' + path + '" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* ── Play buttons — the chip actually travels on the real curve ─────────── */
  document.querySelectorAll('[data-play]').forEach((button) => {
    const name = button.dataset.play;
    const easing = DATA.easings[name];
    const chip = document.querySelector('[data-chip="' + name + '"]');
    let out = false;
    button.addEventListener('click', () => {
      // Read the token off the cascade so simulated reduced motion is honoured.
      const styles = getComputedStyle(document.documentElement);
      const dur = styles.getPropertyValue('--duration-' + name).trim() || easing.duration_ms + 'ms';
      const ease = styles.getPropertyValue('--ease-' + name).trim() || easing.css_timing_function;
      chip.style.transition = 'translate ' + dur + ' ' + ease;
      out = !out;
      const track = chip.parentElement;
      const distance = track.clientWidth - chip.offsetWidth - 8;
      chip.style.translate = out ? distance + 'px 0' : '0 0';
    });
  });

  /* ── Swap, settle ──────────────────────────────────────────────────────── */
  const swap = document.getElementById('swap');
  document.getElementById('swap-btn').addEventListener('click', () => {
    swap.dataset.showing = swap.dataset.showing === 'a' ? 'b' : 'a';
  });

  const settle = document.getElementById('settle');
  document.getElementById('settle-btn').addEventListener('click', () => {
    settle.dataset.state = 'out';
    requestAnimationFrame(() => requestAnimationFrame(() => { settle.dataset.state = 'in'; }));
  });

  /* ── Reduced-motion readout and simulator ──────────────────────────────── */
  const mq = matchMedia(DATA.reduced_motion.media_query);
  const statusEl = document.getElementById('rm-status');
  const valueEl = document.getElementById('rm-value');
  const toggle = document.getElementById('rm-toggle');
  let simulated = false;
  const render = () => {
    const on = simulated || mq.matches;
    document.documentElement.dataset.motion = on ? 'reduced' : 'system';
    statusEl.dataset.on = String(on);
    valueEl.textContent = mq.matches ? 'reduce (system)' : simulated ? 'reduce (simulated)' : 'no-preference';
    toggle.textContent = simulated ? 'Stop simulating' : 'Simulate reduced motion';
  };
  mq.addEventListener('change', render);
  toggle.addEventListener('click', () => { simulated = !simulated; render(); });
  render();
</script>
</body>
</html>
`;

/* ── write or check ──────────────────────────────────────────────────────── */

const outputs = [
	[cssPath, css],
	[specimenPath, specimen],
];

if (process.argv.includes('--check')) {
	let failed = 0;
	for (const [path, expected] of outputs) {
		let actual = '';
		try {
			actual = readFileSync(path, 'utf8');
		} catch {
			console.error(`MISSING  ${path}`);
			failed++;
			continue;
		}
		if (actual !== expected) {
			console.error(`DRIFTED  ${path} — does not match motion.json`);
			failed++;
		} else {
			console.log(`ok       ${path}`);
		}
	}
	process.exit(failed === 0 ? 0 : 1);
}

for (const [path, contents] of outputs) {
	writeFileSync(path, contents);
	console.log(`wrote    ${path}`);
}
