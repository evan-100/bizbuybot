---
description: BizBuyBot — set up or edit your buyer profile (budget, skills, geography, deal criteria)
---

# bizbuybot setup

$ARGUMENTS

Load the bizbuybot skill and run the `setup` mode:

```javascript
skill({ name: "bizbuybot" })
```

Follow `modes/setup.md` exactly:
- If `config/profile.yml` is missing → run the onboarding interview (one question group at a time), then generate `config/profile.yml`, optionally seed `portals.yml` and draft `buyer-profile.md`.
- If it exists → show current values grouped, ask which section to change, apply edits.
- Validate generated YAML before writing. Never invent financial data.

Optional focus from the user: $ARGUMENTS