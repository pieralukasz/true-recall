# Plan: Metodologia Zarządzania Wiedzą - Zettelkasten + Fiszki

## Diagnoza problemów

**Obecny stan:**
- `#mind/concept` używany do WSZYSTKIEGO - pustych connectorów i pełnych definicji
- Brak jasnych zasad: co jest Concept, co jest Zettle
- Duplikacja treści między Literature Note → Concept → Zettle
- Friction przy przenoszeniu wiedzy między poziomami

---

## Finalna Metodologia: Kompletny system tagów

### Przegląd wszystkich tagów `#mind/`

| Tag | Tytuł | Cel | Fiszki |
|-----|-------|-----|--------|
| `#mind/concept` | TERMIN (słowo) | Definicja + fakty | TAK |
| `#mind/zettel` | CLAIM (zdanie) | Twoja myśl/teza | TAK |
| `#mind/question` | PYTANIE (?) | Pytanie bez odpowiedzi | NIE |
| `#mind/protocol` | "How to...?" | Idealne rozwiązanie/procedura | TAK |
| `#mind/hub` | Temat do eksploracji | Punkt wejścia do "trains of thought" | NIE |
| `#mind/structure` | Temat do pisania | Sandbox do organizacji artykułu | NIE |
| `#mind/index` | Szeroka kategoria | Pusty connector/backlink | NIE |
| `#mind/person` | Imię i nazwisko | Osoba (autor, ekspert, etc.) | NIE |

### Przegląd tagów `#input/` (źródła)

| Tag | Użycie |
|-----|--------|
| `#input/book` | Książka |
| `#input/article` | Artykuł |
| `#input/course` | Kurs |

---

### Szczegółowy opis każdego typu

---

### 1. CONCEPT (`#mind/concept`)
**Tytuł:** TERMIN (słowo/nazwa)
**Fiszki:** TAK - główne źródło fiszek!

**Zawartość:**
- Bullet-pointy z informacjami O TYM TERMINIE
- Każdy bullet = jedna informacja (własnymi słowami!)
- Linki do źródeł `([[literatura|źródło]])`

**Przykład:** `nucleus accumbens.md`
```markdown
---
tags: ["#mind/concept"]
aliases: [jądra półleżące, NAc]
---

- Komponent [[basal ganglia]] w [[ventral striatum]].
- Otrzymuje [[dopamine]] z [[VTA]].
- Służy do TWORZENIA [[habit]], nie do utrzymania.
```

---

### 2. ZETTLE (`#mind/zettel`)
**Tytuł:** CLAIM/TEZA (pełne zdanie twierdzące)
**Fiszki:** TAK

**Zawartość:**
- Tekst ciągły rozwijający tezę z tytułu
- Linki do Concepts które wspierają claim
- "See also" z powiązanymi Zettle

**Przykład:** `serotonin inhibits dopamine release.md`
```markdown
---
tags: ["#mind/zettel"]
source: [["nawykologia (course)"]]
---

High [[serotonin]] can inhibit [[dopamine]] firing.
That is why if you're truly happy, you don't need anything 'special'.

See also:
- [[vta is responsible for our desires]]
```

---

### 3. QUESTION (`#mind/question`)
**Tytuł:** PYTANIE (kończy się na "?")
**Fiszki:** NIE (jeszcze nie ma odpowiedzi!)

**Cel:** Pytanie na które NIE MASZ jeszcze odpowiedzi.

**Zawartość:**
- Rozwinięcie pytania
- Kontekst dlaczego to pytanie
- Linki do powiązanych notatek

**Workflow:**
1. Tworzysz question gdy masz pytanie bez odpowiedzi
2. Zbierasz informacje, czytasz źródła
3. Kiedy znajdziesz odpowiedź → tworzysz Zettle (claim) i linkujesz
4. Question może zostać jako "archiwum pytania" lub można go usunąć

**Przykład:** `why do i feel aversion to effort?.md`
```markdown
---
tags: ["#mind/question"]
created: "[[2025-12-20]]"
---

* Cannot learn language actively, feel a wall.
* Cannot go exercise, always find excuse.
```

