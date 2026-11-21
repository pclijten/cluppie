# Cluppie: ontwerpafspraken

Vastgelegd op 21-11-2026 (release 20261121d). Dit is het systeem voor de app (`public/index.html`, `public/kamer.html`, `public/privacy.html`). Elk nieuw scherm, ook een scherm dat uit ASV'33 wordt overgezet, houdt zich hieraan. De waarden zelf staan in blok 1 van `public/styles.css`; dit document zegt hoe je ze gebruikt.

De pagina `over.html` heeft een eigen systeem (`public/over/tokens.css`) en valt hier buiten.

## Merk

- Koppen: Barlow Condensed, in hoofdletters. Alleen voor koppen, scores, grote cijfers en titels van rijen.
- Alle andere tekst: Inter. Labels, tabelkoppen, tabs, chips, knoppen en bijtekst staan in Inter, in gewone schrijfwijze, zonder letterspatiëring.
- Eén accent: de clubkleur. `--accent-vlak` voor een gevuld vlak, `--accent-tekst` voor tekst in de clubkleur, `--accent-ink` voor tekst op het vlak. Het accent is voor de hoofdactie, de huidige keuze en een toestand, niet voor versiering.
- Twee thema's: donker en licht (`data-thema` op `<html>`). Elk scherm werkt in allebei.

## Tokens

Een stijlregel gebruikt een token, geen losse waarde.

| Wat | Tokens | Opmerking |
|---|---|---|
| Kleur | `--bg`, `--surface`, `--surface-2`, `--card`, `--ink`, `--ink-2`, `--hair`, `--line-d`, `--accent*`, `--ok`, `--warn`, `--info`, `--n1` … `--n5` | Een kleur die bewust niet meekantelt met het thema (veld, scorebord, luchtfoto, merk van een ander) is een `--vast-*` token in blok 2. |
| Letter | `--t-2xs` (11) … `--t-6xl` (40) | Kleinste tekst is 11 px. De tokens schalen mee met de lettergrootte die de gebruiker kiest. |
| Hoek | `--r-2xs` 3, `--r-xs` 6, `--r-s` 10, `--radius` 14, `--r-m` 16, `--r-l` 22, `--r-pill` | Knop, invoerveld en chip: `--r-s`. Kaart: `--radius`. Venster en blad: `--r-l`. Pil alleen voor een bediening of een teller. |
| Ruimte | `--space-3xs` 2 … `--space-3xl` 96 | Valt een afstand op een token, dan staat het token er. |
| Tijd | `--dur-micro` 120 ms, `--dur-short` 220 ms, `--dur-long` 420 ms | Een overgang noemt zijn eigenschappen (nooit alles tegelijk) en beweegt alleen kleur, doorzichtigheid en verplaatsing. |
| Focus | `--focus` | Eén ring: 2 px, 2 px afstand. Geen eigen ring per scherm. |

## Onderdelen

- **Knop:** `.knop`, met `.fluo` (hoofdactie, één per scherm), `.secundair`, `.klein`, `.destructief`. Uitgeschakeld is zichtbaar aan vlak, inkt en aanwijzer, niet alleen aan doorzichtigheid.
- **Kaart:** `.kaart`. Geen kaart in een kaart.
- **Invoer:** `.invoer`, met het label erboven in Inter.
- **Keuzebalk:** `.segment`, 40 px hoog, 44 px op een aanraakscherm.
- **Tabel:** cijfers staan onder elkaar (`tabular-nums`); de kop is Inter, gewone schrijfwijze.
- **Tikdoel:** op een aanraakscherm is alles wat je kunt aantikken minstens 44 × 44 px. Is het teken kleiner, dan krijgt het een onzichtbaar raakvlak (blok TIKDOELEN en blok 5).
- **Iconen:** uit `icons.js`. Geen emoji als icoon.

## Toegankelijkheid

- Contrast: 4,5:1 voor tekst, 3:1 voor tekst vanaf 24 px. Op een gekleurd vlak uit de beoordelingsschaal staat donkere inkt (`--vast-donkergrijs-4`).
- `prefers-reduced-motion`, `prefers-contrast: more` en `forced-colors` worden gevolgd (blok 4 en 5).
- Systeemonderdelen (datumkiezer, keuzelijst, schuifbalk) volgen het thema via `color-scheme`.

## Controleren

Voor elke release:

1. `npm test`
2. `node tools/rooktest.mjs` en `node tools/rooktest.mjs --donker` (acht rollen, telefoon en laptop: fouten, horizontaal schuiven, tikdoelen, contrast)
3. `node <hallmark>/scripts/sloplint.mjs public/index.html public/styles.css public/kamer.html public/kamer.css public/privacy.html --genre modern-minimal --scope app`

Na een port uit ASV'33: draai stap 3 eerst. Losse kleuren, hoofdletterlabels en eigen hoeken of lettergroottes in de nieuwe regels gaan terug naar de tokens voordat de port op `main` komt.

## Bewust zo gelaten

- Tussenruimtes die niet op het raster van 4 px vallen (6, 10, 14 px) zijn gebleven zoals ze waren; die omzetten verschuift elk scherm.
- Titels van rijen (`.lijst-item .titel`), de teamnaam op het scorebord en de datum in de agenda staan in Barlow Condensed in hoofdletters: dat zijn titels, geen labels.
- De onderbalk op de telefoon en de balk tijdens een lopende training zijn doorschijnend met vervaging, zodat ze leesbaar blijven boven het veld.
