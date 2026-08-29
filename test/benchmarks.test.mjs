import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import * as XLSX from 'xlsx';
import {
  loadBenchmarks, CATEGORY_DEFS, categoryMatches, parseSusbLine, filterSusbRows, deriveRevenueAvg,
  deriveIrsMargin,
} from '../lib/benchmarks.mjs';
import { _internals } from '../build-benchmarks.mjs';
const { buildDoc, toIrsStateLabel } = _internals;

const NATIONAL = { benchmarks: [{ category: 'General Main Street', sde_multiple_min: 2.0 }] };
const LOCAL = {
  meta: { primary_metro: 'Orlando, FL' },
  benchmarks: [
    { category: 'HVAC', keywords: [], sde_multiple_min: 2.5,
      revenue_benchmark: { avg: 900000, scope: 'Orlando MSA', fallback_reason: null },
      sde_benchmark: { avg: 135000, scope: 'FL', fallback_reason: null } },
  ],
};

function makeRoot({ local, national, corruptLocal }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-bench-'));
  fs.mkdirSync(path.join(root, 'templates'), { recursive: true });
  fs.writeFileSync(path.join(root, 'templates', 'benchmarks.yml'),
    yamlDump(national !== undefined ? national : NATIONAL));
  if (local === 'corrupt') {
    fs.mkdirSync(path.join(root, 'data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data', 'local-benchmarks.yml'), '{{{ not yaml');
  } else if (local) {
    fs.mkdirSync(path.join(root, 'data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data', 'local-benchmarks.yml'), yamlDump(local));
  }
  return root;
}

test('local file wins when present', () => {
  const r = loadBenchmarks(makeRoot({ local: LOCAL }));
  assert.equal(r.source, 'local');
  assert.equal(r.meta.primary_metro, 'Orlando, FL');
  assert.equal(r.benchmarks[0].category, 'HVAC');
});
test('falls back to national when local absent', () => {
  const r = loadBenchmarks(makeRoot({}));
  assert.equal(r.source, 'national');
});
test('malformed local falls back with warning, no crash', () => {
  const r = loadBenchmarks(makeRoot({ local: 'corrupt' }));
  assert.equal(r.source, 'national');
  assert.ok(r.warning);
});
test('nothing exists -> none', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-bench-'));
  const r = loadBenchmarks(root);
  assert.equal(r.source, 'none');
  assert.equal(r.benchmarks, null);
});

const SAMPLE = fs.readFileSync(new URL('./fixtures/susb-sample.csv', import.meta.url), 'utf8')
  .split('\n').slice(1).map(parseSusbLine).filter(Boolean);

test('quoted metro names survive CSV parsing', () => {
  assert.equal(SAMPLE[0].msaName, 'Orlando-Kissimmee-Sanford, FL Metro Area');
});
test('employment filter keeps <20 classes only', () => {
  const rows = filterSusbRows(SAMPLE, { msaCode: '36740', def: CATEGORY_DEFS.find((d) => d.category === 'Laundromat') });
  assert.equal(rows.length, 3); // drops ENTRSIZE=05 and Aberdeen
});
test('revenue avg = sum(RCPT*1000)/sum(FIRM)', () => {
  const rows = filterSusbRows(SAMPLE, { msaCode: '36740', def: CATEGORY_DEFS.find((d) => d.category === 'Laundromat') });
  const r = deriveRevenueAvg(rows); // (150+130+140)*1000 / (300+120+80) = 420000/500
  assert.equal(r.avg, 840);
  assert.equal(r.firms, 500);
});
test('sector-prefix matching covers Retail subsectors', () => {
  const retailDef = CATEGORY_DEFS.find((d) => d.category === 'Retail');
  const rows = filterSusbRows(SAMPLE, { msaCode: '36740', def: retailDef });
  assert.equal(rows.length, 0); // fixture has no retail rows; proves no crash
  assert.ok(categoryMatches(retailDef, '445'));
  assert.ok(categoryMatches(retailDef, '459'));
  assert.ok(!categoryMatches(retailDef, '722'));
});
test('suppressed row makes category fall back', () => {
  const rows = SAMPLE.filter((r) => r.naics === '238');
  assert.deepEqual(deriveRevenueAvg(rows), { suppressed: true });
});

function sheetFrom(aoa) {
  return XLSX.utils.sheet_to_json(XLSX.utils.aoa_to_sheet(aoa), { header: 1 });
}

