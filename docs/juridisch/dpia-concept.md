# DPIA Cluppie: concept

21-11-2026. **Concept, geschreven door een AI uit de code en `AVG.md`. Niet door een jurist of privacyadviseur gelezen.** Een DPIA (gegevensbeschermingseffectbeoordeling) is hier zeer waarschijnlijk verplicht: het gaat om gegevens van kinderen, op schaal, met beoordelingen van hun ontwikkeling. Dit concept is bedoeld om de adviseur werk te besparen, niet om het oordeel te vervangen. Waar iets tussen blokhaken staat, is het niet bekend of moet iemand kiezen.

Wie de DPIA moet doen: de club is verantwoordelijke voor de gegevens van haar spelers, Cluppie is verwerker. Een club kan deze tekst als basis gebruiken; Cluppie heeft hem zelf nodig om te kunnen aantonen dat het product "privacy by design" is, en voor de verwerkingen waar Cluppie zelf verantwoordelijke is (accounts, trainers zonder club).

## 1. Wat er gebeurt

| | |
|---|---|
| Doel | Jeugdtrainers en clubs helpen bij trainen, wedstrijden en de ontwikkeling van spelers |
| Betrokkenen | Spelers van ongeveer 6 tot 19 jaar; trainers en andere vrijwilligers; ouders (alleen als de teamkamer aan staat) |
| Gegevens van spelers | Voornaam, soms achternaam, rugnummer, positie; aanwezigheid met reden van afwezigheid; opstelling, speeltijd, doelpunten; beoordelingen per domein (techniek, tactiek, fysiek, mentaal, gedrag) met toelichting; notities en leerpunten in vrije tekst |
| Bijzondere of gevoelige gegevens | Niet gevraagd. Wel mogelijk in vrije tekst en in "reden van afwezigheid" (ziek, blessure): dat kan iets over gezondheid zeggen. Video's waarop kinderen te zien zijn |
| Omvang | Nu [aantal] clubs; doel dertig clubs, ruwweg [aantal] spelers |
| Waar | Firestore en bestandsopslag in de EU (`europe-west1`). AI-aanvragen gaan naar Anthropic in de Verenigde Staten, zonder namen en contactgegevens, en alleen als de platformbeheerder AI voor die club heeft aangezet |
| Wie ziet wat | Zie `docs/rollenkaart.md`. Kern: een coach ziet zijn eigen team; sturende rollen van de club zien meer; de platformbeheerder ziet geen spelersnamen, behalve tijdens een gelogde ondersteuning van hoogstens twee uur |
| Bewaren | Sinds 21-11-2026 kiest de club een termijn (voorstel: vertrokken spelers één jaar na het seizoen van vertrek; drie seizoenen aan wedstrijden, aanwezigheid en beoordelingen) en ruimt de clubbeheerder op vanuit de app. Er wordt niets vanzelf gewist |

Het volledige overzicht per verwerking staat in `verwerkingsregister-concept.md`.

## 2. Noodzaak en evenredigheid

| Vraag | Stand | Te beoordelen |
|---|---|---|
| Grondslag voor de club | [Niet vastgesteld] | Uitvoering van het lidmaatschap of gerechtvaardigd belang voor spelerslijst, aanwezigheid en wedstrijden. Voor beoordelingen en leerpunten is dat minder vanzelfsprekend: is toestemming van ouders nodig? |
| Kinderen onder 16 | Spelers hebben zelf geen account, behalve in de teamkamer met een code van de eigen ouder (staat standaard uit) | Of die route voldoet als toestemming van de ouder |
| Dataminimalisatie | Achternamen zijn een keuze van de club; uit Sportlink komt alleen de voornaam; geen geboortedatum, adres, telefoon of foto van spelers | Of vrije tekst (notities, leerpunten) begrensd moet worden, bijvoorbeeld met een waarschuwing |
| Bewaartermijn | Zie hierboven | Of "de club kiest en ruimt zelf op" voldoende is, of dat opruimen vanzelf moet gebeuren; de termijnen zelf |
| Rechten van betrokkenen | Een gebruiker kan zijn eigen gegevens inzien en zijn account verwijderen. Voor één speler is er geen knop: de coach of clubbeheerder zoekt op en verwijdert met de hand | Of dat werkbaar is bij een verzoek van een ouder; wie het verzoek afhandelt |
| Informatie aan ouders | `privacy.html` bestaat; de aanvullingen in `LEESMIJ.md` zijn nog niet doorgevoerd | De tekst, en hoe ouders hem te zien krijgen (zij gebruiken de app meestal niet) |
| Verwerkersovereenkomst | Digitaal akkoord per club in de app; de tekst is een concept | De tekst; aansprakelijkheid |
| Doorgifte buiten de EU | Anthropic (alleen AI, zonder namen); mogelijk Firebase Authentication; reCAPTCHA | Welke waarborgen gelden en of dat in de documenten staat |

## 3. Risico's voor de betrokkenen

Kans en ernst zijn een eerste inschatting van de AI, geen oordeel.

