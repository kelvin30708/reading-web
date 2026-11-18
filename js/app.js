import { store, files, uid, grade, isDue, BOX_DAYS, startOfNextDay, startOfDayPlus, mergeInto } from './store.js';
import { rangeToParts, partsText, paint, containerText, sentenceAround, tidyCJK } from './anchor.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = { yellow: 'var(--sw-yellow)', green: 'var(--sw-green)', pink: 'var(--sw-pink)', blue: 'var(--sw-blue)' };
const COLOR_NAMES = { yellow: 'Yamabuki 山吹 (yellow)', green: 'Matcha 抹茶 (green)', pink: 'Sakura 櫻 (pink)', blue: 'Ai 藍 (blue)' };
const EMOJI = { yellow: '🟨 山吹', green: '🟩 抹茶', pink: '🌸 櫻', blue: '🟦 藍' };
const META = window.RW_META;
const view = $('#view');
let pdfjsLib = null;
let reader = null;

store.load();
window.RW = { store }; // handy for debugging / tests

// ---------- input modality (N5): focus moves for keyboard users only ----------
let lastInput = 'pointer', lastKey = null;
addEventListener('keydown', e => { lastInput = 'key'; lastKey = e; }, true);
addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);
const announce = msg => { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); };

// ---------- helpers ----------
function toast(msg, action, keep = false) {
  const t = $('#toast'); t.textContent = msg; toast.keep = keep;
  if (action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label; b.onclick = () => { t.classList.remove('show'); action.fn(); }; t.appendChild(b); }
  t.classList.toggle('has-action', !!action); t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2200);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function download(name, text, type = 'text/markdown') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function fmtSize(n) { return n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB'; }
const fmtDate = (t, o = { year: 'numeric', month: 'short', day: 'numeric' }) => new Date(t).toLocaleDateString(undefined, o);
// calendar days, not 24-hour blocks (P3)
function dayLabel(t) {
  const d = Math.round((startOfDayPlus(t, 0) - startOfDayPlus(Date.now(), 0)) / 86400000);
  if (d <= 0) return 'today 今天';
  if (d === 1) return 'tomorrow 明天';
  if (d < 7) return fmtDate(t, { weekday: 'short' });
  return fmtDate(t, { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtDue(c) {
  if (isDue(c)) return 'due now';
  const d = Math.round((startOfDayPlus(c.due, 0) - startOfDayPlus(Date.now(), 0)) / 86400000);
  if (d <= 0) return 'today 今天';
  if (d === 1) return 'tomorrow 明天';
  if (d < 7) return fmtDate(c.due, { weekday: 'short' });
  return `in ${d} days`;
}
const localDate = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ago = t => { const d = Math.round((startOfDayPlus(Date.now(), 0) - startOfDayPlus(t, 0)) / 86400000); return d <= 0 ? 'today 今天' : d === 1 ? 'yesterday 昨天' : `${d} days ago`; };
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
}
async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('../vendor/pdfjs/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjsLib;
}
function docInfo(id) {
  const m = META.find(d => d.id === id); if (m) return m;
  const u = store.data.uploads.find(d => d.id === id);
  if (u) return { id, kind: 'pdf', lang: 'en', title: u.name.replace(/\.pdf$/i, ''), short: u.name.replace(/\.pdf$/i, ''), subtitle: `Uploaded ${fmtDate(u.added)} · ${fmtSize(u.size)}`, userFile: true, group: 'user', file: u };
  return null;
}

// ---------- settings ----------
function applySettings() {
  const s = store.data.settings;
  const theme = s.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  $('meta[name=theme-color]').content = theme === 'dark' ? '#15171C' : '#F7F4EE';
  document.documentElement.style.setProperty('--fs', (s.fs || 19) + 'px');
  $('#fsVal').textContent = s.fs || 19;
  if (reader && reader.fitVertical) reader.fitVertical();
}
$('#themeBtn').onclick = () => { const cur = document.documentElement.dataset.theme; store.data.settings.theme = cur === 'dark' ? 'light' : 'dark'; store.save(); applySettings(); };
function changeSize(dir) {
  const s = store.data.settings;
  if (reader && reader.kind === 'pdf') {
    s.pdfZoom = Math.min(2.5, Math.max(0.5, +((s.pdfZoom || 1) + dir * 0.15).toFixed(2))); store.save();
    reader.relayout(); toast(`Zoom ${Math.round(s.pdfZoom * 100)}%`);
  } else {
    const keep = reader && reader.firstVisible ? reader.firstVisible() : null;
    const cap = reader && reader.vdoc && reader.vdoc() && reader.vMax;
    if (dir < 0 && cap && (s.fs || 19) > cap) s.fs = cap; // step down from what is actually shown
    if (dir > 0 && cap && (s.fs || 19) >= cap) { toast(`直排 size limited to ${cap}px · switch to 橫排 for larger text`); return; } // P10
    s.fs = Math.min(32, Math.max(14, (s.fs || 19) + dir)); store.save(); applySettings();
    toast(`Text size ${s.fs}px`);
    if (keep) requestAnimationFrame(() => reader && reader.restoreTo(keep));
  }
}
$('#fontUp').onclick = () => changeSize(1);
$('#fontDown').onclick = () => changeSize(-1);
// N1: on narrow phones A−/A+ live in a small "Aa" popover so the top bar fits 360px
{ const btn = $('#sizeBtn'), pop = $('#sizePop');
  const set = open => { pop.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.onclick = () => { const open = !pop.classList.contains('open'); set(open); if (open && lastInput === 'key') $('#fontUp').focus(); };
  document.addEventListener('pointerdown', e => { if (pop.classList.contains('open') && !pop.contains(e.target) && e.target !== btn) set(false); });
  pop.addEventListener('keydown', e => { if (e.key === 'Escape' && pop.classList.contains('open')) { e.stopPropagation(); set(false); btn.focus(); } });
  addEventListener('hashchange', () => set(false)); }
applySettings();

// ---------- data safety (P1, P2) ----------
// storage full / blocked: keep what is on screen in memory and say so clearly
store.onError = e => {
  const full = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
  toast(full ? 'Couldn’t save — browser storage is full 儲存空間已滿. Back up, then remove a PDF or old cards.' : 'Couldn’t save your change 無法儲存: ' + (e?.message || e),
    { label: 'Back up 備份', fn: backup }, true);
  console.warn('save failed', e);
};
// ask the browser to keep our data (not evict it) once there is something worth keeping
function askPersist() {
  const s = store.data.settings; if (s.askedPersist) return;
  s.askedPersist = Date.now(); store.save();
  navigator.storage?.persist?.().then(ok => { s.persisted = !!ok; store.save(); }).catch(() => {});
}
function backupData() { return { app: 'reading-web', version: 1, exportedAt: Date.now(), ...store.data }; }
function backup() {
  download(`reading-web-backup-${localDate()}.json`, JSON.stringify(backupData(), null, 1), 'application/json');
  store.data.settings.lastBackup = Date.now(); store.save();
  toast('Backup downloaded 已備份. PDFs aren’t included; their highlights are.', null, true);
  if (!reader && /^#\/(library)?$|^$/.test(location.hash)) renderLibrary();
}
const countItems = d => ({ hl: Object.values(d.highlights || {}).reduce((n, a) => n + a.length, 0), cards: (d.cards || []).length });
// "Your data" row: last backup, counts, and a gentle reminder (P2)
function dataRow(small = false) {
  const s = store.data.settings, { hl, cards } = countItems(store.data);
  const since = s.lastBackup || 0;
  const changed = Object.values(store.data.highlights).flat().concat(store.data.cards).filter(o => (o.mt || o.created || 0) > since).length;
  const stale = !since || Date.now() - since > 14 * 86400000;
  const today = localDate();
  const remind = !small && stale && changed >= 20 && (!s.remindDay || s.remindDay === today);
  if (remind && s.remindDay !== today) { s.remindDay = today; store.save(); }
  const last = since ? `Last backup 上次備份: ${ago(since)}` : 'Not backed up yet 尚未備份';
  const msg = remind ? `備份提醒 · ${since ? `It’s been ${Math.round((Date.now() - since) / 86400000)} days since your last backup` : `${changed} changes aren’t backed up yet`}` : last;
  return `<section class="datarow${small ? ' small' : ''}${remind ? ' remind' : ''}" aria-label="Your data">
    <span class="dr-label">資料 Your data</span><span class="dr-msg">${esc(msg)}</span><span class="hint dr-count">${hl} highlight${hl === 1 ? '' : 's'} · ${cards} card${cards === 1 ? '' : 's'}</span>
    <span class="grow"></span><span class="dr-btns"><button class="btn small" data-backup>Back up 備份</button><button class="btn small ghost" data-restore>Restore 還原</button></span></section>`;
}
function wireDataRow(root) {
  $$('[data-backup]', root).forEach(b => b.onclick = backup);
  $$('[data-restore]', root).forEach(b => b.onclick = () => { $('#importInput').value = ''; $('#importInput').click(); });
}
// another tab saved: merge and refresh what is on screen (P1)
addEventListener('storage', e => {
  if (e.key !== 'readingweb:v1' || !store.sync()) return;
  updateBadge();
  const busy = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (reader) {
    reader.repaint();
    if (busy && $('#panel')?.contains(document.activeElement)) refreshView.pending = true; else renderPanel();
  } else if (location.hash.startsWith('#/cards')) { if (!busy && !dlg.open) renderCards(); }
  else if (!location.hash.startsWith('#/review')) renderLibrary();
});
function refreshView() { if (reader && refreshView.pending) { refreshView.pending = false; renderPanel(); } }
document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement || !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) refreshView(); }, 0));
// offline + install (P5)
if ('serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e)));

function updateBadge() {
  const n = store.data.cards.filter(c => isDue(c)).length; const b = $('#dueBadge');
  b.hidden = !n; b.textContent = n;
}

// ---------- router ----------
function route() {
  const h = location.hash || '#/library';
  if (reader) { reader.destroy(); reader = null; }
  hideBar();
  if (toast.keep) toast.keep = false; else { $('#toast').classList.remove('show'); clearTimeout(toast.t); } // P9
  const [, name, arg] = h.split('/');
  $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === (name === 'review' ? 'cards' : name)));
  window.scrollTo(0, 0);
  if (name === 'read' && arg) openReader(decodeURIComponent(arg));
  else if (name === 'cards') renderCards();
  else if (name === 'review') renderReview(arg ? decodeURIComponent(arg) : null);
  else renderLibrary();
  updateBadge();
  $('[data-skip=notes]').hidden = name !== 'read';
  if (name !== 'read') { document.title = (name === 'cards' ? 'Flashcards 單字卡' : name === 'review' ? 'Review 複習' : 'Library 書房') + ' · Reading Web'; focusHeading(); }
}
addEventListener('hashchange', route);
// after a view change, keyboard users land on the page heading (N5c)
function focusHeading() {
  if (lastInput !== 'key' || !route.ran) { route.ran = true; return; }
  requestAnimationFrame(() => { const h = $('#view [data-heading]'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } });
}
// skip links (N5a): they are handled in JS because the URL hash is the router
$$('.skip').forEach(a => a.onclick = e => {
  e.preventDefault();
  if (a.dataset.skip === 'notes' && reader) { reader.openPanel(); setTimeout(() => ($('#hlSearch') || $('#panel')).focus(), 50); return; }
  const t = (reader && $('mark.hl[tabindex="0"]', reader.root)) || $('#view .doc') || $('#view [data-heading]') || view;
  if (!t.hasAttribute('tabindex')) t.tabIndex = -1;
  t.focus();
});

