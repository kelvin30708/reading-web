// Persistence: small JSON state in localStorage, PDF files in IndexedDB.
// Several tabs can be open at once (P1): every highlight and card carries `mt` (modified time),
// deletions leave tombstones in `deleted`, and save() merges what is on disk before writing.
const KEY = 'readingweb:v1';
const DAY = 86400000;
const blank = () => ({ highlights: {}, cards: [], uploads: [], deleted: {}, settings: { theme: null, fs: 19, pdfZoom: 1 }, pos: {} });
const mtOf = o => o.mt || o.created || 0;

// Merge `inc` (another tab's copy or a backup) into `cur` IN PLACE, so objects the UI holds stay live.
// Per item by id: newer `mt` wins; an item deleted after its last change stays deleted.
export function mergeInto(cur, inc) {
  inc = Object.assign(blank(), inc);
  const del = cur.deleted ||= {};
  for (const [id, t] of Object.entries(inc.deleted || {})) del[id] = Math.max(del[id] || 0, t);
  const gone = o => del[o.id] != null && del[o.id] >= mtOf(o);
  const mergeList = (a, b) => {
    const byId = new Map(a.map(o => [o.id, o]));
    for (const o of b || []) {
      const mine = byId.get(o.id);
      if (!mine) { if (!gone(o)) { const c = structuredClone(o); a.push(c); byId.set(o.id, c); } }
      else if (mtOf(o) > mtOf(mine)) { for (const k of Object.keys(mine)) if (!(k in o)) delete mine[k]; Object.assign(mine, structuredClone(o)); }
    }
    for (let i = a.length - 1; i >= 0; i--) if (gone(a[i])) a.splice(i, 1);
    return a;
  };
  for (const doc of new Set([...Object.keys(cur.highlights), ...Object.keys(inc.highlights || {})]))
    mergeList(cur.highlights[doc] ||= [], inc.highlights?.[doc]);
  mergeList(cur.cards, inc.cards);
  // uploads: union by id (a removed upload leaves a tombstone too); the Peak record if we lack one
  for (const u of inc.uploads || []) if (!cur.uploads.some(x => x.id === u.id) && !(del[u.id] >= (u.added || 0))) cur.uploads.push(structuredClone(u));
  cur.uploads = cur.uploads.filter(u => !(del[u.id] >= (u.added || 0)));
  if (!cur.peakFile && inc.peakFile && !(del.peak >= (inc.peakFile.added || 0))) cur.peakFile = structuredClone(inc.peakFile);
  // settings and reading positions stay per tab, except facts that only ever move forward
  const s = cur.settings, r = inc.settings || {};
  for (const k of ['lastBackup', 'askedPersist', 'seenVHint', 'remindDay']) if (r[k] && !(s[k] >= r[k])) s[k] = r[k];
  // tombstones older than 30 days are no longer needed
  const cutoff = Date.now() - 30 * DAY;
  for (const [id, t] of Object.entries(del)) if (t < cutoff) delete del[id];
  return cur;
}

export const store = {
  data: blank(),
  raw: null,           // the string we last read or wrote, to notice other tabs' writes
  onError: null,       // (err) => void, set by the app (quota toast, P2)
  load() {
    try { this.raw = localStorage.getItem(KEY); this.data = Object.assign(blank(), JSON.parse(this.raw || '{}')); }
    catch (e) { console.warn('bad state', e); this.data = blank(); }
    this.data.deleted ||= {};
    migrate(this.data);
    return this.data;
  },
  // pull other tabs' changes into memory (used by save() and by the storage event)
  sync() {
    let raw; try { raw = localStorage.getItem(KEY); } catch { return false; }
    if (!raw || raw === this.raw) return false;
    try { mergeInto(this.data, JSON.parse(raw)); } catch (e) { console.warn('merge failed', e); return false; }
    this.raw = raw; return true;
  },
  save() {
    this.sync();
    const s = JSON.stringify(this.data);
    try { localStorage.setItem(KEY, s); this.raw = s; this.failed = false; return true; }
    catch (e) { this.failed = true; if (this.onError) this.onError(e); else console.warn('save failed', e); return false; }
  },
  hls(docId) { return (this.data.highlights[docId] ||= []); },
  touch(o) { o.mt = Date.now(); delete this.data.deleted[o.id]; return o; },
  tomb(id) { this.data.deleted[id] = Date.now(); },
  // Replace is authoritative: everything not in `obj` gets a tombstone, so other open tabs drop it too
  replaceAll(obj) {
    const keep = new Set([...Object.values(obj.highlights || {}).flat(), ...(obj.cards || []), ...(obj.uploads || [])].map(o => o.id));
    const now = Date.now(), tombs = { ...(obj.deleted || {}) };
    for (const o of [...Object.values(this.data.highlights).flat(), ...this.data.cards, ...this.data.uploads]) if (!keep.has(o.id)) tombs[o.id] = now;
    this.data = Object.assign(blank(), obj, { deleted: tombs }); migrate(this.data);
    try { this.raw = localStorage.getItem(KEY); } catch {}
    this.save();
  }
};

// one-time data migrations (they never change highlight offsets)
function migrate(d) {
  const s = d.settings ||= {};
  if ((s.dataV || 0) < 3) {
    // P3: due dates snap to the start of their local calendar day
    for (const c of d.cards || []) if (c.due) c.due = startOfDayPlus(c.due, 0);
    // P15: 说 → 說 in the 金剛經 heading. Same UTF-16 length, so stored offsets stay valid; refresh quote text only.
    for (const h of d.highlights?.['diamond-zh'] || []) { if (h.quote) h.quote = h.quote.replace(/说/g, '說'); if (h.context) h.context = h.context.replace(/说/g, '說'); }
    for (const c of d.cards || []) if (c.docId === 'diamond-zh') { c.term = c.term.replace(/说/g, '說'); if (c.context) c.context = c.context.replace(/说/g, '說'); }
    s.dataV = 3;
  }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---- IndexedDB for PDF blobs ----
let dbp;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('readingweb-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pdfs');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('pdfs', mode); const st = t.objectStore('pdfs');
    const r = fn(st);
    t.oncomplete = () => res(r && r.result);
    t.onerror = () => rej(t.error);
  });
}
export const files = {
  put: (id, blob) => tx('readwrite', s => s.put(blob, id)),
  get: (id) => tx('readonly', s => s.get(id)),
  del: (id) => tx('readwrite', s => s.delete(id)),
};

// ---- Leitner spaced repetition, in local calendar days (P3) ----
export const BOX_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
// midnight (local) n days after `now`; setDate handles DST and month ends
export const startOfDayPlus = (now, n) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return +d; };
export const startOfNextDay = (now = Date.now()) => startOfDayPlus(now, 1);
export function grade(card, known, now = Date.now()) {
  if (known) card.box = Math.min(5, (card.box || 1) + 1);
  else card.box = 1;
  card.due = startOfDayPlus(now, known ? BOX_DAYS[card.box] : 1);
  card.reviews = (card.reviews || 0) + 1;
  card.last = now; card.mt = now;
  return card;
}
export const isDue = (c, now = Date.now()) => (c.due || 0) <= now;
