# Trainingen en seizoensplan — review (11-11-2026)

Aanleiding: Paul vindt het geheel rommelig. Vijf vragen: passen trainingen zich aan, is de opbouw/layout helder, is het verschil tussen Training maken en Seizoensplan duidelijk, komen trainingen bij het juiste team en zijn ze te vinden, en wat ziet elke rol.

Alles hieronder is in de code nagekeken en waar mogelijk gemeten met de echte planner en bibliotheek (141 vormen). Niet in een browser bekeken.

## Kort oordeel

Je gevoel klopt. De planner zelf is degelijk, maar er zijn **vier routes** die elk trainingen op hetzelfde tabblad zetten, onder **vijf namen**, zonder onderlinge afstemming:

| Route | Waar | Wie | Schrijft naar |
|---|---|---|---|
| Training maken | Team › Oefenstof › Training maken | coach | `teams/{id}/trainingsplannen` + optioneel één training op Oefenstof (`bron: trainingsmodule`) |
| Seizoensplan team | Team › Oefenstof › Seizoen | coach | `teams/{id}/seizoensplan` + het hele seizoen op Oefenstof (`bron: seizoensplan`, planId `team_…`) |
| Seizoensplan jeugd (club) | Club › Seizoensplan | admin, hoofd jeugd, coördinator | `clubs/{id}/seizoensplannen` + het hele seizoen per team op Oefenstof (`bron: seizoensplan`, eigen planId) |
| Blokplanning (PDF/zip) | Club › Trainingen › upload | admin, hoofd jeugd | trainingen met `plan`, `zichtbaarVanaf` |

Namen voor bijna hetzelfde: Oefenstof / Trainingen (desktop en meldingen) / Seizoen / Seizoensplanning / Seizoensplan (jeugd). En op de hub staan "Training" (presentie) en "Training maken" (oefenstof) in verschillende groepen.

## 1. Passen de trainingen zich aan?

