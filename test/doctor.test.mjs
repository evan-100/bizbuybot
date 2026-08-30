import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runDoctor } from '../doctor.mjs';
import { dump as yamlDump } from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '..');

function setupFullRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bizbuybot-doctor-'));

  for (const dir of ['data', 'templates', 'modes', 'config', 'lib', 'providers', 'reports']) {
    fs.mkdirSync(path.join(tmp, dir), { recursive: true });
  }

  for (const file of [
    'data/acquisitions.md',
    'data/pipeline.md',
    'data/scan-history.tsv',
    'data/status-log.tsv',
  ]) {
    fs.copyFileSync(path.join(ROOT, file), path.join(tmp, file));
  }

  for (const file of [
    'templates/states.yml',
    'templates/benchmarks.yml',
    'templates/loi-template.md',
    'templates/dd-checklist-base.md',
  ]) {
    fs.copyFileSync(path.join(ROOT, file), path.join(tmp, file));
  }

  for (const file of ['modes/_shared.md', 'modes/evaluate.md']) {
    fs.copyFileSync(path.join(ROOT, file), path.join(tmp, file));
  }

  fs.copyFileSync(path.join(ROOT, 'lib/cli-flags.mjs'), path.join(tmp, 'lib/cli-flags.mjs'));
  fs.copyFileSync(path.join(ROOT, 'lib/local-today.mjs'), path.join(tmp, 'lib/local-today.mjs'));
  fs.copyFileSync(path.join(ROOT, 'lib/scraper.mjs'), path.join(tmp, 'lib/scraper.mjs'));

  for (const file of ['providers/index.mjs', 'providers/bizbuysell.mjs', 'providers/bizquest.mjs']) {
    fs.copyFileSync(path.join(ROOT, file), path.join(tmp, file));
  }

  fs.copyFileSync(path.join(ROOT, 'DATA_CONTRACT.md'), path.join(tmp, 'DATA_CONTRACT.md'));

  // node_modules stubs
  fs.mkdirSync(path.join(tmp, 'node_modules', 'playwright'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'node_modules', 'js-yaml'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'node_modules', 'dotenv'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'node_modules', 'playwright', 'package.json'), '{}');
  fs.writeFileSync(path.join(tmp, 'node_modules', 'js-yaml', 'package.json'), '{}');
  fs.writeFileSync(path.join(tmp, 'node_modules', 'dotenv', 'package.json'), '{}');

  // User-config files (warn-level)
  fs.copyFileSync(path.join(ROOT, 'config/profile.example.yml'), path.join(tmp, 'config/profile.yml'));
  fs.writeFileSync(path.join(tmp, 'portals.yml'), 'providers: {}');
  fs.writeFileSync(path.join(tmp, 'buyer-profile.md'), '# Buyer Profile');

  return tmp;
}

function findCheck(result, name) {
  return result.checks.find(c => c.name === name);
}

test('runDoctor: fully-populated root → ok: true, no fails', () => {
  const root = setupFullRoot();
  const result = runDoctor({ root });
  assert.equal(result.ok, true, `Expected ok: true, got: ${JSON.stringify(result.checks, null, 2)}`);
  const fails = result.checks.filter(c => c.status === 'fail');
  assert.equal(fails.length, 0, `Unexpected fails: ${JSON.stringify(fails)}`);
});

test('runDoctor: missing data/acquisitions.md → auto-seeds skeleton, ok: true', () => {
  const root = setupFullRoot();
  fs.unlinkSync(path.join(root, 'data', 'acquisitions.md'));
  const result = runDoctor({ root });
  assert.equal(result.ok, true, `Expected ok: true after seeding, got: ${JSON.stringify(result.checks, null, 2)}`);
  assert.ok(fs.existsSync(path.join(root, 'data', 'acquisitions.md')), 'doctor should re-create the data file');
  const check = findCheck(result, 'data/acquisitions.md');
  assert.ok(check, 'Should have a check for data/acquisitions.md');
  assert.equal(check.status, 'ok');
});

test('runDoctor: missing config/profile.yml → warn, ok still true', () => {
  const root = setupFullRoot();
  fs.unlinkSync(path.join(root, 'config', 'profile.yml'));
  const result = runDoctor({ root });
  assert.equal(result.ok, true, 'Missing profile.yml should not fail');
  const check = findCheck(result, 'config/profile.yml');
  assert.ok(check, 'Should have a check for config/profile.yml');
  assert.equal(check.status, 'warn');
});