const HEADERS = ['State', 'NAICS', 'Industry Description', 'Number of Returns', 'Gross Receipts ($)', 'Net Income ($)'];
const ROWS = [
  HEADERS,
  ['FL', 812, 'Personal & Laundry Services', 1000, 1000000, 256000],
  ['FL', 813, 'Other Services', 500, 400000, 100000],
  ['TX', 812, 'Personal & Laundry Services', 2000, 3000000, 750000],
];

test('margin = net income / receipts for state+naics', () => {
  const r = deriveIrsMargin(sheetFrom(ROWS), 'FL', (nc) => nc === '812');
  assert.equal(Math.round(r.margin * 10000) / 10000, 0.256);
});
test('retail-style multi-subsector predicate aggregates before dividing', () => {
  const retail = sheetFrom([
    HEADERS,
    ['FL', 441, 'Auto Dealers', 10, 500000, 25000],
    ['FL', 445, 'Grocery', 10, 500000, 50000],
    ['FL', 722, 'Food Svcs', 10, 999999, 99999],
  ]);
  const r = deriveIrsMargin(retail, 'FL', (nc) => /^(44|45)/.test(nc));
  assert.equal(Math.round(r.margin * 10000) / 10000, 0.075); // 75k/1M
});
test('allIndustries aggregates every NAICS for the state', () => {
  const r = deriveIrsMargin(sheetFrom(ROWS), 'FL', () => true, { allIndustries: true });
  // (256000+100000) net / (1000000+400000) receipts = 356000/1400000
  assert.equal(Math.round(r.margin * 10000) / 10000, 0.2543);
});
test('suppressed numeric cells force fallback', () => {
  const bad = sheetFrom([HEADERS, ['FL', 812, 'x', 5, '', '']]);
  assert.deepEqual(deriveIrsMargin(bad, 'FL', (nc) => nc === '812'), { suppressed: true });
});
test('state with no matching rows -> suppressed', () => {
  assert.deepEqual(deriveIrsMargin(sheetFrom(ROWS), 'WY', (nc) => nc === '812'), { suppressed: true });
});

const SUSBFIXTURE = SAMPLE;
const NAT_WITH_KEYWORDS = [
  { category: 'Laundromat', sde_multiple_min: 3.0, sde_multiple_max: 4.5, typical_sde_margin: '20-30% of gross revenue',
    keywords: ['laundry'], revenue_benchmark: { avg: 321000 }, sde_benchmark: { avg: 82000 } },
  { category: 'Car Wash', sde_multiple_min: 3.0, sde_multiple_max: 4.0, typical_sde_margin: '25-35% of gross revenue',
    keywords: ['carwash'], revenue_benchmark: { avg: 459000 }, sde_benchmark: { avg: 106000 } },
  { category: 'HVAC', sde_multiple_min: 2.5, sde_multiple_max: 3.5, typical_sde_margin: '10-20% of gross revenue',
    keywords: ['insulation', 'drywall', 'heating'], revenue_benchmark: { avg: 921000 }, sde_benchmark: { avg: 138000 } },
  { category: 'Plumbing', sde_multiple_min: 2.5, sde_multiple_max: 3.5, typical_sde_margin: '10-20% of gross revenue',
    keywords: [], revenue_benchmark: { avg: 921000 }, sde_benchmark: { avg: 138000 } },
  { category: 'Commercial Cleaning', sde_multiple_min: 2.0, sde_multiple_max: 3.0, typical_sde_margin: '15-25% of gross revenue',
    keywords: ['janitorial', 'maid'], revenue_benchmark: { avg: 383000 }, sde_benchmark: { avg: 86000 } },
  { category: 'Auto Repair', sde_multiple_min: 2.5, sde_multiple_max: 3.5, typical_sde_margin: '10-20% of gross revenue',
    keywords: ['automotive', 'mechanic'], revenue_benchmark: { avg: 677000 }, sde_benchmark: { avg: 157000 } },
  { category: 'Retail', sde_multiple_min: 2.0, sde_multiple_max: 3.0, typical_sde_margin: '5-15% of gross revenue',
    keywords: ['shop', 'store'], notes: 'chain-heavy — verify unit-level economics, not brand averages',
    revenue_benchmark: { avg: 1562000 }, sde_benchmark: { avg: 120000 } },
  { category: 'Food Service', sde_multiple_min: 1.5, sde_multiple_max: 2.5, typical_sde_margin: '10-20% of gross revenue',
    keywords: ['food', 'restaurant', 'cafe', 'catering', 'bar'], revenue_benchmark: { avg: 579000 }, sde_benchmark: { avg: 31000 } },
  { category: 'General Main Street', sde_multiple_min: 2.0, sde_multiple_max: 3.2, typical_sde_margin: '10-25% of gross revenue',
    keywords: [], revenue_benchmark: { avg: 550000 }, sde_benchmark: { avg: 108000 } },
];
const ORLANDO = { name: 'Orlando, FL', code: '36740' };
const ROWS_NAMED = ROWS.map((r) => (r[0] === 'FL' ? ['FLORIDA', ...r.slice(1)] : r));