// ---------- library ----------
function statsFor(id) {
  const h = (store.data.highlights[id] || []).length, c = store.data.cards.filter(x => x.docId === id).length;
  return `${h} highlight${h === 1 ? '' : 's'} · ${c} card${c === 1 ? '' : 's'}`;
}
function renderLibrary() {
  const peak = store.data.peakFile;
  const pct = id => Math.round((store.data.pos[id] || 0) * 100);
  const readLabel = (id, base) => pct(id) > 1 ? `Continue · ${pct(id)}%` : base;
  const progLine = id => pct(id) > 1 ? `<span class="prog" style="width:${pct(id)}%" aria-hidden="true"></span>` : '';
  const last = store.data.settings.lastDoc && docInfo(store.data.settings.lastDoc);
  const cards = META.map(m => {
    const isPeak = m.id === 'peak';
    const actions = isPeak
      ? (peak ? `<a class="btn primary" href="#/read/peak">${readLabel('peak', 'Open')}</a><button class="btn ghost small" data-upload="peak">Replace PDF</button>` :
        `<button class="btn primary" data-upload="peak">Upload your copy (PDF)</button>`)
      : `<a class="btn primary" href="#/read/${m.id}">${readLabel(m.id, 'Read')}</a>`;
    return `<article class="card cover-${m.group}">
      <span class="tag">${m.lang.startsWith('zh') ? '中文 Chinese' : 'English'}${isPeak ? ' · your file' : ' · built-in'}</span>
      <h2>${esc(m.short)}</h2>
      <p>${esc(isPeak && peak ? `${peak.name} · ${fmtSize(peak.size)}` : m.subtitle)}</p>
      <div class="actions">${actions}<span class="stats">${(isPeak && !peak) ? '' : statsFor(m.id)}</span></div>${progLine(m.id)}
    </article>`;
  }).join('');
  const ups = store.data.uploads.map(u => `<article class="card cover-user">
      <span class="tag">Your PDF</span><h2>${esc(u.name.replace(/\.pdf$/i, ''))}</h2>
      <p>${fmtSize(u.size)} · added ${fmtDate(u.added)}</p>
      <div class="actions"><a class="btn primary" href="#/read/${u.id}">${readLabel(u.id, 'Open')}</a><button class="btn ghost small danger" data-del="${u.id}">Remove</button><span class="stats">${statsFor(u.id)}</span></div>${progLine(u.id)}
    </article>`).join('');
  view.innerHTML = `<div class="wrap">
    <section class="hero"><h1 data-heading>Your reading room <span lang="zh-Hant">書房</span></h1>
      <p>Pick a text or upload a PDF. Select any passage to highlight it in four colors, attach notes, or turn words into flashcards 單字卡. Everything is saved in this browser only.</p></section>
    ${last ? `<a class="resume" href="#/read/${encodeURIComponent(last.id)}"><span class="hint">繼續閱讀 · Continue</span><b>${esc(last.short)}</b>${pct(last.id) > 0 ? `<span class="hint">${pct(last.id)}%</span>` : ''}</a>` : ''}
    ${dataRow()}
    <div class="grid">${cards}
      <article class="card cover-upload" id="uploadCard" tabindex="0" role="button" aria-label="Upload your own PDF">
        <span class="tag">Upload</span><h2>＋ Upload your own PDF</h2><p>Click or drop a PDF here. It is stored locally (IndexedDB) and opens in the reader with highlights and notes.</p>
      </article>
    </div>
    ${ups ? `<h3 class="section">Your PDFs</h3><div class="grid">${ups}</div>` : ''}
    <div class="about">
      <h3 class="section">Texts &amp; licenses</h3>
      <ul>${META.filter(m => !m.userFile).map(m => `<li><b>${esc(m.short)}</b> — ${esc(m.subtitle)}. Source: ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.source)}</a>` : esc(m.source)}. ${esc(m.license)}</li>`).join('')}
      <li><b>刻意練習 Peak</b> is copyrighted, so it isn't included. Upload a copy you own.</li></ul>
      <p class="hint">Backups (資料 Your data, above) hold your highlights, notes, cards and settings. Uploaded PDF files stay in this browser only; after restoring on another device, re-attach each PDF and its highlights reappear.</p>
    </div></div>`;
  $$('[data-upload]', view).forEach(b => b.onclick = () => pickFile(b.dataset.upload));
  $$('[data-del]', view).forEach(b => b.onclick = async () => {
    const id = b.dataset.del; if (!confirm('Remove this PDF and its highlights from this browser?')) return;
    store.data.uploads = store.data.uploads.filter(u => u.id !== id); store.tomb(id);
    for (const h of store.data.highlights[id] || []) store.tomb(h.id);
    delete store.data.highlights[id]; store.save();
    await files.del(id); renderLibrary();
  });
  const up = $('#uploadCard');
  up.onclick = () => pickFile('new');
  up.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFile('new'); } };
  up.ondragover = e => { e.preventDefault(); up.classList.add('drag'); };
  up.ondragleave = () => up.classList.remove('drag');
  up.ondrop = e => { e.preventDefault(); up.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) saveUpload(f, 'new'); };
  wireDataRow(view);
}
let uploadTarget = 'new';
function pickFile(target) { uploadTarget = target; $('#fileInput').value = ''; $('#fileInput').click(); }
$('#fileInput').onchange = e => { const f = e.target.files[0]; if (f) saveUpload(f, uploadTarget); };
$('#importInput').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  let obj; try { obj = JSON.parse(await f.text()); if (!obj.highlights || !obj.cards) throw 0; } catch { toast('That file is not a Reading Web backup'); return; }
  openRestore(obj);
};
// restore: merge by default, replace only on purpose (P4)
function openRestore(obj) {
  const d = $('#restoreDlg'), a = countItems(obj), b = countItems(store.data);
  const when = obj.exportedAt ? fmtDate(obj.exportedAt) + ' ' + new Date(obj.exportedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'an unknown date (older backup)';
  const pdfs = (obj.uploads || []).length + (obj.peakFile ? 1 : 0);
  $('#restoreInfo').innerHTML = `<p><b>Backup</b> from ${esc(when)} · ${a.cards} card${a.cards === 1 ? '' : 's'} · ${a.hl} highlight${a.hl === 1 ? '' : 's'}</p>
    <p><b>This browser</b> · ${b.cards} card${b.cards === 1 ? '' : 's'} · ${b.hl} highlight${b.hl === 1 ? '' : 's'}</p>
    <p class="hint">合併 Merge keeps everything from both, and the newer version of anything edited in both. 取代 Replace makes this browser match the backup exactly; a copy of the current data is downloaded first.${pdfs ? ` PDF files aren’t inside backups: ${pdfs} PDF record${pdfs === 1 ? '' : 's'} and their highlights come back, and you re-attach each file once.` : ''}</p>`;
  d.returnValue = ''; d.showModal();
  d.onclose = () => {
    if (d.returnValue === 'merge') { mergeInto(store.data, obj); store.save(); toast('Backup merged 已合併', null, true); route(); }
    else if (d.returnValue === 'replace') {
      download(`reading-web-before-restore-${localDate()}.json`, JSON.stringify(backupData(), null, 1), 'application/json');
      const keep = store.data.settings; const { app, version, exportedAt, ...rest } = obj;
      store.replaceAll(rest); store.data.settings = { ...store.data.settings, lastBackup: keep.lastBackup, askedPersist: keep.askedPersist }; store.save();
      applySettings(); toast('Backup restored 已還原 · previous data downloaded first', null, true); route();
    }
  };
}
$('#restoreMerge').onclick = () => $('#restoreDlg').close('merge');
$('#restoreReplace').onclick = () => $('#restoreDlg').close('replace');
$('#restoreCancel').onclick = () => $('#restoreDlg').close('cancel');
export async function saveUpload(file, target) {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { toast('Please choose a PDF file'); return; }
  const existing = target !== 'new' && target !== 'peak' && store.data.uploads.find(u => u.id === target);
  const id = target === 'peak' ? 'peak' : existing ? existing.id : 'up-' + uid();
  const old = id === 'peak' ? store.data.peakFile : existing;
  try { await files.put(id, file); } catch (e) { toast('Couldn’t store the PDF — browser storage is full 儲存空間已滿', { label: 'Back up 備份', fn: backup }, true); return; }
  let msg = 'PDF saved in this browser';
  const n = store.hls(id).length;
  if (old && old.size && old.size !== file.size && n) msg = `Re-attached, but the size differs from the original (${fmtSize(old.size)}) — check that the highlights line up`;
  else if (old && n) msg = `Re-attached · ${n} highlight${n === 1 ? '' : 's'} restored`;
  const meta = { id, name: file.name, size: file.size, added: old?.added || Date.now() };
  if (id === 'peak') store.data.peakFile = meta; else if (existing) Object.assign(existing, meta); else store.data.uploads.push(meta);
  store.save(); toast(msg, null, true);
  if (location.hash === '#/read/' + id) route(); else location.hash = '#/read/' + id; // re-attach from the open reader
}

// ---------- reader ----------
async function openReader(id) {
  const info = docInfo(id);
  if (!info) { view.innerHTML = `<div class="wrap"><p>Document not found. <a href="#/library">Back to library</a></p></div>`; return; }
  // phones always start with the notes sheet closed; desktop remembers the user's choice
  const closed = innerWidth < 860 ? true : (store.data.settings.panelClosed ?? false);
  store.data.settings.lastDoc = id; store.save();
  const zh = info.kind === 'text' && info.lang.startsWith('zh');
  const L = zh ? { notes: '筆記 Notes', exp: '匯出 Export', rev: '複習 Review', ph: '寫下筆記… Add a note', head: '筆記 · Highlights & notes', filter: '篩選 Filter' }
               : { notes: 'Notes 筆記', exp: 'Export .md', rev: 'Review 複習', ph: 'Add a note… 寫下筆記', head: 'Highlights & notes · 筆記', filter: 'Filter' };
  document.title = `${info.short} · Reading Web`;
  view.innerHTML = `<div class="reader ${closed ? 'panel-closed' : ''}" data-lang="${info.kind === 'text' ? info.lang : ''}"${zh ? ' lang="zh-Hant"' : ''}>
    <div class="reader-main">
      <div class="rbar"><a class="btn small ghost" href="#/library" aria-label="Back to library">←</a>
        <h1 class="title" data-heading>${esc(info.short)}</h1>
        <div class="seg only-zh" id="vertSeg" role="group" aria-label="Text direction 排版方向"><button type="button" data-v="1" aria-pressed="true" title="直排 Vertical" aria-label="直排 Vertical">直</button><button type="button" data-v="0" aria-pressed="false" title="橫排 Horizontal" aria-label="橫排 Horizontal">橫</button></div>
        <div class="land-tools only-land"><button class="btn small ghost" id="landAa" aria-label="Text size and theme" aria-expanded="false">Aa</button>
          <div class="land-pop" id="landPop" role="group" aria-label="Text size and theme"><button class="icon-btn" data-size="-1" aria-label="Smaller text">A−</button><button class="icon-btn" data-size="1" aria-label="Larger text">A+</button><button class="icon-btn" data-theme aria-label="Toggle dark mode">◐</button></div></div>
        <button class="btn small" id="panelBtn" aria-controls="panel" aria-expanded="${!closed}">${L.notes} <span id="hlCount"></span></button>
        <div class="progress" id="prog"></div></div>
      <div id="docRoot"></div>
    </div>
    <aside class="panel" id="panel" aria-label="Highlights and notes" tabindex="-1">
      <div class="panel-head" id="panelHead"><h4>${esc(L.head)}</h4>
        <button class="btn small" id="exportBtn" title="Download notes as Markdown (.md)">${L.exp}</button>
        <a class="btn small ghost" href="#/review/${encodeURIComponent(id)}" title="Review flashcards from this text">${L.rev}</a>
        <button class="btn small ghost only-mobile" id="panelClose" aria-label="Close notes">✕</button></div>
      <div class="psearch"><input type="search" class="field" id="hlSearch" placeholder="${zh ? '搜尋 Search highlights & notes' : 'Search highlights & notes 搜尋'}" aria-label="Search highlights and notes"></div>
      <div class="filters" id="filters"><span class="hint flabel">${L.filter}</span>${Object.keys(COLORS).map(c => `<button class="sw sw-${c}" data-f="${c}" title="Show/hide ${COLOR_NAMES[c]}" aria-label="Show or hide ${COLOR_NAMES[c]}" aria-pressed="true"><span class="n">0</span></button>`).join('')}<button class="chip" id="noteChip" aria-pressed="false" title="Only highlights with a note">筆記 With notes</button></div>
      <div class="hl-list" id="hlList"></div>
    </aside>
    <div class="sheet-scrim" id="sheetScrim" aria-hidden="true"></div></div>`;
  const R = { id, info, kind: info.kind, root: $('#docRoot'), hidden: new Set(), cleanup: [], L };
  reader = R;
  R.destroy = () => { R.dead = true; R.cleanup.forEach(f => f()); $$('#fontUp').forEach(b => { b.removeAttribute('aria-disabled'); b.title = 'Larger text'; }); };
  R.hls = () => store.hls(id);
  R.containers = () => $$('[data-anchor]', R.root);
  R.paint = c => { paint(c, R.hls()); decorateCards(c, R); rove(R); };
  R.repaint = (keys) => { for (const c of R.containers()) if (!keys || keys.includes(c.dataset.anchor)) R.paint(c); };
  const toggle = (open) => {
    const el = $('.reader'); if (!el) return;
    const isClosed = open === undefined ? !el.classList.contains('panel-closed') : !open;
    el.classList.toggle('panel-closed', isClosed);
    $('#panelBtn').setAttribute('aria-expanded', String(!isClosed));
    if (!isClosed) $('.vcoach button')?.click();
    if (innerWidth >= 860) { store.data.settings.panelClosed = isClosed; store.save(); } // the phone sheet is transient
    if (R.kind === 'pdf' && innerWidth >= 860) setTimeout(() => R.relayout(), 260);
  };
  R.openPanel = () => toggle(true);
  R.closePanel = () => toggle(false);
  R.sheetOpen = () => innerWidth < 860 && !$('.reader')?.classList.contains('panel-closed');
  $('#sheetScrim').onclick = () => toggle(false);
  // drag the sheet's grab area down to close it
  { const head = $('#panelHead'); let y0 = null;
    head.addEventListener('pointerdown', e => { if (innerWidth < 860 && !e.target.closest('button,a')) { y0 = e.clientY; head.setPointerCapture?.(e.pointerId); } });
    head.addEventListener('pointermove', e => { if (y0 != null && e.clientY - y0 > 80) { y0 = null; toggle(false); } });
    head.addEventListener('pointerup', () => { y0 = null; }); head.addEventListener('pointercancel', () => { y0 = null; }); }
  // first visible text block, used to keep the reading place across layout changes (直/橫, text size)
  R.firstVisible = () => {
    const doc = $('.doc', R.root); if (!doc) return null;
    const v = doc.classList.contains('vertical'), vr = doc.getBoundingClientRect();
    return $$('[data-anchor]', doc).find(b => { const r = b.getBoundingClientRect(); return v ? (r.left < vr.right - 8 && r.right > vr.left) : (r.bottom > 130 && r.top < innerHeight); }) || null;
  };
  R.restoreTo = el => {
    if (!el || !el.isConnected) return;
    const doc = $('.doc', R.root);
    if (doc && doc.classList.contains('vertical')) { scrollTo(0, 0); el.scrollIntoView({ block: 'start', inline: 'nearest' }); scrollTo(0, 0); }
    else { el.scrollIntoView({ block: 'start' }); scrollBy(0, -130); }
  };
  { const aa = $('#landAa'), pop = $('#landPop');
    aa.onclick = () => { const o = pop.classList.toggle('open'); aa.setAttribute('aria-expanded', String(o)); };
    $$('[data-size]', pop).forEach(b => b.onclick = () => changeSize(+b.dataset.size));
    $('[data-theme]', pop).onclick = () => $('#themeBtn').click();
    const off = e => { if (pop.classList.contains('open') && !e.target.closest('.land-tools')) { pop.classList.remove('open'); aa.setAttribute('aria-expanded', 'false'); } };
    document.addEventListener('pointerdown', off); R.cleanup.push(() => document.removeEventListener('pointerdown', off)); }
  $('#panelBtn').onclick = () => toggle();
  $('#panelClose').onclick = () => toggle(false);
  $('#exportBtn').onclick = () => exportMarkdown(R);
  R.q = ''; R.onlyNotes = false;
  $('#hlSearch').oninput = debounce(e => { R.q = e.target.value.trim().toLowerCase(); renderPanel(); }, 150);
  $('#noteChip').onclick = e => { R.onlyNotes = !R.onlyNotes; e.currentTarget.setAttribute('aria-pressed', String(R.onlyNotes)); renderPanel(); };
  $$('#filters [data-f]').forEach(b => b.onclick = () => { const c = b.dataset.f; R.hidden.has(c) ? R.hidden.delete(c) : R.hidden.add(c); b.classList.toggle('off'); b.setAttribute('aria-pressed', String(!R.hidden.has(c))); renderPanel(); });
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight; const p = max > 0 ? scrollY / max : 0;
    $('#prog').style.width = (p * 100).toFixed(1) + '%';
    savePos(p);
  };
  const savePos = debounce(p => { if (!R.dead) { store.data.pos[id] = p; store.save(); } }, 400);
  addEventListener('scroll', onScroll, { passive: true }); R.cleanup.push(() => removeEventListener('scroll', onScroll));

  try {
    if (info.kind === 'text') await renderTextDoc(R); else await renderPdfDoc(R);
  } catch (e) { console.error(e); R.root.innerHTML = `<div class="pdf-empty"><p>Could not open this document: ${esc(e.message)}</p></div>`; }
  if (R.dead) return;
  renderPanel();
  focusHeading();
  const p = store.data.pos[id];
  requestAnimationFrame(() => {
    if (R.dead) return;
    const d = R.vdoc && R.vdoc();
    if (p && R.kind === 'text') {
      if (d) d.scrollLeft = -p * (d.scrollWidth - d.clientWidth);
      else scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight));
    }
    if (d) { R.edge(); showVCoach(R); } // after the restore, so restoring isn't mistaken for the first scroll
  });
}

async function renderTextDoc(R) {
  if (!window.RW_TEXTS?.[R.id]) await loadScript(`texts/${R.id}.js`);
  const blocks = window.RW_TEXTS[R.id];
  const m = R.info;
  R.root.innerHTML = `<article class="doc" lang="${m.lang}">
    <h1>${esc(m.title)}</h1><div class="sub">${esc(m.subtitle)}</div>
    ${blocks.map((b, i) => b[0] === 'h' ? `<h3 data-anchor="b${i}">${esc(b[1])}</h3>` : `<p data-anchor="b${i}" class="${b[0] === 'v' ? 'verse' : ''}">${esc(b[1])}</p>`).join('')}
    <div class="colophon">Source: ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.source)}</a>` : esc(m.source)}<br>License: ${esc(m.license)}</div>
  </article>`;
  R.repaint();
  if (m.lang.startsWith('zh')) setupVertical(R);
}

