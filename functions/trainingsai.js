/* ==================== AI voor trainingsmodule en seizoensplanning ====================
   Twee callables. De app werkt ook zonder deze functies: de keuze en de controle van
   trainingen en jaarlijnen gebeuren in de browser (trainingsplanner.js, seizoensplan-logica.js).
   De AI stelt alleen voor of verwoordt; de app controleert het resultaat altijd opnieuw.

   AVG: er gaan alleen teamprofiel, vormnamen en teamgemiddelden naar het model. Geen namen,
   geen spelerdata, geen uitslagen. Vrije tekst gaat door scrubPII (wordt door index.js meegegeven). */
const tekst = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const lijst = (a, n, m) => (Array.isArray(a) ? a : []).slice(0, m).map(x => tekst(x, n)).filter(Boolean);

function leesJson(rauw){
  let t = String(rauw || '').trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

const TRAINING_SYSTEEM = `Je bent een ervaren jeugdtrainer-opleider voor Cluppie, een app voor amateurvoetbalclubs.
Je krijgt een samengestelde training (vaste vormen, vaste minuten) voor een jeugdteam. Jij verandert niets aan de training.
Je schrijft per onderdeel twee korte teksten in het Nederlands, in de je-vorm:
- "intro": één of twee zinnen die uitleggen waarom dit onderdeel nu past bij het thema en het niveau van het team.
- "tip": één concrete tip voor de trainer bij dit onderdeel.
Regels:
- Gebruik alleen wat in de aangeleverde gegevens staat. Verzin geen regels, afmetingen of oefeningen.
- Noem nooit namen van spelers of andere personen. Vraag er ook niet om.
- Geen medisch of juridisch advies. Geen belofte van resultaat.
- Toon: warm, praktisch, kort. Bij stijl "ontdekkend" formuleer je de tip als vraag aan de spelers.
Antwoord uitsluitend met JSON in dit formaat, zonder tekst eromheen:
{"teksten":{"<slot>":{"intro":"…","tip":"…"}}}`;

const JAAR_SYSTEEM = `Je bent hoofd technische commissie van een amateurvoetbalclub en stelt een concept-seizoensopbouw voor een jeugdteam op.
Je krijgt: leeftijdscategorie, bouw, gekozen opbouwmodel, accenten, het aantal trainingsweken, de toegestane thema's en een voorkeursvolgorde.
Maak blokken van 4 tot 6 weken met één thema per blok.
Harde eisen (de app controleert ze en wijst een voorstel af dat er niet aan voldoet):
- Gebruik uitsluitend thema's uit "toegestaneThemas", exact zoals geschreven.
- Elk blok heeft een geheel aantal weken van 4, 5 of 6.
- De weken van alle blokken samen zijn precies gelijk aan "weken".
- Twee blokken achter elkaar hebben nooit hetzelfde thema.
Zachte wensen: volg de voorkeursvolgorde zoveel als kan, laat gekozen accenten vaker of langer terugkomen, laat thema's later in het seizoen terugkomen als herhaling, begin rustig en basaal.
Per blok geef je "waarom": één zin in het Nederlands waarom dit blok hier staat. Alleen op basis van de gegevens; geen namen, geen beloftes.
Antwoord uitsluitend met JSON, zonder tekst eromheen:
{"blokken":[{"thema":"…","weken":5,"waarom":"…"}]}`;

const UITLEG_SYSTEEM = `Je legt in het Nederlands in twee of drie zinnen uit waarom Cluppie een wijziging in het seizoensplan voorstelt.
Je krijgt de titel van het voorstel, het thema, de soort en de feiten (gemiddelden en tellingen op teamniveau).
Gebruik uitsluitend die feiten en noem de getallen precies zoals ze zijn. Verzin niets, noem geen namen en geen uitslagen.
Sluit af met de opmerking dat de trainer beslist.
Antwoord uitsluitend met JSON: {"uitleg":"…"}`;

function valideerBlokken(blokken, weken, toegestaan){
  if (!Array.isArray(blokken) || !blokken.length || blokken.length > 20) return false;
  let som = 0;
  for (let i = 0; i < blokken.length; i++){
    const b = blokken[i];
    if (!toegestaan.has(b?.thema) || !Number.isInteger(b?.weken) || b.weken < 4 || b.weken > 6) return false;
    if (i && blokken[i - 1].thema === b.thema) return false;
    som += b.weken;
  }
  return som === weken;
}

function maak({ onCall, HttpsError, secrets, REGIO, vereisAI, claude, apiKey, scrubPII }){
  const personaliseerTraining = onCall({ region: REGIO, secrets, cors: true, timeoutSeconds: 60 }, async (request) => {
    await vereisAI(request);
    const p = request.data?.profiel || {};
    const onderdelen = (Array.isArray(request.data?.onderdelen) ? request.data.onderdelen : []).slice(0, 6).map(o => ({
      slot: tekst(o?.slot, 20), minuten: Math.max(0, Math.min(90, Number(o?.minuten) || 0)), naam: tekst(o?.naam, 80), doel: scrubPII(tekst(o?.doel, 240)),
    })).filter(o => o.slot && o.naam);
    if (!onderdelen.length) throw new HttpsError('invalid-argument', 'Geen onderdelen ontvangen.');
    const profiel = { categorie: tekst(p.categorie, 12), aantalSpelers: Math.max(0, Math.min(40, Number(p.aantalSpelers) || 0)), niveau: Math.max(1, Math.min(3, Number(p.niveau) || 2)),
      duur: Math.max(0, Math.min(120, Number(p.duur) || 0)), thema: tekst(p.thema, 60), blokFase: tekst(p.blokFase, 12) };
    const stijl = request.data?.stijl === 'ontdekkend' ? 'ontdekkend' : 'punten';
    const { tekst: rauw } = await claude({ apiKey: apiKey(), system: [{ type: 'text', text: TRAINING_SYSTEEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: JSON.stringify({ profiel, stijl, onderdelen }) }], maxTokens: 1500, temperature: 0.4, metaTerug: true });
    const json = leesJson(rauw);
    const slots = new Set(onderdelen.map(o => o.slot));
    const teksten = {};
    for (const [slot, v] of Object.entries(json?.teksten || {})){
      if (!slots.has(slot)) continue;
      const intro = scrubPII(tekst(v?.intro, 400)), tip = scrubPII(tekst(v?.tip, 300));
      if (intro || tip) teksten[slot] = { intro, tip };
    }
    if (!Object.keys(teksten).length) throw new HttpsError('internal', 'De AI-uitleg kon niet gelezen worden. Probeer opnieuw.');
    return { teksten };
  });

  const seizoensVoorstel = onCall({ region: REGIO, secrets, cors: true, timeoutSeconds: 60 }, async (request) => {
    await vereisAI(request);
    const modus = request.data?.modus;
    if (modus === 'jaarplan'){
      const d = request.data;
      const weken = Number(d.weken);
      if (!Number.isInteger(weken) || weken < 4 || weken > 60) throw new HttpsError('invalid-argument', 'Aantal weken klopt niet.');
      const toegestaneThemas = lijst(d.toegestaneThemas, 60, 20);
      if (!toegestaneThemas.length) throw new HttpsError('invalid-argument', 'Geen thema’s ontvangen.');
      const toegestaan = new Set(toegestaneThemas);
      const invoer = { categorie: tekst(d.categorie, 12), bouw: tekst(d.bouw, 10), model: tekst(d.model, 60), accent: lijst(d.accent, 40, 2),
        weken, toegestaneThemas, voorkeursvolgorde: lijst(d.voorkeursvolgorde, 60, 20), niveau: tekst(d.niveau, 20) };
      const { tekst: rauw } = await claude({ apiKey: apiKey(), system: [{ type: 'text', text: JAAR_SYSTEEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: JSON.stringify(invoer) }], maxTokens: 2000, temperature: 0.3, metaTerug: true });
      const blokken = (leesJson(rauw)?.blokken || []).map(b => ({ thema: tekst(b?.thema, 60), weken: Number(b?.weken), waarom: scrubPII(tekst(b?.waarom, 300)) }));
      if (!valideerBlokken(blokken, weken, toegestaan)) throw new HttpsError('internal', 'Het AI-voorstel voldeed niet aan de controles.');
      return { blokken };
    }
    if (modus === 'uitleg'){
      const v = request.data?.voorstel || {};
      const feiten = {};
      for (const [k, w] of Object.entries(v.feiten && typeof v.feiten === 'object' ? v.feiten : {}).slice(0, 12)){
        feiten[tekst(k, 30)] = typeof w === 'number' ? w : tekst(w, 60);
      }
      const invoer = { titel: tekst(v.titel, 160), thema: tekst(v.thema, 60), soort: tekst(v.soort, 20), feiten, gevolg: tekst(v.gevolg, 240) };
      if (!invoer.titel) throw new HttpsError('invalid-argument', 'Geen voorstel ontvangen.');
      const { tekst: rauw } = await claude({ apiKey: apiKey(), system: [{ type: 'text', text: UITLEG_SYSTEEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: JSON.stringify(invoer) }], maxTokens: 400, temperature: 0.3, metaTerug: true });
      const uitleg = scrubPII(tekst(leesJson(rauw)?.uitleg, 600));
      if (!uitleg) throw new HttpsError('internal', 'De uitleg kon niet gelezen worden.');
      return { uitleg };
    }
    throw new HttpsError('invalid-argument', 'Onbekende modus.');
  });

  return { personaliseerTraining, seizoensVoorstel };
}

module.exports = { maak, valideerBlokken, leesJson };
