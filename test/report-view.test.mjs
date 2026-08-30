import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { load as yamlLoad } from 'js-yaml';
import {
  parseYamlFooter,
  extractBlocks,
  matchBenchmark,
  mdToHtml,
  scoreGauge,
  valuationBand,
  benchmarkComparison,
  industryBenchmarkPanel,
  renderReportPage,
  renderArtifactPage,
  findArtifacts,
  escapeHtml,
} from '../lib/report-view.mjs';

const SAMPLE_REPORT = `# 001 — Alpha Laundromat — Evaluation Report

**Date:** 2026-08-22
**Listing URL:** https://example.com/listing/12345

## Block A — Business & Deal Summary

**TL;DR:** Solid laundromat with long lease.

| Metric | Value |
|---|---|
| Asking Price | $450,000 |
| Cash Flow (SDE) | $160,000 |

- Customer concentration >15%? **No**
- Lease <1 year? **No**

---

## Block B — Financial Analysis

### Multiple Calculation

\`\`\`
Multiple = 450000 / 160000 = 2.8x
\`\`\`

Adjusted SDE is **supported** by the add-back audit.

\`\`\`yaml
---
bizbuybot:
  business_name: "Alpha Laundromat"
  asking_price: 450000
  revenue: 800000
  sde: 160000
  multiple: 2.8
  score: 4.4
  risk_tier: "High Confidence"
  archetype: "Laundromat"
  recommended_action: "Pursue"
  key_risks:
    - "Equipment age unknown"
    - "Single location"
  financing_fit: "Strong"
---
\`\`\`
`;

const BENCHMARKS = [
  { category: 'Laundromat', sde_multiple_min: 3.0, sde_multiple_max: 4.5 },
  { category: 'HVAC', sde_multiple_min: 2.5, sde_multiple_max: 3.5 },
  { category: 'General Main Street', sde_multiple_min: 2.0, sde_multiple_max: 3.2 },
];

test('parseYamlFooter extracts the bizbuybot object', () => {
  const footer = parseYamlFooter(SAMPLE_REPORT);
  assert.ok(footer);
  assert.equal(footer.business_name, 'Alpha Laundromat');
  assert.equal(footer.score, 4.4);
  assert.deepEqual(footer.key_risks, ['Equipment age unknown', 'Single location']);
});

test('parseYamlFooter tolerates an unfenced footer (missing ```yaml)', () => {
  const unfenced = SAMPLE_REPORT.replace(/```yaml\s*\n---/, '---').replace(/\n---\n```\s*$/, '\n---');
  const footer = parseYamlFooter(unfenced);
  assert.ok(footer, 'bare --- document markers should parse');
  assert.equal(footer.business_name, 'Alpha Laundromat');
  assert.equal(footer.score, 4.4);
});

test('parseYamlFooter returns null when no yaml footer', () => {
  assert.equal(parseYamlFooter('# no footer'), null);
});

test('parseYamlFooter parses a real generated report (regression)', () => {
  const reportsDir = path.join(import.meta.dirname, '..', 'reports');
  const files = fs.existsSync(reportsDir)
    ? fs.readdirSync(reportsDir).filter((f) => f.endsWith('.md') && /^\d{3}-/.test(f) && !f.includes('dd-checklist') && !f.includes('outreach') && !f.includes('loi'))
    : [];
  if (files.length === 0) return; // no real reports yet — nothing to regression-test
  const md = fs.readFileSync(path.join(reportsDir, files[0]), 'utf-8');
  const footer = parseYamlFooter(md);
  assert.ok(footer, `should parse yaml footer of ${files[0]}`);
  assert.ok(footer.business_name || footer.score !== undefined, 'footer has structured fields');
});

