# WP8 — Marketing en verkoop

16-11-2026. Voorstellen. Er is niets gepubliceerd of verstuurd; de landingspagina is niet gewijzigd (behalve een foutje in de console, zie WP2).

## Positie ten opzichte van anderen

Bronnen: de eigen sites en app-pagina's van de aanbieders, opgezocht op 16-11-2026. Prijzen van anderen veranderen; controleer ze vóór je ze in een gesprek gebruikt.

| Aanbieder | Wat het is | Prijs volgens eigen opgave | Waar Cluppie anders is |
|---|---|---|---|
| **KNVB Rinus** | Online assistent-trainer: honderden oefeningen, kant-en-klare trainingsschema's, een seizoensplan per team, 2D- en 3D-beelden | Gratis | Rinus gaat over oefenstof voor de trainer. Cluppie verbindt training met wedstrijd, speeltijd, aanwezigheid en evaluatie, en met het plan van de club. Niet concurreren op aantal oefeningen. |
| **Spond** | Teamorganisatie: agenda, aanwezigheid, berichten, betalingen | Gratis; verdient aan transactiekosten bij betalingen | Spond regelt wie er komt en wie betaald heeft, vooral richting ouders. Cluppie gaat over wat er op het veld gebeurt. Ze kunnen naast elkaar bestaan. |
| **TeamSnap** | Teamorganisatie en clubadministratie, vooral Noord-Amerika | Gratis instap per team; clubs op offerte | Engelstalig en gericht op inschrijving en betaling. Geen Nederlandse jeugdvisie, geen Sportlink. |
| **Touchline Studio** | Trainingen plannen met AI, oefeningenbibliotheek, spelers volgen; iPad | App is gratis in de App Store; een betaald plan heb ik niet kunnen vinden | Engelstalig, voor de individuele coach. Geen club-laag. |

**Wat alleen Cluppie combineert:** Nederlandstalig; gebouwd rond de jeugdopleiding van de club (vijf domeinen, veertien leercurvethema's, speelstijl, seizoensplan per bouw); eerlijke speeltijd als vast onderdeel van de wedstrijd; koppeling met Sportlink; rollen voor de hele club (coach, bouwcoördinator, hoofd jeugd); gegevens in de EU en afgeschermd per club.

**Eerlijk over wat Cluppie niet doet:** geen betalingen, geen communicatie met ouders, geen ledenadministratie.

## Twee boodschappen

**Voor de losse trainer (instap).**
"Je team op orde in tien minuten. Opstelling, eerlijke speeltijd en een training die past, op je telefoon langs de lijn. Gratis voor je eigen team."
- Belofte: tijd besparen vóór en tijdens training en wedstrijd.
- Bewijs: de snelstart (vier stappen), Training maken, de speeltijdteller.
- Vervolgstap: "Doet je club ook mee? Dan neem je je team mee."

**Voor de club (bestuur, hoofd jeugd, clubadmin).**
"De jeugdopleiding van je club, digitaal op orde. Eén plan per bouw, zicht op wat er getraind wordt en hoe spelers zich ontwikkelen, zonder extra werk voor je vrijwilligers."
- Belofte: continuïteit (kennis verdwijnt niet als een trainer stopt), eerlijkheid (speeltijd), privacy.
- Bewijs: seizoensplan voor de hele club, evaluatierondes, Inzicht, Sportlink-koppeling, verwerkersovereenkomst.
- Vervolgstap: club aanmelden, of een gesprek.

## Prijsmodel (voorstel, beslissing aan Paul)

Uitgangspunten: de losse trainer is de instap en moet gratis blijven; een club betaalt voor wat de club-laag toevoegt; de prijs moet uit te leggen zijn in een bestuursvergadering; AI kost Cluppie per gebruik geld en hoort dus begrensd te zijn.

| Wie | Voorstel | Wat erin zit |
|---|---|---|
| Losse trainer | Gratis | Eén of meer eigen teams, alles wat geen club nodig heeft. AI alleen als de eindbaas het aanzet, met een maandlimiet. |
| Club, pilot | Gratis tot het einde van het seizoen | Alles, in ruil voor terugkoppeling. Sluit aan op het huidige aanbod (early adopters een half jaar gratis). |
| Club, daarna | Vast bedrag per seizoen, in twee of drie treden naar aantal jeugdteams | Alle club-onderdelen, Sportlink, ondersteuning. AI als aparte optie of met een limiet per maand. |

Waarom per seizoen en per trede, niet per gebruiker: een vereniging begroot per seizoen, en een prijs per coach straft clubs die veel vrijwilligers laten meedoen.

Wat ik niet kan invullen: de bedragen. Die hangen af van jouw kosten (Firebase, AI, je eigen tijd) en van wat clubs gewend zijn te betalen. De kosten per club zijn uit de Firebase-facturen en het AI-verbruik (`clubs/{id}/aiGebruik`) te halen zodra er een paar clubs draaien.

## Landingspagina: voorstel

De huidige `over.html` spreekt de club aan en noemt de trainer halverwege ("Ook als trainer alleen te starten").

Voorstel:
1. Bovenaan een keuze met twee knoppen: "Ik train een team" en "Ik zoek iets voor onze club". Elk leidt naar een eigen blok met de boodschap hierboven.
2. Een blok "Wat Cluppie niet doet", kort. Dat voorkomt verkeerde verwachtingen en onderscheidt van Spond.
3. Een blok privacy voor besturen: gegevens in de EU, afgeschermd per club, verwerkersovereenkomst, Cluppie ziet geen spelersnamen.

Dit verandert de pagina zichtbaar, dus eerst een mockup.

## Demo met fictieve data per rol

Nu: `index.html?demo` toont één coach met één team (O11-2). De link staat niet meer op de landingspagina.

Voorstel: de demo uitbreiden met de vaste fictieve club uit de rules-tests (FC Testdorp: O9-1, O11-1, O13-1, MO11-1, spelers "Speler 1" enzovoort) en een keuze "Bekijk als…" met de acht rollen. Dat dient drie doelen: verkoop (een bestuurder ziet het clubscherm), onboarding (een nieuwe coördinator ziet wat hij krijgt) en testen (de ontwerpmeting uit WP5 en rooktests per rol).

## Verkoopmateriaal (nog te maken)

- Eén pagina voor besturen (pdf): probleem, wat Cluppie doet, privacy, wat het vraagt van de club, prijs.
- Een stappenkaart voor de clubadmin: de zeven stappen van "Aan de slag".
- Een korte tekst die een trainer naar zijn jeugdcoördinator kan sturen.

In `marketing/` staat al een campagne voor de winterstop; die heb ik niet beoordeeld.

## Beslissingen voor Paul

1. Akkoord op de twee boodschappen?
2. Prijsmodel: per seizoen in treden, en welke bedragen?
3. Demo per rol bouwen? Die heeft de meeste opbrengst, ook voor WP5 en WP6.
