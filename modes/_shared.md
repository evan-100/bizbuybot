# `_shared.md` — Core Evaluation Rules

> This file defines the scoring rubric and report structure that **every** BizBuyBot A-F evaluation follows. Every evaluation mode (`modes/evaluate.md`, `modes/auto-pipeline.md`) must read and apply these rules. Do not skip sections.

---

## 1. Scoring Dimensions (each 1–5, integer)

Score each dimension on a 1–5 integer scale. Use the anchors below.

### Financial Quality (FQ)
Assesses cash flow stability, historical revenue consistency, add-back defensibility, and SDE margins.

| Score | Anchor |
|---|---|
| 5 | 3+ years stable or growing revenue, SDE margin at/above industry benchmark, add-backs fully documented and defensible |
| 4 | Solid financials, minor add-back questions, SDE margin in line with benchmark |
| 3 | Some volatility, partial add-back support, SDE margin slightly below benchmark |
| 2 | Material volatility, aggressive add-backs, margin below benchmark |
| 1 | Declining revenue, unsubstantiated SDE, or accounting irregularities |

### Valuation & Multiples (VM)
Assesses the asking-price SDE multiple against industry benchmarks from `templates/benchmarks.yml`.

| Score | Anchor |
|---|---|
| 5 | Multiple at or below the low end of the benchmark range |
| 4 | Multiple within the lower half of the benchmark range |
| 3 | Multiple in the middle of the benchmark range |
| 2 | Multiple in the upper half of the benchmark range |
| 1 | Multiple above the high end of the benchmark range |

If the business category is not in `templates/benchmarks.yml`, use the "General Main Street" benchmark (2.0x–3.2x SDE). Prefer `data/local-benchmarks.yml` when present (values carry `scope` and `fallback_reason` — cite scope, disclose fallbacks).

### Operational Risk & Transferability (ORT)
Assesses key-man risk, customer concentration, lease risk, and supplier dependency.

| Score | Anchor |
|---|---|
| 5 | Fully transferable — documented SOPs, dispersed customer base (no customer >10% of revenue), long lease (≥5 years), multiple suppliers |
| 4 | Transferable with minor intervention — some SOPs, customer base diversified, lease ≥3 years, alternative suppliers available |
| 3 | Moderate key-man risk — owner-dependent in some functions, one customer 10–15% of revenue, lease 1–3 years |
| 2 | High key-man risk — owner is the business, customer concentration >15%, lease <1 year or month-to-month, single-source supplier |
| 1 | Non-transferable — business cannot operate without current owner, or a single customer >25% of revenue |

### Growth & Value-Creation Levers (GVC)
Assesses margin expansion, technology modernization, digital presence, pricing, and cross-selling opportunities.

| Score | Anchor |
|---|---|
| 5 | Multiple obvious, high-ROI levers (no online presence, no pricing optimization, no cross-selling) that the buyer can execute in 100 days |
| 4 | Clear growth levers with moderate effort and reasonable risk |
| 3 | Some levers exist but require capital or skill the buyer may not have |
| 2 | Limited levers, market saturated, or levers require significant investment |
| 1 | No realistic growth levers, market declining |

### Buyer Thesis & Financing Match (BTM)
Assesses alignment with the buyer profile in `config/profile.yml` — see `modes/_profile.md` for the scoring procedure.

| Score | Anchor |
|---|---|
| 5 | Ideal fit — within budget, matches buyer skills and geography, financing feasibility high (DSCR ≥ 1.4 at structure) |
| 4 | Good fit — minor mismatches, financing feasible with reasonable structure |
| 3 | Acceptable fit — one material mismatch (geography, skills, or financing), still viable |
| 2 | Poor fit — multiple mismatches, financing strained (DSCR < 1.4 at standard structure) |
| 1 | No fit — outside budget, wrong geography, wrong industry, financing infeasible |

---

## 2. Holistic Global Score (1.0–5.0)

The global score is a **holistic judgment**, NOT an arithmetic average of the five dimensions. Output a single decimal number between 1.0 and 5.0 (one decimal place).