test('extractBlocks splits on ## headers', () => {
  const blocks = extractBlocks(SAMPLE_REPORT);
  assert.equal(blocks.length, 2);
  assert.match(blocks[0].title, /Block A/);
  assert.match(blocks[1].title, /Block B/);
  // Block A body should not contain Block B content
  assert.ok(!blocks[0].body.includes('Multiple Calculation'));
  // yaml block is excluded (it lives inside Block B's fence)
});

test('matchBenchmark matches by keyword overlap', () => {
  assert.equal(matchBenchmark(BENCHMARKS, 'Laundromats and Dry Cleaners').category, 'Laundromat');
  assert.equal(matchBenchmark(BENCHMARKS, 'HVAC Services').category, 'HVAC');
});

test('matchBenchmark falls back to General Main Street', () => {
  const fallback = matchBenchmark(BENCHMARKS, 'Dumpster Rental');
  assert.equal(fallback.category, 'General Main Street');

  const empty = matchBenchmark(BENCHMARKS, '');
  assert.equal(empty.category, 'General Main Street');
});

test('mdToHtml renders bold, tables, lists, code fences', () => {
  const html = mdToHtml(
    '**bold** and *em*\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- item one\n- item two\n\n```\ncode here\n```',
  );
  assert.ok(html.includes('<strong>bold</strong>'));
  assert.ok(html.includes('<em>em</em>'));
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<li>item one</li>'));
  assert.ok(html.includes('<pre><code>code here'));
});

test('mdToHtml escapes raw html', () => {
  const html = mdToHtml('hello <script>alert(1)</script>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('mdToHtml renders blockquote lines as callouts', () => {
  const html = mdToHtml('> **Priority — flagged risk:** Inspect the lease.\n> Focus on items A3, A7.');
  assert.ok(html.includes('<blockquote>'));
  assert.ok(html.includes('<strong>Priority — flagged risk:</strong>'));
  assert.ok(html.includes('Inspect the lease.'));
  assert.ok(!html.includes('&gt;'), 'quote marker must not leak as escaped text');
});

test('mdToHtml ends a blockquote at a blank line', () => {
  const html = mdToHtml('> quoted line\n\nplain paragraph');
  assert.ok(html.includes('<blockquote>quoted line</blockquote>'));
  assert.ok(html.includes('plain paragraph'));
});

test('scoreGauge renders svg with the score value', () => {
  const svg = scoreGauge(4.4);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('4.4'));
  // clamps out-of-range scores
  assert.ok(scoreGauge(9).includes('5.0'));
});

test('valuationBand shows multiple position vs benchmark', () => {
  const svg = valuationBand(2.8, BENCHMARKS[0]);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('benchmark 3.0x–4.5x'));
  assert.ok(svg.includes('2.8x')); // marker label
});

test('renderReportPage produces full page with charts and sections', () => {
  const deal = {
    id: '001',
    date: '2026-08-22',
    business: 'Alpha Laundromat',
    category: 'Laundromat',
    location: 'Austin, TX',
    askingPrice: '$450,000',
    sde: '$160,000',
    multiple: '2.8x',
    score: '4.4/5',
    status: 'Evaluated',
    report: 'reports/001-alpha.md',
    url: 'https://example.com/listing',
    notes: '',
  };
  const html = renderReportPage({ deal, reportMd: SAMPLE_REPORT, benchmarks: BENCHMARKS });

  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('Alpha Laundromat'));
  assert.ok(html.includes('<svg')); // gauge + band
  assert.ok(html.includes('Key Risks'));
  assert.ok(html.includes('Equipment age unknown'));
  assert.ok(html.includes('Block A — Business &amp; Deal Summary'));
  assert.ok(html.includes('$450,000'));
  assert.ok(html.includes('benchmark 3.0x–4.5x'));
  assert.ok(html.includes('High Confidence'));
  assert.ok(html.includes('/deal/') === false); // no self links needed
});

