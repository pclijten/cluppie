// Proefverhuizing bekijken: serveert de app uit public/ op http://localhost:5033, maar verbonden met het
// PROEFPROJECT in plaats van met cluppie.io. Er verandert niets aan de code in public/: alleen het antwoord
// op js/firebase.js wordt onderweg aangepast. Zie VERHUIZING-ASV33.md, deel Proef.
//
//   node tools/verhuis-asv33/proef-server.mjs
//
// Nodig: .verhuis/proef-config.txt met de webconfig van het proefproject (Firebase-console › Projectinstellingen ›
// Jouw apps › Web-app › "firebaseConfig"; plak het blok zoals het daar staat).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HIER, '..', '..', 'public');
const CONFIG = path.join(HIER, '..', '..', '.verhuis', 'proef-config.txt');
const POORT = Number(process.env.POORT || 5033);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webp': 'image/webp' };

/* Leest de webconfig uit geplakte tekst (JSON of het JavaScript-blok uit de console). */
export function leesConfig(tekst){
  const c = {};
  for (const k of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']){
    const m = new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`).exec(tekst);
    if (m) c[k] = m[1];
  }
  for (const k of ['apiKey', 'authDomain', 'projectId', 'appId']) if (!c[k]) throw new Error(`"${k}" ontbreekt in de webconfig`);
  return c;
}
/* Vervangt in js/firebase.js het config-blok en de bucket. Gooit een fout als het blok niet gevonden wordt
   (dan is firebase.js veranderd en moet deze functie mee). */
export function metProefConfig(bron, c){
  const blok = /const firebaseConfig = \{[\s\S]*?\n\};/;
  if (!blok.test(bron)) throw new Error('firebaseConfig niet gevonden in js/firebase.js');
  let uit = bron.replace(blok, 'const firebaseConfig = ' + JSON.stringify(c, null, 2) + ';');
  const bucket = /export const STORAGE_BUCKET = '[^']*';/;
  if (!bucket.test(uit)) throw new Error('STORAGE_BUCKET niet gevonden in js/firebase.js');
  return uit.replace(bucket, `export const STORAGE_BUCKET = ${JSON.stringify(c.storageBucket ? 'gs://' + c.storageBucket : '')};`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  let config;
  try { config = leesConfig(fs.readFileSync(CONFIG, 'utf8')); }
  catch (e){ console.error(`Kan ${CONFIG} niet lezen: ${e.message}\nZie VERHUIZING-ASV33.md, deel Proef.`); process.exit(1); }
  if (config.projectId === 'cluppie-ad329'){ console.error('Dit is de config van het echte project. De proef-server is alleen voor het proefproject.'); process.exit(1); }
  http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.normalize(path.join(ROOT, p));
    if (!f.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
    /* geen service worker bij de proef: die zou een oude versie blijven tonen */
    if (p === '/sw.js'){ res.writeHead(404); return res.end(); }
    fs.readFile(f, (e, d) => {
      if (e){ res.writeHead(404); return res.end('niet gevonden'); }
      if (p === '/js/firebase.js') d = Buffer.from(metProefConfig(d.toString('utf8'), config));
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(d);
    });
  }).listen(POORT, '127.0.0.1', () => console.log(`Proef: de app draait op http://localhost:${POORT} tegen project ${config.projectId}.\nStoppen: Ctrl+C.`));
}
