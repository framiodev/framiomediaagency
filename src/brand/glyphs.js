import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';

// Turkish letters plus the basic Latin needed for any Turkish copy.
export const TURKISH_CHARS = 'ğĞşŞıİöÖüÜçÇâÂîÎûÛ';
export const BASIC_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?\'"()-–—%&@';

/**
 * @param {opentype.Font} font
 * @param {string} chars
 * @returns {string[]} characters with no glyph (mapped to .notdef)
 */
export function missingGlyphs(font, chars = TURKISH_CHARS + BASIC_CHARS) {
  return [...new Set(chars)].filter((c) => font.charToGlyphIndex(c) === 0);
}

/**
 * @param {string} path - .ttf, .otf or .woff file (woff2 is not supported)
 * @returns {{family: string, missing: string[]}}
 */
export function checkFontFile(path, chars) {
  const buf = readFileSync(path);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const family = font.names.fontFamily?.en ?? '';
  return { family, missing: missingGlyphs(font, chars) };
}
