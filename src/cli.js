#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { validateSpec } from './spec/validate.js';
import { renderSpec } from './render/png.js';
import { checkSpec } from './rubric/checks.js';
import { Ledger } from './llm/ledger.js';
import { validateBrandKitFile } from './brand/validate.js';
import { checkFontFile } from './brand/glyphs.js';

const USAGE = `Usage:
  ajans validate <spec.json> [...]      validate design specs
  ajans brand <brand-kit.json> [...]    validate brand kits (incl. font glyphs)
  ajans glyphs <font.ttf|otf|woff|woff2> [...] check Turkish glyph coverage
  ajans render <spec.json> [-o out.png] [--brands dir]   render a spec to PNG
  ajans check <spec.json> [...] [--brands dir] [--json]   deterministic rubric checks
  ajans cost [YYYY-MM]                  model spending against budget caps
  ajans psd <spec.json> [-o dir]        layered PSD through Photoshop (Windows)`;

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

if (command === 'render') {
  // ajans render <spec.json> [-o out.png] [--brands dir]
  const flag = (name, def) => {
    const i = files.indexOf(name);
    return i === -1 ? def : files.splice(i, 2)[1];
  };
  const out = flag('-o');
  const brandsDir = flag('--brands', 'brands');
  if (files.length !== 1) {
    console.error(USAGE);
    process.exit(2);
  }
  const [file] = files;
  const target = out ?? join('out', basename(file).replace(/\.json$/, '.png'));
  try {
    const started = performance.now();
    const { png, warnings } = renderSpec(JSON.parse(readFileSync(file, 'utf8')), { brandsDir });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, png);
    for (const w of warnings) console.warn(`  ! ${w}`);
    console.log(`✓ ${target} (${Math.round(performance.now() - started)} ms)`);
    process.exit(0);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    process.exit(1);
  }
}

if (command === 'psd') {
  // ajans psd <spec.json> [-o out/psd] [--brands dir]: layered PSD via Photoshop (Windows)
  const { buildPsd } = await import('./engines/photoshop.js');
  const i = files.indexOf('-o');
  const outDir = i === -1 ? join('out', 'psd') : files.splice(i, 2)[1];
  const j = files.indexOf('--brands');
  const brandsDir = j === -1 ? 'brands' : files.splice(j, 2)[1];
  const [file] = files;
  try {
    const res = buildPsd(JSON.parse(readFileSync(file, 'utf8')), { brandsDir, outDir, name: basename(file, '.json') });
    for (const note of res.notes) console.warn(`  ! ${note}`);
    console.log(`✓ ${res.psd} (${res.result})`);
    process.exit(0);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    process.exit(1);
  }
}

if (command === 'cost') {
  // ajans cost [YYYY-MM]: model spending against the caps in config/budget.json
  const budget = JSON.parse(readFileSync('config/budget.json', 'utf8'));
  const ledger = new Ledger(budget.ledger_path);
  const month = files[0] ?? new Date().toISOString().slice(0, 7);
  const entries = ledger.entries().filter((e) => e.at.startsWith(month));
  console.log(`${month}: ${ledger.spent(month).toFixed(4)} / ${budget.monthly_usd} USD, ${entries.length} calls`);
  for (const brand of [...new Set(entries.map((e) => e.brand).filter(Boolean))]) {
    const cap = budget.per_brand_monthly_usd?.[brand] ?? budget.per_brand_monthly_usd?.default;
    console.log(`  ${brand}: ${ledger.spent(month, { brand }).toFixed(4)} / ${cap ?? '—'} USD`);
  }
  process.exit(0);
}

if (command === 'check') {
  // ajans check <spec.json> [...] [--brands dir] [--json]
  const json = files.includes('--json');
  const args = files.filter((f) => f !== '--json');
  const i = args.indexOf('--brands');
  const brandsDir = i === -1 ? 'brands' : args.splice(i, 2)[1];
  if (args.length === 0) {
    console.error(USAGE);
    process.exit(2);
  }
  let failed = 0;
  for (const file of args) {
    try {
      const result = checkSpec(JSON.parse(readFileSync(file, 'utf8')), { brandsDir });
      if (!result.passed) failed++;
      if (json) {
        console.log(JSON.stringify({ file, ...result }, null, 2));
        continue;
      }
      console.log(`${result.passed ? '✓' : '✗'} ${file}`);
      for (const f of result.failures) console.log(`    [${f.severity}] ${f.code} ${f.layer}: ${f.detail}`);
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`);
      failed++;
    }
  }
  process.exit(failed ? 1 : 0);
}

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
