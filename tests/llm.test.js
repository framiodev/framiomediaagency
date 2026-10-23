import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cost, worstCaseCost } from '../src/llm/pricing.js';
import { Ledger } from '../src/llm/ledger.js';
import { LLM, BudgetExceededError } from '../src/llm/client.js';

const MODELS = {
  models: {
    big: { provider: 'mock', input: 4, output: 20, cache_read: 0.2, cache_write_multiplier: 1.25, batch_discount: 0.5 },
    small: { provider: 'mock', tiers: [{ max_input_tokens: 100000, input: 0.1, output: 0.5 }, { input: 0.5, output: 2.5 }], cache_read: null },
  },
  roles: { concept: 'big', critique: 'small' },
};

const dir = mkdtempSync(join(tmpdir(), 'ajans-llm-'));
after(() => rmSync(dir, { recursive: true, force: true }));

let calls;
let ledger;
let n = 0;
const mock = (usage = { input_tokens: 1000, output_tokens: 500 }) => ({
  async complete(req) {
    calls.push(req);
    return { text: 'ok', stop_reason: 'end_turn', usage };
  },
});
const make = (budget, usage) =>
  new LLM({
    providers: { mock: mock(usage) },
    models: MODELS,
    budget: { monthly_usd: 1, per_brand_monthly_usd: { default: 0.5 }, ...budget },
    ledger,
    now: () => new Date('2026-10-23T12:00:00Z'),
  });
const ask = { role: 'concept', tenant: 'framio', brand: 'whisk', task: 'test', messages: [{ role: 'user', content: 'Merhaba' }], maxTokens: 1000 };

beforeEach(() => {
  calls = [];
  ledger = new Ledger(join(dir, `ledger-${n++}.jsonl`));
});

test('cost uses input, output, cache read and cache write prices', () => {
  const usd = cost(MODELS.models.big, { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 1e6 });
  assert.equal(usd, 4 + 20 + 0.2 + 5);
});

test('batch calls get the batch discount', () => {
  assert.equal(cost(MODELS.models.big, { input_tokens: 1e6 }, { batch: true }), 2);
});

test('tiered pricing switches above 100k prompt tokens', () => {
  assert.equal(cost(MODELS.models.small, { input_tokens: 1e5, output_tokens: 1e6 }), 0.01 + 0.5);
  assert.equal(cost(MODELS.models.small, { input_tokens: 2e5, output_tokens: 1e6 }), 0.1 + 2.5);
});

test('unknown cache-read price is charged at the full input price', () => {
  assert.equal(cost(MODELS.models.small, { cache_read_input_tokens: 1e5 }), 0.01);
});

test('worst case assumes every output token is used', () => {
  assert.equal(worstCaseCost(MODELS.models.big, 1000, 1000), (1000 * 4 + 1000 * 20) / 1e6);
});

test('every call is logged with its cost, tenant, brand and task', async () => {
  const res = await make().complete(ask);
  const [entry] = ledger.entries();
  assert.equal(entry.tenant, 'framio');
  assert.equal(entry.brand, 'whisk');
  assert.equal(entry.task, 'test');
  assert.equal(entry.model, 'big');
  assert.equal(entry.cost_usd, (1000 * 4 + 500 * 20) / 1e6);
  assert.equal(res.cost_usd, entry.cost_usd);
});

test('roles route to the configured model', async () => {
  await make().complete({ ...ask, role: 'critique' });
  assert.equal(ledger.entries()[0].model, 'small');
});

test('monthly cap stops the call before it is sent', async () => {
  const llm = make({ monthly_usd: 0.03, per_brand_monthly_usd: {} });
  await llm.complete(ask); // ≈ 0.014 spent
  await assert.rejects(() => llm.complete({ ...ask, maxTokens: 1000 }), BudgetExceededError);
  assert.equal(calls.length, 1, 'refused call never reached the provider');
});

test('per-brand cap is separate from the global cap', async () => {
  const llm = make({ monthly_usd: 100, per_brand_monthly_usd: { default: 0.03 } });
  await llm.complete(ask);
  await assert.rejects(() => llm.complete(ask), (e) => e instanceof BudgetExceededError && e.scope === 'brand whisk');
  await llm.complete({ ...ask, brand: 'dk_koksallar' });
  assert.equal(calls.length, 2);
});

test('spending from earlier months does not count', async () => {
  ledger.append({ at: '2026-09-30T23:00:00Z', tenant: 'framio', brand: 'whisk', cost_usd: 99 });
  await make().complete(ask);
  assert.equal(calls.length, 1);
});

test('tenant is required', async () => {
  await assert.rejects(() => make().complete({ ...ask, tenant: undefined }), /tenant/);
});

test('model missing from config is an error', async () => {
  await assert.rejects(() => make().complete({ ...ask, role: undefined, model: 'nope' }), /not in config/);
});
