#!/usr/bin/env node
/**
 * Frameless brand kit — structural gate
 *
 * Proves the kit is internally sound rather than merely plausible. Every number in this kit
 * is recomputed from its stored parameters; nothing is trusted because it is written down.
 *
 *   node brand/tools/structural-gate.mjs
 *
 * Exits non-zero on any failure so it is usable in CI.
 * Node stdlib only — no dependencies, no network.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(KIT, '..');

let failures = 0;
let checks = 0;
const rel = (p) => relative(REPO, p);

function check(name, fn) {
  checks++;
  try {
    const detail = fn();
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${name}`);
    for (const line of String(err.message).split('\n')) console.log(`          ${line}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Every file under the kit, excluding provenance. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === '_source' || entry === 'node_modules') continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

const files = walk(KIT);
const textFiles = files.filter((f) => ['.css', '.html', '.json', '.md', '.mjs', '.svg', '.yaml'].includes(extname(f)));
const read = (f) => readFileSync(f, 'utf8');

/**
 * The same text with its COMMENTS removed, for the checks that hunt for real
 * declarations and real references.
 *
 * A comment is prose. `elevation.css` explains, in a comment, why the noise tile
 * writes its internal filter reference as `%75rl%28%23g%29` instead of `url(#g)`
 * — and in doing so it has to type the characters `url(` and `)`. A naive
 * url()-extracting regex reads that sentence as a path and reports the kit as
 * broken. Stripping comments first is the fix; a reference that only exists
 * inside a comment is not a reference.
 */
