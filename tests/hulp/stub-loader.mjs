// Laat browser-modules uit public/js in Node laden voor pure unit-tests:
// firebase.js wordt vervangen door lege stubs, DOM-globals krijgen minimale nepversies.
import { register } from 'node:module';
const NAMEN = ['db','auth','storage','functions','app','doc','getDoc','getDocs','setDoc','addDoc','updateDoc','deleteDoc','collection','query','where','orderBy','limit','onSnapshot','writeBatch','serverTimestamp','increment','arrayUnion','arrayRemove','deleteField','Timestamp','httpsCallable','sRef','uploadBytes','uploadBytesResumable','getDownloadURL','deleteObject','documentId','onAuthStateChanged','signOut','sendEmailVerification','getCountFromServer','runTransaction'];
const stub = `const f = () => ({}); export const ${NAMEN.map(n => `${n} = f`).join(', ')}; export default {};`;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next){
  if (/(^|\\/)firebase\\.js(\\?|$)/.test(spec)) return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(stub)}), shortCircuit: true };
  if (/^https?:/.test(spec)) return { url: 'data:text/javascript,export default {}', shortCircuit: true };
  return next(spec, ctx);
}`));
const leeg = () => {};
const el = new Proxy({}, { get: (t, k) => (k === 'classList' ? { add: leeg, remove: leeg, toggle: leeg, contains: () => false } : k === 'style' ? {} : leeg) });
globalThis.window ??= globalThis;
globalThis.document ??= { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => el, addEventListener: leeg, documentElement: el, body: el };
globalThis.localStorage ??= { getItem: () => null, setItem: leeg, removeItem: leeg };
globalThis.sessionStorage ??= globalThis.localStorage;
globalThis.history ??= { pushState: leeg, replaceState: leeg };
globalThis.location ??= { origin: 'https://www.cluppie.io', pathname: '/', search: '', hash: '' };
try { globalThis.navigator ??= { userAgent: 'node' }; } catch (e) {}
globalThis.matchMedia ??= () => ({ matches: false, addEventListener: leeg });
