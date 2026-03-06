# Type-in Mode

**Type-in Mode** lets you type your answers during review instead of just thinking them. True Recall can compare your typed answer with the correct one using either diff comparison or AI semantic grading.

## Enabling Type-in Mode

### During Review

Press `T` to cycle through modes:
1. **Off** — Standard review
2. **AI Grading** — AI evaluates your answer semantically
3. **Diff** — Character-by-character comparison

### Default Setting

Settings → General → Default type-in mode

Options: Off, Diff, AI

## Type-in Interface

```
┌─────────────────────────────────────────────────┐
│              Question text here                  │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ Type your answer...                         ││
│  │                                             ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│            [Show Answer] - Space                │
└─────────────────────────────────────────────────┘
```

### Workflow

1. Read the question
2. Type your answer in the text area
3. Press **Space** or **Cmd/Ctrl + Enter** to submit
4. See the comparison/grading result
5. Rate your answer

## AI Semantic Grading

When using **AI Grading** mode, True Recall uses AI to evaluate your answer.

### How It Works

1. You type your answer
2. AI compares your answer with the correct one
3. AI assigns a score (0-100) and provides feedback
4. You see the score and can rate manually

### Advantages

- Understands synonyms and paraphrases
- Catches partial answers
- Provides helpful feedback
- More forgiving than exact matching

### Example

| Correct Answer | Your Answer | AI Score | Feedback |
|----------------|-------------|----------|----------|
| "Mitochondria" | "Mitochondria" | 100% | Correct! |
| "Mitochondria" | "The powerhouse of the cell" | 85% | Correct description, but looking for the organelle name |
| "Mitochondria" | "Mitocondria" | 95% | Minor spelling error, essentially correct |
| "Mitochondria" | "Nucleus" | 0% | Incorrect |

### Custom Grading Prompt

Settings → AI → Type-in grading prompt

Customize how AI evaluates answers:

```
You are grading a flashcard answer.
- Correct answer: {{correct}}
- Student answer: {{student}}

Score 0-100 and provide brief feedback.
Be strict but fair. Minor spelling errors should score 90+.
```

## Diff Comparison Mode

When using **Diff** mode, True Recall shows a character-by-character comparison.

### How It Works

1. You type your answer
2. System compares with correct answer
3. Differences are highlighted:
   - **Green** — Correct characters
   - **Red** — Incorrect characters
   - **Yellow** — Missing characters

### Example

```
Correct:  M i t o c h o n d r i a
Yours:    M i t o c o n d r i a
              ^^^^^
```

The "on" instead of "chon" is highlighted red.

### Advantages

- Exact spelling feedback
- Good for vocabulary and terminology
- No AI required (works offline)

### Limitations

- Doesn't understand synonyms
- Sensitive to minor typos
- Word order must match

## Choosing Between Modes

| Use AI Grading When | Use Diff Mode When |
|---------------------|-------------------|
| Answers are sentences | Exact spelling matters |
| Multiple correct answers exist | Learning vocabulary |
| You want feedback | Working offline |
| Testing understanding | Testing memorization |

## Type-in Answer Actions

### During Typing

| Key | Action |
|-----|--------|
| `Tab` | Focus/blur input |
| `Cmd/Ctrl+Enter` | Submit answer |
| `Escape` | Cancel typing |

### After Submission

| Button | Action |
|--------|--------|
| **Accept & Rate** | Use AI score as rating |
| **Override** | Ignore AI, rate manually |
| **Edit** | Modify your answer |

## Tips for Effective Type-in

### 1. Don't Look at the Answer

Resist the urge to peek. Type first, then reveal.

### 2. Be Honest with Ratings

Even if AI gives 95%, if you struggled, rate Hard instead of Good.

### 3. Use AI Mode for Concepts

AI grading excels at evaluating conceptual understanding.

### 4. Use Diff Mode for Terms

Diff mode is better for exact terminology and spelling.

### 5. Customize the Prompt

If AI is too lenient or strict, adjust the grading prompt.

## Troubleshooting

### AI Grading Not Working

1. Ensure AI is configured (API key or subscription)
2. Check network connection
3. Fall back to Diff mode if offline

### Input Not Focusing

Press `Tab` to focus the input field.

### Answer Shows Before Typing

Make sure you're not pressing Space too early. Type first, then submit.

## Related Topics

- [Review Interface](./review-interface.md) — Main review view
- [Answering Cards](./answering-cards.md) — Rating explanation
- [AI Settings](../configuration/ai-settings.md) — Configure AI grading