test('renderReportPage shows the listing URL at the top', () => {
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: SAMPLE_REPORT, benchmarks: BENCHMARKS });
  assert.ok(html.includes('View original listing'));
  assert.ok(html.includes('https://example.com/listing'));
  assert.ok(html.includes('listing-url'));
});

test('escapeHtml neutralizes injection', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

const EST_REPORT = SAMPLE_REPORT.replace(
  '**TL;DR:** Solid laundromat with long lease.',
  '**TL;DR:** Solid laundromat with long lease. SDE was not disclosed by the seller; Cash Flow (SDE) is a provisional estimate based on a 20% margin.',
);

const DEAL_FIXTURE = {
  id: '001', date: '2026-08-22', business: 'Alpha Laundromat', category: 'Laundromat',
  location: 'Austin, TX', askingPrice: '$450,000', sde: '$160,000', multiple: '2.8x',
  score: '4.4/5', status: 'Evaluated', report: 'reports/001-alpha.md', url: '', notes: '',
};

test('metric cards flag estimated SDE detected from report prose', () => {
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: EST_REPORT, benchmarks: BENCHMARKS });
  assert.ok(html.includes('≈ $160,000'));
  assert.ok(html.includes('estimated'));
  // Multiple derives from SDE, so it is flagged too
  const multCard = html.match(/<div class="card-value est"[^>]*>≈ 2\.8x[^<]*<span class="est-chip"/);
  assert.ok(multCard, 'multiple card should be flagged when SDE is estimated');
  // Asking price is never estimated
  assert.ok(!html.includes('≈ $450,000'));
});

test('explicit footer flags mark estimates without prose heuristics', () => {
  const flagged = SAMPLE_REPORT.replace(
    '  financing_fit: "Strong"',
    '  financing_fit: "Strong"\n  revenue_estimated: true',
  );
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: flagged, benchmarks: BENCHMARKS });
  assert.ok(html.includes('≈ $800K') || /Gross Revenue[\s\S]*?≈ \$800,000/.test(html), 'revenue card flagged via footer flag');
});

test('renderReportPage shows an EBITDA card when the footer discloses EBITDA', () => {
  const withEbitda = SAMPLE_REPORT.replace(
    '  financing_fit: "Strong"',
    '  financing_fit: "Strong"\n  ebitda: 120000',
  );
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: withEbitda, benchmarks: BENCHMARKS });
  assert.ok(html.includes('EBITDA'), 'EBITDA card rendered');
  assert.ok(html.includes('$120,000'), 'EBITDA value formatted');
});

test('renderReportPage omits the EBITDA card when the footer does not disclose EBITDA', () => {
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: SAMPLE_REPORT, benchmarks: BENCHMARKS });
  assert.ok(!html.includes('EBITDA'), 'no EBITDA card without a disclosed figure');
});

test('renderReportPage flags an estimated EBITDA from the footer flag', () => {
  const est = SAMPLE_REPORT.replace(
    '  financing_fit: "Strong"',
    '  financing_fit: "Strong"\n  ebitda: 120000\n  ebitda_estimated: true',
  );
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: est, benchmarks: BENCHMARKS });
  assert.ok(html.includes('≈ $120,000'), 'EBITDA card marked as estimate');
  assert.ok(html.includes('>estimated</span>'), 'estimate chip shown');
});

test('clean reports show no estimate markers', () => {
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: SAMPLE_REPORT, benchmarks: BENCHMARKS });
  assert.ok(!html.includes('card-value est'));
  assert.ok(!html.includes('>estimated</span>'));
  assert.ok(!html.includes('≈ $160,000'));
});

test('unverified/claimed SDE language triggers estimate flag (deal 003 pattern)', () => {
  const unverified = SAMPLE_REPORT.replace(
    '**TL;DR:** Solid laundromat with long lease.',
    '**TL;DR:** Solid laundromat with long lease.\n\n- **No financial documentation** — SDE and revenue claims are unverified. Must request P&L, tax returns, and bank statements before proceeding.',
  );
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: unverified, benchmarks: BENCHMARKS });
  assert.ok(html.includes('≈ $160,000'), 'SDE card should be flagged');
  assert.ok(html.includes('≈ $800,000'), 'revenue card should be flagged');
  assert.ok(html.includes('≈ 2.8x'), 'multiple card should be flagged via SDE');
});

