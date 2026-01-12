# Code Quality & Best Practices

Code quality ensures maintainability, reliability, and better user experience.

## Table of Contents
- [Remove Sample Code](#remove-sample-code)
- [Security Best Practices](#security-best-practices)
- [Platform Compatibility](#platform-compatibility)
- [API Usage Best Practices](#api-usage-best-practices)
- [Async/Await Patterns](#asyncawait-patterns)
- [DOM Helpers](#dom-helpers)
- [Miscellaneous Rules](#miscellaneous-rules)

---

## Remove Sample Code

### Remove Sample Code
Rule: `obsidianmd/no-sample-code`

Remove all sample/template code before publishing:
- Sample ribbon icons
- Example status bar items
- Template settings
- Boilerplate comments

---

### Rename Sample Class Names
Rule: `obsidianmd/sample-names`

❌ **INCORRECT**:
```typescript
class MyPlugin extends Plugin { }
interface MyPluginSettings { }
class SampleSettingTab extends PluginSettingTab { }
class SampleModal extends Modal { }
```

✅ **CORRECT**:
```typescript
class TodoPlugin extends Plugin { }
interface TodoPluginSettings { }
class TodoSettingTab extends PluginSettingTab { }
class TodoModal extends Modal { }
```

Rationale: Rename placeholder class names from the sample plugin template (`MyPlugin`, `MyPluginSettings`, `SampleSettingTab`, `SampleModal`) to meaningful names for your plugin.

---

## Security Best Practices

### Avoid innerHTML and outerHTML
Rule: Security best practice

❌ **INCORRECT**:
```typescript
element.innerHTML = '<div>' + userContent + '</div>';
element.outerHTML = '<p>' + text + '</p>';
```

✅ **CORRECT**:
```typescript
// Use DOM API
const div = element.createDiv();
div.textContent = userContent;

// Or use Obsidian helpers
const div = createDiv();
div.setText(userContent);
```

Rationale: Using `innerHTML`/`outerHTML` is a security risk (XSS vulnerability). Use DOM API or Obsidian helper functions instead.

---

## Platform Compatibility

### Avoid Regex Lookbehind
Rule: `obsidianmd/regex-lookbehind`

❌ **INCORRECT**:
```typescript
const pattern = /(?<=@)\w+/;  // Not supported on some iOS versions
```

✅ **CORRECT**:
```typescript
const pattern = /@(\w+)/;
const match = text.match(pattern);
const username = match?.[1];
```

Rationale: Regex lookbehind not supported on iOS versions before 16.4.

---

### Use Platform API for OS Detection
Rule: `obsidianmd/platform`

❌ **INCORRECT**:
```typescript
if (navigator.platform.includes('Mac')) { }
if (navigator.userAgent.includes('Windows')) { }
if (window.navigator.platform === 'Linux') { }
```

✅ **CORRECT**:
```typescript
import { Platform } from 'obsidian';

if (Platform.isMacOS) { }
if (Platform.isWin) { }
if (Platform.isLinux) { }
if (Platform.isMobile) { }
if (Platform.isIosApp) { }
if (Platform.isAndroidApp) { }
if (Platform.isDesktopApp) { }
```

Rationale: Avoid using the `navigator` API to detect the operating system. Use Obsidian's Platform API instead for better reliability and mobile support.

---

### Use window.setTimeout and window.setInterval
Rule: Platform compatibility

❌ **INCORRECT**:
```typescript
const timer: NodeJS.Timeout = setTimeout(() => {
  // do something
}, 1000);

const interval = setInterval(() => {
  // do something
}, 1000);
```

✅ **CORRECT**:
```typescript
const timer: number = window.setTimeout(() => {
  // do something
}, 1000);

const interval: number = window.setInterval(() => {
  // do something
}, 1000);

// Clear them with:
window.clearTimeout(timer);
window.clearInterval(interval);
```

Rationale: Use `window.setTimeout/setInterval` with `number` type instead of `NodeJS.Timeout` for browser compatibility.

---

## API Usage Best Practices

### Don't Use Global `app` Object
Rule: Best practice from official guidelines

❌ **INCORRECT**:
```typescript
// Don't use global app
const vault = app.vault;
const workspace = app.workspace;
```

✅ **CORRECT**:
```typescript
// Use the plugin instance reference
const vault = this.app.vault;
const workspace = this.app.workspace;
```

Rationale: Always use `this.app` from your plugin instance instead of the global `app` object for better encapsulation and reliability.

---

### Use requestUrl() Instead of fetch()
Rule: Best practice from official guidelines

❌ **INCORRECT**:
```typescript
// Don't use fetch()
const response = await fetch('https://api.example.com/data');
const data = await response.json();
```

✅ **CORRECT**:
```typescript
import { requestUrl } from 'obsidian';

// Use Obsidian's requestUrl() to bypass CORS
const response = await requestUrl('https://api.example.com/data');
const data = response.json;
```

Rationale: Don't use `fetch()`. Use Obsidian's `requestUrl()` instead to bypass CORS restrictions. The browser's fetch API is subject to CORS policies, but `requestUrl()` bypasses these restrictions.

---

### Minimize Console Logging
Rule: Best practice from official guidelines

❌ **INCORRECT**:
```typescript
async onload() {
  console.log('Plugin loaded');
  console.log('Processing file:', file.path);
  console.log('Settings updated:', settings);
}

onunload() {
  console.log('Plugin unloaded');
}
```

✅ **CORRECT**:
```typescript
async onload() {
  // Only log errors by default
  console.error('Failed to process file:', error);

  // Use debug mode for development logging
  if (this.settings.debugMode) {
    console.log('Processing file:', file.path);
  }
}

onunload() {
  // No console.log in production
}
```

Rationale: The developer console should display errors by default, not debug messages. Minimize unnecessary console output. **In production, do not use console.log in onload and onunload** - these methods are called frequently and pollute the console. Use debug mode flags for development logging.

---

### Prefer AbstractInputSuggest
Rule: `obsidianmd/prefer-abstract-input-suggest`

❌ **INCORRECT**:
```typescript
// Don't use the custom TextInputSuggest implementation
// (frequently copied from Liam's code)
class MyTextInputSuggest extends TextInputSuggest<string> {
  // Uses createPopper with sameWidth modifier
}
```

✅ **CORRECT**:
```typescript
import { AbstractInputSuggest } from 'obsidian';

class MyInputSuggest extends AbstractInputSuggest<string> {
  getSuggestions(query: string): string[] {
    // Return suggestions
  }

  renderSuggestion(value: string, el: HTMLElement) {
    el.setText(value);
  }

  selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent) {
    // Handle selection
  }
}
```

Rationale: Use the built-in `AbstractInputSuggest` API instead of copying custom `TextInputSuggest` implementations that use `createPopper`.

---

### Use updateOptions() for Editor Extensions
Rule: Official guidelines

```typescript
// When reconfiguring editor extensions
this.app.workspace.updateOptions();
```

Rationale: When reconfiguring editor extensions, use `updateOptions()` to flush changes across all open editors.

---

## Async/Await Patterns

### Prefer async/await over Promise chains
Rule: Code readability and maintainability

❌ **INCORRECT**:
```typescript
function loadData() {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), 1000);
  });
}

getData()
  .then(result => processResult(result))
  .then(processed => saveData(processed))
  .catch(error => console.error(error))
  .finally(() => cleanup());
```

✅ **CORRECT**:
```typescript
async function loadData() {
  await sleep(1000);  // Use Obsidian's sleep() helper
  return data;
}

try {
  const result = await getData();
  const processed = await processResult(result);
  await saveData(processed);
} catch (error) {
  console.error(error);
} finally {
  cleanup();
}
```

Rationale: async/await is more readable and maintainable. Use Obsidian's `sleep()` function instead of `new Promise` with setTimeout.

---

## DOM Helpers

### Use Obsidian DOM Helpers
Rule: Prefer Obsidian API over vanilla DOM

❌ **INCORRECT**:
```typescript
const div = document.createElement('div');
const span = document.createElement('span');
const fragment = document.createDocumentFragment();
```

✅ **CORRECT**:
```typescript
// On any HTMLElement:
const div = containerEl.createDiv();
const span = containerEl.createSpan();
const el = containerEl.createEl('section');

// Or use global helpers:
const div = createDiv();
const span = createSpan();
const fragment = createFragment();
```

Rationale: Obsidian's helper functions (`createDiv()`, `createSpan()`, `createEl()`, `createFragment()`) are more concise and integrate better with the API.

---

## Miscellaneous Rules

### Object.assign Must Have 3 Parameters
Rule: `obsidianmd/object-assign`

❌ **INCORRECT**:
```typescript
Object.assign(settings);  // Missing target
```

✅ **CORRECT**:
```typescript
Object.assign({}, DEFAULT_SETTINGS, settings);
```

---

### Organize Multi-File Plugins into Folders
Rule: Best practice from official guidelines

✅ GOOD STRUCTURE:
```
my-plugin/
├── src/
│   ├── commands/
│   ├── modals/
│   ├── settings/
│   ├── utils/
│   └── main.ts
├── styles.css
├── manifest.json
└── README.md
```

Rationale: For plugins with multiple files, organize them into folders to improve maintainability and review processes.

---

### Validate manifest.json
Rule: `obsidianmd/validate-manifest`

Ensure your `manifest.json` is valid:
```json
{
  "id": "unique-plugin-id",
  "name": "Plugin Name",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "Short description",
  "author": "Your Name",
  "authorUrl": "https://...",
  "isDesktopOnly": false
}
```

---

### Validate LICENSE
Rule: `obsidianmd/validate-license`

Must include a valid LICENSE file (MIT recommended).
