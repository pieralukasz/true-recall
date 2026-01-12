# CSS Styling Best Practices

Proper CSS styling ensures your plugin respects user themes and provides a native Obsidian experience.

## Table of Contents
- [Avoid Inline Styles](#avoid-inline-styles)
- [Use Obsidian CSS Variables](#use-obsidian-css-variables)
- [Scope Plugin Styles](#scope-plugin-styles)
- [Theme Support](#theme-support)
- [Spacing and Layout](#spacing-and-layout)
- [Complete Examples](#complete-examples)

---

## Avoid Inline Styles

### Avoid Inline Styles
Rule: `obsidianmd/no-static-styles-assignment`

❌ **INCORRECT**:
```typescript
element.style.color = 'red';
element.style.fontSize = '14px';
element.setAttribute('style', 'margin: 10px;');
```

✅ **CORRECT**:
```typescript
// Add class in TypeScript
element.addClass('my-custom-element');

// Define styles in styles.css using Obsidian CSS variables
.my-custom-element {
  color: var(--text-error);
  font-size: var(--font-ui-small);
  margin: var(--size-4-2);
}
```

Rationale: Move all styles to CSS for better theme/snippet adaptability. Use Obsidian's CSS variables for theme consistency.

---

### Don't Create `<link>` or `<style>` Elements
Rule: `obsidianmd/no-forbidden-elements`

❌ **INCORRECT**:
```typescript
// Don't manually create and append stylesheets
const styleSheet = document.createElement('link');
styleSheet.rel = 'stylesheet';
styleSheet.href = 'path/to/styles.css';
document.head.appendChild(styleSheet);

// Don't create inline style elements
const style = document.createElement('style');
style.textContent = 'body { color: red; }';
document.head.appendChild(style);

// Also forbidden with Obsidian helpers
containerEl.createEl('link');
containerEl.createEl('style');
```

✅ **CORRECT**:
```typescript
// Use styles.css file in your plugin root
// Obsidian automatically loads it for you
// No manual CSS loading needed!
```

Rationale: Creating and attaching `<link>` or `<style>` elements is not allowed. For loading CSS, use a `styles.css` file in your plugin directory, which Obsidian loads automatically.

---

## Use Obsidian CSS Variables

### Use Obsidian CSS Variables
Rule: Theme consistency and user customization

Always use Obsidian's CSS variables instead of hardcoded values to ensure your plugin respects user themes and customization.

❌ **INCORRECT**:
```css
.my-plugin-modal {
  background: #1e1e1e;
  color: #dadada;
  padding: 16px;
  border-radius: 8px;
  font-size: 14px;
}
```

✅ **CORRECT**:
```css
.my-plugin-modal {
  background: var(--modal-background);
  color: var(--text-normal);
  padding: var(--size-4-4);
  border-radius: var(--radius-m);
  font-size: var(--font-ui-medium);
}
```

### Common CSS Variables by Category

**Colors**:
- `--text-normal`, `--text-muted`, `--text-faint` - Text colors
- `--text-accent`, `--text-accent-hover` - Accent colors for links/buttons
- `--text-error`, `--text-success`, `--text-warning` - Status colors
- `--background-primary`, `--background-secondary` - Background colors
- `--interactive-normal`, `--interactive-hover`, `--interactive-accent` - Interactive elements
- `--background-modifier-border` - Border colors

**Spacing** (4px grid):
- `--size-4-1` (4px), `--size-4-2` (8px), `--size-4-3` (12px)
- `--size-4-4` (16px), `--size-4-6` (24px), `--size-4-8` (32px)

**Typography**:
- `--font-text-theme` - Editor text font
- `--font-interface-theme` - UI font
- `--font-monospace-theme` - Code font
- `--font-ui-small` (13px), `--font-ui-medium` (15px), `--font-ui-large` (20px)
- `--font-bold`, `--font-normal` - Font weights

**Borders & Radius**:
- `--radius-s`, `--radius-m`, `--radius-l` - Border radius
- `--input-radius` - Input field border radius
- `--border-width` - Standard border thickness
- `--background-modifier-border` - Standard border color
- `--background-modifier-border-focus` - Focus state border/shadow color
- `--background-modifier-border-hover` - Hover state border color

**Modal/Dialog**:
- `--modal-background`, `--modal-border-color`
- `--modal-max-width`, `--modal-max-height`

---

## Scope Plugin Styles

### Scope Plugin Styles
Rule: Avoid conflicts with Obsidian and other plugins

Always scope your CSS to your plugin's specific elements to prevent style conflicts.

❌ **INCORRECT**:
```css
/* Too broad - affects all buttons everywhere */
button {
  background: blue;
}

/* Conflicts with Obsidian */
.modal {
  width: 600px;
}
```

✅ **CORRECT**:
```css
/* Scoped to your plugin's view */
.my-plugin-view button {
  background: var(--interactive-accent);
}

/* Scoped to your plugin's modal */
.modal.my-plugin-modal {
  max-width: var(--modal-max-width);
}

/* Or use unique class names */
.my-plugin-custom-button {
  background: var(--interactive-accent);
}
```

Rationale: Scoping prevents your styles from affecting Obsidian's UI or other plugins. Use unique class names or scope to your plugin's containers (views, modals, settings).

---

### Scope to Plugin Containers
Rule: Use view and modal class names

Obsidian automatically adds class names to your plugin's elements. Use these for scoping:

```css
/* Scope to your custom view */
.view-type-my-plugin {
  /* Styles only affect your view */
}

/* Scope to your modal */
.modal.my-plugin-settings-modal {
  /* Styles only affect your modal */
}

/* Scope to settings tab */
.my-plugin-settings-tab {
  /* Styles only affect your settings */
}
```

Add these classes in your TypeScript:

```typescript
// In your view
export class MyPluginView extends ItemView {
  getViewType() {
    return "my-plugin";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.addClass('view-type-my-plugin');
  }
}

// In your modal
export class MyModal extends Modal {
  onOpen() {
    this.modalEl.addClass('my-plugin-settings-modal');
  }
}
```

---

## Theme Support

### Support Light and Dark Themes
Rule: Respect user theme preference

Test your plugin in both light and dark themes. Obsidian's CSS variables automatically adjust.

```css
/* ✅ CORRECT - Variables adapt automatically */
.my-plugin-element {
  background: var(--background-secondary);
  color: var(--text-normal);
  border: 1px solid var(--background-modifier-border);
}

/* ❌ AVOID - Manual theme switching */
.theme-dark .my-plugin-element {
  background: #1e1e1e;
  color: #dadada;
}
.theme-light .my-plugin-element {
  background: #ffffff;
  color: #222222;
}
```

Rationale: Using CSS variables ensures your plugin works with any theme, including community themes. Manual theme detection is fragile and doesn't support custom themes.

---

## Spacing and Layout

### Use Consistent Spacing
Rule: Follow Obsidian's 4px grid system

Use Obsidian's spacing variables for consistent layouts:

```css
.my-plugin-container {
  padding: var(--size-4-4);        /* 16px */
  margin-bottom: var(--size-4-6);  /* 24px */
  gap: var(--size-4-2);             /* 8px */
}

.my-plugin-compact {
  padding: var(--size-4-2);        /* 8px */
  gap: var(--size-4-1);             /* 4px */
}
```

Rationale: Obsidian uses a 4px grid for spacing. Following this ensures your plugin feels native and works well across different DPI screens.

---

## Complete Examples

### Example: Complete Modal Styling

```css
/* Scope to plugin modal */
.modal.my-todo-plugin-modal {
  /* Use modal variables */
  background: var(--modal-background);
  border: var(--modal-border-width) solid var(--modal-border-color);
  border-radius: var(--modal-radius);
  max-width: var(--modal-max-width);

  /* Use spacing variables */
  padding: var(--size-4-6);
}

.modal.my-todo-plugin-modal .modal-title {
  /* Use typography variables */
  font-size: var(--font-ui-large);
  font-weight: var(--font-bold);
  color: var(--text-normal);
  margin-bottom: var(--size-4-4);
}

.modal.my-todo-plugin-modal .modal-content {
  /* Use text and spacing */
  color: var(--text-muted);
  font-size: var(--font-ui-medium);
  line-height: var(--line-height-normal);
  padding: var(--size-4-4);
}

.modal.my-todo-plugin-modal button {
  /* Use interactive colors */
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: var(--radius-m);
  padding: var(--size-4-2) var(--size-4-4);
}

.modal.my-todo-plugin-modal button:hover {
  background: var(--interactive-accent-hover);
}
```