test('disclosed SDE with verified financials is not flagged', () => {
  const verified = SAMPLE_REPORT.replace(
    '**TL;DR:** Solid laundromat with long lease.',
    '**TL;DR:** Solid laundromat with long lease. Seller provided three years of reviewed financials; SDE was verified against tax returns.',
  );
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: verified, benchmarks: BENCHMARKS });
  assert.ok(!html.includes('card-value est'));
});

const FULL_BENCH = {
  category: 'Laundromat',
  sde_multiple_min: 3.0,
  sde_multiple_max: 4.5,
  revenue_benchmark: { avg: 321000 },
  sde_benchmark: { avg: 82000 },
};

test('benchmarkComparison renders strip with this business and sourced reference', () => {
  const svg = benchmarkComparison('Gross Revenue', 800000, [
    { label: 'Census avg revenue *', value: 321000 },
  ]);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('$800K'));
  assert.ok(svg.includes('$321K'));
  assert.ok(svg.includes('This Business'));
  assert.ok(svg.includes('Census avg revenue'));
});

test('benchmarkComparison skips missing this-value', () => {
  const svg = benchmarkComparison('Cash Flow (SDE)', null, [
    { label: 'SDE @ IRS net margin *', value: 82000 },
  ]);
  assert.equal(svg, '');
});

test('benchmarkComparison returns empty when no usable values', () => {
  assert.equal(benchmarkComparison('X', null, []), '');
});

test('industryBenchmarkPanel renders revenue and SDE comparisons', () => {
  const html = industryBenchmarkPanel(FULL_BENCH, { revenue: 800000, sde: 160000 });
  assert.ok(html.includes('Industry Benchmarks — Laundromat'));
  assert.ok(html.includes('Gross Revenue'));
  assert.ok(html.includes('Cash Flow (SDE)'));
  assert.ok(html.includes('$160K'));
  assert.ok(html.includes('Census avg revenue'));
  assert.ok(html.includes('SDE @ IRS net margin'));
  assert.ok(html.includes('US Census SUSB 2022'));
  assert.ok(html.includes('IRS SOI'));
});

test('industryBenchmarkPanel skips strips with undisclosed deal values', () => {
  const html = industryBenchmarkPanel(FULL_BENCH, { revenue: null, sde: 160000 });
  assert.ok(html.includes('Cash Flow (SDE)'));
  assert.ok(!html.includes('Gross Revenue'));
});

test('industryBenchmarkPanel empty without benchmark or values', () => {
  assert.equal(industryBenchmarkPanel(null, { revenue: 1, sde: 2 }), '');
  assert.equal(industryBenchmarkPanel(FULL_BENCH, { revenue: null, sde: null }), '');
});

// ===== deal artifacts (dd checklist, loi, outreach) =====

test('findArtifacts discovers artifacts by deal id, oldest-safe suffix match', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizbuybot-art-'));
  fs.writeFileSync(path.join(dir, '001-dd-checklist.md'), '# DD');
  fs.writeFileSync(path.join(dir, '001-loi.md'), '# LOI');
  fs.writeFileSync(path.join(dir, '003-outreach.md'), '# OUT');
  fs.writeFileSync(path.join(dir, '002-eval-report.md'), '# eval'); // eval reports never matched
  fs.writeFileSync(path.join(dir, '001-dd-checklist.backup.md'), 'x'); // wrong suffix
  const found = findArtifacts(dir, '001');
  assert.deepEqual(found.map((a) => a.kind), ['dd', 'loi']);
  assert.equal(found[0].label, 'Due Diligence Checklist');
  assert.equal(found[0].file, '001-dd-checklist.md');
  assert.equal(found[1].label, 'Letter of Intent');
});

