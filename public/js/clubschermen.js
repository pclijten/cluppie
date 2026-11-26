/* ==================== KANTINE-TV EN SPONSOREN [20261125w] ====================
   Onderdeel van Activiteiten (zelfde schakelaar), alleen voor clubbeheer.
   - Kantine-tv: een openbare pagina (?scherm=<id>, scherm-boot.js) voor de tv in de kantine met het
     programma van vandaag (thuis en uit), uitslagen, een mededeling, sponsoren en eigen schermen.
     Het programma houdt de Cloud Function kantineTv bij; hier kan het ook met de hand.
   - Sponsoren per seizoen: pakket, bedrag, einddatum en notitie (alleen clubbeheer), logo en naam op tv.
     Verlopen sponsoren verdwijnen vanzelf van de tv.

   Opslag: clubs/{club}/sponsoren/{id} (met bedrag en notitie) en de openbare kopie in
   clubTv/{tvId} + clubTv/{tvId}/schermen/{id}. Krijgt alles van activiteiten.js via ctx. */
import { db, doc, collection, query, where, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261127r';
import { ico } from './icons.js?v=20261127b';
import { liveId, MAX_SCHERMEN } from './toernooi-logica.js?v=20261127r';
import { kleinPlaatje } from './plaatje.js?v=20261127r';
import * as C from './clubscherm-logica.js?v=20261127r';
import { SJABLONEN, sjabloonId } from './tv-sjablonen.js?v=20261127r';

const cs = { tvbZoek: '', keuze: {}, vast: 'auto', proef: null, clubId: '', tv: undefined, items: null, stop: null, qrVoor: '', qr: '', bezig: false };
const vandaag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const opt = (w, t, sel) => `<option value="${esc(w)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
export const schermLink = id => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}?scherm=${encodeURIComponent(id)}`;
/* [20261127b] Korte link: de club kiest een naam (www.cluppie.io/tv/mifano). tvNamen/{naam} wijst naar de tv; 404.html stuurt
   /tv/<naam> door naar ?kantine=<naam>. De lange link blijft werken. */
const korteLink = naam => `${location.origin}/tv/${naam}`;
const tvLink = tv => tv?.korteNaam ? korteLink(tv.korteNaam) : schermLink(tv.id);
const schoneNaam = w => String(w || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const naamVoorstel = () => schoneNaam(S.club?.naam || '');
const datumKort = d => { const x = new Date(d + 'T12:00'); return isNaN(x) ? d : x.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }); };
const clubInfo = () => ({ clubNaam: S.club?.naam || '', logo: S.club?.instellingen?.identiteit?.logo || '', kleur: S.club?.instellingen?.identiteit?.kleur || '' });

export function resetSchermen(){ cs.keuze = {}; cs.vast = 'auto'; cs.proef = null; cs.stop?.(); cs.stop = null; cs.clubId = ''; cs.tv = undefined; cs.items = null; cs.qrVoor = ''; cs.qr = ''; }
async function laad(ctx){
  if (cs.clubId === ctx.clubId) return;
  resetSchermen(); cs.clubId = ctx.clubId;
  cs.stop = onSnapshot(collection(db, 'clubs', ctx.clubId, 'sponsoren'), s => { cs.items = s.docs.map(d => ({ id: d.id, ...d.data() })); ctx.herteken(); },
    e => { console.warn('[schermen] sponsoren', e); cs.items = []; ctx.herteken(); });
  try { const s = await getDocs(query(collection(db, 'clubTv'), where('club', '==', ctx.clubId))); cs.tv = s.docs[0] ? { id: s.docs[0].id, ...s.docs[0].data() } : null; }
  catch (e){ console.warn('[schermen] tv', e); cs.tv = null; }
  ctx.herteken();
}
let _qr = null;
async function qrSvg(tekst){
  if (typeof window.qrcode !== 'function') await (_qr ||= new Promise((ok, mis) => { const s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = ok; s.onerror = mis; document.head.appendChild(s); }));
  const q = window.qrcode(0, 'M'); q.addData(tekst); q.make();
  return q.createSvgTag({ cellSize: 6, margin: 12, scalable: true });
}

/* ---------- de openbare kopie ---------- */
async function zetOpenbaar(id){
  if (!cs.tv?.id) return;
  const x = (cs.items || []).find(i => i.id === id), o = x ? C.openbaarItem(x, vandaag()) : null, ref = doc(db, 'clubTv', cs.tv.id, 'schermen', id);
  try { if (o) await setDoc(ref, o); else await deleteDoc(ref); } catch (e){ console.warn('[schermen] openbaar', e); }
}
async function zetAllesOpenbaar(){ for (const x of cs.items || []) await zetOpenbaar(x.id); }
/* Het programma van vandaag uit de wedstrijden van alle teams van de club. */
async function leesProgramma(){
  const teams = (S.clubTeams || []).map(t => ({ id: t.id, naam: t.naam || '' })), datum = vandaag(), perTeam = {};
  await Promise.all(teams.map(async t => {
    try { const s = await getDocs(query(collection(db, 'teams', t.id, 'wedstrijden'), where('datum', '==', datum))); perTeam[t.id] = s.docs.map(d => d.data()); }
    catch { perTeam[t.id] = []; }
  }));
  /* Namen bij doelpunten, alleen als de club dat aan heeft staan: de spelers die vandaag scoorden of aangaven. */
  let namen = null;
  if (cs.tv?.namen === true){
    namen = {};
    await Promise.all(teams.map(async t => {
      const ids = [...new Set((perTeam[t.id] || []).flatMap(w => (Array.isArray(w.goals) ? w.goals : []).flatMap(g => g?.type === 'voor' ? [g.pid, g.assist] : [])).filter(x => typeof x === 'string' && x))].slice(0, 40);
      const lijst = await Promise.all(ids.map(id => getDoc(doc(db, 'teams', t.id, 'spelers', id)).then(d => [id, d.exists() ? String(d.data()?.naam || '') : '']).catch(() => [id, ''])));
      if (lijst.length) namen[t.id] = Object.fromEntries(lijst);
    }));
  }
  return { datum, programma: C.bouwProgramma(teams, perTeam, datum, namen) };
}

