/* ==================== ACTIVITEITEN BIJ HET TEAM [20261125x] ====================
   De kant van de coach: clubactiviteiten waar het eigen team aan meedoet, in de Planning.
   Bron: clubs/{clubId}/activiteitenAgenda/{actId} (alleen naam, datum, tijd, locatie, plan B en de
   vrijwilligerslink; het comité zet hem aan in Activiteiten › Deelnemers). Elk clublid mag lezen.

   Met één knop maakt de coach een deelnemerslijstje (Lijstjes, sjabloon 'aanwezig') voor zijn team.
   Dit bestand importeert niets uit teams.js (geen kringverwijzing): teams.js geeft openLijst mee. */
import { db, collection, addDoc, query, where, onSnapshot } from './firebase.js?v=20261011g';
import { S, esc, meld, openModal, sluitModal } from './state.js?v=20261130d';

/* luisteren zolang het team open is; stop() via S.unsub.activiteiten (stopUnsubs in teams.js) */
export function luisterActiviteiten(teamId, clubId, klaar){
  S._activiteiten = [];
  if (!teamId || !clubId) return () => {};
  return onSnapshot(query(collection(db, 'clubs', clubId, 'activiteitenAgenda'), where('teams', 'array-contains', teamId)), snap => {
    S._activiteiten = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.datum);
    klaar?.();
  }, () => { S._activiteiten = []; });   /* rules nog niet gepubliceerd of Activiteiten uit: stil, niets tonen */
}

export function activiteitPlanningItems(){
  return (S._activiteiten || []).filter(a => a && a.datum && a.status !== 'geannuleerd').map(a => ({
    bron: 'activiteit', docId: a.id, datum: a.datum, type: 'club', label: a.naam || 'Clubactiviteit',
    opmerking: [a.start ? a.start + (a.eind ? '–' + a.eind : '') : '', a.locatie || '', a.planB ? 'Plan B' : '', a.link ? 'helpers gezocht' : ''].filter(Boolean).join(' · '),
    aangepast: false, tijd: a.start || '',
  }));
}

export function openActiviteitVoorTeam(id, { openLijst, zetTeamTab } = {}){
  const a = (S._activiteiten || []).find(x => x.id === id);
  if (!a) return;
  const datum = new Date(a.datum + 'T12:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  const lijst = (S._lijsten || []).find(l => l.activiteit === id && !l.gearchiveerd);
  const wa = a.link ? 'https://wa.me/?text=' + encodeURIComponent(`${a.naam} op ${datum}: we zoeken nog helpers! Schrijf je in: ${a.link}`) : '';
  openModal(`<h2>${esc(a.naam)}</h2>
    <p class="sub">${esc([datum, a.start ? a.start + (a.eind ? '–' + a.eind : '') : '', a.locatie].filter(Boolean).join(' · '))}</p>
    ${a.planB ? `<div class="kaart" style="border-left:4px solid var(--uit)"><b>Plan B:</b> ${esc(a.planB)}</div>` : ''}
    ${a.omschrijving ? `<p style="white-space:pre-line">${esc(a.omschrijving)}</p>` : ''}
    <p class="sub">Een clubactiviteit van ${esc(a.clubNaam || 'de club')}. Het comité regelt de organisatie; jij regelt wie er van je team meedoet.</p>
    <div class="knoppen" style="display:flex;flex-direction:column;gap:8px">
      ${lijst ? '<button class="knop vol" id="acTLijst">Deelnemerslijstje openen</button>' : (S.team?.leden?.[S.user?.uid] === true ? '<button class="knop vol" id="acTMaak">Deelnemerslijstje maken</button>' : '')}
      ${wa ? `<a class="knop" href="${esc(wa)}" target="_blank" rel="noopener">Helpers zoeken via WhatsApp</a>` : ''}
      <button class="knop licht" id="acTDicht">Sluiten</button></div>`);
  document.getElementById('acTDicht')?.addEventListener('click', sluitModal);
  document.getElementById('acTLijst')?.addEventListener('click', () => { sluitModal(); openLijst?.(lijst.id, zetTeamTab); });
  document.getElementById('acTMaak')?.addEventListener('click', async () => {
    try {
      const data = { naam: a.naam.slice(0, 60), sjabloon: 'aanwezig', rijen: 'spelers',
        kolommen: [{ id: 'mee', naam: 'Doet mee', type: 'check' }, { id: 'opm', naam: 'Opmerking', type: 'tekst', optioneel: true }],
        waarden: {}, inPlanning: false, gearchiveerd: false, datum: a.datum, ...(a.start ? { tijd: a.start } : {}), activiteit: id,
        seizoen: S.huidigSeizoen || '', gemaaktDoor: S.user?.uid || '', gemaaktMs: Date.now(), bijgewerktMs: Date.now() };
      const ref = await addDoc(collection(db, 'teams', S.teamId, 'lijsten'), data);
      S._lijsten = [...(S._lijsten || []).filter(x => x.id !== ref.id), { id: ref.id, ...data }];
      sluitModal(); meld('Lijstje gemaakt');
      openLijst?.(ref.id, zetTeamTab);
    } catch (e){ console.error('[activiteiten] lijstje', e); meld('Het lijstje maken lukte niet.'); }
  });
}