---

### 4. PROTOCOL (`#mind/protocol`)
**Tytuł:** "How to...?" (idealne rozwiązanie)
**Fiszki:** TAK

**Cel:** Konkretna procedura/protokół do osiągnięcia celu. "Idealne rozwiązanie" do którego linkujesz różne Zettle.

**Różnica od Zettle:**
- Zettle = pojedynczy claim/fakt
- Protocol = ZBIÓR kroków/procedura

**Zawartość:**
- Numerowane kroki
- Linki do Concepts i Zettle które wspierają każdy krok

**Przykład:** `how to change habit?.md`
```markdown
---
tags: ["#mind/protocol"]
source: [["nawykologia (course)"]]
---

1. Formulate proper habits. [[new habits should adhere to our identity]]
2. Start paying attention to thoughts and behaviors.
3. ...
```

---

### 5. HUB (`#mind/hub`)
**Tytuł:** Temat do eksploracji
**Fiszki:** NIE

**Cel:** Punkt wejścia do "trains of thought" w zettelkasten. Używasz gdy chcesz EKSPLOROWAĆ co masz na dany temat.

**Różnica od Structure:**
- Hub = "Gdzie są moje notatki o X?" (mapa)
- Structure = "Jak zorganizować X do napisania?" (sandbox)

**Zawartość:**
- Linki do POCZĄTKÓW wątków myślowych
- Grupowanie po kategoriach
- NIE zawiera treści - tylko nawigacja

**Przykład:** `how to build proper understanding?.md`
```markdown
---
tags: ["#mind/hub"]
---

How does understanding work?
* [[environment without distractions promotes deep understanding]]
* [[using our words is more important for brain than copying]]

Techniques:
* [[feynman technique]]
* [[using martian approach enhance understanding]]
```

---

### 6. STRUCTURE (`#mind/structure`)
**Tytuł:** Temat do pisania/organizacji
**Fiszki:** NIE

**Cel:** Sandbox do ORGANIZOWANIA pomysłów przed napisaniem artykułu/tekstu.

**Różnica od Hub:**
- Hub = eksploracja, nawigacja
- Structure = rozwój, organizacja do pisania

**Zawartość:**
- Ułożone pomysły w logicznej kolejności
- Komentarze o relacjach między pomysłami
- Szkic/outline artykułu

**Przykład:** `how to change habit?.md` (gdy rozwijasz do artykułu)
```markdown
---
tags: ["#mind/structure"]
---

## Intro
- Problem z nawykami...

## Main argument
1. [[new habits should adhere to our identity]]
   - Rozwinięcie...
2. ...

## Conclusion
```

---

### 7. INDEX (`#mind/index`)
**Tytuł:** Szeroka kategoria
**Fiszki:** NIE

**Cel:** Pusty connector/backlink. Używasz gdy potrzebujesz linka ale nie masz jeszcze definicji.

**Różnica od Hub:**
- Index = PUSTY (tylko aliasy i tag)
- Hub = MA TREŚĆ (linki do wątków)

**Zawartość:**
- Tylko YAML frontmatter
- ZERO bullet-pointów

**Przykład:** `productivity.md`
```markdown
---
tags: ["#mind/index"]
aliases: [produktywność]
---
```

---

### 8. PERSON (`#mind/person`)
**Tytuł:** Imię i nazwisko
**Fiszki:** NIE

**Cel:** Notatka o osobie (autor, ekspert, historyczna postać).

**Zawartość:**
- Aliasy (nazwisko, pseudonim)
- Cytaty
- Linki do ich prac/pomysłów

**Przykład:** `richard feynman.md`
```markdown
---
tags: ["#mind/person"]
aliases: [Feynman]
---

> "If you think you understand quantum mechanics, you don't understand quantum mechanics"
```

---

### 9. LITERATURE NOTE (`#input/*`)
**Tytuł:** Tytuł źródła
**Fiszki:** NIE (archiwum)

**Tagi:** `#input/book`, `#input/article`, `#input/course`

**Cel:** Przechwycenie surowych informacji ze źródła.

