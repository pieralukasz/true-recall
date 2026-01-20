# Episteme - AI-Powered Spaced Repetition for Obsidian

> **"Operating System for the Mind"** - UNDERSTAND, REMEMBER, CREATE

Episteme is a comprehensive Obsidian plugin that combines AI-powered flashcard generation with FSRS v6 spaced repetition and Zettelkasten workflow integration. All data is stored locally in SQLite.

---

## Features at a Glance

| Feature | Description |
|---------|-------------|
| **AI Flashcard Generation** | 7 AI models via OpenRouter create atomic, well-formatted flashcards |
| **FSRS v6 Algorithm** | State-of-the-art spaced repetition with 21 trainable parameters |
| **SQLite Storage** | All data in portable `.episteme/episteme.db` file |
| **Projects System** | Organize cards across notes with many-to-many relationships |
| **12 Commands** | Full command palette integration |
| **12+ Keyboard Shortcuts** | Efficient review workflow |
| **9 Views/Panels** | Specialized interfaces for every task |
| **Natural Language Queries** | Ask questions about your stats in plain English |
| **Image/Media Support** | Embed images and videos with auto-path tracking |

---

## Installation

### Manual Installation

1. Download the latest release
2. Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/episteme/` folder
3. Enable the plugin in Obsidian settings

### From Source

```bash
git clone https://github.com/yourusername/obsidian-episteme.git
cd obsidian-episteme
npm install
npm run build
```

---

## Quick Start

1. **Configure API Key**: Settings → Episteme → Enter your [OpenRouter](https://openrouter.ai) API key
2. **Open a Note**: Navigate to any note you want to create flashcards from
3. **Generate**: Click the brain icon or run "Generate flashcards for current note"
4. **Review**: Click the brain ribbon icon to start a review session
5. **Rate Cards**: Press 1-4 or use buttons (Again, Hard, Good, Easy)

---

## Commands (12)

Access via Command Palette (`Cmd/Ctrl+P`):

| Command | Description |
|---------|-------------|
| **Open flashcard panel** | Opens the main sidebar showing flashcards for the current note. Add, edit, delete cards, and trigger AI generation from here. |
| **Generate flashcards for current note** | AI analyzes the active note and creates atomic flashcards. If cards exist, proposes updates via diff mode (NEW/MODIFIED/DELETED). |
| **Start review session** | Opens review interface with cards filtered by daily limits and due dates. Rate cards 1-4 to schedule next review. |
| **Review flashcards from current note** | Reviews ONLY cards from the currently open note. Useful for focused topic study. |
| **Review today's new cards** | Reviews flashcards created today regardless of scheduling. Reinforce newly generated cards immediately. |
| **Open statistics panel** | Displays analytics: retention rate, future due forecast, card maturity pie chart, daily heatmap, and more. |
| **Show notes missing flashcards** | Lists all notes without flashcards (respects excluded folders). Find gaps in your knowledge coverage. |
| **Show ready to harvest** | Lists cards with 21+ day intervals ready to move from literature notes to permanent Zettel notes. |
| **Sync source notes with vault** | Reconciles database with vault state. Detects renamed/moved/deleted notes and updates references. |
| **Show orphaned cards** | Shows flashcards whose source notes were deleted. Review, delete, or re-attach them to other notes. |
| **Show projects** | Opens Projects panel showing all project groupings with card counts. Start project-filtered reviews. |
| **Add current note to project** | Add/remove current note from projects. Projects stored in frontmatter and auto-synced. |

---

## Keyboard Shortcuts

All shortcuts work during review sessions:

| Key | Action | Context |
|-----|--------|---------|
| **Space** | Show answer / Rate Good | Hidden → reveals answer; Revealed → rates 3 |
| **1** | Rate "Again" | Schedules for immediate re-review (failed) |
| **2** | Rate "Hard" | Shorter interval than default |
| **3** | Rate "Good" | Normal interval progression |
| **4** | Rate "Easy" | Longer interval, card is well-known |
| **Cmd/Ctrl+Z** | Undo last rating | Restores previous card state |
| **! (Shift+1)** | Suspend card | Removes from queue until manually unsuspended |
| **-** | Bury card | Hides until tomorrow |
| **=** | Bury note | Buries ALL cards from same source note until tomorrow |
| **M** | Move card | Opens modal to transfer to different source note |
| **N** | New flashcard | Opens editor to add card to current source |
| **B** | Branch/copy card | Duplicates the card |
| **E** | Edit card | Opens inline editor for question/answer |

---

## Views & Panels (9)

### 1. Flashcard Panel (Main Sidebar)

Primary interface for managing flashcards:
- List of all flashcards from current note
- Add new flashcard button
- AI generation with diff mode for updates
- Edit/delete/move actions per card
- Card preview with markdown rendering
- Live autocomplete when linking notes

### 2. Review View

Study interface for spaced repetition:
- Question display (Space to reveal answer)
- Answer with markdown formatting
- Four rating buttons: Again (1), Hard (2), Good (3), Easy (4)
- Next interval preview for each rating
- Progress header: "New: 5 | Learning: 3 | Due: 12"
- Undo button (Cmd+Z)
- Edit card inline

### 3. Statistics View

Comprehensive analytics dashboard:
- **Today's Summary**: Cards reviewed, time spent, accuracy %
- **Future Due Chart**: Bar chart of upcoming workload
- **Retention Rate**: Line chart over 1m/3m/6m/1y/all-time
- **Card Maturity**: Pie chart (New, Learning, Young <21d, Mature >=21d, Suspended, Buried)
- **Calendar Heatmap**: Daily activity visualization
- **Natural Language Query**: Ask questions like "How many cards did I review last week?"

### 4. Custom Session View

Advanced session builder for filtered reviews:
- **Current Note**: Review only active note's cards
- **Today's Cards**: Cards created today
- **Multi-Note Selection**: Search and select multiple notes
- **State Filters**: Due, Learning, New, Buried checkboxes
- **Ignore Daily Limits**: Override new/review limits
- **Bypass Scheduling**: Study cards regardless of due dates
- **Project Filter**: Review only cards from specific projects

### 5. Missing Flashcards View

Find notes without flashcards:
- Click note name to open it
- Shows note path for disambiguation
- Respects excluded folders setting
- Identify coverage gaps

### 6. Ready to Harvest View

Cards ready for "graduation" to permanent notes:
- Cards with 21+ day intervals (well-learned)
- Grouped by source note
- Part of literature → permanent workflow

### 7. Orphaned Cards View

Manage cards without source notes:
- Lists cards whose source files were deleted
- Actions: Edit, Delete, Re-attach to note
- Prevents knowledge loss from deletions

### 8. Projects View

Project organization interface:
- All projects with card counts
- Due/New cards per project
- Click to start filtered review
- Create/rename/delete projects

### 9. Dashboard View

Quick command center:
- Searchable command list
- Organized by category
- One-click execution
- Today's quick stats

---

## Ribbon Icons (3)

| Icon | Color | Action |
|------|-------|--------|
| Brain | Purple | Opens review session selector |
| Bar Chart | Orange | Opens statistics panel |
| Blocks | Light | Opens command dashboard |

---

## Context Menu (Right-Click)

When right-clicking a markdown file:

| Menu Item | Action |
|-----------|--------|
| **Review flashcards from this note** | Starts review with ONLY cards from this file |
| **Create project from this note** | Creates a new project using note's name |

---

## Projects System

Projects organize flashcards into collections spanning multiple notes.

### What Are Projects?

- Named groups (e.g., "Spanish Course", "Machine Learning", "Book: Atomic Habits")
- Notes can belong to multiple projects (many-to-many)
- Cards inherit their source note's project memberships
- Review sessions can filter by project

### Using Projects

Add `episteme_projects` to note frontmatter:

```yaml
---
episteme_projects:
  - Machine Learning
  - Python Course
