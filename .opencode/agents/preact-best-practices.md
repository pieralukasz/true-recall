---
description: "Preact performance optimization and best-practice guidelines. Use when writing, reviewing, or refactoring Preact components, signals, hooks, or TypeScript+JSX code. Triggers on @preact/signals-core, useRef, useEffect, useErrorBoundary, rendering performance, SVG animation, Set/Map data structures, or cva component variants. Apply 33 rules across 7 categories prioritized by impact."
mode: subagent
---

# Preact Best Practices

Comprehensive performance optimization and correctness guide for Preact applications. 33 rules across 7 categories, prioritized by impact. Detailed rule files live in `.opencode/agents/preact-best-practices/rules/`. Read individual rules with the Read tool when relevant; do not load all of them upfront.

## When to Apply

Reference these guidelines when:
- Writing new Preact components or hooks
- Using `@preact/signals-core` (`signal`, `computed`, `effect`, `batch`)
- Reviewing code for re-render issues or memory leaks
- Refactoring existing Preact/JSX code
- Optimizing rendering performance or bundle size

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Signals — Core | CRITICAL | `signal-` |
| 2 | Re-render Optimization | CRITICAL | `rerender-` |
| 3 | Hooks Patterns | HIGH | `hooks-` |
| 4 | Component Architecture | MEDIUM-HIGH | `component-` |
| 5 | Rendering Performance | MEDIUM | `rendering-` |
| 6 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 7 | TypeScript + Preact | LOW | `ts-` |

## Quick Reference

### 1. Signals — Core (CRITICAL)

- `signal-jsx-direct` — Pass signal directly to JSX, skip `.value` read
- `signal-batch` — Batch multiple signal writes with `batch()`
- `signal-computed` — Use `computed()` for derived state
- `signal-effect-cleanup` — Always dispose `effect()` return value
- `signal-peek` — Use `.peek()` to read without subscribing
- `signal-global-vs-local` — `signal()` for shared, `useSignal()` for local state

### 2. Re-render Optimization (CRITICAL)

- `rerender-signals-over-memo` — Prefer signals over memo for shared state
- `rerender-functional-setstate` — Use functional `setState` updates
- `rerender-keys` — Use stable unique keys in lists
- `rerender-lazy-state-init` — Use lazy state initialization
- `rerender-derived-state` — Calculate derived state during rendering
- `rerender-useref-transient` — Use `useRef` for transient values

### 3. Hooks Patterns (HIGH)

- `hooks-useref-not-createref` — Never use `createRef` in function components
- `hooks-effect-cleanup` — Always return cleanup from `useEffect`
- `hooks-uselayouteffect` — Limit `useLayoutEffect` to DOM measurements
- `hooks-errorboundary` — Use Preact's `useErrorBoundary`
- `hooks-compat-stubs` — `useTransition`/`useDeferredValue` are no-ops in Preact

### 4. Component Architecture (MEDIUM-HIGH)

- `component-small-focused` — Keep components small and focused
- `component-local-vs-shared` — Choose local state vs signal by scope
- `component-no-effect-derived` — Derive state during render, not in effects

### 5. Rendering Performance (MEDIUM)

- `rendering-conditional` — Use ternary, not `&&` for conditional rendering
- `rendering-hoist-static` — Hoist static JSX outside components
- `rendering-svg-precision` — Reduce SVG coordinate precision
- `rendering-animate-wrapper` — Animate wrapper div, not SVG element

### 6. JavaScript Performance (LOW-MEDIUM)

- `js-set-map-lookups` — Use Set/Map for O(1) lookups
- `js-index-maps` — Build index maps for repeated lookups
- `js-early-exit` — Return early from functions
- `js-hoist-regexp` — Hoist RegExp creation outside loops
- `js-combine-iterations` — Combine multiple array iterations
- `js-cache-property-access` — Cache property access in loops

### 7. TypeScript + Preact (LOW)

- `ts-jsx-factory` — Configure `jsxFactory: "h"` in tsconfig
- `ts-variantprops-cva` — Use `cva` + `VariantProps` for component variants
- `ts-preact-compat` — Use `preact/compat` for React library compatibility

## How to Use

Read the individual rule file relevant to the task:

```
.opencode/agents/preact-best-practices/rules/signal-jsx-direct.md
.opencode/agents/preact-best-practices/rules/rerender-keys.md
.opencode/agents/preact-best-practices/rules/hooks-errorboundary.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

Cite the rule ID when making suggestions so the user can look it up.
