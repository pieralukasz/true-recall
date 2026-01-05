# Plan: Kompleksowa Refaktoryzacja Aplikacji Episteme

---

## CZĘŚĆ I: PODSUMOWANIE POSTĘPU (Wykonane)

### Zrealizowane Fazy Refaktoryzacji Services

| Faza     | Status  | Szczegóły                                                    |
| -------- | ------- | ------------------------------------------------------------ |
| Faza 1.1 | ✅ DONE | Fix `sessionPersistence` visibility → private + proxy method |
| Faza 2.1 | ✅ DONE | Extract `FrontmatterService` (229 LOC)                       |
| Faza 2.2 | ✅ DONE | Extract `FlashcardParserService` (98 LOC)                    |
| Faza 2.3 | ✅ DONE | Extract `CardMoverService` (141 LOC)                         |
| Faza 3   | ✅ DONE | Reorganizacja folderów (7 subdomen)                          |

### Aktualna Struktura Services (Po Refaktoryzacji)

```
services/
├── ai/
│   └── openrouter.service.ts         (228 LOC)
├── core/
│   ├── day-boundary.service.ts       (108 LOC) ✅ Wzorcowy
│   └── fsrs.service.ts               (319 LOC)
├── flashcard/
│   ├── card-mover.service.ts         (141 LOC) NEW
│   ├── flashcard-parser.service.ts   (98 LOC) NEW
│   ├── flashcard.service.ts          (1,282 LOC) ← Nadal wymaga podziału
│   └── frontmatter.service.ts        (229 LOC) NEW
├── persistence/
│   ├── session-persistence.service.ts (373 LOC)
│   └── sharded-store.service.ts      (365 LOC)
├── review/
│   └── review.service.ts             (582 LOC)
├── stats/
│   ├── stats-calculator.service.ts   (533 LOC)
│   └── stats.service.ts              (66 LOC)
├── ui/
│   └── backlinks-filter.service.ts   (150 LOC)
└── index.ts                          (z dokumentacją)
```

**FlashcardManager zredukowany z 1,529 → 1,282 LOC** (nadal God Class)

---

## CZĘŚĆ II: ANALIZA CAŁEJ APLIKACJI

### Przegląd Wszystkich Folderów

| Folder         | Pliki | LOC    | Status         | Priorytet |
| -------------- | ----- | ------ | -------------- | --------- |
| `ui/`          | 26    | 6,788  | 🔴 CRITICAL    | P0        |
| `services/`    | 13    | ~3,800 | 🟡 IN PROGRESS | P1        |
| `types/`       | 5     | 751    | ✅ OK          | -         |
| `validation/`  | 4     | 633    | ✅ OK          | -         |
| `errors/`      | 4     | 205    | ✅ OK          | -         |
| `constants.ts` | 1     | 269    | ✅ OK          | -         |
| `main.ts`      | 1     | 621    | ✅ OK          | -         |

---

## CZĘŚĆ III: ANALIZA UI (CRITICAL)

### God Classes w UI

| Plik                      | LOC   | Single Responsibility | Problemy                       |
| ------------------------- | ----- | --------------------- | ------------------------------ |
| **ReviewView.ts**         | 1,264 | 2/10 ❌               | 10+ odpowiedzialności          |
| **CustomSessionModal.ts** | 701   | 4/10                  | 8 metod kalkulacji statystyk   |
| **StatsView.ts**          | 616   | 5/10                  | Mieszanie logiki i prezentacji |
| **FlashcardPanelView.ts** | 565   | 5/10                  | Wiele odpowiedzialności        |

### ReviewView.ts - Dekompozycja (1,264 LOC)

```
ReviewView obecnie robi:
├── Session management (start, pause, resume, end)
├── Card rendering (question, answer, hints)
├── UI state management (buttons, progress)
├── Keyboard shortcuts handling
├── Statistics tracking (session stats)
├── Timer management
├── Audio feedback
├── Progress bar updates
├── Deck filtering
├── Rating button logic
├── Animation handling
└── Error handling
```

**Proponowany podział:**

```
ui/review/
├── ReviewView.ts              (~300 LOC) - Orchestrator/Container
├── components/
│   ├── CardRenderer.ts        (~200 LOC) - Renderowanie karty
│   ├── ProgressBar.ts         (~80 LOC) - Pasek postępu
│   ├── RatingButtons.ts       (~150 LOC) - Przyciski oceny
│   ├── SessionControls.ts     (~100 LOC) - Kontrolki sesji
│   └── TimerDisplay.ts        (~60 LOC) - Wyświetlanie czasu
├── hooks/
│   └── useKeyboardShortcuts.ts (~100 LOC)
└── state/
    └── ReviewSessionState.ts  (~150 LOC) - Stan sesji
```

