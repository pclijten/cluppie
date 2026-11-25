# Clubevenementen (organisatiecomité): opzet en impactanalyse

25-11-2026. Analyse, geen code. Poort **P2**: na akkoord van Paul volgt een klikbare mockup (P3), daarna pas productiecode, achter een schakelaar die de eindbaas per club aanzet.

Vraag van Paul (25-11-2026): binnen een club zijn er clubbrede activiteiten, zoals een kersttoernooi, een pietentraining of een informatieavond. Een organisatiecomité regelt dat. Bedenk breed hoe alles wat al in Cluppie zit zo'n comité kan helpen, en bouw een organisatiedeel waarin je een evenement van begin tot eind regelt. Kijk naar de problemen die organisatoren tegenkomen, naar hoe de evenementenbranche zich met ICT laat helpen, geef draaiboeken voor verschillende evenementen, houd het flexibel (ieder zijn eigen methode) en maak alles exporteerbaar.

## In één alinea

Een nieuw onderdeel **Evenementen** op het clubscherm. Een comité maakt een evenement aan vanuit een draaiboeksjabloon (of leeg, of als kopie van vorig jaar). Cluppie rekent alle taken terug vanaf de datum ("6 weken vooraf: zaal vastleggen"), verdeelt ze over het comité en laat in één oogopslag zien wat achterloopt. Vrijwilligers schrijven zich in voor diensten via een open link, zonder account, zoals nu al bij Trainingshulp. Teams en ouders krijgen het bericht via de bestaande Berichten, de Teamkamer en de Planning. De velden worden geregeld via de Veldplanner (wijziging voor één dag). Op de dag zelf is er een live dagprogramma ("nu bezig, straks"). Na afloop een korte evaluatie die als les in het sjabloon van volgend jaar landt, zodat de kennis bij de club blijft en niet bij één vrijwilliger. Alles kan eruit: PDF, Excel/CSV, agenda (ICS) en een volledige back-up.

## Past dit bij de visie?

Ja. Het totaalplan zegt "simpel voor vrijwilligers, sterk op mobiel" en "bespaart tijd". Clubactiviteiten draaien nu op appgroepen, een Excel van de vorige voorzitter en het geheugen van één persoon. Het grootste probleem bij amateurclubs is niet het plannen zelf, maar dat de kennis elk jaar verdwijnt als het comité wisselt. Cluppie heeft al de mensen, de teams, de velden en de kanalen naar ouders: een comité hoeft niets opnieuw in te voeren.

## Wat organisatoren tegenkomen

Uit de branche (zie bronnen onderaan) en vertaald naar een amateurclub:

| Probleem | Hoe het er bij een club uitziet | Antwoord in Cluppie |
|---|---|---|
| Versnipperde informatie | Afspraken in WhatsApp, mail, een Excel en iemands hoofd | Eén evenementpagina: taken, mensen, programma, documenten, budget |
| Kennis verdwijnt | Nieuw comité begint elk jaar bij nul | Sjablonen + "kopie van vorig jaar" + evaluatie die terugvloeit in het sjabloon |
| Te laat beginnen | Zaal of Sint pas 2 weken vooraf gevraagd | Taken met terugplanning vanaf de datum en een signaal als iets te laat dreigt |
| Te weinig vrijwilligers | "Wie kan er helpen?" in de groep, niemand reageert | Diensten met tijdsblokken, open inschrijflink, per team een oproep, teller "nog 4 nodig" |
| Wie doet wat? | Taken blijven liggen omdat iedereen denkt dat een ander het doet | Elke taak één eigenaar, comitérollen met vaste taken |
| Communicatie naar teams en ouders | Te laat, te vaak, of via de verkeerde kanalen | Berichtenplanner: Berichten (coaches), Teamkamer (ouders), WhatsApp-tekst klaar |
| Velden, zalen, spullen | Botst met trainingen of wedstrijden | Veldplanner-dagwijziging + materiaallijst |
| Budget | Bonnetjes in een schoenendoos | Begroting en werkelijk per post, eenvoudig |
| Op de dag zelf | Draaiboek op papier, wijzigingen niet bekend | Live dagprogramma op de telefoon, wijziging is direct bij iedereen |
| Slecht weer, afmeldingen | Paniek op de ochtend zelf | Plan B in het draaiboek, één knop "plan B" die iedereen informeert |
| Veiligheid en vergunningen | EHBO, AED, kinderen ophalen, alcohol | Vaste veiligheidschecklist per evenementtype |
| Privacy | Namen en telefoonnummers in open lijsten | Alleen voornamen in open links, geen kindgegevens, bewaartermijn |
| Te veel losse tools | Elk comité kiest zijn eigen app | Alles op één plek, maar exporteerbaar voor wie toch Excel wil |

