# Voortgang totaalplan cluppie.io

Bijgewerkt 15-11-2026. Werk staat op branch `wp0-opruimen` (lokaal, vanaf `main` 1d44083, niet gepusht).

## WP0 — Opruimen: af, zit in release 20261115d

| Onderdeel uit het plan | Stand |
|---|---|
| Rollenkaart uit de code | Af: `docs/rollenkaart.md`. Acht gebruikerstypen, rechtenbron, matrix per collectie, tien kandidaat-bevindingen, voorstel testaccounts. |
| Functions naar een ondersteunde Node-versie | Was al gedaan: `functions/package.json` staat op Node 22. Niets gewijzigd. |
| Foutafhandeling: 400 niet als 503 | De server deed dit al goed voor 400/401/403/404. Toegevoegd: tegoed of bestedingslimiet op (402, of 400 met die melding) geeft nu "AI staat uit" (`failed-precondition`) in plaats van een algemene fout. De chatbot toonde bij élke fout "even niet bereikbaar", ook als AI uit stond of de limiet bereikt was; die toont nu de reden van de server. |
| Prompt caching kennisbank `chatHulp` | `cache_control` stond er al. Niet bewezen dat het werkt: Haiku 4.5 cachet pas vanaf 4096 tokens en het systeemblok van `chatHulp` (kennisbank 14.877 tekens plus instructie) zit daar vlak omheen. De andere AI-functies hebben veel kortere systeemblokken en cachen op Haiku 4.5 dus zeker niet. Toegevoegd: één logregel per aanroep met `cacheSchrijven` en `cacheLezen`, zodat het na de deploy in de logs te zien is. |
| AI-functies controleren na het spendlimiet | Code nagelopen (`structureerTraining`, `chatHulp`): geen fouten gevonden. Niet live getest; dat kan pas na deploy en met AI aan voor een club. |
| Open punten PORTEREN.md | Gesorteerd, zie hieronder. De meeste zijn deploys of console-acties van Paul. |

Gewijzigde bestanden: `functions/ai-fout.js` (nieuw), `functions/index.js`, `public/js/chatbot.js`, `tests/ai-fout.test.js` (nieuw, in `npm test`), `tests/sleutel.test.mjs` (Windows-pad; zelfde wijziging als in de lokale 14-nov-werkmap), `package.json`.

Getest: `npm test` 40 van 40 suites groen, `node tests/toegang.test.js` groen, `node --check` op de gewijzigde bestanden. Versie-bump en UPDATES-regel zijn samen met de fixes van WP1 gedaan (20261115d).

Deploy: zie het blok bovenaan PORTEREN.md.

## WP1 — Beveiligingsaudit en fixes: grotendeels af, wacht op deploy

Rapport: `docs/beveiligingsaudit.md` (met een tabel "Stand na de fixes" bovenaan). Paul gaf op 15-11 akkoord om alles te fixen zonder verdere toestemming.

Gefixt in release 20261115d (lokaal, branch `wp0-opruimen`): K1, H1, H3, M1 t/m M5, M7, L1, L2, L3. Getest: rules in de emulator 39 van 39 scenario's (één daarvan draait 74 proeven met vaste fictieve accounts per gebruikerstype, zowel "mag niet" als "moet blijven werken"), `npm test` 40 suites, `tests/toegang.test.js`. Versie-bump en UPDATES-regel gedaan. Niet in een browser bekeken en niet tegen echte Firebase.

Open in WP1:
- **H2** notities en leerpunten leesbaar voor elke coach van de club (ook via de snapshot op uitleningen). Vraagt een datamodelwijziging met migratie; impactanalyse is de volgende stap.
- **M6** Storage-rules testen en aanscherpen.
- **L4 t/m L7** (eindbaas-adres op vier plekken, `sportlinkClubcode`, dossier bij overzetten, App Check).
- Rolwissels en functions van begin tot eind zijn niet getoetst.

## Wat alleen Paul kan

1. **Deployen en mergen** van release 20261115d. De volgorde staat bovenaan PORTEREN.md. Tot dan staat K1 in productie open. Ik heb niets gepusht of gedeployed: dat raakt de live app en vraagt jouw Firebase- en GitHub-rechten.
2. **Emulator afsluiten:** er draait nog een Firestore-emulator van mijn eerste testronde (java, poort 8080). Ik mocht hem niet stoppen. Sluit hem via Taakbeheer, anders start `npm run test:rules` niet (rechtstreeks draaien kan wel: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test tests/rules.test.mjs tests/audit-rules.test.mjs`).
3. **Release 20261114a** is lokaal vastgelegd op `asv33-14nov` (commit 9b9d260), nog niet bijgewerkt naar `main`. Dat doe ik als volgende stap, in een eigen branch.
4. **Model naar Haiku 5.5** (`claude-haiku-5-5`): ongeveer tien keer goedkoper en cachet al vanaf 512 tokens, maar `temperature` moet weg, het model denkt standaard na en telt ongeveer 30% meer tokens. Moet live getest worden met een echte trainings-PDF; eigen kleine release.

## Open punten uit PORTEREN.md, gesorteerd

- **Alleen Paul (deploy, console, terminal):** alle "Voor Paul"-blokken met deploys en invokers; App Check op Enforce; tijdelijke database en oude bucket verwijderen; SPF/DKIM; AI per club aanzetten; `functions/scouting.js` uit ASV'33 kopiëren.
- **Naar WP1 (beveiliging):** `storage.rules` testen in de emulator; `sportlinkClubcode` door een clubadmin te wijzigen; documenten zonder `club`-veld.
- **Naar WP2 (logica):** `openPlatformOud()` weghalen; kompas-blok op Trainingen kiest een eigen thema naast het seizoensplan; notities, video's en tactiek bij trainingen van losse trainers werken niet.
- **Eigen release:** `firebase-functions` upgraden (breaking changes); model naar Haiku 5.5.
- **Vraagt mockup of keuze:** knop JO→O-teamnamen; trainingsbibliotheek uitbreiden.

## Eigen toevoegingen

| Wat | Reden | Geraakte gebruikerstypen |
|---|---|---|
| Tegoed op → "AI staat uit" in plaats van algemene fout | Na het spendlimiet kreeg de coach een melding die naar een storing wees | Coach, coördinatoren, hoofd jeugd, clubadmin; losse trainer als solo-AI aan staat |
| Chatbot toont de reden van de server | "Even niet bereikbaar" bij AI uit of limiet bereikt is onjuist | Iedereen met AI |
| Logregel met cache-tokens | Zonder meting is niet te zeggen of caching werkt | Eindbaas (kosten) |
| `sleutel.test.mjs` draait op Windows | `npm test` stopte op Pauls pc bij de vijfde suite | Geen (ontwikkeling) |

| `tests/audit-rules.test.mjs` en `npm run audit:rules` | Bewijs per gebruikerstype voor de audit, herhaalbaar | Alle |
| Gekoppelde coach bouw krijgt de rechten van een bouwcoördinator | De interface beloofde het, de rules gaven het niet; het totaalplan noemt het als bedoeling | Gekoppelde coach bouw |
| Ouder-link draagt naam en rugnummer zelf | De link gaf toegang tot volledige spelerdocumenten | Coach, losse trainer (ouders) |
| `tools/versie.mjs` draait op Windows | De release-tool stopte op Pauls pc | Geen (ontwikkeling) |
| Werkwijze: scripts schrijven pas weg als alle vervangingen gelukt zijn | Een bewerkingsscript maakte `functions/index.js` leeg; hersteld uit de commit, niets verloren | Geen |


## Fable-verbruik

Niet zichtbaar vanuit deze sessie.
