/* ==================== TEAMKAMER — beheerscherm van de trainer [20261116n] ====================
   Tegel Teamkamer (sectie Meer) en, op de computer, Team › Teamkamer. De trainer zet hier de teamkamer
   aan, deelt de teamlink, keurt ouders goed, plaatst mededelingen en polls en kiest wat ouders en
   spelers zien. Wat ouders zien staat in een aparte kopie (teamkamer/{teamId}) die de Cloud Functions
   vullen; dit scherm schrijft daar alleen mededelingen en polls in. Instellingen staan op het
   teamdocument (teams/{id}.teamkamer), waarna de server de kopie bijwerkt.
   Importeert niets uit teams.js (geen kringverwijzing): teams.js geeft renderTeam mee aan
   koppelTeamkamer(). state.js is niet aangeraakt. */
import { db, functions, httpsCallable, doc, collection, addDoc, setDoc, updateDoc, deleteDoc, getDocs, query, where, onSnapshot, Timestamp } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261130c';
import * as K from './kamer-logica.js?v=20261127k';
import { actieveSport } from './sporten.js?v=20261126g';   /* [20261126g] alleen oefenstof van de eigen sport */

const roep = (naam, data) => httpsCallable(functions, naam)(data || {}).then(r => r.data);
const M = { teamId: null, sub: 'toegang', subs: [], kamer: null, link: null, aanvragen: [], leden: [], polls: [], berichten: [], gezin: {},
  stemmen: {}, stemSleutel: {}, open: '', form: null, zoek: '', vormen: null, teken: null, uitgesteld: false };

export const teamkamerZichtbaar = (team = S.team) => K.teamkamerMag(team, S._clubPlatform, S._teamkamerLos);
/* wat de eindbaas voor deze club (of voor trainers zonder club) heeft aangezet; wat uit staat, toont dit scherm niet */
const mag = (k) => K.optiesVan(S.team, S._clubPlatform, S._teamkamerLosOpties)[k] === true;
const inst = () => { const k = (S.team && S.team.teamkamer) || {}; return { aan: k.aan === true, namen: k.namen !== false, uitslag: k.uitslag === true, live: k.live === true,
  trainingen: k.trainingen === true, opstellingAltijd: k.opstellingAltijd === true, stats: { aan: false, ...(k.stats || {}) }, lijn: Array.isArray(k.lijn) ? k.lijn : [], thuis: k.thuis || null,
  thuisVideos: (Array.isArray(k.thuisVideos) ? k.thuisVideos : []).map(kamerVideo).filter(Boolean),
  videoCats: (Array.isArray(k.videoCats) ? k.videoCats : []).filter(c => typeof c === 'string' && c).slice(0, K.MAX_VIDEO_CATS) }; };
/* [20261126v] een gedeelde video zoals hij op het teamdocument staat: titel en bron (K.thuisVideo), plus categorie en
   wanneer hij gedeeld werd. Het vinkje voor de pushmelding (melding) en wie deelde (door) gaan alleen mee bij het toevoegen. */
function kamerVideo(v){
  const x = K.thuisVideo(v); if (!x) return null;
  if (typeof v.cat === 'string' && v.cat) x.cat = v.cat.slice(0, 30);
  if (Number(v.ms) > 0) x.ms = Number(v.ms);
  return x;
}
/* video's die de club met dit team deelde (S.videos, zie teams.js), als kandidaat voor Thuis oefenen */
const clubVideos = () => (S.videos || []).filter(v => (v.teams || []).includes(S.teamId))
  .map(v => { const x = K.thuisVideo(v); return x ? { ...x, clubCat: String(v.categorieNaam || '').slice(0, 30), plek: Number.isFinite(v.categorieVolgorde) ? v.categorieVolgorde : 999,
    volg: Number.isFinite(v.volgorde) ? v.volgorde : -((v.gemaakt && v.gemaakt.seconds) || 0) } : null; }).filter(Boolean)
  .sort((a, b) => a.plek - b.plek || a.volg - b.volg);
const zelfdeVideo = (a, b) => (a.yt && a.yt === b.yt) || (a.url && a.url === b.url);
const eigenSpelers = () => (S._eigenSpelers && S._eigenSpelers.length ? S._eigenSpelers : (S.spelers || [])).filter(p => p && !p.gearchiveerd && p.naam)
  .slice().sort((a, b) => (Number(a.nummer) || 999) - (Number(b.nummer) || 999) || String(a.naam).localeCompare(String(b.naam), 'nl'));
const voornaam = (p) => String((p && p.naam) || '').trim().split(/\s+/)[0];
const naamVan = (id) => voornaam(eigenSpelers().find(p => p.id === id)) || 'Speler';
const komendeWedstrijden = () => (S.wedstrijden || []).filter(w => w.datum && w.datum >= K.vandaagIso() && w.status !== 'afgelast')
  .slice().sort((a, b) => String(a.datum).localeCompare(String(b.datum))).slice(0, 6);
const foutTekst = (x) => (x && x.code === 'functions/not-found' ? 'De teamkamer-functies zijn nog niet gedeployed.' : (x && x.message) || 'Dat lukte niet.');

/* ==================== [20261116r] aanleveren: trainingen en cijfers ====================
   De trainersapp rekent al uit welke training op welke dag valt (trainingenPerWeek) en wat de speeltijd is
   (analyse.js). Een tweede berekening op de server zou andere uitkomsten kunnen geven. Daarom levert de app van de
   trainer aan (teams/{id}/kamerBeheer/trainingen en /stats) en zet de server daar alleen de toegestane velden van in
   de kopie voor ouders. Dit loopt mee als een trainer het team opent; er wordt alleen geschreven als er iets anders is. */
let syncTimer = 0;
const onthoud = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch (e){ return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e){ /* geen opslag */ } } };
export function syncTeamkamer(nu){ clearTimeout(syncTimer); syncTimer = setTimeout(() => doeSync().catch(() => {}), nu ? 300 : 4000); }
async function lever(teamId, naam, inhoud){
  const tekst = JSON.stringify(inhoud), sleutel = `tkSync:${teamId}:${naam}`;
  if (onthoud.get(sleutel) === tekst) return;
  await setDoc(doc(db, 'teams', teamId, 'kamerBeheer', naam), { ...inhoud, ms: Date.now(), tm: K.vandaagIso() });
  onthoud.set(sleutel, tekst);
}
async function doeSync(){
  const teamId = S.teamId, team = S.team;
  if (!teamId || !team || !teamkamerZichtbaar(team)) return;
  const i = inst();
  if (!i.aan) return;
  if (i.trainingen && mag('trainingen')){
    const { trainingenPerWeek } = await import('./teams-training.js?v=20261130c');
    if (S.teamId !== teamId) return;
    const vandaag = K.vandaagIso(), items = {};
    for (const g of trainingenPerWeek().komend) for (const x of g.items){
      if (!x.iso || x.iso < vandaag || items[x.iso] || Object.keys(items).length >= 4) continue;
      items[x.iso] = K.trainingVoorOuders(x.t);
    }
    await lever(teamId, 'trainingen', { items });
  }
  if (i.stats.aan && mag('stats') && (S.spelers || []).length){
    const [A, O] = await Promise.all([import('./analyse.js?v=20261130c'), import('./opkomst.js?v=20260922c')]);
    if (S.teamId !== teamId) return;
    const sz = S.huidigSeizoen, ditSeizoen = (x) => !sz || !x.seizoen || x.seizoen === sz;
    const spelers = K.statsVoorOuders(eigenSpelers(), (S.wedstrijden || []).filter(ditSeizoen), (S.presentie || []).filter(ditSeizoen),
      { analyse: A.analyseWedstrijd, reserve: A.speeltijdReserve, opkomst: O.opkomstVoor });
    await lever(teamId, 'stats', { spelers });
  }
}