/* ---------- wie beheert de tv ---------- */
/* De clubbeheerder wijst clubleden aan die de kantine-tv en de sponsoren mogen beheren (clubs/{id}.tvBeheerders). */
function htmlTvBeheerders(ctx){
  const aan = S.club?.tvBeheerders || {}, admins = S.club?.admins || {};
  const mensen = (ctx.mensen?.() || []).filter(p => !admins[p.id]);
  const chip = p => `<button class="tn-chip ${aan[p.id] ? 'aan' : ''}" data-cs="tvb" data-id="${esc(p.id)}" aria-pressed="${aan[p.id] ? 'true' : 'false'}">${aan[p.id] ? '✓ ' : ''}${esc(p.naam)}</button>`;
  const zoek = cs.tvbZoek.trim().toLowerCase(), lijst = zoek ? mensen.filter(p => p.naam.toLowerCase().includes(zoek)) : mensen.filter(p => aan[p.id]).concat(mensen.filter(p => !aan[p.id]).slice(0, 12));
  return `<div class="ac-paneel"><h3>Wie beheert de tv</h3>
    <p class="ac-zacht">Clubbeheerders mogen dit altijd. Geef hier ook andere clubleden de tv, bijvoorbeeld de kantinecommissie of de sponsorcommissie. Zij zien de tegel Kantine-tv op het clubdashboard en beheren de tv en de sponsoren, ook de bedragen. Verder krijgen ze geen rechten.</p>
    ${mensen.length > 12 ? `<input class="ac-in" data-cs-zoek="tvb" value="${esc(cs.tvbZoek)}" placeholder="Zoek een clublid" aria-label="Zoek een clublid">` : ''}
    <div class="tn-chips" style="margin-top:8px">${lijst.map(chip).join('') || '<span class="ac-zacht">Geen clubleden gevonden.</span>'}</div></div>`;
}
async function zetTvBeheerder(ctx, id){
  const p = (ctx.mensen?.() || []).find(x => x.id === id); if (!p || !S.clubId) return;
  const aan = S.club?.tvBeheerders?.[id] !== true;
  try {
    await updateDoc(doc(db, 'clubs', ctx.clubId), aan ? { [`tvBeheerders.${id}`]: true, [`tvBeheerdersInfo.${id}`]: { naam: p.naam } } : { [`tvBeheerders.${id}`]: deleteField(), [`tvBeheerdersInfo.${id}`]: deleteField() });
    if (S.club){ S.club.tvBeheerders = { ...(S.club.tvBeheerders || {}) }; if (aan) S.club.tvBeheerders[id] = true; else delete S.club.tvBeheerders[id]; }
    meld(aan ? `${p.naam} beheert nu ook de tv` : `${p.naam} beheert de tv niet meer`);
  } catch (e){ console.error('[schermen] tv-beheerder', e); meld('Wijzigen mislukt.'); }
  ctx.herteken();
}

/* ---------- tekenen ---------- */
/* [20261126u] Ontwerpen met het beeld ernaast. Rechts staat de tv-pagina zelf, verkleind (een iframe met &ontwerp=1).
   Wat je kiest (sjabloon, welke dia, een proefdoelpunt) gaat er direct heen zonder dat de pagina opnieuw laadt.
   activiteiten.js ververst alleen de delen met data-cs-deel, zodat het beeld blijft staan (zie naTekenSchermen). */
const DIA_UITLEG = {
  auto: ['Vanzelf', 'Zo draait de tv: het programma (in pagina\'s), de standen en uitslagen, en daartussen je sponsoren en eigen schermen. Elke dia staat zo\'n twaalf seconden.'],
  programma: ['Programma', 'De wedstrijden van vandaag met tijd, teams, veld en kleedkamer. Die komen vanzelf uit de wedstrijden van alle teams van de club: uit Sportlink en ook de wedstrijden die een trainer zelf in de app aanmaakt.'],
  uitslagen: ['Standen', 'Wedstrijden die bezig of gespeeld zijn, met de stand. Houdt de trainer de wedstrijd bij in de app, dan staat elk doelpunt binnen een paar seconden op de tv. Anders komt de uitslag uit Sportlink.'],
  goal: ['Doelpunt', 'Bij een doelpunt springt de stand zichtbaar om en komt het groot in beeld: team, minuut, veld en bij meer doelpunten de tijdlijn van de wedstrijd. De voornaam van de maker en de assist alleen als je dat aanzet. Hiernaast kies je voor welke wedstrijden.'],
};
const RAND_UITLEG = 'Altijd in beeld: de naam, het logo en de kleur van de club (uit de clubinstellingen), de datum en de klok, en onderin je mededeling.';
function beeldSrc(tv, aan, proef){
  if (aan && tv?.id) return `${schermLink(tv.id)}&tv=1&ontwerp=1${proef ? '&proef=1' : ''}`;
  return `${schermLink('voorbeeld')}&tv=1&ontwerp=1&proef=1&naam=${encodeURIComponent(clubInfo().clubNaam)}&kleur=${encodeURIComponent(clubInfo().kleur)}`;
}
/* Iets naar het beeld sturen (sjabloon, vaste dia, proefdoelpunt). */
function naarBeeld(bericht){
  const f = document.querySelector('iframe[data-cs-iframe]');
  try { f?.contentWindow?.postMessage({ cluppieTv: 1, ...bericht }, location.origin); } catch { /* beeld nog niet geladen */ }
}
const sjabloonNu = () => sjabloonId(cs.tv?.sjabloon ?? cs.keuze.sjabloon);

