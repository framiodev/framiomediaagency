import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude adapter. Credentials come from the environment (ANTHROPIC_API_KEY or
 * an `ant auth login` profile); BYOK users set their own key.
 */
export function anthropicProvider(client = new Anthropic()) {
  return {
    async complete({ model, config, system, messages, maxTokens, effort, outputSchema }) {
      const params = {
        model,
        max_tokens: maxTokens,
        messages,
        ...(system ? { system } : {}),
        ...(effort || outputSchema
          ? { output_config: { ...(effort ? { effort } : {}), ...(outputSchema ? { format: { type: 'json_schema', schema: outputSchema } } : {}) } }
          : {}),
      };
      // Server-side fallback on safety refusals, where the model supports it.
      const res = config.fallbacks
        ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: config.fallbacks })
        : await client.messages.create(params);

      if (res.stop_reason === 'refusal') {
        const why = res.stop_details?.category ?? 'unspecified';
        throw new Error(`model refused (${why})`);
      }
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const u = res.usage;
      return {
        text,
        stop_reason: res.stop_reason,
        usage: {
          input_tokens: u.input_tokens,
          output_tokens: u.output_tokens,
          cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
        },
      };
    },
  };
}
