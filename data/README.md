# data/ — Personal Deal Data (Gitignored)

Everything in this directory is **personal user data** and is excluded from version
control (see `DATA_CONTRACT.md`). It is preserved across system updates and never
committed to the repo.

| File | What it holds |
|---|---|
| `acquisitions.md` | Canonical deal tracker — one row per evaluated business. |
| `pipeline.md` | Scrape inbox — raw leads pending evaluation. |
| `scan-history.tsv` | Deduplication index for scraped listings. |
| `status-log.tsv` | Audit ledger of deal status transitions. |
| `local-benchmarks.yml` | Per-user benchmark overlay (metro revenue, state margins). |
| `cache/` | Generated federal-data cache. |

If any of the first four files is missing, `doctor` recreates an empty skeleton on
its next run, so a fresh clone works out of the box.
