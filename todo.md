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