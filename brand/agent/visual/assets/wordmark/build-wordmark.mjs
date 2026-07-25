#!/usr/bin/env node
/* Frameless — wordmark generator
 * ============================================================================
 * Generates every OUTLINED wordmark asset in this folder directly from the
 * licensed Que Grotesque WOFF2 subsets in ../../fonts/.
 *
 *     node brand/agent/visual/assets/wordmark/build-wordmark.mjs
 *     node brand/agent/visual/assets/wordmark/build-wordmark.mjs --check
 *
 * WHY THIS EXISTS
 * The live CSS wordmark (./wordmark.css) is the primary artefact because it
 * stays editable. But a favicon and an Open Graph card are rendered where live
 * text cannot be relied on — a favicon has no access to a self-hosted @font-face
 * in every context, and an OG card is scraped and rasterised by machines that
 * will never load a webfont. Those need real outlines.
 *
 * Drawing those outlines by hand would mean the SVG only *resembled* Que
 * Grotesque. Every path in every SVG this script writes is the actual glyph
 * contour out of the actual shipped WOFF2, so the outlined lockup and the live
 * lockup are the same letterforms by construction rather than by eye.
 *
 * LICENSING: this script READS the WOFF2 and writes glyph outlines for the six
 * fixed brand strings below. It does not copy, re-encode or redistribute the
 * font. Outlines of a specific logotype are the normal, permitted way to ship a
 * wordmark. See ../../fonts/LICENSE.md.
 *
 * Node stdlib only (zlib.brotliDecompressSync). No dependencies, no network.
 * ============================================================================ */

import { brotliDecompressSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fontDir = resolve(here, '../../fonts');

/* ============================================================================
 * 1. WOFF2 → sfnt tables
 * ==========================================================================*/

const KNOWN_TAGS = [
	'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
	'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern',
	'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
	'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
	'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
	'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
	'Gloc', 'Feat', 'Sill',
];

function readWoff2(path) {
	const buf = readFileSync(path);
	if (buf.toString('ascii', 0, 4) !== 'wOF2') throw new Error(`${path}: not a WOFF2 file`);
	const numTables = buf.readUInt16BE(12);
	const totalCompressedSize = buf.readUInt32BE(20);

	let p = 48;
	const readBase128 = () => {
		let result = 0;
		for (let i = 0; i < 5; i++) {
			const byte = buf[p++];
			result = (result << 7) | (byte & 0x7f);
			if (!(byte & 0x80)) return result >>> 0;
		}
		throw new Error('base128 overflow');
	};

	const directory = [];
	for (let i = 0; i < numTables; i++) {
		const flags = buf[p++];
		const index = flags & 0x3f;
		let tag;
		if (index === 63) {
			tag = buf.toString('ascii', p, p + 4);
			p += 4;
		} else {
			tag = KNOWN_TAGS[index];
		}
		const transform = (flags >> 6) & 0x3;
		const origLength = readBase128();
		const transformed = tag === 'glyf' || tag === 'loca' ? transform !== 3 : transform !== 0;
		const transformLength = transformed ? readBase128() : origLength;
		directory.push({ tag, transform, origLength, transformLength, transformed });
	}

	const compressed = buf.subarray(p, p + totalCompressedSize);
	const stream = brotliDecompressSync(compressed);

	const tables = new Map();
	let offset = 0;
	for (const entry of directory) {
		tables.set(entry.tag, { ...entry, data: stream.subarray(offset, offset + entry.transformLength) });
		offset += entry.transformLength;
	}
	return tables;
}

/* ============================================================================
 * 2. The WOFF2 transformed-glyf reconstruction
 *
 * glyf is stored transformed (transform 0) in these subsets, so the outlines
 * are not sitting there as a TrueType glyf table waiting to be read. They are
 * split across seven parallel sub-streams with a custom triplet coding for the
 * point deltas. This is a faithful port of the reference decoder's
 * TripletDecode / ReconstructGlyf, which is the only way to get real contours
 * out of these files without a font library.
 * ==========================================================================*/

function read255UShort(view) {
	const code = view.data[view.p++];
	if (code === 253) {
		const value = (view.data[view.p] << 8) | view.data[view.p + 1];
		view.p += 2;
		return value;
	}
	if (code === 254) return view.data[view.p++] + 253;
	if (code === 255) return view.data[view.p++] + 253 * 2;
	return code;
}

function decodeGlyf(glyfTable) {
	const d = glyfTable.data;
	const version = d.readUInt32BE(0);
	if ((version & 0xffff0000) !== 0) throw new Error('unexpected transformed glyf version');
	const numGlyphs = d.readUInt16BE(4);

	const sizes = [];
	for (let i = 0; i < 7; i++) sizes.push(d.readUInt32BE(8 + i * 4));

	let cursor = 36;
	const sub = sizes.map((size) => {
		const slice = d.subarray(cursor, cursor + size);
		cursor += size;
		return { data: slice, p: 0 };
	});
	const [nContourStream, nPointsStream, flagStream, glyphStream, compositeStream] = sub;

	const withSign = (flag, value) => ((flag & 1) ? value : -value);

	const glyphs = [];
	for (let gid = 0; gid < numGlyphs; gid++) {
		const nContours = nContourStream.data.readInt16BE(nContourStream.p);
		nContourStream.p += 2;

		if (nContours === 0) {
			glyphs.push({ contours: [] });
			continue;
		}
		if (nContours < 0) {
			// Composite. Not needed for any brand string; fail loudly rather than
			// silently emitting a blank glyph.
			glyphs.push({ composite: true, contours: [] });
			// Consume the component records so later glyphs stay aligned.
			let more = true;
			while (more) {
				const flags = compositeStream.data.readUInt16BE(compositeStream.p);
				compositeStream.p += 4; // flags + glyphIndex
				compositeStream.p += flags & 0x0001 ? 4 : 2; // ARG_1_AND_2_ARE_WORDS
				if (flags & 0x0008) compositeStream.p += 2;
				else if (flags & 0x0040) compositeStream.p += 4;
				else if (flags & 0x0080) compositeStream.p += 8;
				more = Boolean(flags & 0x0020);
			}
			if (glyphStream) read255UShort(glyphStream); // instruction size follows
			continue;
		}

		const pointsPerContour = [];
		let totalPoints = 0;
		for (let c = 0; c < nContours; c++) {
			const n = read255UShort(nPointsStream);
			pointsPerContour.push(n);
			totalPoints += n;
		}

		const points = [];
		let x = 0;
		let y = 0;
		for (let i = 0; i < totalPoints; i++) {
			const raw = flagStream.data[flagStream.p++];
			const onCurve = !(raw >> 7);
			const flag = raw & 0x7f;
			let dx = 0;
			let dy = 0;
			const g = glyphStream.data;
			let q = glyphStream.p;
			if (flag < 10) {
				dx = 0;
				dy = withSign(flag, ((flag & 14) << 7) + g[q]);
				q += 1;
			} else if (flag < 20) {
				dx = withSign(flag, (((flag - 10) & 14) << 7) + g[q]);
				dy = 0;
				q += 1;
			} else if (flag < 84) {
				const b0 = flag - 20;
				const b1 = g[q];
				dx = withSign(flag, 1 + (b0 & 0x30) + (b1 >> 4));
				dy = withSign(flag >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f));
				q += 1;
			} else if (flag < 120) {
				const b0 = flag - 84;
				dx = withSign(flag, 1 + ((b0 / 12) << 8) + g[q]);
				dy = withSign(flag >> 1, 1 + ((((b0 % 12) >> 2) << 8)) + g[q + 1]);
				q += 2;
			} else if (flag < 124) {
				const b2 = g[q + 1];
				dx = withSign(flag, (g[q] << 4) + (b2 >> 4));
				dy = withSign(flag >> 1, ((b2 & 0x0f) << 8) + g[q + 2]);
				q += 3;
			} else {
				dx = withSign(flag, (g[q] << 8) + g[q + 1]);
				dy = withSign(flag >> 1, (g[q + 2] << 8) + g[q + 3]);
				q += 4;
			}
			glyphStream.p = q;
			x += dx;
			y += dy;
			points.push({ x, y, onCurve });
		}

		read255UShort(glyphStream); // instruction size — instructions live in their own stream

		const contours = [];
		let index = 0;
		for (const count of pointsPerContour) {
			contours.push(points.slice(index, index + count));
			index += count;
		}
		glyphs.push({ contours });
	}

	return { numGlyphs, glyphs };
}

/* ============================================================================
 * 3. cmap, head, hhea, hmtx
 * ==========================================================================*/

