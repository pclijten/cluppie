# Voortgang totaalplan cluppie.io

Bijgewerkt 16-11-2026. Releases 20261116a t/m e staan live. Release 20261115e staat live: rules, indexen, alle functions en de client (`main`). Paul koos een permissiemodus waarin Claude mocht deployen.

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
- **M6** Storage-rules: opgelost in 20261116d (getest per gebruikerstype, bestandstypen in de trainingsmap beperkt).
- **L4 t/m L7**: eindbaas-adres op vier plekken, `sportlinkClubcode`, dossier bij overzetten, App Check.
- Rolwissels (iemand die een rol verliest) en functions van begin tot eind zijn niet getoetst.

## Release 20261114a: bijgewerkt en samengevoegd

De release die alleen in Pauls werkmap stond is eerst ongewijzigd vastgelegd (`asv33-14nov`, commit 9b9d260) en daarna samengevoegd met `main` en de beveiligingsfixes op branch `asv33-14nov-bijgewerkt` (release 20261115e). Van de 92 conflicten waren er 78 alleen versienummers; 14 hadden inhoud (importregels, UPDATES, test-script, `structureerTraining`). Alle tests groen. De werkmap van Paul staat nog op `asv33-14nov`; daar is niets aan veranderd behalve die ene commit.

## Wat alleen Paul kan

1. **In de echte app nalopen** wat Claude niet kon zien: een gewone coach (team, Selectie, ingeleende speler), een bouwcoördinator (bouwoverzicht, uitlenen), een coach zonder `clubs.leden` (AI, "Uit Sportlink"), een training delen met een ouder, en de nieuwe volledige beoordeling uit 20261114a. De lijst staat bovenaan PORTEREN.md.
2. **Nagaan of het lek is misbruikt** en de build-images opruimen (PORTEREN.md).
3. **Model naar Haiku 5.5** (`claude-haiku-5-5`): ongeveer tien keer goedkoper en cachet al vanaf 512 tokens, maar `temperature` moet weg, het model denkt standaard na en telt ongeveer 30% meer tokens. Moet live getest worden met een echte trainings-PDF.
4. **Repo openbaar:** `firestore.rules`, de functions en nu ook het auditrapport staan in een openbare repo. Overweeg de repo besloten te maken (GitHub Pages vanaf een besloten repo vraagt een betaald plan) of de hosting te verplaatsen naar Firebase Hosting.

## WP2 t/m WP9: stand op 16-11-2026

Paul gaf op 15-11 akkoord om WP2 t/m WP9 zelfstandig te maken. Eerlijk over wat dat heeft opgeleverd: WP2, WP5 en WP6 hebben code gekregen (releases 20261116a en b, live); WP3, WP4, WP6, WP8 en WP9 zijn analyses en plannen met beslispunten; WP7 is een set concepten voor een jurist. Geen van deze werkpakketten is "af" in de zin van het totaalplan.

