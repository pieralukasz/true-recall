# Episteme - AI-Powered Spaced Repetition for Obsidian

> **"Operating System for the Mind"** - UNDERSTAND, REMEMBER, CREATE

Episteme is an Obsidian plugin that combines AI-powered flashcard generation with FSRS v6 spaced repetition. All data is stored locally in SQLite with optional cloud sync.

---

## Features at a Glance

| Feature                      | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| **AI Flashcard Generation**  | 7 AI models via OpenRouter create atomic, well-formatted cards  |
| **FSRS v6 Algorithm**        | State-of-the-art spaced repetition with 21 trainable parameters |
| **SQLite Storage**           | All data in portable `.episteme/episteme.db` file               |
| **Projects System**          | Organize cards across notes with many-to-many relationships     |
| **Card Browser**             | Search, filter, and manage all flashcards in one place          |
| **FSRS Simulator**           | Visualize scheduling behavior with different parameters         |
| **Cloud Sync**               | Optional Supabase sync across devices                           |
| **Natural Language Queries** | Ask questions about your stats in plain English                 |

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
3. **Generate**: Click the floating brain button or open the flashcard panel
4. **Review**: Click the brain ribbon icon to start a review session
5. **Rate Cards**: Press 1-4 or use buttons (Again, Hard, Good, Easy)

---

## Commands (13)

Access via Command Palette (`Cmd/Ctrl+P`):

| Command                                  | Description                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| **Open flashcard panel**                 | Opens the sidebar showing flashcards for the current note                |
| **Generate flashcards for current note** | Opens panel and triggers AI generation for the active note               |
| **Start review session**                 | Opens session builder to configure and start a review                    |
| **Review flashcards from current note**  | Reviews ONLY cards from the currently open note                          |
| **Review today's new cards**             | Reviews flashcards created today regardless of scheduling                |
| **Open statistics panel**                | Displays analytics: retention, forecasts, charts, and heatmap            |
| **Open projects panel**                  | Shows all projects with card counts. Start project-filtered reviews      |
| **Add current note to project**          | Add/remove current note from projects                                    |
| **Open card browser**                    | Full-featured browser to search, filter, and manage all flashcards       |
| **Open FSRS simulator**                  | Interactive simulator to visualize FSRS scheduling with different params |
| **Create database backup**               | Creates a timestamped backup of your flashcard database                  |
| **Sync cloud data**                      | Synchronize flashcards with Supabase cloud (pull + push)                 |
| **Add flashcard UID to current note**    | Adds a unique identifier to link flashcards to the source note           |

---

## Keyboard Shortcuts

All shortcuts work during review sessions:

| Key             | Action                       | Context                                       |
| --------------- | ---------------------------- | --------------------------------------------- |
| **Space**       | Show answer / Rate Good      | Hidden → reveals answer; Revealed → rates 3   |
| **1**           | Rate "Again"                 | Schedules for immediate re-review (failed)    |
| **2**           | Rate "Hard"                  | Shorter interval than default                 |
| **3**           | Rate "Good"                  | Normal interval progression                   |
| **4**           | Rate "Easy"                  | Longer interval, card is well-known           |
| **Cmd/Ctrl+Z**  | Undo last rating             | Restores previous card state                  |
| **! (Shift+1)** | Suspend card                 | Removes from queue until manually unsuspended |
| **-**           | Bury card                    | Hides until tomorrow                          |
| **=**           | Bury note                    | Buries ALL cards from same source note        |
| **M**           | Move card                    | Opens modal to transfer to different note     |
| **N**           | New flashcard                | Opens editor to add card manually             |
| **G**           | AI Generate                  | Generate flashcard with AI instructions       |
| **B**           | Branch/copy card             | Duplicates the card                           |
| **E**           | Edit card                    | Opens editor for question/answer              |

---

## Views & Panels (8)

### 1. Flashcard Panel (Sidebar)

Primary interface for managing flashcards:

- List of all flashcards from current note
- Add new flashcard button
- AI generation with diff mode for updates
- Edit/delete/move actions per card
- Card preview with markdown rendering

### 2. Review View

Study interface for spaced repetition:

- Question display (Space to reveal answer)
- Answer with markdown formatting
- Four rating buttons: Again (1), Hard (2), Good (3), Easy (4)
- Next interval preview for each rating
- Progress header: "New: 5 | Learning: 3 | Due: 12"
- Undo button (Cmd+Z)

### 3. Statistics View

Comprehensive analytics dashboard:

