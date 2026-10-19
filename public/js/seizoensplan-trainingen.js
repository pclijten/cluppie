/* ==================== SEIZOENSTRAININGEN → TABBLAD TRAININGEN [20261018a] ====================
   Het seizoensplan (per team of clubbreed) wordt als trainingsdocumenten in de collectie
   `trainingen` geschreven, zodat de trainingen op het tabblad Trainingen van het team staan.

   Per training één document (zie trainingDocs in seizoensplan-club.js) met vaste id's, dus
   opnieuw opslaan overschrijft in plaats van dupliceert. Documenten van een eerdere versie van
   hetzelfde plan (bron 'seizoensplan', zelfde seizoensplanId) die niet meer in het plan zitten,
   worden verwijderd. Handmatige trainingen (bron niet 'seizoensplan') blijven altijd staan. */
import { db, collection, doc, getDocs, query, where, writeBatch, serverTimestamp } from './firebase.js?v=20261011g';
import { trainingDocs } from './seizoensplan-club.js?v=20261019a';

/* plan = { kal, blokken, params } zoals het teamplan of planVoorTeam die levert.
   team = { id, categorie }. Geeft { geschreven, verwijderd, meldingen }. */
export async function zetSeizoenTrainingen({ plan, team, clubId, planId, planVersie = 1, vormen, aantalSpelers = 12 }){
  const { docs, meldingen } = trainingDocs({ plan, team, clubId, planId, planVersie, vormen, aantalSpelers });
  const bestaand = await getDocs(query(collection(db, 'trainingen'), where('club', '==', clubId), where('teams', 'array-contains', team.id)));
  const nieuw = new Set(docs.map(d => d.id));
  const weg = bestaand.docs.filter(d => { const x = d.data(); return x.bron === 'seizoensplan' && x.seizoensplanId === planId && !nieuw.has(d.id); });
  for (let i = 0; i < docs.length; i += 400){
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach(d => batch.set(doc(db, 'trainingen', d.id), { ...d, gemaakt: serverTimestamp() }, { merge: true }));
    await batch.commit();
  }
  for (let i = 0; i < weg.length; i += 400){
    const batch = writeBatch(db);
    weg.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return { geschreven: docs.length, verwijderd: weg.length, meldingen };
}
