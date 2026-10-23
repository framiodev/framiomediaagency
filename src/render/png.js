import { Resvg } from '@resvg/resvg-js';
import { validateSpec } from '../spec/validate.js';
import { specToSvg } from './svg.js';

/**
 * Renders a spec to PNG bytes. Text is converted to outlines from the brand's
 * own font files and system fonts are never loaded, so output is identical
 * on every machine.
 * @param {object} spec
 * @param {{brandsDir: string}} opts
 * @returns {{png: Buffer, svg: string, warnings: string[], layout: object[], background: string}}
 */
export function renderSpec(spec, opts) {
  const { valid, errors } = validateSpec(spec);
  if (!valid) {
    throw new Error(`invalid spec:\n${errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')}`);
  }
  const { svg, warnings, layout, background } = specToSvg(spec, opts);
  const resvg = new Resvg(svg, {
    font: { loadSystemFonts: false },
    shapeRendering: 2,
    textRendering: 1,
    imageRendering: 0,
  });
  return { png: resvg.render().asPng(), svg, warnings, layout, background };
}
