// Photoshop composition engine (F0-13). Builds a layered PSD from a design
// spec over COM + ExtendScript (Windows). Layers Photoshop can build natively
// stay editable (text, flat shapes, placed images); everything else is drawn
// by the resvg renderer as a transparent full-canvas PNG and placed as a smart
// object, so the PSD is always complete.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSpec } from '../render/png.js';
import { loadBrand, frame, color } from '../render/svg.js';

const runner = fileURLToPath(new URL('./run-ps.ps1', import.meta.url));
const fwd = (p) => resolve(p).replace(/\\/g, '/');

/** Runs an ExtendScript file in Photoshop and returns its result string. */
export function runJsx(jsxPath) {
  const out = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', runner, '-Jsx', resolve(jsxPath)], {
    encoding: 'utf8', timeout: 300000,
  });
  return out.split(/\r?\n/).slice(1).join('\n').trim();
}

/** Installed fonts as "family|style|postScriptName" lines, read from Photoshop. */
export function installedFonts(workDir) {
  const probe = join(workDir, 'fonts.jsx');
  writeFileSync(probe, 'var o=[];for(var i=0;i<app.fonts.length;i++){var f=app.fonts[i];o.push(f.family+"|"+f.style+"|"+f.postScriptName);}o.join("\\n");');
  return runJsx(probe).split('\n').filter(Boolean).map((l) => {
    const [family, style, ps] = l.split('|');
    return { family, style, ps };
  });
}

const STYLE_WEIGHT = { thin: 100, extralight: 200, light: 300, regular: 400, book: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
const styleWeight = (style) => STYLE_WEIGHT[style.toLowerCase().replace(/[\s-]/g, '')] ?? 400;

function psFont(fonts, family, weight) {
  const faces = fonts.filter((f) => f.family === family && !/italic/i.test(f.style));
  const hit = faces.find((f) => Math.abs(styleWeight(f.style) - weight) <= 100);
  return hit?.ps ?? null;
}

const upper = (s, lang) => s.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : undefined);

/** Decides how each layer is built and returns the job for the ExtendScript side. */
export function planPsd(spec, { brandsDir, workDir, fonts }) {
  const brand = loadBrand(brandsDir, spec.brand_ref);
  const notes = [];
  const raster = (layer) => {
    const single = { ...spec, canvas: { ...spec.canvas, background: undefined }, layers: [layer] };
    const { png } = renderSpec(single, { brandsDir, transparent: true });
    const file = join(workDir, `layer-${layer.id}.png`);
    writeFileSync(file, png);
    return { kind: 'raster', id: layer.id, file: fwd(file) };
  };

  const layers = spec.layers.map((l) => {
    const f = frame(l, spec);
    if (l.type === 'shape' && typeof l.fill === 'string' && !l.shadow && !l.rotate && !(l.radius > 0) && l.shape !== 'ellipse') {
      const c = color(l.fill, brand);
      const pts = l.shape === 'polygon' ? l.points.map(([x, y]) => [f.x + x * f.w, f.y + y * f.h]) : [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]];
      return { kind: 'shape', id: l.id, pts, color: c.fill, opacity: c.opacity * (l.opacity ?? 1) };
    }
    // Images go through the raster path too: the renderer already applies fit,
    // mask, tint and effects, and the result is still a separate smart object.
    if (l.type === 'text' && !l.shadow) {
      const family = brand.kit.fonts[l.font.slice(6)].family;
      const runs = (l.spans ?? [{ text: l.text }]).map((r) => ({
        text: l.case === 'upper' ? upper(r.text, l.lang) : r.text,
        color: color(r.color ?? l.color, brand).fill,
        ps: psFont(fonts, family, r.weight ?? l.weight ?? 400),
      }));
      if (runs.every((r) => r.ps)) {
        return {
          kind: 'text', id: l.id, f, runs, size: l.size, lh: l.line_height ?? 1.2, tracking: l.tracking ?? 0,
          align: l.align ?? 'left', rotate: l.rotate ?? 0,
        };
      }
      notes.push(`${l.id}: font "${family}" not installed in Photoshop at the needed weight; placed as pixels (install the font to keep it editable)`);
    }
    return raster(l);
  });
  return {
    job: { w: spec.canvas.w, h: spec.canvas.h, bg: color(spec.canvas.background ?? '#FFFFFF', brand).fill, layers },
    notes,
  };
}