test('runDoctor: missing templates/ → fails', () => {
  const root = setupFullRoot();
  fs.rmSync(path.join(root, 'templates'), { recursive: true });
  const result = runDoctor({ root });
  assert.equal(result.ok, false);
  const fails = result.checks.filter(c => c.status === 'fail');
  assert.ok(fails.length > 0, 'Should have fail checks when templates/ is missing');
});

test('runDoctor: missing node_modules/playwright → fail', () => {
  const root = setupFullRoot();
  fs.rmSync(path.join(root, 'node_modules', 'playwright'), { recursive: true });
  const result = runDoctor({ root });
  assert.equal(result.ok, false);
  const check = findCheck(result, 'node_modules/playwright');
  assert.ok(check);
  assert.equal(check.status, 'fail');
});

test('runDoctor: Node version check → ok', () => {
  const root = setupFullRoot();
  const result = runDoctor({ root });
  const check = findCheck(result, 'Node.js version');
  assert.ok(check, 'Should have a Node.js version check');
  assert.equal(check.status, 'ok');
});

test('runDoctor: missing portals.yml → warn, ok still true', () => {
  const root = setupFullRoot();
  fs.unlinkSync(path.join(root, 'portals.yml'));
  const result = runDoctor({ root });
  assert.equal(result.ok, true);
  const check = findCheck(result, 'portals.yml');
  assert.ok(check);
  assert.equal(check.status, 'warn');
});

test('runDoctor: missing buyer-profile.md → warn, ok still true', () => {
  const root = setupFullRoot();
  fs.unlinkSync(path.join(root, 'buyer-profile.md'));
  const result = runDoctor({ root });
  assert.equal(result.ok, true);
  const check = findCheck(result, 'buyer-profile.md');
  assert.ok(check);
  assert.equal(check.status, 'warn');
});

function writeLocalBench(root, metro) {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'local-benchmarks.yml'), yamlDump({
    meta: { primary_metro: metro, generated_at: '2026-08-25T10:00:00Z' },
    benchmarks: [{ category: 'General Main Street' }],
  }));
}

test('Benchmarks check is LOCAL when local file matches profile metro', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-doc-'));
  writeLocalBench(root, 'Orlando, FL');
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config', 'profile.yml'),
    yamlDump({ geography: { preferred_metro: ['Orlando, FL'], preferred_states: ['FL'] } }));
  const res = runDoctor({ root });
  const c = res.checks.find((x) => x.name === 'Benchmarks');
  assert.equal(c.status, 'ok');
  assert.match(c.message, /LOCAL — Orlando, FL/);
});
test('Benchmarks check warns with national defaults when nothing built', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-doc-'));
  const res = runDoctor({ root });
  const c = res.checks.find((x) => x.name === 'Benchmarks');
  assert.equal(c.status, 'warn');
  assert.match(c.message, /national defaults/);
});
test('Benchmarks check fuzzy-matches dataset-normalized metro names', () => {
  // buildDoc writes dataset names ("Orlando-Kissimmee-Sanford, FL"); profiles say "Orlando, FL".
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-doc-'));
  writeLocalBench(root, 'Orlando-Kissimmee-Sanford, FL');
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config', 'profile.yml'),
    yamlDump({ geography: { preferred_metro: ['Orlando, FL'], preferred_states: ['FL'] } }));
  const res = runDoctor({ root });
  const c = res.checks.find((x) => x.name === 'Benchmarks');
  assert.equal(c.status, 'ok');
  assert.match(c.message, /LOCAL — Orlando-Kissimmee-Sanford, FL/);
});
test('Benchmarks check tolerates local file with benchmarks but no meta block', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-doc-'));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'local-benchmarks.yml'),
    yamlDump({ benchmarks: [{ category: 'General Main Street' }] }));
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config', 'profile.yml'),
    yamlDump({ geography: { preferred_states: ['FL'] } }));
  const res = runDoctor({ root });
  const c = res.checks.find((x) => x.name === 'Benchmarks');
  assert.equal(c.status, 'ok');
  assert.match(c.message, /unknown metro/);
});
