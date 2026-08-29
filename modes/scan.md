# `scan.md` — Marketplace Scanning Mode

> This mode runs the marketplace scanner to discover new listings and triage which to evaluate. It invokes the deterministic `scan.mjs` script (no LLM tokens spent on scraping).

---

## Inputs

- None (uses `portals.yml` configuration).

To evaluate a specific listing URL, use `/bizbuybot <URL>` (the `modes/auto-pipeline.md` flow) instead of this mode.

---

## Execution Steps

### Step 1 — Verify Portal Configuration

- Read `portals.yml` (gitignored; falls back to `templates/portals.example.yml` if absent).
- Confirm at least one `search_queries` entry exists and at least one provider is `enabled: true`.
- If `portals.yml` is missing, instruct the user to copy `templates/portals.example.yml` to `portals.yml` and customize.

### Step 2 — Run the Scanner

Run the deterministic scanner from the project root:

```bash
node scan.mjs
```

This script:
- Reads `portals.yml` for search queries and filters.
- Uses Playwright to fetch search engine results and listing pages.
- Parses listings via the registered providers (`providers/bizbuysell.mjs`, `providers/bizquest.mjs`).
- Deduplicates against `data/scan-history.tsv` (skips listings already seen).
- Appends new listings to `data/pipeline.md` under `## Pending`.
- Appends new rows to `data/scan-history.tsv`.
- Prints a summary of new vs. skipped listings.

The `--data-dir=<path>` flag is supported (defaults to `data/`).

`scan.mjs` runs all queries configured in `portals.yml`. It does not accept a single-URL argument — to evaluate a specific listing, pass its URL or pasted text directly to `/bizbuybot` (the `modes/auto-pipeline.md` flow), which fetches and parses the listing via the AI CLI's web fetch capability.

### Step 3 — Review the Scanner Output

`scan.mjs` prints a summary table (date, queries, added/skipped/errors) plus one row per new listing with Asking / SDE / Multiple / Location / Title / Source, followed by skip reasons and errors. Read it carefully.

### Step 4 — Walk the User Through the Findings

Present the results as a readable markdown table in chat, then triage. Do not just paste the raw terminal output — walk the user through it:

1. **Show the new listings table:**

   ```markdown
   | # | Business | Location | Asking | SDE | Mult | Source |
   |---|----------|----------|--------|-----|------|--------|
   | 1 | Prime Plaza Laundromat | Houston, TX | $520,000 | $180,000 | 2.9x | bizbuysell |
   ```

   Include every new listing (not just the first 10). Link each title to its listing URL.

2. **Triage against the buyer profile** (`config/profile.yml`, or `config/profile.example.yml` if absent). For each listing check:
   - Asking price within `deal_criteria.target_asking_price_range`?
   - Category in `industries.preferred` (and not in `industries.excluded`)?
   - Location in `geography.preferred_states` / `preferred_metro` (or `open_to_relocate: true`)?
   - Multiple vs `data/local-benchmarks.yml` if present, else `templates/benchmarks.yml`, for its category — flag anything above the benchmark high end.

3. **Give a verdict per row:** ✅ strong fit · 🟡 worth a look · 🔴 poor fit — with a one-line rationale referencing the profile criterion or benchmark that drove it.

4. **Recommend the top 3–5 candidates** for full A-F evaluation, ranked, with rationale.

5. **Note skips and errors briefly:** one line summarizing why listings were skipped (dupes dominate — that's healthy) and any provider errors worth attention.

6. **End with next actions:**

   ```
   Next steps:
     /bizbuybot <listing-url>   — evaluate a listing (A-F report + tracker entry)
     /bizbuybot scan            — run this scan again later
   ```

### Step 5 — Terminal Summary

After the walkthrough, print the scanner's own summary block (it is already well-formatted). If the user wants to proceed immediately, offer to run `/bizbuybot <url>` on the top candidate.

### Step 6 — (Optional) Bulk Evaluate

If the user requests bulk evaluation, run `modes/auto-pipeline.md` for each top candidate in sequence. This is token-intensive — confirm with the user first.

---

## Notes

- `scan.mjs` is deterministic and uses Playwright. If Playwright is not installed, the script will fail with a clear error — instruct the user to run `npm install` and `npx playwright install chromium`.
- The scanner does not evaluate listings. Evaluation is a separate LLM step (via `modes/evaluate.md` or `modes/auto-pipeline.md`).
- If a provider fails, the scanner continues with the other providers and reports the failure in the summary.
- Do not modify `data/scan-history.tsv` or `data/pipeline.md` manually — the script is the only writer.