Gemeten over 672 combinaties (O8, O10, O12, O15 × 14 thema's × 4 fases × 3 seeds), steeds één instelling anders:

| Instelling | Exact dezelfde training | ≥ 3 van 4 vormen gelijk | Oordeel |
|---|---|---|---|
| Niveau Basis ↔ Midden | 44% | 71% | zwak |
| Niveau Basis ↔ Hoog | 13% | 54% | redelijk |
| Fase Ontdek ↔ Wedstrijd | 26% | 61% | redelijk |
| 8 ↔ 16 spelers | 27% | 88% | groepen/veld veranderen wel, vormen nauwelijks |
| Duur 45 ↔ 75 | 100% | 100% | alleen de minuten veranderen |

- Niveau en fase werken via één getal (doelcomplexiteit 1–3) dat maar licht meeweegt tegen het thema (+10). Gemiddelde complexiteit van de kern: Basis 1,4 · Midden 2,0 · Hoog 2,2. Midden en Hoog liggen dus dicht bij elkaar.
- Duur verandert nooit welke vormen je krijgt. Dat is te verdedigen (vier vormen, langer of korter), maar de trainer verwacht het niet.
- Weer, veld en materiaal werken sinds 20261111b wel.
- **Seizoen** (80 trainingen, 2× per week): O7 wisselt het hele jaar tussen twee thema's en krijgt sommige vormen 27×; O11 en O13 krijgen exact dezelfde blokvolgorde (bouw midden), alleen de vormen verschillen. Dat is de bibliotheek en de vaste volgorde per bouw, geen fout in de code.
- **Clubplan** houdt geen rekening met het team: één duur, één niveau en één aantal trainingen per week voor de hele bouw of club (een O7 in een clubplan van 60′ traint 60′), altijd 12 spelers, de trainingsdagen van het team worden niet gebruikt. Meldingen van de planner ("partijspel past niet met …") worden weggegooid.

## 2. Fouten gevonden (hersteld in release 20261111c)

1. **Training maken koos het verkeerde thema.** De leerlijn werd opgezocht met het ISO-weeknummer van het jaar (week 47) alsof het de week in het seizoen was. In november gaf dat het thema van het laatste blok; in januari het eerste. Gemeten voor een O11: 17-11 hoort Dieptespel opbouw (Verdiep), Training maken toonde Voorkomen van doelpunten (Wedstrijd). Nu: thema bij de datum van de training (`seizoensweekOp` in `seizoensplan-logica.js`, getest).
2. **Het seizoensplan telde pas mee als je eerst het tabblad Seizoen opende** (ook bij de thema-check in de wedstrijdevaluatie). Training maken laadt het plan nu zelf; de thema-check in de evaluatie (telefoon en desktop) nog niet, die volgt in de herstructurering.
3. "Open in Training maken" vanuit Seizoen gaf geen datum mee; nu de datum van die week.
4. Op Oefenstof kon training 2 boven training 1 staan (zelfde tijdstempel). Nu `trainingNr`.

## 3. Komen trainingen bij het juiste team en zijn ze te vinden?

Het juiste team: ja, elke training heeft `teams: [teamId]`. Te vinden: nee, om vier redenen.

- **Oefenstof loopt over.** Een seizoensplan zet ~80 trainingen in één keer neer, allemaal direct zichtbaar (geen `zichtbaarVanaf`), allemaal "nieuw" (badge op de tegel), en de weken staan nieuw → oud. Bovenaan staat dus juni volgend jaar; "Deze week" zit ergens halverwege 35 weekkoppen.
- **Dubbele trainingen zonder waarschuwing.** Het teamplan en het clubplan hebben allebei `bron: seizoensplan`. De botsingcontrole bij toewijzen slaat alles met die bron over, dus als een coach een eigen plan heeft en de club wijst er één toe, staan er twee trainingen per trainingsdag. Bij "Trainers vrij" kan dat gewoon.
- **Losse trainers (zonder club) krijgen niets op Oefenstof.** De rules eisen een `club` op een training en het laden gaat per club. Seizoensplan opslaan eindigt in "Plan bewaard, maar de trainingen zijn niet op Trainingen gezet"; Oefenstof toont "Elke zondag zet je clubadmin hier …".
- **Twee weergaven van dezelfde training.** In Training maken een rijk scherm (tijdlijn, tabs Uitvoering/Coach/Differentiatie); op Oefenstof dezelfde training als platte blokken. En de training in de week-preview van Seizoen is niet dezelfde als die je krijgt met "Open in Training maken" (andere seed).

## 4. Wat ziet elke rol nu?

| Rol | Trainers vrij (standaard) | Club stuurt |
|---|---|---|
| Coach | Oefenstof, Training maken, Seizoen (eigen teamplan) | alleen Oefenstof |
| Coach met "Mag zelf plannen" | — | als Trainers vrij |
| Bouwcoördinator / hoofd jeugd / admin | Club › Seizoensplan (eigen bouw / alles) **én** Training maken + Seizoen op elk team dat ze openen | idem |
| Trainingscoördinator | eigen scherm met alle trainingen van de club | idem |
| Losse trainer | Training maken, Seizoen; Oefenstof blijft leeg | — |
| Eindbaas | alles, per club via Meehelpen | idem |

Het lastigste punt: een coördinator ziet twee verschillende dingen die allebei "seizoensplan" heten (Club › Seizoensplan en Team › Seizoen), die elkaar niet kennen en allebei het hele seizoen wegschrijven.

## 5. Voorstel: één lijn, drie woorden

**Seizoensplan = wat** (thema per week). **Training maken = hoe, deze keer.** **Trainingen = waar het staat.**

1. **Eén seizoensplan per team, met één eigenaar.** Wijst de club een plan toe, dan is dat hét plan van het team: de coach ziet het onder Seizoen (alleen lezen, met "van de club") en het eigen teamplan verdwijnt (of wordt gearchiveerd). Een coach met een eigen plan kan alleen een clubplan krijgen na een bevestiging van de coördinator ("vervangt het plan van de trainer"). Dan zijn dubbele trainingen onmogelijk.
2. **Seizoensplan schrijft het seizoen niet meer vol.** Het plan bewaart blokken en thema's; de trainingen verschijnen per week op Trainingen, de week ervoor (maandag). De rest is te zien in Seizoen, niet in de lijst. Zo blijft Trainingen kort en klopt de "nieuw"-teller.
3. **Training maken opent op de eerstvolgende training uit het plan** en past die aan op vandaag (spelers uit de presentie, weer, veld, materiaal). "Bewaar" vervangt die training op Trainingen in plaats van er één naast te zetten. Zonder plan werkt het zoals nu.
4. **Clubplan per team aanvullen met wat het team zelf heeft:** duur volgens leeftijd (45/60/75), trainingsdagen en aantal spelers van het team, en meldingen zichtbaar voor de coördinator.
5. **Losse trainers:** trainingen in de eigen teamruimte (`teams/{id}/trainingen`) of `club` vervangen door een eigenaarsveld in de rules. Eigen beslissing, want het raakt rules.
6. **Namen:** tegel en desktop allebei **Trainingen** (Oefenstof verdwijnt als woord); **Seizoen** voor het plan op team- en clubniveau; Presentie-tegel "Training" wordt "Aanwezig training".
7. **Niveau sterker laten wegen** (complexiteit ×3 i.p.v. ×2 en Midden/Hoog verder uit elkaar), en bij Duur 75 een vijfde, korte vorm of een langere kern toestaan. Pas na een praktijktest; dit is smaak.

### Beslispunten voor Paul

| # | Vraag | Mijn keuze |
|---|---|---|
| 1 | Eén plan per team, clubplan wint bij Club stuurt en vraagt bevestiging bij Trainers vrij | Ja |
| 2 | Trainingen per week zichtbaar (maandag van de week ervoor) in plaats van het hele seizoen | Ja |
| 3 | Training maken = de geplande training aanpassen, bewaren vervangt | Ja |
| 4 | Losse trainers: trainingen onder het team (rules-wijziging, aparte deploy) | Ja, als eigen release |
| 5 | Oefenstof → Trainingen overal | Ja |
| 6 | Niveau/duur sterker laten werken | Na praktijktest |

Volgende stap na akkoord: mockup (telefoon 414×896 en desktop) van Team › Trainingen, Team › Seizoen en Club › Seizoen, daarna code in twee releases (1–3 en 5 client-only; 4 met rules).

## Uitgevoerd (11-11-2026)

Beslispunten 1–5 akkoord ("prima") en gebouwd in releases 20261111c en 20261111d (PR #57), volgens de mockup "Cluppie Trainingen en Seizoen". Punt 6 wacht op een praktijktest. Release B (losse trainers) bleek zonder rules-wijziging te kunnen: de trainingen staan onder het team. Wel één rules-wijziging gevonden en gemaakt: een bouwcoördinator kon de trainingen van zijn eigen bouw niet schrijven, waardoor toewijzen door een coördinator mislukte. Details en deploy-volgorde in PORTEREN.md.
