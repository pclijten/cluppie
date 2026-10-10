/* ====================================================================
   PLATFORM — overzicht van alle clubs (alleen platformbeheerder)
   Leest clubs/ en aanvragen/ zonder filter; de Firestore-regels laten dat
   alleen de platformbeheerder toe. Voor een club openen: openClub() (de
   regels geven de platformbeheerder daar volledige rechten).
==================================================================== */
import { db, collection, getDocs } from './firebase.js?v=20260922c';
import { S, esc, meld, openModal, sluitModal, isPlatformBeheerder } from './state.js?v=20261010c';
import { logoImgVoorDoc } from './clubconfig.js?v=20261010c';

const telKeys = o => Object.keys(o || {}).length;
const datum = t => {
  try { const d = t && t.toDate ? t.toDate() : null; return d ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  catch (e) { return ''; }
};

export async function openPlatform(){
  if (!isPlatformBeheerder()) return;
  openModal('<h2>Alle clubs</h2><div class="kaart leeg">Clubs laden…</div>');
  let clubs = [], aanvragen = {};
  try {
    const [cs, as] = await Promise.all([ getDocs(collection(db, 'clubs')), getDocs(collection(db, 'aanvragen')) ]);
    clubs = cs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
    as.docs.forEach(d => { const c = d.data().clubId; if (c) aanvragen[c] = (aanvragen[c] || 0) + 1; });
  } catch (e) {
    console.error('[Cluppie] Platformoverzicht kon niet laden:', e.code, e.message);
    openModal('<h2>Alle clubs</h2><div class="kaart leeg">Laden mislukt' + (e.code === 'permission-denied' ? ': je account heeft geen platformrechten (e-mailadres geverifieerd?).' : '.') + '</div>');
    return;
  }
  const totTeams = clubs.reduce((n, c) => n + telKeys(c.teams), 0);
  const totLeden = clubs.reduce((n, c) => n + telKeys(c.leden), 0);
  const totWacht = Object.values(aanvragen).reduce((n, x) => n + x, 0);
  const rij = c => {
    const w = aanvragen[c.id] || 0;
    const plaats = c.instellingen && c.instellingen.locatie && c.instellingen.locatie.plaats;
    const meta = [telKeys(c.teams) + ' teams', telKeys(c.leden) + ' leden', telKeys(c.admins) + ' admin' + (telKeys(c.admins) === 1 ? '' : 's'), plaats, datum(c.gemaakt) && ('sinds ' + datum(c.gemaakt))].filter(Boolean).join(' · ');
    return `<button class="lijst-item" data-platform-club="${esc(c.id)}">
      <div class="club-shirt">${logoImgVoorDoc(c, 'club-schild')}</div>
      <div class="li-tekst"><div class="titel">${esc(c.naam || 'Club zonder naam')}${w ? ` <span class="club-badge">${w} wacht${w === 1 ? '' : 'en'}</span>` : ''}</div>
      <div class="meta">${esc(meta)}</div></div><span class="pijl">›</span></button>`;
  };
  openModal(`<h2>Alle clubs</h2>
    <p class="cb-uitleg" style="margin:0 0 12px">${clubs.length} club${clubs.length === 1 ? '' : 's'} · ${totTeams} teams · ${totLeden} leden · ${totWacht} aanvra${totWacht === 1 ? 'ag' : 'gen'} in behandeling</p>
    ${clubs.length ? clubs.map(rij).join('') : '<div class="kaart leeg">Er zijn nog geen clubs.</div>'}`);
  document.querySelectorAll('[data-platform-club]').forEach(b => b.onclick = () => {
    const id = b.dataset.platformClub;
    sluitModal();
    import('./club.js?v=20261010c').then(m => m.openClub(id)).catch(e => meld('Club openen mislukt'));
  });
}
