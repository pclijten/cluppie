/* ==================== KANTINE-TV EN SPONSOREN [20261125w] ====================
   Onderdeel van Activiteiten (zelfde schakelaar), alleen voor clubbeheer.
   - Kantine-tv: een openbare pagina (?scherm=<id>, scherm-boot.js) voor de tv in de kantine met het
     programma van vandaag (thuis en uit), uitslagen, een mededeling, sponsoren en eigen schermen.
     Het programma houdt de Cloud Function kantineTv bij; hier kan het ook met de hand.
   - Sponsoren per seizoen: pakket, bedrag, einddatum en notitie (alleen clubbeheer), logo en naam op tv.
     Verlopen sponsoren verdwijnen vanzelf van de tv.

   Opslag: clubs/{club}/sponsoren/{id} (met bedrag en notitie) en de openbare kopie in
   clubTv/{tvId} + clubTv/{tvId}/schermen/{id}. Krijgt alles van activiteiten.js via ctx. */
import { db, doc, collection, query, where, getDocs, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261126p';
import { ico } from './icons.js?v=20261116t';
import { liveId, MAX_SCHERMEN } from './toernooi-logica.js?v=20261125w';
import { kleinPlaatje } from './plaatje.js?v=20261125w';
import * as C from './clubscherm-logica.js?v=20261125w';

const cs = { clubId: '', tv: undefined, items: null, stop: null, qrVoor: '', qr: '', bezig: false };
const vandaag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const opt = (w, t, sel) => `<option value="${esc(w)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
export const schermLink = id => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}?scherm=${encodeURIComponent(id)}`;
const clubInfo = () => ({ clubNaam: S.club?.naam || '', logo: S.club?.instellingen?.identiteit?.logo || '', kleur: S.club?.instellingen?.identiteit?.kleur || '' });

export function resetSchermen(){ cs.stop?.(); cs.stop = null; cs.clubId = ''; cs.tv = undefined; cs.items = null; cs.qrVoor = ''; cs.qr = ''; }
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
  return { datum, programma: C.bouwProgramma(teams, perTeam, datum) };
}

