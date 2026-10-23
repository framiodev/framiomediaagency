#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { validateSpec } from './spec/validate.js';
import { validateBrandKitFile } from './brand/validate.js';
import { checkFontFile } from './brand/glyphs.js';

const USAGE = `Usage:
  ajans validate <spec.json> [...]      validate design specs
  ajans brand <brand-kit.json> [...]    validate brand kits (incl. font glyphs)
  ajans glyphs <font.ttf|otf|woff> [...] check Turkish glyph coverage`;

const commands = {
  validate: (file) => validateSpec(JSON.parse(readFileSync(file, 'utf8'))),
  brand: (file) => validateBrandKitFile(file),
  glyphs: (file) => {
    const { family, missing } = checkFontFile(file);
    const errors = missing.length ? [{ path: family || '/', message: `missing glyphs: ${missing.join(' ')}` }] : [];
    return { valid: errors.length === 0, errors };
  },
};

const [command, ...files] = process.argv.slice(2);
const run = commands[command];
if (!run || files.length === 0) {
  console.error(USAGE);
  process.exit(2);
}

let failed = 0;
for (const file of files) {
  let result;
  try {
    result = run(file);
  } catch (err) {
    console.error(`✗ ${file}: cannot read (${err.message})`);
    failed++;
    continue;
  }
  if (result.valid) {
    console.log(`✓ ${file}`);
  } else {
    failed++;
    console.error(`✗ ${file}`);
    for (const e of result.errors) console.error(`    ${e.path}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
