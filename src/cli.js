#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { validateSpec } from './spec/validate.js';

const [command, ...files] = process.argv.slice(2);

if (command !== 'validate' || files.length === 0) {
  console.error('Usage: ajans validate <spec.json> [more.json ...]');
  process.exit(2);
}

let failed = 0;
for (const file of files) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`✗ ${file}: cannot read JSON (${err.message})`);
    failed++;
    continue;
  }
  const { valid, errors } = validateSpec(spec);
  if (valid) {
    console.log(`✓ ${file}`);
  } else {
    failed++;
    console.error(`✗ ${file}`);
    for (const e of errors) console.error(`    ${e.path}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
