---
description: BizBuyBot — generate a tailored Due Diligence checklist for a deal (e.g. /bizbuybot dd 003)
---

# bizbuybot dd

$ARGUMENTS

Load the bizbuybot skill and run the `dd` due-diligence mode:

```javascript
skill({ name: "bizbuybot" })
```

Follow `modes/dd.md` exactly: read `templates/dd-checklist-base.md`, the deal's evaluation report (from `data/acquisitions.md` / `reports/`), tailor the checklist to the business, and write `reports/{NNN}-dd-checklist.md`.