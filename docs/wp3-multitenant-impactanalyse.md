# WP3 — Multi-tenant fundament: impactanalyse

16-11-2026. Analyse, geen code. Bedoeld om te beslissen wat er nog gebouwd moet worden.

## Waar het model nu staat

| Onderdeel uit het plan | Stand in de code |
|---|---|
| Rules per club | Klaar en getest: 41 scenario's en 88 proeven per gebruikerstype (zie `docs/beveiligingsaudit.md`). |
| Sportlink per club | Klaar: client-ID per club in `clubs/{id}/geheim`, sync per team. |
| Clubinstellingen als config-laag | Klaar: `clubs/{id}.instellingen` (kleur, logo, namen van rollen, werkwijze, privacy, onderdelen) via `clubconfig.js`. |
| Schakelaars van de eindbaas | Klaar: `clubs/{id}.platformModules`, alleen door de eindbaas te schrijven. |
| Losse trainer | Klaar: team zonder `club`, met `eigenClub` voor naam en plaats. |
| Overstap losse trainer naar club | Gebouwd in twee routes: de eindbaas stelt een koppeling voor (20261111a), of de trainer meldt zelf zijn club aan en het team gaat mee (20261114a). De clubadmin keurt goed; team, spelers en wedstrijden gaan mee via `zetTeamNaarClub`. |
| Club-ID-first Firestore | **Niet zo gebouwd.** Teams, trainingen, video's, documenten en berichten zijn top-level collecties met een `club`-veld. |
| Evaluatiedomeinen als config | **Deels.** De vijf domeinen en de criteria staan in de code (`config.js`); clubs kunnen namen en inhoud aanpassen, niet het aantal. |

## Vraag 1: moet de database "club-ID-first" worden?

Dat zou betekenen: alles onder `clubs/{clubId}/…`. Voordelen: de club zit in het pad, dus rules worden korter en een lek tussen clubs is moeilijker te maken. Nadelen: elk team, elke training en elke speler moet verhuizen, losse trainers passen er niet in (geen club), en alle queries, listeners, functions en Storage-paden veranderen.

**Advies: niet doen.** Wat het moest opleveren is er al: scheiding per club, afgedwongen in de rules en bewezen met tests. De fouten die de audit vond zaten niet in het model maar in de regels zelf, en zijn dicht. Een verhuizing van alle data geeft maanden risico voor een verbetering die gebruikers niet merken. Wel doen:
1. Elke nieuwe collectie krijgt verplicht een `club`-veld en een proef in `tests/audit-rules.test.mjs` (mag wel, mag niet).
2. Documenten zonder `club`-veld opsporen en vullen (stond al open in PORTEREN.md).
3. `clubs/{id}.teams` als enige bron voor "dit team hoort bij deze club" op de server (sinds 20261115d in `clubRol`).

## Vraag 2: de losse trainer in het model

Nu: `teams/{id}` zonder `club`, trainingen onder `teams/{id}/trainingen`, AI via een eigen limiet per trainer (`aiGebruikSolo`).

Wat ontbreekt:
- **Geen eigen bibliotheek met video's of documenten**: alles in Storage staat onder `clubs/{id}/`. Bewust: opslag kost geld en er is geen clubadmin die toezicht houdt.
- **Bij de overstap gaat mee**: team, spelers, wedstrijden, presentie, evaluaties (alles onder het team). **Gaat niet mee**: het eigen seizoensplan als de club "Club stuurt" heeft (dan geldt het clubplan), en het AI-tegoed.
- **Terug naar los**: bestaat niet. Een clubadmin kan een team loskoppelen (rules staan dat toe), maar er is geen scherm voor en de coach houdt dan zijn clublidmaatschap.

Voorstel (kleine releases, elk met eigen rules-proeven):
1. Scherm "Team loskoppelen" voor de clubadmin, met uitleg wat de coach houdt en verliest.
2. Bij de overstap een overzicht voor de trainer: wat gaat mee, wat verandert (onderdelen die de club bepaalt).

## Vraag 3: evaluatiedomeinen per club

PORTEREN.md zegt: "Variabel aantal beoordelingsdomeinen (3 tot 6): pas als een club erom vraagt." Dat blijft het advies. De vijf domeinen en de veertien leercurvethema's zijn de pedagogische kern van Cluppie en de basis voor vergelijken tussen teams en seizoenen. Een club die een eigen model wil, kan namen en inhoud al aanpassen (coachmodel, speelstijl).

Als het er toch komt: domeinen opslaan per club met een vast id per domein, bestaande beoordelingen blijven op dat id staan, en de clubvergelijking gebruikt alleen de standaarddomeinen.

## Migratieplan en terugrolpad

Voor wat hierboven is voorgesteld is geen datamigratie nodig, behalve het vullen van ontbrekende `club`-velden. Daarvoor geldt:
1. Eerst tellen (alleen lezen): per collectie het aantal documenten zonder `club`.
2. Vullen met een script dat per document de oude waarde logt.
3. Terugrollen: het logbestand terugschrijven. Vooraf een export van Firestore maken (`gcloud firestore export`).

## Per gebruikerstype

| Gebruikerstype | Raakt dit? |
|---|---|
| Losse trainer | Ja: overzicht bij de overstap; mogelijkheid om terug te gaan. |
| Coach | Nee. |
| Gekoppelde coach bouw, bouwcoördinator, trainingscoördinator, hoofd jeugd | Nee. |
| Clubadmin | Ja: scherm om een team los te koppelen. |
| Eindbaas | Ja: telling van documenten zonder club in het platformcentrum zou handig zijn. |

## Beslissingen voor Paul

1. Akkoord dat "club-ID-first" niet gebouwd wordt?
2. Wil je "team loskoppelen" en het overzicht bij de overstap? Dan volgt een mockup.