function parseCmap(table) {
	const d = table.data;
	const numTables = d.readUInt16BE(2);
	let best = null;
	for (let i = 0; i < numTables; i++) {
		const platform = d.readUInt16BE(4 + i * 8);
		const encoding = d.readUInt16BE(6 + i * 8);
		const offset = d.readUInt32BE(8 + i * 8);
		const format = d.readUInt16BE(offset);
		const score =
			platform === 3 && encoding === 10 ? 4 : platform === 3 && encoding === 1 ? 3 : platform === 0 ? 2 : 1;
		if (!best || score > best.score) best = { platform, encoding, offset, format, score };
	}
	const map = new Map();
	const { offset, format } = best;
	if (format === 4) {
		const segCountX2 = d.readUInt16BE(offset + 6);
		const segCount = segCountX2 / 2;
		const endBase = offset + 14;
		const startBase = endBase + segCountX2 + 2;
		const deltaBase = startBase + segCountX2;
		const rangeBase = deltaBase + segCountX2;
		for (let s = 0; s < segCount; s++) {
			const end = d.readUInt16BE(endBase + s * 2);
			const start = d.readUInt16BE(startBase + s * 2);
			const delta = d.readInt16BE(deltaBase + s * 2);
			const rangeOffset = d.readUInt16BE(rangeBase + s * 2);
			if (start === 0xffff) continue;
			for (let c = start; c <= end && c !== 0x10000; c++) {
				let gid;
				if (rangeOffset === 0) {
					gid = (c + delta) & 0xffff;
				} else {
					const glyphIndexAddress = rangeBase + s * 2 + rangeOffset + (c - start) * 2;
					gid = d.readUInt16BE(glyphIndexAddress);
					if (gid !== 0) gid = (gid + delta) & 0xffff;
				}
				if (gid) map.set(c, gid);
			}
		}
	} else if (format === 12) {
		const nGroups = d.readUInt32BE(offset + 12);
		for (let g = 0; g < nGroups; g++) {
			const base = offset + 16 + g * 12;
			const start = d.readUInt32BE(base);
			const end = d.readUInt32BE(base + 4);
			const startGid = d.readUInt32BE(base + 8);
			for (let c = start; c <= end; c++) map.set(c, startGid + (c - start));
		}
	} else {
		throw new Error(`unsupported cmap format ${format}`);
	}
	return map;
}

function loadFont(file) {
	const tables = readWoff2(resolve(fontDir, file));
	const head = tables.get('head').data;
	const hhea = tables.get('hhea').data;
	const hmtx = tables.get('hmtx').data;
	const unitsPerEm = head.readUInt16BE(18);
	const ascender = hhea.readInt16BE(4);
	const descender = hhea.readInt16BE(6);
	const numberOfHMetrics = hhea.readUInt16BE(34);
	const cmap = parseCmap(tables.get('cmap'));
	const { glyphs } = decodeGlyf(tables.get('glyf'));
	const advance = (gid) => {
		const i = Math.min(gid, numberOfHMetrics - 1);
		return hmtx.readUInt16BE(i * 4);
	};
	return { file, unitsPerEm, ascender, descender, cmap, glyphs, advance };
}

/* ============================================================================
 * 4. Contours → SVG path data
 *
 * TrueType outlines are quadratic. Consecutive off-curve points imply an
 * on-curve point at their midpoint, which is why this is not a straight
 * point-to-command mapping. Y is flipped here (font units are y-up, SVG is
 * y-down) so the emitted path needs no transform to sit correctly.
 * ==========================================================================*/

