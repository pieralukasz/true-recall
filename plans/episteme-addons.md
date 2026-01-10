# Episteme Plugin Enhancement Plan

## Image Occlusion, Quick Image Paste, and Card Templates

---

## Research Summary: Anki's Strengths & Weaknesses

### What Anki Does Best

-   **Image Occlusion Enhanced** (most popular addon) - hide/reveal parts of images
-   **Spaced repetition** - proven algorithm for long-term retention
-   **Cross-platform** - desktop, web, mobile sync
-   **Customizable** - addons, card templates, advanced scheduling
-   **Large community** - shared decks, extensive documentation

### What Anki Does Poorly (Your Opportunities)

| Issue                | Anki's Problem                                 | Your Advantage                      |
| -------------------- | ---------------------------------------------- | ----------------------------------- |
| **UI/UX**            | "Ugly, clunky, outdated", steep learning curve | Clean Obsidian-native interface     |
| **AI Integration**   | None native                                    | Built-in OpenRouter AI generation ✓ |
| **Sync/Reliability** | Crashes, data loss, sync conflicts             | Git-based version control ✓         |
| **Mobile**           | Separate apps, sync issues                     | Works via Obsidian Mobile ✓         |
| **Card Creation**    | 100% manual, tedious                           | AI-powered generation ✓             |
| **Collaboration**    | Poor deck sharing                              | Git-based collaboration ✓           |
| **Modern Features**  | Incremental reading, cram mode missing         | Potential to innovate               |

### Most Popular Anki Addons to Emulate

1. **Image Occlusion Enhanced** (1374772155) - 5 stars, #1 most popular
2. **Review Heatmap** - Visual progress tracking
3. **Quick Clipboard Copy** (1297559139) - Fast clipboard workflows
4. **Screenshot Copy** (307017237) - Auto-copy screenshots to cards
5. **Batch Editing** (291119185) - Bulk card operations

---

## Your Plugin: Current State

### Already Implemented Well

