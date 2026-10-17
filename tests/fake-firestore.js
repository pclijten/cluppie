// minimale in-memory Firestore voor toegang.js-test
const store = new Map();               // pad -> data
const SENT = { del: Symbol('del') };
class Ts { constructor(ms){ this.ms = ms; } toMillis(){ return this.ms; } }
const FieldValue = { delete: () => SENT.del, serverTimestamp: () => new Ts(Date.now()), increment: n => ({ inc: n }), arrayRemove: v => ({ rm: v }) };
const clone = o => { if (o === undefined) return undefined; if (o instanceof Ts) return new Ts(o.ms); if (Array.isArray(o)) return o.map(clone); if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k,v]) => [k, clone(v)])); return o; };
function setPath(obj, path, val){
  const k = path.split('.'); let o = obj;
  for (let i = 0; i < k.length - 1; i++){ o[k[i]] = (o[k[i]] && typeof o[k[i]] === 'object') ? o[k[i]] : {}; o = o[k[i]]; }
  const last = k[k.length - 1];
  if (val === SENT.del) delete o[last];
  else if (val && val.inc !== undefined) o[last] = (o[last] || 0) + val.inc;
  else if (val && val.rm !== undefined) o[last] = (o[last] || []).filter(x => x !== val.rm);
  else o[last] = val;
}
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
class Doc {
  constructor(p){ this.path = p; this.id = p.split('/').pop(); this.ref = this; }
  async get(){ const d = store.get(this.path); return { exists: d !== undefined, id: this.id, ref: this, data: () => clone(d) }; }
  async set(d, opt){
    if (opt && opt.merge && store.has(this.path)){ const o = store.get(this.path); for (const [k, v] of Object.entries(d)){ if (v === SENT.del) delete o[k]; else o[k] = clone(v); } return; }
    const c = clone(d); for (const [k, v] of Object.entries(c)) if (v === SENT.del) delete c[k]; store.set(this.path, c);
  }
  async update(u){ const d = store.get(this.path); if (!d) throw new Error('NOT_FOUND ' + this.path); for (const [k, v] of Object.entries(u)) setPath(d, k, v); }
  async delete(){ store.delete(this.path); }
}
class Query {
  constructor(col, f = [], lim = 1e9){ this.col = col; this.f = f; this.lim = lim; }
  where(p, op, v){ return new Query(this.col, [...this.f, [p, op, v]], this.lim); }
  limit(n){ return new Query(this.col, this.f, n); }
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
    const l = docs.slice(0, this.lim);
    return { docs: l, empty: !l.length, size: l.length };
  }
  doc(id){ return new Doc(`${this.col}/${id || 'a' + Math.random().toString(36).slice(2, 10)}`); }
  async add(d){ const id = 'a' + Math.random().toString(36).slice(2, 10); store.set(`${this.col}/${id}`, clone(d)); return new Doc(`${this.col}/${id}`); }
}
const db = {
  doc: p => new Doc(p), collection: c => new Query(c),
  getAll: async (...refs) => Promise.all(refs.map(r => r.get())),
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
module.exports = { store, db, FieldValue, Timestamp: { fromMillis: ms => new Ts(ms) }, Ts };
