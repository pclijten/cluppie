/* ==================== TEAM-HUB (startscherm van een team) ====================
   Onderdeel van de teams.js-modulaire split. Dit bestand bevat de HTML-bouwers
   voor het nieuwe tegel-startscherm dat de onderbalk vervangt, plus de nieuwe
   pagina's die daarbij horen:
     • htmlHub()               — het tegel-startscherm (kop + secties)
     • htmlPresWedstrijd()     — presentie/selectie per wedstrijd (met kiezer)
     • htmlEvaluatieLijst()    — wedstrijden die nog geëvalueerd moeten worden
     • htmlLeerlijnOverzicht() — alle open leerpunten per speler in één lijst
     • htmlHistorieLijst()     — spelerslijst als ingang naar het historie-tab
   Event-koppeling gebeurt in teams.js (koppelTeamTab) — dit bestand levert
   alleen HTML + de opslaghulpjes voor de wedstrijd-presentie. Het importeert
   bewust NIET terug uit teams.js (geen circulaire import). */
import { db, doc, updateDoc, deleteField } from './firebase.js?v=20261011g';
import { S, esc, meld, datumNL, modAan, openModal } from './state.js?v=20261011g';
import { AFWEZIG_REDENEN, afwezigRedenInfo } from './config.js?v=20261011g';
import { ico } from './icons.js?v=20260922c';
import { logoImg, primaireClubId } from './clubconfig.js?v=20261011g';
import { analyseWedstrijd, WISSEL_BEURT } from './analyse.js?v=20261011g';
import { telGebruik } from './tracker.js?v=20261011g';
import { ongelezenBerichten } from './berichten.js?v=20261011g';
import { lijstjesOpenTotaal } from './teams-lijsten.js?v=20261012a';
import { htmlRondeBalk } from './evaluatierondes.js?v=20261011g';
import { htmlSelectieDashboard, heeftElftallen, elftalWedstrijd, elftalNaam, spelersVoorElftal, elftalPillWedstrijd } from './elftallen.js?v=20261011g';
import { isAfgelast, telMee, soortPill, wedstrijdInfo, htmlAfgelastBanner, afgelastMeldingen, deelTekst } from './wedstrijd-status.js?v=20261012h';


/* ---------- Hulpjes ---------- */
function voornaamCoach(){
  let naam = '';
  for (const t of S.teams){ const n = t.ledenInfo?.[S.user.uid]?.naam; if (n){ naam = n; break; } }
  if (!naam) for (const c of S.clubs){ const n = c.ledenInfo?.[S.user.uid]?.naam; if (n){ naam = n; break; } }
  naam = (naam || S.user.displayName || (S.user.email||'').split('@')[0] || '').trim();
  const v = naam ? naam.split(/[ @.]/)[0] : '';
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : 'coach';
}

function vandaagIso(){ return new Date().toISOString().slice(0,10); }

/* Wedstrijden die nog geëvalueerd moeten worden (zelfde criteria als de
   "nog te evalueren"-herinnering op het teamsoverzicht, maar dan binnen
   het geopende team op basis van de al geladen state). */
export function evaluatieOpen(){
  if (!modAan('evaluaties')) return [];
  const vandaag = vandaagIso();
  const geevalueerd = new Set((S.teamEvaluaties || []).map(e => e.wedstrijdId));
  return S.wedstrijden
    .filter(w => (w.datum || '') <= vandaag)
    .filter(w => !w.evaluatieGenegeerd && !geevalueerd.has(w.id))
    .filter(w => (w.goals || []).length || analyseWedstrijd(w).kwarten)
    .sort((a,b) => (b.datum||'').localeCompare(a.datum||''));
}

/* ==================== HUB ==================== */
/* Eén tegel. data-hub-open="<tab>" wordt in teams.js gekoppeld aan zetTeamTab. */
function tegel(tab, naam, icoNaam, badge){
  const mark = badge === true ? '<span class="hub-dot"></span>'
             : badge ? `<span class="hub-badge">${badge}</span>` : '';
  return `<button class="hub-tegel" data-hub-open="${tab}">${mark}${ico(icoNaam, 40)}<span class="hub-tnaam">${esc(naam)}</span></button>`;
}

