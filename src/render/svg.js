import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { FontFamily, linePath, lineWidth, missingChars } from './text.js';

// Fixed precision keeps SVG text (and therefore PNG bytes) stable across runs.
const n = (v) => Number(v.toFixed(2));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

/**
 * Loads the brand kit a spec points at and resolves its tokens.
 * @param {string} brandsDir - folder holding <brand_id>/brand-kit.json
 */
export function loadBrand(brandsDir, brandId) {
  const kitPath = join(brandsDir, brandId, 'brand-kit.json');
  if (!existsSync(kitPath)) throw new Error(`brand kit not found: ${kitPath}`);
  const kit = JSON.parse(readFileSync(kitPath, 'utf8'));
  const dir = dirname(kitPath);
  const fonts = new Map();
  for (const [token, def] of Object.entries(kit.fonts)) {
    const paths = def.files.map((f) => resolve(dir, f)).filter((f) => existsSync(f));
    if (paths.length) fonts.set(token, new FontFamily(paths));
  }
  return { kit, dir, fonts };
}

export function color(value, brand) {
  let hex = value;
  if (value.startsWith('brand.')) {
    const def = brand.kit.colors[value.slice(6)];
    if (!def) throw new Error(`unknown color token ${value} in brand ${brand.kit.brand_id}`);
    hex = def.hex;
  }
  const alpha = hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;
  return { fill: hex.slice(0, 7), opacity: n(alpha) };
}

/** Converts a grid placement or box into pixel coordinates. */
export function frame(layer, spec) {
  if (layer.box) return layer.box;
  const { w: W, h: H } = spec.canvas;
  if (!layer.grid) return { x: 0, y: 0, w: W, h: H };
  const { cols, rows = 12, margin, gutter } = spec.grid;
  const colW = (W - 2 * margin - (cols - 1) * gutter) / cols;
  const rowH = (H - 2 * margin - (rows - 1) * gutter) / rows;
  const { col, span, row, row_span = 1 } = layer.grid;
  return {
    x: margin + (col - 1) * (colW + gutter),
    y: margin + (row - 1) * (rowH + gutter),
    w: span * colW + (span - 1) * gutter,
    h: row_span * rowH + (row_span - 1) * gutter,
  };
}

/** Bounding box of a box rotated by `deg` around its centre. */
export function rotatedBox(box, deg) {
  if (!deg) return box;
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  const w = box.w * c + box.h * s;
  const h = box.w * s + box.h * c;
  return { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h };
}

/** Rotation and shadow shared by every layer type, as attributes for a wrapping <g>. */
function effects(layer, fr, brand, defs) {
  let attrs = '';
  if (layer.rotate) attrs += ` transform="rotate(${layer.rotate} ${n(fr.x + fr.w / 2)} ${n(fr.y + fr.h / 2)})"`;
  if (layer.shadow) {
    const sh = layer.shadow;
    const c = color(sh.color, brand);
    const id = `shadow-${layer.id}`;
    defs.push(`<filter id="${esc(id)}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${sh.x ?? 0}" dy="${sh.y ?? 8}" ` +
      `stdDeviation="${n((sh.blur ?? 16) / 2)}" flood-color="${c.fill}" flood-opacity="${n((sh.opacity ?? 0.35) * c.opacity)}"/></filter>`);
    attrs += ` filter="url(#${esc(id)})"`;
  }
  return attrs;
}

/** Solid colour or linear gradient; returns the fill attributes. */
function paint(value, layerId, brand, defs) {
  if (typeof value === 'string') {
    const { fill, opacity } = color(value, brand);
    return { attrs: `fill="${fill}" fill-opacity="${opacity}"`, hex: fill, opacity };
  }
  const id = `grad-${layerId}`;
  const a = ((value.angle ?? 0) * Math.PI) / 180;
  const [dx, dy] = [Math.cos(a) / 2, Math.sin(a) / 2];
  const stops = value.stops.map((s) => {
    const c = color(s.color, brand);
    return `<stop offset="${s.offset}" stop-color="${c.fill}" stop-opacity="${c.opacity}"/>`;
  });
  defs.push(`<linearGradient id="${esc(id)}" x1="${n(0.5 - dx)}" y1="${n(0.5 - dy)}" x2="${n(0.5 + dx)}" y2="${n(0.5 + dy)}">${stops.join('')}</linearGradient>`);
  // For contrast checks the layout records the first stop; real pixels are measured anyway.
  const first = color(value.stops[0].color, brand);
  return { attrs: `fill="url(#${esc(id)})"`, hex: first.fill, opacity: first.opacity };
}

