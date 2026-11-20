/* ==================== CLUBPROFIEL: documenten van een club analyseren ====================
   Alleen de platformbeheerder (eindbaas). Hij leest de documenten van een club in (beleidsplan,
   jeugdplan, reglement …). De AI zoekt per onderwerp (veld) uit wat de club heeft vastgelegd en
   maakt er meteen een voorstel voor Cluppie van: de tekst voor de Clubwijzer, de gouden regels en
   de instellingen. Hoofdstukken en velden: public/js/clubprofiel-logica.js.

   [20261120d] Analyse opnieuw opgezet. Was: stukken van 24.000 tekens met het snelle model en de hele
   veldenlijst tegelijk; dat haalde weinig op. Nu: het HELE document in één aanroep (het model leest
   bijlagen en tabellen in samenhang), per groep van drie of vier hoofdstukken (aandacht per onderwerp),
   met MODEL_PROFIEL. Het document staat in een gecachet blok, zodat de volgende groepen het goedkoop
   hergebruiken. Kosten: ruwweg een euro per document van zestig pagina's.

   Drie functies:
   - analyseerClubdocument     één document × één groep hoofdstukken → bevindingen met voorstel
   - stelClubinstellingenVoor  één antwoord (bijv. zelf ingevuld) → voorstel voor Cluppie
   - leesClubscan              één ingescande pagina → de tekst die erop staat
   Geen van drieën bewaart iets: de app schrijft naar clubprofielen/{clubId} en, na goedkeuring, naar de
   club. Het telt niet mee in de AI-limiet van de club.

   Controle op de uitkomst: alleen velden die de app meestuurde; elk citaat wordt teruggezocht in de tekst
   (citaatOk); instellingen worden tegen soort, grenzen en opties gecontroleerd; e-mailadressen en
   telefoonnummers gaan eruit. AVG: de tekst gaat naar het model en wordt nergens opgeslagen. */
const { foutVanAntwoord } = require('./ai-fout');

/* Het model voor de analyse. Bewust het sterkste gewone model: dit draait alleen voor de eindbaas, een paar
   keer per club, en de kwaliteit van de inrichting hangt ervan af. Andere functies houden hun eigen model. */
const MODEL_PROFIEL = 'claude-opus-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TEKST = 400000;   // tekens per document (ongeveer 150 pagina's)
const tekst = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
/* als tekst(), maar regeleinden blijven (opsommingen in de Clubwijzer) */
const alinea = (x, n) => String(x ?? '').replace(/\r/g, '').split('\n').map(r => r.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);