// Optional vertical writing (直排) for Chinese sutras. Highlights are DOM-based, so they keep working.
function setupVertical(R) {
  const doc = $('.doc', R.root), seg = $('#vertSeg');
  R.vdoc = () => (doc.classList.contains('vertical') ? doc : null);
  // N14: in 直排 a column should hold at least 10 characters; cap the size for this layout only
  R.fitVertical = () => {
    doc.style.fontSize = ''; R.vCap = null; R.vMax = null;
    if (R.vdoc()) {
      const cs = getComputedStyle(doc), h = doc.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      R.vMax = Math.max(14, Math.floor(h / (10 * 1.12)));
      if ((store.data.settings.fs || 19) > R.vMax) { doc.style.fontSize = R.vMax + 'px'; R.vCap = R.vMax; }
    }
    const at = !!R.vMax && (store.data.settings.fs || 19) >= R.vMax;
    $$('#fontUp, #landPop [data-size="1"]').forEach(b => { b.setAttribute('aria-disabled', String(at)); b.title = at ? '直排 size limit reached · switch to 橫排 for larger text' : 'Larger text'; });
  };
  const onRs = debounce(() => { if (!R.dead) R.fitVertical(); }, 200);
  addEventListener('resize', onRs); R.cleanup.push(() => removeEventListener('resize', onRs));
  // N8: the edge fade goes away at the end of the text
  R.edge = () => doc.classList.toggle('at-end', !!R.vdoc() && Math.abs(doc.scrollLeft) >= doc.scrollWidth - doc.clientWidth - 4);
  const apply = (on, keep = true) => {
    const anchor = keep ? R.firstVisible() : null;
    doc.classList.toggle('vertical', on);
    R.fitVertical();
    $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String((b.dataset.v === '1') === on)));
    hideBar();
    if (!keep) return;
    requestAnimationFrame(() => {
      if (anchor) R.restoreTo(anchor); else { scrollTo(0, 0); doc.scrollLeft = 0; }
      R.edge();
      if (on) showVCoach(R);
    });
  };
  // Chinese sutras open in 直排 by default; an explicit choice is remembered per text in settings.verticalByDoc.
  const prefs = (store.data.settings.verticalByDoc ||= {});
  const isOn = () => prefs[R.id] ?? true;
  apply(isOn(), false);
  $$('button', seg).forEach(b => b.onclick = () => {
    const on = b.dataset.v === '1'; if (on === isOn()) return;
    prefs[R.id] = on; store.save(); apply(on); toast(on ? '直排 vertical · 向左閱讀 read right → left' : '橫排 horizontal text');
  });
  // touch: a vertical swipe moves through the columns (finger up = read on)
  let t0 = null;
  doc.addEventListener('touchstart', e => { t0 = R.vdoc() && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  doc.addEventListener('touchmove', e => {
    if (!t0 || !R.vdoc() || !getSelection().isCollapsed) return;
    const x = e.touches[0].clientX, y = e.touches[0].clientY, dx = x - t0.x, dy = y - t0.y;
    if (Math.abs(dy) > Math.abs(dx)) { e.preventDefault(); doc.scrollLeft += dy; }
    t0 = { x, y };
  }, { passive: false });
  // mouse wheel scrolls the vertical page sideways (right → left)
  doc.addEventListener('wheel', e => {
    if (!R.vdoc() || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault(); doc.scrollLeft -= e.deltaY;
  }, { passive: false });
  const save = debounce(p => { if (!R.dead) { store.data.pos[R.id] = p; store.save(); } }, 400);
  doc.addEventListener('scroll', () => {
    if (!R.vdoc()) return;
    const max = doc.scrollWidth - doc.clientWidth; const p = max > 0 ? Math.min(1, Math.abs(doc.scrollLeft) / max) : 0;
    $('#prog').style.width = (p * 100).toFixed(1) + '%'; save(p); R.edge();
    if (!bar.hidden) { if (pending) { const sel = getSelection(); if (sel.rangeCount && !sel.isCollapsed) placeBar(sel.getRangeAt(0).getBoundingClientRect()); } else hideBar(); }
  }, { passive: true });
}

// one-time cue for reading vertical text (H4)
function showVCoach(R) {
  const st = store.data.settings; if (st.seenVHint || $('.vcoach')) return;
  const doc = R.vdoc && R.vdoc(); if (!doc) return;
  const el = document.createElement('div'); el.className = 'vcoach'; el.setAttribute('role', 'status');
  const fine = matchMedia('(pointer:fine)').matches;
  el.innerHTML = fine ? `<span><b class="vc-arrow" aria-hidden="true">⇣</b> 滾動滑鼠繼續閱讀<br><small>Scroll to read on · right → left</small></span><button type="button" class="btn small ghost" aria-label="Dismiss">OK</button>`
    : `<span><b class="vc-arrow" aria-hidden="true">↑</b> 上滑繼續閱讀<br><small>Swipe up to read on · 由右往左</small></span><button type="button" class="btn small ghost" aria-label="Dismiss">OK</button>`;
  $('.reader-main').appendChild(el);
  const start = doc.scrollLeft; // baseline taken now, so the first real scroll dismisses (N3)
  const done = () => { if (!el.isConnected) return; el.remove(); st.seenVHint = true; store.save(); doc.removeEventListener('scroll', onSc); clearTimeout(tm); };
  const onSc = () => { if (Math.abs(doc.scrollLeft - start) > 40) done(); };
  doc.addEventListener('scroll', onSc, { passive: true });
  $('button', el).onclick = done;
  const tm = setTimeout(done, 6000);
  R.cleanup.push(() => { clearTimeout(tm); el.remove(); });
}

async function renderPdfDoc(R) {
  const blob = await files.get(R.id);
  if (R.dead) return; // N9: the reader was replaced while IndexedDB answered
  if (!blob) {
    const rec = R.id === 'peak' ? store.data.peakFile : R.info.file, n = R.hls().length;
    R.root.innerHTML = rec ? `<div class="pdf-empty"><h2>${esc(R.info.title)}</h2>
      <p>Re-attach <b>${esc(rec.name)}</b>${rec.size ? ` (${fmtSize(rec.size)})` : ''} to see it again${n ? ` — your ${n} highlight${n === 1 ? ' is' : 's are'} kept and will reappear` : ''}.<br><span lang="zh-Hant">重新選擇此 PDF 檔即可恢復。</span></p>
      <button class="btn primary" id="upHere">Choose ${esc(rec.name)}</button></div>`
      : `<div class="pdf-empty"><h2>${esc(R.info.title)}</h2><p>${esc(R.info.subtitle)}</p>
      <p>No PDF stored in this browser yet.</p><button class="btn primary" id="upHere">Upload PDF</button></div>`;
    $('#upHere', R.root).onclick = () => pickFile(R.id === 'peak' ? 'peak' : rec ? R.id : 'new');
    return;
  }
  const lib = await getPdfjs();
  if (R.dead) return;
  R.root.innerHTML = `<div class="pdfdoc" id="pdfdoc"><p class="hint">Loading PDF…</p></div>`;
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), cMapUrl: 'vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: 'vendor/pdfjs/standard_fonts/' }).promise;
  if (R.dead) return;
  R.pdf = pdf;
  const first = await pdf.getPage(1); const base = first.getViewport({ scale: 1 });
  const host = $('#pdfdoc');
  const io = new IntersectionObserver(ents => ents.forEach(e => { if (e.isIntersecting) renderPage(+e.target.dataset.page); }), { rootMargin: '800px 0px' });
  R.cleanup.push(() => io.disconnect(), () => pdf.destroy());
  const rendered = new Map(); // page -> {scale, promise}
  const pageSizes = {};
  function scaleFor(vp) {
    const avail = Math.min(host.clientWidth - 48, 820);
    return (avail / vp.width) * (store.data.settings.pdfZoom || 1);
  }
  function layout() {
    host.innerHTML = ''; rendered.clear(); io.disconnect();
    for (let i = 1; i <= pdf.numPages; i++) {
      const vp = pageSizes[i] || base; const s = scaleFor(vp);
      const d = document.createElement('div'); d.className = 'page'; d.dataset.page = i;
      d.style.width = Math.floor(vp.width * s) + 'px'; d.style.height = Math.floor(vp.height * s) + 'px';
      d.innerHTML = `<span class="pno">${i}</span>`;
      host.appendChild(d); io.observe(d);
    }
  }
  async function renderPage(n) {
    if (rendered.has(n)) return rendered.get(n);
    const pr = (async () => {
      const page = await pdf.getPage(n); if (R.dead) return;
      const vp1 = page.getViewport({ scale: 1 }); pageSizes[n] = vp1;
      const scale = scaleFor(vp1); const vp = page.getViewport({ scale });
      const d = host.querySelector(`.page[data-page="${n}"]`); if (!d) return;
      d.style.width = Math.floor(vp.width) + 'px'; d.style.height = Math.floor(vp.height) + 'px';
      d.style.setProperty('--scale-factor', scale);
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const canvas = document.createElement('canvas'); canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
      const tl = document.createElement('div'); tl.className = 'textLayer'; tl.dataset.anchor = 'p' + n;
      d.prepend(canvas); d.appendChild(tl);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
      const textLayer = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport: vp });
      await textLayer.render();
      if (R.dead) return;
      R.paint(tl);
    })().catch(e => console.warn('page', n, e));
    rendered.set(n, pr); return pr;
  }
  R.renderPage = renderPage;
  R.relayout = debounce(() => { const p = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight); layout(); scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)); }, 150);
  const onResize = debounce(() => R.relayout(), 300);
  addEventListener('resize', onResize); R.cleanup.push(() => removeEventListener('resize', onResize));
  layout();
  const p = store.data.pos[R.id]; if (p) scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight));
}

