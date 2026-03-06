# Note Types

**Note Types** are templates that define how flashcards are created from your notes. They're similar to Anki's note types, with fields, templates, and styling.

## What is a Note Type?

A note type defines:

1. **Fields** — Data slots (e.g., Front, Back, Extra, Image)
2. **Templates** — How fields are displayed as cards
3. **CSS** — Styling for cards

One note type can generate multiple cards. For example, a "Reversed" note type might create two cards: one testing Front→Back, another testing Back→Front.

## Built-in Note Types

True Recall includes several built-in note types:

### Basic

The simplest note type with two fields.

| Field | Description |
|-------|-------------|
| Front | Question side |
| Back | Answer side |

Template: Shows Front on the question side, Front + Back on the answer side.

### Basic (Optional Reversed)

Same as Basic, but optionally creates a reversed card.

| Field | Description |
|-------|-------------|
| Front | Question side |
| Back | Answer side |
| Add Reverse | If non-empty, creates reverse card |

### Cloze

Creates fill-in-the-blank cards.

| Field | Description |
|-------|-------------|
| Text | Text with cloze markers `{{c1::answer}}` |
| Back Extra | Additional notes (optional) |

Each cloze deletion becomes a separate card.

### Image Occlusion

Creates cards from images by hiding regions.

| Field | Description |
|-------|-------------|
| Image | Path to the image |
| Mask | Occlusion regions definition |
| Header | Optional header text |
| Back Extra | Additional notes (optional) |

### Reversed

Automatically creates two cards in both directions.

| Field | Description |
|-------|-------------|
| Front | First side |
| Back | Second side |

Creates: Front→Back AND Back→Front cards.

## Managing Note Types

### Opening the Note Type Manager

1. Open Command Palette (Cmd/Ctrl + P)
2. Search for "Manage note types"
3. The Note Type Manager modal opens

### Creating a Custom Note Type

1. In the Note Type Manager, click **New**
2. Enter a name for your note type
3. Add fields as needed
4. Create card templates
5. Add CSS styling
6. Click **Save**

### Editing a Note Type

1. Select the note type in the manager
2. Click **Edit**
3. Modify fields, templates, or CSS
4. Save changes

Note: Changes affect all cards using this note type.

### Deleting a Note Type

1. Select the note type
2. Click **Delete**
3. Confirm the deletion

Built-in note types cannot be deleted.

## Fields

Fields are named slots that hold data. Each field has:

- **Name** — Used in templates (e.g., `{{Front}}`)
- **Type** — Text, image, or other

### Using Fields in Templates

Reference fields with double braces:

```
{{Front}}
```

Fields can be used in both question and answer templates.

### Special Fields

| Field | Description |
|-------|-------------|
| `{{Tags}}` | Note tags |
| `{{Type}}` | Note type name |
| `{{Deck}}` | Project name |
| `{{Subdeck}}` | Sub-project name |

## Templates

Templates define how cards are displayed. Each template has:

- **Question Template** — What shows on the front
- **Answer Template** — What shows on the back

### Template Syntax

Basic field insertion:
```
{{Front}}
```

Cloze field:
```
{{cloze:Text}}
```

Conditional content:
```
{{#Extra}}
Hint: {{Extra}}
{{/Extra}}
```

Inverse conditional (show if empty):
```
{{^Extra}}
No hint available
{{/Extra}}
```

### Creating Multiple Cards

A single note type can have multiple card templates, creating multiple cards:

**Card 1 (Front→Back):**
```
Q: {{Front}}
---
A: {{Back}}
```

**Card 2 (Back→Front):**
```
Q: {{Back}}
---
A: {{Front}}
```

## CSS Styling

Customize card appearance with CSS:

```css
.card {
    font-family: arial;
    font-size: 20px;
    text-align: center;
    color: black;
    background-color: white;
}

.question {
    font-weight: bold;
    color: #333;
}

.answer {
    color: #0066cc;
}

.hint {
    font-style: italic;
    font-size: 0.9em;
    color: #666;
}
```

### Night Mode Support

Use CSS variables for theme compatibility:

```css
.card {
    color: var(--text-normal);
    background-color: var(--background-primary);
}
```

## Using Note Types When Creating Cards

### From Markdown

Specify the note type with a tag:

```markdown
What is the capital of France?
::Paris
#flashcard

Or for cloze:
The capital of France is {{c1::Paris}}.
#flashcard-cloze
```

### From AI Generation

When generating cards with AI, select the note type from the dropdown.

### In the Flashcard Panel

Use the note type picker when creating new cards.

## Converting Between Note Types

You can change the note type of existing cards:

1. Open Card Browser
2. Select cards to convert
3. Right-click → Change note type
4. Select the new note type
5. Map old fields to new fields
6. Confirm

## Note Type vs Card Type

- **Note Type** — Template with fields and card templates
- **Card Type** — Individual card generated from a note type

A "Cloze" note type with 3 clozes generates 3 cards (card types).

## Best Practices

1. **Keep it simple** — Start with built-in types, create custom only when needed
2. **Consistent naming** — Use clear field names like "Front", "Back", "Example"
3. **Minimal templates** — Avoid overly complex templates
4. **Test styling** — Check both light and dark modes
5. **Reuse fields** — Don't duplicate fields across note types

## Related Topics

- [Basic Cards](../creation/basic-cards.md) — Creating basic flashcards
- [Cloze Deletions](../creation/cloze-deletions.md) — Cloze syntax
- [Image Occlusion](../creation/image-occlusion.md) — Image cards
