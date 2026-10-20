/* ====================================================================
   TOEGANG & ONBOARDING (client)
   - tabblad "Toegang & privacy" in clubinstellingen (beheerder)
   - persoonlijke uitnodigingen (verlopen, maximaal aantal keer, intrekbaar)
   - aanvragen met goedkeuring, rol (assistent / coach), toegangslog
   - leden uitschrijven, inactieve leden voorstellen
   - kennisname van de privacyregels + e-mailverificatie bij eerste gebruik
   Serverkant: functions/toegang.js. Data: uitnodigingen, aanvragen, toegangslog.
==================================================================== */
import {
  auth, db, functions, httpsCallable, sendEmailVerification,
  collection, doc, getDoc, getDocs, query, where
} from './firebase.js?v=20261011g';
import { S, esc, meld, openModal, sluitModal } from './state.js?v=20261011g';
import { bewaar } from './club-instellingen.js?v=20261020d';
import { effectief } from './clubconfig.js?v=20261020a';

export const PRIVACY_VERSIE = '2026-10';
const roep = (naam, data) => httpsCallable(functions, naam)(data || {}).then(r => r.data);
const fout = (e) => meld((e && e.message) || 'Er ging iets mis');
const datumKort = (ts) => {
  const ms = ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : (ts ? new Date(ts).getTime() : 0));
  return ms ? new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '—';
};
const linkVoor = (code) => location.origin + location.pathname + '?uitn=' + code;

/* ---------- 1. Eerste keer: kennisname privacyregels ---------- */
export async function zorgKennisname(){
  if (!S.user) return;
  try {
    const snap = await getDoc(doc(db, 'privacyKennisname', S.user.uid));
    if (snap.exists() && snap.data().versie === PRIVACY_VERSIE) return;
  } catch(e){ return; }                       // geen blokkade bij een tijdelijke leesfout
  await new Promise(klaar => {
    openModal(`
      <h2>Voordat je begint</h2>
      <p style="font-size:calc(13.5px * var(--fs));color:var(--ink-2);line-height:1.5;margin-bottom:10px">
        Je werkt met gegevens van kinderen. Daarom een paar afspraken:</p>
      <ul style="font-size:calc(13.5px * var(--fs));color:var(--ink-2);line-height:1.6;padding-left:18px;margin:0 0 12px">
        <li>Zet <b>geen medische gegevens</b>, telefoonnummers, adressen of foto's van kinderen in Cluppie.</li>
        <li>Deel inloggegevens en uitnodigingslinks alleen met mensen die bij het team horen.</li>
        <li>Gebruik de spelersgegevens alleen voor je werk als coach, en niet buiten de club.</li>
        <li>Zet geen namen van spelers in vrije tekstvelden die je naar AI stuurt; Cluppie haalt ze er automatisch uit, maar dat is een vangnet.</li>
      </ul>
      <a href="privacy.html" target="_blank" rel="noopener" style="font-size:calc(13px * var(--fs))">Privacyverklaring lezen</a>
      <label class="ci-schakel" style="margin-top:12px"><input type="checkbox" id="kenOk"><span>Ik heb dit gelezen en ga hiermee akkoord</span></label>
      <button class="knop vol" id="kenKnop" disabled style="margin-top:10px">Doorgaan</button>`);
    const cb = document.getElementById('kenOk'), kn = document.getElementById('kenKnop');
    cb.onchange = () => { kn.disabled = !cb.checked; };
    kn.onclick = async () => {
      kn.disabled = true; kn.textContent = 'Bezig…';
      try { await roep('bevestigPrivacy'); sluitModal(); klaar(); }
      catch(e){ kn.disabled = false; kn.textContent = 'Doorgaan'; fout(e); }
    };
  });
}

