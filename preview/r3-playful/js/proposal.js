/* Round 3 proposal. Event-driven. No setInterval. No sutra text changes. No seals. */
const VARIANT = 'playful';
const R3 = {
  name: VARIANT,
  keepStillMs: VARIANT === 'calm' ? 2000 : 1500,
  touchHold: VARIANT !== 'calm',
  touchTap: VARIANT === 'playful',
  slips: VARIANT !== 'calm',
  shichenDefault: VARIANT === 'playful',
  moonBreath: VARIANT === 'playful',
  firstGutterBreath: VARIANT !== 'calm',
  fabTick: VARIANT === 'playful',
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const FRAME_ICON = `<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="3.2" y="3.2" width="11.6" height="11.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 12.2c1.3-1.5 2.2-2.2 3.4-2.2 1 0 1.6.6 3.6 2.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`;
const SHARE_ICON = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9M7 5.5 10 3l3 2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10.5v5h10v-5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SAVE_ICON = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v9M7 10.5 10 13.5 13 10.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 16.5h10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const PETAL_SVG = `<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 1.6c1.7 2.3 2.6 4.1 2.6 6 0 2.3-1.3 4.1-2.6 5.6-1.3-1.5-2.6-3.3-2.6-5.6 0-1.9.9-3.7 2.6-6zm0 8c2.5 0 4.5 1.2 6.2 3-1.9.7-3.8 1-6.2 1s-4.3-.3-6.2-1c1.7-1.8 3.7-3 6.2-3z"/></svg>`;
const JIAN_ICON = `<svg viewBox="0 0 22 22" aria-hidden="true"><rect x="5" y="4" width="11" height="15" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="7.5" y="2.5" width="11" height="15" rx="1" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".7"/></svg>`;

const BYLINE = /譯$|translated from|三藏|鳩摩羅什|玄奘|Kum[aā]raj[iī]va|colophon|^Source:|^License:|CBETA/i;
const PUNCT = '。！？；：、…」』，：「」『』';
const KEEP_KEY = 'readingweb:proposal-keeps';
function isPunct(ch) {
  if (!ch) return false;
  if (/\s/u.test(ch)) return false;
  if (/\p{P}/u.test(ch)) return true;
  return '、·•—–…「」『』'.includes(ch);
}
function stripPunct(s) {
  return [...String(s || '')].filter(ch => !isPunct(ch)).join('').replace(/ +/g, ' ').trim();
}
const GLOW_MS = 1200;
const PETAL_AFTER_GLOW = 80; // first petal starts 80 ms after the moon-glow ends

/* ---------- moon path: semicircle + terminator ellipse, true half at p=0.5 ---------- */
function moonPath(p, cx = 10, cy = 10, r = 7) {
  const t = Math.max(0, Math.min(1, p));
  if (t <= 0) return '';
  if (t >= 1) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  const rx = r * Math.abs(1 - 2 * t);
  if (rx < 0.04) return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z`;
  const sweep = t > 0.5 ? 1 : 0;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${rx.toFixed(3)} ${r} 0 0 ${sweep} ${cx} ${cy - r} Z`;
}
function moonSvg(p) {
  const d = moonPath(p);
  const light = d ? `<path class="moon-light" d="${d}"/>` : '';
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle class="moon-disk" cx="10" cy="10" r="7.2"/>${light}</svg>`;
}

function currentRange(i) {
  const ranges = window.RW?.reader?.dlg?.lotus?.ranges;
  if (!ranges || i == null || i < 0) return null;
  return ranges.find(r => i >= r.start && i <= r.end) || null;
}
function phaseOf(i) {
  const r = currentRange(i);
  if (!r) return 0;
  const span = r.end - r.start;
  if (span <= 0) return 1;
  return (i - r.start) / span;
}

let moonEl = null, moonPhase = -1, moonAnim = 0, moonPage = -999;
function ensureMoon() {
  const stage = document.querySelector('#dlgStage');
  if (!stage || stage.hidden || getComputedStyle(stage).display === 'none') return null;
  if (!stage.classList.contains('has-lotus')) return null;
  if (!moonEl || !stage.contains(moonEl)) {
    moonEl = document.createElement('div');
    moonEl.className = 'ink-moon';
    moonEl.setAttribute('role', 'img');
    stage.appendChild(moonEl);
    moonPhase = -1; moonPage = -999;
  }
  return moonEl;
}
function paintMoon(p, { animate = true, glow = false } = {}) {
  const el = ensureMoon();
  if (!el) return;
  const target = Math.max(0, Math.min(1, p));
  const from = moonPhase < 0 ? target : moonPhase;
  el.classList.remove('is-breath');
  el.classList.toggle('is-full', !!glow && target >= 1 && !reduced());
  const write = (v) => {
    if (Math.abs(v - (el._p ?? -1)) < 0.0008 && el.innerHTML) return;
    el._p = v;
    el.innerHTML = moonSvg(v);
    const pin = currentRange(window.RW?.reader?.dlg?.idx);
    el.setAttribute('aria-label', pin ? `月相 本分進度 ${Math.round(v * 100)}%` : '月相');
  };
  cancelAnimationFrame(moonAnim);
  if (!animate || reduced() || Math.abs(target - from) < 0.001) {
    moonPhase = target;
    write(target);
    return;
  }
  const t0 = performance.now();
  const dur = 600;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const ease = 1 - Math.pow(1 - k, 3) * (1 - 0.3 * k);
    const v = from + (target - from) * ease;
    moonPhase = v;
    write(v);
    if (k < 1) moonAnim = requestAnimationFrame(tick);
  };
  moonAnim = requestAnimationFrame(tick);
}
function breathMoon() {
  const el = ensureMoon();
  if (!el || reduced()) return;
  el.classList.remove('is-full', 'is-breath');
  void el.offsetWidth;
  el.classList.add('is-breath');
  setTimeout(() => el.classList.remove('is-breath'), 420);
}
function onDlgPage(ev) {
  const i = ev.detail?.i;
  if (typeof i !== 'number') return;
  if (ev.detail.how === 'scrub') markScrubbed(i);
  if (i === moonPage && ev.detail.how !== 'scrub') return;
  const was = moonPage;
  moonPage = i;
  const p = phaseOf(i);
  const glow = p >= 1 && was !== i;
  paintMoon(p, { animate: was >= 0, glow });
}

const scrubbedPins = new Set();
function pinOfIndex(i) {
  const r = currentRange(i);
  return r ? r.pin : 0;
}
function markScrubbed(i) {
  const pin = pinOfIndex(i);
  if (pin) scrubbedPins.add(pin);
}

function petalCount(pin, how) {
  if (pin % 8 === 0) return 3;
  if (how !== 'scrub' && !scrubbedPins.has(pin)) return 2;
  return 1;
}
function fallPetals(n) {
  const stage = document.querySelector('#dlgStage');
  const moon = ensureMoon() || stage?.querySelector('.ink-moon');
  if (!stage) return;
  let layer = stage.querySelector('.plum-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'plum-layer';
    layer.setAttribute('aria-hidden', 'true');
    stage.appendChild(layer);
  }
  const field = stage.querySelector('#inkField');
  if (field) {
    const pad = parseFloat(getComputedStyle(field).paddingLeft) || 72;
    layer.style.setProperty('--petal-gutter', pad + 'px');
  }
  layer.querySelectorAll('.plum-petal').forEach(p => p.remove());
  const sr = stage.getBoundingClientRect();
  const mr = moon ? moon.getBoundingClientRect() : { left: sr.left + 68, top: sr.top + 20, width: 28, height: 28 };
  const x0 = mr.left + mr.width / 2 - sr.left - 10;
  const y0 = mr.top + mr.height / 2 - sr.top;
  const durs = [2.6, 2.9, 3.2];
  const delays = [0, 280, 560];
  const count = Math.max(1, Math.min(3, n));
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'plum-petal';
    p.style.setProperty('--x0', x0 + 'px');
    p.style.setProperty('--y0', y0 + 'px');
    p.style.setProperty('--x1', (x0 + (i - 1) * 14) + 'px');
    p.style.setProperty('--y1', (sr.height * 0.82) + 'px');
    p.style.setProperty('--r0', (i * 16 - 14) + 'deg');
    p.style.setProperty('--r1', (i * 28 + 24) + 'deg');
    p.style.setProperty('--dur', durs[i] + 's');
    p.style.setProperty('--delay', delays[i] + 'ms');
    const inner = document.createElement('i');
    inner.innerHTML = PETAL_SVG;
    p.appendChild(inner);
    layer.appendChild(p);
    if (!document.documentElement.classList.contains('proposal-freeze')) {
      const life = (durs[i] * 1000) + delays[i] + 40;
      setTimeout(() => p.remove(), life);
    }
  }
}
function petalsSettledMs(n) {
  const durs = [2.6, 2.9, 3.2];
  const delays = [0, 280, 560];
  const i = Math.max(1, Math.min(3, n)) - 1;
  return durs[i] * 1000 + delays[i];
}
function onLotusPin(ev) {
  const { pin, how, already } = ev.detail || {};
  if (!pin || already) return;
  const n = petalCount(pin, how);
  const startIn = reduced() ? 0 : (GLOW_MS + PETAL_AFTER_GLOW);
  setTimeout(() => {
    fallPetals(n);
    const after = reduced() ? 0 : petalsSettledMs(n);
    setTimeout(() => {
      if (R3.moonBreath) breathMoon();
      const breathWait = (R3.moonBreath && !reduced()) ? 400 : 0;
      if (R3.slips) setTimeout(() => flySlip(pin), breathWait);
    }, after);
  }, startIn);
}

/* ---------- 時辰月: compose night + full; never replace night with only 'full' ---------- */
function lunarDay(d = new Date()) {
  const SYN = 29.53058867;
  const epoch = Date.UTC(2000, 0, 6, 18, 14, 0);
  const days = (d.getTime() - epoch) / 86400000;
  const age = ((days % SYN) + SYN) % SYN;
  return Math.floor(age) + 1;
}
function applyShichen(on, clock) {
  const html = document.documentElement;
  if (!on) {
    delete html.dataset.shichen;
    return;
  }
  const h = clock?.hour ?? new Date().getHours();
  const day = clock?.lunarDay ?? lunarDay();
  const tokens = [];
  if (h >= 21 || h < 5) tokens.push('night');
  else if (h >= 5 && h < 7) tokens.push('dawn');
  if (day === 15) tokens.push('full');
  if (tokens.length) html.dataset.shichen = tokens.join(' ');
  else delete html.dataset.shichen;
}
function shichenWanted() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('shichen') === '0') return false;
    if (q.has('shichen')) return true;
    if (localStorage.getItem('readingweb:proposal-shichen') === '1') return true;
    if (localStorage.getItem('readingweb:proposal-shichen') === '0') return false;
  } catch {}
  return !!R3.shichenDefault;
}

/* ---------- passage picking for 留一幀 ---------- */
function glyphCount(s) { return [...s].length; }
function trimPassage(s) {
  let t = String(s || '').replace(/\s+/g, '');
  if (!t) return '';
  if (glyphCount(t) <= 64) return t;
  const chars = [...t].slice(0, 64);
  let cut = -1;
  for (let i = chars.length - 1; i >= 12; i--) {
    if (isPunct(chars[i]) || PUNCT.includes(chars[i])) { cut = i + 1; break; }
  }
  return (cut > 0 ? chars.slice(0, cut) : chars).join('');
}
function isByline(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  if (BYLINE.test(t)) return true;
  if (glyphCount(t) <= 16 && /譯/.test(t)) return true;
  return false;
}
function selectedText() {
  const sel = getSelection && getSelection();
  if (sel && String(sel).trim()) {
    const t = trimPassage(String(sel).trim());
    if (t && !isByline(t)) return t;
  }
  return '';
}
function passageOnScreen() {
  const stage = document.querySelector('#dlgStage');
  const dlgOn = stage && getComputedStyle(stage).display !== 'none';
  if (dlgOn) {
    try {
      const i = window.RW?.reader?.dlg?.idx;
      const raw = (typeof i === 'number' && i >= 0) ? window.RW.reader.dlg.turns?.[i]?.[1] : '';
      const t = trimPassage(String(raw || '').trim());
      if (t && !isByline(t)) return t;
    } catch {}
    const pass = stage.querySelector('.ink-pass .ink-text, .ink-pass');
    const t = trimPassage((pass?.innerText || '').trim());
    if (t && !isByline(t)) return t;
  }
  const doc = document.querySelector('.doc');
  if (doc) {
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const blocks = [...doc.querySelectorAll('[data-anchor], p, h3')];
    let hit = null, fallback = null;
    for (const el of blocks) {
      if (el.closest('.colophon, .sub, .art-head, .art-end')) continue;
      const txt = (el.innerText || '').trim();
      if (!txt || isByline(txt)) continue;
      if (!fallback) fallback = txt;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      if (r.left < cx && r.right > cx && r.top < cy && r.bottom > cy) { hit = txt; break; }
      if (!hit && r.top < cy && r.bottom > 80) hit = txt;
    }
    const t = trimPassage(hit || fallback || '');
    if (t) return t;
  }
  try {
    const id = window.RW?.reader?.id;
    const hls = id && window.RW?.store?.hls?.(id);
    const q = hls && hls[0]?.quote;
    const t = trimPassage(q || '');
    if (t && !isByline(t)) return t;
  } catch {}
  return '';
}
function docTitle() {
  return (document.querySelector('.rbar .title')?.textContent || '').trim()
    || (window.RW?.reader?.info?.short || '');
}
function keepTitle() {
  const t = stripPunct(docTitle());
  const id = window.RW?.reader?.id || '';
  if (/-zh$/.test(id) || /中文/.test(t)) {
    const base = t || '金剛經';
    return /中文/.test(base) ? base : `${base} 中文`;
  }
  return t || '金剛經 中文';
}

/* Phrase-aware 直排 columns. Punctuation is stripped; columns break where the
   marks used to be. ≤32 glyphs (after stripping) use 2 balanced columns;
   never split a phrase such as 還至本處. */
function unitsOf(s) {
  const units = [];
  let cur = '';
  for (const ch of [...String(s || '')]) {
    if (isPunct(ch) || /\s/u.test(ch)) {
      if (cur) { units.push(cur); cur = ''; }
    } else cur += ch;
  }
  if (cur) units.push(cur);
  return units;
}
function packTwo(units) {
  if (!units.length) return [];
  if (units.length === 1) return [units[0]];
  const lens = units.map(u => [...u].length);
  const total = lens.reduce((a, b) => a + b, 0);
  let best = 0, bestDiff = Infinity;
  let acc = 0;
  for (let i = 0; i < units.length - 1; i++) {
    acc += lens[i];
    const diff = Math.abs(acc - (total - acc));
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return [units.slice(0, best + 1).join(''), units.slice(best + 1).join('')].filter(Boolean);
}
function packN(units, colsWanted) {
  if (colsWanted <= 2) return packTwo(units);
  const total = units.reduce((a, u) => a + [...u].length, 0);
  const target = Math.ceil(total / colsWanted);
  const cols = [[]];
  let used = 0;
  for (const u of units) {
    const ul = [...u].length;
    if (used && used + ul > target && cols.length < colsWanted) {
      cols.push([u]);
      used = ul;
    } else {
      cols[cols.length - 1].push(u);
      used += ul;
    }
  }
  return cols.map(c => c.join('')).filter(Boolean);
}
function layoutColumns(text) {
  const units = unitsOf(text);
  const n = units.reduce((a, u) => a + [...u].length, 0);
  if (n <= 32) return packTwo(units);
  return packN(units, Math.min(3, Math.max(2, Math.ceil(n / 16))));
}

function keepCount() {
  try { return Math.max(0, +localStorage.getItem(KEEP_KEY) || 0); } catch { return 0; }
}
function bumpKeepCount() {
  const n = keepCount() + 1;
  try { localStorage.setItem(KEEP_KEY, String(n)); } catch {}
  return n;
}
function paperTone(n) {
  return (n === 3 || n === 10 || n === 32) ? '#EFE7D8' : '#F4EFE6';
}
async function drawKeepPng(text, title, tone) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = tone || '#F4EFE6';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(42,38,33,.28)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(W - 90, H - 70);
  g.quadraticCurveTo(W - 60, H - 86, W - 48, H - 54);
  g.stroke();
  g.beginPath();
  g.moveTo(W - 86, H - 52);
  g.quadraticCurveTo(W - 70, H - 48, W - 54, H - 64);
  g.stroke();

  await document.fonts.ready;
  try { await document.fonts.load('64px "RW Brush"'); } catch {}
  try { await document.fonts.load('64px "Noto Serif TC Sutra"'); } catch {}

  const body = text || '';
  const fs = glyphCount(body) > 40 ? 52 : 64;
  g.font = `${fs}px "RW Brush", "Noto Serif TC Sutra", serif`;
  g.fillStyle = '#2A2621';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cols = layoutColumns(body);
  const lineH = fs * 1.35;
  const colW = fs * 1.55;
  const rows = Math.max(1, ...cols.map(c => [...c].length));
  const blockH = rows * lineH;
  const blockW = Math.max(1, cols.length) * colW;
  const xRight = (W + blockW) / 2 - colW / 2;
  const yTop = (H - blockH) / 2 + lineH / 2;
  cols.forEach((col, ci) => {
    [...col].forEach((ch, ri) => {
      g.fillText(ch, xRight - ci * colW, yTop + ri * lineH);
    });
  });

  if (title) {
    g.font = '28px "Noto Serif TC Sutra", serif';
    g.fillStyle = '#6B6458';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(stripPunct(title), 56, H - 56);
  }
  return await new Promise(res => c.toBlob(b => res(b), 'image/png'));
}

let lastFocus = null, keepBlob = null, trapHandler = null;
function trapFocus(root) {
  const nodes = () => [...root.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
  trapHandler = ev => {
    if (ev.key === 'Escape') { ev.preventDefault(); closeImpression(); return; }
    if (ev.key !== 'Tab') return;
    const list = nodes();
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', trapHandler);
}
function untrap() {
  if (trapHandler) document.removeEventListener('keydown', trapHandler);
  trapHandler = null;
}
function paintImBody(el, passage) {
  el.innerHTML = '';
  for (const col of layoutColumns(passage)) {
    const s = document.createElement('span');
    s.className = 'im-col';
    s.textContent = col;
    el.appendChild(s);
  }
}
async function openImpression(text, title, opener) {
  const passage = trimPassage(text || selectedText() || passageOnScreen());
  if (!passage) return;
  const meta = title || keepTitle();
  const n = keepCount() + 1;
  const tone = paperTone(n);
  keepBlob = null;
  window.__keepPending = { passage, meta, tone };
  lastFocus = (opener && opener.focus) ? opener : (document.activeElement && document.activeElement.classList?.contains('keep-frame-btn') ? document.activeElement : keepBtn);
  let root = document.querySelector('.impression');
  if (!root) {
    root = document.createElement('div');
    root.className = 'impression';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '留一幀');
    root.innerHTML = `<div class="impression-sheet">
      <div class="im-body"></div>
      <div class="im-meta"></div>
      <i class="im-corner" aria-hidden="true"></i>
      <div class="impression-actions">
        <button type="button" class="im-share" aria-label="分享">${SHARE_ICON}</button>
        <button type="button" class="im-save" aria-label="下載">${SAVE_ICON}</button>
        <button type="button" class="im-close" aria-label="關閉">${CLOSE_ICON}</button>
      </div>
    </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', ev => { if (ev.target === root) closeImpression(); });
    root.querySelector('.im-close').addEventListener('click', closeImpression);
    root.querySelector('.im-share').addEventListener('click', () => shareKeep(true));
    root.querySelector('.im-save').addEventListener('click', () => shareKeep(false));
  }
  root.querySelector('.impression-sheet').classList.toggle('is-deep', tone === '#EFE7D8');
  paintImBody(root.querySelector('.im-body'), passage);
  root.querySelector('.im-meta').textContent = stripPunct(meta);
  root.hidden = false;
  trapFocus(root);
  const focusBtn = root.querySelector('.im-share');
  (focusBtn || root.querySelector('.im-close')).focus();
}
function closeImpression() {
  const root = document.querySelector('.impression');
  if (root) root.hidden = true;
  untrap();
  const back = (lastFocus && lastFocus.classList?.contains('keep-frame-btn'))
    ? lastFocus
    : (keepBtn && keepBtn.classList.contains('is-in') ? keepBtn : null);
  lastFocus = null;
  if (back && typeof back.focus === 'function') {
    try { back.focus(); } catch {}
  }
}
async function shareKeep(preferShare) {
  if (!keepBlob) {
    const k = window.__keepPending;
    if (!k) return;
    keepBlob = await drawKeepPng(k.passage, k.meta, k.tone);
  }
  const file = new File([keepBlob], 'liuyizhen.png', { type: 'image/png' });
  let shared = false;
  if (preferShare && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); shared = true; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (!shared) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(keepBlob);
    a.download = 'liuyizhen.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  bumpKeepCount();
}

