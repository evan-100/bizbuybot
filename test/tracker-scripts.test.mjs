import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseRows } from '../lib/parse-rows.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function setupTempDataDir() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizbuybot-'));
  // Seed canonical minimal fixtures — never copy live data files, which change as the user adds real deals.
  fs.writeFileSync(
    path.join(tmpdir, 'acquisitions.md'),
    '# BizBuyBot — Acquisitions Tracker\n\nCanonical deal tracker. One row per evaluated business.\n\n| # | Date | Business | Category | Location | Asking Price | Cash Flow (SDE) | Multiple | Score | Status | Report | Notes |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n',
  );
  fs.writeFileSync(path.join(tmpdir, 'pipeline.md'), '# BizBuyBot — Pipeline Inbox\n\n## Pending\n\n## Processed\n');
  fs.writeFileSync(path.join(tmpdir, 'status-log.tsv'), 'timestamp\tdeal_id\tfrom_status\tto_status\treason\n');
  fs.copyFileSync(path.join(ROOT, 'templates', 'states.yml'), path.join(tmpdir, 'states.yml'));
  return tmpdir;
}

function run(script, args, dataDir) {
  return spawnSync('node', [path.join(ROOT, script), ...args, '--data-dir=' + dataDir], {
    encoding: 'utf-8',
  });
}

function parseTrackerRows(content) {
  return parseRows(content)
    .filter(cells => cells.length >= 12)
    .map(cells => ({
      id: cells[0], date: cells[1], business: cells[2], category: cells[3],
      location: cells[4], askingPrice: cells[5], sde: cells[6],
      multiple: cells[7], score: cells[8], status: cells[9],
      report: cells[10], notes: cells[11],
    }));
}

function addEntry(dir, opts = {}) {
  const args = [
    '--business=' + (opts.business || 'Test Biz'),
    '--category=' + (opts.category || 'Test'),
    '--location=' + (opts.location || 'Test, TX'),
    '--price=' + (opts.price || 100000),
    '--sde=' + (opts.sde || 50000),
  ];
  if (opts.score !== undefined) args.push('--score=' + opts.score);
  if (opts.status) args.push('--status=' + opts.status);
  if (opts.report) args.push('--report=' + opts.report);
  if (opts.notes) args.push('--notes=' + opts.notes);
  return run('add-entry.mjs', args, dir);
}

// ===== add-entry =====

test('add-entry: first entry gets ID 001 with correct multiple', () => {
  const dir = setupTempDataDir();
  const res = addEntry(dir, { business: 'Metro Laundromat', price: 450000, sde: 160000, score: 4.4 });
  assert.equal(res.status, 0, `exit ${res.status}, stderr: ${res.stderr}`);
  assert.match(res.stdout, /001/);

  const rows = parseTrackerRows(fs.readFileSync(path.join(dir, 'acquisitions.md'), 'utf-8'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, '001');
  assert.equal(rows[0].business, 'Metro Laundromat');
  assert.equal(rows[0].multiple, '2.8x');
});

test('add-entry: second entry gets ID 002', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'First Biz' });
  const res = addEntry(dir, { business: 'Second Biz' });
  assert.equal(res.status, 0, `exit ${res.status}, stderr: ${res.stderr}`);
  assert.match(res.stdout, /002/);

  const rows = parseTrackerRows(fs.readFileSync(path.join(dir, 'acquisitions.md'), 'utf-8'));
  assert.equal(rows.length, 2);
  assert.equal(rows[1].id, '002');
});

test('add-entry: default status is Evaluated', () => {
  const dir = setupTempDataDir();
  const res = addEntry(dir, { business: 'No Status Biz' });
  assert.equal(res.status, 0, `exit ${res.status}, stderr: ${res.stderr}`);

  const rows = parseTrackerRows(fs.readFileSync(path.join(dir, 'acquisitions.md'), 'utf-8'));
  assert.equal(rows[0].status, 'Evaluated');
});

// ===== set-status =====

test('set-status: legal transition succeeds and logs to status-log.tsv', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Status Biz' });
  const res = run('set-status.mjs', ['001', 'Outreach_Sent', '--reason=Reached out'], dir);
  assert.equal(res.status, 0, `exit ${res.status}, stderr: ${res.stderr}`);

  const rows = parseTrackerRows(fs.readFileSync(path.join(dir, 'acquisitions.md'), 'utf-8'));
  assert.equal(rows[0].status, 'Outreach_Sent');

  const log = fs.readFileSync(path.join(dir, 'status-log.tsv'), 'utf-8').trim().split('\n');
  assert.equal(log.length, 2);
  const fields = log[1].split('\t');
  assert.equal(fields[1], '001');
  assert.equal(fields[2], 'Evaluated');
  assert.equal(fields[3], 'Outreach_Sent');
  assert.equal(fields[4], 'Reached out');
});

