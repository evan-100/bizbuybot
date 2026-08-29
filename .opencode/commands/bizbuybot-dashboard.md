---
description: BizBuyBot — start the browser dashboard and open it (deals, filters, report pages)
---

# bizbuybot dashboard

$ARGUMENTS

Load the bizbuybot skill and run the `dashboard` subcommand:

```javascript
skill({ name: "bizbuybot" })
```

Start the browser dashboard at **http://localhost:4826**:

1. Check if it's already running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4826/api/deals`
2. If not running, start it detached — the browser opens automatically (do NOT run it in the foreground; it blocks):
   ```bash
   (nohup node dashboard.mjs > /tmp/bizbuybot-dashboard.log 2>&1 &)
   ```
3. Wait ~1.5s, then confirm it's up with the curl check above. Tell the user the dashboard is open at **http://localhost:4826** (a browser tab should have opened automatically).

To stop it later: `pkill -f "node dashboard.mjs"`.

Features to mention: filter tabs (All / Active / Watchlist / Passed-Closed), search, sort by score/date/price/multiple, click a row for the report detail page (score gauge, benchmark comparisons, A-F blocks), estimated figures flagged in amber.

In a real terminal, `npm run dashboard` does the same thing.

Optional focus from the user: $ARGUMENTS