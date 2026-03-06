# Selection Toolbar

The **Selection Toolbar** appears when you select text in the editor, providing instant access to AI-powered flashcard creation.

## Enabling the Toolbar

Settings → AI → Selection toolbar (enabled by default)

When enabled, selecting any text shows the toolbar above your selection.

## Toolbar Buttons

| Button | Shortcut | Action |
|--------|----------|--------|
| **Basic** | — | Generate Q&A flashcard(s) |
| **Cloze** | — | Generate cloze deletion(s) |
| **Reversed** | — | Generate reversed card(s) |
| **Auto** | — | AI chooses best format automatically |
| **IO** | — | Image occlusion (appears if image is selected) |
| **Edit** | — | Open selection in flashcard editor |
| **Quick+** | — | Quickly add as basic flashcard |

## Using the Toolbar

### Basic Workflow

1. Select text in your note
2. Toolbar appears automatically
3. Click the desired button
4. AI generates flashcard(s)
5. Preview appears in the toolbar
6. Click to collect or edit

### Quick+ Workflow

For fastest card creation:

1. Select a question and answer
2. Click **Quick+**
3. Card is immediately created

Use when the selection is already in Q&A format.

### Auto Mode

Let AI decide the best format:

1. Select text
2. Click **Auto**
3. AI analyzes content and chooses:
   - Cloze for lists and sequences
   - Basic for Q&A pairs
   - Reversed for definitions

## Image Occlusion Button

The **IO** button appears when:
- Selected text contains an image reference
- An image file is selected in the file browser

Click to open the Image Occlusion editor for that image.

## Customizing Behavior

### Generation Settings

Settings → AI controls:

- **Model** — Which AI model to use
- **Language** — Output language
- **Custom prompts** — Generation instructions

### Per-Click Options

Right-click any toolbar button for options:
- Change model temporarily
- Adjust card count
- Select target note

## Toolbar Position

The toolbar positions itself:
- **Above** the selection (default)
- Adjusts if near screen edges
- Follows as you extend selection

## Keyboard Workflow

While there are no default shortcuts for toolbar buttons, you can:

1. Select text with keyboard (Shift + arrows)
2. Press Tab to focus toolbar
3. Use arrow keys to select button
4. Press Enter to activate

## Tips

### 1. Select Meaningful Chunks

```markdown
✅ Good selection
The mitochondria is the powerhouse of the cell. It produces ATP
through cellular respiration and has its own DNA.

❌ Too short
The mitochondria

❌ Too long
[Entire 10-page chapter]
```

### 2. Use Auto for Mixed Content

When text contains both definitions and lists, Auto mode picks the best format for each part.

### 3. Edit After Generation

Generated cards aren't perfect. Click the generated card to edit before collecting.

### 4. Batch Generation

Select multiple paragraphs at once. AI generates multiple cards, which you can review individually.

## Troubleshooting

### Toolbar Not Appearing

1. Check Settings → AI → Selection toolbar is enabled
2. Make sure AI is configured (API key or subscription)
3. Try reloading Obsidian

### Generation Fails

1. Check API key is valid
2. Check network connection
3. Try a different model

### Toolbar Position Wrong

The toolbar may overlap other editor extensions. Try:
- Scrolling the note
- Reducing editor font size
- Disabling conflicting plugins

## Related Topics

- [AI Generation](./ai-generation.md) — Detailed AI generation guide
- [Image Occlusion](./image-occlusion.md) — Creating cards from images
- [AI Settings](../configuration/ai-settings.md) — Configuration options
