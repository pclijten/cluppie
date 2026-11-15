# WP6 — Beheer en onboarding per gebruikerstype

16-11-2026. Inventaris van wat er is, per rol, en wat ontbreekt. Er is in dit werkpakket niets gebouwd: elke aanvulling verandert schermen en vraagt dus een mockup.

## Eerste-keer-ervaring per rol

| Gebruikerstype | Wat er nu is | Wat ontbreekt |
|---|---|---|
| **Losse trainer** | Snelstart in vier stappen (uitleg, club en plaats, categorie, privacy), kaart Eerste stappen op het team, deellink `?start=trainer`. | Herkennen dat zijn club al Cluppie gebruikt en dan doorverwijzen naar aansluiten (stond open in PORTEREN.md). |
| **Coach, uitgenodigd** | Uitnodigingsscherm met logo en teamnaam, bevestigen van de privacyafspraken, rondleiding per hoofdstuk (`onboarding.js`: welkom, team, wedstrijden, opstelling, spelers en verder). | Een welkom dat past bij "ik kom via een uitnodiging": de kaart Eerste stappen is er alleen voor wie zelf een team start. |
| **Gekoppelde coach bouw** | Niets eigens. | Uitleg wat de koppeling betekent. Sinds 20261115d heeft hij de rechten van een bouwcoördinator in die bouw; dat staat nergens in de app uitgelegd. |
| **Bouwcoördinator** | Niets eigens; hij wordt aangewezen door de clubadmin en ziet daarna het bouwoverzicht. | Eerste-keer-uitleg: wat is mijn bouw, wat kan ik in de teams, hoe leen ik een speler uit, waar staat de weekbrief. |
| **Trainingscoördinator** | Eigen uitnodigingslink en eigen scherm. | Eén zin bij binnenkomst: alleen lezen, alleen trainingen en video's, geen spelers. |
| **Hoofd jeugdopleiding** | Niets eigens. | Uitleg van seizoensplan, speelstijl en evaluatierondes als één geheel. |
| **Clubadmin, nieuwe club** | Aanmeldformulier met Sportlink-ID, welkomstmail met zeven stappen, startlijst "Aan de slag" op de club-hub, wizard Nieuwe club, teams uit Sportlink in één keer. | Controleren of een clubadmin de zeven stappen zonder hulp doorloopt; dat kan alleen met een echte gebruiker (pilot, WP9). |
| **Eindbaas** | Platformcentrum met Vandaag doen, Uitrol in vijf fases, clubdetail met Meehelpen. | Geen. |

## Voorstel in volgorde van opbrengst

1. **Rolkaart bij eerste binnenkomst** voor bouwcoördinator, gekoppelde coach bouw, trainingscoördinator en hoofd jeugd: één kaart met drie regels ("Dit zie je", "Dit kun je", "Dit kun je niet") en een knop naar het belangrijkste scherm. Eén onderdeel, vier teksten. Vlag per gebruiker in `gebruikers/{uid}/meta/onboarding` (bestaat al voor de snelstart).
2. **Welkom voor de uitgenodigde coach**: dezelfde kaart Eerste stappen, met stappen die passen bij een bestaand team.
3. **Doorverwijzen als de club al meedoet** (losse trainer): een callable die op clubcode of naam en plaats alleen ja of nee teruggeeft, geen clubgegevens.

Teksten voor de rolkaarten (concept):

| Rol | Dit zie je | Dit kun je | Dit kun je niet |
|---|---|---|---|
| Bouwcoördinator | Alle teams van je bouw, en de spelerslijsten van de club | In de teams van je bouw alles wat een coach kan; spelers uitlenen; het seizoensplan van je bouw toewijzen | Beoordelingen en aanwezigheid van teams buiten je bouw bekijken |
| Gekoppelde coach bouw | De teams van je eigen bouw | Hetzelfde als een bouwcoördinator, voor die teams | Clubinstellingen wijzigen |
| Trainingscoördinator | De trainingen en video's van alle teams | Meekijken wat er getraind wordt | Spelers, wedstrijden of beoordelingen bekijken; iets wijzigen |
| Hoofd jeugdopleiding | Alle bouwen, het seizoensplan en de speelstijl | Het plan en de speelstijl van de club vastleggen, trainingen voor meerdere teams maken, evaluatierondes volgen | Clubinstellingen wijzigen (dat doet de clubadmin) |

## Handleiding en kennisbank per rol

De handleiding (`teams-handleiding.js`) en de kennisbank van de hulpchat (`functions/kennis.js`) zijn ingedeeld per onderdeel van de app, niet per rol. Ze beschrijven vooral wat een coach doet.

Voorstel: bovenaan de handleiding een keuze "Ik ben…" met de rollen, die de bestaande hoofdstukken filtert en per rol één hoofdstuk toevoegt met de tekst van de rolkaart hierboven. De kennisbank krijgt dezelfde vier alinea's. Let op de omvang: de kennisbank zit rond de grens waar prompt caching begint te werken (zie `docs/voortgang.md`, WP0); langer maken helpt daar zelfs bij.

## Beslissingen voor Paul

1. Akkoord op de rolkaart als eerste stap? Dan maak ik de mockup.
2. Klopt de tabel "Dit zie je / kun je / kun je niet" met hoe jij de rollen bedoelt? Die volgt de rules zoals ze nu live staan.
