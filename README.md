# True Recall - Spaced Repetition System for Obsidian

> **"Operating System for the Mind"** - UNDERSTAND, REMEMBER, CREATE

True Recall is an Obsidian plugin that combines AI-powered flashcard generation with FSRS v6 spaced repetition. All data is stored locally in SQLite with optional cloud sync (coming soon).

**[Documentation](http://localhost:4321/)**

---

## Features at a Glance

| Feature                      | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| **AI Flashcard Generation**  | 7 AI models via OpenRouter create atomic, well-formatted cards  |
| **FSRS v6 Algorithm**        | State-of-the-art spaced repetition with 21 trainable parameters |
| **SQLite Storage**           | All data in portable `.true-recall/true-recall.db` file         |
| **Projects System**          | Organize cards across notes with many-to-many relationships     |
| **Card Browser**             | Search, filter, and manage all flashcards in one place          |
| **FSRS Simulator**           | Visualize scheduling behavior with different parameters         |
| **Cloud Sync** (coming soon) | Optional sync across devices                                    |
| **Natural Language Queries** | Ask questions about your stats                                  |

---

## Installation

True Recall can be installed via BRAT, manually, or from source.

### Installation via BRAT (Recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) is the easiest way to install and keep True Recall updated.

1. **Install BRAT** from Obsidian Community Plugins
   - Settings → Community plugins → Browse
   - Search for "BRAT"
   - Install and enable it

2. **Add True Recall via BRAT**
   - Settings → BRAT → Add Beta Plugin
   - Enter: `pieralukasz/true-recall`
   - Click "Add Plugin"

3. **Enable True Recall**
   - Settings → Community plugins
   - Find "True Recall" and toggle it on

> BRAT automatically checks for updates. When a new version is released, BRAT will notify you and can update the plugin automatically.

### Manual Installation

1. **Download the latest release** from [GitHub Releases](https://github.com/pieralukasz/true-recall/releases)

2. **Locate your vault's plugins folder**:
   - Open Obsidian → Settings → Community plugins
   - Click the folder icon next to "Installed plugins" to open the plugins folder
   - Or navigate to `<your-vault>/.obsidian/plugins/`

3. **Create the plugin folder**:
   ```bash
   mkdir true-recall
   ```

4. **Copy the files** into the `true-recall` folder:
   - `main.js`
   - `styles.css`
   - `manifest.json`

5. **Enable the plugin**:
   - Settings → Community plugins → Find "True Recall" → Toggle on

### Installation from Source

```bash
git clone https://github.com/pieralukasz/true-recall.git
cd true-recall
npm install
npm run build
cp main.js styles.css manifest.json <your-vault>/.obsidian/plugins/true-recall/
```

Then enable the plugin in Obsidian settings.

### Verify Installation

After installation, you should see:

1. **Ribbon icons**: A brain icon (purple) and a chart icon (orange) in the left sidebar
2. **Commands**: Open Command Palette (`Cmd/Ctrl+P`) and search for "True Recall"
3. **Settings tab**: Settings → True Recall with configuration options

### System Requirements

- **Obsidian**: Version 0.15.0 or later
- **Operating System**: Windows, macOS, or Linux
- **Mobile**: iOS and Android via Obsidian Mobile

### Troubleshooting

- **Plugin doesn't appear**: Ensure all three files (`main.js`, `styles.css`, `manifest.json`) are in the folder, check that the folder is named exactly `true-recall`, try restarting Obsidian
- **Build errors**: Make sure you have Node.js 18+ installed, delete `node_modules` and run `npm install` again
- **Performance issues**: Large vaults (10,000+ notes) may take longer on first load

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
| **Open FSRS simulator**                  | Interactive simulator to visualize FSRS scheduling with different params |
| **Create database backup**               | Creates a timestamped backup of your flashcard database                  |
| **Add flashcard UID to current note**    | Adds a unique identifier to link flashcards to the source note           |

---

## Keyboard Shortcuts

All shortcuts work during review sessions:

| Key             | Action                  | Context                                       |
| --------------- | ----------------------- | --------------------------------------------- |
| **Space**       | Show answer / Rate Good | Hidden → reveals answer; Revealed → rates 3   |
| **1**           | Rate "Again"            | Schedules for immediate re-review (failed)    |
| **2**           | Rate "Hard"             | Shorter interval than default                 |
| **3**           | Rate "Good"             | Normal interval progression                   |
| **4**           | Rate "Easy"             | Longer interval, card is well-known           |
| **Cmd/Ctrl+Z**  | Undo last rating        | Restores previous card state                  |
| **! (Shift+1)** | Suspend card            | Removes from queue until manually unsuspended |
| **-**           | Bury card               | Hides until tomorrow                          |
| **=**           | Bury note               | Buries ALL cards from same source note        |
| **M**           | Move card               | Opens modal to transfer to different note     |
| **N**           | New flashcard           | Opens editor to add card manually             |
| **G**           | AI Generate             | Generate flashcard with AI instructions       |
| **B**           | Branch/copy card        | Duplicates the card                           |
| **E**           | Edit card               | Opens editor for question/answer              |

---

## Views & Panels (8)

### 1. Flashcard Panel (Sidebar)

Primary interface for managing flashcards:

- List of all flashcards from current note
- Add new flashcard button
- AI generation for flashcards
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

### 5. Projects View

Project organization interface:

- All projects with card counts
- Due/New cards per project
- Click to start filtered review
- Create/rename/delete projects

### 6. Simulator View

FSRS algorithm simulator:

- Adjust retention, weights, intervals
- Visualize scheduling curves
- Compare different configurations
- Understand FSRS behavior

---

## Ribbon Icons (2)

| Icon      | Color  | Action                 |
| --------- | ------ | ---------------------- |
| Brain     | Purple | Opens session builder  |
| Bar Chart | Orange | Opens statistics panel |

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

Add `projects` to note frontmatter:

```yaml
---
projects:
    - [[Machine Learning]]
    - [[Python Course]]
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

All data stored in `.true-recall/true-recall.db` using sql.js:

| Table                    | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| **cards**                | Flashcard content (Q&A) + FSRS scheduling data       |
| **review_log**           | Every review: card_id, rating, response time         |
| **daily_stats**          | Daily aggregates: reviews, new cards, time, accuracy |
| **daily_reviewed_cards** | Which cards reviewed each day                        |
| **meta**                 | Schema version for migrations                        |

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
- **@langchain/\*** - Natural language queries
- **@supabase/supabase-js** - Cloud sync
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
- FSRS4Anki Wiki: [https://github.com/open-spaced-repetition/fsrs4anki/wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki)

---

**True Recall** - Transform your Obsidian vault into an intelligent learning system.
