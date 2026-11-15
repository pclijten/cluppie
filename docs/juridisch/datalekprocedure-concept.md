# Datalekprocedure Cluppie (CONCEPT)

**Concept van een AI, niet juridisch getoetst.** Termijnen tussen [haken] zijn voorstellen.

## Wat is een datalek

Elke gebeurtenis waarbij persoonsgegevens verloren gaan, of in handen komen van iemand die ze niet mocht zien of wijzigen. Ook als het per ongeluk gebeurt en ook als onduidelijk is of iemand er gebruik van heeft gemaakt.

Voorbeelden bij Cluppie: een fout in de toegangsregels; een coach die bij een verkeerd team is toegevoegd; een gedeelde ouder-link die verder is doorgestuurd; een gestolen telefoon waarop een coach is ingelogd; een uitgelekt wachtwoord van een beheerder.

## Stap 1: stoppen en vastleggen (direct)

1. Dicht het lek of beperk de toegang (regels aanpassen, account blokkeren, link intrekken).
2. Leg vast: wat is ontdekt, wanneer, door wie, en wat is er gedaan. Gebruik één document per incident, buiten de openbare repo.

## Stap 2: beoordelen (binnen [24 uur])

Beantwoord:
- Welke gegevens, van hoeveel personen, van welke clubs? Zijn het gegevens van kinderen?
- Wie kon erbij, en is er aanwijzing dat dat ook is gebeurd? Bronnen: het toegangslog per club, de logs van de functies, de wijzigingsdata van documenten.
- Wat kan iemand ermee? Namen en rugnummers wegen anders dan beoordelingen en notities.

## Stap 3: melden

| Wie | Wanneer | Door wie |
|---|---|---|
| De getroffen clubs (contactpersoon privacy) | Zonder onredelijke vertraging, uiterlijk [36 uur] na ontdekking | Cluppie |
| Autoriteit Persoonsgegevens | Binnen 72 uur na ontdekking, tenzij een risico voor betrokkenen onwaarschijnlijk is | De club voor spelersgegevens; Cluppie voor accountgegevens |
| Betrokkenen (ouders, coaches) | Zo snel mogelijk als het lek waarschijnlijk een hoog risico voor hen geeft | De club, met hulp van Cluppie |

De melding aan een club bevat: wat er is gebeurd, welke gegevens en hoeveel personen, wat Cluppie heeft gedaan, wat de club kan doen, en bij wie de club terecht kan.

## Stap 4: afronden

- Oorzaak wegnemen, en een test toevoegen die dezelfde fout voortaan vangt.
- Het incident opnemen in het interne register van datalekken, ook als er niet gemeld is, met de reden waarom niet.

## Toepassing: de fout in de toegangsregels van november 2026

Bij de beveiligingsaudit van 15-11-2026 is een fout gevonden waarmee elke coach het hele teamdocument kon schrijven, met een mogelijke route naar spelersnamen uit Sportlink van een andere club. De fout is dezelfde dag gedicht (`docs/beveiligingsaudit.md`, K1).

Nog te doen, door Paul:
1. Nagaan of de fout is gebruikt: zijn er teams met een `club`-veld die niet in de teamlijst van die club staan, of coaches in `leden` die niet via het toegangslog zijn toegevoegd.
2. Op basis daarvan beslissen of er iets te melden is, en dat besluit vastleggen. Is er geen aanwijzing van misbruik, dan is een melding mogelijk niet nodig, maar het besluit hoort in het register. **Laat een privacyadviseur hiernaar kijken.**

Hetzelfde geldt voor twee andere bevindingen uit die audit: een ouder met een gedeelde link kon de notities en leerpunten van alle spelers van het team lezen (H1), en elke coach van een club die van alle spelers van de club (H2). Beide zijn gedicht; of ze gebruikt zijn is niet uit de logs af te leiden, omdat leesacties niet worden gelogd.
