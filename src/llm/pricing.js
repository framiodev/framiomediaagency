/** Price row for a model, picking the tier that matches the prompt size. */
export function rates(model, inputTokens) {
  if (!model.tiers) return model;
  const tier = model.tiers.find((t) => t.max_input_tokens === undefined || inputTokens <= t.max_input_tokens);
  return { ...model, ...tier };
}

/**
 * Cost in USD of one call.
 * @param {object} model - entry from config/models.json
 * @param {{input_tokens?: number, output_tokens?: number, cache_read_input_tokens?: number, cache_creation_input_tokens?: number}} usage
 * @param {{batch?: boolean}} [opts]
 */
export function cost(model, usage, { batch = false } = {}) {
  const read = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const input = usage.input_tokens ?? 0;
  const r = rates(model, input + read + write);
  // Unknown cache-read price: charge full input price rather than under-count.
  const readPrice = r.cache_read ?? r.input;
  const usd =
    (input * r.input + write * r.input * (r.cache_write_multiplier ?? 1) + read * readPrice + (usage.output_tokens ?? 0) * r.output) / 1e6;
  return batch ? usd * (r.batch_discount ?? 1) : usd;
}

/** Upper bound before a call: every prompt token uncached, every allowed output token used. */
export function worstCaseCost(model, promptTokens, maxTokens) {
  return cost(model, { input_tokens: promptTokens, output_tokens: maxTokens });
}