export function htmlSchermen(ctx){
  laad(ctx);
  const v = vandaag(), items = C.sorteer((cs.items || []).map(x => ({ id: x.id, ...C.schoonItem(x) }))), tv = cs.tv, aan = !!tv?.open;
  const sponsors = items.filter(x => x.soort === 'sponsor'), eigen = items.filter(x => x.soort === 'scherm'), tot = C.sponsorTotaal(items, v), vol = items.length >= C.MAX_ITEMS;
  const link = tv?.id ? tvLink(tv) : '';
  const sj = SJABLONEN.find(x => x.id === sjabloonNu()) || SJABLONEN[0];
  const evs = ctx.evenementen?.() || [], ev = C.evenementId(tv?.evenement ?? cs.keuze.evenement);
  const vandaagProg = aan && tv.datum === v ? (tv.programma || []) : [];
  const proef = !aan || (cs.proef ?? !vandaagProg.length), src = beeldSrc(tv, aan, proef);
  const opTv = x => x.tv && !C.verlopen(x, v) && (x.titel || x.tekst || x.img);

  /* rechts: het beeld met de knoppen eronder */
  const diaKnop = (k, naam, extra = '') => `<button class="tn-chip ${cs.vast === k ? 'aan' : ''}" data-cs="vast" data-id="${k}" aria-pressed="${cs.vast === k}" ${extra}>${esc(naam)}</button>`;
  const gekozenItem = cs.vast.startsWith('dia:') ? items.find(x => `dia:${x.id}` === cs.vast) : null;
  const uitleg = gekozenItem ? `${gekozenItem.soort === 'sponsor' ? 'Sponsor' : 'Eigen scherm'}: titel, tekst en afbeelding zoals je ze hieronder invult. Verander je iets, dan zie je het hier meteen.` : (DIA_UITLEG[cs.vast] || DIA_UITLEG.auto)[1];
  const bediening = `<div class="cs-bron" role="group" aria-label="Welke wedstrijden in het beeld">
      <button class="tn-chip ${!proef ? 'aan' : ''}" data-cs="bron" data-id="echt" ${aan ? '' : 'disabled'} aria-pressed="${!proef}">Echt, van vandaag</button>
      <button class="tn-chip ${proef ? 'aan' : ''}" data-cs="bron" data-id="proef" aria-pressed="${proef}">Proefwedstrijden</button></div>
    <p class="ac-zacht cs-bron-t">${!aan ? 'De tv staat nog uit. Je ziet je sjabloon met proefwedstrijden.' : proef ? (vandaagProg.length ? 'Proefwedstrijden, zodat je alles ziet: standen, live en afgelast.' : 'Vandaag staan er (nog) geen wedstrijden op het programma, dus je ziet proefwedstrijden.') : 'Precies wat er nu op de tv staat.'}</p>
    <div class="cs-dias" role="group" aria-label="Welke dia bekijken">${Object.entries(DIA_UITLEG).map(([k, [n]]) => diaKnop(k, n)).join('')}${gekozenItem ? diaKnop(cs.vast, gekozenItem.titel || 'Dia') : ''}</div>
    <p class="cs-uitleg">${esc(uitleg)}</p>
    <p class="ac-zacht cs-uitleg-rand">${esc(RAND_UITLEG)}</p>`;

  /* links: instellingen */
  if (aan && cs.qrVoor !== link){ cs.qrVoor = link; cs.qr = ''; qrSvg(link).then(svg => { cs.qr = svg; ctx.herteken(); }).catch(() => {}); }
  const tvPaneel = `<div class="ac-paneel"><h3>Kantine-tv ${aan ? '<span class="tn-st toegelaten">Aan</span>' : tv ? '<span class="tn-st">Uit</span>' : ''}</h3>
      ${cs.tv === undefined ? '<p class="ac-zacht">Laden…</p>' : aan ? `<div class="tn-live"><div class="tn-qr">${cs.qr || '<span class="ac-zacht">QR-code maken…</span>'}</div>
          <div class="tn-live-t"><input class="ac-in" readonly value="${esc(link)}" aria-label="Link naar de kantine-tv" onfocus="this.select()">
            <div class="ac-acties"><a class="knop vol klein" href="${esc(link)}" target="_blank" rel="noopener">Tv-pagina openen</a><button class="knop licht klein" data-cs="kopieer">Link kopiëren</button>${ctx.isAdmin ? `<button class="knop licht klein" data-cs="programma" ${cs.bezig ? 'disabled' : ''}>Programma nu bijwerken</button>` : ''}<span class="ac-groei"></span><button class="knop licht klein" data-cs="tv-uit">Tv uitzetten</button></div>
            <p class="ac-zacht">Open de link in de browser van de tv, of scan de code met een telefoon die je op de tv aansluit.</p>
            <label class="cs-kort"><span>Korte link</span><span class="cs-kort-v"><span class="ac-zacht">${esc(location.host)}/tv/</span><input class="ac-in" data-cs-kort value="${esc(tv.korteNaam || '')}" placeholder="${esc(naamVoorstel() || 'clubnaam')}" maxlength="30" autocomplete="off" spellcheck="false" aria-label="Korte naam voor de link"></span></label>
            <p class="ac-zacht">Makkelijk over te typen op de tv: kleine letters, cijfers en streepjes. ${tv.korteNaam ? 'De lange link blijft ook werken.' : 'Typ een naam en klik ernaast.'}</p></div></div>`
        : `<p class="ac-zacht">Zet de tv aan als je tevreden bent over het ontwerp. Je krijgt dan een link en een QR-code voor de tv in de kantine.</p><div class="ac-acties"><button class="knop vol" data-cs="tv-aan">Kantine-tv aanzetten</button></div>${tv?.id ? '<p class="ac-zacht">Aanzetten geeft dezelfde link als eerst.</p>' : ''}`}</div>`;
  const kaart = x => `<button class="cs-sj ${x.id === sj.id ? 'aan' : ''}" data-cs="sjabloon" data-id="${esc(x.id)}" aria-pressed="${x.id === sj.id}"><b>${esc(x.naam)}</b><small>${esc(x.kort)}</small></button>`;
  const sjPaneel = `<div class="ac-paneel"><h3>1. Kies een sjabloon</h3>
      <p class="ac-zacht">Het sjabloon bepaalt hoe de tv eruitziet. Klik er een aan en je ziet het meteen in het beeld. ${aan ? 'Je keuze staat ook direct op de tv.' : 'Je keuze blijft bewaard tot je de tv aanzet.'}</p>
      <div class="cs-sjablonen">${SJABLONEN.map(kaart).join('')}</div></div>`;
  const rij = w => `<li><b>${esc(w.tijd || '–')}</b><span class="cs-kap">${esc(w.a)} – ${esc(w.b)}</span><em>${esc(w.afgelast ? 'afgelast' : w.stand || (w.thuis ? '' : 'uit'))}</em></li>`;
  const inhoudPaneel = `<div class="ac-paneel"><h3>2. Wat er op komt</h3>
      <label class="ac-label">Vandaag op het programma</label>
      ${!aan ? '<p class="ac-zacht">Als de tv aan staat, zie je hier welke wedstrijden van vandaag erop staan.</p>' : vandaagProg.length ? `<ul class="cs-prog">${vandaagProg.slice(0, 40).map(rij).join('')}</ul>` : '<p class="ac-zacht">Vandaag nog geen wedstrijden.</p>'}
      <p class="ac-zacht">Elke wedstrijd van een team van de club staat op de dag zelf vanzelf op de tv, ook als een trainer hem zelf in de app aanmaakt. Houdt de trainer de wedstrijd bij in de app, dan loopt de stand op de tv mee. Nieuwe wedstrijden staan er binnen een paar seconden op, en anders bij de ronde van elke tien minuten.</p>
      ${aan ? `<label class="ac-schak"><input type="checkbox" data-cs-tv="uit" ${tv.uit !== false ? 'checked' : ''}> Ook uitwedstrijden tonen</label>
      <label class="ac-label">Mededeling onderin het scherm</label><input class="ac-in" data-cs-tv="mededeling" maxlength="200" value="${esc(tv.mededeling || '')}" placeholder="Bijvoorbeeld: Zaterdag 12 december kerstbingo in de kantine">` : ''}
      <label class="ac-label" for="csGoals">Doelpunt groot in beeld</label>
      <select class="ac-in" id="csGoals" data-cs-tv="goals">${Object.entries(C.GOAL_KEUZES).map(([k, n]) => opt(k, n, C.goalKeuze(tv?.goals ?? cs.keuze.goals) === k)).join('')}</select>
      <p class="ac-zacht">De stand springt zichtbaar om, met de minuut, het veld en bij meer doelpunten een tijdlijn van de wedstrijd. Scoren er teams tegelijk, dan komen de doelpunten na elkaar, elk even lang. Dit werkt als de trainer de wedstrijd met de klok bijhoudt in de app. Doelpunten die achteraf worden ingevoerd geven geen melding.</p>
      ${aan ? `<label class="ac-schak"><input type="checkbox" data-cs-tv="namen" ${tv.namen === true ? 'checked' : ''}> Voornaam van de doelpuntenmaker en de assist tonen</label>
      <p class="ac-zacht">Staat uit tot je het aanzet. De tv-pagina is openbaar voor wie de link heeft en het gaat vaak om kinderen, dus stem dit af binnen de club. Er komt alleen een voornaam op het scherm, alleen van het eigen team.</p>` : ''}
      <label class="ac-label" for="csEvenement">Evenement op de tv</label>
      <select class="ac-in" id="csEvenement" data-cs-tv="evenement">${opt('', 'Geen: het wedstrijdprogramma van vandaag', !ev)}${evs.map(x => opt(x.id, `${x.naam}${x.datum ? ' · ' + datumKort(x.datum) : ''}`, x.id === ev)).join('')}${ev && !evs.some(x => x.id === ev) ? opt(ev, 'Een toernooi waarvan de live pagina uit staat', true) : ''}</select>
      <p class="ac-zacht">${evs.length ? 'Op de dag van het toernooi toont de tv het schema, de uitslagen, de mededelingen en de sponsoren van het toernooi, in je sjabloon. Op andere dagen gewoon het wedstrijdprogramma.' : 'Zet bij een toernooi de live pagina aan, dan kun je het hier kiezen. De tv toont het toernooi dan op de dag zelf.'}</p></div>`;
  const veld = (id, k, w, o = {}) => `<input class="ac-in ${o.klasse || ''}" type="${o.type || 'text'}" data-cs-veld="${esc(id)}.${k}" value="${esc(w ?? '')}" placeholder="${esc(o.ph || '')}" ${o.extra || ''}>`;
  const itemRij = x => { const oud = C.verlopen(x, v), bijna = C.bijnaVerlopen(x, v);
    return `<div class="tn-scherm ${oud ? 'cs-oud' : ''} ${cs.vast === `dia:${x.id}` ? 'cs-bekeken' : ''}"><label class="tn-plaatje" title="Afbeelding kiezen">${x.img ? `<img src="${esc(x.img)}" alt="">` : `<span>${x.soort === 'sponsor' ? 'Logo' : 'Afbeelding'}</span>`}<input type="file" accept="image/*" data-cs-plaatje="${esc(x.id)}" hidden></label>
      <div class="tn-scherm-v"><div class="ac-rij">${veld(x.id, 'titel', x.titel, { klasse: 'ac-groei vet', ph: x.soort === 'sponsor' ? 'Naam van de sponsor' : 'Titel', extra: 'maxlength="60"' })}${oud ? '<span class="tn-st afgewezen">Verlopen</span>' : bijna ? '<span class="tn-st nieuw">Loopt bijna af</span>' : ''}<button class="ac-x" data-cs="weg" data-id="${esc(x.id)}" aria-label="Weg">✕</button></div>
        ${veld(x.id, 'tekst', x.tekst, { ph: x.soort === 'sponsor' ? 'Korte tekst op tv (mag leeg blijven)' : 'Tekst op het scherm', extra: 'maxlength="240"' })}
        ${x.soort === 'sponsor' ? `<div class="ac-rij cs-rij"><select class="ac-in smal" data-cs-veld="${esc(x.id)}.pakket" aria-label="Pakket">${Object.entries(C.PAKKETTEN).map(([k, n]) => opt(k, n, x.pakket === k)).join('')}</select>
            <label class="tn-mini">€ per jaar ${veld(x.id, 'bedrag', x.bedrag || '', { type: 'number', klasse: 'getal', ph: '0', extra: 'inputmode="numeric" min="0" max="999999"' })}</label>
            <label class="tn-mini">Loopt tot ${veld(x.id, 'tot', x.tot, { type: 'date', klasse: 'cs-datum' })}</label></div>
          ${veld(x.id, 'link', x.link, { ph: 'Website (mag leeg blijven)', extra: 'maxlength="200" inputmode="url"' })}
          ${veld(x.id, 'notitie', x.notitie, { ph: 'Notitie voor het bestuur (niet op tv), bv. contactpersoon of afspraak', extra: 'maxlength="200"' })}` : ''}
        <div class="ac-rij"><label class="ac-schak"><input type="checkbox" data-cs-veld="${esc(x.id)}.tv" ${x.tv ? 'checked' : ''}> Op de kantine-tv</label><span class="ac-groei"></span>${x.img ? `<button class="knop licht klein" data-cs="plaatje-weg" data-id="${esc(x.id)}">Afbeelding weg</button>` : ''}${opTv(x) && aan ? `<button class="knop licht klein" data-cs="vast" data-id="dia:${esc(x.id)}">${cs.vast === `dia:${x.id}` ? 'Staat in het beeld' : 'Bekijk in het beeld'}</button>` : ''}</div></div></div>`; };
  const sponsPaneel = `<div class="ac-paneel"><h3>3. Sponsoren ${sponsors.length ? `<small class="ac-zacht">· ${tot.actief} actief${tot.bedrag ? `, € ${tot.bedrag.toLocaleString('nl-NL')} per jaar` : ''}${tot.verlopen ? `, ${tot.verlopen} verlopen` : ''}${tot.bijna ? `, ${tot.bijna} loopt bijna af` : ''}</small>` : ''}</h3>
      <p class="ac-zacht">Elke sponsor met een vinkje bij "Op de kantine-tv" krijgt een eigen dia en staat in de sponsorbalk. Per sponsor het pakket, het bedrag en tot wanneer de afspraak loopt. Bedrag en notitie ziet alleen het bestuur. Na de einddatum verdwijnt de sponsor vanzelf van de tv. Hoofdsponsoren staan vooraan.${aan ? '' : ' Met "Bekijk in het beeld" zie je een sponsor op de tv zodra die aan staat.'}</p>
      ${cs.items === null ? '<p class="ac-zacht">Laden…</p>' : sponsors.map(itemRij).join('') || '<p class="ac-zacht">Nog geen sponsoren.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-cs="nieuw" data-id="sponsor" ${vol ? 'disabled' : ''}>${ico('action-add', 16)} Sponsor</button>${sponsors.length ? `<button class="knop licht klein" data-cs="csv">${ico('admin-file', 16)} Overzicht als CSV</button>` : ''}</div></div>`;
  const eigenPaneel = `<div class="ac-paneel"><h3>4. Eigen schermen</h3><p class="ac-zacht">Een eigen dia met titel, tekst en eventueel een afbeelding: het kantinemenu, de activiteitenkalender, een oproep voor vrijwilligers of de huisregels. Hij komt tussen het programma door, net als een sponsor.</p>
      ${eigen.map(itemRij).join('') || '<p class="ac-zacht">Nog geen eigen schermen.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-cs="nieuw" data-id="scherm" ${vol ? 'disabled' : ''}>${ico('action-add', 16)} Eigen scherm</button></div></div>`;

  return `<div class="cs-app" data-cs-src="${esc(src)}"><div data-cs-deel="kop">${ctx.kop('Kantine-tv en sponsoren', S.club?.naam || '')}</div>
    <div class="cs-ontwerp">
      <aside class="cs-rechts" aria-label="Zo ziet de tv eruit"><div class="cs-beeld" data-cs-beeld="${esc(src)}&sjabloon=${esc(sj.id)}"></div><div class="cs-bediening" data-cs-deel="bediening">${bediening}</div></aside>
      <div class="cs-links" data-cs-deel="links">${tvPaneel}${sjPaneel}${inhoudPaneel}${ctx.isAdmin ? htmlTvBeheerders(ctx) : ''}${sponsPaneel}${eigenPaneel}
        <p class="ac-zacht">Bij een toernooi neem je deze sponsoren over met één knop: tab Toernooi, Live, Sponsoren van de club overnemen.</p></div>
    </div></div>`;
}

