/* ==================== VRIJWILLIGERSBANK [20261125w] ====================
   Onderdeel van Activiteiten (zelfde schakelaar), alleen voor clubbeheer.
   De club geeft aan waar ze vrijwilligers voor zoekt en schrijft per taak precies op wat de
   vrijwilliger doet: de stappen, wanneer, hoe lang, waar, voor wie het geschikt is, wat je ervoor
   terugkrijgt en bij wie je terecht kunt. De taken staan op een openbare pagina (?taken=<id>,
   taken-boot.js); wie de link heeft meldt zich aan. De aanmeldingen komen hier binnen.

   Opslag: vrijwilligersBank/{id} (openbaar als de bank open staat; geen persoonsgegevens) en
   vrijwilligersBank/{id}/aanmeldingen (naam en contact, alleen clubbeheer en de aanmelder zelf).
   Krijgt alles van activiteiten.js via ctx. */
import { db, doc, collection, query, where, getDocs, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261130f';
import { ico } from './icons.js?v=20261127b';
import { liveId } from './toernooi-logica.js?v=20261130m';
import * as V from './vrijwilligers-logica.js?v=20261130m';

const vb = { clubId: '', bank: undefined, aanm: null, stops: [], qrVoor: '', qr: '', filter: '' };
const opt = (w, t, sel) => `<option value="${esc(w)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
export const takenLink = id => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}?taken=${encodeURIComponent(id)}`;
const clubInfo = () => ({ clubNaam: S.club?.naam || '', logo: S.club?.instellingen?.identiteit?.logo || '', kleur: S.club?.instellingen?.identiteit?.kleur || '' });

export function resetVrijwilligers(){ vb.stops.forEach(u => { try { u(); } catch { /* al gestopt */ } }); vb.stops = []; vb.clubId = ''; vb.bank = undefined; vb.aanm = null; vb.qrVoor = ''; vb.qr = ''; vb.filter = ''; }
async function laad(ctx){
  if (vb.clubId === ctx.clubId) return;
  resetVrijwilligers(); vb.clubId = ctx.clubId;
  let id = '';
  try { const s = await getDocs(query(collection(db, 'vrijwilligersBank'), where('club', '==', ctx.clubId))); id = s.docs[0]?.id || ''; if (!id) vb.bank = null; }
  catch (e){ console.warn('[vrijwilligers] laden', e); vb.bank = null; }
  if (id) volg(ctx, id); else ctx.herteken();
}
function volg(ctx, id){
  vb.stops.push(onSnapshot(doc(db, 'vrijwilligersBank', id), s => { vb.bank = s.exists() ? { id: s.id, ...s.data() } : null; ctx.herteken(); }, e => { console.warn('[vrijwilligers] bank', e); vb.bank = null; ctx.herteken(); }));
  vb.stops.push(onSnapshot(collection(db, 'vrijwilligersBank', id, 'aanmeldingen'), s => { vb.aanm = s.docs.map(d => ({ id: d.id, ...d.data() })); telBij(); ctx.herteken(); }, () => { vb.aanm = []; ctx.herteken(); }));
}
/* Bestaat de bank nog niet, dan maken we hem (dicht) bij de eerste taak of bij openzetten. */
async function zorgBank(ctx){
  if (vb.bank?.id) return vb.bank.id;
  const id = liveId(), data = { club: ctx.clubId, open: false, ...V.bankKopie(clubInfo()), taken: {}, gemaaktMs: Date.now() };
  await setDoc(doc(db, 'vrijwilligersBank', id), data);
  vb.bank = { id, ...data }; volg(ctx, id);
  return id;
}
const zet = async (ctx, patch) => {
  try { const id = await zorgBank(ctx); await updateDoc(doc(db, 'vrijwilligersBank', id), { ...patch, bijgewerktMs: Date.now() }); ctx.opgeslagen?.(); return true; }
  catch (e){ console.error('[vrijwilligers] opslaan', e); meld(e?.code === 'permission-denied' ? 'Mag niet (alleen clubbeheer, en de regels moeten gepubliceerd zijn).' : 'Opslaan mislukt.'); return false; }
};
/* het aantal geplaatste vrijwilligers per taak openbaar bijhouden ("nog 3 gezocht") */
function telBij(){
  if (!vb.bank?.id || !vb.aanm) return;
  const tel = V.telAanmeldingen(vb.aanm), patch = {};
  for (const t of V.takenLijst(vb.bank.taken)){ const n = tel[t.id]?.geplaatst || 0; if (n !== t.geplaatst) patch[`taken.${t.id}.geplaatst`] = n; }
  if (Object.keys(patch).length) updateDoc(doc(db, 'vrijwilligersBank', vb.bank.id), patch).catch(() => {});
}
let _qr = null;
async function qrSvg(tekst){
  if (typeof window.qrcode !== 'function') await (_qr ||= new Promise((ok, mis) => { const s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = ok; s.onerror = mis; document.head.appendChild(s); }));
  const q = window.qrcode(0, 'M'); q.addData(tekst); q.make();
  return q.createSvgTag({ cellSize: 6, margin: 12, scalable: true });
}
const taakKaart = (t, { print = false } = {}) => `<div class="vb-kaart-in">${print ? `<h2>${esc(t.titel)}</h2>` : ''}
    <p class="vb-meta">${esc([V.CATS[t.cat], V.FREQ[t.freq], t.duur].filter(Boolean).join(' · '))}</p>
    ${t.wat ? `<p>${esc(t.wat)}</p>` : ''}
    ${t.stappen.length ? `<p><b>Dit doe je precies</b></p><ol>${t.stappen.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    <table class="vb-tabel">${[['Wanneer', t.moment], ['Hoe lang', t.duur], ['Waar', t.waar], ['Voor wie', t.voorWie], ['Dit krijg je', t.krijgt], ['Vragen', t.contact]].filter(([, w]) => w).map(([k, w]) => `<tr><th>${k}</th><td>${esc(w)}</td></tr>`).join('')}</table></div>`;

/* ---------- tekenen ---------- */
export function htmlVrijwilligers(ctx){
  laad(ctx);
  const b = vb.bank, aan = !!b?.open, taken = V.takenLijst(b?.taken), tel = V.telAanmeldingen(vb.aanm || []), link = b?.id ? takenLink(b.id) : '';
  if (aan && vb.qrVoor !== b.id){ vb.qrVoor = b.id; vb.qr = ''; qrSvg(link).then(svg => { vb.qr = svg; ctx.herteken(); }).catch(() => {}); }
  const aanm = [...(vb.aanm || [])].filter(a => !vb.filter || a.taak === vb.filter).sort((x, y) => (y.ms || 0) - (x.ms || 0)), nNieuw = (vb.aanm || []).filter(a => !a.status || a.status === 'nieuw').length;
  const taakVan = Object.fromEntries(taken.map(t => [t.id, t]));
  return `${ctx.kop('Vrijwilligers', S.club?.naam || '')}
    <p class="ac-zacht">Geef aan waar de club vrijwilligers voor zoekt en schrijf per taak precies op wat iemand doet. Wie weet waar hij ja tegen zegt, zegt eerder ja. Diensten bij één activiteit (bijvoorbeeld het kersttoernooi) regel je in die activiteit, in het draaiboek bij Vrijwilligers.</p>
    <div class="ac-paneel"><h3>Vrijwilligersbank</h3><p class="ac-zacht">Eén pagina met alle taken waar de club mensen voor zoekt. Deel de link in de nieuwsbrief, de Teamkamer of op een poster in de kantine. Aanmelden kan zonder account.</p>
      ${b === undefined ? '<p class="ac-zacht">Laden…</p>' : aan ? `<div class="tn-live"><div class="tn-qr">${vb.qr || '<span class="ac-zacht">QR-code maken…</span>'}</div>
          <div class="tn-live-t"><input class="ac-in" readonly value="${esc(link)}" aria-label="Link naar de vrijwilligersbank" onfocus="this.select()">
            <div class="ac-acties"><button class="knop vol klein" data-vb="kopieer">Link kopiëren</button><a class="knop licht klein" href="${esc(ctx.waLink(`${S.club?.naam || 'Onze club'} zoekt vrijwilligers. Bekijk de taken en meld je aan: ${link}`))}" target="_blank" rel="noopener">WhatsApp</a>
              <a class="knop licht klein" href="${esc(link)}" target="_blank" rel="noopener">Openen</a><button class="knop licht klein" data-vb="poster">Poster printen</button><span class="ac-groei"></span><button class="knop licht klein" data-vb="uit">Sluiten</button></div></div></div>`
        : `<div class="ac-acties"><button class="knop vol" data-vb="aan" ${taken.length ? '' : 'disabled'}>Vrijwilligersbank openzetten</button></div><p class="ac-zacht">${taken.length ? (b?.id ? 'De bank staat dicht: de link laat nu niets zien.' : '') : 'Zet hieronder eerst een taak klaar.'}</p>`}
      <label class="ac-label">Tekst bovenaan de pagina</label><textarea class="ac-in" data-vb-bank="intro" rows="2" maxlength="500" placeholder="Bijvoorbeeld: Onze club draait op vrijwilligers. Vele handen maken licht werk: kijk of er iets voor je bij zit.">${esc(b?.intro || '')}</textarea>
      <div class="ac-rij2"><span><label class="ac-label">Contactpersoon (zichtbaar)</label><input class="ac-in" data-vb-bank="contact" maxlength="60" value="${esc(b?.contact || '')}" placeholder="bv. Sandra, vrijwilligerscoördinator"></span>
        <span><label class="ac-label">E-mail voor vragen (zichtbaar)</label><input class="ac-in" type="email" data-vb-bank="contactMail" maxlength="120" value="${esc(b?.contactMail || '')}" placeholder="vrijwilligers@jouwclub.nl"></span></div></div>
    <div class="ac-paneel"><h3>Taken <small class="ac-zacht">· ${taken.filter(t => t.status === 'open').length} open</small></h3>
      ${taken.map(t => { const mis = V.ontbreekt(t), n = tel[t.id]?.n || 0, nog = V.nogNodig(t);
        return `<div class="vb-taak ${t.status}"><button class="vb-taak-t" data-vb="bewerk" data-id="${esc(t.id)}"><b>${esc(t.titel || 'Nieuwe taak')}</b>
            <small>${esc([V.CATS[t.cat], V.FREQ[t.freq], t.duur].filter(Boolean).join(' · '))}</small>
            ${mis.length && t.status === 'open' ? `<small class="vb-mis">${ico('action-warning', 14)} Nog invullen: ${esc(mis.join(', '))}</small>` : ''}</button>
          <span class="vb-teller">${t.status !== 'open' ? `<span class="tn-st ${t.status === 'vervuld' ? 'toegelaten' : ''}">${esc(V.STATUS_TAAK[t.status])}</span>` : `<b>${n}</b><small>${nog === null ? 'aangemeld' : `aangemeld · nog ${nog} gezocht`}</small>`}</span></div>`; }).join('') || '<p class="ac-zacht">Nog geen taken. Begin met een voorbeeld en pas het aan.</p>'}
      <div class="ac-acties"><button class="knop vol klein" data-vb="nieuw" ${taken.length >= V.MAX_TAKEN ? 'disabled' : ''}>${ico('action-add', 16)} Taak toevoegen</button>${taken.length ? '<button class="knop licht klein" data-vb="print-alle">Alle taakkaarten printen</button>' : ''}</div></div>
    <div class="ac-paneel"><h3>Aanmeldingen ${vb.aanm?.length ? `<small class="ac-zacht">· ${vb.aanm.length}${nNieuw ? `, ${nNieuw} nieuw` : ''}</small>` : ''}</h3>
      ${!b?.id ? '<p class="ac-zacht">Zodra de vrijwilligersbank open staat, komen aanmeldingen hier binnen.</p>' : vb.aanm === null ? '<p class="ac-zacht">Laden…</p>' : !vb.aanm.length ? '<p class="ac-zacht">Nog geen aanmeldingen.</p>' : `
        <select class="ac-in" data-vb-filter aria-label="Taak">${opt('', 'Alle taken', !vb.filter)}${taken.filter(t => tel[t.id]).map(t => opt(t.id, `${t.titel} (${tel[t.id].n})`, vb.filter === t.id)).join('')}</select>
        ${aanm.map(a => { const stt = V.STATUS_AANM[a.status] ? a.status : 'nieuw', mail = /@/.test(a.contact || '');
          return `<div class="tn-ins ${stt}"><div class="ac-rij"><b class="ac-groei">${esc(a.naam)}</b><span class="tn-st ${stt === 'geplaatst' ? 'toegelaten' : stt}">${esc(V.STATUS_AANM[stt])}</span></div>
            <p class="ac-zacht">${esc(taakVan[a.taak]?.titel || 'taak vervallen')} · <a href="${mail ? 'mailto:' : 'tel:'}${esc(a.contact || '')}">${esc(a.contact || '')}</a>${a.ms ? ' · ' + new Date(a.ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : ''}</p>
            ${a.opm ? `<p class="tn-opm">${esc(a.opm)}</p>` : ''}
            <div class="ac-acties">${['gesproken', 'geplaatst', 'afgewezen'].filter(k => k !== stt).map(k => `<button class="knop ${k === 'geplaatst' ? 'vol' : 'licht'} klein" data-vb="status" data-id="${esc(a.id)}" data-naar="${k}">${{ gesproken: 'Gesproken', geplaatst: 'Geplaatst', afgewezen: 'Niet geplaatst' }[k]}</button>`).join('')}<span class="ac-groei"></span><button class="ac-x" data-vb="aanm-weg" data-id="${esc(a.id)}" aria-label="Aanmelding weg">✕</button></div></div>`; }).join('')}
        <div class="ac-acties"><button class="knop licht klein" data-vb="csv">${ico('admin-file', 16)} Lijst als CSV</button></div>`}</div>`;
}
function vensterTaak(ctx, id){
  if (!V.takenLijst(vb.bank?.taken).some(x => x.id === id)) return;
  /* als functie: na elke wijziging tekent het venster de opgeslagen waarden, niet de oude */
  ctx.venster(() => { const t = V.takenLijst(vb.bank?.taken).find(x => x.id === id); if (!t) return '<h2>Taak</h2><p class="ac-zacht">Deze taak is verwijderd.</p><div class="ac-acties"><button class="knop vol" data-ac="venster-dicht">Sluiten</button></div>';
  const v = (k, w, o = {}) => `<input class="ac-in" data-vb-veld="${esc(id)}.${k}" value="${esc(w ?? '')}" placeholder="${esc(o.ph || '')}" maxlength="${o.max || 60}" ${o.extra || ''}>`;
  return `<h2>Taak</h2>
    <label class="ac-label">Naam van de taak</label>${v('titel', t.titel, { ph: 'bv. Bardienst op zaterdag' })}
    <div class="ac-rij2"><span><label class="ac-label">Soort</label><select class="ac-in" data-vb-veld="${esc(id)}.cat">${Object.entries(V.CATS).map(([k, n]) => opt(k, n, t.cat === k)).join('')}</select></span>
      <span><label class="ac-label">Hoe vaak</label><select class="ac-in" data-vb-veld="${esc(id)}.freq">${Object.entries(V.FREQ).map(([k, n]) => opt(k, n, t.freq === k)).join('')}</select></span></div>
    <label class="ac-label">Wat ga je doen (in twee of drie zinnen)</label><textarea class="ac-in" data-vb-veld="${esc(id)}.wat" rows="3" maxlength="500" placeholder="Beschrijf de taak zoals je hem aan een nieuwe ouder zou uitleggen.">${esc(t.wat)}</textarea>
    <label class="ac-label">Dit doe je precies (één stap per regel, hooguit ${V.MAX_STAPPEN})</label><textarea class="ac-in" data-vb-veld="${esc(id)}.stappen" rows="5" placeholder="Een kwartier voor je dienst aanwezig&#10;Koffie zetten, koeling bijvullen&#10;…">${esc(t.stappen.join('\n'))}</textarea>
    <div class="ac-rij2"><span><label class="ac-label">Wanneer</label>${v('moment', t.moment, { ph: 'bv. zaterdag 8:00–12:30', max: 80 })}</span><span><label class="ac-label">Hoe lang</label>${v('duur', t.duur, { ph: 'bv. 4 uur per keer', max: 40 })}</span></div>
    <div class="ac-rij2"><span><label class="ac-label">Waar</label>${v('waar', t.waar, { ph: 'bv. Kantine' })}</span><span><label class="ac-label">Hoeveel mensen zoek je (0 = onbeperkt)</label><input class="ac-in" type="number" inputmode="numeric" min="0" max="99" data-vb-veld="${esc(id)}.nodig" value="${t.nodig}"></span></div>
    <label class="ac-label">Voor wie is het geschikt</label>${v('voorWie', t.voorWie, { ph: 'bv. iedereen vanaf 18 jaar, ervaring is niet nodig', max: 140 })}
    <label class="ac-label">Dit krijg je ervoor terug</label>${v('krijgt', t.krijgt, { ph: 'bv. inwerken, koffie en een tosti', max: 140 })}
    <label class="ac-label">Bij wie kun je terecht (zichtbaar, liever een rol of voornaam)</label>${v('contact', t.contact, { ph: 'bv. Kantinecommissie' })}
    <label class="ac-label">Status</label><select class="ac-in" data-vb-veld="${esc(id)}.status">${Object.entries(V.STATUS_TAAK).map(([k, n]) => opt(k, k === 'verborgen' ? 'Verborgen (niet op de pagina)' : k === 'vervuld' ? 'Vervuld (met vinkje op de pagina)' : 'Open (mensen kunnen zich aanmelden)', t.status === k)).join('')}</select>
    <div class="ac-acties"><button class="knop gevaar" data-vb="taak-weg" data-id="${esc(id)}">Verwijderen</button><button class="knop licht" data-vb="print" data-id="${esc(id)}">Taakkaart printen</button><span class="ac-groei"></span><button class="knop vol" data-ac="venster-dicht">Klaar</button></div>`; });
}

/* ---------- klikken en wijzigen ---------- */
export async function klikVrijwilligers(ctx, b){
  const actie = b.dataset.vb, id = b.dataset.id, bank = vb.bank;
  switch (actie){
    case 'nieuw': return ctx.venster(`<h2>Taak toevoegen</h2><p class="ac-zacht">Kies een voorbeeld. Het is volledig uitgeschreven; je past het daarna aan jullie club aan.</p>
      <div class="vb-vbn">${V.VOORBEELDEN.map((x, i) => `<button class="vb-vb" data-vb="voorbeeld" data-id="${i}"><b>${esc(x.titel)}</b><small>${esc([V.CATS[x.cat], x.duur].join(' · '))}</small></button>`).join('')}
        <button class="vb-vb" data-vb="voorbeeld" data-id="-1"><b>Lege taak</b><small>Zelf alles invullen</small></button></div>
      <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Annuleren</button></div>`);
    case 'voorbeeld': {
      const bron = V.VOORBEELDEN[Number(id)] || { titel: '', status: 'open' }, nid = V.nieuwId();
      const volg = V.takenLijst(bank?.taken).reduce((m, x) => Math.max(m, x.volg), 0) + 1;
      if (await zet(ctx, { [`taken.${nid}`]: { ...V.schoneTaak(bron), volg } })){ vb.bank = { ...vb.bank, taken: { ...(vb.bank?.taken || {}), [nid]: { ...V.schoneTaak(bron), volg } } }; vensterTaak(ctx, nid); }
      return;
    }
    case 'bewerk': return vensterTaak(ctx, id);
    case 'taak-weg': { const n = (vb.aanm || []).filter(a => a.taak === id).length;
      if (!confirm(n ? `Bij deze taak ${n === 1 ? 'staat 1 aanmelding' : `staan ${n} aanmeldingen`}. Toch verwijderen?` : 'Deze taak verwijderen?')) return;
      ctx.sluitVenster(); return zet(ctx, { [`taken.${id}`]: deleteField() }); }
    case 'print': { const t = V.takenLijst(bank?.taken).find(x => x.id === id); return t && ctx.printen(`<style>${PRINT_CSS}</style><p class="sub">${esc(S.club?.naam || '')} · taakkaart vrijwilliger</p>${taakKaart(t, { print: true })}`); }
    case 'print-alle': return ctx.printen(`<style>${PRINT_CSS}</style>${V.takenLijst(bank?.taken).filter(t => t.status !== 'verborgen').map(t => `<section class="vb-blad"><p class="sub">${esc(S.club?.naam || '')} · taakkaart vrijwilliger</p>${taakKaart(t, { print: true })}</section>`).join('')}`);
    case 'poster': return ctx.printen(`<style>${PRINT_CSS}</style><div style="text-align:center"><h1>${esc(S.club?.naam || 'Onze club')} zoekt jou</h1><p class="sub">Scan de code, bekijk de taken en meld je aan</p><div style="width:80mm;margin:6mm auto">${vb.qr || ''}</div>
      <ul style="list-style:none;padding:0;font-size:14pt;line-height:1.7">${V.zichtbaar(V.takenLijst(bank?.taken)).filter(t => t.status === 'open').slice(0, 12).map(t => `<li>${esc(t.titel)}${t.duur ? ` <span style="color:#666">· ${esc(t.duur)}</span>` : ''}</li>`).join('')}</ul><p>${esc(takenLink(bank.id))}</p></div>`);
    case 'aan': if (await zet(ctx, { open: true, ...V.bankKopie({ ...clubInfo(), intro: bank?.intro, contact: bank?.contact, contactMail: bank?.contactMail }) })) meld('De vrijwilligersbank staat open. Deel de link!'); return;
    case 'uit': if (confirm('Vrijwilligersbank sluiten? De link laat dan niets meer zien. Taken en aanmeldingen blijven staan.')) await zet(ctx, { open: false }); return;
    case 'kopieer': return ctx.kopieer(takenLink(bank.id), 'Link gekopieerd');
    case 'status': try { await updateDoc(doc(db, 'vrijwilligersBank', bank.id, 'aanmeldingen', id), { status: b.dataset.naar }); } catch { meld('Opslaan mislukt.'); } return;
    case 'aanm-weg': { const a = (vb.aanm || []).find(x => x.id === id); if (!a || !confirm(`Aanmelding van ${a.naam} weghalen? Dit kan niet terug.`)) return;
      try { await deleteDoc(doc(db, 'vrijwilligersBank', bank.id, 'aanmeldingen', id)); } catch { meld('Weghalen mislukt.'); } return; }
    case 'csv': return ctx.download(`vrijwilligers-aanmeldingen.csv`, V.csvAanmeldingen(vb.aanm || [], Object.fromEntries(V.takenLijst(bank?.taken).map(t => [t.id, t]))), 'text/csv;charset=utf-8');
  }
}
export async function wijzigVrijwilligers(ctx, el){
  if (el.matches('[data-vb-filter]')){ vb.filter = el.value; ctx.herteken(); return true; }
  if (el.matches('[data-vb-bank]')){
    const k = el.dataset.vbBank, schoon = V.bankKopie({ ...clubInfo(), intro: vb.bank?.intro, contact: vb.bank?.contact, contactMail: vb.bank?.contactMail, [k]: el.value });
    await zet(ctx, schoon); return true;
  }
  if (el.matches('[data-vb-veld]')){
    const [id, k] = el.dataset.vbVeld.split('.'), huidig = vb.bank?.taken?.[id]; if (!huidig) return true;
    const schoon = V.schoneTaak({ ...huidig, [k]: el.value });
    await zet(ctx, { [`taken.${id}.${k}`]: schoon[k] }); return true;
  }
  return false;
}

const PRINT_CSS = `.vb-blad{page-break-after:always}.vb-kaart-in h2{font-size:20pt;margin:0 0 2mm}.vb-meta{color:#555}.vb-kaart-in ol{margin:0 0 4mm 6mm;padding:0}.vb-kaart-in li{margin:1mm 0}.vb-tabel{border-collapse:collapse;width:100%}.vb-tabel th{text-align:left;vertical-align:top;padding:2mm 4mm 2mm 0;white-space:nowrap;width:1%}.vb-tabel td{padding:2mm 0;border-bottom:1px solid #ddd}`;
export const VRIJWILLIGERS_CSS = `
.vb-taak{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--hair)}.vb-taak.verborgen{opacity:.55}
.vb-taak-t{flex:1;min-width:0;text-align:left;background:none;color:var(--ink);display:flex;flex-direction:column;gap:2px;padding:0;cursor:pointer}
.vb-taak-t b{font-size:var(--t-base,16px)}.vb-taak-t small{color:var(--ink-2);font-size:var(--t-sm,14px)}
.vb-mis{color:var(--warn-ink,#b45309)!important;display:flex;align-items:center;gap:4px}
.vb-teller{display:flex;flex-direction:column;align-items:flex-end;text-align:right;flex-shrink:0}.vb-teller b{font-size:var(--t-lg,18px)}.vb-teller small{color:var(--ink-2);font-size:var(--t-xs,12px)}
.vb-vbn{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin:8px 0}
.vb-vb{display:flex;flex-direction:column;gap:2px;text-align:left;padding:10px 12px;border-radius:var(--r-s,10px);background:var(--surface-2,var(--hair));color:var(--ink);cursor:pointer}
.vb-vb small{color:var(--ink-2);font-size:var(--t-sm,14px)}.vb-vb:hover{outline:2px solid var(--accent)}`;