function leesJson(rauw){
  let t = String(rauw || '').trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

/* ---------- het model aanroepen ----------
   Gestreamd (een grote analyse duurt minuten; zonder stream verloopt de verbinding), met gestructureerde
   uitvoer (altijd geldige JSON) en het terugvalmodel van de API voor het zeldzame geval dat een aanvraag
   wordt geweigerd. Wijst de API de aanvraag af (400), dan proberen we het in een eenvoudiger vorm: eerst
   zonder terugvalmodel, dan ook zonder gestructureerde uitvoer (de instructie vraagt zelf al om JSON). */
async function leesStroom(res, HttpsError){
  const dec = new TextDecoder();
  let buf = '', uit = '', stop = null, usage = null;
  const regel = (r) => {
    if (!r.startsWith('data:')) return;
    let d; try { d = JSON.parse(r.slice(5)); } catch { return; }
    if (d.type === 'content_block_start'){
      const b = d.content_block || {};
      if (b.type === 'fallback') uit = '';                       // een ander model neemt het over: wat er al stond vervalt
      if (b.type === 'text' && b.text) uit += b.text;
    }
    else if (d.type === 'content_block_delta' && d.delta && d.delta.type === 'text_delta') uit += d.delta.text || '';
    else if (d.type === 'message_delta'){ if (d.delta && d.delta.stop_reason) stop = d.delta.stop_reason; if (d.usage) usage = d.usage; }
    else if (d.type === 'error'){
      console.error('[clubprofiel] fout in de stroom', JSON.stringify(d.error || {}).slice(0, 300));
      throw new HttpsError('unavailable', 'De AI is nu niet bereikbaar. Probeer het zo opnieuw.');
    }
  };
  for await (const stuk of res.body){
    buf += dec.decode(stuk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0){ const r = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (r) regel(r); }
  }
  if (buf.trim()) regel(buf.trim());
  if (usage) console.log(`[clubprofiel] verbruik uit=${usage.output_tokens || 0} cache_gelezen=${usage.cache_read_input_tokens || 0} cache_gemaakt=${usage.cache_creation_input_tokens || 0}`);
  return { tekst: uit.trim(), stopReason: stop };
}
const wacht = ms => new Promise(r => setTimeout(r, ms));
async function vraagModel({ apiKey, HttpsError, system, messages, schema, maxTokens = 16000, effort = 'high', model = MODEL_PROFIEL, fetchFn = fetch, pauzeMs = 4000 }){
  const vormen = [{ format: true, terugval: true }, { format: true, terugval: false }, { format: false, terugval: false }];
  let laatste = { status: 0, tekst: '' };
  for (const v of vormen){
    const body = { model, max_tokens: maxTokens, stream: true, system, messages,
      ...(v.format ? { output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) } } : {}),
      ...(v.terugval ? { fallbacks: 'default' } : {}) };
    const headers = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
      ...(v.terugval ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}) };
    for (let poging = 0; poging < 2; poging++){
      const res = await fetchFn(API_URL, { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) return leesStroom(res, HttpsError);
      laatste = { status: res.status, tekst: await res.text().catch(() => '') };
      console.error('[clubprofiel] API-fout', res.status, laatste.tekst.slice(0, 400));
      /* druk of een storing: één keer opnieuw na een korte pauze; anders niet */
      if (!(poging === 0 && (res.status === 429 || res.status >= 500))) break;
      await wacht(pauzeMs);
    }
    if (laatste.status !== 400) break;   // alleen een afgewezen aanvraag proberen we in een eenvoudiger vorm
  }
  const fout = foutVanAntwoord(laatste.status, laatste.tekst);
  throw new HttpsError(fout.code, fout.bericht);
}

/* ---------- invoer: hoofdstukken, velden en hun instellingen ---------- */
const TYPES = ['tekst', 'getal', 'kleur', 'keuze', 'formatie'];
function schoonInstelVelden(v){
  return (Array.isArray(v) ? v : []).slice(0, 20).map(x => ({
    pad: tekst(x && x.pad, 80).replace(/[^A-Za-z0-9.]/g, ''), label: tekst(x && x.label, 80), uitleg: tekst(x && x.uitleg, 200),
    type: TYPES.includes(x && x.type) ? x.type : 'tekst', max: Math.round(Number(x && x.max)) || 40, min: Math.round(Number(x && x.min)) || 0,
    opties: (Array.isArray(x && x.opties) ? x.opties : []).slice(0, 8).map(o => ({ id: tekst(Array.isArray(o) ? o[0] : o && o.id, 30), naam: tekst(Array.isArray(o) ? o[1] : o && o.naam, 80) })).filter(o => o.id),
  })).filter(x => x.pad && x.label);
}
function schoonHoofdstukken(h){
  return (Array.isArray(h) ? h : []).slice(0, 30).map(x => ({
    id: tekst(x && x.id, 30).replace(/[^a-z]/g, ''), naam: tekst(x && x.naam, 60),
    velden: (Array.isArray(x && x.velden) ? x.velden : []).slice(0, 15).map(v => ({
      id: tekst(v && v.id, 40).replace(/[^a-z.]/g, ''), label: tekst(v && v.label, 80), vraag: tekst(v && v.vraag, 200),
      tekst: !(v && v.tekst === false), regels: !!(v && v.regels === true), rondes: !!(v && v.rondes === true), instellingen: schoonInstelVelden(v && v.instellingen),
    })).filter(v => v.id && v.label),
  })).filter(x => x.id && x.naam && x.velden.length);
}
/* Eén voorgestelde instelling, of undefined als hij niet aan het veld voldoet. */
function schoonInstelWaarde(def, w){
  if (w === null || w === undefined || w === '') return undefined;
  if (def.type === 'getal'){ const n = Math.round(Number(String(w).replace(/^[JM]?O/i, ''))); return Number.isFinite(n) && n >= def.min && n <= def.max ? n : undefined; }
  const t = tekst(w, 200);
  if (def.type === 'kleur') return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toLowerCase() : undefined;
  if (def.type === 'keuze') return def.opties.some(o => o.id === t) ? t : undefined;
  if (def.type === 'formatie') return /^\d(-\d){1,4}$/.test(t) ? t : undefined;
  return t && t.length <= def.max ? t : undefined;
}

