/* ==================== TRAININGSCOÖRDINATOR — BEHEER ====================
   Kaart voor de clubbeheerder (tab Coaches): de coördinator uitnodigen,
   aanvragen accepteren, toegang intrekken en meekijken zoals hij het ziet.

   Uitnodigen = een persoonlijke uitnodiging met de rol 'trainco' (Cloud Function
   maakUitnodiging). Wie die opent en inlogt, wordt NIET meteen lid: sluitAan zet
   een aanvraag klaar (aanvragen/{clubId}_{uid}, rol 'trainco'). Pas als de
   beheerder die accepteert (beoordeelAanvraag) krijgt de persoon
   `trainingscoordinatoren.<uid> = true` en leesrechten op teams, trainingen en
   video's van de club — nooit op spelers. Rechtenbron: dat veld.
   Importeert niets uit club.js (geen kringimport). */
import { db, doc, updateDoc, deleteField, collection, query, where, getDocs, getDoc, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261113b';
import { ico } from './icons.js?v=20261110a';

const roep = (naam, data) => httpsCallable(functions, naam)(data).then(r => r.data);
const naamKort = n => String(n || 'Naamloos').split('@')[0];
const twee = n => naamKort(n).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const linkVoor = code => location.origin + location.pathname + '?uitn=' + code;
const ms = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0);

function coordinatoren(){
  const c = S.club?.trainingscoordinatoren || {};
  return Object.keys(c).filter(u => c[u] === true)
    .map(uid => ({ uid, naam: naamKort(S.club.trainingscoordinatorenInfo?.[uid]?.naam || S.club.ledenInfo?.[uid]?.naam) }));
}

export function htmlTraincoKaart(){
  if (!S.club?.admins?.[S.user?.uid]) return '';
  const co = coordinatoren();
  return `
    <div class="cb-kaart" id="traincoKaart">
      <div class="cb-kaart-kop">${ico('team-add', 18)}<b>Trainingscoördinator</b><span class="cb-telling">${co.length}</span></div>
      <p class="cb-uitleg" style="margin:0 0 8px">Een coördinator ziet alle teams waarvoor trainingen klaarstaan: wie wanneer traint, het aantal spelers, de AI-training, de PDF en de diagrammen. Geen spelersnamen.</p>
      ${co.map(c => `<div class="cb-persoon"><div class="cb-av">${esc(twee(c.naam))}</div><div class="cb-persoon-n">${esc(c.naam)} <span class="cb-rol coord">Coördinator</span></div>
        <button class="knop licht klein" data-tc-weg="${esc(c.uid)}">Toegang intrekken</button></div>`).join('')}
      <div id="tcAanvragen"></div>
      <div class="sectie-kop" style="margin:12px 0 6px">Uitnodigen</div>
      <div id="tcUitnodig"><p class="cb-uitleg" style="margin:0">Laden…</p></div>
      <div class="cb-acties" style="margin:10px 0 0">
        <a class="knop licht klein" href="${esc(location.pathname)}?trainco=1">Bekijk als coördinator</a>
      </div>
    </div>`;
}

