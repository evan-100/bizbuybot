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

**Group 4 — Deal Criteria**
12. Industries you want? Industries to avoid?
13. Sweet-spot asking price range? (defaults to budget range)
14. Minimum cash flow (SDE) you need to live on / service debt?
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
- Derive sensible defaults from their answers: `max_dscr_target` → `1.4` unless they say stricter; `target_sde_range.min` ≥ their stated minimum cash need; `max_multiple` → `4.0` unless they cap it lower; `min_cash_flow_margin` → `0.15`.

Before writing, validate:

```bash
node -e "const y=require('js-yaml'),f=require('fs');y.load(f.readFileSync('config/profile.yml','utf8'));console.log('profile.yml valid')"
```

Then show the user the generated file and ask them to confirm (or adjust) before moving on.

## Step 3.5 — Local Benchmark Calibration (offer)

After writing `config/profile.yml`, offer calibration:

> *"Want me to calibrate benchmarks to your metro? This downloads ~50MB of Census data once (cached) plus a small IRS file, so valuations use Orlando-area figures instead of national averages."*

- **Yes** → run `node build-benchmarks.mjs`, show the resulting per-category table (localized vs fell-back, with reasons), mention re-running refreshes it.
- **No** → skip; note in Step 7 summary that national defaults are active.
- **Edit Mode:** if geography answers changed, offer re-running this step.

## Step 4 — Seed `portals.yml`

If `portals.yml` is missing, offer to create it customized to their answers:
- Copy the structure of `templates/portals.example.yml`.
- Build `search_queries` for their preferred industries × preferred states (`site:bizbuysell.com <industry> for sale <state>` and the same for bizquest).
- Set `filters.asking_price_range` from their budget, `filters.categories` from preferred industries, `filters.locations` from preferred states (empty = all).
- Leave `exclude_keywords` empty unless they named exclusions beyond industries.

## Step 5 — Create `buyer-profile.md`

If `buyer-profile.md` is missing, offer to draft it: copy the header from `buyer-profile.example.md`, then write 2–3 short paragraphs from their Group 1–4 answers (who they are, what they're hunting, how they'll fund and operate). Show the draft and let them edit or replace it — it's their voice, not the system's.

## Step 6 — Edit Mode (existing profile)

Read `config/profile.yml`. Present current values grouped (Identity & Money / Skills & Involvement / Geography / Deal Criteria) as a compact table, then ask:

> *"Which section do you want to change? (or 'all' to re-run the interview)"*

- Single section → re-ask only that group's questions showing current value per field ("Budget range [200000–750000]:").
- `all` → rerun Step 2, pre-filling defaults from current values.
- Apply edits, validate YAML (Step 3), and show a before → after diff summary of only the changed fields.

## Step 7 — Finish

Run `node doctor.mjs` and report: warnings should now be cleared (or explain any that remain). Close with:

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
