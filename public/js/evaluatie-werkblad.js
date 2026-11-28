/* ==================== EVALUATIE OP DE DESKTOP: werkblad en teammatrix ====================
   [20261130a] Twee schermen voor de volledige beoordeling op de laptop, in
   plaats van het smalle zijpaneel:
     - Werkblad per speler: spelers links, één domein tegelijk in het midden
       (knoppen met de naam van het niveau en de trede uit de ladder erboven),
       rechts de radar die meegroeit.
     - Teammatrix: spelers als rijen, criteria als kolommen; typ 1 t/m 5.
   Beide werken op hetzelfde concept (nog niet opgeslagen wijzigingen per
   speler) en bewaren via bewaarVolledig in teams-spelers.js, dus precies
   hetzelfde datamodel als het formulier op de telefoon.
   Alleen op desktop: desktop-schermen.js tekent dit in de modus Evaluatie. */
import { S, esc, speler, meld } from './state.js?v=20261130p';
import { ico } from './icons.js?v=20261127b';
import { SKILLS } from './config.js?v=20261130p';
import { VB_DOMEINEN, critSleutel, critZichtbaar, ladderVan, NIV_LABEL, leeftijdTeam, koppelInfo } from './beoordeling-volledig.js?v=20261130p';
import { teRadarSvg } from './team-evaluatie-criteria.js?v=20261127p';
import { rondesVoorTeam, rondeSpelers, datumKort } from './evaluatierondes.js?v=20261130p';
import { bewaarVolledig, modalLeerpunt } from './teams-spelers.js?v=20261130p';
import { renderTeam } from './teams.js?v=20261130p';

const EW = { view:null, teamId:null, pid:null, dom:'TE', fcrit:0, ronde:null, extraRonde:null, moment:'',
  bewerk:{}, concepten:new Map(), mxDom:'TE', mx:{ r:0, c:0 }, mxPop:false, bezig:false };

/* ---------- gegevens ---------- */
const lft = () => leeftijdTeam(S.team?.categorie);
const mij = () => S.user?.uid;
const vandaag = () => new Date().toISOString().slice(0, 10);   // zelfde notatie als bewaarVolledig
const voornaam = p => (p?.naam || '').trim().split(' ')[0] || 'Speler';
const dag = iso => { try { return new Date(iso + 'T12:00').toLocaleDateString('nl-NL', { day:'numeric', month:'short' }); } catch(e){ return iso || ''; } };
const kom = n => n == null ? '–' : n.toFixed(1).replace('.', ',');
function spelers(){ return rondeSpelers(S.spelers).slice().sort((a, b) => (Number(a.nummer) || 99) - (Number(b.nummer) || 99)); }
function lopend(){ return rondesVoorTeam(S._clubRondes, S.teamId).filter(r => r.soort !== 'snel'); }
function rondeOpties(){
  const l = [...lopend()];
  if (EW.extraRonde && !l.some(r => r.id === EW.extraRonde.id)) l.push(EW.extraRonde);
  return l;
}
function ronde(){
  if (EW.ronde == null) EW.ronde = lopend()[0]?.id || '';
  if (EW.ronde && !rondeOpties().some(r => r.id === EW.ronde)) EW.ronde = '';
  return EW.ronde;
}
/* De beoordeling waar je voor deze speler in werkt: een bewust geopende, anders
   je eigen beoordeling in de gekozen ronde, anders je losse meting van vandaag. */
function doel(pid){
  const id = EW.bewerk[pid];
  if (id){ const b = S.beoordelingen.find(x => x.id === id); if (b) return b; }
  const r = ronde();
  const eigen = S.beoordelingen.filter(b => b.soort === 'volledig' && b.spelerId === pid && b.door?.uid === mij());
  return (r ? eigen.find(b => b.ronde === r) : eigen.find(b => !b.ronde && !b.officieel && b.datum === vandaag())) || null;
}
function vorige(pid, d){
  return S.beoordelingen.find(b => b.soort === 'volledig' && b.spelerId === pid && b.id !== d?.id && (!d || (b.datum || '') <= (d.datum || '9'))) || null;
}
const sleutel = pid => pid + '|' + ronde();
function concept(pid, maak = false){
  let c = EW.concepten.get(sleutel(pid));
  if (!c && maak){
    const d = doel(pid);
    c = { criteria:{ ...(d?.criteria || {}) }, notities:{ ...(d?.notities || {}) }, oud: d && !d.criteria ? { ...(d.scores || {}) } : {}, vuil:true };
    EW.concepten.set(sleutel(pid), c);
  }
  return c || null;
}
function waarden(pid){
  const c = concept(pid); if (c) return c;
  const d = doel(pid);
  return { criteria: d?.criteria || {}, notities: d?.notities || {}, oud: d && !d.criteria ? (d.scores || {}) : {}, vuil:false };
}
function zet(pid, k, n){
  const c = concept(pid, true);
  if (n >= 1 && n <= 5) c.criteria[k] = n; else delete c.criteria[k];
  c.vuil = true;
}
const aantalVuil = () => [...EW.concepten.values()].filter(c => c.vuil).length;
function crits(domId){
  const l = lft();
  return VB_DOMEINEN.filter(d => !domId || d.id === domId)
    .flatMap(d => d.criteria.map((c, i) => ({ d, c, i, k: critSleutel(d.id, i) })).filter(x => critZichtbaar(x.c, l)));
}
function telling(pid){
  const w = waarden(pid), alle = crits();
  return { n: alle.filter(x => w.criteria[x.k] >= 1).length, van: alle.length };
}
/* niet-afgerond gemiddelde per domein; valt terug op een oude domeinscore */
function domGem(bron, d){
  const w = crits(d.id).map(x => Number(bron?.criteria?.[x.k])).filter(n => n >= 1 && n <= 5);
  if (w.length) return w.reduce((a, b) => a + b, 0) / w.length;
  const o = Number((bron?.oud || bron?.scores || {})[d.id]);
  return o >= 1 && o <= 5 ? o : null;
}
const domKleur = id => SKILLS.find(x => x.id === id)?.kleur || 'var(--accent)';
const kleurTekst = n => `color-mix(in srgb,var(--n${n}) 60%,var(--ink))`;