/* ---------- 2. E-mailverificatie (alleen wachtwoord-accounts) ---------- */
export function eerstVerifierenNodig(){
  const u = auth.currentUser;
  return !!(u && !u.isAnonymous && u.email && !u.emailVerified
    && (u.providerData || []).some(p => p.providerId === 'password'));
}
export function toonVerificatieHint(){
  if (!eerstVerifierenNodig()) return;
  openModal(`
    <h2>Bevestig je e-mailadres</h2>
    <p style="font-size:calc(13.5px * var(--fs));color:var(--ink-2);line-height:1.5;margin-bottom:12px">
      We hebben een mail gestuurd naar <b>${esc(auth.currentUser.email)}</b>. Klik op de link erin. Dat is nodig om je bij een team of club aan te sluiten.</p>
    <button class="knop vol" id="verOk">Ik heb bevestigd</button>
    <button class="knop licht vol" id="verOpnieuw" style="margin-top:8px">Mail opnieuw sturen</button>
    <button class="knop licht vol" id="verLater" style="margin-top:8px">Later</button>`);
  document.getElementById('verLater').onclick = sluitModal;
  document.getElementById('verOpnieuw').onclick = async () => {
    try { await sendEmailVerification(auth.currentUser); meld('Mail verstuurd'); } catch(e){ meld('Versturen mislukt, probeer het zo opnieuw'); }
  };
  document.getElementById('verOk').onclick = async () => {
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);         // verse token met email_verified
    if (auth.currentUser.emailVerified){ sluitModal(); meld('Bevestigd. Je kunt je nu aansluiten.'); }
    else meld('Nog niet bevestigd — klik eerst op de link in de mail');
  };
}

/* ---------- 3. Na aansluiten met goedkeuring ---------- */
export function toonAanvraagVerstuurd(res){
  openModal(`
    <h2>Aanvraag verstuurd</h2>
    <p style="font-size:calc(13.5px * var(--fs));color:var(--ink-2);line-height:1.5;margin-bottom:12px">
      Je aanvraag voor <b>${esc(res.naam || res.clubNaam || 'het team')}</b>${res.clubNaam && res.naam ? ' bij ' + esc(res.clubNaam) : ''} is verstuurd.
      Zodra een coach of beheerder van de club hem goedkeurt, zie je het team in de app.</p>
    <button class="knop vol" id="avOk">Begrepen</button>`);
  document.getElementById('avOk').onclick = sluitModal;
}

/* Lege staat op "Mijn teams": wachtende aanvragen van deze gebruiker */
export async function laadMijnAanvragen(container){
  if (!container || !S.user) return;
  try {
    const snap = await getDocs(query(collection(db, 'aanvragen'), where('uid', '==', S.user.uid)));
    if (snap.empty){ container.innerHTML = ''; return; }
    container.innerHTML = snap.docs.map(d => {
      const a = d.data();
      return `<div class="cb-kaart"><div class="cb-kaart-kop"><b>Wacht op goedkeuring</b></div>
        <p class="cb-uitleg" style="margin:0">Je aanvraag voor ${esc(a.teamNaam || 'de club')} is nog niet beoordeeld. Vraag de coach of beheerder om hem goed te keuren.</p></div>`;
    }).join('');
  } catch(e){ container.innerHTML = ''; }
}

/* Beheerder/coach: melding bij openstaande aanvragen */
export async function meldOpenAanvragen(clubId){
  try {
    const snap = await getDocs(query(collection(db, 'aanvragen'), where('clubId', '==', clubId)));
    if (!snap.empty) meld(`${snap.size} aanvraag${snap.size > 1 ? 'en' : ''} wacht${snap.size > 1 ? 'en' : ''} op je goedkeuring (Instellingen → Toegang & privacy)`);
  } catch(e){ /* alleen beheerders mogen dit lezen */ }
}

