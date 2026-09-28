# Te laat met minuut (ASV'33-release 20260928a)

## Waarom
Een speler die te laat komt, telde voor de speeltijd-statistiek alsof hij de hele wedstrijd beschikbaar was.
De minuten vóór zijn aankomst telden daardoor als reservetijd en drukten zijn speeltijd-percentage.
De eerlijkheidsscore van het team werd daardoor ook scheef.

## Gedrag voor de gebruiker
- **Wedstrijdselectie:** een speler kan al op *Te laat* staan (bestond al, zonder minuut).
  Naast de actieve te-laat-knop staat nu een veld **"erbij vanaf min. [ ]"**.
  - Het veld is optioneel. Blijft het leeg, dan verandert er niets aan de berekening.
  - Er komt een getal van 1 tot het totaal aantal wedstrijdminuten in (periodes × periodeduur).
  - Uitleg in de selectie: de minuut telt door over alle periodes.
- **Bank tijdens de wedstrijd:** een te-late speler met ingevulde minuut krijgt onder zijn naam een oranje label `⏱ 30'`.
- **Spelersprofiel, per wedstrijd:** het percentage wordt berekend zonder de tijd vóór aankomst.
  De reden luidt "⏱ Te laat, erbij vanaf minuut 30". Is er ook een andere reden, dan komt dit er met " · " achter.
- **Stats-uitleg:** vermeldt dat de tijd vóór aankomst niet meetelt in het percentage.

## Datamodel
Op het wedstrijddocument:

| Veld | Type | Betekenis |
|---|---|---|
| `telaat` | `string[]` (speler-id's) | Bestond al: spelers die erbij waren maar te laat kwamen. |
| `telaatVanaf` | `{ [spelerId]: number }` | **Nieuw.** De doorlopende wedstrijdminuut vanaf wanneer de speler beschikbaar was. |

- Een minuut telt alleen als de speler ook in `telaat` én in `selectie` staat.
  Bij het opslaan van de selectie worden minuten van anderen weggegooid.
- Het veld ontbreekt of is leeg: gedrag exact zoals vóór de release. Oude wedstrijden blijven dus gelijk.

## Rekenregels
**1. Te-laat-tijd per speler (seconden)**, alleen over *gespeelde* periodes:
```
start = 0
voor elke periode p in volgorde:
  D = duur(p)          // gespeeld: max(ingestelde duur, klokstand) · niet gespeeld: ingestelde duur
  als p gespeeld is:
    laat += clamp(minuut*60 - start, 0, D)
  start += D
```
De tijdlijn schuift ook bij niet-gespeelde periodes door, zodat minuut 40 altijd dezelfde wedstrijdminuut blijft.

**2. Persoonlijke noemer** (per speler, per wedstrijd):
```
ruimte    = max(0, wedstrijdduur - gespeeld)     // wedstrijdduur = som van de gespeelde periodes
laat      = min(te-laat-tijd, ruimte)
straf     = min(disciplinaire banktijd, ruimte - laat)
speelbaar = max(gespeeld, wedstrijdduur - laat - straf)
reserve   = max(0, speelbaar - gespeeld)
speeltijd-% = gespeeld / speelbaar
```
- Te-laat-tijd en straftijd samen kunnen nooit meer aftrekken dan de niet-gespeelde tijd.
  Een verkeerd ingevulde minuut geeft dus nooit meer dan 100%.
- De **gespeelde tijd zelf verandert niet**: die komt nog steeds uit opstelling + wissels.
- In de aggregatie over wedstrijden komt per speler een extra teller `telaat` (seconden) bij, naast `disciplinair`.

## Testgevallen
Opzet: 2 periodes van 30 min, beide gespeeld. Selectie: a, b, c.
Periode 1: a speelt de hele periode. Periode 2: a speelt tot 10:00 en wordt dan gewisseld voor c.

| Situatie | Verwacht |
|---|---|
| c te laat, `telaatVanaf.c = 40` | te-laat-tijd c = 2400 s; c: gespeeld 1200, speelbaar 1200 → **100%** |
| zelfde, a | gespeeld 2400, speelbaar 3600 → 67% (ongewijzigd) |
| zelfde, b | gespeeld 0, speelbaar 3600 → 0% (ongewijzigd) |
| c **niet** in `telaat`, wel `telaatVanaf.c = 40` | minuut genegeerd: c speelbaar 3600 → 33% |
| `telaatVanaf.c = 90` (verder dan de wedstrijd) | laat afgekapt op de niet-gespeelde tijd (2400 s): c 100% |
| geen `telaatVanaf` | identiek aan het gedrag vóór de release |

## Aandachtspunten voor cluppie.io
- **Feature-toggle:** hoort bij *Wedstrijden* / *Analytics*. Geen eigen toggle nodig.
- **Vertaalsleutels (NL/EN):** veldlabel "erbij vanaf min.", uitlegregel in de selectie, reden in het profiel, zin in de stats-uitleg.
- **Firestore:** het veld hoort bij het wedstrijddocument onder de club/bouw/team-structuur. Security rules: dezelfde schrijfrechten als voor `selectie`.
- **Rekenlogica:** op één centrale plek, samen met de disciplinaire correctie. Neem de testgevallen hierboven over als unit test.
- **Uitleenspelers / gastspelers:** in ASV'33 geen aparte behandeling. De regel geldt voor iedere speler in de selectie.

## Keuzes in cluppie.io
(in te vullen bij het porteren)
