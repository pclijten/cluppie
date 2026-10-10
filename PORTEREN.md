# PORTEREN.md — open punten multi-tenant (fase 2: Firebase + Cloud Functions)

Fundament (fase 1, client) is klaar: alle clubwaarden staan in `clubs/{id}.instellingen` en zijn in de browser instelbaar
(Club → Instellingen; wizard "Nieuwe club"). Zonder wijziging blijft ASV'33 werken via de legacy-shim in `clubconfig.js`
(knop "Waarden vastleggen" schrijft de ASV-waarden expliciet weg).

## Gepoort uit ASV'33 (bijgewerkt 2026-10-10, cache-versie 20261010c)
Vergelijking van de complete cluppieasv33-zip (t/m release 2026-10-05) met deze repo. Alle andere verschillen zijn bewuste multi-tenant-aanpassingen (clubconfig, instellingen per club).
| ASV'33-release | Wat | Status in cluppie.io |
|---|---|---|
| 2026-10-05 | Startopstelling achteraf aanpassen (Achteraf bijwerken) incl. `harmoniseerWissels`; veldmelding stopt na afloop periode en is neutraal na rode kaart (`veldMelding`) | **gepoort** (`wedstrijd.js`, css `.bw-start*`, `.waarschuwing.neutraal`, UPDATES) |
| 2026-10-02 | Presentie: eerstvolgende training volgt `team.trainingsdagen`; knop "vooruit afgemeld" + venster `modalLaterAfgemeld` | **gepoort** (`teams-training.js`, `teams.js`, css `.pres-*`, `.later-*`, UPDATES) |
| n.v.t. | Bugfix: opslaan van een wedstrijd keerde terug naar tab Trainingen i.p.v. Wedstrijden (`sluitWedstrijd`) | **gepoort** |
| 20260928a-e | Te laat met minuut, komt later, selectie achteraf, Sportlink per team, assists + 1e/2e elftal | client-code stond er al; teamsleutel nu generiek in `sportlink-sleutel.js` |
| 2026-10-10 | Verwachte speeltijd bij geplande wissels (ASV'33 PR #2, release 20261010a) | **gepoort** ([notitie](porteren/20261010a-verwachte-speeltijd.md)) |
| 2026-10-10 | Speler definitief overzetten met bevroren dossier (ASV'33 PR #4, release 20261010b) + tenant-controle, naam-fallback, dossier wissen bij speler verwijderen | **gepoort** ([notitie](porteren/20261010b-speler-overdracht.md)) |
| 2026-10-10 | Lokale AVG/onboarding-lijn samengevoegd met GitHub, app weer in `public/js/` (release 20261010c) | **klaar** ([notitie](porteren/20261010c-samenvoegen.md)) |

Twee typefouten in de nieuwe ASV'33-code zijn hier meteen hersteld (ontbrekend `"` in `aria-label` van `#presentieLater`; los `"` in "Geen toekomstige afmeldingen"). Zet die ook recht in ASV'33.

Ontbrekende modules uit de repo toegevoegd (werden wel overal geimporteerd): `firebase.js`, `icons.js`, `thema.js`, `pwa.js`, `opkomst.js`, `leerinhoud.js`. `updates.js` is dode code en bewust niet meegenomen.

Harde ASV-teksten naar de clubinstellingen: onboarding-stap kompas, handleiding (teamcode-voorbeeld, beleidsplannaam), leerlijn-badge, speler/evaluatie-teksten, radarkleuren in desktop-stats (volgen nu `--accent`).

## Structuur (opgelost 2026-10-08)
- App staat nu in `public/` (modules in `public/js/`, `icons/`, `content/seed.json`); het oude fase-1-skelet staat in `_fase1-backup/`.
- Icons en `over.html`/`readme.html` zijn nog de ASV'33-versies: vervang door Cluppie-eigen beeld voordat andere clubs ze zien (`clubconfig.js` verwijst naar `icons/asv-schild.png` als ASV-logo).
- Datamodel = dat van de app (zie `functions/LEESMIJ-deploy.md`); het fase-1-model (`clubs/{id}/bouwen/.../players`) is vervallen.

## AVG (okt 2026) — zie AVG.md
Rules zijn aangescherpt (leesrechten per club); client sluit aan via Cloud Functions; fonts/PDF.js/ExcelJS zelf gehost; privacy.html + 'Mijn gegevens'. Open: bestaande documenten zonder `club`-veld vullen, composite indexen deployen, ASV'33-client gelijktrekken vóór rules live gaan.

## Onboarding (okt 2026)
Uitnodigingen, aanvragen met goedkeuring, rollen (assistent/coach), toegangslog, uitschrijven, kennisname, e-mailverificatie, rate limiting: zie AVG.md. Serverlogica getest met een mock (24 scenario's); rules en UI ongetest. Open: e-mailmelding bij aanvragen, App Check site key, ASV'33-client gelijktrekken.

## Firestore rules (geschreven, NOG TESTEN)
- `firestore.rules` is opgesteld uit de client-code en is niet in de emulator doorlopen. Test: join via teamcode/clubcode, nieuw team, uitlening, deel-link (anoniem), Sportlink-sleutel (alleen admin), club aanmaken (alleen platformbeheerder).
- Bekende zwakte: lezen van `clubs`, `teams`, `trainingen`, `videos`, `documenten`, `berichten` is open voor elke ingelogde coach (client-queries op `code==` en `teams array-contains-any` laten niets strakkers toe). Isolatie per club vraagt een club-filter in die queries.
- `platform/instellingen` schrijven kan alleen via de console; platformbeheerder-check eist een geverifieerd e-mailadres.
- Storage-regels bestaan nog niet (`storage.rules`).

## Cloud Functions (omgezet naar het app-model, ONGETEST tegen echte Firestore)
- Sportlink: `sportlinkSyncNu` (admin) + `syncSportlink` (nacht) schrijven `teams/{id}/poule/*`, `teams/{id}/wedstrijden/sl_*` en `clubs/{id}/geheim/*` in het schema van de app.
- AI: `instellingen.ai.aan` en `maandLimiet` worden server-side afgedwongen; clubId verplicht.
- Open: `aggregeerGebruik` ontbreekt; `teamSleutel` (client) vs `naamSleutel` (server) moeten dezelfde uitkomst geven; Anthropic-limiet t/m oktober blokkeert AI; Node 22 is al ingesteld.

## Bewust nog statisch
- Onboarding-, handleiding- en updateteksten noemen soms nog ASV-voorbeelden (bijv. "ASVJO11-1").
- `over.html`/`readme.html`, PWA-manifest en icons: één per domein, niet per club.
- Standaard-content (kompas-tips, leercurve-teksten) = ASV-beleidsplan; clubs kunnen een eigen kopie maken of "Cluppie-standaard" gebruiken.
- `firebase.js` project-id `cluppieasv33` (één Firebase-project voor alle clubs; bewuste keuze).

## Testen voor livegang
- Nieuwe club via wizard → team → speler → wedstrijd; controleer dat er geen ASV-namen/logo verschijnen.
- ASV'33 ongewijzigd controleren (dashboard, weer, planning, kompas).
