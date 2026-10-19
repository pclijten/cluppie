/* ==================== SEIZOENSOVERGANG-ASSISTENT (20261011d) ====================
   Elke zomer schuiven alle jeugdspelers een leeftijdscategorie door. Deze assistent doet
   dat in één keer voor de hele club:
     1. nieuw seizoen + startdatum kiezen
     2. per team de bestemming kiezen (standaard: zelfde teamnummer in de volgende categorie),
        per speler aan te passen (blijft · ander team · verlaat de club); coaches kunnen meegaan
     3. uitvoeren: elke speler verhuist met zijn bevroren dossier (verhuisSpelersSeizoen,
        zelfde mechanisme als definitief overzetten), het origineel blijft gearchiveerd bewaard
     4. het seizoenslabel van de club gaat naar het nieuwe seizoen
   Geen geboortedata nodig (die slaat Cluppie bewust niet op): de coördinator beslist per speler
   bij categorieën die twee jaar beslaan.
   PURE helpers (getest in tests/seizoen.test.mjs): volgendeCategorie, standaardBestemming. */

import { db, doc, getDocs, collection, updateDoc, deleteField } from './firebase.js?v=20261011g';
import { S, esc, meld, openModal, sluitModal } from './state.js?v=20261011g';
import { verhuisSpelersSeizoen } from './teams-spelers.js?v=20261019h';

const BLIJFT = '__blijft', WEG = '__weg';

/* Leeftijd uit een categorie: JO11 → 11, MO15 → 15; Senioren/Vrouwen → 99; onbekend → null. */
function leeftijd(cat){
  const m = String(cat || '').toUpperCase().match(/^[JM]O(\d{1,2})$/);
  if (m) return Number(m[1]);
  return /^(senioren|vrouwen)$/i.test(String(cat || '')) ? 99 : null;
}
const meidenCat = cat => /^MO|^vrouwen$/i.test(String(cat || ''));
const teamNr = naam => { const m = String(naam || '').match(/-(\d+)\b/); return m ? Number(m[1]) : 1; };

/* De eerstvolgende categorie die de club echt heeft (zelfde jongens/meiden), of null. */
export function volgendeCategorie(cat, aanwezigeCats){
  const l = leeftijd(cat);
  if (l == null || l === 99) return null;
  const kandidaten = [...new Set(aanwezigeCats)].filter(c => meidenCat(c) === meidenCat(cat) && leeftijd(c) != null && leeftijd(c) > l && leeftijd(c) !== 99)
    .sort((a, b) => leeftijd(a) - leeftijd(b));
  return kandidaten[0] || null;
}
/* Bestemming voor een heel team: zelfde teamnummer in de volgende categorie, anders het laagste nummer. */
export function standaardBestemming(team, teams){
  const volgende = volgendeCategorie(team.categorie, teams.map(t => t.categorie));
  if (!volgende) return BLIJFT;
  const opties = teams.filter(t => t.categorie === volgende && t.id !== team.id).sort((a, b) => teamNr(a.naam) - teamNr(b.naam));
  return (opties.find(t => teamNr(t.naam) === teamNr(team.naam)) || opties[0] || {}).id || BLIJFT;
}

function volgendSeizoen(huidig){
  const m = /^(\d{4})/.exec(huidig || '');
  const jaar = m ? Number(m[1]) + 1 : new Date().getFullYear();
  return `${jaar}/'${String(jaar + 1).slice(-2)}`;
}

