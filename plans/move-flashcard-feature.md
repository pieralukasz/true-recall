# Plan: Move Flashcard Feature (Literature Note → Zettel)

## Problem
Użytkownik tworzy fiszki w literature notes, potem przetwarza je i pisze własne zettels. Chce przenosić fiszki z literatury do zettla bez duplikacji i z zachowaniem historii powtórek (FSRS).

## Kluczowa obserwacja architekturalna
**Dane FSRS są indeksowane tylko po UUID** (w sharded store `.episteme/store/`), NIE po filePath. Oznacza to, że:
- Wystarczy przenieść tekst fiszki z tym samym `^uuid` do nowego pliku
- Dane FSRS (stability, difficulty, history) zostaną automatycznie zachowane
- Nie trzeba modyfikować sharded store

## Wymagania
1. Zachować historię FSRS przy przenoszeniu
2. Przenosić do konkretnego pliku fiszek zettla
3. Trzy punkty dostępu: panel boczny, podczas review, bulk selection

---

## Implementacja

### 1. Nowy modal: `MoveCardModal`
**Plik:** `src/ui/modals/MoveCardModal.ts`

```
MoveCardModal
├── Wyszukiwarka notatek z filtrowaniem
├── Lista WSZYSTKICH notatek .md w vault
├── Wykluczone: pliki fiszek (flashcards_*.md)
├── Automatyczne tworzenie pliku fiszek dla wybranej notatki (jeśli nie istnieje)
└── Przycisk "Move" / "Move X cards"
```

**Interface:**
```typescript
interface MoveCardResult {
  cancelled: boolean;
  targetNotePath: string | null;  // ścieżka do docelowej notatki (nie pliku fiszek)
}
```

**Uwagi:**
- Pokazuj wszystkie notatki .md (oprócz plików fiszek)
- NIE twórz nowych notatek z modalu - tylko wybieranie istniejących
- Plik fiszek dla wybranej notatki zostanie utworzony automatycznie jeśli nie istnieje

### 2. Nowa metoda w `FlashcardManager`
**Plik:** `src/services/flashcard.service.ts`

```typescript
async moveCard(
  cardId: string,           // UUID fiszki
  sourceFilePath: string,   // ścieżka do pliku źródłowego
  targetNotePath: string    // ścieżka do docelowej notatki
): Promise<boolean>
```

**Logika:**
1. Znajdź fiszkę w źródłowym pliku po `^{cardId}` (UUID)
2. Wyekstrahuj question, answer, `^uuid` (szukaj wstecz od ^uuid)
3. Utwórz/otwórz docelowy plik fiszek (`flashcards_{targetNote}.md`)
4. Dopisz fiszkę na końcu (zachowując `^uuid`)
5. Usuń fiszkę ze źródłowego pliku (bez kasowania z store!)
6. Dane FSRS pozostają w store - automatycznie połączone przez UUID

**Identyfikacja fiszki:** Szukamy `^{uuid}` w pliku, potem parsujemy wstecz do linii z `#flashcard`

### 3. UI: Panel boczny - przycisk Move
**Plik:** `src/ui/components/CardPreview.ts`

Dodać handler `onMove` do `CardPreviewHandlers`:
```typescript
interface CardPreviewHandlers {
  // ... existing
  onMove?: (card: FlashcardItem) => void;
}
```

Dodać przycisk "Move" (📤 lub →) obok Copy i Delete.

### 4. UI: Review - skrót klawiszowy 'M'
**Plik:** `src/ui/review/ReviewView.ts`

W `handleKeyDown`:
- 'M' lub 'm' → otwiera MoveCardModal dla aktualnej fiszki
- Po przeniesieniu: usuń kartę z kolejki, przejdź do następnej

### 5. UI: Bulk selection
**Plik:** `src/ui/panel/PanelContent.ts` (lub nowy komponent)

Opcja A (prostsza): Dodać checkboxy do CardPreview, przycisk "Move selected" w PanelFooter
Opcja B (bardziej zaawansowana): Nowy modal BulkMoveModal z listą fiszek do zaznaczenia

**Rekomendacja:** Opcja A - checkboxy w panelu

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/ui/modals/MoveCardModal.ts` | **NOWY** - modal wyboru docelowej notatki |
| `src/ui/modals/index.ts` | Export MoveCardModal |
| `src/services/flashcard.service.ts` | Metoda `moveCard()` |
| `src/ui/components/CardPreview.ts` | Przycisk Move, handler onMove |
| `src/ui/review/ReviewView.ts` | Obsługa klawisza 'M' |
| `src/ui/panel/PanelContent.ts` | Checkboxy do bulk selection |
| `src/ui/panel/PanelFooter.ts` | Przycisk "Move selected" |
| `src/types/flashcard.types.ts` | Opcjonalnie: typ MoveResult |

---

## Kolejność implementacji

1. **FlashcardManager.moveCard()** - logika przenoszenia
2. **MoveCardModal** - wybór docelowej notatki
3. **CardPreview + przycisk Move** - pojedyncze przenoszenie z panelu
4. **ReviewView + klawisz 'M'** - przenoszenie podczas review
5. **Bulk selection** - checkboxy i masowe przenoszenie

---

## Edge cases

| Scenariusz | Rozwiązanie |
|------------|-------------|
| Docelowy plik fiszek nie istnieje | Utworzyć nowy z frontmatter |
| Docelowy plik ma inny deck | Odziedziczyć deck z docelowego pliku |
| Przenoszona fiszka jest w kolejce review | Usunąć z kolejki po przeniesieniu |
| Ostatnia fiszka w pliku źródłowym | Zostawić pusty plik (frontmatter + header) |
| Fiszka bez block ID (nowa) | Błąd - wymaga UUID do przeniesienia |
| UUID nie znaleziony w pliku | Błąd - fiszka mogła zostać usunięta |

---

## Algorytm moveCard() - szczegóły

```
1. Odczytaj źródłowy plik
2. Znajdź linię z ^{cardId} (UUID)
3. Parsuj wstecz do linii z #flashcard:
   - Zbieraj linie odpowiedzi (od ^uuid w górę)
   - Zatrzymaj się na linii z #flashcard (to pytanie)
4. Wyekstrahuj: question, answer lines, ^uuid

5. Sprawdź czy docelowy plik fiszek istnieje:
   - TAK → odczytaj, dopisz fiszkę na końcu
   - NIE → utwórz z frontmatter + fiszka

6. Format dodawanej fiszki:
   {question} #flashcard
   {answer}
   ^{uuid}

7. Usuń fiszkę ze źródłowego pliku:
   - Znajdź zakres linii (od #flashcard do ^uuid włącznie)
   - Usuń też pustą linię po ^uuid (jeśli jest)
8. Zapisz oba pliki
```

---

## Pomocnicza metoda: extractCardById()

```typescript
private extractCardById(content: string, cardId: string): {
  question: string;
  answer: string;
  startLine: number;  // indeks linii z #flashcard
  endLine: number;    // indeks linii z ^uuid
} | null
```

Parsuje plik wstecz od `^{uuid}` do `#flashcard` i zwraca dane fiszki.
