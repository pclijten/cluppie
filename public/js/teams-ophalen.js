/* Teams ophalen op id (club.teams, bouw-overzicht, uitleningen).
   Eén ontbrekend of onleesbaar team (bv. in de Firebase-console verwijderd, terwijl het nog
   in club.teams staat) liet de hele 'in'-query falen met permission-denied: zwart scherm.
   Nu: per blok van 30 de snelle query; faalt die, dan per team apart en worden de
   onleesbare overgeslagen. Ids van teams die echt niet (meer) bestaan staan in het resultaat .ontbreekt;
   onleesbare teams worden alleen overgeslagen. */
import { db, doc, getDoc, getDocs, query, collection, where, documentId } from './firebase.js?v=20261011g';

export async function teamsOpId(ids){
  const lijst = [...new Set((ids || []).filter(Boolean))];
  const uit = [], ontbreekt = [];
  for (let i = 0; i < lijst.length; i += 30){
    const blok = lijst.slice(i, i + 30);
    try {
      const snap = await getDocs(query(collection(db, 'teams'), where(documentId(), 'in', blok)));
      const gezien = new Set();
      snap.docs.forEach(d => { gezien.add(d.id); uit.push({ id: d.id, ...d.data() }); });
      /* uit de offline-cache kan een blok onvolledig zijn: dan niets als ontbrekend tellen */
      if (!snap.metadata.fromCache) blok.forEach(id => { if (!gezien.has(id)) ontbreekt.push(id); });
    } catch (e){
      if (e?.code !== 'permission-denied') throw e;
      const los = await Promise.all(blok.map(id =>
        getDoc(doc(db, 'teams', id))
          .then(s => s.exists() ? { id: s.id, ...s.data() } : (s.metadata.fromCache ? 'onbekend' : null))
          .catch(f => { console.warn('[Cluppie] team niet leesbaar', id, f?.code || f); return 'onbekend'; })));
      los.forEach((t, k) => { if (t === null) ontbreekt.push(blok[k]); else if (t !== 'onbekend') uit.push(t); });
    }
  }
  if (ontbreekt.length) console.warn('[Cluppie] teams niet gevonden of niet leesbaar:', ontbreekt.join(', '));
  uit.ontbreekt = ontbreekt;
  return uit;
}
