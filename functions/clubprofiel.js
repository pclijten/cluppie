/* ==================== CLUBPROFIEL: documenten van een club analyseren ====================
   Alleen de platformbeheerder (eindbaas). Hij leest de documenten van een club in (beleidsplan,
   jeugdplan, reglement …); de AI zet wat erin staat in een vaste set hoofdstukken met velden
   (public/js/clubprofiel-logica.js). Eén aanroep = één stuk tekst van één document.

   De functie bewaart niets: de app schrijft de bevindingen naar clubprofielen/{clubId}
   (rules: alleen de platformbeheerder). Het telt niet mee in de AI-limiet van de club.

   Controle op de uitkomst:
   - alleen velden die de app meestuurde (of "<hoofdstuk>.overig");
   - elk citaat wordt teruggezocht in de tekst; lukt dat niet, dan citaatOk: false (de app waarschuwt);
   - e-mailadressen en telefoonnummers worden uit uitkomst en citaat gehaald.
   AVG: de tekst gaat naar het model en wordt nergens opgeslagen; de instructie verbiedt namen van personen. */
const MAX_TEKST = 30000;
const tekst = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

function leesJson(rauw){
  let t = String(rauw || '').trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

/* De hoofdstukken en velden zoals de app ze meestuurt, begrensd. */
function schoonHoofdstukken(h){
  return (Array.isArray(h) ? h : []).slice(0, 30).map(x => ({
    id: tekst(x && x.id, 30).replace(/[^a-z]/g, ''), naam: tekst(x && x.naam, 60),
    velden: (Array.isArray(x && x.velden) ? x.velden : []).slice(0, 15)
      .map(v => ({ id: tekst(v && v.id, 40).replace(/[^a-z.]/g, ''), label: tekst(v && v.label, 80), vraag: tekst(v && v.vraag, 200) }))
      .filter(v => v.id && v.label),
  })).filter(x => x.id && x.naam && x.velden.length);
}

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-\s*\n\s*/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/* Staat het citaat in de tekst? Letterlijk (zonder leestekens en regeleinden), of anders: komt minstens
   60% van de reeksen van vijf woorden uit het citaat in de tekst voor (een PDF breekt regels en woorden af). */
function citaatKlopt(bron, citaat){
  const c = norm(citaat), t = norm(bron);
  if (!c) return false;
  if (t.includes(c)) return true;
  const w = c.split(' ');
  if (w.length < 6) return false;
  let goed = 0, totaal = 0;
  for (let i = 0; i + 5 <= w.length; i++){ totaal++; if (t.includes(w.slice(i, i + 5).join(' '))) goed++; }
  return goed / totaal >= 0.6;
}
const MASKER = [[/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[e-mailadres]'], [/(?:\+31|0031|\b0)[\s-]?[1-9](?:[\s-]?\d){8}\b/g, '[telefoonnummer]']];
const maskeer = s => MASKER.reduce((t, [re, v]) => t.replace(re, v), String(s || ''));

/* De uitvoer van het model: alleen bekende velden, hoogstens drie uitkomsten per veld, citaat gecontroleerd. */
function schoonUitvoer(json, hoofdstukken, bron){
  const toegestaan = new Set();
  for (const h of hoofdstukken){ toegestaan.add(h.id + '.overig'); for (const v of h.velden) toegestaan.add(v.id); }
  const perVeld = {}, uit = [];
  for (const b of (Array.isArray(json && json.bevindingen) ? json.bevindingen : []).slice(0, 200)){
    const veld = tekst(b && b.veld, 40), waarde = tekst(b && b.waarde, 600), citaat = tekst(b && b.citaat, 400);
    if (!toegestaan.has(veld) || !waarde) continue;
    perVeld[veld] = (perVeld[veld] || 0) + 1;
    if (perVeld[veld] > 3) continue;
    const pagina = Math.round(Number(b.pagina));
    uit.push({ veld, waarde: maskeer(waarde), citaat: maskeer(citaat), citaatOk: citaatKlopt(bron, citaat),
      pagina: pagina > 0 && pagina < 5000 ? pagina : null, zeker: ['hoog', 'middel', 'laag'].includes(b.zeker) ? b.zeker : 'middel' });
  }
  return uit;
}

const INSTRUCTIE = `Je leest documenten van een Nederlandse amateurvoetbalclub (beleidsplan, jeugdplan, reglement, notitie) voor Cluppie, een app voor jeugdtrainers. Cluppie wordt per club ingericht zoals de club zelf werkt. Jij zoekt in het stuk tekst wat de club over elk onderwerp heeft vastgelegd.

Werkwijze:
- Gebruik uitsluitend wat in het stuk staat. Verzin niets, vul niets aan uit algemene voetbalkennis en geef geen advies.
- Per onderwerp (veld) geef je een bevinding als het stuk er iets over zegt. Zegt het stuk er niets over, dan sla je het veld over. Een leeg resultaat is goed.
- "waarde": de uitkomst in een of twee zinnen, feitelijk en in de woorden van de club. Neem namen van functies, bouwen, teams en formulieren letterlijk over. Bij een opsomming noem je alle onderdelen.
- "citaat": een letterlijk overgenomen fragment uit het stuk (hoogstens 300 tekens) waaruit de uitkomst blijkt. Wijzig het citaat niet en plak geen fragmenten aan elkaar.
- "pagina": het nummer uit de laatste regel "[pagina N]" boven het citaat. Staat er geen paginaregel, geef dan null.
- "zeker": "hoog" als het er letterlijk staat, "middel" als je het uit de tekst afleidt, "laag" als het alleen een aanwijzing is.
- Zegt het stuk over één veld twee verschillende dingen (bijvoorbeeld per leeftijd), geef dan hoogstens drie bevindingen voor dat veld.
- Staat er iets dat belangrijk is voor het inrichten van een coachapp en bij geen enkel veld past, gebruik dan het veld "<hoofdstuk-id>.overig" van het hoofdstuk waar het bij hoort.
- Noem nooit namen van personen: schrijf de functie ("de jeugdcoördinator"). Kies een citaat zonder naam, e-mailadres of telefoonnummer.
- Sla inhoudsopgaven, voorwoorden, financiën en contactlijsten over.

UITVOER: uitsluitend geldige JSON, zonder uitleg of markdown:
{"bevindingen":[{"veld":"<veld-id>","waarde":"…","citaat":"…","pagina":3,"zeker":"hoog"}]}`;

function veldenTekst(hoofdstukken){
  return 'HOOFDSTUKKEN EN VELDEN\n' + hoofdstukken.map(h => `\n${h.naam} (hoofdstuk-id: ${h.id})\n` + h.velden.map(v => `- ${v.id}: ${v.label}${v.vraag ? '. ' + v.vraag : ''}`).join('\n')).join('\n');
}

/* ---------- scans: tekst van een ingescande pagina overnemen ---------- */
const MAX_BEELD = 4500000;   // tekens base64 (ruim 3 MB aan JPEG)
const SCAN_INSTRUCTIE = `Je krijgt een foto of scan van één pagina uit een document van een Nederlandse voetbalclub. Neem alle tekst van de pagina letterlijk over, in de volgorde waarin je hem leest.
- Kopjes en opsommingen elk op een eigen regel. Een tabel: één rij per regel, cellen gescheiden door een tab.
- Verbeter niets en vat niets samen. Wat je niet kunt lezen schrijf je als [onleesbaar].
- Sla paginanummers, kop- en voetteksten en logo's over.
- Staat er geen tekst op de pagina, antwoord dan met precies: [leeg]
Geef alleen de overgenomen tekst, zonder uitleg.`;

/* ---------- een goedgekeurd antwoord omzetten naar instellingen van Cluppie ---------- */
const TYPES = ['tekst', 'getal', 'kleur', 'keuze', 'formatie'];
function schoonInstelVelden(v){
  return (Array.isArray(v) ? v : []).slice(0, 20).map(x => ({
    pad: tekst(x && x.pad, 80).replace(/[^A-Za-z0-9.]/g, ''), label: tekst(x && x.label, 80), uitleg: tekst(x && x.uitleg, 200),
    type: TYPES.includes(x && x.type) ? x.type : 'tekst', max: Math.round(Number(x && x.max)) || 40, min: Math.round(Number(x && x.min)) || 0,
    opties: (Array.isArray(x && x.opties) ? x.opties : []).slice(0, 8).map(o => ({ id: tekst(Array.isArray(o) ? o[0] : o && o.id, 30), naam: tekst(Array.isArray(o) ? o[1] : o && o.naam, 80) })).filter(o => o.id),
  })).filter(x => x.pad && x.label);
}
/* Eén voorgestelde waarde, of undefined als hij niet aan het veld voldoet. */
function schoonInstelWaarde(def, w){
  if (w === null || w === undefined || w === '') return undefined;
  if (def.type === 'getal'){ const n = Math.round(Number(w)); return Number.isFinite(n) && n >= def.min && n <= def.max ? n : undefined; }
  const t = tekst(w, 200);
  if (def.type === 'kleur') return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toLowerCase() : undefined;
  if (def.type === 'keuze') return def.opties.some(o => o.id === t) ? t : undefined;
  if (def.type === 'formatie') return /^\d(-\d){1,4}$/.test(t) ? t : undefined;
  return t && t.length <= def.max ? t : undefined;
}
const INSTEL_INSTRUCTIE = `Je helpt Cluppie, een app voor jeugdtrainers, in te richten voor een Nederlandse voetbalclub. Je krijgt antwoorden die uit de documenten van de club komen en door een mens zijn goedgekeurd, en een lijst instellingen. Zet de antwoorden om naar waarden voor die instellingen.
- Geef alleen een waarde als het antwoord hem duidelijk bevat. Bij twijfel laat je de instelling weg. Raad niet.
- "tekst": neem de woorden van de club over, kort, zonder lidwoord en zonder uitleg, en niet langer dan het maximum.
- "getal": een geheel getal binnen de grenzen. Een leeftijd als O11 of JO11 is 11. "tot en met" is het hoogste getal van de groep.
- "kleur": een hex-kleur als #cc0000 voor de hoofdkleur die de club noemt.
- "keuze": precies een van de genoemde opties.
- "formatie": alleen cijfers met streepjes, zonder keeper, zoals 4-3-3.
Antwoord uitsluitend met JSON, zonder uitleg: {"waarden":{"<pad>":<waarde>}}`;

function maak({ onCall, HttpsError, secrets, REGIO, claude, apiKey, isPlatformBeheerder, model, db }){
  const analyseerClubdocument = onCall(
    { region: REGIO, secrets, cors: true, timeoutSeconds: 300, memory: '512MiB', maxInstances: 3 },
    async (request) => {
      if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Documenten van een club inlezen kan alleen de platformbeheerder.');
      const d = request.data || {};
      const clubId = tekst(d.clubId, 80);
      if (!clubId || (db && !(await db().doc('clubs/' + clubId).get()).exists)) throw new HttpsError('not-found', 'Deze club bestaat niet.');
      const bron = String(d.tekst || '').replace(/[ \t]+\n/g, '\n').trim();
      if (bron.length < 80) throw new HttpsError('invalid-argument', 'Te weinig tekst om te analyseren.');
      if (bron.length > MAX_TEKST) throw new HttpsError('invalid-argument', 'Dit stuk is te lang. Stuur het in kleinere stukken.');
      const hoofdstukken = schoonHoofdstukken(d.hoofdstukken);
      if (!hoofdstukken.length) throw new HttpsError('invalid-argument', 'De hoofdstukken ontbreken.');
      const { tekst: rauw, stopReason } = await claude({
        apiKey: apiKey(),
        system: [{ type: 'text', text: INSTRUCTIE + '\n\n' + veldenTekst(hoofdstukken), cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Document: ${tekst(d.documentNaam, 120) || 'zonder naam'}\n\n--- STUK TEKST ---\n${bron}` }],
        maxTokens: 8000, temperature: 0.1, metaTerug: true, ...(model ? { model } : {}),
      });
      /* te veel uitkomsten voor één antwoord: de app halveert het stuk en probeert opnieuw */
      if (stopReason === 'max_tokens') throw new HttpsError('resource-exhausted', 'Dit stuk levert te veel op in één keer.');
      const json = leesJson(rauw);
      if (!json){
        console.error('[analyseerClubdocument] JSON niet leesbaar:', String(rauw).slice(0, 200));
        throw new HttpsError('internal', 'De analyse kon niet gelezen worden. Probeer opnieuw.');
      }
      return { bevindingen: schoonUitvoer(json, hoofdstukken, bron) };
    }
  );
  const eindbaas = async (request) => {
    if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Dit kan alleen de platformbeheerder.');
    const clubId = tekst(request.data && request.data.clubId, 80);
    if (!clubId || (db && !(await db().doc('clubs/' + clubId).get()).exists)) throw new HttpsError('not-found', 'Deze club bestaat niet.');
    return clubId;
  };
  /* Eén ingescande pagina (JPEG, base64) → de tekst die erop staat. De app stuurt daarna die tekst
     gewoon naar analyseerClubdocument. Beeld en tekst worden nergens opgeslagen. */
  const leesClubscan = onCall(
    { region: REGIO, secrets, cors: true, timeoutSeconds: 120, memory: '512MiB', maxInstances: 3 },
    async (request) => {
      await eindbaas(request);
      const beeld = String((request.data && request.data.beeld) || '').replace(/^data:image\/jpeg;base64,/, '');
      if (beeld.length < 2000 || !/^[A-Za-z0-9+/]+=*$/.test(beeld)) throw new HttpsError('invalid-argument', 'Geen leesbare afbeelding ontvangen.');
      if (beeld.length > MAX_BEELD) throw new HttpsError('invalid-argument', 'Deze pagina is te groot. Stuur hem kleiner.');
      const { tekst: rauw, stopReason } = await claude({
        apiKey: apiKey(), system: [{ type: 'text', text: SCAN_INSTRUCTIE, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: beeld } }, { type: 'text', text: 'Neem de tekst van deze pagina over.' }] }],
        maxTokens: 4000, temperature: 0, metaTerug: true, ...(model ? { model } : {}),
      });
      const uit = String(rauw || '').trim();
      return { tekst: /^\[leeg\]$/i.test(uit) ? '' : maskeer(uit), afgekapt: stopReason === 'max_tokens' };
    }
  );
  /* Goedgekeurde antwoorden → een voorstel voor instellingen. De app toont het voorstel in een formulier;
     er wordt hier niets ingesteld. Elke waarde wordt tegen het veld gecontroleerd (soort, grenzen, opties). */
  const stelClubinstellingenVoor = onCall(
    { region: REGIO, secrets, cors: true, timeoutSeconds: 60, maxInstances: 3 },
    async (request) => {
      await eindbaas(request);
      const d = request.data || {};
      const velden = schoonInstelVelden(d.velden);
      const antwoorden = (Array.isArray(d.antwoorden) ? d.antwoorden : []).slice(0, 12).map(x => tekst(x, 600)).filter(Boolean);
      if (!velden.length || !antwoorden.length) throw new HttpsError('invalid-argument', 'Er is niets om om te zetten.');
      const soort = v => v.type === 'getal' ? `, ${v.min} tot en met ${v.max}` : v.type === 'tekst' ? `, hoogstens ${v.max} tekens`
        : v.type === 'keuze' ? ', opties: ' + v.opties.map(o => `"${o.id}" = ${o.naam}`).join('; ') : '';
      const vraag = `Onderwerp: ${tekst(d.onderwerp, 120)}\n\nAntwoorden van de club:\n${antwoorden.map(a => '- ' + a).join('\n')}\n\nInstellingen:\n`
        + velden.map(v => `- pad "${v.pad}" (${v.type}${soort(v)}): ${v.label}${v.uitleg ? '. ' + v.uitleg : ''}`).join('\n');
      const { tekst: rauw } = await claude({
        apiKey: apiKey(), system: [{ type: 'text', text: INSTEL_INSTRUCTIE, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: vraag }], maxTokens: 800, temperature: 0, metaTerug: true, ...(model ? { model } : {}),
      });
      const json = leesJson(rauw);
      if (!json || typeof json.waarden !== 'object' || !json.waarden) throw new HttpsError('internal', 'Het voorstel kon niet gelezen worden.');
      const waarden = {};
      for (const v of velden){ const w = schoonInstelWaarde(v, json.waarden[v.pad]); if (w !== undefined) waarden[v.pad] = w; }
      return { waarden };
    }
  );
  return { analyseerClubdocument, leesClubscan, stelClubinstellingenVoor };
}

module.exports = { maak, leesJson, schoonHoofdstukken, schoonUitvoer, citaatKlopt, maskeer, veldenTekst, schoonInstelVelden, schoonInstelWaarde, MAX_TEKST, MAX_BEELD };
