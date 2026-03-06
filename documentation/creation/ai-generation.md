# AI Flashcard Generation

True Recall uses AI to automatically generate flashcards from your notes. This saves hours of manual card creation and helps you focus on learning.

## How AI Generation Works

1. You provide content (selected text, entire note, or topic)
2. AI analyzes the content and identifies key concepts
3. AI generates flashcards in your chosen format (Basic, Cloze, Reversed)
4. You review and collect the generated cards

## Prerequisites

### Option 1: True Recall AI Subscription

The easiest option — no API configuration needed:

1. Go to [truerecall.app](https://truerecall.app)
2. Subscribe to True Recall AI
3. Copy your subscription key
4. Paste in Settings → True Recall → AI → Subscription key

### Option 2: OpenRouter API Key

For advanced users who want direct API access:

1. Create an account at [openrouter.ai](https://openrouter.ai)
2. Generate an API key
3. Add the key in Settings → True Recall → AI → API key

## Generation Methods

### 1. Selection Toolbar

Select text in any note — a toolbar appears:

| Button | Action |
|--------|--------|
| **Basic** | Generate Q&A flashcard(s) |
| **Cloze** | Generate cloze deletion(s) |
| **Reversed** | Generate reversed card(s) |
| **Auto** | AI chooses best format |
| **IO** | Image occlusion (if image detected) |
| **Edit** | Open in flashcard editor |
| **Quick+** | Quick add as basic card |

Enable/disable in Settings → AI → Selection toolbar.

### 2. From Flashcard Panel

1. Open the Flashcard Panel
2. Click **Generate** button
3. Choose generation mode:
   - From current note
   - From selection
   - From highlights (AI finds important text)
4. Review generated cards
5. Collect the ones you want

### 3. Import Studio

For bulk generation:

1. Command Palette → "Import flashcards"
2. Paste or type content
3. Choose note type and prompt
4. Preview generated cards
5. Import selected cards

## AI Models

True Recall supports multiple AI models through OpenRouter:

### Recommended Models

| Model | Best For | Speed |
|-------|----------|-------|
| Gemini 3 Flash | General use, fast | ⚡ Fastest |
| Gemini 2.5 Pro | Complex content | 🔵 Medium |
| GPT-4o | High quality | 🔵 Medium |
| Claude Sonnet | Nuanced content | 🔵 Medium |

Select your preferred model in Settings → AI.

## Custom Prompts

Customize how AI generates cards:

### Default Prompts

True Recall includes optimized prompts for each card type. These work well for most use cases.

### Custom Prompts

In Settings → AI → Custom Prompts, you can:

1. **Basic prompt** — Instructions for Q&A generation
2. **Cloze prompt** — Instructions for cloze generation
3. **Reversed prompt** — Instructions for reversed cards
4. **Auto prompt** — Instructions for auto-detection

### Prompt Tips

Effective prompts include:
- Desired card count (e.g., "Generate 3-5 cards")
- Focus areas (e.g., "Focus on definitions and relationships")
- Format preferences (e.g., "Use simple language")
- What to avoid (e.g., "Don't create cards for dates")

Example custom prompt:
```
Generate flashcards from the selected text.
- Create 2-4 cards maximum
- Focus on key concepts and definitions
- Use cloze format for lists and sequences
- Avoid trivial facts
- Keep answers concise
```

## Generation Language

AI can generate cards in your preferred language:

Settings → AI → Generation language

Options:
- **Auto** — Detect from content
- English, Polish, Spanish, French, German, Japanese, Chinese, etc.

## From Highlights

Generate cards from highlighted text:

1. Highlight important passages in your notes
2. Open Flashcard Panel
3. Click **From Highlights**
4. AI creates cards from highlighted sections

This workflow is perfect for:
- Textbook notes
- Research papers
- Meeting notes

## Tips for Better AI Generation

### 1. Provide Context

```markdown
✅ Good - has context
## Photosynthesis

Photosynthesis is the process by which plants convert light energy
into chemical energy. It occurs in two stages: the light-dependent
reactions and the Calvin cycle.

[Select this paragraph for generation]

❌ Less ideal
Photosynthesis is the process... [isolated sentence]
```

### 2. Use Structured Content

AI works better with structured notes:

```markdown
✅ Good
## Cell Organelles

### Mitochondria
- Function: ATP production
- Location: Cytoplasm
- Structure: Double membrane

### Nucleus
- Function: Contains DNA
- Location: Center of cell
- Structure: Nuclear envelope
```

### 3. Review Before Collecting

Always review generated cards:
- Check for accuracy
- Edit if needed
- Delete irrelevant cards

### 4. Iterate on Prompts

If generation quality is poor:
1. Try a different model
2. Adjust your custom prompt
3. Provide more structured input

## Limitations

- AI may occasionally generate inaccurate cards
- Complex diagrams or math may not be handled well
- Very long content may be truncated
- Language detection isn't perfect

## Troubleshooting

### "No API key configured"

Add your OpenRouter key or subscription key in Settings → AI.

### "Rate limit exceeded"

Wait a moment and try again. Consider upgrading your API tier.

### Poor quality cards

1. Try a different model (Gemini Pro, GPT-4o)
2. Add a custom prompt with specific instructions
3. Provide more structured input text

### Generation too slow

Switch to a faster model like Gemini Flash.

## Related Topics

- [Selection Toolbar](./selection-toolbar.md) — Toolbar details
- [AI Settings](../configuration/ai-settings.md) — Configuration options
- [Subscription](../ai/subscription.md) — True Recall AI subscription
