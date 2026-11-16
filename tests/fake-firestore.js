// minimale in-memory Firestore voor de tests van de Cloud Functions (toegang, overdracht, teamkamer)
const store = new Map();               // pad -> data
const SENT = { del: Symbol('del') };
class Ts { constructor(ms){ this.ms = ms; } toMillis(){ return this.ms; } valueOf(){ return this.ms; } toDate(){ return new Date(this.ms); } }
const FieldValue = { delete: () => SENT.del, serverTimestamp: () => new Ts(Date.now()), increment: n => ({ inc: n }), arrayRemove: v => ({ rm: v }), arrayUnion: (...v) => ({ uni: v }) };
const clone = o => { if (o === undefined) return undefined; if (o instanceof Ts) return new Ts(o.ms); if (Array.isArray(o)) return o.map(clone); if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k,v]) => [k, clone(v)])); return o; };
function setPath(obj, path, val){
  const k = path.split('.'); let o = obj;
  for (let i = 0; i < k.length - 1; i++){ o[k[i]] = (o[k[i]] && typeof o[k[i]] === 'object') ? o[k[i]] : {}; o = o[k[i]]; }
  const last = k[k.length - 1];
  if (val === SENT.del) delete o[last];
  else if (val && val.inc !== undefined) o[last] = (o[last] || 0) + val.inc;
  else if (val && val.rm !== undefined) o[last] = (o[last] || []).filter(x => x !== val.rm);
  else if (val && val.uni !== undefined) o[last] = [...new Set([...(o[last] || []), ...val.uni])];
  else o[last] = val;
}
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
class Doc {
  constructor(p){ this.path = p; this.id = p.split('/').pop(); this.ref = this; }
  async get(){ const d = store.get(this.path); return { exists: d !== undefined, id: this.id, ref: this, data: () => clone(d) }; }
  async set(d, opt){
    /* [20261116m] mergeFields: alleen die velden, elk in zijn geheel vervangen */
    if (opt && opt.mergeFields){ const o = store.get(this.path) || {}; for (const k of opt.mergeFields){ if (d[k] === SENT.del || d[k] === undefined) delete o[k]; else o[k] = clone(d[k]); } store.set(this.path, o); return; }
    if (opt && opt.merge && store.has(this.path)){
      const voeg = (o, bron) => { for (const [k, v] of Object.entries(bron)){
        if (v === SENT.del) delete o[k];
        else if (v && (v.inc !== undefined || v.rm !== undefined || v.uni !== undefined)) setPath(o, k, v);
        else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Ts)){ if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; voeg(o[k], v); }
        else o[k] = clone(v); } };
      voeg(store.get(this.path), d); return;
    }
    const c = {}; const schoon = (doel, bron) => { for (const [k, v] of Object.entries(bron)){
      if (v === SENT.del) continue;
      if (v && (v.inc !== undefined || v.rm !== undefined || v.uni !== undefined)) setPath(doel, k, v);
      else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Ts)){ doel[k] = {}; schoon(doel[k], v); }
      else doel[k] = clone(v); } };
    schoon(c, d); store.set(this.path, c);
  }
  collection(naam){ return new Query(`${this.path}/${naam}`); }
  async update(u){ const d = store.get(this.path); if (!d) throw new Error('NOT_FOUND ' + this.path); for (const [k, v] of Object.entries(u)) setPath(d, k, v); }
  async delete(){ store.delete(this.path); }
}
class Query {
  constructor(col, f = [], lim = 1e9){ this.col = col; this.f = f; this.lim = lim; }
  where(p, op, v){ const q = new Query(this.col, [...this.f, [p, op, v]], this.lim); q.o = this.o; return q; }
  limit(n){ const q = new Query(this.col, this.f, n); q.o = this.o; return q; }
  orderBy(p, richting){ const q = new Query(this.col, this.f, this.lim); q.o = [p, richting === 'desc' ? -1 : 1]; return q; }
  async get(){
    const docs = [];
    for (const [p, d] of store){
      if (p.startsWith(this.col + '/') && p.split('/').length === this.col.split('/').length + 1){
        if (this.f.every(([k, op, v]) => { const x = getPath(d, k);
          return op === '==' ? x === v : op === 'array-contains' ? (x || []).includes(v)
            : op === '>=' ? x != null && x >= v : op === '>' ? x != null && x > v : op === '<' ? x != null && x < v : op === '<=' ? x != null && x <= v : false; }))
          docs.push({ id: p.split('/').pop(), ref: new Doc(p), data: () => clone(d) });
      }
    }
    if (this.o) docs.sort((a, b) => { const x = getPath(a.data(), this.o[0]), y = getPath(b.data(), this.o[0]); return (x > y ? 1 : x < y ? -1 : 0) * this.o[1]; });
    const l = docs.slice(0, this.lim);
    return { docs: l, empty: !l.length, size: l.length };
  }
  doc(id){ return new Doc(`${this.col}/${id || 'a' + Math.random().toString(36).slice(2, 10)}`); }
  async add(d){ const id = 'a' + Math.random().toString(36).slice(2, 10); store.set(`${this.col}/${id}`, clone(d)); return new Doc(`${this.col}/${id}`); }
}
const db = {
  doc: p => new Doc(p), collection: c => new Query(c),
  getAll: async (...refs) => Promise.all(refs.map(r => r.get())),
  recursiveDelete: async (ref) => { const pad = ref.path || ref.col; for (const p of [...store.keys()]) if (p === pad || p.startsWith(pad + '/')) store.delete(p); },
  /* writes worden pas na afloop uitgevoerd (zoals echt): faalt fn, dan verandert er niets */
  runTransaction: async fn => {
    const w = [];
    const r = await fn({ get: x => x.get(), set: (x, d, o) => w.push(() => x.set(d, o)), update: (x, u) => w.push(() => x.update(u)), delete: x => w.push(() => x.delete()) });
    for (const f of w) await f();
    return r;
  },
  batch: () => ({ ops: [], delete(r){ this.ops.push(() => r.delete()); }, set(r, d, o){ this.ops.push(() => r.set(d, o)); },
    update(r, u){ this.ops.push(() => r.update(u)); }, async commit(){ for (const f of this.ops) await f(); } }),
};
module.exports = { store, db, FieldValue, Timestamp: { fromMillis: ms => new Ts(ms), now: () => new Ts(Date.now()), fromDate: d => new Ts(d.getTime()) }, Ts };