export function htmlHub(updInfo){
  const upd = updInfo || { ongelezen:0, nieuwsteTitel:'' };
  const vandaagMooi = (() => {
    let d = '';
    try { d = new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'}); } catch(e){}
    return d.charAt(0).toUpperCase() + d.slice(1);
  })();

  const evalOpen = evaluatieOpen().length;
  const documentenOngelezen = S.documenten
    .filter(d => (d.teams||[]).includes(S.teamId) && !S.trainingenGelezen[d.id]).length;
  const oefenstofOngelezen = S.trainingen
    .filter(t => (t.teams||[]).includes(S.teamId) && !S.trainingenGelezen[t.id]).length;

  /* Teamkeuze-dropdown: alle teams van deze coach + doorlink naar het
     teamsoverzicht (daar wonen clubbeheer, berichten en team-aanmaken). */
  const teamKeuze = `
    <div class="hub-teamrij">
      <button class="hub-teamnaam" id="hubTeamKnop">${esc(S.team.naam)}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4 4 4-4"/></svg></button>
      <span class="hub-teamsub">${S.team.categorie ? esc(S.team.categorie)+' · ' : ''}${esc(S.team.format)} tegen ${esc(S.team.format)}</span>
      <div class="hub-teamkeuze" id="hubTeamKeuze">
        ${S.teams.map(t => `
          <button data-hub-team="${t.id}" class="${t.id === S.teamId ? 'actief' : ''}">${esc(t.naam)}
            <span class="sub">${esc(t.format)}v${esc(t.format)}</span></button>`).join('')}
        <button data-hub-overzicht="1">Teamoverzicht &amp; beheer <span class="sub">›</span></button>
      </div>
    </div>`;

  /* Secties conform de goedgekeurde mockup (v4, feedback 18 aug). */
  const secties = [
    ['Oefenstof', [
      tegel('trainingen',       'Oefenstof',    'training-cones', oefenstofOngelezen || null),
      `<button class="hub-tegel" data-open-tactiek="1">${ico('football-tactics', 40)}<span class="hub-tnaam">Tactiek</span></button>`,
      tegel('videos',           'Video\u2019s', 'training-video'),
      tegel('trainingsmodule',  'Training maken', 'training-plan'),
      tegel('seizoensplan',     'Seizoen',      'planning-month'),
    ]],
    ['Presentie', [
      tegel('presentietraining','Training',     'training-cones'),
      tegel('preswedstrijd',    'Wedstrijd',    'football-whistle'),
      tegel('stats',            'Stats',        'stats-bars'),
    ]],
    ['Wedstrijden', [
      tegel('wedstrijden',      'Wedstrijden',  'football-lineup', afgelastMeldingen(S.wedstrijden, vandaagIso()).length || null),
      ...(modAan('evaluaties') ? [tegel('evaluatie', 'Evaluatie', 'attendance-evaluatie', evalOpen || null)] : []),
      tegel('poule',            'Poule',        'football-competition'),
    ]],
    ['Spelers', [
      tegel('spelers',          'Overzicht',    'team-members'),
      ...(modAan('leerlijn') ? [tegel('leerlijnoverzicht', 'Leerlijn', 'football-training')] : []),
      tegel('historie',         'Historie',     'attendance-overview'),
    ]],
    ['Meer', [
      tegel('planning',         'Planning',     'planning-calendar'),
      tegel('documenten',       'Documenten',   'admin-document', documentenOngelezen || null),
      ...(modAan('lijstjes') ? [tegel('lijstjes', 'Lijstjes', 'attendance-fill', lijstjesOpenTotaal() || null)] : []),
      tegel('instellingen',     'Instellingen', 'navigation-settings'),
      tegel('help',             'Help',         'navigation-help'),
      `<button class="hub-tegel" data-open-hulpchat="1">${ico('communication-chat', 40)}<span class="hub-tnaam">Hulpchat</span></button>`,
      tegel('berichten',        'Berichten',    'communication-announcement', ongelezenBerichten() || null),
    ]],
  ];

  /* Update-melding — combi van banner (bovenaan) en verrijkte onder-link.
     Beide verschijnen alleen zolang er ongelezen updates zijn; zodra de
     coach de Updates-tab opent, markeert htmlUpdates() alles als gezien en
     valt de melding vanzelf weg. De banner is per sessie weg te tikken
     (S._updBannerWeg) zonder de teller op de onder-link te wissen. */
  const updBanner = (upd.ongelezen > 0 && !S._updBannerWeg) ? `
    <button class="upd-banner" data-hub-open="updates">
      <span class="upd-b-ico">${ico('communication-announcement', 22)}</span>
      <span class="upd-b-txt">
        <span class="upd-b-rij1"><span class="upd-b-badge">Nieuw</span><span class="upd-b-tel">${upd.ongelezen} nieuwe update${upd.ongelezen === 1 ? '' : 's'}</span></span>
        <span class="upd-b-titel">${esc(upd.nieuwsteTitel)}</span>
        <span class="upd-b-sub">Tik om te bekijken wat er nieuw is</span>
      </span>
      <svg class="upd-b-pijl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      <span class="upd-b-sluit" id="updBannerSluit" role="button" aria-label="Verbergen">&#10005;</span>
    </button>` : '';

  const updLink = upd.ongelezen > 0 ? `
    <button class="hub-updates-link plus" data-hub-open="updates">
      <span class="upd-l-dot"></span>Wat is er nieuw?<span class="upd-l-pil">${upd.ongelezen} nieuw</span><span class="upd-l-pijl">&#8250;</span>
    </button>` : `
    <button class="hub-updates-link" data-hub-open="updates">Wat is er nieuw? Bekijk de updates &#8250;</button>`;

  return `
    <div class="welkom-kop hub-kop">
      <div class="club-streep" aria-hidden="true"></div>
      ${logoImg('welkom-schild', primaireClubId())}
      <div class="welkom-tekst">
        <div class="welkom-datum">${esc(vandaagMooi)}</div>
        <h1 class="welkom-groet">Hoi <span class="groet-naam">${esc(voornaamCoach())}</span></h1>
      </div>
      <button class="uitlog-knop" id="hubPrivacy" title="Privacy &amp; mijn gegevens" style="margin-right:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/></svg></button>
      <button class="uitlog-knop" id="hubUitloggen" title="Uitloggen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/></svg></button>
    </div>
    ${teamKeuze}
    ${htmlAfgelastBanner(S.wedstrijden, S.team.naam, vandaagIso())}
    ${updBanner}
    ${modAan('evaluaties') ? htmlRondeBalk(S._clubRondes, S.teamId, S.spelers, S.beoordelingen) : ''}
    ${htmlSelectieDashboard()}
    ${secties.map(([kop, tegels]) => `
      <section class="hub-sectie">
        <div class="hub-sectie-kop">${esc(kop)}</div>
        <div class="hub-grid">${tegels.join('')}</div>
      </section>`).join('')}
    ${updLink}`;
}

/* ==================== PRESENTIE WEDSTRIJD ==================== */
/* [20260928e] Standaardselectie als de wedstrijd er (nog) geen heeft: iedereen,
   of bij een team met 1e + 2e elftal de spelers van het elftal van die wedstrijd.
   Zelfde regel als normaliseerWedstrijd in wedstrijd.js. */
function standaardSelectie(w){
  if (Array.isArray(w.selectie) && w.selectie.length) return w.selectie;
  if (heeftElftallen() && w.type !== 'toernooi'){
    const e = spelersVoorElftal(S.spelers, elftalWedstrijd(w)).eigen;
    if (e.length) return e.map(p => p.id);
  }
  return S.spelers.map(p => p.id);
}
/* De wedstrijd waarvoor presentie getoond wordt: gekozen door de coach, of
   standaard de eerstvolgende (vandaag of later); zonder komende wedstrijden
   de meest recente. */
export function presWedstrijdHuidig(){
  const gekozen = S.wedstrijden.find(w => w.id === S._presWedstrijdId);
  if (gekozen) return gekozen;
  const vandaag = vandaagIso();
  const komend = S.wedstrijden
    .filter(w => (w.datum || '') >= vandaag && telMee(w))
    .sort((a,b) => (a.datum||'').localeCompare(b.datum||'') || (a.aftrap||'').localeCompare(b.aftrap||''));
  return komend[0] || S.wedstrijden[0] || null;
}

function wedstrijdTitel(w){
  return w.thuis ? `${esc(S.team.naam)} – ${esc(w.tegenstander)}`
                 : `${esc(w.tegenstander)} – ${esc(S.team.naam)}`;
}

export function htmlPresWedstrijd(){
  const w = presWedstrijdHuidig();
  if (!w){
    return `<div class="kaart leeg">Nog geen wedstrijden.<br>Maak eerst een wedstrijd aan via de tegel <b>Wedstrijden</b>.</div>`;
  }
  /* Zonder expliciete selectie geldt: iedereen speelt mee (zelfde aanname als
     normaliseerWedstrijd in wedstrijd.js). */
  const sel = new Set(standaardSelectie(w));
  const redenen = w.afwezigRedenen || {};
  const laat = new Set(w.telaat || []);          // erbij, maar komt later
  const vanaf = w.telaatVanaf || {};             // wedstrijdminuut van aankomst
  const maxMin = Math.round((w.periodes || 4) * (w.kwartduur || 0)) || 90;
  const aanwezigN = S.spelers.filter(p => sel.has(p.id)).length;

  const kiezer = `
    <button class="pw-kiezer" id="pwKiezer">
      <span class="pw-ico">${ico('football-whistle', 20)}</span>
      <span class="pw-txt"><span class="pw-t">${wedstrijdTitel(w)}</span>
        <span class="pw-m">${elftalPillWedstrijd(w)}${soortPill(w)}${datumNL(w.datum)}${w.aftrap ? ' · '+esc(w.aftrap) : ''} · ${w.thuis ? 'thuis' : 'uit'}${isAfgelast(w) ? ' · <b class="ws-tekst-af">afgelast</b>' : ''}</span></span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="pw-pijl"><path d="M8 9l4 4 4-4"/></svg>
    </button>`;

  /* Team met 1e + 2e elftal: eerst het elftal van deze wedstrijd, dan de
     rest van de selectie ("niet mee" zonder redenkeuze). */
  const tweeElftallen = heeftElftallen() && w.type !== 'toernooi';
  const groepen = tweeElftallen ? spelersVoorElftal(S.spelers, elftalWedstrijd(w)) : { eigen: S.spelers, rest: [] };
  const rij = (p, rest) => {
    const aanwezig = sel.has(p.id);
    const isLaat = aanwezig && laat.has(p.id);
    const info = redenen[p.id] ? afwezigRedenInfo(redenen[p.id]) : null;
    const klasse = !aanwezig ? 'afwezig' : (isLaat ? 'telaat' : 'aanwezig');
    const nietMee = !aanwezig && rest && !info;
    return `
    <div class="pres-speler ${klasse}${nietMee ? ' nietmee' : ''}">
      <button type="button" class="pres-speler-kop" data-pw-toggle="${p.id}">
        <span class="pres-shirt">${esc(p.nummer ?? '·')}</span>
        <span class="pres-naam">${esc(p.naam)}</span>
        <span class="pres-status">${!aanwezig ? (nietMee ? 'Niet mee' : 'Afwezig') : (isLaat ? 'Komt later' : 'Erbij')}</span>
      </button>
      ${!aanwezig && !nietMee ? `
      <div class="pres-reden-rij">${AFWEZIG_REDENEN.map(r =>
        `<button type="button" class="pres-reden-chip ${info?.id===r.id?'actief':''}" data-pw-reden="${r.id}" data-pid="${p.id}">${r.ico?ico(r.ico,16):r.emoji} ${r.label}</button>`).join('')}<button type="button" class="pres-reden-chip telaat-chip" data-pw-laat="${p.id}">⏱ Komt later</button></div>
      ${info?.id==='anders' || (info && redenen[p.id]?.notitie) ? `<input class="invoer pres-reden-notitie" data-pw-notitie="${p.id}" placeholder="Toelichting (optioneel)" value="${esc(redenen[p.id]?.notitie||'')}">` : ''}
      ` : isLaat ? `
      <div class="pres-telaat-rij"><button type="button" class="pres-reden-chip telaat-chip actief" data-pw-laat="${p.id}">⏱ Komt later — tik om te wissen</button>
        <label class="telaat-minuut">erbij vanaf min.<input type="number" inputmode="numeric" min="1" max="${maxMin}" class="invoer" data-pw-vanaf="${p.id}" value="${esc(vanaf[p.id] ?? '')}" placeholder="—"></label></div>
      ` : ''}
    </div>`;
  };
  const rijen = (tweeElftallen ? `<div class="elf-groep">${elftalNaam(elftalWedstrijd(w))}</div>` : '')
    + groepen.eigen.map(p => rij(p, false)).join('')
    + (groepen.rest.length ? `<div class="elf-groep">Rest van de selectie</div>` + groepen.rest.map(p => rij(p, true)).join('') : '');

  return `
    ${kiezer}
    ${htmlWedstrijdInfo(w)}
    <div class="pw-tel">${aanwezigN} van ${S.spelers.length} spelen mee${laat.size ? ` (${[...laat].filter(id => sel.has(id)).length} later)` : ''} · wijzigingen worden direct bewaard</div>
    <div class="pw-tel" style="margin-top:-4px">Komt iemand later? Tik hem op afwezig, kies <b>⏱ Komt later</b> en vul eventueel de wedstrijdminuut in. De tijd daarvóór telt niet mee in zijn speeltijd-%.</div>
    ${S.spelers.length ? rijen : `<div class="kaart leeg">Nog geen spelers in dit team.</div>`}
    <button class="knop vol" id="pwKlaar" style="margin-top:16px">Klaar</button>`;
}

/* [20261012a] Wedstrijdinfo: verzamelen/vertrek/aftrap, sportpark, veld, kleedkamer, route, delen.
   Sportlink vult `info`; de coach kan verzamel- en vertrektijd zelf zetten (`infoEigen`, gaat voor).
   Geen spelernamen in het deelbericht. Handlers: teams.js (tab preswedstrijd). */
export function htmlWedstrijdInfo(w, { bewerk = true } = {}){
  if (!w) return '';
  if (isAfgelast(w)) return `<div class="ws-info ws-info-af"><b>Deze wedstrijd is afgelast door de KNVB.</b>
    <span>Presentie en opstelling blijven bewaard, maar tellen niet mee.</span></div>`;
  const i = wedstrijdInfo(w);
  const komt = (w.datum || '') >= vandaagIso();
  if (!komt && !i.accommodatie) return '';
  const tijd = (label, t, sleutel) => `<div class="ws-tijd${t.t ? '' : ' leeg'}"><small>${label}</small><b>${esc(t.t || '–:–')}</b>
      <span>${t.bron === 'eigen' ? (sleutel === 'aftrap' ? '' : 'door jou') : t.bron === 'sportlink' ? 'Sportlink' : 'niet bekend'}</span></div>`;
  const rij = (l, waarde) => waarde ? `<div class="ws-rij"><span>${l}</span><div>${waarde}</div></div>` : '';
  const eigen = w.infoEigen || {};
  // [20261012h] bij een eigen wedstrijd zijn ook aftrap en plek aan te passen; bij Sportlink alleen de tijden
  const eigenW = w.bron !== 'sportlink';
  const toernooi = w.type === 'toernooi';
  return `<div class="ws-info">
    <div class="ws-info-kop">Wedstrijdinfo</div>
    ${komt ? `<div class="ws-tijden">${tijd('Verzamelen', i.verzamel, 'verzamel')}${tijd('Vertrek', i.vertrek, 'vertrek')}${tijd('Aftrap', i.aftrap, 'aftrap')}</div>`
      : rij('Aftrap', esc(i.aftrap.t))}
    ${komt && bewerk ? `<details class="ws-tijd-edit"${S._wsTijdOpen === w.id ? ' open' : ''}><summary>${eigenW ? 'Tijden en plek aanpassen' : 'Tijden zelf invullen'}</summary>
      <div class="ws-tijd-invoer">
        <label>Verzamelen<input type="time" class="invoer" id="wsVerzamel" value="${esc(eigen.verzamel || '')}"></label>
        ${w.thuis && !toernooi ? '' : `<label>Vertrek<input type="time" class="invoer" id="wsVertrek" value="${esc(eigen.vertrek || '')}"></label>`}
        ${eigenW ? `<label>Aftrap<input type="time" class="invoer" id="wsAftrap" value="${esc(w.aftrap || '')}"></label>` : ''}</div>
      ${eigenW ? `<label class="ws-plek-invoer">Plek<input class="invoer" id="wsPlek" maxlength="80" value="${esc(eigen.accommodatie || '')}" placeholder="Bijv. Sportpark De Hoef, Rixtel"></label>` : ''}
      <button class="knop klein" id="wsTijdBewaar" data-wid="${esc(w.id)}" style="margin-top:8px">Bewaar</button>
      ${eigenW ? '' : '<p class="ws-hint">Leeg laten = de tijd uit Sportlink (als die er is).</p>'}</details>` : ''}
    ${rij('Sportpark', esc(i.accommodatie))}
    ${!w.thuis ? rij('Adres', [i.adres, i.plaatsAdres || i.plaats].filter(Boolean).map(esc).join('<br>')) : ''}
    ${rij('Veld', esc(i.veld))}
    ${rij('Kleedkamer', esc(i.kleedkamer))}
    ${komt ? `<div class="ws-knoppen">${!w.thuis && i.route ? `<a class="knop licht klein" href="${esc(i.route)}" target="_blank" rel="noopener">Route</a>` : ''}
      ${bewerk ? `<button class="knop klein ws-wa" id="wsDeel" data-wid="${esc(w.id)}">Deel met ouders</button>` : ''}</div>`
      : `<p class="ws-hint">Deze wedstrijd is gespeeld. Tijden invullen en delen met ouders kan bij komende wedstrijden.</p>`}
  </div>`;
}

/* [20261012h] Handlers van het wedstrijdinfo-blok: tijden/plek bewaren en delen met ouders.
   Gebruikt door teams.js (Aanwezigheid, mobiel) én desktop-schermen.js (wedstrijdkaart). */
export function koppelWedstrijdInfo(v){
  const det = v.querySelector('.ws-tijd-edit');
  if (det) det.ontoggle = () => { S._wsTijdOpen = det.open ? v.querySelector('#wsTijdBewaar')?.dataset.wid : null; };
  const bewaar = v.querySelector('#wsTijdBewaar');
  if (bewaar) bewaar.onclick = async () => {
    const w = S.wedstrijden.find(x => x.id === bewaar.dataset.wid); if (!w) return;
    const tijd = id => { const el = v.querySelector(id); if (!el) return undefined; const x = el.value.trim(); return /^\d{2}:\d{2}$/.test(x) ? x : deleteField(); };
    const upd = {};
    for (const [veld, id] of [['infoEigen.verzamel', '#wsVerzamel'], ['infoEigen.vertrek', '#wsVertrek']]){ const t = tijd(id); if (t !== undefined) upd[veld] = t; }
    const aftrap = v.querySelector('#wsAftrap');
    if (aftrap) upd.aftrap = /^\d{2}:\d{2}$/.test(aftrap.value) ? aftrap.value : null;
    const plek = v.querySelector('#wsPlek');
    if (plek){
      const nieuw = plek.value.trim().slice(0, 80), oud = (w.infoEigen || {}).accommodatie || '';
      if (nieuw !== oud){
        // andere plek: adres en route van de oude plek kloppen niet meer; route opnieuw via zoeken
        upd['infoEigen.accommodatie'] = nieuw || deleteField();
        upd['infoEigen.adres'] = deleteField(); upd['infoEigen.plaatsAdres'] = deleteField();
        upd['infoEigen.route'] = nieuw ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(nieuw) : deleteField();
      }
    }
    bewaar.disabled = true;
    try {
      await updateDoc(doc(db, 'teams', S.teamId, 'wedstrijden', w.id), upd);
      S._wsTijdOpen = null; meld('Bewaard');
    } catch (e){ bewaar.disabled = false; meld('Bewaren mislukt: ' + (e.code || e.message)); }
  };
  const deel = v.querySelector('#wsDeel');
  if (deel) deel.onclick = () => {
    const w = S.wedstrijden.find(x => x.id === deel.dataset.wid); if (!w) return;
    const tekst = deelTekst(w, S.team.naam);
    openModal(`<h2>Delen met ouders</h2>
      <p class="cb-uitleg" style="margin:0 0 10px">Alleen tijden en plek, geen spelernamen.</p>
      <div class="ws-deel-tekst" id="wsDeelTekst">${esc(tekst)}</div>
      <div class="rij" style="margin-top:12px"><button class="knop licht" id="wsKopieer">Kopiëren</button><button class="knop ws-wa" id="wsWhatsapp">WhatsApp</button></div>`);
    document.getElementById('wsKopieer').onclick = async () => { try { await navigator.clipboard.writeText(tekst); meld('Gekopieerd'); } catch { meld('Kopiëren lukte niet; selecteer de tekst zelf'); } };
    document.getElementById('wsWhatsapp').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(tekst), '_blank', 'noopener');
  };
}

