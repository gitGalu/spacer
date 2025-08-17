# Spacer

**Spacer** to mobilna, przeglądarkowa gra terenowa, w której odgadujemy miejsca wykonania prezentowanych fotografii. Aby wskazać lokalizację, musimy faktycznie udać się w dane miejsce i sprawdzić rezultat w aplikacji. Ułatwieniem dla gracza jest informacja o tym, z jakiego obszaru (np. dzielnicy czy fragmentu miasta) pochodzi zdjęcie.  

Do gry **Spacer** dołączone są przykładowe scenariusze przygotowane dla Gdyni, ale dostępne jest również dedykowane narzędzie do tworzenia własnych scenariuszy: [Spacer-konstruktor](https://spacer-konstruktor.pages.dev).  

Na początku gry możemy z listy wybrać obszar startowy, co spowoduje odblokowanie wszystkich zdjęć z tego terenu. Za poprawne odpowiedzi odblokowujemy kolejne fotografie z innych obszarów. W trakcie rozgrywki widzimy całkowity postęp procentowy oraz poziom energii, który zmniejsza się przy każdej błędnej odpowiedzi i odnawia przy poprawnej.  

## Główne założenia projektowe

- **zachowanie prywatności gracza** – program nie przesyła na serwer żadnych informacji o użytkowniku; po jednorazowym pobraniu danych wszystko działa lokalnie na telefonie,  
- **możliwość gry offline** – mimo że gra działa w przeglądarce, po pobraniu scenariusza (w tym zdjęć) nie wymaga już połączenia z internetem,  
- **otwartość** – gracze mogą tworzyć własne scenariusze i wymieniać się nimi między sobą, bez udziału serwera, na którym udostępniono grę, a kod źródłowy aplikacji jest dostępny dla zainteresowanych
- **luźny charakter zabawy** – celowo pominięto elementy rywalizacji, takie jak rankingi czy tablice najlepszych wyników.  