/* ==================== TOERNOOIPLANNER: CONTROLE EN PROEFDRAAIEN [20261127s] ====================
   Puur rekenwerk (geen Firebase, geen DOM), getest in tests/toernooi-controle.test.mjs.

   controleer(t)  zoekt fouten in de opzet, de indeling, het schema, de finales en de kleedkamers:
                  dubbel geboekte velden, teams die tegelijk of zonder rust spelen, een schema dat over de
                  eindtijd loopt of niet meer bij de poules past, ongelijke poules, finales die beginnen voordat
                  de poule klaar is, te volle kleedkamers, enz.
   proefdraaien(t) speelt het toernooi vele keren na met willekeurige uitslagen, schuift door naar de finales
                  en de prijsuitreiking, en meldt wat dan misgaat (bv. een halve finale waarvan de teams nog niet
                  bekend zijn, of een poulewinnaar die meteen weer moet spelen). Er wordt niets opgeslagen.
   aiSamenvatting(t, problemen) is wat de AI-controle (functions: toernooiControleAI) te zien krijgt: teamnamen,
                  poules en tijden, zonder spelers.

   Een probleem: { id, niveau: 'fout'|'waarsch'|'tip', groep, tekst, tab, wed: [wedId], teams: [teamId] }
   fout = moet opgelost, waarsch = waarschijnlijk niet de bedoeling, tip = kan beter. */
import * as T from './toernooi-logica.js?v=20261130e';

export const NIVEAUS = { fout: 'Fout', waarsch: 'Let op', tip: 'Tip' };
const ORDE = { fout: 0, waarsch: 1, tip: 2 };
const MAX_WACHT = 75;        /* minuten tussen twee wedstrijden waarboven we het melden */
const lijstje = (xs, n = 4) => xs.length <= n ? xs.join(', ') : `${xs.slice(0, n).join(', ')} en ${xs.length - n} meer`;
const paar = (a, b) => [a, b].sort().join('|');
const H = s => s ? s[0].toUpperCase() + s.slice(1) : s;
/* "de halve finale 1", "de wedstrijd om plaats 3" */
export const koNaam = (t, w) => { const k = T.koTitel(t, w).split(' · ')[0].toLowerCase(); return /^om plaats/.test(k) ? `de wedstrijd ${k}` : `de ${k}`; };