| # | Risico | Gevolg voor een kind of ouder | Kans | Ernst | Wat er nu tegen gedaan is | Wat nog open staat |
|---|---|---|---|---|---|---|
| 1 | Een trainer van een andere club of een ander team leest beoordelingen of notities | Vertrouwelijke oordelen over een kind komen bij de verkeerde terecht | Laag tot midden | Hoog | Scheiding per club en per team in de rules, getest per rol; de audit van november vond en herstelde lekken | Onafhankelijke pentest; App Check afdwingen |
| 2 | Een account van een trainer wordt overgenomen | Als 1, voor een heel team | Midden | Hoog | E-mailadres moet bevestigd zijn; uitnodigingen verlopen | Tweestapsverificatie wordt niet afgedwongen |
| 3 | Beoordelingen blijven jaren staan en achtervolgen een speler | Een oordeel uit de O11 speelt mee in de O17, of blijft staan na vertrek | Hoog zonder beleid | Midden | Bewaartermijn per club met een opruimscherm | Het gebeurt niet vanzelf; privé-rondebeoordelingen kan alleen de schrijver wissen |
| 4 | Vrije tekst met gevoelige inhoud (gezondheid, thuissituatie, gedrag) | Gevoelige gegevens zonder grondslag, breed leesbaar binnen het team | Midden | Hoog | Notities van een ander team zijn alleen voor sturende rollen leesbaar | Geen waarschuwing of richtlijn in de app bij het invullen |
| 5 | Gegevens van kinderen gaan naar de AI-leverancier | Verwerking buiten de EU zonder dat ouders het weten | Laag | Midden | Namen, e-mail, telefoon en postcode worden vooraf weggehaald; AI staat per club standaard uit | Het filter haalt geen namen uit clubdocumenten in het Clubprofiel; beleid van de leverancier over bewaren nagaan |
| 6 | De platformbeheerder kijkt mee | Iemand buiten de club ziet spelersgegevens | Laag | Midden | Alleen op verzoek, hoogstens twee uur, gelogd, door de club uit te zetten | Staat nog niet in de privacyverklaring |
| 7 | Een link voor ouders komt bij de verkeerde | Naam en rugnummer van een team zichtbaar | Midden | Laag | De link draagt alleen naam en nummer en verloopt | |
| 8 | Ouders en kinderen in de teamkamer | Een kind met een account; ouders zien gegevens van andere kinderen | Midden | Midden | Elke mogelijkheid staat standaard uit en heeft een eigen schakelaar; toegang na goedkeuring door de trainer en met einddatum | Eerst deze DPIA afronden vóór de teamkamer bij clubs aan gaat (`AVG.md`) |
| 9 | Video's waarop kinderen staan | Beeld van een kind zonder toestemming van de ouders | Midden | Midden | Alleen leden van de club zien video's | Toestemming regelt de club; geen waarschuwing bij uploaden |
| 10 | Een datalek wordt niet of te laat gemeld | Ouders weten niet dat gegevens zijn uitgelekt | Laag | Hoog | Conceptprocedure | Niet vastgesteld; niet nagegaan of de fout van vóór 15-11 is misbruikt |
| 11 | Eén persoon beheert het platform | Bij uitval kan niemand ingrijpen of een verzoek afhandelen | Midden | Midden | | Vervanging en toegang regelen |

## 4. Maatregelen die uit deze DPIA volgen

Wat Cluppie kan doen, in volgorde van belang:

1. Onafhankelijke pentest (`docs/pentest-opdracht.md`) en App Check afdwingen (`docs/appcheck-afdwingen.md`).
2. Tweestapsverificatie voor platform- en clubbeheerders.
3. Een knop voor de clubbeheerder om bij een verzoek van een ouder de gegevens van één speler in te zien en te wissen.
4. Een korte richtlijn bij notities en leerpunten: geen gezondheid, geen thuissituatie.
5. Privé-rondebeoordelingen laten meelopen met de bewaartermijn. *Gebouwd op 22-11-2026 (functie `bewaarOpruimen`, nog niet live): de clubbeheerder wist ze samen met oude gegevens uit de teamkamer, na een telling en een bevestiging. Te beoordelen blijft of dit vanzelf moet gebeuren.*
6. De privacyverklaring aanvullen en ouders bereiken via de club.
7. Vervanging van de platformbeheerder regelen.

Wat de club moet doen: de grondslag en de termijn vastleggen in het eigen privacybeleid, ouders informeren, toestemming voor beeld regelen, en één keer per seizoen opruimen.

## 5. Wat er nog moet gebeuren voor dit een DPIA is

- Een privacyadviseur of jurist beoordeelt hoofdstuk 2 en 3 en stelt de restrisico's vast.
- De mening van betrokkenen: ten minste één club en een paar ouders. [Niet gedaan.]
- Besluit: is het restrisico aanvaardbaar, of is voorafgaande raadpleging van de Autoriteit Persoonsgegevens nodig?
- Vastleggen wie dit document beheert en wanneer het opnieuw wordt bekeken (bij de teamkamer, bij dertig clubs, bij elke nieuwe soort gegevens).
