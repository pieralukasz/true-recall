# Reversed Cards

Reversed cards create two flashcards from one piece of information — one in each direction. They're perfect for vocabulary, definitions, and any bidirectional learning.

## Basic Syntax

Use `:::` (three colons) instead of `::`:

```markdown
Capital of France
:::Paris
```

This creates **two cards**:

1. **Card 1:**
   - Front: Capital of France
   - Back: Paris

2. **Card 2:**
   - Front: Paris
   - Back: Capital of France

## When to Use Reversed Cards

Reversed cards are ideal when:

- Learning vocabulary (word ↔ definition)
- Memorizing capitals (country ↔ city)
- Studying formulas (name ↔ equation)
- Any A ↔ B relationship

## Examples

### Vocabulary

```markdown
ephemeral
:::lasting for a very short time
```

Cards:
1. ephemeral → lasting for a very short time
2. lasting for a very short time → ephemeral

### Capitals

```markdown
Japan
:::Tokyo
```

Cards:
1. Japan → Tokyo
2. Tokyo → Japan

### Formulas

```markdown
Pythagorean theorem
:::$$a^2 + b^2 = c^2$$
```

Cards:
1. Pythagorean theorem → a² + b² = c²
2. a² + b² = c² → Pythagorean theorem

### Abbreviations

```markdown
HTTP
:::Hypertext Transfer Protocol
```

Cards:
1. HTTP → Hypertext Transfer Protocol
2. Hypertext Transfer Protocol → HTTP

## Multi-Line Content

Reversed syntax works with multi-line content:

```markdown
Water molecule structure
:::
- Formula: H₂O
- Two hydrogen atoms
- One oxygen atom
- Bent molecular geometry
```

Both cards show the full answer.

## Note Type for Reversed

Use the **Reversed** note type or **Basic (Optional Reversed)**:

### Reversed Note Type

Always creates both directions.

### Basic (Optional Reversed)

Has an "Add Reverse" field. Fill it to create the reverse card:

```markdown
Question :: Answer
Add Reverse: yes
```

## Scheduling Independence

Each direction is scheduled independently:

- You might remember "Japan → Tokyo" easily
- But struggle with "Tokyo → Japan"

FSRS tracks each card separately, optimizing intervals for each direction.

## When NOT to Use Reversed

Reversed cards aren't always appropriate:

### Asymmetric Knowledge

```markdown
❌ Avoid
The protagonist of 1984
:::Winston Smith
```

Problem: "Winston Smith" could be from many books. The reverse card is confusing.

```markdown
✅ Better - one direction only
The protagonist of 1984
::Winston Smith
```

### Lists

```markdown
❌ Avoid
The primary colors
:::Red, Blue, Yellow
```

Problem: "Red, Blue, Yellow" → "The primary colors" is too easy/guessable.

### Complex Answers

```markdown
❌ Avoid
Photosynthesis
:::
1. Light-dependent reactions occur in...
2. Calvin cycle fixes carbon...
```

Problem: The reverse card requires recalling all that from "1. Light-dependent..."

## Tips for Good Reversed Cards

### 1. Symmetric Difficulty

Both directions should be similarly challenging:

```markdown
✅ Good
mitochondria
:::powerhouse of the cell
```

Both directions require actual recall.

### 2. Unique Identifiers

Each side should uniquely identify the other:

```markdown
✅ Good
C++ creator
:::Bjarne Stroustrup
```

Only one person created C++, and he's known for it.

### 3. Clear Context

Add context if needed:

```markdown
✅ Good
[Greek mythology] God of the sea
:::Poseidon
```

### 4. Consistent Format

Keep both sides in similar format:

```markdown
✅ Good
temporary
:::ephemeral

❌ Inconsistent
temporary
:::lasting for a very short time; ephemeral; brief; fleeting
```

## Converting to Reversed

Convert existing basic cards:

1. Open the card in editor
2. Change `::` to `:::`
3. Save

A new reverse card is created and scheduled as "New".

## Related Topics

- [Basic Cards](./basic-cards.md) — One-direction Q&A cards
- [Cloze Deletions](./cloze-deletions.md) — Fill-in-the-blank
- [AI Generation](./ai-generation.md) — AI can suggest reversed cards
- [Note Types](../concepts/note-types.md) — Reversed note type
