# True Recall Design System

## Intent

**Who:** Knowledge workers and learners — developers, students, researchers — reviewing flashcards as part of their daily Obsidian workflow. Quick sessions, not marathons.

**Task:** Review cards, track memory progress, manage growing card collections. The rhythm is daily: open, review, close.

**Feel:** Like the back pages of a well-used notebook. Quiet, reliable, unhurried. Never competes with the notes themselves. Calm confidence in a system that works.

---

## Palette

All colors inherit from the active Obsidian theme. No hard-coded colors.

### Semantic (FSRS states)
| State       | Color Variable  | Usage                        |
|-------------|-----------------|------------------------------|
| New         | `--color-blue`  | Unseen cards                 |
| Learning    | `--color-orange`| Cards in learning steps      |
| Review      | `--color-green` | Mature cards due for review  |
| Relearning  | `--color-yellow`| Lapsed cards                 |
| Suspended   | `--color-red`   | Paused cards                 |
| Buried      | `--text-muted`  | Temporarily hidden           |

### Opacity scale for backgrounds
- **15%** — Badges, state indicators (`ep-bg-obs-{color}-15`)
- **20%** — Emphasized badge backgrounds (`ep-bg-obs-{color}-20`)
- **10%** — Alert/info box backgrounds (`ep-bg-obs-{color}-10`)
- **30%** — Alert/info box borders (`ep-border-obs-{color}-30`)

### Surface hierarchy
| Layer            | Token                    | Usage                    |
|------------------|--------------------------|--------------------------|
| Page background  | `--background-primary`   | Base canvas              |
| Card / section   | `--background-secondary` | Elevated content areas   |
| Hover / active   | `--background-modifier-hover` | Interactive feedback |
| Dividers         | `--background-modifier-border` | Internal separators |

### Text hierarchy
| Level   | Token            | Usage                    |
|---------|------------------|--------------------------|
| Primary | `--text-normal`  | Card content, headings   |
| Secondary | `--text-muted` | Labels, metadata         |
| Tertiary | `--text-faint`  | Placeholders, disabled   |
| Accent  | `--text-accent`  | Links, active states     |
| Interactive | `--interactive-accent` | Buttons, selections |

---

## Depth

**No shadows.** Obsidian themes vary wildly (dark, light, custom). Hard-coded shadow colors create visible borders in some themes. Depth is expressed through:

1. **Background layering** — `bg-obs-primary` (base) → `bg-obs-secondary` (card) → `bg-obs-modifier-hover` (active)
2. **Subtle translate** — `-translate-y-px` on hover for cards
3. **Color transitions** — 200ms ease for all interactive elements

---

## Typography

| Role        | Font Family               | Size Token          | Weight    |
|-------------|---------------------------|---------------------|-----------|
| UI labels   | `--font-interface-theme`  | `--font-ui-smaller` (12px) | medium |
| UI text     | `--font-interface-theme`  | `--font-ui-small` (13px) | normal    |
| UI headings | `--font-interface-theme`  | `--font-ui-large` (20px) | semibold, tracking-tight |
| Card content| `--font-text-theme`       | `--font-ui-small` (13px) | normal, leading-normal |
| Code        | `--font-monospace-theme`  | `--font-ui-small` (13px) | normal    |

---

## Spacing

**Base unit:** 4px (Tailwind default)

| Context               | Value      | Tailwind class |
|-----------------------|------------|----------------|
| Between related items | 4-8px      | `gap-1` to `gap-2` |
| Card internal padding | 20px       | `p-5`          |
| Between cards/sections| 20px       | `mb-5`         |
| Panel horizontal pad  | 4px        | `px-1`         |
| Badge padding         | 2px / 8px  | `py-0.5 px-2`  |
| Chip padding          | 4px / 10px | `py-1 px-2.5`  |

---

## Corners

| Element          | Radius    | Tailwind class  |
|------------------|-----------|-----------------|
| Cards / sections | 16px      | `rounded-lg`    |
| Chips / pills    | 24px      | `rounded-xl`    |
| Small badges     | 4px       | `rounded`       |
| Buttons          | 6px       | `rounded-md`    |
| Inputs / textareas | 8px    | `rounded-lg`    |

---

## Motion

- **Duration:** 200ms for interactive transitions
- **Easing:** `ease-out` for entrances, `ease-in-out` for hover states
- **Chart entrance:** Fade-in with 4px upward slide, 300ms
- **Respects `prefers-reduced-motion`** — all animations disabled

---

## Component Patterns

### Badge
Inline span with low-opacity colored background. Uppercase, semibold, tight tracking for state badges. Normal case for generic badges.

### Chip (interactive pill)
Rounded-xl border, transitions between inactive (muted border, muted text) and active (accent border, accent tint background).

### StatsCard
`bg-obs-secondary`, `rounded-lg`, `p-5`. No border, no shadow. Optional header with bottom border divider. Hover lift via `-translate-y-px`.

### Panel
Flex column filling available height. Scrollable content area with `overflow-y-auto`. Optional sticky footer.

### Buttons
- **Primary:** `bg-obs-interactive`, `text-obs-on-accent`, `rounded-md`
- **Ghost:** No background, `text-obs-muted`, hover shows `bg-obs-modifier-hover`

---

## CSS Architecture

- **Entry:** `src/ui/styles.css`
- **Framework:** Tailwind v4 with `ep` prefix (all utilities prefixed `ep:`)
- **Theme bridge:** Obsidian CSS variables mapped to Tailwind tokens in `@theme` block
- **Opacity utilities:** Custom `@layer utilities` for `rgba()` color-with-opacity patterns
- **Component overrides:** `@layer components` for Obsidian-specific selectors (`:has()`, modal sizing, mobile adjustments)

### Naming convention
- Tailwind utilities: `ep:bg-obs-primary`, `ep:text-ui-small`
- Custom opacity utilities: `ep-bg-obs-blue-15` (no colon — direct class)
- CSS classes: `true-recall-` prefix for component-specific styles

---

## Mobile

- Modals go full-screen on `.is-mobile`
- Views get `padding-bottom: 60px` for Obsidian's bottom toolbar
- Review view has zero padding (fullscreen experience)
- Safe area insets respected via `env(safe-area-inset-bottom)`
