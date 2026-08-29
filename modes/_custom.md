# `_custom.md` — User House Rules

> This file is for the user's "always/never" automation rules — personal preferences that should be applied to every evaluation. The system provides sensible defaults; the user overrides them here. Active (uncommented) rules take precedence over `modes/_shared.md` defaults.
>
> **Format:** Each rule is a short imperative statement under a named heading. Comment out (with `<!-- -->` or `#`) any rule you do not want active. Rules can be category-specific or global.

---

## How the AI CLI Uses This File

1. Read this file at the start of every evaluation (after `modes/_shared.md` and `modes/_profile.md`).
2. For each **active** (uncommented) rule, apply it as an override or additional constraint.
3. If a rule conflicts with `_shared.md`, the user rule wins. If a rule conflicts with `_profile.md`, the user rule wins.
4. Note in the report (Block A or F) which custom rules were applied.

---

## Example Rules (commented — uncomment and edit to activate)

<!-- ## Always
- Never proceed to LOI for any business with customer concentration >20% of revenue, even if the global score is 4.5+.
- Always require a seller non-compete of at least 3 years as a condition of any LOI.
- Always discount claimed SDE by 10% before computing the multiple, to account for undisclosed add-backs.
- Always cap the walk-away ceiling at 3.5x SDE regardless of category. -->

<!-- ## Never
- Never pursue a Food Service business — buyer is not interested in owner-operator restaurant operations.
- Never consider a deal where the lease has less than 24 months remaining without a written renewal option.
- Never evaluate a listing that has been on the market more than 180 days without a price reduction (stale listing indicator). -->

<!-- ## Category-Specific: Laundromat
- For laundromats, always require equipment age <10 years on average, or a 20% price discount to reflect capex.
- For laundromats, water and sewer costs must be <12% of gross revenue. -->

<!-- ## Category-Specific: HVAC
- For HVAC businesses, recurring service agreements must be >30% of revenue for the deal to be worth pursuing.
- For HVAC businesses, technician tenure average must be >3 years. -->

<!-- ## Financing
- Always require the seller note to be on standby (interest accruing, payments deferred) for at least 12 months.
- Always structure the buyer equity at exactly 10% — do not accept structures requiring >15% cash at close. -->

<!-- ## Geography
- Never pursue a deal outside Texas, Florida, or North Carolina.
- Always require a physical site visit before LOI submission. -->

---

*End of `_custom.md`. No active rules by default — the user adds their own above.*
