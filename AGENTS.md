# BizBuyBot — AI CLI Instructions

## What Is BizBuyBot

BizBuyBot is an AI-powered business acquisition command center for Small Main Street businesses. It helps a buyer find, evaluate, and manage business listings from marketplace sites like BizBuySell and BizQuest. The system produces A-F evaluation reports, due diligence checklists, broker outreach drafts, and letters of intent, all tracked in a structured deal pipeline.

## How to Use It

### Command Suite

The user interacts with BizBuyBot through slash commands:

| Command | Action |
|---|---|
| `/bizbuybot` | Display interactive menu of available commands and pipeline summary |
| `/bizbuybot <URL or text>` | Run auto-pipeline (Fetch → A-F Eval → Tracker entry) |
| `/bizbuybot setup` | Set up or edit your buyer profile (interactive interview) |
| `/bizbuybot scan` | Scrape BizBuySell/BizQuest for deals matching criteria |
| `/bizbuybot loi <slug or ID>` | Generate customized Letter of Intent |
| `/bizbuybot dd <slug or ID>` | Generate tailored Due Diligence Checklist |
| `/bizbuybot outreach <slug or ID>` | Generate Broker/Seller initial inquiry email |
| `/bizbuybot tracker` | Summarize current acquisition pipeline metrics |
| `/bizbuybot export` | Export pipeline to CSV or JSON |

### How Modes Work

Each command maps to a **mode file** in `modes/`. When a command is invoked, read the corresponding `modes/*.md` file and execute its instructions step by step. Modes reference other files (`modes/_shared.md`, `modes/_profile.md`, `templates/*`, `config/profile.yml`, `data/*`) — read those as instructed.

The routing logic is defined in `.agents/skills/bizbuybot/SKILL.md`. Key routing rules:

- No argument → show menu + pipeline summary (`modes/tracker.md`).
- URL or pasted text → `modes/auto-pipeline.md` (fetch → evaluate → tracker entry).
- Subcommand (`setup`, `scan`, `loi`, `dd`, `outreach`, `tracker`) → corresponding mode file. `export` → `modes/tracker.md` Step 7.

### Human-in-the-Loop Principle

BizBuyBot evaluates and drafts. The user decides and acts. **Never submit, send, or commit anything on the user's behalf.** Reports, outreach drafts, and LOIs are drafts for the user to review and act on. Status transitions are recommended, not automatic — the user must authorize them.

## Data Contract

BizBuyBot enforces a strict **two-layer separation** between system code and user data. See `DATA_CONTRACT.md` for the full contract.

### User Layer (preserved across updates)

| File | Description |
|---|---|
| `config/profile.yml` | Active buyer profile (financial capacity, deal criteria, preferences). Gitignored. |
| `buyer-profile.md` | Free-form buyer narrative and investment thesis. Gitignored. |
| `portals.yml` | Active portal search criteria. Gitignored. |
| `data/acquisitions.md` | Canonical deal tracker — one row per evaluated business. |
| `data/pipeline.md` | Scrape inbox — raw leads pending evaluation. |
| `data/scan-history.tsv` | Deduplication index for scraped listings. |
| `data/status-log.tsv` | Audit ledger of all deal status transitions. |
| `data/local-benchmarks.yml` | Generated per-user benchmark overlay (gitignored). |
| `reports/*.md` | Generated deal reports and artifacts. |

### System Layer (version-controlled, read-only to user)

| File | Description |
|---|---|
| `modes/*.md` | A-F evaluation prompt specs and pipeline modes. |
| `providers/*.mjs` | Marketplace scrapers (BizBuySell, BizQuest). |
| `templates/*.yml` & `templates/*.md` | State definitions, benchmarks, LOI/DD templates. |
| `lib/*.mjs` & `*.mjs` | Deterministic JS scripts (CLI tools, utilities). |
| `DATA_CONTRACT.md` | The data contract. |

Never modify system-layer files from user actions. Never hand-write data that a deterministic script manages.

## Actions

Keep it simple for the user. Never recommend a full `node *.mjs` or `npm run ...` command — use the short action names below, and run them yourself when that's useful and safe.

| Action | What it does |
|---|---|
| `add` | Append a deal to the tracker (auto-assigns ID, computes multiple) |
| `status` | Transition a deal to a new status (validated + audited) |
| `verify` | Check pipeline integrity (IDs, dates, statuses, multiples, log rows) |
| `export` / `export json` | Print the tracker as CSV (default) or JSON |
| `scan` | Scrape marketplaces → dedupe → append new leads |
| `dashboard` | Open the browser pipeline dashboard |
| `doctor` | Check setup health |
| `benchmarks` | Recalibrate local benchmarks (metro revenue, state margins) |
| `fetch` | Fetch a listing page via the local browser |

For the args-heavy ones, describe them in plain words instead of flags:
- `add` a deal → "Add a deal: business name, category, location, asking price, cash flow." Build the call from the listing you parsed.
- `status` a deal → "Update status: the deal ID, the new status, and a short reason." Use a status from `templates/states.yml`.
- `fetch` a listing → pass the listing URL.

## Onboarding

Start a new buyer the friction-free way instead of asking them to edit files:

1. Ask them to run `npm install` in the repo.
2. Run `doctor` — if anything's missing, fix or report it.
3. Tell them to invoke `/bizbuybot setup` in their AI CLI — the interview writes their profile, portals, and thesis for them.
4. Offer `benchmarks` during setup if they want local calibration.
5. Mention `scan` needs Chromium: `npx playwright install chromium`.
