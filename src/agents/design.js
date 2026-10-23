// Brief → spec → render → checks → model critique → revision loop (F0-7).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { renderSpec } from '../render/png.js';
import { checkSpec } from '../rubric/checks.js';
import { validateSpec } from '../spec/validate.js';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');

const critiqueSchema = JSON.parse(read('schemas/critique-0.1.schema.json'));
const validateCritique = new Ajv2020({ allErrors: true, strict: false }).compile(critiqueSchema);

/** Weighted total of criterion scores using config/rubric.json weights. */
export function weightedScore(scores, criteria) {
  const total = Object.values(criteria).reduce((s, c) => s + c.weight, 0);
  return Object.entries(criteria).reduce((s, [k, c]) => s + (scores[k] ?? 0) * c.weight, 0) / total;
}

/** First JSON object in a model reply (tolerates stray prose or code fences). */
export function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in model reply');
  return JSON.parse(text.slice(start, end + 1));
}

function pngSize(buf) {
  return buf.subarray(1, 4).toString() === 'PNG' ? `${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}` : 'unknown size';
}

/** Everything the designer needs about a brand, as prompt text. */
export function brandContext(brandsDir, brandId) {
  const dir = join(brandsDir, brandId);
  const kit = JSON.parse(readFileSync(join(dir, 'brand-kit.json'), 'utf8'));
  const assetsDir = join(dir, 'assets');
  const assets = existsSync(assetsDir)
    ? readdirSync(assetsDir, { recursive: true })
      .filter((f) => ['.png', '.jpg', '.jpeg'].includes(extname(String(f)).toLowerCase()))
      .map((f) => {
        const id = String(f).replace(/\\/g, '/').replace(/\.[^.]+$/, '');
        return `asset://${id} (${pngSize(readFileSync(join(assetsDir, String(f))))})`;
      })
    : [];
  const cardPath = root(`docs/style-cards/${brandId}.md`);
  const card = existsSync(cardPath) ? readFileSync(cardPath, 'utf8') : '(no style card)';
  return { kit, assets, card };
}

/**
 * Runs one brief through design, checks, critique and up to N revisions.
 * @param {{brief: object, llm: import('../llm/client.js').LLM, brandsDir: string, tenant: string,
 *   designModel?: string, criticModel?: string, examples?: object[]}} opts
 */
export async function designLoop({ brief, llm, brandsDir, tenant, designModel, criticModel, examples = [] }) {
  const rubric = JSON.parse(read('config/rubric.json'));
  const { kit, assets, card } = brandContext(brandsDir, brief.brand);
  const schema = read('schemas/design-spec-0.1.schema.json');
  const context = [
    `# Brand kit\n${JSON.stringify(kit, null, 1)}`,
    `# Style card\n${card}`,
    `# Available assets\n${assets.join('\n') || '(none)'}`,
    `# Spec JSON Schema\n${schema}`,
    ...examples.map((e, i) => `# Example spec ${i + 1} (passes all checks)\n${JSON.stringify(e)}`),
  ].join('\n\n');
  const designer = { model: designModel, role: designModel ? undefined : 'concept', tenant, brand: brief.brand, system: read('prompts/designer.md') };
  const critic = { model: criticModel, role: criticModel ? undefined : 'critique', tenant, brand: brief.brand, system: read('prompts/critic.md') };

  const rounds = [];
  let messages = [{ role: 'user', content: `${context}\n\n# Brief\n${JSON.stringify(brief, null, 1)}\n\nWrite the spec.` }];
  let cost = 0;

  for (let round = 0; round <= rubric.max_revision_rounds; round++) {
    const reply = await llm.complete({ ...designer, task: `design:${brief.id}:r${round}`, messages, maxTokens: 16000 });
    cost += reply.cost_usd;
    let spec;
    let problems;
    try {
      spec = parseJson(reply.text);
      const v = validateSpec(spec);
      problems = v.valid ? null : v.errors.map((e) => `${e.path}: ${e.message}`);
    } catch (err) {
      problems = [err.message];
    }
    messages = [...messages, { role: 'assistant', content: reply.text }];
    if (problems) {
      rounds.push({ round, invalid: problems });
      messages.push({ role: 'user', content: `The spec is invalid:\n${problems.join('\n')}\nReturn a corrected spec.` });
      continue;
    }

    const { png, warnings } = renderSpec(spec, { brandsDir });
    const checks = checkSpec(spec, { brandsDir });
    const review = await llm.complete({
      ...critic,
      task: `critique:${brief.id}:r${round}`,
      maxTokens: 4000,
      outputSchema: critiqueSchema,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } },
          { type: 'text', text: `# Brief\n${JSON.stringify(brief)}\n\n# Spec\n${JSON.stringify(spec)}\n\n# Checker failures\n${JSON.stringify(checks.failures)}\n\n# Rubric criteria\n${JSON.stringify(rubric.criteria)}` },
        ],
      }],
    });
    cost += review.cost_usd;
    const critique = parseJson(review.text);
    if (!validateCritique(critique)) {
      throw new Error(`critique does not match the rubric schema: ${JSON.stringify(validateCritique.errors)}`);
    }
    const score = weightedScore(critique.scores, rubric.criteria);
    const critical = [...checks.failures, ...critique.failures].filter((f) => f.severity === 'critical');
    const passed = score >= rubric.pass_score && critical.length === 0;
    rounds.push({ round, spec, png, warnings, checks, critique, score, passed });
    if (passed || round === rubric.max_revision_rounds) break;

    messages.push({
      role: 'user',
      content: `Review of your spec (score ${score.toFixed(1)}, needs ${rubric.pass_score} and no critical failures):\n` +
        `${JSON.stringify({ checker: checks.failures, critique })}\nRevise the spec to fix these. Return only the full revised spec.`,
    });
  }

  const best = rounds.filter((r) => r.spec).sort((a, b) => b.score - a.score)[0] ?? null;
  return { brief, rounds, best, cost_usd: cost };
}