function orderKey(h) { const p = h.parts[0]; return [+p.c.slice(1), p.s]; }
// ensō: a 300° brush circle for quiet empty and finished states (P6)
const ENSO = `<svg class="enso" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 A16 16 0 1 1 6.14 12" fill="none" stroke="var(--line-strong)" stroke-width="1.5" stroke-linecap="round"/></svg>`;
// nearest preceding heading for each container (N6 section context)
function sectionMap(R) {
  if (R.secMap) return R.secMap;
  const map = {}; let cur = '';
  for (const c of R.containers()) { if (c.tagName === 'H3') cur = c.textContent.split('『')[0].trim(); map[c.dataset.anchor] = cur; }
  return (R.secMap = map);
}
const grow = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
function openNote(id) {
  const item = $(`.hl-item[data-id="${id}"]`); if (!item) return;
  item.classList.add('writing', 'open'); const ta = $('textarea', item);
  grow(ta); ta.scrollIntoView({ block: 'nearest' }); ta.focus();
}
function renderPanel() {
  const R = reader; if (!R) return;
  const all = R.hls().slice().sort((a, b) => { const x = orderKey(a), y = orderKey(b); return x[0] - y[0] || x[1] - y[1]; });
  $('#hlCount').textContent = all.length ? `(${all.length})` : '';
  const q = R.q || '';
  const list = all.filter(h => !R.hidden.has(h.color) && (!R.onlyNotes || h.note) && (!q || (tidyCJK(h.quote) + ' ' + (h.note || '')).toLowerCase().includes(q)));
  $$('#filters [data-f]').forEach(b => { $('.n', b).textContent = all.filter(h => h.color === b.dataset.f).length; });
  const el = $('#hlList');
  // P6: an empty panel shows only a quiet hint; search appears from 6 highlights on
  const panel = $('#panel'); panel.classList.toggle('is-empty', !all.length); panel.classList.toggle('few', all.length < 6);
  if (!all.length) { el.innerHTML = `<div class="empty-state">${ENSO}<p lang="zh-Hant">選取文字即可畫螢光筆</p><p>Select text to highlight</p>
    <p class="hint">Then add a note or make a flashcard 單字卡. Keyboard: Tab to the first highlight, arrows move between them, Enter opens its tools.</p></div>`; return; }
  const sec = R.kind === 'text' ? sectionMap(R) : {};
  // keep in-progress UI state (open items, focus) across re-renders
  const openIds = new Set($$('.hl-item.open', el).map(x => x.dataset.id));
  const focusId = document.activeElement?.closest?.('.hl-item')?.dataset.id;
  el.innerHTML = list.map(h => {
    const where = R.kind === 'pdf' ? `p. ${h.parts[0].c.slice(1)}` : sec[h.parts[0].c] || '';
    const short = tidyCJK(h.quote).slice(0, 30);
    return `<div class="hl-item${h.note ? ' has-note' : ''}${openIds.has(h.id) ? ' open' : ''}" data-id="${h.id}" style="--c:${COLORS[h.color]}">
      ${where ? `<div class="where hint">${esc(where)}</div>` : ''}
      <div class="q" role="link" tabindex="0" title="Jump to passage">${esc(tidyCJK(h.quote))}</div>
      <textarea placeholder="${esc(R.L.ph)}" aria-label="Note for: ${esc(short)}" rows="1">${esc(h.note)}</textarea>
      <div class="foot"><button class="addnote" data-act="note">＋ 筆記 Note</button><span class="grow"></span>
        <button class="more" data-act="more" aria-expanded="${openIds.has(h.id)}" aria-label="More actions for: ${esc(short)}" title="Colour, card, delete">⋯</button></div>
      <div class="meta">${Object.keys(COLORS).map(c => `<button class="dot sw-${c}" data-color="${c}" title="${COLOR_NAMES[c]}" aria-label="Color: ${COLOR_NAMES[c]}" aria-pressed="${c === h.color}">${c === h.color ? '●' : '○'}</button>`).join('')}
        <span class="grow"></span><button data-act="card">＋ Card</button><button data-act="del">Delete</button></div>
    </div>`; }).join('') || `<p class="empty">${q || R.onlyNotes ? 'No highlights match. 沒有符合的筆記。' : 'No highlights in the selected colors.'}</p>`;
  $$('.hl-item', el).forEach(item => {
    const h = R.hls().find(x => x.id === item.dataset.id);
    $$('.meta [data-color]', item).forEach(b => { b.onclick = () => { h.color = b.dataset.color; store.touch(h); store.save(); R.repaint(h.parts.map(p => p.c)); renderPanel(); }; });
    const qd = $('.q', item); qd.onclick = () => jumpTo(h); qd.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); jumpTo(h); } };
    const ta = $('textarea', item);
    if (h.note) requestAnimationFrame(() => grow(ta));
    const saveNote = debounce(() => { const had = !!h.note; h.note = ta.value; store.touch(h); store.save(); item.classList.toggle('has-note', !!h.note); if (had !== !!h.note) R.repaint(h.parts.map(p => p.c)); }, 300);
    ta.oninput = () => { grow(ta); saveNote(); };
    ta.onblur = () => { if (!ta.value.trim()) item.classList.remove('writing'); };
    $('[data-act=note]', item).onclick = () => openNote(h.id);
    const more = $('[data-act=more]', item);
    more.onclick = () => { const o = item.classList.toggle('open'); more.setAttribute('aria-expanded', String(o)); };
    $('[data-act=del]', item).onclick = () => removeHl(h.id);
    // N11: a card made from the panel is linked to its highlight too
    $('[data-act=card]', item).onclick = () => openCardDialog({ term: h.quote.length > 60 ? h.quote.slice(0, 60) : h.quote, context: h.context || h.quote, docId: R.id, origin: { R, hlId: h.id } });
  });
  if (focusId) { const f = $(`.hl-item[data-id="${focusId}"] .more`, el); if (f && el.contains(f)) f.focus({ preventScroll: true }); }
}

