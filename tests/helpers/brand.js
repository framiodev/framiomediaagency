import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import opentype from 'opentype.js';
import { TURKISH_CHARS, BASIC_CHARS } from '../../src/brand/glyphs.js';

// A generated font and a 1×1 PNG keep these tests free of third-party files.
export function makeFont() {
  const box = () => {
    const p = new opentype.Path();
    p.moveTo(40, 0); p.lineTo(460, 0); p.lineTo(460, 700); p.lineTo(40, 700); p.close();
    return p;
  };
  const glyphs = [
    new opentype.Glyph({ name: '.notdef', advanceWidth: 500, path: new opentype.Path() }),
    new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 250, path: new opentype.Path() }),
  ];
  for (const c of new Set(TURKISH_CHARS + BASIC_CHARS)) {
    glyphs.push(new opentype.Glyph({ name: `u${c.codePointAt(0).toString(16)}`, unicode: c.codePointAt(0), advanceWidth: 500, path: box() }));
  }
  const font = new opentype.Font({ familyName: 'TestSans', styleName: 'Regular', weightClass: 400, unitsPerEm: 1000, ascender: 800, descender: -200, glyphs });
  return Buffer.from(font.toArrayBuffer());
}

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/eL9mJgAAAABJRU5ErkJggg==',
  'base64',
);

/** Creates a temp brands dir with test_brand (generated font, 1×1 PNG). Caller removes it. */
export function makeTestBrands() {
  const brandsDir = mkdtempSync(join(tmpdir(), 'ajans-render-'));
  const dir = join(brandsDir, 'test_brand');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'TestSans.ttf'), makeFont());
  writeFileSync(join(dir, 'assets', 'dot.png'), PNG_1PX);
  writeFileSync(join(dir, 'brand-kit.json'), JSON.stringify({
    kit_version: '0.1', brand_id: 'test_brand', tenant_id: 't', name: 'Test', status: 'draft', label: 'internal',
    colors: { ink: { hex: '#111111', role: 'ink', source: 'test' }, paper: { hex: '#FAFAFA', role: 'paper', source: 'test' } },
    fonts: { text: { family: 'TestSans', files: ['assets/TestSans.ttf'], asset_id: 'font' } },
    logos: [], tone: { voice: null, do: [], dont: [] },
    provenance: { assets: [{ id: 'font', source: 'test', license: 'test' }] },
  }));
  return brandsDir;
}
