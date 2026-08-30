# `dd.md` — Due Diligence Checklist Generation Mode

> This mode generates a tailored due diligence checklist from `templates/dd-checklist-base.md`, customized to the business category and risks flagged in the evaluation report. Output: `reports/{NNN}-dd-checklist.md`.

---

## Inputs

- A deal ID (e.g., `003`), OR
- A business slug matching a report in `reports/`.

---

## Execution Steps

### Step 1 — Locate the Evaluation Report

- If a deal ID is given, read `data/acquisitions.md`, find the row, and read the `Report` column for the evaluation report path.
- If a slug is given, find `reports/{NNN}-{slug}-*.md` in `reports/`.
- Read the evaluation report, especially:
  - Block A (category, archetype).
  - Block B (financial findings — which financial DD items to emphasize).
  - Block C (operational risks — which operational DD items to emphasize).
  - Block F (red flags — items to prioritize).
  - The YAML footer (`key_risks`, `archetype`, `risk_tier`, `business_name`).

### Step 2 — Read the Base Checklist

Read `templates/dd-checklist-base.md`. This is the comprehensive ~50-item base across five sections: Financial, Operational, Legal, Market, Closing & Transition.

### Step 3 — Tailor the Checklist

Apply these tailoring rules:

1. **Include all Financial items (A1–A16).** These are non-negotiable for every deal.
2. **Include all Legal items (C1–C12).** These are non-negotiable for every deal.
3. **Include all Operational items (B1–B14)** but reorder/prioritize by archetype:
   - **Asset-Heavy** (laundromat, car wash, auto repair): prioritize B1 (equipment inventory & age), B2 (maintenance logs), B12 (vehicle titles).
   - **Route Service** (commercial cleaning, HVAC, plumbing): prioritize B5 (customer concentration), B6 (customer contracts), B7 (supplier contracts).
   - **Retail/Trade**: prioritize B11 (inventory count), B9/B10 (lease & assignability), B14 (marketing channels).
   - **Food/Hospitality**: prioritize B3/B4 (employees & payroll — turnover risk), B14 (reputation & reviews).
4. **Include all Market items (D1–D8)** but add archetype-specific emphasis in the "What to look for" notes.
5. **Include all Closing & Transition items (E1–E5).**

For each `key_risk` in the YAML footer, add a prioritized callout at the top of the relevant section:

```markdown
> **Priority — flagged risk:** {risk text from YAML footer}
> Focus on items {relevant item IDs} below. This risk was identified in the evaluation report.
```

### Step 4 — Add Archetype-Specific Items

Add 2–5 archetype-specific items based on the business category. Examples:

- **Laundromat:** equipment age audit by machine serial number, utility cost trend (water/sewer/gas/electric), coin vs. card revenue mix, attendant staffing model.
- **Car Wash:** tunnel vs. self-serve equipment audit, chemical supply contracts, water reclamation system condition, real estate environmental assessment.
- **HVAC:** recurring service agreement (RSA) revenue breakdown, technician certifications, van and equipment value, service area map.
- **Plumbing:** license transferability with the state board, journeyman roster, truck inventory, emergency service call volume.
- **Commercial Cleaning:** contract renewal calendar, employee turnover rate, bonding & insurance, customer concentration by contract.
- **Auto Repair:** ASE certifications, lift equipment audit, parts inventory turnover, shop equipment liens.

### Step 5 — Add the Header

Prepend a header to the checklist:

```markdown
# Due Diligence Checklist — {Business Name} (Deal {NNN})

**Generated:** {YYYY-MM-DD}
**Source evaluation:** `reports/{NNN}-{slug}-{date}.md`
**Category:** {category}
**Risk tier:** {risk_tier}
**Key risks flagged:** {list from YAML footer}

> Mark each item as `[ ]` (not yet requested), `[~]` (requested, pending), or `[x]` (received and reviewed). Items marked **Priority** correspond to risks flagged in the evaluation report.

---
```

### Step 6 — Write the Output

Write the tailored checklist to `reports/{NNN}-dd-checklist.md` (no slug or date — just the ID, per `DATA_CONTRACT.md`).

### Step 7 — Terminal Summary

Print:

```
BizBuyBot DD Checklist — {NNN}
  Business:     {name}
  Category:     {category}
  Risk tier:    {risk_tier}
  Priority items: {count} (from flagged risks)
  Total items:  {count}
  Output:       reports/{NNN}-dd-checklist.md
  Next: Use this checklist during due diligence. Tell me to mark the deal as in due diligence when DD formally begins.
```

---

## Notes

- The DD checklist is a working document. The buyer updates the `[ ]` / `[~]` / `[x]` status as items are requested and received. BizBuyBot does not auto-update these statuses.
- If the evaluation report is missing (e.g., the user runs `dd` before `evaluate`), halt with an error and instruct the user to run `modes/evaluate.md` first.
- Do not invent items beyond the base template and the archetype-specific additions above. The base template is comprehensive.
