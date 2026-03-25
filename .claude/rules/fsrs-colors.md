---
paths:
  - "src/shared/ui/helpers/fsrs-colors*"
  - "src/features/metrics/**"
  - "src/features/study/ui/**"
---

# FSRS State Colors (`src/shared/ui/helpers/fsrs-colors.ts`)

Single source of truth for FSRS state -> color mapping. All UI layers derive from `FSRS_COLORS`:

| State        | Color  | CSS Variable     | Tailwind text         |
|--------------|--------|------------------|-----------------------|
| New          | green  | `--color-green`  | `ep:text-obs-green`   |
| Learning     | orange | `--color-orange` | `ep:text-obs-orange`  |
| Relearning   | orange | `--color-orange` | `ep:text-obs-orange`  |
| Review       | blue   | `--color-blue`   | `ep:text-obs-blue`    |
| Suspended    | red    | `--color-red`    | `ep:text-obs-error`   |

```typescript
import { FSRS_COLORS, fsrsStateToColor, fsrsStateToCssVar } from "@shared/ui/helpers/fsrs-colors";

FSRS_COLORS.new.cssVar       // "--color-green"
FSRS_COLORS.new.bgCls        // "ep:bg-obs-green/10"
FSRS_COLORS.new.badgeCls     // "ep:bg-obs-green/15 ep:text-obs-green"
fsrsStateToColor(State.New)  // full config object
fsrsStateToCssVar(State.New) // "var(--color-green)"
```

## Rules
- MUST import from `fsrs-colors.ts` — never hardcode state->color mappings
- CSS files reference the same CSS variables with a comment pointing to `fsrs-colors.ts`
- Tailwind classes MUST appear as full string literals in `FSRS_COLORS` (no template interpolation) for tree-shaking
- Chart.js runtime colors: `getThemeColor(FSRS_COLORS.new.cssVar)`
- Domain-specific chart colors (young/mature breakdowns, rating colors) are NOT centralized