const toUpper = (s, lang) => s.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : undefined);

/**
 * Splits text or spans into words carrying their own colour and weight;
 * `br` marks an explicit line break before the word.
 */
function tokens(layer) {
  const runs = layer.spans ?? [{ text: layer.text }];
  const out = [];
  let br = false;
  for (const run of runs) {
    const text = layer.case === 'upper' ? toUpper(run.text, layer.lang) : run.text;
    text.split('\n').forEach((part, i) => {
      if (i > 0) br = true;
      for (const word of part.split(/ +/).filter(Boolean)) {
        out.push({ text: word, color: run.color ?? layer.color, weight: run.weight ?? layer.weight ?? 400, br });
        br = false;
      }
    });
  }
  return out;
}

function renderText(layer, spec, brand, warnings, layout, defs) {
  const family = brand.fonts.get(layer.font.slice(6));
  if (!family) throw new Error(`font ${layer.font} has no loadable file in brand ${brand.kit.brand_id}`);
  const size = layer.size;
  const tracking = layer.tracking ?? 0;
  const fontFor = (weight) => {
    const { font, note } = family.pick(weight, size);
    if (note && !warnings.includes(`${layer.id}: ${note}`)) warnings.push(`${layer.id}: ${note}`);
    return font;
  };
  const base = fontFor(layer.weight ?? 400);
  const words = tokens(layer).map((t) => {
    const font = fontFor(t.weight);
    return { ...t, font, w: lineWidth(font, t.text, size, tracking) };
  });
  const missing = [...new Set(words.flatMap((t) => missingChars(t.font, t.text)))];
  if (missing.length) warnings.push(`${layer.id}: no glyph for ${missing.join(' ')}`);

  const fr = frame(layer, spec);
  const { x, y, w } = fr;
  const space = lineWidth(base, ' ', size, 0) + tracking * size;

  // Greedy wrap over styled words.
  const lines = [[]];
  let used = 0;
  for (const t of words) {
    const line = lines[lines.length - 1];
    const next = line.length ? used + space + t.w : t.w;
    if (t.br || (line.length && next > w)) {
      lines.push([t]);
      used = t.w;
    } else {
      line.push(t);
      used = next;
    }
  }

  const lh = size * (layer.line_height ?? 1.2);
  const ascent = (base.ascent / base.unitsPerEm) * size;
  const descent = (-base.descent / base.unitsPerEm) * size;
  const byColor = new Map();
  let left = Infinity;
  let right = -Infinity;
  lines.forEach((line, i) => {
    const lw = line.reduce((s, t) => s + t.w, 0) + Math.max(0, line.length - 1) * space;
    if (lw > w + 0.5) warnings.push(`${layer.id}: word wider than its frame ("${line.map((t) => t.text).join(' ')}")`);
    const dx = layer.align === 'center' ? (w - lw) / 2 : layer.align === 'right' ? w - lw : 0;
    left = Math.min(left, x + dx);
    right = Math.max(right, x + dx + lw);
    let pen = x + dx;
    for (const t of line) {
      byColor.set(t.color, (byColor.get(t.color) ?? '') + linePath(t.font, t.text, pen, y + ascent + i * lh, size, tracking));
      pen += t.w + space;
    }
  });

  const colors = [...byColor.keys()].map((c) => color(c, brand));
  const ink = { x: left, y, w: right - left, h: ascent + (lines.length - 1) * lh + descent };
  layout.push({
    id: layer.id, type: 'text', role: layer.role ?? null, frame: fr,
    ink: rotatedBox(ink, layer.rotate),
    // Every distinct run colour, so contrast can be checked for the weakest one.
    colors: colors.map((c) => ({ hex: c.fill, opacity: c.opacity })),
    color: colors[0].fill, opacity: colors[0].opacity,
    size, weight: Math.min(...words.map((t) => t.weight)), lines: lines.length, missing,
  });
  const paths = [...byColor.entries()].map(([c, d]) => {
    const { fill, opacity } = color(c, brand);
    return `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`;
  });
  return `<g id="${esc(layer.id)}" data-role="text"${effects(layer, fr, brand, defs)}>${paths.join('')}</g>`;
}