### Duplikacja Kodu w Modalach

**4 identyczne implementacje wzorca search/filter:**

1. `MissingFlashcardsModal.ts` - linie 278-297
2. `MoveCardModal.ts` - linie 180-199
3. `CustomSessionModal.ts` - linie 250-280
4. `SelectFlashcardFileModal.ts` - linie 156-180

**Rozwiązanie:** Extract `SearchableListComponent`

```typescript
// ui/components/SearchableList.ts
export class SearchableList<T> {
	private searchQuery = "";
	private container: HTMLElement;
	private onSelect: (item: T) => void;

	constructor(options: SearchableListOptions<T>) {}

	render(): void {}
	filterItems(query: string): T[] {}
	renderItem(item: T): HTMLElement {}
}
```

---

## CZĘŚĆ IV: ANALIZA POZOSTAŁYCH FOLDERÓW

### ✅ types/ (751 LOC) - Dobrze zorganizowane

```
types/
├── flashcard.ts       (304 LOC) - FlashcardItem, FSRSFlashcardItem
├── settings.ts        (168 LOC) - PluginSettings
├── review.ts          (134 LOC) - ReviewSession, QueueBuildOptions
├── stats.ts           (94 LOC) - DailyStats, ReviewStats
└── index.ts           (51 LOC) - Barrel exports
```

**Ocena:** 8/10 - Dobra separacja, typy są dobrze zdefiniowane.

### ✅ validation/ (633 LOC) - Wzorcowe użycie Zod

```
validation/
├── schemas/
│   ├── openrouter.schema.ts  - API response validation
│   └── diff.schema.ts        - Diff JSON validation
├── validators/
│   ├── openrouter.validator.ts
│   └── diff.validator.ts
└── index.ts
```

**Ocena:** 9/10 - Doskonałe użycie schema-validator pattern.

### ✅ errors/ (205 LOC) - Poprawna hierarchia

```
errors/
├── base.error.ts       (45 LOC) - EpistemeError base class
├── api.error.ts        (52 LOC) - APIError, RateLimitError
├── config.error.ts     (38 LOC) - ConfigurationError
├── network.error.ts    (35 LOC) - NetworkError
└── index.ts
```

**Ocena:** 8/10 - Dobra hierarchia błędów.

### ✅ main.ts (621 LOC) - NIE jest God Class

```
main.ts odpowiedzialności:
├── Plugin lifecycle (onload, onunload)
├── Service initialization (1x setup)
├── Command registration
├── Settings tab registration
└── Ribbon icon setup
```

**Ocena:** 7/10 - Akceptowalne dla głównego pliku pluginu Obsidian.

---

## CZĘŚĆ V: BEST PRACTICES 2025

### 1. Result Pattern (zamiast throw/catch)

```typescript
// Zamiast:
async function fetchData(): Promise<Data> {
	throw new Error("Failed");
}

// Użyj:
type Result<T, E = Error> =
	| { success: true; data: T }
	| { success: false; error: E };

async function fetchData(): Promise<Result<Data>> {
	return { success: false, error: new Error("Failed") };
}
```

**Zastosowanie:** OpenRouterService, FlashcardManager operacje I/O

### 2. Feature-Sliced Design dla UI

```
ui/
├── features/
│   ├── review/
│   │   ├── ReviewView.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   └── state/
│   ├── stats/
│   │   ├── StatsView.ts
│   │   └── components/
│   └── flashcard-panel/
│       └── ...
├── shared/
│   ├── components/       ← SearchableList, Modal base
│   ├── hooks/           ← useKeyboard, useTimer
│   └── utils/
└── widgets/             ← Standalone widgets
```

### 3. Pure Dependency Injection

```typescript
// services/index.ts - Composition Root
export function createServices(app: App, settings: Settings): Services {
	const dayBoundary = new DayBoundaryService(settings.dayStartHour);
	const fsrs = new FSRSService(dayBoundary);
	const store = new ShardedStoreService(app, settings);
	// ... wire dependencies

	return { dayBoundary, fsrs, store /* ... */ };
}
```

### 4. Repository Pattern dla Persistence

```typescript
interface IFlashcardRepository {
	findById(id: string): Promise<FlashcardItem | null>;
	findByDeck(deck: string): Promise<FlashcardItem[]>;
	save(flashcard: FlashcardItem): Promise<void>;
	delete(id: string): Promise<void>;
}
```

---

## CZĘŚĆ VI: PROPONOWANY PLAN IMPLEMENTACJI

