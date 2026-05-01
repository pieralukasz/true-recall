---
title: Hoist Static JSX Outside Components
impact: MEDIUM
impactDescription: prevents Preact from diffing and reallocating identical VNode trees on every render
tags: preact, jsx, optimization, static-content, hoisting
---

## Hoist Static JSX Outside Components

JSX that doesn't depend on props or state creates a new VNode object on every render, forcing Preact's reconciler to compare it against the previous tree. Hoisting static JSX to module scope makes Preact receive the same object reference every render, skipping the diff entirely.

**Incorrect (new VNode on every render — wasted allocation and diff):**

```tsx
function AppShell({ children }: { children: ComponentChildren }) {
  return (
    <div class="shell">
      {/* ❌ New VNode object created on every render of AppShell */}
      <header class="header">
        <img src="/logo.svg" alt="Logo" width={48} height={48} />
        <span class="brand">True Recall</span>
      </header>
      <main>{children}</main>
    </div>
  )
}
```

**Correct (static VNode created once at module load):**

```tsx
// ✅ Created once — same object reference on every render
const HEADER = (
  <header class="header">
    <img src="/logo.svg" alt="Logo" width={48} height={48} />
    <span class="brand">True Recall</span>
  </header>
)

function AppShell({ children }: { children: ComponentChildren }) {
  return (
    <div class="shell">
      {HEADER}
      <main>{children}</main>
    </div>
  )
}
```

**When to hoist:**
- Pure decorative elements (icons, dividers, branding) that never change
- Empty-state placeholders with fixed content
- SVG illustrations embedded in components

**When NOT to hoist:**
- Any JSX that reads props or state
- JSX with event handlers (they close over component scope)
- JSX containing children passed as props

Reference: [Preact Benchmarking & Performance](https://preactjs.com/guide/v10/differences-to-react/)
