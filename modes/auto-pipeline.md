# `auto-pipeline.md` — Auto-Pipeline Mode

> Invoked by `/bizbuybot <URL or text>` (with an argument). This mode fetches the listing, runs the A-F evaluation, and adds a tracker entry. Due diligence checklists, outreach drafts, and LOIs are generated on demand via their dedicated commands (`/bizbuybot dd`, `/bizbuybot outreach`, `/bizbuybot loi`).

---

## Inputs

- A listing URL (e.g., `https://www.bizbuysell.com/Business-Opportunity/.../12345/`), OR
- Pasted listing text (the listing body, with asking price, revenue, SDE, location, and category if available).

---

## Execution Steps

### Step 1 — Fetch / Parse the Listing

**IMPORTANT: BizBuySell and BizQuest are protected by Akamai Bot Manager. Do NOT use `webfetch` — it will be blocked with 403 Access Denied.**

- If a **URL** is provided (BizBuySell or BizQuest):
  - Use the `fetch` action with the URL (runs the local Playwright fetcher).
  - It uses a real browser engine (Firefox/WebKit) that bypasses Akamai anti-bot protection.
  - Parse the JSON output: `parsed` contains structured fields (`title`, `price`, `sde`, `revenue`, `location`, `category`, `description`), and `text` contains the full rendered page text.
  - Use the `text` field for additional details not in `parsed` (inventory, FF&E, real estate, lease terms, employees, reason for selling).
  - Note the `source` as the marketplace (BizBuySell, BizQuest, or other) based on the URL domain.
  - If `fetch` fails (returns null or errors), ask the user to paste the listing text directly.
- If **pasted text** is provided: parse the same fields directly from the text.

Extract and normalize into a listing object with these fields (use `null` if unavailable):
- `business_name`, `asking_price`, `revenue`, `sde`, `category`, `location`, `inventory`, `ffe`, `real_estate` (Leased/Owned + expiration), `lease_term_remaining`, `url`, `source`.

### Step 2 — Determine the Next Deal ID

- Read `data/acquisitions.md` and find the highest existing deal ID (the `#` column, zero-padded 3-digit).
- The next ID is `String(max + 1).padStart(3, '0')` (e.g., if max is `003`, next is `004`).
- This ID is used for the report filename and the tracker entry. Do not skip or reuse IDs.

### Step 3 — Evaluate (A-F Report)

Follow `modes/evaluate.md` exactly:
1. Read `modes/_shared.md`, `modes/_profile.md`, `modes/_custom.md`.
2. Read `data/local-benchmarks.yml` if present, else `templates/benchmarks.yml`.
3. Read `config/profile.yml` (or `config/profile.example.yml` if absent).
4. Produce the A-F report (Blocks A–F + YAML footer) per `modes/_shared.md`.
5. Compute the holistic global score (1.0–5.0).
6. Write the report to `reports/{NNN}-{slug}-{date}.md`, where:
   - `{NNN}` = the deal ID from Step 2.
   - `{slug}` = a URL-safe slug of the business name (lowercase, hyphenated, ≤60 chars).
   - `{date}` = today's date in `YYYY-MM-DD` (use the current system date).

### Step 4 — Add the Tracker Entry

Use the `add` action to append the deal to `data/acquisitions.md`. Pass the parsed fields, including:
- business name, category, location
- asking price and SDE (plain numbers)
- the global score from Step 3
- status `Evaluated`
- the report path from Step 3
- a one-line notes summary from the Block A TL;DR

Notes:
- It auto-assigns the ID and computes the multiple. Verify the ID matches Step 2 — if the tracker already advanced, re-read the max ID and adjust.

### Step 5 — Mark the Pipeline Entry as Processed (if applicable)

If the listing came from `data/pipeline.md` (the scrape inbox):
1. Find the matching `[ ]` pending entry.
2. Update it to `[x]` with the deal ID and score, per the pipeline format:
   ```
   - [x] #004 | <url> | <business> | <location> | 4.4/5 | Evaluated 📄
   ```
3. Move it from the `## Pending` section to the `## Processed` section.
4. Do not delete the original URL.

If the listing was a direct URL or pasted text (not from the pipeline), skip this step.

### Step 6 — Terminal Summary

Print a concise summary to the terminal:

```
BizBuyBot Auto-Pipeline — Complete
  Deal ID:      004
  Business:     <name>
  Score:        4.4/5
  Report:       reports/004-<slug>-2026-08-22.md

  Next steps (run on demand):
    /bizbuybot dd 004        — Generate due diligence checklist
    /bizbuybot outreach 004  — Draft broker/seller outreach email
    /bizbuybot loi 004       — Generate letter of intent
```

---

## Error Handling

- If the fetch for a URL fails, ask the user to paste the listing text directly.
- If `config/profile.yml` is missing, use `config/profile.example.yml` and flag BTM as provisional.
- If the listing is missing `sde` or `asking_price`, halt with an error: cannot evaluate without these two fields.
- If `add-entry.mjs` fails (e.g., ID collision), re-read `data/acquisitions.md`, recompute the next ID, and retry.
