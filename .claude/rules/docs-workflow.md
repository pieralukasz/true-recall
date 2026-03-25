---
paths:
  - "src/features/settings/**"
  - "src/features/study/**"
  - "src/features/ai/**"
  - "src/features/library/**"
  - "src/features/metrics/**"
  - "src/features/integration/**"
---

# Companion Repos & Docs Updates

True Recall spans two repositories:

| Repo | Path | Purpose | Deploy |
|------|------|---------|--------|
| **true-recall** | `~/Projects/true-recall` | Obsidian plugin | GitHub Release on tag push |
| **true-recall-docs** | `~/Projects/true-recall-docs` | Astro/Starlight docs | Vercel auto-deploy on push to main |

## When Plugin Changes Require Docs Updates

| Plugin change | Docs? |
|---------------|-------|
| Add/remove AI model | If documented |
| New user-facing feature | Yes |
| Settings UI change | Yes |
| SQLite schema migration | No |
| Bug fix (no UI change) | No |

## Update Workflow

1. Read `~/Projects/true-recall-docs/SITEMAP.md` to find relevant pages
2. Read `~/Projects/true-recall-docs/CLAUDE.md` for writing guidelines
3. Edit pages in `~/Projects/true-recall-docs/src/content/docs/`
4. Commit in docs repo separately

## Plugin Area -> Docs Mapping

| Plugin area | Docs pages (`src/content/docs/`) |
|-------------|----------------------------------|
| Review UI/flow | `review/` |
| Card creation/AI | `creation/` |
| Settings | `configuration/` |
| FSRS/scheduling | `scheduling/` |
| Card Browser/Library | `views/` |
| Import/Export | `data/` |
| Stats/Metrics | `views/statistics.md` |
| Getting started | `getting-started/` |
