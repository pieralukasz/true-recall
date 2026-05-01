## Core Package

This subtree is for platform-agnostic domain logic in `packages/core`.

### Responsibilities

- Flashcard domain logic
- FSRS scheduling and review behavior
- Persistence and backup logic
- AI generation and grading
- Metrics and analytics calculations
- RAG and retrieval services
- Validation, types, helpers, and domain interfaces

### Rules

- Keep Obsidian-specific behavior out of this package
- Prefer pure domain services and explicit interfaces over plugin-coupled utilities
- When adding new behavior, place it in the closest domain slice instead of growing generic utility files
- Update or add tests under `packages/core/tests` with non-trivial core changes
