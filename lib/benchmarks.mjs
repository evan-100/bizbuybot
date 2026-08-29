import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';

const STOPWORDS = new Set(['services', 'service', 'business', 'general', 'company', 'center']);

export function tokenizeCategory(s) {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 3 && t.length <= 40)
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
    .filter(Boolean);
}

function entryKeys(entry) {
  const nameWords = tokenizeCategory(entry.category).filter((w) => !STOPWORDS.has(w));
  const kws = tokenizeCategory((entry.keywords || []).join(' '));
  return new Set([...nameWords, ...kws]);
}

export function matchBenchmark(benchmarks, category) {
  if (!benchmarks || !Array.isArray(benchmarks)) return null;
  const tokens = new Set(tokenizeCategory(category));
  let fallback = null;
  for (const b of benchmarks) {
    if (/general/i.test(String(b.category || ''))) { fallback = b; continue; }
    const keys = entryKeys(b);
    for (const k of keys) if (tokens.has(k)) return b;
  }
  return fallback;
}

export function loadBenchmarks(root) {
  const readYaml = (p) => {
    try { return { doc: yamlLoad(fs.readFileSync(p, 'utf8')) }; }
    catch (e) { return { error: e }; }
  };
  const localPath = path.join(root, 'data', 'local-benchmarks.yml');
  if (fs.existsSync(localPath)) {
    const { doc, error } = readYaml(localPath);
    if (doc?.benchmarks) return { source: 'local', meta: doc.meta || null, benchmarks: doc.benchmarks };
    return { source: 'national', meta: null, benchmarks: loadNational(root), warning: `malformed ${localPath}: ${error}` };
  }
  const nat = loadNational(root);
  return nat ? { source: 'national', meta: null, benchmarks: nat } : { source: 'none', meta: null, benchmarks: null };
}

function loadNational(root) {
  const p = path.join(root, 'templates', 'benchmarks.yml');
  if (!fs.existsSync(p)) return null;
  try { return yamlLoad(fs.readFileSync(p, 'utf8')).benchmarks ?? null; } catch { return null; }
}

export const CATEGORY_DEFS = [
  { category: 'Laundromat', naics3: ['812'] },
  { category: 'Car Wash', naics3: ['811'] },
  { category: 'HVAC', naics3: ['238'] },
  { category: 'Plumbing', naics3: ['238'] },
  { category: 'Commercial Cleaning', naics3: ['561'] },
  { category: 'Auto Repair', naics3: ['811'] },
  { category: 'Retail', sectorPrefixes: ['44', '45'], retailSum: true },
  { category: 'Food Service', naics3: ['722'] },
  { category: 'General Main Street', sectorPrefixes: ['81'], generalAll: true },
];

export function categoryMatches(def, naics) {
  if (def.naics3 && def.naics3.includes(naics)) return true;
  if (def.sectorPrefixes && def.sectorPrefixes.some((p) => naics.startsWith(p))) return true;
  return false;
}

export function parseSusbLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  if (out.length < 14 || out[0] === 'MSA') return null;
  const num = (v) => (/^\d+$/.test(v) ? Number(v) : null);
  return { msa: out[0], naics: out[1], entrsize: out[2], firm: num(out[3]), rcpt: num(out[9]), msaName: out[11] };
}

export function filterSusbRows(rows, { msaCode, def }) {
  return rows.filter((r) =>
    r.msa === String(msaCode) && categoryMatches(def, r.naics) && ['02', '03', '04'].includes(r.entrsize));
}

export function deriveRevenueAvg(rows) {
  let firms = 0, rcpt = 0, ok = true;
  for (const r of rows) {
    if (r.firm == null || r.rcpt == null) { ok = false; break; }
    firms += r.firm; rcpt += r.rcpt * 1000;
  }
  if (!ok || !firms) return { suppressed: true };
  return { avg: Math.round(rcpt / firms), firms };
}

export function deriveIrsMargin(sheetRows, state, naicsMatch, opts = {}) {
  if (!Array.isArray(sheetRows) || sheetRows.length < 2) return { suppressed: true };
  const headRowIdx = sheetRows.findIndex((r) =>
    r.some((c) => typeof c === 'string' && /gross receipt/i.test(String(c))));
  if (headRowIdx === -1) return { suppressed: true };
  const headRow = sheetRows[headRowIdx];
  const col = (re) => headRow.findIndex((c) => re.test(String(c || '')));
  const idx = {
    state: col(/^state$/i),
    naics: col(/naics/i),
    receipts: col(/gross receipt/i),
    net: col(/net income|net profit/i),
  };
  if (idx.state === -1 || idx.naics === -1 || idx.receipts === -1 || idx.net === -1) return { suppressed: true };
  const num = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v ?? '').replace(/[,$\s]/g, '');
    return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  };
  let receipts = 0, net = 0, matched = false;
  for (const row of sheetRows.slice(headRowIdx + 1)) {
    if (!row) continue;
    const st = String(row[idx.state] ?? '').trim().toUpperCase();
    if (st !== String(state).trim().toUpperCase()) continue;
    if (!opts.allIndustries) {
      const nc = String(row[idx.naics] ?? '').trim().padStart(3, '0');
      if (!naicsMatch(nc)) continue;
    }
    const rec = num(row[idx.receipts]);
    const ni = num(row[idx.net]);
    if (rec == null || ni == null) continue; // IRS-suppressed cell (<10 returns)
    receipts += rec; net += ni; matched = true;
  }
  if (!matched || receipts <= 0) return { suppressed: true };
  return { margin: net / receipts, vintage: 'IRS SOI TY2022' };
}
