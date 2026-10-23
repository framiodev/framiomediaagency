import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designLoop, weightedScore, parseJson } from '../src/agents/design.js';
import { LLM } from '../src/llm/client.js';
import { Ledger } from '../src/llm/ledger.js';
import { makeTestBrands } from './helpers/brand.js';

let brandsDir;
let dir;
before(() => {
  brandsDir = makeTestBrands();
  dir = mkdtempSync(join(tmpdir(), 'ajans-design-'));
});
after(() => {
  rmSync(brandsDir, { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
});

const goodSpec = {
  spec_version: '0.2',
  intent: { message: 'm', audience: 'a', platform: 'instagram_post_4x5', label: 'internal' },
  canvas: { w: 1080, h: 1350, unit: 'px', background: 'brand.paper', safe_area: { top: 120, bottom: 160, side: 72 } },
  brand_ref: 'test_brand',
  grid: { cols: 12, rows: 12, margin: 72, gutter: 24, baseline: 8 },
  layers: [{ id: 'headline', type: 'text', role: 'headline', text: 'Merhaba', font: 'brand.text', size: 96, box: { x: 72, y: 400, w: 936, h: 130 }, color: 'brand.ink', lang: 'tr' }],
  provenance: { assets: [] },
};
const crit = (n) => ({
  scores: { message: n, hierarchy: n, typography: n, layout: n, color: n, brand: n, quality: n, platform: n },
  failures: [], suggestions: [{ layer: 'headline', change: 'bigger' }], summary: 'ok',
});

/** Mock provider replaying scripted replies in order and recording requests. */
function scripted(replies) {
  const seen = [];
  return {
    seen,
    provider: {
      async complete(req) {
        seen.push(req);
        const text = replies.shift();
        return { text, stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 200 } };
      },
    },
  };
}
const MODELS = { models: { m: { provider: 'mock', input: 1, output: 5 } }, roles: { concept: 'm', critique: 'm' } };
const llmWith = (provider, name) => new LLM({
  providers: { mock: provider }, models: MODELS, budget: { monthly_usd: 100 }, ledger: new Ledger(join(dir, `${name}.jsonl`)),
});
const brief = { id: 'b1', brand: 'test_brand', message: 'Merhaba de' };

test('weighted score follows rubric weights', () => {
  const criteria = { a: { weight: 3 }, b: { weight: 1 } };
  assert.equal(weightedScore({ a: 100, b: 0 }, criteria), 75);
});

test('parseJson tolerates code fences and prose', () => {
  assert.deepEqual(parseJson('Here:\n```json\n{"a":1}\n```'), { a: 1 });
});

test('a good first design passes in one round with a rubric-shaped critique', async () => {
  const { provider, seen } = scripted([JSON.stringify(goodSpec), JSON.stringify(crit(90))]);
  const res = await designLoop({ brief, llm: llmWith(provider, 'a'), brandsDir, tenant: 't' });
  assert.equal(res.rounds.length, 1);
  assert.equal(res.best.passed, true);
  assert.equal(res.best.score, 90);
  assert.ok(res.cost_usd > 0);
  // The critic saw the rendered image.
  assert.equal(seen[1].messages[0].content[0].type, 'image');
  assert.ok(seen[1].outputSchema.properties.scores);
});

test('a weak design is revised, at most twice', async () => {
  const replies = [JSON.stringify(goodSpec), JSON.stringify(crit(60)), JSON.stringify(goodSpec), JSON.stringify(crit(70)), JSON.stringify(goodSpec), JSON.stringify(crit(75))];
  const { provider, seen } = scripted(replies);
  const res = await designLoop({ brief, llm: llmWith(provider, 'b'), brandsDir, tenant: 't' });
  assert.equal(res.rounds.length, 3);
  assert.equal(res.best.passed, false);
  assert.equal(res.best.score, 75);
  assert.match(seen[2].messages.at(-1).content, /Revise the spec/);
});

test('an invalid spec is sent back with its errors', async () => {
  const replies = ['{"spec_version":"0.2"}', JSON.stringify(goodSpec), JSON.stringify(crit(85))];
  const { provider, seen } = scripted(replies);
  const res = await designLoop({ brief, llm: llmWith(provider, 'c'), brandsDir, tenant: 't' });
  assert.ok(res.rounds[0].invalid.length > 0);
  assert.match(seen[1].messages.at(-1).content, /The spec is invalid/);
  assert.equal(res.best.passed, true);
});

test('a critique that does not match the rubric is rejected', async () => {
  const bad = { ...crit(90), scores: { message: 90 } };
  const { provider } = scripted([JSON.stringify(goodSpec), JSON.stringify(bad)]);
  await assert.rejects(() => designLoop({ brief, llm: llmWith(provider, 'd'), brandsDir, tenant: 't' }), /rubric schema/);
});
