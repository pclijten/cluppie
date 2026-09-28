# Selectie aanpassen in "Achteraf bijwerken" (ASV'33-release 20260928c)

## Waarom
Na afloop zet de coach in "Achteraf bijwerken" wissels, doelpunten, kaarten en speeltijd recht.
Wie er wel of niet was, kon hij daar nog niet aanpassen. Terwijl juist de selectie de noemer van het speeltijd-% bepaalt.

## Gedrag voor de gebruiker
- **Achteraf bijwerken:** bovenaan, boven de periode-tabs, staat een blok **👥 Selectie**. Het geldt voor de hele wedstrijd.
  Het blok toont een telling ("14 erbij · 1 kwam later · 2 afwezig") en chips met wie later kwam (met minuut) en wie afwezig was (met reden).
- **✎ Selectie & afwezigheid aanpassen** opent dezelfde selectie als in het wedstrijdscherm. Daarin: erbij / afwezig, alle afwezigheidsredenen met toelichting, ⏱ Komt later met minuut.
  Klaar, ✕ en "‹ Terug naar overzicht" gaan terug naar het overzicht, op dezelfde periode.
- **Bescherming tegen dataverlies (geldt ook buiten achteraf):** zet de coach iemand op afwezig die al een opstellingsplek, wissels of kaarten in deze wedstrijd heeft, dan komt er bij Klaar eerst een waarschuwing met zijn naam.
  De knop wordt "Toch opslaan". Pas bij de tweede tik worden die gegevens gewist, en daarmee zijn speeltijd.
  Een wijziging in de lijst zet de waarschuwing weer terug.

## Datamodel
Geen nieuwe velden. Gebruikt `selectie`, `afwezigRedenen`, `telaat` en `telaatVanaf` (zie 20260928a/b).

## Rekenregels
Ongewijzigd. Uit de selectie halen blijft betekenen: weg uit lineups, events en plannen van alle periodes, uit kaarten, en als aanvoerder.
Doelpunten blijven staan.

## Testgevallen
| Situatie | Verwacht |
|---|---|
| Achteraf: speler zonder speeltijd op afwezig + reden "ziek" | Direct opgeslagen, terug in het overzicht, chip "Naam · 🤒 Ziek" |
| Achteraf: speler met wissels op afwezig | Waarschuwing met naam, knop "Toch opslaan"; na tweede tik zijn events weg |
| Waarschuwing zichtbaar, speler weer op erbij | Waarschuwing weg, knop weer "Klaar" |
| Achteraf: iemand ⏱ Komt later, minuut 25 | Chip "Naam · ⏱ later (25')", speeltijd-% met aangepaste noemer |

## Aandachtspunten voor cluppie.io
- De selectie-editor één keer bouwen en op drie plekken hergebruiken: vooraf (Presentie), live (wedstrijdscherm) en achteraf.
- De waarschuwing voor dataverlies hoort in de gedeelde opslaglogica, niet per scherm.

## Keuzes in cluppie.io
(in te vullen bij het porteren)
