import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { dump as yamlDump } from 'js-yaml';
import { loadDeals, filterDeals, sortDeals, startServer } from '../dashboard.mjs';

function setupTempProject() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizbuybot-dash-'));
  // dashboard serves reports from <dataDir>/../reports
  const dataDir = path.join(tmpdir, 'data');
  const reportsDir = path.join(tmpdir, 'reports');
  fs.mkdirSync(dataDir);
  fs.mkdirSync(reportsDir);
  fs.writeFileSync(
    path.join(dataDir, 'acquisitions.md'),
    `# BizBuyBot — Acquisitions Tracker

| # | Date | Business | Category | Location | Asking Price | Cash Flow (SDE) | Multiple | Score | Status | Report | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 001 | 2026-08-22 | Alpha Laundromat | Laundromat | Austin, TX | $450,000 | $160,000 | 2.8x | 4.4/5 | Evaluated | reports/001-alpha.md | solid |
| 002 | 2026-08-23 | Beta HVAC | HVAC | Dallas, TX | $799,000 | $84,000 | 9.5x | 2.0/5 | Passed | reports/002-beta.md | too expensive |
| 003 | 2026-08-24 | Gamma Wash | Car Wash | Tampa, FL | $650,000 | $210,000 | 3.1x | 4.0/5 | Watchlist | reports/003-gamma.md | watching |
| 004 | 2026-08-25 | Delta Plumbing | Plumbing | Orlando, FL | $600,000 | $189,000 | 3.2x | 3.6/5 | Under_Review | reports/004-delta.md | in review |
| 005 | 2026-08-26 | Epsilon Clean | Cleaning | Miami, FL | $300,000 | $95,000 | 3.2x | 3.8/5 | Closed | reports/005-epsilon.md | done |
`,
  );
  fs.writeFileSync(path.join(reportsDir, '001-alpha.md'), '# Alpha Laundromat — Evaluation\n\nScore: 4.4/5\n');
  return tmpdir;
}

async function withServer(fn) {
  const root = setupTempProject();
  const server = startServer({ port: 0, dataDir: path.join(root, 'data') });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`, root);
  } finally {
    server.close();
  }
}

// ===== pure logic =====

test('loadDeals parses tracker rows into deal objects', () => {
  const root = setupTempProject();
  const deals = loadDeals(path.join(root, 'data'));
  assert.equal(deals.length, 5);
  assert.equal(deals[0].id, '001');
  assert.equal(deals[0].business, 'Alpha Laundromat');
  assert.equal(deals[1].status, 'Passed');
});

test('loadDeals returns empty array for missing tracker', () => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizbuybot-dash-'));
  assert.deepEqual(loadDeals(tmpdir), []);
});

test('filterDeals tabs select the right statuses', () => {
  const root = setupTempProject();
  const deals = loadDeals(path.join(root, 'data'));

  assert.equal(filterDeals(deals, 'all').length, 5);

  const active = filterDeals(deals, 'active');
  assert.deepEqual(active.map((d) => d.id), ['001', '004']);

  const watchlist = filterDeals(deals, 'watchlist');
  assert.deepEqual(watchlist.map((d) => d.id), ['003']);

  const done = filterDeals(deals, 'done');
  assert.deepEqual(done.map((d) => d.id), ['002', '005']);
});

test('sortDeals by score descending', () => {
  const root = setupTempProject();
  const deals = loadDeals(path.join(root, 'data'));
  const sorted = sortDeals(deals, 'score');
  assert.deepEqual(sorted.map((d) => d.id), ['001', '003', '005', '004', '002']);
});

test('sortDeals by date descending', () => {
  const root = setupTempProject();
  const deals = loadDeals(path.join(root, 'data'));
  const sorted = sortDeals(deals, 'date');
  assert.equal(sorted[0].id, '005');
  assert.equal(sorted[4].id, '001');
});

test('sortDeals by price descending puts highest first', () => {
  const root = setupTempProject();
  const deals = loadDeals(path.join(root, 'data'));
  const sorted = sortDeals(deals, 'price');
  assert.equal(sorted[0].id, '002'); // $799k
  assert.equal(sorted[4].id, '005'); // $300k
});

test('sortDeals by multiple ascending (cheapest multiple first)', () => {
  const root = setupTempProject();
  const deals = loadDeals(path.join(root, 'data'));
  const sorted = sortDeals(deals, 'multiple');
  assert.equal(sorted[0].id, '001'); // 2.8x
  assert.equal(sorted[4].id, '002'); // 9.5x
});

// ===== HTTP server =====

test('GET /api/deals returns tracker rows as JSON', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/deals`);
    assert.equal(res.status, 200);
    const deals = await res.json();
    assert.equal(deals.length, 5);
    assert.equal(deals[0].business, 'Alpha Laundromat');
  });
});

test('GET / serves the dashboard HTML page', async () => {
  await withServer(async (base) => {
    const res = await fetch(base);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('<title>BizBuyBot Dashboard</title>'));
    assert.ok(html.includes('/api/deals'));
  });
});

test('GET /reports/<file> serves a linked report', async () => {
  await withServer(async (base, root) => {
    const name = encodeURIComponent('reports/001-alpha.md');
    const res = await fetch(`${base}/${name}`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes('# Alpha Laundromat — Evaluation'));
    void root;
  });
});