// ExtendScript is ES3: no JSON, no let/const, no arrow functions.
const JSX = `
app.preferences.rulerUnits = Units.PIXELS;
app.preferences.typeUnits = TypeUnits.PIXELS;
app.displayDialogs = DialogModes.NO;
var t0 = new Date().getTime();
function rgb(hex) { var c = new SolidColor(); c.rgb.hexValue = hex.replace('#', ''); return c; }
function poly(layer, pts, hex, opacity) {
  doc.activeLayer = layer;
  doc.selection.select(pts);
  doc.selection.fill(rgb(hex));
  doc.selection.deselect();
  layer.opacity = opacity * 100;
}
function place(file) {
  var d = new ActionDescriptor();
  d.putPath(charIDToTypeID('null'), new File(file));
  d.putEnumerated(charIDToTypeID('FTcs'), charIDToTypeID('QCSt'), charIDToTypeID('Qcsa'));
  executeAction(charIDToTypeID('Plc '), d, DialogModes.NO);
  return doc.activeLayer;
}
// Per-range colour and font on the active text layer, keeping its paragraph box.
function styleRuns(runs) {
  var ref = new ActionReference();
  ref.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
  var tk = executeActionGet(ref).getObjectValue(stringIDToTypeID('textKey'));
  var base = tk.getList(charIDToTypeID('Txtt')).getObjectValue(0).getObjectValue(charIDToTypeID('TxtS'));
  var list = new ActionList(), at = 0;
  for (var i = 0; i < runs.length; i++) {
    var st = new ActionDescriptor(); st.fromStream(base.toStream());
    st.putString(stringIDToTypeID('fontPostScriptName'), runs[i].ps);
    var c = new ActionDescriptor(), h = runs[i].color;
    c.putDouble(charIDToTypeID('Rd  '), parseInt(h.substr(1, 2), 16));
    c.putDouble(charIDToTypeID('Grn '), parseInt(h.substr(3, 2), 16));
    c.putDouble(charIDToTypeID('Bl  '), parseInt(h.substr(5, 2), 16));
    st.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), c);
    var r = new ActionDescriptor();
    r.putInteger(charIDToTypeID('From'), at); at += runs[i].text.length; r.putInteger(charIDToTypeID('T   '), at);
    r.putObject(charIDToTypeID('TxtS'), charIDToTypeID('TxtS'), st);
    list.putObject(charIDToTypeID('Txtt'), r);
  }
  tk.putList(charIDToTypeID('Txtt'), list);
  var d = new ActionDescriptor(); d.putReference(charIDToTypeID('null'), ref);
  d.putObject(charIDToTypeID('T   '), charIDToTypeID('TxLr'), tk);
  executeAction(charIDToTypeID('setd'), d, DialogModes.NO);
}

var doc = app.documents.add(JOB.w, JOB.h, 72, JOB.name, NewDocumentMode.RGB, DocumentFill.WHITE);
doc.artLayers[0].isBackgroundLayer = false;
poly(doc.artLayers[0], [[0, 0], [JOB.w, 0], [JOB.w, JOB.h], [0, JOB.h]], JOB.bg, 1);
doc.artLayers[0].name = 'background';
var counts = { text: 0, shape: 0, raster: 0 };
for (var i = 0; i < JOB.layers.length; i++) {
  var L = JOB.layers[i];
  counts[L.kind]++;
  if (L.kind === 'shape') {
    var s = doc.artLayers.add(); s.name = L.id; poly(s, L.pts, L.color, L.opacity);
  } else if (L.kind === 'raster') {
    var p = place(L.file); p.name = L.id;
  } else {
    var t = doc.artLayers.add(); t.kind = LayerKind.TEXT; t.name = L.id;
    var ti = t.textItem, all = '';
    for (var k = 0; k < L.runs.length; k++) all += L.runs[k].text;
    ti.kind = TextType.PARAGRAPHTEXT;
    ti.font = L.runs[0].ps;
    ti.size = L.size;
    ti.useAutoLeading = false; ti.leading = L.size * L.lh;
    ti.tracking = L.tracking * 1000;
    ti.justification = L.align === 'center' ? Justification.CENTER : L.align === 'right' ? Justification.RIGHT : Justification.LEFT;
    ti.color = rgb(L.runs[0].color);
    ti.contents = all.replace(/\\n/g, '\\r');
    ti.position = [L.f.x, L.f.y];
    ti.width = L.f.w; ti.height = Math.max(L.f.h, L.size * L.lh * 3);
    if (L.runs.length > 1) styleRuns(L.runs);
    if (L.rotate) t.rotate(L.rotate, AnchorPosition.MIDDLECENTER);
  }
}
var psd = new PhotoshopSaveOptions(); psd.layers = true; psd.embedColorProfile = true;
doc.saveAs(new File(JOB.out + '.psd'), psd, true);
var png = new ExportOptionsSaveForWeb(); png.format = SaveDocumentType.PNG; png.PNG8 = false;
doc.exportDocument(new File(JOB.out + '.png'), ExportType.SAVEFORWEB, png);
doc.close(SaveOptions.DONOTSAVECHANGES);
'ms=' + (new Date().getTime() - t0) + ' text=' + counts.text + ' shape=' + counts.shape + ' raster=' + counts.raster;
`;

/**
 * Builds <outDir>/<name>.psd and .png in Photoshop.
 * @returns {{psd: string, png: string, result: string, notes: string[]}}
 */
export function buildPsd(spec, { brandsDir, outDir, name }) {
  const workDir = join(outDir, `${name}.parts`);
  mkdirSync(workDir, { recursive: true });
  const fonts = installedFonts(workDir);
  const { job, notes } = planPsd(spec, { brandsDir, workDir, fonts });
  job.name = name;
  job.out = fwd(join(outDir, name));
  const jsx = join(workDir, 'build.jsx');
  writeFileSync(jsx, `#target photoshop\nvar JOB = ${JSON.stringify(job)};\n${JSX}`);
  const result = runJsx(jsx);
  return { psd: `${job.out}.psd`, png: `${job.out}.png`, result, notes };
}
