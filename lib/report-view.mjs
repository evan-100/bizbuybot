import fs from 'node:fs';
import { load as yamlLoad } from 'js-yaml';
import { matchBenchmark } from './benchmarks.mjs';

export const ARTIFACT_DEFS = [
  { kind: 'dd', label: 'Due Diligence Checklist', suffix: 'dd-checklist' },
  { kind: 'loi', label: 'Letter of Intent', suffix: 'loi' },
  { kind: 'outreach', label: 'Broker Outreach', suffix: 'outreach' },
];

export function findArtifacts(reportsDir, dealId) {
  let files = [];
  try {
    files = fs.readdirSync(reportsDir);
  } catch {
    return [];
  }
  const norm = String(dealId).padStart(3, '0');
  return ARTIFACT_DEFS.flatMap(({ kind, label, suffix }) => {
    const file = `${norm}-${suffix}.md`;
    return files.includes(file) ? [{ kind, label, file }] : [];
  });
}

// ---------- helpers ----------

export { matchBenchmark };

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- parsing ----------

export function parseYamlFooter(md) {
  if (!md) return null;
  const m = md.match(/```yaml\s*\n([\s\S]*?)\n```\s*$/);
  if (!m) return null;
  // Reports wrap the mapping in YAML document markers (--- ... ---); strip them before parsing.
  const inner = m[1].replace(/^---\s*\n/, '').replace(/\n---\s*$/, '');
  try {
    const parsed = yamlLoad(inner);
    if (!parsed) return null;
    return parsed.bizbuybot ? parsed.bizbuybot : parsed;
  } catch {
    return null;
  }
}

export function extractBlocks(md) {
  if (!md) return [];
  const lines = md.split('\n');
  const blocks = [];
  let current = null;
  let buf = [];
  let fence = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) fence = !fence;
    const h2 = !fence && /^## (?!#)/.exec(line);
    if (h2) {
      if (current) blocks.push({ title: current, body: buf.join('\n') });
      current = line.replace(/^##\s+/, '').trim();
      buf = [];
      continue;
    }
    if (current) buf.push(line);
  }
  if (current) blocks.push({ title: current, body: buf.join('\n') });
  // drop trailing yaml-fence-only block if it leaked in
  return blocks.filter((b) => !(b.body.trim().startsWith('```yaml') && b.title.toLowerCase().includes('yaml')));
}

