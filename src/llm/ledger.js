import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Append-only JSONL record of every model call and its cost. */
export class Ledger {
  constructor(path) {
    this.path = path;
  }

  append(entry) {
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, `${JSON.stringify(entry)}\n`);
  }

  entries() {
    if (!existsSync(this.path)) return [];
    return readFileSync(this.path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }

  /** USD spent in a calendar month (UTC, "YYYY-MM"), optionally for one tenant/brand. */
  spent(month, { tenant, brand } = {}) {
    return this.entries()
      .filter((e) => e.at.startsWith(month) && (!tenant || e.tenant === tenant) && (!brand || e.brand === brand))
      .reduce((sum, e) => sum + e.cost_usd, 0);
  }
}
