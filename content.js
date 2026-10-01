/* ==================== CONTENT (leercurve-teksten, ASV-kompas, gouden regels) ====================
   Doel: teksten uit het jeugdbeleidsplan (achtergrond + tips per leerthema, de
   roterende ASV-kompas-tips, de gouden regels) staan niet langer hardcoded in
   config.js, maar in de Firestore-collectie 'content'. Zo kan een tekst worden
   aangepast via het clubdashboard-tabblad "Content" (zie club-content.js),
   zonder ooit JS te hoeven aanpassen, valideren of opnieuw te uploaden.

   Schema per document in 'content':
     {
       categorie: 'leercurve' | 'kompas' | 'gouden-regel',
       thema:     alleen bij 'leercurve' — koppelt aan LEERCURVE in config.js
       tags:      string[]   — vrij, voor latere filtering/zoeken
       volgorde:  number     — bepaalt de weergavevolgorde
       status:    'concept' | 'gepubliceerd'
       titel:     string     — thema-naam / kompas-tekst / gouden-regeltekst
       achtergrond: string
       tips:      string[]
     }

   'concept'-content wordt NERGENS getoond behalve in het admin-tabblad zelf —
   zo kun je een tekst rustig schrijven zonder hem meteen aan coaches te tonen.

   content/seed.json bevat de oorspronkelijke teksten uit het jeugdbeleidsplan.
   Dat bestand dient als:
     (a) fallback zodat de app blijft werken vóórdat er iets in Firestore staat
         (bijv. een gloednieuw Firebase-testproject), en
     (b) brondata voor de knop "Seed content naar Firestore" in het
         admin-tabblad — een eenmalige, veilige migratie (bestaande content
         wordt nooit overschreven). */

import {
  db, collection, doc, setDoc, deleteDoc, getDocs, query, where, onSnapshot
} from './firebase.js?v=20260922c';
import { listenMet } from './state.js?v=20260929z';

/* [20260929c] CONTENT PER CLUB
   De collectie 'content' is de Cluppie-STANDAARD (gedeeld). Een club kan eigen
   teksten hebben in clubs/{clubId}/content (zelfde schema). Voorrang:
   - leercurve: per thema — een eigen tekst vervangt de standaard voor dat thema;
   - kompas en gouden-regel: heeft de club in die categorie eigen gepubliceerde
     items, dan vervangen die de hele standaardlijst; anders geldt de standaard.
   Een club kan de standaardteksten ook helemaal uitzetten (instellingen →
   Pedagogiek): dan zijn alleen de eigen teksten zichtbaar. Lezen van de eigen
   content faalt stil (console) zolang de Firestore-regels er nog niet voor zijn. */
let _clubEigen = [];
let _clubEigenId = null;
let _unsubClub = null;
let _gebruikStandaard = true;
export function zetContentClub(clubId, gebruikStandaard = true){
  _gebruikStandaard = gebruikStandaard !== false;
  if (_clubEigenId === clubId) return;
  if (_unsubClub){ try { _unsubClub(); } catch (e) {} _unsubClub = null; }
  _clubEigenId = clubId || null; _clubEigen = [];
  if (!clubId) return;
  _unsubClub = onSnapshot(
    query(collection(db, 'clubs', clubId, 'content'), where('status', '==', 'gepubliceerd')),
    snap => { _clubEigen = snap.docs.map(d => ({ id: d.id, ...d.data() })); try { document.dispatchEvent(new CustomEvent('clubcontent')); } catch (e) {} },
    err => console.info('[Cluppie] eigen clubcontent niet leesbaar (regels nog niet aangepast?):', err.code)
  );
}

let _gepubliceerd = [];   // wat coaches te zien krijgen (de Cluppie-standaard)
let _alles = [];          // incl. concepten — alleen gebruikt door het admin-tabblad
let _seedFallback = null; // lazy geladen content/seed.json, alleen als fallback

function sorteer(lijst){ return [...lijst].sort((a,b) => (a.volgorde||0) - (b.volgorde||0)); }

/* ---------- Live lezen (voor alle coaches) ---------- */
export function startContentListener(){
  return listenMet(
    query(collection(db,'content'), where('status','==','gepubliceerd')),
    snap => {
      _gepubliceerd = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      // Zodra er echte content is geladen heeft de fallback geen functie meer.
    },
    'content'
  );
}

