# `outreach.md` — Broker/Seller Outreach Draft Mode

> This mode generates a professional initial outreach message to the broker or seller, requesting the Confidential Information Memorandum (CIM) and P&L under NDA. Output: `reports/{NNN}-outreach.md`.

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
  - Block A (business name, category, location, listing URL).
  - Block B (financial highlights — to show the buyer has done homework).
  - The YAML footer (`business_name`, `asking_price`, `sde`, `multiple`).
- Read `config/profile.yml` (or `config/profile.example.yml`) for buyer qualification details: `identity.name`, `financial.cash_down_payment`, `financial.pre_qualified`, `skills.industries`, `geography.preferred_metro`.

### Step 2 — Determine the Recipient

- If the listing names a broker, address the message to the broker by name.
- If no broker is named, address it to "the listing broker" or "the seller" generically.
- Extract the broker name, firm, and any contact info from the listing. If none, leave a placeholder `[BROKER NAME]`.

### Step 3 — Draft the Outreach Message

Write a professional, concise message (200–350 words) with this structure:

1. **Subject line:** Specific and credible. Format: `Inquiry — {Business Name} ({Location}) — Serious Buyer`. Do not use generic subjects like "Interested in your business."

2. **Opening:** One sentence identifying the buyer by name and role, and the specific listing (by name and URL).

3. **Buyer qualification (2–3 sentences):** Show credibility without over-sharing:
   - Liquid down payment available (state the amount from `financial.cash_down_payment` if the profile is configured; otherwise say "liquid capital available for a down payment").
   - SBA pre-qualified status (if `financial.pre_qualified` is true; otherwise say "working with an SBA lender").
   - Relevant industry experience (from `skills.industries` and `skills.management_experience`).
   - Geography match (from `geography.preferred_metro` / `preferred_states`).

4. **Specific interest signal (2–3 sentences):** Reference 2–3 specific facts from the evaluation that show the buyer has actually studied the listing (not a mass email):
   - The SDE multiple relative to benchmark (e.g., "The asking multiple of 3.1x is within the typical range for {category} businesses").
   - A specific operational strength or growth lever from Block D (e.g., "The opportunity to modernize the booking system and expand service lines is compelling").
   - A specific question that signals genuine diligence (e.g., "Could you share whether the current lease has a renewal option beyond 2027?").

5. **Request:** Clearly request the CIM and recent P&L under NDA. Offer to sign the broker's NDA immediately.

6. **Close:** Professional sign-off with the buyer's name, phone, and email. State a realistic timeline for a response and next steps (e.g., "I'm prepared to move quickly and would welcome a call this week").

### Step 4 — Add a Header

Prepend a header to the output file:

```markdown
# Broker/Seller Outreach Draft — {Business Name} (Deal {NNN})

**Generated:** {YYYY-MM-DD}
**Source evaluation:** `reports/{NNN}-{slug}-{date}.md`
**Recipient:** {broker name / firm, or "[BROKER NAME]" if unknown}

> **Draft.** Review and personalize before sending. Replace any bracketed placeholders with verified contact details. This draft is tailored to the evaluation findings to demonstrate genuine diligence.

---

**Subject:** Inquiry — {Business Name} ({Location}) — Serious Buyer

**To:** {broker email, or "[BROKER EMAIL]"}

---
```

### Step 5 — Write the Output

Write the draft to `reports/{NNN}-outreach.md` (no slug or date — just the ID, per `DATA_CONTRACT.md`).

### Step 6 — Update Deal Status (recommended)

If the buyer sends the outreach, transition the deal status:

```bash
node set-status.mjs {NNN} Outreach_Sent --reason="Initial outreach email sent to broker/seller"
```

This requires the current status to be `Evaluated` or `Watchlist` (states whose `next` includes `Outreach_Sent`). If the current status does not allow this transition, skip and note the required prior state in the terminal summary.

### Step 7 — Terminal Summary

Print:

```
BizBuyBot Outreach Draft — {NNN}
  Business:   {name}
  Recipient:  {broker name or [BROKER NAME]}
  Subject:    Inquiry — {name} ({location}) — Serious Buyer
  Output:     reports/{NNN}-outreach.md
  Next: Review, personalize contact details, and send. Run `node set-status.mjs {NNN} Outreach_Sent --reason="..."` after sending.
```

---

## Tone Guidelines

- **Credible, not desperate.** The buyer is a qualified acquirer evaluating a specific opportunity, not a job applicant.
- **Specific, not generic.** Reference actual numbers from the listing and evaluation. Mass-email language kills credibility.
- **Concise.** Brokers receive many inquiries. 200–350 words. One screen on mobile.
- **Professional, not formal.** Plain business English. No jargon overload.
- **No negotiation in the first email.** Do not mention price objections or terms. The goal is to get the CIM and start a conversation.

---

## Notes

- Do not include the evaluation score or the buyer's internal walk-away ceiling in the outreach message — these are private.
- If `config/profile.yml` is missing, use `config/profile.example.yml` and note in the terminal summary that qualification details are generic.
- If the listing does not name a broker, leave `[BROKER NAME]` and `[BROKER EMAIL]` placeholders for the user to fill.
