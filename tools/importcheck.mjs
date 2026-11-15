// node tools/importcheck.mjs  (zit in npm test)
// Controleert of elke benoemde import uit ./x.js in public/js ook door x.js wordt geëxporteerd,
// en of een module nergens met twee verschillende ?v= wordt geïmporteerd.
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2] || 'public/js');
const bestanden = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
// commentaar weg: namen in een export-lijst staan soms tussen kopjes (blokcommentaar)
const zonderCommentaar = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
const bron = Object.fromEntries(bestanden.map(f => [f, zonderCommentaar(fs.readFileSync(path.join(dir, f), 'utf8'))]));
function exports_(f, gezien = new Set()){
  if (gezien.has(f) || !bron[f]) return new Set(); gezien.add(f);
  const s = bron[f], uit = new Set();
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) uit.add(m[1]);
  for (const m of s.matchAll(/export\s+(?:const|let|var)\s+([^=;]+?)\s*=/g)) for (const n of m[1].split(',')) uit.add(n.trim());
  for (const m of s.matchAll(/export\s*\{([^}]*)\}(?:\s*from\s*'\.\/([^'?]+))?/g))
    for (const n of m[1].split(',')){ const x = n.trim().split(/\s+as\s+/).pop().trim(); if (x) uit.add(x); }
  for (const m of s.matchAll(/export\s*\*\s*from\s*'\.\/([^'?]+)/g)) for (const n of exports_(m[1], gezien)) uit.add(n);
  if (/export\s+default/.test(s)) uit.add('default');
  return uit;
}
let fouten = 0; const versies = {};
for (const f of bestanden){
  for (const m of bron[f].matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/([A-Za-z0-9_-]+\.js)(\?v=[0-9a-z]+)?'/g)){
    const [, namen, mod, v] = m;
    if (!bron[mod]){ console.log(`${f}: module ${mod} bestaat niet`); fouten++; continue; }
    if (f !== 'firebase-demo.js') (versies[mod] ||= new Set()).add(v || '');   /* de demo laadt bewust zonder versie */
    const ex = exports_(mod);
    for (const n of namen.split(',')){ const x = n.trim().split(/\s+as\s+/)[0].trim(); if (x && !ex.has(x)){ console.log(`${f}: ${x} bestaat niet in ${mod}`); fouten++; } }
  }
  for (const m of bron[f].matchAll(/import\(\s*'\.\/([A-Za-z0-9_-]+\.js)(\?v=[0-9a-z]+)?'/g)){
    if (!bron[m[1]]){ console.log(`${f}: module ${m[1]} bestaat niet (dynamisch)`); fouten++; }
    else if (f !== 'firebase-demo.js') (versies[m[1]] ||= new Set()).add(m[2] || '');
  }
}
for (const [mod, vs] of Object.entries(versies)) if (vs.size > 1){ console.log(`${mod}: meerdere versies ${[...vs].join(' ')}`); fouten++; }
console.log(fouten ? `importcontrole: ${fouten} fouten` : `importcontrole: ${bestanden.length} modules in orde`);
process.exit(fouten ? 1 : 0);