let keepBtn = null, keepTimer = 0;
function hideKeep() {
  clearTimeout(keepTimer);
  if (keepBtn) keepBtn.classList.remove('is-in');
}
function scheduleKeep() {
  clearTimeout(keepTimer);
  const stage = document.querySelector('#dlgStage');
  const dlgOn = stage && getComputedStyle(stage).display !== 'none';
  const reader = document.querySelector('.reader');
  const reading = reader && getComputedStyle(reader).display !== 'none';
  if (!dlgOn && !reading) { hideKeep(); if (keepBtn) keepBtn.hidden = true; return; }
  if (dlgOn && (window.RW?.reader?.dlg?.playing || stage.classList.contains('is-playing'))) {
    hideKeep();
    ensureKeep();
    keepBtn.hidden = false;
    return;
  }
  ensureKeep();
  keepBtn.hidden = false;
  keepTimer = setTimeout(() => { if (keepBtn) keepBtn.classList.add('is-in'); }, R3.keepStillMs);
}
function ensureKeep() {
  if (keepBtn && document.body.contains(keepBtn)) return keepBtn;
  keepBtn = document.createElement('button');
  keepBtn.type = 'button';
  keepBtn.className = 'keep-frame-btn';
  keepBtn.setAttribute('aria-label', '留一幀');
  keepBtn.title = '留一幀';
  keepBtn.innerHTML = FRAME_ICON;
  keepBtn.addEventListener('click', () => openImpression(undefined, undefined, keepBtn));
  document.body.appendChild(keepBtn);
  return keepBtn;
}
function bindStillness() {
  const bump = () => { hideKeep(); scheduleKeep(); };
  addEventListener('scroll', bump, { passive: true, capture: true });
  document.addEventListener('rw:dlg-page', bump);
  document.addEventListener('rw:dlg-play', ev => {
    if (ev.detail?.playing) hideKeep();
    else scheduleKeep();
  });
}

