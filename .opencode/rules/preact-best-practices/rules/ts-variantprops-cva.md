---
title: Use cva + VariantProps for Component Variants
impact: LOW
impactDescription: replaces ad-hoc className string concatenation with typed, exhaustive variant switching
tags: preact, typescript, cva, class-variance-authority, variants, tailwind
---

## Use cva + VariantProps for Component Variants

When a component has visual variants (size, color, state), use `class-variance-authority` (cva) to define them. `cva` provides TypeScript types via `VariantProps`, enforces exhaustiveness, and eliminates manual string concatenation.

**Incorrect (ad-hoc string concatenation — not type-safe):**

```tsx
function Badge({ type }: { type: "new" | "learning" | "due" }) {
  // ❌ No type enforcement — easy to forget a case, classes scattered
  const cls = type === "new"
    ? "bg-blue-500 text-white"
    : type === "learning"
    ? "bg-yellow-500 text-black"
    : "bg-red-500 text-white"

  return <span class={`badge ${cls}`}>...</span>
}
```

**Correct (cva — exhaustive, typed, readable):**

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "ep:badge ep:inline-flex ep:items-center ep:rounded-full ep:px-2 ep:text-xs",
  {
    variants: {
      type: {
        new:      "ep:bg-blue-500 ep:text-white",
        learning: "ep:bg-yellow-500 ep:text-black",
        due:      "ep:bg-red-500 ep:text-white",
      },
    },
    defaultVariants: { type: "due" },
  }
)

// VariantProps makes variant prop type-safe (includes null | undefined)
export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  label: string
}

export function Badge({ type, label }: BadgeProps) {
  return <span class={badgeVariants({ type })}>{label}</span>
}
```

**Important: VariantProps includes `null | undefined`**

```tsx
// VariantProps types variant as: "new" | "learning" | "due" | null | undefined
// Use ?? to fall back when accessing variant in non-cva contexts:
const isNew = (type ?? "due") === "new"
```

**Threading variants through the call stack:**

```tsx
// When a variant is passed via a non-Preact API (e.g., CodeMirror WidgetType),
// store it as a class field and include it in eq():
class MyWidget extends WidgetType {
  constructor(readonly info: Info, readonly variant: Variant) { super() }

  eq(other: MyWidget) {
    return this.info === other.info && this.variant === other.variant
  }
}
```

Reference: [class-variance-authority](https://cva.style/docs)