test('buildDoc produces schema-complete doc with provenance', () => {
  const doc = _internals.buildDoc({
    susbRows: SUSBFIXTURE.filter((r) => r.msa === '36740'),
    irsRows: sheetFrom(ROWS),
    metro: ORLANDO,
    state: 'FL',
    nationalDoc: { benchmarks: NAT_WITH_KEYWORDS },
  });
  assert.equal(doc.meta.primary_metro, 'Orlando, FL');
  assert.equal(doc.benchmarks.length, 9);
  for (const b of doc.benchmarks) {
    assert.ok(b.revenue_benchmark.scope);
    assert.ok('fallback_reason' in b.revenue_benchmark);
    assert.ok('fallback_reason' in b.sde_benchmark);
  }
});

test('buildDoc passes through national notes and omits the key when absent', () => {
  const doc = buildDoc({
    susbRows: SUSBFIXTURE.filter((r) => r.msa === '36740'),
    irsRows: sheetFrom(ROWS),
    metro: ORLANDO,
    state: 'FL',
    nationalDoc: { benchmarks: NAT_WITH_KEYWORDS },
  });
  const retail = doc.benchmarks.find((b) => b.category === 'Retail');
  assert.equal(retail.notes, 'chain-heavy — verify unit-level economics, not brand averages');
  const laundromat = doc.benchmarks.find((b) => b.category === 'Laundromat');
  assert.ok(!('notes' in laundromat));
});
test('buildDoc calibrates Laundromat end-to-end (SUSB avg x IRS FL margin)', () => {
  const doc = buildDoc({
    susbRows: SUSBFIXTURE.filter((r) => r.msa === '36740'),
    irsRows: sheetFrom(ROWS_NAMED),
    metro: ORLANDO,
    state: 'FL',
    nationalDoc: { benchmarks: NAT_WITH_KEYWORDS },
  });
  const lau = doc.benchmarks.find((b) => b.category === 'Laundromat');
  assert.equal(lau.naics_3digit.join(','), '812');
  assert.equal(lau.revenue_benchmark.avg, 840); // fixture math from Task 5
  assert.equal(lau.revenue_benchmark.sample_firms, 500);
  assert.ok(lau.revenue_benchmark.scope.includes('Orlando'));
  assert.equal(lau.sde_benchmark.avg, Math.round(840 * 0.256)); // 215
  assert.equal(lau.sde_benchmark.fallback_reason, null);
  assert.equal(doc.meta.msa_code, 36740);
  assert.deepEqual(doc.meta.states, ['FL']);
  assert.equal(doc.meta.generator, 'build-benchmarks.mjs');
  assert.ok(doc.meta.sources.revenue.url && doc.meta.sources.margin.url);
});
test('hybrid overlay: national revenue x local margin when MSA revenue suppressed', () => {
  const carWashIrs = sheetFrom([HEADERS, ['FLORIDA', 811, 'Car Washes', 100, 200000, 50000]]);
  const doc = _internals.buildDoc({
    susbRows: SUSBFIXTURE.filter((r) => r.msa === '36740'),
    irsRows: carWashIrs,
    metro: ORLANDO,
    state: 'FL',
    nationalDoc: { benchmarks: NAT_WITH_KEYWORDS },
  });
  const cw = doc.benchmarks.find((b) => b.category === 'Car Wash');
  assert.equal(cw.revenue_benchmark.avg, 459000); // national fallback
  assert.ok(cw.revenue_benchmark.fallback_reason);
  assert.equal(cw.sde_benchmark.avg, Math.round(459000 * 0.25)); // local margin on national revenue
  assert.equal(cw.sde_benchmark.fallback_reason, 'revenue fell back to national');
});
test('missing IRS data degrades margins to national without crashing', () => {
  const doc = buildDoc({
    susbRows: SUSBFIXTURE.filter((r) => r.msa === '36740'),
    irsRows: null,
    metro: ORLANDO,
    state: 'FL',
    nationalDoc: { benchmarks: NAT_WITH_KEYWORDS },
  });
  const lau = doc.benchmarks.find((b) => b.category === 'Laundromat');
  assert.equal(lau.revenue_benchmark.avg, 840); // revenue still local
  assert.equal(lau.sde_benchmark.avg, 82000); // national SDE
  assert.equal(lau.sde_benchmark.fallback_reason, 'IRS data unavailable');
});