- **Today's Summary**: Cards reviewed, time spent, accuracy %
- **Future Due Chart**: Bar chart of upcoming workload
- **Retention Rate**: Line chart over time ranges
- **Card Counts**: Distribution by state
- **Calendar Heatmap**: Daily activity visualization
- **Natural Language Query**: Ask questions about your data

### 4. Session View

Advanced session builder for filtered reviews:

- **Current Note**: Review only active note's cards
- **Today's Cards**: Cards created today
- **Multi-Note Selection**: Search and select multiple notes
- **State Filters**: Due, Learning, New, Buried checkboxes
- **Ignore Daily Limits**: Override new/review limits
- **Bypass Scheduling**: Study cards regardless of due dates

### 5. Dashboard View

Quick command center:

- Searchable command list
- Organized by category
- One-click execution

### 6. Projects View

Project organization interface:

- All projects with card counts
- Due/New cards per project
- Click to start filtered review
- Create/rename/delete projects

### 7. Browser View

Full-featured card browser:

- Search cards by question/answer content
- Filter by state, source note, project
- Sort by various criteria
- Bulk operations
- Preview and edit cards

### 8. Simulator View

FSRS algorithm simulator:

- Adjust retention, weights, intervals
- Visualize scheduling curves
- Compare different configurations
- Understand FSRS behavior

---

## Ribbon Icons (3)

| Icon      | Color  | Action                 |
| --------- | ------ | ---------------------- |
| Brain     | Purple | Opens session builder  |
| Bar Chart | Orange | Opens statistics panel |
| Blocks    | Light  | Opens command dashboard|

---

## Context Menu (Right-Click)

When right-clicking a markdown file:

| Menu Item                            | Action                                       |
| ------------------------------------ | -------------------------------------------- |
| **Review flashcards from this note** | Starts review with ONLY cards from this file |
| **Create project from this note**    | Creates a new project using note's name      |
| **Open flashcard panel**             | Opens the sidebar panel                      |

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

---

## AI Models (7)

All accessed via [OpenRouter](https://openrouter.ai) with a single API key:

| Model                | Provider  | Best For                                 |
| -------------------- | --------- | ---------------------------------------- |
| **Gemini 3 Flash**   | Google    | Default - fast, affordable, good quality |
| **Gemini 2.5 Pro**   | Google    | Complex notes requiring deep reasoning   |
| **GPT-5.1**          | OpenAI    | Latest OpenAI model                      |
| **GPT-4o**           | OpenAI    | Balanced speed and quality               |
| **Claude Opus 4.5**  | Anthropic | Most capable, nuanced content            |
| **Claude Sonnet 4**  | Anthropic | Fast with good quality                   |
| **Llama 4 Maverick** | Meta      | Open-source option                       |

---

## Data Storage

### SQLite Database

All data stored in `.episteme/episteme.db` using sql.js:

| Table                    | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| **cards**                | Flashcard content (Q&A) + FSRS scheduling data         |
| **review_log**           | Every review: card_id, rating, response time           |
| **daily_stats**          | Daily aggregates: reviews, new cards, time, accuracy   |
| **daily_reviewed_cards** | Which cards reviewed each day                          |
| **meta**                 | Schema version for migrations                          |

### Cloud Sync (Optional)

- Supabase-based synchronization
- Pull/push with conflict resolution
- Force replace option for recovery

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
- **@langchain/*** - Natural language queries
- **@supabase/supabase-js** - Cloud sync
- **zod** - Schema validation

---

## TODO

### High Priority

- [ ] FSRS weight optimization from review history
- [ ] Mobile-responsive UI improvements
- [ ] Bulk card operations in browser
- [ ] Export/import flashcards (Anki format)

### Features

- [ ] Cloze deletion support
- [ ] Audio/TTS for flashcards
- [ ] Spaced repetition for images (visual memory)
- [ ] Custom card templates
- [ ] Shared decks/projects

### Quality of Life

- [ ] Keyboard shortcuts customization
- [ ] Statistics export (CSV/JSON)
- [ ] Review session history
- [ ] Card difficulty hints during review
- [ ] Improved diff mode accuracy

### Technical

- [ ] Performance optimization for large databases
- [ ] Offline-first sync conflict resolution
- [ ] Plugin API for extensions
- [ ] Automated testing coverage improvement

---

## License

0-BSD

---

## Contributing

Contributions welcome! Please submit a Pull Request.

---

## Support

- Report issues on GitHub
- FSRS4Anki Wiki: [https://github.com/open-spaced-repetition/fsrs4anki/wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki)

---

**Episteme** - Transform your Obsidian vault into an intelligent learning system.
