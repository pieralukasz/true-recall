# Type Safety

Type safety is essential for reliable Obsidian plugins. Use proper type narrowing and avoid unsafe type casts.

## Avoid Type Casting to TFile/TFolder
Rule: `obsidianmd/no-tfile-tfolder-cast`

❌ **INCORRECT**:
```typescript
const file = abstractFile as TFile;
const folder = <TFolder>abstractFile;
```

✅ **CORRECT**:
```typescript
if (abstractFile instanceof TFile) {
  // TypeScript now knows it's a TFile
  const file = abstractFile;
}

if (abstractFile instanceof TFolder) {
  const folder = abstractFile;
}
```

Rationale: Type casting bypasses type safety. Use `instanceof` for safe type narrowing.

---

## Avoid TypeScript `any`
Rule: Type safety best practice

❌ **INCORRECT**:
```typescript
function processData(data: any) {
  return data.value;
}
```

✅ **CORRECT**:
```typescript
// Use specific types
function processData(data: FileData) {
  return data.value;
}

// Or use unknown for truly unknown data
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
}
```

Rationale: `any` bypasses type checking. Use specific types or `unknown` for type safety.

---

## Prefer const and let over var
Rule: Official guidelines (TypeScript best practice)

❌ **INCORRECT**:
```typescript
var count = 0;
var settings = {};
```

✅ **CORRECT**:
```typescript
let count = 0;
const settings = {};
```

Rationale: Use `const` for values that won't be reassigned and `let` for values that will. Avoid `var` for better scoping and fewer bugs.