/* ---------- openen en sluiten ---------- */
export function ewActief(){
  if (EW.view && EW.teamId !== S.teamId){ EW.view = null; EW.concepten.clear(); EW.bewerk = {}; EW.ronde = null; EW.extraRonde = null; }
  return !!EW.view && S._dkModus === 'evaluatie';
}
function start(view){
  if (EW.teamId !== S.teamId){ EW.concepten.clear(); EW.bewerk = {}; EW.ronde = null; EW.extraRonde = null; EW.moment = ''; }
  EW.teamId = S.teamId; EW.view = view; EW.mxPop = false;
  S._dkModus = 'evaluatie';
}
export function openWerkblad(pid, bestaande = null){
  start('werkblad');
  EW.pid = pid || spelers()[0]?.id || null; EW.fcrit = 0;
  if (bestaande){
    if (aantalVuil() && (bestaande.ronde || '') !== ronde()) EW.concepten.clear();
    EW.bewerk = { [bestaande.spelerId]: bestaande.id };
    EW.ronde = bestaande.ronde || '';
    if (bestaande.ronde){ const r = (S._clubRondes || []).find(x => x.id === bestaande.ronde); EW.extraRonde = { id: bestaande.ronde, naam: r?.naam || 'Evaluatieronde', tot: null }; }
    EW.concepten.delete(sleutel(bestaande.spelerId));
  }
  renderTeam();
}
export function openMatrix(){ start('matrix'); EW.mx = { r:0, c:0 }; renderTeam(); }

/* ---------- gedeelde stukjes ---------- */
function htmlKop(titel, acties){
  const r = ronde(), opties = rondeOpties();
  return `<div class="dk-kop"><div class="dk-kruim">${esc(S.team?.naam || '')} / Evaluatie / <b>${esc(titel)}</b></div>
    <div class="dk-acties">
      <label class="ew-hoort"><span>Hoort bij</span><select class="invoer" data-ew-ronde aria-label="Hoort bij">
        ${opties.map(o => `<option value="${esc(o.id)}" ${o.id === r ? 'selected' : ''}>${esc(o.naam)}${o.tot ? ' (t/m ' + esc(datumKort(o.tot)) + ')' : ''}</option>`).join('')}
        <option value="" ${r ? '' : 'selected'}>Geen ronde, losse meting</option></select></label>
      ${r ? '' : `<input class="invoer ew-moment" data-ew-moment value="${esc(EW.moment)}" placeholder="Moment, bijv. Kwartaalmeting" aria-label="Moment">`}
      <button class="dk-knop dk-stil" data-vb-naslag>${ico('training-plan', 18)}Zo beoordelen we</button>
      ${acties}
      <button class="dk-knop" data-ew="sluit">${ico('navigation-back', 18)}Overzicht</button>
    </div></div>`;
}
const zichtTekst = () => ronde()
  ? `${ico('admin-permissions', 15)}<span><b>Privé.</b> Alleen jij, de coördinatoren van de bouw en de clubbeheerder zien deze rondebeoordeling.</span>`
  : `${ico('team-player', 15)}<span>Zichtbaar voor alle trainers van dit team en de coördinatoren.</span>`;

