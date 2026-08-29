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

## Deterministic Scripts

These scripts are the canonical writers for their respective data files. Always use them instead of hand-editing.

### `add-entry.mjs`

Appends a deal to `data/acquisitions.md`. Auto-assigns the next sequential ID and computes the SDE multiple.

```bash
node add-entry.mjs \
  --business="<name>" \
  --category="<category>" \
  --location="<city, ST>" \
  --price=<asking_price> \
  --sde=<sde> \
  [--score=<1.0-5.0>] \
  [--status="Evaluated"] \
  [--report="<path>"] \
  [--notes="<text>"] \
  [--data-dir=<path>]
```

### `set-status.mjs`

Transitions a deal to a new status. Validates the transition against `templates/states.yml` and logs to `data/status-log.tsv`.

```bash
node set-status.mjs <id> <new_status> [--reason="..."] [--data-dir=<path>]
```

### `verify-pipeline.mjs`

Validates pipeline integrity: column counts, sequential IDs, date formats, status validity, multiple consistency, and status-log row integrity.

```bash
node verify-pipeline.mjs [--data-dir=<path>]
```

### `export-pipeline.mjs`

Exports the deal tracker to CSV or JSON (printed to stdout).

```bash
node export-pipeline.mjs --format=csv|json [--data-dir=<path>]
```

### `scan.mjs`

Scrapes marketplace search results, applies filters, deduplicates, and appends new listings to `data/pipeline.md` and `data/scan-history.tsv`.

```bash
node scan.mjs [--data-dir=<path>]
```

### `dashboard.mjs`

Serves the browser dashboard for the deal pipeline at `http://localhost:4826`. Reads only from `data/acquisitions.md` and serves linked reports read-only. Opens the browser automatically unless `--no-open` is passed.

```bash
node dashboard.mjs [--port=<port>] [--no-open] [--data-dir=<path>]
```

When launched by an agent, start it detached (`nohup node dashboard.mjs --no-open ... &`) — never in the foreground.

### `doctor.mjs`

Checks setup health: verifies required directories, system files, data files, and dependencies exist.

```bash
node doctor.mjs [--root=<path>]
```

### `build-benchmarks.mjs`

Derives per-user local benchmarks (metro revenue, state margins) into `data/local-benchmarks.yml` from Census SUSB + IRS SOI data. Opt-in at setup.

```bash
node build-benchmarks.mjs [--force] [--dry-run] [--data-dir=<path>]
```

## Onboarding

To set up BizBuyBot for a new buyer:

1. Copy `config/profile.example.yml` → `config/profile.yml` and fill in your financial capacity, skills, geography, and deal criteria.
2. Copy `templates/portals.example.yml` → `portals.yml` (at the project root) and customize search queries and filters.
3. Copy `buyer-profile.example.md` → `buyer-profile.md` (at the project root) and customize with your free-form investment thesis and background narrative.
4. Run `npm install` to install dependencies (playwright, js-yaml, dotenv).
5. Run `npm run doctor` to verify the setup is complete.
6. Run `npx playwright install chromium` if you plan to use the scan feature.
