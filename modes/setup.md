# `setup.md` — Profile Setup & Edit Mode

> Invoked by `/bizbuybot setup`. Two behaviors:
> - **No profile yet** (`config/profile.yml` missing) → run the full onboarding interview.
> - **Profile exists** → show current values and let the user edit section by section.
>
> This mode WRITES user-layer files (`config/profile.yml`, `portals.yml`, `buyer-profile.md`). It must never touch system-layer files.

---

## Step 1 — Assess Current State

Check which of these exist:

| File | Purpose |
|---|---|
| `config/profile.yml` | Structured buyer profile (drives BTM scoring + triage) |
| `portals.yml` | Marketplace search queries & filters |
| `buyer-profile.md` | Free-form investment thesis narrative |

Report the state, then branch:

- **Nothing set up** → say so and ask: *"Want me to walk you through setup now? Takes ~2 minutes."* If yes → Step 2 (Onboarding). If no → stop, remind them they can run `/bizbuybot setup` anytime.
- **Partially set up** → list what's missing and offer to complete just those pieces (jump to the relevant step).
- **Fully set up** → go to Step 6 (Edit Mode).

## Step 2 — Onboarding Interview

Ask questions **one group at a time**, in plain language. Accept loose answers ("around 500k", "TX or FL", "anything but food service") and normalize them. Never invent values — if the user skips a question, use the same default as `config/profile.example.yml` and note it.

**Group 1 — Identity & Money**
1. Your name? (and one line on your background, if you want it in the profile)
2. What's your all-in budget range for a deal? (total purchase price)
3. How much liquid cash do you have for a down payment?
4. How do you plan to finance? (SBA 7(a) / conventional / seller-financed / all-cash)
5. Been pre-qualified by a lender yet?

**Group 2 — Skills & Involvement**
6. What industries do you know well (work experience, ownership, family business)?
7. Years of management or ownership experience?
8. Operational strengths? (sales, operations, bookkeeping, marketing, trades…)
9. Full-time owner-operator, semi-absentee, or passive investor?

**Group 3 — Geography**
10. Preferred states or metros?
11. Open to relocating for the right deal? Max commute if local?

**Typical values (measure first).** Before asking Group 4, load `templates/benchmarks.yml` and match the industries the user named (via `keywords`; fall back to `General Main Street` for anything unrecognized). Use the matched entries' `sde_benchmark.avg`, `sde_multiple_min/max`, `revenue_benchmark.avg`, and `typical_sde_margin` to ground every "typical / recommended" below. The benchmarks file is the ONLY source — never invent a number. Useful derived figures per matched category:

- **Typical SDE** = `sde_benchmark.avg` (e.g. Laundromat ~$82k, HVAC ~$138k, Commercial Cleaning ~$86k).
- **Recommended SDE floor** = 50% of the lowest matching category's typical SDE (≈ keeps floor from excluding a whole category while still cutting junk). Round to a clean number.
- **Typical asking band** = `sde_benchmark.avg` × `sde_multiple_min` → `sde_benchmark.avg` × `sde_multiple_max` (e.g. Laundromat ~$246k–$369k).
- **Typical multiple band** = `sde_multiple_min` → `sde_multiple_max` for the category.
- **Typical margin** = `typical_sde_margin` (e.g. Car Wash 25–35%).

**Group 4 — Deal Criteria** (offer typicals on each question; user accepts or overrides)
12. Industries you want? Industries to avoid?
13. Sweet-spot asking price range? (defaults to budget range). If unsure, state the typical band for their categories and ask if they want to use it.
14. Minimum cash flow (SDE) you need to live on / service debt? Show the typical SDE for their top category and the recommended floor — e.g. *"A typical HVAC business clears about $138k in SDE. A $70k floor keeps most listings visible; anything higher removes entire categories. Use that, or your own number?"* Also probe a multiple ceiling: typical {category} deals transact at {min}–{max}x SDE — suggest `max_multiple` from the top category.
15. Any hard requirements? (must include real estate, max employees, etc.)

## Step 3 — Generate `config/profile.yml`

Build the YAML **exactly** matching the `config/profile.example.yml` schema (same keys, same nesting):

```yaml
identity:
  name, role, background
financial:
  budget_range: {min, max}, cash_down_payment, financing_approach, pre_qualified, max_dscr_target
skills:
  industries: [], management_experience, technical_skills: [], certifications: []
geography:
  preferred_states: [], preferred_metro: [], open_to_relocate, max_commute_minutes
industries:
  preferred: [], excluded: [], involvement_level
deal_criteria:
  target_asking_price_range: {min, max}, target_sde_range: {min, max},
  max_multiple, min_cash_flow_margin, requires_real_estate, max_employee_count
```

