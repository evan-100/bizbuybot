#!/usr/bin/env node
// Derives per-user local benchmarks from Census SUSB (MSA revenue) and
// IRS SOI (state Schedule C margins). Writes data/local-benchmarks.yml.
// Never hand-edit that file — re-run this script instead.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import * as XLSX from 'xlsx';
import {
  CATEGORY_DEFS, categoryMatches, parseSusbLine, filterSusbRows,
  deriveRevenueAvg, deriveIrsMargin,
} from './lib/benchmarks.mjs';
import { TOP_METROS, resolveMetroStatic, resolveMetroFromNames, scanMetroNames } from './lib/msa-lookup.mjs';

const SUSB_URL = 'https://www2.census.gov/programs-surveys/susb/datasets/2022/msa_3digitnaics_2022.txt';
const IRS_URL = 'https://www.irs.gov/pub/irs-soi/22sp01st.xlsx';

// IRS SOI state tables spell out state names ("FLORIDA") and use 6-digit NAICS
// ("812000"); normalize both before matching (found during live smoke testing).
const US_STATE_NAMES = {
  AL: 'ALABAMA', AK: 'ALASKA', AZ: 'ARIZONA', AR: 'ARKANSAS', CA: 'CALIFORNIA', CO: 'COLORADO',
  CT: 'CONNECTICUT', DE: 'DELAWARE', FL: 'FLORIDA', GA: 'GEORGIA', HI: 'HAWAII', ID: 'IDAHO',
  IL: 'ILLINOIS', IN: 'INDIANA', IA: 'IOWA', KS: 'KANSAS', KY: 'KENTUCKY', LA: 'LOUISIANA',
  ME: 'MAINE', MD: 'MARYLAND', MA: 'MASSACHUSETTS', MI: 'MICHIGAN', MN: 'MINNESOTA',
  MS: 'MISSISSIPPI', MO: 'MISSOURI', MT: 'MONTANA', NE: 'NEBRASKA', NV: 'NEVADA',
  NH: 'NEW HAMPSHIRE', NJ: 'NEW JERSEY', NM: 'NEW MEXICO', NY: 'NEW YORK',
  NC: 'NORTH CAROLINA', ND: 'NORTH DAKOTA', OH: 'OHIO', OK: 'OKLAHOMA', OR: 'OREGON',
  PA: 'PENNSYLVANIA', RI: 'RHODE ISLAND', SC: 'SOUTH CAROLINA', SD: 'SOUTH DAKOTA',
  TN: 'TENNESSEE', TX: 'TEXAS', UT: 'UTAH', VT: 'VERMONT', VA: 'VIRGINIA',
  WA: 'WASHINGTON', WV: 'WEST VIRGINIA', WI: 'WISCONSIN', WY: 'WYOMING', DC: 'DISTRICT OF COLUMBIA',
};
export function toIrsStateLabel(code) {
  const c = String(code || '').trim().toUpperCase();
  return US_STATE_NAMES[c] || c;
}