/* ---------- werkblad per speler ---------- */
function htmlWerkblad(){
  const lijst = spelers();
  let p = speler(EW.pid);
  if (!p || !lijst.some(x => x.id === p.id)){ p = lijst[0]; EW.pid = p?.id || null; }
  if (!p) return `<div class="dk-scherm ew-scherm">${htmlKop('Werkblad', '')}<p class="dk-leeg ew-leeg">Nog geen spelers in dit team.</p></div>`;
  const d = doel(p.id), v = vorige(p.id, d), w = waarden(p.id), tel = telling(p.id);
  if (!VB_DOMEINEN.some(x => x.id === EW.dom)) EW.dom = VB_DOMEINEN[0].id;
  const dom = VB_DOMEINEN.find(x => x.id === EW.dom), lad = ladderVan(dom.id), rijen = crits(dom.id);
  EW.fcrit = Math.max(0, Math.min(EW.fcrit, rijen.length - 1));
  const vuil = aantalVuil();
  const volgende = volgendeSpeler(p.id);

  const lijstHtml = lijst.map(s => {
    const t = telling(s.id), c = concept(s.id), heeft = !!doel(s.id);
    const st = c?.vuil ? `<em class="ew-st vuil" title="Nog niet opgeslagen">${t.n}/${t.van}</em>`
      : heeft ? (t.n >= t.van ? `<em class="ew-st klaar">${ico('action-check', 14)}klaar</em>` : `<em class="ew-st half">${t.n}/${t.van}</em>`) : '';
    return `<button class="dk-sp ew-sp ${s.id === p.id ? 'actief' : ''}" data-ew="speler" data-id="${esc(s.id)}"><span class="dk-sp-nr">${esc(s.nummer ?? '')}</span><span class="dk-sp-t"><b>${esc((s.naam || '').trim() || 'Speler')}</b><small>${esc(s.positie || 'Speler')}</small></span>${st}</button>`;
  }).join('');

  const tabs = VB_DOMEINEN.map(x => {
    const cs = crits(x.id), n = cs.filter(y => w.criteria[y.k] >= 1).length;
    return `<button class="ew-tab ${x.id === dom.id ? 'aan' : ''}" data-ew="dom" data-id="${x.id}" style="--c:${domKleur(x.id)}"><b>${x.id}</b>${esc(x.naam.split(' ')[0])}<small class="${n >= cs.length ? 'ok' : ''}">${n}/${cs.length}</small></button>`;
  }).join('');

  /* [20261130d] De betekenis van elk niveau staat nu uitgeschreven boven de knoppen
     (blijft in beeld bij scrollen), op elke knop staat de trede, en onder een
     gekozen niveau lees je de hele zin terug, net als in het formulier op de telefoon. */
  const ladder = `<div class="ew-ladder"><div class="ew-ladder-l"><b>Wat zie je bij elk niveau?</b><span>${esc(lad.naam)} · ${esc(lad.model.split(' · ')[0])}</span><button type="button" class="dk-link" data-vb-info="dom" data-dom="${dom.id}">Meer uitleg</button></div>${[1, 2, 3, 4, 5].map(n => `<div class="ew-trede" style="--n:var(--n${n});--nt:var(--n${n}-tekst)"><b>${NIV_LABEL[n]}</b><strong>${esc(lad.treden[n].trede)}</strong><span>${esc(lad.treden[n].tekst)}</span></div>`).join('')}</div>`;
  const critHtml = rijen.map((x, idx) => {
    const g = w.criteria[x.k] || 0, vg = Number(v?.criteria?.[x.k]) || 0;
    return `<div class="ew-crit ${idx === EW.fcrit ? 'focus' : ''}" data-ew-rij="${idx}">
      <div class="ew-crit-n" data-ew="focus" data-idx="${idx}"><b>${esc(x.c.naam)}${x.c.vanaf ? `<span class="vb-badge">vanaf O${x.c.vanaf}</span>` : ''}<button type="button" class="vb-info" data-vb-info="crit" data-dom="${dom.id}" data-idx="${x.i}" aria-label="Uitleg ${esc(x.c.naam)}">i</button></b><small>${esc(x.c.uitleg)}</small></div>
      ${[1, 2, 3, 4, 5].map(n => `<button class="ew-lv ${g === n ? 'gekozen kn' + n : ''} ${vg === n ? 'vorig' : ''}" data-ew="niv" data-idx="${idx}" data-n="${n}" title="${esc(lad.treden[n].tekst)}" aria-pressed="${g === n}"><b>${NIV_LABEL[n]}</b><small>${esc(lad.treden[n].trede)}</small></button>`).join('')}
      ${g ? `<div class="ew-anker" style="--n:var(--n${g});--nt:var(--n${g}-tekst)"><i></i><b>${NIV_LABEL[g]}</b>${esc(lad.treden[g].tekst)}</div>` : ''}
    </div>`;
  }).join('');
  const oudDom = w.oud?.[dom.id] && !rijen.some(x => w.criteria[x.k]) ? `<div class="vb-oud">Eerder ingevuld als domeinscore: <b style="color:${kleurTekst(w.oud[dom.id])}">${NIV_LABEL[w.oud[dom.id]]}</b>. Vul de criteria in om die te vervangen.</div>` : '';

  const nu = VB_DOMEINEN.map(x => domGem(w, x)), was = VB_DOMEINEN.map(x => domGem(v, x));
  const kleuren = VB_DOMEINEN.map(x => `${domKleur(x.id)}`);
  const domRijen = VB_DOMEINEN.map((x, i) => {
    const delta = nu[i] != null && was[i] != null ? nu[i] - was[i] : null;
    const pijl = delta == null ? `<em class="gelijk">${nu[i] == null ? 'nog leeg' : ''}</em>`
      : Math.abs(delta) < 0.05 ? '<em class="gelijk">gelijk</em>'
      : `<em class="${delta > 0 ? 'op' : 'neer'}">${delta > 0 ? '▲' : '▼'} ${kom(Math.abs(delta))}</em>`;
    return `<button class="ew-domrij" data-ew="dom" data-id="${x.id}" style="--c:${kleuren[i]}"><b>${x.id}</b><span>${esc(x.naam)}</span><strong>${kom(nu[i])}</strong>${pijl}</button>`;
  }).join('');
  const lps = (p.leerpunten || []).filter(l => !l.klaar);

  return `<div class="dk-scherm ew-scherm ew-werkblad">
    ${htmlKop(voornaam(p), `<button class="dk-knop" data-ew="matrix">${ico('attendance-overview', 18)}Teammatrix</button>`)}
    <div class="ew-drie">
      <aside class="dk-kol dk-lijstkol" data-ew-scroll="lijst">${lijstHtml}</aside>
      <section class="dk-kol ew-midden" data-ew-scroll="midden">
        <div class="ew-wkop"><h1>${esc(voornaam(p))}</h1>
          <span class="ew-meta">${p.nummer != null && p.nummer !== '' ? '#' + esc(p.nummer) + ' · ' : ''}${esc(p.positie || 'Speler')}${v ? ' · vorige beoordeling ' + esc(dag(v.datum)) : ' · eerste volledige beoordeling'}${d ? ' · je bewerkt die van ' + esc(dag(d.datum)) : ''}</span>
          <div class="ew-voortgang">${tel.n} van ${tel.van} criteria<i><b style="width:${tel.van ? Math.round(tel.n / tel.van * 100) : 0}%"></b></i></div></div>
        <div class="ew-tabs" role="tablist">${tabs}</div>
        <div class="ew-domuitleg"><span>${esc(dom.omschrijving)}</span></div>
        ${ladder}${oudDom}${critHtml}
        <textarea class="invoer ew-not" data-ew-not="${dom.id}" rows="2" placeholder="Toelichting ${esc(dom.naam.toLowerCase())}…">${esc(w.notities?.[dom.id] || '')}</textarea>
        <div class="ew-onder"><span class="ew-hint">Niet goed gezien? Laat het criterium leeg. Nog eens klikken maakt het weer leeg.<br><span class="ew-toetsen"><kbd>1</kbd>–<kbd>5</kbd> kiezen <kbd>↓</kbd><kbd>↑</kbd> criterium <kbd>←</kbd><kbd>→</kbd> domein</span></span>
          ${v?.criteria ? `<button class="dk-knop dk-stil" data-ew="kopieer">Lege criteria vullen met de vorige beoordeling</button>` : ''}</div>
      </section>
      <aside class="dk-kol ew-rechts">
        <div class="dk-blok ew-radar"><h3 class="dk-label">Profiel nu${v ? `<span>stippel = ${esc(dag(v.datum))}</span>` : ''}</h3>
          ${nu.some(x => x) ? teRadarSvg(nu, v ? was : null, VB_DOMEINEN.map(x => x.id), kleuren, { breed:300, hoog:250, R:86 }) : '<p class="dk-leeg">Kies een niveau en het profiel verschijnt hier.</p>'}</div>
        <div class="dk-blok"><h3 class="dk-label">Per domein</h3>${domRijen}</div>
        <div class="dk-blok"><h3 class="dk-label">Leerpunten<span>${lps.length} open</span></h3>
          ${lps.slice(0, 3).map(l => `<div class="ew-lp">${esc(l.tekst)}</div>`).join('')}
          <button class="dk-link" data-ew="leerpunt">+ Leerpunt toevoegen</button></div>
        <div class="vb-zicht ${ronde() ? 'prive' : ''}">${zichtTekst()}</div>
        <div class="ew-knoppen">
          <button class="dk-knop rood" data-ew="bewaarvolgende" ${EW.bezig ? 'disabled' : ''}>${volgende ? 'Opslaan, naar ' + esc(voornaam(volgende)) + ' →' : 'Opslaan'}</button>
          <button class="dk-knop" data-ew="bewaar" ${vuil && !EW.bezig ? '' : 'disabled'}>${vuil > 1 ? `Alles opslaan (${vuil} spelers)` : 'Tussendoor opslaan'}</button>
        </div>
      </aside>
    </div></div>`;
}
/* de eerstvolgende speler in de lijst die nog niet (helemaal) beoordeeld is */
function volgendeSpeler(pid){
  const lijst = spelers(), i = lijst.findIndex(s => s.id === pid);
  const rest = [...lijst.slice(i + 1), ...lijst.slice(0, Math.max(0, i))];
  return rest.find(s => { const t = telling(s.id); return t.n < t.van; }) || null;
}