## Hoe de evenementenbranche ICT inzet

Professionele pakketten (Cvent, Zoho Backstage, PheedLoop, Bizzabo, Whova) en roostertools voor vrijwilligers (Inzetrooster/Shiftplanner, SignUpGenius) bieden grofweg:

1. **Planning en taken**: taken met deadlines, eigenaren en een portaal voor betrokkenen. Doel: weg van mail en spreadsheets.
2. **Run of show / dagprogramma**: een minuut-tot-minuutschema dat je met één klik publiceert; een wijziging staat meteen in app en web.
3. **Vrijwilligers- en dienstenroosters**: inschrijven op diensten, herinneringen, ruilen. Inzetrooster richt zich expliciet op sportclubs (o.a. hockey en voetbal).
4. **Aanmelden en inchecken**: aanmeldformulier, QR-code, inchecken zonder app.
5. **Communicatie**: berichten per doelgroep, polls, vragen.
6. **Na afloop**: automatische bedank- en evaluatievragen, en cijfers op één dashboard.
7. **AI**: agenda-voorstellen, een assistent die vragen beantwoordt, samenvattingen. De branche klaagt tegelijk over "te veel losse AI-tools".

Wat Cluppie anders en beter kan doen dan die pakketten: we kennen de club al (teams, coaches, ouders via de Teamkamer, velden), dus er hoeft niets ingevoerd te worden. En we richten ons op vrijwilligers die het één keer per jaar doen, niet op professionals: daarom sjablonen, terugplanning en het clubgeheugen in plaats van honderd instellingen.

## Wat Cluppie al heeft en hoe het meedoet

Gemeten op `main` (c735098).

| Wat er is | Waar | Rol bij evenementen |
|---|---|---|
| **Berichten** clubbeheerder → teams (`teams:[...]`, `zichtbaarTot`) | `berichten.js`, collectie `berichten` | Aankondigingen naar coaches van gekozen teams. Een evenement kan berichten vooraf inplannen. |
| **Teamkamer** (ouders en spelers: agenda, mededelingen, polls) | `kamer-app.js`, `teamkamer/{teamId}` | Evenement verschijnt in de agenda van ouders; poll "wie komt er?" per team. |
| **Trainingshulp** (open link zonder account, `hulpDeel/{id}/aanmeldingen`) | `lijst-hulp.js`, `hulp-boot.js` | Het bewezen patroon voor vrijwilligersdiensten: zelfde aanpak, eigen collectie. |
| **Lijstjes** (rijen × kolommen, veldpaden, delen via WhatsApp) | `teams-lijsten.js` | Deelnemerslijst per team ("wie doet mee aan het kersttoernooi", maat T-shirt). Een evenement kan een lijstje bij elk deelnemend team klaarzetten. |
| **Toernooitje** (schema, klok, scores, stand) | `teams-toernooi.js` | Kersttoernooi: het speelschema op de dag. Nu per team; voor een clubtoernooi met meerdere teams uit te breiden (release 4). |
| **Planning** (items met datum) | `teams.js planningItems()` | Evenement komt vanzelf in de Planning van deelnemende teams. |
| **Veldplanner** met dagwijzigingen | `veldplanner.js`, `veldwijzigingen/{datum}` | Velden en kleedkamers vastleggen voor het evenement; trainingen die vervallen zien teams direct. |
| **Afgelastingen** | `clubs/{id}/afgelastingen` | "Geen training vanwege de pietentraining" met dezelfde knop. |
| **Documenten** (club → teams) | `club.js`, `teams-documenten.js` | Draaiboek-PDF, plattegrond, inschrijfformulier bij het evenement. |
| **Mensen / rollen** | `club-mensen.js`, `rollen-bezetting.js` | Comitéleden kiezen uit bekende mensen; nieuwe rol "comitélid" per evenement. |
| **Aanwezigheid** | `teams-training.js`, `opkomst.js` | Inchecken van deelnemers op de dag (optioneel); telt niet mee in de trainingsopkomst. |
| **Video's en uitleg** | content, bibliotheek | Uitlegvideo bij een evenement (bijv. de pietentraining-oefeningen) of een korte instructie voor vrijwilligers. |
| **Tactisch bord / 3D-oefeningen** | `tactiekbord.js`, oefenkaart | Oefeningen voor een pietentraining of clinic als onderdeel van het programma. |
| **Hulp-chatbot / AI** (`platformModules.ai`) | `chatbot.js`, function `chatHulp` | Later: "maak een draaiboek voor een sinterklaasochtend met 80 kinderen". |
| **Eindbaas-schakelaars** | `platformModules`, `platform-maatwerk.js` | `platformModules.evenementen`, standaard uit. |

