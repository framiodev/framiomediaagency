#!/usr/bin/env node
// F0-8 benchmark: every brief through the design loop with each designer model,
// one fixed critic, results and costs written to docs/reports/f0-8-benchmark.md.
// Usage: node scripts/benchmark.mjs [--models a,b] [--critic id] [--limit N] [--only dk]
// Spends real money: every call is checked against config/budget.json first.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LLM, BudgetExceededError } from '../src/llm/client.js';
import { anthropicProvider } from '../src/llm/providers/anthropic.js';
import { designLoop } from '../src/agents/design.js';

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? def : process.argv[i + 1];
};
const models = arg('--models', 'claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5').split(',');
const criticModel = arg('--critic', 'claude-sonnet-5-5');
const limit = Number(arg('--limit', '0'));
const only = arg('--only', '');

let briefs = JSON.parse(readFileSync('benchmarks/briefs.json', 'utf8')).briefs.filter((b) => !only || b.id.startsWith(only));
if (limit) briefs = briefs.slice(0, limit);
const examples = ['dk-29-ekim', 'dk-sehirler'].map((f) => JSON.parse(readFileSync(`examples/specs/valid/${f}.json`, 'utf8')));
const llm = new LLM({ providers: { anthropic: anthropicProvider() } });
const outDir = join('out', 'benchmark');

const rows = [];
for (const model of models) {
  const cfg = llm.models.models[model];
  if (!cfg || cfg.provider !== 'anthropic') {
    console.warn(`skip ${model}: no provider adapter yet`);
    continue;
  }
  for (const brief of briefs) {
    const started = Date.now();
    try {
      const res = await designLoop({ brief, llm, brandsDir: 'brands', tenant: 'framio', designModel: model, criticModel, examples });
      const dir = join(outDir, model);
      mkdirSync(dir, { recursive: true });
      if (res.best) {
        writeFileSync(join(dir, `${brief.id}.png`), res.best.png);
        writeFileSync(join(dir, `${brief.id}.json`), JSON.stringify(res.best.spec, null, 2));
      }
      rows.push({ model, id: brief.id, score: res.best?.score ?? 0, passed: Boolean(res.best?.passed), rounds: res.rounds.length, cost: res.cost_usd, s: (Date.now() - started) / 1000 });
      console.log(`${model} ${brief.id}: ${res.best ? res.best.score.toFixed(1) : 'invalid'} ${res.best?.passed ? 'PASS' : 'fail'} $${res.cost_usd.toFixed(4)}`);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        console.error(`stopped: ${err.message}`);
        break;
      }
      rows.push({ model, id: brief.id, error: err.message });
      console.error(`${model} ${brief.id}: ${err.message}`);
    }
  }
}

const by = (m) => rows.filter((r) => r.model === m && !r.error);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const lines = [
  '# F0-8 — Model karşılaştırması',
  '',
  `Tarih: ${new Date().toISOString().slice(0, 10)} · Brief: ${briefs.length} · Eleştirmen: ${criticModel} · Bütçe: config/budget.json`,
  '',
  '| Model | Geçen | Ort. puan | Ort. tur | Ort. maliyet ($) | Toplam ($) | Ort. süre (sn) | Hata |',
  '|---|---|---|---|---|---|---|---|',
  ...models.map((m) => {
    const r = by(m);
    const errors = rows.filter((x) => x.model === m && x.error).length;
    return `| ${m} | ${r.filter((x) => x.passed).length}/${r.length} | ${avg(r.map((x) => x.score)).toFixed(1)} | ${avg(r.map((x) => x.rounds)).toFixed(1)} | ` +
      `${avg(r.map((x) => x.cost)).toFixed(4)} | ${r.reduce((a, x) => a + x.cost, 0).toFixed(4)} | ${avg(r.map((x) => x.s)).toFixed(0)} | ${errors} |`;
  }),
  '',
  '## Brief bazında',
  '',
  '| Model | Brief | Puan | Geçti | Tur | Maliyet ($) |',
  '|---|---|---|---|---|---|',
  ...rows.map((r) => (r.error ? `| ${r.model} | ${r.id} | hata: ${r.error} | | | |` : `| ${r.model} | ${r.id} | ${r.score.toFixed(1)} | ${r.passed ? 'evet' : 'hayır'} | ${r.rounds} | ${r.cost.toFixed(4)} |`)),
  '',
  `Görseller ve spec'ler: \`${outDir}/<model>/\` (git dışında).`,
];
mkdirSync('docs/reports', { recursive: true });
writeFileSync('docs/reports/f0-8-benchmark.md', `${lines.join('\n')}\n`);
console.log('report: docs/reports/f0-8-benchmark.md');