function htmlAanvragen(lijst){
  if (!lijst.length) return '';
  return `<div class="sectie-kop" style="margin:12px 0 6px">Wacht op acceptatie</div>
    ${lijst.map(w => `<div class="cb-persoon"><div class="cb-av">${esc(twee(w.naam))}</div><div class="cb-persoon-n">${esc(naamKort(w.naam))}
      <div class="cb-uitleg" style="margin:2px 0 0">Heeft zich aangemeld als trainingscoördinator</div></div>
      <button class="knop klein" data-tc-maak="${esc(w.uid)}">Maak coördinator</button>
      <button class="knop licht klein cb-verwijder" data-tc-afwijs="${esc(w.uid)}" style="margin-left:6px">Verwijderen</button></div>`).join('')}`;
}
function htmlUitnodiging(u){
  if (!u) return `<p class="cb-uitleg" style="margin:0 0 8px">Maak een persoonlijke link (30 dagen geldig, maximaal 3 keer te gebruiken). Na inloggen verschijnt de persoon hierboven onder "Wacht op acceptatie". Hij krijgt pas toegang als jij hem accepteert.</p>
    <button class="knop klein" id="tcMaakLink">Uitnodigingslink maken</button>`;
  const link = linkVoor(u.code);
  const tekst = 'Hoi! Open deze link en log in met je e-mailadres om de trainingen van ' + (S.club.naam || 'de club') + ' te bekijken: ' + link;
  return `<p class="cb-uitleg" style="margin:0 0 8px">Stuur deze link. Na inloggen verschijnt de persoon hierboven onder "Wacht op acceptatie". Hij krijgt pas toegang als jij hem accepteert.</p>
    <div class="uitnodig-link" id="traincoLink">${esc(link)}</div>
    <div class="cb-acties" style="margin:10px 0 0">
      <button class="knop licht klein" id="traincoKopieer">Link kopiëren</button>
      <a class="knop licht klein" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(tekst)}">WhatsApp</a>
      <button class="knop licht klein" id="tcLinkIn" data-id="${esc(u.id)}">Link intrekken</button>
    </div>`;
}

/* api: { herteken() } */
export function koppelTraincoKaart(v, api){
  const kaart = v.querySelector('#traincoKaart'); if (!kaart) return;
  const clubId = S.club.id;
  const schrijf = async (data, ok) => {
    try { await updateDoc(doc(db, 'clubs', clubId), data); meld(ok); api.herteken(); }
    catch(e){ meld('Opslaan mislukt: ' + (e.code || e.message)); }
  };
  kaart.querySelectorAll('[data-tc-weg]').forEach(b => b.onclick = async () => {
    if (!confirm('Toegang van deze trainingscoördinator intrekken?')) return;
    const uid = b.dataset.tcWeg; b.disabled = true;
    if (S.club.trainingscoordinatoren) delete S.club.trainingscoordinatoren[uid];
    await schrijf({ ['trainingscoordinatoren.' + uid]: deleteField(), ['trainingscoordinatorenInfo.' + uid]: deleteField() }, 'Toegang ingetrokken');
  });

  const laad = async () => {
    const nu = Date.now();
    let aanvragen = [], uitnodiging = null;
    try {
      const [a, u] = await Promise.all([
        getDocs(query(collection(db, 'aanvragen'), where('clubId', '==', clubId))),
        getDocs(query(collection(db, 'uitnodigingen'), where('clubId', '==', clubId))),
      ]);
      aanvragen = a.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.rol === 'trainco');
      uitnodiging = u.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(x => x.rol === 'trainco' && !x.ingetrokken && ms(x.verlooptOp) > nu && (x.gebruikt || 0) < (x.maxGebruik || 1))
        .sort((p, q) => ms(q.gemaakt) - ms(p.gemaakt))[0] || null;
    } catch(e){ /* geen rechten of offline: kaart blijft bruikbaar voor intrekken */ }
    const ra = kaart.querySelector('#tcAanvragen'), ru = kaart.querySelector('#tcUitnodig');
    if (!ra || !ru) return;      // intussen opnieuw getekend
    ra.innerHTML = htmlAanvragen(aanvragen);
    ru.innerHTML = htmlUitnodiging(uitnodiging);

    ra.querySelectorAll('[data-tc-maak]').forEach(b => b.onclick = async () => {
      const uid = b.dataset.tcMaak; b.disabled = true;
      try { await roep('beoordeelAanvraag', { clubId, uid, soort: 'trainco', besluit: 'goed' }); meld('Trainingscoördinator geaccepteerd'); await herlaadClub(); }
      catch(e){ b.disabled = false; meld('Accepteren mislukt: ' + (e.message || e.code)); }
    });
    ra.querySelectorAll('[data-tc-afwijs]').forEach(b => b.onclick = async () => {
      const uid = b.dataset.tcAfwijs, a = aanvragen.find(x => x.uid === uid), naam = naamKort(a?.naam);
      if (!confirm(`Aanmelding van ${naam} verwijderen?\n\nDe persoon krijgt geen toegang als trainingscoördinator. Hij kan zich opnieuw aanmelden met een nieuwe uitnodigingslink.`)) return;
      b.disabled = true;
      try { await roep('beoordeelAanvraag', { clubId, uid, soort: 'trainco', besluit: 'af' }); meld('Aanmelding verwijderd'); laad(); }
      catch(e){ b.disabled = false; meld('Verwijderen mislukt: ' + (e.message || e.code)); }
    });
    const maak = ru.querySelector('#tcMaakLink');
    if (maak) maak.onclick = async () => {
      maak.disabled = true;
      try { await roep('maakUitnodiging', { clubId, rol: 'trainco', geldigDagen: 30, maxGebruik: 3 }); laad(); }
      catch(e){ maak.disabled = false; meld('Link maken mislukt: ' + (e.message || e.code)); }
    };
    const kopie = ru.querySelector('#traincoKopieer');
    if (kopie) kopie.onclick = async () => {
      try { await navigator.clipboard.writeText(ru.querySelector('#traincoLink').textContent); meld('Link gekopieerd'); }
      catch(e){ meld('Kopiëren mislukt — selecteer de link handmatig'); }
    };
    const weg = ru.querySelector('#tcLinkIn');
    if (weg) weg.onclick = async () => {
      if (!confirm('Deze uitnodigingslink intrekken? Hij werkt daarna niet meer.')) return;
      weg.disabled = true;
      try { await roep('trekUitnodigingIn', { id: weg.dataset.id }); laad(); }
      catch(e){ weg.disabled = false; meld('Intrekken mislukt: ' + (e.message || e.code)); }
    };
  };
  /* na accepteren staat de nieuwe coördinator pas in het clubdocument als dat opnieuw is gelezen */
  const herlaadClub = async () => {
    try {
      const sn = await getDoc(doc(db, 'clubs', clubId));
      if (sn.exists()) for (const k of ['trainingscoordinatoren', 'trainingscoordinatorenInfo']) S.club[k] = sn.data()[k] || {};
    } catch(e){}
    api.herteken();
  };
  laad();
}

