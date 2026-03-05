# Plan monetyzacji True Recall (v1)

## 1. Strategia monetyzacji

True Recall pozostaje produktem open-source i lokalnym, a monetyzacja opiera się na modelu hybrydowym:

- **Free + BYOK**: użytkownik może używać AI przez własny klucz OpenRouter.
- **Managed AI Subscription**: użytkownik płaci za wygodę, gotowy dostęp i budżet usage bez konfiguracji klucza.
- **Top-up credits**: po zużyciu limitu miesięcznego użytkownik może dokupić kredyty bez zmiany planu.

To podejście pozwala:
- zachować open-source growth,
- obniżyć barierę wejścia dla nowych userów,
- monetyzować realny koszt inference,
- utrzymać kontrolę marży.

---

## 2. Segment docelowy i pozycjonowanie

**Primary ICP (start):** studenci i self-learners.

Pozycjonowanie:
- “Najprostsza droga od notatki do fiszek i regularnej nauki.”
- Sprzedawana wartość: oszczędność czasu + płynny workflow + gotowe AI.
- Core SRS i lokalność danych pozostają darmowe; płatne jest compute AI i wygoda.

---

## 3. Oferta i pricing (v1)

## Free (open-source)
- Wszystkie funkcje core SRS (review, statystyki, FSRS, import/export).
- AI tylko przez **własny** OpenRouter key (BYOK).
- Brak kosztu inference po stronie True Recall.

## Managed AI Trial (jednorazowy)
- Budżet trialowy: **$0.35**.
- Orientacyjnie ~50 generacji (przy estymacji średniej ~`$0.007`/generację).
- Cel: szybka aktywacja wartości bez konfiguracji BYOK.

## Starter Monthly
- Cena: **$7 / miesiąc**.
- Budżet monthly: **$2.50** (`budget_max`).
- Dla użytkowników, którzy chcą “po prostu działać” bez ustawiania API key.

## Top-up Credits
- **Top-up S**: `$4.99` za dodatkowe `$2.00` budżetu.
- **Top-up M**: `$9.99` za dodatkowe `$4.50` budżetu.

Uwaga:
- Na starcie tylko plan miesięczny (bez rocznego), żeby szybciej iterować pricing i limity.

---

## 4. Co jest płatne, a co nie (paywall policy)

Zasada:
- **Paywall tylko na managed AI**.
- Core plugin i workflow SRS nie są paywallowane.

Konkretnie:
- Generowanie fiszek AI, AI obróbka fiszek, AI SQL chat działają:
  - przez subskrypcję managed AI, albo
  - przez BYOK.
- Brak blokowania podstawowej nauki, review, statystyk i danych lokalnych.

To minimalizuje ryzyko negatywnego odbioru w społeczności open-source.

---

## 5. Polityka modeli i kontrola kosztów

Dla planu Starter:
- Managed AI ma whitelistę tanich modeli (np. Gemini Flash, DeepSeek, GPT-4o mini).
- Droższe modele:
  - dostępne przez BYOK, albo
  - ewentualnie w przyszłym Pro/top-up premium.

Ważne:
- Egzekwowanie limitów i whitelisty musi być po stronie serwera (nie tylko UI).
- Pozwala to chronić marżę przy niskiej cenie wejścia.

---

## 6. Lejek konwersji (free → paid)

## Etap 1: Aktywacja
Nowy user widzi dwa równorzędne wejścia:
- “Start free AI trial”
- “Use your OpenRouter key”

## Etap 2: Użycie
User robi pierwsze generowanie fiszek lub AI chat SQL.

## Etap 3: Zużycie limitu
Po przekroczeniu budżetu:
- jeśli ma BYOK: automatyczny fallback na BYOK,
- jeśli nie ma BYOK: modal z CTA do top-up / subskrypcji.

## Etap 4: Monetyzacja
Najkrótsza ścieżka płatności:
- checkout subskrypcji lub top-up (Polar),
- po webhooku od razu aktualizacja statusu.

---

## 7. Zmiany backendowe i billing (Polar)

## Status subskrypcji
Rozszerzyć endpoint statusu (obecnie zwraca tier i budget) o:
- `plan_type`
- `next_reset_at`
- `allowed_models`
- `trial_used`
- `topup_available`

## Checkout API
Dodać endpointy:
- `create_subscription_checkout`
- `create_topup_checkout`

## Webhooki Polar
Obsłużyć:
- `subscription.created`
- `subscription.renewed`
- `subscription.canceled`
- `payment.succeeded`
- `payment.failed`
- `topup.purchased`

## Logika budżetu
- Monthly reset budżetu dla subskrypcji.
- Top-up dodaje budżet inkrementalnie.
- Każde request AI zwiększa `budget_spent`.
- Wszystkie decyzje limitów i dostępu po stronie serwera.

---

## 8. Zmiany w pluginie (UX + runtime)

## Settings / AITab
- Zostawić istniejący flow `subscriptionKey` + `openRouterApiKey`.
- Dodać wyraźne CTA:
  - “Start free trial”
  - “Manage plan / Top up”
  - “Use BYOK fallback”

## AI runtime
- Po `429` lub braku budżetu:
  - fallback do BYOK, jeśli skonfigurowany,
  - inaczej komunikat z linkiem do top-up.

## Messaging
Spójna komunikacja:
- “AI działa przez subskrypcję True Recall lub Twój klucz OpenRouter.”

---

## 9. KPI i progi decyzyjne (pierwsze 6–8 tygodni)

Śledzić:
- **AI Activation Rate**: % nowych użytkowników, którzy wykonali 1. operację AI w 24h.
- **Trial → Paid Conversion**.
- **ARPPU**.
- **Top-up Attach Rate**.
- **Monthly Churn (Starter)**.
- **Gross Margin per paid user**.

Zasada decyzji:
- jeśli marża brutto < 60%, ograniczyć modele/lub zmniejszyć budget planu,
- jeśli konwersja trial → paid jest niska, zwiększyć wartość trialu lub poprawić onboarding,
- jeśli top-up attach jest wysoki, rozważyć plan Pro.

---

## 10. Test plan (funkcjonalny i biznesowy)

1. Nowy user bez klucza:
- Dostaje trial.
- Może wygenerować fiszki i użyć AI chat.

2. User bez subskrypcji, z BYOK:
- Pełny AI flow działa poprawnie.
- Brak odwołań do managed budget.

3. User ze Starter:
- Zużycie budżetu rośnie po requestach.
- UI pokazuje poprawny remaining i progress.

4. Przekroczenie budżetu:
- Z BYOK: fallback działa.
- Bez BYOK: poprawny flow top-up.

5. Polityka modeli:
- Niedozwolony model dla Starter jest blokowany server-side.

6. Billing events:
- Webhooki poprawnie aktualizują status i limity.

7. Regresja core pluginu:
- Review/FSRS/statystyki działają niezależnie od AI i płatności.

---

## 11. Założenia i decyzje (zamknięte)

- Model biznesowy: **BYOK + Managed AI Subscription**.
- Pricing pozycjonowany low-cost: **$6–9**, start od **$7**.
- Oferta startowa: **tylko monthly**.
- Segment startowy: **studenci + self-learners**.
- Paywall: **tylko managed AI**.
- Overage: **top-up credits**.
- Billing stack: **Polar**.
- Priorytet strategiczny: utrzymać open-source goodwill i jednocześnie monetyzować koszt AI.
