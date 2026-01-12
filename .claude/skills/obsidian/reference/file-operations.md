# File & Vault Operations

Proper file operations are critical for safe and efficient Obsidian plugin development.

## Table of Contents
- [View Access](#view-access)
- [Editor vs Vault API](#editor-vs-vault-api)
- [Atomic File Operations](#atomic-file-operations)
- [File Management](#file-management)
- [Path Handling](#path-handling)

---

## View Access

### Use getActiveViewOfType() for View Access
Rule: Official guidelines

❌ **INCORRECT**:
```typescript
const view = this.app.workspace.activeLeaf?.view;
```

✅ **CORRECT**:
```typescript
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
if (view) {
  // Work with view
}
```

Rationale: Use `getActiveViewOfType()` instead of directly accessing `workspace.activeLeaf` for safer view access.

---

## Editor vs Vault API

### Prefer Editor API over Vault.modify()
Rule: Official guidelines

❌ **INCORRECT**:
```typescript
// For active file edits
const activeFile = this.app.workspace.getActiveFile();
await this.app.vault.modify(activeFile, newContent);
```

✅ **CORRECT**:
```typescript
// Use Editor API for active file
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
if (view) {
  const editor = view.editor;
  editor.setValue(newContent);
  // Or use editor methods to preserve cursor
  editor.replaceRange(text, from, to);
}
```

Rationale: Use Editor API for active file edits to preserve cursor position and selection. Use `Vault.modify()` only for non-active files.

---

## Atomic File Operations

### Use Vault.process() for Background Modifications
Rule: Official guidelines

❌ **INCORRECT**:
```typescript
// Direct modification can conflict with other plugins
const content = await this.app.vault.read(file);
const modified = content.replace(/old/g, 'new');
await this.app.vault.modify(file, modified);
```

✅ **CORRECT**:
```typescript
// Vault.process() prevents conflicts
await this.app.vault.process(file, (data) => {
  return data.replace(/old/g, 'new');
});
```

Rationale: Use `Vault.process()` for background file modifications—it prevents conflicts with other plugins through atomic operations.

---

### Use FileManager.processFrontMatter() for YAML
Rule: Official guidelines

❌ **INCORRECT**:
```typescript
const content = await this.app.vault.read(file);
const updated = content.replace(/tags:.*/, 'tags: [new-tag]');
await this.app.vault.modify(file, updated);
```

✅ **CORRECT**:
```typescript
await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
  frontmatter.tags = ['new-tag'];
  frontmatter.modified = new Date().toISOString();
});
```

Rationale: Use `FileManager.processFrontMatter()` for YAML modifications to ensure atomic operations and consistent formatting.

---

## File Management

### Prefer Vault API over Adapter API
Rule: Official guidelines

❌ **INCORRECT**:
```typescript
// Adapter API bypasses Obsidian's safety mechanisms
const content = await this.app.vault.adapter.read(file.path);
await this.app.vault.adapter.write(file.path, newContent);
```

✅ **CORRECT**:
```typescript
// Vault API provides safety and serialization
const content = await this.app.vault.read(file);
await this.app.vault.modify(file, newContent);
```

Rationale: Prefer the Vault API over the Adapter API for better performance and safety through serialized operations.

---

### Prefer FileManager for Deletion
Rules:
- `obsidianmd/prefer-file-manager-trash`
- `obsidianmd/prefer-file-manager-trash-file`

❌ **INCORRECT**:
```typescript
await this.app.vault.trash(file, system);
```

✅ **CORRECT**:
```typescript
await this.app.fileManager.trashFile(file);
```

Rationale: `fileManager.trashFile()` handles additional cleanup like backlinks.

---

### Avoid Full Vault Iteration
Rule: `obsidianmd/vault/iterate`

❌ **INCORRECT**:
```typescript
// Iterating all files to find one
const files = this.app.vault.getMarkdownFiles();
const target = files.find(f => f.path === targetPath);
```

✅ **CORRECT**:
```typescript
// Direct lookup
const target = this.app.vault.getAbstractFileByPath(targetPath);
```

Rationale: Use direct lookup methods instead of iterating all files for better performance.

---

## Path Handling

### Use normalizePath() for User-Defined Paths
Rule: Official guidelines

❌ **INCORRECT**:
```typescript
const file = this.app.vault.getAbstractFileByPath(userPath);
```

✅ **CORRECT**:
```typescript
import { normalizePath } from 'obsidian';

const normalizedPath = normalizePath(userPath);
const file = this.app.vault.getAbstractFileByPath(normalizedPath);
```

Rationale: Apply `normalizePath()` to user-defined paths to ensure cross-platform compatibility (handles backslashes, etc.).

---

### Don't Hardcode Config Directory
Rule: `obsidianmd/hardcoded-config-path`

❌ **INCORRECT**:
```typescript
const configPath = '.obsidian/plugins/my-plugin/';
const pluginDir = vault.adapter.basePath + '/.obsidian/plugins/my-plugin';
```

✅ **CORRECT**:
```typescript
// Access the configured directory
const configDir = this.app.vault.configDir;  // Might not be '.obsidian'
const pluginDir = `${configDir}/plugins/${this.manifest.id}`;

// Or better yet, use the data APIs:
await this.loadData();
await this.saveData(data);
```

Rationale: Obsidian's configuration directory isn't necessarily `.obsidian` - it can be configured by the user. Access it via `Vault#configDir`.