**Zawartość:**
- Cytaty
- Surowe notatki
- Backlinki do terminów

---

## Workflow: Od źródła do wiedzy

### Kluczowe podejście: UNDERSTAND → REMEMBER (nie odwrotnie!)

**Dlaczego NIE klasyczne Bloom (Remember → Understand):**
- Zapamiętywanie bez zrozumienia = strata czasu
- W Anki robiłeś fiszki z surowych faktów → zapamiętywałeś rzeczy których nie potrzebowałeś
- Lepiej: najpierw ZROZUM (przez pisanie), potem UTRWALAJ (fiszki)

---

### Krok 1: CAPTURE (podczas czytania/słuchania)
```
Źródło → Literature Note
```
- Zapisuj cytaty i notatki w Literature Note
- Twórz `[[backlinki]]` do terminów które zauważasz
- NIE przetwarzaj od razu - to jest przechwycenie

---

### Krok 2: ELABORATE + CREATE (jeden proces!)
```
Literature Note → Concept / Zettle
```

**To jest JEDEN krok - uczysz się PRZEZ tworzenie notatek!**

**Jak to działa w praktyce:**
1. Czytasz Literature Note
2. Piszesz własnymi słowami do Concept/Zettle (= elaboracja)
3. Jeśli czegoś nie rozumiesz → zadajesz pytania AI
4. Tworzysz notatkę i uczysz się JEDNOCZEŚNIE

**Techniki podczas pisania:**
- Brain dump do AI → AI formatuje
- Pisanie własnymi słowami (technika Feynmana)
- Łączenie z istniejącą wiedzą: "Jak to się ma do [[concept X]]?"
- Zadawanie pytań: "Dlaczego to działa?"

**Pytanie decyzyjne:**
```
Czy ta informacja DOTYCZY konkretnego TERMINU?
    │
    ├─ TAK → Bullet-point do Concept (własnymi słowami!)
    │
    └─ NIE (to jest CLAIM/TEZA) → Nowy Zettle
```

**Bloom:** UNDERSTAND + APPLY + ANALYZE (poziomy 2-4) - wszystko naraz!

---

### Krok 2b: INKUBATOR (dla nieznanych niewiadomych)

**Problem:** Nie wiesz, czego nie wiesz. Niektóre informacje WYDAJĄ SIĘ nieważne, ale później okazują się kluczowe.

**Rozwiązanie:** Jeśli nie wiesz czy coś jest ważne - **nie wyrzucaj, nie przetwarzaj od razu**.

```
Czytam Literature Note i trafiam na informację:
    │
    ├─ Wiem że ważne → ELABORATE + CREATE (Concept/Zettle)
    │
    └─ Nie wiem czy ważne → Zostaw z tagiem #review/later
                            Wróć po czasie gdy masz więcej kontekstu
```

**Tag `#review/later`:**
- Dodaj do fragmentu lub całej notatki gdy:
  - Nie rozumiesz jeszcze
  - Nie wiesz czy będzie potrzebne
  - Wydaje się ciekawe ale nie wiesz gdzie pasuje

**Cykliczny przegląd (np. co tydzień):**
- Przeglądasz notatki z `#review/later`
- Z nową wiedzą decydujesz:
  - Teraz rozumiem → ELABORATE + CREATE
  - Nadal nie wiem → zostaw na później
  - Niepotrzebne → usuń tag

---

### Krok 3: REVIEW (spaced repetition + fiszki)
- Przeglądaj fiszki (AI generuje z Concept/Zettle)
- Podczas review mogą pojawić się nowe wnioski → nowe Zettle

---

## Cały workflow wizualnie:

