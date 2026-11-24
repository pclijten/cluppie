# Veldplanner (trainingen op velden en in kleedkamers): impactanalyse

24-11-2026. Analyse, geen code. Poort **P2**: na akkoord van Paul volgt een interactieve mockup (P3), daarna pas productiecode.

Vraag van Paul (24-11-2026): de club deelt teams in op velden, met tijden en kleedkamers. Dat komt automatisch bij de teams terecht. Wijzigingen houdt de beheerder centraal bij. Veel aandacht voor overzicht, met slepen en neerzetten (drag & drop). Inspiratie: Sportlink Club.Trainingen, niet kopiëren.

## Past dit bij de visie?

Ja. Het bespaart vrijwilligers tijd (geen Excel-rooster en appgroepen meer), het maakt één bron van waarheid voor "waar en wanneer trainen we", en het sluit aan op wat Cluppie al heeft: trainingsmomenten per team, de veldkaart met deelvelden en kleedkamers, afgelastingen en het Nu-scherm.

**Wat Sportlink biedt** (hun pagina, 24-11): seizoensplanning vooraf, terugkerende trainingen, teams/velden/kleedkamers uit Sportlink, "geen overlap", weergave in de Club.Mobiel-app, aanwezigheid. Losse module (€ 10 eenmalig + € 0,22 per lid per jaar), draait nog in de Java-versie. Rechten en afgelastingen noemen ze niet.

**Waar Cluppie anders en beter kan zijn:**
1. Een tijdlijn per veld met deelvelden (heel, half, kwart) waarop je teams sleept, in plaats van een formulier per training.
2. Direct zien wat botst: veld vol, kleedkamer dubbel, trainer in twee teams tegelijk, jong team te laat, veld zonder licht.
3. "Vul aan": Cluppie stelt een indeling voor voor de teams die nog geen plek hebben; de beheerder schuift daarna bij.
4. Eén druk op "Publiceren" zet het rooster bij alle teams; elk team ziet alleen wat voor hem verandert.
5. Wijzigingen voor één dag (veld afgekeurd, toernooi) zonder het basisrooster te slopen.
6. De kaart: een tijdschuif over de luchtfoto van het sportpark laat zien welke velden op dat moment bezet zijn.

## Wat er al is (gemeten op `main`, ff1e22a)

| Onderdeel | Waar | Bruikbaar voor de planner |
|---|---|---|
| Trainingsmomenten per team: `{dag, start, eind}` | `teams/{id}.trainingsmomenten`, `trainingsmomenten.js`; bewerkt in Clubbeheer (`club-beheer.js`) en door de coach | Ja: dit is waar de planner naartoe schrijft. Nu-scherm, presentie, Inzicht, trainingscoördinator en vaste afmeldingen lezen het al. |
| Sportpark met velden, deelvelden (heel/half/kwart) en plekken (kleedkamers als groep, "Kleedkamers 1–4") | `clubs/{id}/sportparken/eigen`, `veldkaart.js` | Ja: velden en hun indeling komen hieruit. Kleedkamers bestaan alleen als groep op de kaart, niet als losse kamers. |
| Welk deelveld past bij een spelvorm | `niveauVanVorm()` in `veldkaart.js` (6 en 4 tegen 4 → kwart, 8 tegen 8 → half, 9 en 11 → heel) | Ja: standaard veldmaat per team. |
| Afgelastingen | `clubs/{id}/afgelastingen` | Ja: een afgelaste dag telt niet mee. |
| Weekrooster (alleen lezen) | `trainco.js` (trainingscoördinator) | Wordt een weergave van hetzelfde rooster. |
| Wedstrijdveld en kleedkamer uit Sportlink | `slVeld`, `slKleedkamer` bij wedstrijden | Nee, dat blijft voor wedstrijden. De planner gaat over trainingen. |

## Ontwerp in het kort

### Datamodel (alles nieuw, altijd `merge`)