// ---------- minimal markdown -> html ----------

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function mdToHtml(md) {
  if (!md) return '';
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // pipe table
    if (/^\s*\|/.exec(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.exec(lines[i + 1])) {
      const header = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.exec(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      out.push(
        `<table><thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
      );
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(h[1].length + 2, 6); // ## -> h4 inside a section
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*(---+|___+)\s*$/.exec(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.exec(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.exec(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.exec(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.exec(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      out.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ol>`);
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (/^\s*>\s?/.exec(line)) {
      const items = [];
      while (i < lines.length && /^\s*>\s?/.exec(lines[i])) {
        items.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${items.map((it) => inline(it)).join('<br>')}</blockquote>`);
      continue;
    }

    // paragraph: gather until blank line
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|\s*[-*]\s|\s*\d+[.)]\s|\s*\||\s*```)/.exec(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

// ---------- svg charts ----------

export function scoreGauge(score) {
  const clamped = Math.max(1, Math.min(5, Number(score) || 1));
  const angle = Math.PI * (1 - (clamped - 1) / 4); // 1 -> PI (left), 5 -> 0 (right)
  const cx = 110;
  const cy = 105;
  const r = 88;
  const nx = cx + r * 0.82 * Math.cos(angle);
  const ny = cy - r * 0.82 * Math.sin(angle);

  const zoneColor = clamped >= 4 ? '#a6e3a1' : clamped >= 3.5 ? '#f9e2af' : '#f38ba8';

  function pt(frac) {
    const a = Math.PI * (1 - frac);
    return `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
  }

  return `<svg viewBox="0 0 220 130" width="220" height="130" role="img" aria-label="Deal score ${clamped} of 5">
    <path d="M ${pt(0)} A ${r} ${r} 0 0 1 ${pt(0.25)}" stroke="#f38ba8" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M ${pt(0.25)} A ${r} ${r} 0 0 1 ${pt(0.5)}" stroke="#f9e2af" stroke-width="14" fill="none"/>
    <path d="M ${pt(0.5)} A ${r} ${r} 0 0 1 ${pt(1)}" stroke="#a6e3a1" stroke-width="14" fill="none" stroke-linecap="round"/>
    <circle cx="${nx}" cy="${ny}" r="9" fill="${zoneColor}" stroke="#1e1e2e" stroke-width="3"/>
    <text x="${cx}" y="92" text-anchor="middle" font-size="40" font-weight="700" fill="#cdd6f4">${Number(score).toFixed(1)}</text>
    <text x="18" y="124" font-size="11" fill="#6c7086">1.0</text>
    <text x="${cx}" y="16" font-size="11" fill="#6c7086" text-anchor="middle">3.0</text>
    <text x="202" y="124" font-size="11" fill="#6c7086" text-anchor="end">5.0</text>
    <text x="${cx}" y="118" font-size="10" fill="#6c7086" text-anchor="middle">holistic deal score</text>
  </svg>`;
}

export function valuationBand(multiple, benchmark) {  const mult = Number(multiple);
  const bmin = benchmark ? Number(benchmark.sde_multiple_min) : null;
  const bmax = benchmark ? Number(benchmark.sde_multiple_max) : null;
  const maxScale = Math.max(6, (Number.isFinite(mult) ? mult : 0) + 1, bmax ? bmax + 1.5 : 0);
  const W = 420;
  const H = 84;
  const padL = 34;
  const trackW = W - padL - 20;
  const x = (v) => padL + (v / maxScale) * trackW;
  const y = 56;

  const inBand = Number.isFinite(mult) && bmin !== null && mult >= bmin && mult <= bmax;
  const markerColor = inBand ? '#a6e3a1' : '#f38ba8';

  let ticks = '';
  for (let v = 0; v <= maxScale; v += 1) {
    ticks += `<line x1="${x(v)}" y1="${y}" x2="${x(v)}" y2="${y + 8}" stroke="#45475a"/>
              <text x="${x(v)}" y="${y + 22}" font-size="10" fill="#6c7086" text-anchor="middle">${v}x</text>`;
  }

  const band =
    bmin !== null && bmax !== null
      ? `<rect x="${x(bmin)}" y="${y - 12}" width="${x(bmax) - x(bmin)}" height="24" rx="6"
           fill="#a6e3a133" stroke="#a6e3a1" stroke-dasharray="3,3"/>`
      : '';

  // Marker label sits above its position; clamp so it never clips at the chart edges.
  const markerLabelX = Number.isFinite(mult) ? Math.max(padL + 16, Math.min(W - 24, x(mult))) : null;
  const marker = Number.isFinite(mult)
    ? `<line x1="${x(mult)}" y1="${y - 16}" x2="${x(mult)}" y2="${y + 14}" stroke="${markerColor}" stroke-width="3"/>
       <text x="${markerLabelX}" y="${y - 22}" font-size="12" font-weight="700" fill="${markerColor}" text-anchor="middle">${mult.toFixed(1)}x asking</text>`
    : '';

  // Benchmark range as a fixed legend on the title row — never collides with the marker label.
  const legend =
    bmin !== null
      ? `<text x="${W - 4}" y="14" font-size="10.5" fill="#a6e3a1" text-anchor="end">▮ benchmark ${bmin.toFixed(1)}x–${bmax.toFixed(1)}x${benchmark && benchmark.category ? ' · ' + escapeHtml(benchmark.category) : ''}</text>`
      : '';

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Asking multiple versus benchmark">
    <text x="${padL}" y="14" font-size="11" fill="#6c7086">asking multiple vs category benchmark</text>
    ${legend}
    ${ticks}
    ${band}
    ${marker}
  </svg>`;
}

// ---------- benchmark comparison strip ----------

function fmtShort(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n);
}

export function benchmarkComparison(title, thisValue, refs) {
  const points = [
    { label: 'This Business', value: thisValue, fill: '#89b4fa' },
    ...refs.map((r) => ({ label: r.label, value: r.value, fill: '#9399b2' })),
  ].filter((p) => Number.isFinite(Number(p.value)) && Number(p.value) > 0);

  if (points.length < 2) return '';

  const W = 460;
  const H = 74;
  const padL = 14;
  const padR = 26;
  const stripY = 40;
  const stripH = 10;
  const maxVal = Math.max(...points.map((p) => Number(p.value))) * 1.15;
  const x = (v) => padL + (Number(v) / maxVal) * (W - padL - padR);

  const gradientId = 'benchgrad-' + title.toLowerCase().replace(/[^a-z]+/g, '');

  const diamonds = points
    .map((p) => {
      const dx = x(p.value);
      return `<path d="M ${dx},${stripY - 8} L ${dx + 7},${stripY + stripH / 2} L ${dx},${stripY + stripH + 8} L ${dx - 7},${stripY + stripH / 2} Z"
               fill="${p.fill}" stroke="#1e1e2e" stroke-width="1.5"/>
              <text x="${dx}" y="${stripY - 13}" font-size="9.5" fill="${p.fill === '#89b4fa' ? '#89b4fa' : '#6c7086'}" text-anchor="middle">${fmtShort(p.value)}</text>`;
    })
    .join('');

  const rows = points
    .map(
      (p) => `<div class="bench-row"><span class="bench-dot" style="background:${p.fill}"></span>
              <span class="bench-label">${escapeHtml(p.label)}</span>
              <span class="bench-value">${fmtShort(p.value)}</span></div>`,
    )
    .join('');

  return `<div class="bench-card">
    <div class="bench-title">${escapeHtml(title)}</div>
    <div class="bench-rows">${rows}</div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${escapeHtml(title)} comparison">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f38ba8"/>
          <stop offset="50%" stop-color="#f9e2af"/>
          <stop offset="100%" stop-color="#a6e3a1"/>
        </linearGradient>
      </defs>
      <rect x="${padL}" y="${stripY}" width="${W - padL - padR}" height="${stripH}" rx="5" fill="url(#${gradientId})" opacity="0.85"/>
      <text x="${padL}" y="${stripY + stripH + 22}" font-size="9.5" fill="#6c7086">lower</text>
      <text x="${W - padR}" y="${stripY + stripH + 22}" font-size="9.5" fill="#6c7086" text-anchor="end">higher</text>
      ${diamonds}
    </svg>
  </div>`;
}

const NATIONAL_BENCH_FOOTNOTE =
  '* national reference points: US Census SUSB 2022 (avg receipts per firm, &lt;20 employees) · IRS SOI sole-proprietorship net margins. SDE reference = avg revenue × industry net margin. Directional only — verify in due diligence.';

function benchmarkFootnote(benchmark) {
  const rev = benchmark.revenue_benchmark;
  const sde = benchmark.sde_benchmark;
  const segs = [];
  if (rev && typeof rev.scope === 'string' && rev.scope) segs.push(`revenue: ${escapeHtml(rev.scope)}`);
  if (sde && typeof sde.scope === 'string' && sde.scope) segs.push(`margin: ${escapeHtml(sde.scope)}`);
  if (!segs.length) return `<p class="bench-note">${NATIONAL_BENCH_FOOTNOTE}</p>`;

  let out = `<p class="bench-note">* ${segs.join(' · ')}</p>`;
  if (rev && rev.fallback_reason) {
    out += `\n    <p class="bench-fallback">Revenue: national fallback — ${escapeHtml(rev.fallback_reason)}</p>`;
  }
  if (sde && sde.fallback_reason) {
    out += `\n    <p class="bench-fallback">SDE: national fallback — ${escapeHtml(sde.fallback_reason)}</p>`;
  }
  return out;
}

export function industryBenchmarkPanel(benchmark, footer) {
  if (!benchmark) return '';
  const hasRev = benchmark.revenue_benchmark && Number(footer.revenue) > 0 && Number.isFinite(Number(footer.revenue));
  const hasSde = benchmark.sde_benchmark && Number(footer.sde) > 0 && Number.isFinite(Number(footer.sde));

  const revCard = hasRev
    ? benchmarkComparison('Gross Revenue', footer.revenue, [
        { label: 'Census avg revenue *', value: benchmark.revenue_benchmark.avg },
      ])
    : '';
  const sdeCard = hasSde
    ? benchmarkComparison('Cash Flow (SDE)', footer.sde, [
        { label: 'SDE @ IRS net margin *', value: benchmark.sde_benchmark.avg },
      ])
    : '';

  if (!revCard && !sdeCard) return '';

  return `<section class="bench-section">
    <h3>Industry Benchmarks — ${escapeHtml(benchmark.category)}</h3>
    ${benchmarkFootnote(benchmark)}
    <div class="bench-grid">${revCard}${sdeCard}</div>
  </section>`;
}

// ---------- page ----------

export const PAGE_CSS = `:root { --bg:#1e1e2e; --surface:#181825; --panel:#313244; --text:#cdd6f4; --muted:#6c7086;
          --green:#a6e3a1; --red:#f38ba8; --cyan:#94e2d5; --yellow:#f9e2af; --accent:#89b4fa; --border:#45475a; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 28px 24px 80px; }
  .toplink { font-size: 13px; margin-bottom: 18px; }
  .toplink a { color: var(--accent); text-decoration: none; }
  h1.name { font-size: 26px; margin: 0 0 10px; }
  .badges { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:22px; align-items:center; }
  .badge { display:inline-block; padding:3px 11px; border-radius:999px; font-size:12px; border:1px solid var(--border); color:var(--muted); }
  .badge.closed { color:var(--green); border-color:var(--green); }
  .badge.passed { color:var(--red); border-color:var(--red); }
  .badge.watchlist { color:var(--cyan); border-color:var(--cyan); }
  .badge.accent { color:var(--accent); border-color:var(--accent); }
  .hero { display:flex; gap:32px; align-items:center; flex-wrap:wrap; background:var(--surface);
          border:1px solid var(--border); border-radius:14px; padding:22px 26px; margin-bottom:22px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; flex:1; min-width:300px; }
  .card { background:var(--panel); border-radius:10px; padding:10px 14px; }
  .card-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
  .card-value { font-size:17px; font-weight:650; margin-top:2px; }
  .card-value.est { color: var(--yellow); }
  .est-chip { display:inline-block; font-size:9.5px; font-weight:600; letter-spacing:.06em; color:var(--yellow);
              border:1px solid var(--yellow); border-radius:999px; padding:1px 7px; vertical-align:middle;
              text-transform:uppercase; margin-left:4px; opacity:.9; cursor:help; }
  .charts { display:flex; gap:30px; flex-wrap:wrap; align-items:center; margin-bottom:8px; }
  .risks { background:var(--surface); border:1px solid var(--border); border-left:4px solid var(--red);
           border-radius:10px; padding:14px 20px; margin:18px 0; }
  .risks h3 { margin:0 0 8px; font-size:15px; color:var(--red); }
  .risks ul { margin:0; padding-left:20px; }
  .risks li { margin: 4px 0; }
  .bench-section { background:var(--surface); border:1px solid var(--border); border-radius:10px;
                   padding:16px 20px; margin:18px 0; }
  .bench-section h3 { margin:0 0 12px; font-size:15px; }
  .bench-note { font-size:11.5px; color:var(--muted); font-weight:400; margin-left:8px; }
  .bench-fallback { font-size:11.5px; color:var(--yellow); font-weight:600; margin:6px 0 0 8px; }
  .bench-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; }
  .bench-card { background:var(--panel); border-radius:10px; padding:12px 16px; }
  .bench-title { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
  .bench-rows { display:flex; flex-direction:column; gap:3px; margin-bottom:6px; }
  .bench-row { display:flex; align-items:center; gap:8px; font-size:13px; }
  .bench-dot { width:8px; height:8px; border-radius:50%; flex:none; }
  .bench-label { color:var(--muted); flex:1; }
  .bench-value { font-weight:650; }
  .artifactnav { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin: 18px 0; }
  .artifactnav .artifact-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin-right:2px; }
  .artifactnav a { font-size:12.5px; color:var(--accent); text-decoration:none; background:var(--panel);
                padding:4px 12px; border-radius:999px; border:1px solid var(--border); }
  .blocknav { display:flex; gap:10px; flex-wrap:wrap; margin: 18px 0; }
  .blocknav a { font-size:12.5px; color:var(--accent); text-decoration:none; background:var(--panel);
                padding:4px 12px; border-radius:999px; border:1px solid var(--border); }
  details.block { background:var(--surface); border:1px solid var(--border); border-radius:12px;
                  margin-bottom:12px; overflow:hidden; }
  details.block summary { cursor:pointer; padding:13px 20px; font-weight:650; list-style:none;
                  display:flex; justify-content:space-between; }
  details.block summary::after { content:"+"; color:var(--muted); font-weight:400; }
  details.block[open] summary::after { content:"–"; }
  details.block[open] summary { border-bottom:1px solid var(--border); }
  .block-body { padding: 6px 22px 18px; }
  .block-body h4 { margin: 18px 0 6px; font-size: 15px; color: var(--accent); }
  .block-body h5 { margin: 16px 0 4px; font-size: 13.5px; color: var(--muted); }
  .block-body p { margin: 8px 0; }
  .block-body ul, .block-body ol { margin: 8px 0; padding-left: 22px; }
  .block-body li { margin: 3px 0; }
  .block-body table { width:auto; border-collapse:collapse; margin:10px 0; }
  .block-body th, .block-body td { border:1px solid var(--border); padding:6px 12px; font-size:13.5px; white-space:normal; }
  .block-body th { background:var(--panel); color:var(--muted); font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; }
  .block-body pre { background:var(--panel); border-radius:8px; padding:12px 14px; overflow-x:auto; font-size:13px; }
  .block-body code { background:var(--panel); border-radius:4px; padding:1px 5px; font-size:13px; }
  .block-body pre code { background:none; padding:0; }
  .block-body hr { border:none; border-top:1px solid var(--border); margin:14px 0; }
  .block-body blockquote { margin:12px 0; padding:10px 16px; background:var(--panel);
                           border-left:4px solid var(--yellow); border-radius:8px; }
  .block-body blockquote p { margin:0; }
  .doc { color:var(--text); }
  .doc h3 { margin:22px 0 8px; font-size:16px; color:var(--accent); }
  .doc h4 { margin:18px 0 6px; font-size:15px; color:var(--accent); }
  .doc h5 { margin:16px 0 4px; font-size:13.5px; color:var(--muted); }
  .doc p { margin:8px 0; }
  .doc ul, .doc ol { margin:8px 0; padding-left:22px; }
  .doc li { margin:3px 0; }
  .doc table { width:auto; border-collapse:collapse; margin:10px 0; }
  .doc th, .doc td { border:1px solid var(--border); padding:6px 12px; font-size:13.5px; white-space:normal; }
  .doc th { background:var(--panel); color:var(--muted); font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; }
  .doc pre { background:var(--panel); border-radius:8px; padding:12px 14px; overflow-x:auto; font-size:13px; }
  .doc code { background:var(--panel); border-radius:4px; padding:1px 5px; font-size:13px; }
  .doc pre code { background:none; padding:0; }
  .doc hr { border:none; border-top:1px solid var(--border); margin:14px 0; }
  .doc blockquote { margin:12px 0; padding:10px 16px; background:var(--panel);
                    border-left:4px solid var(--yellow); border-radius:8px; }
  .meta { color:var(--muted); font-size:13px; margin-bottom:6px; }
  .listing-line { margin: 2px 0 14px; font-size: 13.5px; display:flex; align-items:center; gap:10px; min-width:0; }
  .listing-line a { color:var(--accent); font-weight:600; text-decoration:none; white-space:nowrap; }
  .listing-line a:hover { text-decoration:underline; }
  .listing-url { color:var(--muted); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }`;

export function renderArtifactPage({ deal, kind, label, file, md }) {
  const title = `${label} — ${deal.business} (Deal ${deal.id})`;
  const rawHref = encodeURIComponent(`reports/${file}`);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — BizBuyBot</title>
<style>
${PAGE_CSS}
</style>
</head>
<body>
<div class="wrap">
  <div class="toplink"><a href="/deal/${escapeHtml(deal.id)}">← back to deal</a></div>
  <h1 class="name">${escapeHtml(title)}</h1>
  <div class="meta">Deal ${escapeHtml(deal.id)} · ${escapeHtml(label)} · generated artifact</div>
  <div class="badges">
    <a class="badge" href="/${rawHref}">raw markdown ↗</a>
  </div>
  <div class="doc">${mdToHtml(md || '')}</div>
</div>
</body>
</html>`;
}

export function renderReportPage({ deal, reportMd, benchmarks, artifacts = [] }) {
  const footer = parseYamlFooter(reportMd) || {};
  const blocks = extractBlocks(reportMd);
  const listingUrl =
    deal.url ||
    (reportMd.match(/\*\*Listing URL:?\*\*\s*(https?:\/\/\S+)/i) || [])[1] ||
    null;

  const name = footer.business_name || deal.business;
  const score = footer.score ?? parseFloat(String(deal.score || '').replace(/\/5$/, '')) ?? null;
  const benchmark = matchBenchmark(benchmarks, deal.category || footer.archetype);

  const riskTierClass =
    footer.risk_tier === 'High Confidence' ? 'badge closed' : footer.risk_tier === 'Suspicious' || /risk/i.test(footer.risk_tier || '') ? 'badge passed' : 'badge watchlist';

  const money = (v) => (Number.isFinite(Number(v)) ? '$' + Number(v).toLocaleString() : '—');

  // A value is an estimate when the footer flags it explicitly, or (legacy reports) when the
  // report prose contains estimate/not-disclosed language near the field.
  const ESTIMATE_RE = /(not disclosed|not provided|not verified|provisional|estimat(e|ed|ing)|assumed|rule of thumb|industry default|unverified|unaudited|claims?|claimed|plausible|derived|implied|no p&amp;l|no p&l|without p&l|without financial)/i;
  const isEstimated = (field, footerFlag) => {
    if (footerFlag === true) return true;
    if (footerFlag === false) return false;
    return new RegExp(`${field}[^\\n]{0,120}`, 'i').test(reportMd) &&
      [...reportMd.matchAll(new RegExp(`${field}[^\\n]{0,120}`, 'gi'))].some((m) => ESTIMATE_RE.test(m[0]));
  };
  const sdeEst = isEstimated('cash flow', footer.sde_estimated) || isEstimated('SDE', footer.sde_estimated);
  const revEst = isEstimated('revenue', footer.revenue_estimated);

  const metricCard = (label, value, { estimated = false, hint = '' } = {}) => {
    const estClass = estimated ? ' est' : '';
    const chip = estimated ? '<span class="est-chip" title="Not disclosed by the seller — provisional estimate. Verify in due diligence.">estimated</span>' : '';
    const tip = estimated ? ` title="${escapeHtml(hint)}"` : '';
    const display = estimated ? '≈ ' + value : value;
    return `<div class="card"><div class="card-label">${escapeHtml(label)}</div><div class="card-value${estClass}"${tip}>${escapeHtml(display)} ${chip}</div></div>`;
  };

  const metricCards = [
    metricCard('Asking Price', money(footer.asking_price ?? deal.askingPrice)),
    metricCard('Cash Flow (SDE)', money(footer.sde ?? deal.sde), {
      estimated: sdeEst,
      hint: 'SDE was not disclosed by the seller — this is a provisional estimate. Verify in due diligence.',
    }),
    metricCard('Gross Revenue', money(footer.revenue), {
      estimated: revEst,
      hint: 'Revenue was not disclosed by the seller — this is a provisional estimate. Verify in due diligence.',
    }),
    metricCard('Multiple', footer.multiple != null ? Number(footer.multiple).toFixed(1) + 'x' : deal.multiple, {
      estimated: sdeEst,
      hint: 'Derived from an estimated SDE — treat the multiple as provisional.',
    }),
    metricCard('Financing Fit', footer.financing_fit || '—'),
    metricCard('Recommended', footer.recommended_action || '—'),
  ].join('');

  const risks = Array.isArray(footer.key_risks)
    ? `<section class="risks"><h3>Key Risks</h3><ul>${footer.key_risks.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul></section>`
    : '';

  const benchPanel = industryBenchmarkPanel(benchmark, footer);

  const artifactNav = artifacts.length
    ? `<nav class="artifactnav"><span class="artifact-label">Artifacts</span>${artifacts
        .map((a) => `<a href="/deal/${escapeHtml(deal.id)}/${a.kind}">${escapeHtml(a.label)}</a>`)
        .join('')}</nav>`
    : '';

  const blockNav = blocks
    .map((b, i) => {
      // Titles look like "Block B — Financial Analysis & Multiple Sanity Check"; show the descriptive part.
      const parts = b.title.split('—');
      const label = parts.length > 1 ? parts.slice(1).join('—').trim() : b.title;
      return `<a href="#block-${i}">${escapeHtml(label)}</a>`;
    })
    .join('');

  const sections = blocks
    .map(
      (b, i) => `<details class="block" id="block-${i}" ${i === 0 ? 'open' : ''}>
        <summary>${escapeHtml(b.title)}</summary>
        <div class="block-body">${mdToHtml(b.body)}</div>
      </details>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)} — BizBuyBot</title>
<style>
${PAGE_CSS}
</style>
</head>
<body>
<div class="wrap">
  <div class="toplink"><a href="/">← back to dashboard</a></div>
  <h1 class="name">${escapeHtml(name)}</h1>
  <div class="meta">${escapeHtml(deal.id)} · evaluated ${escapeHtml(deal.date)} · ${escapeHtml(deal.location || '')}${footer.archetype ? ' · ' + escapeHtml(footer.archetype) : ''}</div>
  ${listingUrl ? `<div class="listing-line"><a href="${escapeHtml(listingUrl)}" target="_blank" rel="noopener">View original listing ↗</a><span class="listing-url">${escapeHtml(listingUrl)}</span></div>` : ''}
  <div class="badges">
    <span class="badge accent">${escapeHtml(deal.status)}</span>
    ${footer.risk_tier ? `<span class="${riskTierClass}">${escapeHtml(footer.risk_tier)}</span>` : ''}
    ${benchmark ? `<span class="badge">benchmark ${Number(benchmark.sde_multiple_min).toFixed(1)}x–${Number(benchmark.sde_multiple_max).toFixed(1)}x ${escapeHtml(benchmark.category)}</span>` : ''}
    <a class="badge" href="/${encodeURIComponent(deal.report)}">raw markdown ↗</a>
  </div>

  ${artifactNav}

  <div class="hero">
    <div>${scoreGauge(score)}</div>
    <div class="charts"><div>${valuationBand(Number(footer.multiple ?? parseFloat(String(deal.multiple||'').replace(/x$/,''))), benchmark)}</div></div>
    <div class="cards">${metricCards}</div>
  </div>

  ${risks}

  ${benchPanel}

  <nav class="blocknav">${blockNav}</nav>
  ${sections}
</div>
</body>
</html>`;
}