Guidance:
- A single hard blocker (e.g., a customer >25% of revenue, a lease expiring in 60 days, DSCR < 1.0) should cap the global score at or below 3.0 regardless of other dimensions.
- The Listing Legitimacy tier (Block F) can cap the global score. "High Risk / Suspicious" caps the score at 2.5.
- A deal with strong financials and growth but a poor buyer fit should not score above 4.0 — the buyer's ability to execute matters.
- When in doubt, score conservatively. The cost of a false positive (overpaying for a bad business) is much higher than the cost of a false negative (passing on a marginal deal).

### Score Interpretation

| Range | Label | Recommended Action |
|---|---|---|
| 4.5–5.0 | Strong | Proceed to outreach and LOI immediately |
| 4.0–4.4 | Good | Proceed to outreach; note any caveats in the report |
| 3.5–3.9 | Decent | Watchlist; pursue only if buyer thesis strongly aligns |
| < 3.5 | Recommend Against | Pass; document the reasons in the report |

---

## 3. A-F Report Block Structure

Every evaluation report must contain Blocks A through F in this exact order, followed by the YAML footer. Do not add or remove blocks.

### Block A — Business & Deal Summary
- **Archetype / Category:** e.g., Route Service, Asset-Heavy, Retail/Trade, Food/Hospitality.
- **Listing source & URL.**
- **Key metrics:** Asking Price, Gross Revenue, Cash Flow (SDE), Inventory, FF&E, Real Estate (Leased/Owned, expiration date).
- **TL;DR:** 2–3 sentence executive summary of the deal and the headline recommendation.
- **Hard Blocker Checks:** Explicit yes/no on each — customer concentration >15%, lease <1 year remaining, DSCR < 1.4 at standard structure, SDE multiple above benchmark high end, key-man risk that prevents transfer.

### Block B — Financial Analysis & Multiple Sanity Check
- **SDE Multiple Calculation:** `Asking Price / Cash Flow (SDE)`, shown as a formula and result.
- **Add-back audit:** Identify suspicious lifestyle write-offs, aggressive owner salary add-backs, or one-time items presented as recurring. Flag the adjusted (defensible) SDE if add-backs are questionable.
- **Multiple comparison:** Compare the computed multiple to the benchmark range from `templates/benchmarks.yml` for this category. State whether the asking price is below, within, or above the benchmark range.
- **Financial sanity rules (apply all):**
  - Recompute SDE multiple from asking price and stated SDE.
  - Adjust SDE downward for any indefensible add-backs; recompute multiple on adjusted SDE.
  - Compute DSCR at a standard SBA 7(a) capital stack (10% buyer cash equity, 10–15% seller note on standby, 75–80% SBA term loan at ~11% over 10 years). Target DSCR ≥ 1.4.
  - Compute cash-on-cash return in year 1 on the buyer's cash equity at closing.
- **Rent as % of gross revenue** (target <10% for most categories; up to 15% for prime retail).

### Block C — Operational & Transferability Risk Audit
- **Key-man risk assessment:** Can the business run if the owner leaves tomorrow? Identify owner-only functions.
- **Customer concentration:** Does any single customer represent >15% of revenue? State the top customer's revenue share if known.
- **Facility & lease:** Term remaining, renewal options, rent as % of gross revenue, assignability.
- **Supplier dependency:** Single-source suppliers, change-of-control clauses, pricing tied to seller relationship.
- **Employee tenure & retention risk:** Any key employee whose departure would materially hurt the business.

### Block D — Post-Acquisition Value Creation (100-Day Plan)
- **3–5 immediate operational quick wins** (e.g., SEO, online booking, dynamic pricing, CRM cleanup). For each: action, expected impact, effort level.
- **Medium-term growth levers** (3–12 months): service line expansion, cross-selling, geographic expansion, acquisitions.
- **Technology / digital gap analysis:** Identify modernization opportunities (POS, scheduling, marketing automation).

### Block E — Deal Structuring & Financing Thesis
- **Indicative capital stack:** 10% Buyer Cash Equity, 10–15% Seller Note on Standby, 75–80% SBA 7(a) Term Loan. State dollar amounts.
- **Projected DSCR:** Compute on the adjusted SDE. Goal ≥ 1.4x. Show the formula.
- **Target Anchor Valuation:** The multiple × adjusted SDE at which the buyer would open negotiation (typically at or below the low end of the benchmark range).
- **Walk-Away Ceiling:** The maximum price the buyer should pay, considering DSCR floor, working capital needs, and post-close capex.

