# Porteren: Sportlink-koppeling per team (ASV'33 release 20260928d)

**Bron:** cluppieasv33 · release `20260928d` · 28-09-2026
**Status in cluppie.io:** ☐ nog te porteren

## Wat het doet

De clubbeheerder kan per team twee dingen los van elkaar instellen: de naam in Cluppie (bijvoorbeeld "Selectie") en aan welk Sportlink-team het team gekoppeld is (bijvoorbeeld "ASV'33 1"). Dat gaat via een ⚽-knop per team in Club → Teams. De Sportlink-teams staan in een keuzelijst die de sync vult. Zonder koppeling matcht de sync op de teamnaam, zoals voorheen.

## Wijzigingen in ASV'33

| Onderdeel | Wijziging |
|---|---|
| `functions/index.js` → `syncClub` | Matcht op `team.sportlinkNaam || team.naam` |
| `functions/index.js` → `teamSleutel` | **Bugfix:** senioren alleen als "sen#" herkennen als er na de clubnaam enkel een nummer staat. Voorheen werden "VR30+1" en "VR35+1" ook "sen1" en botsten ze met het 1e elftal. |
| `functions/index.js` → `schrijfTeamlijst` (nieuw) | Haalt `teams` op bij Sportlink en schrijft één regel per teamcode (klasse/poule van de reguliere competitie) naar `clubs/{clubId}/geheim/_sportlink` |
| `functions/index.js` → `syncNu` | Nieuwe optie `alleenTeamlijst: true`: alleen de teamlijst verversen, zonder volledige sync |
| `js/club.js` | ⚽-knop + `modalSportlinkTeam`, `sportlinkMeta` in de teamregel, client-kopie `slTeamSleutel`, melding in Teamstatus noemt de Sportlink-naam |

**Datamodel:** `teams/{id}` krijgt `sportlinkNaam?` en `sportlinkTeamcode?` (alleen voor weergave). Een lege waarde betekent automatisch op naam.

## ⚠️ Anders doen in cluppie.io (multi-tenant)

1. **Clubnaam niet hardcoderen.** `EIGEN_CLUB_RE = /asv'33/` (server) en `EIGEN_CLUB_RE_SL` (client) zijn ASV'33-specifiek. In cluppie.io moet het clubvoorvoegsel per club komen, bijvoorbeeld afgeleid uit de Sportlink-teamlijst (het gemeenschappelijke voorvoegsel van `teamnaam`) of als veld op het clubdocument. Zonder die aanpassing matcht de sync voor andere clubs niets.
2. **Autorisatie op `syncNu`.** In ASV'33 controleert `syncNu` alleen óf iemand ingelogd is, niet of die persoon beheerder is van `clubId`. In een multi-tenant omgeving is dat een datalek of misbruikrisico: controleer in de functie dat `request.auth.uid` admin is van de club. Dat geldt ook voor `alleenTeamlijst`.
3. **Eén bron voor `teamSleutel`.** De logica staat nu twee keer, in de server en in `club.js`, en die moeten gelijk blijven. Zet hem in cluppie.io in een gedeelde module, of laat de server de verwachte match meeschrijven in `_sportlink`, zodat de client niet zelf hoeft te rekenen.
4. **Matchen op teamcode overwegen.** De koppeling gaat nu op naam. De programma- en uitslagregels bevatten waarschijnlijk `thuisteamid`/`uitteamid`. Als die gelijk zijn aan `teamcode` (eerst verifiëren tegen de echte feed), is matchen op `sportlinkTeamcode` robuuster dan op naam. Voor cluppie.io zou ik dat meteen zo bouwen.
5. **Firestore-rules.** De clubadmin schrijft `naam`, `sportlinkNaam` en `sportlinkTeamcode` op het teamdocument. Neem dat expliciet op in de rules van cluppie.io, met de admin-rol per club.
6. **Pad van de teamlijst.** In ASV'33 is dat `clubs/{clubId}/geheim/_sportlink`. Dat document staat tussen de per-team statusdocumenten, en dat werkt alleen omdat de sync over `club.teams` loopt. Geef het in het club-ID-first-model van cluppie.io een eigen plek, bijvoorbeeld `clubs/{clubId}/sportlink/teams`.

## Ook meenemen (bestaande bug, niet in deze release opgelost)

- **Club → Teams, mobiele weergave:** de teamregel is een `<button>` met daarin `<button class="actie">`-knoppen. De HTML-parser sluit de buitenste knop af, waardoor de actieknoppen buiten de teamkaart vallen. Bouw het in cluppie.io als `<div role="button">` of als een kaart met aparte knoppen.

## Testen na porteren

- [ ] Een team met afwijkende naam koppelen via de keuzelijst: Teamstatus toont "Gematcht", poule en stand kloppen
- [ ] Terug naar "Automatisch": `sportlinkNaam` en `sportlinkTeamcode` zijn verwijderd uit het document
- [ ] Een VR30+/35+-team en het 1e elftal in dezelfde club: geen kruisbesmetting
- [ ] Een tweede club met een ander voorvoegsel: de matching werkt (zie punt 1)
- [ ] Een niet-admin roept `syncNu` aan voor een vreemde club: dat wordt geweigerd (zie punt 2)