function herteken(){
  S._vbVerversen?.();                                  /* open wedstrijdvoorbereiding (pollblok) */
  if (!M.teken || S.teamTab !== 'teamkamer' || S.wedstrijdId) return;
  const a = document.activeElement;
  if (a && a.closest && a.closest('.tkb') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){ M.uitgesteld = true; return; }   /* niet onder het typen */
  M.uitgesteld = false; M.teken();
}
function stop(){ M.subs.forEach(u => { try { u(); } catch (e){ /* al gestopt */ } }); M.subs = []; }
export function resetTeamkamer(){ stop(); M.teamId = null; }
function start(teamId){
  stop();
  Object.assign(M, { teamId, kamer: null, link: null, aanvragen: [], leden: [], polls: [], berichten: [], gezin: {}, stemmen: {}, stemSleutel: {}, open: '', form: null });
  const basis = doc(db, 'teamkamer', teamId), stil = () => {};
  M.subs.push(onSnapshot(basis, s => { M.kamer = s.data() || null; herteken(); }, stil));
  M.subs.push(onSnapshot(doc(db, 'teams', teamId, 'kamerBeheer', 'link'), s => { M.link = s.data() || null; herteken(); }, stil));
  M.subs.push(onSnapshot(query(collection(db, 'kamerAanvragen'), where('teamId', '==', teamId)), s => { M.aanvragen = s.docs.map(d => ({ id: d.id, ...d.data() })); herteken(); }, stil));
  M.subs.push(onSnapshot(collection(basis, 'kamerleden'), s => { M.leden = s.docs.map(d => ({ id: d.id, ...d.data() })); herteken(); }, stil));
  M.subs.push(onSnapshot(collection(basis, 'polls'), s => { M.polls = s.docs.map(d => ({ id: d.id, ...d.data() })); laadStemmen(); herteken(); }, stil));
  M.subs.push(onSnapshot(collection(basis, 'berichten'), s => { M.berichten = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.ms || 0) - (a.ms || 0)); herteken(); }, stil));
  M.subs.push(onSnapshot(collection(basis, 'gezin'), s => { M.gezin = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); herteken(); }, stil));
}
/* wie stemde wat: alleen de trainer leest de stemmen zelf (voor "nog niet gestemd" en namen bij een poll zonder namen) */
async function laadStemmen(){
  for (const p of M.polls.filter(x => x.status === 'open')){
    const sleutel = `${p.gestemd || 0}|${JSON.stringify(p.telling || {})}`;
    if (M.stemSleutel[p.id] === sleutel) continue;
    M.stemSleutel[p.id] = sleutel;
    try { const s = await getDocs(collection(db, 'teamkamer', M.teamId, 'polls', p.id, 'stemmen')); M.stemmen[p.id] = s.docs.map(d => ({ spelerId: d.id, keuzes: d.data().keuzes || [] })); herteken(); }
    catch (e){ /* geen stemmen te lezen */ }
  }
}

/* ---------- formulier voor een nieuwe poll ---------- */
function nieuwForm(sjId = 'rijden', wedstrijdId){
  const sj = K.SJABLONEN.find(x => x.id === sjId) || K.SJABLONEN[0], ws = komendeWedstrijden();
  const w = sj.wedstrijd ? (ws.find(x => x.id === wedstrijdId) || ws[0] || null) : null;
  const sluit = w ? (() => { const d = new Date(w.datum + 'T12:00:00'); d.setDate(d.getDate() - 1); return K.vandaagIso(d) < K.vandaagIso() ? K.vandaagIso() : K.vandaagIso(d); })()
    : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return K.vandaagIso(d); })();
  return { soort: sj.id, vraag: sj.vraag(w), opties: [...sj.opties], wedstrijdId: w ? w.id : '', meer: sj.meer === true, namen: true, spelers: false, nodig: sj.nodig || 4, sluit, melding: true };
}
export function openPollVoorWedstrijd(wedstrijdId, soort = 'rijden'){ M.sub = 'polls'; M.form = nieuwForm(soort, wedstrijdId); }

/* ==================== html ==================== */
const sw = (naam, uitleg, aan, attr) => `<div class="tk-schakel"><div><div class="tk-vet">${esc(naam)}</div>${uitleg ? `<div class="tk-klein tk-zacht">${esc(uitleg)}</div>` : ''}</div>
  <button type="button" class="tk-sw" role="switch" aria-checked="${aan}" aria-label="${esc(naam)}" ${attr}></button></div>`;