/* Na het tekenen: het beeld plaatsen (alleen als het nog niet staat) en laten meeschalen. */
let _ro = null;
export function naTekenSchermen(root){
  const vak = root.querySelector('[data-cs-beeld]'); if (!vak) return;
  if (!vak.querySelector('iframe')){
    const f = document.createElement('iframe');
    f.dataset.csIframe = ''; f.title = 'Voorbeeld van de kantine-tv'; f.tabIndex = -1; f.setAttribute('aria-hidden', 'true');
    f.src = vak.dataset.csBeeld;
    f.onload = () => naarBeeld({ sjabloon: sjabloonNu(), vast: vastBericht() });
    vak.appendChild(f);
  }
  const zet = () => vak.style.setProperty('--cs-s', String((vak.clientWidth || 640) / 1920));
  zet(); _ro?.disconnect(); _ro = new ResizeObserver(zet); _ro.observe(vak);
}
const vastBericht = () => cs.vast === 'auto' || cs.vast === 'goal' ? null : cs.vast.startsWith('dia:') ? { soort: 'dia', id: cs.vast.slice(4) } : { soort: cs.vast };

/* ---------- klikken en wijzigen ---------- */
export async function klikSchermen(ctx, b){
  const actie = b.dataset.cs, id = b.dataset.id;
  switch (actie){
    case 'nieuw': {
      if ((cs.items || []).length >= C.MAX_ITEMS) return meld(`Maximaal ${C.MAX_ITEMS} sponsoren en schermen.`);
      const volg = (cs.items || []).reduce((m, x) => Math.max(m, Number(x.volg) || 0), 0) + 1;
      try { await addDoc(collection(db, 'clubs', ctx.clubId, 'sponsoren'), { soort: id === 'scherm' ? 'scherm' : 'sponsor', titel: '', tekst: '', pakket: id === 'scherm' ? '' : 'sponsor', tv: true, volg, gemaaktMs: Date.now() }); }
      catch (e){ console.error('[schermen] nieuw', e); meld(e?.code === 'permission-denied' ? 'Mag niet (alleen clubbeheer, en de regels moeten gepubliceerd zijn).' : 'Toevoegen mislukt.'); }
      return;
    }
    case 'weg': { const x = (cs.items || []).find(i => i.id === id); if (!x || !confirm(`${x.titel || 'Dit onderdeel'} weghalen?`)) return;
      try { await deleteDoc(doc(db, 'clubs', ctx.clubId, 'sponsoren', id)); if (cs.tv?.id) await deleteDoc(doc(db, 'clubTv', cs.tv.id, 'schermen', id)).catch(() => {}); } catch { meld('Weghalen mislukt.'); } return; }
    case 'plaatje-weg': return bewaarItem(ctx, id, { img: '' });
    case 'csv': return ctx.download(`sponsoren-${vandaag()}.csv`, C.csvSponsoren(cs.items || [], vandaag()), 'text/csv;charset=utf-8');
    case 'tvb': if (!ctx.isAdmin) return; return zetTvBeheerder(ctx, id);
    /* ontwerpen: sjabloon kiezen, een dia vasthouden, echte of proefwedstrijden in het beeld */
    case 'sjabloon': {
      const w = sjabloonId(id); naarBeeld({ sjabloon: w });
      if (!cs.tv?.id){ cs.keuze.sjabloon = w; return ctx.herteken(); }
      try { await updateDoc(doc(db, 'clubTv', cs.tv.id), { sjabloon: w, ...clubInfoKopie(), bijgewerktMs: Date.now() }); cs.tv.sjabloon = w; ctx.opgeslagen?.(); }
      catch { meld('Opslaan mislukt.'); }
      return ctx.herteken();
    }
    case 'vast': {
      if (id === 'goal'){ cs.vast = 'goal'; naarBeeld({ vast: null, goal: true }); return ctx.herteken(); }
      cs.vast = id === cs.vast && id.startsWith('dia:') ? 'auto' : id; naarBeeld({ vast: vastBericht() }); return ctx.herteken();
    }
    case 'bron': cs.proef = id === 'proef'; return ctx.herteken();
    case 'kopieer': return ctx.kopieer(tvLink(cs.tv), 'Link gekopieerd');
    case 'tv-aan': {
      const tid = cs.tv?.id || liveId();
      try {
        /* Een tv-beheerder ziet niet alle teams; dan vult de Cloud Function het programma binnen tien minuten. */
        const p = ctx.isAdmin ? await leesProgramma() : { datum: '', programma: [] };
        const data = { club: ctx.clubId, open: true, ...C.tvKopie({ ...clubInfo(), mededeling: cs.tv?.mededeling || '', uit: cs.tv?.uit, sjabloon: cs.tv?.sjabloon ?? cs.keuze.sjabloon, goals: cs.tv?.goals ?? cs.keuze.goals, evenement: cs.tv?.evenement ?? cs.keuze.evenement, namen: cs.tv?.namen === true, ...p }), bijgewerktMs: Date.now(), programmaMs: Date.now() };
        await setDoc(doc(db, 'clubTv', tid), data);
        cs.tv = { id: tid, ...data }; await zetAllesOpenbaar();
      } catch (e){ console.error('[schermen] tv aan', e); return meld(e?.code === 'permission-denied' ? 'De tv kan nog niet aan: de regels zijn nog niet gepubliceerd.' : 'Aanzetten mislukt.'); }
      meld('De kantine-tv staat aan'); return ctx.herteken();
    }
    case 'tv-uit': {
      if (!confirm('Kantine-tv uitzetten? De link laat dan niets meer zien.')) return;
      try { await updateDoc(doc(db, 'clubTv', cs.tv.id), { open: false, bijgewerktMs: Date.now() }); cs.tv.open = false; } catch { return meld('Uitzetten mislukt.'); }
      return ctx.herteken();
    }
    case 'programma': {
      cs.bezig = true; ctx.herteken();
      try { const p = await leesProgramma(); await updateDoc(doc(db, 'clubTv', cs.tv.id), { ...p, ...C.tvKopie({ ...clubInfo(), mededeling: cs.tv.mededeling, uit: cs.tv.uit, sjabloon: cs.tv.sjabloon, goals: cs.tv.goals, evenement: cs.tv.evenement, namen: cs.tv.namen === true, ...p }), bijgewerktMs: Date.now(), programmaMs: Date.now() }); Object.assign(cs.tv, p); await zetAllesOpenbaar(); meld(`${p.programma.length} ${p.programma.length === 1 ? 'wedstrijd' : 'wedstrijden'} op het scherm`); }
      catch (e){ console.error('[schermen] programma', e); meld('Bijwerken mislukt.'); }
      cs.bezig = false; return ctx.herteken();
    }
  }
}
async function bewaarItem(ctx, id, patch){
  try { await updateDoc(doc(db, 'clubs', ctx.clubId, 'sponsoren', id), patch); const x = (cs.items || []).find(i => i.id === id); if (x) Object.assign(x, patch); await zetOpenbaar(id); ctx.opgeslagen?.(); }
  catch (e){ console.error('[schermen] opslaan', e); meld('Opslaan mislukt.'); }
}
export async function wijzigSchermen(ctx, el){
  if (el.matches('[data-cs-zoek="tvb"]')){ cs.tvbZoek = el.value || ''; ctx.herteken(); return true; }
  if (el.matches('[data-cs-plaatje]')){
    const f = el.files?.[0], id = el.dataset.csPlaatje; el.value = ''; if (!f) return true;
    if (!/^image\//.test(f.type) || f.size > 12 * 1024 * 1024){ meld('Kies een afbeelding (jpg of png, max 12 MB).'); return true; }
    try { const img = await kleinPlaatje(f); if (!img) throw new Error('te groot'); await bewaarItem(ctx, id, { img }); meld('Afbeelding geplaatst'); }
    catch (e){ console.error('[schermen] plaatje', e); meld('Deze afbeelding kon niet gebruikt worden. Probeer een jpg of png.'); }
    return true;
  }
  if (el.matches('[data-cs-veld]')){
    const [id, k] = el.dataset.csVeld.split('.');
    const w = el.type === 'checkbox' ? el.checked : k === 'bedrag' ? Math.max(0, Math.round(Number(el.value) || 0)) : el.value;
    await bewaarItem(ctx, id, { [k]: w }); return true;
  }
  /* Nog geen tv aangemaakt: sjabloon en doelpunten onthouden tot de tv aangaat. */
  if (el.matches('[data-cs-kort]') && cs.tv?.id){ await zetKorteNaam(ctx, el.value); return true; }
  if (el.matches('[data-cs-tv="sjabloon"],[data-cs-tv="goals"],[data-cs-tv="evenement"]') && !cs.tv?.id){
    const k = el.dataset.csTv; cs.keuze[k] = k === 'sjabloon' ? sjabloonId(el.value) : k === 'evenement' ? C.evenementId(el.value) : C.goalKeuze(el.value); ctx.herteken(); return true;
  }
  if (el.matches('[data-cs-tv]') && cs.tv?.id){
    const k = el.dataset.csTv, w = el.type === 'checkbox' ? el.checked : k === 'sjabloon' ? sjabloonId(el.value) : k === 'goals' ? C.goalKeuze(el.value) : k === 'evenement' ? C.evenementId(el.value) : String(el.value || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    try { await updateDoc(doc(db, 'clubTv', cs.tv.id), { [k]: w, ...clubInfoKopie(), bijgewerktMs: Date.now() }); cs.tv[k] = w; ctx.opgeslagen?.(); if (k === 'sjabloon' || k === 'evenement') ctx.herteken();
      /* namen aan of uit: het programma meteen opnieuw opbouwen, zodat de namen erbij komen of verdwijnen */
      if (k === 'namen' && ctx.isAdmin && cs.tv.open){ const p = await leesProgramma(); await updateDoc(doc(db, 'clubTv', cs.tv.id), { ...p, programmaMs: Date.now() }); Object.assign(cs.tv, p); }
    } catch { meld('Opslaan mislukt.'); }
    return true;
  }
  return false;
}
async function zetKorteNaam(ctx, waarde){
  const naam = schoneNaam(waarde), oud = cs.tv.korteNaam || '';
  if (naam === oud) return ctx.herteken();
  if (naam && naam.length < 3) return meld('Kies een naam van minstens 3 tekens.');
  try {
    if (naam){
      const bestaand = await getDoc(doc(db, 'tvNamen', naam));
      if (bestaand.exists() && bestaand.data().tv !== cs.tv.id) return meld(`De naam "${naam}" is al in gebruik. Kies een andere.`);
      if (!bestaand.exists()) await setDoc(doc(db, 'tvNamen', naam), { tv: cs.tv.id, club: ctx.clubId, ms: Date.now() });
    }
    await updateDoc(doc(db, 'clubTv', cs.tv.id), { korteNaam: naam, bijgewerktMs: Date.now() });
    if (oud) await deleteDoc(doc(db, 'tvNamen', oud)).catch(() => {});
    cs.tv.korteNaam = naam; meld(naam ? `Korte link: ${korteLink(naam).replace(/^https?:\/\//, '')}` : 'Korte link weggehaald');
  } catch (e){ console.error('[schermen] korte naam', e); meld(e?.code === 'permission-denied' ? 'Opslaan mag nog niet: de regels zijn nog niet gepubliceerd.' : 'Opslaan mislukt.'); }
  ctx.herteken();
}
const clubInfoKopie = () => { const k = C.tvKopie(clubInfo()); return { clubNaam: k.clubNaam, logo: k.logo, kleur: k.kleur }; };

/* Voor de toernooiplanner: de actieve sponsoren van de club, om over te nemen op de live pagina van een toernooi. */
export async function clubSponsoren(clubId){
  const s = await getDocs(collection(db, 'clubs', clubId, 'sponsoren')), v = vandaag();
  return C.sorteer(s.docs.map(d => C.schoonItem(d.data())).filter(x => x.soort === 'sponsor' && !C.verlopen(x, v) && (x.titel || x.img))).slice(0, MAX_SCHERMEN);
}

export const SCHERM_CSS = `
.cs-oud{opacity:.6}.cs-rij{flex-wrap:wrap;gap:8px 12px}.cs-datum{width:auto}
.cs-app{display:flex;flex-direction:column;gap:var(--space-sm)}
.cs-ontwerp{display:grid;gap:var(--space-sm);align-items:start}
.cs-links{display:flex;flex-direction:column;gap:var(--space-sm);min-width:0}
.cs-rechts{display:flex;flex-direction:column;gap:8px;min-width:0;background:var(--card);border-radius:var(--r-m);padding:var(--space-sm);box-shadow:var(--shadow)}
.cs-beeld{position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:10px;background:#05060a}
.cs-beeld iframe{position:absolute;left:0;top:0;width:1920px;height:1080px;border:0;transform-origin:0 0;transform:scale(var(--cs-s,.3));pointer-events:none}
.cs-bediening{display:flex;flex-direction:column;gap:8px}
.cs-bron,.cs-dias{display:flex;flex-wrap:wrap;gap:6px}
.cs-bron-t{margin:0}
.cs-uitleg{margin:0;font-size:var(--t-sm);line-height:1.45;background:var(--surface-2);border-radius:10px;padding:10px 12px}
.cs-uitleg-rand{margin:0}
.cs-sjablonen{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.cs-sj{display:flex;flex-direction:column;gap:3px;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--line-d);background:var(--surface-2);color:var(--ink);font:inherit;cursor:pointer;min-height:64px}
.cs-sj b{font-size:var(--t-sm)}.cs-sj small{font-size:12px;color:var(--ink-2,var(--ink));opacity:.75;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cs-sj.aan{border-color:var(--accent);box-shadow:inset 0 0 0 2px var(--accent);background:var(--card)}
.cs-kort{display:flex;flex-direction:column;gap:4px;font-size:var(--t-sm);font-weight:600;margin-top:4px}
.cs-kort-v{display:flex;align-items:center;gap:2px;font-weight:400;min-width:0}.cs-kort-v .ac-in{flex:1 1 auto;min-width:0}
.cs-prog{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;max-height:240px;overflow:auto}
.cs-prog li{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:8px;font-size:var(--t-sm);padding:4px 0;border-bottom:1px solid var(--hair)}
.cs-prog em{font-style:normal;font-weight:700}
.cs-kap{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.cs-bekeken{outline:2px solid var(--accent);outline-offset:2px;border-radius:12px}
@media (min-width:980px){.cs-ontwerp{grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)}.cs-rechts{order:2;position:sticky;top:0}.cs-links{order:1}}`;
