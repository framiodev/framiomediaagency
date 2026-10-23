import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const schemaPath = fileURLToPath(new URL('../../schemas/design-spec-0.1.schema.json', import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
const validateSchema = ajv.compile(schema);

/**
 * Rules JSON Schema cannot express: cross-field geometry and references.
 * @param {object} spec - a spec that already passed the schema
 * @returns {{path: string, message: string}[]}
 */
function semanticErrors(spec) {
  const errors = [];
  const { canvas, grid, layers, provenance } = spec;

  const sa = canvas.safe_area;
  if (sa && (sa.top + sa.bottom >= canvas.h || sa.side * 2 >= canvas.w)) {
    errors.push({ path: '/canvas/safe_area', message: 'safe area leaves no drawable space' });
  }
  if (grid.margin * 2 >= canvas.w) {
    errors.push({ path: '/grid/margin', message: 'grid margins exceed canvas width' });
  }

  const seen = new Set();
  const assetIds = new Set(provenance.assets.map((a) => a.id));

  layers.forEach((layer, i) => {
    const at = `/layers/${i}`;
    if (seen.has(layer.id)) errors.push({ path: `${at}/id`, message: `duplicate layer id "${layer.id}"` });
    seen.add(layer.id);

    if (layer.grid) {
      const { col, span, row, row_span = 1 } = layer.grid;
      if (col + span - 1 > grid.cols) {
        errors.push({ path: `${at}/grid`, message: `columns ${col}..${col + span - 1} exceed grid.cols=${grid.cols}` });
      }
      if (grid.rows && row + row_span - 1 > grid.rows) {
        errors.push({ path: `${at}/grid`, message: `rows ${row}..${row + row_span - 1} exceed grid.rows=${grid.rows}` });
      }
    }

    if (layer.type === 'image') {
      const id = layer.src.slice('asset://'.length);
      if (!assetIds.has(id)) {
        errors.push({ path: `${at}/src`, message: `asset "${id}" has no provenance entry` });
      }
    }
  });

  return errors;
}

/**
 * @param {unknown} spec
 * @returns {{valid: boolean, errors: {path: string, message: string}[]}}
 */
export function validateSpec(spec) {
  if (!validateSchema(spec)) {
    const errors = validateSchema.errors.map((e) => ({ path: e.instancePath || '/', message: e.message }));
    return { valid: false, errors };
  }
  const errors = semanticErrors(spec);
  return { valid: errors.length === 0, errors };
}