/* ---------- teammatrix ---------- */
function mxKolommen(){ return crits(EW.mxDom === 'alles' ? null : EW.mxDom); }
function mxWaarde(pid, k){
  const w = waarden(pid), n = Number(w.criteria[k]) || 0;
  if (n) return { n, soort:'nu' };
  const vg = Number(vorige(pid, doel(pid))?.criteria?.[k]) || 0;
  return { n:0, soort: vg ? 'vorig' : 'leeg', vorig: vg };
}
/* gemiddelde over de domeinen in beeld (één domein, of alle vijf) */
function mxGem(bron){
  if (!bron) return null;
  const w = VB_DOMEINEN.filter(d => EW.mxDom === 'alles' || d.id === EW.mxDom).map(d => domGem(bron, d)).filter(n => n != null);
  return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
}
function htmlMatrix(){
  const lijst = spelers(), kol = mxKolommen(), alles = EW.mxDom === 'alles';
  if (!alles && !VB_DOMEINEN.some(x => x.id === EW.mxDom)) EW.mxDom = VB_DOMEINEN[0].id;
  EW.mx.r = Math.max(0, Math.min(EW.mx.r, lijst.length - 1)); EW.mx.c = Math.max(0, Math.min(EW.mx.c, kol.length - 1));
  const vuil = aantalVuil();
  const totaal = lijst.length * crits().length, gevuld = lijst.reduce((a, s) => a + telling(s.id).n, 0);
  const seg = VB_DOMEINEN.map(x => `<button class="${EW.mxDom === x.id ? 'aan' : ''}" data-ew="mxdom" data-id="${x.id}" style="--c:${domKleur(x.id)}"><b>${x.id}</b>${esc(x.naam.split(' ')[0])}</button>`).join('')
    + `<button class="${alles ? 'aan' : ''}" data-ew="mxdom" data-id="alles">Alles</button>`;
  const domKop = alles
    ? `<tr class="ew-mx-dom"><th></th>${VB_DOMEINEN.map(x => { const n = crits(x.id).length; return n ? `<th colspan="${n}" style="--c:${domKleur(x.id)}">${x.id} · ${esc(x.naam)}</th>` : ''; }).join('')}<th colspan="2"></th></tr>` : '';
  const kop = `<tr><th class="ew-nm">${lijst.length} spelers</th>${kol.map((x, c) => `<th class="${alles && x.i === crits(x.d.id)[0].i ? 'ew-sep' : ''}"><button type="button" class="ew-mx-th" data-vb-info="crit" data-dom="${x.d.id}" data-idx="${x.i}" title="${esc(x.c.uitleg)}">${esc(x.c.naam)}</button></th>`).join('')}<th class="ew-sep ew-gem">Gem.</th><th class="ew-gem">Vorige</th></tr>`;
  const rijen = lijst.map((s, r) => {
    const w = waarden(s.id), v = vorige(s.id, doel(s.id));
    const g = mxGem(w), vg = mxGem(v);
    return `<tr class="${r === EW.mx.r ? 'ew-hl' : ''}"><td class="ew-nm"><button type="button" data-ew="naarspeler" data-id="${esc(s.id)}" title="Open het werkblad van ${esc(voornaam(s))}"><b>${esc((s.naam || '').trim() || 'Speler')}</b><small>${esc(s.positie || '')}</small>${concept(s.id)?.vuil ? '<i class="ew-stip" title="Nog niet opgeslagen"></i>' : ''}</button></td>
      ${kol.map((x, c) => { const m = mxWaarde(s.id, x.k); const aan = r === EW.mx.r && c === EW.mx.c;
        return `<td class="${alles && x.i === crits(x.d.id)[0].i ? 'ew-sep' : ''}"><button type="button" class="ew-cel ${m.soort === 'nu' ? 'kn' + m.n : m.soort === 'vorig' ? 'ew-c-vorig' : 'ew-c-leeg'}" ${m.soort === 'vorig' ? `style="--c:var(--n${m.vorig}-tekst)"` : ''} data-ew="cel" data-r="${r}" data-c="${c}" tabindex="${aan ? 0 : -1}" aria-label="${esc(voornaam(s))}, ${esc(x.c.naam)}: ${m.n ? NIV_LABEL[m.n] : m.vorig ? 'vorige keer ' + NIV_LABEL[m.vorig] : 'leeg'}">${m.n || m.vorig || '·'}</button></td>`; }).join('')}
      <td class="ew-sep ew-gem"><b>${kom(g)}</b></td><td class="ew-gem ew-vg">${kom(vg)}</td></tr>`;
  }).join('');
  return `<div class="dk-scherm ew-scherm ew-matrix">
    ${htmlKop('Teammatrix', `<button class="dk-knop" data-ew="werkblad">${ico('team-player', 18)}Per speler</button>`)}
    <div class="ew-mx">
      <div class="ew-mx-balk"><div class="ew-seg">${seg}</div>        <span class="ew-ruimte"></span>
        <button class="dk-knop dk-stil" data-ew="mxvorige" title="Zet in de lege vakjes van deze kolommen de score van de vorige beoordeling">Vorige overnemen</button>
        ${vuil ? `<button class="dk-knop dk-stil" data-ew="weggooien">Weggooien</button>` : ''}
        <button class="dk-knop rood" data-ew="bewaar" ${vuil && !EW.bezig ? '' : 'disabled'}>${vuil ? `Opslaan (${vuil} ${vuil === 1 ? 'speler' : 'spelers'})` : 'Alles opgeslagen'}</button></div>
      <div class="ew-mx-rol ${alles ? 'alles' : ''}" data-ew-scroll="mx"><table class="ew-mx-tabel"><thead>${domKop}${kop}</thead><tbody>${rijen}</tbody></table></div>
      <div class="ew-mx-voet"><span class="ew-leg"><span><b>${gevuld} van ${totaal}</b> ingevuld</span>${[1, 2, 3, 4, 5].map(n => `<span><i class="kn${n}"></i>${n} ${NIV_LABEL[n]}</span>`).join('')}<span><i class="vorig"></i>omlijnd = vorige beoordeling</span></span>
        <span class="ew-toetsen"><kbd>1</kbd>–<kbd>5</kbd> invullen <kbd>Tab</kbd> volgende <kbd>Enter</kbd> vorige overnemen <kbd>Del</kbd> leegmaken</span></div>
      <div class="vb-zicht ${ronde() ? 'prive' : ''}">${zichtTekst()}</div>
      ${EW.mxPop ? htmlMxPop(lijst, kol) : ''}
    </div></div>`;
}
function htmlMxPop(lijst, kol){
  const s = lijst[EW.mx.r], x = kol[EW.mx.c]; if (!s || !x) return '';
  const lad = ladderVan(x.d.id), m = mxWaarde(s.id, x.k);
  return `<div class="ew-pop" role="dialog" aria-label="Niveau kiezen"><h5>${esc(voornaam(s))} · ${esc(x.c.naam)}</h5><p>${esc(x.c.uitleg)}</p>
    ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${m.n === n ? 'aan' : ''}" data-ew="mxkies" data-n="${n}"><i class="kn${n}">${n}</i><span>${NIV_LABEL[n]}${m.vorig === n ? ' <em>vorige</em>' : ''}</span><small>${esc(lad.treden[n].tekst)}</small></button>`).join('')}
    ${m.n ? `<button type="button" class="ew-wis" data-ew="mxkies" data-n="0">Leegmaken</button>` : ''}</div>`;
}

/* ---------- tekenen en koppelen ---------- */
export function htmlEw(){ return EW.view === 'matrix' ? htmlMatrix() : htmlWerkblad(); }
function teken(){
  const oud = document.querySelector('#view-team > .ew-scherm');
  if (!oud || !ewActief()) return renderTeam();
  const scroll = {};
  oud.querySelectorAll('[data-ew-scroll]').forEach(e => { scroll[e.dataset.ewScroll] = [e.scrollTop, e.scrollLeft]; });
  const t = document.createElement('div'); t.innerHTML = htmlEw();
  const nieuw = t.firstElementChild;
  oud.replaceWith(nieuw);
  nieuw.querySelectorAll('[data-ew-scroll]').forEach(e => { const s = scroll[e.dataset.ewScroll]; if (s){ e.scrollTop = s[0]; e.scrollLeft = s[1]; } });
  koppelEw(nieuw.parentElement);
}
function plaatsPop(root){
  const pop = root.querySelector('.ew-pop'), cel = root.querySelector(`.ew-cel[data-r="${EW.mx.r}"][data-c="${EW.mx.c}"]`), mx = root.querySelector('.ew-mx');
  if (!pop || !cel || !mx) return;
  const a = cel.getBoundingClientRect(), b = mx.getBoundingClientRect();
  let x = a.left - b.left + a.width / 2 - pop.offsetWidth / 2, y = a.bottom - b.top + 8;
  x = Math.max(8, Math.min(x, b.width - pop.offsetWidth - 8));
  if (a.bottom + pop.offsetHeight + 16 > window.innerHeight) y = a.top - b.top - pop.offsetHeight - 8;
  pop.style.left = x + 'px'; pop.style.top = Math.max(8, y) + 'px';
}
export function koppelEw(v){
  const root = v.querySelector(':scope > .ew-scherm'); if (!root) return;
  koppelInfo(root, lft());
  root.addEventListener('click', klik);
  root.addEventListener('change', e => {
    if (!e.target.matches('[data-ew-ronde]')) return;
    if (aantalVuil() && !confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Wisselen gooit ze weg. Doorgaan?')){ e.target.value = ronde(); return; }
    EW.concepten.clear(); EW.bewerk = {}; EW.ronde = e.target.value; teken();
  });
  root.addEventListener('input', e => {
    if (e.target.matches('[data-ew-moment]')){ EW.moment = e.target.value; return; }
    if (e.target.matches('[data-ew-not]')){
      const c = concept(EW.pid, true); const t = e.target.value;
      if (t.trim()) c.notities[e.target.dataset.ewNot] = t; else delete c.notities[e.target.dataset.ewNot];
      c.vuil = true;
      const b = root.querySelector('[data-ew="bewaar"]'); if (b) b.disabled = false;
    }
  });
  if (EW.view === 'matrix'){
    plaatsPop(root);
    const actief = document.activeElement;
    if (!actief || actief === document.body || !root.contains(actief) || actief.classList.contains('ew-cel'))
      root.querySelector(`.ew-cel[data-r="${EW.mx.r}"][data-c="${EW.mx.c}"]`)?.focus({ preventScroll: EW.mxPop });
  }
  if (!toetsenAan){ toetsenAan = true; document.addEventListener('keydown', toets);
    window.addEventListener('beforeunload', e => { if (aantalVuil()){ e.preventDefault(); e.returnValue = ''; } }); }
}
let toetsenAan = false;

async function bewaarVuil(){
  if (EW.bezig) return -1;
  EW.bezig = true;
  let n = 0, leeg = 0;
  const r = ronde(), rondeNaam = r ? (rondeOpties().find(x => x.id === r)?.naam || '') : '';
  try {
    for (const [key, c] of [...EW.concepten]){
      if (!c.vuil){ EW.concepten.delete(key); continue; }
      const pid = key.split('|')[0], d = doel(pid);
      const notities = {};
      for (const [k, t] of Object.entries(c.notities || {})) if (String(t).trim()) notities[k] = String(t).trim();
      const ok = await bewaarVolledig({ spelerId: pid, bestaande: d, criteria: c.criteria, oud: c.oud, notities,
        rondeKeuze: r || (d && !d.ronde && d.officieel ? '_oud' : ''), rondeNaam,
        moment: EW.moment.trim() || (d && !r ? (d.bron?.label || '') : '') });
      if (ok){ n++; EW.concepten.delete(key); } else leeg++;
    }
    if (n) meld(n === 1 ? 'Beoordeling opgeslagen' : `${n} beoordelingen opgeslagen`);
    else if (leeg) meld('Geef minstens één score');
  } catch(e){ meld('Opslaan mislukt: ' + (e.code || e.message)); n = -1; }
  EW.bezig = false;
  return n;
}
function mxStap(dr, dc){
  const rijen = spelers().length, kol = mxKolommen().length;
  let r = EW.mx.r + dr, c = EW.mx.c + dc;
  if (c >= kol){ c = 0; r++; } else if (c < 0){ c = kol - 1; r--; }
  if (r < 0 || r >= rijen) return false;
  EW.mx = { r, c }; return true;
}
function mxZet(n, verder = true){
  const s = spelers()[EW.mx.r], x = mxKolommen()[EW.mx.c]; if (!s || !x) return;
  zet(s.id, x.k, n); EW.mxPop = false;
  if (verder) mxStap(0, 1);
  teken();
}

async function klik(e){
  if (e.target.closest('[data-vb-info],[data-vb-naslag]')) return;
  const b = e.target.closest('[data-ew]');
  if (!b){ if (EW.mxPop && !e.target.closest('.ew-pop')){ EW.mxPop = false; teken(); } return; }
  const a = b.dataset.ew, id = b.dataset.id;
  if (a === 'sluit'){
    if (aantalVuil() && !confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Sluiten gooit ze weg. Doorgaan?')) return;
    EW.concepten.clear(); EW.bewerk = {}; EW.view = null; if (EW.pid) S._beoordeelProfiel = EW.pid; renderTeam(); return; }
  if (a === 'matrix'){ EW.view = 'matrix'; EW.mxPop = false; EW.mxDom = EW.dom; const i = spelers().findIndex(s => s.id === EW.pid); EW.mx = { r: Math.max(0, i), c: 0 }; teken(); return; }
  if (a === 'werkblad'){ EW.view = 'werkblad'; EW.mxPop = false; const s = spelers()[EW.mx.r]; if (s) EW.pid = s.id; if (EW.mxDom !== 'alles') EW.dom = EW.mxDom; teken(); return; }
  if (a === 'speler'){ EW.pid = id; EW.fcrit = 0; S._beoordeelProfiel = id; teken(); return; }
  if (a === 'naarspeler'){ EW.view = 'werkblad'; EW.mxPop = false; EW.pid = id; EW.fcrit = 0; if (EW.mxDom !== 'alles') EW.dom = EW.mxDom; teken(); return; }
  if (a === 'focus'){ EW.fcrit = Number(b.dataset.idx) || 0; teken(); return; }
  if (a === 'dom'){ EW.dom = id; EW.fcrit = 0; teken(); return; }
  if (a === 'niv'){
    const idx = Number(b.dataset.idx), n = Number(b.dataset.n), x = crits(EW.dom)[idx]; if (!x) return;
    const zelfde = waarden(EW.pid).criteria[x.k] === n;
    zet(EW.pid, x.k, zelfde ? 0 : n);
    EW.fcrit = zelfde ? idx : Math.min(idx + 1, crits(EW.dom).length - 1);
    teken(); return; }
  if (a === 'kopieer'){
    const v = vorige(EW.pid, doel(EW.pid)), w = waarden(EW.pid); let n = 0;
    for (const x of crits()){ const vg = Number(v?.criteria?.[x.k]); if (vg >= 1 && !w.criteria[x.k]){ zet(EW.pid, x.k, vg); n++; } }
    meld(n ? `${n} criteria overgenomen. Pas aan wat veranderd is.` : 'Er viel niets over te nemen'); teken(); return; }
  if (a === 'leerpunt'){ modalLeerpunt(EW.pid); return; }
  if (a === 'bewaar'){ const klaar = bewaarVuil(); teken(); await klaar; teken(); return; }
  if (a === 'bewaarvolgende'){
    const pid = EW.pid, c = concept(pid);
    if (!c?.vuil && !doel(pid)) return meld('Geef minstens één score');
    const n = c?.vuil ? await bewaarVuil() : 1;
    if (n > 0){ const s = volgendeSpeler(pid); if (s){ EW.pid = s.id; EW.fcrit = 0; EW.dom = VB_DOMEINEN[0].id; S._beoordeelProfiel = s.id; } else meld('Alle spelers zijn beoordeeld'); }
    teken(); return; }
  if (a === 'mxdom'){ EW.mxDom = id; EW.mx.c = 0; EW.mxPop = false; teken(); return; }
  if (a === 'cel'){ const r = Number(b.dataset.r), c = Number(b.dataset.c); const open = EW.mxPop && EW.mx.r === r && EW.mx.c === c; EW.mx = { r, c }; EW.mxPop = !open; teken(); return; }
  if (a === 'mxkies'){ mxZet(Number(b.dataset.n), false); return; }
  if (a === 'mxvorige'){
    let n = 0;
    for (const s of spelers()){ const v = vorige(s.id, doel(s.id)), w = waarden(s.id);
      for (const x of mxKolommen()){ const vg = Number(v?.criteria?.[x.k]); if (vg >= 1 && !w.criteria[x.k]){ zet(s.id, x.k, vg); n++; } } }
    meld(n ? `${n} vakjes gevuld met de vorige beoordeling. Pas aan wat veranderd is en sla op.` : 'Er viel niets over te nemen'); teken(); return; }
  if (a === 'weggooien'){ if (!confirm('Alle wijzigingen die nog niet zijn opgeslagen weggooien?')) return; EW.concepten.clear(); teken(); return; }
}

function toets(e){
  if (!EW.view || e.ctrlKey || e.metaKey || e.altKey) return;
  const root = document.querySelector('#view-team.actief > .ew-scherm'); if (!root) return;
  if (document.querySelector('#modalAchter.open, #vbPopup.toon')) return;
  const t = e.target, k = e.key;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const cijfer = /^[1-5]$/.test(k) ? Number(k) : 0;
  if (EW.view === 'werkblad'){
    const rijen = crits(EW.dom), x = rijen[EW.fcrit];
    if (cijfer && x){ zet(EW.pid, x.k, cijfer); EW.fcrit = Math.min(EW.fcrit + 1, rijen.length - 1); }
    else if ((k === '0' || k === 'Delete' || k === 'Backspace') && x) zet(EW.pid, x.k, 0);
    else if (k === 'ArrowDown') EW.fcrit = Math.min(EW.fcrit + 1, rijen.length - 1);
    else if (k === 'ArrowUp') EW.fcrit = Math.max(EW.fcrit - 1, 0);
    else if (k === 'ArrowRight' || k === 'ArrowLeft'){
      const i = VB_DOMEINEN.findIndex(d => d.id === EW.dom) + (k === 'ArrowRight' ? 1 : -1);
      if (i < 0 || i >= VB_DOMEINEN.length) return;
      EW.dom = VB_DOMEINEN[i].id; EW.fcrit = 0;
    } else return;
    e.preventDefault(); teken();
    return;
  }
  /* matrix: alleen als een vakje de focus heeft (of er nog niets gekozen is) */
  if (t !== document.body && !t.classList?.contains('ew-cel') && !t.closest?.('.ew-pop')) return;
  if (k === 'Escape'){ if (EW.mxPop){ EW.mxPop = false; e.preventDefault(); teken(); } return; }
  if (cijfer){ e.preventDefault(); mxZet(cijfer); return; }
  if (k === '0' || k === 'Delete' || k === 'Backspace'){ e.preventDefault(); mxZet(0, false); return; }
  if (k === 'Enter'){
    const s = spelers()[EW.mx.r], x = mxKolommen()[EW.mx.c]; if (!s || !x) return;
    const m = mxWaarde(s.id, x.k);
    e.preventDefault();
    if (!m.n && m.vorig) mxZet(m.vorig); else { EW.mxPop = false; mxStap(0, 1); teken(); }
    return; }
  const stap = k === 'ArrowRight' ? [0, 1] : k === 'ArrowLeft' ? [0, -1] : k === 'ArrowDown' ? [1, 0] : k === 'ArrowUp' ? [-1, 0] : k === 'Tab' ? [0, e.shiftKey ? -1 : 1] : null;
  if (!stap) return;
  EW.mxPop = false;
  if (k === 'ArrowDown' || k === 'ArrowUp'){ const r = EW.mx.r + stap[0]; if (r < 0 || r >= spelers().length) return; EW.mx.r = r; }
  else if (!mxStap(stap[0], stap[1])){ if (k === 'Tab') return; }   // aan het eind van de tabel: Tab loopt gewoon door
  e.preventDefault(); teken();
}
