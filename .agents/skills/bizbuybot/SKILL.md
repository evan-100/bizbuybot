---
name: bizbuybot
description: "AI-powered business acquisition command center for Small Main Street businesses. Evaluates listings, generates due diligence checklists, drafts outreach and LOIs, and tracks the deal pipeline."
---

# BizBuyBot Skill Router

BizBuyBot is an AI-powered business acquisition command center for Small Main Street businesses. It evaluates listings, generates due diligence checklists, drafts outreach and LOIs, and tracks the deal pipeline.

## Command Suite

| Command | Action |
|---|---|
| `/bizbuybot` | Display interactive menu of available commands and pipeline summary |
| `/bizbuybot <URL or text>` | Run auto-pipeline (Scrape -> A-F Eval -> Tracker entry) |
| `/bizbuybot setup` | Set up or edit your buyer profile (interactive interview) |
| `/bizbuybot scan` | Scrape BizBuySell/BizQuest for deals matching criteria |
| `/bizbuybot loi <slug or ID>` | Generate customized Letter of Intent |
| `/bizbuybot dd <slug or ID>` | Generate tailored Due Diligence Checklist |
| `/bizbuybot outreach <slug or ID>` | Generate Broker/Seller initial inquiry email |
| `/bizbuybot tracker` | Summarize current acquisition pipeline metrics |
| `/bizbuybot dashboard` | Open the browser dashboard (localhost:4826) — filter, sort, preview reports |
| `/bizbuybot export` | Export pipeline to CSV or JSON |

## Routing Logic

**Pre-flight check (run before any mode):** if `config/profile.yml` is missing, tell the user their buyer profile isn't set up and ask: *"Run `/bizbuybot setup` first? (evaluations will use provisional defaults until then)"*. Proceed with the requested mode either way if they decline.

Given the user input after `/bizbuybot`, determine which mode to execute:

1. **No argument** (`/bizbuybot`) — Display the command menu above and read `modes/tracker.md` for a pipeline summary. Show the user the available commands and the current pipeline state.

2. **URL or pasted listing text** (`/bizbuybot https://www.bizbuysell.com/...` or `/bizbuybot <listing body>`) — Read and execute `modes/auto-pipeline.md`. This runs the pipeline: fetch/parse the listing, evaluate (A-F report), and add a tracker entry.

3. **Subcommand** — Match the first token and execute the corresponding mode:

   | Token | Mode File |
   |---|---|
   | `setup` | `modes/setup.md` |
   | `scan` | `modes/scan.md` |
   | `loi` | `modes/loi.md` |
   | `dd` | `modes/dd.md` |
   | `outreach` | `modes/outreach.md` |
   | `tracker` | `modes/tracker.md` |
   | `dashboard` | Browser dashboard at localhost:4826 — if not running, start detached (`(nohup node dashboard.mjs ... &)`) and the browser opens automatically; never run it in the foreground |
   | `export` | Read `modes/tracker.md` Step 7 — run `node export-pipeline.mjs --format=csv|json` |

   For `loi`, `dd`, and `outreach`, the second token is the deal ID or slug argument passed to the mode.

4. **Unknown argument** — Show the command menu and ask the user to clarify.

## How to Execute a Mode

When a mode is selected:
1. Read the corresponding `modes/*.md` file.
2. Follow its execution steps exactly, reading any referenced files (`modes/_shared.md`, `modes/_profile.md`, `templates/*`, `config/profile.yml`, `data/*`) as instructed.
3. Use the deterministic scripts (`add-entry.mjs`, `set-status.mjs`, `verify-pipeline.mjs`, `export-pipeline.mjs`, `scan.mjs`, `fetch-listing.mjs`) where the mode instructs — never hand-write data that a script manages.
4. **CRITICAL: For fetching BizBuySell or BizQuest listings, ALWAYS run `node fetch-listing.mjs "<url>" --json` from the project root. NEVER use `webfetch` — Akamai will block it with 403.**
5. Produce the terminal summary the mode specifies.

## Data Contract

BizBuyBot enforces a strict two-layer separation between system files and user data. See `DATA_CONTRACT.md` for the full contract.

- **System layer** (version-controlled, read-only to user): `modes/*.md`, `templates/*`, `lib/*.mjs`, `providers/*.mjs`, `*.mjs` scripts, `DATA_CONTRACT.md`, skill files, `AGENTS.md`.
- **User layer** (personal, gitignored where noted): `config/profile.yml`, `buyer-profile.md`, `portals.yml`, `data/acquisitions.md`, `data/pipeline.md`, `data/scan-history.tsv`, `data/status-log.tsv`, `reports/*.md`.

Never modify system-layer files from user actions. Never submit or send anything on the user's behalf — the system evaluates and drafts; the user decides and acts.
