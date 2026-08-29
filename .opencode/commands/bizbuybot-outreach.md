---
description: BizBuyBot — draft broker/seller outreach email for a deal (e.g. /bizbuybot outreach 003)
---

# bizbuybot outreach

$ARGUMENTS

Load the bizbuybot skill and run the `outreach` mode:

```javascript
skill({ name: "bizbuybot" })
```

Follow `modes/outreach.md` exactly: read the deal's evaluation report and buyer profile, draft the outreach message requesting CIM and P&L under NDA, write `reports/{NNN}-outreach.md`. Draft-only — never send on the user's behalf.