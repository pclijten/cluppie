# Verhuizing ASV'33 naar cluppie.io: draaiboek

ASV'33 draait nu in een eigen omgeving: site cluppieasv33.nl (repo `cluppieasv33`), Firebase-project `cluppieasv33`. Na de verhuizing is ASV'33 een gewone club in cluppie.io (project `cluppie-ad329`) en stuurt cluppieasv33.nl door naar www.cluppie.io.

Stand 22-11-2026: alles hieronder is gebouwd en getest in de emulator en in een browser. Er is nog **niets** gedraaid tegen een echt Firebase-project. Deel A en B zijn veilig; deel C (de echte verhuizing) pas na akkoord van Paul en een geslaagde proef.

## Wat er is

| Onderdeel | Bestand | Doet |
|---|---|---|
| Verhuisscript | `tools/verhuis-asv33.mjs` (regels in `tools/verhuis-asv33/logica.mjs`) | Kopieert accounts (zelfde account-id, wachtwoord en Google-koppeling), gegevens (zelfde document-id's) en bestanden (zelfde pad en downloadlink); richt de club in; controleert bron tegen doel |
| Clubsjabloon | `tools/verhuis-asv33/club-asv33.json` | Instellingen waarmee ASV'33 in cluppie.io werkt zoals nu: clubkleur, schild, ASV-kompas, oude codes blijven geldig, AI aan, Training maken en Seizoensplanning uit |
| Stil inloggen | `functions/verhuizing.js` (`verhuisLogin`), `public/js/verhuis-login.js` | Wie op het oude adres ingelogd was, is na het doorverwijzen meteen ingelogd op cluppie.io |
| Doorverwijzing | `tools/verhuis-asv33/doorverwijzing/`, `tools/verhuis-asv33/zet-doorverwijzing.mjs` | Pagina en service worker voor cluppieasv33.nl; behoudt `?team=`, `?club=`, `?deel=`, `?hulp=` en de rest van de link |
| Proef bekijken | `tools/verhuis-asv33/proef-server.mjs` | De app van cluppie.io op de eigen pc, verbonden met het proefproject |
| Tests | `npm test` (regels, `verhuisLogin`), `npm run test:verhuis` (van begin tot eind in de emulator) | |

Wat het script omzet: de collectie `content` van ASV'33 gaat naar `clubs/{clubId}/content`; veldfoto's van `veldfotos/{club}/…` naar `clubs/{club}/veldfotos/…`; links naar de oude bucket in documenten wijzen daarna naar de nieuwe. Anonieme sessies (ouders op een deel- of hulplink) en `trainingToegang` gaan niet mee: die ontstaan op het nieuwe adres vanzelf opnieuw. Had iemand al een cluppie.io-account met hetzelfde e-mailadres, dan blijft dat account bestaan en worden de gegevens van ASV'33 daaraan gehangen (het wachtwoord van cluppie.io blijft dan gelden).

## Wat trainers merken

- Ze openen cluppieasv33.nl (of de app op hun telefoon) en komen op www.cluppie.io uit, ingelogd, in hun eigen team.
- Eén keer het venster "Voordat je begint" (privacy). Dat is bewust niet voor hen ingevuld: het is hun eigen bevestiging.
- Wie de app op het beginscherm van de telefoon heeft gezet: het icoon blijft werken, maar opent voortaan cluppie.io in de browser. Opnieuw "Zet op beginscherm" vanaf cluppie.io maakt er weer een app van.
- Het stil inloggen werkt niet als het apparaat op het oude adres niet meer ingelogd was, of als de browser de opslag van het oude adres heeft gewist. Dan logt de trainer in met hetzelfde e-mailadres en wachtwoord, of met Google, zoals altijd.
- Cluppie.io heeft meer dan ASV'33 had (teamkamer, jaaroverzicht, speelwijze, snelstart). Training maken en Seizoensplanning staan in het sjabloon uit. Wil je er meer uit, dan kan dat per club in Platform › Maatwerk.

## Voorbereiding op de pc (eenmalig)

```
cd functions
npm install
cd ..
gcloud auth application-default login
gcloud auth application-default set-quota-project cluppie-ad329
```

Inloggen met het Google-account dat eigenaar is van beide projecten. Het script werkt daarna zonder sleutelbestanden. Alle opdrachten hieronder draai je in de map van de repo `cluppie`.

## Deel A: klaarzetten in cluppie.io (verandert niets voor bestaande clubs)

1. De pull request met dit draaiboek mergen. De website en de functie `verhuisLogin` gaan vanzelf live via de workflows.
2. `powershell -ExecutionPolicy Bypass -File tools\deploy-alles.ps1` draaien: zet de toegang (invoker) voor `verhuisLogin`.
3. De functie toestemming geven om inlogbewijzen te ondertekenen. Zoek de service-account van de functie op en geef hem de rol op zichzelf:

```
gcloud functions describe verhuisLogin --region=europe-west1 --project=cluppie-ad329 --format="value(serviceConfig.serviceAccountEmail)"
gcloud iam service-accounts add-iam-policy-binding <dat adres> --member="serviceAccount:<dat adres>" --role="roles/iam.serviceAccountTokenCreator" --project=cluppie-ad329
```

   Zonder stap 3 werkt alles, alleen het stil inloggen niet: trainers loggen dan één keer zelf in.

## Deel B: proef in een apart proefproject

Doel: zien dat alles overkomt en dat inloggen met het oude wachtwoord werkt, zonder cluppie.io aan te raken. Dat laatste kan alleen in een echt project, niet in de emulator.

1. In de Firebase-console een nieuw project maken (bijvoorbeeld `cluppie-proef`). Aanzetten: Authentication met E-mail/wachtwoord en Google, en Firestore (locatie `eur3` of `europe-west1`). Storage mag, hoeft niet.
2. De rules van cluppie.io erin zetten: `firebase deploy --only firestore:rules --project cluppie-proef`.
3. De proef draaien. Elke opdracht kan eerst met `--droog` (laat zien wat er zou gebeuren):

```
node tools/verhuis-asv33.mjs voorcontrole --naar=cluppie-proef
node tools/verhuis-asv33.mjs accounts     --naar=cluppie-proef
node tools/verhuis-asv33.mjs gegevens     --naar=cluppie-proef
node tools/verhuis-asv33.mjs club         --naar=cluppie-proef
node tools/verhuis-asv33.mjs controle     --naar=cluppie-proef
node tools/verhuis-asv33.mjs proef-akkoord --naar=cluppie-proef
```

   Met Storage in het proefproject ook `bestanden --naar=cluppie-proef --bucket=<bucket van het proefproject>` (vóór `club`). Zonder bucket blijven foto's en video's in de proef naar de oude omgeving wijzen; ze zijn dan wel zichtbaar.
   `proef-akkoord` vult het privacyvenster in voor alle accounts, omdat het proefproject geen functions heeft. Het script weigert dit op cluppie.io.
4. Bekijken: in de console van het proefproject bij Projectinstellingen › Jouw apps een web-app toevoegen, het blok `firebaseConfig` plakken in `.verhuis/proef-config.txt`, en bij Authentication › Instellingen › Geautoriseerde domeinen staat `localhost` al. Dan:

```
node tools/verhuis-asv33/proef-server.mjs
```

   Open http://localhost:5033 en log in met een ASV'33-account. Nalopen: teams en spelers, trainingen, video's en documenten, berichten, beoordelingen, een oude link `?team=<code>` en `?club=<code>`, een deellink van een training.
5. Meldt de voorcontrole dat de wachtwoorden niet leesbaar zijn, dan mist het ingelogde account het recht om ze te lezen. Geef het de rol Firebase Authentication-beheerder op `cluppieasv33`, of geef de hash-instellingen met de hand mee (`--hash-sleutel` enzovoort, uit Firebase-console › Authentication › ⋮ › Password hash parameters).

Na de proef kan het proefproject weg.

## Deel C: de echte verhuizing (pas na akkoord)

Kies een avond waarop niemand traint. Reken op een uur. Tot en met stap 6 is alles terug te draaien door de oude omgeving weer open te zetten.

1. **Melding** aan de trainers vooraf is niet nodig, maar een regel in de groepsapp ("vanavond tussen acht en negen even niet opslaan") voorkomt verloren werk.
2. **Oude omgeving op slot** (niemand kan daar nog iets openen of opslaan; trainers zien tot stap 7 dus een foutmelding als ze de app toch openen):
   `node tools/verhuis-asv33.mjs slot`
   Het script bewaart eerst de huidige rules in `.verhuis/`. Deze opdracht is gebouwd maar nog nooit tegen de echte dienst geprobeerd. Lukt hij niet: in de Firebase-console van `cluppieasv33` bij Firestore › Regels en Storage › Regels overal `allow write: if false;` zetten en de oude regels eerst kopiëren naar een tekstbestand.
3. **Kopiëren:**

```
node tools/verhuis-asv33.mjs voorcontrole --naar=cluppie-ad329
node tools/verhuis-asv33.mjs accounts     --naar=cluppie-ad329 --echt
node tools/verhuis-asv33.mjs gegevens     --naar=cluppie-ad329 --echt
node tools/verhuis-asv33.mjs bestanden    --naar=cluppie-ad329 --echt
node tools/verhuis-asv33.mjs controle     --naar=cluppie-ad329
```

   Bij `--echt` vraagt het script om het woord VERHUIS te typen. `controle` moet zonder verschillen eindigen; anders niet verder gaan.
4. **Club inrichten:** `node tools/verhuis-asv33.mjs club --naar=cluppie-ad329 --echt`. Vanaf hier weigert `gegevens` een nieuwe kopie, omdat die het werk van trainers in cluppie.io zou overschrijven.
5. **Zelf kijken:** op www.cluppie.io inloggen met een ASV'33-account en dezelfde punten nalopen als in de proef. In Platform staat ASV'33 nu tussen de clubs.
6. **Sportlink:** het clubdocument neemt `sportlinkClientId` mee. Controleer in Club › Instellingen dat de koppeling er staat, laat één keer met de hand syncen en vergelijk programma en uitslagen met de oude omgeving.
7. **Doorverwijzing aanzetten** (vanaf nu merken trainers het):

```
node tools/verhuis-asv33/zet-doorverwijzing.mjs <pad naar de werkmap van cluppieasv33>
```

   Het script zet de pagina's klaar in die werkmap en laat `CNAME` staan. Daarna in die map zelf committen en pushen naar `main`; GitHub Pages zet het binnen een paar minuten live. Het domein cluppieasv33.nl en de repo moeten blijven bestaan zolang de doorverwijzing nodig is.
8. **Functies van de oude omgeving uitzetten** (anders blijven `syncVoetbalNl`, `wedstrijddagCheck` en de rest draaien en mails sturen): in de Firebase-console van `cluppieasv33` de geplande functies verwijderen of pauzeren in Cloud Scheduler.

## Terugdraaien

- **Vóór stap 7:** `node tools/verhuis-asv33.mjs ontgrendel` (of de bewaarde rules terugzetten in de console). ASV'33 werkt dan weer als voorheen. Wat in cluppie.io is gekopieerd doet geen kwaad en kan later worden overschreven met een nieuwe run (`--opnieuw`).
- **Na stap 7:** in de repo `cluppieasv33` de commit met de doorverwijzing terugdraaien (`git revert`) en de oude omgeving ontgrendelen. Wat trainers intussen in cluppie.io hebben gedaan, staat dan niet in de oude omgeving. Daarom: na stap 7 alleen terug bij een echte storing.

## Daarna

- Het oude project `cluppieasv33` drie maanden op slot laten staan als reservekopie, daarna opruimen (dat is ook de AVG-afspraak: geen dubbele gegevens langer dan nodig).
- `verhuisLogin` stopt vanzelf op 1 juli 2027 (`EINDE` in `functions/verhuizing.js`). Daarna de functie, `public/js/verhuis-login.js` en de aanroep in `main.js` verwijderen.
- De pariteitscontrole (`tools/pariteit.mjs`) en het porten uit ASV'33 vervallen: er is nog maar één app.
