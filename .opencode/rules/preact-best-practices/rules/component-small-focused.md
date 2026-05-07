---
title: Keep Components Small and Focused
impact: MEDIUM
impactDescription: small components re-render in smaller scopes; easier to memoize, test, and maintain
tags: preact, components, architecture, single-responsibility, composition
---

## Keep Components Small and Focused

A component should render one conceptual thing. When a component grows beyond ~80 lines of JSX or handles more than one concern (data fetching + layout + animation), extract sub-components. Smaller components:
- Re-render in tighter scopes (fewer wasted renders)
- Are easier to wrap with `memo()` or isolate behind signals
- Are independently testable

**Incorrect (monolithic component doing too much):**

```tsx
function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => { fetchUser().then(setUser) }, [])
  useEffect(() => { fetchStats().then(setStats) }, [])

  // ❌ 150 lines: header, sidebar, charts, user profile, settings panel...
  return (
    <div class={`dashboard ${theme}`}>
      <header>...</header>
      <aside>...</aside>
      <main>{/* 100 lines of charts */}</main>
      <footer>...</footer>
    </div>
  )
}
```

**Correct (composed from focused sub-components):**

```tsx
// Each component owns exactly one concern
function Dashboard() {
  return (
    <div class="dashboard">
      <DashboardHeader />
      <DashboardSidebar />
      <DashboardCharts />
    </div>
  )
}

function DashboardCharts() {
  const stats = useSignal<Stats | null>(null)
  useEffect(() => { fetchStats().then(s => (stats.value = s)) }, [])
  if (!stats.value) return <Spinner />
  return <ChartGrid stats={stats.value} />
}
```

**Rule of thumb:**
- >80 lines of JSX → consider splitting
- Two `useEffect` calls for unrelated concerns → split into two components
- Same prop passed through 3+ layers → lift to a signal or context

Reference: [Components — Preact Guide](https://preactjs.com/guide/v10/components/)