Normalization rules:
- Money → plain integers, no `$`, commas, or "k"/"M" ("around 500k" → `500000`).
- States → two-letter codes (`Texas` → `TX`). Metros → `"City, ST"`.
- `involvement_level` → exactly one of `full-time owner-operator` | `semi-absentee` | `investor`.
- Derive sensible defaults from their answers, preferring the benchmarks-derived typicals when the user had none: `max_dscr_target` → `1.4` unless they say stricter; `target_sde_range.min` → 50% of the lowest matching category's typical SDE (or their stated cash need, whichever is lower) unless they give their own number; `max_multiple` → the highest matching category's `sde_multiple_max` (e.g. Laundromat 4.5x) unless they cap it lower; `min_cash_flow_margin` → the low end of the category's `typical_sde_margin` (e.g. Car Wash 25%).
- **Guardrails — warn, don't silently accept.** Before writing, cross-check against `templates/benchmarks.yml` and flag anything that would starve results; let the user decide whether to keep it or take the typical:
  1. `target_sde_range.min` above the lowest matching category's typical SDE → warn *"this excludes most {category} listings."*
  2. `max_multiple` below the matching category's `sde_multiple_min` → warn *"this rules out nearly every {category} deal."*
  3. `target_asking_price_range` (or budget) entirely above/below that category's typical asking band → warn *"your price range probably misses {category} — typical asking is ~$X–$Y."*

Before writing, validate the generated YAML parses cleanly (you can run a quick parse check locally).

Then show the user the generated file and ask them to confirm (or adjust) before moving on.

## Step 3.5 — Local Benchmark Calibration (offer)

After writing `config/profile.yml`, offer calibration:

> *"Want me to calibrate benchmarks to your metro? This downloads ~50MB of Census data once (cached) plus a small IRS file, so valuations use Orlando-area figures instead of national averages."*

- **Yes** → run the `benchmarks` action, show the resulting per-category table (localized vs fell-back, with reasons), mention re-running refreshes it.
- **No** → skip; note in Step 7 summary that national defaults are active.
- **Edit Mode:** if geography answers changed, offer re-running this step.

## Step 4 — Seed `portals.yml`

Create or **regenerate** `portals.yml` customized to their answers:
- Copy the structure of `templates/portals.example.yml`.
- Build `search_queries` for their preferred industries × preferred states (`site:bizbuysell.com <industry> for sale <state>` and the same for bizquest).
- Set `filters.asking_price_range` from their budget, `filters.categories` from preferred industries, `filters.locations` from preferred states (empty = all).
- Set `filters.sde_range.min` to the same `target_sde_range.min` written into the profile (the typical-derived floor), so scans don't filter out matches that pass deal criteria.
- Leave `exclude_keywords` empty unless they named exclusions beyond industries.

**Regenerate when criteria change.** The scanner reads `portals.yml`, not `config/profile.yml`. If the user changed industries, budget range, or states — in onboarding or edit mode — rebuild `portals.yml` from the new values. Ask the user whether to keep any custom queries they added by hand before overwriting; keep those that still match the new criteria. Scans do not need their history cleared: criteria-rejected listings (see `modes/scan.md`) resurface automatically once the filters match them.

## Step 5 — Create `buyer-profile.md`

If `buyer-profile.md` is missing, offer to draft it: copy the header from `buyer-profile.example.md`, then write 2–3 short paragraphs from their Group 1–4 answers (who they are, what they're hunting, how they'll fund and operate). Show the draft and let them edit or replace it — it's their voice, not the system's.

## Step 6 — Edit Mode (existing profile)

Read `config/profile.yml`. Present current values grouped (Identity & Money / Skills & Involvement / Geography / Deal Criteria) as a compact table, then ask:

> *"Which section do you want to change? (or 'all' to re-run the interview)"*

- Single section → re-ask only that group's questions showing current value per field ("Budget range [200000–750000]:").
- `all` → rerun Step 2, pre-filling defaults from current values.
- Apply edits, validate YAML (Step 3), and show a before → after diff summary of only the changed fields.
- **Criteria changed** (industries, budget, states) → regenerate `portals.yml` per Step 4 so scans use the new criteria.

## Step 7 — Finish

Run the `doctor` action and report: warnings should now be cleared (or explain any that remain). Close with:

```
BizBuyBot Setup — Complete
  config/profile.yml   ✓ written
  portals.yml          ✓ written (N search queries)
  buyer-profile.md     ✓ written

Next steps:
  /bizbuybot scan            — find listings matching your criteria
  /bizbuybot <listing-url>   — evaluate a specific listing
```

---

## Error Handling

- User declines mid-interview → save nothing, tell them partial answers were discarded, offer to resume later.
- YAML validation fails → fix the generated output and re-validate before writing; never leave an invalid profile.yml on disk.
- Existing profile.yml is malformed → show the parse error, offer to regenerate from scratch (Step 2) rather than patching blindly.
