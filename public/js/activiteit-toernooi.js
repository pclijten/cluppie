/* ==================== ACTIVITEITEN › TOERNOOI [20261125n] ====================
   De toernooiplanner in een activiteit (tab Toernooi): velden en veldjes, poules, spelers inlezen,
   teams indelen (zelf of met een voorstel op team, leeftijd en geslacht), wie bij welk team mag,
   het speelschema over de velden, kleedkamers, uitslagen en stand. Alles exporteerbaar.

   Koppelingen met de club: de velden komen uit de veldkaart (clubs/{id}/sportparken/eigen), de
   kleedkamers en trainingen uit de Veldplanner (veldplanner/instellingen, veldroosters/basis). Wie die
   niet mag lezen (een comitélid zonder beheerrechten) vult velden en kleedkamers zelf in.
   Spelers uit Cluppie-teams: teams/{id}/spelers (alleen wie die mag lezen; anders CSV of plakken).

   Opslag: veld `toernooi` in de activiteit (zie toernooi-logica.js). Geen rules-wijziging nodig.
   Dit bestand krijgt alles van activiteiten.js via ctx en importeert dat bestand niet. */
import { db, doc, collection, getDoc, getDocs, setDoc, deleteField } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261125w';
import { ico } from './icons.js?v=20261116t';
import * as T from './toernooi-logica.js?v=20261125v';

const opt = (w, t, sel) => `<option value="${esc(w)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
const SUB = [['opzet', 'Opzet'], ['spelers', 'Spelers'], ['teams', 'Teams'], ['schema', 'Schema'], ['kk', 'Kleedkamers'], ['uitslagen', 'Uitslagen'], ['live', 'Live']];
const st = { sub: 'opzet', zoek: '', gekozen: '', teamFilter: '', club: null, clubLaden: null, voorstel: null };

/* ---------- clubgegevens (velden, kleedkamers, trainingen) ---------- */
async function laadClub(clubId){
  if (st.club?.clubId === clubId) return st.club;
  if (st.clubLaden) return st.clubLaden;
  st.clubLaden = (async () => {
    const lees = async (...pad) => { try { const s = await getDoc(doc(db, ...pad)); return s.exists() ? s.data() : null; } catch { return null; } };
    const [park, inst, rooster] = await Promise.all([lees('clubs', clubId, 'sportparken', 'eigen'), lees('clubs', clubId, 'veldplanner', 'instellingen'), lees('clubs', clubId, 'veldroosters', 'basis')]);
    st.club = { clubId, velden: (park?.velden || []).filter(v => v && v.id).map(v => ({ id: String(v.id), naam: String(v.naam || 'Veld') })),
      kk: Array.isArray(inst?.kleedkamers) ? inst.kleedkamers.filter(k => k && k.id).map(k => ({ id: String(k.id), naam: String(k.naam || 'Kleedkamer') })) : [],
      blokken: Array.isArray(rooster?.blokken) ? rooster.blokken : [] };
    st.clubLaden = null;
    return st.club;
  })();
  return st.clubLaden;
}

/* ---------- tekenen ---------- */
export function htmlToernooi(ctx){
  const a = ctx.act, t = a.toernooi || {};
  if (!st.club && !st.clubLaden) laadClub(ctx.clubId).then(() => ctx.herteken());
  const inhoud = { opzet: htmlOpzet, spelers: htmlSpelers, teams: htmlTeams, schema: htmlSchema, kk: htmlKk, uitslagen: htmlUitslagen, live: htmlLive }[st.sub] || htmlOpzet;
  const nT = Object.keys(t.teams || {}).length, nS = Object.keys(t.spelers || {}).length, nW = (t.schema || []).length;
  return `<div class="ac-balkje"><div class="ac-schakel tn-sub">${SUB.map(([id, n]) => `<button class="${st.sub === id ? 'aan' : ''}" data-tn="sub" data-id="${id}">${n}</button>`).join('')}</div></div>
    <p class="ac-zacht">${[`${Object.keys(t.velden || {}).length} ${Object.keys(t.velden || {}).length === 1 ? 'veld' : 'velden'}`, `${nS} spelers`, `${nT} teams`, nW ? `${nW} wedstrijden, ${T.gespeeld(t)} gespeeld` : 'nog geen schema'].join(' · ')}</p>
    ${inhoud(ctx, a, t)}`;
}
const veld = (pad, waarde, { type = 'text', ph = '', klasse = '', extra = '' } = {}) =>
  `<input class="ac-in ${klasse}" type="${type}" data-veld="toernooi.${esc(pad)}" value="${esc(waarde ?? '')}" placeholder="${esc(ph)}" ${extra}>`;
const getal = (pad, waarde, extra = '') => veld(pad, waarde, { type: 'number', klasse: 'getal', extra: `data-num inputmode="numeric" ${extra}` });
const naamTeam = (t, id) => t.teams?.[id]?.naam || '?';
const kleurPoule = (t, id) => t.poules?.[id]?.kleur || '#999';

function htmlOpzet(ctx, a, t){
  const o = T.opzet(t), vj = T.veldjes(t), club = st.club;
  const velden = T.gesorteerd(t.velden), poules = T.gesorteerd(t.poules);
  const nogClub = (club?.velden || []).filter(v => !velden.some(x => x.clubVeld === v.id));
  const eind = (t.schema || []).length ? T.planSchema(t).eind : '';
  const conflicten = club && a.datum ? T.veldConflicten(club.blokken, { datum: a.datum, van: o.start, tot: eind || T.naarTijd(T.naarMin(o.start) + 240), velden: velden.map(v => v.clubVeld).filter(Boolean) }) : [];
  return `<div class="ac-paneel"><h3>Tijden</h3>
      <div class="tn-rij"><label>Eerste wedstrijd ${veld('start', o.start, { type: 'time' })}</label><label>Speeltijd (min) ${getal('duur', o.duur, 'min="4" max="90"')}</label><label>Wisseltijd (min) ${getal('wissel', o.wissel, 'min="0" max="30"')}</label></div>
      <label class="ac-schak"><input type="checkbox" data-veld="toernooi.rust" data-bool ${o.rust ? 'checked' : ''}> <span><b>Rust tussen wedstrijden</b><small class="ac-zacht"> Een team speelt liefst niet twee keer achter elkaar.</small></span></label></div>
    <div class="ac-paneel"><h3>Velden</h3><p class="ac-zacht">Splits een veld in twee of vier veldjes voor de kleintjes. Elk veldje speelt tegelijk.</p>
      ${velden.map(v => `<div class="ac-rij">${veld(`velden.${v.id}.naam`, v.naam, { klasse: 'ac-groei' })}
        <select class="ac-in smal" data-veld="toernooi.velden.${esc(v.id)}.delen" data-num>${[[1, 'Heel veld'], [2, 'Twee helften'], [4, 'Vier kwarten']].map(([n, l]) => opt(n, l, Number(v.delen || 1) === n)).join('')}</select>
        <button class="ac-x" data-tn="veld-weg" data-id="${esc(v.id)}" aria-label="Veld weg">✕</button></div>`).join('') || '<p class="ac-zacht">Nog geen velden.</p>'}
      <div class="ac-acties">${nogClub.length ? `<button class="knop licht klein" data-tn="velden-club">${ico('planning-week', 16)} Velden van de club (${nogClub.length})</button>` : ''}<button class="knop licht klein" data-tn="veld-nieuw">${ico('action-add', 16)} Veld</button></div>
      ${!club ? '<p class="ac-zacht">Velden van de club laden…</p>' : !club.velden.length ? '<p class="ac-zacht">De club heeft nog geen velden op de veldkaart, of je mag die niet zien. Voeg ze hier zelf toe.</p>' : ''}
      ${conflicten.length ? `<div class="ac-melding">${ico('action-warning', 18)} <span><b>Let op, in de Veldplanner staat op deze dag:</b> ${conflicten.map(b => `${esc(b.teamNaam || b.naam || b.team || 'een training')} ${esc(b.start)}–${esc(b.eind)} op ${esc(club.velden.find(v => v.id === String(b.veld))?.naam || 'een veld')}`).join('; ')}. Verplaats of laat afgelasten (tab Locatie en spullen).</span></div>` : ''}</div>
    <div class="ac-paneel"><h3>Poules</h3><p class="ac-zacht">Een poule speelt iedereen tegen iedereen. Geef een poule eigen velden of een eigen begintijd, bijvoorbeeld de jongsten op de kwartvelden om 9:00.</p>
      ${poules.map(p => { const n = Object.values(t.teams || {}).filter(x => x.poule === p.id).length, mag = new Set(p.velden || []);
        return `<div class="tn-poule" style="--pk:${esc(p.kleur || '#999')}"><div class="ac-rij"><input class="tn-kleur" type="color" data-veld="toernooi.poules.${esc(p.id)}.kleur" value="${esc(p.kleur || '#999999')}" aria-label="Kleur">${veld(`poules.${p.id}.naam`, p.naam, { klasse: 'ac-groei vet' })}
          <span class="ac-zacht">${n} teams · ${n * (n - 1) / 2 * (p.dubbel ? 2 : 1)} wedstr.</span><button class="ac-x" data-tn="poule-weg" data-id="${esc(p.id)}" aria-label="Poule weg">✕</button></div>
          <div class="ac-chips">${vj.map(v => `<label class="ac-chip ${mag.has(v.id) ? 'aan' : ''}"><input type="checkbox" data-tn-pveld="${esc(p.id)}" value="${esc(v.id)}" ${mag.has(v.id) ? 'checked' : ''}> ${esc(v.naam)}</label>`).join('')}<span class="ac-zacht">${mag.size ? '' : 'Alle velden'}</span></div>
          <div class="tn-rij"><label>Begint om ${veld(`poules.${p.id}.start`, p.start || '', { type: 'time' })}</label><label class="ac-schak"><input type="checkbox" data-veld="toernooi.poules.${esc(p.id)}.dubbel" data-bool ${p.dubbel ? 'checked' : ''}> Uit en thuis</label></div></div>`; }).join('') || '<p class="ac-zacht">Nog geen poules. Maak ze hier, of laat ze maken bij Teams › Voorstel.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-tn="poule-nieuw">${ico('action-add', 16)} Poule</button></div></div>`;
}

