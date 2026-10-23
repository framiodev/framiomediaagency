import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { checkSpec, contrastRatio } from '../src/rubric/checks.js';
import { makeTestBrands } from './helpers/brand.js';

let brandsDir;
before(() => {
  brandsDir = makeTestBrands();
});
after(() => rmSync(brandsDir, { recursive: true, force: true }));

// A clean spec: every check passes. Each test breaks exactly one thing.
const spec = () => ({
  spec_version: '0.1',
  intent: { message: 'm', audience: 'a', platform: 'instagram_post_4x5' },
  canvas: { w: 1080, h: 1350, unit: 'px', background: 'brand.paper', safe_area: { top: 120, bottom: 160, side: 72 } },
  brand_ref: 'test_brand',
  grid: { cols: 12, rows: 12, margin: 72, gutter: 24, baseline: 8 },
  layers: [
    { id: 'photo', type: 'image', src: 'asset://dot', fit: 'cover', box: { x: 0, y: 0, w: 1080, h: 500 } },
    { id: 'headline', type: 'text', text: 'Başlık', font: 'brand.text', size: 96, box: { x: 72, y: 600, w: 936, h: 130 }, color: 'brand.ink', lang: 'tr' },
    { id: 'body', type: 'text', text: 'Gövde metni', font: 'brand.text', size: 40, box: { x: 72, y: 800, w: 936, h: 60 }, color: 'brand.ink', lang: 'tr' },
  ],
  provenance: { assets: [{ id: 'dot', source: 'test', license: 'CC0' }] },
});

const run = (s) => checkSpec(s, { brandsDir });
const codes = (s) => run(s).failures.map((f) => `${f.code}:${f.layer}`);

test('clean spec passes with no failures', () => {
  const res = run(spec());
  assert.deepEqual(res.failures, []);
  assert.equal(res.passed, true);
});

test('contrast ratio matches WCAG reference values', () => {
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255]) * 10) / 10, 21);
  assert.equal(Math.round(contrastRatio([119, 119, 119], [255, 255, 255]) * 100) / 100, 4.48);
});

test('low contrast text is critical', () => {
  const s = spec();
  s.layers[2].color = '#DDDDDD';
  const res = run(s);
  assert.ok(codes(s).includes('contrast_low:body'));
  assert.equal(res.passed, false);
});

test('contrast is measured against the shape under the text', () => {
  const s = spec();
  s.layers.splice(2, 0, { id: 'dark', type: 'shape', shape: 'rect', fill: '#111111', box: { x: 60, y: 780, w: 960, h: 100 } });
  assert.ok(codes(s).includes('contrast_low:body'));
});

test('large text uses the 3:1 threshold', () => {
  const s = spec();
  s.layers[1].color = '#888888'; // ≈3.5:1 on #FAFAFA: fails 4.5, passes 3
  assert.ok(!codes(s).includes('contrast_low:headline'));
  s.layers[1].size = 40;
  assert.ok(codes(s).includes('contrast_low:headline'));
});

test('text too small on a phone is major', () => {
  const s = spec();
  s.layers[2].size = 24;
  const f = run(s).failures.find((x) => x.code === 'text_too_small');
  assert.equal(f.severity, 'major');
});

test('text outside the safe area is critical', () => {
  const s = spec();
  s.layers[2].box.y = 1250;
  assert.ok(codes(s).includes('safe_area_violation:body'));
});

test('cover images may bleed past the safe area', () => {
  assert.ok(!codes(spec()).some((c) => c.startsWith('safe_area_violation:photo')));
});

test('a contained image (logo) outside the safe area is critical', () => {
  const s = spec();
  s.layers[0] = { ...s.layers[0], fit: 'contain', box: { x: 0, y: 0, w: 200, h: 200 } };
  assert.ok(codes(s).includes('safe_area_violation:photo'));
});

test('overlapping text layers are critical', () => {
  const s = spec();
  s.layers[2].box.y = 620;
  assert.ok(codes(s).includes('text_overlap:headline'));
});

test('text half on an image is a partial overlap', () => {
  const s = spec();
  s.layers[1].box.y = 450;
  assert.ok(codes(s).includes('text_partial_overlap:headline'));
});

test('text fully inside a shape is fine', () => {
  const s = spec();
  s.layers.splice(1, 0, { id: 'panel', type: 'shape', shape: 'rect', fill: 'brand.paper', box: { x: 60, y: 580, w: 960, h: 300 } });
  assert.ok(!codes(s).some((c) => c.startsWith('text_partial_overlap')));
});

test('text taller than its frame overflows', () => {
  const s = spec();
  s.layers[2].text = 'Bir iki üç dört beş altı yedi sekiz dokuz on on bir on iki on üç on dört';
  s.layers[2].box.w = 300;
  assert.ok(codes(s).includes('text_overflow:body'));
});

test('missing glyph is critical', () => {
  const s = spec();
  s.layers[2].text = 'Ok →';
  assert.ok(codes(s).includes('missing_glyph:body'));
});

test('missing asset file is critical', () => {
  const s = spec();
  s.layers[0].src = 'asset://nope';
  s.provenance.assets.push({ id: 'nope', source: 'test', license: 'CC0' });
  assert.ok(codes(s).includes('asset_missing:photo'));
});

test('unknown license is critical', () => {
  const s = spec();
  s.provenance.assets[0].license = 'TBD';
  assert.ok(codes(s).includes('license_unknown:photo'));
});

test('a colour outside the brand palette is minor and does not fail', () => {
  const s = spec();
  s.layers[2].color = '#000000';
  const res = run(s);
  assert.deepEqual(res.failures.map((f) => [f.code, f.severity]), [['off_palette', 'minor']]);
  assert.equal(res.passed, true);
});

test('every failure maps to a rubric criterion', () => {
  const s = spec();
  s.layers[2].color = '#DDDDDD';
  s.layers[2].box.y = 1250;
  for (const f of run(s).failures) assert.ok(f.criterion, f.code);
});

test('decorative text may bleed off canvas and sit under other text', () => {
  const s = spec();
  s.layers.push({ id: 'stripe', type: 'text', role: 'decor', text: 'MERSİN İSTANBUL ANKARA', font: 'brand.text', size: 200, color: '#EEEEEE', lang: 'tr', box: { x: -100, y: 560, w: 1400, h: 260 } });
  const found = codes(s).filter((c) => !c.startsWith('off_palette'));
  assert.deepEqual(found, []);
});
