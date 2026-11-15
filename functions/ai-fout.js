/* ==================== AI-FOUTEN EN VERBRUIK [20261115d] ====================
   Zuivere hulpjes voor de aanroep van het taalmodel (zie claude() in index.js), los te testen.

   foutVanAntwoord: vertaalt een mislukt antwoord van de Anthropic-API naar de fout voor de app.
     - 429, 5xx (ook 529 overbelast)  → unavailable: tijdelijk, later opnieuw proberen.
     - 402, of 400 met een melding over tegoed of bestedingslimiet → failed-precondition: het
       AI-tegoed van Cluppie is op. Dat is geen storing en ook geen fout van de gebruiker; de app
       toont dan "AI staat nu uit" en valt terug op de standaardtekst.
     - overige 4xx (400/401/403/404/413) → internal: onze aanvraag of sleutel is afgewezen.
   verbruikRegel: één logregel met de tokens, zodat in de logs te zien is of prompt caching werkt
     (cacheLezen > 0 bij een tweede vraag binnen 5 minuten). Bevat geen inhoud van de vraag. */

const TEGOED_RE = /credit balance|usage limit|spend limit|billing/i;

function foutVanAntwoord(status, tekst = ''){
  let type = '', bericht = '';
  try {
    const j = JSON.parse(tekst);
    type = String(j?.error?.type || '');
    bericht = String(j?.error?.message || '');
  } catch { bericht = String(tekst || ''); }

  if (status === 429 || status >= 500)
    return { code: 'unavailable', bericht: 'Het taalmodel is even niet bereikbaar.', soort: 'tijdelijk' };
  if (status === 402 || type === 'billing_error' || (status === 400 && TEGOED_RE.test(bericht)))
    return { code: 'failed-precondition', bericht: 'AI is tijdelijk uitgeschakeld: het AI-tegoed van Cluppie is op. De rest van de app werkt gewoon.', soort: 'tegoed' };
  return { code: 'internal', bericht: 'Het AI-verzoek is afgewezen door het taalmodel. Dit ligt aan de instelling van de app, niet aan jouw invoer.', soort: 'afgewezen' };
}

function verbruikRegel(model, usage){
  const u = usage || {};
  const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return `[claude] verbruik model=${model} invoer=${n(u.input_tokens)} cacheSchrijven=${n(u.cache_creation_input_tokens)} cacheLezen=${n(u.cache_read_input_tokens)} uitvoer=${n(u.output_tokens)}`;
}

module.exports = { foutVanAntwoord, verbruikRegel };
