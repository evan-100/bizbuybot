---
description: BizBuyBot — generate a Letter of Intent for a deal (e.g. /bizbuybot loi 003)
---

# bizbuybot loi

$ARGUMENTS

Load the bizbuybot skill and run the `loi` mode:

```javascript
skill({ name: "bizbuybot" })
```

Follow `modes/loi.md` exactly: read `templates/loi-template.md`, the deal's evaluation report, fill in deal-specific values, write `reports/{NNN}-loi.md`. Draft-only — never submit the LOI on the user's behalf.