/* ==================== TEAMS UIT SPORTLINK (20261011d) ====================
   De clubbeheerder maakt in één keer alle teams aan uit de Sportlink-teamlijst
   (clubs/{id}/geheim/_sportlink, bijgehouden door sportlinkSyncNu). Elk team krijgt
   meteen zijn exacte Sportlink-naam en teamcode, dus de koppeling klopt vanaf dag één.

   - teamVoorstel(): PURE vertaling van een Sportlink-teamnaam naar naam/categorie/geslacht
     (getest in tests/sportlink-import.test.mjs).
   - modalTeamsUitSportlink(): keuzelijst met vinkjes, aanmaken in één batch.
   De clubbeheerder wordt NIET automatisch lid van de teams (rules: clubadmin mag een
   team zonder zichzelf aanmaken); coaches komen binnen via de teamlink. */

import { db, doc, getDoc, collection, writeBatch, serverTimestamp, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld, openModal, sluitModal, teamCode } from './state.js?v=20261011g';
import { CATEGORIEEN, CATEGORIEEN_MEIDEN, catInfo, bouwVanCategorie, catLabel } from './config.js?v=20261011g';
import { clubAfk } from './clubconfig.js?v=20261020b';
import { eigenClubPatronen, teamSleutel } from './sportlink-sleutel.js?v=20261011d';

const BOUW_NAAM = { onder: 'Onderbouw', midden: 'Middenbouw', boven: 'Bovenbouw' };

/* [20261011f] Het clubvoorvoegsel ("ASV'33 ") halen we uit de teamlijst zelf: het gemeenschappelijke
   begin van alle Sportlink-namen (zelfde aanpak als clubVoorvoegsel() in functions/index.js). Zo werkt
   het ook als de clubnaam in Cluppie anders is gespeld dan in Sportlink. */
export function voorvoegselUit(namen){
  const n = (namen || []).filter(Boolean);
  if (n.length < 2) return '';
  let p = n[0];
  for (const x of n) while (p && !x.startsWith(p)) p = p.slice(0, -1);
  const sp = p.lastIndexOf(' ');
  return sp >= 0 ? p.slice(0, sp + 1) : '';
}

/* "ASV'33 O11-1JM" → { naam:'O11-1', categorie:'JO11', geslacht:'j', standaardAan:true }
   Jongensteams heten tegenwoordig O11 (zonder J); meidenteams houden de M (MO15).
   De categorie blijft intern JO11/MO15 (regels, speeltijden, bouw). Futsal en onbekende vormen
   staan standaard uit. */
export function teamVoorstel(teamnaam, clubNaam = '', afkorting = '', voorvoegsel = ''){
  let s = String(teamnaam || '');
  if (voorvoegsel && s.toLowerCase().startsWith(voorvoegsel.toLowerCase())) s = s.slice(voorvoegsel.length);
  s = s.toLowerCase();
  for (const re of eigenClubPatronen(clubNaam, afkorting)) s = s.replace(re, '$1 ');
  s = s.replace(/\s+/g, ' ').trim();
  const futsal = /futsal|zaal/.test(s);
  const extra = futsal ? ' Futsal' : '';
  let m = s.match(/^(m)?j?o\s*(\d{1,2})\s*[-\s]\s*(\d+)/);
  if (m){
    const meiden = !!m[1];
    const lijst = meiden ? CATEGORIEEN_MEIDEN : CATEGORIEEN;
    const cat = (meiden ? 'MO' : 'JO') + Number(m[2]);
    const bekend = !!lijst[cat];
    return { naam: `${catLabel(cat)}-${m[3]}${extra}`, categorie: bekend ? cat : null, geslacht: meiden ? 'm' : 'j', standaardAan: bekend && !futsal };
  }
  if ((m = s.match(/^(?:vr|vrouwen)\s*(\d+)$/))) return { naam: `Vrouwen ${m[1]}`, categorie: 'Vrouwen', geslacht: 'm', standaardAan: !futsal };
  if ((m = s.match(/^vr\s*(\d{2})\s*\+\s*(\d+)$/))) return { naam: `Vrouwen ${m[1]}+${m[2]}`, categorie: 'Vrouwen', geslacht: 'm', standaardAan: true };
  if ((m = s.match(/^(\d{2})\s*\+\s*(\d+)$/))) return { naam: `${m[1]}+${m[2]}`, categorie: 'Senioren', geslacht: 'j', standaardAan: true };
  if ((m = s.match(/^(\d{1,2})(?:\s*\(?\s*(zon|zat)[a-z]*\s*\)?)?$/))){
    const nr = m[1], dag = m[2] ? ` (${m[2] === 'zat' ? 'zaterdag' : 'zondag'})` : '';
    return { naam: (nr === '1' ? 'Eerste elftal' : `Senioren ${nr}`) + dag, categorie: 'Senioren', geslacht: 'j', standaardAan: !futsal };
  }
  const netjes = (voorvoegsel && String(teamnaam).startsWith(voorvoegsel) ? String(teamnaam).slice(voorvoegsel.length) : String(teamnaam || '')).trim();
  return { naam: netjes, categorie: null, geslacht: 'j', standaardAan: false };
}

