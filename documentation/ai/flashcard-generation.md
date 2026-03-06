# AI Flashcard Generation

True Recall uses AI to automatically generate flashcards from your notes. This page covers generation methods, models, and customization.

## How AI Generation Works

1. **Input** — You provide content (text, note, or selection)
2. **Processing** — AI analyzes and extracts key concepts
3. **Output** — Flashcards are generated in your chosen format
4. **Review** — You preview and collect the cards you want

## Prerequisites

### Option 1: True Recall AI Subscription (Recommended)

1. Visit [truerecall.app](https://truerecall.app)
2. Subscribe to True Recall AI
3. Copy your subscription key
4. Settings → AI → Subscription key

**Benefits:**
- No API configuration
- Pre-optimized prompts
- Usage tracking
- Priority support

### Option 2: OpenRouter API Key

1. Create account at [openrouter.ai](https://openrouter.ai)
2. Generate API key
3. Settings → AI → API key

**Benefits:**
- Direct API access
- Choose any model
- Pay-per-use

## Generation Methods

### 1. Selection Toolbar

Select text in any note → Toolbar appears:

| Button | Action |
|--------|--------|
| Basic | Generate Q&A card(s) |
| Cloze | Generate cloze deletion(s) |
| Reversed | Generate reversed card(s) |
| Auto | AI chooses best format |

### 2. Flashcard Panel

1. Open Flashcard Panel
2. Click **Generate**
3. Choose source:
   - **Current note** — All content
   - **Selection** — Selected text only
   - **Highlights** — Only highlighted passages
4. Review and collect

### 3. Import Studio

For bulk generation:

1. Command → "Import flashcards"
2. Paste content or type
3. Configure generation options
4. Preview generated cards
5. Import selected

## AI Models

Available through OpenRouter:

### Recommended Models

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| Gemini 3 Flash | ⚡ Fastest | Good | Quick generation |
| Gemini 2.5 Pro | Medium | Excellent | Complex content |
| GPT-4o | Medium | Excellent | General use |
| Claude Sonnet 4 | Medium | Excellent | Nuanced content |
| GPT-4o mini | Fast | Good | Simple content |

### Selecting a Model

Settings → AI → Model

Consider:
- **Speed vs Quality** — Faster models for quick cards, better models for complex topics
- **Cost** — Faster models are usually cheaper
- **Content type** — Some models excel at specific domains

## Generation Language

Control output language:

Settings → AI → Generation language

Options:
- **Auto** — Detect from input (recommended)
- **English, Polish, Spanish, etc.** — Force specific language

## Custom Prompts

Customize how AI generates cards:

Settings → AI → Custom Prompts

### Available Prompts

| Prompt | Affects |
|--------|---------|
| Basic | Q&A generation |
| Cloze | Cloze deletion generation |
| Reversed | Reversed card generation |
| Auto | Auto-detection mode |

### Prompt Template Variables

| Variable | Description |
|----------|-------------|
| `{{content}}` | Input text |
| `{{language}}` | Target language |
| `{{cardCount}}` | Suggested card count |

### Example Custom Prompt

```
Generate flashcards from the following content.
Create 3-5 cards maximum.
Focus on:
- Key definitions
- Important relationships
- Cause and effect

Use simple, clear language.
Avoid creating cards for:
- Dates and years
- Proper names
- Trivial facts

Content:
{{content}}
```

### Prompt Tips

1. **Be specific** — Tell AI exactly what you want
2. **Set limits** — Specify max cards to generate
3. **Define focus** — What concepts matter most
4. **Exclude unwanted** — What to avoid

## Generation Quality Tips

### 1. Provide Context

```markdown
✅ Good input
## Cell Biology

The mitochondria is an organelle found in eukaryotic cells.
It is often called the "powerhouse of the cell" because it
generates most of the cell's ATP through oxidative phosphorylation.

❌ Poor input
mitochondria powerhouse ATP
```

### 2. Use Structured Notes

```markdown
✅ Good structure
## Photosynthesis

### Definition
Process by which plants convert light to chemical energy

### Stages
1. Light-dependent reactions
2. Calvin cycle

### Location
Chloroplasts
```

### 3. Select Appropriate Chunks

- **Too small** — AI lacks context
- **Too large** — AI may miss important points
- **Ideal** — 1-3 paragraphs per generation

### 4. Review Generated Cards

Always check:
- Accuracy of information
- Clarity of questions
- Completeness of answers

## Batch Generation

Generate from multiple notes:

1. Open Import Studio
2. Paste content from multiple sources
3. Generate cards in bulk
4. Review and select

## Troubleshooting

### Poor Quality Cards

1. Try a better model (GPT-4o, Claude)
2. Improve input structure
3. Add custom prompt with guidance

### Too Many Cards

1. Add "Maximum 3 cards" to prompt
2. Select smaller text chunks
3. Be more specific in prompt

### Wrong Language

1. Set explicit language in settings
2. Add language instruction to prompt

### Generation Fails

1. Check API key is valid
2. Check network connection
3. Try different model
4. Check API quota

## Related Topics

- [Selection Toolbar](../creation/selection-toolbar.md) — Quick generation
- [AI Settings](../configuration/ai-settings.md) — Configuration
- [Subscription](./subscription.md) — True Recall AI subscription