function htmlSpelers(ctx, a, t){
  const sp = Object.entries(t.spelers || {}).map(([id, s]) => ({ id, ...s }));
  const z = st.zoek.toLowerCase();
  const lijst = sp.filter(s => !z || `${s.naam} ${s.bron} ${s.jaar || ''}`.toLowerCase().includes(z)).sort((x, y) => String(x.bron).localeCompare(String(y.bron), 'nl', { numeric: true }) || String(x.naam).localeCompare(String(y.naam), 'nl'));
  const teams = T.gesorteerd(t.teams), vrij = sp.filter(s => !s.tt).length;
  const groepen = new Map(); for (const s of lijst){ const k = s.bron || 'Zonder team'; if (!groepen.has(k)) groepen.set(k, []); groepen.get(k).push(s); }
  return `<div class="ac-paneel"><h3>Spelers inlezen</h3><p class="ac-zacht">Uit de teams in Cluppie, uit een inschrijflijst (CSV, of plakken uit Excel) of één voor één. Alleen naam, geboortejaar, geslacht en team.</p>
      <div class="ac-acties"><button class="knop licht klein" data-tn="imp-teams">${ico('team-group', 16)} Uit Cluppie-teams</button>
        <label class="knop licht klein">${ico('admin-file', 16)} Excel of CSV<input type="file" accept=".csv,.txt,.xlsx,text/csv" data-tn-bestand hidden></label>
        <button class="knop licht klein" data-tn="imp-plak">Plakken uit Excel</button><button class="knop licht klein" data-tn="speler-nieuw">${ico('action-add', 16)} Speler</button></div></div>
    <div class="ac-paneel"><h3>${sp.length} spelers${vrij ? ` <small class="ac-zacht">· ${vrij} zonder team</small>` : ''}</h3><div class="ac-rij">
        <input class="ac-in ac-groei" type="search" data-tn-zoek value="${esc(st.zoek)}" placeholder="Zoeken">${sp.length ? '<button class="knop licht klein" data-tn="spelers-weg">Alles weg</button>' : ''}</div>
      ${[...groepen.entries()].map(([k, l]) => `<h4 class="tn-h4">${esc(k)} <small class="ac-zacht">${l.length}</small></h4>${l.map(s => {
        const r = s.tt && t.teams?.[s.tt] ? T.magInTeam(s, t.teams[s.tt]) : [];
        return `<div class="ac-rij tn-sp">${veld(`spelers.${s.id}.naam`, s.naam, { klasse: 'ac-groei' })}
          ${veld(`spelers.${s.id}.jaar`, s.jaar ?? '', { type: 'number', klasse: 'getal', ph: 'Jaar', extra: 'data-num inputmode="numeric" min="1950" max="2099"' })}
          <select class="ac-in tn-g" data-veld="toernooi.spelers.${esc(s.id)}.geslacht" aria-label="Geslacht">${opt('', '?', !s.geslacht)}${opt('m', 'J', s.geslacht === 'm')}${opt('v', 'M', s.geslacht === 'v')}</select>
          <select class="ac-in smal ${r.length ? 'tn-fout' : ''}" data-veld="toernooi.spelers.${esc(s.id)}.tt" title="${esc(r.join(', '))}">${opt('', '— geen team —')}${teams.map(tm => { const m = T.magInTeam(s, tm); return opt(tm.id, `${tm.naam}${m.length ? ' ⚠' : ''}`, s.tt === tm.id); }).join('')}</select>
          <button class="ac-x" data-tn="speler-weg" data-id="${esc(s.id)}" aria-label="Weg">✕</button></div>${r.length ? `<p class="tn-waarsch">${ico('action-warning', 14)} ${esc(s.naam)} past niet in ${esc(naamTeam(t, s.tt))}: ${esc(r.join(', '))}</p>` : ''}`; }).join('')}`).join('') || '<p class="ac-zacht">Nog geen spelers.</p>'}</div>`;
}

