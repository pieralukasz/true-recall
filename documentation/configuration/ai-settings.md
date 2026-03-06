# AI Settings

Configure AI features in Settings → True Recall → AI.

## True Recall AI Subscription

### Subscription Key

Enter your True Recall AI subscription key (format: `tr-xxxxxxxxxxxx`).

After entering key:
- Shows subscription status
- Tier (Basic, Pro, etc.)
- Approximate generations remaining
- Renewal date

### Benefits of Subscription

- No API configuration
- Pre-optimized prompts
- Usage tracking
- Priority support

## OpenRouter API Key

### API Key

Your OpenRouter API key for direct API access.

**When to use:**
- As fallback when subscription exhausted
- For access to specific models
- For pay-per-use pricing

### Getting an API Key

1. Create account at [openrouter.ai](https://openrouter.ai)
2. Go to Keys
3. Create new key
4. Copy and paste here

## Model Selection

### Generation Model

AI model for flashcard generation:

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| Gemini 3 Flash | ⚡⚡⚡ | Good | Low |
| Gemini 2.5 Pro | ⚡⚡ | Excellent | Medium |
| GPT-4o | ⚡⚡ | Excellent | Medium |
| Claude Sonnet | ⚡⚡ | Excellent | Medium |
| GPT-4o mini | ⚡⚡⚡ | Good | Low |

**Recommended:** Gemini 3 Flash for speed, GPT-4o for quality.

## Generation Language

Target language for AI-generated cards:

| Option | Description |
|--------|-------------|
| Auto | Detect from input content |
| English | Force English output |
| Polish | Force Polish output |
| etc. | Other languages |

**Recommended:** Auto for most cases.

## Selection Toolbar

### Enable Selection Toolbar

Show floating toolbar when text is selected in editor.

| Setting | Effect |
|---------|--------|
| On | Toolbar appears above selection |
| Off | No toolbar (use panel for generation) |

**Recommended:** On for quick card creation.

## Custom Prompts

Customize how AI generates cards.

### Basic Prompt

System prompt for generating basic Q&A cards.

Variables:
- `{{content}}` — Selected text
- `{{language}}` — Target language

### Cloze Prompt

System prompt for generating cloze deletions.

### Reversed Prompt

System prompt for generating reversed cards.

### Auto Prompt

System prompt for auto-detecting best card type.

### Type-in Grading Prompt

System prompt for AI answer grading during type-in mode.

Variables:
- `{{correct}}` — Correct answer
- `{{student}}` — Student's answer

### Image Occlusion Detection Prompt

System prompt for AI region detection in images.

## Prompt Tips

### 1. Be Specific

```
Generate 3-5 flashcards focusing on key definitions.
Use simple language appropriate for beginners.
```

### 2. Set Limits

```
Maximum 3 cards per selection.
Avoid creating cards for dates and names.
```

### 3. Define Format

```
For lists, use cloze format.
For definitions, use basic format.
```

## Settings Summary

| Setting | Default | Recommendation |
|---------|---------|----------------|
| Subscription key | — | Add if subscribed |
| API key | — | Add as fallback |
| Model | Gemini 3 Flash | Flash for speed, GPT-4o for quality |
| Language | Auto | Auto |
| Selection toolbar | On | On |
| Custom prompts | Default | Customize if needed |

## Related Topics

- [AI Flashcard Generation](../ai/flashcard-generation.md) — Using AI
- [AI Answer Grading](../ai/answer-grading.md) — Type-in grading
- [Selection Toolbar](../creation/selection-toolbar.md) — Toolbar usage
