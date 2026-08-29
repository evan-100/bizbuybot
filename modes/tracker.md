# `tracker.md` — Pipeline Management Mode

> This mode summarizes the current deal pipeline, runs health checks, and guides status updates. It invokes the deterministic `verify-pipeline.mjs`, `export-pipeline.mjs`, and `set-status.mjs` scripts.

---

## Inputs

- None (shows full pipeline summary), OR
- A deal ID (shows that deal's status and recent transitions).

---

## Execution Steps

### Step 1 — Run the Health Check

Run the deterministic pipeline verifier:

```bash
node verify-pipeline.mjs
```

This script checks:
- Column count consistency in `data/acquisitions.md`.
- Sequential, non-duplicate deal IDs.
- Valid date format (`YYYY-MM-DD`).
- Valid status values (per `templates/states.yml`).
- Multiple consistency (`asking_price / sde` matches the `Multiple` column).
- `data/status-log.tsv` row integrity (5 fields per row).

Read the output:
- If healthy: `Pipeline healthy. {N} deals checked.`
- If issues: a list of issues with deal IDs. Report these to the user and suggest fixes.

### Step 2 — Read the Deal Tracker

Read `data/acquisitions.md`. Parse the Markdown table into deal objects with the columns defined in `DATA_CONTRACT.md`: `#`, `Date`, `Business`, `Category`, `Location`, `Asking Price`, `Cash Flow (SDE)`, `Multiple`, `Score`, `Status`, `Report`, `Notes`.

### Step 3 — Read the Status Log

Read `data/status-log.tsv`. Parse the tab-delimited rows (after the header) into transition records: `timestamp`, `deal_id`, `from_status`, `to_status`, `reason`.

### Step 4 — Summarize the Pipeline

Produce a structured summary:

```
BizBuyBot Pipeline Summary — {YYYY-MM-DD}
=========================================

Health: {Healthy | N issues}
Total deals: {N}
By status:
  Evaluated:        {N}
  Outreach_Sent:    {N}
  Under_Review:     {N}
  LOI_Submitted:    {N}
  Under_LOI:        {N}
  Due_Diligence:    {N}
  Closing:          {N}
  Closed:           {N}
  Passed:           {N}
  Watchlist:        {N}

Active deals (not terminal):
  {id} | {business} | {status} | {score}/5 | {asking} | {last transition date}

Recent status transitions (last 10):
  {timestamp} | {id} | {from} → {to} | {reason}

Average score (active): {avg}/5
Average multiple (active): {avg}x
```

### Step 5 — Deal-Specific View (if a deal ID is given)

If the user passed a deal ID, show the full record for that deal:

```
Deal {NNN} — {Business}
  Category:     {category}
  Location:     {location}
  Asking:       {asking}  | SDE: {sde}  | Multiple: {multiple}
  Score:        {score}/5  | Status: {status}
  Report:       {report path}
  Notes:        {notes}

Status history:
  {timestamp} | {from} → {to} | {reason}
  ...

Allowed next statuses: {list from templates/states.yml for the current status}
```

Read `templates/states.yml` to determine the allowed next statuses for the current state. Do not guess — read the `next` array for the current state.

### Step 6 — Guide Status Updates

If the user wants to update a deal's status, guide them through the deterministic command:

```bash
node set-status.mjs <id> <new_status> --reason="<reason>"
```

Rules:
- `<new_status>` must be in the `next` array for the current state in `templates/states.yml`.
- The script validates the transition and writes to `data/status-log.tsv` automatically.
- If the transition is invalid, the script exits with an error listing allowed transitions — relay this to the user.
- Always include a `--reason` for auditability.

Common transitions:
- `Evaluated → Outreach_Sent` (after sending the outreach draft)
- `Outreach_Sent → Under_Review` (after the broker responds)
- `Under_Review → LOI_Submitted` (after submitting the LOI from `modes/loi.md`)
- `LOI_Submitted → Under_LOI` (after the seller accepts the LOI)
- `Under_LOI → Due_Diligence` (when formal DD begins, using the checklist from `modes/dd.md`)
- `Due_Diligence → Closing` (when DD completes and financing is finalized)
- `Closing → Closed` (deal closed)
- Any active state → `Passed` (deal rejected)
- Any active state → `Watchlist` (parked for monitoring)
- `Watchlist → Outreach_Sent` (re-activated)

### Step 7 — Export (if requested)

If the user wants to export the pipeline:

```bash
node export-pipeline.mjs --format=csv
node export-pipeline.mjs --format=json
```

This prints to stdout. Instruct the user to redirect to a file if needed (e.g., `node export-pipeline.mjs --format=csv > pipeline-export.csv`).

### Step 8 — Terminal Summary

Print the pipeline summary from Step 4 (or the deal-specific view from Step 5) followed by:

```
Next actions:
  - To update a status: `node set-status.mjs <id> <new_status> --reason="..."`
  - To export: `node export-pipeline.mjs --format=csv|json`
  - To re-verify: `node verify-pipeline.mjs`
  - To evaluate a new listing: `/bizbuybot <URL>` or `/bizbuybot evaluate`
```

---

## Notes

- This mode is read-mostly. The only writes are via `set-status.mjs` (which the user must authorize) and `export-pipeline.mjs` (which writes to stdout, not a file).
- Do not modify `data/acquisitions.md` or `data/status-log.tsv` directly — always use the deterministic scripts.
- If `verify-pipeline.mjs` reports issues, prioritize fixing them before any status updates. Common fixes:
  - Invalid status: run `node set-status.mjs <id> <valid_status>` (the script will reject invalid targets).
  - Multiple mismatch: this usually means the row was hand-edited; recompute and correct the `Multiple` column, or re-run `add-entry.mjs` (do not hand-edit unless unavoidable).
  - ID sequence gap: indicates a deleted row; advise the user on whether to renumber (risky — see `DATA_CONTRACT.md` "Report IDs are immutable") or leave the gap.