async function jumpTo(h) {
  const R = reader; const p = h.parts[0];
  if (R.kind === 'pdf') {
    const n = +p.c.slice(1); const pg = $(`.page[data-page="${n}"]`); pg?.scrollIntoView({ block: 'center' });
    await R.renderPage(n);
  }
  const m = $(`mark[data-id="${h.id}"]`);
  if (m) { m.scrollIntoView({ block: 'center', behavior: 'smooth' }); $$(`mark[data-id="${h.id}"]`).forEach(x => { x.classList.add('flash'); setTimeout(() => x.classList.remove('flash'), 1400); }); }
  if (innerWidth < 860) R.closePanel();
}

function removeHl(id) {
  const R = reader; const arr = R.hls(); const i = arr.findIndex(h => h.id === id); if (i < 0) return;
  const [h] = arr.splice(i, 1); store.tomb(h.id); store.save(); R.repaint(h.parts.map(p => p.c)); renderPanel();
  toast(h.note ? 'Highlight and note removed' : 'Highlight removed', { label: 'Undo 復原', fn: () => {
    if (reader !== R) return; arr.splice(Math.min(i, arr.length), 0, h); store.touch(h); store.save(); R.repaint(h.parts.map(p => p.c)); renderPanel(); } });
}

// roving tabindex (N5a): highlights are one Tab stop; arrow keys move between them
function rove(R) {
  const marks = $$('mark.hl[role=button]', R.root); if (!marks.length) return;
  let cur = R.roveId && marks.find(m => m.dataset.id === R.roveId);
  if (!cur) { cur = marks[0]; R.roveId = cur.dataset.id; }
  for (const m of marks) m.tabIndex = m === cur ? 0 : -1;
}
function moveMark(from, dir) {
  const R = reader; const marks = $$('mark.hl[role=button]', R.root);
  const i = marks.indexOf(from); const to = marks[Math.max(0, Math.min(marks.length - 1, i + dir))];
  if (!to || to === from) return;
  from.tabIndex = -1; to.tabIndex = 0; R.roveId = to.dataset.id;
  to.focus({ preventScroll: true }); to.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function focusMark(id) {
  const R = reader; if (!R) return;
  const m = $(`mark.hl[role=button][data-id="${id}"]`, R.root); if (!m) return;
  R.roveId = id; rove(R); m.focus({ preventScroll: true });
}

// highlights that have a flashcard made from them get a thin ai underline (M2)
function decorateCards(container, R) {
  const ids = new Set(store.data.cards.filter(c => c.docId === R.id && c.hlId).map(c => c.hlId));
  $$('mark.hl', container).forEach(m => m.classList.toggle('has-card', ids.has(m.dataset.id)));
}

function addHighlight(color, sel) {
  const R = reader;
  const h = { id: uid(), color, parts: sel.parts, quote: sel.quote, context: sel.context, note: '', created: Date.now(), mt: Date.now() };
  R.hls().push(h); store.save(); askPersist(); R.repaint(h.parts.map(p => p.c)); renderPanel();
  getSelection().removeAllRanges();
  return h;
}

function exportMarkdown(R) {
  const m = R.info; const hl = R.hls().slice().sort((a, b) => { const x = orderKey(a), y = orderKey(b); return x[0] - y[0] || x[1] - y[1]; });
  const cards = store.data.cards.filter(c => c.docId === R.id);
  let md = `# ${m.title}\n\n_${m.subtitle}_\n\n`;
  if (m.url) md += `Source: [${m.source}](${m.url}) — ${m.license}\n\n`;
  md += `Exported from Reading Web on ${new Date().toLocaleString()}\n\n## Highlights & notes (${hl.length})\n\n`;
  for (const h of hl) {
    md += `${EMOJI[h.color]}${R.kind === 'pdf' ? ` **p. ${h.parts[0].c.slice(1)}**` : ''}\n> ${tidyCJK(h.quote).replace(/\n/g, '\n> ')}\n\n`;
    if (h.note) md += `**Note:** ${h.note.replace(/\n/g, '  \n')}\n\n`;
  }
  if (cards.length) {
    md += `## Flashcards 單字卡 (${cards.length})\n\n| Term | Definition | Context |\n|---|---|---|\n`;
    const cell = s => (s || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
    for (const c of cards) md += `| **${cell(c.term)}** | ${cell(c.def)} | ${cell(c.context)} |\n`;
  }
  download(`${m.title.replace(/\s*[:：]\s*/g, ' - ').replace(/[\\/:*?"<>|]+/g, '_')} - notes.md`, md);
  toast('Markdown exported');
}

// ---------- selection toolbar ----------
const bar = $('#selbar');
let pending = null, activeHl = null;
let barReturn = null; // the mark to give focus back to when a keyboard user leaves the toolbar
function hideBar() { bar.hidden = true; pending = null; activeHl = null; }
function focusBar() { ($('.sw.cur', bar) || $('.sw', bar)).focus(); }
// keyboard opened the bar? (a Shift/arrow selection keeps focus in the text so the selection can still grow)
const keyOpened = () => lastInput === 'key' && lastKey && !lastKey.shiftKey && !/^Arrow|^Home$|^End$|^Page/.test(lastKey.key);
function placeBar(rect) {
  bar.hidden = false;
  $('.vcoach button')?.click();
  const touch = matchMedia('(pointer: coarse)').matches || innerWidth < 600;
  bar.classList.toggle('docked', touch);
  if (touch) { bar.style.left = ''; bar.style.top = ''; return; } // docked above the bottom edge (CSS), clear of the OS selection menu
  const bw = bar.offsetWidth, bh = bar.offsetHeight;
  let x = rect.left + rect.width / 2 - bw / 2; x = Math.max(8, Math.min(innerWidth - bw - 8, x));
  let y = touch ? rect.bottom + 12 : rect.top - bh - 10;
  if (y < 64) y = rect.bottom + 10;
  if (y + bh > innerHeight - 8) y = Math.max(64, rect.top - bh - 10);
  y = Math.max(64, Math.min(innerHeight - bh - 8, y));
  bar.style.left = x + 'px'; bar.style.top = y + 'px';
}
function readSelection() {
  if (!reader) return null;
  const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!reader.root.contains(r.commonAncestorContainer)) return null;
  const parts = rangeToParts(r, reader.root); if (!parts.length) return null;
  const quote = partsText(parts, reader.root); if (!quote) return null;
  const c0 = reader.root.querySelector(`[data-anchor="${parts[0].c}"]`);
  const context = sentenceAround(containerText(c0), parts[0].s, parts[0].e);
  return { parts, quote, context, rect: r.getBoundingClientRect() };
}
const onSelChange = debounce(() => {
  const s = readSelection();
  if (!s) { if (!activeHl && !bar.matches(':hover')) { bar.hidden = true; pending = null; } return; }
  pending = s; activeHl = null; barReturn = null;
  $('[data-act=remove]', bar).hidden = true; $$('.sw', bar).forEach(b => b.classList.remove('cur'));
  placeBar(s.rect);
  if (keyOpened()) focusBar();
}, 180);
document.addEventListener('selectionchange', onSelChange);
addEventListener('scroll', () => { if (!bar.hidden) { if (pending) { const sel = getSelection(); if (sel.rangeCount && !sel.isCollapsed) placeBar(sel.getRangeAt(0).getBoundingClientRect()); } else hideBar(); } }, { passive: true });
bar.addEventListener('pointerdown', e => e.preventDefault()); // keep selection alive
bar.addEventListener('mousedown', e => e.preventDefault());
document.addEventListener('click', e => {
  if (bar.contains(e.target)) return;
  const m = e.target.closest?.('mark.hl');
  if (m && reader && getSelection().isCollapsed) { openMarkBar(m); return; }
  if (getSelection().isCollapsed) hideBar();
});
function openMarkBar(m) {
  const h = reader && reader.hls().find(x => x.id === m.dataset.id); if (!h) return;
  activeHl = h; pending = null;
  $('[data-act=remove]', bar).hidden = false;
  $$('.sw', bar).forEach(b => b.classList.toggle('cur', b.dataset.color === h.color));
  placeBar(m.getBoundingClientRect());
  barReturn = lastInput === 'key' ? h.id : null;
  if (barReturn) focusBar();
}
// ←/→ move between toolbar buttons, Esc leaves it (N5b)
bar.addEventListener('keydown', e => {
  const btns = $$('button:not([hidden])', bar); const i = btns.indexOf(document.activeElement);
  if (i < 0) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length].focus(); }
  else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); btns[e.key === 'Home' ? 0 : btns.length - 1].focus(); }
});
bar.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !reader) return;
  const R = reader;
  const back = lastInput === 'key';
  if (b.dataset.color) {
    let id = null;
    if (activeHl) { id = activeHl.id; activeHl.color = b.dataset.color; store.touch(activeHl); store.save(); R.repaint(activeHl.parts.map(p => p.c)); renderPanel(); announce('Colour changed'); }
    else if (pending) { id = addHighlight(b.dataset.color, pending).id; announce('Highlighted'); }
    hideBar(); if (back && id) focusMark(id); return;
  }
  const act = b.dataset.act;
  if (act === 'remove' && activeHl) { removeHl(activeHl.id); hideBar(); if (back) { const m = $('mark.hl[role=button]', R.root); m ? focusMark(m.dataset.id) : $('#panelBtn').focus(); } }
  if (act === 'note') {
    const h = activeHl || (pending && addHighlight('yellow', pending)); hideBar(); if (!h) return;
    R.openPanel(); R.hidden.delete(h.color); renderPanel();
    setTimeout(() => openNote(h.id), 280);
  }
  if (act === 'card') {
    if (activeHl) openCardDialog({ term: activeHl.quote, context: activeHl.context || activeHl.quote, docId: R.id, origin: { R, hlId: activeHl.id } });
    else if (pending) openCardDialog({ term: pending.quote, context: pending.context, docId: R.id, origin: { R, sel: pending } });
    getSelection().removeAllRanges(); hideBar();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (dlg.open) return;
    if (!bar.hidden) { const back = barReturn; hideBar(); if (back) focusMark(back); return; }
    if (reader && reader.sheetOpen && reader.sheetOpen()) { reader.closePanel(); return; }
    return;
  }
  if (!reader || dlg.open || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = document.activeElement?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  // keyboard path to highlights (L6): Enter/Space on a focused mark opens the toolbar
  const m = document.activeElement?.closest?.('mark.hl');
  if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openMarkBar(m); return; }
  if (m && /^Arrow/.test(e.key)) {
    const v = !!(reader.vdoc && reader.vdoc());
    const next = v ? (e.key === 'ArrowLeft' || e.key === 'ArrowDown') : (e.key === 'ArrowRight' || e.key === 'ArrowDown');
    e.preventDefault(); moveMark(m, next ? 1 : -1); return;
  }
  if (activeHl && !bar.hidden && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); $('[data-act=remove]', bar).click(); return; }
  // with a text selection (or an active highlight): 1–4 colours, N note, C card
  if (bar.hidden || !(pending || activeHl)) return;
  const k = e.key.toLowerCase(); const map = { 1: 'yellow', 2: 'green', 3: 'pink', 4: 'blue' };
  const btn = map[k] ? $(`.sw[data-color="${map[k]}"]`, bar) : k === 'n' ? $('[data-act=note]', bar) : k === 'c' ? $('[data-act=card]', bar) : null;
  if (btn) { e.preventDefault(); btn.click(); }
});

