#!/usr/bin/env node
// F0-11: measure SDXL generation on the local GPU through a running ComfyUI
// server, sampling nvidia-smi (VRAM, temperature, power) while it works.
// Usage: node scripts/gpu-benchmark.mjs [--host http://127.0.0.1:8188] [--runs 3] [--out dir]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? def : process.argv[i + 1];
};
const host = arg('--host', 'http://127.0.0.1:8188');
const runs = Number(arg('--runs', '3'));
const outDir = arg('--out', 'out/gpu');
mkdirSync(outDir, { recursive: true });

const NEGATIVE = 'text, letters, logo, watermark, brand name, signage, license plate, people, blurry, deformed';
const JOBS = [
  // Generic, brand-free scene for the DK route concept (concept study only).
  { name: 'coach-highway', w: 896, h: 1152, steps: 30, seed: 2026,
    prompt: 'photograph of a modern white intercity coach bus driving on an empty coastal highway at golden hour, sea on the right, low camera angle, motion blur on the road, cinematic, sharp focus on the bus, 35mm' },
  ...Array.from({ length: runs }, (_, i) => ({ name: `bench-${i + 1}`, w: 1024, h: 1024, steps: 30, seed: 100 + i,
    prompt: 'studio product photograph of a ceramic matcha bowl with bright green whisked matcha and a bamboo whisk, soft daylight, beige linen background, minimal' })),
];

function workflow(job) {
  return {
    4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
    5: { class_type: 'EmptyLatentImage', inputs: { width: job.w, height: job.h, batch_size: 1 } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: job.prompt, clip: ['4', 1] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: NEGATIVE, clip: ['4', 1] } },
    3: { class_type: 'KSampler', inputs: { seed: job.seed, steps: job.steps, cfg: 6.5, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    9: { class_type: 'SaveImage', inputs: { filename_prefix: `f0-11-${job.name}`, images: ['8', 0] } },
  };
}

function gpu() {
  const q = 'memory.used,memory.total,temperature.gpu,power.draw,utilization.gpu';
  const line = execFileSync('nvidia-smi', [`--query-gpu=${q}`, '--format=csv,noheader,nounits'], { encoding: 'utf8' }).trim();
  const [mem, total, temp, power, util] = line.split(',').map((v) => Number(v.trim()));
  return { mem, total, temp, power, util };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const samples = [];
let sampling = true;
(async () => {
  while (sampling) {
    try { samples.push({ t: Date.now(), ...gpu() }); } catch { /* ignore */ }
    await sleep(2000);
  }
})();

const idle = gpu();
const results = [];
for (const job of JOBS) {
  const started = Date.now();
  const res = await fetch(`${host}/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: workflow(job) }) });
  const { prompt_id: id } = await res.json();
  let out;
  for (;;) {
    await sleep(1000);
    const h = await (await fetch(`${host}/history/${id}`)).json();
    if (h[id]?.status?.completed) {
      out = h[id];
      break;
    }
    if (h[id]?.status?.status_str === 'error') throw new Error(`job ${job.name} failed`);
  }
  const img = Object.values(out.outputs)[0].images[0];
  const file = await (await fetch(`${host}/view?filename=${encodeURIComponent(img.filename)}&type=output`)).arrayBuffer();
  writeFileSync(join(outDir, `${job.name}.png`), Buffer.from(file));
  const s = (Date.now() - started) / 1000;
  results.push({ ...job, seconds: s });
  console.log(`${job.name} ${job.w}x${job.h} ${job.steps} steps: ${s.toFixed(1)} s`);
}
sampling = false;

const peak = (k) => Math.max(...samples.map((x) => x[k]));
const report = {
  idle,
  peak: { mem: peak('mem'), temp: peak('temp'), power: peak('power'), util: peak('util') },
  results: results.map(({ name, w, h, steps, seconds }) => ({ name, w, h, steps, seconds })),
  samples: samples.length,
};
writeFileSync(join(outDir, 'gpu-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.peak));