---
```

Or use:
- Command: "Add current note to project"
- Right-click: "Create project from this note"

Projects auto-create when first used and sync automatically when notes are modified.

### Project-Filtered Reviews

1. Open Projects panel
2. Click a project to start filtered review
3. Or use Custom Session → select project
4. Only cards from notes in that project appear

---

## Tagging System (Zettelkasten)

Tags determine which notes generate flashcards:

### Literature Notes (`#input/*`)

Temporary flashcards for processing source material:

| Tag | Purpose |
|-----|---------|
| `#input/book` | Book notes |
| `#input/article` | Article/paper notes |
| `#input/video` | Video/lecture notes |
| `#input/course` | Course material |

### Permanent Notes (`#mind/*`)

| Tag | Flashcards | Purpose |
|-----|------------|---------|
| `#mind/zettel` | Yes | Your ideas and insights - permanent knowledge |
| `#mind/application` | Optional | Real-world case studies |
| `#mind/protocol` | Optional | Procedures and how-to guides |
| `#mind/question` | No | Open questions to explore |
| `#mind/hub` | No | Entry points to topics |
| `#mind/structure` | No | Writing outlines |
| `#mind/index` | No | Category connectors |
| `#mind/person` | No | People profiles |

---

## AI Models (7)

All accessed via [OpenRouter](https://openrouter.ai) with a single API key:

| Model | Provider | Best For |
|-------|----------|----------|
| **Gemini 3 Flash** | Google | Default - fast, affordable, good quality |
| **Gemini 2.5 Pro** | Google | Complex notes requiring deeper understanding |
| **GPT-5.1** | OpenAI | Excellent reasoning |
| **GPT-4o** | OpenAI | Balanced speed and quality |
| **Claude Opus 4.5** | Anthropic | Most capable, nuanced content |
| **Claude Sonnet 4** | Anthropic | Fast with good quality |
| **Llama 4 Maverick** | Meta | Open-source, privacy-focused |

---

## Settings Reference

### AI Generation

| Setting | Description | Default |
|---------|-------------|---------|
| **OpenRouter API Key** | Required for AI generation | None |
| **AI Model** | Model for flashcard generation | Gemini 3 Flash |
| **Flashcards Folder** | Legacy folder setting | "Flashcards" |
| **Store Source Content** | Save note content for diff updates | false |
| **Excluded Folders** | Ignore when scanning for missing flashcards | [] |

### FSRS Algorithm

| Setting | Description | Default |
|---------|-------------|---------|
| **Request Retention** | Target recall probability (0.70-0.99) | 0.90 |
| **Maximum Interval** | Longest possible review interval | 36500 days |
| **New Cards Per Day** | Daily new card limit | 20 |
| **Reviews Per Day** | Daily review limit | 200 |
| **Learning Steps** | Minutes between new card reviews | [1, 10] |
| **Relearning Steps** | Minutes for lapsed cards | [10] |
| **Graduating Interval** | Days until first review after learning | 1 |
| **Easy Interval** | Days if rated "Easy" first time | 4 |
| **FSRS Weights** | 21 algorithm parameters | v6 defaults |

### Review UI

| Setting | Description | Default |
|---------|-------------|---------|
| **Review Mode** | Fullscreen or sidebar panel | Fullscreen |
| **Custom Session Interface** | Modal or panel | Modal |
| **Show Next Review Time** | Display predicted intervals | true |
| **Auto-Advance** | Auto-show next card after rating | false |
| **Show Review Header** | Display progress bar and stats | true |
| **Show Header Stats** | Show New/Learning/Due counters | true |
| **Continuous Custom Reviews** | "Next Session" button after completing | false |

### Display Order

| Setting | Description | Default |
|---------|-------------|---------|
| **New Card Order** | Random, Oldest First, Newest First | Random |
| **Review Order** | Due Date, Random, Due Date + Random | Due Date |
| **New/Review Mix** | After Reviews, Mixed In, Before Reviews | After Reviews |

### Scheduling

| Setting | Description | Default |
|---------|-------------|---------|
| **Day Start Hour** | When "day" resets (Anki-style) | 4 (4:00 AM) |
| **Zettel Folder** | Where to create permanent notes | "Zettel" |

---

## Data Storage

### SQLite Database

All data stored in `.episteme/episteme.db` using sql.js:

| Table | Purpose |
|-------|---------|
| **cards** | Flashcard content (Q&A) + FSRS data (due, stability, difficulty, state, reps, lapses) |
| **source_notes** | Maps note UIDs to file paths |
| **projects** | Project names and timestamps |
| **note_projects** | Many-to-many note-project relationships |
| **review_log** | Every review: card_id, rating, response_time_ms, scheduled/elapsed days |
| **daily_stats** | Daily aggregates: reviews, new cards, time, rating breakdown |
| **daily_reviewed_cards** | Which cards reviewed each day |
| **card_image_refs** | Image-to-card references |
| **meta** | Schema version for migrations |

### Benefits

- Fast queries with proper indexing
- Portable single-file database
- No external server needed
- Full review history for analytics

---

## Advanced Features

### Natural Language Queries

Ask questions about your data in plain English:

**How it works:**
- Uses LangChain with OpenRouter LLM
- AI generates read-only SQL queries
- Results interpreted in natural language

**Example questions:**
- "How many cards did I review last week?"
- "What's my average retention rate?"
- "Which cards have I failed the most?"
- "What's my longest review streak?"

**Access:** Statistics panel → "Ask a Question" section

### Image & Media Support

**Supported formats:**
- Images: png, jpg, jpeg, gif, webp, svg
- Videos: mp4, webm, mov, ogg

**Features:**
- Image Picker Modal: Browse vault for images
- Clipboard Paste: Paste directly into editor
- Wiki-Link Syntax: `![[image.png|width]]`
- Auto-Path Updates: References update when images move/rename
- Database Tracking: `card_image_refs` table tracks usage

### Auto-Sync Behaviors

The plugin automatically responds to file changes:

| Event | Behavior |
|-------|----------|
| **File Modify** | Syncs `episteme_projects` frontmatter to database (500ms debounce) |
| **File Rename** | Updates source note paths and image references in cards |
| **File Delete** | Marks cards as orphaned (preserves cards, unlinks source) |
| **Image Rename** | Updates all flashcard image paths |
| **Leaf Change** | Flashcard panel updates to show current note's cards |

### Diff Mode Updates

When generating flashcards for a note that already has cards:
- AI compares current note content with existing flashcards
- Proposes: NEW cards for uncovered content, MODIFIED for errors, DELETED for removed content
- Preserves existing stable flashcards (stability over perfection)
- Requires "Store Source Content" setting enabled

---

## FSRS v6 Algorithm

Free Spaced Repetition Scheduler version 6 - superior to Anki's SM-2:

### Key Concepts

- **Stability**: Days until 90% retention probability
- **Difficulty**: Per-card difficulty (0-10)
- **Fuzzing**: ±2.5% interval randomization prevents bunching
- **States**: New → Learning → Review → Relearning (on lapse)

### Learning Flow

1. New card shown
2. Learning steps (default: 1min, 10min)
3. Graduates to Review (default: 1 day interval)
4. Review intervals grow based on ratings
5. Lapsed cards enter Relearning

---

## Architecture

```
src/
├── main.ts                           # Plugin entry point
├── constants.ts                      # AI prompts, models, defaults
├── plugin/
│   ├── PluginCommands.ts            # All 12 commands
│   ├── PluginEventHandlers.ts       # File watchers, context menus
│   └── ViewActivator.ts             # View management
├── services/
│   ├── core/
│   │   ├── fsrs.service.ts          # FSRS algorithm
│   │   ├── day-boundary.service.ts  # Anki-style day handling
│   │   └── event-bus.service.ts     # Cross-component events
│   ├── flashcard/
│   │   ├── FlashcardManager.ts      # Card operations
│   │   ├── FrontmatterService.ts    # YAML parsing
│   │   └── CardMoverService.ts      # Move cards between notes
│   ├── persistence/sqlite/
│   │   ├── SqliteStoreService.ts    # Database facade
│   │   └── repositories/            # Specialized data access
│   ├── ai/
│   │   ├── OpenRouterService.ts     # AI API integration
│   │   └── NLQueryService.ts        # Natural language queries
│   ├── review/
│   │   └── ReviewService.ts         # Review session logic
│   └── stats/
│       └── StatsService.ts          # Analytics calculations
├── ui/
│   ├── panel/                       # Main sidebar
│   ├── review/                      # Review interface
│   ├── stats/                       # Statistics dashboard
│   ├── session/                     # Custom session builder
│   ├── projects/                    # Project management
│   └── modals/                      # Various dialogs
└── types/                           # TypeScript definitions
```

---

## Development

```bash
npm run dev          # Development build with hot reload
npm run build        # Production build
npm run lint         # ESLint with Obsidian plugin rules
npm test             # Run tests with Vitest
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

### Dependencies

- **obsidian** - Plugin API
- **ts-fsrs** - FSRS v6 algorithm
- **sql.js** - SQLite in JavaScript
- **chart.js** - Visualizations
- **langchain** - Natural language queries
- **zod** - Schema validation

---

## License

0-BSD

---

## Contributing

Contributions welcome! Please submit a Pull Request.

---

## Support

- Report issues on GitHub
- FSRS details: [FSRS4Anki Wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki)

---

**Episteme** - Transform your Obsidian vault into an intelligent learning system.
