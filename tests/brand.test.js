import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import opentype from 'opentype.js';
import { validateBrandKit, validateBrandKitFile } from '../src/brand/validate.js';
import { checkFontFile, TURKISH_CHARS, BASIC_CHARS } from '../src/brand/glyphs.js';

// Fonts are generated here so no third-party font file is committed.
function makeFont(chars) {
  const box = () => {
    const p = new opentype.Path();
    p.moveTo(0, 0); p.lineTo(500, 0); p.lineTo(500, 700); p.lineTo(0, 700); p.close();
    return p;
  };
  const glyphs = [new opentype.Glyph({ name: '.notdef', advanceWidth: 600, path: new opentype.Path() })];
  for (const c of new Set(chars)) {
    glyphs.push(new opentype.Glyph({ name: `u${c.codePointAt(0).toString(16)}`, unicode: c.codePointAt(0), advanceWidth: 600, path: box() }));
  }
  const font = new opentype.Font({ familyName: 'TestSans', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs });
  return Buffer.from(font.toArrayBuffer());
}

let dir;
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'ajans-brand-'));
  writeFileSync(join(dir, 'full.ttf'), makeFont(TURKISH_CHARS + BASIC_CHARS));
  writeFileSync(join(dir, 'no-g-breve.ttf'), makeFont((TURKISH_CHARS + BASIC_CHARS).replace(/[ğĞ]/g, '')));
});
after(() => rmSync(dir, { recursive: true, force: true }));

const readyKit = (fontFile) => ({
  kit_version: '0.1',
  brand_id: 'test_brand',
  tenant_id: 'framio',
  name: 'Test',
  status: 'ready',
  label: 'internal',
  sector: 'test',
  colors: { ink: { hex: '#111111', role: 'ink', source: 'test' } },
  fonts: { display: { family: 'TestSans', files: [fontFile], asset_id: 'font/test' } },
  logos: [{ id: 'logo', variant: 'primary', file: 'logo.svg', asset_id: 'logo/test' }],
  tone: { voice: 'sakin', address: 'sen', do: [], dont: [] },
  provenance: {
    assets: [
      { id: 'font/test', source: 'generated in test', license: 'test-only' },
      { id: 'logo/test', source: 'generated in test', license: 'test-only' },
    ],
  },
});

const writeKit = (name, kit) => {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(kit));
  return path;
};

test('glyph check passes for a font with Turkish letters', () => {
  assert.deepEqual(checkFontFile(join(dir, 'full.ttf')).missing, []);
});

test('glyph check reports missing ğ Ğ', () => {
  assert.deepEqual(checkFontFile(join(dir, 'no-g-breve.ttf')).missing.sort(), ['Ğ', 'ğ'].sort());
});

test('ready kit with complete font is valid', () => {
  const res = validateBrandKitFile(writeKit('ok.json', readyKit('full.ttf')));
  assert.deepEqual(res.errors, []);
});

test('ready kit with font missing Turkish glyphs is rejected', () => {
  const res = validateBrandKitFile(writeKit('bad-font.json', readyKit('no-g-breve.ttf')));
  assert.equal(res.valid, false);
  assert.match(res.errors[0].message, /missing glyphs: .*ğ/);
});

test('ready kit with missing font file is rejected', () => {
  const res = validateBrandKitFile(writeKit('no-file.json', readyKit('nope.ttf')));
  assert.equal(res.valid, false);
});

test('asset without provenance is rejected', () => {
  const kit = readyKit('full.ttf');
  kit.provenance.assets = kit.provenance.assets.filter((a) => a.id !== 'logo/test');
  assert.equal(validateBrandKit(kit).valid, false);
});

test('ready kit with TBD license is rejected', () => {
  const kit = readyKit('full.ttf');
  kit.provenance.assets[0].license = 'TBD';
  assert.equal(validateBrandKit(kit).valid, false);
});

test('pilot brand must be concept_study', () => {
  const kit = { ...readyKit('full.ttf'), pilot: true };
  assert.equal(validateBrandKit(kit).valid, false);
  kit.label = 'concept_study';
  assert.equal(validateBrandKit(kit).valid, true);
});

test('ready kit without colors, logo or voice is rejected', () => {
  const kit = { ...readyKit('full.ttf'), colors: {}, logos: [], tone: { voice: null, do: [], dont: [] } };
  const paths = validateBrandKit(kit).errors.map((e) => e.path);
  assert.ok(paths.includes('/colors') && paths.includes('/logos') && paths.includes('/tone/voice'));
});

for (const id of ['dk_koksallar', 'pilot_b_cafe']) {
  test(`pilot kit ${id} is a valid needs_input kit`, () => {
    const path = `brands/${id}/brand-kit.json`;
    const kit = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(kit.status, 'needs_input');
    assert.equal(kit.label, 'concept_study');
    assert.deepEqual(validateBrandKitFile(path).errors, []);
  });
}
