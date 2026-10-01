# PORTEREN.md — open punten multi-tenant (fase 2: Firebase + Cloud Functions)

Fundament (fase 1, client) is klaar: alle clubwaarden staan in `clubs/{id}.instellingen` en zijn in de browser instelbaar
(Club → Instellingen; wizard "Nieuwe club"). Zonder wijziging blijft ASV'33 werken via de legacy-shim in `clubconfig.js`
(knop "Waarden vastleggen" schrijft de ASV-waarden expliciet weg).

## Firestore rules (nog te doen)
- `clubs/{id}`: clubbeheerders (admins) mogen `instellingen` schrijven; niet-leden geen lees/schrijf.
- `clubs/{id}/kalender/huidig` en `clubs/{id}/content/*`: lezen voor leden van de club, schrijven voor clubadmin.
- `platform/instellingen` (veld `beheerders`): lezen voor ingelogde gebruikers, schrijven alleen handmatig/console.
- Aanmaken van clubs/teams alleen door platformbeheerder (client-gating bestaat al via `isPlatformBeheerder()`, rules moeten dit afdwingen).
- Logo staat nu als data-URL in het clubdocument (klein gehouden); eventueel later Storage + rules.

## Cloud Functions (nog te doen)
- `syncNu`/nachtelijke sync: `sportlinkClientId` per club uit clubdocument lezen; per club controleren.
- `teamSleutel()` in `functions/index.js` moet gelijk lopen met `slTeamSleutel()` in `club.js` (nu nog vast ASV-voorvoegsel strippen; generiek maken met clubnaam/afkorting).
- AI (`structureerTraining`, `chatHulp`, `genereerVerslagAI`): `instellingen.ai.aan` en `maandLimiet` afdwingen server-side; prompts parametriseren met clubnaam/kompasNaam/beleidsplanNaam; geen spelersnamen in prompts (AVG).
- 400→503 foutmapping herstellen; prompt caching `chatHulp`; Node 20 → nieuwere runtime vóór oktober 2026.
- Anthropic API-limiet (t/m oktober 2026) blokkeert AI-functies.

## Bewust nog statisch
- Onboarding-, handleiding- en updateteksten noemen soms nog ASV-voorbeelden (bijv. "ASVJO11-1").
- `over.html`/`readme.html`, PWA-manifest en icons: één per domein, niet per club.
- Standaard-content (kompas-tips, leercurve-teksten) = ASV-beleidsplan; clubs kunnen een eigen kopie maken of "Cluppie-standaard" gebruiken.
- `firebase.js` project-id `cluppieasv33` (één Firebase-project voor alle clubs).

## Testen voor livegang
- Nieuwe club via wizard → team → speler → wedstrijd; controleer dat er geen ASV-namen/logo verschijnen.
- ASV'33 ongewijzigd controleren (dashboard, weer, planning, kompas).
