---
title: Configure jsxFactory "h" in tsconfig
impact: LOW
impactDescription: eliminates the need to import h/Fragment manually in every file; keeps Preact code concise
tags: preact, typescript, tsconfig, jsx, h, configuration
---

## Configure jsxFactory "h" in tsconfig

Preact uses `h()` as its JSX factory (instead of React's `React.createElement()`). Without the correct `tsconfig.json` settings, TypeScript will emit React-style calls that fail at runtime, or you must manually `import { h } from "preact"` in every file. Configure it once in `tsconfig.json`.

**Incorrect (missing or wrong jsxFactory — requires manual import everywhere):**

```tsx
// ❌ Must manually import h in every .tsx file
import { h, Fragment } from "preact"

function Card() {
  return <div>Hello</div>
}
```

**Correct (configured in tsconfig.json — no imports needed):**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

With `jsx: "react-jsx"` and `jsxImportSource: "preact"`, TypeScript automatically imports from `preact/jsx-runtime` — no manual `import { h }` required in any file.

**Alternative (classic factory, older projects):**

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment"
  }
}
```

With this setting, you need `import { h, Fragment } from "preact"` in files that use Fragments. Prefer the `react-jsx` approach for new projects.

**For bundlers (esbuild/vite):**

```ts
// vite.config.ts
export default defineConfig({
  esbuild: {
    jsxImportSource: "preact",
    jsx: "automatic",
  },
})
```

Reference: [TypeScript JSX — Preact Guide](https://preactjs.com/guide/v10/typescript/)
