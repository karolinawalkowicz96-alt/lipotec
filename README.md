# LIPOTEC — serwis EVA SP6

Statyczny serwis generowany skryptem bez zależności + jedna funkcja Vercel (formularz).

## Struktura
- `company.config.mjs` — **jedyne miejsce z danymi firmy** (e-mail, telefon, dane rejestrowe). Puste pola są ukrywane na stronie.
- `src/layout.html`, `src/partials/*`, `src/pages/**` — szablony stron (`<!--meta {...}-->` na początku każdej strony: title, description, FAQ, breadcrumbs).
- `assets/css/site.css` — design system. Wartości złota i gradientów przeniesione 1:1 z poprzedniej wersji strony.
- `assets/js/site.js` — interakcje (scroll story, hotspoty, lupa, bramka „dla profesjonalistów”, formularz).
- `assets/brand/` — oryginalne logo i ikony (bez zmian).
- `assets/original/` — oryginalne wizualizacje (nienaruszone). `assets/img/` — pochodne zoptymalizowane wersje (`npm run images`).
- `api/contact.js` — wysyłka zapytań przez Resend.
- `scripts/build.mjs` — generator → `dist/` (sitemap.xml, robots.txt, JSON-LD).

## Komendy
```
npm run build    # buduje dist/
npm run images   # regeneruje obrazy z assets/original (Python + Pillow)
```

## Formularz — aktywacja
Ustaw w Vercel (Project → Settings → Environment Variables):
- `RESEND_API_KEY` — klucz API Resend,
- `CONTACT_FROM` — zweryfikowany nadawca, np. `LIPOTEC <formularz@twojadomena.pl>`,
- `CONTACT_TO` (opcjonalnie) — domyślnie `lipotec@gmail.com`.

Bez tych zmiennych formularz NIE udaje wysyłki: informuje o tym i proponuje gotową wiadomość e-mail.

## Do uzupełnienia przed pełną zgodnością
Dane rejestrowe w `company.config.mjs` (nazwa prawna, forma, adres, NIP, REGON, KRS), administrator danych, a następnie `complianceReady: true`.

## Uwaga o obrazach
Wszystkie obrazy urządzenia to wizualizacje (AI), nie fotografie egzemplarza. Po otrzymaniu autoryzowanych zdjęć od producenta/dystrybutora wystarczy podmienić pliki w `assets/original/` i uruchomić `npm run images`.