/* ---------- controle van de uitkomst ---------- */
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-\s*\n\s*/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/* Staat het citaat in de tekst? Letterlijk (zonder leestekens en regeleinden), of anders: komt minstens
   60% van de reeksen van vijf woorden uit het citaat in de tekst voor (een PDF breekt regels en woorden af). */
function citaatKlopt(bron, citaat){
  const c = norm(citaat), t = typeof bron === 'object' && bron ? bron.n : norm(bron);
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

/* [20261120e] Evaluatierondes: de beoordelingsmomenten van het seizoen, met datums als JJJJ-MM-DD. */
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
function schoonRondes(lijst){
  const uit = [], namen = new Set();
  for (const r of (Array.isArray(lijst) ? lijst : [])){
    const naam = tekst(r && r.naam, 60), van = String((r && r.van) || ''), tot = String((r && r.tot) || '');
    if (!naam || !DATUM.test(tot) || (van && !DATUM.test(van)) || (van && tot < van) || isNaN(Date.parse(tot)) || namen.has(naam.toLowerCase())) continue;
    namen.add(naam.toLowerCase());
    uit.push({ naam, soort: r.soort === 'snel' ? 'snel' : 'volledig', van: van || null, tot });
    if (uit.length >= 6) break;
  }
  return uit;
}
/* Het voorstel voor Cluppie bij één veld: tekst voor de Clubwijzer, gouden regels, evaluatierondes en instellingen. */
function schoonVoorstel(ruw, veld){
  const r = ruw || {};
  const inst = {};
  const lijst = Array.isArray(r.instellingen) ? r.instellingen
    : (r.instellingen && typeof r.instellingen === 'object' ? Object.entries(r.instellingen).map(([pad, waarde]) => ({ pad, waarde })) : []);
  for (const def of (veld.instellingen || [])){
    const gevonden = lijst.find(x => x && x.pad === def.pad);
    const w = gevonden ? schoonInstelWaarde(def, gevonden.waarde) : undefined;
    if (w !== undefined) inst[def.pad] = w;
  }
  return {
    tekst: veld.tekst === false ? '' : maskeer(alinea(r.tekst, 1500)),
    regels: veld.regels ? (Array.isArray(r.regels) ? r.regels : []).map(x => maskeer(tekst(x, 160))).filter(Boolean).slice(0, 10) : [],
    rondes: veld.rondes ? schoonRondes(r.rondes) : [],
    instellingen: inst,
  };
}
/* De uitvoer van het model: alleen bekende velden, één bevinding per veld (overig: hoogstens vier per hoofdstuk). */
function schoonUitvoer(json, hoofdstukken, bron){
  const velden = new Map();
  for (const h of hoofdstukken){
    velden.set(h.id + '.overig', { id: h.id + '.overig', overig: true, tekst: true, regels: false, instellingen: [] });
    for (const v of h.velden) velden.set(v.id, v);
  }
  const bronN = { n: norm(bron) }, teller = {}, uit = [];
  for (const b of (Array.isArray(json && json.bevindingen) ? json.bevindingen : []).slice(0, 200)){
    const veld = velden.get(tekst(b && b.veld, 40)), waarde = alinea(b && (b.antwoord ?? b.waarde), 1500), citaat = tekst(b && b.citaat, 400);
    if (!veld || !waarde) continue;
    teller[veld.id] = (teller[veld.id] || 0) + 1;
    if (teller[veld.id] > (veld.overig ? 4 : 1)) continue;
    const pagina = Math.round(Number(b.pagina));
    uit.push({ veld: veld.id, waarde: maskeer(waarde), citaat: maskeer(citaat), citaatOk: citaatKlopt(bronN, citaat),
      pagina: pagina > 0 && pagina < 5000 ? pagina : null, zeker: ['hoog', 'middel', 'laag'].includes(b.zeker) ? b.zeker : 'middel',
      status: b.status === 'deels' ? 'deels' : 'volledig', ontbreekt: b.status === 'deels' ? maskeer(tekst(b.ontbreekt, 300)) : '',
      voorstel: schoonVoorstel(b, veld) });
  }
  return uit;
}

/* ---------- de opdracht aan het model ---------- */
const SOORTEN = `Waarden van instellingen geef je als tekst:
- tekst: de woorden van de club, kort, zonder lidwoord en zonder uitleg, niet langer dan het maximum.
- getal: een geheel getal binnen de grenzen. Een leeftijd als O11 of JO11 is 11; "tot en met" is het hoogste getal van de groep.
- kleur: een hex-kleur als #cc0000 voor de hoofdkleur die de club noemt.
- keuze: precies de code van een van de genoemde opties.
- formatie: alleen cijfers met streepjes, zonder keeper, zoals 4-3-3.`;
const VOORSTEL_UITLEG = `- "tekst": zoals het in de Clubwijzer van de app komt te staan, voor de trainers van de club. Schrijf in de wij-vorm, helder en praktisch: twee tot zes zinnen, of een korte opsomming met elk punt op een nieuwe regel. Alleen wat de club zelf heeft vastgelegd, zonder inleiding en zonder naar het document te verwijzen. Een lege tekst bij een veld met de aantekening [geen tekst].
- "regels": alleen bij een veld met de aantekening [regels]: de afspraken als losse, korte regels (elk hoogstens 120 tekens), zoals de club ze formuleert. Anders een lege lijst.
- "rondes": alleen bij een veld met de aantekening [rondes]: de momenten waarop spelers beoordeeld worden, elk als ronde met een naam zoals de club hem noemt (bijvoorbeeld "Winterevaluatie"), "soort" ("volledig" voor een uitgebreide beoordeling per speler, "snel" voor een korte tussenstand; bij twijfel "volledig") en de periode als "van" en "tot" in de vorm JJJJ-MM-DD, binnen het seizoen dat bij de velden staat. Noemt de club alleen een maand, neem dan de eerste en de laatste dag van die maand. Alleen als de club de maanden of periodes noemt; anders een lege lijst.
- "instellingen": alleen de instellingen die bij het veld staan vermeld, en alleen als de waarde er duidelijk uit volgt. Bij twijfel laat je een instelling weg; raad niet. Anders een lege lijst.
${SOORTEN}`;
const INSTRUCTIE = `Je bent een ervaren adviseur jeugdvoetbal die het beleid van een Nederlandse amateurvoetbalclub doorgrondt. Je werkt voor Cluppie, een app voor jeugdtrainers die per club wordt ingericht zoals de club zelf werkt. Je krijgt de volledige tekst van één document van de club en een lijst onderwerpen (velden). Voor elk veld zoek je uit wat de club heeft vastgelegd, en je maakt er meteen een voorstel van voor Cluppie.

Zo lees je:
- Lees het hele document, ook tabellen, opsommingen, bijlagen, organogrammen en functiebeschrijvingen. Wat bij een veld hoort staat vaak verspreid of onder een andere kop; voeg het samen tot één antwoord.
- Loop elk veld apart na. Sla een veld alleen over als het document er werkelijk niets over zegt. Zegt het er iets over maar niet alles, dan geef je wat er staat met status "deels".
- Gebruik uitsluitend wat in het document staat. Vul niets aan uit algemene voetbalkennis of uit wat bij clubs gebruikelijk is, en geef geen advies.
- Noem nooit namen van personen, e-mailadressen of telefoonnummers: schrijf de functie ("de jeugdcoördinator").

Per veld geef je één bevinding:
- "veld": de code van het veld.
- "status": "volledig" als het document de vraag van het veld beantwoordt; "deels" als het er iets over zegt maar de vraag niet helemaal beantwoordt.
- "antwoord": wat de club heeft vastgelegd, volledig en concreet. Neem alle leeftijden, aantallen, tijden, momenten en namen van functies, bouwen, teams en formulieren over, in de woorden van de club. Liever drie precieze zinnen dan één vage.
- "ontbreekt": bij "deels" in één zin wat er nog ontbreekt om dit in een app in te richten. Anders een lege tekst.
- "citaat": het letterlijk overgenomen fragment (hoogstens 300 tekens) dat het antwoord het best onderbouwt. Wijzig niets en plak geen fragmenten aan elkaar.
- "pagina": het nummer uit de laatste regel "[pagina N]" boven het citaat, of 0 als het document geen paginaregels heeft.
- "zeker": "hoog" als het er letterlijk staat, "middel" als je het uit de tekst afleidt, "laag" als het alleen een aanwijzing is.
${VOORSTEL_UITLEG}

Staat er iets in het document dat belangrijk is voor trainers of voor het inrichten van de app en bij geen enkel veld past, gebruik dan het veld "<hoofdstuk-id>.overig" (hoogstens vier per hoofdstuk) en begin het antwoord met het onderwerp in een paar woorden, gevolgd door een dubbele punt.

Velden waarover het document niets zegt laat je weg. Antwoord uitsluitend met JSON: {"bevindingen":[{"veld":"…","status":"volledig","antwoord":"…","ontbreekt":"","citaat":"…","pagina":3,"zeker":"hoog","tekst":"…","regels":[],"rondes":[],"instellingen":[{"pad":"…","waarde":"…"}]}]}`;
const VOORSTEL_INSTRUCTIE = `Je helpt Cluppie, een app voor jeugdtrainers, in te richten voor een Nederlandse voetbalclub. Je krijgt één onderwerp en het antwoord van de club daarop, goedgekeurd door een mens. Maak er het voorstel voor Cluppie van. Gebruik uitsluitend wat in het antwoord staat; vul niets aan en noem geen namen van personen.
${VOORSTEL_UITLEG}
Antwoord uitsluitend met JSON: {"tekst":"…","regels":[],"rondes":[{"naam":"…","soort":"volledig","van":"JJJJ-MM-DD","tot":"JJJJ-MM-DD"}],"instellingen":[{"pad":"…","waarde":"…"}]}`;

const tekenreeks = { type: 'string' };
const INSTELLINGEN_SCHEMA = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['pad', 'waarde'], properties: { pad: tekenreeks, waarde: tekenreeks } } };
const RONDES_SCHEMA = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['naam', 'soort', 'van', 'tot'],
  properties: { naam: tekenreeks, soort: { type: 'string', enum: ['volledig', 'snel'] }, van: tekenreeks, tot: tekenreeks } } };