## Ontwerp

### Waar en voor wie

- **Club › Evenementen** (nieuwe tegel op de club-hub; alleen zichtbaar als de eindbaas het aanzet).
- **Clubbeheerder**: maakt evenementen, wijst het comité aan, ziet alles.
- **Comitélid** (nieuw, per evenement): werkt aan dat ene evenement. Kan iemand zijn die verder geen rol in Cluppie heeft (een ouder of kantinevrijwilliger): uitnodigen per mail, net als een coach.
- **Coach**: ziet het evenement in de Planning, vult het deelnemerslijstje van het eigen team.
- **Ouders en spelers**: zien het in de Teamkamer en kunnen zich via de open link als vrijwilliger opgeven.
- **Iedereen met de link**: alleen de vrijwilligersdiensten (voornamen), niets anders.

### Een evenement, van boven naar beneden

Eén scherm met tabbladen. Elk tabblad kan het comité aan- of uitzetten, zodat een infoavond niet vol staat met velden en toernooischema's.

1. **Overzicht**: aftellen (nog 23 dagen), stoplicht per onderdeel (taken, vrijwilligers, budget), "deze week te doen", wat achterloopt.
2. **Draaiboek (taken)**: fasen (voorbereiding, laatste week, de dag, afronding) met taken. Elke taak: eigenaar, deadline als "x dagen voor" of vaste datum, status, notitie, bijlage. Drie weergaven, zelf te kiezen: **lijst**, **bord** (te doen / bezig / klaar) en **tijdlijn**. Zo werkt ieder op zijn eigen manier.
3. **Dagprogramma (run of show)**: tijd, wat, waar, wie. Op de dag een **live-modus**: "nu" en "straks", en een vertraging van 10 minuten schuift de rest mee voor iedereen.
4. **Mensen**: comité met rollen (voorzitter, vrijwilligers, communicatie, inkoop, veiligheid, ...), wie doet wat.
5. **Vrijwilligers**: diensten (taak, tijd, plek, aantal nodig). Inschrijven via open link of Teamkamer. Teller "nog 4 nodig", oproep per team met één knop. Op de dag: aftekenen wie er is.
6. **Deelnemers**: welke teams of groepen doen mee; per team een lijstje klaarzetten; of een open aanmeldlink voor niet-leden (bijv. vriendjes bij de pietentraining).
7. **Locatie en spullen**: velden en kleedkamers via de Veldplanner, plattegrond met plekken (EHBO, kraam, ingang), materiaallijst met "wie neemt mee".
8. **Communicatie**: berichtenplanner met kant-en-klare teksten per moment (aankondiging 4 weken, herinnering 1 week, laatste info 1 dag). Kanalen: Berichten (coaches), Teamkamer (ouders), WhatsApp-tekst om te kopiëren.
9. **Budget**: begroting en werkelijk per post (inkoop, prijzen, huur), totaal en verschil. Geen boekhouding.
10. **Documenten**: bijlagen en links.
11. **Evaluatie**: na afloop drie vragen aan het comité (wat ging goed, wat beter, tip voor volgend jaar) en optioneel een poll in de Teamkamer. De tips worden aan het sjabloon gekoppeld.