/* Kiezerlijst voor de dropdown (komend eerst, dan afgelopen — beide op datum). */
export function presWedstrijdKeuzes(){
  const vandaag = vandaagIso();
  const komend = [], eerder = [];
  for (const w of S.wedstrijden){
    if ((w.datum || '') >= vandaag) komend.push(w); else eerder.push(w);
  }
  komend.sort((a,b) => (a.datum||'').localeCompare(b.datum||''));
  // eerder staat al nieuw → oud (S.wedstrijden-sortering)
  return { komend, eerder };
}

export function presWedstrijdKeuzeHtml(){
  const { komend, eerder } = presWedstrijdKeuzes();
  const huidig = presWedstrijdHuidig();
  const rij = (w) => `
    <button class="lijst-item ${huidig && w.id === huidig.id ? 'eerstvolgend' : ''}" data-pw-kies="${w.id}">
      <div class="li-tekst"><div class="titel">${wedstrijdTitel(w)}</div>
      <div class="meta">${elftalPillWedstrijd(w)}${soortPill(w)}${datumNL(w.datum)}${w.aftrap ? ' · '+esc(w.aftrap) : ''} · ${w.thuis ? 'thuis' : 'uit'}${isAfgelast(w) ? ' · afgelast' : ''}</div></div>
      <span class="pijl">›</span></button>`;
  return `
    <h2>Kies een wedstrijd</h2>
    ${komend.length ? `<div class="veldlabel" style="margin-bottom:8px">Komend</div>${komend.map(rij).join('')}` : ''}
    ${eerder.length ? `<div class="veldlabel" style="margin:14px 0 8px">Gespeeld</div>${eerder.slice(0, 10).map(rij).join('')}` : ''}
    ${!komend.length && !eerder.length ? `<div class="kaart leeg">Geen wedstrijden.</div>` : ''}`;
}

