# PORTEREN.md — stand van zaken cluppie.io

Cluppie.io is de multi-tenant versie van Cluppie (oorspronkelijk de app van ASV'33, repo `cluppieasv33`). Alle clubwaarden staan in `clubs/{id}.instellingen` en zijn in de browser instelbaar (Club → Instellingen; wizard "Nieuwe club"); de app bevat geen ASV-verwijzingen meer. Project `cluppie-ad329`, alles in de EU (`europe-west1`), client via GitHub Pages vanaf `main`.

## Stand (bijgewerkt 20-10-2026, versie 20261020c)
- **Firestore-rules:** per club afgeschermd (teams, trainingen, video's, documenten, berichten via clublidmaatschap). Getest in de emulator: `npm run test:rules` (21 scenario's, laatst 20/20 groen op 11-10; de 21e is in 20261011f toegevoegd). Deploy: `firebase deploy --only firestore:rules --project cluppie-ad329`.
- **Cloud Functions:** live in `europe-west1` (Node 22, 2nd gen). Iedere nieuwe callable heeft na de eerste deploy de invoker `allUsers` nodig (`gcloud run services add-iam-policy-binding <naam-in-kleine-letters> …`), anders krijgt de app een CORS-/`internal`-fout.
- **Tests:** `npm test` (17 suites, laatst 13-10 allemaal groen; nieuw: `vaste-afmeldingen`. Eerst één keer `cd functions && npm install`) en `node tests/toegang.test.js` (aansluiten/uitnodigen, 24 scenario's). Pariteit met ASV'33: `node tools/pariteit.mjs ../cluppieasv33` (10 verwachte verschillen in `bouw-hub.js`, `club.js` en `teams-spelers.js`: het overzetten loopt hier via de server; ASV'33 PR #5 is sinds 20261013a gepoort).
- **Versies:** elke release `node tools/versie.mjs JJJJMMDDx origin/main` (zet `?v=` in gewijzigde modules en hun importeurs + `CACHE_VERSIE` in `sw.js`).
- **App Check:** reCAPTCHA Enterprise, meet alleen (Enforce uit).

## Open
**Voor Paul (console/terminal)**
- [ ] Release 20261013b (branch `onderdelen-aan-uit`): PR reviewen en mergen. **Eerst** `npm run test:rules` draaien (Java nodig, kon hier niet), daarna deployen: `firebase deploy --only firestore:rules --project cluppie-ad329` en `firebase deploy --only functions:personaliseerTraining,functions:seizoensVoorstel --project cluppie-ad329`. Zonder die twee deploys kan een clubbeheerder de eindbaas-schakelaar nog omzeilen.
- [x] Release 20261013a (branch `vaste-afmelding`, gemerged als PR #19): PR reviewen en mergen. Alleen client, geen rules- of functions-deploy voor de vaste afmelding. De bijgewerkte kennisbank (`functions/kennis.js`) gaat mee bij de eerstvolgende deploy van `chatHulp`: `firebase deploy --only functions:chatHulp --project cluppie-ad329`.
- [ ] In ASV'33 (`cluppieasv33`): niets te doen voor de vaste afmelding (daar komt hij vandaan).
- [x] Release 20261012a: functions gedeployed en invoker `sportlinkclubinfo` open (12-10-2026).
- [ ] Na het mergen van PR #12: één keer "Sync nu" bij een club met Sportlink.
- [ ] `firebase-functions` upgraden (de CLI waarschuwt; breaking changes, dus als eigen release met tests).
- [ ] `zetSpelerOver` deployen + invoker openzetten (zie release 20261011h), als dat nog niet gebeurd is (PR #11 is al gemerged).
- [ ] Rond 18-10: tijdelijke database weg (`gcloud firestore databases delete --database=cluppie-overzet --project=cluppie-ad329`) en bestanden in de oude bucket verwijderen.
- [ ] App Check: na een paar dagen in Console → App Check → APIs kijken; bij ~100% geldige verzoeken Enforce aan voor Firestore, Storage en Functions.
- [ ] AI per club aanzetten zodra de Anthropic-limiet het toelaat (eind oktober).
- [ ] E-mail: eigen function `verstuurMail` (`functions/mail.js`) in gebruik nemen: `firebase functions:secrets:set SMTP_WACHTWOORD`, daarna `firebase deploy --only functions:verstuurMail` (vraagt SMTP_HOST, poort, gebruiker en afzender). Testen met een document in de collectie `mail` (Console → Firestore: `to`, `message.subject`, `message.text`) en kijken of `delivery.state` op SUCCESS komt. De Trigger Email-extensie is dus niet nodig (Firebase Extensions wordt op 31-03-2027 stopgezet).

**Voor Paul — Opgemaakte aanmeldmails in het Nederlands (release 20261020c, branch `mooie-aanmeldmail`)**
- [ ] PR reviewen en mergen. Wat het doet: de vier mails rond aanmelden zijn nu opgemaakt (donkere kop met Cluppie-C, rode accentlijn, genummerde stappen, knop) en bevatten naast de tekstversie een HTML-versie: welkomstmail aan de nieuwe clubbeheerder (met de zeven stappen van "Aan de slag"), afwijzing, melding aan jou van een nieuwe clubaanmelding, en de melding aan clubbeheerders bij een nieuwe coach-aanvraag. Alles in het Nederlands, geen externe afbeeldingen.
- [ ] Deploy: `firebase deploy --only functions:meldClubAan,functions:beoordeelClubAanmelding,functions:meldNieuweAanvraag,functions:verstuurMail --project cluppie-ad329`. Geen nieuwe functies, dus geen invoker nodig. Zonder deploy van `verstuurMail` gaat de HTML niet mee (dan blijft het tekstmail).
- [ ] Testen: laat een testclub aanmelden en goedkeuren, en bekijk de mail in Gmail, Outlook en op je telefoon. Niet in een echt mailprogramma bekeken (wel in Chromium op 700 en 375 px breed).
- [ ] Niet gedaan: de overige mails (bijv. uitnodigingen) zijn er niet; als die er komen, gebruik `maakMail()` uit `functions/mail-sjabloon.js`.

**Voor Paul — Trainingsupload, blokplanning en individuele coaches (release 20261020b, branch `training-upload-blokplanning`)**
- [ ] PR reviewen en mergen. Wat het doet: (1) uit ASV'33 gepoort (releases van 13-10): een zip of meerdere PDF's met blok-namen in één keer inplannen (`training-plan.js`), uploaden op de achtergrond met wachtrij en concept (`upload-wachtrij.js`), drie trainingen tegelijk omzetten, "zichtbaar voor het team vanaf" ook bij een losse training, Overzicht per groep horizontaal scrollen en afwijkers weggooien; (2) nieuw: in het eindbaasscherm staat een kaart **Individuele coaches** (accounts zonder club: eigen team, aanvraag open of nog niets gestart, met "nieuw"-label voor de laatste 7 dagen) en een extra KPI.
- [ ] **Eerst** `cd functions && npm install` en `npm test` (nieuw: `tests/trainingplan.test.mjs`, `tests/individuele-coaches.test.mjs`; allebei groen op 20-10, de hele reeks eindigde groen). Geen rules-wijziging.
- [ ] Deploy: `firebase deploy --only functions:structureerTraining,functions:platformOverzichtNu,functions:aggregeerGebruikNacht --project cluppie-ad329` (de nachtelijke functie bouwt hetzelfde overzicht). Geen nieuwe functies, dus geen invoker nodig. Daarna in het platformscherm één keer **Vernieuwen**: pas dan verschijnt de kaart Individuele coaches.
- [ ] **AVG:** het eindbaasscherm toont van individuele coaches naam, e-mailadres, aanmelddatum, laatste login, teamnaam en aantal spelers (geen spelersnamen). Alleen voor de platformbeheerder leesbaar (`platformstats`). Noem dit in privacyverklaring en gebruiksvoorwaarden en laat een privacyadviseur kijken.
- [ ] "Nauwkeuriger" AI-model staat bewust **uit**. Aanzetten kan pas als jij het model-id kiest: zet `MODEL_NAUWKEURIG` in `functions/index.js` en `NAUWKEURIG_AAN = true` in `public/js/upload-wachtrij.js` samen aan, en deploy `structureerTraining`. Controleer het model-id eerst (zie ook het punt over `MODEL` hieronder).
- [ ] JSZip staat nu lokaal in `public/vendor/jszip.min.js` (v3.10.1, geen externe CDN, past bij de CSP). In ASV'33 komt hij nog van jsdelivr.
- [ ] Niet in een echte browser bekeken (414×896 en desktop): het uploadvlak met zip, het blokvenster, de weergave Plannen, het label rechtsonder en de kaart Individuele coaches in het platformscherm. Even bekijken na de deploy.
- [ ] Niet gedaan: een mail aan jou zodra een nieuwe individuele coach zich aanmeldt (nu alleen zichtbaar in het scherm); eventueel een Auth-trigger of een melding bij Vernieuwen.

**Voor Paul — Ondersteuningsmodus voor de eindbaas (release 20261020a, branch `ondersteuningsmodus`)**
- [ ] PR reviewen en mergen. Wat het doet: de eindbaas opent een club vanuit het platformdashboard en werkt dan maximaal 2 uur als clubbeheerder in precies die club (balk "Je werkt als eindbaas in …" met stopknop). Zonder de modus ziet de eindbaas alleen de teamlijst per club, geen spelers. Start en stop staan in het toegangslog van de club; handelingen daartussen worden niet apart gelogd. Een club kan het uitzetten (Toegang & privacy → "Cluppie mag meekijken en helpen", standaard aan).
- [ ] **Eerst** `npm run test:rules` draaien (4 nieuwe scenario's onderaan `tests/rules.test.mjs`; Java nodig, kon hier niet), daarna deployen: `firebase deploy --only firestore:rules --project cluppie-ad329` en `firebase deploy --only functions:startOndersteuning,functions:stopOndersteuning --project cluppie-ad329`. Per nieuwe functie de invoker openzetten: `gcloud run services add-iam-policy-binding startondersteuning --region=europe-west1 --member=allUsers --role=roles/run.invoker --project=cluppie-ad329` en hetzelfde voor `stopondersteuning`.
- [ ] Verwerkersovereenkomst/privacyverklaring: noem dat Cluppie (de eindbaas) op verzoek of ter ondersteuning tijdelijk in de club kan werken, met logging, en dat een club dit kan uitzetten.
- [ ] Niet gedaan: zoeken op teamnaam over alle clubs in het platformscherm (nu zoeken op club of plaats).

**Voor Paul — Training maken v2 (release 20261014a, branch `trainingen-4-vormen`)**
- [ ] PR reviewen en mergen. Alleen client (geen rules- of functions-deploy). Max 4 vormen (warming-up, 2 kern, partij), vorm ≤15 min (partij 20 met rust), duur 45/60/75, bibliotheek 141 vormen O6–O19, nieuw scherm met tabs Uitvoering/Coach/Differentiatie/Spelvormen. Oude bewaarde trainingen (90 min) worden bij openen opnieuw samengesteld.
- [ ] Praktijktest met een mini-team (O7), een O11 en een O15+: veldmaten zijn aannames; dunne cellen staan bij Bouwen.

**Voor Paul — Training maken en Seizoen (release 20261012e)**
- [ ] De code staat op `main`. Nog te doen (als dat niet gebeurd is): `firebase deploy --only functions:personaliseerTraining,functions:seizoensVoorstel` en voor beide de invoker `allUsers` openzetten (zie `functions/LEESMIJ-deploy.md`).
- [ ] AI-uitleg en AI-jaarvoorstel werken pas als de Anthropic-limiet het toelaat; zonder AI werkt alles met de standaardtekst en de standaard jaarlijn.
- [ ] `MODEL` in `functions/index.js` is nog `claude-haiku-4-5-20251001`. Haiku 5.5 is volgens de prijzenpagina 10× goedkoper; model-id eerst controleren, dan omzetten (geldt voor alle AI-functies).
- [ ] Praktijktest met één of twee teams (bijv. een O11 en een O9) voordat het breder gaat; coaches de 48 vormen laten beoordelen (veldmaten en m² per speler zijn aannames).
- [ ] KNVB schriftelijk om toestemming vragen als KNVB-vormen getoond of bewerkt moeten worden; nu is de bibliotheek eigen werk.

**Bouwen**
- [ ] Trainingsbibliotheek uitbreiden: omschakelen balwinst/balverlies (vanaf O14), dunne cellen (Teamsport O13, Technische vaardigheden O13, Dieptespel O8), keepervormen, O14+.
- [ ] Sportlink: na de eerste weekendcontrole (`checkAfgelastingen`, vr 16–22 en za/zo 7–14) in de logs kijken of het aantal calls en markeringen klopt.
- [ ] Een clubbeheerder kan in zijn eigen club `sportlinkClubcode` aanpassen. Misbruik (de code van een andere club invullen om diens aanmelding te blokkeren) is onwaarschijnlijk; eventueel het veld in de rules alleen voor functions/platform schrijfbaar maken.
- [ ] Bestaande teamnamen "JO11-1" omzetten naar "O11-1" (knop voor de clubbeheerder of eenmalig voor alle clubs).
- [ ] `storage.rules` testen in de emulator (Firestore-rules zijn getest, Storage nog niet).
- [ ] Documenten van vóór de clubscheiding zonder `club`-veld: controleren of ze er nog zijn en zo nodig vullen.
- [ ] ASV'33 als club op cluppie.io: aparte migratie (data overzetten, coaches laten overstappen).
- [ ] Test met één bevriende club vóór bredere uitrol.

**Bewust (nog) niet**
- Variabel aantal beoordelingsdomeinen (3–6): pas als een club erom vraagt.
- Delen van plannen tussen clubs: vraagt expliciete toestemming per club.
- `over.html`/`readme.html`, PWA-manifest en icons: één per domein, niet per club.

---

# Geschiedenis

## Release 20261020c — aanmeldmails opgemaakt (HTML) en in het Nederlands
- Nieuw: `functions/mail-sjabloon.js` (`maakMail({ voorkop, titel, alineas, stappen, gegevens, knop, slot, voet })` → `{ text, html }`; puur, alles ge-escaped, knop alleen `https://`). Tabelgebaseerde HTML met inline stijlen, 600 px breed, merkkleuren (`#e2342f` accent, `#0e1013` kop), geen externe afbeeldingen (de C in de kop is tekst), tekstversie blijft als terugval.
- `functions/mail.js`: `message.html` (optioneel, max 100.000 tekens) wordt meegestuurd; `message.text` blijft verplicht. Afzender en ontvangercontroles ongewijzigd.
- `functions/aanmelding.js`: welkomst-, afwijzings-, platformmelding- en coach-aanvraagmail gebruiken `maakMail`. De zeven stappen in de welkomstmail spiegelen `STAPPEN` in `public/js/startlijst.js`.
- Tests: `tests/mail-sjabloon.test.js` (nieuw, in `npm test`) en uitbreiding van `tests/mail.test.js`. `state.js` en rules niet aangeraakt; geen client-wijziging, dus geen versie-bump van de app nodig.

## Release 20261020b — trainingsupload en blokplanning gepoort, individuele coaches in het eindbaasscherm
- **Gepoort uit ASV'33** (PR #6–#11, 13-10-2026): nieuwe modules `training-plan.js` en `upload-wachtrij.js`, koppelpunten in `club.js`, zichtbaarheidsfilter in `teams.js` (`zichtbaarVanaf`), weekweergave in `teams-training.js`, parallelle diagram-upload in `training-ai.js`, CSS-blokken `BLOKPLANNING` en `UPLOADWACHTRIJ`. Aanpassingen voor cluppie.io: JSZip lokaal in `vendor/`, de wijzigingenlijst als twee neutrale regels, geen ASV-teksten (bewaakt in `tests/trainingplan.test.mjs`). Training-documenten krijgen zoals altijd `club` en `clubNaam`, dus de bestaande rules blijven gelden.
- **Modelkeuze:** `structureerTraining` accepteert `model` (`standaard` | `nauwkeurig`, whitelist; anders `invalid-argument`). `MODEL_NAUWKEURIG` is `null`, dus nu altijd het standaardmodel; de keuze is in de app verborgen (`NAUWKEURIG_AAN = false`).
- **Eindbaasscherm:** `bepaalIndividueleCoaches` in `functions/platform.js` (puur, getest) + `leesAuthGebruikers` (Admin Auth `listUsers`) → `platformstats/overzicht.individueel` en `totalen.individueel`/`individueelNieuw`. Een account telt als individueel als het in geen enkele club zit; de eindbaas zelf wordt uitgesloten. Mislukt het lezen, dan blijft de rest van het overzicht gewoon werken. Client: kaart en KPI in `platform.js`, stijlen `.pf-coach*`.
- `state.js` niet aangeraakt. Versie via `node tools/versie.mjs 20261020b origin/main`.

## Release 20261018a — eigen mailfunctie (vervangt de Trigger Email-extensie)
- `functions/mail.js`: `verstuurMail` (trigger op `mail/{id}`, `europe-west1`) verstuurt elk nieuw document via SMTP (nodemailer). Zelfde documentvorm als de extensie (`to`, `message.subject/text`), dus `aanmelding.js` bleef ongewijzigd. Resultaat in het document: `delivery.state` PROCESSING → SUCCESS of ERROR (met `error`).
- Veilig: afzender komt altijd uit de instelling `MAIL_VAN` (nooit uit het document), max. 10 ontvangers, adressen gecontroleerd, regeleinden uit het onderwerp (geen header-injectie), tekst max. 20.000 tekens, één keer claimen via een transactie (geen dubbele mails bij een dubbele gebeurtenis), geen automatische herhaling.
- Instellingen bij de eerste deploy: `SMTP_HOST`, `SMTP_PORT` (465), `SMTP_GEBRUIKER` (paul@cluppie.io), `MAIL_VAN`. Geheim: `SMTP_WACHTWOORD` (Secret Manager). Geen invoker nodig (trigger, geen callable).
- Test: `node tests/mail.test.js` (24 controles, in `npm test`); `tests/sportlink-sync.test.js` kent nu `defineString`.
- `PLATFORM_EMAIL` in `functions/aanmelding.js` (ontvanger van de aanmeldmelding) staat nu op paul@cluppie.io. De platformbeheerder-controle (`functions/platform.js`, `firestore.rules`, `public/js/state.js`) blijft bewust op het inlogaccount pclijten@gmail.com: dat is een ander ding.


## Release 20261013b — Training maken en Seizoensplanning aan/uit (eindbaas, club, team)

Drie lagen, strengste wint: **eindbaas** (platformscherm, per club, harde poort) → **clubbeheerder** (standaard per club, "Onderdelen die standaard aan staan") → **team** (matrix/teaminstellingen).

- **Standaard:** clubs aangemaakt vóór 2026-10-13 behouden beide onderdelen (geen datamigratie: `GRENS_SEC` in `onderdelen.js` en `functions/onderdelen.js`). Nieuwe clubs beginnen **uit** tot de eindbaas ze aanzet. Expliciete waarde in `clubs/{id}.platformModules.{trainingsmodule|seizoensplan}` wint altijd.
- **Code:** `public/js/onderdelen.js` (`onderdeelAan`, `platformToegestaan`, `doorPlatformUit`); `state.js` is bewust niet aangeraakt. `clubconfig.js` zet `S._clubPlatform`. Tegels, desktopmenu, tab-herstel, thema-check en weekplanning kijken naar `onderdeelAan`.
- **Server:** `vereisAI(request, rollen, onderdeel)` weigert met `failed-precondition` als de eindbaas het onderdeel uit heeft (`personaliseerTraining`, `seizoensVoorstel`).
- **Rules:** clubadmin mag `platformModules` niet wijzigen (alleen `isPlatform()`); scenario toegevoegd in `tests/rules.test.mjs`.
- **Tests:** `tests/onderdelen.test.mjs` (lagen, datumformaten, client = server).
- **Niet getest:** de emulator-rules en het uiterlijk in een echte browser (platformscherm-knoppen, uitgegrijsde cellen in de matrix). Even bekijken na de deploy.

## Release 20261013a — vaste afmelding gepoord, thema-check op desktop, handleiding
- **Vaste afmelding** (ASV'33 PR #5, release 20261012a): een coach meldt een speler in één keer af voor een vaste trainingsdag over meerdere weken. Regels staan op `teams/{id}.vasteAfmeldingen`; er worden geen presentie-records vooruit aangemaakt, zodat opkomst-% en afgelaste trainingen kloppen. Presentievenster, eerstvolgende-kaart, "vooruit afgemeld" en de desktop-trainingen tonen de afmelding met 🔁. Nieuwe module `public/js/vaste-afmeldingen.js` (zonder imports), aanpassingen in `teams-training.js`, `teams.js`, `desktop-schermen.js`, `styles.css`. Test: `tests/vaste-afmeldingen.test.mjs`. Presentie-HTML met een lopende regel is in Node gerenderd; **niet getest in een echte browser** (414×896/desktop): bekijk de knop "Vaste afmelding" en het formulier even op je telefoon.
- **Thema-check op desktop**: de teamevaluatie op de desktop (`desktop-schermen.js`, actie `evcheck`/`evsave`) vraagt nu ook "Kwam het thema terug?" (ja/deels/nee), alleen als het team een seizoensplan heeft; zelfde veld `themaCheck` als op de telefoon.
- **Handleiding en kennisbank**: nieuwe secties Training maken, Seizoen (jaarlijn en bijsturing) en Vaste afmelding in `teams-handleiding.js` en `functions/kennis.js`.
- `PORTEREN-regel.md` (verouderd snippet van 28-9) verwijderd. `state.js` niet aangeraakt, geen rules-wijziging.
- Bewust **niet** gedaan: `MODEL` in `functions/index.js` omzetten (het model-id van Haiku 5.5 kon ik hier niet controleren), en bouwen die een mockup of jouw keuze vragen (bibliotheek uitbreiden, knop JO→O-namen, `storage.rules`-test in de emulator).

## Release 20261012h — eigen wedstrijd: tegenstander uit de clubgids, tijden en plek
Mockup goedgekeurd 12-10. Gecontroleerd met live pouledata (O12-1): `pouleuitslagen` bevat per wedstrijd `thuisteamclubrelatiecode` en `accommodatie`; een adres geeft Sportlink alleen bij wedstrijden met een eigen team.
- **Clubgids** (`clubgids/{clubcode}`, platformbreed, alleen openbare clubgegevens): naam (gemeenschappelijk begin van de teamnamen), teamnamen, meest gebruikte sportpark, plaats, adres/route zodra bekend. De sync (`schrijfClubgids`) vult hem uit programma, uitslagen en pouledata; leest bestaande documenten in één keer en schrijft alleen wat verandert. Een fout in de gids laat de sync nooit mislukken.
- **Nieuwe wedstrijd** (`wedstrijd.js`): tegenstander met suggesties (eerst de eigen poule, dan de gids, altijd ook vrije tekst), tijden (verzamelen, vertrek alleen bij uit, aftrap) en plek (uit: sportpark van de tegenstander; thuis: eigen sportpark; "Wijzigen" of vrije tekst). Bewaart `aftrap`, `infoEigen{verzamel, vertrek, accommodatie, adres?, plaatsAdres?, route}` en `tegenstanderClub`. Toernooi: tijden + vrije plek.
- **Wedstrijdinfo**: eigen plek gaat voor (`wedstrijdInfo`); bij een eigen wedstrijd ook aftrap en plek aan te passen. Handlers gedeeld in `koppelWedstrijdInfo` (teams-hub.js), nu ook op de desktop-wedstrijdkaart (was alleen-lezen). Toernooien tonen het blok ook.
- `state.js` niet aangeraakt (`S._clubgids`).
- **Rules:** nieuwe regel `clubgids` (lezen: ingelogd; schrijven: niemand). Scenario toegevoegd aan `tests/rules.test.mjs`; **niet in deze omgeving gedraaid** (emulator-download geblokkeerd) — draai `npm run test:rules` op je pc.
- **Deploy:** `firebase deploy --only firestore:rules,functions:sportlinkSyncNu,functions:syncSportlink --project cluppie-ad329`, daarna "Sync nu" (vult de gids), dan mergen.

## Release 20261012g — spelers uit Sportlink + wedstrijdinfo op desktop
- **Spelers uit Sportlink** (mockup goedgekeurd 12-10): knop "Uit Sportlink" bij Selectie (mobiel en desktop), alleen als de club een Sportlink-koppeling heeft. Nieuwe callable `sportlinkTeamSpelers` haalt `team-indeling` op en geeft alleen voornamen (achternaam alleen als de club die vastlegt) van zichtbare spelers terug; afgeschermde leden worden geteld, staf/lidnummer/contact/foto/geslacht nooit. Coach kiest wie erbij komt; dubbelen grijs (`markeerBestaand`, getest). Geen nachtelijke sync. Zie `AVG.md` → Sportlink-gegevens.
- **Wedstrijdinfo:** op desktop bij Aanwezigheid over de volle breedte (stond in een spelerstegel). Bij een gespeelde wedstrijd geen lege tijdvakjes meer, wel de uitleg dat invullen en delen bij komende wedstrijden kan.
- **Deploy:** `firebase deploy --only functions:sportlinkTeamSpelers --project cluppie-ad329` en `gcloud run services add-iam-policy-binding sportlinkteamspelers --region=europe-west1 --member=allUsers --role=roles/run.invoker --project=cluppie-ad329`. Daarna mergen.

## Release 20261012e — Training maken en Seizoensplanning
- **Training maken** (tab `trainingsmodule`, hub → Oefenstof): een complete training uit een eigen bibliotheek van 48 vormen (O8–O13). Regelgebaseerde planner kiest en controleert (duur, opbouw, voetbalecht ≥50%, thema ≥60%, geen wachtrijen, ruimte per speler, belasting, groepsgrootte); SVG-tekening per onderdeel; knoppen Druk/Moeilijkheid/Coachstijl; Wissel vorm; bewaren onder `teams/{id}/trainingsplannen` (alleen vorm-id's en minuten) en delen via WhatsApp. Werkt zonder AI.
- **Seizoensplanning** (tab `seizoensplan`): drie opbouwmodellen, parameters (data, vrije weken, trainingen per week, accent), concept-jaarlijn in blokken van 4–6 weken met uitleg, eerste weken uitgewerkt, wekelijks aanvullen. Bijsturing alleen als voorstel (min. 3 wedstrijdevaluaties, max. één per week, feiten + besluit gelogd in `…/seizoensplan/{seizoen}/voorstellen`). Optioneel AI-jaarvoorstel en AI-uitleg, altijd door code gevalideerd met terugval op de standaardopbouw.
- **Teamevaluatie:** optionele thema-check (ja/deels/nee) als er een seizoensplan is; veld `themaCheck` op `teamevaluaties`.
- **Functions:** `personaliseerTraining`, `seizoensVoorstel` in `functions/trainingsai.js` (geen namen of spelerdata naar het model; zelfde AI-limiet als de andere AI-functies).
- **Tests:** `tests/trainingsplanner.test.mjs` (1872 proefplannen), `tests/seizoensplan.test.mjs`, `tests/trainingsai.test.js`; alle in `npm test`. Bibliotheekbron: `tools/trainingsbibliotheek/` (bouwt `public/js/trainingsbibliotheek.js`).
- Geen wijziging in `state.js` en geen rules-wijziging (valt onder `/teams/{teamId}/{sub=**}`).

## Release 20261012d — Sportlink-wedstrijden per team ophalen (bugfix)
- **Probleem:** bij ASV O12-1 stonden alleen de wedstrijden t/m 12 september in Cluppie; rondes 4–6 en de oktoberwedstrijden ontbraken. Oorzaak: de sync vroeg `programma` en `uitslagen` clubbreed op, en Sportlink kapt die lijst af (bij een club met veel teams stopte het seizoensoverzicht half september). Live vastgesteld 12-10-2026: met `teamcode=361275` en hetzelfde venster komen alle zes O12-1-wedstrijden t/m 10 oktober wél terug.
- **Oplossing:** `syncClubSportlink` vraagt programma en uitslagen nu per gekoppeld team op (`teamcode` + `lokaleteamcode`, die de teamlijst nu ook bewaart). Afgelastingen blijft clubbreed (korte lijst). Twee Sportlink-calls per team per sync in plaats van twee per club.
- "Niet in Sportlink" werkt nu per team: is het programma van een team leeg of mislukt, dan wordt niets als verdwenen gemarkeerd.
- Test: `tests/sportlink-sync.test.js` bootst de afkapping na (clubbreed 1 regel, per team alles); 35 controles, drie ervan falen op de oude code.
- **Deploy:** `firebase deploy --only functions:sportlinkSyncNu,functions:syncSportlink --project cluppie-ad329`, daarna "Sync nu". Geen invoker nodig (bestaande functies).

## Release 20261012c — teamcode weg uit Teaminstellingen
- De kaart "Teamcode voor coaches" (code, kopiëren, handmatig wijzigen) is weg; "Coach uitnodigen" (persoonlijke link, 14 dagen) staat nu in de Coaches-kaart. Het vinkje "code volgt naam" bij teamnaam wijzigen staat er alleen nog als de club vaste codes aan heeft. Handleiding, rondleiding, hulp-antwoord en `functions/kennis.js` aangepast (kennis.js gaat mee bij de volgende deploy van `chatHulp`).
- Gekozen wedstrijdvorm ("8 tegen 8") was in het lichte thema onleesbaar (witte tekst): `.vxv-opt.aan` gebruikt nu `--ink`.

## Release 20261012b — logo op het uitnodigingsscherm
- Het scherm dat een coach ziet bij een uitnodigingslink (`?uitn=`) toont nu het Cluppie-logo boven de teamnaam (zelfde `login-logo` als het loginscherm); het 🏟-teken vóór de teamnaam is weg (`index.html`, `auth.js`). Alleen client, geen deploy van functions nodig.

## Release 20261012a — meer uit Sportlink
Mockup en impactanalyse goedgekeurd 12-10-2026. Alle Sportlink-velden live gecontroleerd met het ASV-ID (clubgegevens, teams, programma, afgelastingen, wedstrijd-accommodatie).
- **Club aanmelden met Client ID** (`club-aanmelden.js`, wizard stap 1 in `club-instellingen.js`, "Koppeling testen" in Instellingen → Sportlink in `club.js`; gedeeld: `sportlink-clubinfo.js`). Nieuwe callable `sportlinkClubInfo`: naam, clubcode, plaats, logo, tenuekleur → hex, aantallen teams. Banknummer, KvK, secretaris, telefoon en e-mail worden in `functions/sportlink-hulp.js` weggefilterd. Max 10 opzoekingen per gebruiker per uur (`ratelimiet/{uid}`, alleen functions). Dubbele club herkend op `sportlinkClubcode` (de nachtsync legt die bij bestaande clubs vast). Goedkeuren zet Client ID, logo en kleur op de club en haalt meteen de teamlijst op. District blijft handmatig: Sportlink geeft het niet mee.
- **Beker en oefen**: teamlijst bewaart alle poules (`poules[]`), bekerpoule (nieuwste ronde) in `teams/{t}/poule/beker`, wedstrijden krijgen `competitiesoort`. Stand & poule krijgt Competitie | Beker; pill Beker/Oefen in lijsten. (Bekerwedstrijden kwamen al binnen; reekswissels gingen al vanzelf.)
- **Afgelastingen** (bestaand probleem: een afgelaste wedstrijd verdween stil uit `programma` en bleef in Cluppie "te spelen"). Sync en nieuwe `checkAfgelastingen` (vr–zo elke 30 min, alleen binnen het venster, één call per club) zetten `status: 'afgelast'`; ingetrokken afgelasting → status weg. Komende wedstrijd die verdwijnt zonder afgelasting → `sportlinkWeg` ("Niet in Sportlink"). Nooit verwijderen. Programma-fout → niets als verdwenen markeren. Banner + badge op de teamhub (wegtikken per toestel), doorgestreept in lijsten, niet meer eerstvolgend, clubscherm Afgelasten toont `clubs/{c}/geheim/_afgelast`. Gedeelde logica in `wedstrijd-status.js` (zonder imports).
- **Wedstrijdinfo**: `info{accommodatie, veld, plaats, verzamel, vertrek, kleedkamer}` uit programma (alleen gevulde velden, merge); uitwedstrijden binnen 21 dagen ook `adres, plaatsAdres, telefoon, route` via `wedstrijd-accommodatie`, gecachet per sportpark in `accommodaties/{sleutel}` (180 dagen, alleen functions). Scheidsrechternaam bewust niet opgeslagen (vaak minderjarig). Coach kan verzamel-/vertrektijd zelf zetten (`infoEigen`, gaat voor). Blok bij Presentie wedstrijd en op de desktop-wedstrijdkaart; delen met ouders via WhatsApp zonder spelernamen.
- `state.js` niet aangeraakt (runtime: `S.pouleBeker`, `S._pouleBron`, `S._wsTijdOpen`, `S._clubWedAfgelast`).
- Tests: `tests/sportlink-meer.test.mjs` (22) en `tests/sportlink-sync.test.js` (33, echte sync tegen nep-Sportlink en nep-Firestore); `tests/fake-firestore.js` kent nu `>=`/`>`-queries, `collection().doc()` en `batch.set/update`. Schermen gerenderd op 414×896 (donker) en desktop 1440 met de echte modules, zonder consolefouten.

### Deploy (vóór het mergen, project `cluppie-ad329`)
1. `cd functions && npm install`
2. `firebase deploy --only functions:sportlinkClubInfo,functions:checkAfgelastingen,functions:sportlinkSyncNu,functions:syncSportlink,functions:meldClubAan,functions:beoordeelClubAanmelding --project cluppie-ad329`
3. `gcloud run services add-iam-policy-binding sportlinkclubinfo --region=europe-west1 --member=allUsers --role=roles/run.invoker --project=cluppie-ad329`
4. Geen rules-deploy nodig: `accommodaties` en `ratelimiet` hebben geen regel en zijn dus dicht voor de app.
5. Mergen; daarna één keer "Sync nu" bij een club met Sportlink, zodat beker, info en afgelastingen gevuld zijn.
6. Kosten: `checkAfgelastingen` is de vierde Cloud Scheduler-taak (eerste drie gratis, daarna ongeveer € 0,10 per maand).

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
| 2026-10-12 | Vaste afmelding: speler terugkerend afmelden voor training (ASV'33 PR #5, release 20261012a) | **gepoort** (release 20261013a) |
| 2026-10-10 | Platformscherm "Platform: alle clubs" (`js/platform.js`, alleen platformbeheerder): alle clubs met teams, leden, admins en wachtende aanvragen, club openen. Loginscherm en opstartscherm tonen altijd het neutrale Cluppie-logo (release 20261010f) | **klaar** |
| 2026-10-10 | Alle ASV-verwijzingen uit de app gehaald: schild, legacy-shim, seed-teksten, over.html, voorbeelden en wijzigingenlijst (release 20261010e) | **klaar** |
| 2026-10-10 | Nieuw Cluppie-logo (open C met bal): app-iconen, favicon (`icons/icon.svg`), laad- en loginscherm, `over.html` (release 20261010d) | **klaar** |

Twee typefouten in de nieuwe ASV'33-code zijn hier meteen hersteld (ontbrekend `"` in `aria-label` van `#presentieLater`; los `"` in "Geen toekomstige afmeldingen"). Zet die ook recht in ASV'33.

Ontbrekende modules uit de repo toegevoegd (werden wel overal geimporteerd): `firebase.js`, `icons.js`, `thema.js`, `pwa.js`, `opkomst.js`, `leerinhoud.js`. `updates.js` is dode code en bewust niet meegenomen.

Harde ASV-teksten naar de clubinstellingen: onboarding-stap kompas, handleiding (teamcode-voorbeeld, beleidsplannaam), leerlijn-badge, speler/evaluatie-teksten, radarkleuren in desktop-stats (volgen nu `--accent`).

Structuur (08-10): app in `public/`, oud fase-1-skelet in `_fase1-backup/`, datamodel = dat van de app (zie `functions/LEESMIJ-deploy.md`). AVG en onboarding: zie `AVG.md`.

## Release 20261010h — districten en kalenders
- `clubconfig.js`: `DISTRICTEN` (noord, oost, west1, west2, zuid1, zuid2; oude waarde `zuid` blijft werken als zuid1), `kalenderId(seizoen, district)`. `zetKalender` volgorde: platformkalender `kalenders/{seizoen}_{district}` (huidigSeizoen van de club, daarna seizoen van vandaag) → ingebouwd (alleen Zuid, 2026/'27) → club-eigen `clubs/{id}/kalender/huidig` gaat altijd voor. Zuid I en II delen de kalender (id eindigt op `_zuid1`).
- `platform.js`: knop "KNVB-kalenders per district beheren": matrix district × (dit en volgend seizoen), JSON plakken/uploaden, opslaan voor alle clubs.
- `firestore.rules`: nieuwe collectie `kalenders` (lezen: ingelogd, schrijven: platform). **Deploy: `firebase deploy --only firestore:rules --project cluppie-ad329`.**
- Wizard stap 4: platformbeheerder ziet alle clubs als kopie-bron; hint als er geen bronnen zijn.
- `functions/toegang.js`: `bevestigPrivacy` logt de echte fout (`logger.error`) en geeft een leesbare melding i.p.v. `internal`. **Deploy functions opnieuw.**
- Jaarlijks: voor augustus per district het volgende seizoen invoeren in het platformscherm; clubs pakken hem op zodra hun huidige seizoen overeenkomt.

## Release 20261010i — beleidsplan-import en desktopfix
- `styles.css` regel ~4398: `html.desk #view-team.dk-na` kreeg `!important display:block` ook zonder `.actief`, waardoor teaminstellingen onder het clubscherm bleven staan. Nu alleen met `.actief`.
- `functions/index.js`: nieuwe `analyseerBeleidsplan` (club_admin, AI-limiet/-schakelaar via `vereisAI`, stukken ≤14.000 tekens, geeft voorstellen voor leercurve/kompas/gouden regel). **Deploy functions.** Werkt pas als de Anthropic-limiet het weer toelaat.
- `public/js/club-beleidsplan.js` (nieuw): PDF/tekst → AI-analyse of handmatig splitsen op koppen → controleren → opslaan als concept in `clubs/{id}/content` (`bron:'beleidsplan-import'`). Knop in Club → Content.
- Bewust niet gebouwd: delen van plannen tussen clubs (vereist expliciete toestemming per club).

## Release 20261011a — geen assistent-rol meer
- Standaardrol is overal `coach` (functions `toegangInst`, clubconfig, wizard). Keuzelijsten voor rol uit Instellingen → Toegang verwijderd; bij bestaande assistenten staat een knop 'Maak coach'. De rol `assistent` blijft technisch in rules/functions bestaan voor oude data. **Deploy functions.**

## Release 20261011b — privacy-akkoord zichtbaar
- Nieuwe callable `privacyOverzicht` (alleen clubadmin; leest `privacyKennisname/{uid}` van alle leden/admins). In de coachlijst (Toegang & privacy) staat per persoon akkoord + datum, of 'nog niet bevestigd'/'oudere versie'. **Deploy functions; daarna per nieuwe functie invoker openzetten: `gcloud run services add-iam-policy-binding privacyoverzicht --region=europe-west1 --member=allUsers --role=roles/run.invoker --project=cluppie-ad329`.**

## Release 20261011c — Inzicht-cijfers en futsal-sleutel
- `functions/gebruik.js` (nieuw): `aggregeerGebruik` (callable, club_admin/coördinator) en `aggregeerGebruikNacht` (04:15 NL, alle clubs) vullen `gebruikstats/{clubId}` uit `navpaden` van de laatste 90 dagen, in precies de vorm die `club-inzicht.js` leest (teams, paginas, coaches, dag, heatmap plat, voorbereiding, wedstrijd, bron, periode). Index `navpaden(clubId, datum)` stond er al. Test: `node tests/gebruik.test.mjs`.
  **Deploy:** `firebase deploy --only functions:aggregeerGebruik,functions:aggregeerGebruikNacht --project cluppie-ad329`, daarna invoker openzetten: `gcloud run services add-iam-policy-binding aggregeergebruik --region=europe-west1 --member=allUsers --role=roles/run.invoker --project=cluppie-ad329`. Pas daarna de branch mergen (de wijzigingenlijst belooft werkende cijfers).
- `sportlink-sleutel.js`: zelfde verankering als `naamSleutel` op de server; "O13-1 Futsal" → `o131futsal`. Let op: een team dat in Cluppie bewust "… Futsal" heet en tot nu toe automatisch op het veldteam matchte, koppelt nu aan het futsalteam (zoals de nachtelijke sync al deed).
- Review en verbeterplan: zie `VERBETERPLAN.md`.

## Release 20261011d — verbeterplan uitgevoerd (zelfde branch/PR als 20261011c)
Alle onderdelen uit `VERBETERPLAN.md` zijn gebouwd. Cache-versie `cluppie-v20261011d`; alle gewijzigde modules en hun importeurs staan op `?v=20261011d` (gezet met `node tools/versie.mjs 20261011d`).

**Nieuw (client)**
- Platformdashboard (`platform.js`): breed scherm, KPI's, "Vraagt aandacht", stoplicht per club, filter/zoek, clubaanmeldingen goedkeuren. Valt terug op een basislijst zolang `platformOverzichtNu` niet gedeployed is.
- Startlijst "Aan de slag" op de club-hub (`startlijst.js`), teams uit Sportlink in één batch (`club-sportlink-import.js`), uitleg Client ID, verwerkersovereenkomst digitaal (`modalVerwerkersovereenkomst` in `club.js`, ook vanuit Toegang & privacy).
- Club aanmelden (`club-aanmelden.js`) op het startscherm, deelbare link `/?aanmelden`, knop op `over.html`.
- Seizoensovergang-assistent (`club-seizoen.js` + `verhuisSpelersSeizoen` in `teams-spelers.js`), knop in Instellingen → Algemeen.
- Clubkleur met contrastcheck en voorbeeld (identiteit + wizard), Instellingen basis/Geavanceerd, sjablonen publiceren/overnemen (Pedagogiek); de wizard kopieert niet meer vrij uit elke club.
- Weekbrief (`club-weekbrief.js`): tegel op de club-hub (per bouw) en knop op beide bouw-dashboards.
- Anonieme clubvergelijking (`club-vergelijk.js`): Inzicht → Vergelijk, opt-in via `instellingen.benchmark`.

**Nieuw (functions)** — `platform.js` (`platformOverzichtNu`), `aanmelding.js` (`meldClubAan`, `beoordeelClubAanmelding`, `meldNieuweAanvraag`), uitbreiding `gebruik.js` (nachtelijk ook platformoverzicht + vergelijking).

**Rules** — nieuw: `platformstats`, `clubAanmeldingen`, `mail`, `sjablonen`, `benchmark`; `gebruikstats` ook voor bouwcoördinatoren (`lezers`); clubbeheerder mag een team aanmaken zonder zelf lid te worden; `trainingToegang.vervaltOp` moet gelijk zijn aan die van de deel-link (beveiligingsfix).

### Deploy-volgorde (alles in project `cluppie-ad329`)
1. **Rules testen:** `npm install && npm run test:rules` (Java nodig; start de Firestore-emulator en draait `tests/rules.test.mjs`, 20 scenario's). Gedraaid op 11-10-2026 op Pauls pc: 20/20 groen (één testfout hersteld: de coach schreef dezelfde kleur als de admin, wat geen wijziging is).
2. **Functions:** `cd functions && npm install`, dan
   `firebase deploy --only functions:aggregeerGebruik,functions:aggregeerGebruikNacht,functions:platformOverzichtNu,functions:meldClubAan,functions:beoordeelClubAanmelding,functions:meldNieuweAanvraag --project cluppie-ad329`
   en per callable de invoker openzetten (zoals bij `privacyoverzicht`): `aggregeergebruik`, `platformoverzichtnu`, `meldclubaan`, `beoordeelclubaanmelding`.
3. **Rules en indexen:** `firebase deploy --only firestore:rules,firestore:indexes --project cluppie-ad329`.
4. **E-mail:** installeer de extensie *Trigger Email from Firestore* (collectie `mail`, SMTP van bijvoorbeeld Strato of SendGrid). Zonder extensie werkt alles, alleen gaan er geen mails uit.
5. **Mergen** naar `main` (GitHub Pages zet de client live).
6. Eén keer **Vernieuwen** in het platformscherm, zodat `platformstats/overzicht` direct gevuld is.

### Testen
`npm test` (9 suites: sleutel, gebruik, startlijst/stoplicht/vergelijking, aanmelding, seizoen, kleur, weekbrief, Sportlink-import) en `node tools/pariteit.mjs ../cluppieasv33` (moet "Gelijk" geven). Alle nieuwe schermen zijn met Playwright gerenderd op 414×896 en desktop met een nep-Firestore, zonder consolefouten.

(Open punten van deze release staan nu bovenaan onder *Open*.)

## Release 20261011e — overstap naar de EU (uitgevoerd 11-10-2026)
Gevonden bij de functions-deploy: Firestore `(default)` staat in `nam5` (VS), de standaard-bucket ook. Draaiboek en volgorde: **`MIGRATIE-EU.md`**. Kort:
- Firestore: `(default)` → tijdelijke database `cluppie-overzet` (EU) → `(default)` verwijderen en opnieuw aanmaken in `europe-west1` → terugkopiëren. Geen codewijziging nodig; een aparte EU-database kan niet, want Storage-rules lezen alleen `(default)`.
- Storage: nieuwe bucket `cluppie-ad329-eu` (`europe-west1`); `public/js/firebase.js` uploadt daar via `STORAGE_BUCKET`. De oude bucket gaat dicht (`storage.dicht.rules`, deploy-doel `oud`).
- `tools/migreer-eu.mjs`: kopie (Firestore recursief, alle subcollecties; bestanden met download-tokens; download-URL's herschreven) en controle.
- `privacy.html`: locaties kloppend gemaakt (Firebase Auth mogelijk buiten de EU, GitHub Pages als host); verouderde zin over de assistent-rol weg.
- Versie `20261011e` (firebase.js gewijzigd, dus alle modules opnieuw geversioneerd).
Uitgevoerd met `tools/overstap-eu.ps1`; `(default)` staat in `europe-west1`, bestanden in `cluppie-ad329-eu`, oude bucket dicht.

## Release 20261011f — O-namen, Sportlink-import automatisch, zwart clubscherm
- Weergave jongenscategorieën als O17 (`catLabel` in config.js); interne sleutels blijven JO17, dus geen datamigratie. Bestaande teamnamen ("JO11-1") blijven zoals ze zijn tot de coach ze hernoemt.
- Sportlink-import: gezamenlijk voorvoegsel van alle Sportlink-teamnamen wordt gestript (`voorvoegselUit`), zodat naam/categorie ook kloppen als de clubnaam afwijkt; 35+/45+ automatisch Senioren.
- Zwart clubscherm (permission-denied in renderClub): een id in `club.teams` van een niet-bestaand team liet de `documentId in`-query falen. Nu `teams-ophalen.js` (`teamsOpId`) met per-team terugval, en de clubbeheerder ruimt spook-ids op.
- **Rules deployen** (nieuw: niet-bestaand team mag gelezen worden, lekt niets): `firebase deploy --only firestore:rules --project cluppie-ad329`. Zonder deploy werkt het scherm ook, maar wordt het spookteam niet opgeruimd.

## Release 20261011g — App Check aan (meten)
- reCAPTCHA Enterprise-sleutel in `firebase.js` (ReCaptchaEnterpriseProvider), niet op localhost. CSP (report-only) staat www.google.com/recaptcha toe.
- Sleutel geregistreerd in de console op 11-10-2026; Enforce staat nog uit (zie *Open*).

## Release 20261011h — overzetten en seizoensovergang alles-of-niets
- Nieuwe callable `zetSpelerOver` (`functions/overdracht.js`): schrijft eerdere dossiers, het nieuwe dossier, het spelerdocument bij het nieuwe team, de archivering van het origineel en (bij een uitlening) het opruimen van het leen-record in één Firestore-transactie. Lukt iets niet, dan verandert er niets; opnieuw aanroepen wordt herkend (`alGedaan`).
- De app rekent het dossier nog zelf uit (alleen lezen) en stuurt het mee; de server leest het spelerdocument, de uitlening en een gekoppelde gast zelf en controleert rechten (uitleen: clubbeheerder of coördinator van de ontvangende bouw; seizoen: schrijfrecht op beide teams) en dat beide teams bij de club horen.
- `voerOverzettenUit` en `verhuisSpelersSeizoen` (`teams-spelers.js`) roepen de functie aan. Seizoensovergang: per speler alles-of-niets; valt de verbinding weg, dan zijn de eerste spelers helemaal over en de rest nog helemaal niet, en een tweede keer starten maakt het af.
- Test: `node tests/overdracht.test.js` (22 controles, in `npm test`). `tests/fake-firestore.js` voert transactie-writes nu pas na afloop uit, zoals echt.
- **Deploy vóór het mergen**, anders werkt overzetten niet:
  `firebase deploy --only functions:zetSpelerOver --project cluppie-ad329`
  `gcloud run services add-iam-policy-binding zetspelerover --region=europe-west1 --member=allUsers --role=roles/run.invoker --project=cluppie-ad329`