// Real 22sp01st.xlsx encodings (Task 8 smoke): full state names, 6-digit NAICS,
// lowercase-'d' suppression markers, native negative numbers.
const REAL_HEADERS = ['NAICS code [1]', 'Industrial sector, subsector, and group', 'FIPS code [2]', 'State',
  'Number of Schedules C [3]', 'Gross receipts or sales minus returns and allowances, page 1, line 3',
  'Cost of goods sold, page 1, line 4', 'Gross income, page 1, line 7',
  'Depreciation and section 179 expense deduction, page 1, line 13', 'Total expenses, page 1, line 28',
  'Expenses for business use of home, page 1, line 30', 'Net profit or (loss), page 1, line 31'];
const REAL_FL_ROWS = [
  REAL_HEADERS,
  ['238000', 'Specialty Trade Contractors', '12000', 'FLORIDA', 114994, 7362504758, 1990689977, 5420864351,
    284725025, 4132948332, 23868423, 1264047596],
  ['812000', 'Personal and Laundry Services', '12000', 'FLORIDA', 311903, 7924686755, 750050256, 7281382841,
    291535955, 5178679732, 39160738, 2063542371],
  ['811000', 'Repair and Maintenance', '12000', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd'],
];
test('buildDoc handles real-workbook encodings (state names, 6-digit NAICS, d-markers)', () => {
  const doc = buildDoc({
    susbRows: SUSBFIXTURE.filter((r) => r.msa === '36740'),
    irsRows: sheetFrom(REAL_FL_ROWS),
    metro: ORLANDO,
    state: 'FL',
    nationalDoc: { benchmarks: NAT_WITH_KEYWORDS },
  });
  const lau = doc.benchmarks.find((b) => b.category === 'Laundromat');
  const lauMargin = 2063542371 / 7924686755;
  assert.ok(String(lau.sde_benchmark.scope).includes(`${(lauMargin * 100).toFixed(1)}%`));
  assert.equal(lau.sde_benchmark.avg, Math.round(840 * lauMargin)); // local FL margin on Orlando revenue
  assert.equal(lau.sde_benchmark.fallback_reason, null);
  const hvac = doc.benchmarks.find((b) => b.category === 'HVAC'); // naics3 def over 6-digit '238000'
  assert.equal(hvac.sde_benchmark.avg, Math.round(921000 * (1264047596 / 7362504758)));
});
test('toIrsStateLabel maps postal codes and passes through names', () => {
  assert.equal(toIrsStateLabel('FL'), 'FLORIDA');
  assert.equal(toIrsStateLabel('tx'), 'TEXAS');
  assert.equal(toIrsStateLabel('FLORIDA'), 'FLORIDA');
  assert.equal(toIrsStateLabel(''), '');
});
test('non-positive statewide margins fall back to national; positives stay local', () => {
  const mixedIrs = sheetFrom([
    REAL_HEADERS,
    ['812000', 'Personal and Laundry Services', '12000', 'FLORIDA', 300, 1000000, 0, 1000000, 0, 900000, 0, -100000],
    ['811000', 'Repair and Maintenance', '12000', 'FLORIDA', 100, 200000, 0, 200000, 0, 150000, 0, 50000],
  ]);
  const doc = buildDoc({
    susbRows: SUSBFIXTURE.filter((r) => r.msa === '36740'),
    irsRows: mixedIrs,
    metro: ORLANDO,
    state: 'FL',
    nationalDoc: { benchmarks: NAT_WITH_KEYWORDS },
  });
  const lau = doc.benchmarks.find((b) => b.category === 'Laundromat'); // 840 x -10% => non-positive
  assert.equal(lau.revenue_benchmark.avg, 840); // revenue stays local
  assert.ok(!lau.revenue_benchmark.fallback_reason);
  assert.equal(lau.sde_benchmark.avg, 82000); // national fallback
  assert.equal(lau.sde_benchmark.scope, 'US (IRS SOI, national)');
  assert.equal(lau.sde_benchmark.fallback_reason,
    'non-positive statewide margin (-10.0%) — sector aggregate loss');
  const cw = doc.benchmarks.find((b) => b.category === 'Car Wash'); // 459000 x +25% still localizes
  assert.equal(cw.sde_benchmark.avg, Math.round(459000 * 0.25));
  assert.equal(cw.sde_benchmark.fallback_reason, 'revenue fell back to national');
});