### Faza 4: Kontynuacja Services (Pozostałe)

**4.1** Extract `DeckService` z FlashcardManager

-   `getAllDecks()`
-   `getCardsForDeck()`
-   ~100 LOC

**4.2** Extract `FlashcardFileService` z FlashcardManager

-   File I/O operations
-   ~200 LOC

**4.3** Refactor FlashcardManager jako Orchestrator

-   Delegacja do extracted services
-   Cel: ~400 LOC

### Faza 5: UI Refaktoryzacja (CRITICAL)

**5.1** Extract `SearchableListComponent`

-   Zunifikowany komponent search/filter
-   Użycie w 4+ modalach
-   ~120 LOC

**5.2** Podział ReviewView.ts

-   Extract `CardRenderer`
-   Extract `RatingButtons`
-   Extract `SessionControls`
-   Extract `ReviewSessionState`
-   Cel: ReviewView < 400 LOC

**5.3** Reorganizacja folderów UI

```
ui/
├── features/
│   ├── review/
│   ├── stats/
│   └── flashcard-panel/
├── modals/
├── settings/
└── shared/
    └── components/
```

### Faza 6: Patterns Adoption

**6.1** Result Pattern

-   Wprowadź w OpenRouterService
-   Rozszerz na FlashcardManager I/O

**6.2** Interfaces

-   `IFlashcardRepository`
-   `IReviewSessionManager`
-   `IStatsCalculator`

### Faza 7: Testing Infrastructure

**7.1** Mock Services

-   Stwórz mock implementations dla interfejsów
-   Ułatwienie unit testów

**7.2** Integration Tests

-   Testy E2E dla głównych flow

---

## CZĘŚĆ VII: PRIORYTETYZACJA

### High Priority (P0) - UI God Classes

| Zadanie                  | Impact | Effort | ROI    |
| ------------------------ | ------ | ------ | ------ |
| Extract SearchableList   | HIGH   | LOW    | ⭐⭐⭐ |
| Split ReviewView         | HIGH   | MEDIUM | ⭐⭐⭐ |
| Split CustomSessionModal | MEDIUM | LOW    | ⭐⭐   |

### Medium Priority (P1) - Services Completion

| Zadanie                         | Impact | Effort | ROI    |
| ------------------------------- | ------ | ------ | ------ |
| Extract DeckService             | MEDIUM | LOW    | ⭐⭐   |
| Extract FlashcardFileService    | MEDIUM | MEDIUM | ⭐⭐   |
| FlashcardManager → Orchestrator | HIGH   | MEDIUM | ⭐⭐⭐ |

### Low Priority (P2) - Polish

| Zadanie                  | Impact | Effort | ROI |
| ------------------------ | ------ | ------ | --- |
| Result Pattern           | LOW    | MEDIUM | ⭐  |
| Full Interface Coverage  | LOW    | LOW    | ⭐  |
| UI Folder Reorganization | LOW    | LOW    | ⭐  |

---

## CZĘŚĆ VIII: METRYKI SUKCESU

### Przed Refaktoryzacją

| Metryka               | Wartość                       |
| --------------------- | ----------------------------- |
| Max LOC (UI)          | 1,264 (ReviewView)            |
| Max LOC (Services)    | 1,282 (FlashcardManager)      |
| God Classes           | 2 (UI) + 1 (Services)         |
| Duplikacja kodu       | 4 implementacje search/filter |
| Pokrycie interfejsami | ~10%                          |

### Cel Po Refaktoryzacji

| Metryka               | Cel   |
| --------------------- | ----- |
| Max LOC (UI)          | < 400 |
| Max LOC (Services)    | < 400 |
| God Classes           | 0     |
| Duplikacja kodu       | 0     |
| Pokrycie interfejsami | > 60% |

---

## ŹRÓDŁA

### TypeScript Architecture 2025

-   [Clean Architecture in Node.js](https://dev.to/evangunawan/clean-architecture-in-nodejs-an-approach-with-typescript-and-dependency-injection-16o)
-   [TypeScript Enterprise Patterns](https://medium.com/slalom-build/typescript-node-js-enterprise-patterns-630df2c06c35)
-   [Result Pattern in TypeScript](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)

### UI Patterns

-   [Feature-Sliced Design](https://feature-sliced.design/)
-   [Component Composition Patterns](https://www.patterns.dev/react/compound-pattern)

### Dependency Injection

-   [Pure DI in TypeScript](https://codezup.com/dependency-injection-in-typescript-best-practices/)
-   [Composition Root Pattern](https://blog.ploeh.dk/2011/07/28/CompositionRoot/)