/* ---------- 4. Uitnodigen (team) — vervangt de oude vaste link ---------- */
export function modalUitnodigNieuw(team){
  const clubId = team.club || S.clubId;
  const vast = (S.club?.instellingen?.toegang?.vasteCodes) !== false && team.code;
  openModal(`
    <h2>Coach uitnodigen voor ${esc(team.naam)}</h2>
    <p style="font-size:calc(13.5px * var(--fs));color:var(--ink-2);line-height:1.5;margin-bottom:12px">
      Maak een persoonlijke uitnodiging. De link is 14 dagen geldig en kan 5 keer worden gebruikt.
      ${effectief(S.club || {}).toegang.goedkeuring ? 'Wie hem gebruikt, komt als aanvraag binnen; jij of een beheerder keurt hem goed.' : 'Wie hem gebruikt, wordt direct lid.'}</p>
    <div id="uitnRes"></div>
    <button class="knop vol" id="uitnMaak">Uitnodiging maken</button>
    ${vast ? `<p style="font-size:calc(12px * var(--fs));color:var(--ink-2);margin-top:12px">Oude teamcode (nog actief, ook via goedkeuring): <b>${esc(team.code)}</b></p>` : ''}`);
  document.getElementById('uitnMaak').onclick = async (e) => {
    const kn = e.currentTarget; kn.disabled = true; kn.textContent = 'Bezig…';
    try {
      const r = await roep('maakUitnodiging', { clubId, teamId: team.id, geldigDagen: 14, maxGebruik: 5 });
      const link = linkVoor(r.code);
      document.getElementById('uitnRes').innerHTML = `
        <div class="uitnodig-link">${esc(link)}</div>
        <div class="rij" style="margin:12px 0">
          <button class="knop vol" id="uitnKopieer">Link kopiëren</button>
          <button class="knop fluo vol" id="uitnWa">📲 WhatsApp</button>
        </div>`;
      kn.style.display = 'none';
      document.getElementById('uitnKopieer').onclick = async () => {
        try { await navigator.clipboard.writeText(link); meld('Link gekopieerd'); } catch { meld('Link: ' + link); }
      };
      document.getElementById('uitnWa').onclick = () => {
        const tekst = `Je bent uitgenodigd als coach voor ${team.naam}. Open deze link (14 dagen geldig) en log in met e-mail of Google:\n${link}`;
        window.open('https://wa.me/?text=' + encodeURIComponent(tekst), '_blank');
      };
    } catch(err){ kn.disabled = false; kn.textContent = 'Uitnodiging maken'; fout(err); }
  };
}

/* ---------- 5. Tabblad "Toegang & privacy" ---------- */
export function htmlToegang(){
  return `<div id="toegangRoot"><p class="cb-uitleg">Laden…</p></div>`;
}

const kaart = (titel, inhoud) => `<div class="cb-kaart"><div class="cb-kaart-kop"><b>${titel}</b></div>${inhoud}</div>`;
const rijStijl = 'display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid color-mix(in srgb,var(--ink) 10%,transparent)';

