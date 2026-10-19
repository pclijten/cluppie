/* ==================== SEIZOENSPLAN JEUGD — CLUBNIVEAU (puur, geen DOM, geen Firestore) ====================
   [20261017a] Een clubbreed seizoensplan (clubs/{clubId}/seizoensplannen/{planId}) dat de hoofd
   jeugdopleiding of een bouwcoördinator maakt en daarna aan de jeugdteams toewijst. Toewijzen
   zet de trainingen van het hele seizoen op het tabblad Oefenstof van elk team: gewone
   trainingsdocumenten (trainingen/{id}) met teams[] en week, zodat de bestaande lijst, de
   datumchips (teams-training.js) en de weergave (training-weergave.js) ze ongewijzigd tonen.

   Alle rekenwerk hier is deterministisch en getest (tests/seizoensplan-club.test.mjs). De
   bron van de trainingen is de bestaande planner (trainingsplanner.js); AI wordt niet gebruikt.

   Vaste docId per training (sp_{planId}_{teamId}_{seizoensweek}_{nr}) maakt een herhaalde
   uitrol idempotent: dezelfde documenten worden overschreven, nooit gedupliceerd. */
import { maakPlan, pasKnoppenToe } from './trainingsplanner.js?v=20261019f';
import { positieWeek, maakSeizoensplan } from './seizoensplan-logica.js?v=20261019f';
import { leeftijdVanCategorie } from './config.js?v=20261011g';
import { vormSvg } from './trainingsvorm-svg.js?v=20261012e';


export const JEUGDBOUWEN = ['onder', 'midden', 'boven'];

/* Jeugdteam = categorie met een leeftijd (O6–O19). Senioren en vrouwen vallen buiten deze planning. */
export function isJeugdCategorie(categorie){ return leeftijdVanCategorie(categorie) < 99; }

/* Maandag (ISO 'YYYY-MM-DD') → ISO-weeknummer en het jaar waartoe die week hoort (donderdag-regel). */
export function isoWeekVan(isoMaandag){
  const d = new Date(isoMaandag + 'T12:00:00');
  const donderdag = new Date(d.getTime()); donderdag.setDate(d.getDate() + 3);
  const jaar = donderdag.getFullYear();
  const jan4 = new Date(jaar, 0, 4, 12);
  const week1 = new Date(jan4.getTime()); week1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNr = Math.round((d - week1) / (7 * 864e5)) + 1;
  return { weekNr, jaar };
}

/* Bouw van een team: de bouw die bij het team hoort, anders afgeleid van de categorie. */
export function bouwVanTeam(team){
  if (JEUGDBOUWEN.includes(team?.bouw)) return team.bouw;
  const lv = leeftijdVanCategorie(team?.categorie);
  if (lv >= 99) return null;
  return lv <= 9 ? 'onder' : lv <= 11 ? 'midden' : 'boven';
}

/* Rechten voor een clubbreed plan. club = clubdocument (admins, hoofdJeugd, bouwCoordinatoren). */
export function rechtenVoor(club, uid){
  const alles = !!(uid && (club?.admins?.[uid] || club?.hoofdJeugd?.[uid]));
  const bouwen = JEUGDBOUWEN.filter(b => !!(uid && club?.bouwCoordinatoren?.[b]?.[uid]));
  return { alles, bouwen, magPlan: alles || bouwen.length > 0 };
}
/* Mag deze gebruiker het plan voor bouw `bouw` maken of toewijzen? (bouw 'club' = alle bouwen) */
export function magVoorBouw(rechten, bouw){
  if (rechten.alles) return true;
  if (!bouw || bouw === 'club') return false;
  return rechten.bouwen.includes(bouw);
}

/* Jaarlijn voor één team. De thema-volgorde hangt af van de leeftijd (leercurve), dus per team berekend.
   plan = clubplan { model, bouw, params:{start, eind, vrij, accent, tpw, duur, niveau} }. */
export function planVoorTeam(plan, team, beschikbaar){
  const p = plan.params || {};
  const bouw = bouwVanTeam(team) || plan.bouw;
  const det = maakSeizoensplan({
    categorie: team.categorie, leeftijd: leeftijdVanCategorie(team.categorie), bouw,
    model: plan.model, start: p.start, eind: p.eind, vrij: p.vrij || [], accent: p.accent || [],
    tpw: p.tpw, duur: p.duur, niveau: p.niveau, beschikbaar,
  });
  return { ...det, params: { ...p, bouw } };
}

/* Jeugdteams binnen het bereik van een plan. */
export function teamsVoorPlan(plan, teams){
  return (teams || []).filter(t => isJeugdCategorie(t.categorie) && (plan.bouw === 'club' || bouwVanTeam(t) === plan.bouw));
}

