import { readFileSync } from 'node:fs';
import * as fontkit from 'fontkit';

// Turkish letters plus the basic Latin needed for any Turkish copy.
export const TURKISH_CHARS = 'ğĞşŞıİöÖüÜçÇâÂîÎûÛ';
export const BASIC_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?\'"()-–—%&@';

/**
 * @param {object} font - a fontkit font
 * @param {string} chars
 * @returns {string[]} characters the font has no glyph for
 */
export function missingGlyphs(font, chars = TURKISH_CHARS + BASIC_CHARS) {
  return [...new Set(chars)].filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)));
}

/**
 * @param {string} path - .ttf, .otf, .woff or .woff2 file
 * @returns {{family: string, missing: string[]}}
 */
export function checkFontFile(path, chars) {
  const font = fontkit.create(readFileSync(path));
  return { family: font.familyName ?? '', missing: missingGlyphs(font, chars) };
}
