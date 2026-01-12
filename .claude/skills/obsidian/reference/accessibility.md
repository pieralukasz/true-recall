# Accessibility (A11y)

Accessibility is MANDATORY for Obsidian plugins. All users, regardless of ability, must be able to use your plugin.

## Table of Contents
- [Keyboard Navigation](#keyboard-navigation)
- [ARIA Labels and Roles](#aria-labels-and-roles)
- [Tooltips and Accessibility](#tooltips-and-accessibility)
- [Focus Management](#focus-management)
- [Focus Visible Styles](#focus-visible-styles)
- [Screen Reader Support](#screen-reader-support)
- [Mobile and Touch Accessibility](#mobile-and-touch-accessibility)
- [Accessibility Checklist](#accessibility-checklist)

---

## Keyboard Navigation

### Keyboard Navigation
Rule: Accessibility best practice - MANDATORY

All interactive elements must be keyboard accessible. Users should be able to navigate and interact with your plugin using only the keyboard.

✅ **CORRECT**:
```typescript
// Make custom interactive elements keyboard accessible
element.setAttribute('tabindex', '0');
element.setAttribute('role', 'button');
element.setAttribute('aria-label', 'Click to change active profile');

element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    performAction();
  }
});
```

**Key Requirements**:
- Add `tabindex="0"` to make elements keyboard focusable
- Support both Enter and Space keys for button-like elements
- Use arrow keys for navigation within lists/menus
- Call `e.preventDefault()` to prevent default scroll behavior on Space

---

## ARIA Labels and Roles

### ARIA Labels and Roles
Rule: Accessibility best practice - MANDATORY

Provide proper ARIA labels and roles for all interactive elements, especially icons and buttons without visible text.

❌ **INCORRECT**:
```typescript
// Icon button with no accessible label
const button = containerEl.createEl('button');
button.innerHTML = '⚙️';
```

✅ **CORRECT**:
```typescript
// Icon button with proper ARIA label
const button = containerEl.createEl('button', {
  attr: {
    'aria-label': 'Open settings',
    'type': 'button'
  }
});
button.setText('⚙️');
```

**Common ARIA attributes**:
- `aria-label`: Accessible name for elements without visible text
- `aria-description`: Additional context beyond the label
- `role`: Semantic role (button, dialog, menu, listbox, etc.)
- `aria-expanded`: For collapsible/expandable elements
- `aria-selected`: For selectable items in lists
- `aria-disabled`: For disabled but visible elements

---

## Tooltips and Accessibility

### Tooltips and Accessibility
Rule: Obsidian API best practice

Use Obsidian's built-in tooltip system with proper positioning and accessibility attributes.

✅ **CORRECT**:
```typescript
const button = containerEl.createEl('button', {
  attr: {
    'aria-label': 'Open settings',
    'data-tooltip-position': 'top'  // Position tooltip above element
  }
});
setTooltip(button, 'Open settings');

// Alternative using setAttr
button.setAttr('aria-label', 'Refresh view');
button.setAttr('data-tooltip-position', 'bottom');
```

**Tooltip Position Options**:
- `top`: Above the element (default for many cases)
- `bottom`: Below the element
- `left`: To the left of the element
- `right`: To the right of the element

**Important**: Always provide `aria-label` in addition to tooltips, as tooltips may not be accessible to screen readers.

---

## Focus Management

### Focus Management
Rule: Accessibility best practice - MANDATORY

Manage focus appropriately when opening modals, menus, or changing context.

✅ **CORRECT**:
```typescript
export class MyModal extends Modal {
  onOpen() {
    const { contentEl } = this;

    // Create focusable content
    const input = contentEl.createEl('input', {
      attr: { 'aria-label': 'Enter value' }
    });

    // Focus the first interactive element
    input.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    // Focus returns to trigger element automatically
  }
}
```

**Focus Best Practices**:
- Focus the first interactive element when opening modals
- Trap focus within modals (prevent Tab from leaving modal)
- Return focus to the trigger element when closing modals
- Define focus styles in CSS using `:focus-visible`

---

## Focus Visible Styles

### Focus Visible Styles
Rule: Accessibility best practice - MANDATORY

Define clear focus indicators using CSS `:focus-visible` pseudo-class.

✅ **CORRECT**:
```css
/* Option 1: Using outline (standard approach) */
.my-plugin-button:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 2px;
}

/* Option 2: Using Obsidian's focus box-shadow pattern */
.my-plugin-input:focus,
.my-plugin-input:focus-visible {
  box-shadow: 0 0 0 3px var(--background-modifier-border-focus);
  border-radius: var(--input-radius);
}

/* Option 3: Alternative focus indicator */
.my-plugin-list-item:focus-visible {
  background: var(--background-modifier-hover);
  box-shadow: inset 0 0 0 2px var(--interactive-accent);
}
```

**Focus Indicator Guidelines**:
- Always provide visible focus indicators
- Use `:focus-visible` (not `:focus`) to show only for keyboard navigation
- Use Obsidian's CSS variables:
  - `--background-modifier-border-focus` for focus borders/shadows
  - `--interactive-accent` for accent color
  - `--input-radius` for input border radius
- The `box-shadow` pattern is preferred for inputs and form elements
- Don't remove outlines without providing alternative indicators

---

## Screen Reader Support

### Screen Reader Support
Rule: Accessibility best practice - MANDATORY

Ensure your plugin works well with screen readers.

✅ **CORRECT**:
```typescript
// Announce dynamic changes to screen readers
const statusEl = containerEl.createEl('div', {
  attr: {
    'role': 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true'
  }
});
statusEl.setText('File saved successfully');

// Use semantic HTML when possible
const list = containerEl.createEl('ul', {
  attr: { 'role': 'list' }
});

const item = list.createEl('li', {
  attr: { 'role': 'listitem' }
});
```

**Screen Reader Considerations**:
- Use `aria-live` regions for dynamic content updates
- Provide meaningful `aria-label` for icons and images
- Use semantic HTML roles when available
- Test with actual screen readers (NVDA, JAWS, VoiceOver)

---

## Mobile and Touch Accessibility

### Mobile and Touch Accessibility
Rule: Platform compatibility - MANDATORY

Ensure touch targets are appropriately sized and spaced for mobile users.

✅ **CORRECT**:
```css
.my-plugin-button {
  /* Minimum touch target size: 44x44px */
  min-width: 44px;
  min-height: 44px;

  /* Adequate spacing between touch targets */
  margin: var(--size-4-2);

  /* Padding for visual size vs. touch target */
  padding: var(--size-4-2) var(--size-4-4);
}
```

**Touch Target Guidelines**:
- Minimum touch target size: 44×44 pixels (iOS), 48×48 pixels (Android)
- Provide adequate spacing between interactive elements
- Support both click and touch events
- Test on actual mobile devices (iOS)

---

## Accessibility Checklist

**IMPORTANT**: Accessibility is NOT optional. When implementing UI elements, ensure:

- [ ] All interactive elements are keyboard accessible (Enter/Space support)
- [ ] Tab order is logical and intuitive
- [ ] Focus indicators are visible and clear (`:focus-visible`)
- [ ] ARIA labels provided for icon-only buttons
- [ ] ARIA roles defined for custom controls
- [ ] Focus managed properly in modals/dialogs
- [ ] Dynamic content changes announced to screen readers (`aria-live`)
- [ ] Touch targets meet minimum size requirements (44×44px minimum)
- [ ] Color contrast meets WCAG AA standards (use Obsidian CSS variables)
- [ ] No information conveyed by color alone
- [ ] Tooltips positioned appropriately (`data-tooltip-position`)
- [ ] Tested with keyboard navigation (Tab, Enter, Space, Arrow keys)
- [ ] Tested with screen reader (if possible)
