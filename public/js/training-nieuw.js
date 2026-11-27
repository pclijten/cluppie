/* [20261127t] Wanneer telt een training als "nieuw"?
   Voorheen was elke training die je zelf nog nooit had geopend "nieuw". Een
   coach of beheerder die een team net krijgt (of nooit opende) zag daardoor
   alle oude trainingen van het seizoen als nieuw: badge "24" bij Trainingen.
   Nu telt alleen ongelezen oefenstof van deze week of later. Trainingen uit
   een eerdere week zijn geweest en vragen geen aandacht meer. Zonder
   herkenbare week telt de uploaddatum: alleen de afgelopen 14 dagen.
   Pure logica (geen imports), zodat de tests hem los kunnen laden. */

function weekNrUit(tekst){
  const m = String(tekst || '').match(/\b([1-9]|[1-4]\d|5[0-3])\b/);
  return m ? parseInt(m[1], 10) : null;
}
function jaarVoorWeek(weekNr, sec){
  const d = sec ? new Date(sec * 1000) : new Date();
  let jaar = d.getFullYear();
  if (d.getMonth() === 0 && weekNr >= 50) jaar -= 1;
  if (d.getMonth() === 11 && weekNr <= 2) jaar += 1;
  return jaar;
}
/* ISO-week + ISO-jaar van een datum, als sorteerbare sleutel 'JJJJ-WW'. */
function weekSleutel(d){
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dt.setUTCDate(dt.getUTCDate() + 3 - ((dt.getUTCDay() + 6) % 7));
  const jaar = dt.getUTCFullYear();
  const vierJan = new Date(Date.UTC(jaar, 0, 4));
  const wk = 1 + Math.round(((dt - vierJan) / 86400000 - 3 + ((vierJan.getUTCDay() + 6) % 7)) / 7);
  return `${jaar}-${String(wk).padStart(2, '0')}`;
}

/* Sleutel 'JJJJ-WW' van de week waarin de training valt, of null. */
export function trainingWeekSleutel(t){
  if (/^\d{4}-\d{2}-\d{2}$/.test(t?.datum || '')) return weekSleutel(new Date(t.datum + 'T12:00'));
  if (/^\d{4}-\d{2}-\d{2}$/.test(t?.weekStart || '')) return weekSleutel(new Date(t.weekStart + 'T12:00'));
  const wn = weekNrUit(t?.week);
  if (!wn) return null;
  const jaar = t.seizoenJaar || jaarVoorWeek(wn, t.gemaakt?.seconds);
  return `${jaar}-${String(wn).padStart(2, '0')}`;
}

/* true als de training nog niet geopend is en niet in een eerdere week valt. */
export function trainingNieuw(t, gelezen, nu = new Date()){
  if (!t || (gelezen && gelezen[t.id])) return false;
  const k = trainingWeekSleutel(t);
  if (k) return k >= weekSleutel(nu);
  const sec = t.gemaakt?.seconds;
  return !sec || (nu.getTime() - sec * 1000) < 14 * 86400000;
}

export const _test = { weekSleutel };