### Flexibel: ieder zijn eigen methode

- **Starten** kan op vier manieren: leeg, uit een Cluppie-sjabloon, uit een eigen clubsjabloon, of als kopie van een eerder evenement (datums schuiven mee).
- **Alles is aan te passen**: fasen, taken, rollen, diensten en tabbladen. Een sjabloon is een startpunt, geen keurslijf.
- **Eigen sjablonen**: elk evenement kan "opslaan als clubsjabloon". Zo bouwt een club zijn eigen draaiboekenkast.
- **Drie weergaven** van dezelfde taken (lijst, bord, tijdlijn). Wie in Excel wil werken, exporteert en importeert.

### Vernieuwend (wat je in clubapps niet ziet)

1. **Terugplannen vanaf de datum**: taken staan als "42 dagen vooraf". Verschuift het evenement, dan schuift alles mee. Het overzicht waarschuwt als een taak dreigt te laat te komen.
2. **Clubgeheugen**: de evaluatie van dit jaar staat volgend jaar als tip bij de taak ("vorig jaar was de zaal al bezet, eerder bellen"). Het sjabloon wordt elk jaar beter, ook als het comité wisselt.
3. **Plan B met één knop**: per evenement een alternatief (binnen, andere datum, afgelast). De knop zet het alternatieve programma live en zet de berichten klaar.
4. **Live dagprogramma**: wie op het veld staat ziet op de telefoon wat nu en straks gebeurt; vertraging schuift mee.
5. **Slim vrijwilligers zoeken**: per team een oproep, met de teller in beeld; diensten die leeg blijven springen in het overzicht op rood.
6. **Koppeling met de club**: velden, trainingen die vervallen, Teamkamer-agenda, deelnemerslijstjes: geen dubbel werk.
7. **Later, met AI** (alleen als `platformModules.ai` aan staat): "Maak een draaiboek voor een pietentraining voor 80 kinderen op zaterdagochtend" levert een concept dat het comité aanpast; en "schrijf de herinnering voor ouders".

### Exporteren

| Wat | Vorm |
|---|---|
| Draaiboek (taken en dagprogramma) | PDF om te printen, Excel/CSV |
| Vrijwilligersrooster | PDF (per dienst, om op te hangen), CSV |
| Deelnemers | CSV (alleen wat nodig is) |
| Datum en dagprogramma | Agenda-bestand (ICS) |
| Budget | CSV |
| Hele evenement | JSON (back-up, overzetten naar een andere club, of opnieuw inlezen) |
| Sjabloon | JSON, zodat clubs draaiboeken met elkaar kunnen delen |

Importeren: taken uit CSV/Excel (eigen draaiboek van de club) en evenement of sjabloon uit JSON.

### Datamodel (alles nieuw, altijd `merge`)

