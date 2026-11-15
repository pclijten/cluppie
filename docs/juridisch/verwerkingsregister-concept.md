# Verwerkingsregister Cluppie (CONCEPT)

**Concept van een AI, afgeleid uit de code en `AVG.md`; niet juridisch getoetst.** Bedoeld als basis voor het register van Cluppie en als hulp voor clubs bij hun eigen register.

Verwerker en (voor accounts) verantwoordelijke: [handelsnaam Cluppie], contact paul@cluppie.io.

## A. Cluppie als verwerker voor clubs

| Verwerking | Betrokkenen | Gegevens | Wie heeft toegang | Bewaartermijn | Waar |
|---|---|---|---|---|---|
| Spelerslijst | Spelers | Voornaam, evt. achternaam, rugnummer, positie | Coaches van het team; sturende rollen van de club | Tot de club verwijdert | Firestore, EU |
| Notities en leerpunten | Spelers | Vrije tekst van de coach | Coaches van het team; sturende rollen van de club | Tot de club verwijdert | Firestore, EU |
| Aanwezigheid | Spelers | Aanwezig of afwezig met reden, vaste afmeldingen | Coaches van het team; clubadmin; coördinator van de bouw | Tot de club verwijdert | Firestore, EU |
| Wedstrijden en speeltijd | Spelers | Opstelling, wissels, minuten, doelpunten | Als hierboven | Tot de club verwijdert | Firestore, EU |
| Beoordelingen en evaluaties | Spelers | Scores per domein, toelichting | Als hierboven; privé-rondebeoordelingen alleen de schrijver en sturende rollen | Tot de club verwijdert | Firestore, EU |
| Uitleningen en overzetten | Spelers | Kopie van naam, nummer en open leerpunten; bevroren dossier bij overzetten | De twee betrokken teams; sturende rollen | Tot de club verwijdert | Firestore, EU |
| Delen met ouders | Spelers | Naam en rugnummer op een tijdelijke link | Wie de link heeft | Tot de link verloopt, daarna 30 dagen | Firestore, EU |
| Trainingen, video's, documenten | Coaches; soms spelers in beeld | Inhoud die de club uploadt | Leden van de club; trainingscoördinator (trainingen en video's) | Tot de club verwijdert | Firestore en bestandsopslag, EU |
| Toegangslog | Coaches | Wie is aangesloten, goedgekeurd, verwijderd; meekijken door Cluppie | Clubadmin; platformbeheerder | [vast te stellen] | Firestore, EU |
| Sportlink-koppeling | Spelers, clubs | Wedstrijdprogramma, uitslagen, sportparken; op verzoek voornamen van een team | Coaches van het team; clubadmin | Zolang de koppeling bestaat | Firestore, EU; bron Sportlink |
| AI-functies (alleen als aangezet) | Coaches, indirect spelers | Tekst zonder namen en contactgegevens; spelers als "Speler 1" | Anthropic verwerkt de aanvraag | Niet door Cluppie bewaard; [beleid Anthropic nagaan] | Verenigde Staten |

## B. Cluppie als verantwoordelijke

| Verwerking | Betrokkenen | Gegevens | Doel en grondslag | Bewaartermijn |
|---|---|---|---|---|
| Accounts | Coaches en andere gebruikers | Naam, e-mailadres, inlogmethode | Toegang tot de app; uitvoering van de overeenkomst | Tot het account wordt verwijderd |
| Logins | Gebruikers | Gebruikers-id, datum, tijd | Beveiliging en gebruik meten; gerechtvaardigd belang | 400 dagen |
| Gebruik en klikpaden | Gebruikers | Welke schermen, per sessie; uit te zetten in Mijn account | De app verbeteren; [grondslag vaststellen: gerechtvaardigd belang of toestemming] | 400 dagen |
| Kennisname privacyafspraken | Gebruikers | Gebruikers-id, versie, datum | Aantonen dat de afspraken zijn bevestigd | [vast te stellen] |
| Clubaanmeldingen | Contactpersoon van een club | Naam, e-mailadres, club, plaats | Een club aansluiten | [vast te stellen] |
| Overzicht losse trainers | Trainers zonder club | Naam, e-mailadres, aanmelddatum, laatste login, teamnaam, aantal spelers | Ondersteuning en uitrol | Zolang het account bestaat |
| Uitgaande e-mail | Ontvangers | E-mailadres, inhoud van het bericht, afleverstatus | Uitnodigingen, meldingen, wachtwoord herstellen | [vast te stellen] |
| Misbruikbeperking | Gebruikers | Tellers per account of adres (gehasht bij wachtwoord herstellen) | Beveiliging | Kort; [vast te stellen] |

## C. Ontvangers en subverwerkers

Google (Firebase), Anthropic (alleen AI), Strato (e-mail), GitHub Pages (uitleveren van de app), Google reCAPTCHA Enterprise (App Check), Open-Meteo (weer: alleen coördinaten en datum).

## D. Beveiligingsmaatregelen (samenvatting)

Scheiding per club in de toegangsregels, getest per rol; toegang op basis van rol; versleuteld transport; opslag in de EU; geheimen alleen aan de serverkant; namen uit AI-invoer gefilterd; toegangslog; tijdelijke toegang voor ondersteuning met logging.

## E. Open punten

1. Bewaartermijnen waar "[vast te stellen]" staat.
2. Automatisch opruimen van vertrokken spelers en oude seizoenen bestaat nog niet.
3. Verzoek van een ouder om inzage of verwijdering van één speler: nu handwerk door de coach of clubadmin.
4. Grondslag voor klikgedrag.
5. Of Firebase Authentication gegevens buiten de EU verwerkt, en welke waarborg daarbij hoort.
