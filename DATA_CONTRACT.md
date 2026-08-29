# BizBuyBot Data Contract

## Purpose

This document defines the strict separation between system code and user state in BizBuyBot. All participants (human and AI) must respect this contract.

---

## Two-Layer Separation

### USER LAYER (Preserved across updates; gitignored or personal)

These files belong to the user. They survive system updates, are never overwritten by tooling, and are excluded from version control where noted.

| File | Description | Gitignored? |
|---|---|---|
| `config/profile.yml` | Active buyer profile (financial capacity, deal criteria, preferences) | Yes |
| `buyer-profile.md` | Free-form buyer narrative and investment thesis | Yes |
| `portals.yml` | Active portal search criteria (derived from `templates/portals.example.yml`) | Yes |
| `data/acquisitions.md` | Canonical deal tracker — one row per evaluated business | No (user data, but committed as seed) |
| `data/pipeline.md` | Scrape inbox — raw leads pending evaluation | No (user data, but committed as seed) |
| `data/scan-history.tsv` | Deduplication index for scraped listings | No |
| `data/status-log.tsv` | Audit ledger of all deal status transitions | No |
| `data/local-benchmarks.yml` | Generated per-user benchmark overlay (metro revenue, state margins) | Yes |
| `data/cache/` | Generated federal-data cache; never committed | Yes |
| `reports/*.md` | Generated deal reports and artifacts (eval reports, DD checklists, outreach, LOIs) | No |

### SYSTEM LAYER (Deterministic engine & prompt logic)

These files are part of the BizBuyBot system. They are version-controlled and updated by the project. User code must never modify these files.

| File | Description |
|---|---|
| `AGENTS.md`, `OPENCODE.md`, `CLAUDE.md` | AI CLI system rules and thin wrappers |
| `.agents/skills/bizbuybot/SKILL.md` | Unified Skill Router |
| `modes/*.md` | A-F evaluation prompt specs and pipeline modes |
| `providers/*.mjs` | Marketplace scrapers (BizBuySell, BizQuest) |
| `templates/*.yml` & `templates/*.md` | State definitions, benchmarks, LOI/DD templates |
| `lib/*.mjs` & `*.mjs` | Deterministic JS scripts (CLI tools, utilities) |
| `DATA_CONTRACT.md` | This file |

---

## Schema Definitions

### `data/acquisitions.md`

Canonical deal tracker. One Markdown table row per evaluated business.

**Columns:**

| Column | Description |
|---|---|
| `#` | Zero-padded deal ID (001, 002, ...) |
| `Date` | Evaluation date (YYYY-MM-DD) |
| `Business` | Business name or short description |
| `Category` | Business archetype (Laundromat, HVAC, Car Wash, etc.) |
| `Location` | City, State |
| `Asking Price` | Listed asking price (USD) |
| `Cash Flow (SDE)` | Seller's Discretionary Earnings (USD) |
| `Multiple` | Asking Price / SDE (decimal, e.g. 2.8x) |
| `Score` | Holistic A-F evaluation score (1.0–5.0) |
| `Status` | Current deal lifecycle state (see `templates/states.yml`) |
| `Report` | Relative link to the generated report in `reports/` |
| `Notes` | Free-text summary |

**Example row:**

```markdown
| # | Date | Business | Category | Location | Asking Price | Cash Flow (SDE) | Multiple | Score | Status | Report | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 001 | 2026-08-22 | Metro Laundromat | Laundromat | Austin, TX | $450,000 | $160,000 | 2.8x | 4.4/5 | Evaluated | [001-metro-laundromat](../reports/001-metro-laundromat-2026-08-22.md) | High SDE margin, long lease |
```

### `data/pipeline.md`

Raw lead inbox. URLs and brief metadata for listings discovered via scraping or manual entry.

**Structure:**

```markdown
## Pending
- [ ] <url> | <title> | <location> | Asking: <price>

## Processed
- [x] #<deal-id> | <url> | <business> | <location> | <score>/5 | <status> <artifact-icon>
```

### `data/scan-history.tsv`

Tab-delimited deduplication index for scraped listings. One row per unique listing discovered.

**Columns (TSV header):**

```
listing_id	url	title	asking_price	sde	source	first_seen
```

### `data/status-log.tsv`

Tab-delimited audit ledger recording every deal status transition.

**Columns (TSV header):**

```
timestamp	deal_id	from_status	to_status	reason
```

### `reports/`

Generated deal artifacts. File naming convention:

| Pattern | Description |
|---|---|
| `reports/{NNN}-{slug}-{date}.md` | A-F evaluation report |
| `reports/{NNN}-dd-checklist.md` | Due diligence checklist |
| `reports/{NNN}-outreach.md` | Broker/seller outreach draft |
| `reports/{NNN}-loi.md` | Letter of intent draft |

Every evaluation report terminates with a machine-readable YAML metadata footer for automated parsing.

---

## Guarantees

1. **System files are read-only to the user layer.** User scripts and AI agents must never modify system-layer files.
2. **User data is append-mostly.** The canonical tracker (`acquisitions.md`) and pipeline (`pipeline.md`) are appended to, not rewritten. Status transitions update the `Status` column in-place but are always logged to `status-log.tsv`.
3. **Report IDs are immutable.** Once a deal ID is assigned, it never changes.
4. **All status transitions are auditable.** Every change to a deal's status must produce a `status-log.tsv` entry.
5. **Deduplication is enforced.** No listing may appear twice in `scan-history.tsv`; `listing_id` is the unique key.