```
clubs/{clubId}/evenementen/{evId}
  { naam, type: 'kersttoernooi'|'pietentraining'|'infoavond'|'eigen'|…, sjabloon, datum, start, eind,
    locatie, status: 'concept'|'bezig'|'geweest'|'geannuleerd', tabs: { taken:true, programma:true, … },
    comite: { [uid]: { rol, naam } }, uitgenodigd: { [mail]: { rol } },
    fasen: [{ id, naam, volg }],
    taken: { [taakId]: { fase, titel, eigenaar, dagenVoor | datum, status, notitie, tip, volg } },
    programma: [{ id, tijd, duur, wat, waar, wie }], vertragingMin,
    planB: { aan, tekst, programma? },
    budget: { [postId]: { naam, begroot, werkelijk } },
    teams: [teamId], veldwijziging: datum, deelId,
    evaluatie: { goed, beter, tip }, seizoen, gemaaktDoor, gemaaktMs, bijgewerktMs }

evenementDeel/{deelId}                 (open link, zoals hulpDeel; alleen wat een vrijwilliger mag zien)
  { club, clubNaam, evId, titel, datum, open, kamer,
    diensten: { [dienstId]: { naam, start, eind, plek, nodig } } }
evenementDeel/{deelId}/aanmeldingen/{id}
  { dienst, naam (voornaam), uid?, ms, door: 'link'|'kamer'|'comite', aanwezig? }

clubs/{clubId}/evenementSjablonen/{id}   (eigen clubsjablonen, zelfde vorm zonder datums en mensen)
```

- **Taken als map met veldpaden** (`taken.<id>.status`), zoals bij Lijstjes en het Toernooitje: twee comitéleden kunnen tegelijk werken zonder elkaars wijziging te overschrijven.
- **Eén document per evenement**: een groot toernooi met 150 taken en 60 programmapunten blijft ruim onder 1 MB.
- **Cluppie-sjablonen** staan in de code (`evenement-sjablonen.js`), zoals de sport-profielen; aanpassen kan zonder database.
- **Rules**: nieuw blok voor `evenementen` (clubbeheerder en comitéleden van dat evenement, alleen met de schakelaar aan), `evenementSjablonen` (clubbeheerder en comité lezen, beheerder schrijft) en `evenementDeel` (zelfde opzet als `hulpDeel`). Rules-tests erbij. Deploy via `deploy-alles.ps1` op Paul's pc.
- **Comitélid zonder andere rol**: nieuwe uitnodiging zoals bij coaches; deze persoon ziet alleen Club › Evenementen en de eigen evenementen. Dit raakt `toegang.js` en de rules en is daarmee het zwaarste deel; het kan in release 1 ook eerst alleen voor mensen die al in de club zitten (zie vraag 2).

### Privacy (AVG)

- Open links tonen alleen voornamen van vrijwilligers, geen telefoonnummers en geen kinderen.
- Deelnemers per team blijven in het lijstje van het team (bestaande regels); het evenement ziet alleen aantallen, tenzij de coach de namen deelt.
- Evenementen vallen onder de bewaartermijn van de club (`bewaartermijn-logica.js`): aanmeldingen verdwijnen na afloop + x maanden, het draaiboek en de evaluatie blijven (zonder namen).

### Schakelaar

`platformModules.evenementen` (Maatwerk en clubdetail in het platformcentrum), **standaard uit**. Uit = geen tegel, geen schrijfrechten (ook in de rules).

## Draaiboeksjablonen (eerste set)

Taken staan in dagen vóór de datum (D-42 = zes weken vooraf). Elk sjabloon heeft ook een dagprogramma, vrijwilligersdiensten, een materiaallijst, berichtteksten en een veiligheidschecklist. Hieronder de kern.

### 1. Kersttoernooi (jeugd, zaal of veld)
- **D-56** Datum en locatie vastleggen (zaal huren of velden via Veldplanner); comité en rollen verdelen; begroting.
- **D-42** Speelvorm en leeftijdsgroepen kiezen; aankondiging naar coaches (Berichten); deelnemerslijstje bij elk team klaarzetten.
- **D-28** Inschrijving sluiten; prijzen en versiering bestellen; vrijwilligersdiensten openzetten (scheidsrechters, kantine, opbouw, EHBO).
- **D-14** Schema maken (Toernooitje); kantine en inkoop regelen; ouders informeren via de Teamkamer.
- **D-7** Schema delen; vrijwilligersrooster rond; plan B (zaal/binnen) bevestigen; trainingen die vervallen afgelasten.
- **D-1** Opbouw, materiaal klaarzetten, laatste bericht.
- **De dag**: ontvangst, warming-up, rondes, prijsuitreiking, opruimen.
- **D+3** Bedankbericht, evaluatie, foto's, budget afronden.

