# Analiza: Episteme vs Anki - Porównanie Systemów Spaced Repetition

## Podsumowanie

Episteme to plugin do Obsidian implementujący algorytm FSRS (Free Spaced Repetition Scheduler) przy użyciu biblioteki **ts-fsrs v5.2.3**. System jest w dużej mierze kompatybilny z Anki, ale brakuje kilku zaawansowanych funkcji.

---

## 1. Co Jest ZAIMPLEMENTOWANE (zgodne z Anki)

### Algorytm FSRS
| Funkcja | Anki | Episteme | Status |
|---------|------|----------|--------|
| FSRS v6 Algorithm | ✅ | ✅ ts-fsrs | **Identyczny** |
| Desired Retention | 0.75-0.99 | 0.7-0.99 | **Identyczny** |
| Maximum Interval | Days | Days | **Identyczny** |
| 21 FSRS Weights | ✅ | ✅ | **Identyczny** |
| Fuzz ±2.5% | ✅ | ✅ | **Identyczny** |

### Stany Kart
| Stan | Opis | Implementacja |
|------|------|---------------|
| New (0) | Nowa karta | ✅ `State.New` |
| Learning (1) | W trakcie nauki | ✅ `State.Learning` |
| Review (2) | Normalne powtórki | ✅ `State.Review` |
| Relearning (3) | Po zapomnieniu | ✅ `State.Relearning` |

### Limity Dzienne
| Funkcja | Anki | Episteme | Lokalizacja |
|---------|------|----------|-------------|
| New cards/day | ✅ Default 20 | ✅ Default 20 | `settings.newCardsPerDay` |
| Reviews/day | ✅ Default 200 | ✅ Default 200 | `settings.reviewsPerDay` |

### Learning Steps
| Funkcja | Anki | Episteme | Lokalizacja |
|---------|------|----------|-------------|
| Learning steps | ✅ [1m, 10m] | ✅ [1, 10] | `settings.learningSteps` |
| Relearning steps | ✅ [10m] | ✅ [10] | `settings.relearningSteps` |
| Graduating interval | ✅ 1 day | ✅ 1 day | `settings.graduatingInterval` |
| Easy interval | ✅ 4 days | ✅ 4 days | `settings.easyInterval` |

### Scheduling
| Funkcja | Anki | Episteme | Lokalizacja |
|---------|------|----------|-------------|
| Day start hour | ✅ 4 AM | ✅ 4 AM | `settings.dayStartHour` |
| Learn ahead limit | ✅ 20 min | ✅ 20 min | `LEARN_AHEAD_LIMIT_MINUTES` |
| Day-based scheduling | ✅ | ✅ | `DayBoundaryService` |

### Display Order (WIĘCEJ niż Anki!)
| Funkcja | Anki | Episteme |
|---------|------|----------|
| New card order | Random/Sequential | **Random/Oldest-first/Newest-first** |
| Review order | Due date/Random | **Due-date/Random/Due-date-random** |
| New/Review mix | Mix/After/Before | **Mix/After/Before** |

### Inne
| Funkcja | Status |
|---------|--------|
| Card suspension | ✅ Zaimplementowane |
| Review history | ✅ Ostatnie 20 recenzji per karta |
| Statistics | ✅ Per-day tracking |

---

## 2. Co NIE JEST Zaimplementowane (brakuje vs Anki)

### 🔴 Burying Siblings (Chowanie Rodzeństwa)
**Co to robi w Anki:**
- Gdy odpowiesz na kartę, Anki automatycznie chowa inne karty z tej samej notatki do następnego dnia
- Zapobiega "interferencji" - widzeniu podobnych kart w tej samej sesji

**Status w Episteme:** ❌ Brak
- Karty z tej samej notatki mogą pojawiać się w tej samej sesji
- Może prowadzić do "fałszywego" zapamiętywania przez kontekst

### 🔴 Leech Detection (Wykrywanie Pijawek)
**Co to robi w Anki:**
- Automatycznie oznacza karty, które są wielokrotnie zapominane (default: 8 lapses)
- Może automatycznie zawiesić "pijawki"
- Pomaga zidentyfikować problematyczne karty

**Status w Episteme:** ❌ Brak
- Brak śledzenia liczby "lapses" per karta
- Brak automatycznego zawieszania
- Brak ostrzeżeń o trudnych kartach

### 🟡 Easy Bonus / Hard Interval (Częściowo)
**Co to robi w Anki:**
- Easy bonus: mnożnik dla "Easy" (default 1.30)
- Hard interval: mnożnik dla "Hard" (default 1.20)
- Użytkownik może je modyfikować w ustawieniach

**Status w Episteme:** ⚠️ Częściowo
- Parametry są w wagach FSRS (w8, w15, w16)
- ALE: nie są wyeksponowane jako osobne ustawienia UI
- Modyfikacja tylko przez ręczną edycję wag

### 🔴 Interval Modifier (Globalny Mnożnik Interwałów)
**Co to robi w Anki:**
- Globalny mnożnik wpływający na wszystkie interwały
- Default 1.0, można ustawić np. 0.8 (krótsze) lub 1.2 (dłuższe)
- Prosty sposób na dostosowanie intensywności