function htmlTeams(ctx, a, t){
  const teams = T.gesorteerd(t.teams), poules = T.gesorteerd(t.poules), o = T.opzet(t);
  const bronnen = [...new Set(Object.values(t.spelers || {}).map(s => s.bron).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'nl', { numeric: true }));
  const fout = T.controleerTeams(t), nVrij = Object.values(t.spelers || {}).filter(s => !s.tt).length;
  return `<div class="ac-paneel"><h3>${ico('action-magic', 18)} Voorstel maken</h3><p class="ac-zacht">Cluppie deelt de spelers ${nVrij ? `zonder team (${nVrij})` : ''} in groepen en maakt teams van ongeveer gelijke grootte en leeftijd. Je ziet het voorstel eerst.</p>
      <div class="ac-chips">${Object.entries(T.GROEP_OP).map(([k, n]) => `<label class="ac-chip ${o.groepOp.includes(k) ? 'aan' : ''}"><input type="checkbox" data-tn-groep="${k}" ${o.groepOp.includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>
      <div class="tn-rij"><label>Spelers per team ${getal('grootte', o.grootte, 'min="2" max="18"')}</label><label class="ac-schak"><input type="checkbox" data-tn-pp checked> Per groep een poule</label></div>
      <div class="ac-acties"><button class="knop vol klein" data-tn="voorstel" ${nVrij ? '' : 'disabled'}>Voorstel maken</button></div></div>
    <div class="ac-paneel"><h3>Verenigingen</h3><p class="ac-zacht">Voeg de clubs toe die meedoen en geef ze teams. Gastteams hebben geen spelerslijst nodig.</p>
      ${T.gesorteerd(t.clubs).map(c => { const n = teams.filter(tm => tm.club === c.id).length;
        return `<div class="ac-rij tn-clubrij">${veld(`clubs.${c.id}.naam`, c.naam, { klasse: 'ac-groei vet' })}<span class="ac-zacht">${n} ${n === 1 ? 'team' : 'teams'}</span>
          <select class="ac-in smal" data-tn-clubteam="${esc(c.id)}" aria-label="Team toevoegen">${opt('', '+ team in poule…')}${poules.map(p => opt(p.id, p.naam)).join('')}${opt('-', 'zonder poule')}</select>
          <button class="ac-x" data-tn="club-weg" data-id="${esc(c.id)}" aria-label="Vereniging weg">✕</button></div>`; }).join('') || '<p class="ac-zacht">Nog geen verenigingen.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-tn="club-nieuw">${ico('action-add', 16)} Vereniging</button><button class="knop licht klein" data-tn="teams-plak">Lijst plakken (vereniging, team, poule)</button></div></div>
    ${fout.length ? `<div class="ac-melding">${ico('action-warning', 18)} <span><b>${fout.length} ${fout.length === 1 ? 'speler past' : 'spelers passen'} niet bij de regels van hun team.</b> Zie de rode teams hieronder.</span></div>` : ''}
    ${teams.map(tm => {
      const sp = Object.entries(t.spelers || {}).filter(([, s]) => s.tt === tm.id).map(([id, s]) => ({ id, ...s })).sort((x, y) => String(x.naam).localeCompare(String(y.naam), 'nl'));
      const e = tm.eisen || {}, bron = new Set(e.bron || []);
      const fouten = sp.filter(s => T.magInTeam(s, tm).length);
      return `<details class="ac-paneel tn-team ${fouten.length ? 'tn-fout' : ''}" style="--pk:${esc(kleurPoule(t, tm.poule))}"><summary><span class="tn-stip"></span><b>${esc(tm.naam)}</b><span class="ac-zacht">${esc(t.poules?.[tm.poule]?.naam || 'geen poule')} · ${tm.gast ? 'gastteam' : sp.length + ' spelers'}${t.clubs?.[tm.club] ? ' · ' + esc(t.clubs[tm.club].naam) : ''} · ${esc(T.eisTekst(e))}</span></summary>
        <div class="ac-rij2"><span><label class="ac-label">Naam</label>${veld(`teams.${tm.id}.naam`, tm.naam)}</span><span><label class="ac-label">Poule</label><select class="ac-in" data-veld="toernooi.teams.${esc(tm.id)}.poule">${opt('', '— geen —')}${poules.map(p => opt(p.id, p.naam, tm.poule === p.id)).join('')}</select></span></div>
        ${Object.keys(t.clubs || {}).length ? `<label class="ac-label">Vereniging</label><select class="ac-in" data-veld="toernooi.teams.${esc(tm.id)}.club">${opt('', '— geen —')}${T.gesorteerd(t.clubs).map(c => opt(c.id, c.naam, tm.club === c.id)).join('')}</select>` : ''}
        <label class="ac-label">Wie mag in dit team?</label>
        <div class="tn-rij"><select class="ac-in smal" data-veld="toernooi.teams.${esc(tm.id)}.eisen.geslacht">${Object.entries(T.GESLACHT).map(([k, n]) => opt(k, k ? `Alleen ${n.toLowerCase()}` : 'Jongens en meisjes', (e.geslacht || '') === k)).join('')}</select>
          <label>Geboren van ${veld(`teams.${tm.id}.eisen.van`, e.van ?? '', { type: 'number', klasse: 'getal', ph: 'jaar', extra: 'data-num min="1950" max="2099"' })}</label><label>tot en met ${veld(`teams.${tm.id}.eisen.tot`, e.tot ?? '', { type: 'number', klasse: 'getal', ph: 'jaar', extra: 'data-num min="1950" max="2099"' })}</label></div>
        ${bronnen.length ? `<div class="ac-chips"><span class="ac-zacht">Uit team:</span>${bronnen.map(b => `<label class="ac-chip ${bron.has(b) ? 'aan' : ''}"><input type="checkbox" data-tn-bron="${esc(tm.id)}" value="${esc(b)}" ${bron.has(b) ? 'checked' : ''}> ${esc(b)}</label>`).join('')}</div>` : ''}
        <label class="ac-schak"><input type="checkbox" data-veld="toernooi.teams.${esc(tm.id)}.gast" data-bool ${tm.gast ? 'checked' : ''}> Gastteam (andere club, zonder spelerslijst)</label>
        <div class="ac-chips">${sp.map(s => `<span class="ac-chip ${T.magInTeam(s, tm).length ? 'tn-fout' : ''}" title="${esc(T.magInTeam(s, tm).join(', '))}">${esc(s.naam)}${s.jaar ? ` <small>${s.jaar}</small>` : ''}<button class="ac-x" data-tn="uit-team" data-id="${esc(s.id)}" aria-label="Uit team">✕</button></span>`).join('') || '<span class="ac-zacht">Nog geen spelers. Kies een team bij een speler (tab Spelers) of voeg toe:</span>'}</div>
        <div class="ac-acties"><select class="ac-in smal" data-tn-erbij="${esc(tm.id)}">${opt('', '+ speler toevoegen')}${Object.entries(t.spelers || {}).filter(([, s]) => s.tt !== tm.id).sort((x, y) => (T.magInTeam(x[1], tm).length - T.magInTeam(y[1], tm).length) || String(x[1].naam).localeCompare(String(y[1].naam), 'nl'))
          .slice(0, 300).map(([id, s]) => opt(id, `${s.naam}${s.jaar ? ' (' + s.jaar + ')' : ''}${s.tt ? ' · nu ' + naamTeam(t, s.tt) : ''}${T.magInTeam(s, tm).length ? ' ⚠' : ''}`)).join('')}</select>
          <span class="ac-groei"></span><button class="knop licht klein" data-tn="team-weg" data-id="${esc(tm.id)}">Team weg</button></div></details>`; }).join('') || '<div class="ac-paneel"><p class="ac-zacht">Nog geen teams.</p></div>'}
    <div class="ac-acties"><button class="knop licht klein" data-tn="team-nieuw">${ico('action-add', 16)} Team</button>${teams.length ? '<button class="knop licht klein" data-tn="teams-weg">Alle teams weg</button>' : ''}</div>`;
}

function htmlSchema(ctx, a, t){
  const vj = T.veldjes(t), schema = t.schema || [], o = T.opzet(t);
  const kop = `<div class="ac-paneel"><div class="ac-rij"><span class="ac-groei">${schema.length ? `<b>${schema.length} wedstrijden</b>, van ${esc(o.start)} tot ${esc(T.naarTijd(Math.max(...schema.map(w => T.naarMin(w.t))) + o.duur))}` : 'Nog geen schema.'}</span>
      <button class="knop vol klein" data-tn="plan">${schema.length ? 'Opnieuw plannen' : 'Schema maken'}</button></div>
      ${st.waarsch?.length ? `<div class="ac-melding">${ico('action-warning', 18)} <span>${st.waarsch.map(esc).join(' ')}</span></div>` : ''}
      ${schema.length ? '<p class="ac-zacht">Tik op een wedstrijd en daarna op een andere plek om te ruilen of te verplaatsen.</p>' : ''}</div>`;
  if (!schema.length) return kop;
  const tijden = [...new Set(schema.map(w => w.t))].sort((x, y) => T.naarMin(x) - T.naarMin(y));
  const vrijeTijden = []; for (let m = T.naarMin(tijden[0]); m <= T.naarMin(tijden[tijden.length - 1]) + T.slot(t); m += T.slot(t)) vrijeTijden.push(T.naarTijd(m));
  const alle = [...new Set([...tijden, ...vrijeTijden])].sort((x, y) => T.naarMin(x) - T.naarMin(y));
  const op = Object.fromEntries(schema.map(w => [`${w.t}|${w.v}`, w]));
  const rooster = T.teamRooster(t), teams = T.gesorteerd(t.teams);
  const krap = teams.filter(tm => rooster[tm.id]?.achterElkaar > 0);
  const grid = `<div class="tn-grid-buiten"><table class="tn-grid"><thead><tr><th></th>${vj.map(v => `<th>${esc(v.naam)}</th>`).join('')}</tr></thead><tbody>
    ${alle.map(tijd => `<tr><th>${esc(tijd)}</th>${vj.map(v => { const w = op[`${tijd}|${v.id}`], u = w && t.uitslag?.[w.id];
      return `<td><button class="tn-cel ${w ? 'vol' : ''} ${st.gekozen && w?.id === st.gekozen ? 'gekozen' : ''} ${st.teamFilter && w && ![w.a, w.b].includes(st.teamFilter) ? 'dim' : ''}" data-tn="cel" data-t="${esc(tijd)}" data-v="${esc(v.id)}" ${w ? `data-id="${esc(w.id)}" style="--pk:${esc(kleurPoule(t, w.p))}"` : ''}>${w ? `<b>${esc(naamTeam(t, w.a))}</b><b>${esc(naamTeam(t, w.b))}</b>${u && u.a != null && u.a !== '' ? `<small>${esc(u.a)}–${esc(u.b)}</small>` : ''}` : '<small>vrij</small>'}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `${kop}<div class="ac-paneel"><div class="ac-rij"><h3 class="ac-groei">Per veld</h3><select class="ac-in smal" data-tn-filter>${opt('', 'Alle teams')}${teams.map(tm => opt(tm.id, tm.naam, st.teamFilter === tm.id)).join('')}</select></div>${grid}
      <div class="ac-chips">${T.gesorteerd(t.poules).map(p => `<span class="ac-chip"><span class="tn-stip" style="--pk:${esc(p.kleur || '#999')}"></span>${esc(p.naam)}</span>`).join('')}</div></div>
    ${st.teamFilter && rooster[st.teamFilter] ? `<div class="ac-paneel"><h3>${esc(naamTeam(t, st.teamFilter))}</h3>${rooster[st.teamFilter].wedstrijden.map(w => `<div class="ac-rij"><span class="ac-tijd">${esc(w.t)}</span><span class="ac-groei">${esc(naamTeam(t, w.a))} – ${esc(naamTeam(t, w.b))}</span><span class="ac-zacht">${esc(vj.find(v => v.id === w.v)?.naam || '')}</span></div>`).join('')}
      <p class="ac-zacht">Eerste wedstrijd ${esc(rooster[st.teamFilter].eerste)}, klaar om ${esc(rooster[st.teamFilter].laatste)}. Langste wachttijd ${rooster[st.teamFilter].langsteWacht} min.</p></div>` : ''}
    ${krap.length ? `<p class="ac-zacht">Achter elkaar spelen (te weinig velden of teams voor rust): ${krap.map(tm => `${esc(tm.naam)} (${rooster[tm.id].achterElkaar}×)`).join(', ')}.</p>` : ''}`;
}

function htmlKk(ctx, a, t){
  const kks = T.gesorteerd(t.kk), plan = T.planKleedkamers(t), rooster = T.teamRooster(t), club = st.club;
  const nogClub = (club?.kk || []).filter(k => !kks.some(x => x.clubKk === k.id));
  const teams = T.gesorteerd(t.teams).filter(tm => rooster[tm.id]);
  return `<div class="ac-paneel"><h3>Kleedkamers</h3><p class="ac-zacht">Plekken = hoeveel teams er tegelijk in passen. Een team krijgt de kleedkamer 30 minuten voor de eerste tot 20 minuten na de laatste wedstrijd.</p>
      ${kks.map(k => `<div class="ac-rij">${veld(`kk.${k.id}.naam`, k.naam, { klasse: 'ac-groei' })}<label class="ac-zacht" title="Maximaal ${plan.drukte[k.id] || 0} teams tegelijk in het schema">plekken ${getal(`kk.${k.id}.plekken`, k.plekken ?? 2, 'min="1" max="8"')}</label><button class="ac-x" data-tn="kk-weg" data-id="${esc(k.id)}" aria-label="Weg">✕</button></div>`).join('') || '<p class="ac-zacht">Nog geen kleedkamers.</p>'}
      <div class="ac-acties">${nogClub.length ? `<button class="knop licht klein" data-tn="kk-club">${ico('planning-week', 16)} Kleedkamers van de club (${nogClub.length})</button>` : ''}<button class="knop licht klein" data-tn="kk-nieuw">${ico('action-add', 16)} Kleedkamer</button></div></div>
    ${plan.tekort.length ? `<div class="ac-melding">${ico('action-warning', 18)} <span><b>Te weinig plek</b> voor ${plan.tekort.map(id => esc(naamTeam(t, id))).join(', ')}. Voeg een kleedkamer toe, geef er een plek bij of spreid de poules (Opzet › begintijd).</span></div>` : ''}
    <div class="ac-paneel"><h3>Indeling</h3>${teams.length ? teams.map(tm => { const r = rooster[tm.id];
      return `<div class="ac-rij"><span class="tn-stip" style="--pk:${esc(kleurPoule(t, tm.poule))}"></span><span class="ac-groei"><b>${esc(tm.naam)}</b> <small class="ac-zacht">${esc(T.naarTijd(T.naarMin(r.eerste) - 30))}–${esc(T.naarTijd(T.naarMin(r.laatste) + 20))}</small></span>
        <select class="ac-in smal" data-veld="toernooi.teams.${esc(tm.id)}.kk">${opt('', plan.kk[tm.id] && !tm.kk ? `Automatisch: ${t.kk?.[plan.kk[tm.id]]?.naam}` : 'Automatisch')}${kks.map(k => opt(k.id, k.naam, tm.kk === k.id)).join('')}</select></div>`; }).join('') : '<p class="ac-zacht">Maak eerst het schema; dan weet Cluppie wanneer elk team er is.</p>'}</div>`;
}

function htmlUitslagen(ctx, a, t){
  const vj = Object.fromEntries(T.veldjes(t).map(v => [v.id, v.naam])), schema = [...(t.schema || [])].sort((x, y) => T.naarMin(x.t) - T.naarMin(y.t) || String(vj[x.v]).localeCompare(String(vj[y.v]), 'nl', { numeric: true }));
  if (!schema.length) return '<div class="ac-paneel"><p class="ac-zacht">Maak eerst het schema.</p></div>';
  const tijden = [...new Set(schema.map(w => w.t))];
  return `<div class="tn-twee"><div class="ac-paneel"><h3>Uitslagen</h3>${tijden.map(tijd => `<h4 class="tn-h4">${esc(tijd)}</h4>${schema.filter(w => w.t === tijd).map(w => { const u = t.uitslag?.[w.id] || {};
      return `<div class="tn-uit" style="--pk:${esc(kleurPoule(t, w.p))}"><span class="tn-uit-v">${esc(vj[w.v] || '')}</span><span class="tn-uit-a">${esc(naamTeam(t, w.a))}</span>
        <input class="ac-in tn-score" type="number" min="0" max="99" inputmode="numeric" data-num data-veld="toernooi.uitslag.${esc(w.id)}.a" value="${esc(u.a ?? '')}" aria-label="Doelpunten ${esc(naamTeam(t, w.a))}">
        <span>–</span><input class="ac-in tn-score" type="number" min="0" max="99" inputmode="numeric" data-num data-veld="toernooi.uitslag.${esc(w.id)}.b" value="${esc(u.b ?? '')}" aria-label="Doelpunten ${esc(naamTeam(t, w.b))}">
        <span class="tn-uit-b">${esc(naamTeam(t, w.b))}</span></div>`; }).join('')}`).join('')}</div>
    <div class="tn-standen">${T.gesorteerd(t.poules).map(p => { const rijen = T.stand(t, p.id); return rijen.length ? `<div class="ac-paneel"><h3><span class="tn-stip" style="--pk:${esc(p.kleur || '#999')}"></span>${esc(p.naam)}</h3>
      <table class="tn-stand"><thead><tr><th></th><th>Team</th><th>G</th><th>W</th><th>GL</th><th>V</th><th>DS</th><th>P</th></tr></thead><tbody>${rijen.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.naam)}</td><td>${r.g}</td><td>${r.w}</td><td>${r.gl}</td><td>${r.v}</td><td>${r.saldo > 0 ? '+' : ''}${r.saldo}</td><td><b>${r.pnt}</b></td></tr>`).join('')}</tbody></table></div>` : ''; }).join('')}</div></div>`;
}

/* ---------- klikken en wijzigen ---------- */
export async function klikToernooi(ctx, b){
  const actie = b.dataset.tn, id = b.dataset.id, a = ctx.act, t = a.toernooi || {}, zet = ctx.zet;
  switch (actie){
    case 'sub': st.sub = id; st.gekozen = ''; return ctx.herteken();
    case 'veld-nieuw': return zet({ [`toernooi.velden.${T.nieuwId('v')}`]: { naam: `Veld ${Object.keys(t.velden || {}).length + 1}`, delen: 1, volg: T.volgende(t.velden) } });
    case 'velden-club': {
      const club = await laadClub(ctx.clubId), patch = {}; let v = T.volgende(t.velden);
      for (const cv of club.velden.filter(cv => !Object.values(t.velden || {}).some(x => x.clubVeld === cv.id))) patch[`toernooi.velden.${T.nieuwId('v')}`] = { naam: cv.naam, clubVeld: cv.id, delen: 1, volg: v++ };
      return Object.keys(patch).length ? zet(patch) : meld('Alle velden staan er al.');
    }
    case 'veld-weg': return zet({ [`toernooi.velden.${id}`]: deleteField() });
    case 'poule-nieuw': { const n = Object.keys(t.poules || {}).length; return zet({ [`toernooi.poules.${T.nieuwId('p')}`]: { naam: `Poule ${String.fromCharCode(65 + (n % 26))}`, kleur: T.KLEUREN[n % T.KLEUREN.length], volg: T.volgende(t.poules), velden: [] } }); }
    case 'poule-weg': {
      if (!confirm('Poule weghalen? De teams blijven bestaan, zonder poule.')) return;
      const patch = { [`toernooi.poules.${id}`]: deleteField() };
      for (const [tid, tm] of Object.entries(t.teams || {})) if (tm.poule === id) patch[`toernooi.teams.${tid}.poule`] = '';
      return zet(patch);
    }
    case 'speler-nieuw': return zet({ [`toernooi.spelers.${T.nieuwId('s')}`]: T.schoonSpeler({ naam: 'Nieuwe speler' }) });
    case 'speler-weg': return zet({ [`toernooi.spelers.${id}`]: deleteField() });
    case 'spelers-weg': if (confirm('Alle spelers weghalen? Teams blijven bestaan.')) return zet({ 'toernooi.spelers': {} }); return;
    case 'uit-team': return zet({ [`toernooi.spelers.${id}.tt`]: '' });
    case 'imp-plak': return ctx.venster(`<h2>Plakken uit Excel</h2><p class="ac-zacht">Kopieer de rijen in Excel of Google Sheets (met de kopregel) en plak ze hier. Herkend worden: Naam (of Voornaam en Achternaam), Geboortedatum of Geboortejaar of Leeftijd, Geslacht en Team.</p>
      <textarea class="ac-in" rows="10" data-tn-plak placeholder="Naam&#9;Geboortedatum&#9;Geslacht&#9;Team"></textarea>
      <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Annuleren</button><span class="ac-groei"></span><button class="knop vol" data-tn="plak-lees">Inlezen</button></div>`);
    case 'plak-lees': return importeer(ctx, b.closest('.ac-blad')?.querySelector('[data-tn-plak]')?.value || '');
    case 'imp-teams': {
      const teams = (S.clubTeams || []).filter(x => x && x.id && !x.gearchiveerd).sort((x, y) => String(x.naam).localeCompare(String(y.naam), 'nl', { numeric: true }));
      if (!teams.length) return meld('Open Activiteiten vanuit het clubscherm om de teams te zien.');
      return ctx.venster(`<h2>Spelers uit Cluppie-teams</h2><p class="ac-zacht">Kies de teams. Cluppie neemt de naam en het team over; het geboortejaar wordt geschat uit de categorie (pas aan waar nodig).</p>
        <div class="ac-chips">${teams.map(x => `<label class="ac-chip"><input type="checkbox" data-tn-impteam="${esc(x.id)}"> ${esc(x.naam)}</label>`).join('')}</div>
        <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Annuleren</button><span class="ac-groei"></span><button class="knop vol" data-tn="imp-teams-ja">Inlezen</button></div>`);
    }
    case 'imp-teams-ja': {
      const ids = [...(b.closest('.ac-blad')?.querySelectorAll('[data-tn-impteam]:checked') || [])].map(x => x.dataset.tnImpteam);
      if (!ids.length) return meld('Kies minstens één team.');
      const lijst = [], mis = [];
      for (const tid of ids){
        const tm = (S.clubTeams || []).find(x => x.id === tid);
        try {
          const snap = await getDocs(collection(db, 'teams', tid, 'spelers'));
          for (const d of snap.docs){ const s = d.data(); if (s.gearchiveerd || s.weg) continue;
            lijst.push(T.schoonSpeler({ naam: s.naam || [s.voornaam, s.achternaam].filter(Boolean).join(' '), jaar: s.geboortejaar || s.geboortedatum || jaarUitCategorie(tm, a.datum), geslacht: s.geslacht === 'v' || s.geslacht === 'm' ? s.geslacht : tm?.geslacht === 'm' ? 'v' : tm?.geslacht === 'j' ? 'm' : '', bron: tm?.naam || '' })); }
        } catch { mis.push(tm?.naam || tid); }
      }
      ctx.sluitVenster();
      await voegToe(ctx, lijst.filter(s => s.naam));
      if (mis.length) meld(`Geen toegang tot ${mis.join(', ')}. Gebruik daar een CSV-lijst.`);
      return;
    }
    case 'voorstel': {
      const o = T.opzet(t), vs = T.voorstelTeams(t.spelers, { groepOp: o.groepOp, grootte: o.grootte });
      if (!vs.length) return meld('Geen spelers zonder team.');
      st.voorstel = { teams: vs, perPoule: !!ctx.el.querySelector('[data-tn-pp]')?.checked };
      return ctx.venster(`<h2>Voorstel: ${vs.length} teams</h2><p class="ac-zacht">Ingedeeld op ${o.groepOp.map(g => T.GROEP_OP[g].toLowerCase()).join(', ') || 'niets'}, ongeveer ${o.grootte} per team. Namen en regels kun je daarna aanpassen.</p>
        ${vs.map(v => `<div class="ac-paneel"><b>${esc(v.naam)}</b> <small class="ac-zacht">${v.spelers.length} spelers · ${esc(T.eisTekst(v.eisen))}</small><p class="ac-zacht">${v.spelers.map(id => esc(t.spelers[id]?.naam || '')).join(', ')}</p></div>`).join('')}
        <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Annuleren</button><span class="ac-groei"></span><button class="knop vol" data-tn="voorstel-ja">Overnemen</button></div>`);
    }
    case 'voorstel-ja': {
      const v = st.voorstel; if (!v) return;
      const patch = {}, pouleVan = {}; let vt = T.volgende(t.teams), vp = T.volgende(t.poules), n = Object.keys(t.poules || {}).length;
      if (v.perPoule) for (const k of [...new Set(v.teams.map(x => x.sleutel))]){
        const bestaand = Object.entries(t.poules || {}).find(([, p]) => p.naam === k);
        if (bestaand){ pouleVan[k] = bestaand[0]; continue; }
        const pid = T.nieuwId('p'); pouleVan[k] = pid; patch[`toernooi.poules.${pid}`] = { naam: String(k).slice(0, 40), kleur: T.KLEUREN[n++ % T.KLEUREN.length], volg: vp++, velden: [] };
      }
      for (const x of v.teams){
        const tid = T.nieuwId('t');
        patch[`toernooi.teams.${tid}`] = { naam: String(x.naam).slice(0, 40), poule: pouleVan[x.sleutel] || '', volg: vt++, gast: false, eisen: x.eisen };
        for (const sid of x.spelers) patch[`toernooi.spelers.${sid}.tt`] = tid;
      }
      st.voorstel = null; ctx.sluitVenster();
      await zet(patch); return meld(`${v.teams.length} teams gemaakt`);
    }
    case 'team-nieuw': return zet({ [`toernooi.teams.${T.nieuwId('t')}`]: { naam: `Team ${Object.keys(t.teams || {}).length + 1}`, poule: T.gesorteerd(t.poules)[0]?.id || '', volg: T.volgende(t.teams), gast: false, eisen: {} } });
    case 'team-weg': {
      const patch = { [`toernooi.teams.${id}`]: deleteField() };
      for (const [sid, s] of Object.entries(t.spelers || {})) if (s.tt === id) patch[`toernooi.spelers.${sid}.tt`] = '';
      return zet(patch);
    }
    case 'teams-weg': {
      if (!confirm('Alle teams weghalen? Spelers blijven, zonder team. Het schema gaat ook weg.')) return;
      const patch = { 'toernooi.teams': {}, 'toernooi.schema': [], 'toernooi.uitslag': {} };
      for (const sid of Object.keys(t.spelers || {})) if (t.spelers[sid].tt) patch[`toernooi.spelers.${sid}.tt`] = '';
      return zet(patch);
    }
    case 'plan': {
      if (Object.keys(t.uitslag || {}).length && !confirm('Er staan al uitslagen. Opnieuw plannen gooit die weg. Doorgaan?')) return;
      const r = T.planSchema(t); st.waarsch = r.waarschuwingen; st.gekozen = '';
      if (!r.schema.length){ ctx.herteken(); return meld(r.waarschuwingen[0] || 'Niets te plannen.'); }
      await zet({ 'toernooi.schema': r.schema, 'toernooi.uitslag': {}, 'toernooi.gepland': Date.now() });
      return meld(`${r.schema.length} wedstrijden gepland, klaar om ${r.eind}`);
    }
    case 'cel': {
      if (!st.gekozen){ if (id){ st.gekozen = id; ctx.herteken(); } return; }
      if (st.gekozen === id){ st.gekozen = ''; return ctx.herteken(); }
      const r = T.verplaats(t.schema, st.gekozen, { t: b.dataset.t, v: b.dataset.v });
      st.gekozen = '';
      if (r.fout){ ctx.herteken(); return meld(r.fout); }
      return zet({ 'toernooi.schema': r.schema });
    }
    case 'club-nieuw': return zet({ [`toernooi.clubs.${T.nieuwId('c')}`]: { naam: Object.keys(t.clubs || {}).length ? 'Nieuwe vereniging' : (S.club?.naam || 'Onze club'), volg: T.volgende(t.clubs) } });
    case 'club-weg': {
      const n = Object.values(t.teams || {}).filter(tm => tm.club === id).length;
      if (n && !confirm(`Vereniging weghalen met ${n} ${n === 1 ? 'team' : 'teams'}? Het schema moet daarna opnieuw.`)) return;
      const patch = { [`toernooi.clubs.${id}`]: deleteField() };
      for (const [tid, tm] of Object.entries(t.teams || {})) if (tm.club === id){ patch[`toernooi.teams.${tid}`] = deleteField(); for (const [sid, sp] of Object.entries(t.spelers || {})) if (sp.tt === tid) patch[`toernooi.spelers.${sid}.tt`] = ''; }
      return zet(patch);
    }
    case 'teams-plak': return ctx.venster(`<h2>Verenigingen en teams plakken</h2><p class="ac-zacht">Eén team per regel: vereniging, team en poule (uit Excel, of met puntkomma's). Team en poule mogen leeg blijven.</p>
      <textarea class="ac-in" rows="10" data-tn-plak placeholder="SV Venray;JO11-1;Poule A&#10;Volharding;JO11-2;Poule A"></textarea>
      <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Annuleren</button><span class="ac-groei"></span><button class="knop vol" data-tn="teams-plak-lees">Toevoegen</button></div>`);
    case 'teams-plak-lees': {
      const lijst = T.teamsUitRijen(ctx.csvLees(b.closest('.ac-blad')?.querySelector('[data-tn-plak]')?.value || ''));
      ctx.sluitVenster();
      if (!lijst.length) return meld('Geen regels gevonden.');
      const patch = {}, clubId = {}, pouleId = {}; let vc = T.volgende(t.clubs), vp = T.volgende(t.poules), vt = T.volgende(t.teams), np = Object.keys(t.poules || {}).length;
      for (const [cid, c] of Object.entries(t.clubs || {})) clubId[String(c.naam).toLowerCase()] = cid;
      for (const [pid, p] of Object.entries(t.poules || {})) pouleId[String(p.naam).toLowerCase()] = pid;
      const al = new Set(Object.values(t.teams || {}).map(tm => String(tm.naam).toLowerCase()));
      let n = 0;
      for (const x of lijst.slice(0, T.MAX.teams)){
        const ck = x.club.toLowerCase(), pk = x.poule.toLowerCase();
        if (!clubId[ck]){ clubId[ck] = T.nieuwId('c'); patch[`toernooi.clubs.${clubId[ck]}`] = { naam: x.club, volg: vc++ }; }
        if (pk && !pouleId[pk]){ pouleId[pk] = T.nieuwId('p'); patch[`toernooi.poules.${pouleId[pk]}`] = { naam: x.poule, kleur: T.KLEUREN[np++ % T.KLEUREN.length], volg: vp++, velden: [] }; }
        const naam = x.team === x.club || x.team.toLowerCase().includes(ck) ? x.team : `${x.club} ${x.team}`;
        if (al.has(naam.toLowerCase())) continue; al.add(naam.toLowerCase());
        patch[`toernooi.teams.${T.nieuwId('t')}`] = { naam: naam.slice(0, 40), poule: pouleId[pk] || '', club: clubId[ck], volg: vt++, gast: true, eisen: {} }; n++;
      }
      await zet(patch); return meld(`${n} teams toegevoegd`);
    }
    case 'live-aan': {
      const lid = t.liveId || T.liveId();
      try { await setDoc(doc(db, 'toernooiLive', lid), { club: ctx.clubId, actId: ctx.actId, open: true, ...T.liveKopie(a, { clubNaam: S.club?.naam || '' }), bijgewerktMs: Date.now() }); }
      catch (e){ console.error('[toernooi] live', e); return meld(e?.code === 'permission-denied' ? 'De live pagina kan nog niet aan: de regels zijn nog niet gepubliceerd.' : 'Aanzetten mislukt.'); }
      await zet({ 'toernooi.liveId': lid, 'toernooi.live': true }); return meld('De live pagina staat aan');
    }
    case 'live-uit': {
      if (!confirm('Live pagina uitzetten? De link en de QR-code werken dan niet meer.')) return;
      try { await setDoc(doc(db, 'toernooiLive', t.liveId), { open: false, bijgewerktMs: Date.now() }, { merge: true }); } catch { return meld('Uitzetten mislukt.'); }
      return zet({ 'toernooi.live': false });
    }
    case 'live-kopieer': return ctx.kopieer(liveLink(t.liveId, b.dataset.tv === '1'), 'Link gekopieerd');
    case 'qr-print': return ctx.printen(`<div style="text-align:center"><h1>${esc(a.naam)}</h1><p class="sub">Scan voor het speelschema, de uitslagen en de stand</p><div style="width:90mm;margin:8mm auto">${st.qrSvg || ''}</div><p>${esc(liveLink(t.liveId))}</p></div>`);
    case 'med-stuur': {
      const inp = ctx.el.querySelector('[data-tn-med]'), tekst = String(inp?.value || '').replace(/\s+/g, ' ').trim().slice(0, 280);
      if (!tekst) return meld('Typ eerst een mededeling.');
      if (Object.keys(t.mededelingen || {}).length >= T.MAX_MEDEDELINGEN) return meld('Haal eerst een oude mededeling weg.');
      inp.value = '';
      await zet({ [`toernooi.mededelingen.${T.nieuwId('m')}`]: { tekst, ms: Date.now() } }); return meld(t.live ? 'Mededeling staat op de live pagina' : 'Mededeling bewaard');
    }
    case 'scherm-nieuw': { if (Object.keys(t.schermen || {}).length >= T.MAX_SCHERMEN) return meld(`Maximaal ${T.MAX_SCHERMEN} sponsoren en schermen.`);
      return zet({ [`toernooi.schermen.${T.nieuwId('x')}`]: { soort: id === 'sponsor' ? 'sponsor' : 'scherm', titel: '', tekst: '', volg: T.volgende(t.schermen), tv: true, tel: true } }); }
    case 'scherm-weg': return zet({ [`toernooi.schermen.${id}`]: deleteField() });
    case 'scherm-plaatje-weg': return zet({ [`toernooi.schermen.${id}.img`]: deleteField() });
    case 'med-weg': return zet({ [`toernooi.mededelingen.${id}`]: deleteField() });
    case 'kk-nieuw': return zet({ [`toernooi.kk.${T.nieuwId('k')}`]: { naam: `Kleedkamer ${Object.keys(t.kk || {}).length + 1}`, plekken: 2, volg: T.volgende(t.kk) } });
    case 'kk-club': {
      const club = await laadClub(ctx.clubId), patch = {}; let v = T.volgende(t.kk);
      for (const k of club.kk.filter(k => !Object.values(t.kk || {}).some(x => x.clubKk === k.id))) patch[`toernooi.kk.${T.nieuwId('k')}`] = { naam: k.naam, clubKk: k.id, plekken: 2, volg: v++ };
      return zet(patch);
    }
    case 'kk-weg': {
      const patch = { [`toernooi.kk.${id}`]: deleteField() };
      for (const [tid, tm] of Object.entries(t.teams || {})) if (tm.kk === id) patch[`toernooi.teams.${tid}.kk`] = '';
      return zet(patch);
    }
  }
}
const jaarUitCategorie = (tm, datum) => {
  const n = Number(/(\d{1,2})/.exec(String(tm?.categorie || tm?.naam || ''))?.[1]);
  const d = String(datum || ''), seizoenStart = /^\d{4}-\d{2}/.test(d) ? (Number(d.slice(5, 7)) >= 7 ? Number(d.slice(0, 4)) : Number(d.slice(0, 4)) - 1) : new Date().getFullYear();
  return n >= 6 && n <= 23 ? seizoenStart + 1 - n : null;
};

async function voegToe(ctx, lijst){
  const t = ctx.act.toernooi || {}, nieuw = T.nieuweSpelers(t.spelers, lijst);
  const ruimte = T.MAX.spelers - Object.keys(t.spelers || {}).length;
  if (!nieuw.length) return meld(lijst.length ? 'Deze spelers staan er al.' : 'Geen spelers gevonden.');
  const patch = {};
  for (const s of nieuw.slice(0, Math.max(0, ruimte))) patch[`toernooi.spelers.${T.nieuwId('s')}`] = s;
  await ctx.zet(patch);
  meld(`${Object.keys(patch).length} spelers ingelezen${lijst.length > nieuw.length ? `, ${lijst.length - nieuw.length} dubbel overgeslagen` : ''}`);
}
async function importeer(ctx, tekst){
  const r = T.spelersUitRijen(ctx.csvLees(tekst), { datum: ctx.act.datum });
  ctx.sluitVenster();
  if (r.fouten.length && !r.spelers.length) return meld(r.fouten[0]);
  await voegToe(ctx, r.spelers);
  if (r.fouten.length) meld(`${r.fouten.length} regels overgeslagen (geen naam).`);
}

export async function wijzigToernooi(ctx, el){
  const a = ctx.act, t = a.toernooi || {};
  if (el.matches('[data-tn-plaatje]')){
    const f = el.files?.[0], sid = el.dataset.tnPlaatje; el.value = ''; if (!f || !t.schermen?.[sid]) return true;
    if (!/^image\//.test(f.type) || f.size > 12 * 1024 * 1024){ meld('Kies een afbeelding (jpg of png, max 12 MB).'); return true; }
    try { const img = await kleinPlaatje(f); if (!T.plaatjeOk(img)) throw new Error('te groot'); await ctx.zet({ [`toernooi.schermen.${sid}.img`]: img }); meld('Afbeelding geplaatst'); }
    catch (e){ console.error('[toernooi] plaatje', e); meld('Deze afbeelding kon niet gebruikt worden. Probeer een jpg of png.'); }
    return true;
  }
  if (el.matches('[data-tn-bestand]')){
    const f = el.files?.[0]; el.value = ''; if (!f) return true;
    if (f.size > 2 * 1024 * 1024){ meld('Dit bestand is te groot (max 2 MB).'); return true; }
    if (/\.xls$/i.test(f.name)){ meld('Sla het bestand op als .xlsx of .csv, of kopieer en plak de rijen.'); return true; }
    if (/\.xlsx$/i.test(f.name)){
      try { const rijen = await excelRijen(f), r = T.spelersUitRijen(rijen, { datum: a.datum }); if (!r.spelers.length) meld(r.fouten[0] || 'Geen spelers gevonden.'); else await voegToe(ctx, r.spelers); }
      catch (e){ console.error('[toernooi] excel', e); meld('Het Excel-bestand kon niet gelezen worden. Probeer CSV of plakken.'); }
      return true;
    }
    await importeer(ctx, await f.text()); return true;
  }
  if (el.matches('[data-tn-pveld]')){
    const pid = el.dataset.tnPveld, set = new Set(t.poules?.[pid]?.velden || []);
    el.checked ? set.add(el.value) : set.delete(el.value);
    await ctx.zet({ [`toernooi.poules.${pid}.velden`]: [...set] }); return true;
  }
  if (el.matches('[data-tn-groep]')){
    const set = new Set(T.opzet(t).groepOp); el.checked ? set.add(el.dataset.tnGroep) : set.delete(el.dataset.tnGroep);
    await ctx.zet({ 'toernooi.groepOp': Object.keys(T.GROEP_OP).filter(k => set.has(k)) }); return true;
  }
  if (el.matches('[data-tn-bron]')){
    const tid = el.dataset.tnBron, set = new Set(t.teams?.[tid]?.eisen?.bron || []);
    el.checked ? set.add(el.value) : set.delete(el.value);
    await ctx.zet({ [`toernooi.teams.${tid}.eisen.bron`]: [...set] }); return true;
  }
  if (el.matches('[data-tn-erbij]')){
    if (el.value) await ctx.zet({ [`toernooi.spelers.${el.value}.tt`]: el.dataset.tnErbij }); return true;
  }
  if (el.matches('[data-tn-clubteam]')){
    const cid = el.dataset.tnClubteam, pid = el.value; if (!pid) return true;
    const club = t.clubs?.[cid], n = Object.values(t.teams || {}).filter(tm => tm.club === cid).length;
    await ctx.zet({ [`toernooi.teams.${T.nieuwId('t')}`]: { naam: `${club?.naam || 'Team'}${n ? ' ' + (n + 1) : ''}`.slice(0, 40), poule: pid === '-' ? '' : pid, club: cid, volg: T.volgende(t.teams), gast: true, eisen: {} } });
    return true;
  }
  if (el.matches('[data-tn-filter]')){ st.teamFilter = el.value; ctx.herteken(); return true; }
  if (el.matches('[data-tn-pp]')) return true;
  return false;
}
export function invoerToernooi(ctx, el){
  if (!el.matches('[data-tn-zoek]')) return false;
  st.zoek = el.value;
  clearTimeout(invoerToernooi._t);
  invoerToernooi._t = setTimeout(() => { ctx.herteken(); const z = ctx.el.querySelector('[data-tn-zoek]'); if (z){ z.focus(); z.setSelectionRange(z.value.length, z.value.length); } }, 250);
  return true;
}
export function resetToernooi(){ st.sub = 'opzet'; st.zoek = ''; st.gekozen = ''; st.teamFilter = ''; st.waarsch = null; st.club = null; st.clubLaden = null; st.qrVoor = ''; st.qrSvg = ''; }

/* Excel (.xlsx) lezen met de meegeleverde ExcelJS (zelfde bestand als de export van Evaluaties). */
let _excel = null;
function laadScript(src, test){
  if (test()) return Promise.resolve();
  return new Promise((ok, mis) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mis(new Error('laden mislukt: ' + src)); document.head.appendChild(s); });
}
async function excelRijen(bestand){
  await (_excel ||= laadScript('vendor/exceljs.min.js', () => !!window.ExcelJS).catch(e => { _excel = null; throw e; }));
  const wb = new window.ExcelJS.Workbook(); await wb.xlsx.load(await bestand.arrayBuffer());
  const ws = wb.worksheets[0], rijen = [];
  ws?.eachRow(rij => { const r = []; rij.eachCell({ includeEmpty: true }, (cel, k) => { const v = cel.value; r[k - 1] = v instanceof Date ? v.toISOString().slice(0, 10) : v && typeof v === 'object' ? String(v.text ?? v.result ?? '') : String(v ?? ''); }); rijen.push(Array.from(r, x => x ?? '')); });
  return rijen;
}

/* ---------- live pagina, QR en mededelingen ---------- */
/* Een logo of foto klein maken (wit vlak eronder, jpg) tot het in het document past. */
async function kleinPlaatje(bestand){
  const url = URL.createObjectURL(bestand);
  try {
    const img = await new Promise((ok, mis) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mis; i.src = url; });
    for (const [maat, kw] of [[640, .82], [520, .78], [420, .72], [320, .68], [240, .6]]){
      const f = Math.min(1, maat / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * f)); c.height = Math.max(1, Math.round(img.naturalHeight * f));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      const uit = c.toDataURL('image/jpeg', kw); if (uit.length <= T.MAX_PLAATJE) return uit;
    }
    return '';
  } finally { URL.revokeObjectURL(url); }
}
export const liveLink = (id, tv) => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}?live=${encodeURIComponent(id)}${tv ? '&tv=1' : ''}`;
let _qr = null;
async function qrSvg(tekst){
  await (_qr ||= laadScript('vendor/qrcode.js', () => typeof window.qrcode === 'function').catch(e => { _qr = null; throw e; }));
  const q = window.qrcode(0, 'M'); q.addData(tekst); q.make();
  return q.createSvgTag({ cellSize: 6, margin: 12, scalable: true });
}
function htmlLive(ctx, a, t){
  const aan = t.live === true && t.liveId, link = aan ? liveLink(t.liveId) : '';
  if (aan && st.qrVoor !== t.liveId){ st.qrVoor = t.liveId; st.qrSvg = ''; qrSvg(link).then(svg => { st.qrSvg = svg; ctx.herteken(); }).catch(() => { st.qrSvg = ''; }); }
  const med = T.mededelingen(t), sch = T.schermen(t, { leeg: true }), vol = Object.keys(t.schermen || {}).length >= T.MAX_SCHERMEN;
  return `<div class="ac-paneel"><h3>Live pagina</h3><p class="ac-zacht">Iedereen met de link of de QR-code ziet het speelschema, de uitslagen, de stand, de kleedkamers en je mededelingen. Zonder account, en zonder namen van spelers. De pagina werkt zichzelf bij.</p>
      ${aan ? `<div class="tn-live"><div class="tn-qr">${st.qrSvg || '<span class="ac-zacht">QR-code maken…</span>'}</div>
          <div class="tn-live-t"><input class="ac-in" readonly value="${esc(link)}" aria-label="Link naar de live pagina" onfocus="this.select()">
            <div class="ac-acties"><button class="knop vol klein" data-tn="live-kopieer">Link kopiëren</button><a class="knop licht klein" href="${esc(ctx.waLink(`${a.naam}: volg het schema en de stand live op ${link}`))}" target="_blank" rel="noopener">WhatsApp</a>
              <a class="knop licht klein" href="${esc(link)}" target="_blank" rel="noopener">Openen</a><button class="knop licht klein" data-tn="qr-print">QR-poster printen</button></div>
            <p class="ac-zacht"><b>Op tv of beamer:</b> open de tv-weergave in de kantine. Grote letters, wisselt vanzelf tussen wedstrijden en standen.</p>
            <div class="ac-acties"><a class="knop licht klein" href="${esc(liveLink(t.liveId, true))}" target="_blank" rel="noopener">Tv-weergave openen</a><button class="knop licht klein" data-tn="live-kopieer" data-tv="1">Tv-link kopiëren</button><span class="ac-groei"></span><button class="knop licht klein" data-tn="live-uit">Live uitzetten</button></div></div></div>`
        : `<div class="ac-acties"><button class="knop vol" data-tn="live-aan">Live pagina aanzetten</button></div>${t.liveId ? '<p class="ac-zacht">De live pagina staat uit. Aanzetten geeft dezelfde link en QR-code als eerst.</p>' : ''}`}</div>
    <div class="ac-paneel"><h3>Mededelingen</h3><p class="ac-zacht">Bijvoorbeeld: "Finales beginnen 10 minuten later" of "Prijsuitreiking om 12:30 in de kantine". Staat meteen bovenaan de live pagina en loopt mee op tv.</p>
      <div class="ac-rij"><input class="ac-in ac-groei" data-tn-med maxlength="280" placeholder="Typ een mededeling"><button class="knop vol klein" data-tn="med-stuur">Plaatsen</button></div>
      ${med.map(m => `<div class="ac-rij"><span class="ac-tijd">${esc(new Date(m.ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))}</span><span class="ac-groei">${esc(m.tekst)}</span><button class="ac-x" data-tn="med-weg" data-id="${esc(m.id)}" aria-label="Weg">✕</button></div>`).join('') || '<p class="ac-zacht">Nog geen mededelingen.</p>'}
      <p class="ac-zacht">Coaches van eigen teams bereik je ook via de tab Communicatie (Berichten en WhatsApp).</p></div>
    <div class="ac-paneel"><h3>Sponsoren en eigen schermen</h3><p class="ac-zacht">Sponsoren staan met hun logo op de tv en onderaan de live pagina. Een eigen scherm is een dia met titel, tekst en eventueel een afbeelding, bijvoorbeeld het menu van de kantine, de loterij of de huisregels. Op tv wisselen ze af met de standen.</p>
      ${sch.map(x => `<div class="tn-scherm"><label class="tn-plaatje" title="Afbeelding kiezen">${x.img ? `<img src="${esc(x.img)}" alt="">` : `<span>${x.soort === 'sponsor' ? 'Logo' : 'Afbeelding'}</span>`}<input type="file" accept="image/*" data-tn-plaatje="${esc(x.id)}" hidden></label>
          <div class="tn-scherm-v"><div class="ac-rij"><span class="ac-zacht">${x.soort === 'sponsor' ? 'Sponsor' : 'Scherm'}</span>${veld(`schermen.${x.id}.titel`, x.titel, { klasse: 'ac-groei vet', ph: x.soort === 'sponsor' ? 'Naam van de sponsor' : 'Titel', extra: 'maxlength="60"' })}<button class="ac-x" data-tn="scherm-weg" data-id="${esc(x.id)}" aria-label="Weg">✕</button></div>
            ${veld(`schermen.${x.id}.tekst`, x.tekst, { ph: x.soort === 'sponsor' ? 'Korte tekst (mag leeg blijven)' : 'Tekst op het scherm', extra: 'maxlength="240"' })}
            ${x.soort === 'sponsor' ? veld(`schermen.${x.id}.link`, x.link, { ph: 'Website (mag leeg blijven)', extra: 'maxlength="200" inputmode="url"' }) : ''}
            <div class="ac-rij"><label class="ac-schak"><input type="checkbox" data-veld="toernooi.schermen.${esc(x.id)}.tv" data-bool ${x.tv ? 'checked' : ''}> Op tv</label><label class="ac-schak"><input type="checkbox" data-veld="toernooi.schermen.${esc(x.id)}.tel" data-bool ${x.tel ? 'checked' : ''}> Op de live pagina</label>${x.img ? `<span class="ac-groei"></span><button class="knop licht klein" data-tn="scherm-plaatje-weg" data-id="${esc(x.id)}">Afbeelding weg</button>` : ''}</div></div></div>`).join('') || '<p class="ac-zacht">Nog geen sponsoren of schermen.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-tn="scherm-nieuw" data-id="sponsor" ${vol ? 'disabled' : ''}>${ico('action-add', 16)} Sponsor</button><button class="knop licht klein" data-tn="scherm-nieuw" data-id="scherm" ${vol ? 'disabled' : ''}>${ico('action-add', 16)} Eigen scherm</button>${vol ? `<span class="ac-zacht">Maximaal ${T.MAX_SCHERMEN}.</span>` : ''}</div></div>`;
}
/* Na elke wijziging aan het toernooi de live-kopie bijwerken (kort gebundeld). */
let _liveT = null;
export function planLive(ctx){
  clearTimeout(_liveT);
  _liveT = setTimeout(async () => {
    const a = ctx.actNu(), t = a?.toernooi;
    if (!t || t.live !== true || !t.liveId) return;
    try { await setDoc(doc(db, 'toernooiLive', t.liveId), { club: ctx.clubId, actId: ctx.actId, open: true, ...T.liveKopie(a, { clubNaam: S.club?.naam || '' }), bijgewerktMs: Date.now() }); }
    catch (e){ console.warn('[toernooi] live bijwerken', e); }
  }, 600);
}

/* ---------- export ---------- */
export function exportKnoppen(a){
  if (!a.toernooi) return '';
  return `<button data-exp="tn-csv-schema">${ico('admin-file', 22)}<b>Speelschema (Excel/CSV)</b></button>
    <button data-exp="tn-csv-teams">${ico('admin-file', 22)}<b>Teams en spelers (Excel/CSV)</b></button>
    <button data-exp="tn-csv-stand">${ico('admin-file', 22)}<b>Stand (Excel/CSV)</b></button>
    <button data-exp="tn-pdf">${ico('admin-download', 22)}<b>Speelschema en teams (PDF)</b></button>`;
}
export function exporteerToernooi(ctx, soort){
  const t = ctx.act.toernooi || {};
  if (soort === 'tn-csv-schema') return ctx.download(ctx.bestandsnaam('csv', 'schema'), T.csvSchema(t), 'text/csv;charset=utf-8'), true;
  if (soort === 'tn-csv-teams') return ctx.download(ctx.bestandsnaam('csv', 'teams'), T.csvTeams(t), 'text/csv;charset=utf-8'), true;
  if (soort === 'tn-csv-stand') return ctx.download(ctx.bestandsnaam('csv', 'stand'), T.csvStand(t), 'text/csv;charset=utf-8'), true;
  if (soort === 'tn-pdf') return ctx.printen(printHtml(ctx.act)), true;
  return false;
}
function printHtml(a){
  const t = a.toernooi || {}, vj = T.veldjes(t), schema = t.schema || [], kk = T.planKleedkamers(t), rooster = T.teamRooster(t);
  const tijden = [...new Set(schema.map(w => w.t))].sort((x, y) => T.naarMin(x) - T.naarMin(y));
  const op = Object.fromEntries(schema.map(w => [`${w.t}|${w.v}`, w]));
  const kn = id => t.kk?.[t.teams?.[id]?.kk || kk.kk[id]]?.naam || '';
  return `<h1>${esc(a.naam)}: speelschema</h1><div class="sub">${esc([a.datum ? new Date(a.datum + 'T12:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '', a.locatie].filter(Boolean).join(' · '))}</div>
    <table><thead><tr><th>Tijd</th>${vj.map(v => `<th>${esc(v.naam)}</th>`).join('')}</tr></thead><tbody>${tijden.map(ti => `<tr><td><b>${esc(ti)}</b></td>${vj.map(v => { const w = op[`${ti}|${v.id}`]; return `<td>${w ? `${esc(naamTeam(t, w.a))} – ${esc(naamTeam(t, w.b))}<br><small>${esc(t.poules?.[w.p]?.naam || '')}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
    <h2>Teams</h2><table><thead><tr><th>Team</th><th>Poule</th><th>Kleedkamer</th><th>Eerste</th><th>Klaar</th><th>Spelers</th></tr></thead><tbody>
    ${T.gesorteerd(t.teams).map(tm => `<tr><td><b>${esc(tm.naam)}</b></td><td>${esc(t.poules?.[tm.poule]?.naam || '')}</td><td>${esc(kn(tm.id))}</td><td>${esc(rooster[tm.id]?.eerste || '')}</td><td>${esc(rooster[tm.id]?.laatste || '')}</td>
      <td>${Object.values(t.spelers || {}).filter(s => s.tt === tm.id).map(s => esc(s.naam)).join(', ')}</td></tr>`).join('')}</tbody></table>
    ${T.gesorteerd(t.poules).map(p => { const r = T.stand(t, p.id); return r.some(x => x.g) ? `<h2>Stand ${esc(p.naam)}</h2><table><thead><tr><th></th><th>Team</th><th>G</th><th>W</th><th>GL</th><th>V</th><th>DS</th><th>P</th></tr></thead><tbody>${r.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.naam)}</td><td>${x.g}</td><td>${x.w}</td><td>${x.gl}</td><td>${x.v}</td><td>${x.saldo}</td><td><b>${x.pnt}</b></td></tr>`).join('')}</tbody></table>` : ''; }).join('')}`;
}

/* ---------- stijl ---------- */
export const TOERNOOI_CSS = `
.tn-scherm{display:flex;gap:var(--space-md);align-items:flex-start;padding:10px 0;border-top:1px solid var(--hair)}
.tn-plaatje{width:96px;height:72px;flex-shrink:0;border-radius:10px;background:#fff;border:1.5px dashed var(--hair);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:#667;font-size:var(--t-xs,12px)}
.tn-plaatje img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.tn-scherm-v{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.tn-scherm-v .ac-rij{flex-wrap:wrap}
.tn-clubrij{flex-wrap:wrap}
@media (max-width:600px){.tn-clubrij>.ac-in:first-child{flex:1 1 100%}.tn-clubrij>select{flex:1 1 0;min-width:0}}
.tn-sub{flex-wrap:wrap}
.tn-rij{display:flex;flex-wrap:wrap;gap:var(--space-xs) var(--space-sm);align-items:flex-end}
.tn-rij > label{display:flex;flex-direction:column;gap:2px;font-size:var(--t-xs);color:var(--ink-2)}
.tn-rij > label.ac-schak{flex-direction:row;align-items:center;font-size:var(--t-sm);color:var(--ink)}
.tn-rij input[type=time]{min-width:120px}
.tn-poule{border-left:4px solid var(--pk);padding:6px 0 8px 10px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid var(--hair)}
.tn-kleur{width:34px;height:34px;border:0;padding:0;background:none;border-radius:8px;flex-shrink:0}
.tn-stip{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--pk);flex-shrink:0;margin-right:4px}
.tn-h4{margin:10px 0 2px;font-size:var(--t-sm);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
.tn-sp .tn-g{width:64px;flex:0 0 64px}
.tn-fout{border-color:var(--uit)!important}
.ac-chip.tn-fout{background:color-mix(in srgb,var(--uit) 12%,var(--card))}
.tn-waarsch{color:var(--uit);font-size:var(--t-xs);margin:0 0 4px}
.tn-team{border-left:4px solid var(--pk)}
.tn-team summary{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;cursor:pointer;min-height:36px}
.tn-team summary .ac-zacht{font-size:var(--t-xs);width:100%}
.tn-grid-buiten{overflow-x:auto;margin:0 calc(-1 * var(--space-sm));padding:0 var(--space-sm)}
.tn-grid{border-collapse:separate;border-spacing:4px;min-width:100%}
.tn-grid th{font-size:var(--t-xs);color:var(--ink-2);font-weight:600;text-align:left;white-space:nowrap;padding:2px 4px}
.tn-grid tbody th{position:sticky;left:0;background:var(--card);font-variant-numeric:tabular-nums}
.tn-cel{width:100%;min-width:118px;min-height:52px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;padding:4px 8px;border-radius:8px;background:var(--surface-2,var(--hair));color:var(--ink-2);text-align:left;font-size:var(--t-xs);border:2px solid transparent}
.tn-cel.vol{background:color-mix(in srgb,var(--pk) 14%,var(--card));color:var(--ink);border-left:4px solid var(--pk)}
.tn-cel b{font-weight:600;font-size:var(--t-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.tn-cel.gekozen{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 30%,transparent)}
.tn-cel.dim{opacity:.3}
.tn-twee{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:var(--space-sm);align-items:start}
.tn-standen{display:flex;flex-direction:column;gap:var(--space-sm)}
.tn-uit{display:grid;grid-template-columns:70px minmax(0,1fr) 54px 10px 54px minmax(0,1fr);gap:6px;align-items:center;border-left:4px solid var(--pk);padding:4px 0 4px 8px}
.tn-uit-v{font-size:var(--t-xs);color:var(--ink-2)}
.tn-uit-a{text-align:right;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tn-uit-b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tn-score{text-align:center;padding:6px 4px}
.tn-stand{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
.tn-stand th,.tn-stand td{padding:4px 6px;border-bottom:1px solid var(--hair);text-align:center}
.tn-stand td:nth-child(2),.tn-stand th:nth-child(2){text-align:left}
.tn-live{display:flex;gap:var(--space-md);align-items:flex-start;flex-wrap:wrap}
.tn-qr{width:180px;flex-shrink:0;background:#fff;border-radius:12px;padding:6px;min-height:180px;display:flex;align-items:center;justify-content:center}
.tn-qr svg{width:100%;height:auto;display:block}
.tn-live-t{flex:1 1 260px;display:flex;flex-direction:column;gap:8px;min-width:0}
@media (max-width:720px){
  .tn-twee{grid-template-columns:1fr}
  .tn-uit{grid-template-columns:minmax(0,1fr) 48px 8px 48px minmax(0,1fr)}
  .tn-uit-v{display:none}
}`;