```
clubs/{clubId}/sportparken/eigen            (bestaat)
   velden[]: + soort ('veld' standaard; een sportprofiel kan 'zaal' e.d. toevoegen)
             + licht (true/false), + ondergrond (vrije tekst: kunstgras, gras)
   kleedkamers[]: { id, naam }               (nieuw: losse kamers, los van de kaartgroep)

clubs/{clubId}/veldroosters/{roosterId}      (nieuw)
   { naam: 'Seizoen 2026-2027' | 'Winterrooster', vanaf, tot, status: 'concept'|'gepubliceerd',
     instellingen: { stap: 15, kleedVoor: 15, kleedNa: 20, dagStart: '16:00', dagEind: '22:30' },
     blokken: [{ id, teamId, dag 1-7, start, eind, veld, deel ('heel'|'a'|'b'|'a voor'…), kleedkamers: [id], notitie }],
     gepubliceerdMs, gepubliceerdDoor, versie }

clubs/{clubId}/veldwijzigingen/{datum}       (nieuw: uitzonderingen voor één dag)
   { datum, reden, wijzigingen: [{ blokId, soort: 'verplaatst'|'vervalt', veld?, deel?, start?, eind?, kleedkamers? }] }
```

- **Veldtypen blijven generiek** (afstemming met het sportprofiel, PR #100): een veld is een "ruimte" met een `soort` en een indeling in delen. Voetbal kent heel/half/kwart; hockey of een zaal kan later een andere indeling krijgen zonder de planner te veranderen. Botsingen worden gerekend in "deel-eenheden" (een kwart = 1, half = 2, heel = 4).
- **Veldindeling** (wens Paul, 24-11): heel, half en kwart staan vast op elk veld. Daarnaast tekent de club met een eigen tekentool vrije vakken op het veld (bijv. keepershoek, pannaveldje, strook voor de warming-up): slepen om te tekenen, verplaatsen en van maat veranderen, op hele meters. Opslag: `velden[].vakken [{id, naam, x, y, w, h}]` op `sportparken/eigen`, als fractie van het veld (0–1), zodat het los staat van de veldmaat en ook voor andere sporten werkt. Botsingen rekenen op overlap van rechthoeken; een team krijgt het kleinste vak dat groot genoeg is (kwart 25%, half 50%, heel 100%).
- **Kaart**: luchtfoto van het eigen sportpark (PDOK, zoals de veldkaart) met een knop naar een getekende weergave. Met Tekenen zet de beheerder zelf objecten op de kaart: parkeren, fietsenstalling, kantine, kleedkamers, materiaalhok, tribune (vlakken) en ingang, AED (punten). Opslag: `objecten [{id, soort, naam, x, y, w?, h?}]` op `sportparken/eigen`. Teams en ouders zien ze terug (bijv. waar parkeren en waar de AED hangt).
- **Eén document per rooster**: 60 teams × 3 trainingen × ~150 bytes ≈ 30 KB, ruim binnen de grens van 1 MB. Eén document = één keer lezen en geen halve stand bij gelijktijdig werken.
- **Seizoen en winter**: een club kan een tweede rooster maken (bijv. kunstgras in de winter) met een eigen periode; het juiste rooster geldt op basis van de datum.

### Hoe het bij de teams komt

Bij **Publiceren** schrijft Cluppie per team (batch, `merge`) de trainingsmomenten, nu uitgebreid met `veld`, `deel`, `kleedkamers` en `rooster`:

```
teams/{id}.trainingsmomenten: [{ dag, start, eind, veld:'Veld 2', deel:'a', kleedkamers:['3'], rooster:'r-2026' }]
```

Zo blijft alle bestaande code werken (dagen en tijden) en ziet het team er nu ook veld en kleedkamer bij: op de Nu-kaart ("Training 18:30–19:45 · Veld 2a · Kleedkamer 3"), in de agenda, en met een tik op het veld de bestaande veldkaart met het deelveld rood gemarkeerd. Vóór publiceren toont Cluppie een overzicht: "14 teams krijgen een wijziging, 38 blijven gelijk". Alleen teams met een wijziging krijgen een bericht in de teamkamer (instelbaar).

Wijzigingen voor één dag (`veldwijzigingen`) leest het Nu-scherm naast de afgelastingen; het team ziet dan "Vandaag op Veld 4 in plaats van Veld 2".

### Het scherm (wat de mockup moet laten zien)

**Club → Veldplanner** (desktop eerst; drag & drop werkt met muis, aanraking en toetsenbord):

1. **Dagtijdlijn** (hoofdweergave): rijen = velden, elk veld met banen voor zijn deelvelden; kolommen = tijd in stappen van 15 minuten. Een team is een blok in de kleur van zijn bouw (onder/midden/boven) met teamnaam, tijd en kleedkamer.
   - Slepen verplaatst (tijd en veld), de rand slepen verandert de duur. Blokken klikken vast op de stap en op het deelveld dat bij het team past.
   - Tijdens het slepen lichten plekken groen (past), oranje (past met waarschuwing) of rood (botst) op.
2. **Zijbalk "Nog in te plannen"**: teams per bouw met hoeveel trainingen ze nog missen (bijv. "O10-2 · 1 van 2"). Van daar sleep je een team de tijdlijn op.
3. **Kleedkamerstrook** onder de tijdlijn: per kleedkamer de bezetting, inclusief de tijd ervoor en erna. Een kleedkamer sleep je op een blok; "Kies vrije" doet het automatisch.
4. **Weekstrip** bovenaan: ma t/m zo met een kleine "hittekaart" van de bezetting per dag; klik om te wisselen.
5. **Controlepaneel** (rechts of als badge): alle botsingen en waarschuwingen in mensentaal, met "Toon" en waar het kan "Los op".
6. **Andere weergaven** van hetzelfde rooster: per team (lijst, handig om na te lopen), en de kaart met tijdschuif.
7. **Vul aan**: Cluppie plant de resterende teams in volgens regels (juiste veldmaat, jongste teams eerst, niet twee keer op een dag, kleedkamer vrij, trainer niet dubbel). Het voorstel staat gestreept tot de beheerder het overneemt.
8. **Dag wijzigen**: kies een datum, bijvoorbeeld "Veld 3 afgekeurd" → Cluppie stelt voor de teams van veld 3 te verplaatsen of te laten vervallen.

Op de telefoon: rooster bekijken per dag en een blok verplaatsen via aantikken ("Verplaats naar…"), geen sleepwerk op een klein scherm.

### Controles (botsingen en waarschuwingen)

| Controle | Soort |
|---|---|
| Veld of deelveld bezet (meer delen dan het veld heeft) | Botsing |
| Kleedkamer dubbel, inclusief tijd ervoor en erna | Botsing |
| Trainer staat bij twee teams die tegelijk trainen (uit `leden` van de teams; geen namen in de opslag) | Waarschuwing |
| Team traint vaker of minder vaak dan ingesteld, of twee keer op één dag | Waarschuwing |
| Veld zonder licht na zonsondergang in de periode van het rooster | Waarschuwing |
| Onderbouw na een instelbaar tijdstip (standaard 19:00) | Waarschuwing |
| Veldmaat kleiner dan de spelvorm van het team | Waarschuwing |

## Rechten

| Wie | Lezen | Schrijven |
|---|---|---|
| Clubadmin | Alles | Roosters, kleedkamers, publiceren, dagwijzigingen |
| Trainingscoördinator | Alles | **Beslissing Paul** (advies: ja, roosters en dagwijzigingen; publiceren ook, het is zijn vak). Nu is deze rol overal alleen-lezen. |
| Hoofd jeugdopleiding, bouwcoördinator | Alles (overzicht) | Nee. Advies: later eventueel "voorstel doen" voor de eigen bouw. |
| Coach, gekoppelde coach bouw | Eigen team via de trainingsmomenten; het clubrooster ook (geen persoonsgegevens) | Geen. Kan "Wijziging vragen" (net als de veldmelding). |
| Losse trainer | Niet van toepassing (geen club, geen planner) | Houdt zijn eigen trainingsmomenten zoals nu. |
| Eindbaas | Via ondersteuningsmodus, zoals bij andere clubonderdelen | Alleen in ondersteuningsmodus |

**Belangrijk:** zolang een club de planner gebruikt, mag de coach de trainingsmomenten van zijn team niet meer zelf wijzigen; anders loopt het team uit de pas met het rooster. Voorstel: een vlag `clubs/{id}.veldplanner = true` (de clubadmin zet hem aan); de rules weigeren dan `trainingsmomenten` in `coachWijzigtTeamVeilig()`. In het teamscherm staat dan "Ingepland door de club · Wijziging vragen". Clubs zonder planner merken niets.

Rules-proeven in `tests/audit-rules.test.mjs` per rol: mag wat moet, mag niet wat niet moet (ook: coach probeert trainingsmomenten te wijzigen bij een club met planner; trainingscoördinator van een andere club).

## Per gebruikerstype

| Gebruikerstype | Raakt dit? |
|---|---|
| Losse trainer | Nee. |
| Coach | Ja: ziet veld en kleedkamer bij de training, krijgt een bericht bij een wijziging, kan een wijziging vragen; kan zijn tijden niet meer zelf aanpassen als de club plant. |
| Gekoppelde coach bouw | Als coach. |
| Bouwcoördinator | Ja: leest het rooster van de club (overzicht). |
| Trainingscoördinator | Ja: zijn weekrooster wordt het clubrooster; schrijfrecht is een beslissing. |
| Hoofd jeugdopleiding | Ja: leest het rooster. |
| Clubadmin | Ja: de planner zelf, kleedkamers invoeren, publiceren, dagwijzigingen. |
| Eindbaas | Nee, behalve via ondersteuningsmodus. In het platformcentrum alleen "planner aan/uit" per club als onderdeel (schakelaar). |

## Raakt het lopend werk?

- **ASV'33-verhuizing:** de planner gebruikt nieuwe collecties en één nieuw veld op teams; niets aan de verhuisscripts. Wel nieuwe rules (deploy via `deploy-alles.ps1`) en wijzigingen in `nu-scherm.js`. Advies: bouwen op een eigen branch, mergen pas na de verhuizing (of eerder met Paul's eigen akkoord).
- **Sportprofiel (PR #100):** veldsoort en indeling blijven generiek; de standaard indeling (heel/half/kwart) wordt later inhoud van het voetbalprofiel.
- **Sportlink:** Cluppie leest nu geen kleedkamers of trainingsvelden uit Sportlink voor trainingen. Kleedkamers voert de club één keer zelf in (of ze worden afgeleid uit "Kleedkamers 1–4" op de kaart). Een koppeling met Sportlink Club.Trainingen is niet nodig en niet voorzien.

## Releases (voorstel, elk met tests en P4)

1. **Basis**: kleedkamers bij het sportpark, rooster-document, de dagtijdlijn met slepen, zijbalk, controles. Alleen concept, nog niets naar teams. Rules + proeven.
2. **Publiceren**: overzicht van wijzigingen, schrijven naar de teams, Nu-kaart en agenda met veld en kleedkamer, coach-slot met "Wijziging vragen".
3. **Dagwijzigingen**: veld afgekeurd, verplaatsen of laten vervallen, bericht aan de teams.
4. **Slim**: Vul aan, kaart met tijdschuif, winterrooster, weergave voor trainingscoördinator vervangen door het clubrooster.

## Beslissingen voor Paul

1. Akkoord met deze opzet en de naam **Veldplanner** (onder Club)?
2. Mag de **trainingscoördinator** roosters maken en publiceren? (advies: ja)
3. Coach-slot op trainingstijden zodra de club plant? (advies: ja, met "Wijziging vragen")
4. Bericht aan teams bij een wijziging: automatisch of per keer kiezen? (advies: standaard aan, uit te zetten bij publiceren)

Na akkoord maak ik een **interactieve mockup** (HTML met echte drag & drop, fictieve club met 4 velden, 8 kleedkamers en 30 teams) om te proberen in de browser: dagtijdlijn, zijbalk, kleedkamerstrook, controles, Publiceren-overzicht, en de Nu-kaart van de coach.

## Stand release 1 (24-11-2026)

Gebouwd op de branch van PR #102, achter de schakelaar van de eindbaas (`clubs/{id}.platformModules.veldplanner`, standaard uit). Afwijking van het plan hierboven: kleedkamers, licht en eigen vakken staan niet op `sportparken/eigen` maar in `clubs/{id}/veldplanner/instellingen`, omdat de veldkaart bij opslaan de hele lijst velden herschrijft en eigen vakken dan zou weggooien. De velden zelf (id en naam) komen nog steeds uit de veldkaart. Het rooster staat in `clubs/{id}/veldroosters/basis`. Op verzoek van Paul zit tekenen op de luchtfoto er al in: weergave Kaart in de Veldplanner (de luchtfoto en het schuiven en zoomen komen uit `Kaart` in `veldkaart.js`). Parkeren, fietsenstalling, kantine, kleedkamers, materiaalhok en tribune teken je als vlak, ingang, AED en overig als punt. Opslag: `veldplanner/instellingen.objecten [{id, soort, naam, lat, lon, b?, h?}]` (midden plus maat in meters, hooguit 60). Teams en ouders zien ze nog niet; dat kan bij Publiceren (release 2).