// ---------- flashcard dialog ----------
const dlg = $('#cardDlg'), form = $('#cardForm');
let editing = null, cardOrigin = null, dupCard = null;
const isEnglish = t => /^[A-Za-z][A-Za-z'’\- ]{0,40}$/.test(t.trim()) && t.trim().split(/\s+/).length <= 3;
function openCardDialog({ term = '', context = '', docId = null, card = null, origin = null }) {
  editing = card; cardOrigin = card ? null : origin;
  term = tidyCJK(term.replace(/\s+/g, ' ').trim()).replace(/^[“"‘'(\[「『]+|[”"’'.,;:!?)\]」』，。、；：！？]+$/g, '');
  form.term.value = card ? card.term : term;
  form.def.value = card ? card.def || '' : '';
  form.context.value = card ? card.context || '' : context;
  const d = docInfo(card ? card.docId : docId);
  $('#cardSrc').textContent = d ? `Source: ${d.short}` : 'Source: added manually';
  form.dataset.doc = card ? card.docId || '' : docId || '';
  $('#cardDlgTitle').textContent = card ? 'Edit flashcard 編輯單字卡' : 'Add to flashcards 加入單字卡';
  $('#cardDelete').hidden = !card;
  $('#lookupMsg').textContent = isEnglish(form.term.value) ? '' : 'Chinese / long phrases: type your own definition.';
  // duplicate check for new cards (M2)
  const t = form.term.value.trim().toLowerCase();
  dupCard = card ? null : store.data.cards.find(c => c.term.trim().toLowerCase() === t) || null;
  $('#openDup').hidden = !dupCard;
  $('#cardSave').textContent = dupCard ? 'Save anyway' : 'Save';
  dlg.returnValue = '';
  dlg.showModal();
  if (dupCard) $('#lookupMsg').textContent = `Already in your deck (box ${dupCard.box || 1}).`;
  // auto lookup only for single English words; phrases keep the manual button (M10)
  if (!card && !dupCard && isEnglish(form.term.value) && form.term.value.trim().split(/\s+/).length === 1) lookup();
  else if (!card && !dupCard) form.def.focus();
}
$('#openDup').onclick = () => { const d = dupCard; if (!d) return; dlg.close('cancel'); setTimeout(() => openCardDialog({ card: d }), 0); };
$('#cardCancel').onclick = () => dlg.close('cancel');
form.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (form.term.value.trim()) dlg.close('save'); } });
form.addEventListener('submit', e => { e.preventDefault(); if (form.term.value.trim()) dlg.close('save'); });
async function lookup() {
  const word = form.term.value.trim(); const msg = $('#lookupMsg');
  if (!isEnglish(word)) { msg.textContent = 'Dictionary lookup works for English words; enter your own definition.'; return; }
  if (!navigator.onLine) { msg.textContent = 'Offline — type your own definition 離線中，請自行填寫'; return; }
  msg.textContent = 'Looking up…';
  try {
    const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word.toLowerCase()));
    if (!r.ok) throw new Error(r.status === 404 ? 'No dictionary entry found. Type your own definition.' : 'Lookup failed (' + r.status + ')');
    const data = await r.json(); const e = data[0];
    const lines = [];
    const ph = e.phonetic || e.phonetics?.find(p => p.text)?.text; if (ph) lines.push(ph);
    for (const m of e.meanings.slice(0, 3)) for (const d of m.definitions.slice(0, 2)) lines.push(`(${m.partOfSpeech}) ${d.definition}`);
    if (!form.def.value.trim() || form.def.dataset.auto === '1') { form.def.value = lines.join('\n'); form.def.dataset.auto = '1'; }
    msg.textContent = 'From dictionaryapi.dev, edit as you like.';
  } catch (err) { msg.textContent = err.message.startsWith('No') || err.message.startsWith('Lookup') ? err.message : 'Offline or lookup unavailable. Type your own definition.'; }
}
form.def.addEventListener('input', () => form.def.dataset.auto = '0');
$('#lookupBtn').onclick = lookup;
$('#cardDelete').onclick = () => { if (editing && confirm('Delete this card?')) { store.data.cards = store.data.cards.filter(c => c !== editing); store.tomb(editing.id); store.save();
    if (reader && editing.hlId) { const h = reader.hls().find(x => x.id === editing.hlId); if (h) reader.repaint(h.parts.map(p => p.c)); } /* N13 */
    dlg.close('deleted'); toast('Card deleted'); if (location.hash.startsWith('#/cards')) renderCards(); updateBadge(); } };
