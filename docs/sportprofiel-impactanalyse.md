# Sportprofiel: impactanalyse

24-11-2026. Analyse, geen code. Poort **P2**: na akkoord van Paul volgt een mockup (P3), daarna pas productiecode.

Achtergrond: het advies "Cluppie voor andere sporten" (24-11-2026) raadt aan eerst een sportprofiel te bouwen, met voetbal als eerste profiel, en daarna hockey als pilot. Dit document beschrijft wat dat sportprofiel raakt en hoe het past in de visie en werkwijze van `docs/totaalplan.md`.

## Past dit bij de visie?

De visie in het totaalplan zegt: "Cluppie is dé Nederlandstalige app voor **jeugdvoetbal**coaches en clubs". Een sportprofiel verandert dat kompas. Alles wat de visie verder vraagt blijft overeind en is juist wat Cluppie in andere teamsporten onderscheidt:

| Onderdeel van de visie | Blijft gelijk bij een sportprofiel? |
|---|---|
| Nederlandstalig | Ja |
| Pedagogisch onderbouwd (5 domeinen, 14 leercurvethema's) | De vijf domeinen (techniek, tactiek, fysiek, mentaal, gedrag) gelden in elke teamsport. De veertien thema's zijn voetbal en moeten per sport opnieuw. |
| Simpel voor vrijwilligers, sterk op mobiel | Ja; het profiel kiest de club één keer, de coach merkt er niets van |
| Privacy-vriendelijk, gegevens in de EU | Ja, niets verandert aan opslag of rules-model |
| Schaalbaar naar 30+ amateurclubs | Groter bereik: ±330 hockeyclubs, ±450 korfbalclubs |
| Elk gebruikerstype, van losse trainer tot eindbaas | Ja, zie "Per gebruikerstype" |

**Voorstel visietekst (beslissing Paul):** "Cluppie is dé Nederlandstalige app voor jeugdcoaches en clubs in teamsporten, begonnen bij voetbal." Zolang Paul dit niet besluit, bouwt het sportprofiel niets zichtbaars: voetbal blijft de enige sport en alle schermen blijven gelijk.

## Wat er nu vastzit op voetbal

Gemeten op `main` (d19c87a) met een zoektelling op voetbaltermen (keeper, KNVB, Sportlink, buitenspel, elftal, JO/MO, formatie, 4v4 … 11v11). Bovenaan staan de bestanden met de meeste treffers:

| Bestand | Treffers | Wat er voetbal is |
|---|---|---|
| `public/js/wedstrijd.js` | 213 | keeper-slot, kaarten en tijdstraf, KNVB-wedstrijdvormen, helften/kwarten |
| `functions/index.js` | 94 | Sportlink-sync, KNVB-teksten in AI-prompts |
| `public/js/config.js` | 87 | categorieën JO/MO met format en duur, formaties, posities, bouwgrenzen, KNVB-kalender, skills, leercurve |
| `public/js/club.js` | 76 | Sportlink, elftallen, KNVB-district |
| `public/js/opstelling-advies.js`, `opstelling-sjabloon.js` | 60 + 59 | formatie-advies, keeper |
| `public/js/elftallen.js` | 56 | teamindeling met KNVB-categorieën |
| `public/js/club-instellingen.js` | 43 | instellingen met KNVB-termen |
| `public/js/veldkaart.js`, `tactiekbord.js` | 29 + 18 | voetbalveld met 16-meter en middenlijn |
| `public/js/club-sportlink-import.js`, `sportlink-clubinfo.js`, `functions/sportlink-hulp.js` | 29 + 14 + 13 | ledenbron Sportlink |

In totaal 87 bestanden met minstens één treffer. Het goede nieuws: `config.js` en `clubconfig.js` zijn al ontworpen als één plek waar standaardwaarden staan die per club in plaats worden aangepast (live-binding). Een sportprofiel past precies in die laag.

## Drie lagen (indeling van Paul, 24-11-2026)

Uitgangspunt: een onderdeel wordt niet als geheel aan een laag toegewezen, maar gesplitst in een **mechanisme** (schermen en logica, één keer gebouwd) en **inhoud** (per sport gevuld). Zo blijven clubvisie, speelwijze en beoordelen één onderdeel in de code.

| Laag | Wat erin zit |
|---|---|
| **Basis** (sportonafhankelijk) | Clubs, rollen en rechten (coach, bouwcoördinator, trainingscoördinator, hoofd jeugd, clubadmin, eindbaas), onboarding, platformcentrum en Meehelpen. Teams, spelers, opkomst, vaste afmeldingen, uitlenen. Teamkamer, berichten, weekbrief, mails. Opbouw van seizoensplan en jaarkalender, trainingsmomenten, agenda. Documenten, video's, uploads. Evaluatierondes, de vijf domeinen, Inzicht, jaaroverzicht. Het mechanisme voor eerlijke speeltijd (klok, wie speelt hoe lang). Het mechanisme voor clubvisie, kompas, speelwijze als rode draad en beoordelen. AI-infrastructuur en limieten, privacy, bewaartermijnen, design, PWA. |
| **Sport** (per sport een profiel) | Leeftijdscategorieën en spelvormen, en daarmee de bouwgrenzen. Wedstrijdregels: periodes, wissels, keeper, straffen, en wat speeltijd telt (minuten, of sets/punten bij volleybal). Veld voor tactiekbord, trainingsvormen en 3D; formaties en posities. Leercurvethema's en beoordelingscriteria. Standaardinhoud voor visie en speelwijze. Oefenstof en bibliotheek, AI-kennis en prompts. Ledenbron (Sportlink of anders), bondskalender en district, woorden (bond, elftal, buitenspel). Overige standaardinstellingen die met de sport te maken hebben. |
| **Club** (bestaat al) | Wat een club nu in Instellingen aanpast: naam, kleur, logo, eigen lijsten, eigen visie, speelstijl en beleidsplan, drempels. Ligt over de sportstandaard heen. |

## Ontwerp in het kort

**Een sportprofiel is een vaste set standaardwaarden per sport**, die onder de clubinstellingen ligt:

```
sportprofiel (voetbal, hockey, …)   ← nieuw, in de code
  └─ config.js-standaard             ← wordt "voetbalprofiel"
      └─ clubs/{id}.instellingen     ← zoals nu: de club past aan
```

Inhoud van een profiel (alles wat nu als voetbal in `config.js` staat):

| Onderdeel | Voetbal nu | Voorbeeld hockey |
|---|---|---|
| Naam, ondergrond | voetbal, veld | hockey, veld |
| Categorieën met spelvorm, periodes, duur | `CATEGORIEEN`, `CATEGORIEEN_MEIDEN` (JO7 … Vrouwen) | Jongste Jeugd 3-tal/6-tal/8-tal, D/C/B/A 11-tal, 4 kwarten |
| Bouwgrenzen | onder t/m O11, midden t/m O15 | per profiel instelbaar |
| Formaties en posities | `FORMATIES`, `POSITIE_GROEPEN`, `LIJN_NAAM` | 11-tal met keeper, andere linies |
| Keeper | ja, behalve 4 tegen 4 | ja |
| Wisselregels | beperkt per KNVB-categorie | onbeperkt, doorlopend |
| Straffen | geel, rood, tijdstraf | groen, geel (tijd), rood |
| Veld voor tactiekbord en 3D | 105 × 68 met 16-meter | 91,4 × 55 met cirkel |
| Kalender en district | `KNVB_KALENDER`, district | bondskalender of geen |
| Leercurve-thema's | 14 voetbalthema's | eigen thema's (met een hockeyclub te vullen) |
| Ledenbron | Sportlink | csv-import (de KNHB gebruikt LISA; koppeling na te gaan) |
| Woorden in teksten en AI | KNVB, elftal, keeper, buitenspel | bond, team, keeper, … |

**Waar de sport wordt opgeslagen:**
- `clubs/{id}.sport` (standaard `voetbal`). Alleen de **eindbaas** zet dit, net als `platformModules`, omdat het de inhoud van de hele club verandert. De rules krijgen dit veld erbij in de lijst die een clubadmin niet mag wijzigen.
- `teams/{id}.sport` voor een losse trainer zonder club (standaard `voetbal`). De trainer kiest het bij aanmaken; bij de overstap naar een club moet de sport gelijk zijn, anders weigert de koppeling met uitleg.
- Bestaande documenten zonder `sport` lezen als voetbal. Geen datamigratie.

**Bibliotheek en inhoud:** de 326 uitgewerkte oefeningen, `content/seed.json` en de leercurveteksten krijgen een `sport`-veld (ontbreekt = voetbal). Een club ziet alleen oefenstof van de eigen sport. Voor een nieuwe sport begint de bibliotheek leeg tot de eindbaas (of een pilotclub) inhoud toevoegt.

## Stand

- 24-11-2026: **stap 1 gebouwd** op de branch, niet gemerged. `public/js/sport-voetbal.js` (diep bevroren profiel) en `public/js/sporten.js` (register, `sportProfiel(id)`, onbekend = voetbal). `config.js` maakt er losse kopieën van; namen en vormen van alle exports zijn gelijk. Bewijs: alle 72 exports van `config.js` vóór en na vergeleken (gelijk, ook de functies), `npm test` groen met nieuwe `tests/sportprofiel.test.mjs` (24 controles), rooktest (157 schermen, 8 rollen) gelijk aan `main`.
- Mockups voor stap 2 en 3 (P3): `docs/mockups/sportprofiel/`. Akkoord van Paul op 25-11-2026.
- 25-11-2026: **stap 2 gebouwd** (20261125x): sport bij club (alleen eindbaas) en team (alleen zonder club, bij aanmaken, daarna vast), rules met tien nieuwe proeven (98 van 98 kloppen), overstap naar een club alleen bij dezelfde sport, kaart Sport in Instellingen, blok Sport in Platform › Clubs, sportkeuze in de snelstart (verborgen zolang er één sport is; `?sport=` uit de latere landingspagina wordt al gelezen). De sportkeuze in het aanmeldformulier voor clubs komt pas als er een tweede sport is.

## Aanpak in kleine releases

1. **Voetbalprofiel uit `config.js` halen (pure refactor).** Nieuw bestand `public/js/sport-voetbal.js` (met een register in `public/js/sporten.js`) met alle voetbalwaarden; `config.js` vult zich daaruit. Geen wijziging voor gebruikers. Bewijs: `npm test`, `npm run test:rook` (109 schermen, zeven rollen) en een vergelijking van alle exports vóór en na.
2. **Sport-veld lezen.** `clubconfig.js` kiest het profiel op basis van `clubs/{id}.sport` of `teams/{id}.sport` voordat de clubinstellingen erop gaan. Rules: `sport` alleen door de eindbaas; proeven in `tests/audit-rules.test.mjs` (clubadmin mag niet, eindbaas wel, losse trainer bij aanmaken wel).
3. **Woorden uit het profiel.** Teksten met KNVB, elftal, keeper en buitenspel via een kleine vertaalfunctie (`sportWoord('bond')`). Begint bij de schermen die een coach het meest ziet: Nu, wedstrijd, opstelling.
4. **Veld uit het profiel.** Tactiekbord, trainingsvorm-svg, 3D en veldkaart lezen maten en lijnen uit het profiel.
5. **Wedstrijd uit het profiel.** Periodes, keeper, wisselregels en straffen. Dit is het grootste stuk (`wedstrijd.js`, `analyse.js`, opstelling) en het meest gevoelig: speeltijd moet voor voetbal tot op de seconde gelijk blijven. Eerst tests op `analyse.js` met vaste wedstrijden.
6. **Bibliotheek en AI per sport.** `sport`-veld op oefeningen en content, filter in de bibliotheek, sport in de AI-prompts.
7. **Ledenbron.** Sportlink alleen tonen als het profiel dat zegt; csv-import als tweede bron.
8. **Hockeyprofiel** als eerste tweede sport, pas na stap 1 t/m 7, met een pilotclub.
9. **Algemene landingspagina met sportkeuze** (idee Paul, 24-11-2026): de bezoeker kiest eerst de sport en komt dan bij de ingang voor die sport (trainer of club). De gekozen sport gaat mee naar het aanmelden. Valt onder WP8, poort P5.

Stap 1 en 2 zijn voor gebruikers onzichtbaar. Na stap 2 is er een natuurlijk stoppunt: de basis ligt er, en elke volgende stap kan wachten tot er een tweede sport komt.

## Per gebruikerstype

| Gebruikerstype | Wat verandert | Beveiliging | Onboarding |
|---|---|---|---|
| Losse trainer | Kiest bij een nieuw team de sport (standaard voetbal; keuze pas zichtbaar als er een tweede profiel is) | `teams/{id}.sport` alleen bij aanmaken door de eigenaar, daarna vast | Sportkeuze als eerste vraag; overstap naar een club met een andere sport wordt geweigerd met uitleg |
| Coach van een team | Ziet de woorden, het veld en de oefenstof van zijn sport; verder niets | Leest alleen | Geen extra stap |
| Gekoppelde coach bouw / bouwcoördinator | Bouwen volgen de categorieën van het profiel | Ongewijzigd | Geen extra stap |
| Trainingscoördinator | Bibliotheek toont alleen oefenstof van de eigen sport | Ongewijzigd | Geen extra stap |
| Hoofd jeugdopleiding | Leercurve en clubprofiel van de eigen sport | Ongewijzigd | Bij een nieuwe sport: leercurve invullen of de standaard overnemen |
| Clubadmin | Ziet de sport in Instellingen, kan hem niet wijzigen; past categorieën en lijsten aan zoals nu | Mag `sport` niet schrijven (nieuwe proef) | Bij aanmelden van een club: sport kiezen in het aanmeldformulier, eindbaas bevestigt |
| Eindbaas | Zet de sport per club; ziet de sport in het platformcentrum; beheert oefenstof per sport | Enige die `clubs/{id}.sport` schrijft | Bij goedkeuren van een club de sport controleren |

Testaccounts: de vaste fictieve set per rol blijft voetbal; voor de rooktest komt er één democlub met een tweede sport zodra er een tweede profiel is.

## Risico's

- **Speeltijd en wissels.** Het meest gebruikte en meest gevoelige stuk. Elke wijziging in `wedstrijd.js`/`analyse.js` krijgt eerst tests met vaste voetbalwedstrijden die vóór en na precies gelijk moeten uitkomen.
- **Live-binding.** `config.js` wordt nu in plaats aangepast door `clubconfig.js`. Het profiel moet op dezelfde manier werken (eerst profiel, dan club), anders zien modules oude waarden.
- **Cache en versies.** Nieuwe modules staan bewust direct in `public/js/`, zodat `tools/versie.mjs` en `tools/importcheck.mjs` ze meenemen; `CACHE_VERSIE` ophogen in de release.
- **Omnisportclubs.** Een club met voetbal én hockey past niet in `clubs/{id}.sport`. Advies: nu niet ondersteunen; later kan `teams/{id}.sport` binnen een club afwijken.
- **Pedagogische kern.** De vijf domeinen blijven; de veertien thema's niet. Zonder goed gevulde leercurve is Cluppie voor een andere sport "een teamapp" en verliest het wat het onderscheidt. Daarom geen tweede sport zonder pilotclub die de inhoud mee vult.

## Wat niet in deze stap zit

Geen hockey-inhoud, geen ledenkoppeling met LISA of een andere bond, geen omnisportclubs, geen wijziging in de website of marketing. Geen datamigratie.

## Beslissingen voor Paul

1. **Visie:** akkoord (24-11-2026): "app voor jeugdcoaches en clubs in teamsporten, begonnen bij voetbal", met de drie lagen hierboven.
2. **Wie zet de sport:** besloten 24-11-2026: gekozen bij het aanmelden (losse trainer zelf, club via het aanmeldformulier), daarna alleen te wijzigen door de eindbaas.
3. **Omvang nu:** alleen stap 1 en 2 (de basis, onzichtbaar), of door tot en met stap 7?
4. **Mockup (P3):** voor stap 2 en 3 is een mockup nodig van Instellingen (sport tonen), Platform › Clubs (sport zetten) en het aanmelden van een losse trainer (sport kiezen). Akkoord om die te maken?