const VOORSTEL_VELDEN = { tekst: tekenreeks, regels: { type: 'array', items: tekenreeks }, rondes: RONDES_SCHEMA, instellingen: INSTELLINGEN_SCHEMA };
const ANALYSE_SCHEMA = { type: 'object', additionalProperties: false, required: ['bevindingen'], properties: { bevindingen: { type: 'array', items: {
  type: 'object', additionalProperties: false, required: ['veld', 'status', 'antwoord', 'ontbreekt', 'citaat', 'pagina', 'zeker', 'tekst', 'regels', 'rondes', 'instellingen'],
  properties: { veld: tekenreeks, status: { type: 'string', enum: ['volledig', 'deels'] }, antwoord: tekenreeks, ontbreekt: tekenreeks, citaat: tekenreeks,
    pagina: { type: 'integer' }, zeker: { type: 'string', enum: ['hoog', 'middel', 'laag'] }, ...VOORSTEL_VELDEN } } } } };
const VOORSTEL_SCHEMA = { type: 'object', additionalProperties: false, required: ['tekst', 'regels', 'rondes', 'instellingen'], properties: VOORSTEL_VELDEN };

function instelRegel(d){
  const soort = d.type === 'getal' ? `getal, ${d.min} tot en met ${d.max}` : d.type === 'tekst' ? `tekst, hoogstens ${d.max} tekens`
    : d.type === 'keuze' ? 'keuze: ' + d.opties.map(o => `"${o.id}" = ${o.naam}`).join('; ') : d.type;
  return `    instelling "${d.pad}" (${soort}): ${d.label}${d.uitleg ? '. ' + d.uitleg : ''}`;
}
function veldRegels(v){
  const aant = [v.tekst === false ? '[geen tekst]' : '', v.regels ? '[regels]' : '', v.rondes ? '[rondes]' : ''].filter(Boolean).join(' ');
  return [`- ${v.id}: ${v.label}${v.vraag ? '. ' + v.vraag : ''}${aant ? ' ' + aant : ''}`, ...(v.instellingen || []).map(instelRegel)].join('\n');
}
function veldenTekst(hoofdstukken, seizoen){
  return 'VELDEN\n' + (seizoen ? `Seizoen van de club: ${seizoen}\n` : '') + hoofdstukken.map(h => `\n${h.naam} (hoofdstuk-id: ${h.id})\n` + h.velden.map(veldRegels).join('\n')).join('\n');
}

