<p align="center">
  <img src="docs/screenshots/hero.png" alt="BizBuyBot — AI-powered business acquisition command center" width="720" />
</p>

<p align="center">
  <strong>Evaluate small-business listings. Generate due-diligence checklists, outreach drafts, and LOIs. Track the deal pipeline — all from your AI coding CLI.</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/CLI-OpenCode%20%C2%B7%20Claude%20Code-%23000" alt="AI CLIs">
  <img src="https://img.shields.io/badge/status-beta-yellow" alt="Status: beta">
</p>

---

Buying a small Main Street business — a laundromat, an HVAC/plumbing contractor, a commercial cleaning company — involves hundreds of listings, most of them filters. BizBuyBot turns any agent-skill-capable AI coding CLI into a **business acquisition command center**: it scans marketplaces, evaluates listings into a structured A-F report with a 1.0–5.0 score, generates the documents you need to act, and tracks every deal in an auditable pipeline.

**Important: this not a "spray and pray" acquisitbot.** BizBuyBot is a filter. It tells you which few businesses out of a batch are actually worth your time, and it drafts the documents — the decisions and the actions (offers, outreach, LOI submission) are always yours.

---

## Features

| Feature | What it does |
|---|---|
| **Auto-Pipeline** | Paste a listing URL or text → fetch → A-F evaluation → tracker entry in one command |
| **A-F Evaluation** | Five scoring dimensions (1–5 each) + a holistic 1.0–5.0 global score; full report with 6 blocks and a machine-readable YAML footer |
| **Industry Benchmarks** | National SDE-multiple ranges per category, upgradeable to **local** metro revenue (US Census SUSB) and state margins (IRS SOI) via `build-benchmarks.mjs` |
| **Due-Diligence Checklists** | Tailored DD checklist per deal, covering financials, lease, employees, and valuation |
| **Broker / Seller Outreach** | Initial inquiry email drafts, tuned to the deal's gaps |
| **Letter of Intent** | Customized LOI drafts from the evaluated deal |
| **Portal Scanner** | Playwright-based scraping of BizBuySell / BizQuest with filters, dedup, and a manual-review inbox |
| **Browser Dashboard** | Filter/sort your pipeline, preview reports and DD/LOI/outreach artifacts at `localhost:4826` |
| **Pipeline Integrity** | Deterministic scripts own every write; status transitions are audited; `verify-pipeline` validates the tracker |
| **Human-in-the-Loop** | BizBuyBot evaluates and drafts. It **never** submits, sends, or commits anything for you. You decide and act |

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- An AI coding CLI that supports agent skills (OpenCode, Claude Code, Codex, Copilot, ...) — you'll run BizBuyBot from inside it
- `npx playwright install chromium` only if you want the **scan** feature

### Install

```bash
git clone https://github.com/evan-100/bizbuybot.git
cd bizbuybot
npm install
```

### Set up

```bash
cp config/profile.example.yml config/profile.yml    # your financial capacity + deal criteria
cp templates/portals.example.yml portals.yml         # search queries for the scanner
cp buyer-profile.example.md buyer-profile.md         # your investment thesis
npm run doctor                                       # validates the whole setup
```

> Everything in `data/` ships as **fictional sample data** so the dashboard, tracker, and reports work immediately. Replace it with your own deals using the scripts — never hand-edit the tracker.

### Run

Open your AI CLI in the `bizbuybot/` directory and use the commands:

```
/bizbuybot                  → interactive menu + pipeline summary
/bizbuybot <URL or text>    → full auto-pipeline
/bizbuybot dashboard        → browser dashboard (localhost:4826)
```

Or launch the dashboard directly:

```bash
npm run dashboard           # opens http://localhost:4826 with sample data
```

### Use It (Your Flow)

```bash
# 1. Find deals meeting your criteria
# 2. Evaluate a listing — paste a URL or pasted listing text:
/bizbuybot https://www.bizbuysell.com/business-opportunity/...
# 3. Read the evaluation — score, multiple, DSCR, red flags
# 4. Act on the good ones:
/bizbuybot dd 001          # due-diligence checklist
/bizbuybot loi 001         # letter of intent draft
/bizbuybot outreach 001    # broker/seller inquiry draft
# 5. Track and verify
/bizbuybot tracker
npm run verify
```

