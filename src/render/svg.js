import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { FontFamily, linePath, lineWidth, missingChars, wrap } from './text.js';

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

function color(value, brand) {
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
function frame(layer, spec) {
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

function renderText(layer, spec, brand, warnings) {
  const family = brand.fonts.get(layer.font.slice(6));
  if (!family) throw new Error(`font ${layer.font} has no loadable file in brand ${brand.kit.brand_id}`);
  const size = layer.size;
  const { font: f, note } = family.pick(layer.weight ?? 400, size);
  if (note) warnings.push(`${layer.id}: ${note}`);
  const missing = missingChars(f, layer.text);
  if (missing.length) warnings.push(`${layer.id}: no glyph for ${missing.join(' ')}`);
  const { x, y, w } = frame(layer, spec);
  const tracking = layer.tracking ?? 0;
  const lh = size * (layer.line_height ?? 1.2);
  const ascent = (f.ascent / f.unitsPerEm) * size;
  const { fill, opacity } = color(layer.color, brand);
  let d = '';
  wrap(f, layer.text, size, tracking, w).forEach((line, i) => {
    const lw = lineWidth(f, line, size, tracking);
    if (lw > w + 0.5) warnings.push(`${layer.id}: word wider than its frame ('${line}')`);
    const dx = layer.align === 'center' ? (w - lw) / 2 : layer.align === 'right' ? w - lw : 0;
    d += linePath(f, line, x + dx, y + ascent + i * lh, size, tracking);
  });
  return `<path id="${esc(layer.id)}" d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`;
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

function renderImage(layer, spec, brand, warnings, defs) {
  const { x, y, w, h } = frame(layer, spec);
  const id = layer.src.slice('asset://'.length);
  const file = findAsset(brand, id);
  const op = layer.opacity ?? 1;
  if (!file) {
    // Visible placeholder so a missing asset is never silently dropped.
    warnings.push(`${layer.id}: asset "${id}" not found, placeholder drawn`);
    return `<g id="${esc(layer.id)}" opacity="${op}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#9AA0A6"/>` +
      `<path d="M${n(x)} ${n(y)}L${n(x + w)} ${n(y + h)}M${n(x + w)} ${n(y)}L${n(x)} ${n(y + h)}" stroke="#6B7075" stroke-width="4"/></g>`;
  }
  const mime = IMAGE_MIME[extname(file).toLowerCase()];
  const data = readFileSync(file).toString('base64');
  const par = { cover: 'xMidYMid slice', contain: 'xMidYMid meet', fill: 'none' }[layer.fit];
  const clip = `clip-${layer.id}`;
  defs.push(`<clipPath id="${esc(clip)}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath>`);
  return `<image id="${esc(layer.id)}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="${par}" ` +
    `clip-path="url(#${esc(clip)})" opacity="${op}" href="data:${mime};base64,${data}"/>`;
}

function renderShape(layer, spec, brand) {
  const { x, y, w, h } = frame(layer, spec);
  const { fill, opacity } = color(layer.fill, brand);
  const op = n(opacity * (layer.opacity ?? 1));
  const attrs = `id="${esc(layer.id)}" fill="${fill}" fill-opacity="${op}"`;
  if (layer.shape === 'ellipse') {
    return `<ellipse ${attrs} cx="${n(x + w / 2)}" cy="${n(y + h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}"/>`;
  }
  return `<rect ${attrs} x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${layer.radius ?? 0}"/>`;
}

/**
 * @param {object} spec - a validated design spec
 * @param {{brandsDir: string}} opts
 * @returns {{svg: string, warnings: string[]}}
 */
export function specToSvg(spec, { brandsDir }) {
  const brand = loadBrand(brandsDir, spec.brand_ref);
  const warnings = [];
  const defs = [];
  const { w, h } = spec.canvas;
  const body = spec.layers.map((layer) => {
    if (layer.type === 'text') return renderText(layer, spec, brand, warnings);
    if (layer.type === 'image') return renderImage(layer, spec, brand, warnings, defs);
    return renderShape(layer, spec, brand);
  });
  const bg = spec.canvas.background ? color(spec.canvas.background, brand) : { fill: '#FFFFFF', opacity: 1 };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>${defs.join('')}</defs>` +
    `<rect width="${w}" height="${h}" fill="${bg.fill}" fill-opacity="${bg.opacity}"/>` +
    body.join('') +
    '</svg>';
  return { svg, warnings };
}
