import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { renderSpec } from '../src/render/png.js';
import { makeTestBrands } from './helpers/brand.js';

let brandsDir;
before(() => {
  brandsDir = makeTestBrands();
});
after(() => rmSync(brandsDir, { recursive: true, force: true }));

const spec = () => ({
  spec_version: '0.1',
  intent: { message: 'm', audience: 'a', platform: 'instagram_post_4x5' },
  canvas: { w: 1080, h: 1350, unit: 'px', background: 'brand.paper' },
  brand_ref: 'test_brand',
  grid: { cols: 12, rows: 12, margin: 72, gutter: 24, baseline: 8 },
  layers: [
    { id: 'img', type: 'image', src: 'asset://dot', fit: 'cover', grid: { col: 1, span: 12, row: 1, row_span: 6 } },
    { id: 'shape', type: 'shape', shape: 'ellipse', fill: '#B81C2280', box: { x: 600, y: 700, w: 300, h: 300 } },
    { id: 'h', type: 'text', text: 'Çırpın, ağır ağır İç ŞÖÜĞ', font: 'brand.text', size: 96, grid: { col: 1, span: 10, row: 8, row_span: 3 }, color: 'brand.ink', lang: 'tr' },
  ],
  provenance: { assets: [{ id: 'dot', source: 'test', license: 'test' }] },
});

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

test('render is bit-identical across runs', () => {
  const a = renderSpec(spec(), { brandsDir });
  const b = renderSpec(spec(), { brandsDir });
  assert.equal(sha(a.png), sha(b.png));
  assert.deepEqual(a.warnings, []);
});

// Same bytes on every OS: CI runs this on Ubuntu and Windows. If a dependency
// upgrade changes rendering on purpose, print the new hash and update it here.
const GOLDEN = '36d3551b9b4cf2909473884cb1fb45a4eb2fbe628459bd0eedbd7930a9426fae';

test('render matches the golden hash', () => {
  const hash = sha(renderSpec(spec(), { brandsDir }).png);
  assert.equal(hash, GOLDEN, `got ${hash}`);
});

test('output is a 1080×1350 PNG', () => {
  const { png } = renderSpec(spec(), { brandsDir });
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1350);
});

test('1080×1350 render takes under 5 s', () => {
  const started = performance.now();
  renderSpec(spec(), { brandsDir });
  assert.ok(performance.now() - started < 5000);
});

test('a change in the spec changes the output', () => {
  const s = spec();
  s.layers[2].text = 'Başka metin';
  assert.notEqual(sha(renderSpec(s, { brandsDir }).png), sha(renderSpec(spec(), { brandsDir }).png));
});

test('text wraps inside its grid frame', () => {
  const { svg } = renderSpec(spec(), { brandsDir });
  const group = svg.match(/<g id="h" data-role="text"[^>]*>(.*?)<\/g>/)[1];
  const xs = [...group.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
  const right = 72 + 10 * ((1080 - 144 - 11 * 24) / 12) + 9 * 24;
  assert.ok(Math.max(...xs) <= right + 0.5, `text reaches x=${Math.max(...xs)}, frame ends at ${right}`);
});

test('missing asset draws a placeholder and warns', () => {
  const s = spec();
  s.layers[0].src = 'asset://nope';
  s.provenance.assets.push({ id: 'nope', source: 'test', license: 'test' });
  const { warnings } = renderSpec(s, { brandsDir });
  assert.match(warnings.join('\n'), /asset "nope" not found/);
});

test('missing glyph is reported', () => {
  const s = spec();
  s.layers[2].text = 'Ok →';
  assert.match(renderSpec(s, { brandsDir }).warnings.join('\n'), /no glyph for →/);
});

test('unknown color token is an error', () => {
  const s = spec();
  s.layers[2].color = 'brand.nope';
  assert.throws(() => renderSpec(s, { brandsDir }), /unknown color token/);
});

test('invalid spec is refused', () => {
  const s = spec();
  delete s.canvas;
  assert.throws(() => renderSpec(s, { brandsDir }), /invalid spec/);
});
