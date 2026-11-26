/* ==================== TEAMKAMER — pushmeldingen op dit toestel [20261126m] ====================
   Een ouder zet hier meldingen aan. Het toestel krijgt een FCM-token, dat onder gebruikers/{uid}/push/{id}
   komt (rules: alleen de eigen gebruiker). De Cloud Functions in functions/teamkamer.js sturen daarheen
   een melding bij een nieuwe poll, een mededeling of een herinnering, als de trainer dat aanvinkt.
   De melding zelf laat public/sw.js zien (dezelfde worker als de trainersapp).
   iPhone en iPad: meldingen kunnen pas als de teamkamer op het beginscherm staat en van daaruit is geopend. */
import { app, db, doc, setDoc, deleteDoc } from './firebase.js?v=20261011g';

/* openbare Web Push-sleutel van het Firebase-project (Projectinstellingen › Cloud Messaging) */
const VAPID = 'BJBaRR47FzcMbYofctCMbp8jBzv4dXrhaVoQukADEW7v0Csy9MYovDVT1UVt9seYFtPh54U7Gww5wFW0iyR7xEo';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';
const SLEUTEL = 'tkPush';           // localStorage: id van het document van dit toestel

const lees = () => { try { return localStorage.getItem(SLEUTEL) || ''; } catch { return ''; } };
const schrijf = (v) => { try { v ? localStorage.setItem(SLEUTEL, v) : localStorage.removeItem(SLEUTEL); } catch { /* geen opslag */ } };
const isDemo = () => /[?&]demo(=|&|$)/.test(location.search);
export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const alsApp = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
const kanPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/* 'kan-niet' | 'beginscherm' (iPhone, eerst op het beginscherm zetten) | 'geweigerd' | 'aan' | 'uit' */
export function staat(){
  if (!VAPID || isDemo()) return 'kan-niet';
  if (isIos() && !alsApp()) return 'beginscherm';
  if (!kanPush()) return 'kan-niet';
  if (Notification.permission === 'denied') return 'geweigerd';
  return Notification.permission === 'granted' && lees() ? 'aan' : 'uit';
}

async function werker(){
  await navigator.serviceWorker.register('sw.js');
  return navigator.serviceWorker.ready;
}
async function token(){
  const reg = await werker();
  const m = await import(SDK);
  if (!(await m.isSupported())) throw new Error('Meldingen werken niet in deze browser.');
  return { m, msg: m.getMessaging(app), t: await m.getToken(m.getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: reg }) };
}
async function idVan(t){
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return Array.from(new Uint8Array(h).slice(0, 12), b => b.toString(16).padStart(2, '0')).join('');
}
const apparaat = () => (isIos() ? 'iPhone of iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computer');

/* Moet vanuit een tik worden aangeroepen (iPhone vraagt anders geen toestemming). */
export async function zetAan(uid){
  if (!uid) throw new Error('Log eerst in.');
  const ok = await Notification.requestPermission();
  if (ok !== 'granted') throw new Error(ok === 'denied' ? 'Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je telefoon.' : 'Je gaf geen toestemming voor meldingen.');
  const { t } = await token();
  if (!t) throw new Error('Dit toestel kreeg geen adres voor meldingen. Probeer het later opnieuw.');
  const id = await idVan(t), oud = lees();
  await setDoc(doc(db, 'gebruikers', uid, 'push', id), { token: t, ms: Date.now(), apparaat: apparaat() });
  if (oud && oud !== id) await deleteDoc(doc(db, 'gebruikers', uid, 'push', oud)).catch(() => {});
  schrijf(id);
}
export async function zetUit(uid){
  const id = lees();
  schrijf('');
  if (uid && id) await deleteDoc(doc(db, 'gebruikers', uid, 'push', id)).catch(() => {});
  try { const { m, msg } = await token(); await m.deleteToken(msg); } catch { /* al weg */ }
}
/* Bij elke start: het token kan door de browser vernieuwd zijn; dan het nieuwe bewaren. Stil bij fouten. */
export async function vernieuw(uid){
  if (!uid || staat() !== 'aan') return;
  try {
    const { t } = await token();
    if (!t) return;
    const id = await idVan(t);
    if (id === lees()) return;
    await setDoc(doc(db, 'gebruikers', uid, 'push', id), { token: t, ms: Date.now(), apparaat: apparaat() });
    const oud = lees(); schrijf(id);
    if (oud) await deleteDoc(doc(db, 'gebruikers', uid, 'push', oud)).catch(() => {});
  } catch { /* volgende keer */ }
}
/* Bij uitloggen: dit toestel hoort niet meer bij dit account. */
export async function vergeet(uid){ if (lees()) await zetUit(uid).catch(() => {}); }

/* Cijfer op het app-icoon (alleen als de teamkamer is geïnstalleerd). De worker telt er bij een melding één bij;
   daarom bewaren we het getal ook waar de worker het leest. */
let vorigeBadge = -1;
export function badge(n){
  if (n === vorigeBadge) return; vorigeBadge = n;
  try { if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch { /* niet ondersteund */ }
  try { caches.open('teamkamer-teller').then(c => c.put('teller', new Response(String(n)))).catch(() => {}); } catch { /* geen cache */ }
}
