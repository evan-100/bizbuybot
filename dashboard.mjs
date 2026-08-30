#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseRows } from './lib/parse-rows.mjs';
import { findArtifacts, renderArtifactPage, renderReportPage, ARTIFACT_DEFS } from './lib/report-view.mjs';
import { loadBenchmarks } from './lib/benchmarks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PORT = 4826;

const ACTIVE_STATUSES = new Set([
  'Evaluated', 'Outreach_Sent', 'Under_Review', 'LOI_Submitted', 'Under_LOI', 'Due_Diligence', 'Closing',
]);
const DONE_STATUSES = new Set(['Closed', 'Passed']);

export function loadDeals(dataDir) {
  const trackerPath = path.join(dataDir, 'acquisitions.md');
  if (!fs.existsSync(trackerPath)) return [];
  const content = fs.readFileSync(trackerPath, 'utf-8');
  return parseRows(content)
    .filter((cells) => cells.length >= 12)
    .map((cells) => ({
      id: cells[0],
      date: cells[1],
      business: cells[2],
      category: cells[3],
      location: cells[4],
      askingPrice: cells[5],
      sde: cells[6],
      multiple: cells[7],
      score: cells[8],
      status: cells[9],
      report: cells[10],
      notes: cells[11],
    }));
}

export function filterDeals(deals, tabKey) {
  if (tabKey === 'all') return deals;
  if (tabKey === 'active') return deals.filter((d) => ACTIVE_STATUSES.has(d.status));
  if (tabKey === 'watchlist') return deals.filter((d) => d.status === 'Watchlist');
  if (tabKey === 'done') return deals.filter((d) => DONE_STATUSES.has(d.status));
  return deals;
}

function numericScore(scoreCell) {
  const n = parseFloat(String(scoreCell || '').replace(/\/5$/, ''));
  return Number.isFinite(n) ? n : -1;
}

