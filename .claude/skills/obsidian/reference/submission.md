# Plugin Submission Requirements

Guidelines for publishing your plugin to the Obsidian community plugin directory.

## Repository Structure

```
your-plugin/
├── manifest.json       # Required: Plugin metadata
├── main.js            # Required: Compiled plugin code
├── styles.css         # Optional: Plugin styles
├── LICENSE            # Required: License file
└── README.md          # Recommended: Usage documentation
```

---

## Naming and Description Guidelines

The Obsidian release validation bot (`validate-plugin-entry.yml`) enforces these rules:

### Plugin ID (Required)
- **Cannot contain "obsidian"** (case-insensitive)
- **Cannot end with "plugin"**
- **Must use only**: lowercase alphanumeric characters, dashes (`-`), and underscores (`_`)
- Must be unique (not used by existing or removed plugins)
- Keep it short and simple (used for plugin folder name)

### Plugin Name (Required)
- **Cannot contain "Obsidian"** (case-insensitive)
- **Cannot end with "Plugin"**
- **Cannot start with "Obsi" or end with "dian"**
- Must be unique among existing plugins
- Use a clear, descriptive name

### Description (Required)
- **Cannot include "Obsidian"** (case-insensitive)
- **Cannot use phrases**: "This plugin", "This is a plugin", "This plugin allows"
- **Must end with punctuation**: `.`, `?`, `!`, or `)`
- **Recommended max 250 characters** (longer descriptions trigger readability warnings)
- Focus on what the plugin does, not what it is

### Author (Required)
- Must be the repository owner or a public member of the organization
- Repository must have issues enabled (warning)
- Must include a valid open source license

### Repository (Required)
- Format: `"owner/repo-name"`
- Must match the actual GitHub repository

### Manifest Synchronization
- Plugin `id`, `name`, and `description` must match `manifest.json` in the repository

---

**Examples:**

✅ Good:
```json
{
  "id": "daily-notes-helper",
  "name": "Daily Notes Helper",
  "description": "Enhance your daily notes workflow with templates and quick actions.",
  "author": "YourUsername",
  "repo": "YourUsername/daily-notes-helper"
}
```

❌ Bad:
```json
{
  "id": "obsidian-daily-notes-plugin",  // Contains "obsidian" and ends with "plugin"
  "name": "Obsidian Daily Notes Plugin", // Contains "Obsidian" and ends with "Plugin"
  "description": "This is an Obsidian plugin that helps with daily notes" // Contains "Obsidian" and "This is...plugin", no punctuation
}
```

---

## Submission Process

### 1. Create GitHub Release

- Tag must match version in `manifest.json`
- Include: `manifest.json`, `main.js`, `styles.css`

### 2. Submit to community-plugins.json

Fork `obsidianmd/obsidian-releases` and add entry:

```json
{
  "id": "your-plugin-id",
  "name": "Your Plugin Name",
  "author": "Your Name",
  "description": "Short description.",
  "repo": "username/repo-name"
}
```

Create pull request.

### 3. Follow Developer Policies

- Comply with Obsidian's terms of service
- No malicious code
- Respect user privacy
- No analytics without disclosure

---

## Semantic Versioning

Follow semantic versioning:
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

---

## Testing Before Submission

- Test on mobile (if not desktop-only)
- Test with keyboard navigation
- Test in both light and dark themes
- Verify all ESLint rules pass
- Remove all sample/template code
- Ensure manifest.json is valid
- Include LICENSE file
