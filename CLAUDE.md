# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Episteme is an Obsidian plugin for AI-powered flashcard generation with FSRS v6 spaced repetition. It uses OpenRouter for AI access (supporting Gemini, GPT, Claude, Llama models) and stores all data in SQLite.

## Commands

```bash
npm run dev          # Development build with hot reload
npm run build        # Production build (runs tsc first)
npm run lint         # ESLint with Obsidian plugin rules
npm test             # Run tests with Vitest
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

## Architecture

### Plugin Entry Point
`src/main.ts` - `EpistemePlugin` class extending Obsidian's `Plugin`. Initializes all services, registers views, commands, and event handlers.

### Services Layer (`src/services/`)
Services are the core business logic, organized by domain:

- **core/** - `FSRSService` wraps ts-fsrs library for scheduling; `DayBoundaryService` handles Anki-style day boundaries (4 AM default); `EventBusService` for cross-component communication
- **flashcard/** - `FlashcardManager` is the main service for card operations; `FrontmatterService` handles YAML parsing; `FlashcardParserService` extracts Q&A from markdown
- **persistence/sqlite/** - `SqliteStoreService` is the facade for all data storage using sql.js; delegates to specialized repositories (`SqliteCardRepository`, `SqliteSourceNotesRepo`, `SqliteDailyStatsRepo`, `SqliteAggregations`)
- **ai/** - `OpenRouterService` handles AI API calls for flashcard generation
- **stats/** - `StatsService` and `StatsCalculatorService` for analytics

### UI Layer (`src/ui/`)
- **panel/** - `FlashcardPanelView` - main sidebar panel
- **review/** - `ReviewView` - flashcard review interface
- **stats/** - `StatsView` - statistics dashboard with Chart.js
- **custom-session/** - `CustomSessionView` - filtered review session builder
- **modals/** - Various modal dialogs (extends `BaseModal`)

### State Management (`src/state/`)
Simple state containers for UI components: `panel.state.ts`, `review.state.ts`, `custom-session.state.ts`

### Data Storage
All FSRS data is stored in SQLite database at `.episteme/episteme.db`. Schema (v3) includes:
- `cards` - FSRS scheduling data + card content (question, answer, source_uid, tags)
- `source_notes` - source note metadata (uid, name, path, deck)
- `review_log` - review history per card
- `daily_stats` - aggregated daily statistics
- `daily_reviewed_cards` - tracks which cards were reviewed each day

### Key Patterns
- Source notes linked to flashcards via UID stored in frontmatter (`flashcard_uid` in source, `source_uid` in cards table)
- Hierarchical tag system: `#input/*` for literature notes (temporary cards), `#mind/*` for permanent notes

## FSRS Integration

Uses `ts-fsrs` library. Key concepts:
- Card states: New, Learning, Review, Relearning
- 21-parameter weights (configurable in settings)
- Day-based scheduling with configurable day start hour (default 4 AM like Anki)
- Learning steps default: [1, 10] minutes

## ESLint Configuration

Uses `eslint-plugin-obsidianmd` with recommended rules for Obsidian plugin development. See `eslint.config.mts`.

## Testing

Tests in `tests/` directory mirror `src/` structure. Uses Vitest with mocks in `tests/services/mocks/`.