/* ---------- scans: tekst van een ingescande pagina overnemen ---------- */
const MAX_BEELD = 4500000;   // tekens base64 (ruim 3 MB aan JPEG)
const SCAN_INSTRUCTIE = `Je krijgt een foto of scan van één pagina uit een document van een Nederlandse voetbalclub. Neem alle tekst van de pagina letterlijk over, in de volgorde waarin je hem leest.
- Kopjes en opsommingen elk op een eigen regel. Een tabel: één rij per regel, cellen gescheiden door een tab.
- Verbeter niets en vat niets samen. Wat je niet kunt lezen schrijf je als [onleesbaar].
- Sla paginanummers, kop- en voetteksten en logo's over.
- Staat er geen tekst op de pagina, antwoord dan met precies: [leeg]
Geef alleen de overgenomen tekst, zonder uitleg.`;

function maak({ onCall, HttpsError, secrets, REGIO, claude, apiKey, isPlatformBeheerder, db, vraag = vraagModel }){
  const eindbaas = async (request) => {
    if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Dit kan alleen de platformbeheerder.');
    const clubId = tekst(request.data && request.data.clubId, 80);
    if (!clubId || (db && !(await db().doc('clubs/' + clubId).get()).exists)) throw new HttpsError('not-found', 'Deze club bestaat niet.');
    return clubId;
  };
  const uitkomst = ({ tekst: rauw, stopReason }, teVeel) => {
    if (stopReason === 'refusal') throw new HttpsError('failed-precondition', 'De AI heeft deze tekst niet willen verwerken.');
    if (stopReason === 'max_tokens') throw new HttpsError('resource-exhausted', teVeel);
    const json = leesJson(rauw);
    if (!json){ console.error('[clubprofiel] JSON niet leesbaar:', String(rauw).slice(0, 200)); throw new HttpsError('internal', 'De analyse kon niet gelezen worden. Probeer opnieuw.'); }
    return json;
  };

  /* Eén document, één groep hoofdstukken. De app stuurt dezelfde tekst voor elke groep; het documentblok
     is gecachet, dus alleen de eerste aanroep betaalt de volle prijs voor het lezen. */
  const analyseerClubdocument = onCall(
    { region: REGIO, secrets, cors: true, timeoutSeconds: 540, memory: '1GiB', maxInstances: 6 },
    async (request) => {
      await eindbaas(request);
      const d = request.data || {};
      const bron = String(d.tekst || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
      if (bron.length < 80) throw new HttpsError('invalid-argument', 'Te weinig tekst om te analyseren.');
      if (bron.length > MAX_TEKST) throw new HttpsError('invalid-argument', 'Dit document is te lang. Knip het in delen.');
      const hoofdstukken = schoonHoofdstukken(d.hoofdstukken);
      if (!hoofdstukken.length) throw new HttpsError('invalid-argument', 'De hoofdstukken ontbreken.');
      const r = await vraag({
        apiKey: apiKey(), HttpsError, schema: ANALYSE_SCHEMA, maxTokens: 20000, effort: 'high',
        system: [{ type: 'text', text: INSTRUCTIE }],
        messages: [{ role: 'user', content: [
          { type: 'text', text: `DOCUMENT: ${tekst(d.documentNaam, 120) || 'zonder naam'}\n\n${bron}`, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: veldenTekst(hoofdstukken, tekst(d.seizoen, 80)) + '\n\nGeef de bevindingen voor deze velden.' },
        ] }],
      });
      /* te veel voor één antwoord: de app splitst de groep hoofdstukken en probeert opnieuw */
      const json = uitkomst(r, 'Deze hoofdstukken leveren te veel op in één keer.');
      return { bevindingen: schoonUitvoer(json, hoofdstukken, bron) };
    }
  );

  /* Eén antwoord → het voorstel voor Cluppie. Voor een antwoord dat de eindbaas zelf invult (of aanpast), en
     voor bevindingen van vóór 20261120d die nog geen voorstel hebben. Er wordt hier niets ingesteld. */
  const stelClubinstellingenVoor = onCall(
    { region: REGIO, secrets, cors: true, timeoutSeconds: 180, maxInstances: 6 },
    async (request) => {
      await eindbaas(request);
      const d = request.data || {};
      const veld = { tekst: d.wilTekst !== false, regels: d.wilRegels === true, rondes: d.wilRondes === true, instellingen: schoonInstelVelden(d.velden) };
      const antwoorden = (Array.isArray(d.antwoorden) ? d.antwoorden : []).slice(0, 12).map(x => alinea(x, 1500)).filter(Boolean);
      if (!antwoorden.length) throw new HttpsError('invalid-argument', 'Er is geen antwoord om om te zetten.');
      const opdracht = `Onderwerp: ${tekst(d.onderwerp, 120)}${d.vraag ? '\nVraag: ' + tekst(d.vraag, 200) : ''}${veld.tekst ? '' : ' [geen tekst]'}${veld.regels ? ' [regels]' : ''}${veld.rondes ? ' [rondes]' : ''}\n${veld.rondes && d.seizoen ? 'Seizoen van de club: ' + tekst(d.seizoen, 80) + '\n' : ''}`
        + (veld.instellingen.length ? 'Instellingen bij dit onderwerp:\n' + veld.instellingen.map(instelRegel).join('\n') + '\n' : 'Bij dit onderwerp horen geen instellingen.\n')
        + `\nAntwoord van de club:\n${antwoorden.map(a => '- ' + a).join('\n')}`;
      const r = await vraag({ apiKey: apiKey(), HttpsError, schema: VOORSTEL_SCHEMA, maxTokens: 4000, effort: 'medium',
        system: [{ type: 'text', text: VOORSTEL_INSTRUCTIE, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: opdracht }] });
      const v = schoonVoorstel(uitkomst(r, 'Het voorstel werd te lang.'), veld);
      return { ...v, waarden: v.instellingen };
    }
  );

  /* Eén ingescande pagina (JPEG, base64) → de tekst die erop staat. De app voegt die tekst in het document
     en stuurt dat daarna gewoon naar analyseerClubdocument. Beeld en tekst worden nergens opgeslagen. */
  const leesClubscan = onCall(
    { region: REGIO, secrets, cors: true, timeoutSeconds: 120, memory: '512MiB', maxInstances: 6 },
    async (request) => {
      await eindbaas(request);
      const beeld = String((request.data && request.data.beeld) || '').replace(/^data:image\/jpeg;base64,/, '');
      if (beeld.length < 2000 || !/^[A-Za-z0-9+/]+=*$/.test(beeld)) throw new HttpsError('invalid-argument', 'Geen leesbare afbeelding ontvangen.');
      if (beeld.length > MAX_BEELD) throw new HttpsError('invalid-argument', 'Deze pagina is te groot. Stuur hem kleiner.');
      const { tekst: rauw, stopReason } = await claude({
        apiKey: apiKey(), system: [{ type: 'text', text: SCAN_INSTRUCTIE, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: beeld } }, { type: 'text', text: 'Neem de tekst van deze pagina over.' }] }],
        maxTokens: 4000, temperature: 0, metaTerug: true,
      });
      const uit = String(rauw || '').trim();
      return { tekst: /^\[leeg\]$/i.test(uit) ? '' : maskeer(uit), afgekapt: stopReason === 'max_tokens' };
    }
  );
  return { analyseerClubdocument, leesClubscan, stelClubinstellingenVoor };
}

module.exports = { maak, vraagModel, leesStroom, leesJson, schoonHoofdstukken, schoonUitvoer, schoonVoorstel, schoonRondes, citaatKlopt, maskeer, veldenTekst,
  schoonInstelVelden, schoonInstelWaarde, ANALYSE_SCHEMA, VOORSTEL_SCHEMA, MODEL_PROFIEL, MAX_TEKST, MAX_BEELD };