---

## Screenshots

| Pipeline dashboard | Deal report | DD checklist artifact |
|---|---|---|
| ![Pipeline](docs/screenshots/dashboard-pipeline.png) | ![Deal report](docs/screenshots/dashboard-deal.png) | ![DD checklist](docs/screenshots/dashboard-dd.png) |

*Rendered from the included sample data.*

---

## Command Reference

| Command | Action |
|---|---|
| `/bizbuybot` | Show interactive menu of available commands and pipeline summary |
| `/bizbuybot <URL or text>` | Run auto-pipeline (Fetch → A-F Eval → Tracker entry) |
| `/bizbuybot setup` | Set up or edit your buyer profile (interactive interview) |
| `/bizbuybot scan` | Scrape BizBuySell/BizQuest for deals matching criteria |
| `/bizbuybot loi <slug or ID>` | Generate customized Letter of Intent |
| `/bizbuybot dd <slug or ID>` | Generate tailored Due Diligence Checklist |
| `/bizbuybot outreach <slug or ID>` | Generate Broker/Seller initial inquiry email |
| `/bizbuybot tracker` | Summarize current acquisition pipeline metrics |
| `/bizbuybot dashboard` | Browser dashboard (localhost:4826) |
| `/bizbuybot export` | Export pipeline to CSV or JSON |

### Deterministic Scripts

| Script | What it does |
|---|---|
| `node add-entry.mjs --business=... --category=... --price=... --sde=...` | Append a deal to the tracker (auto-assigns ID, computes multiple) |
| `node set-status.mjs 001 Evaluated --reason="..."` | Transition a deal's status with audit logging |
| `node verify-pipeline.mjs` | Validate pipeline integrity |
| `node export-pipeline.mjs --format=csv\|json` | Export the tracker |
| `node scan.mjs` | Scrape marketplaces → dedupe → append leads |
| `node dashboard.mjs [--port=N] [--no-open]` | Browser dashboard |
| `node doctor.mjs` | Check setup health |
| `node build-benchmarks.mjs` | Derive **local** benchmarks from Census + IRS data |

---

## How It Works

Businesses that match your criteria are passed through **mode files** in `modes/` — the prompt specs that drive the A-F rubric, DD checklist generation, LOI drafting, and tracking. Deterministic JavaScript scripts (in `lib/` and the repo root) are the **only writers** to pipeline data, which keeps the tracker auditable and safe.

BizBuyBot enforces a strict **two-layer data contract**:

- **System layer** (version-controlled, read-only to you): `modes/`, `templates/`, `providers/`, `lib/`, the scripts.
- **User layer** (personal, preserved across updates): `config/profile.yml`, `portals.yml`, `buyer-profile.md`, your deal data, and generated reports — these are gitignored or replaced by sample data in this repo.

Read [`DATA_CONTRACT.md`](DATA_CONTRACT.md) for the full contract, and [`AGENTS.md`](AGENTS.md) for the precise AI instructions and script reference.

---

## Methodology Notes

- **SDE multiples** come from `templates/benchmarks.yml` — industry rules-of-thumb (BizBuySell/BizQuest historical, SBA lending norms), directional only.
- **Local benchmark overlay** (`build-benchmarks.mjs`) derives per-user metro revenue averages (US Census SUSB, firms <20 employees) and state margins (IRS SOI Schedule C) and overrides national references when present.
- Every evaluation report ends with a **machine-readable YAML footer** (price, SDE, multiple, score, risks, financing fit) for automated parsing.

---

## License

Distributed under the [MIT License](LICENSE). This project builds on the BizBuySell and BizQuest marketplace data patterns but is not affiliated with either platform. It is intended for evaluating publicly listed businesses only.

---

<p align="center"><small>BizBuyBot evaluates and drafts. You decide and act.</small></p>