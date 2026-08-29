import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

test('fetch-listing: requires url argument', () => {
  const res = spawnSync('node', [path.join(ROOT, 'fetch-listing.mjs')], {
    encoding: 'utf-8',
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Usage: node fetch-listing.mjs'));
});