### 2. Pietentraining / Sinterklaasochtend
- **D-49** Sint en pieten vastleggen (eigen leden of extern), datum afstemmen met de school-/feestagenda.
- **D-35** Doelgroep (O7–O9 en vriendjes?), aanmelding openzetten, cadeautjes/strooigoed begroten.
- **D-21** Oefeningen kiezen (pietenparcours, uit de oefenstof), vrijwilligers (pieten, begeleiders, schmink, foto).
- **D-14** Draaiboek aankomst Sint (route, muziek), toestemming foto's via ouders, allergieën strooigoed.
- **D-7** Indeling groepen, roulatieschema, materiaal, plan B bij regen (binnen/kantine).
- **De dag**: verzamelen, aankomst Sint, parcours in groepen, liedjes, cadeautjes, foto met de Sint.
- **Let op**: geen namen of foto's van kinderen in open links; toestemming beeldmateriaal.

### 3. Informatieavond (ouders, nieuwe leden, nieuw seizoen)
- **D-35** Doel en doelgroep, sprekers (bestuur, hoofd jeugd, coördinatoren), zaal/kantine.
- **D-21** Uitnodiging via Teamkamer en Berichten, aanmeldpoll (aantal), agenda.
- **D-10** Presentatie (beleidsplan en seizoensplan uit Cluppie), handouts, vragen vooraf verzamelen.
- **D-2** Herinnering, techniek testen (beamer, geluid), koffie.
- **De avond**: ontvangst, programma per spreker met tijden, vragen, afsluiting.
- **D+2** Presentatie en antwoorden delen (Documenten), evaluatiepoll.

### Daarnaast in de eerste set (korter)
- **Clubdag / open dag** (ledenwerving, clinics, kraampjes).
- **Seizoensafsluiting / slotdag** (ouder-kindwedstrijd, prijsuitreiking, barbecue).
- **Vrijwilligersavond** (bedanken, uitnodigingen, kosten).
- **Jeugdkamp / uitje** (vervoer, toestemmingen, noodnummers, overnachting).
- **Clinic of toernooi met gastclubs** (uitnodiging andere clubs, scheidsrechters, schema).
- **Leeg sjabloon** (vier fasen, geen taken).

## Releases (voorstel)

| Release | Inhoud |
|---|---|
| **1. Basis** | Schakelaar; Club › Evenementen; evenement aanmaken uit sjabloon/leeg/kopie; draaiboek met terugplanning en drie weergaven; dagprogramma; comité (mensen die al in de club zitten); documenten; export PDF/CSV/ICS/JSON; import CSV. |
| **2. Vrijwilligers** | Diensten, open link en Teamkamer, oproep per team, aftekenen op de dag, PDF-rooster. |
| **3. Koppelingen** | Planning en Teamkamer-agenda van deelnemende teams; deelnemerslijstje bij teams klaarzetten; Berichtenplanner; Veldplanner-dagwijziging en afgelastingen; live-modus en plan B. |
| **4. Slimmer** | Budget; evaluatie die terugvloeit in het sjabloon (clubgeheugen); eigen clubsjablonen delen; clubtoernooi met meerdere teams in het Toernooitje; comitéleden zonder andere rol; AI-concept (met `ai` aan). |

Release 1 is al bruikbaar zonder de rest: een comité kan het draaiboek beheren en exporteren.

## Vragen aan Paul

