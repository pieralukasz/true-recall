---
title: Use Preact's useErrorBoundary
impact: HIGH
impactDescription: catches render-time errors without needing a class component; prevents blank-screen crashes
tags: preact, hooks, useErrorBoundary, error-boundary, error-handling
---

## Use Preact's useErrorBoundary

Preact ships `useErrorBoundary` as a first-class hook — no class component required. It catches errors thrown during rendering of child components and lets you render a fallback UI or reset the boundary. In React you must write a class component with `componentDidCatch`; in Preact you don't.

**Incorrect (class-based error boundary — verbose and unnecessary in Preact):**

```tsx
class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info)
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />
    }
    return this.props.children
  }
}
```

**Correct (useErrorBoundary hook — concise and idiomatic in Preact):**

```tsx
import { useErrorBoundary } from "preact/hooks"

function SafeWidget({ children }: { children: ComponentChildren }) {
  const [error, resetError] = useErrorBoundary((err) => {
    // Optional: report the error to an external service
    reportError(err)
  })

  if (error) {
    return (
      <div class="error-state">
        <p>Something went wrong.</p>
        <button onClick={resetError}>Try again</button>
      </div>
    )
  }

  return <>{children}</>
}
```

`resetError()` clears the caught error, re-rendering children and giving users a recovery path without a page reload.

Reference: [useErrorBoundary — Preact Hooks](https://preactjs.com/guide/v10/hooks/#useerrorboundary)
