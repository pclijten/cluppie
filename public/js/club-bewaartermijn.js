/* ==================== CLUB › BEWAARTERMIJNEN EN OPRUIMEN [20261121c] ====================
   Clubinstellingen › Algemeen › Seizoen › "Bewaartermijnen en opruimen" (alleen de clubbeheerder).

   De club kiest hoe lang gegevens blijven staan van (1) spelers die niet meer bij een team horen
   (gearchiveerd: overgezet of vertrokken) en (2) oude seizoenen. "Zoek wat over de termijn is" leest alle
   teams van de club en toont aantallen. Pas na een vinkje en een knop wordt er gewist. Er gebeurt nooit
   iets vanzelf, en er staan geen namen in het overzicht.

   Wat er bij een speler weggaat: het spelerdocument (naam, nummer, notities, leerpunten), de dossiers van
   eerdere teams eronder (vorigeTeams), zijn beoordelingen bij dat team en zijn naam in de aanwezigheid.
   Wedstrijden blijven staan; daarin staat alleen nog een nummer zonder naam.
   Wat er bij een oud seizoen weggaat: wedstrijden, aanwezigheid, beoordelingen en teamevaluaties met dat
   seizoenslabel. Documenten zonder label blijven staan (eerst "Oude data zonder seizoen labelen").

   [20261122a] Derde blok: wat de app zelf niet mag wissen (rules) en dus via de server gaat, functie
   bewaarOpruimen in functions/bewaartermijn.js: beoordelingen uit evaluatierondes (alleen de schrijver
   mag ze wissen), en uit de teamkamer de mededelingen en gesloten polls van vorige seizoenen, de
   gegevens van gezinnen waarvan de speler weg is en oude aanmeldingen voor trainingshulp. Zelfde
   werkwijze: eerst tellen, dan bevestigen. Staat de functie nog niet live, dan zegt het scherm dat.

   De drie acties staan los van elkaar. Na elke actie wordt opnieuw gezocht, zodat de tweede nooit een
   document bijwerkt dat de eerste net heeft gewist.
   Rekenregels: bewaartermijn-logica.js (getest). Schrijven: alles onder teams/{id}/… mag de clubbeheerder
   volgens de bestaande rules (magSchrijven); de keuze en "laatst opgeruimd" staan in
   clubs/{id}.instellingen.privacy.bewaar. */
import { S, esc, meld, openModal } from './state.js?v=20261125u';
import { db, collection, doc, getDocs, writeBatch, functions, httpsCallable } from './firebase.js?v=20261011g';
import { ico } from './icons.js?v=20261116t';
import { SEIZOEN_FALLBACK } from './config.js?v=20261125u';
import { bewaar } from './club-instellingen.js?v=20261125u';
import { STANDAARD, KEUZES_SPELERS, KEUZES_SEIZOENEN, SEIZOEN_COLLECTIES, schoonBewaar, sorteerSpelers, seizoenVerlopen, seizoenStart, oudsteBewaard,
  presentieZonder, datumNL, seizoenLabel, tellingTekst, laatstTekst } from './bewaartermijn-logica.js?v=20261122a';

const B = { keuze: null, scan: null, bezig: '', fout: '', teams: [] };
const vandaag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const huidig = () => S.club?.huidigSeizoen || SEIZOEN_FALLBACK;
const opgeslagen = () => S.club?.instellingen?.privacy?.bewaar || null;

/* regel onder de knop in Instellingen */
export function bewaarRegel(){ return opgeslagen() ? laatstTekst(opgeslagen().laatst) : 'Nog geen termijn gekozen'; }

export function modalBewaartermijn(teams){
  B.teams = teams || []; B.keuze = schoonBewaar(opgeslagen()); B.scan = null; B.bezig = ''; B.fout = '';
  openModal(html());
  koppel();
}
const m$ = id => document.getElementById(id);
function herteken(){ const el = m$('bwRoot'); if (el){ el.outerHTML = body(); koppel(); } }

