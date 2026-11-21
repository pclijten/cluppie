// Alle Cloud Functions die in de code staan, met hun soort. Bron voor tools/deploy-alles.ps1 en voor de
// vraag "wat hoort er live te staan". Leest functions/index.js zoals de Firebase-CLI dat doet; maakt geen verbinding.
//   node tools/functies-lijst.mjs               tabel: naam en soort
//   node tools/functies-lijst.mjs --groepen=8   regels voor "firebase deploy --only …", acht functies per regel
//   node tools/functies-lijst.mjs --callables   de callables in kleine letters (zo heten de Cloud Run-services)
//   node tools/functies-lijst.mjs --json
// Eerst één keer: cd functions && npm install
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const hier = path.dirname(fileURLToPath(import.meta.url));
process.env.GCLOUD_PROJECT ||= 'cluppie-lijst';
process.env.FIREBASE_CONFIG ||= '{}';
const require = createRequire(path.join(hier, '..', 'functions', 'index.js'));

export function functies(){
  let m;
  try { m = require('./index.js'); }
  catch (e){ throw new Error('functions/index.js kon niet geladen worden (eerst: cd functions && npm install): ' + e.message); }
  return Object.keys(m).map(naam => {
    const e = m[naam] && m[naam].__endpoint;
    const soort = !e ? null : e.callableTrigger ? 'callable' : e.scheduleTrigger ? 'gepland' : e.eventTrigger ? 'trigger' : e.httpsTrigger ? 'https' : 'anders';
    return soort ? { naam, soort } : null;
  }).filter(Boolean).sort((a, b) => a.naam.localeCompare(b.naam));
}
export function groepen(lijst, per){
  const uit = [];
  for (let i = 0; i < lijst.length; i += per) uit.push(lijst.slice(i, i + per).map(f => 'functions:' + f.naam).join(','));
  return uit;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const args = process.argv.slice(2), lijst = functies();
  const g = args.find(a => a.startsWith('--groepen'));
  if (g){ const per = Math.max(1, Math.min(20, Number(g.split('=')[1]) || 8)); console.log(groepen(lijst, per).join('\n')); }
  else if (args.includes('--callables')) console.log(lijst.filter(f => f.soort === 'callable').map(f => f.naam.toLowerCase()).join('\n'));
  else if (args.includes('--json')) console.log(JSON.stringify(lijst));
  else {
    for (const f of lijst) console.log(f.naam.padEnd(28) + f.soort);
    const tel = s => lijst.filter(f => f.soort === s).length;
    console.log(`\n${lijst.length} functies: ${tel('callable')} callables, ${tel('trigger')} triggers, ${tel('gepland')} gepland`);
  }
  process.exit(0);
}