const brushedIds = new Set();
let pendingNewHl = false;
function armNewHl() { pendingNewHl = true; }
function onHlListMut(list) {
  if (!pendingNewHl) return;
  const items = [...list.querySelectorAll('.hl-item')];
  const fresh = items.find(it => !brushedIds.has(it.dataset.id));
  if (!fresh) return;
  pendingNewHl = false;
  brushedIds.add(fresh.dataset.id);
  if (fresh.querySelector('.brush-line')) return;
  const line = document.createElement('i');
  line.className = 'brush-line is-new';
  line.setAttribute('aria-hidden', 'true');
  fresh.appendChild(line);
}
function watchNotes() {
  const list = document.querySelector('#hlList');
  if (!list || list.dataset.r3Brush === '1') return;
  list.dataset.r3Brush = '1';
  const mo = new MutationObserver(() => onHlListMut(list));
  mo.observe(list, { childList: true });
  document.getElementById('selbar')?.addEventListener('click', ev => {
    if (ev.target.closest('[data-color], .sw')) armNewHl();
  });
}

/* ---------- 墨觸 ---------- */
let ripples = [];
function glyphBox() {
  const el = document.querySelector('#dlgStage .ink-pass, #dlgStage .ink-text');
  return el ? el.getBoundingClientRect() : null;
}
function tooCloseToGlyphs(x, y, pad = 32) {
  const r = glyphBox();
  if (!r) return false;
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}
function nearChrome(x, y, pad = 8) {
  const sels = '.ink-lotus, .ink-moon, .jian-fab, .ink-playbar, .ink-scrub, .keep-frame-btn, .ink-lotus-finale, .ink-lotus-tip, .ink-tools, .ink-toc';
  for (const el of document.querySelectorAll(sels)) {
    const r = el.getBoundingClientRect();
    if (r.width && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return true;
  }
  return false;
}
function spawnRipple(x, y, size, extraClass) {
  const stage = document.querySelector('#dlgStage');
  if (!stage) return null;
  let layer = stage.querySelector('.ink-ripple-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'ink-ripple-layer';
    layer.setAttribute('aria-hidden', 'true');
    const bg = stage.querySelector('.ink-bg');
    if (bg && bg.nextSibling) stage.insertBefore(layer, bg.nextSibling);
    else stage.insertBefore(layer, stage.firstChild);
  }
  while (ripples.length >= 2) {
    const old = ripples.shift();
    if (old.t) clearTimeout(old.t);
    old.el.style.transition = 'opacity .2s ease';
    old.el.style.opacity = '0';
    setTimeout(() => old.el.remove(), 200);
  }
  const r = document.createElement('i');
  r.className = 'ink-ripple' + (extraClass ? ' ' + extraClass : '');
  const sr = stage.getBoundingClientRect();
  r.style.left = (x - sr.left) + 'px';
  r.style.top = (y - sr.top) + 'px';
  r.style.setProperty('--r', size + 'px');
  layer.appendChild(r);
  const rec = { el: r, t: 0 };
  ripples.push(rec);
  rec.t = setTimeout(() => {
    r.remove();
    ripples = ripples.filter(x => x !== rec);
  }, reduced() ? 340 : (extraClass === 'is-breath' ? 1300 : 960));
  return rec;
}
function gutterBreath() {
  if (!R3.firstGutterBreath) return;
  try { if (sessionStorage.getItem('rw:r3-gutter-breath') === '1') return; } catch {}
  const stage = document.querySelector('#dlgStage');
  if (!stage || getComputedStyle(stage).display === 'none') return;
  try { sessionStorage.setItem('rw:r3-gutter-breath', '1'); } catch {}
  const sr = stage.getBoundingClientRect();
  const field = stage.querySelector('#inkField');
  const pad = field ? (parseFloat(getComputedStyle(field).paddingLeft) || 72) : 72;
  const x = sr.left + Math.max(28, pad * 0.45);
  const y = sr.top + sr.height * 0.62;
  spawnRipple(x, y, 12, 'is-breath');
}
function bindRipple() {
  if (!R3.touchHold && !R3.touchTap) return;
  const stage = document.querySelector('#dlgStage');
  if (!stage) return;
  if (getComputedStyle(stage).display === 'none') return;
  if (stage.dataset.r2Touch === '1') return;
  stage.dataset.r2Touch = '1';
  let holdT = 0, holding = false, rec = null, start = null;
  const clearHold = () => { clearTimeout(holdT); holdT = 0; };
  stage.addEventListener('pointerdown', ev => {
    if (ev.target.closest('.ink-tools, .ink-toc, .ink-lotus, .ink-lotus-finale, .ink-lotus-tip, .ink-playbar, .ink-scrub, .ink-moon, .plum-layer, .jian-fab, .keep-frame-btn')) return;
    if (nearChrome(ev.clientX, ev.clientY, 8)) return;
    start = { x: ev.clientX, y: ev.clientY };
    holding = false;
    rec = null;
    const far = !tooCloseToGlyphs(ev.clientX, ev.clientY, 32);
    const size = matchMedia('(max-width:360px)').matches ? 90 : 120;
    if (R3.touchTap && far) rec = spawnRipple(ev.clientX, ev.clientY, size);
    clearHold();
    if (!R3.touchHold) return;
    holdT = setTimeout(() => {
      holding = true;
      const grow = matchMedia('(max-width:360px)').matches ? 140 : 180;
      if (!rec) rec = spawnRipple(start.x, start.y, grow);
      rec.el.classList.add('is-hold');
      rec.el.style.setProperty('--r', grow + 'px');
      rec.el.style.opacity = '1';
      rec.el.style.transform = 'translate(-50%,-50%) scale(1)';
    }, 600);
  });
  const endHold = ev => {
    clearHold();
    if (holding && rec) {
      rec.el.style.opacity = '0';
      const self = rec;
      setTimeout(() => { self.el.remove(); ripples = ripples.filter(x => x !== self); }, 420);
    }
    if (holding) {
      const block = ev2 => { ev2.stopImmediatePropagation(); ev2.preventDefault(); };
      stage.addEventListener('click', block, { capture: true, once: true });
    }
    holding = false;
  };
  stage.addEventListener('pointerup', endHold);
  stage.addEventListener('pointercancel', endHold);
}

/* ---------- 箋匣 ---------- */
function ensureDialogueSrc() {
  if (window.RW_DIALOGUE?.['diamond-zh']) return Promise.resolve();
  const src = new URL('texts/diamond-zh.js', document.baseURI).href;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
function slipText(pin) {
  const dlg = window.RW?.reader?.dlg;
  const ranges = dlg?.lotus?.ranges || window.__lotusRanges;
  const turns = dlg?.turns || window.__dlgTurns;
  if (!ranges || !turns) {
    const id = 'diamond-zh';
    const src = window.RW_DIALOGUE?.[id];
    if (!src) return null;
    const titles = [];
    src.forEach((t, i) => { if (t[0] === 't') titles.push(i); });
    if (titles.length !== 32 || pin < 1 || pin > 32) return null;
    const start = titles[pin - 1];
    const end = pin < 32 ? titles[pin] - 1 : src.length - 1;
    const title = String(src[start][1] || '').split('\n')[0];
    let first = '';
    for (let i = start + 1; i <= end; i++) {
      if (src[i][0] !== 't') { first = String(src[i][1] || '').split('\n')[0]; break; }
    }
    return { title, first };
  }
  const r = ranges[pin - 1];
  if (!r) return null;
  const title = String(turns[r.start]?.[1] || '').split('\n')[0];
  let first = '';
  for (let i = r.start + 1; i <= r.end; i++) {
    if (turns[i][0] !== 't') { first = String(turns[i][1] || '').split('\n')[0]; break; }
  }
  return { title, first };
}
function earnedPins() {
  try {
    const raw = JSON.parse(localStorage.getItem('readingweb:v1') || '{}');
    const d = raw?.settings?.dlgLotus?.['diamond-zh']?.done;
    if (Array.isArray(d)) return d.filter(n => n >= 1 && n <= 32);
  } catch {}
  try { return window.RW?.reader?.dlg?.lotus?.done?.() || []; } catch {}
  return [];
}
function updateFabCount(opts = {}) {
  const fab = document.querySelector('.jian-fab');
  if (!fab) return;
  const n = earnedPins().length;
  let mark = fab.querySelector('.jian-count');
  if (!mark) {
    mark = document.createElement('b');
    mark.className = 'jian-count';
    mark.setAttribute('aria-hidden', 'true');
    fab.appendChild(mark);
  }
  const next = n ? String(n) : '';
  const changed = mark.textContent !== next;
  mark.textContent = next;
  fab.setAttribute('aria-label', `箋匣 已得 ${n} 品 共 32 品`);
  if (opts.tick && changed && n && R3.fabTick && !reduced()) {
    mark.classList.remove('is-tick');
    void mark.offsetWidth;
    mark.classList.add('is-tick');
    setTimeout(() => mark.classList.remove('is-tick'), 260);
  }
}
function fillSlipGrid(grid) {
  const done = new Set(earnedPins());
  if (grid.childElementCount !== 32) {
    grid.innerHTML = '';
    for (let pin = 1; pin <= 32; pin++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'jian-slip';
      b.dataset.pin = String(pin);
      b.addEventListener('click', async () => {
        if (!b.classList.contains('is-earned')) return;
        await ensureDialogueSrc();
        const s = slipText(pin);
        // Body is the first line only; title stays in the sheet meta as its own field.
        // Never concatenate title+first (that painted 法會因由分第一如是我聞 as one column).
        const passage = s ? trimPassage(s.first || s.title || '') : '';
        if (passage) openImpression(passage, s?.title || keepTitle());
      });
      grid.appendChild(b);
    }
  }
  grid.querySelectorAll('.jian-slip').forEach(b => {
    const pin = +b.dataset.pin;
    const on = done.has(pin);
    b.classList.toggle('is-earned', on);
    b.disabled = !on;
    const s = on ? slipText(pin) : null;
    b.textContent = on && s ? stripPunct(s.title || '') : '';
    b.setAttribute('aria-label', on && s ? `詩箋 第${pin}品 ${stripPunct(s.title)}` : `第${pin}品 未得`);
  });
}
function openJianSheet() {
  if (!R3.slips) return;
  let root = document.querySelector('.jian-sheet');
  if (!root) {
    root = document.createElement('div');
    root.className = 'jian-sheet';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '箋匣');
    root.innerHTML = `<div class="jian-sheet-panel">
      <div class="jian-sheet-grid"></div>
      <button type="button" class="jian-sheet-close" aria-label="關閉">${CLOSE_ICON}</button>
    </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', ev => { if (ev.target === root) closeJianSheet(); });
    root.querySelector('.jian-sheet-close').addEventListener('click', closeJianSheet);
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && root && !root.hidden) closeJianSheet();
    });
  }
  fillSlipGrid(root.querySelector('.jian-sheet-grid'));
  root.hidden = false;
  root.querySelector('.jian-sheet-close').focus();
}
function closeJianSheet() {
  const root = document.querySelector('.jian-sheet');
  if (root) root.hidden = true;
}
function placeJianTile() {
  if (!R3.slips) return;
  const row = document.querySelector('.datarow');
  if (!row) return;
  let tile = row.querySelector('.jian-tile');
  if (!tile) {
    tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'jian-tile';
    tile.setAttribute('aria-label', '箋匣');
    tile.innerHTML = JIAN_ICON;
    const btns = row.querySelector('.dr-btns');
    if (btns) row.insertBefore(tile, btns);
    else row.appendChild(tile);
    tile.addEventListener('click', ev => { ev.preventDefault(); openJianSheet(); });
  }
}
async function renderJianBox() {
  if (!R3.slips) return;
  await ensureDialogueSrc();
  placeJianTile();
  const sheet = document.querySelector('.jian-sheet:not([hidden]) .jian-sheet-grid');
  if (sheet) fillSlipGrid(sheet);
  updateFabCount();
}
function ensureJianFab() {
  if (!R3.slips) return null;
  const stage = document.querySelector('#dlgStage');
  if (!stage || getComputedStyle(stage).display === 'none') return null;
  let fab = stage.querySelector('.jian-fab');
  if (!fab) {
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'jian-fab';
    fab.setAttribute('aria-label', '箋匣 已得 0 品 共 32 品');
    fab.innerHTML = JIAN_ICON;
    fab.addEventListener('click', ev => {
      ev.stopPropagation();
      openJianSheet();
    });
    stage.appendChild(fab);
  }
  updateFabCount();
  return fab;
}
function flySlip(pin) {
  if (!R3.slips) return;
  const moon = document.querySelector('.ink-moon') || document.querySelector('.ink-lotus');
  const fab = ensureJianFab();
  slipText(pin);
  if (!moon || !fab) { renderJianBox(); return; }
  const a = moon.getBoundingClientRect();
  const b = fab.getBoundingClientRect();
  const flyer = document.createElement('i');
  flyer.className = 'jian-flyer';
  flyer.setAttribute('aria-hidden', 'true');
  flyer.style.left = a.left + 'px';
  flyer.style.top = a.top + 'px';
  flyer.style.opacity = '1';
  document.body.appendChild(flyer);
  const dx = b.left - a.left, dy = b.top - a.top;
  const land = () => {
    flyer.remove();
    updateFabCount({ tick: true });
    renderJianBox();
  };
  if (reduced()) {
    flyer.style.opacity = '0';
    setTimeout(land, 300);
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    flyer.style.transform = `translate(${dx}px, ${dy}px) scale(.7)`;
    flyer.style.opacity = '0';
  }));
  setTimeout(land, 740);
}

function onDlgOpen() {
  const stage = document.querySelector('#dlgStage');
  const dlgOn = stage && getComputedStyle(stage).display !== 'none';
  if (!dlgOn) return;
  ensureMoon();
  const i = window.RW?.reader?.dlg?.idx;
  if (typeof i === 'number' && i >= 0) {
    moonPage = i;
    paintMoon(phaseOf(i), { animate: false, glow: phaseOf(i) >= 1 });
  }
  bindRipple();
  ensureJianFab();
  scheduleKeep();
  gutterBreath();
  if (shichenWanted()) applyShichen(true);
}

function onRoute() {
  const hash = location.hash || '';
  if (hash === '#/library' || hash === '' || hash === '#/') renderJianBox();
  const stage = document.querySelector('#dlgStage');
  const dlgOn = stage && getComputedStyle(stage).display !== 'none';
  if (dlgOn) onDlgOpen();
  watchNotes();
  scheduleKeep();
  if (shichenWanted()) applyShichen(true);
}

function boot() {
  addEventListener('hashchange', () => setTimeout(onRoute, 50));
  document.addEventListener('rw:dlg-page', onDlgPage);
  document.addEventListener('rw:lotus-pin', onLotusPin);
  document.addEventListener('rw:lotus-reset', () => { scrubbedPins.clear(); renderJianBox(); });
  document.addEventListener('rw:dlg-open', onDlgOpen);
  document.addEventListener('visibilitychange', () => { if (shichenWanted()) applyShichen(true); });
  bindStillness();
  const view = document.getElementById('view');
  if (view) {
    const mo = new MutationObserver(() => onRoute());
    mo.observe(view, { childList: true });
  }
  onRoute();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

window.__proposal = {
  features: R3, R3,
  phaseOf, moonPath, paintMoon, fallPetals, petalCount, breathMoon,
  openImpression, passageOnScreen, trimPassage, isByline, keepTitle,
  drawKeepPng, layoutColumns, unitsOf, isPunct, stripPunct,
  renderJianBox, flySlip, openJianSheet, applyShichen, shichen: applyShichen,
  spawnRipple, tooCloseToGlyphs, bindRipple, ensureJianFab, scheduleKeep, hideKeep,
};
window.__proposalShichen = on => {
  try { localStorage.setItem('readingweb:proposal-shichen', on ? '1' : '0'); } catch {}
  applyShichen(!!on);
};
