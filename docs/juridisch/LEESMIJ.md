# WP7 — Juridisch en AVG: concepten

16-11-2026. **Dit zijn concepten, geschreven door een AI.** Ze zijn niet gepubliceerd, niet verstuurd en niet door een jurist gelezen. Gebruik ze als startpunt voor een jurist of privacyadviseur, niet als eindtekst. Het gaat om gegevens van minderjarigen; een fout hier is duur.

| Document | Voor wie | Stand |
|---|---|---|
| `verwerkersovereenkomst-concept.md` | Club (verantwoordelijke) en Cluppie (verwerker) | Concept. De app heeft al een digitale verwerkersovereenkomst in Club › Toegang & privacy; deze tekst moet daarmee vergeleken worden. |
| `voorwaarden-losse-trainers-concept.md` | Trainer zonder club | Concept. Bevat de lastigste vraag: wie is verantwoordelijke als er geen club is. |
| `verwerkingsregister-concept.md` | Cluppie intern, en als hulp voor clubs | Concept, afgeleid uit de code en `AVG.md`. |
| `datalekprocedure-concept.md` | Cluppie intern, afspraak met clubs | Concept. |
| `dpia-concept.md` | Privacyadviseur; clubs als basis voor hun eigen DPIA | Concept van 21-11-2026: beschrijving, toets en een risicotabel met een eerste inschatting. Geen DPIA tot een adviseur het heeft beoordeeld en betrokkenen zijn gehoord. |
| Privacyverklaring | Iedereen | Bestaat: `public/privacy.html` (versie 2026-10). Aanvullingen hieronder. |

## Aanvullingen op de bestaande privacyverklaring

Uit de code volgt dat deze punten erin horen. Niet doorgevoerd, omdat een juridische tekst die live gaat eerst gelezen moet worden.

1. **Cluppie kan meekijken en helpen.** De platformbeheerder kan op verzoek maximaal twee uur als clubbeheerder in één club werken. Start en stop staan in het toegangslog van de club. Een club kan dit uitzetten.
2. **Wat de platformbeheerder altijd ziet.** Per club: teamnamen, namen van coaches, aantallen. Van trainers zonder club: naam, e-mailadres, aanmelddatum, laatste login, teamnaam en aantal spelers. Geen spelersnamen.
3. **Delen met ouders.** Een gedeelde training toont naam en rugnummer van de spelers aan wie de link heeft, tot de link verloopt.
4. **AI.** Alleen als de platformbeheerder het voor de club aanzet. Namen, e-mailadressen, telefoonnummers en postcodes worden vóór verzending weggehaald. De verwerker is Anthropic (Verenigde Staten).
5. **Sportlink.** Spelers ophalen gebeurt alleen op verzoek van een coach; alleen de voornaam, en de achternaam als de club die vastlegt.

## Wat een jurist in elk geval moet beoordelen

1. De rolverdeling bij de **losse trainer**: is de trainer zelf verantwoordelijke, of Cluppie? Dat bepaalt de hele tekst van de voorwaarden.
2. Of **toestemming van ouders** nodig is, of dat de club en de trainer zich op gerechtvaardigd belang of de uitvoering van het lidmaatschap kunnen beroepen, ook voor beoordelingen en leerpunten.
3. De **doorgifte naar de Verenigde Staten** (Anthropic; mogelijk Firebase Authentication) en welke waarborgen daarbij horen.
4. Of een **DPIA** verplicht is vóór de uitrol naar meer clubs. `AVG.md` adviseert van wel.
5. **Bewaartermijnen** voor spelers die vertrokken zijn: sinds 21-11-2026 kiest de club een termijn en ruimt de clubbeheerder op vanuit de app (voorstel: één jaar na het seizoen van vertrek; drie seizoenen). Te beoordelen: de termijnen zelf, en of opruimen vanzelf moet gebeuren in plaats van na een bevestiging.
6. **Aansprakelijkheid** in de verwerkersovereenkomst voor een eenmanszaak.

## Openbare repo

Deze map staat in een openbare GitHub-repo. Zet hier geen ondertekende overeenkomsten, namen van contactpersonen bij clubs of meldingen van datalekken in.
