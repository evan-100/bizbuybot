# `pipeline.md` — Pending Inbox Mode

> Invoked by `/bizbuybot pipeline`. Shows the raw-lead inbox (`data/pipeline.md` `## Pending`) — every listing found by scans or manual adds that has not yet been evaluated. It is read-only; it never writes to the pipeline.

---

## Inputs

- None (shows the whole pending inbox).

---

## Execution Steps

### Step 1 — Read the Pending Inbox

Read `data/pipeline.md`. Take everything under the `## Pending` heading (stop at `## Processed` or EOF). Each line is a raw lead in this shape:

```
- [ ] https://www.bizbuysell.com/opportunity/... | Business Name | City, ST | Asking: 450000
```

The fields after `|` are: listing URL, business name, location, optional asking price. **There is no SDE or multiple in the inbox** — those are only available after fetching and evaluating a listing (see Step 3).

If `## Pending` is empty, say so and close — there is nothing queued to evaluate.

### Step 2 — Render the Inbox as a Triage Table

Parse each pending line into { url, title, location, asking }. Present them as a markdown table:

```
## Pending Inbox — {N} lead(s)

| # | Business | Location | Asking | Source | Verdict |
|---|----------|----------|--------|--------|---------|
| 1 | Prime Plaza Laundromat | Houston, TX | $520,000 | bizbuysell | 🟡 worth a look |
| 2 | Austin Cleaning Co | Austin, TX | $180,000 | bizquest | ✅ strong fit |
```

Link each business name to its listing URL. Derive `Source` from the URL host (bizbuysell / bizquest / other).

Apply a verdict per row against the buyer profile (`config/profile.yml`, or `config/profile.example.yml` if absent):

- **Asking price** within `deal_criteria.target_asking_price_range` (or `financial.budget_range`)? Out of range → 🔴 poor fit.
- **Title** keyword overlaps `industries.preferred`, and does not hit `industries.excluded`? Strong mismatch → 🔴.
- **Location** in `geography.preferred_states` / `preferred_metro` (or `open_to_relocate: true`)? Mismatch when not flexible → 🔴.
- Otherwise: inside range + matches category & location → ✅ strong fit; unclear → 🟡 worth a look.
- Add a one-line rationale per row pointing at the criterion that drove the verdict.

If the pending list is large, show it all — the point is to sweep the queue — then rank the top 3–5 for evaluation.

### Step 3 — Recommend Next Actions

Note what the inbox cannot tell you: SDE, multiple, and financials aren't in the pending line, so scores/valuations require evaluating the listing. Recommend:

- Top candidates for full A-F evaluation → `/bizbuybot <listing-url>` per candidate.
- If everything looks weak, suggest re-tightening criteria (`/bizbuybot setup`) or re-scanning (`/bizbuybot scan`).
- Optionally prune: if the user wants something removed from `## Pending`, that is a manual `data/pipeline.md` edit — remind them to leave the file otherwise untouched (the scanner is its only writer).

### Step 4 — Terminal Summary

Close with:

```
Next steps:
  /bizbuybot <listing-url>   — evaluate a lead (A-F report + tracker entry)
  /bizbuybot scan            — find more leads
```

---

## Notes

- This mode is read-mostly. Do not modify `data/pipeline.md`; the scanner owns it.
- Processed leads live in the acquisitions tracker (`data/acquisitions.md`) — see `/bizbuybot tracker` for those. The pending inbox shows only what is still actionable.
- If the user wants run-by-run scan history (what a *specific* scan added vs. skipped), that data is not currently persisted — only the surviving `## Pending` leads are.