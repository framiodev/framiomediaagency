import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { renderSpec } from '../render/png.js';
import { loadBrand } from '../render/svg.js';

const defaultConfigPath = fileURLToPath(new URL('../../config/rubric.json', import.meta.url));

// Which rubric criterion (brief section 6) each check feeds.
const CRITERION = {
  contrast_low: 'color',
  missing_glyph: 'typography',
  text_too_small: 'typography',
  safe_area_violation: 'platform',
  text_overlap: 'layout',
  text_partial_overlap: 'layout',
  text_overflow: 'layout',
  asset_missing: 'quality',
  license_unknown: 'brand',
  off_palette: 'brand',
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const intersect = (a, b, tol = 0) =>
  a.x + tol < b.x + b.w && b.x + tol < a.x + a.w && a.y + tol < b.y + b.h && b.y + tol < a.y + a.h;
const contains = (outer, inner, tol = 0) =>
  inner.x >= outer.x - tol && inner.y >= outer.y - tol &&
  inner.x + inner.w <= outer.x + outer.w + tol && inner.y + inner.h <= outer.y + outer.h + tol;
const round = (v) => Math.round(v * 100) / 100;

/** Renders everything except text so contrast is measured against what is really behind it. */
function backgroundPixels(svg, layout, w) {
  const textIds = new Set(layout.filter((l) => l.type === 'text').map((l) => l.id));
  const noText = svg.replace(/<path id="([^"]+)" d="[^"]*"[^>]*\/>/g, (m, id) => (textIds.has(id) ? '' : m));
  const img = new Resvg(noText, { font: { loadSystemFonts: false } }).render();
  return { px: img.pixels, w, h: img.height };
}

/** p-th percentile contrast between the text colour and the pixels under its box. */
function measureContrast(bg, box, rgb, opacity, percentile) {
  const ratios = [];
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(bg.w, Math.ceil(box.x + box.w));
  const y1 = Math.min(bg.h, Math.ceil(box.y + box.h));
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * bg.w + x) * 4;
      const under = [bg.px[i], bg.px[i + 1], bg.px[i + 2]];
      const fg = rgb.map((c, k) => c * opacity + under[k] * (1 - opacity));
      ratios.push(contrastRatio(fg, under));
    }
  }
  if (!ratios.length) return null;
  ratios.sort((a, b) => a - b);
  return ratios[Math.min(ratios.length - 1, Math.floor((ratios.length * percentile) / 100))];
}

/**
 * Runs the deterministic rubric checks on a spec.
 * @param {object} spec
 * @param {{brandsDir: string, config?: object}} opts
 * @returns {{passed: boolean, failures: object[], metrics: object}}
 */
export function checkSpec(spec, { brandsDir, config }) {
  const cfg = config ?? JSON.parse(readFileSync(defaultConfigPath, 'utf8'));
  const { svg, layout } = renderSpec(spec, { brandsDir });
  const brand = loadBrand(brandsDir, spec.brand_ref);
  const { w: W, h: H } = spec.canvas;
  const scale = cfg.display_width_px / W;
  const tol = cfg.overlap_tolerance_px;
  const failures = [];
  const metrics = { display_scale: round(scale), contrast: {} };
  const fail = (code, layer, detail) =>
    failures.push({ code, severity: cfg.severity[code], criterion: CRITERION[code], layer, detail });

  const texts = layout.filter((l) => l.type === 'text');
  const bg = texts.length ? backgroundPixels(svg, layout, W) : null;

  for (const t of texts) {
    // Typography
    if (t.missing.length) fail('missing_glyph', t.id, `no glyph for ${t.missing.join(' ')}`);
    const shown = t.size * scale;
    if (shown < cfg.min_text_px) fail('text_too_small', t.id, `${round(shown)} px on screen, minimum ${cfg.min_text_px}`);

    // Contrast
    const large = shown >= cfg.large_text.min_px || (shown >= cfg.large_text.bold_min_px && t.weight >= cfg.large_text.bold_weight);
    const need = large ? cfg.contrast.large : cfg.contrast.normal;
    const ratio = measureContrast(bg, t.ink, hexToRgb(t.color), t.opacity, cfg.contrast.percentile);
    metrics.contrast[t.id] = ratio === null ? null : round(ratio);
    if (ratio !== null && ratio < need) {
      fail('contrast_low', t.id, `${round(ratio)}:1, needs ${need}:1 (${large ? 'large' : 'normal'} text)`);
    }

    // Overflow from its own frame
    const fr = t.frame;
    if (t.ink.w > fr.w + tol || t.ink.y + t.ink.h > fr.y + fr.h + tol) {
      fail('text_overflow', t.id, `text box ${round(t.ink.w)}×${round(t.ink.h)} exceeds frame ${round(fr.w)}×${round(fr.h)}`);
    }
  }

  // Overlaps: text on text is always wrong; text on a shape/image is only fine when fully inside it.
  layout.forEach((a, i) => {
    if (a.type !== 'text') return;
    layout.forEach((b, j) => {
      if (i === j || !intersect(a.ink, b.ink, tol)) return;
      if (b.type === 'text' && j > i) fail('text_overlap', a.id, `overlaps text "${b.id}"`);
      if (b.type !== 'text' && !contains(b.ink, a.ink, tol)) fail('text_partial_overlap', a.id, `partly covers ${b.type} "${b.id}"`);
    });
  });

  // Safe area: text and contained images (logos, products) must stay inside it.
  const sa = spec.canvas.safe_area ?? { top: 0, bottom: 0, side: 0 };
  const safe = { x: sa.side, y: sa.top, w: W - 2 * sa.side, h: H - sa.top - sa.bottom };
  for (const l of layout) {
    const guarded = l.type === 'text' || (l.type === 'image' && l.fit === 'contain');
    if (guarded && !contains(safe, l.ink, tol)) fail('safe_area_violation', l.id, 'outside the platform safe area');
  }

  // Assets and licenses
  const unknown = new Set(cfg.unknown_licenses);
  const prov = new Map(spec.provenance.assets.map((a) => [a.id, a]));
  for (const l of layout.filter((x) => x.type === 'image')) {
    if (!l.found) fail('asset_missing', l.id, `asset "${l.asset}" has no file`);
    const lic = prov.get(l.asset)?.license ?? '';
    if (unknown.has(lic.trim().toLowerCase())) fail('license_unknown', l.id, `asset "${l.asset}" license is "${lic}"`);
  }

  // Palette: literal hex colours that are not in the brand kit.
  const palette = new Set(Object.values(brand.kit.colors).map((c) => c.hex.toUpperCase()));
  for (const layer of spec.layers) {
    const value = layer.color ?? layer.fill;
    if (value && value.startsWith('#') && !palette.has(value.slice(0, 7).toUpperCase())) {
      fail('off_palette', layer.id, `${value} is not a brand colour`);
    }
  }

  return { passed: !failures.some((f) => f.severity === 'critical'), failures, metrics };
}
