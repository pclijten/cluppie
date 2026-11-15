# Verwerkersovereenkomst Cluppie (CONCEPT)

**Concept van een AI, niet juridisch getoetst, niet gebruiken zonder jurist.** Velden tussen [haken] nog invullen.

## Partijen

1. **[Naam vereniging]**, gevestigd te [plaats], hierna "de Club" (verwerkingsverantwoordelijke);
2. **[Handelsnaam en rechtsvorm van Cluppie]**, gevestigd te [plaats], KvK [nummer], hierna "Cluppie" (verwerker).

## 1. Onderwerp en duur

1.1 Cluppie levert de Club een webapplicatie voor het begeleiden van (jeugd)teams. Daarbij verwerkt Cluppie persoonsgegevens in opdracht van de Club.
1.2 Deze overeenkomst geldt zolang de Club Cluppie gebruikt en eindigt wanneer alle gegevens van de Club zijn verwijderd of teruggegeven.

## 2. Welke gegevens, van wie, waarvoor

| Betrokkenen | Gegevens | Doel |
|---|---|---|
| Spelers (grotendeels minderjarig) | Voornaam, eventueel achternaam (keuze van de Club), rugnummer, positie, team; aanwezigheid; speeltijd, wissels, doelpunten; beoordelingen en leerpunten; notities van de coach | Teams begeleiden, eerlijke speeltijd, ontwikkeling volgen |
| Coaches en andere vrijwilligers | Naam, e-mailadres (voor inloggen), rol in de club, gebruik van de app | Toegang, samenwerking, ondersteuning |
| Ouders (via een gedeelde link) | Geen account; een tijdelijke, anonieme toegang | Een training of aanwezigheid inzien |

2.1 Cluppie raadt in de app af om gezondheidsgegevens vast te leggen. De Club ziet erop toe dat coaches dat niet doen.
2.2 Cluppie verwerkt de gegevens alleen voor de doelen hierboven en op schriftelijke instructie van de Club. Het gebruik van de app volgens de instellingen van de Club geldt als instructie.

## 3. Verplichtingen van Cluppie

3.1 **Geheimhouding.** Iedereen die namens Cluppie toegang heeft, is tot geheimhouding verplicht.
3.2 **Beveiliging.** Cluppie neemt passende maatregelen, waaronder: scheiding van gegevens per club, afgedwongen aan de serverkant; toegang per rol; versleuteld transport; opslag in de Europese Unie (Firestore en bestanden in `europe-west1`); een toegangslog per club; geautomatiseerde tests van de toegangsregels bij elke wijziging.
3.3 **Meekijken en helpen.** Cluppie kan op verzoek van de Club tijdelijk (maximaal twee uur per keer) als beheerder in de omgeving van de Club werken. Begin en einde worden vastgelegd in het toegangslog van de Club. De Club kan dit in de instellingen uitzetten. Zonder die modus heeft Cluppie geen toegang tot spelersgegevens.
3.4 **Hulp bij rechten van betrokkenen.** Cluppie helpt de Club bij verzoeken om inzage, correctie en verwijdering. Coaches kunnen hun eigen gegevens in de app inzien, meenemen en verwijderen.
3.5 **Datalekken.** Cluppie meldt een inbreuk die gegevens van de Club raakt zonder onredelijke vertraging en uiterlijk binnen [voorstel: 36 uur] na ontdekking aan de contactpersoon van de Club, met wat bekend is over aard, omvang en genomen maatregelen. De Club beslist over melding aan de Autoriteit Persoonsgegevens en aan betrokkenen.
3.6 **Audit.** De Club mag één keer per jaar de naleving laten controleren. Cluppie werkt mee en stelt de relevante informatie beschikbaar.

## 4. Subverwerkers

De Club geeft algemene toestemming voor de subverwerkers hieronder. Cluppie meldt een nieuwe subverwerker minstens 30 dagen vooraf; de Club kan bezwaar maken.

| Subverwerker | Waarvoor | Waar |
|---|---|---|
| Google (Firebase: database, bestanden, functies, inloggen) | Hosting van de gegevens | EU (`europe-west1`); inloggen mogelijk buiten de EU |
| Anthropic | AI-functies, alleen als die voor de Club aanstaan; namen en contactgegevens worden vooraf verwijderd | Verenigde Staten |
| Strato | Versturen van e-mail (uitnodigingen, meldingen) | EU |
| GitHub (Pages) | Uitleveren van de app zelf; geen clubgegevens, wel technische verbindingsgegevens | [nagaan] |

## 5. Doorgifte buiten de EER

Doorgifte vindt alleen plaats aan de subverwerkers in artikel 4 en op basis van [adequaatheidsbesluit / standaardcontractbepalingen: door jurist in te vullen].

## 6. Bewaren en verwijderen

6.1 Gebruiksgegevens (logins, klikgedrag) worden na 400 dagen verwijderd; verlopen deel-links na 30 dagen.
6.2 Spelersgegevens blijven staan tot de Club ze verwijdert. [Voorstel: uiterlijk één jaar na het einde van het seizoen waarin de speler is vertrokken.]
6.3 Na het einde van de overeenkomst verwijdert Cluppie alle gegevens van de Club binnen [30] dagen, of geeft ze op verzoek eerst terug in een gangbaar formaat.

## 7. Aansprakelijkheid

[Door jurist op te stellen. Aandachtspunt: Cluppie is een kleine onderneming; een beperking tot het bedrag dat de verzekering uitkeert of tot de vergoeding van een jaar is gebruikelijk, maar moet passen bij de AVG.]

## 8. Slot

8.1 Nederlands recht is van toepassing.
8.2 Bij strijd tussen deze overeenkomst en andere afspraken gaat deze overeenkomst voor, voor zover het persoonsgegevens betreft.

Contactpersoon privacy bij de Club: [naam, e-mail]. Contact bij Cluppie: paul@cluppie.io.
