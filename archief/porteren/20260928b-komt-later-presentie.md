# "Komt later" ook in Presentie → Wedstrijd (ASV'33-release 20260928b)

Aanvulling op [20260928a-telaat-minuut](20260928a-telaat-minuut.md). Bouw die eerst.

## Waarom
De coach vult de aanwezigheid voor een wedstrijd vaak vooraf in via de tegel Presentie → Wedstrijd, niet via de selectie in het wedstrijdscherm.
Daar kon hij nog niet aangeven dat een speler later komt.

## Gedrag voor de gebruiker
- **Presentie → Wedstrijd:** bij een afwezige speler staat naast de afwezigheidsredenen de chip **⏱ Komt later**.
  - Tik erop: de speler is weer erbij, met de status *Komt later* (oranje), plus het veld "erbij vanaf min. [ ]".
  - Tik op de actieve chip: de vlag gaat weg en de speler staat gewoon op *Erbij*.
  - Tik op de spelersrij zelf: de speler gaat naar *Afwezig* en de vlag vervalt.
  - Alles wordt direct bewaard, zoals de rest van dit scherm. De minuut wordt bewaard bij het verlaten van het veld.
  - De teller toont "X van Y spelen mee (N later)", met eronder een korte uitlegregel.
- **Naamgeving:** voor wedstrijden heet de optie overal **"Komt later"** (voorheen "Te laat"), ook in de selectie in het wedstrijdscherm.
  In het spelersprofiel staat "⏱ Kwam later, erbij vanaf minuut X".
  Bij de **trainingspresentie** blijft het "Te laat", want dat is iets anders: aanwezig maar te laat bij de training.

## Datamodel
Geen nieuwe velden. Dit scherm schrijft nu ook `telaat` en `telaatVanaf` op het wedstrijddocument, met dezelfde opschoning:
`telaat` ⊆ `selectie` en `telaatVanaf` ⊆ `telaat`.

## Rekenregels
Ongewijzigd, zie 20260928a.

## Testgevallen
| Actie in Presentie → Wedstrijd | Resultaat op het wedstrijddocument |
|---|---|
| Afwezige speler c → ⏱ Komt later | c in `selectie` en `telaat`, afwezigheidsreden van c weg |
| Minuut 40 invullen bij c | `telaatVanaf.c = 40` |
| Rij van c aantikken (naar afwezig) | c uit `selectie` en `telaat`, `telaatVanaf.c` weg |
| Actieve chip bij c aantikken | c blijft in `selectie`, uit `telaat`, `telaatVanaf.c` weg |

## Aandachtspunten voor cluppie.io
- Beide invoerplekken (vooraf-presentie en de selectie in het wedstrijdscherm) moeten dezelfde velden en opschoning gebruiken. Liefst één gedeelde functie.
- Vertaalsleutels: "Komt later", "Kwam later, erbij vanaf minuut {m}", de teller "({n} later)" en de uitlegregel.

## Keuzes in cluppie.io
(in te vullen bij het porteren)