function html(){ return `<h2>${ico('admin-archive', 18)} Bewaartermijnen en opruimen</h2>${body()}`; }
function body(){
  const k = B.keuze, gekozen = !!opgeslagen(), grens = oudsteBewaard(huidig(), k.seizoenen);
  const opt = (lijst, w) => lijst.map(([v, t]) => `<option value="${v}" ${v === w ? 'selected' : ''}>${esc(t)}</option>`).join('');
  return `<div id="bwRoot">
    <p class="cb-uitleg" style="margin-top:0">Gegevens van kinderen bewaar je niet langer dan nodig. De club kiest de termijn; Cluppie wist nooit iets vanzelf. Je ziet eerst wat het is, daarna bevestig je.</p>
    <div class="cb-kaart">
      <div class="cb-kaart-kop"><b>Termijnen van ${esc(S.club?.naam || 'de club')}</b></div>
      <div class="veldgroep"><label for="bwSpelers">Spelers die niet meer bij een team horen</label>
        <select class="invoer" id="bwSpelers">${opt(KEUZES_SPELERS, k.spelersJaren)}</select>
        <p class="cb-uitleg">Overgezet naar een ander team of vertrokken. Bij een overgezette speler is het dossier al mee naar het nieuwe team; hier gaat het om wat bij het oude team is blijven staan.</p></div>
      <div class="veldgroep"><label for="bwSeizoenen">Wedstrijden, aanwezigheid, beoordelingen en evaluaties</label>
        <select class="invoer" id="bwSeizoenen">${opt(KEUZES_SEIZOENEN, k.seizoenen)}</select>
        <p class="cb-uitleg">${grens === null ? 'Er wordt geen seizoen voorgesteld om te wissen.' : `Nu is het ${esc(huidig())}. Seizoenen vóór ${esc(seizoenLabel(grens))} vallen buiten de termijn.`}</p></div>
      <div class="rij"><button class="knop licht klein" id="bwBewaar">${gekozen ? 'Termijnen opslaan' : 'Deze termijnen vastleggen'}</button></div>
      <p class="cb-uitleg">${esc(bewaarRegel())}. Het voorstel van Cluppie is ${STANDAARD.spelersJaren} jaar en ${STANDAARD.seizoenen} seizoenen; leg je eigen keuze vast in het privacybeleid van de club.</p>
    </div>
    ${B.fout ? `<div class="cb-kaart cb-let"><div class="cb-kaart-kop u-mb-xs"><span class="cb-let-ico">${ico('action-warning', 18)}</span><b>Niet gelukt</b></div><p class="cb-uitleg" style="margin:0">${esc(B.fout)}</p></div>` : ''}
    ${B.scan ? htmlScan() : `<button class="knop vol" id="bwZoek" ${B.bezig ? 'disabled' : ''}>${B.bezig ? esc(B.bezig) : 'Zoek wat over de termijn is'}</button>
      <p class="cb-uitleg">Leest de ${B.teams.length} team${B.teams.length === 1 ? '' : 's'} van de club. Er wordt nog niets gewist.</p>`}
  </div>`;
}
function htmlScan(){
  const s = B.scan, k = B.keuze, nSp = s.spelers.length, nDoc = s.docs.length;
  const perSeizoen = [...s.perSeizoen.entries()].sort((a, b) => a[0] - b[0]);
  const eerst = s.later[0];
  const blok = (titel, n, inhoud, knopId, knopTekst, vinkId) => `<div class="cb-kaart ${n ? 'cb-gevaar' : ''}">
      <div class="cb-kaart-kop">${ico(n ? 'action-warning' : 'action-check', 18)}<b>${esc(titel)}</b><span class="cb-telling">${n}</span></div>
      ${inhoud}
      ${n ? `<label class="ci-schakel" style="margin-top:var(--space-xs)"><input type="checkbox" id="${vinkId}"><span>Ik weet dat dit niet terug te draaien is.</span></label>
        <button class="knop gevaar vol" id="${knopId}" disabled>${esc(B.bezig || knopTekst)}</button>` : ''}</div>`;
  return `
    ${blok('Spelers over de termijn', nSp, nSp
      ? `<p class="cb-uitleg" style="margin:0">${nSp} speler${nSp === 1 ? '' : 's'} in ${s.spelerTeams} team${s.spelerTeams === 1 ? '' : 's'}: ${s.spelers.filter(p => p.weg).length} vertrokken, ${s.spelers.filter(p => !p.weg).length} overgezet naar een ander team. Hun spelerdocument, eerdere dossiers, ${s.beoordelingen} beoordeling${s.beoordelingen === 1 ? '' : 'en'} en hun naam in ${s.presentie} training${s.presentie === 1 ? '' : 'en'} gaan weg. Wedstrijden blijven staan, zonder naam.</p>`
      : `<p class="cb-uitleg" style="margin:0">Geen spelers over de termijn van ${k.spelersJaren} jaar.${eerst ? ` De eerstvolgende is op ${esc(datumNL(eerst.vanaf))}.` : ''}${s.zonderDatum ? ` ${s.zonderDatum} gearchiveerde speler${s.zonderDatum === 1 ? ' heeft' : 's hebben'} geen datum en ${s.zonderDatum === 1 ? 'blijft' : 'blijven'} staan.` : ''}</p>`,
      'bwWisSpelers', `Wis de gegevens van ${nSp} speler${nSp === 1 ? '' : 's'}`, 'bwVinkSpelers')}
    ${blok('Oude seizoenen', nDoc, nDoc
      ? `${perSeizoen.map(([start, tel]) => `<p class="cb-uitleg" style="margin:0 0 var(--space-3xs)"><b>${esc(seizoenLabel(start))}</b>: ${esc(tellingTekst(tel))}</p>`).join('')}
         <p class="cb-uitleg" style="margin:var(--space-xs) 0 0">Ook van spelers die nog bij de club spelen: hun ontwikkeling uit deze seizoenen is daarna niet meer terug te zien.</p>`
      : `<p class="cb-uitleg" style="margin:0">${k.seizoenen ? 'Geen gegevens uit seizoenen buiten de termijn.' : 'Je bewaart alle seizoenen.'}${s.zonderLabel ? ` ${s.zonderLabel} document${s.zonderLabel === 1 ? ' heeft' : 'en hebben'} geen seizoen en ${s.zonderLabel === 1 ? 'blijft' : 'blijven'} staan: gebruik eerst "Oude data zonder seizoen labelen".` : ''}</p>`,
      'bwWisSeizoenen', `Wis ${nDoc} document${nDoc === 1 ? '' : 'en'} uit oude seizoenen`, 'bwVinkSeizoenen')}
    ${htmlServer(blok)}
    <button class="knop licht vol" id="bwOpnieuw" ${B.bezig ? 'disabled' : ''}>Opnieuw zoeken</button>`;
}

