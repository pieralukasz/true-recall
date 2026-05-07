# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Signals — Core (signal)

**Impact:** CRITICAL
**Description:** Signals are the primary reactivity primitive in Preact. Correct usage bypasses the Virtual DOM entirely for fine-grained DOM updates, yielding the largest performance gains.

## 2. Re-render Optimization (rerender)

**Impact:** CRITICAL
**Description:** Reducing unnecessary re-renders minimizes wasted computation and improves UI responsiveness. In Preact, Signals solve most of these problems automatically, but state and hooks still need careful handling.

## 3. Hooks Patterns (hooks)

**Impact:** HIGH
**Description:** Correct hook usage prevents memory leaks, stale closures, and layout thrashing. Preact has hook-specific behavior that differs from React (no concurrent mode, Preact-specific hooks like useErrorBoundary).

## 4. Component Architecture (component)

**Impact:** MEDIUM-HIGH
**Description:** Well-structured components are easier to optimize, test, and maintain. Separating concerns and keeping components focused allows Signals to work most effectively.

## 5. Rendering Performance (rendering)

**Impact:** MEDIUM
**Description:** Optimizing the rendering process reduces work the browser needs to perform. Includes static JSX hoisting, conditional rendering patterns, and SVG optimization.

## 6. JavaScript Performance (js)

**Impact:** LOW-MEDIUM
**Description:** Framework-agnostic micro-optimizations for hot paths. These apply to any JavaScript code in the project.

## 7. TypeScript + Preact (ts)

**Impact:** LOW
**Description:** TypeScript configuration and typing patterns specific to Preact. Correct setup prevents silent runtime errors from JSX pragma misconfiguration.