/* Een coach uit de club halen (Cloud Function verwijderLid: uit al zijn teams, de club en zijn rollen).
   Beheerders kunnen hier niet worden verwijderd. Vraagt eerst bevestiging. Geeft true terug bij gelukt. */
export async function verwijderCoach(uid, naam, teams){
  if (!S.club?.admins?.[S.user?.uid]) return false;
  if (uid === S.user.uid || S.club.admins?.[uid]) return false;
  const zijnTeams = (teams || []).filter(t => t.leden?.[uid] === true);
  const lijst = zijnTeams.length ? zijnTeams.map(t => t.naam).join(', ') : 'geen eigen team';
  if (!confirm(`${naam} verwijderen?\n\nTeams: ${lijst}\n\nHij verliest de toegang tot deze teams en de club. Dit kun je niet ongedaan maken, maar hij kan zich opnieuw aanmelden via een uitnodigingslink.`)) return false;
  try {
    await roep('verwijderLid', { clubId: S.club.id, uid });
    for (const t of zijnTeams){ if (t.leden) delete t.leden[uid]; if (t.ledenInfo) delete t.ledenInfo[uid]; }
    for (const k of ['leden', 'ledenInfo', 'trainingscoordinatoren', 'trainingscoordinatorenInfo']) if (S.club[k]) delete S.club[k][uid];
    for (const m of Object.values(S.club.bouwCoordinatoren || {})) if (m) delete m[uid];
    meld(naam + ' is verwijderd');
    return true;
  } catch(e){
    meld('Verwijderen mislukt: ' + (e.message || e.code));
    return false;
  }
}