async function leesTeamlijst(){
  const snap = await getDoc(doc(db, 'clubs', S.clubId, 'geheim', '_sportlink'));
  const teams = snap.exists() ? (snap.data().teams || []) : [];
  /* één regel per teamnaam; de variant met poule wint (veld vóór futsal-dubbel) */
  const perNaam = new Map();
  for (const t of teams){ const b = perNaam.get(t.teamnaam); if (!b || (!b.klassepoule && t.klassepoule)) perNaam.set(t.teamnaam, t); }
  return [...perNaam.values()];
}

const catOpties = (gekozen) => [...Object.keys(CATEGORIEEN), ...Object.keys(CATEGORIEEN_MEIDEN)]
  .map(c => `<option value="${c}" ${c === gekozen ? 'selected' : ''}>${catLabel(c)}</option>`).join('');

export async function modalTeamsUitSportlink(bestaandeTeams = [], naKlaar){
  if (!S.club?.sportlinkClientId){
    openModal(`<h2>Teams uit Sportlink</h2>
      <p class="cb-uitleg">Koppel eerst Sportlink (Instellingen → Sportlink → Client ID). Daarna haalt Cluppie de teamlijst van jullie club op.</p>`);
    return;
  }
  openModal('<h2>Teams uit Sportlink</h2><div class="kaart leeg">Teamlijst laden…</div>');
  let lijst = [];
  try { lijst = await leesTeamlijst(); } catch (e){ console.warn('[sportlink-import] lezen mislukt', e); }
  if (!lijst.length){
    openModal(`<h2>Teams uit Sportlink</h2>
      <p class="cb-uitleg">De teamlijst is nog niet opgehaald.</p>
      <button class="knop vol" id="slImpOphalen">Teamlijst ophalen</button>`);
    document.getElementById('slImpOphalen').onclick = async e => {
      const k = e.currentTarget; k.disabled = true; k.textContent = 'Ophalen…';
      try { await httpsCallable(functions, 'sportlinkSyncNu')({ clubId: S.clubId, alleenTeamlijst: true }); modalTeamsUitSportlink(bestaandeTeams, naKlaar); }
      catch (x){ k.disabled = false; k.textContent = 'Teamlijst ophalen'; meld('Ophalen mislukt: ' + (x.message || x.code)); }
    };
    return;
  }

  const clubNaam = S.club.naam || '', afk = clubAfk(S.club);
  const bestaandSleutel = new Set(bestaandeTeams.map(t => teamSleutel(t.sportlinkNaam || t.naam, clubNaam, afk)));
  const voorvoegsel = voorvoegselUit(lijst.map(t => t.teamnaam));
  const rijen = lijst.map((t, i) => {
    const v = teamVoorstel(t.teamnaam, clubNaam, afk, voorvoegsel);
    const bestaat = bestaandSleutel.has(teamSleutel(t.teamnaam, clubNaam, afk));
    return { i, sl: t, ...v, bestaat, aan: v.standaardAan && !bestaat };
  }).sort((a, b) => (a.bestaat - b.bestaat) || a.naam.localeCompare(b.naam, 'nl', { numeric: true }));

  const teken = () => {
    const n = rijen.filter(r => r.aan && !r.bestaat).length;
    openModal(`<h2>Teams uit Sportlink</h2>
      <p class="cb-uitleg" style="margin:0 0 10px">Vink aan welke teams je wilt aanmaken. Ze worden meteen aan Sportlink gekoppeld en in de juiste bouw gezet. Naam en categorie kun je hier nog aanpassen.</p>
      <div class="rij" style="margin-bottom:8px"><button class="knop licht klein" id="slImpAlles">Alles aan</button><button class="knop licht klein" id="slImpNiets">Alles uit</button></div>
      <div class="sli-lijst">${rijen.map(r => `
        <label class="sli-rij ${r.bestaat ? 'bestaat' : ''}">
          <input type="checkbox" data-sli="${r.i}" ${r.aan ? 'checked' : ''} ${r.bestaat ? 'disabled' : ''}>
          <span class="sli-sl">${esc(r.sl.teamnaam)}${r.sl.klassepoule ? `<small>${esc(r.sl.klassepoule)}</small>` : ''}</span>
          ${r.bestaat ? '<span class="sli-bestaat">bestaat al</span>' : `
          <input class="invoer sli-naam" data-sli-naam="${r.i}" value="${esc(r.naam)}" maxlength="40" autocomplete="off">
          <select class="invoer sli-cat" data-sli-cat="${r.i}"><option value="">categorie…</option>${catOpties(r.categorie)}</select>
          <span class="sli-bouw">${r.categorie ? esc(BOUW_NAAM[bouwVanCategorie(r.categorie)] || '') : ''}</span>`}
        </label>`).join('')}</div>
      <button class="knop vol" id="slImpOk" style="margin-top:12px" ${n ? '' : 'disabled'}>${n ? `Maak ${n} team${n === 1 ? '' : 's'} aan` : 'Niets gekozen'}</button>`);
    const m = document.getElementById('modalInhoud');
    m.querySelectorAll('[data-sli]').forEach(c => c.onchange = () => { rijen.find(r => r.i == c.dataset.sli).aan = c.checked; teken(); });
    m.querySelectorAll('[data-sli-naam]').forEach(c => c.oninput = () => { rijen.find(r => r.i == c.dataset.sliNaam).naam = c.value; });
    m.querySelectorAll('[data-sli-cat]').forEach(c => c.onchange = () => {
      const r = rijen.find(x => x.i == c.dataset.sliCat); r.categorie = c.value || null;
      r.geslacht = /^MO|Vrouwen/.test(r.categorie || '') ? 'm' : 'j'; if (r.categorie) r.aan = true; teken();
    });
    document.getElementById('slImpAlles').onclick = () => { rijen.forEach(r => { if (!r.bestaat) r.aan = true; }); teken(); };
    document.getElementById('slImpNiets').onclick = () => { rijen.forEach(r => { r.aan = false; }); teken(); };
    document.getElementById('slImpOk').onclick = () => maakTeams(rijen.filter(r => r.aan && !r.bestaat), bestaandeTeams, naKlaar);
  };
  teken();
}

