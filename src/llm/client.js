import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ledger } from './ledger.js';
import { cost, worstCaseCost } from './pricing.js';

const configPath = (name) => fileURLToPath(new URL(`../../config/${name}`, import.meta.url));

export class BudgetExceededError extends Error {
  constructor({ scope, cap, spent, estimate }) {
    super(`${scope} budget would be exceeded: spent ${spent.toFixed(4)} + up to ${estimate.toFixed(4)} > cap ${cap} USD; user approval required`);
    this.name = 'BudgetExceededError';
    Object.assign(this, { scope, cap, spent, estimate });
  }
}

// Rough prompt size before sending: ~3 characters per token over-estimates
// Turkish and English text, which is the safe direction for a budget check.
// Images are counted at a flat ~1,600 tokens (a 1080px image is ~1,500).
const IMAGE_TOKENS = 1600;
const estimateTokens = (system, messages) => {
  let images = 0;
  const text = JSON.stringify({ system, messages }, (k, v) => {
    if (v && v.type === 'image') {
      images++;
      return null;
    }
    return v;
  });
  return Math.ceil(text.length / 3) + images * IMAGE_TOKENS;
};

/**
 * Provider-neutral model client. Every call is priced from config, checked
 * against monthly caps before it is sent, and written to the ledger after.
 */
export class LLM {
  /**
   * @param {{providers: Record<string, {complete: Function}>, models?: object, budget?: object, ledger?: Ledger, now?: () => Date}} opts
   */
  constructor({ providers, models, budget, ledger, now = () => new Date() }) {
    this.models = models ?? JSON.parse(readFileSync(configPath('models.json'), 'utf8'));
    this.budget = budget ?? JSON.parse(readFileSync(configPath('budget.json'), 'utf8'));
    this.ledger = ledger ?? new Ledger(this.budget.ledger_path);
    this.providers = providers;
    this.now = now;
  }

  resolve({ model, role }) {
    const id = model ?? this.models.roles[role];
    if (!id) throw new Error(`no model for role "${role}"`);
    const cfg = this.models.models[id];
    if (!cfg) throw new Error(`model "${id}" is not in config/models.json`);
    const provider = this.providers[cfg.provider];
    if (!provider) throw new Error(`no provider adapter for "${cfg.provider}"`);
    return { id: cfg.model_id ?? id, key: id, cfg, provider };
  }

  checkBudget({ tenant, brand }, estimate) {
    const month = this.now().toISOString().slice(0, 7);
    const total = this.ledger.spent(month);
    if (total + estimate > this.budget.monthly_usd) {
      throw new BudgetExceededError({ scope: 'monthly', cap: this.budget.monthly_usd, spent: total, estimate });
    }
    if (brand) {
      const caps = this.budget.per_brand_monthly_usd ?? {};
      const cap = caps[brand] ?? caps.default;
      const spent = this.ledger.spent(month, { tenant, brand });
      if (cap !== undefined && spent + estimate > cap) {
        throw new BudgetExceededError({ scope: `brand ${brand}`, cap, spent, estimate });
      }
    }
  }

  /**
   * @param {{role?: string, model?: string, tenant: string, brand?: string, task: string,
   *   system?: string, messages: object[], maxTokens?: number, effort?: string, outputSchema?: object}} req
   * @returns {Promise<{text: string, usage: object, cost_usd: number, model: string, stop_reason: string}>}
   */
  async complete(req) {
    if (!req.tenant) throw new Error('tenant is required on every call');
    const { id, key, cfg, provider } = this.resolve(req);
    const maxTokens = req.maxTokens ?? 16000;
    const estimate = worstCaseCost(cfg, estimateTokens(req.system, req.messages), maxTokens);
    this.checkBudget(req, estimate);

    const started = Date.now();
    const res = await provider.complete({
      model: id, config: cfg, system: req.system, messages: req.messages, maxTokens, effort: req.effort, outputSchema: req.outputSchema,
    });
    const usd = cost(cfg, res.usage);
    this.ledger.append({
      at: this.now().toISOString(),
      tenant: req.tenant,
      brand: req.brand ?? null,
      task: req.task,
      role: req.role ?? null,
      model: key,
      usage: res.usage,
      cost_usd: Number(usd.toFixed(6)),
      ms: Date.now() - started,
      stop_reason: res.stop_reason,
    });
    return { ...res, cost_usd: usd, model: key };
  }
}
