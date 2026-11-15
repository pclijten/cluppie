# WP2 — Applogica en kwaliteit

16-11-2026. Wat is nagelopen, wat is gefixt (release 20261116a) en wat blijft liggen.

## Gefixt

| Wat | Voor wie | Hoe getoetst |
|---|---|---|
| **Van plek wisselen tijdens een lopende periode.** Kwam een speler er via een wissel in en zette de coach hem daarna op een andere plek, dan verdween de speler die begonnen was uit de startopstelling. Was de nieuwe plek leeg, dan stond de invaller op twee plekken tegelijk. Nu worden de twee plekken overal omgewisseld, in de startopstelling en in de wissels (`verwisselSlots` in `analyse.js`). | Coach, losse trainer | `tests/opstelling.test.mjs`: opstelling en speeltijd per speler kloppen na het verwisselen. |
| **Klok op 0:00 en toch een veldspeler vervangen.** Dat past de opstelling aan en telt niet als wissel; de vervangen speler krijgt dan geen speeltijd. De zijlijnweergave zei dat al, de gewone weergave niet. Nu één melding per periode. | Coach, losse trainer | `node --check`; niet in een browser doorgeklikt. |
| **Module met twee versienummers.** `oefenkaart.js` werd twee keer geladen. Er is nu een controle in `npm test` (`tools/importcheck.mjs`): elke benoemde import bestaat, en geen module met twee versienummers. | Ontwikkeling | Draait groen op 121 modules. |
| **Landingspagina:** fout in de console bij het verkleinen van het venster (`over-beleving.js`). | Bezoekers | `node --check`. |

## De "bekende bug: wissel zonder lopende klok"

Het totaalplan noemt deze bug zonder beschrijving. Ik heb twee dingen gevonden die erop lijken en beide aangepakt (hierboven). Wat ik niet zeker weet is of dit de bug is die Paul bedoelt.

Wat de code nu doet:
- Klok loopt, of staat stil op een tijd boven 0:00: een wissel wordt vastgelegd op de klokstand. Dat is juist.
- Klok op 0:00: een vervanging is een wijziging van de opstelling. Vergeet een coach de klok te starten en wisselt hij de hele periode zo, dan krijgt iedereen die aan het eind op het veld staat de volle periode en wie eruit ging niets.

Dat tweede is niet met zekerheid te herkennen (vóór de aftrap is hetzelfde gedrag juist), dus er is nu alleen een melding. Een sterkere oplossing vraagt een keuze: bijvoorbeeld na de aftraptijd van de wedstrijd vragen "Klok starten?" bij de eerste vervanging. **Vraag aan Paul: is dit de bug, en wil je die vraag in het scherm?**

## Nagelopen, geen fout gevonden

- **Losse trainer en trainingen.** PORTEREN.md noemde dat notities, video's en tactiek bij een training onder `teams/{id}/trainingen` niet werken. Aantekeningen staan onder het team en werken dus. Video's bij een training kan alleen een clubadmin toevoegen, dus een losse trainer krijgt die knop niet te zien. Geen zichtbare fout.
- **Spelerdocumenten van andere teams** leest een gewone coach nergens in de app (zie de audit, H2). Uitlenen, bouwoverzicht, evaluatierondes en overzetten zijn schermen voor sturende rollen.

## Niet gedaan, met reden

| Onderdeel | Waarom niet |
|---|---|
| `teams.js` splitsen (ruim 3.200 regels) | Pure refactor zonder winst voor gebruikers en met risico: er is geen geautomatiseerde test van de ingelogde schermen, alleen de demo. Eerst een rooktest per rol in de demo bouwen, dan splitsen in stappen met `node --check` en die rooktest. |
| `openPlatformOud()` weghalen | Paul wilde het oude platformscherm houden tot het centrum in productie bewezen is. Jouw seintje is genoeg. |
| Kompas-blok op Trainingen kiest een eigen thema naast het seizoensplan | Twee bronnen voor "het thema van deze week" is verwarrend, maar samenvoegen verandert wat de coach ziet: impactanalyse en mockup nodig. |
| Tests per rol in Playwright (414×896 en 1440) | De demo kent één rol (coach). Voor de andere rollen is demo-data per rol nodig; dat staat bij WP8 (demo per rol) en dient beide doelen. |
| Doorlichting van alle views op logicafouten | Gedaan voor wedstrijd/speeltijd (hierboven) en rechten (WP1). Niet systematisch voor evaluaties, bouwen, seizoensplan en Sportlink-sync. |
