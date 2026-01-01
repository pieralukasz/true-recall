Haszowanie treści (Smart Diff):

Ulepszenie: Przed wysłaniem zapytania do AI, oblicz hash treści (np. MD5) sekcji SOURCE_CONTENT.

Logika: Jeśli hash notatki w Obsidian jest identyczny z hashem zapisanym w ukrytym komentarzu pliku fiszek → zablokuj przycisk "Update" i wyświetl "Up to date". Oszczędza to niepotrzebne wywołania API.

Edycja w trybie Diff (Inline Editing):

Problem: AI czasem generuje dziwne pytania. Obecnie w trybie Diff mogę tylko zaakceptować lub odrzucić.

Rozwiązanie: Pozwolić edytować pole tekstowe "New Question/Answer" zanim kliknę "Apply". To pozwoli poprawić halucynacje AI w locie.

Dodatek: Obsługa Deck Mapping. W ustawieniach lub we frontmatterze notatki zdefiniować, do jakiej talii w Anki mają trafiać fiszki (np. anki-deck: Medycyna::Anatomia).

Generowanie kontekstowe (Backlinks Awareness):

Pomysł: Obecnie AI widzi tylko jeden plik.

Feature: Opcja "Include linked mentions". Plugin pobierałby małe fragmenty notatek, do których linkuje aktualna notatka.

Efekt: Fiszki byłyby bogatsze o kontekst i połączenia między wiedzą, a nie tylko izolowane fakty.
