# Episteme - AI-Powered Spaced Repetition for Obsidian

> **"Operating System for the Mind"** - UNDERSTAND → REMEMBER → CREATE

Episteme is a sophisticated Obsidian plugin that combines AI-powered flashcard generation with the modern FSRS v6 spaced repetition algorithm and Zettelkasten workflow.

## Features

### 🤖 AI-Powered Flashcard Generation
- **Multiple AI Models**: Support for Google Gemini, OpenAI GPT, Anthropic Claude, and Meta Llama via OpenRouter
- **Intelligent Generation**: Atomic flashcards with proper formatting, backlinks, and context
- **Diff Mode**: Update existing flashcards based on note changes without losing stability
- **Source Content Preservation**: Store original note content for better context and updates

### 🧠 Advanced Spaced Repetition (FSRS v6)
- **Modern Algorithm**: FSRS v6 - state-of-the-art spacing algorithm superior to SM-2
- **Day-Based Scheduling**: Anki-style scheduling with configurable day start hour
- **21 Parameter Weights**: Optimizable weights for personalized learning
- **Smart Review Queue**: Prioritizes due learning, review, and new cards intelligently
- **Fuzzing**: ±2.5% interval randomization to prevent review bunching

### 📚 Zettelkasten Integration
- **Tag-Based Classification**: Automatic note type detection via tags
- **Literature Notes** (`#input/*`): Temporary flashcards for source processing
- **Permanent Notes** (`#mind/zettel`): Long-term knowledge storage
- **Harvest Workflow**: Seeding → Incubation → Harvest (21-day maturation)

### 🎯 Flexible Review System
- **Multiple Review Modes**: Fullscreen or sidebar
- **Custom Sessions**: Filter by deck, source, date range, card state, weak cards
- **Daily Limits**: Configurable limits for new cards and reviews
- **Auto-Advance**: Optional automatic card progression
- **Undo Support**: Cmd+Z to undo last answer

### 📊 Comprehensive Statistics
- **Retention Tracking**: Monitor your learning performance
- **Review History**: Visualize your study patterns with Chart.js
- **FSRS Analytics**: Understand algorithm performance and optimization

## Tagging System

Episteme uses a hierarchical tagging system to determine flashcard behavior:

### Literature Notes (`#input/*`)
*Generate temporary flashcards for processing*
- `#input/book` - Book notes
- `#input/article` - Article notes
- `#input/video` - Video notes
- `#input/course` - Course notes

### Permanent Notes (`#mind/*`)

| Tag | Flashcards | Purpose |
|-----|------------|---------|
| `#mind/zettel` | ✅ Permanent | Your thoughts and theses |
| `#mind/application` | ⚠️ Optional | Real-world case studies |
| `#mind/protocol` | ⚠️ Optional | Procedures and how-to |
| `#mind/question` | ❌ None | Open questions |
| `#mind/hub` | ❌ None | Entry points |
| `#mind/structure` | ❌ None | Writing organization |
| `#mind/index` | ❌ None | Category connectors |
| `#mind/person` | ❌ None | People profiles |

## Workflow

### 1. SEEDING
Create temporary flashcards from Literature Notes (`#input/*`)

### 2. INCUBATION
Review cards through spaced repetition (FSRS algorithm)

### 3. HARVEST
After 21+ days, move mature cards to permanent Zettel notes

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

## Configuration

### Required Settings
1. **OpenRouter API Key**: Get your key from [openrouter.ai](https://openrouter.ai)
2. **AI Model**: Choose from Gemini, GPT, Claude, or Llama
3. **Flashcards Folder**: Default is `Flashcards`

### FSRS Settings
- **Request Retention**: Target retention (70%-99%, default 90%)
- **Maximum Interval**: Up to 100 years
- **New Cards Per Day**: Default 20
- **Reviews Per Day**: Default 200
- **Learning Steps**: Default [1, 10] minutes
- **Day Start Hour**: Default 4 AM (Anki-style)

## Usage

### Generate Flashcards
1. Open a note in Obsidian
2. Open the Episteme panel (Cmd+P → "Open flashcard panel")
3. Click "Generate Flashcards"
4. AI will analyze your note and create atomic flashcards

### Review Flashcards
- **Standard Review**: Click the brain icon or use "Start review session"
- **Custom Review**: Use "Start custom review session" for advanced filtering
- **Current Note**: Right-click file → "Review flashcards from this note"

### Harvest Cards
1. Open "Harvest Dashboard" (Cmd+P → "Open harvest dashboard")
2. Review cards ready for harvest (21+ day interval)
3. Select cards and move to permanent Zettel notes

## Commands

- `Open flashcard panel` - Toggle sidebar panel
- `Generate flashcards for current note` - Create flashcards from active note
- `Start review session` - Begin standard review
- `Start custom review session` - Open custom review filters
- `Review flashcards from current note` - Review current note's cards
- `Review today's new cards` - Review cards created today
- `Open statistics panel` - View learning statistics
- `Scan vault for new flashcards` - Index new flashcards
- `Show notes missing flashcards` - Find notes without flashcards
- `Open harvest dashboard` - View harvestable cards

## Development

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Architecture

```
src/
├── main.ts                    # Plugin entry point
├── constants.ts               # Configuration and system prompts
├── services/
│   ├── core/
│   │   ├── fsrs.service.ts   # FSRS algorithm wrapper
│   │   └── day-boundary.service.ts
│   ├── flashcard/
│   │   ├── flashcard.service.ts
│   │   ├── frontmatter.service.ts
│   │   └── card-mover.service.ts
│   ├── harvest/
│   │   └── harvest.service.ts
│   ├── persistence/
│   │   ├── sharded-store.service.ts
│   │   └── session-persistence.service.ts
│   ├── stats/
│   │   └── stats.service.ts
│   └── open-router.service.ts
├── ui/
│   ├── panel/                 # Sidebar panel
│   ├── review/                # Review view
│   ├── stats/                 # Statistics view
│   └── modals/                # Various modals
└── types/                     # TypeScript definitions
```

## Dependencies

- **obsidian** - Obsidian Plugin API
- **ts-fsrs** - FSRS v6 algorithm implementation
- **chart.js** - Statistical visualizations
- **zod** - Schema validation

## License

0-BSD

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

- Report issues on GitHub
- Check documentation for common questions
- Review FSRS algorithm details: [FSRS4Anki Wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki)

---

**Episteme** - Transform your Obsidian vault into an intelligent learning system.