function numericMoney(cell) {
  const n = parseFloat(String(cell || '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : -1;
}

function numericMultiple(cell) {
  const n = parseFloat(String(cell || '').replace(/x$/, ''));
  return Number.isFinite(n) ? n : -1;
}

export function sortDeals(deals, sortMode) {
  const sorted = [...deals];
  switch (sortMode) {
    case 'score':
      sorted.sort((a, b) => numericScore(b.score) - numericScore(a.score));
      break;
    case 'date':
      sorted.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      break;
    case 'price':
      sorted.sort((a, b) => numericMoney(b.askingPrice) - numericMoney(a.askingPrice));
      break;
    case 'multiple':
      sorted.sort((a, b) => numericMultiple(a.multiple) - numericMultiple(b.multiple));
      break;
    default:
      break;
  }
  return sorted;
}

// ---------- Web server ----------

const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BizBuyBot Dashboard</title>
<style>
  :root {
    --bg: #1e1e2e; --surface: #181825; --panel: #313244; --text: #cdd6f4;
    --muted: #6c7086; --green: #a6e3a1; --red: #f38ba8; --cyan: #94e2d5;
    --yellow: #f9e2af; --accent: #89b4fa; --border: #45475a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  header { padding: 20px 28px 8px; display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
  h1 { font-size: 18px; margin: 0; }
  .sub { color: var(--muted); font-size: 12px; }
  .controls { padding: 12px 28px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .tabs { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .tab { padding: 6px 14px; cursor: pointer; color: var(--muted); background: transparent; border: none;
         font-size: 13px; border-right: 1px solid var(--border); }
  .tab:last-child { border-right: none; }
  .tab.active { background: var(--panel); color: var(--text); }
  input[type=search], select { background: var(--surface); color: var(--text); border: 1px solid var(--border);
         border-radius: 8px; padding: 6px 10px; font-size: 13px; outline: none; }
  input[type=search]:focus, select:focus { border-color: var(--accent); }
  main { padding: 0 28px 40px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: var(--muted); font-weight: 600; font-size: 11px;
       text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 10px;
       border-bottom: 1px solid var(--border); white-space: nowrap; }
  th.sortable { cursor: pointer; user-select: none; }
  th.sortable:hover { color: var(--text); }
  td { padding: 9px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  tr.deal { cursor: pointer; }
  tr.deal:hover td { background: var(--panel); }
  tr.selected td { background: var(--panel); }
  .biz { max-width: 340px; overflow: hidden; text-overflow: ellipsis; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px;
           border: 1px solid var(--border); color: var(--muted); }
  .badge.active { color: var(--accent); border-color: var(--accent); }
  .badge.watchlist { color: var(--cyan); border-color: var(--cyan); }
  .badge.closed { color: var(--green); border-color: var(--green); }
  .badge.passed { color: var(--red); border-color: var(--red); }
  .score-hi { color: var(--green); font-weight: 600; }
  .score-mid { color: var(--yellow); }
  .score-lo { color: var(--red); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .empty { color: var(--muted); padding: 32px 0; text-align: center; }
  #preview { position: fixed; left: 0; right: 0; bottom: 0; height: 42vh; background: var(--surface);
             border-top: 1px solid var(--border); transform: translateY(100%); transition: transform .18s ease;
             display: flex; flex-direction: column; }
  #preview.open { transform: translateY(0); }
  #preview-bar { display: flex; justify-content: space-between; align-items: center;
                 padding: 8px 20px; border-bottom: 1px solid var(--border); }
  #preview-title { font-weight: 600; font-size: 13px; }
  #preview-close { background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; }
  #preview-body { overflow: auto; padding: 12px 20px; margin: 0; font: 12px/1.55 ui-monospace, Menlo, monospace;
                  color: var(--text); white-space: pre-wrap; }
</style>
</head>
<body>
<header>
  <h1>BizBuyBot Dashboard</h1>
  <span class="sub" id="stats"></span>
</header>
<div class="controls">
  <div class="tabs" id="tabs"></div>
  <input type="search" id="search" placeholder="Search business, category, location…">
  <select id="sort">
    <option value="score">Sort: Score</option>
    <option value="date">Sort: Date</option>
    <option value="price">Sort: Price</option>
    <option value="multiple">Sort: Multiple</option>
  </select>
</div>
<main>
  <table>
    <thead><tr>
      <th>#</th><th>Date</th><th>Business</th><th>Category</th><th>Location</th>
      <th>Asking</th><th>SDE</th><th>Mult</th><th>Score</th><th>Status</th><th></th>
    </tr></thead>
    <tbody id="rows"></tbody>
  </table>
  <div class="empty" id="empty" hidden>No deals match this view.</div>
</main>
<div id="preview">
  <div id="preview-bar">
    <span id="preview-title"></span>
    <span><a id="report-link" href="#" style="margin-right:14px">open report ↗</a>
          <button id="preview-close" aria-label="Close">×</button></span>
  </div>
  <pre id="preview-body"></pre>
</div>
<script>
const TABS = [["all","All"],["active","Active"],["watchlist","Watchlist"],["done","Passed/Closed"]];
let deals = [], tab = "all", q = "", sortMode = "score", selectedId = null;

const ACTIVE = new Set(["Evaluated","Outreach_Sent","Under_Review","LOI_Submitted","Under_LOI","Due_Diligence","Closing"]);
const DONE = new Set(["Closed","Passed"]);

function num(v) { const n = parseFloat(String(v||"").replace(/[$,]/g,"").replace(/(\\/5|x)$/,"")); return Number.isFinite(n) ? n : -1; }

async function init() {
  deals = await (await fetch("/api/deals")).json();
  renderTabs();
  document.getElementById("search").addEventListener("input", e => { q = e.target.value.toLowerCase(); render(); });
  document.getElementById("sort").addEventListener("change", e => { sortMode = e.target.value; render(); });
  document.getElementById("preview-close").addEventListener("click", closePreview);
  render();
}
function tabDeals() {
  if (tab === "active") return deals.filter(d => ACTIVE.has(d.status));
  if (tab === "watchlist") return deals.filter(d => d.status === "Watchlist");
  if (tab === "done") return deals.filter(d => DONE.has(d.status));
  return deals;
}
function renderTabs() {
  const el = document.getElementById("tabs");
  el.innerHTML = "";
  for (const [key,label] of TABS) {
    const b = document.createElement("button");
    b.className = "tab" + (key===tab ? " active" : "");
    b.textContent = label;
    b.onclick = () => { tab = key; renderTabs(); render(); };
    el.appendChild(b);
  }
}
function statusClass(s) {
  if (s === "Closed") return "closed";
  if (s === "Passed") return "passed";
  if (s === "Watchlist") return "watchlist";
  return "active";
}
function scoreClass(v) { return v >= 4 ? "score-hi" : v >= 3.5 ? "score-mid" : v >= 0 ? "score-lo" : ""; }
function render() {
  let rows = tabDeals().filter(d =>
    !q || [d.business,d.category,d.location].join(" ").toLowerCase().includes(q));
  rows = rows.slice().sort((a,b) => {
    if (sortMode === "date") return String(b.date).localeCompare(String(a.date));
    if (sortMode === "price") return num(b.askingPrice) - num(a.askingPrice);
    if (sortMode === "multiple") return num(a.multiple) - num(b.multiple);
    return num(b.score) - num(a.score);
  });

  document.getElementById("stats").textContent =
    deals.length + " deals · " +
    deals.filter(d=>ACTIVE.has(d.status)).length + " active · " +
    deals.filter(d=>d.status==="Watchlist").length + " watchlist";

  const tbody = document.getElementById("rows");
  tbody.innerHTML = "";
  document.getElementById("empty").hidden = rows.length > 0;

  for (const d of rows) {
    const tr = document.createElement("tr");
    tr.className = "deal" + (d.id === selectedId ? " selected" : "");
    const sv = num(d.score);
    tr.innerHTML =
      "<td>" + d.id + "</td>" +
      "<td>" + d.date + "</td>" +
      '<td class="biz" title="' + d.notes.replace(/"/g,"&quot;") + '">' + d.business + "</td>" +
      "<td>" + d.category + "</td>" +
      "<td>" + d.location + "</td>" +
      "<td>" + d.askingPrice + "</td>" +
      "<td>" + d.sde + "</td>" +
      "<td>" + d.multiple + "</td>" +
      '<td class="' + scoreClass(sv) + '">' + d.score + "</td>" +
      '<td><span class="badge ' + statusClass(d.status) + '">' + d.status + "</span></td>" +
      "<td>" + (d.report ? '<a href="/deal/' + d.id + '">report ↗</a>' : "") + "</td>";
    tr.onclick = (e) => { if (e.target.tagName !== "A") togglePreview(d); };
    tbody.appendChild(tr);
  }
}
async function togglePreview(d) {
  const p = document.getElementById("preview");
  if (selectedId === d.id && p.classList.contains("open")) return closePreview();
  selectedId = d.id;
  render();
  document.getElementById("preview-title").textContent = d.id + " — " + d.business;
  const link = document.getElementById("report-link");
  if (d.report) {
    link.href = "/deal/" + d.id;
    link.style.display = "";
    const body = document.getElementById("preview-body");
    body.textContent = "Loading…";
    p.classList.add("open");
    try {
      const res = await fetch("/" + encodeURIComponent(d.report));
      body.textContent = await res.text();
    } catch { body.textContent = "Failed to load report."; }
  } else {
    link.style.display = "none";
    document.getElementById("preview-body").textContent = "No report linked.";
    p.classList.add("open");
  }
}
function closePreview() {
  document.getElementById("preview").classList.remove("open");
  selectedId = null; render();
}
init();
</script>
</body>
</html>`;

function safeReportPath(dataDir, encodedName) {
  const name = decodeURIComponent(encodedName);
  if (!name.endsWith('.md')) return null;
  const reportsDir = path.resolve(dataDir, '..', 'reports');
  const resolved = path.resolve(reportsDir, path.basename(name));
  if (!resolved.startsWith(reportsDir + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

export function startServer({ port = DEFAULT_PORT, dataDir } = {}) {
  // Benchmarks live at <root>/data/local-benchmarks.yml; derive the root from
  // dataDir the same way build-benchmarks.mjs does so a relocated data dir gets
  // the same localized overlay the CLI wrote (defaults to the install root).
  const benchmarkRoot = path.resolve(dataDir || path.join(__dirname, 'data'), '..');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/deals') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadDeals(dataDir)));
      return;
    }

    // Deal detail page: /deal/001
    const dealMatch = url.pathname.match(/^\/deal\/([a-z0-9]+)$/i);
    if (dealMatch) {
      const id = dealMatch[1].padStart(3, '0');
      const deal = loadDeals(dataDir).find((d) => d.id === id);
      if (!deal || !deal.report) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Deal not found');
        return;
      }
      const reportPath = safeReportPath(dataDir, deal.report);
      if (!reportPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Report not found');
        return;
      }
      const { benchmarks } = loadBenchmarks(benchmarkRoot);
      const reportsDir = path.resolve(dataDir, '..', 'reports');
      const artifacts = findArtifacts(reportsDir, deal.id);
      const html = renderReportPage({
        deal,
        reportMd: fs.readFileSync(reportPath, 'utf-8'),
        benchmarks,
        artifacts,
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // Deal artifact page: /deal/001/dd | /deal/001/loi | /deal/001/outreach
    const artifactMatch = url.pathname.match(/^\/deal\/([a-z0-9]+)\/(dd|loi|outreach)$/i);
    if (artifactMatch) {
      const id = artifactMatch[1].padStart(3, '0');
      const kind = artifactMatch[2].toLowerCase();
      const deal = loadDeals(dataDir).find((d) => d.id === id);
      const def = ARTIFACT_DEFS.find((a) => a.kind === kind);
      if (!deal || !def) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const file = `${id}-${def.suffix}.md`;
      const artifactPath = safeReportPath(dataDir, `reports/${file}`);
      if (!artifactPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const html = renderArtifactPage({
        deal,
        kind,
        label: def.label,
        file,
        md: fs.readFileSync(artifactPath, 'utf-8'),
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE_HTML);
      return;
    }

    // Serve linked reports: /reports%2F001-foo.md or /reports/001-foo.md
    const match = url.pathname.match(/^\/(reports%2F|reports\/)(.+)$/i);
    if (match) {
      const filePath = safeReportPath(dataDir, match[2]);
      if (filePath) {
        res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
        res.end(fs.readFileSync(filePath));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });
  return server;
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
  } catch {
    // non-fatal — the URL is printed anyway
  }
}

async function main() {
  const args = process.argv.slice(2);
  const portFlag = args.find((a) => a.startsWith('--port='));
  const requested = portFlag ? parseInt(portFlag.split('=')[1], 10) : DEFAULT_PORT;
  const noOpen = args.includes('--no-open');
  const dataDirFlag = args.find((a) => a.startsWith('--data-dir='));
  const dataDir = dataDirFlag ? dataDirFlag.split('=')[1] : path.join(__dirname, 'data');

  let port = requested;
  let server;
  try {
    server = startServer({ port, dataDir });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err;
    port = await findFreePort(requested);
    console.warn(
      `Port ${requested} is in use by another process (likely a stale dashboard from another copy of the project).` +
        `Starting on the next free port instead: ${port}`,
    );
    server = startServer({ port, dataDir });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
  }

  const url = `http://localhost:${port}`;
  console.log(`BizBuyBot Dashboard running at ${url}`);
  console.log('Press Ctrl+C to stop.');

  if (!noOpen) {
    openBrowser(url);
  }
}

async function findFreePort(from) {
  const { createServer } = await import('node:net');
  for (let p = from + 1; p < from + 50; p++) {
    const ok = await new Promise((resolve) => {
      const s = createServer();
      s.once('error', () => resolve(false));
      s.listen(p, () => s.close(() => resolve(true)));
    });
    if (ok) return p;
  }
  throw new Error('No free port found in a reasonable range');
}
export { findFreePort };

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
