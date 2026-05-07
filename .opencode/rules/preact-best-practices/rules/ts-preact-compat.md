---
title: Use preact/compat for React Library Compatibility
impact: LOW
impactDescription: enables using React-targeted npm packages (react-markdown, react-hook-form, etc.) with Preact at near-zero cost
tags: preact, typescript, preact-compat, react-compat, aliasing, bundler
---

## Use preact/compat for React Library Compatibility

`preact/compat` is a thin compatibility layer that aliases `react` and `react-dom` to Preact's implementations. This allows libraries written for React (`react-markdown`, `react-hook-form`, `@radix-ui/*`, etc.) to work with Preact without bundling React itself.

**Without compat (React library fails to find react):**

```typescript
// ❌ react-markdown imports from "react" — crashes in Preact project
import ReactMarkdown from "react-markdown"

function Card({ answer }: { answer: string }) {
  return <ReactMarkdown>{answer}</ReactMarkdown>
}
```

**Correct (alias react → preact/compat in bundler config):**

**Vite:**
```ts
// vite.config.ts
import { defineConfig } from "vite"
import preact from "@preact/preset-vite"

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "react": "preact/compat",
      "react-dom/test-utils": "preact/test-utils",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
})
```

**esbuild / Obsidian plugin (esbuild.config.mjs):**
```js
import esbuild from "esbuild"

esbuild.build({
  // ...
  alias: {
    "react":     "preact/compat",
    "react-dom": "preact/compat",
  },
})
```

**TypeScript paths (if needed alongside bundler alias):**
```json
{
  "compilerOptions": {
    "paths": {
      "react": ["./node_modules/preact/compat/"],
      "react-dom": ["./node_modules/preact/compat/"]
    }
  }
}
```

After aliasing, React libraries work transparently — Preact handles rendering.

Reference: [preact/compat — Preact Guide](https://preactjs.com/guide/v10/switching-to-preact/)