| WP | Wat er nu is | Document | Wat nog moet |
|---|---|---|---|
| WP2 Applogica | Klaar op branch (20261116a): van plek wisselen tijdens een periode klopt, melding bij klok op 0:00, importcontrole in `npm test`. | `docs/wp2-applogica.md` | Paul: is dit de bedoelde bug? `teams.js` splitsen, kompas-blok, rooktests per rol, de rest van de views doorlichten. |
| WP3 Multi-tenant | Analyse. Advies: "club-ID-first" niet bouwen; wel team loskoppelen en een overzicht bij de overstap. | `docs/wp3-multitenant-impactanalyse.md` | Besluit van Paul, dan mockup. |
| WP4 3D | Gebouwd en live (20261116c): tekening- en 3D-editor voor vormen in de bibliotheek (besluit Paul: alleen de bibliotheek). | `docs/wp4-3d-stand.md` | Paul probeert opslaan tegen de echte database; doeltjes, zones en pionnen bewerken; spelvormen 4-3-3 e.d. als vormen in de bibliotheek. |
| WP5 Design | Twee schermen gemeten in de demo; tikdoelen gefixt (20261116a) en de oranje tekstkleur in het lichte thema donkerder gemaakt (20261116d). | `docs/wp5-design-doorlichting.md` | Andere schermen, donker thema, desktop, andere rollen (kan nu met de demo per rol); tekst van 9 px. |
| WP6 Onboarding | Inventaris per rol. Gebouwd en live: de rolkaart voor vier rollen (20261116b) en het welkom voor een nieuwe coach bij een clubteam (20261116e), beide zonder mockup. | `docs/wp6-onboarding-per-rol.md` | Paul bekijkt beide; doorverwijzen als de club al meedoet (losse trainer); handleiding per rol. |
| WP7 Juridisch | Vier concepten en een lijst aanvullingen op de privacyverklaring. | `docs/juridisch/` | Jurist. Niets is gepubliceerd. |
| WP8 Marketing | Positie tegenover Rinus, Spond, TeamSnap en Touchline Studio; twee boodschappen; prijsmodel zonder bedragen; Gebouwd en live: demo per rol (20261116b) en de landingspagina met twee ingangen en een blok over privacy (20261116c). | `docs/wp8-marketing.md` | Paul leest de teksten na; prijsmodel en bedragen; de demo per rol op de landingspagina zetten; verkoopmateriaal. |
| WP9 Uitrol | Plan per fase met wat er klaar moet zijn. | `docs/wp9-uitrolplan.md` | Uitvoeren; contact met clubs doet Paul. |

**Demo per rol staat er.** Daarmee kunnen nu: de ontwerpmeting per rol (WP5), rooktests vóór het splitsen van `teams.js` (WP2) en de verkoop (WP8). De demo kent geen toegangsregels en geen eindbaas-rol.

**Wat ik bewust niet heb gebouwd** en waarom: team loskoppelen (WP3) en het splitsen van `teams.js` (WP2). Dat zijn grote of zichtbare veranderingen waar een keuze van Paul in zit (zie de beslispunten in elk document). De juridische teksten (WP7) blijven concepten tot een jurist ze heeft gelezen.

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
| Van plek wisselen tijdens een periode (`verwisselSlots`) | Invaller kon op twee plekken staan; starter verdween uit de opstelling | Coach, losse trainer |
| Raakvlak van kleine knoppen minstens 44 px | Gemeten: 28 tot 38 px | Alle |
| `tools/importcheck.mjs` in `npm test` | Een module werd met twee versienummers geladen | Geen (ontwikkeling) |
| Rolkaart bij eerste binnenkomst | Vier rollen kregen geen enkele uitleg; de gekoppelde coach bouw heeft sinds 15-11 nieuwe rechten | Bouwcoördinator, gekoppelde coach bouw, hoofd jeugd, trainingscoördinator |
| Demo per rol | Schermen van andere rollen dan de coach waren nergens te bekijken | Alle behalve eindbaas |
| Tekening- en 3D-editor in Platform › Bibliotheek | Gevraagd door Paul (alleen bibliotheek); tekeningen waren niet te bewerken | Eindbaas; indirect iedereen die een training bekijkt |
| Tekening als tekst opslaan | Firestore weigert lijsten in lijsten; Dupliceren zou daardoor mislukken | Eindbaas |
| Landingspagina: twee ingangen, wat Cluppie niet doet, privacy voor besturen | Gevraagd door Paul | Losse trainer, clubadmin (bezoekers) |
| Storage-regels getest; alleen PDF, PNG en JPEG in de trainingsmap | De regels waren nooit getest; elk bestandstype mocht | Coach, clubadmin |
| `--warn` donkerder in het lichte thema | Oranje tekst haalde het contrast niet | Alle |
| Welkomkaart voor een nieuwe coach bij een clubteam | Gekozen door Paul; uitgenodigde coaches kregen geen eerste stappen | Coach |
| Werkwijze: scripts schrijven pas weg als alle vervangingen gelukt zijn | Een bewerkingsscript maakte `functions/index.js` leeg; hersteld uit de commit, niets verloren | Geen |


## Fable-verbruik

Niet zichtbaar vanuit deze sessie.
