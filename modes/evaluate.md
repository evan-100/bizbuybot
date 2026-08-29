# `evaluate.md` — Pure A-F Evaluation Mode

> This mode produces only the A-F evaluation report for a listing. It does not generate DD checklists, outreach drafts, or tracker entries — use `modes/auto-pipeline.md` for the full flow, or run `modes/dd.md` / `modes/outreach.md` afterward.

---

## Inputs

- A listing URL, OR
- Pasted listing text, OR
- A deal ID (e.g., `003`) referring to an existing row in `data/acquisitions.md` — in this case, locate the linked report in `reports/` and re-evaluate (overwrite).

---

## Execution Steps

### Step 1 — Read the Core Rules

Read these files in order (paths relative to the project root):
1. `modes/_shared.md` — scoring rubric, A-F block structure, YAML footer, financial sanity rules.
2. `modes/_profile.md` — buyer thesis and BTM scoring procedure.
3. `modes/_custom.md` — apply any active user rules.
4. `templates/benchmarks.yml` — benchmark SDE multiples by category.
5. `config/profile.yml` (or `config/profile.example.yml` if `config/profile.yml` does not exist).
6. `templates/states.yml` — for reference (the evaluation does not transition states, but the recommended action maps to states).

### Step 2 — Parse the Listing

Extract and normalize these fields (use `null` if unavailable, and flag the gap in Block F):
- `business_name`, `asking_price`, `revenue`, `sde`, `category`, `location`
- `inventory`, `ffe`, `real_estate` (Leased/Owned + expiration date), `lease_term_remaining`
- `url`, `source` (BizBuySell, BizQuest, direct, paste)

If `asking_price` or `sde` is missing, halt with an error — these are required to compute the multiple.

### Step 3 — Determine the Deal ID and Filename

- If the input is a deal ID, use it directly.
- Otherwise, read `data/acquisitions.md`, find the highest deal ID in the `#` column, and use `String(max + 1).padStart(3, '0')`.
- Compute the slug: lowercase the business name, replace non-alphanumeric runs with `-`, trim hyphens, truncate to 60 chars.
- Today's date in `YYYY-MM-DD` (use the system date).
- Target filename: `reports/{NNN}-{slug}-{date}.md`.

### Step 4 — Apply Financial Sanity Rules

Per `modes/_shared.md` Section 5:
1. Recompute `multiple = asking_price / sde` (round to one decimal).
2. Audit add-backs. For each add-back claimed in the listing, judge defensibility. Subtract indefensible add-backs from SDE to get **adjusted SDE**. Recompute the multiple on adjusted SDE.
3. Compute DSCR at the standard SBA 7(a) stack:
   - Buyer cash equity = 10% of asking price.
   - Seller note (standby) = 10–15% of asking price.
   - SBA 7(a) term loan = 75–80% of asking price, at ~11% annual rate, 10-year amortization.
   - `DSCR = adjusted_sde / annual_debt_service`. Flag if < 1.4.
4. Compute cash-on-cash return: `adjusted_sde / buyer_cash_equity_at_close`. Flag if < 20%.
5. Compute rent ratio if rent and revenue are available. Flag if >10% (or >15% for prime retail).

### Step 5 — Look Up the Benchmark

Prefer `data/local-benchmarks.yml` when present (values carry `scope` and `fallback_reason` — cite scope, disclose fallbacks). Find the matching category in `templates/benchmarks.yml`. If not present, use "General Main Street" (2.0x–3.2x SDE). Record `sde_multiple_min`, `sde_multiple_max`, `typical_sde_margin`, and `notes`.

### Step 6 — Score the Five Dimensions

Score each dimension 1–5 integer per the anchors in `modes/_shared.md` Section 1:
1. Financial Quality (FQ)
2. Valuation & Multiples (VM)
3. Operational Risk & Transferability (ORT)
4. Growth & Value-Creation Levers (GVC)
5. Buyer Thesis & Financing Match (BTM) — per `modes/_profile.md`.

### Step 7 — Compute the Holistic Global Score

Apply the holistic judgment rules in `modes/_shared.md` Section 2. Produce a single decimal 1.0–5.0.
- Apply hard-blocker caps (customer >25% of revenue, lease <1 year, DSCR < 1.0 → cap at 3.0 or below).
- Apply Block F legitimacy cap (High Risk / Suspicious → cap at 2.5).
- Do NOT arithmetic-average the five dimensions.

### Step 8 — Write the Report

Produce a Markdown report with this exact structure:

```markdown
# {NNN} — {Business Name} — Evaluation Report

**Date:** {YYYY-MM-DD}
**Listing URL:** {url}
**Category:** {category}  |  **Location:** {location}

## Block A — Business & Deal Summary
...

## Block B — Financial Analysis & Multiple Sanity Check
...

## Block C — Operational & Transferability Risk Audit
...

## Block D — Post-Acquisition Value Creation (100-Day Plan)
...

## Block E — Deal Structuring & Financing Thesis
...

## Block F — Listing Legitimacy & Red Flag Tier
...
```

Then terminate the file with the YAML footer (per `modes/_shared.md` Section 4). Nothing follows the footer.

Write to `reports/{NNN}-{slug}-{date}.md`.

### Step 9 — Terminal Summary

Print:

```
BizBuyBot Evaluation — {NNN}
  Business:   {name}
  Score:      {score}/5  ({label})
  Multiple:   {multiple}x  (benchmark: {min}x–{max}x)
  DSCR:       {dscr}  ({Strong/Good/Acceptable/Strained/Infeasible})
  Risk Tier:  {tier}
  Action:     {Proceed to Outreach | Watchlist | Pass}
  Report:     reports/{NNN}-{slug}-{date}.md
```

---

## Re-Evaluation

If the input is an existing deal ID, overwrite the existing report file at its linked path (read the `Report` column in `data/acquisitions.md` for that row). Do not create a new ID. Note in Block A that this is a re-evaluation and the previous score.
