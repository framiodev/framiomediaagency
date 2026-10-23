import { readFileSync } from 'node:fs';
import * as fontkit from 'fontkit';

/**
 * A brand font token's faces. Variable fonts are instanced on demand
 * (wght from the layer, opsz from the font size, like CSS "auto");
 * static files are chosen by their OS/2 weight.
 */
export class FontFamily {
  /** @param {string[]} paths */
  constructor(paths) {
    this.faces = paths.map((path) => {
      const font = fontkit.create(readFileSync(path));
      return { font, weight: font['OS/2']?.usWeightClass ?? 400, axes: font.variationAxes ?? {} };
    });
    this.cache = new Map();
  }

  /** @returns {{font: object, note: string|null}} */
  pick(weight, size) {
    const variable = this.faces.find((f) => f.axes.wght);
    if (variable) {
      const { wght, opsz } = variable.axes;
      const coords = { wght: Math.min(Math.max(weight, wght.min), wght.max) };
      if (opsz) coords.opsz = Math.min(Math.max(size, opsz.min), opsz.max);
      const key = JSON.stringify(coords);
      if (!this.cache.has(key)) this.cache.set(key, variable.font.getVariation(coords));
      const note = coords.wght !== weight ? `weight ${weight} outside font range, using ${coords.wght}` : null;
      return { font: this.cache.get(key), note };
    }
    const face = this.faces.reduce((best, f) => {
      const d = Math.abs(f.weight - weight) - Math.abs(best.weight - weight);
      return d < 0 || (d === 0 && f.weight > best.weight) ? f : best;
    });
    return { font: face.font, note: face.weight !== weight ? `weight ${weight} not available, using ${face.weight}` : null };
  }
}

/** Shaped run of one line: glyphs with positions, in font units. */
function shape(font, text) {
  return font.layout(text);
}

export function lineWidth(font, text, size, tracking) {
  const run = shape(font, text);
  const scale = size / font.unitsPerEm;
  const n = run.glyphs.length;
  return run.advanceWidth * scale + Math.max(0, n - 1) * tracking * size;
}

/** Greedy word wrap; explicit \n starts a new line and no-break spaces hold words together. */
export function wrap(font, text, size, tracking, maxWidth) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/ +/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && lineWidth(font, next, size, tracking) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

const fmt = (v) => (Math.round(v * 100) / 100).toString();

/** SVG path data for one line with its baseline at (x, y). */
export function linePath(font, text, x, y, size, tracking) {
  const run = shape(font, text);
  const scale = size / font.unitsPerEm;
  let pen = x;
  let d = '';
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    const gx = pen + pos.xOffset * scale;
    const gy = y - pos.yOffset * scale;
    for (const c of glyph.path.commands) {
      const pts = [];
      for (let k = 0; k < c.args.length; k += 2) {
        pts.push(`${fmt(gx + c.args[k] * scale)} ${fmt(gy - c.args[k + 1] * scale)}`);
      }
      const op = { moveTo: 'M', lineTo: 'L', quadraticCurveTo: 'Q', bezierCurveTo: 'C', closePath: 'Z' }[c.command];
      d += op + pts.join(' ');
    }
    pen += pos.xAdvance * scale + tracking * size;
  });
  return d;
}

export function missingChars(font, text) {
  return [...new Set(text.replace(/\s/g, ''))].filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)));
}
