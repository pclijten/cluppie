# PDF-trainingen per club: voorstel (14-11-2026)

## Wat er al is
De upload uit ASV'33 staat volledig in cluppie.io (release 20261020b): één PDF, meerdere PDF's of een zip met een blokplanning.
Per PDF gebeurt dit:

1. **Bestandsnaam → planning** (`training-plan.js`, `herkenNaam`): "Blok 2 - Week 1 - Training 1", "Week 6 - Thema - Training 2". Bladen met "Overzicht" worden overgeslagen.
2. **Plaatjes** (`training-ai.js`): per pagina de *ingebedde afbeeldingen* (de veldjes), kleine logo's eruit.
3. **Tekst → oefeningen** (`structureerTraining`): de AI deelt de tekst letterlijk op in oefeningen en blokken ("meestal 1 per pagina"). Daarna telt de app woord voor woord of er niets is weggelaten of verzonnen. Afwijkers wachten op een blik.

Dat werkt goed voor PDF's die op die van ASV'33 lijken. Andere clubs wijken af op een paar vaste punten, niet in de basis.

## Waar PDF's per club verschillen
| Verschil | Wat er nu gebeurt |
| --- | --- |
| Veldtekening is een vectortekening (Word, tekenprogramma), geen ingebedde afbeelding | Geen plaatje bij de oefening |
| Hele training op één pagina, of één oefening over twee pagina's | AI moet raden; "meestal 1 per pagina" zit in de prompt |
| Voorblad, legenda of uitlegpagina's | Komen mee als "oefening" |
| Eigen koppen ("Aandachtspunten", "Organisatie", "Variatie") | Gaan goed, de AI neemt koppen letterlijk over |
| Andere bestandsnamen ("Training 12 - Passen.pdf", datums) | Geen planning herkend; de beheerder kiest het zelf |
| Club heeft geen AI-module | Alleen de PDF, geen scrolbare oefeningen |

## Voorstel: een PDF-profiel per club (gegevens, geen code)
Geen aparte code per club, maar één klein profiel in `clubs/{id}.instellingen.pdf`. De standaard is precies het huidige gedrag, dus ASV-achtige PDF's hebben niets nodig.

```
pdf: {
  indeling:   'pagina' | 'geheel' | 'auto',        // 1 oefening per pagina (standaard) · hele training per pagina · AI bepaalt
  plaatjes:   'afbeeldingen' | 'pagina' | 'geen',  // ingebedde veldjes (standaard) · hele pagina als plaatje · geen
  overslaan:  { eerstePagina: false, woorden: ['Overzicht', 'Legenda'] },
  naam:       'auto' | 'geen',                     // planning uit de bestandsnaam (standaard) · altijd zelf kiezen
  aanwijzing: ''                                   // max. 500 tekens extra uitleg voor de AI, bv. "De kop Organisatie hoort bij Benodigdheden."
}
```

**Zo werkt het instellen (maatwerk in 5 minuten):**
1. Platform › Clubs › club openen › nieuw tabblad **PDF-trainingen**.
2. Sleep één voorbeeld-PDF van de club erin. Je ziet meteen het resultaat zoals een trainer het ziet, met de woordcontrole.
3. Klopt iets niet, verander een keuze (bv. Plaatjes → hele pagina) of typ een aanwijzing. Opnieuw proberen gaat met dezelfde PDF.
4. Bewaren. Vanaf dan gebruiken alle uploads van die club dit profiel.

**Wat er technisch verandert:**
- `training-ai.js`: leest het profiel. Bij `plaatjes: 'pagina'` rendert hij de hele pagina als plaatje (pdf.js doet dat al voor de terugval). Bij `overslaan` vallen pagina's weg vóór de AI.
- `structureerTraining`: krijgt `indeling` en `aanwijzing` als tweede systeemblok (na de vaste prompt, met cache). De aanwijzing gaat door `scrubPII` en is begrensd. De woordcontrole blijft ongewijzigd, dus een aanwijzing kan de tekst niet laten herschrijven.
- `training-plan.js`: `naam: 'geen'` slaat de herkenning over.
- Rules: geen wijziging (`instellingen` schrijft de clubbeheerder al; het platform via de ondersteuningsmodus of een functie).
- Tests: profiel-standaard = huidig gedrag; overslaan; prompt bevat de aanwijzing alleen als die er is.

Omvang: één release, ongeveer zoals de bibliotheek-beheerlaag.

## Waarom niet anders
- **Code per club**: werkt, maar elke nieuwe club kost een release.
- **AI alles laten raden**: kost meer per PDF en geeft wisselende resultaten. De woordcontrole vangt fouten, maar de plaatjes (vector) blijven dan toch weg.
- **Clubs vragen een vast sjabloon te gebruiken**: de oefenstof komt vaak van een externe partij; daar heeft de club geen grip op.

## Beslispunten
1. Wie stelt het profiel in: alleen jij als platformbeheerder (voorstel), of ook de clubbeheerder?
2. Mag het omzetten ook bij clubs zonder AI-module? Het kost ongeveer een cent per PDF. Voorstel: ja, als apart onderdeel "PDF omzetten" met een limiet per maand, los van de AI-chat.
3. Mogen losse trainers (zonder club) ook PDF's uploaden? Voorstel: nee, dit blijft een clubfunctie.
