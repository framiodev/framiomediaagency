// F0-12 spike: turn a design spec into an ExtendScript that builds a layered PSD
// in Photoshop, so the same spec feeds two engines (resvg and Photoshop).
// Usage: node spikes/f0-12/spec-to-psd.mjs <spec.json> <out-dir>
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { loadBrand, frame, color } from '../../src/render/svg.js';

const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const brand = loadBrand('brands', spec.brand_ref);
mkdirSync(outDir, { recursive: true });

function assetFile(id) {
  const base = resolve(brand.dir, 'assets', id);
  const dir = resolve(base, '..');
  if (!existsSync(dir)) return null;
  const stem = base.slice(dir.length + 1);
  const hit = readdirSync(dir).find((f) => f.slice(0, -extname(f).length) === stem && /\.(png|jpe?g)$/i.test(f));
  return hit ? resolve(dir, hit).replace(/\\/g, '/') : null;
}

const layers = spec.layers.map((l) => {
  const f = frame(l, spec);
  if (l.type === 'text') {
    const fam = brand.kit.fonts[l.font.slice(6)].family;
    return { kind: 'text', id: l.id, f, text: l.text, family: fam, weight: l.weight ?? 400, size: l.size,
      lh: l.line_height ?? 1.2, tracking: l.tracking ?? 0, align: l.align ?? 'left', color: color(l.color, brand).fill };
  }
  if (l.type === 'shape') return { kind: 'shape', id: l.id, f, color: color(l.fill, brand).fill, opacity: l.opacity ?? 1 };
  return { kind: 'image', id: l.id, f, fit: l.fit, file: assetFile(l.src.slice(8)) };
});

const job = {
  w: spec.canvas.w, h: spec.canvas.h, name: spec.brand_ref + '-' + spec.intent.platform,
  bg: color(spec.canvas.background ?? '#FFFFFF', brand).fill, layers,
  out: resolve(outDir).replace(/\\/g, '/'),
};

// ExtendScript is ES3: no JSON, no let/const, no arrow functions.
const jsx = `#target photoshop
var JOB = ${JSON.stringify(job)};
var log = [];
var t0 = new Date().getTime();
app.preferences.rulerUnits = Units.PIXELS;
app.preferences.typeUnits = TypeUnits.PIXELS;
app.displayDialogs = DialogModes.NO;

function rgb(hex) { var c = new SolidColor(); c.rgb.hexValue = hex.replace('#', ''); return c; }

// Closest installed face of a family by weight, using style names.
var WEIGHTS = { thin: 100, extralight: 200, light: 300, regular: 400, book: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
function findFont(family, weight) {
  var best = null, bestD = 9999;
  for (var i = 0; i < app.fonts.length; i++) {
    var f = app.fonts[i];
    if (f.family !== family) continue;
    var w = WEIGHTS[f.style.toLowerCase().replace(/[\\s-]/g, '')] || 400;
    var d = Math.abs(w - weight);
    if (d < bestD) { best = f; bestD = d; }
  }
  return best;
}

function fillRect(layer, x, y, w, h, hex, opacity) {
  doc.activeLayer = layer;
  doc.selection.select([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  doc.selection.fill(rgb(hex));
  doc.selection.deselect();
  layer.opacity = opacity * 100;
}

function placeEmbedded(file) {
  var d = new ActionDescriptor();
  d.putPath(charIDToTypeID('null'), new File(file));
  d.putEnumerated(charIDToTypeID('FTcs'), charIDToTypeID('QCSt'), charIDToTypeID('Qcsa'));
  executeAction(charIDToTypeID('Plc '), d, DialogModes.NO);
  return doc.activeLayer;
}

var doc = app.documents.add(JOB.w, JOB.h, 72, JOB.name, NewDocumentMode.RGB, DocumentFill.WHITE);
fillRect(doc.artLayers[0], 0, 0, JOB.w, JOB.h, JOB.bg, 1);

for (var i = 0; i < JOB.layers.length; i++) {
  var L = JOB.layers[i], f = L.f;
  if (L.kind === 'shape') {
    var s = doc.artLayers.add(); s.name = L.id;
    fillRect(s, f.x, f.y, f.w, f.h, L.color, L.opacity);
  } else if (L.kind === 'image') {
    if (!L.file) { log.push(L.id + ': asset missing, skipped'); continue; }
    var p = placeEmbedded(L.file); p.name = L.id;
    var b = p.bounds, bw = b[2].value - b[0].value, bh = b[3].value - b[1].value;
    var k = L.fit === 'cover' ? Math.max(f.w / bw, f.h / bh) : Math.min(f.w / bw, f.h / bh);
    p.resize(k * 100, k * 100, AnchorPosition.MIDDLECENTER);
    b = p.bounds;
    p.translate(f.x + f.w / 2 - (b[0].value + b[2].value) / 2, f.y + f.h / 2 - (b[1].value + b[3].value) / 2);
  } else {
    var t = doc.artLayers.add(); t.kind = LayerKind.TEXT; t.name = L.id;
    var ti = t.textItem;
    var font = findFont(L.family, L.weight);
    if (font) ti.font = font.postScriptName; else log.push(L.id + ': font "' + L.family + '" not installed, Photoshop default used');
    ti.kind = TextType.PARAGRAPHTEXT;
    ti.size = L.size;
    ti.useAutoLeading = false; ti.leading = L.size * L.lh;
    ti.tracking = L.tracking * 1000;
    ti.justification = L.align === 'center' ? Justification.CENTER : L.align === 'right' ? Justification.RIGHT : Justification.LEFT;
    ti.color = rgb(L.color);
    ti.contents = L.text.replace(/\\n/g, '\\r');
    ti.position = [f.x, f.y];
    ti.width = f.w; ti.height = Math.max(f.h, L.size * L.lh * 4);
  }
}

var psd = new PhotoshopSaveOptions(); psd.layers = true; psd.embedColorProfile = true;
doc.saveAs(new File(JOB.out + '/' + JOB.name + '.psd'), psd, true);
var png = new ExportOptionsSaveForWeb(); png.format = SaveDocumentType.PNG; png.PNG8 = false;
doc.exportDocument(new File(JOB.out + '/' + JOB.name + '.png'), ExportType.SAVEFORWEB, png);
var layerCount = doc.layers.length;
doc.close(SaveOptions.DONOTSAVECHANGES);
'ms=' + (new Date().getTime() - t0) + ' layers=' + layerCount + (log.length ? '\\n' + log.join('\\n') : '');
`;
const out = join(outDir, `${job.name}.jsx`);
writeFileSync(out, jsx);
console.log(out);