/* ---------- tekenen ---------- */
export function htmlSchermen(ctx){
  laad(ctx);
  const v = vandaag(), items = C.sorteer((cs.items || []).map(x => ({ id: x.id, ...C.schoonItem(x) }))), tv = cs.tv, aan = !!tv?.open;
  const sponsors = items.filter(x => x.soort === 'sponsor'), eigen = items.filter(x => x.soort === 'scherm'), tot = C.sponsorTotaal(items, v), vol = items.length >= C.MAX_ITEMS;
  const link = tv?.id ? schermLink(tv.id) : '';
  if (aan && cs.qrVoor !== tv.id){ cs.qrVoor = tv.id; cs.qr = ''; qrSvg(link).then(svg => { cs.qr = svg; ctx.herteken(); }).catch(() => {}); }
  const veld = (id, k, w, o = {}) => `<input class="ac-in ${o.klasse || ''}" type="${o.type || 'text'}" data-cs-veld="${esc(id)}.${k}" value="${esc(w ?? '')}" placeholder="${esc(o.ph || '')}" ${o.extra || ''}>`;
  const rij = x => { const oud = C.verlopen(x, v), bijna = C.bijnaVerlopen(x, v);
    return `<div class="tn-scherm ${oud ? 'cs-oud' : ''}"><label class="tn-plaatje" title="Afbeelding kiezen">${x.img ? `<img src="${esc(x.img)}" alt="">` : `<span>${x.soort === 'sponsor' ? 'Logo' : 'Afbeelding'}</span>`}<input type="file" accept="image/*" data-cs-plaatje="${esc(x.id)}" hidden></label>
      <div class="tn-scherm-v"><div class="ac-rij">${veld(x.id, 'titel', x.titel, { klasse: 'ac-groei vet', ph: x.soort === 'sponsor' ? 'Naam van de sponsor' : 'Titel', extra: 'maxlength="60"' })}${oud ? '<span class="tn-st afgewezen">Verlopen</span>' : bijna ? '<span class="tn-st nieuw">Loopt bijna af</span>' : ''}<button class="ac-x" data-cs="weg" data-id="${esc(x.id)}" aria-label="Weg">✕</button></div>
        ${veld(x.id, 'tekst', x.tekst, { ph: x.soort === 'sponsor' ? 'Korte tekst op tv (mag leeg blijven)' : 'Tekst op het scherm', extra: 'maxlength="240"' })}
        ${x.soort === 'sponsor' ? `<div class="ac-rij cs-rij"><select class="ac-in smal" data-cs-veld="${esc(x.id)}.pakket" aria-label="Pakket">${Object.entries(C.PAKKETTEN).map(([k, n]) => opt(k, n, x.pakket === k)).join('')}</select>
            <label class="tn-mini">€ per jaar ${veld(x.id, 'bedrag', x.bedrag || '', { type: 'number', klasse: 'getal', ph: '0', extra: 'inputmode="numeric" min="0" max="999999"' })}</label>
            <label class="tn-mini">Loopt tot ${veld(x.id, 'tot', x.tot, { type: 'date', klasse: 'cs-datum' })}</label></div>
          ${veld(x.id, 'link', x.link, { ph: 'Website (mag leeg blijven)', extra: 'maxlength="200" inputmode="url"' })}
          ${veld(x.id, 'notitie', x.notitie, { ph: 'Notitie voor het bestuur (niet op tv), bv. contactpersoon of afspraak', extra: 'maxlength="200"' })}` : ''}
        <div class="ac-rij"><label class="ac-schak"><input type="checkbox" data-cs-veld="${esc(x.id)}.tv" ${x.tv ? 'checked' : ''}> Op de kantine-tv</label>${x.img ? `<span class="ac-groei"></span><button class="knop licht klein" data-cs="plaatje-weg" data-id="${esc(x.id)}">Afbeelding weg</button>` : ''}</div></div></div>`; };
  return `${ctx.kop('Kantine-tv en sponsoren', S.club?.naam || '')}
    <div class="ac-paneel"><h3>Kantine-tv</h3><p class="ac-zacht">Zet deze pagina op de tv in de kantine. Hij toont het wedstrijdprogramma van vandaag met veld en kleedkamer, de uitslagen, je sponsoren en eigen schermen. De pagina werkt zichzelf bij; het programma komt elke tien minuten uit de wedstrijden van de teams.</p>
      ${cs.tv === undefined ? '<p class="ac-zacht">Laden…</p>' : aan ? `<div class="tn-live"><div class="tn-qr">${cs.qr || '<span class="ac-zacht">QR-code maken…</span>'}</div>
          <div class="tn-live-t"><input class="ac-in" readonly value="${esc(link)}" aria-label="Link naar de kantine-tv" onfocus="this.select()">
            <div class="ac-acties"><a class="knop vol klein" href="${esc(link)}" target="_blank" rel="noopener">Tv-pagina openen</a><button class="knop licht klein" data-cs="kopieer">Link kopiëren</button><button class="knop licht klein" data-cs="programma" ${cs.bezig ? 'disabled' : ''}>Programma nu bijwerken</button><span class="ac-groei"></span><button class="knop licht klein" data-cs="tv-uit">Tv uitzetten</button></div>
            <p class="ac-zacht">${tv.datum === v ? `Vandaag ${(tv.programma || []).length} ${(tv.programma || []).length === 1 ? 'wedstrijd' : 'wedstrijden'} op het scherm.` : 'Het programma van vandaag staat er nog niet op.'} Open de link in de browser van de tv, of scan de code met een telefoon die je op de tv aansluit.</p>
            <label class="ac-label">Mededeling onderin het scherm</label><input class="ac-in" data-cs-tv="mededeling" maxlength="200" value="${esc(tv.mededeling || '')}" placeholder="Bijvoorbeeld: Zaterdag 12 december kerstbingo in de kantine">
            <label class="ac-schak"><input type="checkbox" data-cs-tv="uit" ${tv.uit !== false ? 'checked' : ''}> Ook uitwedstrijden tonen</label></div></div>`
        : `<div class="ac-acties"><button class="knop vol" data-cs="tv-aan">Kantine-tv aanzetten</button></div>${tv?.id ? '<p class="ac-zacht">De tv staat uit. Aanzetten geeft dezelfde link als eerst.</p>' : ''}`}</div>
    <div class="ac-paneel"><h3>Sponsoren ${sponsors.length ? `<small class="ac-zacht">· ${tot.actief} actief${tot.bedrag ? `, € ${tot.bedrag.toLocaleString('nl-NL')} per jaar` : ''}${tot.verlopen ? `, ${tot.verlopen} verlopen` : ''}${tot.bijna ? `, ${tot.bijna} loopt bijna af` : ''}</small>` : ''}</h3>
      <p class="ac-zacht">Per sponsor het pakket, het bedrag en tot wanneer de afspraak loopt. Bedrag en notitie ziet alleen het bestuur. Na de einddatum verdwijnt de sponsor vanzelf van de tv. Hoofdsponsoren staan vooraan.</p>
      ${cs.items === null ? '<p class="ac-zacht">Laden…</p>' : sponsors.map(rij).join('') || '<p class="ac-zacht">Nog geen sponsoren.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-cs="nieuw" data-id="sponsor" ${vol ? 'disabled' : ''}>${ico('action-add', 16)} Sponsor</button>${sponsors.length ? `<button class="knop licht klein" data-cs="csv">${ico('admin-file', 16)} Overzicht als CSV</button>` : ''}</div></div>
    <div class="ac-paneel"><h3>Eigen schermen</h3><p class="ac-zacht">Een dia met titel, tekst en eventueel een afbeelding: het kantinemenu, de activiteitenkalender, een oproep voor vrijwilligers of de huisregels.</p>
      ${eigen.map(rij).join('') || '<p class="ac-zacht">Nog geen eigen schermen.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-cs="nieuw" data-id="scherm" ${vol ? 'disabled' : ''}>${ico('action-add', 16)} Eigen scherm</button></div></div>
    <p class="ac-zacht">Bij een toernooi neem je deze sponsoren over met één knop: tab Toernooi, Live, Sponsoren van de club overnemen.</p>`;
}

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
    case 'kopieer': return ctx.kopieer(schermLink(cs.tv.id), 'Link gekopieerd');
    case 'tv-aan': {
      const tid = cs.tv?.id || liveId();
      try {
        const p = await leesProgramma();
        const data = { club: ctx.clubId, open: true, ...C.tvKopie({ ...clubInfo(), mededeling: cs.tv?.mededeling || '', uit: cs.tv?.uit, ...p }), bijgewerktMs: Date.now(), programmaMs: Date.now() };
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
      try { const p = await leesProgramma(); await updateDoc(doc(db, 'clubTv', cs.tv.id), { ...p, ...C.tvKopie({ ...clubInfo(), mededeling: cs.tv.mededeling, uit: cs.tv.uit, ...p }), bijgewerktMs: Date.now(), programmaMs: Date.now() }); Object.assign(cs.tv, p); await zetAllesOpenbaar(); meld(`${p.programma.length} ${p.programma.length === 1 ? 'wedstrijd' : 'wedstrijden'} op het scherm`); }
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
  if (el.matches('[data-cs-tv]') && cs.tv?.id){
    const k = el.dataset.csTv, w = el.type === 'checkbox' ? el.checked : String(el.value || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    try { await updateDoc(doc(db, 'clubTv', cs.tv.id), { [k]: w, ...clubInfoKopie(), bijgewerktMs: Date.now() }); cs.tv[k] = w; ctx.opgeslagen?.(); } catch { meld('Opslaan mislukt.'); }
    return true;
  }
  return false;
}
const clubInfoKopie = () => { const k = C.tvKopie(clubInfo()); return { clubNaam: k.clubNaam, logo: k.logo, kleur: k.kleur }; };

/* Voor de toernooiplanner: de actieve sponsoren van de club, om over te nemen op de live pagina van een toernooi. */
export async function clubSponsoren(clubId){
  const s = await getDocs(collection(db, 'clubs', clubId, 'sponsoren')), v = vandaag();
  return C.sorteer(s.docs.map(d => C.schoonItem(d.data())).filter(x => x.soort === 'sponsor' && !C.verlopen(x, v) && (x.titel || x.img))).slice(0, MAX_SCHERMEN);
}

export const SCHERM_CSS = `
.cs-oud{opacity:.6}.cs-rij{flex-wrap:wrap;gap:8px 12px}.cs-datum{width:auto}`;
