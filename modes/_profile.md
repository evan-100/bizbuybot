# `_profile.md` — Buyer Thesis & Financing Match Scoring

> This file defines how to read the buyer profile and score the **Buyer Thesis & Financing Match** dimension (Dimension 5 in `modes/_shared.md`).

---

## 1. Read the Buyer Profile

Read `config/profile.yml`. If it does not exist, read `config/profile.example.yml` and treat all fields as defaults/unconfigured. Note this clearly in the report — an unconfigured profile means the BTM score is provisional.

The profile schema (see `config/profile.example.yml`):

```yaml
identity:
  name: "..."
  role: "..."
  background: "..."
financial:
  budget_range: { min, max }
  cash_down_payment: <number>
  financing_approach: "SBA 7(a)" | "conventional" | "seller-financed" | "all-cash"
  pre_qualified: <bool>
  max_dscr_target: 1.4
skills:
  industries: [...]
  management_experience: <years>
  technical_skills: [...]
  certifications: [...]
geography:
  preferred_states: [...]
  preferred_metro: [...]
  open_to_relocate: <bool>
  max_commute_minutes: <number>
industries:
  preferred: [...]
  excluded: [...]
  involvement_level: "full-time owner-operator" | "semi-absentee" | "investor"
deal_criteria:
  target_asking_price_range: { min, max }
  target_sde_range: { min, max }
  max_multiple: <number>
  min_cash_flow_margin: <number>
  requires_real_estate: <bool>
  max_employee_count: <number>
```

---

## 2. Build the Buyer Thesis

Synthesize the profile into a 2–3 sentence thesis statement that will appear in Block A of the report:

> "The buyer is a [involvement_level] seeking [industry preferences] in [geography], with [$cash_down_payment] liquid for a down payment and [financing_approach] financing. Target deal size: $[min]–$[max] asking, $[sde_min]–$[sde_max] SDE, max [max_multiple]x multiple. Skills: [technical_skills]. Excluded industries: [excluded]."

If the profile is unconfigured (reading the example file), state: "Buyer profile is unconfigured — using default example profile. BTM score is provisional."

---

## 3. Score Buyer Thesis & Financing Match (1–5)

Evaluate the listing against each of the following checks. A mismatch on any single check is not necessarily fatal — weigh them holistically.

### Check 3.1 — Price & Budget Fit
- Listing asking price within `financial.budget_range` and `deal_criteria.target_asking_price_range`?
- Buyer's `cash_down_payment` sufficient for a 10% equity contribution at the asking price?
- If asking price > budget max or buyer cash < 10% of asking price → major mismatch.

### Check 3.2 — Financing Feasibility (DSCR)
- Compute DSCR at the standard SBA 7(a) stack using `financial.cash_down_payment`, adjusted SDE from Block B, and `financial.max_dscr_target` as the floor.
- If DSCR < `max_dscr_target` (default 1.4) → financing strained.
- If `financial.financing_approach` is "all-cash" or "seller-financed", recompute the relevant structure instead.

### Check 3.3 — Industry Fit
- Is the business category in `industries.preferred`? (+)
- Is it in `industries.excluded`? (hard negative — recommend BTM ≤ 2)
- Does the buyer's `skills.industries` include this category? (+)
- Does the buyer hold any `skills.certifications` required to operate it (e.g., EPA 608 for HVAC, contractor license for plumbing)? (+)

### Check 3.4 — Geography Fit
- Is the listing location in `geography.preferred_states` or `geography.preferred_metro`? (+)
- If `geography.open_to_relocate` is false and the location is outside preferences → major mismatch.
- Compute commute if a metro is specified and `max_commute_minutes` is set. (Heuristic: if outside the preferred metro, treat as exceeding the commute cap unless `open_to_relocate` is true.)

### Check 3.5 — Involvement Level Fit
- Does the business's operational profile match `industries.involvement_level`?
  - "full-time owner-operator" → business must require an owner-operator (not a pure absentee play).
  - "semi-absentee" → business must be runnable with a manager in place.
  - "investor" → business must be fully manager-run with verified manager tenure.
- A mismatch here is a structural problem (the buyer cannot or will not run the business as required).

### Check 3.6 — Deal Criteria Hard Filters
- Multiple ≤ `deal_criteria.max_multiple`?
- SDE margin ≥ `deal_criteria.min_cash_flow_margin`?
- Employee count ≤ `deal_criteria.max_employee_count`?
- Real estate ownership required (`requires_real_estate: true`) and the deal is lease-only? → hard mismatch.

### Check 3.7 — Skills Match
- Do the buyer's `technical_skills` overlap with the skills needed to run or grow this business (per Block D)?
- `skills.management_experience` relative to the business's employee count and complexity.

---

## 4. Produce the BTM Score

Summarize the checks in a short paragraph in Block A or E (the report body), then assign a 1–5 integer using the anchors in `modes/_shared.md` Section 1 (Buyer Thesis & Financing Match). Use this guidance:

- **5:** Passes all checks; clear thesis fit; financing comfortable (DSCR ≥ 1.4 with margin).
- **4:** Passes all but one minor check; financing feasible (DSCR ≥ 1.4 at structure).
- **3:** One material mismatch (e.g., outside preferred geography but buyer open to relocate; or industry not in preferred but not excluded); financing feasible.
- **2:** Multiple mismatches or financing strained (DSCR < 1.4 at standard structure but salvageable with restructuring).
- **1:** Hard mismatch — excluded industry, or asking price far above budget, or DSCR < 1.0, or involvement level incompatible.

The BTM score feeds into the holistic global score per `modes/_shared.md` Section 2.

---

## 5. Output: Buyer Thesis Statement

Include the buyer thesis statement in Block A of the evaluation report (one or two sentences after the TL;DR). Also include the BTM score and a one-line rationale in Block E.

The `financing_fit` field in the YAML footer is derived from Check 3.2 (DSCR feasibility):
- DSCR ≥ 1.6 → "Strong"
- DSCR 1.4–1.59 → "Good"
- DSCR 1.2–1.39 → "Acceptable"
- DSCR 1.0–1.19 → "Strained"
- DSCR < 1.0 → "Infeasible"
