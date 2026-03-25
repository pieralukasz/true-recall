---
paths:
  - "**/*.css"
  - "src/shared/ui/styles.css"
---

# CSS Workflow

Do NOT edit root `styles.css` — it gets overwritten by the build.

- **Entry point:** `src/shared/ui/styles.css`
- **Output:** `styles.css` (root)
- **Build:** `bunx postcss src/shared/ui/styles.css -o styles.css` (runs during `bun run build`)
- Uses Tailwind v4 with PostCSS