async function maakTeams(gekozen, bestaandeTeams, naKlaar){
  const zonderCat = gekozen.filter(r => !r.categorie || !r.naam.trim());
  if (zonderCat.length) return meld(`Kies een naam en categorie voor ${zonderCat.map(r => r.sl.teamnaam).slice(0, 3).join(', ')}`);
  const knop = document.getElementById('slImpOk'); if (knop){ knop.disabled = true; knop.textContent = 'Bezig…'; }
  const afk = clubAfk(S.club);
  const codes = [...bestaandeTeams.map(t => t.code), ...(S.teams || []).map(t => t.code)].filter(Boolean);
  try {
    /* Firestore-batch: max 500 schrijfacties; per team 1 + 1 clubupdate is ruim genoeg */
    const batch = writeBatch(db), clubTeams = {};
    for (const r of gekozen){
      const ref = doc(collection(db, 'teams'));
      const code = teamCode(r.naam.trim(), afk, codes); codes.push(code);
      batch.set(ref, {
        naam: r.naam.trim(), categorie: r.categorie, geslacht: r.geslacht, format: catInfo(r.categorie).format,
        bouw: bouwVanCategorie(r.categorie), code, club: S.clubId, clubNaam: S.club.naam || '',
        leden: {}, ledenInfo: {}, sportlinkNaam: r.sl.teamnaam, ...(r.sl.teamcode ? { sportlinkTeamcode: String(r.sl.teamcode) } : {}),
        bron: 'sportlink-import', gemaakt: serverTimestamp(),
      });
      clubTeams['teams.' + ref.id] = true;
    }
    batch.update(doc(db, 'clubs', S.clubId), clubTeams);
    await batch.commit();
    sluitModal();
    meld(`${gekozen.length} team${gekozen.length === 1 ? '' : 's'} aangemaakt ✓ Deel nu per team de teamlink met de coach.`);
    if (naKlaar) naKlaar();
  } catch (e){
    console.error('[sportlink-import]', e);
    if (knop){ knop.disabled = false; knop.textContent = 'Opnieuw proberen'; }
    meld('Aanmaken mislukt: ' + (e.code || e.message));
  }
}
