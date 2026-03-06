# AI Answer Grading

True Recall can use AI to grade your typed answers during review. This provides semantic evaluation that understands meaning, not just exact matches.

## How AI Grading Works

1. You type your answer during review
2. AI compares your answer with the correct one
3. AI assigns a score (0-100) and provides feedback
4. You can accept the AI score or rate manually

## Enabling AI Grading

### During Review

Press `T` to cycle: Off → AI Grading → Diff → Off

### Default Mode

Settings → General → Default type-in mode: AI

## Grading Interface

```
┌─────────────────────────────────────────────────┐
│  Question: What is the powerhouse of the cell?  │
│                                                 │
│  Your answer:                                   │
│  ┌─────────────────────────────────────────────┐│
│  │ The organelle that produces ATP             ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  [Submit Answer]                                │
└─────────────────────────────────────────────────┘

After submission:
┌─────────────────────────────────────────────────┐
│  Correct: Mitochondria                          │
│  Yours: The organelle that produces ATP         │
│                                                 │
│  AI Score: 85%                                  │
│  Feedback: Correct description! The answer      │
│  you're looking for is the specific organelle   │
│  name: Mitochondria.                            │
│                                                 │
│  [Accept & Rate Good]  [Override]              │
└─────────────────────────────────────────────────┘
```

## Grading Behavior

### Score Interpretation

| Score | Interpretation |
|-------|----------------|
| 90-100 | Essentially correct |
| 70-89 | Mostly correct, minor issues |
| 50-69 | Partially correct |
| 0-49 | Incorrect |

### Auto-Rating

When you click "Accept & Rate":

| AI Score | Rating Applied |
|----------|----------------|
| 90-100 | Good |
| 70-89 | Hard |
| 0-69 | Again |

### Manual Override

Click "Override" to rate manually regardless of AI score.

## What AI Grading Understands

### Synonyms

```
Correct: Automobile
Answer: Car
Score: 95%
```

### Paraphrases

```
Correct: The process of photosynthesis converts light to energy
Answer: Photosynthesis turns sunlight into chemical energy
Score: 90%
```

### Partial Answers

```
Correct: Mitochondria produces ATP through oxidative phosphorylation
Answer: Mitochondria produces ATP
Score: 75%
Feedback: Correct, but missing the specific process
```

### Minor Typos

```
Correct: Mitochondria
Answer: Mitocondria
Score: 95%
```

## Customizing Grading

### Grading Prompt

Settings → AI → Type-in grading prompt

Customize how AI evaluates:

```
Grade this flashcard answer:
- Correct answer: {{correct}}
- Student answer: {{student}}

Score 0-100 where:
- 90-100: Essentially correct
- 70-89: Minor errors or incomplete
- 50-69: Partially correct
- 0-49: Incorrect

Provide brief feedback (1-2 sentences).
Be strict but fair. Minor spelling errors should score 90+.
```

### Template Variables

| Variable | Description |
|----------|-------------|
| `{{correct}}` | The correct answer |
| `{{student}}` | The student's answer |
| `{{question}}` | The card's question |

## When to Use AI Grading

### Good For

- Conceptual understanding questions
- Open-ended answers
- Multiple correct answers possible
- Testing comprehension

### Less Ideal For

- Exact terminology (use Diff mode)
- Spelling practice (use Diff mode)
- Short factual answers
- Working offline

## Tips

### 1. Be Honest with Overrides

If AI says 90% but you struggled, rate Hard instead of Good.

### 2. Use for Complex Cards

AI grading shines with longer, conceptual answers.

### 3. Adjust Prompt for Your Style

If AI is too lenient, make the prompt stricter.

### 4. Check Feedback

AI feedback can help identify knowledge gaps.

## Troubleshooting

### AI Grading Not Working

1. Ensure AI is configured (API key or subscription)
2. Check network connection
3. Fall back to Diff mode if offline

### Inconsistent Grading

1. Try a more consistent model (GPT-4o)
2. Adjust grading prompt
3. Use Diff mode for exact matching

### Too Lenient/Strict

Modify the grading prompt with your desired strictness level.

## Related Topics

- [Type-in Mode](../review/type-in-mode.md) — Type-in interface
- [Review Interface](../review/review-interface.md) — Review view
- [AI Settings](../configuration/ai-settings.md) — AI configuration
