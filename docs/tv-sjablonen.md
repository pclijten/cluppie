# Tv-sjablonen voor de kantine-tv

Een club kiest bij **Activiteiten › Kantine-tv en sponsoren** hoe de tv eruitziet. Elke keuze is een *sjabloon*.
Dit document legt uit hoe je een sjabloon toevoegt, wijzigt of weghaalt.

## Waar staat wat

| Bestand | Wat het doet |
| --- | --- |
| `public/js/tv-sjablonen.js` | De lijst: id, naam en korte omschrijving per sjabloon. Hieruit komt de keuzelijst bij de instellingen. |
| `public/js/tv-sjabloon-<id>.js` | Eén sjabloon: alleen html en css. Wordt pas geladen als een tv het nodig heeft. |
| `public/js/tv-speler.js` | Alles wat voor elk sjabloon gelijk is: schalen, dia's wisselen, klok, doelpunt-moment, hulpfuncties. |
| `public/js/tv-stijl.js` | Het tactisch bord (sjabloon `bord`). Dat is ouder en loopt niet via de speler. |
| `public/js/scherm-boot.js` | De tv-pagina (`?scherm=<tv>`): leest de gegevens en geeft ze aan de speler. |
| `public/fonts/tv/` | De lettertypes voor de tv, zelf gehost. |

De keuze van de club staat in `clubTv/{id}.sjabloon`, de keuze voor doelpunten in `clubTv/{id}.goals`
(`park` = alleen wedstrijden op het eigen sportpark, `alle`, of `uit`).

## Een sjabloon toevoegen

1. Kopieer een bestaand sjabloon, bijvoorbeeld `tv-sjabloon-affiche.js`, naar `tv-sjabloon-<id>.js`.
   De id bestaat uit kleine letters, cijfers en streepjes.
2. Pas in het nieuwe bestand de `id` aan en geef alle klassen een eigen voorvoegsel (zie de regels hieronder).
3. Zet in `tv-sjablonen.js` één regel in `SJABLONEN` en één regel in `LADERS`.
4. Draai `node tools/versie.mjs <versie> origin/main` en `npm test`.

Daarna staat het sjabloon in de keuzelijst. Bekijken kan zonder iets op te slaan:

```
?scherm=<tv-id>&sjabloon=<id>&proef=1
```

`sjabloon=` kiest het sjabloon voor deze ene keer, `proef=1` vult het scherm met proefwedstrijden waarin om de halve
minuut een doelpunt valt.

## Een sjabloon wijzigen of weghalen

- **Wijzigen:** alleen het eigen bestand aanpassen. De id blijft gelijk, want die staat bij de clubs opgeslagen.
  Naam en omschrijving mogen wel veranderen.
- **Weghalen:** de regel uit `SJABLONEN` halen. Clubs die het sjabloon hadden vallen terug op het tactisch bord.

## Wat een sjabloon levert

Het bestand exporteert één object:

```js
export default {
  id: 'affiche',     // gelijk aan de bestandsnaam en de regel in tv-sjablonen.js
  per: 5,            // wedstrijden per programmapagina
  duur: 12000,       // milliseconden per dia
  css: `...`,        // alle opmaak van dit sjabloon
  kader: m => html,                    // wat blijft staan: naam, klok, lopende band
  programma: (m, rijen, pag) => html,  // een pagina van het programma; pag = { nr, van }
  uitslagen: m => html,                // standen en uitslagen (alleen als er een stand is)
  dia: (m, x) => html,                 // een sponsor of eigen scherm
  goal: (m, g) => html,                // het doelpunt-moment, 9 seconden over het hele beeld
  fx: () => html,                      // mag: een overgang die bij elke wissel over het beeld gaat
};
```

Het beeld is een vast vlak van 1920 × 1080 px dat meeschaalt met de tv. Reken dus in gewone px.

### Het model `m`

| Veld | Inhoud |
| --- | --- |
| `club`, `logo`, `kleur` | Naam, logo en clubkleur |
| `dag` | "zaterdag 28 november" |
| `med` | De mededeling, of leeg |
| `rijen` | Alle wedstrijden van vandaag |
| `live`, `straks`, `klaar` | Dezelfde wedstrijden, per status |
| `top` | De eerstvolgende thuiswedstrijd, of `null` |
| `sponsors`, `hoofd` | De sponsoren en de eerste daarvan |
| `dias` | Sponsoren en eigen schermen samen |

Een wedstrijd (`r`): `tijd`, `a` (thuis), `b` (uit), `thuis`, `veld`, `kk`, `plek` ("Veld 1 · kk 3"), `score` ("2–1" of leeg),
`status` (`live`, `straks`, `klaar`, `af`, `voorbij`), `eigen` (het team van de club) en `tegen`.

Een dia (`x`): `soort` (`sponsor` of `scherm`), `pakket`, `titel`, `tekst`, `img`.

Een doelpunt (`g`): `team` (wie scoorde), `a`, `b`, `stand` ("3–1"), `veld`, `thuis`, `eigen`.
Er komen geen namen van spelers op de tv.

### Hulpfuncties uit `tv-speler.js`

`esc` (altijd om tekst van de club heen), `maat(tekst, px, tekens)` en `maatWoord` (lettergrootte die krimpt bij lange
namen), `klok`, `stip` (rood live-bolletje), `lint(html, sec)` (lopende band), `beeld(x, klasse)` (logo of afbeelding),
`bovenSponsor(x)`, `label(r)` en `plek(r)`.

Kleuren: `var(--club)`, `var(--club-ink)` (leesbare tekstkleur op de clubkleur), `var(--club-d)`, `var(--club-dd)` en
`var(--club-l)`. Letters: `var(--ts-display)` en `var(--ts-body)`.

## Regels

1. **Eigen voorvoegsel voor klassen.** De tv draait in dezelfde pagina als de app, dus een klasse die al in
   `styles.css` bestaat krijgt die opmaak erbij. Kies een voorvoegsel dat nog niet voorkomt
   (`grep -c "\.xx-" public/styles.css`). In gebruik: `wa- vh- af- be- vdk- sn- lk- pb- ku- lo-` en `ts-` voor de speler.
   Losse korte klassen (`.m`, `.tt`) alleen binnen een eigen klasse: `.xx-rij .m{}`.
2. **Instap alleen onder `.ts-in`, vertrek onder `.ts-uit`.** Verandert er een stand terwijl een dia staat, dan zet
   de speler dezelfde dia opnieuw neer met `.ts-stil`. Die mag niet opnieuw invliegen.
3. **Lange namen.** Gebruik `maat()` of de klasse `ts-kap` bij namen van teams en sponsoren. Test met
   "Roda JC Kerkrade JO17-2".
4. **Lichte clubkleur.** Tekst op de clubkleur krijgt `var(--club-ink)`, nooit vast wit.
5. **Geen bestanden van buiten.** Lettertypes en beelden komen van de eigen site.
6. **Lege dag.** `programma` krijgt ook een lege lijst; laat dan een nette regel zien.

## Doelpunten

De coach houdt de stand bij in de app. De functie `kantineTvWedstrijd` zet een nieuwe stand meteen in het programma
van de tv. De tv-pagina vergelijkt de stand met de vorige (`nieuweGoals` in `clubscherm-logica.js`) en roept bij een
doelpunt `goal(m, g)` van het sjabloon aan. Een uitslag die achteraf wordt ingevuld of een correctie naar beneden geeft
geen melding.