/* [20261122a] Evaluatierondes en teamkamer: de server telt en wist. s.server = het antwoord, of { fout }. */
const meerv = (n, een, veel) => `${n} ${n === 1 ? een : veel}`;
function htmlServer(blok){
  const r = B.scan.server;
  if (!r || r.fout) return `<div class="cb-kaart"><div class="cb-kaart-kop">${ico('action-warning', 18)}<b>Evaluatierondes en teamkamer</b></div>
    <p class="cb-uitleg" style="margin:0">${esc(r && r.fout === 'recht' ? 'Alleen een clubbeheerder kan dit opruimen.' : 'Dit deel is nog niet beschikbaar: de functie hiervoor staat nog niet live. De twee blokken hierboven werken wel.')}</p></div>`;
  const delen = [
    r.prive.oud ? `${meerv(r.prive.oud, 'beoordeling', 'beoordelingen')} uit evaluatierondes van seizoenen buiten de termijn` : '',
    r.prive.wees ? `${meerv(r.prive.wees, 'beoordeling', 'beoordelingen')} uit evaluatierondes van spelers die al gewist zijn` : '',
    r.kamer.berichten ? `${meerv(r.kamer.berichten, 'mededeling', 'mededelingen')} in de teamkamer van vóór dit seizoen` : '',
    r.kamer.polls ? `${meerv(r.kamer.polls, 'gesloten poll', 'gesloten polls')} van vóór dit seizoen, met de stemmen` : '',
    r.kamer.gezinnen ? `teamkamer-gegevens van ${meerv(r.kamer.gezinnen, 'speler', 'spelers')} die niet meer in het team ${r.kamer.gezinnen === 1 ? 'staat' : 'staan'}` : '',
    r.hulp ? `${meerv(r.hulp, 'aanmelding', 'aanmeldingen')} voor trainingshulp van vóór dit seizoen` : '',
  ].filter(Boolean);
  return blok('Evaluatierondes en teamkamer', r.totaal, r.totaal
    ? `<ul class="cb-uitleg" style="margin:0;padding-left:var(--space-md)">${delen.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
       <p class="cb-uitleg" style="margin:var(--space-xs) 0 0">Open polls en alles van dit seizoen blijven staan. De lijsten voor trainingshulp zelf ook.</p>`
    : '<p class="cb-uitleg" style="margin:0">Niets op te ruimen in de evaluatierondes en de teamkamer.</p>',
    'bwWisServer', `Wis deze ${r.totaal} gegevens`, 'bwVinkServer');
}
async function vraagServer(wis){
  try { return (await httpsCallable(functions, 'bewaarOpruimen')({ clubId: S.clubId, wis: wis === true })).data || { fout: 'weg' }; }
  catch (x){
    console.warn('[bewaartermijn] server', x.code || x.message);
    return { fout: x.code === 'functions/permission-denied' ? 'recht' : 'weg' };
  }
}
async function wisServer(){
  const s = B.scan; if (!s || !s.server || !s.server.totaal || B.bezig) return;
  B.bezig = 'Bezig…'; B.fout = ''; herteken();
  const r = await vraagServer(true);
  if (r.fout || !r.gewist){
    B.bezig = ''; B.fout = 'Opruimen van evaluatierondes en teamkamer is niet gelukt. Er is niets gewist; probeer het later opnieuw.'; herteken(); return;
  }
  await legVast(0, 0, r.totaal);
  meld(`${r.totaal} gegevens uit evaluatierondes en teamkamer gewist`);
  B.bezig = ''; B.scan = null; await zoek();
}