function contoursToPath(contours, originX, baselineY, scale) {
	const X = (v) => +(originX + v * scale).toFixed(2);
	const Y = (v) => +(baselineY - v * scale).toFixed(2);
	const out = [];

	for (const points of contours) {
		if (points.length === 0) continue;

		let start = 0;
		let startPoint;
		const first = points[0];
		const last = points[points.length - 1];
		if (first.onCurve) {
			startPoint = first;
			start = 1;
		} else if (last.onCurve) {
			startPoint = last;
			start = 0;
		} else {
			startPoint = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2, onCurve: true };
			start = 0;
		}

		out.push(`M${X(startPoint.x)} ${Y(startPoint.y)}`);

		const ordered = [];
		for (let i = 0; i < points.length; i++) {
			const point = points[(start + i) % points.length];
			if (point === startPoint) continue;
			ordered.push(point);
		}
		ordered.push(startPoint);

		let control = null;
		for (const point of ordered) {
			if (point.onCurve) {
				if (control) {
					out.push(`Q${X(control.x)} ${Y(control.y)} ${X(point.x)} ${Y(point.y)}`);
					control = null;
				} else {
					out.push(`L${X(point.x)} ${Y(point.y)}`);
				}
			} else if (control) {
				const mid = { x: (control.x + point.x) / 2, y: (control.y + point.y) / 2 };
				out.push(`Q${X(control.x)} ${Y(control.y)} ${X(mid.x)} ${Y(mid.y)}`);
				control = point;
			} else {
				control = point;
			}
		}
		if (control) out.push(`Q${X(control.x)} ${Y(control.y)} ${X(startPoint.x)} ${Y(startPoint.y)}`);
		out.push('Z');
	}
	return out.join('');
}

/* Lay out a string and return { d, width, height, top, bottom } in px at the
   requested size, with the display tracking from the type system applied. */
function typeset(font, text, sizePx, trackingEm) {
	const scale = sizePx / font.unitsPerEm;
	const tracking = trackingEm * font.unitsPerEm;
	let pen = 0;
	const parts = [];
	let minY = Infinity;
	let maxY = -Infinity;
	let minX = Infinity;
	let maxX = -Infinity;

	for (const char of text) {
		const gid = font.cmap.get(char.codePointAt(0));
		if (gid === undefined) throw new Error(`glyph missing from ${font.file}: ${JSON.stringify(char)}`);
		const glyph = font.glyphs[gid];
		if (glyph.composite) throw new Error(`composite glyph unsupported: ${JSON.stringify(char)}`);
		if (glyph.contours.length) {
			parts.push(contoursToPath(glyph.contours, pen * scale, 0, scale));
			for (const contour of glyph.contours) {
				for (const point of contour) {
					minY = Math.min(minY, point.y);
					maxY = Math.max(maxY, point.y);
					minX = Math.min(minX, (pen + point.x) * scale);
					maxX = Math.max(maxX, (pen + point.x) * scale);
				}
			}
		}
		pen += font.advance(gid) + tracking;
	}

	return {
		d: parts.join(''),
		advanceWidth: +((pen - tracking) * scale).toFixed(2),
		inkLeft: +minX.toFixed(2),
		inkRight: +maxX.toFixed(2),
		inkTop: +(-maxY * scale).toFixed(2),
		inkBottom: +(-minY * scale).toFixed(2),
		inkHeight: +((maxY - minY) * scale).toFixed(2),
	};
}

/* ============================================================================
 * 5. The brand geometry — MEASURED OFF THE CONCEPT ART, NOT OFF FLAT PNGs
 *
 * The lockup in brand/_source/concept/CONCEPT-ART-AUTHORITATIVE.jpeg is built
 * outward in four layers, and all four are load-bearing:
 *
 *   1. lime fill        #cce007
 *   2. thick black keyline
 *   3. thick cream band #e0dfca
 *   4. A HEAVY OFFSET DROP SHADOW
 *
 * Layer 4 is the one this generator previously did not draw, on the strength of
 * a measurement taken from four flat sticker PNGs and generalised into a
 * kit-wide prohibition. It is the most recognisable single quality of the mark.
 *
 * Ratios, as a proportion of the lockup's INK HEIGHT (the letterform is the
 * die-cut object, so its ink height is its longest meaningful edge):
 *
 *   keyline  9.0%   the black stroke is nearly as heavy as the band
 *   band    11.5%   chunky, per ../../tokens/sticker.css's 6-8% of WIDTH rule
 *                   applied to a lockup whose width is many times its height
 *   shadow   dx 1.8%, dy 8.5%   straight down and a little to the right
 *
 * ── THE KEYLINE IS OFFSET, NOT CENTRED ──────────────────────────────────────
 *
 * Look at the art closely: the black around each letter is THICKER at the
 * bottom-right than at the top-left. The black is not a centred outline, it is
 * an offset copy — which is what makes the lime read as sitting on top of it
 * rather than inside it. That offset is the "text shadow / sticker feel" the
 * owner named, and drawing the keyline centred is why the previous lockup read
 * as flat even before the cast shadow was removed.
 *
 * The offset is smaller than the keyline's own width (2.8% against 9.0%), so
 * the black still fully surrounds the lime on the light side. Push it past the
 * width and the mark comes apart at the top-left.
 *
 * Strokes in SVG are centred on the path, so a visible band of width W needs a
 * stroke-width of 2W — hence the doubling below.
 * ==========================================================================*/