export async function koppelToegang(v, herteken){
  const root = v.querySelector('#toegangRoot');
  if (!root) return;
  const clubId = S.clubId;
  const eff = effectief(S.club);
  const T = eff.toegang, P = eff.privacy;

  const lees = async (col, veld = 'clubId') => {
    try { return (await getDocs(query(collection(db, col), where(veld, '==', clubId)))).docs.map(d => ({ id: d.id, ...d.data() })); }
    catch(e){ return []; }
  };
  const [aanvragen, uitnodigingen, logs, gebruikDocs, teamsSnap] = await Promise.all([
    lees('aanvragen'), lees('uitnodigingen'), lees('toegangslog'),
    (async () => {
      const vanaf = new Date(Date.now() - 270 * 86400000).toISOString().slice(0, 10);
      try { return (await getDocs(query(collection(db, 'gebruik'), where('clubId', '==', clubId), where('datum', '>=', vanaf)))).docs.map(d => d.data()); }
      catch(e){ return null; }
    })(),
    getDocs(query(collection(db, 'teams'), where('club', '==', clubId))).catch(() => ({ docs: [] })),
  ]);
  const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const nu = Date.now();

  /* --- instellingen --- */
  const html1 = kaart('Hoe sluiten coaches aan?', `
    <label class="ci-schakel"><input type="checkbox" id="tgGoed" ${T.goedkeuring ? 'checked' : ''}><span><b>Aanvragen goedkeuren</b> — nieuwe coaches komen pas binnen na jouw goedkeuring (aanbevolen)</span></label>
    <label class="ci-schakel" style="margin-top:8px"><input type="checkbox" id="tgVast" ${T.vasteCodes ? 'checked' : ''}><span>Oude vaste team- en clubcodes blijven werken (zet uit zodra alle coaches zijn aangesloten)</span></label>
    <label class="ci-schakel" style="margin-top:8px"><input type="checkbox" id="tgOnd" ${T.ondersteuning !== false ? 'checked' : ''}><span><b>Cluppie mag meekijken en helpen</b> — de eindbaas kan tijdelijk (maximaal 2 uur) als beheerder in jullie club werken om te ondersteunen. Elke start en stop staat in het toegangslog.</span></label>
    <button class="knop vol klein" id="tgOpslaan" style="margin-top:10px">Opslaan</button>`);

  /* --- aanvragen --- */
  const html2 = kaart(`Aanvragen${aanvragen.length ? ` (${aanvragen.length})` : ''}`, aanvragen.length ? aanvragen.map(a => `
    <div style="${rijStijl};flex-wrap:wrap">
      <div style="flex:1;min-width:150px"><b>${esc(a.naam)}</b><div class="cb-uitleg" style="margin:0">${esc(a.teamNaam || 'club')} · ${datumKort(a.gemaakt)}</div></div>
      <button class="knop klein" data-ar-goed="${esc(a.uid)}">Goedkeuren</button>
      <button class="knop licht klein" data-ar-af="${esc(a.uid)}">Afwijzen</button>
    </div>`).join('') : '<p class="cb-uitleg" style="margin:0">Geen openstaande aanvragen.</p>');

  /* --- uitnodigingen --- */
  const actief = uitnodigingen.filter(u => !u.ingetrokken);
  const html3 = kaart('Uitnodigingen', `
    <div class="rij" style="margin-bottom:8px;gap:8px;flex-wrap:wrap">
      <select class="invoer" id="tgInvTeam" style="flex:1;min-width:150px"><option value="">Hele club (geen team)</option>${teams.sort((a,b)=>(a.naam||'').localeCompare(b.naam||'')).map(t => `<option value="${t.id}">${esc(t.naam)}</option>`).join('')}</select>
      <button class="knop klein" id="tgInvMaak">Nieuwe uitnodiging</button>
    </div>
    ${actief.length ? actief.sort((a,b)=>(b.gemaakt?.seconds||0)-(a.gemaakt?.seconds||0)).slice(0, 15).map(u => {
      const verlopen = u.verlooptOp?.toMillis && u.verlooptOp.toMillis() < nu, op = u.gebruikt >= u.maxGebruik;
      return `<div style="${rijStijl};flex-wrap:wrap">
        <div style="flex:1;min-width:150px"><b>${esc(u.teamNaam || 'Hele club')}</b>
          <div class="cb-uitleg" style="margin:0">${verlopen ? 'verlopen' : op ? 'vol' : 'geldig tot ' + datumKort(u.verlooptOp)} · ${u.gebruikt}/${u.maxGebruik} gebruikt · door ${esc(u.gemaaktDoorNaam || '—')}</div></div>
        ${!verlopen && !op ? `<button class="knop licht klein" data-inv-kopie="${esc(u.code)}">Kopieer link</button>` : ''}
        <button class="knop licht klein" data-inv-weg="${u.id}">Intrekken</button></div>`;
    }).join('') : '<p class="cb-uitleg" style="margin:0">Nog geen uitnodigingen.</p>'}`);

  /* --- leden --- */
  const laatst = {};
  (gebruikDocs || []).forEach(g => { if (!laatst[g.uid] || g.datum > laatst[g.uid]) laatst[g.uid] = g.datum; });
  const leden = new Map();
  for (const t of teams) for (const [uid, aan] of Object.entries(t.leden || {})) {
    if (!aan) continue;
    const l = leden.get(uid) || { uid, naam: t.ledenInfo?.[uid]?.naam || S.club.ledenInfo?.[uid]?.naam || 'Onbekend', teams: [] };
    l.teams.push({ id: t.id, naam: t.naam, rol: t.rollen?.[uid] || 'coach' }); leden.set(uid, l);
  }
  for (const uid of Object.keys(S.club.admins || {})) if (!leden.has(uid)) leden.set(uid, { uid, naam: S.club.adminsInfo?.[uid]?.naam || 'Beheerder', teams: [] });
  let kennis = null;
  try { kennis = await roep('privacyOverzicht', { clubId }); } catch (e) { console.warn('[Cluppie] privacyoverzicht niet beschikbaar (functions niet gedeployed?)', e.code); }
  const akkoordTekst = uid => {
    if (!kennis) return '';
    const k = kennis.per[uid];
    if (!k) return ' · <b style="color:var(--accent)">privacyregels nog niet bevestigd</b>';
    const dat = k.tijd ? datumKort(k.tijd) : '';
    return k.versie === kennis.huidigeVersie ? ` · privacy akkoord ${dat}` : ` · <b style="color:var(--accent)">akkoord op oudere versie</b> ${dat}`;
  };
  const grens = new Date(Date.now() - 270 * 86400000).toISOString().slice(0, 10);
  const html4 = kaart(`Coaches (${leden.size})`, `
    ${gebruikDocs ? '<p class="cb-uitleg" style="margin:0 0 6px">Coaches zonder activiteit in 9 maanden staan als voorstel om te verwijderen.</p>' : ''}
    ${[...leden.values()].sort((a, b) => a.naam.localeCompare(b.naam)).map(l => {
      const isAdmin = !!S.club.admins?.[l.uid], last = laatst[l.uid];
      const inactief = gebruikDocs && !isAdmin && (!last || last < grens);
      return `<div style="${rijStijl};flex-wrap:wrap">
        <div style="flex:1;min-width:150px"><b>${esc(l.naam)}</b>${isAdmin ? ' <span class="cb-uitleg">· beheerder</span>' : ''}
          <div class="cb-uitleg" style="margin:0">${l.teams.map(t => `${esc(t.naam)}${t.rol === 'assistent' ? ' (assistent)' : ''}`).join(', ') || 'geen team'}${gebruikDocs ? ' · laatst actief ' + (last ? datumKort(last) : 'niet in 9 mnd') : ''}${inactief ? ' <b style="color:var(--accent)">· inactief</b>' : ''}${akkoordTekst(l.uid)}</div></div>
        ${l.teams.some(t => t.rol === 'assistent') ? `<button class="knop klein" data-lid-rol="${esc(l.uid)}" data-rol="coach">Maak coach</button>` : ''}
        ${!isAdmin ? `<button class="knop licht klein" data-lid-weg="${esc(l.uid)}" data-lid-naam="${esc(l.naam)}">Uitschrijven</button>` : ''}
      </div>`;
    }).join('')}`);

  /* --- privacy --- */
  const vo = P.verwerkersovereenkomst;
  const html5 = kaart('Privacy van de club', `
    <div class="veldgroep"><label>Privacycontactpersoon van de club</label>
      <input class="invoer" id="pvNaam" placeholder="Naam" value="${esc(P.contactNaam)}" maxlength="80"></div>
    <div class="veldgroep"><input class="invoer" id="pvMail" type="email" placeholder="E-mailadres" value="${esc(P.contactEmail)}" maxlength="120"></div>
    <label class="ci-schakel"><input type="checkbox" id="pvAch" ${P.achternamen ? 'checked' : ''}><span>Achternaam van spelers vastleggen (uit = alleen voornaam, aanbevolen)</span></label>
    <label class="ci-schakel" style="margin-top:6px"><input type="checkbox" id="pvVo" ${vo?.geaccepteerd ? 'checked' : ''}><span>De club heeft een <b>verwerkersovereenkomst</b> met Cluppie afgesloten${vo?.geaccepteerd ? ` (vastgelegd ${datumKort(vo.tijd)} door ${esc(vo.naam || '—')})` : ''}</span></label>
    <button class="cb-link" id="pvVoLees" type="button" style="margin-top:4px">Lees de overeenkomst en accepteer digitaal ›</button>
    <p class="cb-uitleg" style="margin:6px 0 0">AI-functies staan onder “AI &amp; modules”; voor nieuwe clubs staan ze standaard uit.</p>
    <button class="knop vol klein" id="pvOpslaan" style="margin-top:10px">Opslaan</button>`);

  /* --- log --- */
  const LOGTXT = { aanvraag: 'vroeg toegang aan', aangesloten: 'sloot aan', goedgekeurd: 'goedgekeurd', afgewezen: 'afgewezen', verwijderd: 'uitgeschreven', rol_gewijzigd: 'rol gewijzigd', uitnodiging_gemaakt: 'uitnodiging gemaakt', uitnodiging_ingetrokken: 'uitnodiging ingetrokken', ondersteuning_start: 'begon met ondersteunen', ondersteuning_stop: 'stopte met ondersteunen' };
  const html6 = kaart('Toegangslog', logs.length ? logs.sort((a, b) => (b.tijd?.seconds || 0) - (a.tijd?.seconds || 0)).slice(0, 30).map(l => `
    <div style="${rijStijl};font-size:calc(12.5px * var(--fs))"><span style="color:var(--ink-2);min-width:52px">${datumKort(l.tijd)}</span>
    <span><b>${esc(l.naam || l.doorNaam || '—')}</b> ${esc(LOGTXT[l.gebeurtenis] || l.gebeurtenis)}${l.naam && l.doorNaam && l.gebeurtenis !== 'aanvraag' && l.gebeurtenis !== 'aangesloten' ? ` <span style="color:var(--ink-2)">door ${esc(l.doorNaam)}</span>` : ''}${l.details ? ` <span style="color:var(--ink-2)">(${esc(l.details)})</span>` : ''}</span></div>`).join('')
    : '<p class="cb-uitleg" style="margin:0">Nog geen gebeurtenissen.</p>');

  root.innerHTML = html2 + html1 + html3 + html4 + html5 + html6;
  const q = (s) => root.querySelector(s), qa = (s) => root.querySelectorAll(s);
  const klaar = async (fn, knop, tekst) => {
    if (knop){ knop.disabled = true; }
    try { await fn(); if (tekst) meld(tekst); herteken(); } catch(e){ fout(e); if (knop) knop.disabled = false; }
  };

  q('#tgOpslaan').onclick = (e) => klaar(() => bewaar([['toegang', {
    goedkeuring: q('#tgGoed').checked, standaardRol: 'coach', vasteCodes: q('#tgVast').checked, ondersteuning: q('#tgOnd').checked }]]), e.currentTarget, 'Opgeslagen');

  qa('[data-ar-goed]').forEach(b => b.onclick = () => klaar(() =>
    roep('beoordeelAanvraag', { clubId, uid: b.dataset.arGoed, besluit: 'goed', rol: 'coach' }), b, 'Goedgekeurd'));
  qa('[data-ar-af]').forEach(b => b.onclick = () => klaar(() => roep('beoordeelAanvraag', { clubId, uid: b.dataset.arAf, besluit: 'af' }), b, 'Afgewezen'));

  q('#tgInvMaak').onclick = (e) => klaar(async () => {
    const teamId = q('#tgInvTeam').value || null;
    const r = await roep('maakUitnodiging', { clubId, teamId, geldigDagen: 14, maxGebruik: teamId ? 5 : 10 });
    try { await navigator.clipboard.writeText(linkVoor(r.code)); } catch(_) {}
    meld('Uitnodiging gemaakt en link gekopieerd');
  }, e.currentTarget);
  qa('[data-inv-kopie]').forEach(b => b.onclick = async () => {
    try { await navigator.clipboard.writeText(linkVoor(b.dataset.invKopie)); meld('Link gekopieerd'); } catch { meld(linkVoor(b.dataset.invKopie)); }
  });
  qa('[data-inv-weg]').forEach(b => b.onclick = () => klaar(() => roep('trekUitnodigingIn', { id: b.dataset.invWeg }), b, 'Ingetrokken'));

  qa('[data-lid-rol]').forEach(s => s.onclick = () => {
    const l = leden.get(s.dataset.lidRol);
    klaar(async () => { for (const t of l.teams.filter(x => x.rol === 'assistent')) await roep('wijzigRol', { clubId, teamId: t.id, uid: l.uid, rol: 'coach' }); }, s, 'Nu coach');
  });
  qa('[data-lid-weg]').forEach(b => b.onclick = () => {
    if (!confirm(`${b.dataset.lidNaam} uitschrijven? Die verliest de toegang tot de club en alle teams.`)) return;
    klaar(() => roep('verwijderLid', { clubId, uid: b.dataset.lidWeg }), b, 'Uitgeschreven');
  });

  q('#pvVoLees')?.addEventListener('click', () => import('./club.js?v=20261020d').then(m => m.modalVerwerkersovereenkomst()));
  q('#pvOpslaan').onclick = (e) => klaar(async () => {
    const wijz = [
      ['privacy.contactNaam', q('#pvNaam').value.trim()], ['privacy.contactEmail', q('#pvMail').value.trim()],
      ['privacy.achternamen', q('#pvAch').checked],
    ];
    const voAan = q('#pvVo').checked;
    if (voAan && !vo?.geaccepteerd) wijz.push(['privacy.verwerkersovereenkomst', { geaccepteerd: true, uid: S.user.uid, naam: S.user.displayName || '', tijd: new Date().toISOString(), versie: PRIVACY_VERSIE }]);
    if (!voAan && vo?.geaccepteerd) wijz.push(['privacy.verwerkersovereenkomst', null]);
    await bewaar(wijz);
  }, e.currentTarget, 'Opgeslagen');
}
