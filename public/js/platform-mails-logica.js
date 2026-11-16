/* PLATFORM › MAILS, pure logica (20261116p). Zelfde regels als functions/mail-teksten.js, zodat het
   voorbeeld op het scherm toont wat de server verstuurt; tests/mail-teksten.test.js vergelijkt de twee.
   Geen imports: ook te laden in de tests. */

export const TEKSTVELDEN = ['onderwerp', 'titel', 'tekst', 'knop', 'slot', 'voet'];
export const VELDNAAM = { onderwerp: 'Onderwerp', titel: 'Kop', tekst: 'Tekst', knop: 'Tekst op de knop', slot: 'Afsluiting', voet: 'Kleine regel onderaan' };
const VELD_RE = /\{([A-Za-z]\w*)\}/g;
const heeftWaarde = v => v != null && String(v).trim() !== '';
const eigen = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* {veld} invullen; tekst tussen [haken] valt weg als een veld daarbinnen leeg is.
   deels: velden die niet in `waarden` staan blijven staan, met hun haken (voor "eerst laten zien":
   de naam en de club zijn bekend, de rest vult de server in). */
export function vulIn(sjabloon, waarden = {}, { deels = false } = {}){
  const vulVelden = t => t.replace(VELD_RE, (heel, k) => (eigen(waarden, k) ? String(waarden[k] == null ? '' : waarden[k]) : heel));
  let uit = '', rest = String(sjabloon == null ? '' : sjabloon);
  const HAAK = /\[([^\[\]]*)\]/;
  for (let m = HAAK.exec(rest); m; m = HAAK.exec(rest)){
    uit += vulVelden(rest.slice(0, m.index));
    const namen = [...m[1].matchAll(VELD_RE)].map(x => x[1]);
    if (!namen.length || (deels && namen.some(k => !eigen(waarden, k)))) uit += m[0];
    else if (namen.every(k => heeftWaarde(waarden[k]))) uit += vulVelden(m[1]);
    rest = rest.slice(m.index + m[0].length);
  }
  return uit + vulVelden(rest);
}
export const alineas = t => String(t || '').split(/\r?\n[ \t]*\r?\n/).map(a => a.replace(/^\s+|\s+$/g, '')).filter(Boolean);
export const veldenIn = t => [...String(t || '').matchAll(VELD_RE)].map(x => x[1]);

/* Zelfde controle als de server, voor een melding tijdens het typen. Geeft '' of de foutzin. */
export function controleer(soort, tekst, max = {}){
  for (const k of ['onderwerp', 'titel', 'tekst']) if (!String(tekst[k] || '').trim()) return `${VELDNAAM[k]} mag niet leeg zijn.`;
  if (soort.heeftKnop && !String(tekst.knop || '').trim()) return 'De knop heeft tekst nodig.';
  for (const k of TEKSTVELDEN) if (max[k] && String(tekst[k] || '').trim().length > max[k]) return `${VELDNAAM[k]} is te lang (hooguit ${max[k]} tekens).`;
  const bekend = new Set(soort.velden.map(v => v.id));
  const onbekend = [...new Set(TEKSTVELDEN.flatMap(k => veldenIn(tekst[k])).filter(k => !bekend.has(k)))];
  return onbekend.length ? `Het invulveld {${onbekend.join('}, {')}} bestaat niet bij deze mail.` : '';
}
export const zelfde = (a, b) => TEKSTVELDEN.every(k => String((a || {})[k] || '').trim() === String((b || {})[k] || '').trim());

/* Status in de lijst. */
export function statusVan(soort, concept){
  if (soort.uit) return 'Uit';
  if (concept && !zelfde(concept, soort.tekst)) return 'Niet bewaard';
  return soort.aangepast ? 'Aangepast' : 'Standaard';
}

/* De delen van de mail zoals hij aankomt (voor het voorbeeld), ingevuld met voorbeeldgegevens. */
export function voorbeeldVan(soort, tekst, algemeen = {}){
  const v = x => vulIn(x, soort.voorbeeld || {});
  const vast = soort.voorbeeldVast || {};
  return {
    onderwerp: v(tekst.onderwerp).replace(/\s+/g, ' ').trim(), voorkop: soort.voorkop || '', titel: v(tekst.titel),
    alineas: alineas(v(tekst.tekst)), stappen: soort.stappen || [],
    gegevens: (vast.gegevens || []).filter(g => g && heeftWaarde(g[1])),
    knop: soort.heeftKnop ? v(tekst.knop).trim() : '',
    slot: [...(vast.slotVooraf || []), ...alineas(v(tekst.slot))], voet: v(tekst.voet),
    afzender: algemeen.afzender || 'Cluppie', merkregel: algemeen.merkregel || 'Cluppie · de trainersapp voor jeugdvoetbalclubs',
  };
}

/* "Eerst laten zien": de tekst voor één aanmelding, met wat al bekend is ingevuld. */
export function voorAanmelding(soort, bekend){
  const uit = {};
  for (const k of TEKSTVELDEN) uit[k] = vulIn(soort.tekst[k], bekend, { deels: true });
  return uit;
}
export function tijdTekst(ms, nu = Date.now()){
  if (!ms) return '';
  const d = new Date(ms), n = new Date(nu), dag = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const uur = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const verschil = Math.round((dag(n) - dag(d)) / 86400000);
  if (verschil === 0) return `vandaag ${uur}`;
  if (verschil === 1) return `gisteren ${uur}`;
  return `${d.getDate()} ${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][d.getMonth()]} ${uur}`;
}
