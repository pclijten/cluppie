# Speler definitief overzetten met overdrachtsdossier (ASV'33 PR #4, release 20261010b)

Bron: `pclijten/cluppieasv33`, PR #4 (branch `feature/speler-overdracht`, commit a487a56).
Status in cluppie.io: **ingebouwd**. Versie 20261010b (globale bump, ook de verwachte speeltijd van 20261010a zit erin).

## Wat het doet
Een speler definitief van team A naar team B zetten zonder zijn geschiedenis kwijt te raken en zonder de data van B te vervuilen.
- Overzetdialoog (vervangt `confirm()`): vinkjes voor Wedstrijden, Beoordelingen, Trainingsaanwezigheid per datum, Leerpunten, Spelernotitie; veld "Bij {team} sinds" (= `meetelVanaf`).
- Bevroren dossier per vorig team: `teams/{B}/spelers/{id}/vorigeTeams/{A}_{datum}` (versie 1: seizoenen[], wedstrijden[], presentie[], beoordelingen[], leerpunten[]).
- Origineel bij A wordt gearchiveerd (`gearchiveerd`, `naarTeam`, `naarTeamNaam`, `gearchiveerdOp`), niet verwijderd. Gearchiveerde spelers worden uit teamlijsten gefilterd (roster-listener, club, evaluatierondes, deel-boot, bouw-hub).
- Spelerskaart: schakelaar Bij dit team / Heel seizoen / Carrière (alleen als er stints zijn), blok "Per team", blok "Vorig team" met uitklapper, admin-knop "Herbereken uit {team}".
- Gekoppelde gast wordt samengevoegd (leerpunten als unie op id, notitie aangevuld).

## Specifiek voor cluppie.io (toegevoegd bovenop ASV'33)
1. **Tenant-scope:** `definitiefOverzetten` controleert dat zowel `vanTeam` als `naarTeam` `club === clubId` hebben voordat er iets gelezen of geschreven wordt. Overzetten tussen clubs wordt geweigerd (aparte beslissing met eigen toestemming en AVG-toets).
2. **Naam-fallback:** `spelerNaam()` en `spelerNr()` vallen terug op `S._gearchiveerd` (gearchiveerde spelers van het huidige team), zodat naam en nummer in oude wedstrijdschermen niet leeg raken. `speler()` zelf blijft actief-only, zodat lijsten en stats ongewijzigd blijven. `state.js` is hiervoor aangeraakt.

## Nog open (fase 2)
- **Rechten server-side afdwingen:** schrijven naar A én B vraagt rechten op beide teams. Nu alleen client-check (clubadmin of bouwcoördinator). Robuuster: Cloud Function of rules.
- **Atomiciteit:** nu sequentiële merge-writes met retry (idempotent). Eén `writeBatch` of server-side functie is strakker.
- **Seizoensdefinitie:** de scope "Heel seizoen" leunt op `S.huidigSeizoen` (uit club/tenant-config).
- Het desktop-paspoort heeft de schakelaar nog niet.
- Geen rules-wijziging nodig: de `/{sub=**}`-regel dekt `vorigeTeams`. **Doe vóór de eerste echte overzet een Firestore-export.**
