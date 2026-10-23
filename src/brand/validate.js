import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { checkFontFile } from './glyphs.js';

const schemaPath = fileURLToPath(new URL('../../schemas/brand-kit-0.1.schema.json', import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
const validateSchema = ajv.compile(schema);

const UNKNOWN_LICENSES = new Set(['tbd', 'unknown', '?', '']);

/**
 * Cross-field rules. Font files are only opened when `baseDir` is given.
 * @param {object} kit - a kit that already passed the schema
 * @param {string} [baseDir] - directory of the kit file
 */
function semanticErrors(kit, baseDir) {
  const errors = [];
  const ready = kit.status === 'ready';
  const assets = new Map(kit.provenance.assets.map((a) => [a.id, a]));

  if (kit.pilot && kit.label !== 'concept_study') {
    errors.push({ path: '/label', message: 'pilot brands must be labelled concept_study' });
  }

  const requireAsset = (path, id) => {
    const asset = assets.get(id);
    if (!asset) {
      errors.push({ path, message: `asset "${id}" has no provenance entry` });
    } else if (ready && UNKNOWN_LICENSES.has(asset.license.trim().toLowerCase())) {
      errors.push({ path, message: `asset "${id}" has unknown license; a ready kit needs a known license` });
    }
  };

  for (const [token, font] of Object.entries(kit.fonts)) {
    const at = `/fonts/${token}`;
    requireAsset(`${at}/asset_id`, font.asset_id);
    if (ready && font.files.length === 0) errors.push({ path: `${at}/files`, message: 'a ready kit needs font files' });
    if (!baseDir) continue;
    font.files.forEach((file, i) => {
      const full = resolve(baseDir, file);
      if (!existsSync(full)) {
        if (ready) errors.push({ path: `${at}/files/${i}`, message: `font file not found: ${file}` });
        return;
      }
      const { missing } = checkFontFile(full);
      if (missing.length) {
        errors.push({ path: `${at}/files/${i}`, message: `missing glyphs: ${missing.join(' ')}` });
      }
    });
  }

  kit.logos.forEach((logo, i) => requireAsset(`/logos/${i}/asset_id`, logo.asset_id));

  if (ready) {
    if (Object.keys(kit.colors).length === 0) errors.push({ path: '/colors', message: 'a ready kit needs colors' });
    if (Object.keys(kit.fonts).length === 0) errors.push({ path: '/fonts', message: 'a ready kit needs fonts' });
    if (kit.logos.length === 0) errors.push({ path: '/logos', message: 'a ready kit needs a logo' });
    if (!kit.tone.voice) errors.push({ path: '/tone/voice', message: 'a ready kit needs a tone of voice' });
    if (kit.open_questions?.length) errors.push({ path: '/open_questions', message: 'a ready kit has no open questions' });
  }

  return errors;
}

/**
 * @param {unknown} kit
 * @param {{baseDir?: string}} [opts]
 * @returns {{valid: boolean, errors: {path: string, message: string}[]}}
 */
export function validateBrandKit(kit, { baseDir } = {}) {
  if (!validateSchema(kit)) {
    const errors = validateSchema.errors.map((e) => ({ path: e.instancePath || '/', message: e.message }));
    return { valid: false, errors };
  }
  const errors = semanticErrors(kit, baseDir);
  return { valid: errors.length === 0, errors };
}

/** Validates a kit file on disk, resolving font paths next to it. */
export function validateBrandKitFile(path) {
  const kit = JSON.parse(readFileSync(path, 'utf8'));
  return validateBrandKit(kit, { baseDir: dirname(path) });
}