```
┌─────────────────────────────────────────────────────────────────┐
│  ŹRÓDŁO (książka, artykuł, kurs)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. CAPTURE: Literature Note                                    │
│     Cytaty, surowe notatki, backlinki                          │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│  Wiem że ważne           │    │  Nie wiem czy ważne          │
│           │              │    │           │                  │
│           ▼              │    │           ▼                  │
│  2. ELABORATE + CREATE   │    │  2b. INKUBATOR               │
│     Concept / Zettle     │    │      #review/later           │
│     → UNDERSTAND+APPLY   │    │      Wróć po czasie          │
└──────────────────────────┘    └──────────────────────────────┘
              │                               │
              │         ┌─────────────────────┘
              │         │ (cykliczny przegląd)
              ▼         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. REVIEW: Fiszki (AI generuje) + Spaced repetition            │
│     Utrwalanie + generowanie nowych pomysłów                    │
│     → Bloom: REMEMBER                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Kluczowy insight: Odwrócona kolejność Blooma

```
KLASYCZNE BLOOM:           TWÓJ WORKFLOW:
─────────────────          ─────────────────
1. REMEMBER     ←────────  3. REVIEW (fiszki, AI generuje)
2. UNDERSTAND   ←────────  2. ELABORATE+CREATE (pisanie)
3. APPLY        ←────────  2. ELABORATE+CREATE (pytania)
4. ANALYZE      ←────────  2. ELABORATE+CREATE (łączenie)
5. EVALUATE                Zettle z opinią
6. CREATE                  Brain dump, pisanie

Kolejność jest ODWRÓCONA - i to jest OK!
Najpierw ROZUMIESZ (przez pisanie), potem PAMIĘTASZ (fiszki).
```

---

## Drzewo decyzyjne: Co utworzyć?

```
Mam informację z Literature Note którą chcę zapamiętać
    │
    ├─ Czy dotyczy konkretnego TERMINU?
    │   │
    │   ├─ TAK → Czy Concept dla tego terminu istnieje?
    │   │         ├─ TAK → Dodaj bullet-point do istniejącego Concept
    │   │         └─ NIE → Stwórz nowy Concept (tytuł = termin)
    │   │
    │   └─ NIE (to jest CLAIM/TEZA)
    │           └─ Stwórz Zettle (tytuł = pełne zdanie)
    │
    └─ Potrzebuję tylko backlinku dla szerokiej kategorii?
            └─ Stwórz Index (np. `neuroscience.md`)
```

---

## Zasady rozwiązujące duplikację

### Single Source of Truth:

| Typ informacji | Gdzie ŻYJE | Przykład |
|----------------|------------|----------|
| Surowy cytat | Literature Note | "Bailey pisze że..." |
| Info o terminie X | Concept X (bullet) | `- Otrzymuje dopaminę z VTA` |
| Claim/Teza | Zettle | `serotonin inhibits dopamine release.md` |

### Linkowanie zamiast kopiowania:

**W Concept Note:**
```markdown
- Otrzymuje [[dopamine]] z [[VTA]]. ([[nawykologia (course)|źródło]])
```

**W Zettle:**
```markdown
High [[serotonin]] can inhibit [[dopamine]] firing.
```
→ Linki do Concepts, nie powtarzanie ich definicji

---

## Przykład praktyczny

**Czytasz artykuł o fleeting notes. W Literature Note masz:**
```
"A fleeting note is a note that is typically taken when you think of something"
"Fleeting notes are simply the notes you've been taking your entire life"
"Not all of your fleeting notes will become permanent zettels"
Hmm, czyli moje notatki głosowe to fleeting notes...
```

**Po przetworzeniu:**

1. **Concept: `fleeting notes.md`** (bo informacje dotyczą TERMINU "fleeting notes")
```markdown
- Notatka robiona gdy chcesz coś zapamiętać. ([[what is a fleeting note?|źródło]])
- To są notatki które robiłeś całe życie - nic specjalnego.
- Nie wszystkie staną się permanentnymi zettlami.
```

2. **Zettle:** `my voice notes are fleeting notes.md` (bo to TWÓJ wniosek)
```markdown
Moje [[notatki głosowe]] to nic innego jak [[fleeting notes]].
Nagrywam je gdy coś chcę zapamiętać, bez formalnej struktury.
```

3. **Literature Note:** Cytaty zostają jako archiwum

4. **Fiszki:** Z Concept `fleeting notes.md` i Zettle

---

## Migracja istniejących notatek

**Dla obecnych `#mind/concept`:**
- Tytuł = TERMIN → zostaw jako `#mind/concept`
- Tytuł = ZDANIE → zmień na `#mind/zettel`
- PUSTY (tylko jako link) → zmień na `#mind/index` LUB dodaj bullet-pointy

