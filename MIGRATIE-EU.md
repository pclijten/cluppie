# Overstap naar de EU (Firestore en Storage)

**Waarom.** De Firestore-database `(default)` van project `cluppie-ad329` staat in `nam5` (Verenigde Staten), en de standaard-bucket `cluppie-ad329.firebasestorage.app` ook. Privacyverklaring, `AVG.md` en de verwerkersovereenkomst beloven "gegevens in de EU". De functies draaien al in `europe-west1`.

**Waarom niet gewoon een tweede database.** Storage-rules kunnen alleen de `(default)`-database lezen (zie [Firebase: Storage rules conditions](https://firebase.google.com/docs/storage/security/rules-conditions), sectie Cloud Firestore). Een aparte EU-database zou alle uploads breken. Daarom:

- **Firestore:** `(default)` leegkopiëren naar een tijdelijke database `cluppie-overzet` (EU), `(default)` verwijderen, opnieuw aanmaken in `europe-west1` en terugkopiëren. De app en functies blijven `(default)` gebruiken; daar verandert geen code voor.
- **Storage:** een extra bucket `cluppie-ad329-eu` in `europe-west1`. De app uploadt daar voortaan naartoe (`STORAGE_BUCKET` in `public/js/firebase.js`). De oude bucket kan niet verhuizen en gaat dicht.

De app ligt tijdens stap 5 t/m 10 zo'n 15 à 30 minuten stil. Doe het op een rustig moment, niet rond 03:30–04:30 (dan draaien de nachtelijke functies), en niet op een wedstrijddag.

## Voorbereiden (kan nu, app blijft draaien)

1. **Inloggen voor het script** (eenmalig): `gcloud auth application-default login`
2. **Tijdelijke database** in de EU:
   `gcloud firestore databases create --database=cluppie-overzet --location=europe-west1 --type=firestore-native --project=cluppie-ad329`
3. **EU-bucket.** Firebase-console → Storage → ⋮ → *Add bucket* → naam `cluppie-ad329-eu`, locatie `europe-west1`. Via de Firebase-console, zodat Firebase-rules erop werken. Daarna lokaal de deploy-doelen koppelen:
   ```
   firebase target:apply storage eu cluppie-ad329-eu --project cluppie-ad329
   firebase target:apply storage oud cluppie-ad329.firebasestorage.app --project cluppie-ad329
   firebase deploy --only storage:eu --project cluppie-ad329
   ```
   Daarmee krijgt alleen de EU-bucket de gewone `storage.rules`. De oude bucket nog **niet** dicht doen.
4. **Proefkopie bestanden** (mag vaker; de bron wordt nooit gewijzigd):
   ```
   cd functions && npm install && cd ..
   node tools/migreer-eu.mjs storage --droog
   node tools/migreer-eu.mjs storage
   node tools/migreer-eu.mjs controle-storage
   ```

## Overstappen (rustig moment, ± 30 minuten)

5. **App op slot.** Firebase-console → Firestore (database `(default)`) → *Rules* → plak de regels hieronder → *Publish*. Coaches zien dan foutmeldingen in plaats van dat ze iets schrijven dat verloren gaat.
   ```
   rules_version = '2';
   service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }
   ```
6. **Kopie A** naar de tijdelijke EU-database, en controleren:
   ```
   node tools/migreer-eu.mjs firestore --van="(default)" --naar=cluppie-overzet
   node tools/migreer-eu.mjs controle --van="(default)" --naar=cluppie-overzet
   ```
   **Ga alleen verder bij "Gelijk".** Anders kopie A opnieuw draaien.
   Laatste bestanden meenemen: `node tools/migreer-eu.mjs storage` en `controle-storage`.
7. **`(default)` verwijderen** (vanaf hier is de tijdelijke database je enige kopie, die net gecontroleerd is):
   ```
   gcloud firestore databases update --database="(default)" --no-delete-protection --project=cluppie-ad329
   gcloud firestore databases delete --database="(default)" --project=cluppie-ad329
   ```
   Wacht daarna minstens 5 minuten: een verwijderde database-ID is zo lang niet opnieuw te gebruiken.
8. **`(default)` opnieuw aanmaken in de EU**, eerst alleen de indexen (een nieuwe database staat standaard helemaal dicht; zo kan niemand schrijven tijdens kopie B):
   ```
   gcloud firestore databases create --database="(default)" --location=europe-west1 --type=firestore-native --project=cluppie-ad329
   firebase deploy --only firestore:indexes --project cluppie-ad329
   ```
   Lukt `create` niet ("already exists" of iets over de locatie), wacht dan nog 5 minuten. Blijft het mislukken, stop en stuur de melding; de gegevens staan veilig in `cluppie-overzet`.
9. **Kopie B** terug naar `(default)`, en controleren:
   ```
   node tools/migreer-eu.mjs firestore --van=cluppie-overzet --naar="(default)"
   node tools/migreer-eu.mjs controle --van=cluppie-overzet --naar="(default)"
   ```
10. **Rules en nieuwe app live:** eerst `firebase deploy --only firestore:rules --project cluppie-ad329`, dan de PR "Overstap naar de EU" mergen. Daarmee gebruikt de app de EU-bucket.
11. **Functies opnieuw deployen**, zodat de Firestore-trigger aan de nieuwe `(default)` in `europe-west1` hangt:
    `firebase deploy --only functions --project cluppie-ad329` (vanuit de map `functions`)
12. **Oude bucket dicht:** `firebase deploy --only storage:oud --project cluppie-ad329` (rules `storage.dicht.rules`).
13. **Testen:** inloggen, een team openen, een training met video of PDF openen (oude links moeten werken), iets uploaden, Platform → Vernieuwen.

## Opruimen (na een week zonder problemen)

- Tijdelijke database weg: `gcloud firestore databases delete --database=cluppie-overzet --project=cluppie-ad329`
- Bestanden in de oude bucket weg (Firebase-console → Storage → oude bucket → alles selecteren → verwijderen).
- In de Firebase-console bij *Project settings* nagaan dat er nergens meer `nam5` of `us-` staat.

## Wat er technisch verandert

| Onderdeel | Voor | Na |
|---|---|---|
| Firestore `(default)` | `nam5` (VS) | `europe-west1` (België) |
| Bestanden | `cluppie-ad329.firebasestorage.app` (VS) | `cluppie-ad329-eu` (België); oude bucket dicht |
| Download-links in documenten | wijzen naar oude bucket | herschreven door het script; tokens gaan mee, links blijven werken |
| Code | — | `public/js/firebase.js`: `STORAGE_BUCKET`; `firebase.json`: storage-doelen `eu` en `oud` |
| Inloggen (Firebase Auth) | Google, wereldwijd | ongewijzigd; staat zo in de privacyverklaring |
