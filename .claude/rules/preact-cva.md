---
paths:
  - "**/*.tsx"
---

# Preact Component Variants (cva)

When a Preact component has multiple visual variants, use `class-variance-authority`:

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const widgetVariants = cva(
    "ep-widget ep:inline-flex ep:items-center ep:cursor-pointer",
    {
        variants: {
            variant: {
                link: "ep:text-xs ep:ml-1 ep:mb-[3px]",
                h1:   "ep:text-sm ep:ml-2 ep:mb-[3px] ep:opacity-80",
            },
        },
        defaultVariants: { variant: "link" },
    },
);

export interface WidgetProps extends VariantProps<typeof widgetVariants> {
    info: SomeInfo;
}

export function Widget({ info, variant }: WidgetProps) {
    return <span class={widgetVariants({ variant })} />;
}
```

## Rules
- `variant` type comes from `VariantProps<typeof ...>` — do not redeclare manually
- `VariantProps` makes variant nullable; use `variant ?? "default"` for non-cva lookups
- Default variant MUST match previous single-class behavior
- All Tailwind classes use `ep:` prefix inside `cva()`
- Derive behavior from resolved variant instead of parallel Records
- `eq()` in CodeMirror `WidgetType` MUST include `variant`

## No Native `<button>` — Use `Clickable`

NEVER use `<button>` in Preact components. Obsidian overrides native button styles.

Use `Clickable` (`src/shared/ui/components/Clickable.tsx`) — renders `<div role="button">` with keyboard accessibility.

```tsx
import { Clickable } from "@shared/ui/components";
<Clickable class="ep:px-3 ep:py-1.5" onClick={handleClick}>Save</Clickable>
```

- Use `[aria-disabled="true"]` not `:disabled` in CSS
- `mod-cta`/`mod-warning` have CSS fallbacks for `[role="button"]`
- Set `stopPropagation={false}` in modal footers
