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
import { db, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, deleteField, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261130f';
import { ico } from './icons.js?v=20261127b';
import * as T from './toernooi-logica.js?v=20261127v';
import * as C from './toernooi-controle.js?v=20261127v';
import { kleinPlaatje } from './plaatje.js?v=20261127v';

const clubInfo = () => ({ clubNaam: S.club?.naam || '', logo: S.club?.instellingen?.identiteit?.logo || '', kleur: S.club?.instellingen?.identiteit?.kleur || '' });
const opt = (w, t, sel) => `<option value="${esc(w)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
const SUB = [['opzet', 'Opzet'], ['inschrijven', 'Inschrijven'], ['spelers', 'Spelers'], ['teams', 'Teams'], ['schema', 'Schema'], ['kk', 'Kleedkamers'], ['uitslagen', 'Uitslagen'], ['live', 'Live']];
const st = { sub: 'opzet', zoek: '', gekozen: '', teamFilter: '', club: null, clubLaden: null, voorstel: null, scoreT: {}, sleep: '', ctx: null };

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
  st.ctx = ctx; koppelSlepen(ctx.el);
  if (!st.club && !st.clubLaden) laadClub(ctx.clubId).then(() => ctx.herteken());
  const inhoud = { opzet: htmlOpzet, spelers: htmlSpelers, teams: htmlTeams, schema: htmlSchema, kk: htmlKk, uitslagen: htmlUitslagen, live: htmlLive, inschrijven: htmlInschrijven }[st.sub] || htmlOpzet;
  const nT = Object.keys(t.teams || {}).length, nS = Object.keys(t.spelers || {}).length, nW = (t.schema || []).length;
  st.controle = C.controleer(t, controleOpties(a));
  return `<div class="ac-balkje"><div class="ac-schakel tn-sub">${SUB.map(([id, n]) => `<button class="${st.sub === id ? 'aan' : ''}" data-tn="sub" data-id="${id}">${n}</button>`).join('')}</div></div>
    ${htmlControleBalk(t, st.controle)}
    <p class="ac-zacht">${[`${Object.keys(t.velden || {}).length} ${Object.keys(t.velden || {}).length === 1 ? 'veld' : 'velden'}`, `${nS} spelers`, `${nT} teams`, nW ? `${nW} wedstrijden, ${T.gespeeld(t)} gespeeld` : 'nog geen schema'].join(' · ')}</p>
    ${inhoud(ctx, a, t)}`;
}

/* ---------- controle en proefdraaien [20261127s] (rekenwerk in toernooi-controle.js) ---------- */
const controleOpties = a => ({ blokken: st.club?.blokken || null, datum: a?.datum || '', clubVelden: st.club?.velden || null, programma: a?.programma || null });
const aiAan = () => S.club?.platformModules?.ai === true;
const TAB_NAAM = Object.fromEntries(SUB);
const NIV_ICO = { fout: '⛔', waarsch: '⚠️', tip: '💡' };
function htmlControleBalk(t, lijst){
  const n = C.telling(lijst), heeftSchema = (t.schema || []).length > 0, eerste = lijst.find(p => p.niveau !== 'tip');
  const kop = n.fout ? `${n.fout} ${n.fout === 1 ? 'fout' : 'fouten'} in de planning${n.waarsch ? `, ${n.waarsch} om op te letten` : ''}`
    : n.waarsch ? `Geen fouten, wel ${n.waarsch} ${n.waarsch === 1 ? 'punt' : 'punten'} om op te letten` : `Geen fouten gevonden${n.tip ? ` · ${n.tip} ${n.tip === 1 ? 'tip' : 'tips'}` : ''}`;
  return `<div class="tn-ctrl ${n.fout ? 'fout' : n.waarsch ? 'waarsch' : 'ok'}" role="status"><span class="tn-ctrl-ico" aria-hidden="true">${n.fout ? '⛔' : n.waarsch ? '⚠️' : '✓'}</span>
    <span class="tn-ctrl-t"><b>${esc(kop)}</b>${eerste ? `<small>${esc(eerste.tekst)}</small>` : '<small>Cluppie controleert de indeling, het schema, de finales en de kleedkamers terwijl je plant.</small>'}</span>
    <span class="tn-ctrl-k">${lijst.length ? `<button class="knop licht klein" data-tn="controle">Bekijk ${lijst.length === 1 ? 'punt' : `alle ${lijst.length}`}</button>` : ''}
    <button class="knop vol klein" data-tn="proef" ${heeftSchema ? '' : 'disabled title="Maak eerst het schema"'}>▶ Proefdraaien</button></span></div>`;
}
const htmlPunt = (p, { hoeVaak = 0, keer = 0, knop = true } = {}) => `<div class="tn-punt ${p.niveau}"><span class="tn-punt-i" title="${esc(C.NIVEAUS[p.niveau])}">${NIV_ICO[p.niveau]}</span>
  <span class="ac-groei"><small class="tn-punt-g">${esc(C.NIVEAUS[p.niveau])} · ${esc(p.groep)}${hoeVaak && keer ? ` · ${hoeVaak >= keer ? 'elke keer' : `${hoeVaak} van de ${keer} keer`}` : ''}</small>${esc(p.tekst)}</span>
  ${knop && p.tab && TAB_NAAM[p.tab] ? `<button class="knop licht klein" data-tn="ga" data-id="${esc(p.tab)}">Naar ${esc(TAB_NAAM[p.tab])}</button>` : ''}</div>`;
function htmlControleVenster(){
  const a = st.ctx?.actNu?.() || st.ctx?.act || {}, t = a.toernooi || {}, lijst = C.controleer(t, controleOpties(a)), n = C.telling(lijst);
  const ai = st.ai, aiDeel = !aiAan() ? '<p class="ac-zacht">AI laten meekijken kan als AI voor de club aan staat (instelling van de eindbaas).</p>'
    : `<div class="ac-paneel tn-ai"><h3>🤖 AI laten meekijken</h3><p class="ac-zacht">De vaste regels hierboven zijn altijd leidend. De AI kijkt daarnaast naar wat regels niet zien: zijn de poules eerlijk verdeeld (bijvoorbeeld JO11-1 en JO11-2 niet samen), past het programma bij de leeftijd, hoe lang wachten teams. Alleen team- en poulenamen en tijden gaan mee, geen spelers.</p>
      ${st.aiBezig ? `<p>${ico('action-loading', 16)} Even kijken…</p>` : ai ? `${ai.punten.map(p => htmlPunt(p, { knop: false })).join('') || '<p class="ac-zacht">De AI ziet niets bijzonders.</p>'}
        ${ai.indeling.length ? `<h4 class="tn-h4">Voorstel voor de indeling</h4>${ai.indeling.map((x, i) => `<div class="ac-rij tn-punt tip"><span class="ac-groei"><b>${esc(naamTeam(t, x.team))}</b> naar <b>${esc(t.poules?.[x.poule]?.naam || '?')}</b><small class="ac-zacht"> ${esc(x.waarom)}</small></span><button class="knop licht klein" data-tn="ai-zet" data-id="${i}">Toepassen</button></div>`).join('')}
          <div class="ac-acties"><button class="knop licht klein" data-tn="ai-zet" data-id="alles">Alles toepassen</button><span class="ac-zacht">${(t.schema || []).length ? 'Het schema wordt daarna opnieuw gepland.' : ''}</span></div>` : ''}
        <div class="ac-acties"><button class="knop licht klein" data-tn="ai-controle">Opnieuw laten kijken</button></div>`
      : '<div class="ac-acties"><button class="knop licht klein" data-tn="ai-controle">Laat AI meekijken</button></div>'}</div>`;
  return `<h2>Controle van de planning</h2>
    <p class="ac-zacht">${lijst.length ? `${n.fout} ${n.fout === 1 ? 'fout' : 'fouten'}, ${n.waarsch} om op te letten, ${n.tip} ${n.tip === 1 ? 'tip' : 'tips'}.` : 'Geen fouten gevonden in de opzet, de indeling, het schema, de finales en de kleedkamers.'} Wil je zien hoe de dag loopt? Gebruik Proefdraaien.</p>
    ${lijst.map(p => htmlPunt(p)).join('')}
    ${aiDeel}
    <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Sluiten</button><span class="ac-groei"></span><button class="knop vol" data-tn="proef" ${(t.schema || []).length ? '' : 'disabled'}>▶ Proefdraaien</button></div>`;
}
function htmlProefVenster(){
  const a = st.ctx?.actNu?.() || st.ctx?.act || {}, t = a.toernooi || {}, o = T.opzet(t);
  const r = C.proefdraaien(t, { keer: 150, zaad: st.zaad || 1, opties: controleOpties(a) });
  if (!r.voorbeeld) return `<h2>Proefdraaien</h2><p>Maak eerst het schema, dan kan Cluppie het toernooi naspelen.</p><div class="ac-acties"><button class="knop vol" data-ac="venster-dicht">Sluiten</button></div>`;
  const ernstig = [...r.problemen, ...r.controle].filter(p => p.niveau !== 'tip'), v = r.voorbeeld, s = r.stats, sim = { ...t, uitslag: v.uitslag };
  const vj = Object.fromEntries(T.veldjes(t).map(x => [x.id, x.naam])), laat = o.eind && s.prijs && T.naarMin(s.prijs.tot) > T.naarMin(o.eind);
  const medaille = x => `${['🥇', '🥈', '🥉'][x.plaats - 1] || x.plaats + '.'} ${esc(naamTeam(t, x.id))}`;
  const bomen = T.koGroepen(t).map(g => T.boomHtml(v.schema.filter(w => w.ko === g.id), { esc, naam: (w, z) => naamW(t, w, z), veld: w => vj[w.v] || '', uitslag: w => v.uitslag[w.id], kop: g.naam || 'Finales' })).join('');
  const tijden = [...new Set(v.schema.map(w => w.t))].sort((x, y) => T.naarMin(x) - T.naarMin(y));
  return `<h2>Proefdraaien</h2>
    <p class="ac-zacht">Cluppie heeft het toernooi ${r.keer} keer gespeeld met willekeurige uitslagen, met doorschuiven naar de finales tot en met de prijsuitreiking. Er is niets opgeslagen.</p>
    <div class="tn-ctrl ${ernstig.some(p => p.niveau === 'fout') ? 'fout' : ernstig.length ? 'waarsch' : 'ok'}"><span class="tn-ctrl-ico">${ernstig.some(p => p.niveau === 'fout') ? '⛔' : ernstig.length ? '⚠️' : '✓'}</span>
      <span class="tn-ctrl-t"><b>${ernstig.length ? `${ernstig.length} ${ernstig.length === 1 ? 'probleem' : 'problemen'} gevonden` : 'Alles loopt goed, van de eerste wedstrijd tot de prijsuitreiking'}</b></span></div>
    ${r.problemen.map(p => htmlPunt(p, { hoeVaak: p.hoeVaak, keer: r.keer })).join('')}
    ${r.controle.length ? `<details class="tn-details" ${r.problemen.length ? '' : 'open'}><summary>Uit de controle (${r.controle.length})</summary>${r.controle.map(p => htmlPunt(p)).join('')}</details>` : ''}
    <h3>Zo kan de dag lopen</h3>
    <div class="ac-chips"><span class="ac-chip aan">${s.wedstrijden} wedstrijden${s.finales ? `, waarvan ${s.finales} ${s.finales === 1 ? 'finale' : 'finalewedstrijden'}` : ''}</span><span class="ac-chip aan">${esc(s.begin)} – ${esc(s.eind)}</span>
      ${s.prijs ? `<span class="ac-chip ${laat ? 'tn-fout' : 'aan'}">🏆 Prijsuitreiking ${esc(s.prijs.van)}–${esc(s.prijs.tot)}${laat ? ` (na ${esc(o.eind)})` : ''}</span>` : ''}
      <span class="ac-chip aan">Elk team ${s.minPoule === s.maxPoule ? s.minPoule : `${s.minPoule} tot ${s.maxPoule}`} poulewedstrijden</span></div>
    ${v.podia.filter(p => p.plaatsen.length).map(p => `<p class="bm-podium">${esc(p.naam)}: ${p.plaatsen.slice(0, 3).map(medaille).join(' ')}</p>`).join('')}
    ${v.winnaars.map(w => `<p class="bm-podium">${esc(w.naam)}: ${w.stand.slice(0, 3).map((x, i) => medaille({ plaats: i + 1, id: x.id })).join(' ')}</p>`).join('')}
    ${bomen ? `<div class="ac-paneel">${bomen}</div>` : ''}
    <details class="tn-details"><summary>Standen na de poules</summary><div class="tn-standen">${T.gesorteerd(t.poules).map(p => { const rij = T.stand(sim, p.id); return rij.length ? `<div><b>${esc(p.naam)}</b><table class="tn-stand"><tbody>${rij.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.naam)}</td><td>${x.g}</td><td>${x.saldo > 0 ? '+' : ''}${x.saldo}</td><td><b>${x.pnt}</b></td></tr>`).join('')}</tbody></table></div>` : ''; }).join('')}</div></details>
    <details class="tn-details"><summary>Alle wedstrijden met de uitslagen van deze proef</summary>${tijden.map(tijd => `<h4 class="tn-h4">${esc(tijd)}</h4>${v.schema.filter(w => w.t === tijd).map(w => { const u = v.uitslag[w.id];
      return `<div class="ac-rij tn-proefrij"><span class="ac-zacht">${esc(vj[w.v] || '')}</span><span class="ac-groei">${w.ko ? `<i>${esc(T.koTitel(t, w))}</i> ` : ''}${esc(naamW(t, w, 'a'))} – ${esc(naamW(t, w, 'b'))}</span><b>${u ? `${u.a}–${u.b}${u.w ? ' (pen.)' : ''}` : '—'}</b></div>`; }).join('')}`).join('')}
      ${s.prijs ? `<h4 class="tn-h4">${esc(s.prijs.van)}</h4><p>🏆 Prijsuitreiking</p>` : ''}</details>
    <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Sluiten</button><span class="ac-groei"></span><button class="knop licht" data-tn="proef-nog">Nog een keer</button></div>`;
}
/* AI kijkt mee (functions: toernooiControleAI). Alleen als AI aan staat voor de club. */
async function aiControle(ctx){
  const a = ctx.actNu?.() || ctx.act, t = a.toernooi || {};
  st.aiBezig = true; st.ai = null; ctx.venster(htmlControleVenster);
  try {
    const r = await httpsCallable(functions, 'toernooiControleAI')({ clubId: ctx.clubId, samenvatting: C.aiSamenvatting(t, C.controleer(t, controleOpties(a)), { naam: a.naam, datum: a.datum }) });
    st.ai = C.schoonAiAntwoord(r.data, t);
  } catch (e){
    console.error('[toernooi] ai', e);
    meld(e?.code === 'functions/failed-precondition' ? 'AI staat uit voor deze club.' : e?.code === 'functions/resource-exhausted' ? 'De AI-limiet van deze maand is bereikt.' : e?.code === 'functions/not-found' ? 'De AI-controle is nog niet uitgerold.' : 'De AI kon nu niet meekijken. Probeer het zo opnieuw.');
  }
  st.aiBezig = false; ctx.venster(htmlControleVenster);
}
async function aiIndeling(ctx, welke){
  const a = ctx.actNu?.() || ctx.act, t = a.toernooi || {}, lijst = (st.ai?.indeling || []).filter((x, i) => welke === 'alles' || String(i) === welke)
    .filter(x => t.teams?.[x.team] && t.poules?.[x.poule]);
  if (!lijst.length) return;
  const teams = Object.fromEntries(Object.entries(t.teams).map(([id, x]) => [id, { ...x }])), patch = {};
  for (const x of lijst){ teams[x.team].poule = x.poule; patch[`toernooi.teams.${x.team}.poule`] = x.poule; }
  const heeftUitslag = Object.values(t.uitslag || {}).some(T.heeftUitslag);
  if ((t.schema || []).length && !heeftUitslag){
    const r = T.planSchema({ ...t, teams });
    if (r.schema.length) Object.assign(patch, { 'toernooi.schema': r.schema, 'toernooi.uitslag': {}, 'toernooi.gepland': Date.now(), ...prijsInProgramma(a, T.prijsuitreiking({ ...t, teams, schema: r.schema })) });
  }
  st.ai.indeling = st.ai.indeling.filter(x => !lijst.includes(x));
  await ctx.zet(patch); ctx.venster(htmlControleVenster);
  meld(`${lijst.length} ${lijst.length === 1 ? 'team' : 'teams'} verplaatst${patch['toernooi.schema'] ? ', schema opnieuw gepland' : heeftUitslag ? '. Er staan al uitslagen: plan het schema zelf opnieuw' : ''}`);
}
/* Na het plannen meteen laten weten of er nog iets mis is. */
const naControle = (a, t) => { const n = C.telling(C.controleer(t, controleOpties(a))); return n.fout ? `. Let op: ${n.fout} ${n.fout === 1 ? 'fout' : 'fouten'}, zie bovenaan` : n.waarsch ? `. ${n.waarsch} ${n.waarsch === 1 ? 'punt' : 'punten'} om op te letten, zie bovenaan` : ''; };

const veld = (pad, waarde, { type = 'text', ph = '', klasse = '', extra = '' } = {}) =>
  `<input class="ac-in ${klasse}" type="${type}" data-veld="toernooi.${esc(pad)}" value="${esc(waarde ?? '')}" placeholder="${esc(ph)}" ${extra}>`;
const getal = (pad, waarde, extra = '') => veld(pad, waarde, { type: 'number', klasse: 'getal', extra: `data-num inputmode="numeric" ${extra}` });
const naamTeam = (t, id) => t.teams?.[id]?.naam || '?';
/* Naam van thuis (z = 'a') of uit ('b') in een wedstrijd; bij de knock-out zolang onbekend: "1e Poule A", "Winnaar HF1". */
const naamW = (t, w, z) => (w[z] && t.teams?.[w[z]]?.naam) || w['l' + z] || '?';
const kleurPoule = (t, id) => t.poules?.[id]?.kleur || '#999';

function htmlOpzet(ctx, a, t){
  const o = T.opzet(t), vj = T.veldjes(t), club = st.club;
  const velden = T.gesorteerd(t.velden), poules = T.gesorteerd(t.poules);
  const nogClub = (club?.velden || []).filter(v => !velden.some(x => x.clubVeld === v.id));
  const eind = (t.schema || []).length ? T.planSchema(t).eind : '';
  const conflicten = club && a.datum ? T.veldConflicten(club.blokken, { datum: a.datum, van: o.start, tot: eind || T.naarTijd(T.naarMin(o.start) + 240), velden: velden.map(v => v.clubVeld).filter(Boolean) }) : [];
  const pr = T.prijsuitreiking(t), nTeams = Object.keys(t.teams || {}).length;
  return `<div class="ac-paneel tn-auto"><h3>Tijden en automatisch indelen</h3><p class="ac-zacht">Geef alleen de teams op (tab Teams), de velden, en hoe laat het toernooi begint en klaar moet zijn. Cluppie maakt de poules, kiest de speeltijd en plant alle wedstrijden, de finales en de prijsuitreiking. Je ziet het voorstel eerst.</p>
      <div class="tn-rij"><label>Eerste wedstrijd ${veld('start', o.start, { type: 'time' })}</label><label>Klaar om ${veld('eind', o.eind, { type: 'time' })}</label><label>Prijsuitreiking (min) ${getal('prijs', o.prijs, 'min="0" max="120"')}</label></div>
      <div class="tn-rij"><label class="ac-schak"><input type="checkbox" data-veld="toernooi.autoKo" data-bool ${o.autoKo ? 'checked' : ''}> Met finales na de poules</label>
        <label class="ac-schak"><input type="checkbox" data-veld="toernooi.duurVast" data-bool ${o.duurVast ? 'checked' : ''}> Speeltijd vast op ${o.duur} minuten (anders kiest Cluppie de langste die past)</label></div>
      <div class="ac-acties"><button class="knop vol klein" data-tn="auto" ${nTeams >= 2 && velden.length && o.eind ? '' : 'disabled'}>Voorstel maken</button><span class="ac-zacht">${nTeams < 2 ? 'Voeg eerst teams toe bij Teams.' : !velden.length ? 'Kies hieronder eerst de velden.' : !o.eind ? 'Vul in hoe laat het klaar moet zijn.' : `${nTeams} teams, ${vj.length} ${vj.length === 1 ? 'veld' : 'velden'}`}</span></div></div>
    <div class="ac-paneel"><h3>Wie doen er mee</h3><p class="ac-zacht">Bepaalt de woorden in de planner, op de inschrijfpagina en op de live pagina. Kies Scholen voor een schooltoernooi en Bedrijven voor een bedrijventoernooi.</p>
      <select class="ac-in" data-veld="toernooi.deelnemers" aria-label="Wie doen er mee">${Object.entries(T.SOORTEN).map(([k, x]) => opt(k, x.naam, T.soort(t) === k)).join('')}</select></div>
    <div class="ac-paneel"><h3>Speeltijd</h3>
      <div class="tn-rij"><label>Speeltijd (min) ${getal('duur', o.duur, 'min="4" max="90"')}</label><label>Wisseltijd (min) ${getal('wissel', o.wissel, 'min="0" max="30"')}</label></div>
      <p class="ac-zacht">${(t.schema || []).length ? 'Verander je de eerste wedstrijd, dan schuift het hele schema mee.' : 'Klaar om is inclusief de prijsuitreiking. Prijsuitreiking 0 = geen.'}${pr ? ` Prijsuitreiking nu om <b>${esc(pr.van)}</b>, klaar om <b>${esc(pr.tot)}</b>.` : ''}${pr && o.eind && T.naarMin(pr.tot) > T.naarMin(o.eind) ? ` <b class="tn-waarsch">Dat is later dan ${esc(o.eind)}.</b>` : ''}</p>
      <label class="ac-schak"><input type="checkbox" data-veld="toernooi.rust" data-bool ${o.rust ? 'checked' : ''}> <span><b>Rust tussen wedstrijden</b><small class="ac-zacht"> Een team speelt liefst niet twee keer achter elkaar.</small></span></label></div>
    <div class="ac-paneel"><h3>Velden</h3><p class="ac-zacht">Splits een veld in twee of vier veldjes voor de kleintjes. Elk veldje speelt tegelijk.</p>
      ${velden.map(v => `<div class="ac-rij">${veld(`velden.${v.id}.naam`, v.naam, { klasse: 'ac-groei' })}
        <select class="ac-in smal" data-veld="toernooi.velden.${esc(v.id)}.delen" data-num>${[[1, 'Heel veld'], [2, 'Twee helften'], [4, 'Vier kwarten']].map(([n, l]) => opt(n, l, Number(v.delen || 1) === n)).join('')}</select>
        <button class="ac-x" data-tn="veld-weg" data-id="${esc(v.id)}" aria-label="Veld weg">✕</button></div>`).join('') || '<p class="ac-zacht">Nog geen velden.</p>'}
      <div class="ac-acties">${nogClub.length ? `<button class="knop licht klein" data-tn="velden-club">${ico('planning-week', 16)} Velden van de club (${nogClub.length})</button>` : ''}<button class="knop licht klein" data-tn="veld-nieuw">${ico('action-add', 16)} Veld</button></div>
      ${!club ? '<p class="ac-zacht">Velden van de club laden…</p>' : !club.velden.length ? '<p class="ac-zacht">De club heeft nog geen velden op de veldkaart, of je mag die niet zien. Voeg ze hier zelf toe.</p>' : ''}
      ${conflicten.length ? `<div class="ac-melding">${ico('action-warning', 18)} <span><b>Let op, in de Veldplanner staat op deze dag:</b> ${conflicten.map(b => `${esc(b.teamNaam || b.naam || b.team || 'een training')} ${esc(b.start)}–${esc(b.eind)} op ${esc(club.velden.find(v => v.id === String(b.veld))?.naam || 'een veld')}`).join('; ')}. Verplaats of laat afgelasten (Draaiboek, onderwerp Datum, plek en comité).</span></div>` : ''}</div>
    <div class="ac-paneel"><h3>Poules</h3><p class="ac-zacht">Een poule speelt iedereen tegen iedereen. Geef een poule eigen velden of een eigen begintijd, bijvoorbeeld de jongsten op de kwartvelden om 9:00.</p>
      ${poules.map(p => { const n = Object.values(t.teams || {}).filter(x => x.poule === p.id).length, mag = new Set(p.velden || []);
        return `<div class="tn-poule" style="--pk:${esc(p.kleur || '#999')}"><div class="ac-rij"><input class="tn-kleur" type="color" data-veld="toernooi.poules.${esc(p.id)}.kleur" value="${esc(p.kleur || '#999999')}" aria-label="Kleur">${veld(`poules.${p.id}.naam`, p.naam, { klasse: 'ac-groei vet' })}
          <span class="ac-zacht">${n} teams · ${n * (n - 1) / 2 * (p.dubbel ? 2 : 1)} wedstr.</span><button class="ac-x" data-tn="poule-weg" data-id="${esc(p.id)}" aria-label="Poule weg">✕</button></div>
          <div class="ac-chips">${vj.map(v => `<label class="ac-chip ${mag.has(v.id) ? 'aan' : ''}"><input type="checkbox" data-tn-pveld="${esc(p.id)}" value="${esc(v.id)}" ${mag.has(v.id) ? 'checked' : ''}> ${esc(v.naam)}</label>`).join('')}<span class="ac-zacht">${mag.size ? '' : 'Alle velden'}</span></div>
          <div class="tn-rij"><label>Begint om ${veld(`poules.${p.id}.start`, p.start && T.naarMin(p.start) > T.naarMin(o.start) ? p.start : o.start, { type: 'time' })}</label><label class="ac-schak"><input type="checkbox" data-veld="toernooi.poules.${esc(p.id)}.dubbel" data-bool ${p.dubbel ? 'checked' : ''}> Uit en thuis</label></div></div>`; }).join('') || '<p class="ac-zacht">Nog geen poules. Maak ze hier, of laat ze maken bij Teams › Voorstel.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-tn="poule-nieuw">${ico('action-add', 16)} Poule</button></div></div>
    ${htmlKoOpzet(t, poules)}`;
}

/* Na de poules: kruisfinales, finale en plaatsingswedstrijden per groep poules. */
function htmlKoOpzet(t, poules){
  const groepen = T.koGroepen(t);
  return `<div class="ac-paneel"><h3>Na de poules</h3><p class="ac-zacht">Kruisfinales, een finale en wedstrijden om de plaatsen. Kies welke poules samen een knock-out spelen, bijvoorbeeld Poule A en B: dan spelen 1A–2B en 1B–2A de halve finales. Cluppie plant ze na de laatste poulewedstrijd en vult de teams vanzelf in zodra de uitslagen er zijn.</p>
    ${groepen.map(g => { const ops = T.koOpzet(t, g), mag = new Set(g.poules);
      return `<div class="tn-ko" style="--pk:${esc(kleurPoule(t, g.poules[0]))}"><div class="ac-rij">${veld(`ko.${g.id}.naam`, g.naam, { klasse: 'ac-groei vet', ph: 'Bijvoorbeeld Finales O10', extra: 'maxlength="40"' })}
          <button class="ac-x" data-tn="ko-weg" data-id="${esc(g.id)}" aria-label="Knock-out weg">✕</button></div>
        <div class="ac-chips"><span class="ac-zacht">Poules:</span>${poules.map(p => `<label class="ac-chip ${mag.has(p.id) ? 'aan' : ''}"><input type="checkbox" data-tn-kop="${esc(g.id)}" value="${esc(p.id)}" ${mag.has(p.id) ? 'checked' : ''}> ${esc(p.naam)}</label>`).join('')}</div>
        <div class="tn-rij"><label>Knock-out <select class="ac-in" data-veld="toernooi.ko.${esc(g.id)}.ronde" data-num>${Object.entries(T.KO_RONDES).map(([n, l]) => opt(n, `${l} (${n} teams)`, Number(g.ronde || 4) === Number(n))).join('')}</select></label>
          <label>Begint om ${veld(`ko.${g.id}.start`, g.start || '', { type: 'time' })}</label></div>
        <div class="tn-rij"><label class="ac-schak"><input type="checkbox" data-veld="toernooi.ko.${esc(g.id)}.plaats3" data-bool ${g.plaats3 !== false ? 'checked' : ''}> Wedstrijd om plaats 3</label>
          <label class="ac-schak"><input type="checkbox" data-veld="toernooi.ko.${esc(g.id)}.overige" data-bool ${g.overige ? 'checked' : ''}> De andere teams spelen om de plaatsen (3A–3B, 4A–4B …)</label></div>
        <p class="ac-zacht">${ops.length ? `${ops.length} ${ops.length === 1 ? 'wedstrijd' : 'wedstrijden'}: ${esc(ops.map(w => `${T.koTitel(t, { ...w, ko: g.id }).split(' · ')[0]} (${T.bronTekst(t, w.ka)} – ${T.bronTekst(t, w.kb)})`).join(', '))}.` : 'Kies minstens één poule met twee of meer teams.'}${(t.schema || []).length && !(t.schema || []).some(w => w.ko === g.id) && ops.length ? ' <b>Plan het schema opnieuw om ze in te plannen.</b>' : ''}</p></div>`; }).join('')}
    <div class="ac-acties"><button class="knop licht klein" data-tn="ko-nieuw" ${poules.length ? '' : 'disabled'}>${ico('action-add', 16)} Knock-out toevoegen</button>${poules.length ? '' : '<span class="ac-zacht">Maak eerst poules.</span>'}</div></div>`;
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
  const teams = T.gesorteerd(t.teams), poules = T.gesorteerd(t.poules), o = T.opzet(t), SO = T.soortTekst(t);
  const bronnen = [...new Set(Object.values(t.spelers || {}).map(s => s.bron).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'nl', { numeric: true }));
  const fout = T.controleerTeams(t), nVrij = Object.values(t.spelers || {}).filter(s => !s.tt).length;
  return `<div class="ac-paneel"><h3>${ico('action-magic', 18)} Voorstel maken</h3><p class="ac-zacht">Cluppie deelt de spelers ${nVrij ? `zonder team (${nVrij})` : ''} in groepen en maakt teams van ongeveer gelijke grootte en leeftijd. Je ziet het voorstel eerst.</p>
      <div class="ac-chips">${Object.entries(T.GROEP_OP).map(([k, n]) => `<label class="ac-chip ${o.groepOp.includes(k) ? 'aan' : ''}"><input type="checkbox" data-tn-groep="${k}" ${o.groepOp.includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>
      <div class="tn-rij"><label>Spelers per team ${getal('grootte', o.grootte, 'min="2" max="18"')}</label><label class="ac-schak"><input type="checkbox" data-tn-pp checked> Per groep een poule</label></div>
      <div class="ac-acties"><button class="knop vol klein" data-tn="voorstel" ${nVrij ? '' : 'disabled'}>Voorstel maken</button></div></div>
    <div class="ac-paneel"><h3>${esc(SO.naam.split(' (')[0])}</h3><p class="ac-zacht">Voeg de ${esc(SO.meer)} toe die meedoen, geef ze teams en kies per team de poule. Gastteams hebben geen spelerslijst nodig. Met Inschrijven melden ze zichzelf aan.</p>
      ${T.gesorteerd(t.clubs).map(c => { const n = teams.filter(tm => tm.club === c.id).length;
        return `<div class="tn-club"><div class="ac-rij tn-clubrij">${veld(`clubs.${c.id}.naam`, c.naam, { klasse: 'ac-groei vet' })}<span class="ac-zacht">${n} ${n === 1 ? 'team' : 'teams'}</span>
          <button class="knop licht klein" data-tn="club-team" data-id="${esc(c.id)}">${ico('action-add', 16)} Team</button>
          <button class="ac-x" data-tn="club-weg" data-id="${esc(c.id)}" aria-label="${esc(SO.Een)} weg">✕</button></div>
          ${teams.filter(tm => tm.club === c.id).map(tm => `<div class="ac-rij tn-clubteam" style="--pk:${esc(kleurPoule(t, tm.poule))}"><span class="tn-stip"></span>${veld(`teams.${tm.id}.naam`, tm.naam, { klasse: 'ac-groei', extra: 'maxlength="40" aria-label="Teamnaam"' })}
            <select class="ac-in smal ${tm.poule && t.poules?.[tm.poule] ? '' : 'tn-leeg'}" data-veld="toernooi.teams.${esc(tm.id)}.poule" aria-label="Poule van ${esc(tm.naam)}">${opt('', 'Poule kiezen…', !t.poules?.[tm.poule])}${poules.map(p => opt(p.id, p.naam, tm.poule === p.id)).join('')}</select>
            <button class="ac-x" data-tn="team-weg" data-id="${esc(tm.id)}" aria-label="Team weg">✕</button></div>`).join('')}</div>`; }).join('') || `<p class="ac-zacht">Nog geen ${esc(SO.meer)}.</p>`}
      ${teams.length >= 2 ? `<p class="ac-zacht">${teams.some(tm => !t.poules?.[tm.poule]) ? `${teams.filter(tm => !t.poules?.[tm.poule]).length} teams hebben nog geen poule. ` : ''}Geen zin om zelf poules te kiezen? Laat Cluppie het doen bij <b>Opzet › Voorstel maken</b>.</p>` : ''}
      <div class="ac-acties"><button class="knop licht klein" data-tn="club-nieuw">${ico('action-add', 16)} ${esc(SO.Een)}</button><button class="knop licht klein" data-tn="teams-plak">Lijst plakken (${esc(SO.een)}, team, poule)</button></div></div>
    ${fout.length ? `<div class="ac-melding">${ico('action-warning', 18)} <span><b>${fout.length} ${fout.length === 1 ? 'speler past' : 'spelers passen'} niet bij de regels van hun team.</b> Zie de rode teams hieronder.</span></div>` : ''}
    ${teams.map(tm => {
      const sp = Object.entries(t.spelers || {}).filter(([, s]) => s.tt === tm.id).map(([id, s]) => ({ id, ...s })).sort((x, y) => String(x.naam).localeCompare(String(y.naam), 'nl'));
      const e = tm.eisen || {}, bron = new Set(e.bron || []);
      const fouten = sp.filter(s => T.magInTeam(s, tm).length);
      return `<details class="ac-paneel tn-team ${fouten.length ? 'tn-fout' : ''}" style="--pk:${esc(kleurPoule(t, tm.poule))}"><summary><span class="tn-stip"></span><b>${esc(tm.naam)}</b><span class="ac-zacht">${esc(t.poules?.[tm.poule]?.naam || 'geen poule')} · ${tm.gast ? 'gastteam' : sp.length + ' spelers'}${t.clubs?.[tm.club] ? ' · ' + esc(t.clubs[tm.club].naam) : ''} · ${esc(T.eisTekst(e))}</span></summary>
        <div class="ac-rij2"><span><label class="ac-label">Naam</label>${veld(`teams.${tm.id}.naam`, tm.naam)}</span><span><label class="ac-label">Poule</label><select class="ac-in" data-veld="toernooi.teams.${esc(tm.id)}.poule">${opt('', '— geen —')}${poules.map(p => opt(p.id, p.naam, tm.poule === p.id)).join('')}</select></span></div>
        ${Object.keys(t.clubs || {}).length ? `<label class="ac-label">${esc(SO.Een)}</label><select class="ac-in" data-veld="toernooi.teams.${esc(tm.id)}.club">${opt('', '— geen —')}${T.gesorteerd(t.clubs).map(c => opt(c.id, c.naam, tm.club === c.id)).join('')}</select>` : ''}
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
  const vj = T.veldjes(t), schema = T.metKo(t), o = T.opzet(t), pr = T.prijsuitreiking(t);
  const kop = `<div class="ac-paneel"><div class="ac-rij"><span class="ac-groei">${schema.length ? `<b>${schema.length} wedstrijden</b>, van ${esc(o.start)} tot ${esc(T.naarTijd(Math.max(...schema.map(w => T.naarMin(w.t))) + o.duur))}` : 'Nog geen schema.'}</span>
      <button class="knop vol klein" data-tn="plan">${schema.length ? 'Opnieuw plannen' : 'Schema maken'}</button></div>
      ${st.waarsch?.length ? `<div class="ac-melding">${ico('action-warning', 18)} <span>${st.waarsch.map(esc).join(' ')}</span></div>` : ''}
      ${pr ? `<p class="tn-prijs">🏆 Prijsuitreiking om <b>${esc(pr.van)}</b>, klaar om <b>${esc(pr.tot)}</b>${o.eind && T.naarMin(pr.tot) > T.naarMin(o.eind) ? ` <span class="tn-waarsch">(later dan ${esc(o.eind)})</span>` : ''}</p>` : ''}
      ${schema.length ? '<p class="ac-zacht">Sleep een wedstrijd naar een andere plek om te ruilen of te verplaatsen. Op de telefoon: tik op een wedstrijd en daarna op de nieuwe plek.</p>' : ''}</div>`;
  if (!schema.length) return kop;
  const tijden = [...new Set(schema.map(w => w.t))].sort((x, y) => T.naarMin(x) - T.naarMin(y));
  const vrijeTijden = []; for (let m = T.naarMin(tijden[0]); m <= T.naarMin(tijden[tijden.length - 1]) + T.slot(t); m += T.slot(t)) vrijeTijden.push(T.naarTijd(m));
  const alle = [...new Set([...tijden, ...vrijeTijden])].sort((x, y) => T.naarMin(x) - T.naarMin(y));
  const op = Object.fromEntries(schema.map(w => [`${w.t}|${w.v}`, w]));
  const probleem = new Map(); for (const p of st.controle || []) if (p.niveau !== 'tip') for (const id of p.wed) probleem.set(id, [...(probleem.get(id) || []), p.tekst]);
  const rooster = T.teamRooster(t), teams = T.gesorteerd(t.teams);
  const krap = teams.filter(tm => rooster[tm.id]?.achterElkaar > 0);
  const grid = `<div class="tn-grid-buiten"><table class="tn-grid"><thead><tr><th></th>${vj.map(v => `<th>${esc(v.naam)}</th>`).join('')}</tr></thead><tbody>
    ${alle.map(tijd => `<tr><th>${esc(tijd)}</th>${vj.map(v => { const w = op[`${tijd}|${v.id}`], u = w && t.uitslag?.[w.id];
      return `<td><button class="tn-cel ${w ? 'vol' : ''} ${w?.ko ? 'ko' : ''} ${st.gekozen && w?.id === st.gekozen ? 'gekozen' : ''} ${st.teamFilter && w && ![w.a, w.b].includes(st.teamFilter) ? 'dim' : ''} ${w && probleem.has(w.id) ? 'probleem' : ''}" data-tn="cel" data-t="${esc(tijd)}" data-v="${esc(v.id)}" ${w ? `data-id="${esc(w.id)}" data-tn-sleep="${esc(w.id)}" draggable="true" style="--pk:${esc(kleurPoule(t, w.p))}"${probleem.has(w.id) ? ` title="${esc(probleem.get(w.id).join(' '))}"` : ''}` : ''}>${w ? `${w.ko ? `<i>${esc(T.koTitel(t, w))}</i>` : ''}<b>${esc(naamW(t, w, 'a'))}</b><b>${esc(naamW(t, w, 'b'))}</b>${u && u.a != null && u.a !== '' ? `<small>${esc(u.a)}–${esc(u.b)}</small>` : ''}` : '<small>vrij</small>'}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `${kop}<div class="ac-paneel"><div class="ac-rij"><h3 class="ac-groei">Per veld</h3><select class="ac-in smal" data-tn-filter>${opt('', 'Alle teams')}${teams.map(tm => opt(tm.id, tm.naam, st.teamFilter === tm.id)).join('')}</select></div>${grid}
      <div class="ac-chips">${T.gesorteerd(t.poules).map(p => `<span class="ac-chip"><span class="tn-stip" style="--pk:${esc(p.kleur || '#999')}"></span>${esc(p.naam)}</span>`).join('')}</div></div>
    ${htmlBomen(t)}
    ${st.teamFilter && rooster[st.teamFilter] ? `<div class="ac-paneel"><h3>${esc(naamTeam(t, st.teamFilter))}</h3>${rooster[st.teamFilter].wedstrijden.map(w => `<div class="ac-rij"><span class="ac-tijd">${esc(w.t)}</span><span class="ac-groei">${esc(naamW(t, w, 'a'))} – ${esc(naamW(t, w, 'b'))}</span><span class="ac-zacht">${esc(vj.find(v => v.id === w.v)?.naam || '')}</span></div>`).join('')}
      <p class="ac-zacht">Eerste wedstrijd ${esc(rooster[st.teamFilter].eerste)}, klaar om ${esc(rooster[st.teamFilter].laatste)}. Langste wachttijd ${rooster[st.teamFilter].langsteWacht} min.</p></div>` : ''}
    ${krap.length ? `<p class="ac-zacht">Achter elkaar spelen (te weinig velden of teams voor rust): ${krap.map(tm => `${esc(tm.naam)} (${rooster[tm.id].achterElkaar}×)`).join(', ')}.</p>` : ''}`;
}

function htmlKk(ctx, a, t){
  const kks = T.gesorteerd(t.kk), delen = T.kkDelen(t), plan = T.planKleedkamers(t), rooster = T.teamRooster(t), club = st.club;
  const nogClub = (club?.kk || []).filter(k => !kks.some(x => x.clubKk === k.id));
  const teams = T.gesorteerd(t.teams).filter(tm => rooster[tm.id]);
  return `<div class="ac-paneel"><h3>Kleedkamers</h3><p class="ac-zacht">Plekken = hoeveel teams er tegelijk in passen. Kies Links en rechts als een kleedkamer twee helften heeft; elke helft is dan een eigen plek. Een team krijgt de kleedkamer 30 minuten voor de eerste tot 20 minuten na de laatste wedstrijd.</p>
      ${kks.map(k => `<div class="ac-rij tn-kkrij">${veld(`kk.${k.id}.naam`, k.naam, { klasse: 'ac-groei' })}
        <select class="ac-in smal" data-veld="toernooi.kk.${esc(k.id)}.delen" data-num aria-label="Indeling van de kleedkamer">${opt(1, 'Hele kleedkamer', Number(k.delen) !== 2)}${opt(2, 'Links en rechts', Number(k.delen) === 2)}</select>
        <label class="ac-zacht tn-mini" title="Maximaal ${plan.drukte[k.id] || 0} teams tegelijk in het schema">${Number(k.delen) === 2 ? 'plekken per helft' : 'plekken'} ${getal(`kk.${k.id}.plekken`, k.plekken ?? (Number(k.delen) === 2 ? 1 : 2), 'min="1" max="8"')}</label><button class="ac-x" data-tn="kk-weg" data-id="${esc(k.id)}" aria-label="Weg">✕</button></div>`).join('') || '<p class="ac-zacht">Nog geen kleedkamers.</p>'}
      <div class="ac-acties">${nogClub.length ? `<button class="knop licht klein" data-tn="kk-club">${ico('planning-week', 16)} Kleedkamers van de club (${nogClub.length})</button>` : ''}<button class="knop licht klein" data-tn="kk-nieuw">${ico('action-add', 16)} Kleedkamer</button></div></div>
    ${plan.tekort.length && kks.length ? `<div class="ac-melding">${ico('action-warning', 18)} <span><b>Te weinig plek</b> voor ${plan.tekort.map(id => esc(naamTeam(t, id))).join(', ')}. Voeg een kleedkamer toe, geef er een plek bij of spreid de poules (Opzet › begintijd).</span></div>` : ''}
    <div class="ac-paneel"><h3>Indeling</h3>${teams.length ? teams.map(tm => { const r = rooster[tm.id];
      return `<div class="ac-rij"><span class="tn-stip" style="--pk:${esc(kleurPoule(t, tm.poule))}"></span><span class="ac-groei"><b>${esc(tm.naam)}</b> <small class="ac-zacht">${esc(T.naarTijd(T.naarMin(r.eerste) - 30))}–${esc(T.naarTijd(T.naarMin(r.laatste) + 20))}</small></span>
        <select class="ac-in tn-kk-kies" data-veld="toernooi.teams.${esc(tm.id)}.kk" aria-label="Kleedkamer van ${esc(tm.naam)}">${opt('', plan.kk[tm.id] && !tm.kk ? `Automatisch (${T.kkNaam(t, plan.kk[tm.id])})` : 'Automatisch')}${delen.map(k => opt(k.id, k.naam, plan.kk[tm.id] === k.id && !!tm.kk)).join('')}</select></div>`; }).join('') : '<p class="ac-zacht">Maak eerst het schema; dan weet Cluppie wanneer elk team er is.</p>'}</div>`;
}

function htmlUitslagen(ctx, a, t){
  const vj = Object.fromEntries(T.veldjes(t).map(v => [v.id, v.naam])), schema = T.metKo(t).sort((x, y) => T.naarMin(x.t) - T.naarMin(y.t) || String(vj[x.v]).localeCompare(String(vj[y.v]), 'nl', { numeric: true }));
  if (!schema.length) return '<div class="ac-paneel"><p class="ac-zacht">Maak eerst het schema.</p></div>';
  const tijden = [...new Set(schema.map(w => w.t))];
  return `<div class="tn-twee"><div class="ac-paneel"><h3>Uitslagen</h3>${tijden.map(tijd => `<h4 class="tn-h4">${esc(tijd)}</h4>${schema.filter(w => w.t === tijd).map(w => { const u = t.uitslag?.[w.id] || {}, open = !w.ko || (w.a && w.b);
      const gelijk = w.ko && T.heeftUitslag(u) && Number(u.a) === Number(u.b);
      return `<div class="tn-uit ${w.ko ? 'ko' : ''}" style="--pk:${esc(kleurPoule(t, w.p))}">${w.ko ? `<span class="tn-uit-titel">${esc(T.koTitel(t, w))}</span>` : ''}<span class="tn-uit-v">${esc(vj[w.v] || '')}</span><span class="tn-uit-a ${w.ko && !w.a ? 'leeg' : ''}">${esc(naamW(t, w, 'a'))}</span>
        <input class="ac-in tn-score" type="number" min="0" max="99" inputmode="numeric" data-num data-veld="toernooi.uitslag.${esc(w.id)}.a" value="${esc(u.a ?? '')}" aria-label="Doelpunten ${esc(naamW(t, w, 'a'))}" ${open ? '' : 'disabled'}>
        <span>–</span><input class="ac-in tn-score" type="number" min="0" max="99" inputmode="numeric" data-num data-veld="toernooi.uitslag.${esc(w.id)}.b" value="${esc(u.b ?? '')}" aria-label="Doelpunten ${esc(naamW(t, w, 'b'))}" ${open ? '' : 'disabled'}>
        <span class="tn-uit-b ${w.ko && !w.b ? 'leeg' : ''}">${esc(naamW(t, w, 'b'))}</span>
        ${gelijk ? `<label class="tn-uit-pen">Gelijk. Wie wint na strafschoppen? <select class="ac-in smal" data-veld="toernooi.uitslag.${esc(w.id)}.w">${opt('', 'kies…', !u.w)}${opt('a', naamW(t, w, 'a'), u.w === 'a')}${opt('b', naamW(t, w, 'b'), u.w === 'b')}</select></label>` : ''}</div>`; }).join('')}`).join('')}</div>
    <div class="tn-standen">${htmlStanden(t)}</div></div><div class="tn-bomen">${htmlBomen(t)}</div>`;
}
/* De finales als wedstrijdboom (zie boomHtml in toernooi-logica.js), per knock-outgroep. */
function htmlBomen(t, { paneel = true } = {}){
  const ko = T.metKo(t).filter(w => w.ko), vj = Object.fromEntries(T.veldjes(t).map(v => [v.id, v.naam]));
  return T.koGroepen(t).map(g => { const ws = ko.filter(w => w.ko === g.id), eind = T.koUitslag(t, g.id);
    const boom = T.boomHtml(ws, { esc, naam: (w, z) => naamW(t, w, z), veld: w => vj[w.v] || '', uitslag: w => t.uitslag?.[w.id], kop: g.naam || 'Finales',
      podium: eind.length ? `<p class="bm-podium">${eind.slice(0, 3).map(x => `<span>${['🥇', '🥈', '🥉'][x.plaats - 1] || x.plaats + '.'} ${esc(naamTeam(t, x.id))}</span>`).join('')}</p>` : '' });
    return boom ? (paneel ? `<div class="ac-paneel">${boom}</div>` : boom) : ''; }).join('');
}
/* Standen per poule en de knock-out. Wordt ook los bijgewerkt tijdens het typen van een score. */
function htmlStanden(t){
  const poules = T.gesorteerd(t.poules).map(p => { const rijen = T.stand(t, p.id), klaar = T.pouleKlaar(t, p.id); return rijen.length ? `<div class="ac-paneel"><h3><span class="tn-stip" style="--pk:${esc(p.kleur || '#999')}"></span>${esc(p.naam)}${klaar ? ' <small class="ac-zacht">· klaar</small>' : ''}</h3>
      <table class="tn-stand"><thead><tr><th></th><th>Team</th><th>G</th><th>W</th><th>GL</th><th>V</th><th>DS</th><th>P</th></tr></thead><tbody>${rijen.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.naam)}</td><td>${r.g}</td><td>${r.w}</td><td>${r.gl}</td><td>${r.v}</td><td>${r.saldo > 0 ? '+' : ''}${r.saldo}</td><td><b>${r.pnt}</b></td></tr>`).join('')}</tbody></table></div>` : ''; }).join('');
  return poules;
}

/* ---------- klikken en wijzigen ---------- */
export async function klikToernooi(ctx, b){
  const actie = b.dataset.tn, id = b.dataset.id, a = ctx.act, t = a.toernooi || {}, zet = ctx.zet;
  switch (actie){
    case 'sub': st.sub = id; st.gekozen = ''; return ctx.herteken();
    case 'controle': return ctx.venster(htmlControleVenster);
    case 'proef': st.zaad = st.zaad || (Date.now() >>> 0); return ctx.venster(htmlProefVenster);
    case 'proef-nog': st.zaad = (Date.now() >>> 0); return ctx.venster(htmlProefVenster);
    case 'ga': st.sub = id; st.gekozen = ''; ctx.sluitVenster(); return ctx.herteken();
    case 'ai-controle': return aiControle(ctx);
    case 'ai-zet': return aiIndeling(ctx, id);
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
      const pr = T.prijsuitreiking({ ...t, schema: r.schema }), grens = T.opzet(t).eind, klaar = pr ? pr.tot : r.eind;
      if (grens && T.naarMin(klaar) > T.naarMin(grens)) st.waarsch = [...r.waarschuwingen, `Het toernooi is klaar om ${klaar}, later dan ${grens}. Kort de speeltijd in, voeg een veld toe of gebruik Opzet › Voorstel maken.`];
      await zet({ 'toernooi.schema': r.schema, 'toernooi.uitslag': {}, 'toernooi.gepland': Date.now(), ...prijsInProgramma(a, pr) });
      return meld(`${r.schema.length} wedstrijden gepland, klaar om ${klaar}${naControle(a, { ...t, schema: r.schema, uitslag: {} })}`);
    }
    case 'cel': {
      if (!st.gekozen){ if (id){ st.gekozen = id; ctx.herteken(); } return; }
      if (st.gekozen === id){ st.gekozen = ''; return ctx.herteken(); }
      const r = T.verplaats(t.schema, st.gekozen, { t: b.dataset.t, v: b.dataset.v });
      st.gekozen = '';
      if (r.fout){ ctx.herteken(); return meld(r.fout); }
      return zet({ 'toernooi.schema': r.schema });
    }
    case 'club-nieuw': return zet({ [`toernooi.clubs.${T.nieuwId('c')}`]: { naam: Object.keys(t.clubs || {}).length || T.soort(t) !== 'vereniging' ? `Nieuwe ${T.soortTekst(t).een}` : (S.club?.naam || 'Onze club'), volg: T.volgende(t.clubs) } });
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
    case 'ins-aan': {
      if (!T.inschrijfCats(t).length) return meld('Maak eerst een categorie.');
      const iid = t.inschrijfId || T.liveId();
      try { await setDoc(doc(db, 'toernooiInschrijf', iid), { club: ctx.clubId, actId: ctx.actId, open: true, ...T.inschrijfKopie(a, { ...clubInfo(), bezet: T.bezetPerCat(ins.id === iid ? ins.lijst || [] : []) }), bijgewerktMs: Date.now() }); }
      catch (e){ console.error('[toernooi] inschrijven', e); return meld(e?.code === 'permission-denied' ? 'Inschrijven kan nog niet aan: de regels zijn nog niet gepubliceerd.' : 'Openzetten mislukt.'); }
      await zet({ 'toernooi.inschrijfId': iid, 'toernooi.inschrijf.open': true }); return meld('Inschrijven staat open. Deel de link!');
    }
    case 'ins-uit': {
      if (!confirm('Inschrijven sluiten? De link laat dan zien dat inschrijven niet meer kan. De inschrijvingen blijven staan.')) return;
      try { await setDoc(doc(db, 'toernooiInschrijf', t.inschrijfId), { open: false, bijgewerktMs: Date.now() }, { merge: true }); } catch { return meld('Sluiten mislukt.'); }
      return zet({ 'toernooi.inschrijf.open': false });
    }
    case 'ins-kopieer': return ctx.kopieer(inschrijfLink(t.inschrijfId), 'Link gekopieerd');
    case 'cat-nieuw': return zet({ [`toernooi.inschrijf.cats.${T.nieuwId('g')}`]: { naam: `Categorie ${Object.keys(t.inschrijf?.cats || {}).length + 1}`, max: 0, prijs: 0, poule: '', volg: T.volgende(t.inschrijf?.cats) } });
    case 'cats-poules': { const patch = {}, heeft = new Set(T.inschrijfCats(t).map(c => c.poule)); let v = T.volgende(t.inschrijf?.cats);
      for (const p of T.gesorteerd(t.poules)) if (!heeft.has(p.id)) patch[`toernooi.inschrijf.cats.${T.nieuwId('g')}`] = { naam: p.naam, max: 0, prijs: 0, poule: p.id, volg: v++ };
      return Object.keys(patch).length ? zet(patch) : meld('Elke poule heeft al een categorie.'); }
    case 'cat-weg': { const n = (ins.lijst || []).filter(x => x.cat === id).length;
      if (n && !confirm(`Bij deze categorie ${n === 1 ? 'staat 1 inschrijving' : `staan ${n} inschrijvingen`}. Toch weghalen?`)) return;
      return zet({ [`toernooi.inschrijf.cats.${id}`]: deleteField() }); }
    case 'ins-status': return zetInschrijfStatus(ctx, t, id, b.dataset.naar);
    case 'ins-weg': { const x = (ins.lijst || []).find(y => y.id === id); if (!x || !confirm(`Inschrijving van ${x.club} weghalen? Dit kan niet terug.`)) return;
      try { await deleteDoc(doc(db, 'toernooiInschrijf', t.inschrijfId, 'aanmeldingen', id)); } catch { meld('Weghalen mislukt.'); } return; }
    case 'ins-csv': return ctx.download(ctx.bestandsnaam('csv', 'inschrijvingen'), T.csvInschrijvingen(ins.lijst || [], t), 'text/csv;charset=utf-8');
    case 'live-aan': {
      const lid = t.liveId || T.liveId();
      try { await setDoc(doc(db, 'toernooiLive', lid), { club: ctx.clubId, actId: ctx.actId, open: true, ...T.liveKopie(a, clubInfo()), bijgewerktMs: Date.now() }); }
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
    case 'scherm-club': {
      let lijst = [];
      try { lijst = await (await import('./clubschermen.js?v=20261130f')).clubSponsoren(ctx.clubId); }
      catch { return meld('De sponsoren van de club zijn alleen te lezen door de clubbeheerder.'); }
      if (!lijst.length) return meld('De club heeft nog geen sponsoren. Zet ze in Activiteiten › Kantine-tv en sponsoren.');
      const heeft = new Set(Object.values(t.schermen || {}).map(x => String(x?.titel || '').toLowerCase())), patch = {};
      let vrij = T.MAX_SCHERMEN - Object.keys(t.schermen || {}).length, volg = T.volgende(t.schermen);
      for (const x of lijst){ if (vrij <= 0) break; if (x.titel && heeft.has(x.titel.toLowerCase())) continue;
        patch[`toernooi.schermen.${T.nieuwId('x')}`] = { soort: 'sponsor', titel: x.titel, tekst: x.tekst, link: x.link, ...(x.img ? { img: x.img } : {}), volg: volg++, tv: true, tel: true }; vrij--; }
      const n = Object.keys(patch).length;
      if (!n) return meld('Alle sponsoren van de club staan er al bij.');
      await zet(patch); return meld(n === 1 ? '1 sponsor overgenomen' : `${n} sponsoren overgenomen`);
    }
    case 'scherm-weg': return zet({ [`toernooi.schermen.${id}`]: deleteField() });
    case 'scherm-plaatje-weg': return zet({ [`toernooi.schermen.${id}.img`]: deleteField() });
    case 'med-weg': return zet({ [`toernooi.mededelingen.${id}`]: deleteField() });
    case 'club-team': {
      if (Object.keys(t.teams || {}).length >= T.MAX.teams) return meld('Het maximum aantal teams is bereikt.');
      const club = t.clubs?.[id], n = Object.values(t.teams || {}).filter(tm => tm.club === id).length;
      return zet({ [`toernooi.teams.${T.nieuwId('t')}`]: { naam: `${club?.naam || 'Team'}${n ? ' ' + (n + 1) : ''}`.slice(0, 40), poule: '', club: id, volg: T.volgende(t.teams), gast: true, eisen: {} } });
    }
    case 'auto': {
      const r = T.autoIndeling(t);
      if (!r.schema) return meld(r.waarschuwingen[0]);
      st.auto = r;
      const perPoule = Object.entries(r.poules).map(([pid, p]) => ({ p, teams: Object.entries(r.teamPoule).filter(([, x]) => x === pid).map(([tid]) => naamTeam(t, tid)) }));
      const nKo = r.schema.filter(w => w.ko).length;
      /* het voorstel meteen controleren en proefdraaien, voordat iemand het overneemt */
      const t2 = { ...t, poules: r.poules, ko: r.ko, duur: r.duur, schema: r.schema, uitslag: {}, teams: Object.fromEntries(Object.entries(t.teams || {}).map(([tid, x]) => [tid, { ...x, poule: r.teamPoule[tid] }])) };
      const proef = C.proefdraaien(t2, { keer: 60, zaad: 7, opties: controleOpties(a) }), ernstig = [...proef.problemen, ...proef.controle].filter(p => p.niveau !== 'tip');
      return ctx.venster(`<h2>Voorstel voor het toernooi</h2>
        ${r.past ? '' : `<div class="ac-melding">${ico('action-warning', 18)} <span>${esc(r.waarschuwingen[0])}</span></div>`}
        <div class="tn-ctrl ${ernstig.some(p => p.niveau === 'fout') ? 'fout' : ernstig.length ? 'waarsch' : 'ok'}"><span class="tn-ctrl-ico">${ernstig.some(p => p.niveau === 'fout') ? '⛔' : ernstig.length ? '⚠️' : '✓'}</span><span class="tn-ctrl-t"><b>${ernstig.length ? `Proefgedraaid: ${ernstig.length} ${ernstig.length === 1 ? 'punt' : 'punten'}` : 'Proefgedraaid: alles loopt goed tot en met de prijsuitreiking'}</b>${ernstig.slice(0, 3).map(p => `<small>${NIV_ICO[p.niveau]} ${esc(p.tekst)}</small>`).join('')}</span></div>
        <div class="ac-chips"><span class="ac-chip aan">${Object.keys(r.poules).length} ${Object.keys(r.poules).length === 1 ? 'poule' : 'poules'}</span><span class="ac-chip aan">${r.duur} min per wedstrijd</span><span class="ac-chip aan">${r.schema.length} wedstrijden${nKo ? `, waarvan ${nKo} ${nKo === 1 ? 'finale' : 'finalewedstrijden'}` : ''}</span><span class="ac-chip aan">${esc(T.opzet(t).start)} – ${esc(r.eind)}</span>${r.prijs ? `<span class="ac-chip aan">Prijsuitreiking ${esc(r.prijs.van)}</span>` : ''}<span class="ac-chip aan">Klaar om ${esc(r.klaar)}</span></div>
        ${perPoule.map(x => `<div class="ac-paneel tn-team" style="--pk:${esc(x.p.kleur)}"><b>${esc(x.p.naam)}</b> <small class="ac-zacht">${x.teams.length} teams</small><p class="ac-zacht">${x.teams.map(esc).join(', ')}</p></div>`).join('')}
        <p class="ac-zacht">Elk team speelt ongeveer ${r.speelmin} minuten. ${Object.keys(t.poules || {}).length || (t.schema || []).length ? '<b>Overnemen vervangt de huidige poules, het schema en de uitslagen.</b>' : ''} Daarna kun je alles nog aanpassen en wedstrijden verslepen.</p>
        <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Annuleren</button><span class="ac-groei"></span><button class="knop vol" data-tn="auto-ja">Overnemen</button></div>`);
    }
    case 'auto-ja': {
      const r = st.auto; if (!r?.schema) return;
      if (Object.keys(t.uitslag || {}).length && !confirm('Er staan al uitslagen. Die gaan weg. Doorgaan?')) return;
      const map = {}, poules = {}, patch = {};
      for (const [oud, p] of Object.entries(r.poules)){ map[oud] = T.nieuwId('p') + oud; poules[map[oud]] = p; }
      const gid = T.nieuwId('g');
      for (const [tid, pid] of Object.entries(r.teamPoule)) patch[`toernooi.teams.${tid}.poule`] = map[pid];
      const bron = b => b?.p ? { ...b, p: map[b.p] } : b?.w ? { ...b, w: b.w.replace(/^ak-/, gid + '-') } : b;
      Object.assign(patch, { 'toernooi.poules': poules, 'toernooi.duur': r.duur, 'toernooi.uitslag': {}, 'toernooi.gepland': Date.now(),
        'toernooi.ko': r.ko.ak ? { [gid]: { ...r.ko.ak, poules: r.ko.ak.poules.map(x => map[x]) } } : {},
        'toernooi.schema': r.schema.map(w => ({ ...w, p: map[w.p] || w.p, ...(w.ko ? { id: w.id.replace(/^ak-/, gid + '-'), ko: gid, ka: bron(w.ka), kb: bron(w.kb) } : {}) })),
        ...prijsInProgramma(a, r.prijs) });
      st.auto = null; st.waarsch = r.waarschuwingen; ctx.sluitVenster();
      await zet(patch); st.sub = 'schema'; ctx.herteken();
      return meld(`${r.schema.length} wedstrijden gepland${r.prijs ? `, prijsuitreiking om ${r.prijs.van}` : ''}${naControle(ctx.actNu?.() || a, ctx.actNu?.()?.toernooi || t)}`);
    }
    case 'ko-nieuw': {
      if (Object.keys(t.ko || {}).length >= T.MAX_KO) return meld(`Maximaal ${T.MAX_KO} knock-outs.`);
      const al = new Set(Object.values(t.ko || {}).flatMap(g => g?.poules || [])), vrij = T.gesorteerd(t.poules).filter(p => !al.has(p.id));
      const kies = (vrij.length ? vrij : T.gesorteerd(t.poules)).slice(0, 2).map(p => p.id);
      return zet({ [`toernooi.ko.${T.nieuwId('g')}`]: { naam: Object.keys(t.ko || {}).length ? `Finales ${Object.keys(t.ko).length + 1}` : 'Finales', poules: kies, ronde: kies.length > 1 ? 4 : 2, plaats3: true, overige: false, volg: T.volgende(t.ko) } });
    }
    case 'ko-weg': {
      const n = (t.schema || []).filter(w => w.ko === id).length;
      if (n && !confirm(`Deze knock-out heeft ${n} ${n === 1 ? 'wedstrijd' : 'wedstrijden'} in het schema. Weghalen? Die wedstrijden gaan ook uit het schema.`)) return;
      const patch = { [`toernooi.ko.${id}`]: deleteField() };
      if (n) patch['toernooi.schema'] = (t.schema || []).filter(w => w.ko !== id);
      return zet(patch);
    }
    case 'kk-nieuw': return zet({ [`toernooi.kk.${T.nieuwId('k')}`]: { naam: `Kleedkamer ${Object.keys(t.kk || {}).length + 1}`, plekken: 2, volg: T.volgende(t.kk) } });
    case 'kk-club': {
      const club = await laadClub(ctx.clubId), patch = {}; let v = T.volgende(t.kk);
      for (const k of club.kk.filter(k => !Object.values(t.kk || {}).some(x => x.clubKk === k.id))) patch[`toernooi.kk.${T.nieuwId('k')}`] = { naam: k.naam, clubKk: k.id, plekken: 2, volg: v++ };
      return zet(patch);
    }
    case 'kk-weg': {
      const patch = { [`toernooi.kk.${id}`]: deleteField() };
      for (const [tid, tm] of Object.entries(t.teams || {})) if (tm.kk && String(tm.kk).split('~')[0] === id) patch[`toernooi.teams.${tid}.kk`] = '';
      return zet(patch);
    }
  }
}
/* De prijsuitreiking ook in het Dagprogramma (één vaste regel, die meeschuift met het schema). */
function prijsInProgramma(a, pr){
  if (!pr) return a.programma?.tnprijs ? { 'programma.tnprijs': deleteField() } : {};
  const oud = a.programma?.tnprijs, duur = T.naarMin(pr.tot) - T.naarMin(pr.van);
  return { 'programma.tnprijs': { wat: 'Prijsuitreiking', waar: '', wie: '', volg: 999, ...(oud || {}), tijd: pr.van, duur } };
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
  if (el.matches('[data-tn-betaald]')){
    try { await updateDoc(doc(db, 'toernooiInschrijf', t.inschrijfId, 'aanmeldingen', el.dataset.tnBetaald), { betaald: el.checked }); } catch { meld('Opslaan mislukt.'); }
    return true;
  }
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
  if (el.dataset.veld === 'toernooi.start' && T.naarMin(el.value) != null){
    const oud = T.naarMin(T.opzet(t).start), d = T.naarMin(el.value) - oud, patch = { 'toernooi.start': el.value };
    if (d && (t.schema || []).length){
      const schuif = x => T.naarTijd(T.naarMin(x) + d);
      patch['toernooi.schema'] = t.schema.map(w => ({ ...w, t: schuif(w.t) }));
      for (const [pid, p] of Object.entries(t.poules || {})) if (T.naarMin(p.start) != null) patch[`toernooi.poules.${pid}.start`] = schuif(p.start);
      for (const [gid, g] of Object.entries(t.ko || {})) if (T.naarMin(g.start) != null) patch[`toernooi.ko.${gid}.start`] = schuif(g.start);
      Object.assign(patch, prijsInProgramma(a, T.prijsuitreiking({ ...t, start: el.value, schema: patch['toernooi.schema'] })));
    }
    await ctx.zet(patch); ctx.herteken();
    /* zolang de cursor nog in een vak staat wordt het scherm niet hertekend: de poules alvast bijwerken */
    for (const i of ctx.el.querySelectorAll('[data-veld^="toernooi.poules."][data-veld$=".start"]')){ const pid = i.dataset.veld.split('.')[2], ps = patch[`toernooi.poules.${pid}.start`] || t.poules?.[pid]?.start;
      i.value = ps && T.naarMin(ps) > T.naarMin(el.value) ? ps : el.value; }
    if (d && (t.schema || []).length) meld(`Het schema begint nu om ${el.value}`);
    return true;
  }
  if (el.dataset.veld === 'toernooi.prijs' && (t.schema || []).length){
    const n = el.value === '' ? 0 : Number(el.value); if (!Number.isFinite(n) || n < 0) return true;
    await ctx.zet({ 'toernooi.prijs': n, ...prijsInProgramma(a, T.prijsuitreiking({ ...t, prijs: n })) }); return true;
  }
  if (el.matches('[data-tn-kop]')){
    const gid = el.dataset.tnKop, set = new Set(t.ko?.[gid]?.poules || []);
    el.checked ? set.add(el.value) : set.delete(el.value);
    await ctx.zet({ [`toernooi.ko.${gid}.poules`]: T.gesorteerd(t.poules).map(p => p.id).filter(id => set.has(id)) }); return true;
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
  if (el.matches('[data-tn-filter]')){ st.teamFilter = el.value; ctx.herteken(); return true; }
  if (el.matches('[data-tn-pp]')) return true;
  return false;
}
export function invoerToernooi(ctx, el){
  if (el.matches('.tn-score')){ standBijTypen(ctx, el); return true; }
  if (!el.matches('[data-tn-zoek]')) return false;
  st.zoek = el.value;
  clearTimeout(invoerToernooi._t);
  invoerToernooi._t = setTimeout(() => { ctx.herteken(); const z = ctx.el.querySelector('[data-tn-zoek]'); if (z){ z.focus(); z.setSelectionRange(z.value.length, z.value.length); } }, 250);
  return true;
}
/* Tijdens het typen van een score: de stand ernaast meteen bijwerken (zonder het scherm te hertekenen, zodat de
   cursor in het vak blijft), en na een korte pauze opslaan zodat de live pagina en de tv ook meteen meegaan. */
function standBijTypen(ctx, el){
  const t0 = ctx.act.toernooi || {}, uitslag = { ...(t0.uitslag || {}) };
  for (const i of ctx.el.querySelectorAll('.tn-score')){
    const [, , wid, z] = String(i.dataset.veld || '').split('.'); if (!wid) continue;
    uitslag[wid] = { ...(uitslag[wid] || {}), [z]: i.value === '' ? null : Number(i.value) };
  }
  const box = ctx.el.querySelector('.tn-standen'); if (box) box.innerHTML = htmlStanden({ ...t0, uitslag });
  const bomen = ctx.el.querySelector('.tn-bomen'); if (bomen) bomen.innerHTML = htmlBomen({ ...t0, uitslag });
  const pad = el.dataset.veld, w = el.value === '' ? null : Number(el.value);
  if (w != null && (!Number.isFinite(w) || w < 0 || w > 99)) return;
  clearTimeout(st.scoreT[pad]);
  st.scoreT[pad] = setTimeout(() => { delete st.scoreT[pad]; ctx.zet({ [pad]: w }, { stil: true }); }, 700);
}

/* Slepen in het schema (muis, en op telefoons die het kunnen met lang indrukken). Tikken om te wisselen blijft ook werken. */
function koppelSlepen(el){
  if (!el || el._tnSlepen) return; el._tnSlepen = true;
  const doelUit = () => el.querySelectorAll('.tn-cel.doel,.tn-cel.sleept').forEach(x => x.classList.remove('doel', 'sleept'));
  el.addEventListener('dragstart', e => {
    const c = e.target.closest?.('[data-tn-sleep]'); if (!c) return;
    st.sleep = c.dataset.tnSleep; st.gekozen = '';
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', st.sleep);
    requestAnimationFrame(() => c.classList.add('sleept'));
  });
  el.addEventListener('dragover', e => {
    if (!st.sleep) return; const c = e.target.closest?.('.tn-cel'); if (!c) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (!c.classList.contains('doel')){ el.querySelectorAll('.tn-cel.doel').forEach(x => x.classList.remove('doel')); c.classList.add('doel'); }
  });
  el.addEventListener('drop', async e => {
    if (!st.sleep) return; const c = e.target.closest?.('.tn-cel'); const id = st.sleep; st.sleep = ''; doelUit();
    if (!c){ return; } e.preventDefault();
    const ctx = st.ctx; if (!ctx || c.dataset.id === id) return;
    const r = T.verplaats(ctx.act.toernooi?.schema, id, { t: c.dataset.t, v: c.dataset.v });
    if (r.fout) return meld(r.fout);
    await ctx.zet({ 'toernooi.schema': r.schema });
  });
  el.addEventListener('dragend', () => { st.sleep = ''; doelUit(); });
}
export function resetToernooi(){ st.ai = null; st.aiBezig = false; st.zaad = 0; st.sub = 'opzet'; st.zoek = ''; st.gekozen = ''; st.teamFilter = ''; st.waarsch = null; st.club = null; st.clubLaden = null; st.qrVoor = ''; st.qrSvg = ''; ins.stop?.(); ins.stop = null; ins.id = ''; ins.lijst = null; ins.qrVoor = ''; ins.qr = ''; }

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


/* ---------- online inschrijven [20261125w] ---------- */
export const inschrijfLink = id => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}?inschrijf=${encodeURIComponent(id)}`;
const ins = { id: '', lijst: null, stop: null, qrVoor: '', qr: '' };
function volgInschrijvingen(ctx, id){
  if (ins.id === id) return;
  ins.stop?.(); ins.stop = null; ins.id = id; ins.lijst = null;
  if (!id) return;
  ins.stop = onSnapshot(collection(db, 'toernooiInschrijf', id, 'aanmeldingen'), s => { ins.lijst = s.docs.map(d => ({ id: d.id, ...d.data() })); planInschrijf(ctx); ctx.herteken(); },
    e => { console.warn('[toernooi] inschrijvingen', e); ins.lijst = []; ctx.herteken(); });
}
/* De openbare kopie (zonder contactgegevens) bijwerken, met hoeveel plekken er per categorie bezet zijn. */
let _insT = null;
export function planInschrijf(ctx){
  const t0 = ctx.actNu()?.toernooi;
  if (!t0?.inschrijfId || t0.inschrijf?.open !== true) return;
  if (ins.id !== t0.inschrijfId || ins.lijst === null) return volgInschrijvingen(ctx, t0.inschrijfId);
  clearTimeout(_insT);
  _insT = setTimeout(async () => {
    const a = ctx.actNu(), t = a?.toernooi;
    if (!t?.inschrijfId || t.inschrijf?.open !== true || ins.id !== t.inschrijfId) return;
    try { await setDoc(doc(db, 'toernooiInschrijf', t.inschrijfId), { club: ctx.clubId, actId: ctx.actId, open: true, ...T.inschrijfKopie(a, { ...clubInfo(), bezet: T.bezetPerCat(ins.lijst || []) }), bijgewerktMs: Date.now() }); }
    catch (e){ console.warn('[toernooi] inschrijfpagina bijwerken', e); }
  }, 600);
}
function htmlInschrijven(ctx, a, t){
  const i = t.inschrijf || {}, aan = i.open === true && !!t.inschrijfId, cats = T.inschrijfCats(t), SO = T.soortTekst(t), poules = T.gesorteerd(t.poules);
  if (t.inschrijfId) volgInschrijvingen(ctx, t.inschrijfId);
  const link = t.inschrijfId ? inschrijfLink(t.inschrijfId) : '';
  if (aan && ins.qrVoor !== t.inschrijfId){ ins.qrVoor = t.inschrijfId; ins.qr = ''; qrSvg(link).then(svg => { ins.qr = svg; ctx.herteken(); }).catch(() => {}); }
  const lijst = [...(ins.lijst || [])].sort((x, y) => (y.ms || 0) - (x.ms || 0)), bezet = T.bezetPerCat(lijst), tot = T.inschrijfTotaal(lijst, t), catVan = Object.fromEntries(cats.map(c => [c.id, c]));
  const mails = [...new Set(lijst.filter(x => x.status !== 'afgewezen').map(x => x.email).filter(Boolean))];
  const v = (pad, w, o) => veld(`inschrijf.${pad}`, w, o);
  return `<div class="ac-paneel"><h3>Online inschrijven</h3><p class="ac-zacht">${esc(SO.naam.split(' (')[0])} schrijven zelf hun teams in via een link, zonder account. Jij laat ze toe en ze staan meteen bij Teams, in de goede poule. De contactgegevens ziet alleen het comité.</p>
      ${aan ? `<div class="tn-live"><div class="tn-qr">${ins.qr || '<span class="ac-zacht">QR-code maken…</span>'}</div>
          <div class="tn-live-t"><input class="ac-in" readonly value="${esc(link)}" aria-label="Link naar de inschrijfpagina" onfocus="this.select()">
            <div class="ac-acties"><button class="knop vol klein" data-tn="ins-kopieer">Link kopiëren</button><a class="knop licht klein" href="${esc(ctx.waLink(`Schrijf je in voor ${a.naam}: ${link}`))}" target="_blank" rel="noopener">WhatsApp</a>
              <a class="knop licht klein" href="mailto:?subject=${encodeURIComponent('Uitnodiging ' + (a.naam || 'toernooi'))}&body=${encodeURIComponent(`Beste sportvrienden,\n\nGraag nodigen we jullie uit voor ${a.naam}${a.datum ? ' op ' + new Date(a.datum + 'T12:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}.\nInschrijven kan hier: ${link}\n\nMet sportieve groet,\n${S.club?.naam || ''}`)}">Uitnodiging mailen</a>
              <a class="knop licht klein" href="${esc(link)}" target="_blank" rel="noopener">Openen</a><span class="ac-groei"></span><button class="knop licht klein" data-tn="ins-uit">Inschrijven sluiten</button></div></div></div>`
        : `<div class="ac-acties"><button class="knop vol" data-tn="ins-aan" ${cats.length ? '' : 'disabled'}>Inschrijven openzetten</button></div><p class="ac-zacht">${cats.length ? (t.inschrijfId ? 'De inschrijving staat dicht. Openzetten geeft dezelfde link als eerst.' : 'Je krijgt een link en een QR-code om te delen.') : 'Maak hieronder eerst minstens één categorie.'}</p>`}</div>
    <div class="ac-paneel"><h3>Categorieën</h3><p class="ac-zacht">Waar kan een team zich voor inschrijven? Meestal een leeftijdsgroep of niveau. Koppel een poule, dan komt een toegelaten team daar vanzelf in. Maximum 0 is onbeperkt, inschrijfgeld 0 is gratis.</p>
      ${cats.map(c => `<div class="ac-rij tn-catrij">${v(`cats.${c.id}.naam`, c.naam, { klasse: 'ac-groei vet', extra: 'maxlength="40"' })}
          <label class="tn-mini">Max ${v(`cats.${c.id}.max`, c.max, { type: 'number', klasse: 'getal', extra: 'data-num inputmode="numeric" min="0" max="200"' })}</label>
          <label class="tn-mini">€ ${v(`cats.${c.id}.prijs`, c.prijs || '', { type: 'number', klasse: 'getal', ph: '0', extra: 'data-num inputmode="decimal" min="0" max="9999" step="0.5"' })}</label>
          <select class="ac-in smal" data-veld="toernooi.inschrijf.cats.${esc(c.id)}.poule" aria-label="Poule">${opt('', 'geen poule', !c.poule)}${poules.map(p => opt(p.id, p.naam, c.poule === p.id)).join('')}</select>
          <span class="ac-zacht">${bezet[c.id] || 0}${c.max ? ' / ' + c.max : ''}</span><button class="ac-x" data-tn="cat-weg" data-id="${esc(c.id)}" aria-label="Categorie weg">✕</button></div>`).join('') || '<p class="ac-zacht">Nog geen categorieën.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-tn="cat-nieuw" ${cats.length >= T.MAX_CATS ? 'disabled' : ''}>${ico('action-add', 16)} Categorie</button>${poules.some(p => !cats.some(c => c.poule === p.id)) ? '<button class="knop licht klein" data-tn="cats-poules">Uit de poules</button>' : ''}</div></div>
    <div class="ac-paneel"><h3>Op de inschrijfpagina</h3>
      <div class="ac-rij2"><span><label class="ac-label">Inschrijven kan tot en met</label>${v('tot', i.tot || '', { type: 'date' })}</span><span><label class="ac-label">Contactpersoon (zichtbaar)</label>${v('contact', i.contact || '', { ph: 'bv. Karin, toernooicommissie', extra: 'maxlength="60"' })}</span></div>
      <label class="ac-label">E-mail voor vragen (zichtbaar)</label>${v('contactMail', i.contactMail || '', { type: 'email', ph: 'toernooi@jouwclub.nl', extra: 'maxlength="120"' })}
      <label class="ac-label">Welkomsttekst</label><textarea class="ac-in" data-veld="toernooi.inschrijf.tekst" rows="3" maxlength="600" placeholder="Bijvoorbeeld: speelvorm, wat teams krijgen (lunch, medaille), parkeren.">${esc(i.tekst || '')}</textarea>
      <label class="ac-label">Zo betaal je (staat op de bevestiging)</label><textarea class="ac-in" data-veld="toernooi.inschrijf.betaal" rows="2" maxlength="400" placeholder="Bijvoorbeeld: maak het inschrijfgeld over op NL00 BANK 0000 0000 00 t.n.v. de club, met de teamnaam erbij.">${esc(i.betaal || '')}</textarea>
      <label class="ac-label">Betaallink (Tikkie of betaalverzoek van je bank, mag leeg)</label>${v('betaalLink', i.betaalLink || '', { ph: 'https://…', extra: 'maxlength="200" inputmode="url"' })}</div>
    <div class="ac-paneel"><h3>Inschrijvingen ${lijst.length ? `<small class="ac-zacht">· ${tot.n}${tot.nieuw ? `, ${tot.nieuw} nieuw` : ''}</small>` : ''}</h3>
      ${!t.inschrijfId ? '<p class="ac-zacht">Zet het inschrijven open om inschrijvingen te ontvangen.</p>' : ins.lijst === null ? '<p class="ac-zacht">Laden…</p>' : !lijst.length ? '<p class="ac-zacht">Nog geen inschrijvingen.</p>' : `
        <p class="ac-zacht">${tot.toegelaten} toegelaten${tot.verwacht ? ` · inschrijfgeld ${T.euro(tot.betaald)} van ${T.euro(tot.verwacht)} binnen` : ''}</p>
        ${lijst.map(x => { const c = catVan[x.cat], stt = T.INSCHRIJF_STATUS[x.status] ? x.status : 'nieuw';
          return `<div class="tn-ins ${stt}"><div class="ac-rij"><b class="ac-groei">${esc(x.club)}${x.team && x.team !== x.club ? ` · ${esc(x.team)}` : ''}</b><span class="tn-st ${stt}">${esc(T.INSCHRIJF_STATUS[stt])}</span></div>
            <p class="ac-zacht">${esc(c?.naam || 'categorie vervallen')}${c?.prijs ? ' · ' + T.euro(c.prijs) : ''} · ${esc(x.contact || '')} · <a href="mailto:${esc(x.email || '')}">${esc(x.email || '')}</a>${x.tel ? ` · <a href="tel:${esc(x.tel)}">${esc(x.tel)}</a>` : ''}${x.ms ? ' · ' + new Date(x.ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : ''}</p>
            ${x.opm ? `<p class="tn-opm">${esc(x.opm)}</p>` : ''}
            <div class="ac-acties">${stt !== 'toegelaten' ? `<button class="knop vol klein" data-tn="ins-status" data-id="${esc(x.id)}" data-naar="toegelaten">Toelaten</button>` : ''}${stt !== 'wachtlijst' ? `<button class="knop licht klein" data-tn="ins-status" data-id="${esc(x.id)}" data-naar="wachtlijst">Wachtlijst</button>` : ''}${stt !== 'afgewezen' ? `<button class="knop licht klein" data-tn="ins-status" data-id="${esc(x.id)}" data-naar="afgewezen">Afwijzen</button>` : ''}
              ${c?.prijs ? `<label class="ac-schak"><input type="checkbox" data-tn-betaald="${esc(x.id)}" ${x.betaald ? 'checked' : ''}> Betaald</label>` : ''}<span class="ac-groei"></span><button class="ac-x" data-tn="ins-weg" data-id="${esc(x.id)}" aria-label="Inschrijving weg">✕</button></div></div>`; }).join('')}
        <div class="ac-acties"><button class="knop licht klein" data-tn="ins-csv">${ico('admin-file', 16)} Lijst als CSV</button>${mails.length ? `<a class="knop licht klein" href="mailto:?bcc=${encodeURIComponent(mails.join(','))}&subject=${encodeURIComponent(a.naam || 'Toernooi')}">Mail alle contactpersonen (${mails.length})</a>` : ''}</div>`}</div>`;
}
/* Bij het verwijderen van de activiteit: de inschrijfpagina en alle inschrijvingen (contactgegevens) weg. */
export async function wisInschrijven(id){
  try { const s = await getDocs(collection(db, 'toernooiInschrijf', id, 'aanmeldingen')); await Promise.all(s.docs.map(d => deleteDoc(d.ref))); await deleteDoc(doc(db, 'toernooiInschrijf', id)); }
  catch (e){ console.warn('[toernooi] inschrijvingen wissen', e); }
}
/* Een inschrijving toelaten: de vereniging (of school, bedrijf) en het team komen in de planner, in de poule van de categorie. */
async function zetInschrijfStatus(ctx, t, id, naar){
  const x = (ins.lijst || []).find(y => y.id === id); if (!x || !t.inschrijfId) return;
  const ref = doc(db, 'toernooiInschrijf', t.inschrijfId, 'aanmeldingen', id), bestaat = x.teamId && t.teams?.[x.teamId];
  try {
    if (naar === 'toegelaten'){
      let teamId = bestaat ? x.teamId : '';
      if (!teamId){
        if (Object.keys(t.teams || {}).length >= T.MAX.teams) return meld('Het maximum aantal teams is bereikt.');
        const cat = T.inschrijfCats(t).find(c => c.id === x.cat), patch = {};
        let cid = Object.entries(t.clubs || {}).find(([, c]) => String(c?.naam || '').trim().toLowerCase() === String(x.club || '').trim().toLowerCase())?.[0];
        if (!cid){ cid = T.nieuwId('c'); patch[`toernooi.clubs.${cid}`] = { naam: String(x.club || '').slice(0, 60), volg: T.volgende(t.clubs) }; }
        const tn = String(x.team || ''), cn = String(x.club || ''), naam = (!tn || tn.toLowerCase() === cn.toLowerCase() ? cn : tn.toLowerCase().includes(cn.toLowerCase()) ? tn : `${cn} ${tn}`).slice(0, 40);
        teamId = T.nieuwId('t');
        patch[`toernooi.teams.${teamId}`] = { naam, poule: cat?.poule || '', club: cid, volg: T.volgende(t.teams), gast: true, eisen: {}, inschrijving: id };
        await ctx.zet(patch);
      }
      await updateDoc(ref, { status: 'toegelaten', teamId });
      return meld((t.schema || []).length ? 'Toegelaten. Maak het schema opnieuw om het team in te plannen.' : 'Toegelaten, het team staat bij Teams');
    }
    if (bestaat && confirm(`${t.teams[x.teamId].naam} ook uit de planner halen?${(t.schema || []).length ? ' Het schema moet daarna opnieuw.' : ''}`)) await ctx.zet({ [`toernooi.teams.${x.teamId}`]: deleteField() });
    await updateDoc(ref, { status: naar });
  } catch (e){ console.error('[toernooi] inschrijving', e); meld('Opslaan mislukt.'); }
}

/* ---------- live pagina, QR en mededelingen ---------- */
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
      <p class="ac-zacht">Coaches van eigen teams bereik je ook via het draaiboek, onderwerp Communicatie (berichten en WhatsApp).</p></div>
    <div class="ac-paneel"><h3>Sponsoren en eigen schermen</h3><p class="ac-zacht">Sponsoren staan met hun logo op de tv en onderaan de live pagina. Een eigen scherm is een dia met titel, tekst en eventueel een afbeelding, bijvoorbeeld het menu van de kantine, de loterij of de huisregels. Op tv wisselen ze af met de standen.</p>
      ${sch.map(x => `<div class="tn-scherm"><label class="tn-plaatje" title="Afbeelding kiezen">${x.img ? `<img src="${esc(x.img)}" alt="">` : `<span>${x.soort === 'sponsor' ? 'Logo' : 'Afbeelding'}</span>`}<input type="file" accept="image/*" data-tn-plaatje="${esc(x.id)}" hidden></label>
          <div class="tn-scherm-v"><div class="ac-rij"><span class="ac-zacht">${x.soort === 'sponsor' ? 'Sponsor' : 'Scherm'}</span>${veld(`schermen.${x.id}.titel`, x.titel, { klasse: 'ac-groei vet', ph: x.soort === 'sponsor' ? 'Naam van de sponsor' : 'Titel', extra: 'maxlength="60"' })}<button class="ac-x" data-tn="scherm-weg" data-id="${esc(x.id)}" aria-label="Weg">✕</button></div>
            ${veld(`schermen.${x.id}.tekst`, x.tekst, { ph: x.soort === 'sponsor' ? 'Korte tekst (mag leeg blijven)' : 'Tekst op het scherm', extra: 'maxlength="240"' })}
            ${x.soort === 'sponsor' ? veld(`schermen.${x.id}.link`, x.link, { ph: 'Website (mag leeg blijven)', extra: 'maxlength="200" inputmode="url"' }) : ''}
            <div class="ac-rij"><label class="ac-schak"><input type="checkbox" data-veld="toernooi.schermen.${esc(x.id)}.tv" data-bool ${x.tv ? 'checked' : ''}> Op tv</label><label class="ac-schak"><input type="checkbox" data-veld="toernooi.schermen.${esc(x.id)}.tel" data-bool ${x.tel ? 'checked' : ''}> Op de live pagina</label>${x.img ? `<span class="ac-groei"></span><button class="knop licht klein" data-tn="scherm-plaatje-weg" data-id="${esc(x.id)}">Afbeelding weg</button>` : ''}</div></div></div>`).join('') || '<p class="ac-zacht">Nog geen sponsoren of schermen.</p>'}
      <div class="ac-acties"><button class="knop licht klein" data-tn="scherm-nieuw" data-id="sponsor" ${vol ? 'disabled' : ''}>${ico('action-add', 16)} Sponsor</button><button class="knop licht klein" data-tn="scherm-nieuw" data-id="scherm" ${vol ? 'disabled' : ''}>${ico('action-add', 16)} Eigen scherm</button>${S.club?.admins?.[S.user?.uid] ? `<button class="knop licht klein" data-tn="scherm-club" ${vol ? 'disabled' : ''}>Sponsoren van de club overnemen</button>` : ''}${vol ? `<span class="ac-zacht">Maximaal ${T.MAX_SCHERMEN}.</span>` : ''}</div></div>`;
}
/* Na elke wijziging aan het toernooi de live-kopie bijwerken (kort gebundeld). */
let _liveT = null;
export function planLive(ctx){
  clearTimeout(_liveT);
  _liveT = setTimeout(async () => {
    const a = ctx.actNu(), t = a?.toernooi;
    if (!t || t.live !== true || !t.liveId) return;
    try { await setDoc(doc(db, 'toernooiLive', t.liveId), { club: ctx.clubId, actId: ctx.actId, open: true, ...T.liveKopie(a, clubInfo()), bijgewerktMs: Date.now() }); }
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
  if (soort === 'tn-pdf'){
    const a = ctx.act;
    (async () => { let qr = ''; if (a.toernooi?.live === true && a.toernooi.liveId){ try { qr = await qrSvg(liveLink(a.toernooi.liveId)); } catch { qr = ''; } } ctx.printen(printHtml(a, qr)); })();
    return true;
  }
  return false;
}
/* Het speelschema als visitekaartje van de club: clubkleur, logo, schema per veld, teams met kleedkamers,
   standen en finales. Liggend A4, kleuren worden meegeprint. */
const leesbaar = hex => { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); if (!m) return '#fff'; const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#111' : '#fff'; };
function printHtml(a, qr = ''){
  const t = a.toernooi || {}, vj = T.veldjes(t), schema = T.metKo(t), plan = T.planKleedkamers(t), rooster = T.teamRooster(t), o = T.opzet(t);
  const ci = clubInfo(), kleur = /^#[0-9a-f]{6}$/i.test(ci.kleur) ? ci.kleur : '#E20613', ink = leesbaar(kleur);
  const tijden = [...new Set(schema.map(w => w.t))].sort((x, y) => T.naarMin(x) - T.naarMin(y));
  const op = Object.fromEntries(schema.map(w => [`${w.t}|${w.v}`, w]));
  const gebruikt = vj.filter(v => schema.some(w => w.v === v.id));
  const eind = schema.length ? T.naarTijd(Math.max(...schema.map(w => T.naarMin(w.t))) + o.duur) : '';
  const poules = T.gesorteerd(t.poules), teams = T.gesorteerd(t.teams);
  const datum = a.datum ? new Date(a.datum + 'T12:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const logo = T.plaatjeOk(ci.logo) ? `<img class="vk-logo" src="${esc(ci.logo)}" alt="">` : `<div class="vk-logo vk-letter">${esc((ci.clubNaam || a.naam || 'C').trim()[0] || 'C')}</div>`;
  const prU = T.prijsuitreiking(t);
  const feiten = [schema.length ? `${esc(o.start)} – ${esc(eind)}` : '', `${teams.length} teams`, `${poules.length} ${poules.length === 1 ? 'poule' : 'poules'}`, gebruikt.length ? `${gebruikt.length} ${gebruikt.length === 1 ? 'veld' : 'velden'}` : '', `${o.duur} min per wedstrijd`, prU ? `Prijsuitreiking ${esc(prU.van)}` : ''].filter(Boolean);
  const cel = w => { if (!w) return '<td class="vk-vrij"></td>'; const u = t.uitslag?.[w.id];
    return `<td><div class="vk-w ${w.ko ? 'ko' : ''}" style="--pk:${esc(kleurPoule(t, w.p))}">${w.ko ? `<i>${esc(T.koTitel(t, w).split(' · ')[0])}</i>` : ''}<span>${esc(naamW(t, w, 'a'))}</span><span>${esc(naamW(t, w, 'b'))}</span>${T.heeftUitslag(u) ? `<b>${esc(u.a)} – ${esc(u.b)}</b>` : ''}</div></td>`; };
  const klein = gebruikt.length > 6 ? ' klein' : '';
  const standen = poules.map(p => { const r = T.stand(t, p.id); return r.some(x => x.g) ? `<div class="vk-kaart" style="--pk:${esc(p.kleur || '#999')}"><h3>Stand ${esc(p.naam)}</h3><table class="vk-tab"><tr><th></th><th>Team</th><th>G</th><th>W</th><th>GL</th><th>V</th><th>DS</th><th>P</th></tr>${r.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.naam)}</td><td>${x.g}</td><td>${x.w}</td><td>${x.gl}</td><td>${x.v}</td><td>${x.saldo > 0 ? '+' : ''}${x.saldo}</td><td><b>${x.pnt}</b></td></tr>`).join('')}</table></div>` : ''; }).join('');
  const ko = htmlBomen(t, { paneel: false });
  return `<style>
@page{size:A4 landscape;margin:9mm}
body{margin:0!important;font-family:system-ui,-apple-system,'Segoe UI',sans-serif!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;color:#14161a}
.voet{display:none}
.vk{--c:${kleur};--ci:${ink}}
.vk-kop{position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;background:var(--c);color:var(--ci);border-radius:16px;padding:14px 22px;margin-bottom:10px}
.vk-kop::after{content:'';position:absolute;right:-40px;top:-30px;width:300px;height:200px;background:repeating-linear-gradient(115deg,rgba(255,255,255,.14) 0 14px,transparent 14px 34px);transform:skewX(-12deg)}
.vk-logo{width:70px;height:70px;border-radius:14px;background:#fff;object-fit:contain;padding:5px;flex-shrink:0;position:relative;z-index:1}
.vk-letter{display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:900;color:var(--c)}
.vk-titel{flex:1;min-width:0;position:relative;z-index:1}
.vk-titel small{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.vk-titel h1{font-size:34px;line-height:1.02;margin:2px 0 4px;font-weight:900;text-transform:uppercase;letter-spacing:.01em;border:0;padding:0}
.vk-titel p{margin:0;font-size:13px;opacity:.92}
.vk-qr{background:#fff;border-radius:12px;padding:4px;width:84px;position:relative;z-index:1;text-align:center;color:#111;font-size:8px;font-weight:700}
.vk-qr svg{width:100%;height:auto;display:block}
.vk-feiten{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.vk-feiten span{border:1.5px solid var(--c);color:#14161a;border-radius:999px;padding:3px 11px;font-size:11px;font-weight:700}
.vk-feiten span:first-child{background:var(--c);color:var(--ci)}
.vk h2{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--c);border:0;margin:10px 0 6px;padding:0;display:flex;align-items:center;gap:8px}
.vk h2::after{content:'';flex:1;height:2px;background:var(--c);opacity:.25}
.vk-schema{width:100%;border-collapse:separate;border-spacing:4px;table-layout:fixed;margin:0}
.vk-schema th{background:#14161a;color:#fff;border-radius:8px;padding:5px 8px;font-size:11px;text-align:center;border:0}
.vk-schema th.vk-t{background:transparent;color:#14161a;width:46px}
.vk-schema td{padding:0;border:0;vertical-align:middle}
.vk-schema td.vk-tijd{font-weight:900;font-size:13px;text-align:right;padding-right:4px;font-variant-numeric:tabular-nums}
.vk-schema td.vk-vrij{background:repeating-linear-gradient(135deg,#f3f4f6 0 5px,#fff 5px 10px);border-radius:8px}
.vk-w{border-radius:8px;background:color-mix(in srgb,var(--pk) 12%,#fff);border-left:5px solid var(--pk);padding:4px 7px;display:flex;flex-direction:column;min-height:34px;justify-content:center;font-size:11px;line-height:1.25}
.vk-w span{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vk-w i{font-style:normal;font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:var(--pk)}
.vk-w b{font-size:10px;color:#444}
.vk-w.ko{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--pk) 18%,#fff) 0 6px,color-mix(in srgb,var(--pk) 9%,#fff) 6px 12px)}
.klein .vk-w{font-size:9.5px;padding:3px 5px}.klein th{font-size:9.5px}
.vk-legenda{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;margin:6px 0 0}.vk-legenda span{display:flex;align-items:center;gap:5px}.vk-legenda i{width:11px;height:11px;border-radius:50%;background:var(--pk)}
.vk-pagina{break-before:page}
.vk-raster{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-items:start}
.vk-kaart{border:1.5px solid #e5e7eb;border-top:5px solid var(--pk);border-radius:12px;padding:8px 10px;break-inside:avoid}
.vk-kaart h3{margin:0 0 4px;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
.vk-tab{width:100%;border-collapse:collapse;margin:0;font-size:10.5px}
.vk-tab th,.vk-tab td{padding:3px 4px;border:0;border-bottom:1px solid #eee;text-align:center;color:#14161a}
.vk-tab th{font-size:9px;color:#666}.vk-tab td:nth-child(2),.vk-tab th:nth-child(2){text-align:left}
.vk-team td:first-child{font-weight:700}.vk-team td,.vk-team th{text-align:left!important}
.vk-onder{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:8px;border-top:2px solid var(--c);font-size:10px;color:#555}
.vk-onder b{color:var(--c)}
.vk-boom{--bmc:var(--c);display:flex;flex-direction:column;gap:14px}.vk-boom .bm-blok{break-inside:avoid}
${T.BOOM_CSS}
</style>
<div class="vk">
  <header class="vk-kop">${logo}<div class="vk-titel"><small>${esc(ci.clubNaam || '')}</small><h1>${esc(a.naam || 'Toernooi')}</h1><p>${esc([datum, a.locatie].filter(Boolean).join(' · '))}</p></div>
    ${qr ? `<div class="vk-qr">${qr}Volg live</div>` : ''}</header>
  <div class="vk-feiten">${feiten.map(f => `<span>${f}</span>`).join('')}</div>
  <h2>Speelschema</h2>
  ${schema.length ? `<table class="vk-schema${klein}"><thead><tr><th class="vk-t"></th>${gebruikt.map(v => `<th>${esc(v.naam)}</th>`).join('')}</tr></thead><tbody>
    ${tijden.map(ti => `<tr><td class="vk-tijd">${esc(ti)}</td>${gebruikt.map(v => cel(op[`${ti}|${v.id}`])).join('')}</tr>`).join('')}</tbody></table>
  <div class="vk-legenda">${poules.map(p => `<span style="--pk:${esc(p.kleur || '#999')}"><i></i>${esc(p.naam)}</span>`).join('')}</div>` : '<p>Het schema volgt nog.</p>'}
  <div class="vk-pagina">
    <h2>Teams en kleedkamers</h2>
    <div class="vk-raster">${poules.map(p => { const ts = teams.filter(tm => tm.poule === p.id); return ts.length ? `<div class="vk-kaart" style="--pk:${esc(p.kleur || '#999')}"><h3>${esc(p.naam)}</h3><table class="vk-tab vk-team"><tr><th>Team</th><th>Kleedkamer</th><th>Eerste</th><th>Klaar</th></tr>
      ${ts.map(tm => `<tr><td>${esc(tm.naam)}</td><td>${esc(T.kkNaam(t, T.kkVanTeam(t, tm.id, plan)) || '–')}</td><td>${esc(rooster[tm.id]?.eerste || '')}</td><td>${esc(rooster[tm.id]?.laatste || '')}</td></tr>`).join('')}</table></div>` : ''; }).join('')}
      ${teams.some(tm => !tm.poule) ? `<div class="vk-kaart" style="--pk:#999"><h3>Zonder poule</h3><table class="vk-tab vk-team">${teams.filter(tm => !tm.poule).map(tm => `<tr><td>${esc(tm.naam)}</td><td>${esc(T.kkNaam(t, T.kkVanTeam(t, tm.id, plan)) || '–')}</td></tr>`).join('')}</table></div>` : ''}</div>
    ${ko ? `<h2>Finales</h2><div class="vk-boom">${ko}</div>` : ''}
    ${standen ? `<h2>Standen</h2><div class="vk-raster">${standen}</div>` : ''}
    <div class="vk-onder"><span><b>${esc(ci.clubNaam || '')}</b>${ci.clubNaam ? ' · ' : ''}${esc(a.naam || '')}</span><span>Gemaakt met Cluppie · ${esc(new Date().toLocaleDateString('nl-NL'))}</span></div>
  </div>
</div>`;
}

/* ---------- stijl ---------- */
export const TOERNOOI_CSS = `
.tn-ctrl{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-radius:var(--r-m,12px);margin:0 0 var(--space-sm,10px);border:1px solid var(--hair);background:var(--card)}
.tn-ctrl.ok{border-color:color-mix(in srgb,var(--ok,#16a34a) 45%,var(--hair));background:color-mix(in srgb,var(--ok,#16a34a) 8%,var(--card))}
.tn-ctrl.waarsch{border-color:var(--amber-lijn,#f59e0b);background:var(--amber-bg,#fff7e6)}
.tn-ctrl.fout{border-color:color-mix(in srgb,var(--rood,#dc2626) 55%,var(--hair));background:color-mix(in srgb,var(--rood,#dc2626) 9%,var(--card))}
.tn-ctrl-ico{font-size:20px;line-height:1;flex-shrink:0}.tn-ctrl.ok .tn-ctrl-ico{color:var(--ok,#16a34a);font-weight:800}
.tn-ctrl-t{flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:2px}.tn-ctrl-t small{color:var(--ink-2);font-size:var(--t-sm,14px)}
.tn-ctrl-k{display:flex;gap:6px;flex-wrap:wrap}
.tn-punt{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--hair)}
.tn-punt-i{font-size:18px;line-height:1.3;flex-shrink:0}.tn-punt-g{display:block;font-size:var(--t-xs,12px);color:var(--ink-2);font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.tn-punt .knop{flex-shrink:0}
.tn-details{margin:8px 0}.tn-details summary{cursor:pointer;font-weight:700;padding:6px 0}
.tn-proefrij{font-size:var(--t-sm,14px)}.tn-proefrij i{font-style:normal;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-2)}
.tn-ai{margin-top:var(--space-sm,10px)}
@media (max-width:720px){.tn-punt{flex-wrap:wrap}.tn-punt .ac-groei{flex:1 1 calc(100% - 40px)}.tn-punt .knop{margin-left:28px}.tn-ctrl-k{width:100%}}
.tn-cel.probleem{border-color:var(--rood,#dc2626);box-shadow:0 0 0 2px color-mix(in srgb,var(--rood,#dc2626) 35%,transparent)}
.tn-catrij{flex-wrap:wrap}.tn-mini{display:flex;align-items:center;gap:4px;font-size:var(--t-sm,14px);color:var(--ink-2)}
.tn-ins{padding:10px 0;border-top:1px solid var(--hair);display:flex;flex-direction:column;gap:4px}.tn-ins p{margin:0}.tn-ins.afgewezen{opacity:.6}
.tn-ins .ac-acties{flex-wrap:wrap;align-items:center}
.tn-st{font-size:var(--t-xs,12px);font-weight:700;padding:3px 10px;border-radius:999px;background:var(--surface-2,var(--hair));color:var(--ink)}
.tn-st.nieuw{background:color-mix(in srgb,var(--warn,#f59e0b) 30%,var(--card))}.tn-st.toegelaten{background:color-mix(in srgb,var(--ok,#16a34a) 28%,var(--card))}
.tn-opm{font-style:italic;font-size:var(--t-sm,14px)}
.tn-scherm{display:flex;gap:var(--space-md);align-items:flex-start;padding:10px 0;border-top:1px solid var(--hair)}
.tn-plaatje{width:96px;height:72px;flex-shrink:0;border-radius:10px;background:#fff;border:1.5px dashed var(--hair);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:#667;font-size:var(--t-xs,12px)}
.tn-plaatje img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.tn-scherm-v{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.tn-scherm-v .ac-rij{flex-wrap:wrap}
.tn-clubrij{flex-wrap:wrap}
.tn-club{padding:6px 0;border-bottom:1px solid var(--hair);display:flex;flex-direction:column;gap:4px}
.tn-clubteam{padding-left:14px}.tn-clubteam select{flex:0 0 190px}.tn-clubteam select.tn-leeg{border-style:dashed;color:var(--ink-2)}
.tn-auto{border:1.5px solid color-mix(in srgb,var(--accent) 45%,var(--hair))}
.tn-prijs{margin:6px 0 0;font-size:var(--t-sm)}
@media (max-width:600px){.tn-clubteam{flex-wrap:wrap;padding-left:0}.tn-clubteam select{flex:1 1 0}}
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
.tn-cel.vol{cursor:grab}.tn-cel.sleept{opacity:.35}.tn-cel.doel{border-color:var(--accent);border-style:dashed;background:color-mix(in srgb,var(--accent) 10%,var(--card))}
.tn-cel i{font-style:normal;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--pk)}
.tn-cel.ko{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--pk) 16%,var(--card)) 0 8px,color-mix(in srgb,var(--pk) 10%,var(--card)) 8px 16px)}
.tn-ko{border-left:4px solid var(--pk);padding:6px 0 8px 10px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid var(--hair)}
.tn-ko .tn-rij select{min-width:240px}
.tn-kkrij{flex-wrap:wrap}.tn-kk-kies{flex:0 1 330px;min-width:240px;width:auto}
@media (max-width:600px){.tn-kkrij>.ac-in:first-child{flex:1 1 100%}.tn-kk-kies{flex:1 1 100%}}
.tn-uit-titel{grid-column:1/-1;font-size:var(--t-xs);font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--pk);margin-top:4px}
.tn-uit .leeg{color:var(--ink-2);font-weight:400;font-style:italic}
.tn-uit-pen{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:var(--t-sm);color:var(--ink-2)}
.tn-bomen{display:flex;flex-direction:column;gap:var(--space-sm);margin-top:var(--space-sm)}.tn-bomen:empty{display:none}
${T.BOOM_CSS}
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
