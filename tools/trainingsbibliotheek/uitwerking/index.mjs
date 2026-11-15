/* Uitwerking per oefening (met de hand). [20261116i]
   Per id: v (spelverloop, zie ../verloop.mjs), pr (principes van de speelwijze), lukt (zo zie je dat het lukt),
   alsDan (kijk en grijp in: [zie, doe]), meet (tel mee), regie (spelers aan zet: sleutel of zin), inz (waarom: sleutel),
   en waar nodig betere teksten (doel, uitleg, org, regels, punten, vragen, makk, moei, var, letOp, lft, veld, n, tijd)
   of een betere opstelling (sp, bal, tek). */
import { compileer } from '../verloop.mjs';
import { INZICHT, REGIE } from '../inzichten.mjs';
import { UIT_A } from './a.mjs';
import { UIT_B } from './b.mjs';
import { UIT_C } from './c.mjs';
export const UITWERKING = { ...UIT_A, ...UIT_B, ...UIT_C };

const TEKST = { doel: 'doel', uitleg: 'uitleg', org: 'organisatie', regels: 'regels', punten: 'coachpunten', vragen: 'coachvragen', makk: 'makkelijker', moei: 'moeilijker', letOp: 'letOp', naam: 'naam', lft: 'leeftijd', tijd: 'tijd' };
export const fouten = [];
export function werkUit(v){
  const u = UITWERKING[v.id];
  if (!u) return v;
  const uit = { ...v };
  for (const [k, veld] of Object.entries(TEKST)) if (u[k] !== undefined) uit[veld] = u[k];
  if (u.var) uit.varianten = u.var.map(([naam, uitleg]) => ({ naam, uitleg }));
  if (u.veld) uit.veld = { b: u.veld[0], l: u.veld[1] };
  if (u.n) uit.spelers = { min: u.n[0], ideaal: u.n[1], max: u.n[2] };
  const t = { ...v.tekening };
  if (u.sp) t.spelers = u.sp;
  if (u.doeltjes) t.doeltjes = u.doeltjes;
  if (u.zones) t.zones = u.zones;
  if (u.pionnen) t.pionnen = u.pionnen;
  if (u.iedereenBal !== undefined) t.iedereenBal = u.iedereenBal;
  if (u.bal !== undefined){
    if (typeof u.bal === 'number'){ const sp = t.spelers.find(x => x.nr === u.bal); if (sp) t.bal = [sp.x, sp.y]; else fouten.push(`${v.id}: bal bij onbekende speler ${u.bal}`); }
    else if (u.bal === null) delete t.bal; else t.bal = u.bal;
  }
  if (u.v){
    const c = compileer(uit, t, u.v, { tek: u.tek });
    for (const f of c.fouten) fouten.push(`${v.id}: ${f}`);
    t.lijnen = c.lijnen;
  }
  uit.tekening = t;
  if (u.pr) uit.principes = u.pr;
  if (u.lukt) uit.lukt = u.lukt;
  if (u.alsDan) uit.alsDan = u.alsDan.map(([zie, doe]) => ({ zie, doe }));
  if (u.meet) uit.meet = u.meet;
  if (u.regie){ uit.regie = REGIE[u.regie] || u.regie; if (!REGIE[u.regie] && u.regie.length < 25) fouten.push(`${v.id}: onbekende regie "${u.regie}"`); }
  if (u.inz){ if (INZICHT[u.inz]) uit.inzicht = INZICHT[u.inz]; else fouten.push(`${v.id}: onbekend inzicht "${u.inz}"`); }
  for (const k of ['v', 'pr', 'lukt', 'alsDan', 'meet', 'regie', 'inz']) if (u[k] === undefined && !(k === 'v' && u.geenV)) fouten.push(`${v.id}: ${k} ontbreekt`);
  return uit;
}
