<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Opisz mi best practice preact signal

Preact Signals to reaktywne prymitywy do zarządzania stanem, które automatycznie śledzą zależności i pozwalają na bezpośrednią aktualizację DOM z pominięciem cyklu re-renderowania komponentów. Najlepsze praktyki skupiają się na wydzielaniu logiki poza komponenty, ochronie przed nadmiarowymi subskrypcjami i unikaniu zbędnych renderów.[^1][^2][^3]

## Globalny i lokalny stan

Sygnały globalne powinny być definiowane całkowicie poza strukturą komponentów interfejsu. Pozwala to na ominięcie problemów znanych z mechanizmu Context, zapobiegając nadmiarowym przeładowaniom całego drzewa aplikacji. W przypadku stanu lokalnego, przypisanego do konkretnego elementu UI, należy używać dedykowanego hooka `useSignal()`. Gwarantuje on, że instancja sygnału nie zostanie niepotrzebnie zresetowana ani odtworzona przy ponownym renderowaniu.[^2][^3][^1]

## Bezpośrednie aktualizacje DOM

```
Największym atutem sygnałów jest możliwość modyfikacji interfejsu bez wywoływania cyklu życiowego komponentów. Aby to osiągnąć, należy przekazywać całą referencję sygnału bezpośrednio do kodu JSX, na przykład pisząc `<div>{count}</div>` zamiast odczytywania wartości poprzez `<div>{count.value}</div>`. Taki zapis sprawia, że Preact traktuje sygnał w sposób specjalny i odświeża wyłącznie docelowy węzeł tekstowy w drzewie DOM, oszczędzając zasoby procesora.[^4][^1]
```


## Zarządzanie stanem pochodnym

Do tworzenia wartości zależnych od innych sygnałów zawsze należy wykorzystywać funkcję `computed()`. Jej przeliczanie jest opóźnione (leniwe) i wykonuje się tylko przy faktycznej próbie odczytu, o ile źródłowe wartości uległy zmianie. Stanowczo odradza się używania funkcji `effect()` do modyfikacji innych sygnałów na podstawie nasłuchiwanych zmian, gdyż prowadzi to do skomplikowanego przepływu danych i potencjalnych nieskończonych pętli.[^3][^5][^1][^2]

## Efekty i subskrypcje

Funkcja `effect()` jest przeznaczona wyłącznie do operacji ubocznych, takich jak zapytania sieciowe, manipulacja strukturą DOM poza frameworkiem czy analityka. Należy w niej pamiętać o zwracaniu funkcji czyszczącej, która resetuje środowisko przed kolejnym wyzwoleniem efektu. Jeśli wewnątrz bloku potrzebujesz odczytać sygnał bez subskrybowania jego przyszłych modyfikacji, najlepszą praktyką jest użycie metody `signal.peek()`.[^6][^1]

## Enkapsulacja modeli danych

Podczas tworzenia rozbudowanej logiki, stan globalny warto hermetyzować wewnątrz fabrykujących funkcji lub klas budujących modele. Aby zapobiec bezpośrednim, niepożądanym mutacjom z poziomu widoków, eksponowane sygnały należy rzutować na interfejs `ReadonlySignal`. Zmiany stanu powinny zachodzić wyłącznie poprzez udostępnione w modelu metody, co gwarantuje jednokierunkowy, łatwy do testowania przepływ informacji.[^1]

## Porównanie architektur stanu

Zastosowanie sygnałów rozwiązuje wiele problemów wydajnościowych znanych z typowych mechanizmów w React oraz Preact.[^2][^6]


| Cechy architektoniczne | Preact Signals | Tradycyjny `useState` |
| :-- | :-- | :-- |
| Położenie i zasięg | Niezależny (lokalny w widoku lub całkowicie globalny w logice) [^1] | Ograniczony cyklem życia i zasięgiem pojedynczego komponentu [^1] |
| Wpływ na interfejs | Celowana, bezpośrednia aktualizacja wybranych elementów DOM [^1][^4] | Wymusza odświeżenie całego komponentu macierzystego oraz jego dzieci [^7] |
| Śledzenie zależności | W pełni zautomatyzowane dzięki subskrypcjom opartym na odczycie [^2] | Wymaga ręcznej i podatnej na błędy deklaracji w tablicach zależności [^2] |
| Stabilność referencji | Całkowity brak problemów z przestarzałymi domknięciami (stale closures) [^6] | Podatność na błędy związane ze starymi wartościami zmiennych [^6] |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://preactjs.com/guide/v10/signals/

[^2]: https://preactjs.com/blog/introducing-signals/

[^3]: https://preactjs.com/guide/v11/signals/

[^4]: https://stackoverflow.com/questions/77405932/comparing-performance-react-hooks-with-optimization-vs-preact-signals

[^5]: https://preactjs.com/blog/signal-boosting/

[^6]: https://peerlist.io/jagss/articles/react-signals-the-future-of-state-management-in-react

[^7]: https://www.reddit.com/r/reactjs/comments/1fl8w6j/preact_signal_in_production/

[^8]: https://blog.logrocket.com/guide-better-state-management-preact-signals/

[^9]: https://github.com/preactjs/signals/discussions/522

[^10]: https://www.reddit.com/r/sveltejs/comments/15wv95d/preact_signals_svelte_reactivity/

[^11]: https://preactjs.com/guide/v10/getting-started/

[^12]: https://www.npmjs.com/package/@preact/signals-react

[^13]: https://www.reddit.com/r/reactjs/comments/1eq8akw/why_signals_from_preact_does_not_support_types/

[^14]: https://www.reddit.com/r/reactjs/comments/1lq0yj7/what_every_react_developer_should_know_about/

[^15]: https://www.youtube.com/watch?v=aDVl8vORUUg

[^16]: https://www.youtube.com/watch?v=Diy4XRSFTiA