const HALO_RATIO = 0.115;
const KEYLINE_RATIO = 0.09;
const KEYLINE_DX_RATIO = 0.012;
const KEYLINE_DY_RATIO = 0.028;
const SHADOW_DX_RATIO = 0.018;
const SHADOW_DY_RATIO = 0.085;

const TOKENS = {
	fill: '#cce007',
	ink: '#0a0d09',
	halo: '#e0dfca',
	deep: '#0b1714',
	cream: '#e0dfca',
	shadow: '#000000',
};

function dieCut(
	pathData,
	inkHeight,
	{
		fill,
		ink = TOKENS.ink,
		halo = TOKENS.halo,
		id,
		keylineRatio = KEYLINE_RATIO,
		haloRatio = HALO_RATIO,
		shadow = TOKENS.shadow,
		shadowOpacity = 0.95,
	},
) {
	const keyline = inkHeight * keylineRatio;
	const band = inkHeight * haloRatio;
	const inkStroke = +(keyline * 2).toFixed(2);
	const haloStroke = +((keyline + band) * 2).toFixed(2);
	const kdx = +(inkHeight * KEYLINE_DX_RATIO).toFixed(2);
	const kdy = +(inkHeight * KEYLINE_DY_RATIO).toFixed(2);
	const dx = +(inkHeight * SHADOW_DX_RATIO).toFixed(2);
	const dy = +(inkHeight * SHADOW_DY_RATIO).toFixed(2);
	return {
		keyline,
		band,
		shadowDx: dx,
		shadowDy: dy,
		defs: `    <path id="${id}" d="${pathData}"/>`,
		/* Four layers. The shadow and the keyline are both DISPLACED copies of a
		   silhouette rather than filters, so the asset renders correctly in
		   scrapers and rasterisers that do not run SVG filters — which is the
		   entire reason these outlined files exist. */
		layers: [
			`    <use href="#${id}" transform="translate(${dx} ${dy})" fill="var(--wordmark-shadow, ${shadow})" stroke="var(--wordmark-shadow, ${shadow})" stroke-width="${haloStroke}" stroke-linejoin="round" stroke-linecap="round" opacity="${shadowOpacity}"/>`,
			`    <use href="#${id}" fill="var(--wordmark-halo, ${halo})" stroke="var(--wordmark-halo, ${halo})" stroke-width="${haloStroke}" stroke-linejoin="round" stroke-linecap="round"/>`,
			`    <use href="#${id}" transform="translate(${kdx} ${kdy})" fill="var(--wordmark-keyline, ${ink})" stroke="var(--wordmark-keyline, ${ink})" stroke-width="${inkStroke}" stroke-linejoin="round" stroke-linecap="round"/>`,
			`    <use href="#${id}" fill="var(--wordmark-fill, ${fill})"/>`,
		].join('\n'),
		pad: keyline + band,
		padBottom: keyline + band + dy,
		padRight: keyline + band + dx,
	};
}

/* ============================================================================
 * 6. The assets
 * ==========================================================================*/

const black = loadFont('QueGrotesque-Black.woff2');
const bold = loadFont('QueGrotesque-Bold.woff2');

const WORD = 'frameless';
const TRACKING = -0.02; // --tracking-display, from ../../colors_and_type.css

const outputs = [];