test('findArtifacts maps outreach suffix and label', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizbuybot-art-'));
  fs.writeFileSync(path.join(dir, '007-outreach.md'), '# OUT');
  const found = findArtifacts(dir, '007');
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'outreach');
  assert.equal(found[0].label, 'Broker Outreach');
});

test('findArtifacts returns empty for missing dir or id with no artifacts', () => {
  assert.deepEqual(findArtifacts(path.join(os.tmpdir(), 'does-not-exist'), '001'), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizbuybot-art-'));
  fs.writeFileSync(path.join(dir, '099-loi.md'), '# x');
  assert.deepEqual(findArtifacts(dir, '005'), []);
});

test('renderArtifactPage renders a styled page with back link and rendered markdown', () => {
  const html = renderArtifactPage({
    deal: { id: '001', business: 'Alpha Laundromat' },
    kind: 'dd',
    label: 'Due Diligence Checklist',
    file: '001-dd-checklist.md',
    md: '# Due Diligence Checklist\n\n> **Priority:** Equipment audit.\n\n### A1. Financial statements',
  });
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('Due Diligence Checklist — Alpha Laundromat (Deal 001)'));
  assert.ok(html.includes('href="/deal/001"'), 'back link to deal page');
  assert.ok(html.includes('<blockquote>'), 'markdown rendered through mdToHtml');
  assert.ok(html.includes('A1. Financial statements'));
  assert.ok(html.includes('001-dd-checklist.md'), 'raw markdown link present');
});

test('renderReportPage shows artifact subnav when artifacts exist', () => {
  const artifacts = [
    { kind: 'dd', label: 'Due Diligence Checklist', file: '001-dd-checklist.md' },
    { kind: 'loi', label: 'Letter of Intent', file: '001-loi.md' },
  ];
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: SAMPLE_REPORT, benchmarks: BENCHMARKS, artifacts });
  assert.ok(html.includes('class="artifactnav"'));
  assert.ok(html.includes('href="/deal/001/dd">Due Diligence Checklist</a>'));
  assert.ok(html.includes('href="/deal/001/loi">Letter of Intent</a>'));
});

test('renderReportPage omits artifact subnav when none exist', () => {
  const html = renderReportPage({ deal: DEAL_FIXTURE, reportMd: SAMPLE_REPORT, benchmarks: BENCHMARKS });
  assert.ok(!html.includes('class="artifactnav"'));
});

describe('matchBenchmark regressions', () => {
  const BENCHES = [
    { category: 'Laundromat', keywords: ['laundry'] },
    { category: 'Car Wash', keywords: ['carwash'] },
    { category: 'HVAC', keywords: ['insulation', 'drywall', 'heating'] },
    { category: 'Plumbing', keywords: [] },
    { category: 'Commercial Cleaning', keywords: ['janitorial', 'maid'] },
    { category: 'Auto Repair', keywords: ['automotive', 'mechanic'] },
    { category: 'Retail', keywords: ['shop', 'store'] },
    { category: 'Food Service', keywords: ['food', 'restaurant', 'cafe', 'catering', 'bar'] },
    { category: 'General Main Street', keywords: [] },
  ];

  test('Insulation Services matches HVAC, never Food Service', () => {
    assert.equal(matchBenchmark(BENCHES, 'Insulation Services').category, 'HVAC');
  });
  test('Food Service listing still matches Food Service', () => {
    assert.equal(matchBenchmark(BENCHES, 'Food Service').category, 'Food Service');
  });
  test('Restaurant matches Food Service via keyword', () => {
    assert.equal(matchBenchmark(BENCHES, 'Restaurant').category, 'Food Service');
  });
  test('Janitorial Services matches Commercial Cleaning', () => {
    assert.equal(matchBenchmark(BENCHES, 'Janitorial Services').category, 'Commercial Cleaning');
  });
  test('Landscaping falls back to General Main Street', () => {
    assert.equal(matchBenchmark(BENCHES, 'Landscaping (200+ Accounts)').category, 'General Main Street');
  });
  test('Waste Management falls back to General Main Street', () => {
    assert.equal(matchBenchmark(BENCHES, 'Waste Management').category, 'General Main Street');
  });
  test('plural tokens singularize: Laundromats matches', () => {
    assert.equal(matchBenchmark(BENCHES, 'Laundromats').category, 'Laundromat');
  });
  test('null benchmarks returns null', () => {
    assert.equal(matchBenchmark(null, 'HVAC'), null);
  });
});

