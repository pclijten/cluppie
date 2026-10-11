// Pariteitscontrole ASV'33 → cluppie.io: wat staat er in de ASV'33-app dat hier (nog) ontbreekt?
//   node tools/pariteit.mjs ../cluppieasv33
// Meldt: modules die alleen in ASV'33 bestaan, functies/constanten die in een gedeelde module
// ontbreken, en releases uit de wijzigingenlijst (UPDATES in teams.js) die hier niet staan.
// Bewuste verschillen (multi-tenant) staan in NEGEER; de rest is een kandidaat om te porten.
import fs from 'node:fs';
import path from 'node:path';

const asv = process.argv[2];
if (!asv) { console.error('Gebruik: node tools/pariteit.mjs <pad-naar-cluppieasv33>'); process.exit(1); }
const A = fs.existsSync(path.join(asv, 'js')) ? path.join(asv, 'js') : asv;
const B = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'js');
const NEGEER_MODULES = new Set(['sw.js', 'updates.js']);
/* bewust anders in cluppie.io (stand 2026-10-11):
   DOC_CATEGORIEN/CATEGORIE_VOLGORDE → clubinstellingen · EIGEN_CLUB_RE_SL → sportlink-sleutel.js ·
   loginsSnap → gebruik-collectie · KNVB_SEIZOEN → seizoen per club · CLUB_FORMATIE_11 → instellingen.pedagogiek.formatie11 ·
   getDocs/updateDoc/query/where in auth.js → aansluiten via Cloud Function sluitAan · rest: lokale variabelen */
const NEGEER_NAMEN = new Set(['DOC_CATEGORIEN', 'CATEGORIE_VOLGORDE', 'EIGEN_CLUB_RE_SL', 'loginsSnap', 'KNVB_SEIZOEN', 'CLUB_FORMATIE_11',
  'getDocs', 'updateDoc', 'query', 'where', 'teamIds', 'snap', 'ref', 'sr', 'c', 'clubId', 'email', 'ledNaam', 'naam', 'team']);
/* gedefinieerd óf geïmporteerd telt als aanwezig (een constante kan naar een gedeelde module verhuisd zijn) */
const namen = s => new Set([...[...s.matchAll(/(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]),
  ...[...s.matchAll(/import\s*\{([^}]*)\}/g)].flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop()).filter(Boolean))]);
/* ASV-specifieke woorden horen in cluppie.io niet in titels; vergelijk zonder */
const norm = t => t.replace(/ASV['’`]?(33)?[- ]?/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
const titels = s => new Set([...s.matchAll(/titel:\s*'([^']+)'/g)].map(m => norm(m[1])));

let n = 0;
for (const f of fs.readdirSync(A).filter(f => f.endsWith('.js'))){
  if (NEGEER_MODULES.has(f)) continue;
  const pb = path.join(B, f);
  if (!fs.existsSync(pb)){ console.log(`MODULE ontbreekt: ${f}`); n++; continue; }
  const mis = [...namen(fs.readFileSync(path.join(A, f), 'utf8'))].filter(x => !namen(fs.readFileSync(pb, 'utf8')).has(x) && !NEGEER_NAMEN.has(x));
  if (mis.length){ console.log(`${f}: ${mis.join(', ')}`); n += mis.length; }
}
const ta = titels(fs.readFileSync(path.join(A, 'teams.js'), 'utf8')), tb = titels(fs.readFileSync(path.join(B, 'teams.js'), 'utf8'));
for (const t of ta) if (!tb.has(t)){ console.log(`RELEASE niet in de wijzigingenlijst: "${t}"`); n++; }
console.log(n ? `\n${n} verschil(len) om na te lopen.` : 'Gelijk: alles uit ASV\'33 zit in cluppie.io.');
process.exit(n ? 2 : 0);
