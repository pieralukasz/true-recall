# Cloze Deletions

Cloze deletion cards are fill-in-the-blank style flashcards. They're excellent for memorizing facts, lists, and structured information.

## Basic Syntax

Use `{{c<number>::text}}` to create cloze deletions:

```markdown
The {{c1::mitochondria}} is the powerhouse of the cell.
```

This creates one card where "mitochondria" is hidden:
- **Front:** The [...] is the powerhouse of the cell.
- **Back:** The **mitochondria** is the powerhouse of the cell.

## Multiple Clozes

Each cloze number creates a separate card:

```markdown
The {{c1::heart}} pumps {{c2::blood}} through the {{c3::circulatory system}}.
```

This creates 3 cards:
1. Hide "heart"
2. Hide "blood"
3. Hide "circulatory system"

### Same Number = Same Card

Use the same number to hide multiple parts on one card:

```markdown
{{c1::John F. Kennedy}} was elected in {{c1::1960}}.
```

Both are hidden together on one card.

## Cloze with Hints

Add hints after a third colon:

```markdown
The {{c1::Paris::capital of France}} is known as the City of Light.
```

The hint appears in the blank: `[capital of France]`

## Rich Formatting

Clozes work with Markdown:

```markdown
The equation {{c1::$$E = mc^2$$}} was discovered by {{c2::**Albert Einstein**}}.
```

Supported:
- **Bold**, *italic*
- Math (`$$...$$` and `$...$`)
- `Code`
- Links and images

## Cloze Tags

Mark cloze cards with the tag:

```markdown
The {{c1::Earth}} revolves around the {{c2::Sun}}.
#flashcard-cloze
```

Or use the `#flashcard` tag — True Recall auto-detects cloze syntax.

## Complex Clozes

### Lists

```markdown
The three states of matter are:
1. {{c1::Solid}}
2. {{c2::Liquid}}
3. {{c3::Gas}}
```

### Tables

```markdown
| Planet | {{c1::Distance from Sun}} |
|--------|---------------------------|
| Mercury| {{c2::57.9 million km}}   |
| Venus  | {{c3::108.2 million km}}  |
```

### Code

```markdown
```python
def {{c1::greet}}(name):
    return f"Hello, {{c2::{name}}}!"
```
```

## Card Generation

Each unique cloze number generates one card:

| Text | Cards Generated |
|------|-----------------|
| `{{c1::A}}` | 1 card |
| `{{c1::A}} {{c2::B}}` | 2 cards |
| `{{c1::A}} {{c1::B}}` | 1 card (both hidden) |
| `{{c1::A}} {{c1::B}} {{c2::C}}` | 2 cards |

## During Review

Cloze cards display:

1. **Question side:** Text with `[...]` (or hint) in place of cloze
2. **Answer side:** Full text with cloze highlighted

### Multiple Clozes Same Card

When you answer, ALL clozes with that number are revealed together.

## Cloze in Note Types

The Cloze note type handles cloze syntax:

- Field: `Text` (contains cloze markers)
- Field: `Back Extra` (optional additional info)

## Converting to Cloze

Convert existing text to cloze:

1. Select the text
2. Use the Selection Toolbar → **Cloze**
3. AI generates appropriate cloze markers

Or manually wrap important terms: `{{c1::term}}`

## Best Practices

### 1. Atomic Clozes

Each cloze should test ONE piece of information:

```markdown
✅ Good
The {{c1::Battle of Hastings}} occurred in {{c2::1066}}.

❌ Avoid
The {{c1::Battle of Hastings occurred in 1066}}.
```

### 2. Natural Sentences

Keep the sentence readable when clozes are revealed:

```markdown
✅ Good
{{c1::Water}} freezes at {{c2::0°C}} ({{c3::32°F}}).

❌ Awkward
{{c1::Water}} {{c2::freezes}} {{c3::at}} {{c4::0°C}}.
```

### 3. Logical Grouping

Use same numbers for related info:

```markdown
The {{c1::Mona Lisa}} was painted by {{c1::Leonardo da Vinci}}.
```

Both pieces of info should be known together.

### 4. Use Hints Sparingly

Hints help when context is unclear:

```markdown
✅ Good with hint
{{c1::Java::programming language}} was released in 1995.

❌ Unnecessary hint
{{c1::Paris::capital of France}} is in Europe.
```

### 5. Avoid Overlapping Clozes

Don't nest clozes:

```markdown
❌ Problematic
The {{c1::{{c2::United}} States}} of America.

✅ Better
The {{c1::United States}} of America.
```

## Common Use Cases

| Use Case | Example |
|----------|---------|
| Facts | `The {{c1::moon}} orbits {{c2::Earth}}.` |
| Lists | `Primary colors: {{c1::red}}, {{c2::blue}}, {{c3::yellow}}` |
| Definitions | `{{c1::Photosynthesis}}: {{c2::converting light to energy}}` |
| Dates | `{{c1::World War II}} ended in {{c2::1945}}` |
| Formulas | `{{c1::$a^2 + b^2 = c^2$}} (Pythagorean theorem)` |
| Code | `{{c1::print}}("Hello, World!")` |

## Related Topics

- [Basic Cards](./basic-cards.md) — Q&A style cards
- [Reversed Cards](./reversed-cards.md) — Bidirectional cards
- [AI Generation](./ai-generation.md) — AI can generate clozes automatically
- [Note Types](../concepts/note-types.md) — Cloze note type details