function koppel(){
  const lees = () => { B.keuze = schoonBewaar({ spelersJaren: m$('bwSpelers')?.value, seizoenen: m$('bwSeizoenen')?.value }); };
  for (const id of ['bwSpelers', 'bwSeizoenen']) m$(id)?.addEventListener('change', () => { lees(); B.scan = null; herteken(); });
  m$('bwBewaar')?.addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    try { await bewaar([['privacy.bewaar', { ...B.keuze, ...(opgeslagen()?.laatst ? { laatst: opgeslagen().laatst } : {}) }]]); meld('Termijnen vastgelegd'); }
    catch (x){ meld('Opslaan mislukt: ' + (x.code || x.message)); }
    herteken();
  });
  m$('bwZoek')?.addEventListener('click', zoek);
  m$('bwOpnieuw')?.addEventListener('click', zoek);
  for (const [vink, knop, doe] of [['bwVinkSpelers', 'bwWisSpelers', wisSpelers], ['bwVinkSeizoenen', 'bwWisSeizoenen', wisSeizoenen], ['bwVinkServer', 'bwWisServer', wisServer]]){
    m$(vink)?.addEventListener('change', e => { const k = m$(knop); if (k) k.disabled = !e.target.checked || !!B.bezig; });
    m$(knop)?.addEventListener('click', doe);
  }
}

/* ---------- zoeken: alle teams lezen, niets schrijven ---------- */
async function zoek(){
  if (B.bezig) return;
  const clubId = S.clubId, k = B.keuze, nu = vandaag();
  B.fout = ''; B.scan = null;
  const scan = { spelers: [], later: [], zonderDatum: 0, spelerTeams: 0, beoordelingen: 0, presentie: 0, wisBeoordelingen: [], presentiePatches: [],
    docs: [], perSeizoen: new Map(), zonderLabel: 0, server: null };
  try {
    let i = 0;
    for (const t of B.teams){
      B.bezig = `Team ${++i} van ${B.teams.length} lezen…`; herteken();
      const lees = sub => getDocs(collection(db, 'teams', t.id, sub));
      const [sp, ...rest] = await Promise.all([lees('spelers'), ...SEIZOEN_COLLECTIES.map(([sub]) => lees(sub))]);
      if (S.clubId !== clubId) return;                     /* de beheerder is intussen naar een andere club gegaan */
      const perSub = Object.fromEntries(SEIZOEN_COLLECTIES.map(([sub], n) => [sub, rest[n].docs]));
      const r = sorteerSpelers(sp.docs.map(d => ({ id: d.id, ...d.data() })), k.spelersJaren, nu);
      scan.later.push(...r.later); scan.zonderDatum += r.zonderDatum;
      for (const [sub] of SEIZOEN_COLLECTIES) for (const d of perSub[sub]){
        const label = d.data().seizoen;
        if (!label){ scan.zonderLabel++; continue; }
        if (!seizoenVerlopen(label, huidig(), k.seizoenen)) continue;
        scan.docs.push(d.ref);
        const start = seizoenStart(label), tel = scan.perSeizoen.get(start) || {};
        tel[sub] = (tel[sub] || 0) + 1; scan.perSeizoen.set(start, tel);
      }
      if (r.verlopen.length){
        scan.spelerTeams++;
        const ids = r.verlopen.map(p => p.id), weg = new Set(ids);
        for (const p of r.verlopen) scan.spelers.push({ ...p, teamId: t.id });
        for (const d of perSub.beoordelingen) if (weg.has(d.data().spelerId)){ scan.beoordelingen++; scan.wisBeoordelingen.push(d.ref); }
        for (const d of perSub.presentie){
          const patch = presentieZonder(d.data(), ids);
          if (patch){ scan.presentie++; scan.presentiePatches.push([d.ref, patch]); }
        }
      }
    }
    scan.later.sort((a, b) => a.vanaf.localeCompare(b.vanaf));
    B.bezig = 'Evaluatierondes en teamkamer tellen…'; herteken();
    scan.server = await vraagServer(false);
    if (S.clubId !== clubId) return;
    B.scan = scan;
  } catch (x){
    console.error('[bewaartermijn] zoeken', x);
    B.fout = x.code === 'permission-denied' ? 'Je mag niet alle teams lezen. Alleen een clubbeheerder kan opruimen.' : 'Zoeken mislukt: ' + (x.code || x.message);
  }
  B.bezig = ''; herteken();
}

