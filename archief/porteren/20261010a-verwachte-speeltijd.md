# Verwachte speeltijd bij geplande wissels (ASV'33 PR #2, release 20261010a)

Bron: `pclijten/cluppieasv33`, PR #2 (branch `feat/verwachte-speeltijd`, commit 1d1cbbc).
Status in cluppie.io: **ingebouwd**, branch `feat/verwachte-speeltijd`.

## Waarom
Een geplande wissel (`k.plan`) is alleen een herinnering. `analyseKwart` rekent uit de startopstelling en de echte wissel-events en negeert het plan terecht. Wie vooraf wissels plant, zag in de speeltijdtabel toch de volle periodeduur voor de uitgaande speler en niets voor de invaller.

## Gedrag voor de gebruiker
- Onder **Speeltijd deze wedstrijd** staat bij geplande wissels de verwachte speeltijd, schuin met een `~`.
- Bij elke geplande wissel een label `uit 6:00` / `in 6:00`, beide in dezelfde kleur. Een tweede wissel in dezelfde periode krijgt de volgende kleur (amber, blauw, paars, daarna herhalend).
- Onder het echte totaal staat, alleen als het afwijkt, het verwachte totaal klein en schuin.
- Schakelaar **Verwachte speeltijd tonen** (alleen zichtbaar als er een plan is). Uit: de tabel toont alleen de echte speeltijd.
- "Wie aan de beurt is": alleen de uitgaande speler krijgt een label en een ★. De invaller staat pas vast op het wisselmoment.
- Zonder geplande wissels is de tabel byte voor byte gelijk aan de oude (geen schakelaar, geen legenda).

## Harde eis: echte speeltijd ongewijzigd
`analyseKwart` en `analyseWedstrijd` zijn niet aangepast. Statistieken, spelersprofielen, verslag, selectie-bouw, bank-sortering en "wie aan de beurt is" blijven op de echte speeltijd. Geen wijziging in datamodel of Firestore. `state.js` is niet aangeraakt; de schakelaar leeft als runtime-vlag op `S` (`S._toonVerwacht`, `S._speeltijdOpen`).

## Regels in de berekening
- Een geplande wissel telt niet mee als de uitgaande speler niet op het veld staat of het veld alsnog via een echte wissel verlaat; als de invaller al op het veld staat of er alsnog via een echte wissel in komt; of als de minuut buiten de periode valt.
- Wissels in een afgelopen periode (klok stil op/voorbij de periodeduur) die nog in het plan staan worden genegeerd. Daarvoor is de handmatige speeltijd-correctie.
- Handmatige correcties gaan altijd voor.

## Afwijkingen t.o.v. ASV'33 en keuzes (akkoord Paul, 2026-10-10)
1. **Bestanden:** de root is de bron. `public/` bevat alleen de stubs uit fase 1.
2. **Versie:** globale bump `20260929z` naar `20261010a` (alle `?v=`, `index.html`, `CACHE_VERSIE` in `sw.js`), zoals eerdere releases. `firebase.js` en `icons.js` houden hun eigen `20260922c`.
3. **`WISSEL_BEURT`:** één bron in `analyse.js`; `wedstrijd.js` en `teams-hub.js` importeren die (voorheen twee losse kopieën).
4. **Gecorrigeerde cel:** een cel met handmatige correctie toont geen `~` en geen label. Het is dan een echte, door de coach gezette tijd. Het verwachte totaal blijft wel kloppen.
5. **Desktop:** de balkenweergave in `desktop-schermen.js` (`zijGespeeld`) is niet aangepast.
6. De tabel zonder plan blijft ongewijzigd doordat de `<div>`-omhulsels van de nieuwe cellen alleen bij een geplande wissel worden gebruikt.

## Aangeraakt
`analyse.js` (alleen toevoegingen), `wedstrijd.js` (import, tabel, schakelaar), `teams-hub.js` (import), `styles.css` (nieuw blok achteraan, tokens `--wissel-a/b/c` per thema), `teams.js` (changelog), `teams-handleiding.js` (alinea + zoektekst bij "Wissels vooraf plannen"), versiebump.

## Tests (uitgevoerd)
Testwedstrijd uit het porteerdocument (12 min, 4 periodes) tegen de echte `analyse.js`:
- Echt naar verwacht: Daan 24→25, Finn 36→29, Sem 36, Noah 36→33, Lucas 36, Milan 20→26, Tim 16, Jesse 12.
- Rollen K2 en K3 en de ★ bij "beurt" kloppen.
- `analyseWedstrijd` identiek met en zonder plan; plan in afgelopen periode genegeerd; uitgaande speler al echt gewisseld genegeerd; correctie gaat voor.
- HTML van de tabel zonder plan identiek aan de oude code.
- Beide thema's op 414×896 met de echte `styles.css`; bij `--fs` 1,3 scrollt de tabel horizontaal, naam- en totaalkolom blijven staan en de actieve periode schuift in beeld.
- Validatie: `node --check` per bestand, acorn (`ecmaVersion:2022`, `sourceType:'module'`) op alle 52 app-bestanden, `tinycss2` op `styles.css`.

Niet getest: de volledige app tegen Firebase (geen toegang in deze omgeving). Check op een testwedstrijd met een gepland wissel na deploy.