function htmlUit(){
  return `<section class="tk-kaart"><h2 class="tk-h2">Teamkamer voor ouders en spelers</h2>
    <p style="margin:0">Ouders en spelers zien de agenda, wie erbij is, je mededelingen en polls. Afmelden blijft via de groepsapp gaan: jij zet het in Cluppie.</p>
    <div class="tk-label ok">Dit zien ze</div><div>Trainingen en wedstrijden, met tijd en plek</div><div>${mag('namen') ? 'Wie erbij is, met voornaam en zonder reden' : 'Hoeveel spelers erbij zijn, zonder namen en zonder reden'}</div>${mag('polls') ? '<div>Polls, zoals wie rijdt en wie wast</div>' : ''}
    <div class="tk-label let">Dit zien ze nooit</div><div>Beoordelingen, leerpunten en notities</div><div>De reden van een afmelding</div><div>Achternamen, andere teams en cijfers van andere kinderen</div>
    <button class="tk-knop" data-tk="aan">Zet de teamkamer aan</button>
    <p class="tk-klein tk-zacht" style="margin:0">Je keurt elke ouder zelf goed.${mag('spelers') ? ' Een speler komt binnen met een code van de eigen ouder, zonder e-mailadres.' : ''}</p></section>`;
}
function htmlToegang(){
  const l = M.link, sp = eigenSpelers(), url = l && l.code ? `${K.KAMER_URL}?k=${l.code}` : '';
  const tot = l && l.verlooptOp && l.verlooptOp.toDate ? K.datumLang(K.vandaagIso(l.verlooptOp.toDate())) : '';
  const perSpeler = (id) => M.leden.filter(x => (x.spelerIds || []).includes(id));
  const gezinnen = sp.filter(p => perSpeler(p.id).some(x => x.rol === 'ouder')).length;
  return `<section class="tk-kaart"><div class="tk-label">Teamlink voor de groepsapp</div>
      ${url ? `<div class="tk-bericht" style="overflow-wrap:anywhere;font-size:var(--t-md)">${esc(url)}</div>
        <div class="tk-klein tk-zacht">${tot ? 'Geldig tot ' + esc(tot) + '. ' : ''}${l.gebruikt || 0} van ${l.maxGebruik || 40} keer gebruikt. Wie de link opent ziet alleen de teamnaam.</div>
        <div class="tk-twee"><a class="tk-knop" href="${esc(K.waUrl(K.linkTekst(S.team?.naam, l.code)))}" target="_blank" rel="noopener">Deel in WhatsApp</a><button class="tk-knop licht" data-tk="kopieer" data-tekst="${esc(url)}">Kopieer</button></div>
        <button class="tk-knop tekst" data-tk="link">Maak een nieuwe link (de oude stopt)</button>`
      : '<button class="tk-knop" data-tk="link">Maak een teamlink</button>'}</section>
    <section class="tk-kaart"><div class="tk-rij"><span class="tk-label">Aanvragen</span><span class="tk-klein tk-vet ${M.aanvragen.length ? 'tk-let' : ''}">${M.aanvragen.length ? M.aanvragen.length + ' wachten' : 'Geen'}</span></div>
      ${M.aanvragen.map(a => { const raad = K.raadSpeler(sp, a.kind);
        return `<div class="tk-bericht" style="display:flex;flex-direction:column;gap:8px" data-aanvraag="${esc(a.id)}">
          <div class="tk-vet" style="overflow-wrap:anywhere">${esc(a.email || 'onbekend adres')}</div>
          <div class="tk-rij"><span class="tk-zacht">Vulde in</span><span>Ouder van ${esc(a.kind || '')}</span></div>
          <div class="tk-veld"><label for="tk-sp-${esc(a.id)}">Koppelen aan</label><select class="tk-invoer" id="tk-sp-${esc(a.id)}"><option value="">Kies de speler</option>
            ${sp.map(p => `<option value="${esc(p.id)}" ${p.id === raad ? 'selected' : ''}>${esc(voornaam(p))}${p.nummer != null && p.nummer !== '' ? ', nr ' + esc(p.nummer) : ''}</option>`).join('')}</select></div>
          <div class="tk-twee"><button class="tk-knop klein" data-tk="goed" data-id="${esc(a.id)}">Goedkeuren</button><button class="tk-knop licht klein" data-tk="af" data-id="${esc(a.id)}">Afwijzen</button></div></div>`; }).join('')
        || '<div class="tk-zacht">Nieuwe aanvragen komen hier te staan. Ken je iemand niet? Wijs dan af.</div>'}</section>
    <section class="tk-kaart" style="gap:4px"><div class="tk-rij"><span class="tk-label">Wie kijkt mee</span><span class="tk-klein tk-vet">${gezinnen} van ${sp.length} gezinnen</span></div>
      ${sp.map(p => { const leden = perSpeler(p.id), ouders = leden.filter(x => x.rol === 'ouder').length, kind = leden.filter(x => x.rol === 'speler').length, isOpen = M.open === p.id;
        const tekst = [ouders && `${ouders} ouder${ouders === 1 ? '' : 's'}`, kind && 'speler'].filter(Boolean).join(', ') || 'Nog niemand';
        return `<div style="border-bottom:1px solid var(--hair)"><button class="tk-item-kop" style="padding:4px 0;min-height:48px" data-tk="open" data-id="${esc(p.id)}" aria-expanded="${isOpen}" ${leden.length ? '' : 'disabled'}>
            <span class="tk-zacht tk-vet" style="width:32px">${p.nummer != null ? esc(p.nummer) : ''}</span><span class="tk-item-tekst tk-vet">${esc(voornaam(p))}</span><span class="tk-klein ${leden.length ? 'tk-zacht' : 'tk-let'}">${tekst}</span></button>
          ${isOpen ? leden.map(x => `<div class="tk-rij" style="padding:4px 0 8px 32px"><span class="tk-klein" style="overflow-wrap:anywhere;text-align:left">${x.rol === 'ouder' ? esc(x.email || 'Ouder') : 'Speler zelf (code van een ouder)'}</span>
            <button class="tk-knop licht klein" data-tk="trek" data-uid="${esc(x.id)}">Trek in</button></div>`).join('') : ''}</div>`; }).join('')}
      <div class="tk-klein tk-zacht" style="padding-top:8px">Alle toegang stopt vanzelf op 30 juni en meteen als een speler het team verlaat.</div>
      <button class="tk-knop tekst" data-tk="verleng">Verleng alle toegang tot het einde van het seizoen</button></section>`;
}
function htmlPollForm(){
  const f = M.form || (M.form = nieuwForm()), ws = komendeWedstrijden();
  return `<section class="tk-kaart" style="gap:14px"><div class="tk-label">Nieuwe poll</div>
    <div class="tk-chips">${K.SJABLONEN.map(s => `<button type="button" class="tk-chip" data-tk="sjabloon" data-id="${s.id}" aria-pressed="${f.soort === s.id}">${esc(s.naam)}</button>`).join('')}</div>
    <div class="tk-veld"><label for="tk-vraag">Vraag</label><input class="tk-invoer" id="tk-vraag" data-tkf="vraag" maxlength="140" value="${esc(f.vraag)}" placeholder="Typ je vraag"></div>
    <div class="tk-veld"><span class="tk-veldnaam">Antwoorden</span>
      ${f.opties.map((o, n) => `<input class="tk-invoer" data-tkf="optie" data-n="${n}" maxlength="80" value="${esc(o)}" placeholder="Antwoord ${n + 1}" aria-label="Antwoord ${n + 1}">`).join('')}
      ${f.opties.length < 12 ? '<button type="button" class="tk-knop licht klein" data-tk="optieplus">Antwoord toevoegen</button>' : ''}</div>
    <div class="tk-veld"><label for="tk-bij">Hoort bij</label><select class="tk-invoer" id="tk-bij" data-tkf="wedstrijdId"><option value="">Losse poll</option>
      ${ws.map(w => `<option value="${esc(w.id)}" ${f.wedstrijdId === w.id ? 'selected' : ''}>Wedstrijd ${esc(K.datumKort(w.datum))}${w.tegenstander ? ', ' + esc(w.tegenstander) : ''}</option>`).join('')}</select></div>
    ${f.soort === 'rijden' ? `<div class="tk-veld"><label for="tk-nodig">Auto's nodig</label><input class="tk-invoer" id="tk-nodig" data-tkf="nodig" type="number" inputmode="numeric" min="1" max="9" value="${esc(f.nodig)}"></div>` : ''}
    <div>${sw('Meer antwoorden mogelijk', 'Een gezin kiest er meer dan één', f.meer, 'data-tk="fsw" data-veld="meer"')}
      ${sw('Namen zichtbaar voor ouders', f.namen ? 'Ouders zien wie wat koos (de voornaam van het kind)' : 'Ouders zien alleen aantallen; jij ziet wie wat koos', f.namen, 'data-tk="fsw" data-veld="namen"')}
      ${sw('Spelers mogen ook stemmen', 'Eén stem per gezin: de laatste geldt', f.spelers, 'data-tk="fsw" data-veld="spelers"')}
      ${sw('Stuur een pushmelding', 'Ouders die meldingen aanzetten in de teamkamer krijgen bericht op hun telefoon', f.melding !== false, 'data-tk="fsw" data-veld="melding"')}</div>
    <div class="tk-veld"><label for="tk-sluit">Sluit op</label><input class="tk-invoer" id="tk-sluit" data-tkf="sluit" type="date" value="${esc(f.sluit)}" min="${K.vandaagIso()}"></div>
    <button class="tk-knop" data-tk="plaatspoll">Plaats poll</button>
    <p class="tk-klein tk-zacht" style="margin:0">Voor wie er kan komen maak je geen poll: afmelden gaat via de groepsapp.</p></section>`;
}
/* [20261126m] pushmeldingen: wat de server terugschreef (meldingBereik, herinnerBereik), en hooguit één herinnering per zes uur */
const HERINNER_MS = 6 * 3600000;
const herinnerKan = (p) => !p.herinnerMs || Date.now() - Number(p.herinnerMs) >= HERINNER_MS;
const ouders = (n) => `${n} ${n === 1 ? 'ouder' : 'ouders'}`;
function meldRegel(x){
  const r = [];
  if (typeof x.meldingBereik === 'number') r.push(x.meldingBereik ? `Pushmelding naar ${ouders(x.meldingBereik)}` : 'Pushmelding verstuurd, maar nog geen ouder heeft meldingen aan');
  else if (x.melding === true) r.push('Pushmelding wordt verstuurd…');
  if (typeof x.herinnerBereik === 'number') r.push(`herinnering naar ${ouders(x.herinnerBereik)}`);
  return r.length ? `<div class="tk-klein tk-zacht">${esc(r.join(', '))}</div>` : '';
}
function htmlPollBeheer(p){
  const sp = eigenSpelers(), spelersMap = Object.fromEntries(sp.map(x => [x.id, { n: voornaam(x) }]));
  const stemmen = M.stemmen[p.id] || [], w = K.pollWeergave(p, spelersMap, [], sp.length);
  const wie = (optieId) => K.namenLijst(spelersMap, stemmen.filter(s => s.keuzes.includes(optieId)).map(s => s.spelerId));
  const niet = K.nogNiet(sp.map(x => x.id), stemmen.filter(s => s.keuzes.length).map(s => s.spelerId));
  return `<section class="tk-kaart"><div class="tk-rij"><span class="tk-label ${w.open ? 'accent' : ''}">${w.open ? 'Loopt' : 'Gesloten'}${p.wedstrijdDatum ? ', wedstrijd ' + esc(K.datumKort(p.wedstrijdDatum)) : ''}</span>${w.nodig ? `<span class="tk-klein tk-vet">${esc(w.nodig)}</span>` : ''}</div>
    <div class="tk-h3">${esc(p.vraag)}</div>
    ${w.opties.map(o => `<div class="tk-rij" style="align-items:flex-start"><span class="tk-zacht" style="text-align:left">${esc(o.tekst)}</span><span><b>${o.aantal}</b>${w.open && wie(o.id) ? `<div class="tk-klein">${esc(wie(o.id))}</div>` : (o.namen ? `<div class="tk-klein">${esc(o.namen)}</div>` : '')}</span></div>`).join('')}
    <div class="tk-rij tk-lijn"><span class="tk-zacht">Gestemd</span><span class="tk-vet">${w.gestemd} van ${sp.length} gezinnen</span></div>
    ${w.open && niet.length ? `<div class="tk-rij" style="align-items:flex-start"><span class="tk-zacht" style="white-space:nowrap">Nog niet</span><span>${esc(niet.map(naamVan).join(', '))}</span></div><div class="tk-klein tk-zacht">Wie nog niet stemde zie alleen jij.</div>` : ''}
    ${meldRegel(p)}
    ${w.open && niet.length ? (herinnerKan(p) ? `<button class="tk-knop licht klein" data-tk="herinner" data-id="${esc(p.id)}">Herinner wie nog niet stemde</button>`
      : '<div class="tk-klein tk-zacht">Herinnering verstuurd. Over zes uur kan het weer.</div>') : ''}
    <div class="tk-twee">${w.open ? `<a class="tk-knop licht klein" href="${esc(K.waUrl(K.pollTekst(p.vraag, p.id)))}" target="_blank" rel="noopener">Deel in WhatsApp</a><button class="tk-knop licht klein" data-tk="sluitpoll" data-id="${esc(p.id)}">Sluit poll</button>`
      : `<button class="tk-knop licht klein" data-tk="heropen" data-id="${esc(p.id)}">Heropen</button><button class="tk-knop licht klein" data-tk="wispoll" data-id="${esc(p.id)}">Verwijder</button>`}</div></section>`;
}
function htmlBerichten(){
  return `<section class="tk-kaart"><label class="tk-label" for="tk-bericht">Nieuwe mededeling</label>
      <textarea class="tk-invoer" id="tk-bericht" maxlength="600" placeholder="Bijvoorbeeld: donderdag trainen we op veld 3."></textarea>
      <div class="tk-klein tk-zacht">Ouders en spelers kunnen niet reageren. Zet geen namen of gezondheid van spelers in je bericht.</div>
      <label class="tk-vink"><input type="checkbox" id="tk-bericht-melding" ${M.berichtMelding === false ? '' : 'checked'}><span>Stuur een pushmelding naar ouders die meldingen aan hebben</span></label>
      <button class="tk-knop" data-tk="plaatsbericht">Plaats mededeling</button></section>
    ${M.berichten.map(b => `<section class="tk-kaart" style="gap:6px"><p style="margin:0;white-space:pre-line">${esc(b.tekst)}</p>
      <div class="tk-klein tk-zacht">${esc([b.datum && K.datumLang(b.datum), b.door].filter(Boolean).join(', door '))}</div>
      ${meldRegel(b)}
      <div class="tk-twee"><a class="tk-knop licht klein" href="${esc(K.waUrl(K.berichtTekst()))}" target="_blank" rel="noopener">Meld het in WhatsApp</a><button class="tk-knop licht klein" data-tk="wisbericht" data-id="${esc(b.id)}">Verwijder</button></div></section>`).join('')}`;
}
function htmlInstellingen(){
  const i = inst(), ws = komendeWedstrijden().slice(0, 3), sp = eigenSpelers();
  const lijn = [0, 1, 2].map(n => i.lijn[n] || '');
  const beurten = sp.filter(p => M.gezin[p.id] && M.gezin[p.id].beurten);
  const treffers = M.zoek && M.vormen ? M.vormen.filter(v => v.naam.toLowerCase().includes(M.zoek.toLowerCase())).slice(0, 6) : [];
  return `<section class="tk-kaart" style="gap:4px"><div class="tk-label">Wat ouders en spelers zien</div>
      ${mag('namen') ? sw('Voornamen van teamgenoten', 'Een ouder kan het eigen kind verbergen', i.namen, 'data-tk="isw" data-veld="namen"') : '<div class="tk-zacht">Ouders zien hoeveel spelers erbij zijn, zonder namen.</div>'}
      ${mag('uitslag') ? sw('Uitslag', 'De dag na de wedstrijd', i.uitslag, 'data-tk="isw" data-veld="uitslag"') : ''}
      ${mag('live') ? sw('Live stand', 'Op de wedstrijddag, alleen de stand en geen namen', i.live, 'data-tk="isw" data-veld="live"') : ''}
      ${mag('trainingen') ? sw('Trainingen', 'De komende trainingen met thema, oefeningen en 3D. Alleen kijken, zonder jouw aantekeningen.', i.trainingen, 'data-tk="isw" data-veld="trainingen"') : ''}
      ${mag('opstelling') ? sw('Opstelling altijd delen', i.opstellingAltijd ? 'Elke wedstrijd, vanaf de dag ervoor' : 'Uit: je deelt per wedstrijd (hieronder)', i.opstellingAltijd, 'data-tk="isw" data-veld="opstellingAltijd"') : ''}
      ${mag('hulp') ? '<div class="tk-klein tk-zacht tk-lijn">Trainingshulp: ouders schrijven zich hier in als helper bij een training. Je zet dat per lijst aan, in Lijstjes bij een lijst Trainingshulp.</div>' : ''}
      <div class="tk-klein tk-zacht tk-lijn">Nooit zichtbaar, ook niet met een schakelaar: redenen van afwezigheid, beoordelingen, leerpunten en achternamen.</div></section>
    ${mag('stats') ? `<section class="tk-kaart" style="gap:4px"><div class="tk-label">Cijfers van het eigen kind</div>
      ${sw('Cijfers tonen aan ouders', 'Een ouder ziet alleen het eigen kind. Nooit teamgenoten, nooit een ranglijst. Spelers zelf zien het niet.', i.stats.aan === true, 'data-tk="statsaan"')}
      ${i.stats.aan === true ? K.STATS_SOORTEN.map(([k, naam, uitleg]) => `<label class="tk-vink" style="padding-left:12px;border-left:2px solid var(--hair)"><input type="checkbox" data-tkstat="${k}" ${i.stats[k] === true ? 'checked' : ''}><span>${esc(naam)}${uitleg ? `<span class="tk-klein tk-zacht" style="display:block">${esc(uitleg)}</span>` : ''}</span></label>`).join('')
        + '<div class="tk-klein tk-zacht" style="padding-top:8px">De cijfers komen uit jouw statistieken van dit seizoen en lopen bij als een trainer het team opent.</div>' : ''}</section>` : ''}
    ${ws.length && mag('opstelling') ? `<section class="tk-kaart" style="gap:4px"><div class="tk-label">Opstelling delen</div>
      ${ws.map(w => sw(`${K.hoofdletter(K.datumKort(w.datum))}${w.tegenstander ? ', ' + w.tegenstander : ''}`, w.deelOpstelling === true ? 'Ouders zien de opstelling van de eerste periode' : 'Staat uit tot jij hem aanzet', w.deelOpstelling === true, `data-tk="opstelling" data-id="${esc(w.id)}"`)).join('')}</section>` : ''}
    ${mag('thuis') ? `<section class="tk-kaart"><h2 class="tk-label">Thuis oefenen</h2>
      <div class="tk-klein tk-zacht">Eén oefening die spelers thuis in 3D bekijken.</div>
      <h3 class="tk-veldnaam">Oefening in 3D</h3>
      ${i.thuis ? `<div class="tk-rij"><span class="tk-vet" style="text-align:left">${esc(i.thuis.naam || i.thuis.vormId)}</span><button class="tk-knop licht klein" data-tk="thuisweg">Haal weg</button></div>` : ''}
      <div class="tk-veld"><label for="tk-zoek">${i.thuis ? 'Kies een andere oefening' : 'Zoek een oefening'}</label><input class="tk-invoer" id="tk-zoek" data-tkf="zoek" value="${esc(M.zoek)}" placeholder="Bijvoorbeeld: dribbelen"></div>
      <div id="tk-treffers" style="display:flex;flex-direction:column;gap:8px">${treffers.map(trefferHtml).join('')}</div>
      <div class="tk-rij tk-lijn"><span class="tk-klein tk-zacht" style="text-align:left">Video's deel je onder Video's${i.thuisVideos.length ? ` (nu ${i.thuisVideos.length} gedeeld)` : ''}.</span><button class="tk-knop licht klein" data-tk="sub" data-id="videos">Naar Video's</button></div></section>` : ''}
    ${mag('lijn') ? `<section class="tk-kaart"><div class="tk-label">Zo moedigen wij aan</div><div class="tk-klein tk-zacht">Drie afspraken voor langs de lijn. Ouders zien ze rond een wedstrijd. Leeg laten geeft de standaardtekst.</div>
      ${lijn.map((r, n) => `<input class="tk-invoer" data-tklijn="${n}" maxlength="90" value="${esc(r)}" aria-label="Afspraak ${n + 1}" placeholder="Afspraak ${n + 1}">`).join('')}
      <button class="tk-knop licht" data-tk="lijn">Bewaar de afspraken</button></section>` : ''}
    ${beurten.length && mag('beurten') ? `<section class="tk-kaart"><div class="tk-label">Beurten dit seizoen</div><div class="tk-klein tk-zacht">Geteld bij het sluiten van een poll (rijden, wassen, fruit, vlaggen). Een ouder ziet alleen de eigen teller en het gemiddelde.</div>
      ${beurten.map(p => `<div class="tk-rij"><span class="tk-vet" style="text-align:left">${esc(voornaam(p))}</span><span class="tk-klein">${K.BEURT_SOORTEN.filter(s => M.gezin[p.id].beurten[s]).map(s => `${K.BEURT_NAMEN[s]} ${M.gezin[p.id].beurten[s]}`).join(', ')}</span></div>`).join('')}
      ${(() => { const nooit = sp.filter(p => !(M.gezin[p.id] && M.gezin[p.id].beurten && M.gezin[p.id].beurten.rijden)); return nooit.length && nooit.length < sp.length ? `<div class="tk-rij tk-lijn" style="align-items:flex-start"><span class="tk-zacht" style="white-space:nowrap">Nog niet gereden</span><span>${esc(nooit.map(voornaam).join(', '))}</span></div>` : ''; })()}</section>` : ''}
    <div class="tk-klein tk-zacht">Meer mogelijkheden (zoals polls, mededelingen of de live stand) zet Cluppie per club aan.</div>
    <section class="tk-kaart"><button class="tk-knop licht" data-tk="ververs">Werk de teamkamer nu bij</button>
      <button class="tk-knop licht" data-tk="uit">Zet de teamkamer uit</button><div class="tk-klein tk-zacht">Uitzetten sluit de teamkamer voor iedereen. Polls en mededelingen blijven bewaard tot je hem weer aanzet.</div></section>`;
}
/* ==================== [20261126v] Video's delen in de teamkamer ====================
   De trainer deelt video's van de club (Team, Video's) of een YouTube-link met ouders en spelers, en deelt ze in
   in eigen categorieën (teamkamer.videoCats). Een video van de club krijgt standaard dezelfde categorie als bij de
   club; bestaat die in de teamkamer nog niet, dan komt hij erbij. Ouders zien de video's in de tab Video's. */
const CLUBCAT = '_club';
function htmlVideos(){
  const i = inst(), cats = i.videoCats, vol = i.thuisVideos.length >= K.MAX_THUIS_VIDEOS;
  const groepen = K.videoGroepen(i.thuisVideos, cats), indexVan = (v) => i.thuisVideos.findIndex(x => K.videoSleutel(x) === K.videoSleutel(v));
  const kies = clubVideos().filter(v => !i.thuisVideos.some(x => zelfdeVideo(x, v)));
  const perClubCat = new Map(); for (const v of kies){ const k = v.clubCat || ''; if (!perClubCat.has(k)) perClubCat.set(k, []); perClubCat.get(k).push(v); }
  const nieuwCat = M.videoCat === undefined ? CLUBCAT : M.videoCat;
  const vm = M.kamer && M.kamer.videoMelding;
  const catSelect = (huidig, attr, metClub) => `<select class="tk-invoer" ${attr}>${metClub ? `<option value="${CLUBCAT}" ${huidig === CLUBCAT ? 'selected' : ''}>Zoals bij de club</option>` : ''}
    <option value="" ${huidig === '' ? 'selected' : ''}>Geen categorie</option>${cats.map(c => `<option value="${esc(c)}" ${huidig === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`;
  return `<section class="tk-kaart"><h2 class="tk-label">Video's in de teamkamer</h2>
      <div class="tk-klein tk-zacht">Ouders en spelers zien deze video's in de teamkamer, onder Video's, per categorie. ${i.thuisVideos.length} van ${K.MAX_THUIS_VIDEOS} gedeeld.</div>
      ${vm && vm.ms && Date.now() - vm.ms < 7 * 864e5 ? `<div class="tk-klein tk-zacht">Laatste melding over ${vm.aantal === 1 ? 'een video' : vm.aantal + " video's"}: ${vm.ouders ? `naar ${ouders(vm.ouders)}` : 'nog geen ouder heeft meldingen aan'}.</div>` : ''}</section>
    <section class="tk-kaart"><h2 class="tk-label">Categorieën</h2>
      <div class="tk-klein tk-zacht">Bijvoorbeeld Thuis oefenen, Techniek of Uitleg voor ouders. Ouders zien ze in deze volgorde.</div>
      ${cats.map((c, n) => `<div class="tk-rij"><span class="tk-vet" style="text-align:left;flex:1">${esc(c)} <span class="tk-klein tk-zacht" style="font-weight:400">${i.thuisVideos.filter(v => v.cat === c).length}</span></span>
        ${n ? `<button class="tk-knop licht klein" data-tk="vcatop" data-n="${n}" aria-label="${esc(c)} hoger">Hoger</button>` : ''}<button class="tk-knop licht klein" data-tk="vcatweg" data-n="${n}" aria-label="${esc(c)} verwijderen">Verwijder</button></div>`).join('') || '<div class="tk-zacht">Nog geen categorieën. Zonder categorieën staan alle video\'s in één lijst.</div>'}
      ${cats.length < K.MAX_VIDEO_CATS ? `<div class="tk-met-knop"><input class="tk-invoer" id="tk-vcat" maxlength="30" autocomplete="off" placeholder="Nieuwe categorie" aria-label="Nieuwe categorie"><button class="tk-knop licht klein" data-tk="vcatplus">Voeg toe</button></div>` : ''}</section>
    <section class="tk-kaart"><h2 class="tk-label">Gedeeld</h2>
      ${groepen.map(g => `${g.naam ? `<h3 class="tk-veldnaam">${esc(g.naam)}</h3>` : ''}${g.videos.map(v => { const n = indexVan(v);
        return `<div class="tk-video-rij tk-video-beheer">${videoBeeld(v)}<span class="tk-item-tekst"><span class="tk-vet" style="display:block">${esc(v.titel)}</span>
          ${cats.length ? catSelect(v.cat && cats.includes(v.cat) ? v.cat : '', `data-tkvcat="${n}" aria-label="Categorie van ${esc(v.titel)}"`, false) : `<span class="tk-klein tk-zacht">${v.yt ? 'YouTube' : 'Video van de club'}</span>`}</span>
          <button class="tk-knop licht klein" data-tk="videoweg" data-n="${n}">Haal weg</button></div>`; }).join('')}`).join('') || '<div class="tk-zacht">Nog geen video\'s gedeeld. Kies hieronder een video van de club of plak een YouTube-link.</div>'}</section>
    ${vol ? `<div class="tk-melding"><span>Het maximum van ${K.MAX_THUIS_VIDEOS} video's is bereikt. Haal er eerst een weg.</span></div>` : `<section class="tk-kaart"><h2 class="tk-label">Video delen</h2>
      <div class="tk-veld"><label for="tk-vnieuwcat">In categorie</label>${catSelect(nieuwCat, 'id="tk-vnieuwcat" data-tkf="videocat"', true)}</div>
      <label class="tk-vink"><input type="checkbox" id="tk-vmelding" ${M.videoMelding === false ? '' : 'checked'}><span>Stuur een pushmelding naar ouders die meldingen aan hebben</span></label>
      ${[...perClubCat.entries()].map(([naam, vids]) => `<h3 class="tk-veldnaam tk-lijn">${esc(naam || (perClubCat.size > 1 ? 'Overige video\'s van de club' : 'Video\'s van de club'))}</h3>
        ${vids.map(v => `<button class="tk-video-rij tk-video-kies" data-tk="videoclub" data-yt="${esc(v.yt || '')}" data-url="${esc(v.url || '')}" data-titel="${esc(v.titel)}" data-clubcat="${esc(v.clubCat)}">${videoBeeld(v)}<span class="tk-item-tekst tk-vet">${esc(v.titel)}</span><span class="tk-klein tk-zacht">Deel</span></button>`).join('')}`).join('')
        || (S.team && S.team.club ? (clubVideos().length ? '<div class="tk-klein tk-zacht">Alle video\'s van de club staan er al in.</div>' : '<div class="tk-klein tk-zacht">De club deelt nog geen video\'s met dit team (Club, Video\'s).</div>') : '')}
      <h3 class="tk-veldnaam tk-lijn">YouTube-link</h3>
      <div class="tk-veld"><label for="tk-yt">Link</label><input class="tk-invoer" id="tk-yt" type="url" inputmode="url" autocomplete="off" placeholder="https://www.youtube.com/watch?v=..."></div>
      <div class="tk-veld"><label for="tk-yt-titel">Titel voor ouders en spelers</label><input class="tk-invoer" id="tk-yt-titel" maxlength="80" autocomplete="off" placeholder="Bijvoorbeeld: kappen en draaien"></div>
      <button class="tk-knop licht" data-tk="videoplus">Deel de video</button>
      <div class="tk-klein tk-zacht">Kies alleen video's die kinderen zonder toezicht mogen zien, en geen beelden waarop spelers herkenbaar zijn.</div></section>`}`;
}
/* [20261126v] één video delen (vanuit dit scherm of vanuit Team, Video's). cat = naam van een categorie, CLUBCAT = die
   van de club (komt erbij als hij nog niet bestaat en er plek is), '' = geen. Geeft de tekst voor de melding terug. */
async function deelVideo(v, cat, melding){
  const i = inst(), nu = i.thuisVideos;
  if (nu.length >= K.MAX_THUIS_VIDEOS) throw new Error(`Maximaal ${K.MAX_THUIS_VIDEOS} video's`);
  const x = K.thuisVideo(v);
  if (!x) throw new Error('Plak een geldige YouTube-link');
  if (nu.some(y => zelfdeVideo(y, x))) throw new Error('Deze video staat er al');
  let cats = i.videoCats, naam = cat === CLUBCAT ? String(v.clubCat || '').trim() : String(cat || '');
  if (naam && !cats.includes(naam)){
    const r = K.catErbij(cats, naam);
    if (r.cats) cats = r.cats; naam = r.naam && (r.cats || cats).includes(r.naam) ? r.naam : '';
  }
  const nieuw = { ...x, ...(naam ? { cat: naam } : {}), ms: Date.now(), ...(melding ? { melding: true, door: S.user.uid } : {}) };
  await zetInst({ thuisVideos: [...nu, nieuw], ...(cats !== i.videoCats ? { videoCats: cats } : {}) });
  return `Gedeeld in de teamkamer${naam ? ', bij ' + naam : ''}${melding ? '. Ouders met meldingen aan krijgen bericht.' : ''}`;
}
/* [20261126v] voor Team, Video's: staat deze video van de club in de teamkamer? null = de teamkamer staat (hier) niet aan */
export function videoInKamer(vid){
  if (!S.team || !teamkamerZichtbaar() || !inst().aan || !mag('thuis')) return null;
  const x = K.thuisVideo(vid); if (!x) return null;
  return inst().thuisVideos.some(y => zelfdeVideo(y, x));
}
export async function wisselVideoInKamer(vid){
  const x = K.thuisVideo(vid); if (!x) return;
  const nu = inst().thuisVideos, n = nu.findIndex(y => zelfdeVideo(y, x));
  try {
    if (n >= 0){ nu.splice(n, 1); await zetInst({ thuisVideos: nu }); meld('Uit de teamkamer gehaald'); }
    else meld(await deelVideo({ ...vid, clubCat: vid.categorieNaam || '' }, CLUBCAT, true));
  } catch (e){ meld((e && e.message) || 'Dat lukte niet.'); }
}
const videoBeeld = (v) => `<span class="tk-video-beeld">${v.yt ? `<img src="${esc(K.ytThumb(v.yt))}" alt="" loading="lazy">` : ''}</span>`;
const trefferHtml = (v) => `<button class="tk-knop licht klein" style="justify-content:flex-start" data-tk="thuis" data-id="${esc(v.id)}">${esc(v.naam)}</button>`;
export function htmlTeamkamer(){
  if (!teamkamerZichtbaar()) return '<div class="kaart leeg">De teamkamer staat niet aan voor deze club.</div>';
  if (M.teamId !== S.teamId) start(S.teamId);
  if (!inst().aan) return `<div class="tkb">${htmlUit()}</div>`;
  const subs = [['toegang', 'Toegang'], ...(mag('polls') ? [['polls', 'Polls']] : []), ...(mag('berichten') ? [['berichten', 'Mededelingen']] : []), ...(mag('thuis') ? [['videos', "Video's"]] : []), ['instellingen', 'Instellingen']];
  if (!subs.some(s => s[0] === M.sub)) M.sub = 'toegang';
  const wacht = M.aanvragen.length;
  return `<div class="tkb" style="display:flex;flex-direction:column;gap:12px">
    <div class="tk-seg">${subs.map(s => `<button type="button" data-tk="sub" data-id="${s[0]}" aria-pressed="${M.sub === s[0]}">${s[1]}${s[0] === 'toegang' && wacht ? ` (${wacht})` : ''}</button>`).join('')}</div>
    ${M.kamer && M.kamer.aan === true ? '' : '<div class="tk-melding"><span>De teamkamer wordt klaargezet. Duurt dit langer dan een minuut, kies dan Instellingen en "Werk de teamkamer nu bij".</span></div>'}
    ${M.sub === 'polls' ? htmlPollForm() + K.sorteerPolls(M.polls).map(htmlPollBeheer).join('')
      : M.sub === 'berichten' ? htmlBerichten() : M.sub === 'videos' ? htmlVideos() : M.sub === 'instellingen' ? htmlInstellingen() : htmlToegang()}</div>`;
}
/* kort blok voor de wedstrijdvoorbereiding: polls bij deze wedstrijd */
export function htmlPollsBijWedstrijd(w){
  if (!w || !teamkamerZichtbaar() || !inst().aan || !(mag('polls') || mag('opstelling'))) return '';
  if (M.teamId !== S.teamId) start(S.teamId);
  /* [20261116p] opstelling delen staat ook hier, bij de wedstrijd zelf (was alleen te vinden onder Teamkamer › Instellingen) */
  const deel = mag('opstelling') ? `<section class="tk-kaart" style="margin-bottom:12px"><div class="tk-label">Teamkamer: opstelling</div>
    ${sw('Deel de opstelling met ouders en spelers', w.deelOpstelling === true ? 'Ze zien de opstelling van de eerste periode op een veld, met voornamen' : 'Staat uit tot jij hem aanzet', w.deelOpstelling === true, `data-tk-deel="${esc(w.id)}"`)}</section>` : '';
  if (!mag('polls')) return deel;
  const polls = M.polls.filter(p => p.wedstrijdId === w.id), sp = eigenSpelers(), spelersMap = Object.fromEntries(sp.map(x => [x.id, { n: voornaam(x) }]));
  const regel = (p) => { const x = K.pollWeergave(p, spelersMap, [], sp.length), ja = x.opties[0];
    const wie = ja ? K.namenLijst(spelersMap, (M.stemmen[p.id] || []).filter(s => s.keuzes.includes(ja.id)).map(s => s.spelerId)) : '';
    return `<div class="tk-rij"><span class="tk-zacht" style="text-align:left">${esc(K.BEURT_NAMEN[p.soort] || p.vraag)}${x.open ? '' : ' (gesloten)'}</span><span class="tk-vet">${esc([x.nodig, wie].filter(Boolean).join(': ') || `${x.gestemd} gestemd`)}</span></div>`; };
  const ontbreekt = ['rijden', 'wassen'].filter(s => !polls.some(p => p.soort === s) && (s !== 'rijden' || w.thuis !== true));
  return `<section class="tk-kaart" style="margin-bottom:12px"><div class="tk-label">Teamkamer: polls bij deze wedstrijd</div>
    ${polls.map(regel).join('') || '<div class="tk-zacht">Nog geen polls.</div>'}
    ${ontbreekt.length ? `<div class="tk-twee">${ontbreekt.map(s => `<button class="tk-knop licht klein" data-tk-poll="${s}" data-wid="${esc(w.id)}">Poll: ${s === 'rijden' ? 'wie rijdt' : 'wie wast'}</button>`).join('')}</div>` : ''}</section>${deel}`;
}
/* de opstelling van één wedstrijd wel of niet delen met de teamkamer (Instellingen en de wedstrijdvoorbereiding) */
export async function zetDeelOpstelling(id, aan){
  const w = (S.wedstrijden || []).find(x => x.id === id);
  await updateDoc(doc(db, 'teams', S.teamId, 'wedstrijden', id), { deelOpstelling: aan });
  if (w) w.deelOpstelling = aan;
  meld(aan ? 'Opstelling gedeeld met de teamkamer' : 'Opstelling niet meer gedeeld');
}

/* ==================== bediening ==================== */
async function zetInst(wijziging){
  const pad = Object.fromEntries(Object.entries(wijziging).map(([k, v]) => ['teamkamer.' + k, v]));
  await updateDoc(doc(db, 'teams', S.teamId), pad);
  S.team.teamkamer = { ...(S.team.teamkamer || {}), ...wijziging };
}
export function koppelTeamkamer(v, { renderTeam }){
  M.teken = renderTeam;
  const root = v.querySelector('.tkb'); if (!root) return;
  root.addEventListener('focusout', () => { if (M.uitgesteld) setTimeout(herteken, 50); });
  root.addEventListener('input', (ev) => {
    const t = ev.target, f = M.form;
    if (t.dataset.tkf === 'zoek'){
      M.zoek = t.value;
      const toon = () => { const doel = root.querySelector('#tk-treffers'); if (doel) doel.innerHTML = M.zoek && M.vormen ? M.vormen.filter(x => x.naam.toLowerCase().includes(M.zoek.toLowerCase())).slice(0, 6).map(trefferHtml).join('') : ''; };
      if (M.vormen) toon();
      else import('./trainingsbibliotheek.js?v=20261126g').then(m => { M.vormen = m.BIBLIOTHEEK.vormen.filter(x => (x.sport || 'voetbal') === actieveSport()).map(x => ({ id: x.id, naam: x.naam })); toon(); }).catch(() => {});
      return;
    }
    if (!f || !t.dataset.tkf) return;
    if (t.dataset.tkf === 'vraag') f.vraag = t.value;
    if (t.dataset.tkf === 'optie') f.opties[Number(t.dataset.n)] = t.value;
    if (t.dataset.tkf === 'nodig') f.nodig = t.value;
    if (t.dataset.tkf === 'sluit') f.sluit = t.value;
  });
  root.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.dataset.tkstat){ try { await zetInst({ stats: { ...inst().stats, [t.dataset.tkstat]: t.checked } }); syncTeamkamer(true); } catch (x){ meld('Dat lukte niet.'); } return; }
    if (t.dataset.tkf === 'wedstrijdId' && M.form){ M.form.wedstrijdId = t.value; renderTeam(); }
    if (t.dataset.tkf === 'videocat'){ M.videoCat = t.value; return; }
    if (t.id === 'tk-vmelding'){ M.videoMelding = t.checked; return; }
    if (t.dataset.tkvcat !== undefined){
      const nu = inst().thuisVideos, v = nu[Number(t.dataset.tkvcat)]; if (!v) return;
      if (t.value) v.cat = t.value; else delete v.cat;
      try { await zetInst({ thuisVideos: nu }); meld(t.value ? 'Verplaatst naar ' + t.value : 'Zonder categorie'); renderTeam(); } catch (x){ meld('Dat lukte niet.'); }
    }
  });
  root.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-tk]'); if (!b) return;
    const a = b.dataset.tk, id = b.dataset.id, basis = doc(db, 'teamkamer', S.teamId);
    try {
      if (a === 'sub'){ M.sub = id; M.open = ''; return renderTeam(); }
      if (a === 'open'){ M.open = M.open === id ? '' : id; return renderTeam(); }
      if (a === 'aan'){
        b.disabled = true;
        await zetInst({ aan: true });
        try { await roep('kamerVervers', { teamId: S.teamId }); await roep('maakKamerLink', { teamId: S.teamId }); }
        catch (x){ meld(foutTekst(x)); }
        return renderTeam();
      }
      if (a === 'uit'){ if (!confirm('De teamkamer uitzetten? Ouders en spelers zien dan niets meer.')) return; await zetInst({ aan: false }); meld('De teamkamer staat uit'); return renderTeam(); }
      if (a === 'ververs'){ b.disabled = true; await roep('kamerVervers', { teamId: S.teamId }); meld('De teamkamer is bijgewerkt'); return renderTeam(); }
      if (a === 'link'){ b.disabled = true; await roep('maakKamerLink', { teamId: S.teamId }); return meld('Nieuwe teamlink gemaakt'); }
      if (a === 'kopieer'){ await navigator.clipboard.writeText(b.dataset.tekst); return meld('Link gekopieerd'); }
      if (a === 'goed'){
        const spelerId = root.querySelector(`#tk-sp-${CSS.escape(id)}`)?.value;
        if (!spelerId) return meld('Kies eerst de speler bij wie deze ouder hoort');
        b.disabled = true; await roep('beoordeelKamerAanvraag', { id, goed: true, spelerId }); return meld('Goedgekeurd');
      }
      if (a === 'af'){ b.disabled = true; await roep('beoordeelKamerAanvraag', { id, goed: false }); return meld('Afgewezen'); }
      if (a === 'trek'){ if (!confirm('Deze toegang intrekken?')) return; await roep('trekKamerToegangIn', { teamId: S.teamId, uid: b.dataset.uid }); return meld('Toegang ingetrokken'); }
      if (a === 'verleng'){ const r = await roep('kamerVerleng', { teamId: S.teamId }); return meld(`Toegang verlengd voor ${r.aantal} ${r.aantal === 1 ? 'persoon' : 'personen'}`); }
      if (a === 'sjabloon'){ M.form = nieuwForm(id, M.form && M.form.wedstrijdId); return renderTeam(); }
      if (a === 'optieplus'){ M.form.opties.push(''); return renderTeam(); }
      if (a === 'fsw'){ M.form[b.dataset.veld] = b.getAttribute('aria-checked') !== 'true'; return renderTeam(); }
      if (a === 'plaatspoll'){
        const f = M.form, w = (S.wedstrijden || []).find(x => x.id === f.wedstrijdId);
        const r = K.maakPoll({ ...f, wedstrijdDatum: w ? w.datum : null });
        if (r.fout) return meld(r.fout);
        if (!f.sluit || f.sluit < K.vandaagIso()) return meld('Kies een sluitdatum vanaf vandaag');
        b.disabled = true;
        await addDoc(collection(basis, 'polls'), { ...r.poll, sluitDatum: f.sluit, sluitOp: Timestamp.fromDate(new Date(f.sluit + 'T20:00:00')), gemaaktDoor: S.user.uid, gemaaktMs: Date.now(), melding: f.melding !== false });
        M.form = null; meld(f.melding !== false ? 'Poll geplaatst. Ouders met meldingen aan krijgen bericht.' : 'Poll geplaatst. Deel de link in de groepsapp.'); return renderTeam();
      }
      if (a === 'herinner'){
        const p = M.polls.find(x => x.id === id);
        if (!p || !herinnerKan(p)) return meld('Je stuurde net al een herinnering');
        b.disabled = true; await updateDoc(doc(basis, 'polls', id), { herinnerMs: Date.now() }); return meld('Herinnering verstuurd naar wie nog niet stemde');
      }
      if (a === 'sluitpoll'){ await updateDoc(doc(basis, 'polls', id), { status: 'gesloten' }); return meld('Poll gesloten'); }
      if (a === 'heropen'){
        const d = new Date(); d.setDate(d.getDate() + 3);
        await updateDoc(doc(basis, 'polls', id), { status: 'open', sluitDatum: K.vandaagIso(d), sluitOp: Timestamp.fromDate(new Date(K.vandaagIso(d) + 'T20:00:00')) }); return meld('Poll weer open, voor 3 dagen');
      }
      if (a === 'wispoll'){ if (!confirm('Deze poll verwijderen?')) return; await deleteDoc(doc(basis, 'polls', id)); return meld('Poll verwijderd'); }
      if (a === 'plaatsbericht'){
        const tekst = (root.querySelector('#tk-bericht')?.value || '').trim().slice(0, 600);
        const melding = root.querySelector('#tk-bericht-melding')?.checked !== false; M.berichtMelding = melding;
        if (!tekst) return meld('Typ eerst je mededeling');
        b.disabled = true;
        await addDoc(collection(basis, 'berichten'), { tekst, door: String(S.user.displayName || '').trim().split(/\s+/)[0] || '', datum: K.vandaagIso(), ms: Date.now(), doorUid: S.user.uid, melding });
        meld('Mededeling geplaatst'); return renderTeam();
      }
      if (a === 'wisbericht'){ if (!confirm('Deze mededeling verwijderen?')) return; return deleteDoc(doc(basis, 'berichten', id)); }
      if (a === 'isw'){ await zetInst({ [b.dataset.veld]: b.getAttribute('aria-checked') !== 'true' }); syncTeamkamer(true); return renderTeam(); }
      if (a === 'statsaan'){
        const aan = b.getAttribute('aria-checked') !== 'true', nu = inst().stats;
        /* eerste keer aan: alles behalve speeltijd en kaarten; die zet de trainer bewust zelf aan */
        await zetInst({ stats: aan && !K.STATS_SOORTEN.some(([k]) => nu[k] === true) ? { aan: true, wedstrijden: true, doelpunten: true, opkomst: true, speeltijd: false, kaarten: false } : { ...nu, aan } });
        syncTeamkamer(true); return renderTeam();
      }
      if (a === 'opstelling'){
        await zetDeelOpstelling(id, b.getAttribute('aria-checked') !== 'true'); return renderTeam();
      }
      if (a === 'thuis'){ const vorm = (M.vormen || []).find(x => x.id === id); await zetInst({ thuis: { vormId: id, naam: vorm ? vorm.naam : '' } }); M.zoek = ''; meld('Thuisoefening gekozen'); return renderTeam(); }
      if (a === 'thuisweg'){ await zetInst({ thuis: null }); return renderTeam(); }
      if (a === 'videoplus' || a === 'videoclub'){
        const melding = root.querySelector('#tk-vmelding')?.checked !== false, cat = M.videoCat === undefined ? CLUBCAT : M.videoCat;
        const v = a === 'videoclub' ? { yt: b.dataset.yt, url: b.dataset.url, bron: b.dataset.yt ? '' : 'upload', titel: b.dataset.titel, clubCat: b.dataset.clubcat }
          : { url: root.querySelector('#tk-yt')?.value, titel: root.querySelector('#tk-yt-titel')?.value };
        if (a === 'videoplus' && !String(v.titel || '').trim()) return meld('Geef de video een titel');
        b.disabled = true;
        try { meld(await deelVideo(v, cat, melding)); } catch (x){ b.disabled = false; return meld(x.message || 'Dat lukte niet.'); }
        return renderTeam();
      }
      if (a === 'vcatplus'){
        const r = K.catErbij(inst().videoCats, root.querySelector('#tk-vcat')?.value);
        if (r.fout) return meld(r.fout);
        await zetInst({ videoCats: r.cats }); return renderTeam();
      }
      if (a === 'vcatop'){ const c = inst().videoCats, n = Number(b.dataset.n); if (n > 0){ [c[n - 1], c[n]] = [c[n], c[n - 1]]; await zetInst({ videoCats: c }); } return renderTeam(); }
      if (a === 'vcatweg'){
        const c = inst().videoCats, n = Number(b.dataset.n), naam = c[n], nu = inst().thuisVideos, erin = nu.filter(v => v.cat === naam).length;
        if (erin && !confirm(`"${naam}" verwijderen? ${erin === 1 ? 'De video blijft' : "De " + erin + " video's blijven"} gedeeld, zonder categorie.`)) return;
        c.splice(n, 1); nu.forEach(v => { if (v.cat === naam) delete v.cat; });
        await zetInst({ videoCats: c, thuisVideos: nu }); return renderTeam();
      }
      if (a === 'videoweg'){ const nu = inst().thuisVideos; nu.splice(Number(b.dataset.n), 1); await zetInst({ thuisVideos: nu }); return renderTeam(); }
      if (a === 'lijn'){
        const lijn = [...root.querySelectorAll('[data-tklijn]')].map(x => x.value.trim().slice(0, 90)).filter(Boolean);
        await zetInst({ lijn }); return meld('Afspraken bewaard');
      }
    } catch (x){ b.disabled = false; meld(foutTekst(x)); }
  });
}
