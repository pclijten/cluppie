/* ==================== SEIZOENSTRAININGEN → TABBLAD TRAININGEN [20261018a] ====================
   Het seizoensplan (per team of clubbreed) wordt als trainingsdocumenten in de collectie
   `trainingen` geschreven, zodat de trainingen op het tabblad Trainingen van het team staan.

   Per training één document (zie trainingDocs in seizoensplan-club.js) met vaste id's, dus
   opnieuw opslaan overschrijft in plaats van dupliceert. Documenten van een eerdere versie van
   hetzelfde plan (bron 'seizoensplan', zelfde seizoensplanId) die niet meer in het plan zitten,
   worden verwijderd. Handmatige trainingen (bron niet 'seizoensplan') blijven altijd staan.
   [20261111d] Al zichtbare en door de coach aangepaste trainingen blijven ook staan (uitrolPlan). */
import { db, collection, doc, getDocs, query, where, writeBatch, serverTimestamp } from './firebase.js?v=20261011g';
import { trainingDocs, uitrolPlan } from './seizoensplan-club.js?v=20261113b';

const vandaagIso = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };

/* [20261111d] Waar de trainingen van een team staan: bij een club in `trainingen` (met club-veld),
   zonder club onder het team zelf (teams/{id}/trainingen, valt onder de bestaande team-rule). */
export function trainingenRef(team, id){
  return team.club ? doc(db, 'trainingen', id) : doc(db, 'teams', team.id, 'trainingen', id);
}
export async function bestaandeTrainingen(team){
  const snap = team.club
    ? await getDocs(query(collection(db, 'trainingen'), where('club', '==', team.club), where('teams', 'array-contains', team.id)))
    : await getDocs(collection(db, 'teams', team.id, 'trainingen'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
/* ops = [{ soort:'set'|'del', ref, data? }] in batches van 400 */
export async function voerUit(ops){
  for (let i = 0; i < ops.length; i += 400){
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach(o => o.soort === 'set' ? batch.set(o.ref, o.data, { merge: true }) : batch.delete(o.ref));
    await batch.commit();
  }
}

/* plan = { kal, blokken, params } zoals het teamplan of planVoorTeam die levert.
   team = { id, categorie, club?, trainingsdagen? }. Geeft { geschreven, verwijderd, behouden, meldingen }. */
export async function zetSeizoenTrainingen({ plan, team, planId, planVersie = 1, vormen, aantalSpelers = 12, vervangt }){
  const { docs, meldingen } = trainingDocs({ plan, team, clubId: team.club || null, planId, planVersie, vormen, aantalSpelers });
  const bestaand = await bestaandeTrainingen(team);
  const r = uitrolPlan({ nieuw: docs, bestaande: bestaand, planId, vandaag: vandaagIso(), vervangt });
  await voerUit([
    ...r.schrijf.map(d => ({ soort: 'set', ref: trainingenRef(team, d.id), data: { ...d, gemaakt: serverTimestamp() } })),
    ...r.verwijder.map(d => ({ soort: 'del', ref: trainingenRef(team, d.id) })),
  ]);
  return { geschreven: r.schrijf.length, verwijderd: r.verwijder.length, behouden: r.vast.length, meldingen };
}