async function download(url, dest, force) {
  if (!force && fs.existsSync(dest)) { console.log(`cached: ${path.basename(dest)}`); return dest; }
  console.log(`downloading ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part';
  await fs.promises.writeFile(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, dest);
  return dest;
}

export function buildDoc({ susbRows, irsRows, metro, state, nationalDoc }) {
  const benchmarks = [];
  for (const def of CATEGORY_DEFS) {
    const nat = nationalDoc.benchmarks.find((b) => b.category === def.category);
    const rev = deriveRevenueAvg(filterSusbRows(susbRows, { msaCode: metro.code, def }));

    const revOut = rev.suppressed
      ? { avg: nat.revenue_benchmark.avg, scope: 'US (SUSB 2022, national)', sample_firms: null, fallback_reason: 'suppressed or no matching MSA rows' }
      : { avg: rev.avg, scope: `${metro.name} (SUSB 2022)`, sample_firms: rev.firms, fallback_reason: null };

    const m = irsRows && state
      ? deriveIrsMargin(irsRows, toIrsStateLabel(state),
          def.generalAll ? () => true : (nc) => categoryMatches(def, String(nc).trim().slice(0, 3)),
          { allIndustries: !!def.generalAll })
      : { suppressed: true };
    const sdeLocal = m.suppressed ? null : Math.round(revOut.avg * m.margin);
    const margOut = m.suppressed
      ? { avg: nat.sde_benchmark.avg, scope: 'US (IRS SOI, national)', fallback_reason: irsRows ? 'suppressed/thin IRS cell' : 'IRS data unavailable' }
      : sdeLocal <= 0
        ? { avg: nat.sde_benchmark.avg, scope: 'US (IRS SOI, national)', fallback_reason: `non-positive statewide margin (${(m.margin * 100).toFixed(1)}%) — sector aggregate loss` }
        : { avg: sdeLocal, scope: `${state} Schedule C margin TY2022 (${(m.margin * 100).toFixed(1)}%)`, fallback_reason: rev.suppressed ? 'revenue fell back to national' : null };

    benchmarks.push({
      category: def.category,
      naics_3digit: def.naics3,
      ...(def.retailSum ? { note: 'revenue aggregates 44x-45x subsectors' } : {}),
      sde_multiple_min: nat.sde_multiple_min,
      sde_multiple_max: nat.sde_multiple_max,
      typical_sde_margin: nat.typical_sde_margin,
      keywords: nat.keywords || [],
      ...(nat.notes ? { notes: nat.notes } : {}),
      revenue_benchmark: revOut,
      sde_benchmark: margOut,
    });
  }

  return { meta: {
    generator: 'build-benchmarks.mjs',
    generated_at: new Date().toISOString(),
    primary_metro: metro.name, msa_code: Number(metro.code),
    other_metros_uncalibrated: [],
    states: state ? [state] : [], sources: {
      revenue: { name: 'US Census SUSB 2022, MSA x 3-digit NAICS (firms <20 employees; ENTRSIZE 02-04)', url: SUSB_URL, vintage: '2022' },
      margin: { name: 'IRS SOI Sole Proprietorship State Tables (TY2022)', url: IRS_URL, vintage: '2022' },
    },
  }, benchmarks };
}

export const _internals = { buildDoc, toIrsStateLabel };

async function main() {
  // --- arg parsing ---
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
  }));
  const ROOT = path.resolve(args['data-dir'] ? path.join(args['data-dir'], '..') : process.cwd());
  const DATA = path.resolve(args['data-dir'] || path.join(ROOT, 'data'));
  const CACHE = path.join(DATA, 'cache');
  const FORCE = !!args.force, DRY = !!args['dry-run'];

  // --- profile geography ---
  let profile;
  try { profile = yamlLoad(fs.readFileSync(path.join(ROOT, 'config', 'profile.yml'), 'utf8')); }
  catch { console.error('No readable config/profile.yml — run /bizbuybot setup first.'); process.exit(1); }
  const metroInput = profile?.geography?.preferred_metro?.[0];
  const states = profile?.geography?.preferred_states?.length ? profile.geography.preferred_states : [];
  if (!metroInput) { console.error('No preferred_metro in config/profile.yml — run /bizbuybot setup first.'); process.exit(1); }
  const primaryState = (metroInput.match(/,\s*([A-Z]{2})\s*$/) || [])[1] || states[0];

  // --- census SUSB (required) ---
  let susbPath;
  try { susbPath = await download(SUSB_URL, path.join(CACHE, 'susb-msa-3digitnaics-2022.txt'), FORCE); }
  catch (e) { console.error(`Census SUSB download failed: ${e.message}`); process.exit(1); }
  const susbRows = fs.readFileSync(susbPath, 'utf8').split('\n').map(parseSusbLine).filter(Boolean);
  if (!susbRows.length) { console.error('Census SUSB download unusable (no parsable rows).'); process.exit(1); }

  // resolve metro: static first, then dataset scan (both state-qualified)
  let metro = resolveMetroStatic(metroInput);
  if (!metro) {
    metro = resolveMetroFromNames(scanMetroNames(susbRows), metroInput);
  }
  if (!metro) {
    console.error(`Could not resolve "${metroInput}".`);
    console.error('Known metros include:\n  ' + TOP_METROS.map((m) => m.name).join('\n  '));
    process.exit(1);
  }
  console.log(`resolved metro: ${metro.name} (${metro.code})`);

  // IRS margins (optional — failure degrades gracefully)
  let irsRows = null;
  try {
    const irsPath = await download(IRS_URL, path.join(CACHE, 'irs-soi-sp-state-2022.xlsx'), FORCE);
    const wb = XLSX.read(fs.readFileSync(irsPath));
    irsRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  } catch (e) { console.warn(`warning: IRS margins unavailable (${e.message}) — margins fall back to national`); }

  const nationalDoc = yamlLoad(fs.readFileSync(path.join(ROOT, 'templates', 'benchmarks.yml'), 'utf8'));
  const doc = buildDoc({ susbRows, irsRows, metro, state: primaryState, nationalDoc });
  doc.meta.other_metros_uncalibrated = (profile.geography.preferred_metro || []).slice(1);
  doc.meta.states = states;

  if (DRY) {
    console.table(doc.benchmarks.map((b) => ({
      category: b.category,
      revenue: b.revenue_benchmark.avg,
      revenue_scope: b.revenue_benchmark.fallback_reason || b.revenue_benchmark.scope,
      sde: b.sde_benchmark.avg,
      sde_scope: b.sde_benchmark.fallback_reason || b.sde_benchmark.scope,
    })));
    return;
  }

  fs.mkdirSync(DATA, { recursive: true });
  const outPath = path.join(DATA, 'local-benchmarks.yml');
  const tmpOut = outPath + '.tmp';
  fs.writeFileSync(tmpOut, '# GENERATED by build-benchmarks.mjs — do not hand-edit.\n' + yamlDump(doc, { lineWidth: 100 }));
  fs.renameSync(tmpOut, outPath);
  console.log(`wrote ${outPath}`);
  const fellBack = doc.benchmarks.filter((b) => b.revenue_benchmark.fallback_reason || b.sde_benchmark.fallback_reason);
  console.log(`calibrated ${doc.benchmarks.length - fellBack.length}/${doc.benchmarks.length} categories locally` + (fellBack.length ? `; fell back: ${fellBack.map((b) => b.category).join(', ')}` : ''));
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) await main();
