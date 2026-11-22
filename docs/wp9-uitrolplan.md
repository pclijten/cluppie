# WP9 — Uitrol: plan

16-11-2026. Plan. Contact met clubs doet Paul; dit document zegt wat er per fase klaar moet zijn en waar je op let.

## Fase 0: vóór de eerste club (nu)

| Wat | Stand |
|---|---|
| Beveiligingsfixes live | Gedaan (15-11) |
| Nagaan of de fouten uit de audit zijn gebruikt, en het besluit vastleggen | Open, Paul (zie `docs/juridisch/datalekprocedure-concept.md`) |
| Ingelogde schermen nalopen na de release van 15-11 | Open, Paul |
| Storage-regels testen | Open |
| App Check op afdwingen | Open, Paul. Stappen in `docs/appcheck-afdwingen.md`; voor de callables staat de schakelaar in de code (`functions/appcheck.js`), niet in de console |
| Verwerkersovereenkomst en privacyverklaring door een jurist | Open |
| Tweestapsverificatie voor het eindbaas-account | Niet nagegaan; aanbevolen |

## Fase 1: pilot met één club

**Doel:** elke rol is bezet en doorloopt zijn eigen werk een maand lang.

Bezetting: één clubadmin, één hoofd jeugd, twee bouwcoördinatoren, één trainingscoördinator, één coach gekoppeld aan een eigen bouw, en per bouw minstens twee coaches.

Wat je meet (staat al in de app, Inzicht en het platformcentrum):
- Doorloopt de clubadmin de startlijst zonder hulp? Bij welke stap vraagt hij iets?
- Hoeveel coaches loggen een wedstrijd, vullen aanwezigheid in, openen een training?
- Welke vragen komen er binnen, per rol.

Stoppen of bijsturen als: een coach gegevens ziet die hij niet hoort te zien; een rol zijn werk niet kan doen door een weigering; de club na twee weken nog op hulp van Paul wacht.

## Fase 2: vijf clubs

Pas starten als de pilot een maand zonder beveiligingsincident en zonder blokkerende fout draait.

Nodig:
- Aanmelden en goedkeuren zonder handwerk van Paul buiten het platformcentrum.
- Handleiding per rol (WP6).
- Een prijsafspraak (WP8).
- Een vaste manier om fouten te melden en terug te koppelen.

Let op verschil tussen clubs: met en zonder Sportlink, "Club stuurt" en "Trainers vrij", met en zonder eigen bouwen. Kies de vijf zo dat die varianten voorkomen.

## Fase 3: dertig clubs

Nodig vóór deze stap, en niet door Fable te vervangen:
- **Onafhankelijke pentest.** De opdracht om naar een tester te sturen ligt klaar als concept: `docs/pentest-opdracht.md`. De audit van november vond één kritieke fout die er maanden zat. Een tweede paar ogen is hier geen luxe.
- **Juridische eindcontrole** en een DPIA (gegevens van minderjarigen op schaal). Concept voor de adviseur: `docs/juridisch/dpia-concept.md`.
- **Kosten per club** bekend, zodat de prijs klopt.
- **Bewaartermijnen** in de app: vertrokken spelers en oude seizoenen opruimen. Gebouwd op 21-11-2026 (Club › Instellingen › Bewaartermijnen en opruimen); sinds 22-11-2026 lopen ook de privé-rondebeoordelingen, de teamkamer en de aanmeldingen voor trainingshulp mee (functie `bewaarOpruimen`, na deploy); nog te doen: met een echte club doorlopen.

Techniek om te bewaken: de nachtelijke taken (Sportlink-sync, gebruikscijfers) lopen over alle clubs; de limieten van Firestore-regels (1000 evaluaties per verzoek, zie de audit); het AI-budget.

## Losse trainers, parallel

Instroom via de deellink `?start=trainer` en de landingspagina. Volgen in het platformcentrum (Trainers). Per trainer die blijft: voorstellen om bij zijn club aan te sluiten als die meedoet.

Let op: AI voor losse trainers staat uit. Aanzetten is een kostenbesluit; er is een limiet per trainer, maar nog geen plafond voor alle trainers samen.

## Wat Fable in de uitrol kan doen

Fouten zoeken en herstellen, tests schrijven, schermen meten, teksten en handleidingen maken, cijfers uit het platformcentrum duiden. Wat niet: gesprekken met clubs, gebruikerstests met echte mensen, de pentest en het juridische eindoordeel.