**Dla obecnych `#mind/zettel`:**
- Tytuł = ZDANIE → zostaw jako `#mind/zettel`
- Tytuł = TERMIN (np. `collagen.md`) → zmień na `#mind/concept`

**Nie musisz migrować wszystkiego naraz** - rób to stopniowo.

---

## Mapowanie na Taksonomię Blooma

```
BLOOM'S TAXONOMY              TWÓJ WORKFLOW
─────────────────────────────────────────────────────
6. CREATE                     Brain dump do AI, pisanie Zettle
5. EVALUATE                   Zettle z opinią/oceną
4. ANALYZE                    Tworzenie Zettle z relacjami
─────────────────────────────────────────────────────
3. APPLY                      ELABORATE - "Jak to użyć?"
2. UNDERSTAND                 ELABORATE - własnymi słowami
─────────────────────────────────────────────────────
1. REMEMBER                   Fiszki + spaced repetition
```

**Kluczowy insight:** ELABORATE (krok 2) pokrywa poziomy UNDERSTAND i APPLY, których brakowało w starym workflow!

---

## Podsumowanie

### Wszystkie typy notatek:

| Tag | Tytuł | Cel | Fiszki |
|-----|-------|-----|--------|
| `#input/*` | Tytuł źródła | Archiwum (book/article/course) | NIE |
| `#mind/concept` | TERMIN (słowo) | Definicja + fakty | TAK |
| `#mind/zettel` | CLAIM (zdanie) | Twoja myśl/teza | TAK |
| `#mind/question` | PYTANIE (?) | Pytanie bez odpowiedzi | NIE |
| `#mind/protocol` | "How to...?" | Idealne rozwiązanie/procedura | TAK |
| `#mind/hub` | Temat eksploracji | Punkt wejścia do wątków | NIE |
| `#mind/structure` | Temat pisania | Sandbox do organizacji | NIE |
| `#mind/index` | Szeroka kategoria | Pusty connector | NIE |
| `#mind/person` | Imię i nazwisko | Osoba | NIE |

### Workflow (UNDERSTAND → REMEMBER):
1. **CAPTURE** - Literature Note (przechwycenie)
2. **ELABORATE + CREATE** - Concept/Zettle/Protocol (uczenie się przez pisanie!)
   - **2b. INKUBATOR** - `#review/later` dla nieznanych niewiadomych
3. **REVIEW** - Fiszki (AI generuje) + Spaced repetition

### Gdzie trafiają informacje:
- **Dotyczy TERMINU X** → bullet w Concept X
- **To jest CLAIM/TEZA** → nowy Zettle
- **To jest PROCEDURA "How to"** → Protocol
- **PYTANIE bez odpowiedzi** → Question (potem → Zettle gdy znajdziesz)
- **Kontekst/cytat** → zostaje w Literature Note

### Nawigacja i organizacja:
- **Hub** - "Gdzie są moje notatki o X?" (eksploracja)
- **Structure** - "Jak to zorganizować do artykułu?" (pisanie)
- **Index** - pusty connector/backlink

---

## Źródła

- [Getting Started - Zettelkasten Method](https://zettelkasten.de/overview/)
- [Create Zettel from Reading Notes According to the Principle of Atomicity](https://zettelkasten.de/posts/create-zettel-from-reading-notes/)
- [From Fleeting Notes to Project Notes – Concepts of "How to Take Smart Notes"](https://zettelkasten.de/posts/concepts-sohnke-ahrens-explained/)
- [The Difference Between Hub Notes and Structure Notes Explained - Bob Doto](https://writing.bobdoto.computer/the-difference-between-hub-notes-and-structure-notes-explained/)
- [Introduction to the Zettelkasten Method](https://zettelkasten.de/introduction/)
- [Niklas Luhmann's Original Zettelkasten](https://www.ernestchiang.com/en/posts/2025/niklas-luhmann-original-zettelkasten-method/)