/** Width and height from a PNG header; null for other formats. */
function pngSize(buf) {
  if (buf.subarray(1, 4).toString() !== 'PNG') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** The box an image with fit=contain actually covers inside its frame. */
function containBox(fr, size) {
  if (!size) return fr;
  const s = Math.min(fr.w / size.w, fr.h / size.h);
  const w = size.w * s;
  const h = size.h * s;
  return { x: fr.x + (fr.w - w) / 2, y: fr.y + (fr.h - h) / 2, w, h };
}

/** Finds the file for asset://<id> under the brand's assets folder. */
function findAsset(brand, id) {
  const base = join(brand.dir, 'assets', id);
  if (existsSync(base) && IMAGE_MIME[extname(base).toLowerCase()]) return base;
  const dir = dirname(base);
  if (!existsSync(dir)) return null;
  const stem = base.slice(dir.length + 1);
  const hit = readdirSync(dir).find((f) => f.slice(0, -extname(f).length) === stem && IMAGE_MIME[extname(f).toLowerCase()]);
  return hit ? join(dir, hit) : null;
}

const polygonPoints = (pts, fr) => pts.map(([px, py]) => `${n(fr.x + px * fr.w)},${n(fr.y + py * fr.h)}`).join(' ');

/** Clip shape for an image: its frame, an ellipse, or a polygon. */
function clipShape(mask, fr) {
  const { x, y, w, h } = fr;
  if (mask === 'ellipse') return `<ellipse cx="${n(x + w / 2)}" cy="${n(y + h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}"/>`;
  if (mask?.points) return `<polygon points="${polygonPoints(mask.points, fr)}"/>`;
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/>`;
}

function renderImage(layer, spec, brand, warnings, defs, layout) {
  const fr = frame(layer, spec);
  const { x, y, w, h } = fr;
  const id = layer.src.slice('asset://'.length);
  const file = findAsset(brand, id);
  const op = layer.opacity ?? 1;
  const entry = { id: layer.id, type: 'image', frame: fr, ink: rotatedBox(fr, layer.rotate), fit: layer.fit, asset: id, found: Boolean(file) };
  layout.push(entry);
  const fx = effects(layer, fr, brand, defs);
  if (!file) {
    // Visible placeholder so a missing asset is never silently dropped.
    warnings.push(`${layer.id}: asset "${id}" not found, placeholder drawn`);
    return `<g id="${esc(layer.id)}" opacity="${op}"${fx}><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#9AA0A6"/>` +
      `<path d="M${n(x)} ${n(y)}L${n(x + w)} ${n(y + h)}M${n(x + w)} ${n(y)}L${n(x)} ${n(y + h)}" stroke="#6B7075" stroke-width="4"/></g>`;
  }
  const mime = IMAGE_MIME[extname(file).toLowerCase()];
  const bytes = readFileSync(file);
  if (layer.fit === 'contain') entry.ink = rotatedBox(containBox(fr, pngSize(bytes)), layer.rotate);
  const data = bytes.toString('base64');
  const par = { cover: 'xMidYMid slice', contain: 'xMidYMid meet', fill: 'none' }[layer.fit];
  const clip = `clip-${layer.id}`;
  defs.push(`<clipPath id="${esc(clip)}">${clipShape(layer.mask, fr)}</clipPath>`);
  let filter = '';
  if (layer.grayscale) {
    defs.push(`<filter id="gray-${esc(layer.id)}"><feColorMatrix type="saturate" values="0"/></filter>`);
    filter = ` filter="url(#gray-${esc(layer.id)})"`;
  }
  let tint = '';
  if (layer.tint) {
    const c = color(layer.tint.color, brand);
    tint = `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c.fill}" fill-opacity="${n(layer.tint.opacity * c.opacity)}"/>`;
  }
  return `<g id="${esc(layer.id)}" opacity="${op}"${fx}><g clip-path="url(#${esc(clip)})">` +
    `<image x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="${par}"${filter} href="data:${mime};base64,${data}"/>${tint}</g></g>`;
}

