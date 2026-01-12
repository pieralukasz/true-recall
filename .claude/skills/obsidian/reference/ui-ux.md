# UI/UX Standards

Consistent UI/UX is essential for a native-feeling Obsidian plugin experience.

## Table of Contents
- [Sentence Case for UI Text](#sentence-case-for-ui-text)
- [Command Naming Conventions](#command-naming-conventions)
- [Settings & Configuration](#settings--configuration)

---

## Sentence Case for UI Text

### Enforce Sentence Case for UI Text
Rule: `obsidianmd/ui/sentence-case` (auto-fixable)

Use sentence case (first word capitalized, rest lowercase except proper nouns) for all UI text.

❌ **INCORRECT**:
```typescript
.setName('Advanced Settings')
.setDesc('Configure Advanced Options')
.setButtonText('Save Changes')
new Notice('File Successfully Saved')
```

✅ **CORRECT**:
```typescript
.setName('Advanced settings')
.setDesc('Configure advanced options')
.setButtonText('Save changes')
new Notice('File successfully saved')
```

Configuration options:
```javascript
'obsidianmd/ui/sentence-case': ['warn', {
  brands: ['Obsidian', 'GitHub'],      // Preserve brand names
  acronyms: ['API', 'URL', 'HTML'],    // Preserve acronyms
  enforceCamelCaseLower: true,         // Fix camelCase to sentence case
}]
```

Applies to:
- `.setName()`, `.setDesc()`, `.setText()`, `.setTitle()`
- `.setButtonText()`, `.setPlaceholder()`, `.setTooltip()`
- `createEl()` text and attributes
- `new Notice()` messages
- `addCommand()` names
- `.setAttribute()` for `aria-label`, `aria-description`, `title`, `placeholder`
- `textContent`, `innerText` assignments

---

## Command Naming Conventions

### No Redundant "Command" in Names
Rules:
- `obsidianmd/commands/no-command-in-command-id`
- `obsidianmd/commands/no-command-in-command-name`

❌ **INCORRECT**:
```typescript
this.addCommand({
  id: 'open-settings-command',
  name: 'Open settings command',
});
```

✅ **CORRECT**:
```typescript
this.addCommand({
  id: 'open-settings',
  name: 'Open settings',
});
```

---

### No Plugin ID/Name in Command IDs
Rules:
- `obsidianmd/commands/no-plugin-id-in-command-id`
- `obsidianmd/commands/no-plugin-name-in-command-name`

❌ **INCORRECT**:
```typescript
// If plugin id is "my-plugin"
this.addCommand({
  id: 'my-plugin-open-settings',
  name: 'My Plugin: Open settings',
});
```

✅ **CORRECT**:
```typescript
this.addCommand({
  id: 'open-settings',
  name: 'Open settings',
});
```

Rationale: Obsidian automatically namespaces commands with the plugin ID.

---

### No Default Hotkeys
Rule: `obsidianmd/commands/no-default-hotkeys`

❌ **INCORRECT**:
```typescript
this.addCommand({
  id: 'toggle-feature',
  name: 'Toggle feature',
  hotkeys: [{ modifiers: ['Mod'], key: 't' }],  // Don't set defaults
});
```

✅ **CORRECT**:
```typescript
this.addCommand({
  id: 'toggle-feature',
  name: 'Toggle feature',
  // Let users configure their own hotkeys
});
```

Rationale: Avoid hotkey conflicts. Let users choose their own shortcuts.

---

### Use Appropriate Command Callbacks
Rule: Official guidelines

Choose the right callback type for your commands:

```typescript
// callback: Always executes
this.addCommand({
  id: 'show-info',
  name: 'Show info',
  callback: () => {
    new Notice('Always works!');
  }
});

// checkCallback: Conditional execution (returns true if executed)
this.addCommand({
  id: 'format-selection',
  name: 'Format selection',
  checkCallback: (checking: boolean) => {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      if (!checking) {
        // Perform the action
        const editor = view.editor;
        const selection = editor.getSelection();
        editor.replaceSelection(selection.toUpperCase());
      }
      return true;
    }
    return false;
  }
});

// editorCallback: Only available when editor is active
this.addCommand({
  id: 'insert-timestamp',
  name: 'Insert timestamp',
  editorCallback: (editor: Editor, view: MarkdownView) => {
    editor.replaceSelection(new Date().toISOString());
  }
});
```

Rationale:
- Use `callback` for unconditional execution
- Use `checkCallback` for conditional execution (command only shows when available)
- Use `editorCallback` for editor-dependent commands

---

## Settings & Configuration

### No Manual HTML Headings in Settings
Rule: `obsidianmd/settings-tab/no-manual-html-headings`

❌ **INCORRECT**:
```typescript
containerEl.createEl('h3', { text: 'Appearance' });
```

✅ **CORRECT**:
```typescript
new Setting(containerEl).setName('Appearance').setHeading();
```

Rationale: Use Obsidian's built-in heading API for consistency.

---

### No Problematic Settings Headings
Rule: `obsidianmd/settings-tab/no-problematic-settings-headings` (auto-fixable)

❌ **INCORRECT**:
```typescript
new Setting(containerEl)
  .setName('General settings')  // Don't use "General"
  .setHeading();

new Setting(containerEl)
  .setName('Plugin options')  // Don't use "settings" or "options"
  .setHeading();

new Setting(containerEl)
  .setName('My Plugin preferences')  // Don't include plugin name
  .setHeading();
```

✅ **CORRECT**:
```typescript
new Setting(containerEl)
  .setName('Appearance')
  .setHeading();

new Setting(containerEl)
  .setName('Behavior')
  .setHeading();

new Setting(containerEl)
  .setName('Advanced')
  .setHeading();
```

Rationale: Avoid redundant words in settings headings:
- Don't use "settings" or "options" (user already knows they're in settings)
- Don't use generic "General" heading
- Don't include the plugin name (already shown in settings tab title)
