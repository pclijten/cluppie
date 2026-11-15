# Voortgang totaalplan cluppie.io

Bijgewerkt 15-11-2026. Release 20261115e staat live: rules, indexen, alle functions en de client (`main`). Paul koos een permissiemodus waarin Claude mocht deployen.

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

## WP1 — Beveiligingsaudit en fixes: live sinds 15-11, drie restpunten

Rapport: `docs/beveiligingsaudit.md` (tabel "Stand na de fixes" bovenaan). Paul gaf op 15-11 akkoord om alles te fixen en het hele plan af te werken zonder verdere toestemming.

Gefixt (release 20261115d en 20261115e, branch `asv33-14nov-bijgewerkt`, lokaal): K1, H1, H2, H3, M1 t/m M5, M7, L1, L2, L3 en de lezerslijst van privé-beoordelingen. Getest: rules in de emulator 41 van 41 scenario's (één daarvan draait 88 proeven met vaste fictieve accounts per gebruikerstype, zowel "mag niet" als "moet blijven werken"), `npm test` 41 suites, `tests/toegang.test.js`. Niet in een browser bekeken en niet tegen echte Firebase.

Open in WP1:
- **M6** Storage-rules: nog geen emulatortest, niets aangescherpt.
- **L4 t/m L7**: eindbaas-adres op vier plekken, `sportlinkClubcode`, dossier bij overzetten, App Check.
- Rolwissels (iemand die een rol verliest) en functions van begin tot eind zijn niet getoetst.

## Release 20261114a: bijgewerkt en samengevoegd

De release die alleen in Pauls werkmap stond is eerst ongewijzigd vastgelegd (`asv33-14nov`, commit 9b9d260) en daarna samengevoegd met `main` en de beveiligingsfixes op branch `asv33-14nov-bijgewerkt` (release 20261115e). Van de 92 conflicten waren er 78 alleen versienummers; 14 hadden inhoud (importregels, UPDATES, test-script, `structureerTraining`). Alle tests groen. De werkmap van Paul staat nog op `asv33-14nov`; daar is niets aan veranderd behalve die ene commit.

## Wat alleen Paul kan

1. **In de echte app nalopen** wat Claude niet kon zien: een gewone coach (team, Selectie, ingeleende speler), een bouwcoördinator (bouwoverzicht, uitlenen), een coach zonder `clubs.leden` (AI, "Uit Sportlink"), een training delen met een ouder, en de nieuwe volledige beoordeling uit 20261114a. De lijst staat bovenaan PORTEREN.md.
2. **Nagaan of het lek is misbruikt** en de build-images opruimen (PORTEREN.md).
3. **Model naar Haiku 5.5** (`claude-haiku-5-5`): ongeveer tien keer goedkoper en cachet al vanaf 512 tokens, maar `temperature` moet weg, het model denkt standaard na en telt ongeveer 30% meer tokens. Moet live getest worden met een echte trainings-PDF.
4. **Repo openbaar:** `firestore.rules`, de functions en nu ook het auditrapport staan in een openbare repo. Overweeg de repo besloten te maken (GitHub Pages vanaf een besloten repo vraagt een betaald plan) of de hosting te verplaatsen naar Firebase Hosting.

## Volgende werkpakketten (nog niet begonnen)

| WP | Eerste stappen |
|---|---|
| WP2 Applogica | Bekende bug "wissel zonder lopende klok" uitzoeken in `wedstrijd.js`; losse trainer: notities, video's en tactiek bij een training onder `teams/{id}/trainingen` werken niet; kompas-blok op Trainingen kiest een eigen thema naast het seizoensplan; `openPlatformOud()` weg; `teams.js` splitsen (3.200 regels, pure refactor met `node --check` per stap); dubbele versienummers bewaken met een importcontrole in `npm test`. |
| WP3 Multi-tenant | Impactanalyse: plek van de losse trainer in het model en de overstap naar een club (deels gebouwd in 20261111a en 20261114a), config-laag evaluatiedomeinen, migratieplan met terugrolpad. |
| WP4 3D | Bestaat deels sinds 20261115b (oefeningen in 3D, stap voor stap). Nog: editor voor coaches, spelvormen 4-3-3 e.d., rechten per rol. |
| WP5 Design | Tokens en contrast nalopen, tikdoelen, lege toestanden per rol; schermen per rol renderen op 414×896 en 1440. |
| WP6 Onboarding | Eerste-keer-ervaring per rol; handleiding en kennisbank per rol. |
| WP7 Juridisch | Concepten: verwerkersovereenkomst, voorwaarden losse trainers, privacyverklaring, verwerkingsregister, datalekprocedure. Controle door een jurist blijft nodig. |
| WP8 Marketing | Prijsmodel, landingspagina met aparte instap voor trainer en club, demo met fictieve data per rol, concurrentiepositie. |
| WP9 Uitrol | Pilotplan één club, dan 5, dan 30. |

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
| Spelerdocumenten en uitleningen alleen voor het eigen team en sturende rollen | Notities en leerpunten waren leesbaar voor elke coach van de club | Coach, alle sturende rollen |
| Rules zuiniger; "moet werken"-proeven per rol | De evaluatielimiet gaf stille weigeringen | Alle |
| Werkwijze: scripts schrijven pas weg als alle vervangingen gelukt zijn | Een bewerkingsscript maakte `functions/index.js` leeg; hersteld uit de commit, niets verloren | Geen |


## Fable-verbruik

Niet zichtbaar vanuit deze sessie.