-   FSRS v6 algorithm (better than Anki's default)
-   AI-powered flashcard generation (unique advantage)
-   Clean Obsidian integration
-   Statistics dashboard with Chart.js
-   Keyboard shortcuts, undo, buried/suspended cards
-   Three main views: Panel, Review, Stats

### Key Gaps to Address

1. **No Image Occlusion** - Anki's #1 addon, completely missing
2. **Limited Image Support** - No quick paste, no clipboard integration
3. **No Card Templates** - Users can't customize layouts
4. **No Tag System** - Basic deck organization only

---

## Implementation Plan

### Feature 1: Image Occlusion

**Goal**: Allow users to hide/reveal parts of images during review (like Anki's IOE addon)

#### Data Model

```typescript
interface OcclusionShape {
	type: "rect" | "ellipse" | "polygon" | "path";
	// Shape-specific coordinates (as percentages for responsive scaling)
}

interface OcclusionItem {
	id: string;
	shape: OcclusionShape;
	label?: string;
	hint?: string;
	group?: string;
}

interface ImageOcclusionData {
	imagePath: string;
	width: number;
	height: number;
	occlusions: OcclusionItem[];
	mode: "hide-all" | "hide-one" | "cloze";
}
```

#### Storage Format (inline in markdown)

```markdown
What structure is shown? #flashcard

<!--IO
{
  "imagePath": "Attachments/anatomy.png",
  "occlusions": [...]
}
IO-->
```

#### Key Components to Create

-   `src/services/image-occlusion.service.ts` - Core IO logic
-   `src/ui/components/ImageOcclusionEditor.ts` - Canvas-based editor
-   `src/ui/components/ImageOcclusionCard.ts` - Review mode renderer
-   `src/types/image-occlusion.types.ts` - Type definitions

#### Integration Points

-   **FlashcardPanelView**: Add "Create Image Occlusion Card" button
-   **ReviewView**: Detect IO cards, render with SVG overlay
-   **FlashcardParserService**: Parse `<!--IO -->` blocks

#### Technical Challenges

-   Canvas coordinate mapping (display size vs actual image size)
-   SVG overlay alignment across resize events
-   Mobile touch support for drawing shapes
-   Performance with many occlusions

---

### Feature 2: Quick Image Paste

**Goal**: Paste images from clipboard/screenshot directly into flashcards

#### Service Implementation

```typescript
class ImagePasteService {
	async handlePaste(event: ClipboardEvent): Promise<string>;
	async saveImageFromClipboard(items: DataTransferItemList): Promise<TFile>;
	generateFilename(): string;
	async optimizeImage(file: File): Promise<Blob>;
}
```

#### Settings to Add

```typescript
imagePasteFolder: string;
imagePasteResize: boolean;
imagePasteMaxWidth: number;
imagePasteMaxHeight: number;
imagePasteQuality: number;
```

#### Integration Points

-   **FlashcardPanelView**: Register paste event handlers
-   **ReviewView**: Enable paste in edit mode
-   Keyboard shortcut: `Cmd+Shift+V`

#### Technical Challenges

-   Clipboard access restrictions
-   Filename collision handling
-   Large image optimization (resize/compress)
-   Obsidian attachment folder configuration

---

### Feature 3: Card Templates

**Goal**: Allow users to customize card layouts with CSS

#### Template System

```typescript
interface CardTemplate {
	id: string;
	name: string;
	type: "global" | "deck" | "card-type";
	css: string;
	htmlStructure?: {
		question: string; // Must contain {{question}} placeholder
		answer: string; // Must contain {{answer}} placeholder
	};
	variables?: Record<string, string>;
}
```

#### Built-in Templates

-   **Default** - Current styling
-   **Minimal** - Clean, simple
-   **Colorful** - Gradient backgrounds
-   **Anki-Style** - Classic Anki appearance

#### Template Variables

-   `{{question}}`, `{{answer}}`, `{{deck}}`
-   `{{tags}}`, `{{sourceNote}}`
-   `{{state}}`, `{{interval}}`, `{{ease}}`

#### Key Components

-   `src/services/template.service.ts` - Template engine
-   `src/ui/modals/TemplateEditorModal.ts` - CSS editor with live preview
-   `src/ui/components/TemplatePreview.ts` - Live preview component

#### Integration Points

-   **ReviewView**: Apply template when rendering cards
-   **SettingsTab**: Template selector and editor
-   **FlashcardPanelView**: Preview with applied template

---

## Critical Files to Modify

1. **`src/types/flashcard.types.ts`**

    - Add `ImageOcclusionFlashcard` interface
    - Extend `FlashcardItem` with `type` field

2. **`src/types/settings.types.ts`**

    - Add image paste settings
    - Add template settings
    - Update `DEFAULT_SETTINGS`

3. **`src/ui/review/ReviewView.ts`**

    - Render IO cards with SVG overlay
    - Apply templates to cards
    - Handle paste events in edit mode

4. **`src/ui/panel/FlashcardPanelView.ts`**

    - IO card creation button
    - Template selector
    - Image paste handlers

5. **`src/services/flashcard/flashcard.service.ts`**
    - Add `createImageOcclusionCard()` method
    - Extend parsing for IO data

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

-   Create type definitions for all 3 features
-   Extend settings with new configuration
-   Create service skeletons
-   Update constants

### Phase 2: Quick Image Paste (Week 2-3)

-   Implement ImagePasteService
-   Add paste handlers in Panel and Review views
-   Create settings UI
-   Test various image formats

### Phase 3: Card Templates - MVP (Week 3-4)

-   Implement TemplateService
-   Create 3 built-in templates
-   Add template selector to ReviewView
-   Integrate template rendering

### Phase 4: Image Occlusion - MVP (Week 4-6)

-   Implement ImageOcclusionService
-   Create basic occlusion editor (rectangles only)
-   Build SVG renderer for review mode
-   Integrate with Panel and Review views

### Phase 5: Image Occlusion - Advanced (Week 6-8)

-   Add multiple shape types (ellipse, polygon, path)
-   Implement selection, move, resize, undo/redo
-   Add mobile touch support
-   Add hide-all, hide-one, cloze modes

### Phase 6: Card Templates - Advanced (Week 8-9)

-   Build Template Editor with syntax highlighting
-   Add live preview
-   Implement variable system
-   Add import/export functionality

### Phase 7: Integration & Polish (Week 9-10)

-   Cross-feature integration
-   Performance optimization
-   Documentation
-   Testing and bug fixes

---

## Technical Considerations

### Obsidian API to Leverage

-   `TFile`, `Vault` - Image file operations
-   `MarkdownRenderer` - Render with templates
-   `Clipboard` - Clipboard data access
-   `Workspace` - Open image editor

### Performance Optimizations

-   Lazy loading for templates
-   Cache parsed templates and SVG
-   Debounce paste events and template edits
-   Web Workers for image processing

### Backward Compatibility

-   All features opt-in (disabled by default)
-   Existing cards unchanged
-   No data migration needed
-   Graceful degradation for errors

---

## Verification

### Testing Checklist

-   [ ] Paste images from clipboard (PNG, JPG, GIF, WebP)
-   [ ] Create image occlusion card with rectangle shapes
-   [ ] Review IO card with reveal animation
-   [ ] Apply different templates to cards
-   [ ] Create custom template with CSS
-   [ ] Test on mobile Obsidian
-   [ ] Verify backward compatibility

### Manual Testing Steps

1. Open FlashcardPanelView, paste image from clipboard
2. Create IO card, draw shapes on image
3. Start review session, verify IO card renders correctly
4. Apply "Colorful" template, verify visual change
5. Create custom template, test live preview

---

## Sources

-   [AnkiWeb Add-ons](https://ankiweb.net/shared/addons)
-   [Image Occlusion Enhanced](https://ankiweb.net/shared/info/1374772155)
-   [Top Anki Plug-Ins 2025](https://www.polyglossic.com/top-anki-plug-ins-2025-edition/)
-   [Reddit: Anki Addons 2025](https://www.reddit.com/r/Anki/comments/1jatsey/its_2025_what_addons_are_you_using/)
-   [Anki Forums: User Complaints](https://forums.ankiweb.net/t/things-that-still-really-piss-me-off-after-using-anki-for-8-years/55826)