### Block F — Listing Legitimacy & Red Flag Tier
- **Legitimacy tier (one of):** `High Confidence` | `Proceed with Caution` | `High Risk / Suspicious`.
- **Red flag checks:** vague broker language, mismatched revenue claims (P&L vs. tax returns vs. bank deposits), stale listing re-posts (listing age >180 days with price cuts), missing financials, broker refusing NDA, pressure tactics.
- **Specific red flags found:** List each, with the evidence.

---

## 4. Machine-Readable YAML Footer

Every evaluation report MUST terminate with a fenced YAML block. No text after the footer. Use exactly these keys:

```yaml
---
bizbuybot:
  business_name: "<string>"
  asking_price: <number>
  revenue: <number>
  sde: <number>
  ebitda: <number>
  revenue_estimated: <boolean>
  sde_estimated: <boolean>
  ebitda_estimated: <boolean>
  multiple: <number>
  score: <number>
  risk_tier: "High Confidence" | "Proceed with Caution" | "High Risk / Suspicious"
  archetype: "<string>"
  recommended_action: "Proceed to Outreach" | "Watchlist" | "Pass"
  key_risks:
    - "<risk 1>"
    - "<risk 2>"
  financing_fit: "Strong" | "Good" | "Acceptable" | "Strained" | "Infeasible"
---
```

Rules:
- `asking_price`, `revenue`, `sde`, `multiple`, `score` are numbers (not strings).
- `revenue_estimated` / `sde_estimated` / `ebitda_estimated` are booleans. Set `true` whenever the figure is NOT directly disclosed by the seller — provisional estimates derived from margins, rules of thumb, or industry defaults MUST be flagged. When omitted, the value is treated as seller-disclosed. Never present an estimate as a disclosed figure.
- `ebitda` is OPTIONAL: include it ONLY when the seller directly discloses an EBITDA figure. Otherwise omit the key entirely — never derive, estimate, or invent EBITDA. This is a premium-valuation metric for larger, professionally-run deals; Main Street listings rarely report it.
- `score` is the holistic global score (1.0–5.0).
- `multiple` is the adjusted SDE multiple (one decimal, no "x").
- `key_risks` is a non-empty list of 1–5 short strings.
- `recommended_action` follows the score interpretation table in Section 2.
- The footer is the last content in the file. Nothing follows.

---

## 5. Financial Sanity Rules (always apply)

1. **Recompute SDE multiple:** `multiple = asking_price / sde`. Round to one decimal.
2. **Audit add-backs:** For each add-back in the listing, judge defensibility. Owner salary above replacement cost, personal auto, personal insurance, one-time expenses presented as recurring — subtract these from SDE. Recompute the multiple on **adjusted SDE**.
3. **DSCR computation:** Use the standard SBA 7(a) stack (10% buyer equity, 10–15% seller note on standby, 75–80% SBA term loan). Assume an SBA 7(a) rate of ~11% on a 10-year amortization for the SBA portion. `DSCR = adjusted_sde / annual_debt_service`. Flag if DSCR < 1.4.
4. **Cash-on-cash return:** `year_1_cash_flow / buyer_cash_equity_at_close`. Flag if < 20%.
5. **Rent ratio:** `annual_rent / gross_revenue`. Flag if >10% (or >15% for prime retail).
6. **Working capital:** Estimate the working capital peg from AR + inventory − AP. Flag if the buyer must inject working capital at close.

---

## 6. Reference Files

When evaluating, read these files (path relative to the project root):
- `templates/benchmarks.yml` — industry SDE multiple ranges for Block B comparison.
- `templates/states.yml` — valid deal states (used by downstream modes, not the evaluation itself).
- `config/profile.yml` — buyer profile (see `modes/_profile.md`). If `config/profile.yml` does not exist, read `config/profile.example.yml` and note that the profile is unconfigured (this downgrades Buyer Thesis & Financing Match scoring to default/neutral).
- `modes/_custom.md` — user house rules. Apply any active rules (see that file).