/* ---------- vaste regels ---------- */
export function controleer(t = {}, { blokken = null, datum = '', clubVelden = null, programma = null } = {}){
  const uit = [], o = T.opzet(t), vj = T.veldjes(t), vjOp = Object.fromEntries(vj.map(v => [v.id, v]));
  const teams = t.teams || {}, poules = T.gesorteerd(t.poules), schema = t.schema || [];
  const tn = id => teams[id]?.naam || 'een verwijderd team', pn = id => t.poules?.[id]?.naam || 'een verwijderde poule';
  const zet = (id, niveau, groep, tekst, tab, extra = {}) => uit.push({ id, niveau, groep, tekst, tab, wed: [], teams: [], ...extra });
  const teamIds = Object.keys(teams).filter(id => teams[id] && typeof teams[id] === 'object');
  const begin = T.naarMin(o.start), grens = T.naarMin(o.eind);

  /* opzet */
  if (!vj.length) zet('geen-velden', 'fout', 'Velden', 'Er zijn nog geen velden gekozen. Zonder velden kan Cluppie niets plannen.', 'opzet');
  if (grens != null && grens <= begin) zet('eind-voor-start', 'fout', 'Tijden', `Het toernooi moet om ${o.eind} klaar zijn, maar de eerste wedstrijd is pas om ${o.start}.`, 'opzet');
  if (teamIds.length < 2){
    zet('weinig-teams', teamIds.length ? 'fout' : 'tip', 'Teams', teamIds.length ? 'Er is maar één team. Voeg minstens nog één team toe.' : 'Nog geen teams. Voeg ze toe bij Teams, of laat ze inschrijven.', 'teams');
    return sorteer(uit);
  }

  /* teams en poules */
  const namen = new Map();
  for (const id of teamIds){ const k = String(teams[id].naam || '').trim().toLowerCase(); if (k) namen.set(k, [...(namen.get(k) || []), id]); }
  for (const ids of namen.values()) if (ids.length > 1) zet(`dubbele-naam|${ids[0]}`, 'waarsch', 'Teams', `${ids.length} teams heten "${tn(ids[0])}". Op het schema en de live pagina zijn ze dan niet uit elkaar te houden.`, 'teams', { teams: ids });
  const perPoule = Object.fromEntries(poules.map(p => [p.id, teamIds.filter(id => teams[id].poule === p.id)]));
  const zonder = teamIds.filter(id => !t.poules?.[teams[id].poule]);
  if (!poules.length) zet('geen-poules', 'fout', 'Poules', 'Er zijn nog geen poules. Maak ze bij Opzet, of laat Cluppie alles indelen met Opzet › Voorstel maken.', 'opzet');
  else if (zonder.length) zet('zonder-poule', 'fout', 'Poules', `${zonder.length === 1 ? 'Eén team zit' : `${zonder.length} teams zitten`} in geen poule en ${zonder.length === 1 ? 'speelt' : 'spelen'} dus niet: ${lijstje(zonder.map(tn))}.`, 'teams', { teams: zonder });
  for (const p of poules){
    const n = perPoule[p.id].length;
    if (n === 1) zet(`poule-een|${p.id}`, 'fout', 'Poules', `${p.naam} heeft maar één team (${tn(perPoule[p.id][0])}). Dat team speelt dan niet.`, 'teams', { teams: perPoule[p.id] });
    else if (!n) zet(`poule-leeg|${p.id}`, 'waarsch', 'Poules', `${p.naam} is leeg. Haal hem weg of zet er teams in.`, 'opzet');
    const eigen = Array.isArray(p.velden) ? p.velden : [];
    if (n >= 2 && eigen.length && !eigen.some(v => vjOp[v])) zet(`poule-velden|${p.id}`, 'fout', 'Velden', `${p.naam} mag alleen op velden die niet meer bestaan. Kies bij Opzet opnieuw de velden van deze poule.`, 'opzet');
    const ps = T.naarMin(p.start);
    if (ps != null && grens != null && ps >= grens) zet(`poule-start-laat|${p.id}`, 'fout', 'Tijden', `${p.naam} begint om ${p.start}, maar het toernooi moet om ${o.eind} klaar zijn.`, 'opzet');
  }
  const gevuld = poules.filter(p => perPoule[p.id].length >= 2);
  if (gevuld.length > 1){
    const groot = Math.max(...gevuld.map(p => perPoule[p.id].length)), klein = Math.min(...gevuld.map(p => perPoule[p.id].length));
    if (groot - klein >= 2){
      const g = gevuld.find(p => perPoule[p.id].length === groot), k = gevuld.find(p => perPoule[p.id].length === klein);
      zet('ongelijke-poules', 'waarsch', 'Poules', `De poules zijn ongelijk: ${g.naam} heeft ${groot} teams, ${k.naam} maar ${klein}. Teams in ${k.naam} spelen ${groot - klein} wedstrijden minder.`, 'teams');
    }
  }
  /* teams van dezelfde club in één poule terwijl het verspreid had gekund */
  if (gevuld.length > 1) for (const p of gevuld){
    const perClub = new Map(); for (const id of perPoule[p.id]) if (teams[id].club) perClub.set(teams[id].club, [...(perClub.get(teams[id].club) || []), id]);
    for (const [c, ids] of perClub){
      const totaal = teamIds.filter(id => teams[id].club === c).length;
      if (ids.length > 1 && totaal <= gevuld.length) zet(`zelfde-club|${p.id}|${c}`, 'tip', 'Poules', `In ${p.naam} spelen ${ids.length} teams van ${t.clubs?.[c]?.naam || 'dezelfde club'} tegen elkaar (${lijstje(ids.map(tn))}). Ze kunnen ook over de poules verdeeld worden.`, 'teams', { teams: ids });
    }
  }
  const spelerFout = T.controleerTeams(t);
  if (spelerFout.length) zet('spelers-regels', 'waarsch', 'Spelers', `${spelerFout.length} ${spelerFout.length === 1 ? 'speler past' : 'spelers passen'} niet bij de regels van ${spelerFout.length === 1 ? 'het' : 'hun'} team (leeftijd, geslacht of eigen team).`, 'teams', { teams: [...new Set(spelerFout.map(f => f.team))] });
  if (Object.keys(t.spelers || {}).length){
    const leeg = teamIds.filter(id => !teams[id].gast && !Object.values(t.spelers).some(s => s?.tt === id));
    if (leeg.length) zet('teams-zonder-spelers', 'tip', 'Spelers', `${leeg.length === 1 ? 'Eén team heeft' : `${leeg.length} teams hebben`} nog geen spelers: ${lijstje(leeg.map(tn))}. Is het een gastteam, zet dan Gastteam aan.`, 'teams', { teams: leeg });
  }

  /* knock-out: opzet */
  const groepen = T.koGroepen(t), inKo = new Map();
  for (const g of groepen){
    for (const p of g.poules) inKo.set(p, [...(inKo.get(p) || []), g]);
    const ops = T.koOpzet(t, g), totaal = g.poules.reduce((n, p) => n + (perPoule[p]?.length || 0), 0);
    if (!g.poules.length) zet(`ko-geen-poules|${g.id}`, 'fout', 'Finales', `${g.naam || 'De knock-out'} hoort bij geen enkele poule. Kies bij Opzet › Na de poules welke poules meedoen.`, 'opzet');
    else if (!ops.length) zet(`ko-leeg|${g.id}`, 'fout', 'Finales', `${g.naam || 'De knock-out'} heeft te weinig teams: de gekozen poules hebben samen minder dan twee teams.`, 'opzet');
    else if (Number(g.ronde) > totaal) zet(`ko-kleiner|${g.id}`, 'tip', 'Finales', `${g.naam || 'De knock-out'} staat op ${T.KO_RONDES[g.ronde]?.toLowerCase() || g.ronde + ' teams'}, maar er doen maar ${totaal} teams mee. Cluppie maakt er een kleinere knock-out van.`, 'opzet');
    if (g.poules.length > 1) for (const w of ops.filter(w => w.ka?.p && w.kb?.p && w.ka.p === w.kb.p))
      zet(`ko-zelfde-poule|${g.id}|${w.id}`, 'tip', 'Finales', `In ${koNaam(t, { ...w, ko: g.id })} spelen ${T.bronTekst(t, w.ka)} en ${T.bronTekst(t, w.kb)} weer tegen elkaar, terwijl ze al in dezelfde poule zaten.`, 'opzet');
  }
  for (const [p, gs] of inKo) if (gs.length > 1) zet(`ko-dubbel|${p}`, 'fout', 'Finales', `${pn(p)} zit in ${gs.length} knock-outs (${lijstje(gs.map(g => g.naam || 'Finales'))}). De besten zouden dan twee finales tegelijk spelen.`, 'opzet');
  if (groepen.length){
    const los = gevuld.filter(p => !inKo.has(p.id));
    if (los.length) zet('poule-zonder-ko', 'tip', 'Finales', `${lijstje(los.map(p => p.naam))} ${los.length === 1 ? 'heeft' : 'hebben'} geen finales, de andere poules wel. Is dat de bedoeling?`, 'opzet');
  }

  /* veldplanner van de club */
  if (blokken && datum && schema.length){
    const eind = T.naarTijd(Math.max(...schema.map(w => T.naarMin(w.t))) + o.duur);
    const conf = T.veldConflicten(blokken, { datum, van: o.start, tot: eind, velden: Object.values(t.velden || {}).map(v => v?.clubVeld).filter(Boolean) });
    if (conf.length) zet('veldplanner', 'waarsch', 'Velden', `In de Veldplanner staan op deze dag ook ${conf.length === 1 ? 'een training of wedstrijd' : `${conf.length} trainingen of wedstrijden`} op de toernooivelden (${lijstje(conf.map(b => `${b.teamNaam || b.naam || b.team || 'training'} ${b.start}–${b.eind}${clubVelden ? ' ' + (clubVelden.find(v => v.id === String(b.veld))?.naam || '') : ''}`.trim()), 3)}).`, 'opzet');
  }

  if (!schema.length){
    if (gevuld.length) zet('geen-schema', 'tip', 'Schema', 'Er is nog geen speelschema. Maak het bij Schema, of met Opzet › Voorstel maken.', 'schema');
    return sorteer(uit);
  }

  /* ---------- schema ---------- */
  const ws = T.metKo(t), duur = o.duur, stap = o.duur + o.wissel;
  const van = w => T.naarMin(w.t), tot = w => T.naarMin(w.t) + duur;
  const wn = w => w.ko ? koNaam(t, w) : `${tn(w.a)}–${tn(w.b)}`;

  /* past het schema nog bij de poules? */
  const verwacht = new Map(), gepland = new Map();
  for (const p of gevuld) for (const ronde of T.rondes(perPoule[p.id], !!p.dubbel)) for (const [a, b] of ronde){ const k = `${p.id}|${paar(a, b)}`; verwacht.set(k, (verwacht.get(k) || 0) + 1); }
  const vreemd = [];
  for (const w of schema.filter(w => !w.ko)){
    const k = `${w.p}|${paar(w.a, w.b)}`;
    if (!teams[w.a] || !teams[w.b] || teams[w.a].poule !== w.p || teams[w.b].poule !== w.p) vreemd.push(w);
    else gepland.set(k, (gepland.get(k) || 0) + 1);
  }
  let mist = 0; for (const [k, n] of verwacht) mist += Math.max(0, n - (gepland.get(k) || 0));
  const dubbel = []; for (const [k, n] of gepland) if (n > (verwacht.get(k) || 0)) dubbel.push(k);
  if (mist || vreemd.length) zet('schema-oud', 'fout', 'Schema', `Het schema past niet meer bij de poules: ${[mist ? `${mist} ${mist === 1 ? 'wedstrijd ontbreekt' : 'wedstrijden ontbreken'}` : '', vreemd.length ? `${vreemd.length} ${vreemd.length === 1 ? 'wedstrijd is' : 'wedstrijden zijn'} van teams die niet meer in die poule zitten` : ''].filter(Boolean).join(' en ')}. Plan het schema opnieuw.`, 'schema', { wed: vreemd.map(w => w.id) });
  if (dubbel.length) zet('schema-dubbel-paar', 'fout', 'Schema', `${dubbel.length === 1 ? 'Eén wedstrijd staat' : `${dubbel.length} wedstrijden staan`} vaker in het schema dan nodig (${lijstje(dubbel.map(k => k.split('|').slice(1).map(tn).join('–')), 3)}).`, 'schema');
  const koOud = groepen.filter(g => { const moet = T.koOpzet(t, g).map(w => w.id).sort().join(','), is = schema.filter(w => w.ko === g.id).map(w => w.id).sort().join(','); return moet !== is; });
  if (koOud.length) zet('ko-oud', 'fout', 'Finales', `De finales in het schema kloppen niet meer met ${lijstje(koOud.map(g => g.naam || 'de knock-out'))}. Plan het schema opnieuw.`, 'schema');
  const weesKo = schema.filter(w => w.ko && !t.ko?.[w.ko]);
  if (weesKo.length) zet('ko-wees', 'waarsch', 'Finales', `${weesKo.length} finalewedstrijden horen bij een knock-out die niet meer bestaat. Plan het schema opnieuw.`, 'schema', { wed: weesKo.map(w => w.id) });

  /* velden: bestaat het veld nog, en speelt er maar één wedstrijd tegelijk? */
  const weg = schema.filter(w => !vjOp[w.v]);
  if (weg.length) zet('veld-weg', 'fout', 'Velden', `${weg.length === 1 ? 'Eén wedstrijd staat' : `${weg.length} wedstrijden staan`} op een veld dat niet meer bestaat. Plan het schema opnieuw of versleep ${weg.length === 1 ? 'hem' : 'ze'}.`, 'schema', { wed: weg.map(w => w.id) });
  const perVeld = new Map(); for (const w of ws) if (vjOp[w.v]) perVeld.set(w.v, [...(perVeld.get(w.v) || []), w]);
  let krapStap = false;
  for (const [v, lijst] of perVeld){
    lijst.sort((x, y) => van(x) - van(y));
    for (let i = 0; i < lijst.length; i++) for (let j = i + 1; j < lijst.length && van(lijst[j]) < tot(lijst[i]); j++){
      const a = lijst[i], b = lijst[j];
      if (van(a) !== van(b)) krapStap = true;
      zet(`veld-dubbel|${a.id}|${b.id}`, 'fout', 'Velden', van(a) === van(b) ? `${vjOp[v].naam} is om ${a.t} dubbel geboekt: ${wn(a)} en ${wn(b)}.` : `Op ${vjOp[v].naam} begint ${wn(b)} om ${b.t}, maar ${wn(a)} (${a.t}) is dan nog bezig.`, 'schema', { wed: [a.id, b.id] });
    }
  }

  /* teams: tegelijk spelen, geen rust, lange wachttijd */
  const perTeam = new Map();
  for (const w of ws) for (const id of [w.a, w.b]) if (id) perTeam.set(id, [...(perTeam.get(id) || []), w]);
  const zonderRust = [], wachters = [];
  for (const [id, lijst] of perTeam){
    lijst.sort((x, y) => van(x) - van(y));
    for (let i = 0; i < lijst.length; i++) for (let j = i + 1; j < lijst.length && van(lijst[j]) < tot(lijst[i]); j++)
      zet(`team-tegelijk|${id}|${lijst[i].id}|${lijst[j].id}`, 'fout', 'Schema', `${tn(id)} speelt om ${lijst[j].t} twee wedstrijden tegelijk (${wn(lijst[i])} en ${wn(lijst[j])}).`, 'schema', { wed: [lijst[i].id, lijst[j].id], teams: [id] });
    let achter = 0, wacht = 0;
    for (let i = 1; i < lijst.length; i++){ const g = van(lijst[i]) - van(lijst[i - 1]); if (g >= duur && g <= stap) achter++; wacht = Math.max(wacht, g - duur); }
    if (achter) zonderRust.push([id, achter]);
    if (wacht > MAX_WACHT) wachters.push([id, wacht]);
  }
  if (o.rust && zonderRust.length) zet('geen-rust', 'waarsch', 'Schema', `${zonderRust.length === 1 ? 'Eén team speelt' : `${zonderRust.length} teams spelen`} zonder rust twee keer achter elkaar: ${lijstje(zonderRust.map(([id, n]) => `${tn(id)}${n > 1 ? ` (${n}×)` : ''}`))}. Versleep een wedstrijd of voeg een veld toe.`, 'schema', { teams: zonderRust.map(([id]) => id) });
  if (wachters.length) zet('lang-wachten', 'tip', 'Schema', `Lang wachten tussen twee wedstrijden: ${lijstje(wachters.sort((a, b) => b[1] - a[1]).map(([id, m]) => `${tn(id)} ${m} min`))}.`, 'schema', { teams: wachters.map(([id]) => id) });
  if (krapStap) zet('speeltijd-veranderd', 'tip', 'Tijden', `De speeltijd (${duur} min) past niet meer in het schema. Is de speeltijd na het plannen langer gemaakt? Plan dan opnieuw.`, 'schema');

  /* tijden: te vroeg, te laat */
  const teVroeg = schema.filter(w => !w.ko && (van(w) < begin || (T.naarMin(t.poules?.[w.p]?.start) != null && van(w) < T.naarMin(t.poules[w.p].start))));
  if (teVroeg.length) zet('te-vroeg', 'waarsch', 'Tijden', `${teVroeg.length === 1 ? 'Eén wedstrijd begint' : `${teVroeg.length} wedstrijden beginnen`} vóór de begintijd van het toernooi of van de poule (bijvoorbeeld ${wn(teVroeg[0])} om ${teVroeg[0].t}).`, 'schema', { wed: teVroeg.map(w => w.id) });
  const laatste = Math.max(...schema.map(tot)), pr = T.prijsuitreiking(t), klaar = pr ? T.naarMin(pr.tot) : laatste;
  if (grens != null && klaar > grens) zet('te-laat', 'fout', 'Tijden', `Het toernooi is klaar om ${T.naarTijd(klaar)}${pr ? ' (met de prijsuitreiking)' : ''}, ${klaar - grens} minuten later dan ${o.eind}. Kort de speeltijd in, voeg een veld toe of gebruik Opzet › Voorstel maken.`, 'opzet');
  if (pr && programma && programma.tnprijs && programma.tnprijs.tijd && programma.tnprijs.tijd !== pr.van) zet('prijs-programma', 'tip', 'Tijden', `In het dagprogramma staat de prijsuitreiking om ${programma.tnprijs.tijd}, maar volgens het schema is die om ${pr.van}. Plan het schema opnieuw of pas het dagprogramma aan.`, 'schema');

  /* finales: niet beginnen voordat de bron klaar is */
  const op = Object.fromEntries(ws.map(w => [w.id, w]));
  for (const w of ws.filter(w => w.ko && t.ko?.[w.ko])) for (const bron of [w.ka, w.kb]){
    if (bron?.p){
      const pw = ws.filter(x => !x.ko && x.p === bron.p);
      const eind = pw.length ? Math.max(...pw.map(tot)) : null;
      if (eind != null && van(w) < eind) zet(`ko-te-vroeg|${w.id}|${bron.p}`, 'fout', 'Finales', `${H(wn(w))} begint om ${w.t}, maar ${pn(bron.p)} is pas om ${T.naarTijd(eind)} klaar. Dan weet nog niemand wie er speelt.`, 'schema', { wed: [w.id] });
      if (bron.r > (perPoule[bron.p]?.length || 0)) zet(`ko-geen-team|${w.id}|${bron.p}|${bron.r}`, 'fout', 'Finales', `${H(wn(w))} wacht op de ${bron.r}e van ${pn(bron.p)}, maar die poule heeft maar ${perPoule[bron.p]?.length || 0} teams.`, 'opzet', { wed: [w.id] });
    } else if (bron?.w){
      const x = op[bron.w];
      if (!x) zet(`ko-bron-weg|${w.id}`, 'fout', 'Finales', `${H(wn(w))} wacht op een wedstrijd die niet meer in het schema staat. Plan het schema opnieuw.`, 'schema', { wed: [w.id] });
      else if (van(w) < tot(x)) zet(`ko-voor-bron|${w.id}|${x.id}`, 'fout', 'Finales', `${H(wn(w))} begint om ${w.t}, maar ${wn(x)} (${x.t}) is dan nog niet afgelopen.`, 'schema', { wed: [w.id, x.id] });
    }
  }

  /* uitslagen die er al staan */
  for (const w of ws.filter(w => w.ko)){
    const u = t.uitslag?.[w.id];
    if (T.heeftUitslag(u) && Number(u.a) === Number(u.b) && !T.winnaar(u)) zet(`ko-gelijk|${w.id}`, 'waarsch', 'Uitslagen', `${H(wn(w))} eindigde gelijk (${u.a}–${u.b}). Kies wie er na strafschoppen wint, anders schuift niemand door.`, 'uitslagen', { wed: [w.id] });
  }
  const raar = schema.filter(w => { const u = t.uitslag?.[w.id]; return T.heeftUitslag(u) && (Number(u.a) < 0 || Number(u.b) < 0 || Number(u.a) > 30 || Number(u.b) > 30); });
  if (raar.length) zet('rare-uitslag', 'tip', 'Uitslagen', `${raar.length === 1 ? 'Eén uitslag ziet' : `${raar.length} uitslagen zien`} er vreemd uit (${lijstje(raar.map(w => `${wn(w)} ${t.uitslag[w.id].a}–${t.uitslag[w.id].b}`), 2)}). Klopt dat?`, 'uitslagen', { wed: raar.map(w => w.id) });

  /* ---------- kleedkamers ---------- */
  const delen = T.kkDelen(t);
  if (!delen.length && teamIds.length >= 4) zet('geen-kk', 'tip', 'Kleedkamers', 'Er zijn nog geen kleedkamers ingevuld. Voeg ze toe als teams zich moeten omkleden.', 'kk');
  if (delen.length){
    const plan = T.planKleedkamers(t), rooster = T.teamRooster({ ...t, schema: ws });
    if (plan.tekort.length) zet('kk-tekort', 'fout', 'Kleedkamers', `Te weinig kleedkamers: ${lijstje(plan.tekort.map(tn))} ${plan.tekort.length === 1 ? 'heeft' : 'hebben'} geen plek. Voeg een kleedkamer toe, geef er een plek bij of laat poules later beginnen.`, 'kk', { teams: plan.tekort });
    const kkVan = Object.fromEntries(teamIds.map(id => [id, T.kkVanTeam(t, id, plan)]));
    const raam = id => { const r = rooster[id]; return r && r.eerste ? [T.naarMin(r.eerste) - 30, T.naarMin(r.laatste) + 20] : null; };
    for (const d of delen){
      const hier = teamIds.filter(id => kkVan[id] === d.id && raam(id)), plek = Math.max(1, Number(d.plekken) || 2);
      let max = 0, moment = 0;
      for (const id of hier){ const [b] = raam(id), n = hier.filter(x => { const [p, q] = raam(x); return p <= b && b < q; }).length; if (n > max){ max = n; moment = b; } }
      if (max > plek) zet(`kk-vol|${d.id}`, 'fout', 'Kleedkamers', `${d.naam} is om ${T.naarTijd(moment)} te vol: ${max} teams, maar plek voor ${plek}.`, 'kk', { teams: hier });
      /* jongens en meisjes tegelijk in dezelfde kleedkamer */
      const g = hier.map(id => [id, teams[id].eisen?.geslacht || '']).filter(([, x]) => x);
      for (const [a, ga] of g) for (const [b, gb] of g) if (a < b && ga !== gb){
        const [p, q] = raam(a), [r, s] = raam(b);
        if (p < s && r < q){ zet(`kk-gemengd|${d.id}`, 'waarsch', 'Kleedkamers', `In ${d.naam} zitten jongens en meisjes tegelijk (${tn(a)} en ${tn(b)}).`, 'kk', { teams: [a, b] }); break; }
      }
    }
    const kwijt = teamIds.filter(id => teams[id].kk && !delen.some(d => d.id === teams[id].kk || d.kk === teams[id].kk));
    if (kwijt.length) zet('kk-weg', 'tip', 'Kleedkamers', `${lijstje(kwijt.map(tn))} ${kwijt.length === 1 ? 'had' : 'hadden'} een kleedkamer die niet meer bestaat en ${kwijt.length === 1 ? 'krijgt' : 'krijgen'} nu automatisch een andere.`, 'kk', { teams: kwijt });
  }
  return sorteer(ontdubbel(uit));
}
const ontdubbel = lijst => { const al = new Set(); return lijst.filter(p => !al.has(p.id) && al.add(p.id)); };
const sorteer = lijst => lijst.sort((a, b) => ORDE[a.niveau] - ORDE[b.niveau]);
export const telling = lijst => ({ fout: lijst.filter(p => p.niveau === 'fout').length, waarsch: lijst.filter(p => p.niveau === 'waarsch').length, tip: lijst.filter(p => p.niveau === 'tip').length });