function renderShape(layer, spec, brand, layout, defs) {
  const fr = frame(layer, spec);
  const { x, y, w, h } = fr;
  const p = paint(layer.fill, layer.id, brand, defs);
  const op = n(layer.opacity ?? 1);
  layout.push({ id: layer.id, type: 'shape', shape: layer.shape, frame: fr, ink: rotatedBox(fr, layer.rotate), color: p.hex, opacity: n(p.opacity * op) });
  const fx = effects(layer, fr, brand, defs);
  let el;
  if (layer.shape === 'ellipse') {
    el = `<ellipse ${p.attrs} cx="${n(x + w / 2)}" cy="${n(y + h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}"/>`;
  } else if (layer.shape === 'polygon') {
    el = `<polygon ${p.attrs} points="${polygonPoints(layer.points, fr)}"/>`;
  } else {
    el = `<rect ${p.attrs} x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${layer.radius ?? 0}"/>`;
  }
  return `<g id="${esc(layer.id)}" opacity="${op}"${fx}>${el}</g>`;
}

/** One tile of a repeating motif, drawn in a square of side s. */
function motif(name, s, c) {
  const sw = n(s * 0.05);
  const stroke = `fill="none" stroke="${c}" stroke-width="${sw}"`;
  const m = s / 2;
  switch (name) {
    case 'dots':
      return `<circle cx="${m}" cy="${m}" r="${n(s * 0.12)}" fill="${c}"/>`;
    case 'diagonal':
      return `<path d="M0 ${s}L${s} 0M${-m} ${m}L${m} ${-m}M${m} ${s + m}L${s + m} ${m}" ${stroke}/>`;
    case 'grid':
      return `<path d="M0 0H${s}M0 0V${s}" ${stroke}/>`;
    case 'chevron':
      return `<path d="M0 ${n(s * 0.75)}L${m} ${n(s * 0.25)}L${s} ${n(s * 0.75)}" ${stroke}/>`;
    default: {
      // star8: two overlapping squares, the classic eight-point star.
      const r = s * 0.3;
      const sq = (a) => [0, 1, 2, 3].map((k) => {
        const t = a + (k * Math.PI) / 2;
        return `${n(m + r * Math.SQRT2 * Math.cos(t))},${n(m + r * Math.SQRT2 * Math.sin(t))}`;
      }).join(' ');
      return `<polygon points="${sq(Math.PI / 4)}" ${stroke}/><polygon points="${sq(0)}" ${stroke}/><circle cx="${m}" cy="${m}" r="${n(r * 0.35)}" ${stroke}/>`;
    }
  }
}

function renderPattern(layer, spec, brand, layout, defs) {
  const fr = frame(layer, spec);
  const c = color(layer.color, brand);
  const s = layer.scale ?? 80;
  const id = `pat-${layer.id}`;
  defs.push(`<pattern id="${esc(id)}" width="${s}" height="${s}" patternUnits="userSpaceOnUse" x="${n(fr.x)}" y="${n(fr.y)}">${motif(layer.motif, s, c.fill)}</pattern>`);
  const op = n((layer.opacity ?? 1) * c.opacity);
  layout.push({ id: layer.id, type: 'pattern', frame: fr, ink: fr, color: c.fill, opacity: op });
  return `<rect id="${esc(layer.id)}" x="${n(fr.x)}" y="${n(fr.y)}" width="${n(fr.w)}" height="${n(fr.h)}" fill="url(#${esc(id)})" opacity="${op}"/>`;
}

/**
 * @param {object} spec - a validated design spec
 * @param {{brandsDir: string}} opts
 * @returns {{svg: string, warnings: string[], layout: object[], background: string}}
 */
export function specToSvg(spec, { brandsDir, transparent = false }) {
  const brand = loadBrand(brandsDir, spec.brand_ref);
  const warnings = [];
  const defs = [];
  const layout = [];
  const { w, h } = spec.canvas;
  const body = spec.layers.map((layer) => {
    if (layer.type === 'text') return renderText(layer, spec, brand, warnings, layout, defs);
    if (layer.type === 'image') return renderImage(layer, spec, brand, warnings, defs, layout);
    if (layer.type === 'pattern') return renderPattern(layer, spec, brand, layout, defs);
    return renderShape(layer, spec, brand, layout, defs);
  });
  const bg = spec.canvas.background ? color(spec.canvas.background, brand) : { fill: '#FFFFFF', opacity: 1 };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>${defs.join('')}</defs>` +
    (transparent ? '' : `<rect width="${w}" height="${h}" fill="${bg.fill}" fill-opacity="${bg.opacity}"/>`) +
    body.join('') +
    '</svg>';
  return { svg, warnings, layout, background: bg.fill };
}
