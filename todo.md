UX: Ciche gubienie powtórek przy archiwizacji projektu
  Jeśli użytkownik zarchiwizuje duży projekt z setkami kart gotowych do powtórki (Review),
  znikną one z kolejki bez ostrzeżenia. Warto dodać alert przy akcji z Context Menu:
  "Archiwizujesz projekt. 45 kart oczekujących na powtórkę zostanie ukrytych."

UX: Brak opcji "Wyklucz z archiwizacji"
  Czasem użytkownik chce zarchiwizować projekt, ale zostawić w nim jedną aktywną "notatkę-pomost".
  Przy obecnym kaskadowaniu wymusza to wyciągnięcie tej notatki z hierarchii (zmianę jej rodzica).
  Rozważyć opcję selektywnego wykluczenia notatek z kaskadowej archiwizacji.

Feature: Typing effect
  True Recall: Brak
  Sprout: Animowane placeholder w name input

Feature: Type-in answer mode
  During review, show a text input where the user types their answer before reveal.
  Compare typed answer against correct answer with diff highlighting (green=correct, red=mistake).
  User still self-grades with FSRS ratings after seeing the comparison.
  Popular for language learning, medical terms, anything requiring exact recall.
  Reference: Anki's {{type:cta}} field functionality.
  Source: Discord feedback from SleepVain1

Feature: AI-powered leech intervention (Auto-Simplification)
  W Anki "pijawki" to fiszki, o których użytkownik zapomina wielokrotnie — system je blokuje bez wyjaśnienia.
  Ulepszenie: po N kolejnych oblaniach tej samej fiszki, AI automatycznie interweniuje:
  "Hej, widzę że ciągle zapominasz tej definicji. Chcesz żebym uprościł pytanie / dodał wskazówkę / podzielił na mniejsze karty?"
  AI może zaproponować: przepisanie pytania prostszym językiem, dodanie przykładu, split na 2-3 atomowe karty.
  Użytkownik akceptuje lub odrzuca propozycję — pełna kontrola, AI tylko sugeruje.

Feature: Hands-Free Voice AI mode
  Anki wymaga patrzenia w ekran i klikania — niemożliwe podczas biegania, jazdy autem czy zmywania naczyń.
  Rozwiązanie: tryb głosowy łączący TTS + STT napędzane AI.
  Flow: wtyczka czyta fiszkę na głos (TTS) → użytkownik odpowiada naturalnym językiem (STT) →
  LLM ocenia poprawność odpowiedzi (semantycznie, nie literalnie) → podaje prawidłową odpowiedź →
  automatycznie wybiera odpowiedni interwał FSRS (Again/Hard/Good/Easy) bez dotykania ekranu.
  Przydatne do: nauki języków, medycyny, prawa — wszystkiego wymagającego aktywnego przypominania.

---
Analiza: True Recall vs RemNote

Typy kart (Flashcard Types)

  | Feature                | RemNote                       | True Recall  |
  |------------------------|-------------------------------|--------------|
  | Basic (Q&A)            | ✅ (>> lub ==)                | ✅ (::)      |
  | Concept card           | ✅ (::)                       | ❌           |
  | Descriptor card        | ✅ (;;)                       | ❌           |
  | Reversed/bidirectional | ✅                            | ✅ (:::)     |
  | Cloze                  | ✅ ({{)                       | ✅ ({{c1::}})|
  | Multiple-choice        | ✅                            | ❌           |
  | List cards             | ✅                            | ❌           |
  | Card Clusters          | ✅ (kontekst sąsiednich kart) | ❌           |
  | Image Occlusion        | ✅ (Pro)                      | ✅           |
  | Multi-line cards       | ✅ (>>>)                      | ✅           |

  Kluczowa różnica: RemNote ma więcej typów kart, szczególnie Card Clusters — gdy
  pokazuje kartę, wyświetla kontekst sąsiednich kart w szarym kolorze. To bardzo ciekawy
  pomysł na uczenie się w kontekście.

Podsumowanie — gdzie jesteś silny, gdzie masz lukę

  True Recall wygrywa:
  - FSRS v6 (vs ich własny, słabszy algorytm)
  - Zaawansowane narzędzia schedulingowe (optimizer, simulator, easy days, breaks)
  - Open source + offline-first
  - NL Query
  - Import Studio

  RemNote wygrywa:
  - AI Tutor podczas nauki (to duży gap)
  - Exam scheduling (killer feature dla studentów)
  - PDF + nagrania jako źródło kart
  - Card Clusters (kontekst sąsiednich kart)
  - Multiple-choice cards
  - Mobile + Web (dostępność)
  - Wyjaśnienia/mnemoniki automatycznie per karta

  Największe luki do zasypania: AI Tutor, Exam Scheduling, generowanie z PDF.