/* ---------- proefdraaien ---------- */
/* Kleine voorspelbare toevalsgenerator, zodat een proefdraai met hetzelfde getal hetzelfde oplevert. */
export function toeval(zaad = 1){
  let a = (Number(zaad) >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
/* Doelpunten zoals bij jeugdvoetbal: meestal 0 tot 3, soms meer. */
const KANS = [0.24, 0.30, 0.22, 0.12, 0.07, 0.03, 0.02];
const goals = r => { let x = r(); for (let i = 0; i < KANS.length; i++){ if (x < KANS[i]) return i; x -= KANS[i]; } return KANS.length; };

/* Eén keer het hele toernooi spelen. Geeft { uitslag, problemen, podia, winnaars }. */
export function speelEenKeer(t = {}, zaad = 1){
  const r = toeval(zaad), o = T.opzet(t), duur = o.duur, stap = o.duur + o.wissel;
  const sim = { ...t, uitslag: {} }, problemen = [], teams = t.teams || {};
  const tn = id => teams[id]?.naam || '?', zet = (id, niveau, groep, tekst, extra = {}) => problemen.push({ id, niveau, groep, tekst, tab: 'schema', wed: [], teams: [], ...extra });
  const tijden = [...new Set((t.schema || []).map(w => w.t))].sort((a, b) => T.naarMin(a) - T.naarMin(b));
  for (const tijd of tijden){
    for (const w of T.metKo(sim).filter(x => x.t === tijd)){
      if (w.ko && (!w.a || !w.b)){
        const wacht = [!w.a ? w.la : '', !w.b ? w.lb : ''].filter(Boolean);
        zet(`sim-onbekend|${w.id}`, 'fout', 'Finales', `Om ${w.t} moet ${koNaam(t, w)} beginnen, maar dan is nog niet bekend wie er speelt (${wacht.join(' en ')}).`, { wed: [w.id] });
        continue;
      }
      const u = { a: goals(r), b: goals(r) };
      if (w.ko && u.a === u.b) u.w = r() < 0.5 ? 'a' : 'b';
      sim.uitslag[w.id] = u;
    }
  }
  /* met de teams van de finales ingevuld: speelt er nu iemand dubbel of zonder rust? */
  const ws = T.metKo(sim), perTeam = new Map();
  for (const w of ws) for (const id of [w.a, w.b]) if (id) perTeam.set(id, [...(perTeam.get(id) || []), w]);
  for (const [id, lijst] of perTeam){
    lijst.sort((x, y) => T.naarMin(x.t) - T.naarMin(y.t));
    for (let i = 1; i < lijst.length; i++){
      const vorige = lijst[i - 1], w = lijst[i], g = T.naarMin(w.t) - T.naarMin(vorige.t);
      if (!w.ko) continue;   /* poulewedstrijden controleert controleer() al */
      const titel = koNaam(t, w);
      if (g < duur) zet(`sim-tegelijk|${w.id}|${vorige.id}`, 'fout', 'Finales', `Als ${tn(id)} doorgaat, speelt het om ${w.t} ${titel} terwijl het nog met ${vorige.ko ? koNaam(t, vorige) : 'een poulewedstrijd'} bezig is.`, { wed: [w.id, vorige.id] });
      else if (o.rust && g <= stap) zet(`sim-rust|${w.id}`, 'waarsch', 'Finales', `Wie in ${vorige.ko ? koNaam(t, vorige) : `de laatste wedstrijd van ${t.poules?.[vorige.p]?.naam || 'de poule'} (${vorige.t})`} speelt, moet zonder rust meteen ${titel} om ${w.t} spelen.`, { wed: [w.id] });
    }
  }
  const podia = T.koGroepen(t).map(g => {
    const p = T.koUitslag(sim, g.id), fin = ws.find(w => w.ko === g.id && w.fase === 'finale');
    if (fin && !p.some(x => x.plaats === 1)) zet(`sim-geen-winnaar|${g.id}`, 'fout', 'Finales', `${g.naam || 'De knock-out'} heeft na het proefdraaien geen winnaar: de finale kon niet gespeeld worden.`);
    if (!fin && T.koOpzet(t, g).length) zet(`sim-geen-finale|${g.id}`, 'fout', 'Finales', `${g.naam || 'De knock-out'} heeft geen finale in het schema. Plan het schema opnieuw.`);
    return { id: g.id, naam: g.naam || 'Finales', plaatsen: p };
  });
  const inKo = new Set(T.koGroepen(t).flatMap(g => g.poules));
  const winnaars = T.gesorteerd(t.poules).filter(p => !inKo.has(p.id)).map(p => ({ id: p.id, naam: p.naam, stand: T.stand(sim, p.id) })).filter(x => x.stand.length);
  return { uitslag: sim.uitslag, schema: ws, problemen, podia, winnaars };
}

/* Vaak achter elkaar spelen; een probleem dat maar soms optreedt (afhankelijk van wie er wint) komt zo ook boven.
   Geeft { keer, problemen: [{ …probleem, hoeVaak }], voorbeeld: speelEenKeer, controle: controleer(t), stats }. */
export function proefdraaien(t = {}, { keer = 120, zaad = Date.now(), opties = {} } = {}){
  const controle = controleer(t, opties), samen = new Map();
  let voorbeeld = null;
  if (!(t.schema || []).length) return { keer: 0, problemen: [], voorbeeld: null, controle, stats: null };
  for (let i = 0; i < keer; i++){
    const run = speelEenKeer(t, (Number(zaad) + i * 7919) >>> 0);
    if (!voorbeeld) voorbeeld = run;
    const gezien = new Set();
    for (const p of run.problemen){ if (gezien.has(p.id)) continue; gezien.add(p.id); const x = samen.get(p.id); if (x) x.hoeVaak++; else samen.set(p.id, { ...p, hoeVaak: 1 }); }
  }
  /* zelfde soort melding over verschillende teams: één regel per wedstrijd is genoeg */
  const problemen = sorteer([...samen.values()]).sort((a, b) => ORDE[a.niveau] - ORDE[b.niveau] || b.hoeVaak - a.hoeVaak);
  return { keer, problemen, voorbeeld, controle, stats: statistiek(t, voorbeeld) };
}

/* Per team: aantal wedstrijden en speelminuten, en hoe druk het op het drukste moment is. */
export function statistiek(t = {}, run = null){
  const o = T.opzet(t), ws = run?.schema || T.metKo(t), teams = t.teams || {};
  const n = {}; for (const w of ws) for (const id of [w.a, w.b]) if (id) n[id] = (n[id] || 0) + 1;
  const poule = {}; for (const w of (t.schema || []).filter(w => !w.ko)) for (const id of [w.a, w.b]) poule[id] = (poule[id] || 0) + 1;
  const ids = Object.keys(teams).filter(id => poule[id]);
  const min = ids.length ? Math.min(...ids.map(id => poule[id])) : 0, max = ids.length ? Math.max(...ids.map(id => poule[id])) : 0;
  const tijden = ws.map(w => T.naarMin(w.t)), pr = T.prijsuitreiking(t);
  return { wedstrijden: ws.length, finales: ws.filter(w => w.ko).length, minPoule: min, maxPoule: max, minMinuten: min * o.duur, maxMinuten: (ids.length ? Math.max(...ids.map(id => n[id] || 0)) : 0) * o.duur,
    begin: tijden.length ? T.naarTijd(Math.min(...tijden)) : o.start, eind: tijden.length ? T.naarTijd(Math.max(...tijden) + o.duur) : o.start, prijs: pr, zonderWedstrijd: Object.keys(teams).filter(id => !n[id]) };
}

/* ---------- wat de AI te zien krijgt ---------- */
/* Teamnamen, clubs, poules, tijden en wat de vaste regels al vonden. Geen spelers, geen contactgegevens. */
export function aiSamenvatting(t = {}, problemen = [], { naam = '', datum = '' } = {}){
  const o = T.opzet(t), teams = t.teams || {}, rooster = T.teamRooster({ ...t, schema: T.metKo(t) }), kort = s => String(s ?? '').slice(0, 40);
  const vj = T.veldjes(t);
  return {
    toernooi: kort(naam), datum: /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : '', soort: T.soort(t),
    tijden: { start: o.start, klaarOm: o.eind || null, speeltijd: o.duur, wisseltijd: o.wissel, rustTussenWedstrijden: o.rust, prijsuitreikingMin: o.prijs },
    velden: vj.map(v => kort(v.naam)),
    poules: T.gesorteerd(t.poules).map(p => ({ naam: kort(p.naam), start: p.start || null, velden: (p.velden || []).map(id => kort(vj.find(v => v.id === id)?.naam)).filter(Boolean),
      teams: T.gesorteerd(teams).filter(tm => tm.poule === p.id).map(tm => ({ naam: kort(tm.naam), club: kort(t.clubs?.[tm.club]?.naam), geslacht: tm.eisen?.geslacht || '', jaren: [tm.eisen?.van || null, tm.eisen?.tot || null] })) })),
    zonderPoule: T.gesorteerd(teams).filter(tm => !t.poules?.[tm.poule]).map(tm => kort(tm.naam)),
    finales: T.koGroepen(t).map(g => ({ naam: kort(g.naam), poules: g.poules.map(p => kort(t.poules[p]?.naam)), ronde: g.ronde, plaats3: g.plaats3 !== false, overige: !!g.overige })),
    perTeam: T.gesorteerd(teams).filter(tm => rooster[tm.id]).map(tm => { const r = rooster[tm.id]; return { team: kort(tm.naam), wedstrijden: r.wedstrijden.length, eerste: r.eerste, laatste: r.laatste, achterElkaar: r.achterElkaar, langsteWachtMin: r.langsteWacht }; }).slice(0, 80),
    kleedkamers: T.kkDelen(t).map(k => ({ naam: kort(k.naam), plekken: Number(k.plekken) || 2 })),
    prijsuitreiking: T.prijsuitreiking(t),
    alGevonden: problemen.slice(0, 30).map(p => `${NIVEAUS[p.niveau]}: ${p.tekst}`.slice(0, 240)),
  };
}

/* Wat de AI teruggeeft schoonmaken: alleen bekende teams en poules, korte teksten. */
export function schoonAiAntwoord(a = {}, t = {}){
  const teams = Object.entries(t.teams || {}), poules = Object.entries(t.poules || {});
  const zoek = (lijst, naam) => { const k = String(naam || '').trim().toLowerCase(); const hit = lijst.filter(([, x]) => String(x?.naam || '').trim().toLowerCase() === k); return hit.length === 1 ? hit[0][0] : ''; };
  const punten = (Array.isArray(a?.punten) ? a.punten : []).filter(p => p && typeof p.tekst === 'string' && p.tekst.trim())
    .slice(0, 8).map((p, i) => ({ id: `ai|${i}`, niveau: p.niveau === 'waarsch' ? 'waarsch' : 'tip', groep: 'AI', tekst: p.tekst.replace(/\s+/g, ' ').trim().slice(0, 300), tab: '', wed: [], teams: [] }));
  const al = new Set();
  const indeling = (Array.isArray(a?.indeling) ? a.indeling : []).map(x => ({ team: zoek(teams, x?.team), poule: zoek(poules, x?.naar), waarom: String(x?.waarom || '').replace(/\s+/g, ' ').trim().slice(0, 200) }))
    .filter(x => x.team && x.poule && t.teams[x.team].poule !== x.poule && !al.has(x.team) && al.add(x.team)).slice(0, 8);
  return { punten, indeling };
}
