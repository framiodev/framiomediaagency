#!/usr/bin/env node
// Environment health check (F0-0). Exits 1 if a required tool is missing.
// Usage: node scripts/doctor.mjs [--ci]   (--ci skips machine-only tools)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ci = process.argv.includes('--ci');

function version(cmd, args = ['--version']) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' })
      .trim().split('\n')[0];
  } catch {
    return null;
  }
}

const major = Number(process.versions.node.split('.')[0]);
const checks = [
  { name: 'Node.js ≥ 22', required: true, ok: major >= 22, info: process.version },
  { name: 'Git', required: true, cmd: ['git'] },
  { name: 'npm dependencies', required: true, ok: existsSync('node_modules/@resvg/resvg-js'), info: 'node_modules' },
  { name: 'Python 3 (font/asset tools)', required: false, cmd: ['python'] },
  { name: 'Rust (Faz 1: Tauri, Faz 5: motor)', required: false, cmd: ['rustc'] },
  { name: 'FFmpeg (video, Faz 2)', required: false, cmd: ['ffmpeg', ['-version']] },
  { name: 'NVIDIA GPU', required: false, machine: true, cmd: ['nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader']] },
  { name: 'Photoshop (COM)', required: false, machine: true, ok: process.platform === 'win32' && existsSync('C:/Program Files/Adobe/Adobe Photoshop 2026/Photoshop.exe'), info: 'Adobe Photoshop 2026' },
];

let failed = 0;
for (const c of checks) {
  if (ci && c.machine) continue;
  let { ok, info } = c;
  if (c.cmd) {
    info = version(c.cmd[0], c.cmd[1]);
    ok = info !== null;
  }
  const mark = ok ? '✓' : c.required ? '✗' : '–';
  console.log(`${mark} ${c.name}${info ? `: ${info}` : ok ? '' : ' (bulunamadı)'}`);
  if (!ok && c.required) failed++;
}
process.exit(failed ? 1 : 0);