/* ---------- Opslaan (selectie + redenen rechtstreeks op het wedstrijddoc) ----------
   Zelfde opschoning als modalSelectie in wedstrijd.js: valt een speler uit de
   selectie, dan verdwijnt hij ook uit opstellingen, geplande wissels en
   kaarten — maar alléén als de wedstrijd al kwarten heeft (geïmporteerde
   wedstrijden zonder opzet laten we met rust). */
export async function presWedstrijdBewaar(wijzig){
  const w = presWedstrijdHuidig();
  if (!w) return;
  const sel = new Set(standaardSelectie(w));
  const redenen = JSON.parse(JSON.stringify(w.afwezigRedenen || {}));
  const laat = new Set(w.telaat || []);
  const vanaf = {...(w.telaatVanaf || {})};
  wijzig(sel, redenen, laat, vanaf);

  const update = { selectie: [...sel] };
  const schoon = {};
  for (const [pid, r] of Object.entries(redenen)) if (!sel.has(pid)) schoon[pid] = r;
  update.afwezigRedenen = schoon;
  // "Komt later" alleen voor wie erbij is; minuut alleen voor wie later komt
  update.telaat = [...laat].filter(pid => sel.has(pid));
  const schoonVanaf = {};
  for (const pid of update.telaat) if (vanaf[pid] > 0) schoonVanaf[pid] = vanaf[pid];
  update.telaatVanaf = schoonVanaf;

  if (w.kwarten){
    const toegestaan = new Set(update.selectie);
    const kwarten = JSON.parse(JSON.stringify(w.kwarten));
    for (const kk of Object.values(kwarten)){
      for (const [slot, pid] of Object.entries(kk.lineup || {})) if (!toegestaan.has(pid)) delete kk.lineup[slot];
      kk.events = (kk.events || []).filter(e => (!e.in || toegestaan.has(e.in)) && (!e.uit || toegestaan.has(e.uit)));
      kk.plan = (kk.plan || []).filter(p => (p.in === WISSEL_BEURT || toegestaan.has(p.in)) && toegestaan.has(p.uit));
    }
    update.kwarten = kwarten;
    if (Array.isArray(w.kaarten)) update.kaarten = w.kaarten.filter(c => toegestaan.has(c.pid));
    if (w.aanvoerder && !toegestaan.has(w.aanvoerder)) update.aanvoerder = null;
  }

  try {
    await updateDoc(doc(db,'teams',S.teamId,'wedstrijden',w.id), update);
    telGebruik('selectie_kiezen');
  } catch(e){
    console.error('[Cluppie] presentie wedstrijd opslaan mislukt:', e);
    meld('Opslaan mislukt — controleer je verbinding');
  }
}

