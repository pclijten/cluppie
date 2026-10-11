# VERBETERPLAN cluppie.io — review 11 oktober 2026

Doorgelopen: de volledige `cluppie`-repo (client, functions, rules) naast `cluppieasv33` t/m release 2026-10-10.
Getoetst aan vier doelen: (1) trainers kunnen hetzelfde als in ASV'33, (2) onboarding duidelijk en makkelijk,
(3) clubs makkelijk personaliseren, (4) innovatieve functies, (5) een helder platformdashboard voor de eindbaas.

Werkwijze blijft: impactanalyse → mockup → akkoord → productie. Alles hieronder met een UI-impact komt dus eerst als mockup.

---

## 1. Trainers: gelijk aan ASV'33 — status: in orde

**Gecontroleerd**
- Alle ASV'33-releases t/m 2026-10-10 staan in de `UPDATES` van cluppie.io (presentie, achteraf bijwerken, verwachte speeltijd, speler-overdracht, lijstjes, evaluatierondes, assists/elftallen).
- Per gedeelde module (55 stuks) vergeleken welke functies/constanten in ASV'33 staan en niet in cluppie.io. Uitkomst: geen ontbrekende functionaliteit. De verschillen zijn bewuste multi-tenant-ombouw (`DOC_CATEGORIEN` → `config.js`/clubinstellingen, logins → `gebruik`-collectie, ASV-regex → `sportlink-sleutel.js`).
- 18 modules zijn identiek; de rest verschilt alleen door clubconfig.

**Risico:** porten blijft handwerk. Elke ASV-release kost een vergelijking en een kans op vergeten.

**Advies**
1. *Kort:* een vergelijkingsscript (`tests/pariteit.mjs`) dat bij elke port de functienamen en `UPDATES`-titels van beide repo's naast elkaar legt. Vandaag handmatig gedaan; als script kost het 15 minuten per port minder.
2. *Structureel (aanbevolen):* ASV'33 wordt de eerste tenant op cluppie.io zodra rules en functions getest zijn. Dan is er één codebase en verdwijnt porten. De clubconfig dekt nu alles wat ASV'33-specifiek was (kompas, beleidsplan, domeinen, kleuren).
3. Twee typefouten die bij het porten zijn hersteld staan nog in ASV'33 (`aria-label` van `#presentieLater`, losse `"` bij "Geen toekomstige afmeldingen").

---

## 2. Onboarding

### Wat er al goed is
- Coach: persoonlijke uitnodigingslink → aanvraag met goedkeuring → privacy-kennisname → interactieve rondleiding op de echte app.
- Club: wizard in 4 stappen (club, uiterlijk, koppeling, start) met kopie-bron en privacy-standaarden.

### Knelpunten
| # | Knelpunt | Gevolg |
|---|---|---|
| O1 | Alleen de platformbeheerder kan een club aanmaken | Bij 30 clubs ben jij de wachtrij; een geïnteresseerde club kan niets zelf |
| O2 | Na "Club aanmaken" staat de beheerder in een leeg dashboard | Geen idee wat de volgende stap is |
| O3 | Teams moeten één voor één (of via PDF) worden aangemaakt, terwijl de Sportlink-teamlijst al wordt opgehaald | Veel tikwerk, typefouten in teamnamen, daardoor Sportlink-mismatch |
| O4 | Sportlink Client ID: geen uitleg waar je die vindt | Stap 3 wordt overgeslagen; programma/uitslagen ontbreken |
| O5 | Geen melding bij een nieuwe aanvraag (open punt PORTEREN) | Coaches wachten dagen op goedkeuring |
| O6 | Verwerkersovereenkomst is een vinkje dat jij zet | Juridisch dun; de club accepteert niet zelf |

### Voorstel
- **Club aanmelden (O1, O6):** publieke aanmeldpagina → aanvraag in `clubAanvragen` → jij keurt goed in het platformscherm → de aanvrager wordt clubbeheerder en doorloopt zelf de wizard, inclusief het digitaal accepteren van de VO (versie + tijd + naam, zoals nu al opgeslagen).
- **Startlijst op de club-hub (O2):** kaart "Aan de slag" met voortgang: logo & kleur · Sportlink gekoppeld · teams aangemaakt · trainingsdagen ingevuld · eerste coach uitgenodigd · privacycontact ingevuld · beleidsplan geïmporteerd. Elke regel opent direct het juiste scherm. De bouwstenen bestaan al (`club-beheer.js` "aandacht nodig").
- **Teams uit Sportlink in één keer (O3):** na koppelen: lijst van alle Sportlink-teams met vinkjes en voorgestelde bouw op leeftijd → "Maak 14 teams aan". Koppeling staat dan meteen goed.
- **Uitleg Client ID (O4):** korte uitklapper: wie bij de club het heeft (ledenadministratie, via de Club.Dataservice in Sportlink Club) plus een kant-en-klaar berichtje om het op te vragen.
- **Meldingen (O5):** e-mail aan clubbeheerders bij een nieuwe aanvraag (Firebase Trigger Email-extensie of Cloud Function), max. één per dag gebundeld.

---

## 3. Personaliseren per club

### Wat er al goed is
Zeven tabbladen (identiteit, competitie, pedagogiek, lijsten, regels, AI, toegang), KNVB-kalender per district, beleidsplan-import met AI, "Cluppie-standaard" of kopie.

### Knelpunten
| # | Knelpunt |
|---|---|
| P1 | Clubkleur wordt alleen op formaat gecontroleerd; een geel of lichtgrijs accent maakt knoppen onleesbaar in het lichte thema |
| P2 | Je ziet het effect pas als je opslaat en rondklikt; geen voorbeeld |
| P3 | Zeven tabbladen met tientallen lijsten: een nieuwe clubbeheerder weet niet wat belangrijk is |
| P4 | Kopie van een andere club neemt diens leercurve-teksten en regels over. Dat is werk van die club; zonder toestemming geeft dat gedoe |
| P5 | Vaste 5 domeinen; clubs die met 4 hoofdlijnen (bv. KNVB) werken passen er niet in |