export async function modalSeizoensovergang(teams, naKlaar){
  const huidig = S.club.huidigSeizoen || '';
  const nieuw = volgendSeizoen(huidig);
  const W = { stap: 1, seizoen: nieuw, datum: `${nieuw.slice(0, 4)}-08-01`, plan: {}, spelers: {}, coachesMee: {}, open: null };
  const jeugd = teams.filter(t => leeftijd(t.categorie) != null).sort((a, b) => (leeftijd(a.categorie) - leeftijd(b.categorie)) || a.naam.localeCompare(b.naam, 'nl', { numeric: true }));
  const naamVan = id => id === BLIJFT ? 'Blijft in dit team' : id === WEG ? 'Verlaat de club' : (teams.find(t => t.id === id)?.naam || '?');
  const opties = (gekozen, eigenId) => [`<option value="${BLIJFT}" ${gekozen === BLIJFT ? 'selected' : ''}>Blijft in dit team</option>`]
    .concat(jeugd.filter(t => t.id !== eigenId).map(t => `<option value="${esc(t.id)}" ${gekozen === t.id ? 'selected' : ''}>${esc(t.naam)}</option>`))
    .concat([`<option value="${WEG}" ${gekozen === WEG ? 'selected' : ''}>Verlaat de club</option>`]).join('');

  const laadSpelers = async () => {
    openModal('<h2>Seizoensovergang</h2><div class="kaart leeg">Spelers laden…</div>');
    for (const t of jeugd){
      const s = await getDocs(collection(db, 'teams', t.id, 'spelers'));
      W.spelers[t.id] = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.gearchiveerd && !p.gast)
        .sort((a, b) => String(a.naam || '').localeCompare(String(b.naam || ''), 'nl'));
      const dest = standaardBestemming(t, jeugd);
      W.plan[t.id] = Object.fromEntries(W.spelers[t.id].map(p => [p.id, dest]));
    }
  };

  const teken = () => {
    if (W.stap === 1){
      openModal(`<h2>Seizoensovergang</h2>
        <p class="cb-uitleg">Schuif alle jeugdspelers in één keer door naar hun team van volgend seizoen. Elke speler neemt zijn geschiedenis mee (wedstrijden, speeltijd, beoordelingen, aanwezigheid, leerpunten). Het oude team bewaart hem als gearchiveerde speler, er gaat niets verloren.</p>
        <div class="rij">
          <div class="veldgroep" style="flex:1"><label>Nieuw seizoen</label><input class="invoer" id="soSeizoen" value="${esc(W.seizoen)}" maxlength="12"></div>
          <div class="veldgroep" style="flex:1"><label>Telt mee vanaf</label><input class="invoer" id="soDatum" type="date" value="${esc(W.datum)}"></div>
        </div>
        <p class="cb-uitleg">Zorg dat de teams van volgend seizoen al bestaan (Club → Teams, of in één keer uit Sportlink). Lege teams mogen.</p>
        <button class="knop vol" id="soVerder">Verder: per team kiezen</button>`);
      document.getElementById('soVerder').onclick = async () => {
        W.seizoen = document.getElementById('soSeizoen').value.trim(); W.datum = document.getElementById('soDatum').value;
        if (!/^\d{4}\/'\d{2}$/.test(W.seizoen)) return meld("Seizoen als 2027/'28");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(W.datum)) return meld('Kies een datum');
        if (!Object.keys(W.spelers).length) await laadSpelers();
        W.stap = 2; teken();
      };
      return;
    }
    if (W.stap === 2){
      const kaarten = jeugd.map(t => {
        const sp = W.spelers[t.id] || [], plan = W.plan[t.id] || {};
        const telling = {}; for (const p of sp) telling[plan[p.id]] = (telling[plan[p.id]] || 0) + 1;
        const samenvatting = Object.entries(telling).map(([d, n]) => `${n} → ${esc(naamVan(d))}`).join(' · ') || 'geen spelers';
        const eenDoel = Object.keys(telling).length === 1 ? Object.keys(telling)[0] : null;
        const coaches = Object.entries(t.ledenInfo || {}).filter(([u]) => t.leden?.[u] && !S.club.admins?.[u]);
        return `<div class="so-team ${W.open === t.id ? 'open' : ''}">
          <div class="so-kop">
            <button class="so-naam" data-so-open="${esc(t.id)}"><b>${esc(t.naam)}</b><small>${sp.length} speler${sp.length === 1 ? '' : 's'} · ${samenvatting}</small></button>
            <select class="invoer so-doel" data-so-team="${esc(t.id)}" ${sp.length ? '' : 'disabled'}><option value="">per speler…</option>${opties(eenDoel, t.id)}</select>
          </div>
          ${coaches.length && eenDoel && eenDoel !== BLIJFT && eenDoel !== WEG ? `<label class="ci-schakel so-coach"><input type="checkbox" data-so-coach="${esc(t.id)}" ${W.coachesMee[t.id] ? 'checked' : ''}><span>Coaches gaan mee naar ${esc(naamVan(eenDoel))} (${coaches.map(([, i]) => esc(i.naam || 'coach')).join(', ')})</span></label>` : ''}
          ${W.open === t.id ? `<div class="so-spelers">${sp.map(p => `
            <div class="so-speler"><span>${esc(p.naam || 'Speler')}${p.nummer != null ? ` <small>#${esc(p.nummer)}</small>` : ''}</span>
              <select class="invoer" data-so-speler="${esc(t.id)}|${esc(p.id)}">${opties(plan[p.id], t.id)}</select></div>`).join('')}</div>` : ''}
        </div>`;
      }).join('');
      const totaal = jeugd.reduce((n, t) => n + Object.values(W.plan[t.id] || {}).filter(d => d !== BLIJFT).length, 0);
      openModal(`<h2>Seizoensovergang ${esc(W.seizoen)}</h2>
        <p class="cb-uitleg" style="margin:0 0 10px">Standaard gaat elk team naar hetzelfde teamnummer in de volgende categorie. Tik op een team om per speler te kiezen, bijvoorbeeld bij een categorie van twee jaar.</p>
        ${kaarten || '<div class="kaart leeg">Geen jeugdteams gevonden.</div>'}
        <div class="rij" style="margin-top:12px"><button class="knop licht vol" id="soTerug">Terug</button>
          <button class="knop vol" id="soVerder" ${totaal ? '' : 'disabled'}>Controleren (${totaal} verhuizing${totaal === 1 ? '' : 'en'})</button></div>`);
      const m = document.getElementById('modalInhoud');
      m.querySelectorAll('[data-so-open]').forEach(b => b.onclick = () => { W.open = W.open === b.dataset.soOpen ? null : b.dataset.soOpen; teken(); });
      m.querySelectorAll('[data-so-team]').forEach(s => s.onchange = () => {
        if (!s.value) return;
        const t = s.dataset.soTeam; for (const pid of Object.keys(W.plan[t] || {})) W.plan[t][pid] = s.value; teken();
      });
      m.querySelectorAll('[data-so-speler]').forEach(s => s.onchange = () => { const [t, p] = s.dataset.soSpeler.split('|'); W.plan[t][p] = s.value; teken(); });
      m.querySelectorAll('[data-so-coach]').forEach(c => c.onchange = () => { W.coachesMee[c.dataset.soCoach] = c.checked; });
      document.getElementById('soTerug').onclick = () => { W.stap = 1; teken(); };
      document.getElementById('soVerder').onclick = () => { W.stap = 3; teken(); };
      return;
    }
    if (W.stap === 3){
      const regels = jeugd.map(t => {
        const telling = {}; for (const d of Object.values(W.plan[t.id] || {})) if (d !== BLIJFT) telling[d] = (telling[d] || 0) + 1;
        const r = Object.entries(telling).map(([d, n]) => `${n} naar ${esc(naamVan(d))}`).join(', ');
        return r ? `<li><b>${esc(t.naam)}</b>: ${r}${W.coachesMee[t.id] ? ' (coaches gaan mee)' : ''}</li>` : '';
      }).join('');
      openModal(`<h2>Klaar om door te schuiven?</h2>
        <ul class="vo-punten">${regels}</ul>
        <p class="cb-uitleg">Daarna staat het seizoen van de club op <b>${esc(W.seizoen)}</b>. Spelers tellen bij hun nieuwe team mee vanaf ${esc(new Date(W.datum).toLocaleDateString('nl-NL'))}. Het oude team houdt ze als gearchiveerde speler, zodat oude wedstrijden kloppen.</p>
        <div class="rij"><button class="knop licht vol" id="soTerug">Terug</button><button class="knop fluo vol" id="soUitvoeren">Doorschuiven</button></div>`);
      document.getElementById('soTerug').onclick = () => { W.stap = 2; teken(); };
      document.getElementById('soUitvoeren').onclick = () => voerUit();
    }
  };

  const voerUit = async () => {
    const taken = jeugd.map(t => ({ t, verhuizingen: Object.entries(W.plan[t.id] || {}).filter(([, d]) => d !== BLIJFT)
      .map(([spelerId, d]) => ({ spelerId, naarTeam: d === WEG ? null : d, naarTeamNaam: d === WEG ? null : naamVan(d) })) })).filter(x => x.verhuizingen.length);
    const totaal = taken.reduce((n, x) => n + x.verhuizingen.length, 0);
    let klaar = 0; const fouten = [];
    const toon = () => openModal(`<h2>Bezig met doorschuiven</h2><div class="sl-balk"><span style="width:${Math.round(100 * klaar / Math.max(1, totaal))}%"></span></div>
      <p class="cb-uitleg">${klaar} van ${totaal} spelers. Laat dit scherm open.</p>`);
    toon();
    for (const { t, verhuizingen } of taken){
      try {
        const r = await verhuisSpelersSeizoen({ clubId: S.clubId, vanTeam: t.id, vanTeamNaam: t.naam, verhuizingen, datum: W.datum,
          opVoortgang: x => { klaar = taken.slice(0, taken.findIndex(y => y.t === t)).reduce((n, y) => n + y.verhuizingen.length, 0) + x.gelukt + x.mislukt.length; toon(); } });
        fouten.push(...r.mislukt.map(f => ({ ...f, team: t.naam })));
        const doel = verhuizingen[0]?.naarTeam;
        if (W.coachesMee[t.id] && doel && verhuizingen.every(v => v.naarTeam === doel)){
          const coaches = Object.keys(t.leden || {}).filter(u => !S.club.admins?.[u]);
          const naar = {}, van = {};
          for (const u of coaches){ naar[`leden.${u}`] = true; naar[`ledenInfo.${u}`] = (t.ledenInfo || {})[u] || { naam: 'Coach' }; van[`leden.${u}`] = deleteField(); van[`ledenInfo.${u}`] = deleteField(); }
          if (coaches.length){ await updateDoc(doc(db, 'teams', doel), naar); await updateDoc(doc(db, 'teams', t.id), van); }
        }
      } catch (e){ fouten.push({ team: t.naam, fout: e.code || e.message }); }
    }
    try { await updateDoc(doc(db, 'clubs', S.clubId), { huidigSeizoen: W.seizoen }); } catch (e){ fouten.push({ team: 'club', fout: 'seizoen niet opgeslagen: ' + (e.code || e.message) }); }
    openModal(`<h2>${fouten.length ? 'Bijna klaar' : 'Klaar voor ' + esc(W.seizoen)}</h2>
      <p class="cb-uitleg">${totaal - fouten.filter(f => f.spelerId).length} van ${totaal} spelers zitten in hun nieuwe team.${fouten.length ? ' Wat niet lukte kun je veilig opnieuw doen: al verhuisde spelers worden overgeslagen.' : ''}</p>
      ${fouten.length ? `<ul class="vo-punten">${fouten.slice(0, 12).map(f => `<li>${esc(f.team)}: ${esc(f.fout)}</li>`).join('')}</ul>` : ''}
      <button class="knop vol" id="soSluit">Sluiten</button>`);
    document.getElementById('soSluit').onclick = () => { sluitModal(); if (naKlaar) naKlaar(); };
  };
  teken();
}