/* ==================== EVALUATIE (nog te evalueren) ==================== */
export function htmlEvaluatieLijst(){
  const open = evaluatieOpen();
  if (!open.length){
    return `<div class="kaart leeg">Alles is geëvalueerd. 🎉<br>Na de eerstvolgende gespeelde wedstrijd verschijnt hij hier.</div>`;
  }
  return `
    <p style="font-size:calc(13px * var(--fs));color:var(--ink-2);margin-bottom:12px;line-height:1.5">Deze wedstrijden zijn gespeeld maar nog niet geëvalueerd. Tik op een wedstrijd om de teamevaluatie in te vullen.</p>
    ${open.map(w => `
      <button class="lijst-item" data-eval-w="${w.id}">
        <div class="li-tekst"><div class="titel">${wedstrijdTitel(w)}</div>
        <div class="meta">${datumNL(w.datum)}${w.aftrap ? ' · '+esc(w.aftrap) : ''}</div></div>
        <span class="badge" style="background:var(--accent);color:#fff">Evalueren</span>
        <span class="pijl">›</span></button>`).join('')}`;
}

/* ==================== LEERLIJN-OVERZICHT ==================== */
export function htmlLeerlijnOverzicht(){
  const metPunten = S.spelers
    .map(p => ({ p, lps: (p.leerpunten || []) }))
    .filter(x => x.lps.length);
  if (!metPunten.length){
    return `<div class="kaart leeg">Nog geen leerpunten.<br>Voeg leerpunten toe via het spelersprofiel (tegel <b>Overzicht</b> → speler → tab <b>Leerlijn</b>).</div>`;
  }
  const blok = ({p, lps}) => {
    const open = lps.filter(l => !l.klaar).length;
    const gesorteerd = [...lps].sort((a,b) => (a.klaar?1:0)-(b.klaar?1:0) || (b.sinds||'').localeCompare(a.sinds||''));
    return `
      <button class="lpl-blok" data-lp-profiel="${p.id}">
        <div class="lpl-kop">
          <span class="pres-shirt">${esc(p.nummer ?? '·')}</span>
          <span class="lpl-naam">${esc(p.naam)}</span>
          <span class="lpl-tel">${open ? `${open} open` : 'alles behaald ✓'}</span>
        </div>
        <div class="lpl-wrap">${gesorteerd.map(l =>
          `<span class="lpl-chip ${l.klaar ? 'klaar' : ''}">${l.domein ? `<span class="lpl-dom">${esc(l.domein)}</span>` : ''}${esc(l.tekst || '')}</span>`).join('')}</div>
      </button>`;
  };
  const totOpen = metPunten.reduce((n,x) => n + x.lps.filter(l=>!l.klaar).length, 0);
  return `
    <p style="font-size:calc(13px * var(--fs));color:var(--ink-2);margin-bottom:12px;line-height:1.5">${totOpen} open leerpunt${totOpen===1?'':'en'} in het team. Tik op een speler om leerpunten te bewerken of af te vinken.</p>
    ${metPunten.map(blok).join('')}`;
}

/* ==================== HISTORIE (spelerkeuze) ==================== */
export function htmlHistorieLijst(){
  if (!S.spelers.length){
    return `<div class="kaart leeg">Nog geen spelers in dit team.</div>`;
  }
  return `
    <p style="font-size:calc(13px * var(--fs));color:var(--ink-2);margin-bottom:12px;line-height:1.5">Kies een speler om de historie te bekijken: beoordelingen en ontwikkeling over de tijd.</p>
    ${S.spelers.map(p => `
      <button class="lijst-item" data-hist-profiel="${p.id}">
        <span class="pres-shirt" style="margin-right:2px">${esc(p.nummer ?? '·')}</span>
        <div class="li-tekst"><div class="titel">${esc(p.naam)}</div></div>
        <span class="pijl">›</span></button>`).join('')}`;
}
