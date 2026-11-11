/* Eindbaas-laag voor Training maken en Seizoensplanning (server). Zelfde regel als
   public/js/onderdelen.js (platformToegestaan); tests/onderdelen.test.mjs vergelijkt ze.
   clubs/{id}.platformModules.{sleutel} = true|false; zonder keuze blijven clubs van vóór
   GRENS_SEC aan en beginnen nieuwere clubs uit tot de platformbeheerder het aanzet. */
const BEHEERD = ['trainingsmodule', 'seizoensplan'];
const GRENS_SEC = Date.parse('2026-10-13T00:00:00+02:00') / 1000;

function seconden(t){
  if (!t) return null;
  if (typeof t === 'number') return t > 1e11 ? t / 1000 : t;
  if (typeof t === 'string'){ const ms = Date.parse(t); return Number.isNaN(ms) ? null : ms / 1000; }
  const s = t.seconds ?? t._seconds;
  return typeof s === 'number' ? s : null;
}
function platformToegestaan(club, sleutel){
  if (!BEHEERD.includes(sleutel)) return true;
  const v = club && club.platformModules && club.platformModules[sleutel];
  if (v === true || v === false) return v;
  const s = seconden(club && club.gemaakt);
  return !(s !== null && s >= GRENS_SEC);
}
/* [20261021] AI en maximale videogrootte beheert alleen de eindbaas: clubs/{id}.platformModules.{ai, aiLimiet, maxVideoMB}.
   AI staat standaard UIT; zonder `ai === true` weigert de server alle AI-functies. */
function aiVanClub(club){
  const pm = (club && club.platformModules) || {}, eigen = (club && club.instellingen && club.instellingen.ai) || {};
  const l = pm.aiLimiet;
  const limiet = (l === null || l === undefined || l === '' || !Number.isFinite(Number(l)) || Number(l) < 0) ? null : Math.round(Number(l));
  return { aan: pm.ai === true && eigen.aan !== false, limiet };
}

/* [20261111b] platformModules voor een nieuwe club, uit platform/instellingen.standaard.
   Zonder standaard: zoals tot nu (Training maken en Seizoensplanning uit, AI uit, video 100 MB).
   Zelfde functie als public/js/onderdelen.js (tests/onderdelen.test.mjs vergelijkt ze). */
function modulesVoorNieuweClub(standaard){
  const s = standaard || {}, l = s.aiLimiet, v = Math.round(Number(s.maxVideoMB));
  return {
    trainingsmodule: s.trainingsmodule === true, seizoensplan: s.seizoensplan === true, ai: s.ai === true,
    aiLimiet: (l === null || l === undefined || l === '' || !Number.isFinite(Number(l)) || Number(l) < 0) ? null : Math.round(Number(l)),
    maxVideoMB: Number.isFinite(v) && v >= 5 && v <= 300 ? v : 100,
  };
}
module.exports = { BEHEERD, GRENS_SEC, platformToegestaan, aiVanClub, modulesVoorNieuweClub };
