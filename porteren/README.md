# Porteren: assists + 1e/2e elftal (ASV'33 release 20260928e)

**Status in cluppie.io:** klaar om in te bouwen zodra de wedstrijd- en stats-schermen er zijn (fase 2).
De logica staat al klaar in `elftallen.js` en kan nu al mee naar `public/js/` en `src/`.

## Wat de feature doet
1. **Assists** — na de scorer kiest de coach wie de assist gaf, of "Geen assist". De minuut wordt vastgelegd bij de eerste tik. Assists zijn aan te passen bij *Doelpunt corrigeren* en *Doelpunt toevoegen*. Ze staan in de stats (kolom A), in het spelersprofiel, in het wedstrijdverslag, in de Excel-export en in de gepseudonimiseerde AI-verslagdata (`assists: [{speler:'Speler N', aantal}]`).
2. **1e + 2e elftal binnen één team** — voor een selectie die met twee elftallen speelt. Spelers wisselen zonder uitlening, cijfers blijven bij elkaar.
   - Clubadmin zet het aan per team, met optioneel een Sportlink-team voor het 2e.
   - Coach wijst spelers toe: 1e / 2e / Beide.
   - Bij een nieuwe wedstrijd kiest de coach het elftal. Spelers van dat elftal staan vooraf in de selectie, de rest staat onder "Rest van de selectie" als *niet mee* (geen afwezigheid, geen redenkeuze).
   - Selectie-dashboard bovenaan de team-home met het filter 1e / 2e / Totaal: wedstrijden, goals, assists, W-G-V en per speler W/G/A/minuten (top 8 + "Toon alle").
   - Stats en desktop-stats met hetzelfde filter. Bij Totaal staat de verdeling 1e/2e onder elk getal, plus een minutenbalk voor spelers die bij beide horen.
   - Spelersprofiel: blok "Per elftal".

## Datamodel (gelijk houden aan ASV'33, dan kan migratie 1-op-1)
| ASV'33 | cluppie.io | veld |
|---|---|---|
| `teams/{id}` | `clubs/{clubId}/teams/{id}` | `tweedeElftal: { sportlinkNaam }` (aanwezig = aan) |
| `teams/{id}/spelers/{pid}` | `.../players/{pid}` | `elftal: '1' \| '2' \| 'b'` (leeg = '1') |
| `teams/{id}/wedstrijden/{wid}` | `.../matches/{mid}` | `elftal: '1' \| '2'` (leeg = '1') |
| goal-event in `goals[]` | idem | `assist: pid` (optioneel, ≠ `pid`) |

Firestore-rules: in cluppie.io is niets nodig, want coaches schrijven al teams, players en matches. Wil je dat alleen de clubadmin `tweedeElftal` aanzet (zoals in ASV'33), maak dat dan een aparte regel of een Cloud Function.

## Bestanden in deze map
- `elftallen.js` — **cluppie.io-versie**: alleen logica en opslaan, met paden `clubs/{clubId}/…`. Geen DOM. Neerzetten als `public/js/elftallen.js` (en `src/elftallen.js`).
- `asv33-elftallen.js` — het origineel uit ASV'33 (met dashboard-HTML en toewijs-modal), als referentie voor de UI.
- `asv33-assists-elftallen.patch` — de volledige ASV'33-diff zonder de versie-bumps. Laat precies zien waar in wedstrijd.js, stats, profiel, hub, desktop en club-beheer iets veranderde.

## Inbouwen in cluppie.io (checklist, fase 2)
- [ ] `elftallen.js` in `public/js/` + `src/`
- [ ] Goal loggen: scorer → assist-stap (`maakGoal`)
- [ ] Doelpunt corrigeren/toevoegen: assist-keuze; bij "Toch een tegendoelpunt" `assist` weghalen
- [ ] Stats: kolom A, filter 1e/2e/Totaal (`filterOpElftal`)
- [ ] Nieuwe match: elftalkeuze, voorselectie via `spelersVoorElftal`; standaardselectie voor geïmporteerde matches ook via het elftal
- [ ] Selectie-/presentiescherm: groepen "Xe elftal" / "Rest van de selectie", status *niet mee*
- [ ] Team-home: selectie-dashboard (`selectieCijfers`) + toewijzen (`zetElftalSpeler`)
- [ ] Teambeheer (clubadmin): 1e + 2e elftal aan/uit + Sportlink 2e (`zetTweedeElftal`)
- [ ] i18n: teksten nl/en (Assist, Geen assist, 1e/2e elftal, Totaal, Spelers toewijzen, Rest van de selectie, Niet mee)
- [ ] Sync (functions): `tweedeElftal.sportlinkNaam` lezen, `elftal: '2'` op matches van het 2e, stand/programma van het 2e apart opslaan

## Nog open in ASV'33 zelf
De Sportlink-sync voor het 2e elftal (`functions/index.js` van ASV'33, niet in de repo). Bouw het in cluppie.io direct goed in de sync.