/* Oefening (één onderdeel van de training) in het formaat van de bestaande weergave: titel + blokken. */
export function oefeningVan(od){
  const v = od.vorm || {};
  const lijst = (kop, items) => (Array.isArray(items) && items.length ? [{ kop, type: 'lijst', items: items.map(String) }] : []);
  const blokken = [
    { kop: 'Tijd en groepen', type: 'tekst', tekst: `${od.minuten} minuten · ${od.slotNaam || ''}${od.groepen ? ` · ${od.groepen} groep${od.groepen === 1 ? '' : 'en'}` : ''}`.trim() },
    ...(v.uitleg ? [{ kop: 'Uitleg', type: 'tekst', tekst: String(v.uitleg) }] : []),
    ...lijst('Organisatie', v.organisatie),
    ...lijst('Regels', v.regels),
    ...(od.themaregel ? [{ kop: 'Themaregel', type: 'tekst', tekst: String(od.themaregel) }] : []),
    ...lijst('Coachpunten', v.coachpunten),
    ...lijst('Coachvragen', v.coachvragen),
    ...lijst('Makkelijker', v.makkelijker),
    ...lijst('Moeilijker', v.moeilijker),
  ];
  return { titel: String(v.naam || od.vormId || 'Oefening'), blokken, svg: tekeningVan(od) };
}
/* De tekening van de oefening als SVG (zoals in de Training maken-weergave). Geen tekening → geen veld. */
function tekeningVan(od){
  const v = od.vorm || {};
  try {
    if (!v.tekening) return '';
    const veld = od.veld || pasKnoppenToe(od, { druk: 0, complexiteit: 0, stijl: 'punten' }).veld || v.veld;
    if (!veld) return '';
    /* pijlpunt-id's uit vormSvg komen uit een teller: vastzetten op de oefening, zodat uitrollen herhaalbaar is */
    const sleutel = String(od.vormId || v.id || 'v').replace(/[^a-z0-9]/gi, '').slice(0, 30) || 'v';
    return vormSvg(v, veld).replace(/\btv\d+\b/g, 'tv' + sleutel);
  } catch (e){ return ''; }
}

/* Alle trainingsdocumenten voor één team uit één seizoensplan.
   p = { plan (uit seizoensplan-logica: kal, blokken, params), team, clubId, planId, planVersie, vormen (bibliotheek), aantalSpelers }
   Geeft { docs:[{id, ...}], meldingen:[] }. Elke trainingsweek krijgt params.tpw trainingen. */
/* [20261018a] Alle trainingen van een seizoensplan voor één team, in volgorde, met de rotatie over
   de weken heen (recent = vorm-id's van de laatste 10 onderdelen). Gedeeld door de opslag
   (trainingDocs) en het teamscherm, zodat wat op het scherm staat precies is wat op Trainingen komt.
   Geeft [{ w, pos, t, p }]: w = trainingsweek uit plan.kal, t = nummer binnen de week. */
export function trainingenVanPlan({ plan, team, vormen, planId, aantalSpelers = 12 }){
  const f = plan.params || {};
  const lv = leeftijdVanCategorie(team.categorie);
  const uit = [];
  let recent = [];
  for (const w of plan.kal.filter(x => !x.vrij)){
    const pos = positieWeek(plan, w.nr);
    for (let t = 1; t <= (f.tpw || 2); t++){
      const p = maakPlan(vormen, {
        categorie: team.categorie, leeftijd: lv, aantalSpelers, niveau: f.niveau || 2, duur: f.duur || 60,
        thema: pos.blok.thema, blokFase: pos.fase, seed: `${team.id}:${planId}:${w.nr}:${t}`, recent,
      });
      recent = [...p.onderdelen.map(o => o.vormId), ...recent].slice(0, 10);
      uit.push({ w, pos, t, p });
    }
  }
  return uit;
}

export function trainingDocs({ plan, team, clubId, planId, planVersie, vormen, aantalSpelers = 12 }){
  const f = plan.params || {};
  const teamId = team.id;
  const meldingen = [];
  const docs = [];
  for (const { w, pos, t, p } of trainingenVanPlan({ plan, team, vormen, planId, aantalSpelers })){
    const { weekNr, jaar } = isoWeekVan(w.iso);
    if (p.meldingen?.length) meldingen.push(`week ${w.nr} training ${t}: ${p.meldingen.join(' ')}`);
    const id = `sp_${planId}_${teamId}_${w.nr}_${t}`.replace(/[^A-Za-z0-9_-]/g, '_');
    docs.push({
      id, club: clubId, teams: [teamId],
      week: `Week ${weekNr}`, seizoenJaar: jaar, seizoensWeek: w.nr,
      titel: `Seizoensplan · week ${w.nr} · training ${t} · ${pos.blok.thema}`,
      bron: 'seizoensplan', seizoensplanId: planId, planVersie: planVersie || 1,
      thema: pos.blok.thema, fase: pos.fase, duur: p.profiel?.duur || f.duur || 60,
      url: '', diagramUrls: {},
      oefeningen: [...p.onderdelen.map(oefeningVan), ...(p.afsluiting ? [oefeningVan(p.afsluiting)] : [])],
    });
  }
  return { docs, meldingen };
}

/* Weken waar een team al een handmatige (niet-seizoensplan) training heeft. Voor de waarschuwing vóór uitrol. */
export function bezetteWeken(bestaande){
  const set = new Set();
  for (const t of bestaande || []){
    if (t.bron === 'seizoensplan') continue;
    const m = String(t.week || '').match(/\b([1-9]|[1-4]\d|5[0-3])\b/);
    if (m) set.add(Number(m[1]));
  }
  return set;
}

/* Hoeveel trainingen van het plan lopen tegen een bezette week aan? */
export function botsingen(docs, bezet){
  return docs.filter(d => bezet.has(Number(String(d.week).match(/\d+/)?.[0]))).length;
}