/* ---------- wissen ---------- */
/* stappen = [fn(batch)]; elke 400 stappen een commit. Geeft het aantal uitgevoerde stappen terug. */
async function inBatches(stappen, voortgang){
  let batch = writeBatch(db), n = 0, klaar = 0;
  for (const stap of stappen){
    stap(batch); n++;
    if (n >= 400){ await batch.commit(); klaar += n; n = 0; batch = writeBatch(db); voortgang(klaar); }
  }
  if (n){ await batch.commit(); klaar += n; }
  return klaar;
}
/* Wanneer en hoeveel: voor de verantwoording van de club. Twee keer wissen binnen een uur telt als één keer opruimen. */
async function legVast(spelers, documenten, overig = 0){
  const oud = opgeslagen()?.laatst || {}, recent = Date.now() - (Number(oud.ms) || 0) < 3600000;
  const laatst = { ms: Date.now(), door: S.user?.uid || '', spelers: (recent ? Number(oud.spelers) || 0 : 0) + spelers, documenten: (recent ? Number(oud.documenten) || 0 : 0) + documenten, overig: (recent ? Number(oud.overig) || 0 : 0) + overig };
  try { await bewaar([['privacy.bewaar', { ...B.keuze, laatst }]]); }
  catch (x){ console.warn('[bewaartermijn] vastleggen', x.code || x.message); }
}
async function wisSpelers(){
  const s = B.scan; if (!s || !s.spelers.length || B.bezig) return;
  const n = s.spelers.length;
  B.bezig = 'Dossiers lezen…'; B.fout = ''; herteken();
  try {
    /* de dossiers van eerdere teams staan onder de speler en gaan niet vanzelf mee met het spelerdocument */
    const dossiers = [];
    for (const p of s.spelers){
      const snap = await getDocs(collection(db, 'teams', p.teamId, 'spelers', p.id, 'vorigeTeams'));
      snap.docs.forEach(d => dossiers.push(d.ref));
    }
    const stappen = [
      ...dossiers.map(r => b => b.delete(r)),
      ...s.wisBeoordelingen.map(r => b => b.delete(r)),
      ...s.presentiePatches.map(([r, patch]) => b => b.update(r, patch)),
      ...s.spelers.map(p => b => b.delete(doc(db, 'teams', p.teamId, 'spelers', p.id))),   /* het spelerdocument als laatste */
    ];
    await inBatches(stappen, k => { B.bezig = `${k} van ${stappen.length} gedaan…`; herteken(); });
    await legVast(n, 0);
    meld(`Gegevens van ${n} speler${n === 1 ? '' : 's'} gewist`);
    B.bezig = ''; B.scan = null; await zoek();
  } catch (x){
    console.error('[bewaartermijn] spelers wissen', x);
    B.bezig = ''; B.fout = 'Wissen is halverwege gestopt (' + (x.code || x.message) + '). Wat al weg is, blijft weg; zoek opnieuw en probeer de rest.'; B.scan = null; herteken();
  }
}
async function wisSeizoenen(){
  const s = B.scan; if (!s || !s.docs.length || B.bezig) return;
  const n = s.docs.length;
  B.bezig = 'Bezig…'; B.fout = ''; herteken();
  try {
    await inBatches(s.docs.map(r => b => b.delete(r)), k => { B.bezig = `${k} van ${n} gewist…`; herteken(); });
    await legVast(0, n);
    meld(`${n} document${n === 1 ? '' : 'en'} uit oude seizoenen gewist`);
    B.bezig = ''; B.scan = null; await zoek();
  } catch (x){
    console.error('[bewaartermijn] seizoenen wissen', x);
    B.bezig = ''; B.fout = 'Wissen is halverwege gestopt (' + (x.code || x.message) + '). Wat al weg is, blijft weg; zoek opnieuw en probeer de rest.'; B.scan = null; herteken();
  }
}
