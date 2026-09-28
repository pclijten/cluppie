# Porteren van cluppieasv33 naar cluppie.io

Hier staat elke wijziging uit `pclijten/cluppieasv33` die ook in cluppie.io moet komen.
**Begin elke werksessie aan cluppie.io met deze lijst.** Alles met status `te doen` is achterstand.

## Hoe het werkt

1. Elke ASV'33-release met een functionele wijziging krijgt hieronder een regel en een notitie in `porteren/`.
2. De notitie beschrijft **gedrag, data en rekenregels**, geen bestanden of regelnummers van ASV'33.
   cluppie.io heeft een andere opbouw (club-first Firestore, bouwen, feature-toggles, NL/EN), dus porteren betekent opnieuw bouwen op basis van de notitie.
3. Bij het porteren beslis je per punt hoe het in cluppie.io past: pad in Firestore, feature-toggle, vertaalsleutels, rollen.
   Leg afwijkingen vast in de notitie, onder *Keuzes in cluppie.io*.
4. De testgevallen moeten in beide apps dezelfde uitkomst geven. Neem ze over als geautomatiseerde test.
5. Klaar? Zet de status op `gedaan` en vul de cluppie.io-commit of -PR in.

**Status:** `te doen` · `bezig` · `gedaan` · `nvt` (geef bij nvt kort de reden)

Pure bugfixes die alleen voor de ASV'33-code gelden, krijgen `nvt`. Een bugfix in rekenlogica (speeltijd, statistieken) moet wél mee.

## Lijst

| ASV'33-release | Onderwerp | Soort | Notitie | Status | cluppie.io |
|---|---|---|---|---|---|
| 20260928a | Te laat met minuut: tijd vóór aankomst telt niet mee in speeltijd-% | functie + rekenregel | [notitie](porteren/20260928a-telaat-minuut.md) | te doen | |
| 20260928b | "Komt later" ook in Presentie → Wedstrijd, optie hernoemd | functie | [notitie](porteren/20260928b-komt-later-presentie.md) | te doen | |
| 20260928c | Selectie & afwezigheid aanpassen in Achteraf bijwerken + waarschuwing bij dataverlies | functie | [notitie](porteren/20260928c-selectie-achteraf.md) | te doen | |

## Sjabloon voor een nieuwe notitie

Kopieer naar `porteren/<release>-<onderwerp>.md`:

```markdown
# <Onderwerp> (ASV'33-release <versie>)

## Waarom
Welk probleem van de coach lost dit op?

## Gedrag voor de gebruiker
Wat ziet en doet de coach, en waar?

## Datamodel
Nieuwe of gewijzigde velden, met type, betekenis en standaardwaarde.
Hoe blijft oude data werken?

## Rekenregels
Precies, met randgevallen.

## Testgevallen
Invoer → verwachte uitkomst. Deze moeten in beide apps gelijk zijn.

## Aandachtspunten voor cluppie.io
Feature-toggle, rollen, vertaalsleutels, Firestore-pad, security rules.

## Keuzes in cluppie.io
(in te vullen bij het porteren)
```
