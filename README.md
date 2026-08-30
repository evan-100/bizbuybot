<p align="center">
  <img src="docs/screenshots/dashboard-top.png" alt="BizBuyBot — AI-powered business acquisition command center" width="720" />
</p>

<p align="center">
  <strong>Evaluate small-business listings. Generate due-diligence checklists, outreach drafts, and LOIs. Track the deal pipeline — all from your AI coding CLI.</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/CLI-OpenCode%20%C2%B7%20Claude%20Code%20%C2%B7%20Codex-%23000" alt="AI CLIs">
  <img src="https://img.shields.io/badge/status-beta-yellow" alt="Status: beta">
</p>

---

Buying a small Main Street business — a laundromat, an HVAC/plumbing contractor, a commercial cleaning company — starts with hundreds of listings, and most of them aren't worth your time. BizBuyBot turns your AI coding CLI into a buying-side command center: it scans the marketplaces, evaluates listings into an easy-to-read report with a 1.0–5.0 score, drafts the documents you'll need to act, and keeps every deal in one auditable pipeline.

**Important: this isn't a "spray and pray" tool.** BizBuyBot is a filter. It helps you find the handful of listings worth pursuing out of a batch, and it drafts the paperwork — the decisions and the actions (offers, outreach, submission) are always yours.

---

## Features

| Feature | What it does |
|---|---|
| **Auto-Pipeline** | Paste a listing URL or text — get a full evaluation and a tracker entry in one step |
| **A-F Evaluation** | Five scoring dimensions plus a holistic 1.0–5.0 score, with a clear written report you can act on |
| **Industry Benchmarks** | SDE-multiple ranges per business category — and **local benchmarks** pulled from real Census + IRS data for your metro |
| **Due-Diligence Checklists** | A tailored checklist per deal — financials, lease, employees, valuation |
| **Broker / Seller Outreach** | Initial inquiry email drafts, focused on the gaps in each listing |
| **Letter of Intent** | Customized LOI drafts from the evaluated deal |
| **Portal Scanner** | Scrape BizBuySell / BizQuest automatically, with filtering and dedup |
| **Browser Dashboard** | Visualize and manage your pipeline, with every report and draft one click away |
| **Pipeline Integrity** | You never hand-edit records — data is written by safe, repeatable tools, so your pipeline stays auditable |
| **Human-in-the-Loop** | BizBuyBot evaluates and drafts. It **never** submits, sends, or commits anything for you. You decide and act |

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- An AI coding CLI that supports agent skills (OpenCode, Claude Code, Codex, Copilot, ...) — you run BizBuyBot from inside it
- `npx playwright install chromium` — only if you want the **scan** feature

### Install

```bash
git clone https://github.com/evan-100/bizbuybot.git
cd bizbuybot
npm install
npm run doctor     # verifies everything is ready
```

### First Steps

**1. Launch your AI CLI from the project folder.** BizBuyBot runs *inside* your coding agent — open terminal and start **opencode**, **claude**, or **codex** (whichever you use):

```bash
opencode        # or: claude, or: codex
```

**2. Run the command inside the agent.** Once your CLI is up, type:

```
/bizbuybot           # your first command
```

On first launch it **automatically walks you through setup** — it asks you the buyer-profile questions (budget, target industries, geography, financing) right there in the chat. No separate setup step, no files to edit. You can decline the interview and use provisional defaults if you prefer.

After setup you're ready to go:

```
/bizbuybot                  → menu + pipeline summary
/bizbuybot <URL or text>    → full auto-pipeline (evaluate + track in one step)
/bizbuybot dashboard        → open the browser dashboard  (or: npm run dashboard)
```

### Commands

The `/bizbuybot` command syntax below is how **opencode** invokes it. **Claude Code** and **Codex** load the same BizBuyBot skill (from `.claude/skills/` and `.agents/skills/` respectively) — open their skill picker (Claude: `/skills` or `@bizbuybot`; Codex: `/skills` or `$bizbuybot`) or just describe what you want ("scan for cleaning businesses in Houston").

| Command | Action |
|---|---|
| `/bizbuybot` | Show the interactive menu and pipeline summary |
| `/bizbuybot <URL or text>` | Run auto-pipeline (fetch → evaluate → track) |
| `/bizbuybot setup` | Set up or edit your buyer profile |
| `/bizbuybot scan` | Scrape BizBuySell/BizQuest for deals matching your criteria |
| `/bizbuybot loi <id>` | Generate a customized Letter of Intent |
| `/bizbuybot dd <id>` | Generate a tailored Due Diligence Checklist |
| `/bizbuybot outreach <id>` | Generate a broker/seller inquiry draft |
| `/bizbuybot tracker` | Summarize current pipeline metrics |
| `/bizbuybot dashboard` | Open the browser dashboard |
| `/bizbuybot export` | Export your pipeline data |

### Behind the scenes

BizBuyBot keeps your data safe with a few simple command-line tools — add deals, change statuses, verify the pipeline, export, scan marketplaces, check setup health, and calibrate benchmarks. Quality is enforced by automated tests and a pipeline-integrity check that run on every change.

---

## Screenshots

| Pipeline dashboard | Deal report | Due-diligence checklist |
|---|---|---|
| ![Pipeline](docs/screenshots/dashboard-pipeline.png) | ![Deal report](docs/screenshots/dashboard-deal.png) | ![DD checklist](docs/screenshots/dashboard-dd.png) |

*Example views of the browser dashboard.*

---

## How It Works

Each command maps to a set of instructions (evaluation rubric, checklist template, LOI drafting) that your CLI follows step by step. Safe, repeatable scripts are the only thing that writes to your pipeline — so your records stay clean and auditable.

BizBuyBot also keeps a strict separation between:

- **The system** — the evaluation logic, templates, and tools. Version-controlled, and you don't need to touch it.
- **Your data** — your profile, catchment criteria, and deal records. Personal, and preserved across updates.

Read [`DATA_CONTRACT.md`](DATA_CONTRACT.md) for the full contract, and [`AGENTS.md`](AGENTS.md) for precise AI instructions.

---

## Methodology Notes

- **SDE multiples** come from industry rules-of-thumb (marketplace history, SBA lending norms) — directional, not absolute.
- **Local benchmarks** — during setup you can calibrate benchmarks to your buying area (metro revenue from Census, state margins from IRS), so evaluations compare against *your market* instead of national averages.
- **Source transparency** — every report shows exactly how the score and the multiple were reached, with the sources cited.

---

## License

Distributed under the [MIT License](LICENSE). This project is not affiliated with BizBuySell or BizQuest. It is intended for evaluating publicly listed businesses only.

---

<p align="center"><small>BizBuyBot evaluates and drafts. You decide and act.</small></p>