### Voorstel
- **Kleur met contrastcheck + live voorbeeld (P1, P2):** bij het kiezen direct een mini-voorbeeld (knop, tegel, spelerskaart) in licht én donker thema; bij te weinig contrast een automatisch donkerdere/lichtere variant voorstellen.
- **"Belangrijk / Geavanceerd" (P3):** bovenaan Instellingen de 6 dingen die elke club moet zetten; de rest achter "Geavanceerd".
- **Sjablonenbibliotheek i.p.v. clubkopie (P4):** platform-sjablonen (Cluppie-standaard, 4Skills, KNVB-leerlijn). Een club kan zijn eigen opzet *publiceren als sjabloon* (expliciete toestemming), pas dan kunnen anderen hem kiezen.
- **Domeinen 3–6 (P5):** radar en kaart variabel maken. Groot werk (radars, kaarten, stats); pas oppakken als een echte club erom vraagt.

---

## 4. Innovatieve functies

Uitgangspunt: bouwen op data die Cluppie al heeft, AVG-proof (geen spelernamen naar AI).

1. **Seizoensovergang-assistent** — "Nieuw seizoen" verandert nu alleen een label. Elke zomer schuiven clubs honderden spelers door. Voorstel: per team een voorstel voor het volgende seizoen (JO11-1 → JO12), spelers met hun ontwikkeldossier mee (de overdracht-functie bestaat al), coaches opnieuw toewijzen, oude teams archiveren. Dit lost het grootste jaarlijkse pijnpunt van een jeugdcoördinator op.
2. **Speeltijd-eerlijkheid over het seizoen** — "verwachte speeltijd" werkt per wedstrijd. Uitbreiden naar een seizoensmeter: wie zit structureel onder het teamgemiddelde, met een suggestie voor de volgende opstelling. Zichtbaar voor coach en (geaggregeerd) coördinator.
3. **Beleidsplan in de praktijk** — de beleidsplan-import is al uniek. Volgende stap: per team zichtbaar hoeveel van de leercurve-thema's dit seizoen in trainingen zijn behandeld, en per bouw waar thema's ontbreken. Het beleidsplan wordt meetbaar.
4. **Coördinator-weekbrief** — elke maandag één scherm per bouw: welke teams trainden zonder aanwezigheid, wie heeft al weken niet geëvalueerd, uitleningen, opvallende speeltijd. Regels, geen AI nodig; AI-samenvatting optioneel.
5. **Anonieme clubvergelijking (alleen mogelijk in multi-tenant)** — opt-in: "jullie coaches evalueren 2× zo vaak als gemiddeld". Alleen club-totalen, nooit teams of personen.

Volgorde: 1 (vóór zomer 2027 nodig), 4, 2, 3, 5.

---

## 5. Platformdashboard voor de eindbaas

### Nu
"Alle clubs" is een pop-up met een lijst: naam, aantal teams/leden/admins, wachtende aanvragen. Daarnaast de kalenderbeheerknop.

### Wat ontbreekt
Je ziet niet of een club *gezond* is: wordt de app gebruikt, is de koppeling in orde, is de privacy geregeld, kost AI geld?

### Voorstel: eigen scherm "Platform" (geen pop-up)
- **Bovenaan 4 kerncijfers:** actieve clubs (laatste 14 dagen) · actieve coaches · open aanvragen (clubs + coaches) · AI-gebruik deze maand t.o.v. budget.
- **Clubtabel met stoplicht per club:** activiteit (laatste gebruik, sessies 30 dagen), Sportlink (laatste sync ok/fout), privacy (VO, contactpersoon, % coaches akkoord), onboarding (startlijst x/7), AI-teller. Sorteerbaar; rood bovenaan.
- **Signalen:** "club X: 3 dagen geen sync", "club Y: 5 coaches wachten op goedkeuring", "club Z: 0 activiteit in 21 dagen".
- **Acties per club:** openen, kalender, aanvraag goedkeuren, AI aan/uit en limiet.
- **Techniek:** de nachtelijke `aggregeerGebruikNacht` (vandaag gebouwd) schrijft al per club een samenvatting; een klein `platformstats/overzicht`-document met per club de kerncijfers maakt het scherm met één read snel.

---

## 6. Vandaag gedaan (release 20261011c, branch — nog deployen)
- `aggregeerGebruik` gebouwd (`functions/gebruik.js`) + nachtelijke variant voor alle clubs. Het Inzicht-dashboard had geen bron; de knop "Synchroniseer" gaf een fout. Getest met `node tests/gebruik.test.mjs`.
- Futsal-sleutel: de client volgt nu de server (`o131futsal`), geen botsing meer met het veldteam. `node tests/sleutel.test.mjs` uitgebreid.

## 7. Voorgestelde volgorde
| Prio | Wat | Soort |
|---|---|---|
| 1 | Rules + functions testen in de emulator en deployen (blokkeert livegang) | techniek |
| 2 | Platformdashboard (5) | mockup eerst |
| 3 | Startlijst + teams uit Sportlink (O2, O3) | mockup eerst |
| 4 | Club aanmelden + VO digitaal (O1, O6) | mockup eerst |
| 5 | Seizoensovergang-assistent | mockup eerst |
| 6 | Kleurcontrast + voorbeeld, belangrijk/geavanceerd (P1–P3) | mockup eerst |
| 7 | ASV'33 als tenant op cluppie.io | migratie |