function code(file) {
  const txt = read(file);
  const ext = extname(file);
  if (ext === '.css' || ext === '.mjs') return txt.replace(/\/\*[\s\S]*?\*\//g, '');
  if (ext === '.html' || ext === '.svg') {
    return txt.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  }
  return txt;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fluid scales — recompute every clamp() from utopia.config.json
// ─────────────────────────────────────────────────────────────────────────────
section('Fluid scales (recomputed from utopia.config.json)');

const cfgPath = join(KIT, 'agent/visual/tokens/utopia.config.json');

check('utopia.config.json exists and parses', () => {
  if (!existsSync(cfgPath)) throw new Error('missing');
  JSON.parse(read(cfgPath));
  return rel(cfgPath);
});

if (existsSync(cfgPath)) {
  const cfg = JSON.parse(read(cfgPath));
  const { minViewport: minVW, maxViewport: maxVW, minFontSize: minFS, maxFontSize: maxFS,
          minTypeScale: minR, maxTypeScale: maxR, stepsUp, stepsDown } = cfg.shared;

  // Utopia's fluid value: a line through (minVW,minSize) and (maxVW,maxSize), clamped.
  const r4 = (n) => Math.round(n * 1e4) / 1e4;
  const clampFor = (minPx, maxPx) => {
    const slope = (maxPx - minPx) / (maxVW - minVW);
    return {
      min: r4(minPx / 16),
      inter: r4((minPx - slope * minVW) / 16),
      slope: r4(slope * 100),
      max: r4(maxPx / 16),
    };
  };
  const parseClamp = (decl) => {
    const m = decl.match(/clamp\(\s*(-?[\d.]+)rem,\s*(-?[\d.]+)rem\s*\+\s*(-?[\d.]+)vw,\s*(-?[\d.]+)rem\s*\)/);
    if (!m) return null;
    return { min: +m[1], inter: +m[2], slope: +m[3], max: +m[4] };
  };
  const near = (a, b, tol = 0.0002) => Math.abs(a - b) <= tol;

  const declsOf = (file) => {
    const out = new Map();
    for (const line of read(file).split('\n')) {
      const m = line.match(/^\s*(--[\w-]+):\s*(clamp\([^;]+\));/);
      if (m) out.set(m[1], m[2]);
    }
    return out;
  };

  check('fluid-type.css: every clamp() matches its computed value', () => {
    const decls = declsOf(join(KIT, 'agent/visual/tokens/fluid-type.css'));
    const bad = [];
    let n = 0;
    for (let step = -stepsDown; step <= stepsUp; step++) {
      const name = `--step-${step < 0 ? `-${Math.abs(step)}` : step}`;
      const got = parseClamp(decls.get(name) ?? '');
      if (!got) { bad.push(`${name}: missing or unparseable`); continue; }
      const want = clampFor(minFS * minR ** step, maxFS * maxR ** step);
      n++;
      for (const k of ['min', 'inter', 'slope', 'max']) {
        if (!near(got[k], want[k])) bad.push(`${name}.${k}: css ${got[k]} vs computed ${want[k]}`);
      }
    }
    if (bad.length) throw new Error(bad.join('\n'));
    return `${n} steps verified against min ${minR} / max ${maxR}`;
  });

  check('fluid-space.css: every clamp() matches its computed value', () => {
    const decls = declsOf(join(KIT, 'agent/visual/tokens/fluid-space.css'));
    // Utopia rounds space values to whole pixels.
    const names = ['3xs', '2xs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl'];
    const mult = [...cfg.space.multipliers.belowBase].sort((a, b) => a - b)
      .concat([1], cfg.space.multipliers.aboveBase);
    const bad = [];
    let n = 0;
    names.forEach((name, i) => {
      const got = parseClamp(decls.get(`--space-${name}`) ?? '');
      if (!got) { bad.push(`--space-${name}: missing`); return; }
      const want = clampFor(Math.round(minFS * mult[i]), Math.round(maxFS * mult[i]));
      n++;
      for (const k of ['min', 'inter', 'slope', 'max']) {
        if (!near(got[k], want[k])) bad.push(`--space-${name}.${k}: css ${got[k]} vs computed ${want[k]}`);
      }
    });
    if (bad.length) throw new Error(bad.join('\n'));
    return `${n} space steps verified (px-rounded, per Utopia)`;
  });

  check('config URLs are present and encode the shipped parameters', () => {
    const expect = `${minVW},${minFS},${minR},${maxVW},${maxFS},${maxR},${stepsUp},${stepsDown}`;
    for (const which of ['type', 'space']) {
      const url = cfg[which]?.configUrl ?? '';
      if (!url.startsWith('https://utopia.fyi/')) throw new Error(`${which}: missing or non-utopia configUrl`);
      if (!url.includes(expect)) throw new Error(`${which}: configUrl does not encode c=${expect}\n  ${url}`);
    }
    return `both URLs encode c=${expect}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Contrast — recompute every stated ratio from its own hex pair
// ─────────────────────────────────────────────────────────────────────────────
section('Contrast (recomputed from hex, WCAG 2.x)');

const colorPath = join(KIT, 'agent/visual/tokens/color.json');

const srgb = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => srgb(parseInt(full.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

if (existsSync(colorPath)) {
  const color = JSON.parse(read(colorPath));

  const collectPairs = (node, acc = []) => {
    if (Array.isArray(node)) { node.forEach((n) => collectPairs(n, acc)); return acc; }
    if (node && typeof node === 'object') {
      const fg = node.fg_value ?? node.fg ?? node.foreground;
      const bg = node.bg_value ?? node.bg ?? node.background;
      const stated = node.ratio ?? node.contrast ?? node.contrast_ratio;
      if (typeof fg === 'string' && typeof bg === 'string' && stated != null
          && fg.startsWith('#') && bg.startsWith('#')) {
        acc.push({ fg, bg, stated: Number(stated), ctx: node.context ?? node.name ?? '' });
      }
      Object.values(node).forEach((v) => collectPairs(v, acc));
    }
    return acc;
  };

  const pairs = collectPairs(color);

  check('every stated contrast ratio recomputes from its hex pair', () => {
    if (!pairs.length) throw new Error('no fg/bg/ratio triples found in color.json');
    const bad = [];
    for (const p of pairs) {
      const got = Math.round(ratio(p.fg, p.bg) * 100) / 100;
      if (Math.abs(got - p.stated) > 0.02) {
        bad.push(`${p.fg} on ${p.bg}: stated ${p.stated}, computed ${got}${p.ctx ? ` (${p.ctx})` : ''}`);
      }
    }
    if (bad.length) throw new Error(`${bad.length}/${pairs.length} mismatched:\n${bad.join('\n')}`);
    return `${pairs.length} pairs, max delta <= 0.02`;
  });

  check('forbidden pairs genuinely fail AA normal text (< 4.5)', () => {
    const forbidden = collectPairs(color.forbidden_pairs ?? []);
    if (!forbidden.length) throw new Error('no forbidden_pairs recorded — the lime law must be encoded as data');
    const wrong = forbidden
      .map((p) => ({ ...p, got: ratio(p.fg, p.bg) }))
      .filter((p) => p.got >= 4.5);
    if (wrong.length) {
      throw new Error(`listed as forbidden but pass AA:\n${wrong.map((p) => `${p.fg} on ${p.bg} = ${p.got.toFixed(2)}`).join('\n')}`);
    }
    return `${forbidden.length} forbidden pairs, all genuinely below 4.5`;
  });

  check('the lime law: --accent fails on every light bed and clears on the dark one', () => {
    // The beds are READ from the live palette rather than typed here. The
    // version of this check before the rebuild hard-coded #f2efd4 / #fdf8e4 /
    // #ebd5a0 / #1d2c22 — every one of them a colour the rebuild superseded —
    // so it went on passing while testing hexes the kit no longer contains.
    const t = color.tokens ?? {};
    const lime = t['--accent']?.value;
    if (!lime) throw new Error('--accent not declared in color.json');

    const lightBeds = [
      ['#ffffff', 'pure white'],
      [t['--surface']?.light_value, '--surface on the paper island'],
      [t['--band']?.value, '--band, the cream die-cut band'],
      // Every framework sticker's own band is a light bed too, and it is the
      // one an agent is most likely to reach for when labelling a badge.
      ...Object.entries(color.framework_colors?.values ?? {}).map(([fw, v]) => [v.band, `${fw} band`]),
    ].filter(([hex]) => typeof hex === 'string' && hex.startsWith('#'));

    if (lightBeds.length < 9) throw new Error(`only ${lightBeds.length} light beds resolvable from color.json`);

    const passing = lightBeds
      .map(([bg, name]) => ({ bg, name, r: ratio(lime, bg) }))
      .filter((x) => x.r >= 4.5);
    if (passing.length) {
      throw new Error(
        `lime unexpectedly passes as an ink on: ${passing.map((b) => `${b.name} ${b.bg}=${b.r.toFixed(2)}`).join(', ')}`,
      );
    }

    const darkBed = t['--surface']?.value;
    const onDark = ratio(lime, darkBed);
    if (onDark < 4.5) throw new Error(`lime must clear AA on the dark bed ${darkBed}, got ${onDark.toFixed(2)}`);

    // The flagship pairing: a lime FILL with its own label on it.
    const onLime = ratio(t['--accent-ink']?.value, lime);
    if (onLime < 4.5) throw new Error(`--accent-ink on --accent must clear AA, got ${onLime.toFixed(2)}`);

    // And the trap: --ink is cream now, so the pre-rebuild habit of putting it
    // on a lime fill is invisible. Assert that it genuinely fails, so nobody
    // "fixes" this by reaching for --ink.
    const inkOnLime = ratio(t['--ink']?.value, lime);
    if (inkOnLime >= 4.5) throw new Error(`--ink on --accent should be illegible, got ${inkOnLime.toFixed(2)}`);

    return `fails on ${lightBeds.length} light beds, clears ${onDark.toFixed(2)} on ${darkBed}, label ${onLime.toFixed(2)}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. References resolve
// ─────────────────────────────────────────────────────────────────────────────
section('References');

check('every local url()/src/href/@import resolves on disk', () => {
  const bad = [];
  let n = 0;
  for (const f of textFiles) {
    const txt = code(f);
    const refs = [
      ...[...txt.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]),
      ...[...txt.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
      ...[...txt.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((m) => m[1]),
    ];
    for (const r of refs) {
      if (/^(https?:|data:|#|mailto:|\/\/)/.test(r)) continue;
      // Skip documentation examples that show a repo-root path inside a comment.
      if (r.startsWith('brand/')) continue;
      n++;
      const target = resolve(dirname(f), r.split(/[?#]/)[0]);
      if (!existsSync(target)) bad.push(`${rel(f)} -> ${r}`);
    }
  }
  if (bad.length) throw new Error(`${bad.length} unresolved:\n${bad.join('\n')}`);
  return `${n} local references, all resolve`;
});

check('no path escapes the kit', () => {
  const bad = [];
  for (const f of textFiles) {
    for (const m of code(f).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g)) {
      const r = m[1] ?? m[2];
      if (!r || /^(https?:|data:|#)/.test(r)) continue;
      const target = resolve(dirname(f), r);
      if (!target.startsWith(KIT)) bad.push(`${rel(f)} -> ${r}`);
    }
  }
  if (bad.length) throw new Error(`kit is not self-contained:\n${bad.join('\n')}`);
  return 'kit is self-contained';
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Licensing and asset hygiene
// ─────────────────────────────────────────────────────────────────────────────
section('Licensing and assets');

check('no OTF/TTF/WOFF/EOT anywhere in the kit', () => {
  const bad = files.filter((f) => /\.(otf|ttf|ttc|woff|eot)$/i.test(f));
  if (bad.length) throw new Error(`purchased-font source must never be committed:\n${bad.map(rel).join('\n')}`);
  const woff2 = files.filter((f) => f.endsWith('.woff2'));
  if (!woff2.length) throw new Error('no WOFF2 found — the kit has no usable font');
  return `${woff2.length} WOFF2 subsets, no restricted formats`;
});

check('font licence note ships with the kit', () => {
  const p = join(KIT, 'agent/visual/fonts/LICENSE.md');
  if (!existsSync(p)) throw new Error('agent/visual/fonts/LICENSE.md missing');
  const txt = read(p).toLowerCase();
  for (const term of ['redistribut', 'self-hosted']) {
    if (!txt.includes(term)) throw new Error(`LICENSE.md does not mention "${term}"`);
  }
  return 'present, states redistribution terms';
});

check('every raster is 8 bits per sample', () => {
  const bad = [];
  for (const f of files.filter((f) => f.toLowerCase().endsWith('.png'))) {
    const buf = readFileSync(f);
    // PNG: 8-byte signature, then IHDR — bit depth is byte 24.
    if (buf.length > 25 && buf.readUInt32BE(0) === 0x89504e47) {
      const depth = buf[24];
      if (depth !== 8) bad.push(`${rel(f)}: ${depth}-bit`);
    }
  }
  if (bad.length) throw new Error(`normalize to 8-bit:\n${bad.join('\n')}`);
  return 'all PNGs 8-bit';
});

check('trademark note ships with the kit', () => {
  const p = join(KIT, 'agent/visual/assets/README.md');
  if (!existsSync(p)) throw new Error('agent/visual/assets/README.md missing');
  const txt = read(p).toLowerCase();
  if (!txt.includes('trademark')) throw new Error('assets/README.md does not carry a trademark note');
  return 'present';
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Style laws that must hold across the whole kit
// ─────────────────────────────────────────────────────────────────────────────
section('Style laws');

// ── Elevation ───────────────────────────────────────────────────────────────
//
// These four checks replace two that this gate used to run: "box-shadow appears
// nowhere" and "drop-shadow only appears with the peel state". BOTH ARE VOID.
// They encoded a rule measured off four flat vector PNGs and generalised to the
// whole system, and the owner overturned it: the concept art's wordmark and all
// six badges sit on a heavy offset shadow, and deleting that deleted the single
// most recognisable quality of the brand.
//
// The new law, from REBUILD-SPEC.md and tokens/color.json#/depth_law:
//
//   · elevation is MANDATORY and must be present, not merely permitted;
//   · `filter: drop-shadow()` is the primitive, because it follows the alpha
//     silhouette of a die-cut shape rather than its bounding box;
//   · `box-shadow` survives for exactly one documented case, --elev-inset, and
//     only because a filter cannot draw INSIDE an alpha silhouette.
//
// So the assertions invert: a missing shadow is now the failure.

const ELEV_SCALE = ['--elev-sticker', '--elev-card', '--elev-lifted'];
const elevationPath = join(KIT, 'agent/visual/tokens/elevation.css');
const cssFiles = textFiles.filter((f) => f.endsWith('.css'));
const styleFiles = textFiles.filter((f) => /\.(css|html)$/.test(f));

/** Every `--token: value;` declared in a stylesheet, comments stripped. */
function customProps(file) {
  const out = new Map();
  const txt = code(file);
  for (const m of txt.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
    if (!out.has(m[1])) out.set(m[1], m[2].replace(/\s+/g, ' ').trim());
  }
  return out;
}

check('the elevation scale exists, and every step is a drop-shadow', () => {
  if (!existsSync(elevationPath)) throw new Error('agent/visual/tokens/elevation.css missing — the kit has no elevation');
  const props = customProps(elevationPath);
  const bad = [];
  for (const name of ELEV_SCALE) {
    const v = props.get(name);
    if (v == null) { bad.push(`${name}: not declared`); continue; }
    if (!/drop-shadow\(/.test(v)) bad.push(`${name}: declared but is not a drop-shadow — "${v}"`);
    if (/box-shadow|inset/.test(v)) bad.push(`${name}: an outer elevation step may not be a box-shadow or inset — "${v}"`);
  }
  const inset = props.get('--elev-inset');
  if (inset == null) bad.push('--elev-inset: not declared (the one documented box-shadow)');
  else if (!/inset/.test(inset)) bad.push(`--elev-inset: must be an inset shadow — "${inset}"`);
  if (bad.length) throw new Error(`elevation is mandatory and it is drop-shadow():\n${bad.join('\n')}`);
  return `${ELEV_SCALE.length} drop-shadow steps + the documented inset exception`;
});

check('elevation is actually USED, not merely declared', () => {
  const bad = [];

  // 1. No dead step. A scale nobody applies is a scale that was not rebuilt.
  //
  //    The match must sit in DECLARATION position — after a property name and
  //    its colon. Searching for the bare token name instead counts the /human
  //    guideline quoting `--shadow-peel`'s value inside a table cell as a use,
  //    which would let every step in the scale go dead while the gate stayed
  //    green on the strength of the documentation describing them.
  const usedIn = (name) =>
    styleFiles.filter((f) =>
      new RegExp(`(?:filter|background|background-image|--[\\w-]+)\\s*:[^;{}]*var\\(\\s*${name}\\b`).test(code(f)),
    );

  for (const name of ELEV_SCALE) {
    const users = usedIn(name);
    const elsewhere = users.filter((f) => f !== elevationPath);
    if (!users.length) bad.push(`${name}: declared but never applied anywhere in the kit`);
    else if (!elsewhere.length) bad.push(`${name}: only ever used by elevation.css itself`);
  }

  // 2. The three files that carry the brand's physical claim must each cast a
  //    shadow. The wordmark's heavy offset shadow is the most defining quality
  //    of the concept art; the die-cut primitive is what every sticker is built
  //    on; elevation.css owns the scale.
  const mustElevate = [
    'agent/visual/assets/wordmark/wordmark.css',
    'agent/visual/tokens/sticker.css',
    'agent/visual/tokens/elevation.css',
  ];
  for (const r of mustElevate) {
    const p = join(KIT, r);
    if (!existsSync(p)) { bad.push(`${r}: missing`); continue; }
    if (!/drop-shadow\(|var\(\s*--elev-|var\(\s*--shadow-peel/.test(code(p))) {
      bad.push(`${r}: carries no elevation — a die-cut object with no shadow is the failure this rebuild exists to correct`);
    }
  }

  // 3. Elevation has to reach the surfaces, not just the tokens.
  const applying = styleFiles.filter((f) => /filter\s*:[^;}]*(drop-shadow\(|var\(\s*--(elev-|shadow-peel))/.test(code(f)));
  if (applying.length < 4) {
    bad.push(`only ${applying.length} file(s) apply a shadow as a filter — elevation is mandatory across the kit, not a token nobody reaches for`);
  }

  if (bad.length) throw new Error(`${bad.join('\n')}`);
  return `${ELEV_SCALE.length} steps all applied; ${applying.length} files cast a filter shadow`;
});

check('box-shadow appears only as the documented --elev-inset exception', () => {
  const bad = [];
  for (const f of styleFiles) {
    code(f).split('\n').forEach((line, i) => {
      if (!/box-shadow\s*:/.test(line)) return;
      const value = line.slice(line.indexOf('box-shadow:') + 'box-shadow:'.length).split(/[;}]/)[0].trim();
      // Permitted: the inset token, applied or aliased; and an explicit reset.
      if (/^none$/.test(value)) return;
      if (/var\(\s*--elev-inset\b/.test(value)) return;
      bad.push(`${rel(f)}:${i + 1}  box-shadow: ${value}`);
    });
  }
  if (bad.length) {
    throw new Error(
      'A die-cut sticker is an irregular shape. box-shadow casts its BOX, which draws a\n' +
      'rounded rectangle behind a cut edge and kills the illusion. Use filter:\n' +
      'drop-shadow(), which follows the alpha silhouette. The only sanctioned box-shadow\n' +
      'is var(--elev-inset), because a filter cannot draw inside an alpha silhouette:\n' +
      bad.join('\n'),
    );
  }
  return 'only var(--elev-inset)';
});

/* The rule the owner reversed left leftovers behind, and a leftover that
   contradicts the system is worse than a missing one: an agent reading the kit
   cannot tell which sentence is current. elevation.css says outright that any
   surviving "shadows are forbidden" comment is a leftover and is wrong — this
   is that sentence made executable.

   Known leftovers are carried HERE, by file and phrase, rather than by quietly
   narrowing the search. Two properties fall out of that, and both matter more
   than a shorter list:

     · an unlisted leftover fails the gate — the check still bites;
     · a listed leftover that has been FIXED also fails the gate, because a
       stale exemption is how a green check stops meaning anything.

   An exemption therefore has to be deleted when the debt is paid. */
/**
 * Locations still carrying the overturned kit-wide shadow ban, with a reason.
 *
 * A STALE entry also fails this gate, so an exemption self-destructs the moment the debt is
 * paid — the list cannot quietly accumulate. The callout.html entry that seeded this list was
 * removed when its sentence was rewritten, and the gate flagged it as stale on the very next
 * run, which is the behaviour working.
 *
 * Keep it empty unless something genuinely cannot be fixed by the task that finds it.
 */
const SHADOW_BAN_EXEMPTIONS = [];

check('no file still claims the overturned shadow ban', () => {
  const leftovers = [
    /never from a shadow/i,
    /no drop shadow/i,
    /zero drop[- ]shadow/i,
    /nothing floats/i,
    /box-shadow is forbidden/i,
    /shadows? (?:are|is) forbidden/i,
  ];
  const seen = new Set();
  const bad = [];
  for (const f of textFiles) {
    if (f.endsWith('structural-gate.mjs')) continue; // this file names them in order to hunt them
    const lines = read(f).split('\n');
    lines.forEach((line, i) => {
      // The kit documents its own correction, so narration about the old rule
      // and explicit denials of it are both legitimate. Read a two-line window:
      // a sentence wrapped in a comment block puts "…not because" on one line
      // and "box-shadow is forbidden" on the next, and judging the second line
      // alone inverts the meaning of the sentence.
      const window = `${lines[i - 1] ?? ''} ${line}`;
      if (/\b(was|were|used to|previously|leftover|overturned|no longer|banned)\b/i.test(window)) return;
      if (/not because|is not forbidden|never was|it is required/i.test(window)) return;
      if (!leftovers.some((re) => re.test(line))) return;
      const exempt = SHADOW_BAN_EXEMPTIONS.find((e) => rel(f) === `brand/${e.file}` && line.includes(e.phrase));
      if (exempt) { seen.add(exempt); return; }
      bad.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  }
  const stale = SHADOW_BAN_EXEMPTIONS.filter((e) => !seen.has(e));
  if (bad.length) {
    throw new Error(`the kit-wide shadow ban is void; these lines still assert it:\n${bad.join('\n')}`);
  }
  if (stale.length) {
    throw new Error(
      `these exemptions no longer match anything — delete them from this file:\n${stale
        .map((e) => `  ${e.file}  "${e.phrase}"`)
        .join('\n')}`,
    );
  }
  return SHADOW_BAN_EXEMPTIONS.length
    ? `clean, with ${SHADOW_BAN_EXEMPTIONS.length} declared exemption(s) still outstanding`
    : 'no surviving assertion of the ban';
});

check('the page bed is never a flat fill, and the grain survives file://', () => {
  const props = customProps(elevationPath);
  const noise = props.get('--texture-noise');
  if (!noise) throw new Error('--texture-noise not declared — the background is never a flat fill');
  if (!noise.startsWith('url("data:')) {
    throw new Error(
      `--texture-noise must be a self-contained data: URI. An external url() in a mask or\n` +
      `texture is CORS-blocked from file://, which silently flattens the page:\n  ${noise.slice(0, 80)}`,
    );
  }
  const grained = cssFiles.filter((f) => /var\(\s*--texture-noise\b/.test(code(f)));
  if (!grained.length) throw new Error('--texture-noise is declared but never applied');
  return `data: URI noise, applied in ${grained.length} file(s)`;
});

check('font-synthesis is disabled (no faux italic/bold on a static subset)', () => {
  const entry = join(KIT, 'agent/visual/colors_and_type.css');
  if (!existsSync(entry)) throw new Error('colors_and_type.css missing');
  if (!/font-synthesis\s*:\s*none/.test(read(entry))) {
    throw new Error('colors_and_type.css must set font-synthesis: none globally');
  }
  return 'font-synthesis: none';
});

check('reduced motion is honoured wherever motion is defined', () => {
  const motion = files.filter((f) => f.includes('/motion/') && f.endsWith('.css'));
  if (!motion.length) return 'no motion CSS yet — skipped';
  const bad = motion.filter((f) => !/prefers-reduced-motion/.test(read(f)));
  if (bad.length) throw new Error(`missing prefers-reduced-motion:\n${bad.map(rel).join('\n')}`);
  return `${motion.length} motion file(s) honour reduced motion`;
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Kit shape
// ─────────────────────────────────────────────────────────────────────────────
section('Kit shape');

check('the article-shaped folder structure is present', () => {
  const required = [
    'readme.md',
    'magic_trick.md',
    'agent/verbal/positioning.md',
    'agent/verbal/audience.yaml',
    'agent/verbal/messaging.md',
    'agent/verbal/differentiation.md',
    'agent/verbal/voice.md',
    'agent/verbal/concepts.md',
    'agent/visual/colors_and_type.css',
    'agent/visual/tokens/color.json',
    'agent/visual/artifacts/web/page-composition.md',
  ];
  const missing = required.filter((r) => !existsSync(join(KIT, r)));
  if (missing.length) throw new Error(`missing:\n${missing.join('\n')}`);
  return `${required.length} required files present`;
});

check('no placeholder or TODO content ships in the kit', () => {
  const bad = [];
  for (const f of textFiles) {
    if (f.endsWith('structural-gate.mjs')) continue;
    read(f).split('\n').forEach((line, i) => {
      if (/\b(TODO|FIXME|TBD|lorem ipsum|PLACEHOLDER)\b/i.test(line)) {
        bad.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 80)}`);
      }
    });
  }
  if (bad.length) throw new Error(`the charter requires no placeholder files:\n${bad.join('\n')}`);
  return 'no placeholders';
});

check('the kit never claims a framework it does not name canonically', () => {
  const canonical = ['react', 'vue', 'svelte', 'solid', 'angular', 'qwik'];
  const p = join(KIT, 'agent/verbal/positioning.md');
  const txt = read(p).toLowerCase();
  const missing = canonical.filter((fw) => !txt.includes(fw));
  if (missing.length) throw new Error(`positioning.md does not name: ${missing.join(', ')}`);
  return 'all six named in positioning';
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Generated files match their generators
// ─────────────────────────────────────────────────────────────────────────────
section('Generated files');

// Three files in this kit are GENERATED from a source of truth: /human's guideline
// from the token + verbal files, motion.css from motion.json, and the wordmark
// artefacts from the WOFF2. Each generator ships a --check that byte-compares its
// output against regeneration. Without running them here, a hand-edit to a
// generated file passes every other check in this gate — which would quietly break
// the kit's central promise that /human and /agent cannot disagree.
for (const [label, script] of [
  ['/human guideline matches its sources', 'agent/../human/build-guideline.mjs'],
  ['motion.css matches motion.json', 'agent/visual/motion/build-motion.mjs'],
  ['wordmark artefacts match the WOFF2', 'agent/visual/assets/wordmark/build-wordmark.mjs'],
]) {
  check(label, () => {
    const abs = join(KIT, script);
    if (!existsSync(abs)) throw new Error(`generator missing: ${rel(abs)}`);
    const res = spawnSync(process.execPath, [abs, '--check'], { encoding: 'utf8' });
    if (res.status !== 0) {
      throw new Error(`regeneration differs from what is on disk — run:\n  node ${rel(abs)}\n${(res.stdout || '') + (res.stderr || '')}`.trim());
    }
    return 'byte-identical to regeneration';
  });
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(70)}`);
if (failures) {
  console.log(`FAILED — ${failures} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`OK — ${checks} checks passed. The kit is internally consistent.`);
