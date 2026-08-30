import { parseFlags } from './lib/cli-flags.mjs';
import { load as yamlLoad } from 'js-yaml';
import { loadBenchmarks } from './lib/benchmarks.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function runDoctor({ root }) {
  const checks = [];

  // Metro names rarely match verbatim: buildDoc writes dataset names
  // ("Orlando-Kissimmee-Sanford, FL") while profiles say "Orlando, FL".
  // Prefer MSA codes when both sides carry them; otherwise match when either
  // string contains the other's pre-comma city token (case-insensitive).
  function metroMatchesProfile(meta, profileMetro, profileMsaCode) {
    if (!profileMetro) return true;
    const metaMetro = meta?.primary_metro || null;
    if (!metaMetro) return false;
    const metaCode = meta?.msa_code ?? null;
    if (metaCode != null && profileMsaCode != null) return String(metaCode) === String(profileMsaCode);
    const cityOf = (s) => String(s).split(',')[0].trim().toLowerCase();
    const metaCity = cityOf(metaMetro);
    const profileCity = cityOf(profileMetro);
    return !!metaCity && !!profileCity && (metaCity.includes(profileCity) || profileCity.includes(metaCity));
  }

  function checkDir(rel) {
    const p = path.join(root, rel);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      checks.push({ name: rel, status: 'ok', message: 'exists' });
    } else {
      checks.push({ name: rel, status: 'fail', message: 'directory missing' });
    }
  }

  function checkFile(rel, level) {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) {
      checks.push({ name: rel, status: 'ok', message: 'exists' });
    } else {
      checks.push({ name: rel, status: level || 'fail', message: 'file missing' });
    }
  }

  // Required directories
  for (const d of ['data', 'reports', 'templates', 'modes', 'config', 'lib', 'providers']) {
    checkDir(d);
  }

  // Required system files
  for (const f of [
    'templates/states.yml',
    'templates/benchmarks.yml',
    'templates/loi-template.md',
    'templates/dd-checklist-base.md',
    'modes/_shared.md',
    'modes/evaluate.md',
    'DATA_CONTRACT.md',
  ]) {
    checkFile(f);
  }

  // Required data files — these are personal (gitignored) but the pipeline needs
  // them to exist; seed empty skeletons on first run so doctor passes on a fresh clone.
  const dataSkeletons = {
    'data/acquisitions.md':
      '# BizBuyBot — Acquisitions Tracker\n\nCanonical deal tracker. One row per evaluated business.\n\n| # | Date | Business | Category | Location | Asking Price | Cash Flow (SDE) | Multiple | Score | Status | Report | Notes |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n',
    'data/pipeline.md':
      '# BizBuyBot — Pipeline Inbox\n\nRaw leads discovered via scraping or manual entry. Pending items are awaiting evaluation. Processed items have been evaluated and added to the acquisitions tracker.\n\n## Pending\n\n## Processed\n',
    'data/scan-history.tsv': 'listing_id\turl\ttitle\tasking_price\tsde\tsource\tfirst_seen\trejection\n',
    'data/status-log.tsv': 'timestamp\tdeal_id\tfrom_status\tto_status\treason\n',
  };
  for (const [rel, skeleton] of Object.entries(dataSkeletons)) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, skeleton);
    }
    checkFile(rel);
  }

  // Dependencies
  for (const d of ['node_modules/playwright', 'node_modules/js-yaml', 'node_modules/dotenv']) {
    checkDir(d);
  }

  // Warn-level checks (user-created files)
  checkFile('config/profile.yml', 'warn');
  checkFile('portals.yml', 'warn');
  checkFile('buyer-profile.md', 'warn');

  // Benchmark tier
  try {
    const bench = loadBenchmarks(root);
    let profileMetro = null;
    let profileMsaCode = null;
    const profPath = path.join(root, 'config', 'profile.yml');
    if (fs.existsSync(profPath)) {
      try {
        const prof = yamlLoad(fs.readFileSync(profPath, 'utf8'));
        profileMetro = prof?.geography?.preferred_metro?.[0] || null;
        profileMsaCode = prof?.geography?.preferred_msa_code ?? null;
      } catch { /* malformed profile: treat as no preference */ }
    }
    if (bench.source === 'local' && metroMatchesProfile(bench.meta, profileMetro, profileMsaCode)) {
      checks.push({ name: 'Benchmarks', status: 'ok',
        message: `LOCAL — ${bench.meta?.primary_metro || 'unknown metro'} (built ${String(bench.meta?.generated_at || '').slice(0, 10) || 'date unknown'})` });
    } else if (bench.source === 'local') {
      checks.push({ name: 'Benchmarks', status: 'warn',
        message: `local benchmarks are for ${bench.meta?.primary_metro || 'unknown metro'}, profile prefers ${profileMetro} — rebuild recommended` });
    } else {
      checks.push({ name: 'Benchmarks', status: 'warn',
        message: 'national defaults (run node build-benchmarks.mjs to calibrate)' });
    }
  } catch {
    checks.push({ name: 'Benchmarks', status: 'warn', message: 'could not evaluate benchmark tier' });
  }

  // Node version check
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major >= 18) {
    checks.push({ name: 'Node.js version', status: 'ok', message: `v${process.versions.node}` });
  } else {
    checks.push({ name: 'Node.js version', status: 'fail', message: `v${process.versions.node} (requires >=18)` });
  }

  const ok = !checks.some(c => c.status === 'fail');
  return { ok, checks };
}

function printReport(result) {
  const statusIcons = { ok: '\u2713', warn: '!', fail: '\u2717' };
  const padName = Math.max(...result.checks.map(c => c.name.length), 4);
  const padStatus = 5;

  console.log('\nBizBuyBot Doctor \u2014 Setup Health Check\n');
  console.log(`  ${'Check'.padEnd(padName)}  ${'Status'.padEnd(padStatus)}  Message`);
  console.log(`  ${'─'.repeat(padName)}  ${'─'.repeat(padStatus)}  ${'─'.repeat(30)}`);

  for (const c of result.checks) {
    const icon = statusIcons[c.status] || '?';
    const statusLabel = c.status.toUpperCase().padEnd(padStatus);
    console.log(`  ${icon} ${c.name.padEnd(padName)}  ${statusLabel}  ${c.message}`);
  }

  const fails = result.checks.filter(c => c.status === 'fail');
  const warns = result.checks.filter(c => c.status === 'warn');
  console.log(`\n  ${result.checks.length} checks: ${result.checks.length - fails.length - warns.length} ok, ${warns.length} warnings, ${fails.length} failures`);

  if (result.ok) {
    console.log('\n  Setup OK. No blocking issues.\n');
  } else {
    console.log('\n  Setup INCOMPLETE. Fix the failing checks above.\n');
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (import.meta.url === `file://${process.argv[1]}`) {
  const { flags } = parseFlags(process.argv.slice(2));
  const root = flags.root || __dirname;
  const result = runDoctor({ root });
  printReport(result);
  process.exit(result.ok ? 0 : 1);
}