/* Fallback: alleen gebruikt als de Firestore-collectie nog leeg is (bv. een
   gloednieuw Firebase-project waar nog niemand op "Seed content" heeft
   gedrukt). Zo staat de app nooit met lege leerlijn-/kompasteksten. */
async function laadFallbackIndienNodig(){
  if (_gepubliceerd.length || _seedFallback) return;
  try {
    const res = await fetch('./content/seed.json');
    _seedFallback = await res.json();
  } catch(e){
    console.error('[Cluppie] Kon content/seed.json niet laden:', e);
    _seedFallback = [];
  }
}

function standaardBron(){
  if (!_gebruikStandaard) return [];
  return _gepubliceerd.length ? _gepubliceerd : (_seedFallback || []);
}
function bron(){
  const std = standaardBron();
  if (!_clubEigen.length) return std;
  const eigenCats = new Set(_clubEigen.filter(c => c.categorie !== 'leercurve').map(c => c.categorie));
  const eigenThemas = new Set(_clubEigen.filter(c => c.categorie === 'leercurve').map(c => c.thema));
  const rest = std.filter(c => c.categorie === 'leercurve' ? !eigenThemas.has(c.thema) : !eigenCats.has(c.categorie));
  return rest.concat(_clubEigen);
}

export function contentVoorCategorie(categorie){
  laadFallbackIndienNodig();
  return sorteer(bron().filter(c => c.categorie === categorie));
}
export function contentVoorThema(thema){
  laadFallbackIndienNodig();
  return bron().find(c => c.categorie === 'leercurve' && c.thema === thema) || null;
}
export function kompasTips(){
  laadFallbackIndienNodig();
  return sorteer(bron().filter(c => c.categorie === 'kompas'));
}
export function goudenRegels(){
  laadFallbackIndienNodig();
  return sorteer(bron().filter(c => c.categorie === 'gouden-regel')).map(c => c.titel);
}

/* ---------- Admin-tabblad: alle content, incl. concepten ----------
   scope 'club'   = de eigen teksten van de club (clubs/{clubId}/content)
   scope 'globaal' = de Cluppie-standaard (alleen platformbeheerder) */
const contentCol = (scope, clubId) => scope === 'club' ? collection(db, 'clubs', clubId, 'content') : collection(db, 'content');
export function startContentAdminListener(onData, scope = 'globaal', clubId = null){
  return listenMet(contentCol(scope, clubId), snap => {
    _alles = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    onData(_alles);
  }, 'content (beheer)');
}

export async function opslaanContent(id, data, scope = 'globaal', clubId = null){
  await setDoc(doc(contentCol(scope, clubId), id), data, { merge:true });
}
export async function verwijderContent(id, scope = 'globaal', clubId = null){
  await deleteDoc(doc(contentCol(scope, clubId), id));
}

/* Begin met een eigen kopie van de standaardteksten (bestaande eigen teksten blijven staan). */
export async function kopieerStandaardNaarClub(clubId){
  let bronLijst = [];
  try { const snap = await getDocs(collection(db, 'content')); bronLijst = snap.docs.map(d => ({ id:d.id, ...d.data() })); } catch (e) {}
  if (!bronLijst.length){ const res = await fetch('./content/seed.json'); bronLijst = await res.json(); }
  const eigen = await getDocs(collection(db, 'clubs', clubId, 'content'));
  const bestaand = new Set(eigen.docs.map(d => d.id));
  let geschreven = 0;
  for (const item of bronLijst){
    if (bestaand.has(item.id)) continue;
    const { id, ...rest } = item;
    await setDoc(doc(db, 'clubs', clubId, 'content', id), rest);
    geschreven++;
  }
  return { geschreven };
}

/* Eenmalige migratie: schrijft content/seed.json naar Firestore. Bestaande
   documenten (zelfde id) worden overgeslagen, dus dit kan zonder risico
   meerdere keren ingedrukt worden — handig bij een nieuw testproject. */
export async function seedContentNaarFirestore(){
  const res = await fetch('./content/seed.json');
  const seed = await res.json();
  let geschreven = 0, overgeslagen = 0;
  for (const item of seed){
    if (_alles.some(c => c.id === item.id)){ overgeslagen++; continue; }
    await setDoc(doc(db,'content', item.id), item);
    geschreven++;
  }
  return { geschreven, overgeslagen };
}