1. **Naam**: "Evenementen", "Activiteiten" of "Organisatie"? Advies: **Activiteiten** sluit het best aan bij hoe clubs het noemen ("activiteitencommissie"); in deze opzet staat nog "Evenementen".
2. **Comitéleden zonder rol**: moeten mensen die verder niets in Cluppie doen (ouder, kantinevrijwilliger) in release 1 al mee kunnen werken? Advies: nee, eerst met mensen die al een account in de club hebben (beheerders, coördinatoren, coaches), en in release 4 de nieuwe rol. Dat houdt release 1 klein en de rules eenvoudig.
3. **Ouders en spelers**: mogen evenementen in de Teamkamer verschijnen (agenda en vrijwilligersdiensten)? Advies: ja, maar per evenement aan te zetten door het comité.
4. **Toernooi met meerdere teams**: is het kersttoernooi bij jullie meestal binnen één team/leeftijdsgroep (dan volstaat het huidige Toernooitje) of clubbreed met meerdere teams en velden (dan uitbreiden in release 4)?
5. **Volgorde**: akkoord met de vier releases, of liever vrijwilligers (release 2) eerst, omdat dat bij de meeste clubs het grootste pijnpunt is?

## Advies

- Bouw het als één onderdeel met losse tabbladen die het comité aan- en uitzet, niet als losse modules: zo blijft een infoavond simpel en een toernooi compleet.
- Begin met het draaiboek en de terugplanning; dat is de kern waar alles aan hangt, en het werkt zonder koppelingen.
- Hergebruik het Trainingshulp-patroon voor vrijwilligers: bewezen, AVG-vriendelijk en zonder account.
- Maak het clubgeheugen (evaluatie → sjabloon) het verhaal naar clubs toe: dat lost het echte probleem op (kennis die verdwijnt) en dat doen de grote pakketten niet.
- Alles exporteerbaar vanaf release 1, zodat geen club het gevoel heeft vast te zitten.
- Niet mergen vóór de ASV-verhuizing zonder akkoord van Paul; de ASV'33-repo blijft onaangeroerd.

## Bronnen (geraadpleegd 25-11-2026)

- PheedLoop, "10 emerging event planning challenges in 2026": https://pheedloop.com/blog/10-emerging-event-planning-challenges-in-2026-and-how-to-solve-them
- Associations Now, "Event management in 2026: your job got bigger, but is your tech actually helping?": https://associationsnow.com/2026/06/event-management-in-2026-your-job-got-bigger-but-is-your-tech-actually-helping/
- Zoho Backstage, "The 9 biggest event management challenges": https://www.zoho.com/backstage/common-event-management-challenges.html
- Inzetrooster/Shiftplanner voor sportclubs: https://inzetrooster.nl/posts/396-get-your-sports-club-off-to-a-flying-start-with-shiftplanner

(PheedLoop en Zoho zijn leveranciersblogs; hun claims over functies zijn reclame, de opsomming van problemen komt overeen met de andere bronnen.)

## Stand van de bouw (25-11-2026)

Alle releases zijn gebouwd op deze branch, achter de schakelaar `platformModules.activiteiten` (standaard uit; de eindbaas zet hem per club aan in het Platformcentrum).

- **Comité-deel** (`activiteiten.js`, `activiteiten-logica.js`, `activiteit-sjablonen.js`): lijst, 9 draaiboeken, tabs Overzicht, Draaiboek (lijst, bord, tijdlijn, CSV inlezen), Dagprogramma (plan A/B, live met vertraging), Comité, Vrijwilligers, Deelnemers, Locatie en spullen, Communicatie, Budget, Documenten, Evaluatie (clubgeheugen, eigen clubdraaiboek, kopie voor volgend jaar). Export: PDF (draaiboek, rooster), CSV's, agenda (ICS), JSON.
- **Vrijwilligerslink** (`activiteit-boot.js`, `index.html?act=<id>`): inschrijven zonder account, alleen voornamen.
- **Teams**: Planning toont de activiteit, coach maakt met één knop een deelnemerslijstje (`activiteiten-team.js`).
- **Teamkamer**: trigger `kamerActiviteit` zet de activiteit in de agenda van ouders (alleen als het comité dat aanzet).
- **AI-concept**: callable `activiteitConceptAI` (alleen als AI én Activiteiten aan staan, zonder namen).

Live zetten (door Paul): `tools/deploy-alles.ps1` (Firestore-regels + functies `kamerActiviteit` en `activiteitConceptAI`), daarna versie ophogen met `tools/versie.mjs`.