test('report endpoint blocks path traversal', async () => {
  await withServer(async (base, root) => {
    // attempt to escape reports dir via encoded traversal
    const evil = encodeURIComponent('reports/../../data/acquisitions.md');
    const res = await fetch(`${base}/${evil}`);
    assert.equal(res.status, 404);

    // also block direct traversal form that decodes outside reports/
    const evil2 = encodeURIComponent('reports/../acquisitions.md');
    const res2 = await fetch(`${base}/${evil2}`);
    assert.equal(res2.status, 404);
    void root;
  });
});

test('unknown routes return 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
  });
});

test('GET /deal/<id> renders the report detail page', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/deal/001`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Alpha Laundromat'));
    assert.ok(html.includes('<svg')); // score gauge / valuation band
  });
});

test('GET /deal/<unknown-id> returns 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/deal/999`);
    assert.equal(res.status, 404);
  });
});

test('GET /deal/<id>/dd serves the artifact as a styled page', async () => {
  await withServer(async (base, root) => {
    fs.writeFileSync(path.join(root, 'reports', '001-dd-checklist.md'), '# Due Diligence Checklist\n\n> **Priority:** inspect the lease.');
    const res = await fetch(`${base}/deal/001/dd`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Due Diligence Checklist'));
    assert.ok(html.includes('<blockquote>'), 'artifact markdown rendered through mdToHtml');
    assert.ok(html.includes('href="/deal/001"'), 'back link to deal');
  });
});

test('GET /deal/<id>/dd and /loi and /outreach resolve independently', async () => {
  await withServer(async (base, root) => {
    fs.writeFileSync(path.join(root, 'reports', '001-dd-checklist.md'), '# Due Diligence Checklist');
    fs.writeFileSync(path.join(root, 'reports', '001-loi.md'), '# Letter of Intent');
    fs.writeFileSync(path.join(root, 'reports', '001-outreach.md'), '# Outreach');
    for (const [kind, label] of [['dd', 'Due Diligence Checklist'], ['loi', 'Letter of Intent'], ['outreach', 'Broker Outreach']]) {
      const res = await fetch(`${base}/deal/001/${kind}`);
      assert.equal(res.status, 200, `${kind} should serve`);
      const html = await res.text();
      assert.ok(html.includes(label), `${kind} page shows its label`);
    }
  });
});

test('deal page links existing artifacts in the subnav', async () => {
  await withServer(async (base, root) => {
    fs.writeFileSync(path.join(root, 'reports', '001-dd-checklist.md'), '# DD');
    fs.writeFileSync(path.join(root, 'reports', '001-loi.md'), '# LOI');
    const res = await fetch(`${base}/deal/001`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('class="artifactnav"'));
    assert.ok(html.includes('href="/deal/001/dd"'));
    assert.ok(html.includes('href="/deal/001/loi"'));
    assert.ok(!html.includes('href="/deal/001/outreach"'), 'no link for artifact that does not exist');
  });
});

test('artifact routes 404 when the artifact file is missing', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/deal/001/loi`);
    assert.equal(res.status, 404);
  });
});

test('artifact routes 404 when the deal is unknown', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/deal/999/dd`);
    assert.equal(res.status, 404);
  });
});

test('artifact routes 404 for unknown kinds', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/deal/001/report`);
    assert.equal(res.status, 404);
  });
});

test('artifact routes block path traversal', async () => {
  await withServer(async (base, root) => {
    fs.writeFileSync(path.join(root, 'reports', '001-dd-checklist.md'), '# DD');
    const evil = await fetch(`${base}/deal/001/..%2F..%2Fdashboard.mjs`);
    assert.equal(evil.status, 404);
    const bare = await fetch(`${base}/deal/001/..`);
    assert.equal(bare.status, 404);
  });
});

test('GET /deal/<id> loads benchmarks from the dataDir root (honors --data-dir)', async () => {
  const root = setupTempProject();
  fs.writeFileSync(
    path.join(root, 'reports', '001-alpha.md'),
    [
      '# Alpha Laundromat — Evaluation',
      '',
      'Score: 4.4/5',
      '',
      '```yaml',
      'bizbuybot:',
      '  score: 4.4',
      '  sde: 160000',
      '  revenue: 520000',
      '```',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(root, 'data', 'local-benchmarks.yml'),
    yamlDump({
      meta: { primary_metro: 'Orlando, FL', generated_at: '2026-08-25T00:00:00Z' },
      benchmarks: [{
        category: 'Laundromat',
        sde_multiple_min: 3.0,
        sde_multiple_max: 4.5,
        revenue_benchmark: { avg: 840000, scope: 'LOCALFIXTURE metro revenue scope' },
        sde_benchmark: { avg: 215000, scope: 'LOCALFIXTURE margin scope' },
      }],
    }),
  );

  const server = startServer({ port: 0, dataDir: path.join(root, 'data') });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/deal/001`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('LOCALFIXTURE metro revenue scope'),
      'report page should render the localized benchmark from <dataDir>/../data');
  } finally {
    server.close();
  }
});