dlg.addEventListener('close', () => {
  form.def.dataset.auto = '0';
  if (dlg.returnValue !== 'save') { cardOrigin = null; return; }
  const term = form.term.value.trim(); if (!term) return;
  if (editing) store.touch(Object.assign(editing, { term, def: form.def.value.trim(), context: form.context.value.trim() }));
  else {
    const docId = form.dataset.doc || null; const d = docInfo(docId);
    const card = { id: uid(), term, def: form.def.value.trim(), context: form.context.value.trim(), docId, docTitle: d ? d.short : '', box: 1, due: Date.now(), created: Date.now(), mt: Date.now(), reviews: 0 };
    // leave a trace in the text: link the card to a highlight, making an ai (blue) one if the words aren't highlighted yet
    const o = cardOrigin; cardOrigin = null;
    if (o && reader === o.R) {
      if (o.hlId) card.hlId = o.hlId;
      else if (o.sel) {
        const overlap = o.R.hls().find(h => h.parts.some(p => o.sel.parts.some(q => q.c === p.c && q.s < p.e && p.s < q.e)));
        card.hlId = overlap ? overlap.id : addHighlight('blue', o.sel).id;
      }
    }
    store.data.cards.push(card); askPersist();
    if (card.hlId && reader) { const h = reader.hls().find(x => x.id === card.hlId); if (h) reader.repaint(h.parts.map(p => p.c)); }
  }
  store.save(); updateBadge();
  if (editing) toast('Card updated'); else toast('Added to flashcards', { label: 'View in deck', fn: () => { location.hash = '#/cards'; } });
  if (location.hash.startsWith('#/cards')) renderCards();
});

