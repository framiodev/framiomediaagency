import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateSpec } from '../src/spec/validate.js';

const load = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]);

const valid = load('examples/specs/valid');
const invalid = load('examples/specs/invalid');

test('there are at least 3 valid examples', () => {
  assert.ok(valid.length >= 3);
});

for (const [name, spec] of valid) {
  test(`valid: ${name}`, () => {
    const res = validateSpec(spec);
    assert.deepEqual(res.errors, []);
    assert.equal(res.valid, true);
  });
}

for (const [name, spec] of invalid) {
  test(`invalid: ${name}`, () => {
    const res = validateSpec(spec);
    assert.equal(res.valid, false);
    assert.ok(res.errors.length > 0);
  });
}

test('non-object input is rejected', () => {
  assert.equal(validateSpec(null).valid, false);
  assert.equal(validateSpec('{}').valid, false);
});