**Status w Episteme:** ❌ Brak
- Brak globalnego mnożnika
- Jedyny sposób: modyfikacja desired retention

### 🔴 Load Balancing (Równoważenie Obciążenia)
**Co to robi w Anki (przez addon):**
- Rozkłada powtórki równomiernie na różne dni
- Zapobiega "spike'om" - dniom z bardzo dużą liczbą kart
- FSRS Helper addon: "Disperse siblings", "Flatten"

**Status w Episteme:** ❌ Brak
- Karty są schedulowane niezależnie
- Może prowadzić do nierównego rozkładu

### 🔴 Easy Days (Lżejsze Dni)
**Co to robi w Anki:**
- Pozwala ustawić dni tygodnia z mniejszą liczbą powtórek
- Np. niedziela = 50% mniej kart
- Automatycznie przesuwa karty na inne dni

**Status w Episteme:** ❌ Brak

### 🔴 Optimizer (Optymalizacja Parametrów)
**Co to robi w Anki:**
- Analizuje historię powtórek
- Machine learning do znalezienia optymalnych wag FSRS
- Przycisk "Optimize" w ustawieniach

**Status w Episteme:** ⚠️ Przygotowane ale nie zaimplementowane
- UI jest gotowe (`SettingsTab.ts:396-410`)
- Przycisk jest disabled z komentarzem "TODO"
- Można ręcznie wkleić wagi z zewnętrznego optymalizatora

---

## 3. Tabela Porównawcza - Pełna

| Funkcja | Anki | Episteme | Priorytet |
|---------|------|----------|-----------|
| **Algorytm Core** |
| FSRS v6 | ✅ | ✅ | - |
| Desired Retention | ✅ | ✅ | - |
| Maximum Interval | ✅ | ✅ | - |
| Fuzz ±2.5% | ✅ | ✅ | - |
| **Stany & Kroki** |
| 4 stany kart | ✅ | ✅ | - |
| Learning steps | ✅ | ✅ | - |
| Relearning steps | ✅ | ✅ | - |
| Graduating interval | ✅ | ✅ | - |
| Easy interval | ✅ | ✅ | - |
| **Limity** |
| New cards/day | ✅ | ✅ | - |
| Reviews/day | ✅ | ✅ | - |
| **Scheduling** |
| Day start hour | ✅ | ✅ | - |
| Learn ahead | ✅ | ✅ | - |
| Day-based review cards | ✅ | ✅ | - |
| **Display Order** |
| New card order | 2 opcje | **3 opcje** | Episteme lepszy |
| Review order | 2 opcje | **3 opcje** | Episteme lepszy |
| New/Review mix | 3 opcje | 3 opcje | - |
| **Zaawansowane** |
| Burying siblings | ✅ | ❌ | 🔴 Wysoki |
| Leech detection | ✅ | ❌ | 🔴 Wysoki |
| Easy bonus UI | ✅ | ❌ | 🟡 Średni |
| Hard interval UI | ✅ | ❌ | 🟡 Średni |
| Interval modifier | ✅ | ❌ | 🟡 Średni |
| Load balancing | addon | ❌ | 🟡 Średni |
| Easy days | ✅ | ❌ | 🟢 Niski |
| FSRS Optimizer | ✅ | ❌ | 🟡 Średni |
| **Inne** |
| Suspension | ✅ | ✅ | - |
| Review history | ✅ | ✅ (20 last) | - |
| Statistics | ✅ | ✅ | - |

---

## 4. Rekomendacje - Co Warto Dodać

### Priorytet Wysoki 🔴

1. **Burying Siblings**
   - Zapobiegnie interferencji między podobnymi kartami
   - Wymaga: śledzenia `noteId` lub `sourceNote` przy schedulingu

2. **Leech Detection**
   - Pomoże zidentyfikować problematyczne karty
   - Wymaga: licznika `lapses`, progu (default 8), auto-suspension

### Priorytet Średni 🟡

3. **Interval Modifier** (prosty)
   - Globalny mnożnik w ustawieniach
   - Łatwa implementacja: pomnóż interval przed zapisaniem

4. **Easy/Hard Bonus UI**
   - Wyeksponować istniejące parametry z wag
   - UI: dwa slidery w ustawieniach

5. **FSRS Optimizer** (złożony)
   - Integracja z ts-fsrs optimizer
   - Wymaga wystarczającej historii (400+ reviews)

### Priorytet Niski 🟢

6. **Load Balancing**
   - Rozkładanie kart równomiernie
   - Może być addon/opcjonalne

7. **Easy Days**
   - Lżejsze dni tygodnia
   - Nice-to-have

---

## 5. Źródła

- [Anki Manual - Deck Options](https://docs.ankiweb.net/deck-options.html)
- [FSRS Algorithm Wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm)
- [ABC of FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/abc-of-fsrs)
- [FSRS vs SM-2 Guide](https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/)
- [FSRS Helper Addon](https://ankiweb.net/shared/info/759844606)
- [Anki FAQs - What Algorithm](https://faqs.ankiweb.net/what-spaced-repetition-algorithm)