// ---------- flashcards list ----------
const SORTS = { newest: ['Newest', (a, b) => b.created - a.created], due: ['Next due', (a, b) => (a.due || 0) - (b.due || 0)], box: ['Box', (a, b) => (a.box || 1) - (b.box || 1) || (a.due || 0) - (b.due || 0)], az: ['A–Z', (a, b) => a.term.localeCompare(b.term, 'zh-Hant')] };
function renderCards() {
  const cards = store.data.cards;
  const filter = renderCards.filter || '';
  const sort = SORTS[store.data.settings.deckSort] ? store.data.settings.deckSort : 'newest';
  const inDoc = cards.filter(c => !filter || c.docId === filter);
  const due = inDoc.filter(c => isDue(c)).length;
  const docs = [...new Set(cards.map(c => c.docId).filter(Boolean))];
  const box = n => inDoc.filter(c => (c.box || 1) === n).length;
  view.innerHTML = `<div class="wrap">
    <div class="deck-head"><h1 data-heading>Flashcards <span lang="zh-Hant">單字卡</span></h1>
      <select class="field" id="deckFilter" style="width:auto" aria-label="Source"><option value="">All sources (${cards.length})</option>${docs.map(d => `<option value="${esc(d)}" ${d === filter ? 'selected' : ''}>${esc(docInfo(d)?.short || d)}</option>`).join('')}</select>
      <button class="btn" id="newCard">＋ New card</button>
      ${due ? `<a class="btn primary" id="reviewBtn" href="#/review/${encodeURIComponent(filter)}">Review (${due} due)</a>`
        : `<a class="btn ghost" id="reviewBtn" href="#/review/${encodeURIComponent(filter)}" aria-disabled="true" title="Nothing due 目前無待複習">Review</a>`}</div>
    ${inDoc.length ? `<div class="boxes">${[1, 2, 3, 4, 5].map(n => { const every = n === 1 ? 'every session' : `every ${BOX_DAYS[n]} day${BOX_DAYS[n] > 1 ? 's' : ''}`; return `<div title="Box ${n}: ${every}"><b>${box(n)}</b>Box ${n}<span class="every"> · ${every}</span></div>`; }).join('')}</div>` : ''}
    ${inDoc.length ? `<div class="deck-tools"><input type="search" class="field" id="deckSearch" placeholder="搜尋 Search cards" aria-label="Search cards" value="${esc(renderCards.q || '')}">
      <label class="hint">Sort <select class="field" id="deckSort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label></div>
    <table class="cards"><thead><tr><th>Term</th><th class="def">Definition</th><th>Source</th><th>Box</th><th>Next</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody id="deckRows"></tbody></table>
    <p class="empty" id="deckNone" hidden>No cards match. 沒有符合的單字卡。</p>` : `<p class="empty">No cards yet. In the reader, select a word or phrase and choose <b>＋ Card</b>. English words get a dictionary definition automatically; for Chinese terms 中文詞語, type your own.</p>`}
    ${dataRow(true)}
    <p class="hint" style="margin-top:18px">Leitner system: “Known” moves a card up one box (reviewed less often); “Again” sends it back to box 1 and brings it back tomorrow. Only your first answer in a session counts.</p>
  </div>`;
  $('#deckFilter').onchange = e => { renderCards.filter = e.target.value; renderCards(); };
  $('#newCard').onclick = () => openCardDialog({ docId: filter || null });
  wireDataRow(view);
  const rb = $('#reviewBtn'); if (rb.getAttribute('aria-disabled') === 'true') rb.onclick = e => { e.preventDefault(); const n = nextDue(inDoc); toast(n ? `Nothing due 目前無待複習 · next: ${dayLabel(n.t)} · ${n.n} card${n.n === 1 ? '' : 's'}` : 'No cards yet 尚無單字卡'); };
  const rows = $('#deckRows'); if (!rows) return;
  const fill = () => {
    if (!rows.isConnected) return; // P11: the page was left while the search was debouncing
    const q = (renderCards.q || '').trim().toLowerCase();
    const shown = inDoc.filter(c => !q || (c.term + ' ' + (c.def || '') + ' ' + (c.context || '')).toLowerCase().includes(q)).sort(SORTS[sort][1]);
    rows.innerHTML = shown.map(c => `<tr data-id="${c.id}" tabindex="0" aria-label="Edit card ${esc(c.term)}"><td class="term">${esc(c.term)}</td><td class="def">${esc((c.def || '—').slice(0, 140))}</td><td class="hint src">${esc(docInfo(c.docId)?.short || c.docTitle || '—')}</td><td class="box">${c.box || 1}</td><td class="hint next">${fmtDue(c)}</td><td class="edit">Edit ›</td></tr>`).join('');
    const none = $('#deckNone'); if (none) none.hidden = !!shown.length;
    $$('tr[data-id]', rows).forEach(tr => {
      const open = () => openCardDialog({ card: store.data.cards.find(c => c.id === tr.dataset.id) });
      tr.onclick = open; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    });
  };
  fill();
  $('#deckSearch').oninput = debounce(e => { renderCards.q = e.target.value; fill(); }, 120);
  $('#deckSort').onchange = e => { store.data.settings.deckSort = e.target.value; store.save(); renderCards(); };
}

// ---------- review ----------
// soonest due day among cards that aren't due yet, and how many share it
function nextDue(cards) {
  const later = cards.filter(c => !isDue(c)); if (!later.length) return null;
  const day = Math.min(...later.map(c => startOfDayPlus(c.due, 0)));
  return { t: day, n: later.filter(c => startOfDayPlus(c.due, 0) === day).length };
}
let reviewKey = null;
function renderReview(docId) {
  const pool = store.data.cards.filter(c => !docId || c.docId === docId);
  let queue = pool.filter(c => isDue(c)).sort(() => Math.random() - .5);
  const seen = new Set(), againSet = new Set();
  const title = docId ? (docInfo(docId)?.short || '') : 'All cards';
  const show = () => {
    if (!queue.length) {
      // P6: centred finished / caught-up / empty states with the next review day
      const nx = nextDue(pool), next = nx ? `下次 Next: ${dayLabel(nx.t)} · ${nx.n} card${nx.n === 1 ? '' : 's'}` : '';
      const [head, line] = !pool.length ? ['尚無單字卡 · No cards yet', 'Select a word in any text and choose ＋ Card.']
        : seen.size ? ['今日完成 · Session complete', `${seen.size} card${seen.size === 1 ? '' : 's'}${againSet.size ? ` · ${againSet.size} to see again tomorrow` : ''}`]
        : ['今日無待複習 · All caught up', title === 'All cards' ? '' : esc(title)];
      view.innerHTML = `<div class="review"><div class="done">${ENSO}<h1 data-heading>${head}</h1><hr class="seal-rule">
        ${line ? `<p>${line}</p>` : ''}${next ? `<p class="hint next">${next}</p>` : ''}
        <div class="row center"><a class="btn primary" href="#/cards">Back to cards</a>${pool.length ? `<button class="btn ghost" id="all">Review all ${pool.length} anyway</button>` : ''}</div></div></div>`;
      const a = $('#all'); if (a) a.onclick = () => { queue = pool.slice().sort(() => Math.random() - .5); show(); };
      reviewKey = null; updateBadge(); return;
    }
    const c = queue[0];
    const ctx = esc(c.context || '').replace(new RegExp(esc(c.term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<b>${m}</b>`);
    view.innerHTML = `<div class="review">
      <div class="row"><a class="btn small ghost" href="#/cards">← Cards</a><span class="grow"></span><span class="hint">${esc(title)} · ${queue.length} left · box ${c.box || 1}</span></div>
      <div class="flip" id="flip" tabindex="0" role="button" aria-pressed="false" aria-label="Flashcard: ${esc(c.term)}. Press Space to show the answer">
        <div class="flip-inner">
          <div class="face front"><div class="term">${esc(c.term)}</div><div class="src">${esc(docInfo(c.docId)?.short || c.docTitle || '')}</div><div class="hint">Tap or press space to flip</div></div>
          <div class="face back"><div class="term" style="font-size:26px">${esc(c.term)}</div>
            <div class="def">${esc(c.def || '(no definition yet — click Edit to add one)')}</div>
            ${c.context ? `<div class="ctx">${ctx}</div>` : ''}<div class="src">${esc(docInfo(c.docId)?.short || '')}</div></div>
        </div></div>
      <div class="grade" id="grade" style="visibility:hidden"><button class="btn" id="again">↺ Again <span class="hint kbd">(1)</span></button><button class="btn primary" id="known">✓ Known <span class="hint kbd">(2)</span></button></div>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn small ghost" id="edit">Edit card</button></div></div>`;
    const flip = $('#flip');
    const doFlip = () => {
      const on = flip.classList.toggle('flipped'); $('#grade').style.visibility = on ? 'visible' : 'hidden';
      flip.setAttribute('aria-pressed', String(on));
      if (on) announce(`${c.term}: ${c.def || 'no definition yet'}. Press 1 for Again, 2 for Known.`);
    };
    flip.onclick = doFlip;
    if (matchMedia('(pointer:fine)').matches) flip.focus({ preventScroll: true });
    // N4: only the first answer in a session moves the card; repeats just keep drilling until Known
    const answer = known => {
      if (!seen.has(c.id)) { grade(c, known); if (!known) againSet.add(c.id); }
      else if (againSet.has(c.id) && known) { c.due = startOfNextDay(); store.touch(c); } // missed today → box 1, back tomorrow
      seen.add(c.id); queue.shift();
      if (!known) queue.push(c);
      store.save(); show();
    };
    $('#again').onclick = () => answer(false); $('#known').onclick = () => answer(true);
    $('#edit').onclick = () => openCardDialog({ card: c });
    reviewKey = e => {
      if (!location.hash.startsWith('#/review') || dlg.open) return;
      if (e.key === ' ') { e.preventDefault(); doFlip(); }
      else if (e.key === '1' && flip.classList.contains('flipped')) answer(false);
      else if (e.key === '2' && flip.classList.contains('flipped')) answer(true);
    };
  };
  show();
}
document.addEventListener('keydown', e => { if (location.hash.startsWith('#/review') && reviewKey) reviewKey(e); });

route();
