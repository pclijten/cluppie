# Voortgang totaalplan cluppie.io

Bijgewerkt 15-11-2026. Werk staat op branch `wp0-opruimen` (lokaal, vanaf `main` 1d44083, niet gepusht).

## WP0 — Opruimen: af, wacht op P4 (push/deploy)

| Onderdeel uit het plan | Stand |
|---|---|
| Rollenkaart uit de code | Af: `docs/rollenkaart.md`. Acht gebruikerstypen, rechtenbron, matrix per collectie, tien kandidaat-bevindingen, voorstel testaccounts. |
| Functions naar een ondersteunde Node-versie | Was al gedaan: `functions/package.json` staat op Node 22. Niets gewijzigd. |
| Foutafhandeling: 400 niet als 503 | De server deed dit al goed voor 400/401/403/404. Toegevoegd: tegoed of bestedingslimiet op (402, of 400 met die melding) geeft nu "AI staat uit" (`failed-precondition`) in plaats van een algemene fout. De chatbot toonde bij élke fout "even niet bereikbaar", ook als AI uit stond of de limiet bereikt was; die toont nu de reden van de server. |
| Prompt caching kennisbank `chatHulp` | `cache_control` stond er al. Niet bewezen dat het werkt: Haiku 4.5 cachet pas vanaf 4096 tokens en het systeemblok van `chatHulp` (kennisbank 14.877 tekens plus instructie) zit daar vlak omheen. De andere AI-functies hebben veel kortere systeemblokken en cachen op Haiku 4.5 dus zeker niet. Toegevoegd: één logregel per aanroep met `cacheSchrijven` en `cacheLezen`, zodat het na de deploy in de logs te zien is. |
| AI-functies controleren na het spendlimiet | Code nagelopen (`structureerTraining`, `chatHulp`): geen fouten gevonden. Niet live getest; dat kan pas na deploy en met AI aan voor een club. |
| Open punten PORTEREN.md | Gesorteerd, zie hieronder. De meeste zijn deploys of console-acties van Paul. |

Gewijzigde bestanden: `functions/ai-fout.js` (nieuw), `functions/index.js`, `public/js/chatbot.js`, `tests/ai-fout.test.js` (nieuw, in `npm test`), `tests/sleutel.test.mjs` (Windows-pad; zelfde wijziging als in de lokale 14-nov-werkmap), `package.json`.

Getest: `npm test` 40 van 40 suites groen, `node tests/toegang.test.js` groen, `node --check` op de gewijzigde bestanden. Niet gedaan: versie-bump (`tools/versie.mjs`) en UPDATES-regel; die horen bij het releasemoment (P4), samen met de fixes uit WP1.

Nodig bij P4: `firebase deploy --only functions:chatHulp,functions:structureerTraining,functions:genereerVerslagAI,functions:samenvatHotspot,functions:vatDoelenSamen,functions:analyseerBeleidsplan,functions:personaliseerTraining,functions:seizoensVoorstel --project cluppie-ad329` (alle functies die `claude()` gebruiken). Geen nieuwe callables, dus geen invoker.

## WP1 — Beveiligingsaudit: rapport af, wacht op P1

`docs/beveiligingsaudit.md`. 47 proeven in de Firestore-emulator met vaste fictieve accounts per gebruikerstype (`tests/audit-rules.test.mjs`, `npm run audit:rules`): 29 in orde, 18 afwijkingen. Eén kritiek (elke coach schrijft het hele teamdocument, met een route naar Sportlink-namen van andere clubs), drie hoog, zeven middel, zeven laag. Er is nog niets aan de rules gewijzigd.

Open in WP1: Storage-rules testen, functions van begin tot eind, rolwissels, release 20261114a. Daarna de fixes, in de volgorde uit het rapport.

## Beslispunten voor Paul

1. **Release 20261114a staat alleen in je lokale werkmap.** Branch `asv33-14nov`, 103 gewijzigde en 6 nieuwe bestanden, niet gecommit en niet op GitHub. `main` is intussen drie releases verder (20261115a t/m c); 93 bestanden overlappen, waarvan 19 met echte inhoudsverschillen (onder andere `teams-spelers.js`, `platform-centrum.js`, `styles.css`, `club.js`). Ik heb er niets aan veranderd. Voorstel: ik commit het op zijn eigen branch en werk het bij naar `main` in een aparte PR, vóór de fixes van WP1.
2. **P1: akkoord op de beveiligingsaudit** en de volgorde van de fixes. Aparte keuze bij M4: krijgt de gekoppelde coach bouw echt de rechten van een bouwcoördinator, of gaat die belofte uit de interface?
3. **Model naar Haiku 5.5** (`claude-haiku-5-5`): ongeveer tien keer goedkoper ($0,10 / $0,50 per miljoen tokens tegenover $1 / $5) en cachet al vanaf 512 tokens. Het is geen kale id-wissel: `temperature` moet weg (geeft een 400), het model denkt standaard na (kost uitvoertokens, dus `max_tokens` omhoog of `effort` laag) en telt ongeveer 30% meer tokens. Moet live getest worden met een echte trainings-PDF. Voorstel: eigen kleine release na WP1.

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

Alle vijf zijn kleine toevoegingen zonder UX- of datamodelwijziging.

## Fable-verbruik

Niet zichtbaar vanuit deze sessie.
