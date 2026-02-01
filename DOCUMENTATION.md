# Shadow Anki - Szczegółowa Dokumentacja Pluginu

## Spis treści
1. [Czym jest Shadow Anki](#czym-jest-shadow-anki)
2. [Struktura plików projektu](#struktura-plików-projektu)
3. [Ekrany i interfejs użytkownika](#ekrany-i-interfejs-użytkownika)
4. [Funkcjonalności](#funkcjonalności)
5. [Szczegóły techniczne](#szczegóły-techniczne)
6. [Przepływ danych](#przepływ-danych)

---

## Czym jest Shadow Anki

**Shadow Anki** to plugin do Obsidian, który automatycznie generuje fiszki do nauki za pomocą sztucznej inteligencji (AI). Główne cechy:

- Generuje fiszki z treści notatek używając API OpenRouter (obsługa wielu modeli AI)
- Przechowuje fiszki w osobnych plikach "shadow" (`flashcards_*.md`), aby nie zaśmiecać oryginalnych notatek
- Wspiera aktualizację fiszek metodą diff (porównanie zmian)
- Opcjonalna synchronizacja z Anki przez AnkiConnect
- Konfigurowalny przez ustawienia z wyborem modelu AI

---

## Struktura plików projektu

```
anki-sync/
├── src/                           # Kod źródłowy
│   ├── main.ts                    # Punkt wejścia pluginu (139 linii)
│   ├── constants.ts               # Konfiguracja, prompty AI, modele (181 linii)
│   │
│   ├── errors/                    # Obsługa błędów
│   │   ├── base.error.ts          # Bazowa klasa AppError
│   │   ├── api.error.ts           # APIError, NetworkError, TimeoutError
│   │   ├── validation.error.ts    # ValidationError, ConfigurationError, FileError
│   │   └── index.ts               # Eksporty + helpery
│   │
│   ├── services/                  # Logika biznesowa
│   │   ├── flashcard.service.ts   # Zarządzanie plikami fiszek (471 linii)
│   │   ├── openrouter.service.ts  # Komunikacja z AI (229 linii)
│   │   ├── anki.service.ts        # Integracja z Anki (246 linii)
│   │   └── index.ts
│   │
│   ├── state/                     # Zarządzanie stanem
│   │   ├── panel.state.ts         # PanelStateManager - reaktywny stan
│   │   ├── state.types.ts         # Typy stanów
│   │   └── index.ts
│   │
│   ├── types/                     # Definicje TypeScript
│   │   ├── flashcard.types.ts     # FlashcardItem, FlashcardInfo
│   │   ├── api.types.ts           # ChatMessage, OpenRouterResponse
│   │   ├── settings.types.ts      # ShadowAnkiSettings
│   │   └── index.ts
│   │
│   ├── ui/                        # Interfejs użytkownika
│   │   ├── component.base.ts      # Bazowa klasa komponentów (88 linii)
│   │   ├── components/            # Komponenty wielokrotnego użytku
│   │   │   ├── CardPreview.ts     # Podgląd pojedynczej fiszki (186 linii)
│   │   │   ├── LoadingSpinner.ts  # Animowany spinner (105 linii)
│   │   │   ├── EmptyState.ts      # Komunikaty pustego stanu (96 linii)
│   │   │   └── index.ts
│   │   ├── panel/                 # Główny panel boczny
│   │   │   ├── FlashcardPanelView.ts  # Kontroler widoku (427 linii)
│   │   │   ├── PanelHeader.ts     # Nagłówek z tytułem (102 linii)
│   │   │   ├── PanelContent.ts    # Zawartość panelu (297 linii)
│   │   │   ├── PanelFooter.ts     # Stopka z przyciskami (187 linii)
│   │   │   └── index.ts
│   │   └── settings/
│   │       ├── SettingsTab.ts     # Ekran ustawień (107 linii)
│   │       └── index.ts
│   │
│   ├── utils/                     # Narzędzia pomocnicze
│   │   └── event.utils.ts         # EventRegistry, debounce, throttle
│   │
│   └── validation/                # Walidacja danych
│       ├── api-response.validator.ts    # Walidacja odpowiedzi API
│       ├── flashcard.validator.ts       # Walidacja fiszek
│       ├── schemas/                     # Schematy Zod
│       │   ├── flashcard.schema.ts
│       │   ├── api.schema.ts
│       │   └── settings.schema.ts
│       └── index.ts
│
├── tests/                         # Testy jednostkowe
│   ├── state/panel.state.test.ts
│   └── validation/*.test.ts
│
├── styles.css                     # Style CSS (497 linii)
├── manifest.json                  # Metadane pluginu
├── package.json                   # Zależności
├── vitest.config.ts               # Konfiguracja testów
└── esbuild.config.mjs             # Konfiguracja builda
```

---

## Ekrany i interfejs użytkownika

### 1. Panel boczny (główny ekran)

Po kliknięciu ikony w ribbonie (📚) lub użyciu komendy, otwiera się panel boczny z trzema sekcjami:

#### A) Nagłówek (PanelHeader)

```
┌──────────────────────────────────────┐
│ 🟢 Nazwa Notatki                  📄 │
└──────────────────────────────────────┘
```

**Elementy:**
- **Wskaźnik statusu (emoji):**
  - 🔴 Czerwony = Brak fiszek
  - 🟡 Żółty = Przetwarzanie
  - 🟢 Zielony = Fiszki istnieją

- **Tytuł notatki:** Nazwa aktualnie otwartego pliku .md
- **Przycisk 📄:** Otwiera plik z fiszkami (widoczny tylko gdy fiszki istnieją)

#### B) Zawartość (PanelContent)

**Stan: Brak pliku**
```
┌─────────────────────────────────┐
│                                 │
│  Open a note to see flashcard   │
│  options                        │
│                                 │
└─────────────────────────────────┘
```

**Stan: Przetwarzanie**
```
┌─────────────────────────────────┐
│                                 │
│        ◯ (spinner)              │
│  Generating flashcards...       │
│  AI is analyzing your note      │
│                                 │
└─────────────────────────────────┘
```

**Stan: Lista fiszek (tryb normalny)**
```
┌─────────────────────────────────┐
│ 5 flashcards • Today 14:30      │
│                                 │
│ Q: What is **term**?            │
│ A: Definition here         📋 🗑️│
│                                 │
│ Q: How does **X** work?         │
│ A: Explanation with [[links]]   │
│                            📋 🗑️│
│                                 │
│ (... więcej kart ...)           │
└─────────────────────────────────┘
```

**Funkcje każdej fiszki:**
- **Kliknięcie:** Otwiera plik fiszek w edytorze na linii tej fiszki
- **📋 (kopiuj):** Kopiuje "Q: ...\nA: ..." do schowka
- **🗑️ (usuń):** Usuwa fiszkę z pliku (i z Anki jeśli połączone)

**Stan: Widok Diff (tryb aktualizacji)**
```
┌──────────────────────────────────┐
│ Proposed Changes (2/4 selected)  │
│                      [Select All]│
│                                  │
│ ┌──────────────────────────────┐ │
│ │ NEW                        ☑ │ │
│ │ Q: What is **new topic**?    │ │
│ │ A: New answer content        │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ MODIFIED                   ☐ │ │
│ │ Q (old): Old question        │ │ (przekreślone)
│ │ Q (new): Better question     │ │
│ │ A (old): Wrong answer        │ │
│ │ A (new): Correct answer      │ │
│ │ Reason: Content changed      │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ DELETE                     ☑ │ │
│ │ Q: Old topic no longer here  │ │ (przekreślone)
│ │ A: Answer being removed      │ │
│ │ Reason: Topic not in note    │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Typy zmian w widoku Diff:**
- **NEW (zielona ramka):** Nowa fiszka do dodania
- **MODIFIED (pomarańczowa ramka):** Zmiana istniejącej fiszki (stare vs nowe)
- **DELETE (czerwona ramka):** Fiszka do usunięcia

**Checkbox:** Pozwala zaakceptować lub odrzucić każdą zmianę indywidualnie.

#### C) Stopka (PanelFooter)

**Tryb normalny (brak fiszek):**
```
┌──────────────────────────────────┐
│ ┌──────────────────────────────┐ │
│ │ Instructions for AI (opti... │ │
│ │                              │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │    Generate flashcards       │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Tryb normalny (fiszki istnieją):**
```
┌──────────────────────────────────┐
│ ┌──────────────────────────────┐ │
│ │ Instructions for AI (opti... │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │    Update flashcards         │ │  ← Zmienia się tekst
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Tryb Diff:**
```
┌──────────────────────────────────┐
│ ┌──────────────────────────────┐ │
│ │ Additional instructions ...  │ │
│ └──────────────────────────────┘ │
│                                  │
│ [Regenerate] [Apply (2)] [Cancel]│
└──────────────────────────────────┘
```

- **Regenerate:** Ponownie generuje diff z AI
- **Apply (N):** Zastosowuje N zaakceptowanych zmian
- **Cancel:** Anuluje i wraca do widoku listy

---

### 2. Ekran ustawień (SettingsTab)

Dostępny w: Settings → Plugin Options → Shadow Anki

```
┌────────────────────────────────────────────┐
│ Get your API key at openrouter.ai/keys     │
│                                            │
│ API key                                    │
│ Your openrouter.ai API key for flashc...   │
│ [••••••••••••••••••] (hasło)               │
│                                            │
│ AI model                                   │
│ Select the AI model for flashcard gen...   │
│ [Gemini 3 Flash (Google)        ▼]         │
│                                            │
│ Flashcards folder                          │
│ Folder where flashcard files will be...    │
│ [Flashcards                    ]           │
│                                            │
│ Auto-sync                                  │
│ Sync with Anki after generating flashc...  │
│ [✓] Toggle                                 │
│                                            │
│ Store source content                       │
│ Save note content in flashcard file for... │
│ [✓] Toggle                                 │
└────────────────────────────────────────────┘
```

**Dostępne modele AI:**
- Gemini 3 Flash (Google) - domyślny
- Gemini 2.5 Pro (Google)
- GPT-5.1 (OpenAI)
- GPT-4o (OpenAI)
- Claude Opus 4.5 (Anthropic)
- Claude Sonnet 4 (Anthropic)
- Llama 4 Maverick (Meta)

---

## Funkcjonalności

### 1. Generowanie fiszek z notatki

**Przepływ:**
1. Użytkownik otwiera notatkę .md w Obsidian
2. W panelu bocznym wpisuje opcjonalne instrukcje dla AI
3. Klika "Generate flashcards"
4. AI analizuje treść notatki
5. Plugin tworzy plik `Flashcards/flashcards_[nazwa_notatki].md`
6. Wyświetla wygenerowane fiszki w panelu

**Format pliku fiszek:**
```markdown
---
source: "[[Nazwa notatki]]"
tags: flashcards
---

<!-- SOURCE_CONTENT_START
(treść źródłowa notatki - ukryta w komentarzu HTML)
SOURCE_CONTENT_END -->

Pytanie pierwsze? #flashcard
Odpowiedź pierwsza

Pytanie drugie? #flashcard
Odpowiedź druga
```

**Zasady generowania fiszek (z SYSTEM_PROMPT):**
- Atomowe informacje - JEDNA koncepcja per fiszka
- Krótkie pytania i odpowiedzi
- Pogrubione słowa kluczowe: **termin**
- Pogrubione backlinki: **[[termin]]**
- Użycie `<br><br>` dla dłuższych treści
- Metodologia SuperMemo

### 2. Aktualizacja fiszek (Diff)

**Przepływ:**
1. Użytkownik edytuje oryginalną notatkę
2. W panelu klika "Update flashcards"
3. AI porównuje starą i nową wersję notatki
4. Generuje listę zmian: NEW, MODIFIED, DELETED
5. Użytkownik akceptuje/odrzuca każdą zmianę
6. Klika "Apply" - zmiany zapisują się do pliku

**Typy zmian:**
- **NEW:** Informacja w notatce, której nie ma w żadnej fiszce
- **MODIFIED:** Istniejąca fiszka z błędem lub przestarzałą informacją
- **DELETED:** Fiszka o temacie usuniętym z notatki

### 3. Zarządzanie fiszkami

- **Edycja:** Kliknięcie fiszki otwiera plik na jej linii
- **Usuwanie:** Przycisk 🗑️ usuwa fiszkę (z pliku i opcjonalnie z Anki)
- **Kopiowanie:** Przycisk 📋 kopiuje treść do schowka
- **Otwieranie pliku:** Przycisk 📄 w nagłówku otwiera plik fiszek

### 4. Integracja z Anki

**Dwa poziomy integracji:**

1. **Przez plugin obsidian-to-anki:**
   - Shadow Anki uruchamia komendę skanowania vault'a
   - obsidian-to-anki czyta pliki fiszek i tworzy karty w Anki
   - Zapisuje ID Anki w plikach fiszek

2. **Bezpośrednio przez AnkiConnect:**
   - Shadow Anki może usuwać karty z Anki
   - Sprawdza dostępność Anki
   - Pobiera informacje o taliach

**Auto-sync:** Jeśli włączone, po każdym generowaniu/aktualizacji automatycznie synchronizuje z Anki.

---

## Szczegóły techniczne

### Architektura warstwowa

```
┌─────────────────────────────────────────┐
│     Warstwa UI (ui/components/)         │
│  FlashcardPanelView, Header, Footer     │
├─────────────────────────────────────────┤
│    Zarządzanie stanem (state/)          │
│    PanelStateManager (reaktywny)        │
├─────────────────────────────────────────┤
│    Warstwa serwisów (services/)         │
│  - FlashcardManager (operacje plikowe)  │
│  - OpenRouterService (generowanie AI)   │
│  - AnkiService (synchronizacja)         │
├─────────────────────────────────────────┤
│    Warstwa walidacji (validation/)      │
│    Schematy Zod + walidatory            │
├─────────────────────────────────────────┤
│    Obsługa błędów (errors/)             │
│    Własne klasy błędów                  │
├─────────────────────────────────────────┤
│    Punkt wejścia (main.ts)              │
│    Integracja z Obsidian Plugin API     │
└─────────────────────────────────────────┘
```

### Typy stanów panelu

```typescript
ProcessingStatus = "none" | "exists" | "processing"
ViewMode = "list"

PanelState = {
  status: ProcessingStatus,       // Stan przetwarzania
  viewMode: ViewMode,             // Tryb wyświetlania
  currentFile: TFile | null,      // Aktualny plik
  flashcardInfo: FlashcardInfo,   // Info o fiszkach
  userInstructions: string,       // Instrukcje użytkownika
  isFlashcardFile: boolean,       // Czy oglądamy plik fiszek
  error: AppError | null,         // Błąd
}
```

### Typy fiszek

```typescript
FlashcardItem = {
  question: string,
  answer: string,
  id: string               // Unikalny identyfikator
}
```

### Konfiguracja API

```typescript
API_CONFIG = {
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  timeout: 60000,          // 60 sekund
  temperature: 0.7,
  maxTokens: 4000,
}

ANKI_CONNECT = {
  endpoint: "http://127.0.0.1:8765",
  timeout: 10000,          // 10 sekund
  version: 6
}
```

### Hierarchia błędów

```
AppError (bazowa)
  ├─ APIError (błędy API)
  ├─ NetworkError (brak połączenia)
  ├─ TimeoutError (przekroczenie czasu)
  ├─ ValidationError (niepoprawne dane)
  ├─ ConfigurationError (brak konfiguracji)
  └─ FileError (problemy z plikami)
```

---

## Przepływ danych

### Generowanie fiszek

```
Użytkownik klika "Generate"
         ↓
Odczyt treści notatki z vault'a
         ↓
OpenRouterService.generateFlashcards(content, instructions)
         ↓
AI stosuje SYSTEM_PROMPT:
  - Tworzy atomowe fiszki
  - JEDNA koncepcja per karta
  - Krótkie pytania/odpowiedzi
  - Pogrubione **słowa kluczowe**
  - Pogrubione **[[backlinki]]**
         ↓
Zwraca markdown z fiszkami
         ↓
FlashcardManager.createFlashcardFile():
  - Tworzy Flashcards/flashcards_[nazwa].md
  - Dodaje frontmatter ze źródłem
  - Zapisuje treść źródłową (jeśli włączone)
  - Zapisuje fiszki
         ↓
Jeśli autoSyncToAnki:
  - Uruchamia obsidian-to-anki
         ↓
Panel odświeża się z nowymi fiszkami
```

### Aktualizacja (Diff)

```
Użytkownik klika "Update"
         ↓
Pobiera istniejące fiszki z pliku
Wyciąga starą treść z komentarzy HTML
Odczytuje aktualną treść notatki
         ↓
OpenRouterService.generateFlashcardsDiff(...)
         ↓
AI analizuje różnice (UPDATE_SYSTEM_PROMPT):
  - NEW: info nie pokryte przez żadną fiszkę
  - MODIFIED: błędne lub przestarzałe
  - DELETED: temat usunięty z notatki
         ↓
Zwraca JSON ze zmianami
         ↓
Walidacja przez schematy Zod
         ↓
Wyświetla UI diff z accept/reject
         ↓
Użytkownik zaznacza zmiany do zastosowania
         ↓
Klika "Apply"
         ↓
FlashcardManager.applyDiffChanges():
  - Usuwa karty DELETED (od końca)
  - Modyfikuje karty MODIFIED
  - Dodaje karty NEW
         ↓
Aktualizuje treść źródłową
         ↓
Jeśli autoSyncToAnki:
  - Synchronizacja z Anki
```

---

## Powiadomienia użytkownika

- "Generated flashcards for [filename]"
- "No flashcard-worthy content found in this note."
- "No changes needed. Flashcards are up to date."
- "Applied: 2 new, 1 modified, 0 deleted"
- "Please configure your OpenRouter API key in settings."
- "Triggered Anki sync"
- "obsidian-to-anki plugin not found..."

---

## Stylowanie CSS

**Konwencja nazewnictwa:** `.shadow-anki-*`

**Główne klasy:**
- `.shadow-anki-panel` - główny kontener
- `.shadow-anki-header` - nagłówek
- `.shadow-anki-content-container` - przewijalna zawartość
- `.shadow-anki-footer-container` - stopka
- `.shadow-anki-card` - pojedyncza fiszka
- `.shadow-anki-diff-card` - karta diff
- `.shadow-anki-diff-card--new` - zielona ramka
- `.shadow-anki-diff-card--modified` - pomarańczowa ramka
- `.shadow-anki-diff-card--deleted` - czerwona ramka
- `.shadow-anki-btn-primary` - niebieski przycisk
- `.shadow-anki-btn-secondary` - szary przycisk
- `.shadow-anki-spinner` - animowany spinner

**Obsługa motywów:** Używa zmiennych CSS Obsidiana dla jasnego/ciemnego motywu.