/* ── frameless-wordmark.svg — the full outlined lockup ─────────────────── */
{
	const size = 200;
	const word = typeset(black, WORD, size, TRACKING);
	const cut = dieCut(word.d, word.inkHeight, { fill: TOKENS.fill, id: 'frameless-word' });
	// The viewBox has to hold the SHADOW as well as the band, so the box is
	// asymmetric: the shadow is offset down and to the right.
	const x = +(word.inkLeft - cut.pad).toFixed(2);
	const y = +(word.inkTop - cut.pad).toFixed(2);
	const w = +(word.inkRight - word.inkLeft + cut.pad + cut.padRight).toFixed(2);
	const h = +(word.inkBottom - word.inkTop + cut.pad + cut.padBottom).toFixed(2);

	outputs.push([
		'frameless-wordmark.svg',
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" role="img" aria-labelledby="frameless-wordmark-title">
  <title id="frameless-wordmark-title">frameless</title>
  <!-- GENERATED. source: ../../fonts/QueGrotesque-Black.woff2 via ./build-wordmark.mjs
       Real Que Grotesque Black contours, not a redrawing. Display tracking applied.
       Four layers, outward: heavy offset shadow, cream band, black keyline, lime
       fill. The shadow is drawn as a displaced copy of the band silhouette rather
       than as an SVG filter, so it survives rasterisers that do not run filters.
       Recolour by setting the wordmark-fill custom property on an ancestor when
       this file is inlined; the baked values are fallbacks for standalone use.
       MUST SIT ON A DARK BED (#0b1714). Lime on any light bed is 1.09 to 1.48:1. -->
  <defs>
${cut.defs}
  </defs>
  <g>
${cut.layers}
  </g>
</svg>
`,
	]);
}

/* ── frameless-mark.svg — the mark-only lockup ─────────────────────────────
   A small-format lockup carries a HEAVIER cut than the measured ratio gives.
   The ratio's own justification is that the keyline is the only thing
   separating a die-cut object from its bed; at mark scale the ratio produces a
   sub-pixel keyline, which fails that justification on its own terms. So the
   override is not a departure from the rule, it is the rule applied. */
function markSvg({ size = 128, cornerRatio = 0.16 } = {}) {
	const glyphSize = size * 0.82;
	const letter = typeset(black, 'f', glyphSize, 0);
	const cut = dieCut(letter.d, letter.inkHeight, {
		fill: TOKENS.fill,
		id: 'frameless-f',
		keylineRatio: 0.06,
		haloRatio: 0.09,
	});
	// Centre the 'f' ink box inside the tile, biased UP by half the shadow offset
	// so the object — letter plus its shadow — is what looks centred, rather than
	// the letter alone sitting high with the shadow hanging off the bottom.
	const inkW = letter.inkRight - letter.inkLeft;
	const inkH = letter.inkBottom - letter.inkTop;
	const dx = +((size - inkW) / 2 - letter.inkLeft - cut.shadowDx / 2).toFixed(2);
	const dy = +((size - inkH) / 2 - letter.inkTop - cut.shadowDy / 2).toFixed(2);
	const r = +(size * cornerRatio).toFixed(2);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="frameless-mark-title">
  <title id="frameless-mark-title">Frameless</title>
  <!-- GENERATED. source: ../../fonts/QueGrotesque-Black.woff2 via ./build-wordmark.mjs -->
  <defs>
${cut.defs}
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" fill="var(--wordmark-bed, ${TOKENS.deep})"/>
  <g transform="translate(${dx} ${dy})">
${cut.layers}
  </g>
</svg>
`;
}

outputs.push(['frameless-mark.svg', markSvg({ size: 128 })]);

/* ── favicon.svg — the mark at favicon proportions ─────────────────────── */
{
	// At 16px the 1.4%-of-ink-height keyline is sub-pixel, so the favicon uses a
	// deliberately heavier cut. This is the one place the ratio is overridden,
	// and it is overridden because the ratio's own justification (the keyline is
	// the only thing separating the object from its bed) fails when the keyline
	// falls below one device pixel.
	const size = 64;
	const letter = typeset(black, 'f', size * 0.8, 0);
	const keyline = size * 0.05;
	const band = size * 0.075;
	const sdx = +(size * 0.012).toFixed(2);
	const sdy = +(size * 0.045).toFixed(2);
	const inkW = letter.inkRight - letter.inkLeft;
	const inkH = letter.inkBottom - letter.inkTop;
	const dx = +((size - inkW) / 2 - letter.inkLeft - sdx / 2).toFixed(2);
	const dy = +((size - inkH) / 2 - letter.inkTop - sdy / 2).toFixed(2);
	outputs.push([
		'favicon.svg',
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="frameless-favicon-title">
  <title id="frameless-favicon-title">Frameless</title>
  <!-- GENERATED from ../../fonts/QueGrotesque-Black.woff2 by ./build-wordmark.mjs
       Heavier cut than the ratio prescribes: below one device pixel a keyline
       stops separating the mark from its bed, which is the whole job. The shadow
       is kept even at 16px — it is the one thing that makes the tile read as an
       object rather than as a letter in a box. -->
  <rect width="${size}" height="${size}" rx="${(size * 0.18).toFixed(2)}" fill="${TOKENS.deep}"/>
  <defs><path id="favicon-f" d="${letter.d}"/></defs>
  <g transform="translate(${dx} ${dy})">
    <use href="#favicon-f" transform="translate(${sdx} ${sdy})" fill="${TOKENS.shadow}" stroke="${TOKENS.shadow}" stroke-width="${((keyline + band) * 2).toFixed(2)}" stroke-linejoin="round" opacity="0.85"/>
    <use href="#favicon-f" fill="${TOKENS.halo}" stroke="${TOKENS.halo}" stroke-width="${((keyline + band) * 2).toFixed(2)}" stroke-linejoin="round"/>
    <use href="#favicon-f" fill="${TOKENS.ink}" stroke="${TOKENS.ink}" stroke-width="${(keyline * 2).toFixed(2)}" stroke-linejoin="round"/>
    <use href="#favicon-f" fill="${TOKENS.fill}"/>
  </g>
</svg>
`,
	]);
}

/* ── og-card.svg — 1200x630 ────────────────────────────────────────────── */
{
	const W = 1200;
	const H = 630;
	const word = typeset(black, WORD, 168, TRACKING);
	const cut = dieCut(word.d, word.inkHeight, { fill: TOKENS.fill, id: 'og-word' });
	const wordX = +(96 - word.inkLeft).toFixed(2);
	const wordY = 300;

	// One line, and it is a SUBHEAD — the headline is the wordmark itself, and
	// "Compile once, output anywhere." belongs to the page, not to the card.
	// There is deliberately no second line counting the targets: see
	// ../../../verbal/messaging.md, "Never count the targets".
	const line1 = typeset(bold, 'One source in. Framework-native code out.', 40, 0);

	// The six marks, in canonical order, EACH IN ITS OWN BRAND COLOUR. A mark may
	// never render in --accent; rendering them in a single flat cream was the
	// previous version's most visible mistake, and the concept art shows all six
	// in full colour.
	const FW_LOGO = {
		react: '#61dafb',
		vue: '#42b883',
		svelte: '#ff3e00',
		solid: '#76b3e1',
		angular: '#dd0031',
		qwik: '#18b6f6',
	};
	const marks = ['react', 'vue', 'svelte', 'solid', 'angular', 'qwik'].map((name) => {
		const svg = readFileSync(resolve(here, `../logos/${name}.svg`), 'utf8');
		const d = /<path d="([^"]+)"/.exec(svg)[1];
		return { name, d };
	});
	const markSize = 34;
	const markGap = 150;
	const markRow = marks
		.map((mark, i) => {
			const x = 96 + i * markGap;
			const y = H - 118;
			// Uppercase at --tracking-caps, matching .badge-label. Que Grotesque
			// Black/Bold has very tight apertures — at 20px a lowercase 'e' closes
			// up and reads as a 'c'. Caps remove the failure mode entirely, and the
			// type system already specifies caps for exactly this role.
			const label = typeset(bold, mark.name.toUpperCase(), 19, 0.06);
			return `    <g transform="translate(${x} ${y})">
      <g transform="scale(${(markSize / 24).toFixed(4)})"><path d="${mark.d}" fill="${FW_LOGO[mark.name]}"/></g>
      <g transform="translate(${(markSize + 12).toFixed(2)} ${(markSize * 0.72).toFixed(2)})"><path d="${label.d}" fill="${TOKENS.cream}"/></g>
    </g>`;
		})
		.join('\n');

	outputs.push([
		'og-card.svg',
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="og-title">
  <title id="og-title">Frameless — compile once, output anywhere</title>
  <!-- GENERATED by ./build-wordmark.mjs. Every glyph is an outlined Que Grotesque
       contour, so this card needs no font to render correctly in a scraper. -->
  <rect width="${W}" height="${H}" fill="${TOKENS.deep}"/>
  <!-- The bed is never a flat fill. A ruled grid at very low alpha, which is the
       one texture that survives JPEG re-encoding by a social scraper. -->
  <g stroke="${TOKENS.cream}" stroke-opacity="0.05" stroke-width="1">
${Array.from({ length: Math.floor(W / 48) }, (_, i) => `    <path d="M${(i + 1) * 48} 0V${H}"/>`).join('\n')}
${Array.from({ length: Math.floor(H / 48) }, (_, i) => `    <path d="M0 ${(i + 1) * 48}H${W}"/>`).join('\n')}
  </g>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="${TOKENS.cream}" stroke-opacity="0.22" stroke-width="3"/>
  <defs>
${cut.defs}
  </defs>
  <g transform="translate(${wordX} ${wordY})">
${cut.layers}
  </g>
  <g transform="translate(${(96 - line1.inkLeft).toFixed(2)} 392)"><path d="${line1.d}" fill="${TOKENS.cream}"/></g>
${markRow}
</svg>
`,
	]);
}

/* ── metrics.json — what the live component must match ─────────────────── */
{
	const word = typeset(black, WORD, 100, TRACKING);
	outputs.push([
		'metrics.json',
		`${JSON.stringify(
			{
				$comment:
					'GENERATED by ./build-wordmark.mjs. Measured off the shipped WOFF2, not asserted. Used to verify that the live CSS wordmark and the outlined SVG are the same letterforms at the same size.',
				source: '../../fonts/QueGrotesque-Black.woff2',
				string: WORD,
				trackingEm: TRACKING,
				unitsPerEm: black.unitsPerEm,
				ascender: black.ascender,
				descender: black.descender,
				at100px: {
					advanceWidth: word.advanceWidth,
					inkLeft: word.inkLeft,
					inkRight: word.inkRight,
					inkWidth: +(word.inkRight - word.inkLeft).toFixed(2),
					inkTop: word.inkTop,
					inkBottom: word.inkBottom,
					inkHeight: word.inkHeight,
				},
				dieCutRatios: {
					band: HALO_RATIO,
					keyline: KEYLINE_RATIO,
					keylineDx: KEYLINE_DX_RATIO,
					keylineDy: KEYLINE_DY_RATIO,
					shadowDx: SHADOW_DX_RATIO,
					shadowDy: SHADOW_DY_RATIO,
					basis: 'ink height of the lockup — the letterform is the die-cut object',
					traceTo: 'brand/_source/concept/CONCEPT-ART-AUTHORITATIVE.jpeg, and ../../tokens/sticker.css for the chunky-band rule',
					note: 'The shadow is the fourth layer and it is not optional. A lockup drawn without it is not this wordmark.',
				},
				liveCssEquivalents: {
					$comment:
						'What ./wordmark.css must set so the live lockup and this outlined one are the same object. -webkit-text-stroke is CENTRED on the glyph edge, so a visible width of W needs a stroke-width of 2W; these values are already doubled and are expressed in em at the wordmark font-size.',
					keylineStrokeEm: +(2 * KEYLINE_RATIO * (word.inkHeight / 100)).toFixed(4),
					bandStrokeEm: +(2 * (KEYLINE_RATIO + HALO_RATIO) * (word.inkHeight / 100)).toFixed(4),
					keylineDxEm: +(KEYLINE_DX_RATIO * (word.inkHeight / 100)).toFixed(4),
					keylineDyEm: +(KEYLINE_DY_RATIO * (word.inkHeight / 100)).toFixed(4),
					shadowDxEm: +(SHADOW_DX_RATIO * (word.inkHeight / 100)).toFixed(4),
					shadowDyEm: +(SHADOW_DY_RATIO * (word.inkHeight / 100)).toFixed(4),
				},
			},
			null,
			2,
		)}\n`,
	]);
}

/* ============================================================================
 * 7. write / check
 * ==========================================================================*/

if (process.argv.includes('--check')) {
	let failed = 0;
	for (const [name, contents] of outputs) {
		let actual = null;
		try {
			actual = readFileSync(resolve(here, name), 'utf8');
		} catch {
			console.error(`MISSING  ${name}`);
			failed++;
			continue;
		}
		if (actual !== contents) {
			console.error(`DRIFTED  ${name}`);
			failed++;
		} else {
			console.log(`ok       ${name}`);
		}
	}
	process.exit(failed === 0 ? 0 : 1);
}

for (const [name, contents] of outputs) {
	writeFileSync(resolve(here, name), contents);
	console.log(`wrote    ${name}`);
}