test('every shipped benchmark entry declares keywords', () => {
  const doc = yamlLoad(fs.readFileSync(new URL('../templates/benchmarks.yml', import.meta.url), 'utf8'));
  for (const b of doc.benchmarks) {
    if (/general/i.test(b.category)) continue;
    assert.ok(Array.isArray(b.keywords), `${b.category} missing keywords`);
  }
});

const LOCAL_BENCH = {
  category: 'Retail',
  sde_multiple_min: 2,
  sde_multiple_max: 3,
  revenue_benchmark: { avg: 1258070, scope: 'Orlando, FL (SUSB 2022)' },
  sde_benchmark: { avg: 120000, scope: 'US (IRS SOI, national)', fallback_reason: 'non-positive statewide margin (-9.1%) — sector aggregate loss' },
};

const LEGACY_FOOTER_HTML =
  '<p class="bench-note">* national reference points: US Census SUSB 2022 (avg receipts per firm, &lt;20 employees) · IRS SOI sole-proprietorship net margins. SDE reference = avg revenue × industry net margin. Directional only — verify in due diligence.</p>';

test('industryBenchmarkPanel renders scope-aware footer with fallback disclosure', () => {
  const html = industryBenchmarkPanel(LOCAL_BENCH, { revenue: 900000, sde: 100000 });
  assert.ok(html.includes('revenue: Orlando, FL (SUSB 2022)'), 'revenue scope segment');
  assert.ok(html.includes('margin: US (IRS SOI, national)'), 'margin scope segment');
  assert.ok(
    html.includes('SDE: national fallback — non-positive statewide margin (-9.1%) — sector aggregate loss'),
    'SDE fallback disclosure',
  );
  assert.ok(!html.includes('* national reference points'), 'national claim replaced');
  // scope segments joined compactly, in metric order
  assert.ok(html.includes('revenue: Orlando, FL (SUSB 2022) · margin: US (IRS SOI, national)'));
});

test('industryBenchmarkPanel keeps legacy national footer byte-identical without scopes', () => {
  const html = industryBenchmarkPanel(FULL_BENCH, { revenue: 800000, sde: 160000 });
  assert.ok(html.includes(LEGACY_FOOTER_HTML), 'exact legacy footer bytes preserved');
  assert.ok(!html.includes('bench-fallback'), 'no fallback disclosure for national shape');
});

test('industryBenchmarkPanel escapes scope and fallback interpolations', () => {
  const evil = {
    category: 'Laundromat',
    revenue_benchmark: { avg: 321000, scope: 'Evil <b>&</b> MSA' },
    sde_benchmark: { avg: 82000, fallback_reason: 'suppressed <img src=x>' },
  };
  const html = industryBenchmarkPanel(evil, { revenue: 800000, sde: 160000 });
  assert.ok(html.includes('Evil &lt;b&gt;&amp;&lt;/b&gt; MSA'), 'scope escaped');
  assert.ok(html.includes('SDE: national fallback — suppressed &lt;img src=x&gt;'), 'fallback escaped');
  assert.ok(!html.includes('<img src=x>'), 'raw markup never emitted');
});
