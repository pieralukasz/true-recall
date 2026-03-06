# Basic Cards

Basic cards are the simplest flashcard type — one question, one answer. This page covers all the syntax options for creating basic flashcards.

## Basic Syntax

The simplest flashcard uses `::` to separate question and answer:

```markdown
What is the capital of France?
::Paris
```

This creates one card:
- **Front:** What is the capital of France?
- **Back:** Paris

## Inline vs Block Syntax

### Inline

Everything on one line:

```markdown
What is 2 + 2? ::4
```

### Block (Multi-line)

Use blank lines for longer content:

```markdown
Explain the process of photosynthesis.

Include the following:
- Light-dependent reactions
- Calvin cycle

::Photosynthesis is the process by which plants convert light energy into chemical energy...

The light-dependent reactions occur in the thylakoid membrane...
```

## Multi-Line Answers

For answers with multiple lines, use block syntax:

```markdown
What are the three branches of government?
::
1. Legislative - makes laws
2. Executive - enforces laws
3. Judicial - interprets laws
```

## Markdown Formatting

Cards support full Markdown:

```markdown
What is the formula for **Euler's identity**?
::$$e^{i\pi} + 1 = 0$$

This equation connects:
- $e$ (Euler's number)
- $i$ (imaginary unit)
- $\pi$ (pi)
```

Supported formatting:
- **Bold**, *italic*, ~~strikethrough~~
- `inline code` and code blocks
- [Links](url) and ![[images]]
- Math (LaTeX)
- Lists, tables, blockquotes

## Images in Cards

### Embedded Images

```markdown
What anatomical structure is highlighted?
![[brain-anatomy.png#highlight]]
::Hippocampus
```

### Image on Both Sides

```markdown
![[flag.png]]
::France

Or:

Identify this country:
::![[france-map.png]]
```

## Links and WikiLinks

Cards can contain links:

```markdown
Which note discusses neural networks?
::[[Machine Learning Basics]]

What is the relationship between [[Topic A]] and [[Topic B]]?
::They are related because...
```

## Tags

Add tags to your cards:

```markdown
What is the powerhouse of the cell?
::Mitochondria
#flashcard #biology #cell-biology
```

Tags are searchable in the Card Browser.

## Hint Syntax

Add optional hints:

```markdown
Who wrote "1984"?
::George Orwell
Hint: British author, also wrote "Animal Farm"
```

Hints appear on the answer side.

## Collecting Cards

After writing flashcards in your notes, they need to be **collected**:

1. Open the Flashcard Panel
2. See the "Uncollected" section
3. Click **Collect** on each card (or Collect All)

Collection:
- Adds cards to the database
- Assigns FSRS scheduling
- Links cards to the source note

## Card Status in Panel

After collection, cards appear in the panel with status badges:

| Badge | Meaning |
|-------|---------|
| 🟢 New | Never reviewed |
| 🟠 Learning | In learning phase |
| 🔵 Review | Graduated |
| 🔴 Suspended | Manually paused |

## Editing Cards

### From Source

Edit the markdown in your note. Changes sync automatically.

### From Panel

Click the edit icon to open the card editor.

### During Review

Press `E` to edit the current card inline.

## Deleting Cards

### From Source

Delete the markdown line. The card becomes "orphaned" and can be removed.

### From Panel

Click the trash icon → confirm deletion.

### During Review

Press `!` to suspend, or use the actions menu.

## Card Separators

Use horizontal rules to separate multiple cards visually:

```markdown
Card 1 question
::Answer 1

---

Card 2 question
::Answer 2
```

## Context Lines

Include context above your cards:

```markdown
## Chapter 3: Cellular Biology

The mitochondria is known as the powerhouse of the cell.

What is the primary function of mitochondria?
::ATP production through cellular respiration
```

Context helps during review without being part of the question.

## Best Practices

1. **One concept per card** — Keep cards focused
2. **Clear questions** — Avoid ambiguity
3. **Concise answers** — Don't write essays
4. **Use formatting** — Bold key terms, use lists
5. **Add context** — Include relevant background
6. **Include images** — Visual learning is powerful

## Common Patterns

### Definition Cards

```markdown
What is [term]?
::[definition]
```

### Q&A Cards

```markdown
[Question]?
::[Answer]
```

### Fact Cards

```markdown
[Fact statement].
::[Elaboration or verification]
```

### Concept Cards

```markdown
Explain the concept of [X].
::[Explanation with key points]
```

## Related Topics

- [Cloze Deletions](./cloze-deletions.md) — Fill-in-the-blank cards
- [Reversed Cards](./reversed-cards.md) — Bidirectional cards
- [AI Generation](./ai-generation.md) — Generate cards with AI
- [Image Occlusion](./image-occlusion.md) — Cards from images