test('set-status: illegal transition fails with non-zero exit', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Status Biz' });
  const res = run('set-status.mjs', ['001', 'Closed'], dir);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr + res.stdout, /illegal|invalid|cannot|not allowed|not a valid/i);
});

test('set-status: unknown status fails', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Status Biz' });
  const res = run('set-status.mjs', ['001', 'FakeStatus'], dir);
  assert.notEqual(res.status, 0);
});

test('set-status: unknown id fails', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Status Biz' });
  const res = run('set-status.mjs', ['999', 'Outreach_Sent'], dir);
  assert.notEqual(res.status, 0);
});

// ===== verify-pipeline =====

test('verify-pipeline: passes on healthy tracker', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Healthy Biz', price: 450000, sde: 160000, score: 4.4 });
  const res = run('verify-pipeline.mjs', [], dir);
  assert.equal(res.status, 0, `Expected pass, stderr: ${res.stderr}, stdout: ${res.stdout}`);
});

test('verify-pipeline: fails on invalid status', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Bad Status Biz' });
  const file = path.join(dir, 'acquisitions.md');
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace('Evaluated', 'FakeStatus');
  fs.writeFileSync(file, content);
  const res = run('verify-pipeline.mjs', [], dir);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr + res.stdout, /invalid status/i);
});

test('verify-pipeline: fails on duplicate IDs', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Biz 1' });
  const file = path.join(dir, 'acquisitions.md');
  const content = fs.readFileSync(file, 'utf-8');
  // Duplicate row 001
  const lastLine = content.trim().split('\n').pop();
  fs.writeFileSync(file, content.trimEnd() + '\n' + lastLine + '\n');
  const res = run('verify-pipeline.mjs', [], dir);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr + res.stdout, /duplicate id/i);
});

test('verify-pipeline: fails on non-sequential IDs', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Biz 1' });
  const file = path.join(dir, 'acquisitions.md');
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace('| 001 |', '| 002 |');
  fs.writeFileSync(file, content);
  const res = run('verify-pipeline.mjs', [], dir);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr + res.stdout, /not sequential/i);
});

test('verify-pipeline: fails on invalid date format', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Bad Date Biz' });
  const file = path.join(dir, 'acquisitions.md');
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/\d{4}-\d{2}-\d{2}/, '08/22/2026');
  fs.writeFileSync(file, content);
  const res = run('verify-pipeline.mjs', [], dir);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr + res.stdout, /invalid date/i);
});

test('verify-pipeline: fails on multiple inconsistency', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Bad Mul Biz', price: 450000, sde: 160000 });
  const file = path.join(dir, 'acquisitions.md');
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace('2.8x', '5.0x');
  fs.writeFileSync(file, content);
  const res = run('verify-pipeline.mjs', [], dir);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr + res.stdout, /multiple/i);
});

test('verify-pipeline: fails on column count mismatch (too few cells)', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Good Biz' });
  const file = path.join(dir, 'acquisitions.md');
  const content = fs.readFileSync(file, 'utf-8');
  fs.writeFileSync(file, content.trimEnd() + '\n| 002 | 2026-08-22 | Bad Row |\n');
  const res = run('verify-pipeline.mjs', [], dir);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr + res.stdout, /column count/i);
});

test('verify-pipeline: fails on malformed status-log lines', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Log Test Biz' });
  const logFile = path.join(dir, 'status-log.tsv');
  fs.appendFileSync(logFile, '2026-08-22T00:00:00Z\t001\n');
  const res = run('verify-pipeline.mjs', [], dir);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr + res.stdout, /status-log\.tsv/i);
});

// ===== export-pipeline =====

test('export-pipeline: CSV output has header and rows', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'Export Biz', price: 450000, sde: 160000 });
  const res = run('export-pipeline.mjs', [], dir);
  assert.equal(res.status, 0, `exit ${res.status}, stderr: ${res.stderr}`);
  const lines = res.stdout.trim().split('\n');
  assert.ok(lines.length >= 2, 'Should have header + at least 1 row');
  assert.match(lines[0], /id,/i);
  assert.match(res.stdout, /Export Biz/);
});

test('export-pipeline: JSON output parses to array with expected keys', () => {
  const dir = setupTempDataDir();
  addEntry(dir, { business: 'JSON Biz', price: 450000, sde: 160000 });
  const res = run('export-pipeline.mjs', ['--format=json'], dir);
  assert.equal(res.status, 0, `exit ${res.status}, stderr: ${res.stderr}`);
  const data = JSON.parse(res.stdout);
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1);
  const expectedKeys = ['id', 'date', 'business', 'category', 'location', 'asking_price', 'sde', 'multiple', 'score', 'status', 'report', 'notes'];
  for (const key of expectedKeys) {
    assert.ok(key in data[0], `Missing key: ${key}`);
  }
  assert.equal(data[0].business, 'JSON Biz');
});
