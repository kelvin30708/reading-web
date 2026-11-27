// 對話 Dialogue mode — "ink in the dark": one passage (one speaker turn, or a screen-sized part of a long one)
// writes itself character by character in brush script on a near-black screen, holds, then dissolves like ink.
// Speakers are told apart by ink colour only — there is no vermilion name-seal, so the screen stays quiet.
// The sutra's own speaker leads (佛告須菩提、須菩提白佛言、佛告具壽善現曰, 善現答言, and so on) are their own narration-colour pages, styled like 如是我聞, and sit immediately before the speech page. Punctuation is still not drawn. Classic four-phrase 偈 stay one page, one line per phrase, without the lead.
// A vocative 須菩提 / 善現 in a 世尊 speech is its own page, in the speaker's colour, before the rest of the speech. Short replies (不也世尊, 如是世尊, 甚多世尊, and similar) are their own page. The formula questions 於意云何 / 於汝意云何 and 何以故 / 所以者何 are each their own page, in the speaker's colour, then the rest of the speech follows. Long passages stay at the largest size step and split across pages at phrase breaks; the type shrinks only when a single phrase cannot fit.
// Passages come from window.RW_DIALOGUE[id] = [speaker, text, reading-block index].
// t = title card; n = narration; b = 世尊; s = Subhūti / 善現;
// m = 曼殊室利; a = 阿難; j = 救脫; y = 十二藥叉大將; i = intro.
// The reading view (.doc) stays in the DOM untouched, so highlights, notes, cards and links keep their anchors;
// the dark stage is a read-only presentation (no [data-anchor]) — mark text in 閱讀 Reading.
const SPK_BY = {
  'diamond-xz': { b: { name: '世尊', en: 'The Buddha' }, s: { name: '善現', en: 'Subhūti' } },
  'diamond-zh': { b: { name: '世尊', en: 'The Buddha' }, s: { name: '須菩提', en: 'Subhūti' } },
  'medicine-zh': {
    b: { name: '世尊', en: 'The Buddha' },
    m: { name: '曼殊室利', en: 'Mañjuśrī' },
    a: { name: '阿難', en: 'Ānanda' },
    j: { name: '救脫', en: 'Salvation Bodhisattva' },
    y: { name: '藥叉', en: 'The twelve yakṣa generals' }
  }
};
const INTRO = {
  'diamond-xz': ['能斷金剛分', '玄奘譯'],
  'diamond-zh': ['金剛般若波羅蜜經', '鳩摩羅什譯'],
  'medicine-zh': ['藥師琉璃光如來本願功德經', '玄奘譯'],
  'qixin-zh': ['大乘起信論', '馬鳴菩薩造 · 真諦譯']
};
const SPEEDS = [{ k: 0.7, step: 150, t: '慢', en: 'slow' }, { k: 1, step: 110, t: '中', en: 'normal' }, { k: 1.7, step: 75, t: '快', en: 'fast' }];
const MINOR = /[，；：,;:]/, ENUM = /[、､]/, MAJOR = /[。！？!?．\s\u3000]/, DROP = /[「」『』《》〈〉（）()\[\]【】"'“”‘’·・—–…～~﹁﹂﹃﹄]/;
const OPEN = /[「『（《〈【“‘﹁﹃(\[]/;
// Narrator frames spoken by Ānanda (佛告須菩提, 須菩提白佛言, 佛言, 曼殊室利言, 阿難白言, 而說偈言, …).
const LEAD_RE = /^((?:說是語已[，、]?|作是語已[，、]?)?(?:爾時[，、]?)?(?:(?:佛復告|佛告|世尊[，、]?復告|世尊告|世尊讚諸?)[^「」：:。！？，、；\n]{0,16}(?:曰|言)?|佛言|世尊而說(?:偈言|頌曰)|(?:同時舉聲)?[^「」：:。！？，、；\n]{0,16}(?:復|即)?(?:白佛言|白言|答言|問[^「」：:。！？，、；\n]{0,12}言|言曰|言[「：:]))[「：:]?)/;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Short Subhūti (or similar) replies: 不也，世尊！ / 如是！世尊！如是！善逝！ / 甚多，世尊！ …
const REPLY_HEAD = /^(?:(?:不也|不爾|否也|不然|如是|甚多|唯然|希有)[，、！!]?\s*)+(?:世尊|善逝)[！!。]?(?:(?:不也|不爾|否也|不然|如是|甚多|唯然|希有)[，、！!]?\s*(?:世尊|善逝)[！!。]?)*/;
const VOC_TOKEN = /(?:須菩提|善現)[！!]/g;
const FORMULA_TOKEN = /(?:於汝意云何|於意云何|所以者何|何以故)[？?]?/g;
const displayGlyphs = s => {
  let n = 0;
  for (const c of s) if (!DROP.test(c) && !ENUM.test(c) && !MINOR.test(c) && !MAJOR.test(c) && c !== '\n') n++;
  return n;
};
const splitVocatives = text => {
  const segs = [];
  let last = 0;
  VOC_TOKEN.lastIndex = 0;
  let m;
  while ((m = VOC_TOKEN.exec(text))) {
    const at = m.index, prev = at > 0 ? text[at - 1] : '';
    // vocative: at start, or after punctuation / close-quote — not mid-word (長老須菩提)
    if (at > 0 && !/[。！？!?．\n、，』」]/.test(prev)) continue;
    if (at > last && displayGlyphs(text.slice(last, at))) segs.push(text.slice(last, at));
    segs.push(m[0]);
    last = at + m[0].length;
  }
  if (last < text.length && displayGlyphs(text.slice(last))) segs.push(text.slice(last));
  return segs.length ? segs : [text];
};
const splitContent = (k, text) => {
  let parts = [text];
  if (k !== 't' && k !== 'n' && k !== 'i' && k !== 'b') {
    parts = parts.flatMap(p => {
      const m = p.match(REPLY_HEAD);
      if (!m) return [p];
      const rest = p.slice(m[0].length);
      return displayGlyphs(rest) ? [m[0], rest] : [p];
    });
  }
  if (k === 'b') parts = parts.flatMap(splitVocatives);
  if (k !== 't' && k !== 'n' && k !== 'i') parts = parts.flatMap(splitFormulas);
  return parts;
};
const splitFormulas = text => {
  const segs = [];
  let last = 0;
  FORMULA_TOKEN.lastIndex = 0;
  let m;
  while ((m = FORMULA_TOKEN.exec(text))) {
    const at = m.index, prev = at > 0 ? text[at - 1] : '';
    if (at > 0 && !/[。！？!?．\n、，』」]/.test(prev)) continue;
    if (at > last && displayGlyphs(text.slice(last, at))) segs.push(text.slice(last, at));
    segs.push(m[0]);
    last = at + m[0].length;
  }
  if (last < text.length && displayGlyphs(text.slice(last))) segs.push(text.slice(last));
  return segs.length ? segs : [text];
};
export function expandDialogue(src) {
  const out = [];
  for (const [k, text, block] of src) for (const part of splitContent(k, text)) out.push([k, part, block]);
  return out;
};
const phraseUnits = text => {
  const units = [];
  let cur = '';
  for (const c of text) {
    cur += c;
    if (ENUM.test(c)) continue; // enumeration list stays one phrase (no gap, no page-split)
    if (MINOR.test(c) || MAJOR.test(c)) { units.push(cur); cur = ''; }
  }
  if (cur) units.push(cur);
  const glued = [];
  for (const u of units) {
    if (glued.length && displayGlyphs(u) <= 2) glued[glued.length - 1] += u;
    else glued.push(u);
  }
  if (glued.length > 1 && displayGlyphs(glued[0]) <= 2) { glued[1] = glued[0] + glued[1]; glued.shift(); }
  return glued.length ? glued : [text];
};

const ico = {
  prev: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg class="i-play" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3 L13 8 L5 13 Z" fill="currentColor"/></svg><svg class="i-pause" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 3.5v9M10.8 3.5v9" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>',
  restart: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v2.5h2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 9 L7 5 L11 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function setupDialogue(R, { store, $, $$, esc, announce, debounce, hideBar, fs }) {
  const srcDlg = window.RW_DIALOGUE?.[R.id];
  if (!srcDlg || !srcDlg.length) return;
  const rawTurns = expandDialogue(srcDlg);
  let turns = rawTurns, N = turns.length;
  const SPK = SPK_BY[R.id] || {};
  const introLines = INTRO[R.id] || ['', ''];
  const st = store.data.settings;
  const posMap = (st.dlgPos ||= {});
  const modeMap = (st.modeByDoc ||= {});
  const rd = $('.reader');
  const root = document.documentElement;
  R.mode = 'read';

  // ---------- the stage ----------
  const stage = document.createElement('section');
  stage.className = 'ink'; stage.id = 'dlgStage'; stage.setAttribute('lang', 'zh-Hant'); stage.setAttribute('aria-label', '對話 Dialogue'); stage.tabIndex = -1;
  stage.dataset.vert = st.dlgVert === false ? '0' : '1';
  stage.innerHTML = `<div class="ink-bg" aria-hidden="true"><i class="ink-cloud ink-cloud-a"></i><i class="ink-cloud ink-cloud-b"></i></div>
    <div class="ink-field" id="inkField"></div>
    <button type="button" class="ink-lotus" id="inkLotus" hidden aria-label="蓮花進度 已完成 0/32 品" title="蓮花進度"></button>
    <p class="ink-lotus-tip" id="inkLotusTip" hidden role="status">已完成 0/32 品</p>
    <div class="ink-lotus-finale" id="inkLotusFinale" hidden></div>
    <p class="ink-hint" id="inkHint" aria-hidden="true"><span class="ink-hint-phone">左／中 下一頁 · 右 上一頁</span><span class="ink-hint-desk">輕點繼續 · Tap, Space or → · ← back · P plays</span></p>
    <div class="ink-edges" aria-hidden="true"><span class="ink-edge ink-edge-next">‹</span><span class="ink-edge ink-edge-prev">›</span></div>
    <div class="ink-scrub" id="inkScrub">
      <p class="ink-scrub-lab" id="inkScrubLab" hidden></p>
      <div class="ink-scrub-hit" id="inkScrubHit">
        <div class="ink-scrub-track">
          <span class="ink-scrub-ticks" id="inkScrubTicks" aria-hidden="true"></span>
          <i class="ink-scrub-fill" id="inkProg"></i>
          <i class="ink-scrub-thumb" id="inkScrubThumb"></i>
        </div>
      </div>
    </div>
    <div class="ink-playbar" id="inkPlaybar">
      <button type="button" class="ink-playbtn" data-a="play" aria-pressed="false" aria-label="自動播放 Auto-play" title="自動播放 Auto-play">${ico.play}</button>
      <button type="button" class="ink-speedbtn" data-a="speed" aria-label="速度 Speed: normal" title="速度 Speed">中</button>
    </div>
    <div class="ink-tools" id="inkTools">
      <button type="button" class="ink-dot" id="inkDot" aria-expanded="false" aria-label="Show dialogue tools 顯示工具" title="Show dialogue tools 顯示工具"></button>
      <div class="ink-row" id="inkRow" role="toolbar" aria-label="Dialogue tools 對話工具">
        <button type="button" class="ik ik-read" data-a="read" aria-label="閱讀 Switch to Reading" title="閱讀 Reading">閱讀</button>
        <button type="button" class="ik" data-a="prev" aria-label="上一段 Previous (←)" title="上一段 Previous (←)">${ico.prev}</button>
        <button type="button" class="ik ik-play" data-a="play" aria-pressed="false" aria-label="自動播放 Auto-play" title="自動播放 Auto-play (P)">${ico.play}</button>
        <button type="button" class="ik ik-speed" data-a="speed" aria-label="" title="速度 Speed"></button>
        <button type="button" class="ik ik-vert" data-a="vert" aria-pressed="true" aria-label="直排 / 橫排 Vertical or horizontal" title="直排 / 橫排"></button>
        <button type="button" class="ik ik-toc" data-a="toc" aria-label="目錄 Contents" title="目錄 Contents">目錄</button>
        <button type="button" class="ik" data-a="restart" aria-label="從頭開始 Restart" title="從頭開始 Restart">${ico.restart}</button>
        <button type="button" class="ik fs-btn" data-a="fs" hidden aria-label="Full screen 全螢幕"></button>
        <button type="button" class="ik ik-lotus" data-a="lotus-reset" hidden aria-label="重設蓮花進度 Reset lotus progress" title="重設蓮花進度">蓮</button>
        <button type="button" class="ik" data-a="close" aria-label="Hide tools 收起工具" title="Hide tools 收起工具">${ico.close}</button>
      </div>
    </div>
    <div class="ink-toc" id="inkToc" hidden role="dialog" aria-label="目錄 Contents"><button type="button" class="ik ink-toc-x" id="inkTocX" aria-label="Close contents 關閉目錄">✕</button><ol id="inkTocList"></ol></div>
    <p class="sr-only" id="dlgLive" aria-live="polite"></p>`;
  R.root.appendChild(stage);
  const field = $('#inkField', stage), hint = $('#inkHint', stage), prog = $('#inkProg', stage), live = $('#dlgLive', stage);
  const tools = $('#inkTools', stage), tocEl = $('#inkToc', stage);
  const lotusBtn = $('#inkLotus', stage), lotusTip = $('#inkLotusTip', stage), lotusFinaleEl = $('#inkLotusFinale', stage);
  const btn = a => $(`[data-a="${a}"]`, stage);

  // ---------- state ----------
  let idx = -1, phase = 'idle', playing = false, tWrite = 0, tHold = 0, tOut = 0, tPeek = 0, tHint = 0, tFinale = 0, tLotusTip = 0, tLotusLong = 0, tScrub = 0, pendingNext = null, started = false;
  let speedI = SPEEDS.findIndex(s => s.k === st.dlgSpeed); if (speedI < 0) speedI = 1;
  const cur = () => field.firstElementChild;
  const lenOf = i => (i < 0 ? introLines.join('').length : turns[i][1].replace(/\n/g, '').length);
  const savePos = debounce(() => { if (!R.dead) { posMap[R.id] = idx + 1; store.save(); } }, 300);

  // ---------- 32-petal lotus (Diamond Sutra 品 progress) ----------
  // A 品 is complete when the reader reaches that 品's last page (the page before the next title, or N-1 for 品 32).
  // Order-independent; persisted per text id. Finale auto-plays once on a user-facing mount (write/fade), not on instant show().
  const hasLotus = rawTurns.filter(t => t[0] === 't').length === 32;
  let lotusRanges = null;
  const refreshLotusRanges = () => {
    if (!hasLotus) { lotusRanges = null; return; }
    const titleIdx = [];
    for (let i = 0; i < N; i++) if (turns[i][0] === 't') titleIdx.push(i);
    lotusRanges = titleIdx.length === 32
      ? titleIdx.map((start, k) => ({ pin: k + 1, start, end: k + 1 < titleIdx.length ? titleIdx[k + 1] - 1 : N - 1 }))
      : null;
  };
  refreshLotusRanges();
  const pinOfLastPage = i => {
    if (!lotusRanges || i < 0) return 0;
    const r = lotusRanges.find(x => x.end === i);
    return r ? r.pin : 0;
  };
  const loadLotus = () => {
    const raw = ((st.dlgLotus ||= {})[R.id]) || { done: [], finale: false };
    const done = new Set((raw.done || []).filter(n => n >= 1 && n <= 32));
    return { done, finale: !!raw.finale };
  };
  const lotusState = loadLotus();
  let finalePlaying = false, lotusLongFired = false;
  const persistLotus = () => {
    (st.dlgLotus ||= {})[R.id] = { done: [...lotusState.done].sort((a, b) => a - b), finale: !!lotusState.finale };
    store.save();
  };
  const petalD = (r0, r1, w) => {
    const y0 = 50 - r0, y1 = 50 - r1, ym = (y0 + y1) / 2;
    return `M50,${y0.toFixed(2)} C${(50 + w).toFixed(2)},${ym.toFixed(2)} ${(50 + w * 0.42).toFixed(2)},${(y1 + 3).toFixed(2)} 50,${y1.toFixed(2)} C${(50 - w * 0.42).toFixed(2)},${(y1 + 3).toFixed(2)} ${(50 - w).toFixed(2)},${ym.toFixed(2)} 50,${y0.toFixed(2)} Z`;
  };
  const buildLotusSvg = () => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<defs>
      <linearGradient id="lotusInk" x1="26" y1="18" x2="80" y2="88" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f4e2c6"/><stop offset="45%" stop-color="#e8c4b0"/><stop offset="100%" stop-color="#d9a8a0"/>
      </linearGradient>
    </defs>`;
    const rings = [
      { n: 8, r0: 10, r1: 32, w: 7.6, rot: 0 },
      { n: 8, r0: 22, r1: 42.5, w: 8.0, rot: 22.5 },
      { n: 16, r0: 36, r1: 48.6, w: 6.15, rot: 11.25 },
    ];
    // Draw outer ring first so the heart sits on top; pin numbers still run inner → outer (1–8, 9–16, 17–32).
    const groups = rings.map(() => document.createElementNS(NS, 'g'));
    let pin = 1;
    rings.forEach((ring, ri) => {
      const g = groups[ri];
      g.setAttribute('class', 'lotus-ring lotus-ring-' + ri);
      for (let i = 0; i < ring.n; i++) {
        const ang = ring.rot + i * (360 / ring.n);
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', petalD(ring.r0, ring.r1, ring.w));
        p.setAttribute('class', 'pt pt-r' + ri);
        p.dataset.pin = String(pin++);
        p.style.setProperty('--ang', ang + 'deg');
        g.appendChild(p);
      }
    });
    for (let i = groups.length - 1; i >= 0; i--) svg.appendChild(groups[i]);
    const seed = document.createElementNS(NS, 'circle');
    seed.setAttribute('class', 'lotus-seed'); seed.setAttribute('cx', '50'); seed.setAttribute('cy', '50'); seed.setAttribute('r', '7');
    const heart = document.createElementNS(NS, 'circle');
    heart.setAttribute('class', 'lotus-heart'); heart.setAttribute('cx', '50'); heart.setAttribute('cy', '50'); heart.setAttribute('r', '3.1');
    svg.appendChild(seed); svg.appendChild(heart);
    return svg;
  };
  const paintLotus = ({ bloomPin } = {}) => {
    if (!hasLotus) return;
    lotusBtn.querySelectorAll('.pt').forEach(p => {
      const pin = +p.dataset.pin;
      const earned = lotusState.done.has(pin);
      p.classList.toggle('earned', earned);
      if (bloomPin && pin === bloomPin && earned) {
        p.classList.remove('bloom');
        void p.getBoundingClientRect();
        p.classList.add('bloom');
        p.addEventListener('animationend', () => p.classList.remove('bloom'), { once: true });
      }
    });
    const n = lotusState.done.size;
    const label = `蓮花進度 已完成 ${n}/32 品`;
    lotusBtn.setAttribute('aria-label', label);
    lotusBtn.setAttribute('title', label);
    lotusTip.textContent = `已完成 ${n}/32 品`;
    stage.classList.toggle('lotus-full', n === 32);
  };
  const endFinale = () => {
    clearTimeout(tFinale);
    finalePlaying = false;
    stage.classList.remove('lotus-finale');
    lotusFinaleEl.hidden = true;
    lotusBtn.style.transform = '';
    lotusBtn.style.opacity = '';
    lotusBtn.style.transition = '';
    if (playing) held();
  };
  const playFinale = ({ replay = false } = {}) => {
    if (!hasLotus || finalePlaying) return;
    if (!replay && lotusState.finale) return;
    if (!replay) { lotusState.finale = true; persistLotus(); }
    finalePlaying = true;
    try { peek(false); } catch (_) {}
    hideLotusTip();
    lotusFinaleEl.hidden = false;
    stage.classList.add('lotus-finale');
    const place = () => {
      const r = stage.getBoundingClientRect();
      const b = lotusBtn.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - (b.left + b.width / 2);
      const dy = (r.top + r.height / 2) - (b.top + b.height / 2);
      const scale = Math.min(r.width, r.height) * 0.72 / Math.max(b.width, 56);
      lotusBtn.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    };
    if (reduced()) {
      lotusBtn.style.transition = 'opacity .5s ease';
      lotusBtn.style.opacity = '0';
      place();
      requestAnimationFrame(() => { lotusBtn.style.opacity = '1'; });
      tFinale = setTimeout(() => {
        lotusBtn.style.opacity = '0';
        tFinale = setTimeout(() => endFinale(), 500);
      }, 2500);
    } else {
      lotusBtn.style.transition = 'transform 1.8s cubic-bezier(.22,.7,.25,1)';
      requestAnimationFrame(() => requestAnimationFrame(place));
      tFinale = setTimeout(() => {
        lotusBtn.style.transform = 'none';
        tFinale = setTimeout(() => endFinale(), 1600);
      }, 4600);
    }
  };
  const hideLotusTip = () => { clearTimeout(tLotusTip); lotusTip.hidden = true; };
  const showLotusTip = () => {
    lotusTip.hidden = false;
    clearTimeout(tLotusTip);
    tLotusTip = setTimeout(() => { lotusTip.hidden = true; }, 2400);
  };
  const resetLotus = ({ confirm: ask = true } = {}) => {
    if (ask && !window.confirm('重設蓮花進度？')) return false;
    lotusState.done.clear();
    lotusState.finale = false;
    persistLotus();
    endFinale();
    hideLotusTip();
    paintLotus();
    announce('已重設蓮花進度');
    return true;
  };
  const notePin = (i, how) => {
    if (!hasLotus || i < 0) return;
    const pin = pinOfLastPage(i);
    if (!pin) return;
    const already = lotusState.done.has(pin);
    if (!already) {
      lotusState.done.add(pin);
      persistLotus();
      paintLotus({ bloomPin: pin });
    }
    if (lotusState.done.size === 32 && !lotusState.finale && how !== 'instant') playFinale({ replay: false });
  };
  if (hasLotus) {
    stage.classList.add('has-lotus');
    lotusBtn.hidden = false;
    lotusBtn.appendChild(buildLotusSvg());
    const resetBtn = btn('lotus-reset');
    if (resetBtn) resetBtn.hidden = false;
    paintLotus();
    lotusBtn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      if (lotusLongFired) { lotusLongFired = false; return; }
      if (finalePlaying) { endFinale(); return; }
      if (lotusState.done.size === 32) { playFinale({ replay: true }); return; }
      if (lotusTip.hidden) showLotusTip(); else hideLotusTip();
    });
    lotusBtn.addEventListener('pointerdown', e => {
      e.stopPropagation();
      lotusLongFired = false;
      clearTimeout(tLotusLong);
      tLotusLong = setTimeout(() => { lotusLongFired = true; resetLotus(); }, 700);
    });
    const clearLong = () => clearTimeout(tLotusLong);
    lotusBtn.addEventListener('pointerup', clearLong);
    lotusBtn.addEventListener('pointercancel', clearLong);
    lotusBtn.addEventListener('pointerleave', clearLong);
    lotusFinaleEl.addEventListener('click', e => { e.stopPropagation(); if (finalePlaying) endFinale(); });
  }

  // ---------- building a passage ----------
  function build(i) {
    const intro = i < 0, t = intro ? null : turns[i], k = intro ? 'i' : t[0];
    const el = document.createElement('div');
    el.className = `ink-pass k-${k}`; el.dataset.i = String(i); el.dataset.k = k;
    let n = 0, gapW = 0;
    // Calligraphy has no punctuation marks: 「」『』 and other marks are dropped; ，；： leave a small gap and 。！？ or a space a larger one; enumeration 、 is dropped with no gap and keeps the list as one phrase,
    // as spacing on the preceding character (padding-inline-end works in vertical and horizontal writing). Display only: RW_DIALOGUE and the reading text keep their punctuation.
    const raw = intro ? introLines.join('\n') : t[1];
    const leadEnd = (!intro && k !== 't' && k !== 'n') ? ((raw.match(LEAD_RE) || ['',''])[1].length) : 0;
    const chars = (s, base = 0) => {
      const toks = [];
      let i = base;
      for (const c of s) {
        if (ENUM.test(c)) { if (toks.length) toks[toks.length - 1].item = true; }
        else if (MINOR.test(c)) { if (toks.length) toks[toks.length - 1].g = Math.max(toks[toks.length - 1].g, 1); }
        else if (MAJOR.test(c)) { if (toks.length) toks[toks.length - 1].g = 2; }
        else if (DROP.test(c)) { if (OPEN.test(c) && toks.length) toks[toks.length - 1].g = Math.max(toks[toks.length - 1].g, 1); i += c.length; continue; }
        else toks.push({ c, g: 0, lead: i < leadEnd });
        i += c.length;
      }
      if (toks.length) toks[toks.length - 1].g = 0;
      return toks.map(t => { gapW += t.g === 2 ? 0.7 : t.g === 1 ? 0.3 : 0; return `<span class="ch${t.lead ? ' lead' : ''}${t.g ? ' g' + t.g : ''}${t.item ? ' item' : ''}"${t.item ? ' data-item="1"' : ''} style="--i:${n++}">${esc(t.c)}</span>`; }).join('');
    };
    let body, off = 0;
    const linesOf = s => s.split('\n').map(line => { const html = chars(line, off); off += line.length + 1; return html; });
    if (intro) body = `<span class="ln t1">${chars(introLines[0])}</span><br><span class="ln t2">${chars(introLines[1], introLines[0].length + 1)}</span>`;
    else if (k === 't') {
      const [a, b] = t[1].split('\n');
      body = `<span class="ln t1">${chars(a)}</span>` + (b ? `<br><span class="ln t2">${chars(b, a.length + 1)}</span>` : '');
    } else body = linesOf(t[1]).map(html => `<span class="ln">${html}</span>`).join('<br>');
    el.dataset.n = String(n); el.dataset.w = String(n + gapW);
    el.innerHTML = `<p class="ink-text" aria-hidden="true">${body}</p>`;
    if (k !== 'i' && k !== 't' && (raw.includes('\n'))) el.querySelector('.ink-text').classList.add('is-verse');
    return el;
  }
  // typography (rw-v20/v21): 3 size steps, phrase-aware balanced columns, no 1–2 glyph stubs at a column start or end,
  // equal-length parallel phrases kept whole (ideally one column each), title cards shrink to one column or split at a natural break,
  // optical weight for heavy glyphs. Safari measure/centre and per-glyph font-size from v19 are kept.
  const GAP = 0.6, MIN_PHRASE = 2, LADDER = [1, 0.86, 0.73], INK_MEAN = 0.135;
  const hasSpeakers = rawTurns.some(x => 'bsmajy'.includes(x[0]));
  const inkScale = (() => {
    const memo = new Map(); let cx = null;
    return ch => {
      if (memo.has(ch)) return memo.get(ch);
      if (!document.fonts.check('64px "RW Brush"', ch)) {
        if (!inkScale.asked) { inkScale.asked = 1; document.fonts.load('64px "RW Brush"', ch).then(() => R.fitInk()); }
        return [1, 1];
      }
      if (!cx) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 96;
        cx = cv.getContext('2d', { willReadFrequently: true });
        cx.font = '64px "RW Brush"'; cx.textBaseline = 'ideographic';
      }
      cx.clearRect(0, 0, 96, 96); cx.fillText(ch, 16, 80);
      const d = cx.getImageData(0, 0, 96, 96).data; let a = 0;
      for (let i = 3; i < d.length; i += 4) a += d[i];
      const r = a / 255 / 4096 / INK_MEAN;
      const f = 1.2 / r, w = r > 1.2 ? Math.max(0.86, Math.pow(f, 0.35)) : 1;
      const o = w < 1 ? Math.min(1, Math.max(0.8, f / (w * w))) : 1;
      memo.set(ch, [w, o]); return [w, o];
    };
  })();
  const scaleOf = tag => tag === 't1' ? 1.3 : tag === 't2' ? 0.46 : 1;
  function captureLines(t) {
    const lines = [[]], tags = [''];
    const tagOf = ln => ln.classList.contains('t1') ? 't1' : ln.classList.contains('t2') ? 't2' : '';
    const add = (nd, tag) => {
      nd.dataset.g0 = nd.classList.contains('g2') ? 2 : nd.classList.contains('g1') ? 1 : 0;
      if (tag) nd.dataset.tag = tag;
      lines.at(-1).push(nd);
      if (tag) tags[tags.length - 1] = tag;
    };
    const walk = (node, tag) => {
      for (const nd of [...node.childNodes]) {
        if (nd.nodeName === 'BR') { if (lines.at(-1).length) { lines.push([]); tags.push(''); } }
        else if (nd.classList && nd.classList.contains('ln')) walk(nd, tagOf(nd) || tag);
        else if (nd.classList && nd.classList.contains('ch')) add(nd, tag);
      }
    };
    walk(t, '');
    while (lines.length && !lines.at(-1).length) { lines.pop(); tags.pop(); }
    return { lines, tags };
  }
  function layoutInk(el, vert, t, k, AW, AH, maxS, probeOnly) {
    if (!el._inkLines) {
      const cap = captureLines(t);
      el._inkLines = cap.lines;
      el._inkTags = cap.tags;
    }
    const ls = k === 'n' && hasSpeakers ? 0.16 : k === 'n' ? 0.12 : 0.1, P = 1 + ls;
    const rawLines0 = el._inkLines.map(L => {
      let run = 0;
      return L.map((n, i) => {
        run++;
        let g = +n.dataset.g0;
        if (i === L.length - 1 || (g === 1 && run < MIN_PHRASE)) g = 0;
        if (g) run = 0;
        return { n, g, item: n.dataset.item === '1' };
      });
    });
    const tags0 = el._inkTags.slice();
    // a 1–2 glyph source line (e.g. the 真言 label) is folded into the next line so it is not a stub column
    const rawLines = [], tags = [];
    for (let i = 0; i < rawLines0.length; i++) {
      const L = rawLines0[i];
      if (L.length <= 2 && i < rawLines0.length - 1 && tags0[i] === tags0[i + 1] && (rawLines0[i + 1].length + L.length) > 2) {
        const last = L[L.length - 1];
        if (!last.g) last.g = 1;
        rawLines0[i + 1] = L.concat(rawLines0[i + 1]);
        continue;
      }
      rawLines.push(L); tags.push(tags0[i]);
    }
    const isTitle = k === 'i' || k === 't';
    // RW Brush's ink box is taller/wider than 1em (~1.25em); letter-spacing sits between those boxes.
    const ADV = 1.25;
    const emLen = n => n <= 0 ? 0 : n * ADV + Math.max(0, n - 1) * ls;
    const lenRange = (L, a, b) => {
      const n = b - a;
      if (n <= 0) return 0;
      let g = 0;
      for (let i = a; i < b - 1; i++) if (L[i].g) g++;
      return n * ADV + Math.max(0, n - 1) * ls + g * GAP;
    };
    const lenCol = col => lenRange(col, 0, col.length);
    const stageW = field.clientWidth;
    const base = vert ? Math.min(56, 4 * Math.round(stageW * 0.031)) : Math.min(44, 4 * Math.round(stageW * 0.024));
    const nk = k === 'n' && hasSpeakers ? 0.75 : 1;
    let steps = LADDER.map(f => 2 * Math.round(base * f * nk / 2));
    const typoFloor = vert ? 22 : 18;
    const floor = maxS != null ? Math.min(typoFloor, maxS) : typoFloor;
    if (maxS != null) {
      steps = steps.map(s => Math.min(s, maxS)).filter((s, i, a) => s >= floor && a.indexOf(s) === i);
      if (!steps.length || steps[steps.length - 1] > maxS) steps.push(Math.max(floor, maxS));
      steps = [...new Set(steps.filter(s => s <= maxS && s >= floor))].sort((a, b) => b - a);
      if (!steps.length) steps = [Math.max(floor, maxS)];
    }
    const capOf = (S, tag) => {
      const sc = scaleOf(tag);
      return vert ? AH / (S * sc) : Math.min(AW / (S * sc), 16);
    };
    const pitchOf = S => S * (isTitle ? 2.1 : (vert ? 1.75 : 1.85));
    const maxColsOf = S => Math.max(1, Math.floor(((vert ? AW : AH) + 0.5) / pitchOf(S)));
    const unitsOf = L => {
      const u = []; let cur = [];
      for (let i = 0; i < L.length; i++) {
        cur.push(L[i]);
        if (L[i].g && i < L.length - 1) { u.push(cur); cur = []; }
      }
      if (cur.length) u.push(cur);
      const glued = [];
      for (const ph of u) {
        if (ph.length <= 2 && glued.length) glued[glued.length - 1] = glued[glued.length - 1].concat(ph);
        else glued.push(ph.slice());
      }
      if (glued.length > 1 && glued[0].length <= 2) {
        glued[1] = glued[0].concat(glued[1]);
        glued.shift();
      }
      return glued;
    };
    const unitLen = (units, a, b) => {
      let glyphs = 0, gaps = 0;
      for (let i = a; i < b; i++) {
        glyphs += units[i].length;
        if (i < b - 1) gaps++;
      }
      if (!glyphs) return 0;
      return glyphs * ADV + Math.max(0, glyphs - 1) * ls + gaps * GAP;
    };
    const naturalCuts = L => {
      const text = L.map(o => o.n.textContent).join('');
      const cuts = [];
      for (let i = 3; i <= text.length - 3; i++) {
        if (text[i - 1] === '分' && text[i] === '第') cuts.push(i);
        else if (text[i] === '第' && /[一二三四五六七八九十百千]/.test(text[i + 1] || '')) cuts.push(i);
      }
      return [...new Set(cuts)];
    };
    const evenSplit = (L, cap) => {
      const n = L.length;
      if (!n) return [L];
      if (lenRange(L, 0, n) <= cap + 1e-6) return [L];
      const prefer = naturalCuts(L);
      const out = [];
      let a = 0;
      while (a < n) {
        let best = -1, bc = 1e9;
        for (let b = a + 1; b <= n; b++) {
          if (lenRange(L, a, b) > cap + 1e-6) break;
          const left = n - b;
          if (b - a <= 2 && n > 2) continue; // don't start a 1–2 glyph stub column
          if (left && left < 3 && n > 2) continue; // don't leave a 1–2 glyph stub
          const d = Math.abs((b - a) - (n - a) / Math.max(1, Math.ceil(lenRange(L, a, n) / cap)));
          const nat = prefer.includes(b) ? -8 : (L[b - 1] && L[b - 1].item ? -6 : 0);
          if (d + nat <= bc) { bc = d + nat; best = b; }
        }
        if (best < 0) { // at least one glyph, even if slightly over (emergency)
          best = Math.min(n, a + Math.max(1, n - a >= 6 ? n - a - 3 : n - a));
          while (best > a + 1 && lenRange(L, a, best) > cap + 1e-6) best--;
          if (best === a) best = a + 1;
        }
        out.push(L.slice(a, best));
        a = best;
      }
      return out;
    };
    const packUnits = (units, cap, minC0, maxC0) => {
      const n = units.length;
      if (!n) return [[]];
      if (n === 1) return unitLen(units, 0, 1) <= cap + 1e-6 ? [units[0]] : null;
      const total = unitLen(units, 0, n);
      const minC = Math.max(minC0 || 1, Math.ceil(total / cap - 1e-9));
      const maxC = Math.max(minC, Math.min(n, maxC0 != null ? maxC0 : n));
      for (let c = minC; c <= maxC; c++) {
        const dp = Array.from({ length: n + 1 }, () => Array(c + 1).fill(null));
        dp[0][0] = { cost: 0, prev: 0 };
        for (let p = 1; p <= c; p++) {
          for (let j = p; j <= n; j++) {
            for (let i = p - 1; i < j; i++) {
              if (!dp[i][p - 1]) continue;
              const l = unitLen(units, i, j);
              if (l > cap + 1e-6) continue;
              let glyphs = 0; for (let u = i; u < j; u++) glyphs += units[u].length;
              if (glyphs <= 2 && !(i === 0 && j === n && n === 1)) continue; // never a 1–2 glyph stub column
              const cost = dp[i][p - 1].cost + Math.abs(l - total / c);
              if (!dp[j][p] || cost < dp[j][p].cost) dp[j][p] = { cost, prev: i };
            }
          }
        }
        if (!dp[n][c]) continue;
        const bounds = [];
        for (let p = c, j = n; p > 0; p--) { bounds.push([dp[j][p].prev, j]); j = dp[j][p].prev; }
        bounds.reverse();
        return bounds.map(([a, b]) => units.slice(a, b).flat());
      }
      return null;
    };
    const parallelMin = units => {
      let best = 0, run = 1;
      for (let i = 1; i <= units.length; i++) {
        if (i < units.length && units[i].length === units[i - 1].length && units[i].length >= 5) run++;
        else { if (run >= 3) best = Math.max(best, run); run = 1; }
      }
      return best;
    };
    const itemCutsOf = u => {
      const cuts = [];
      for (let i = 0; i < u.length - 1; i++) if (u[i].item) cuts.push(i + 1);
      return cuts;
    };
    const packItemCuts = (u, cap) => {
      const cuts = itemCutsOf(u);
      if (!cuts.length) return null;
      const em = n => n * ADV + Math.max(0, n - 1) * ls;
      const points = [0, ...cuts, u.length];
      const items = [];
      for (let i = 0; i < points.length - 1; i++) {
        const it = u.slice(points[i], points[i + 1]);
        if (em(it.length) > cap + 1e-6) return null; // a single item is itself longer than the column
        items.push(it);
      }
      const parts = [];
      let cur = [];
      const glen = arr => arr.reduce((n, it) => n + it.length, 0);
      const flush = () => { if (cur.length) { parts.push(cur); cur = []; } };
      for (const it of items) {
        if (!cur.length || em(glen(cur) + it.length) <= cap + 1e-6) cur.push(it);
        else { flush(); cur.push(it); }
      }
      flush();
      // no 1–2 glyph leftover: steal whole items from the previous part so both sides stay >= 3 when possible
      const steal = (from, to) => {
        while (from.length > 1 && glen(to) <= 2) {
          const give = from.pop();
          if (em(glen(from) + 0) > cap + 1e-6) { from.push(give); break; }
          if (glen(from) < 3 && glen(to) + give.length <= 2) { from.push(give); break; }
          to.unshift(give);
          if (glen(from) < 3 && from.length) {
            // put it back if we broke the donor into a stub and still have a stub
            if (glen(to) <= 2) { from.push(to.shift()); break; }
          }
        }
      };
      for (let i = parts.length - 1; i >= 0; i--) {
        if (glen(parts[i]) > 2) continue;
        if (i > 0) steal(parts[i - 1], parts[i]);
        if (glen(parts[i]) <= 2 && i + 1 < parts.length) {
          // merge forward (next part starts the combined run)
          const next = parts[i + 1];
          if (em(glen(parts[i]) + glen(next)) <= cap + 1e-6 || glen(parts[i]) <= 2) {
            parts[i + 1] = parts[i].concat(next);
            parts.splice(i, 1);
          }
        } else if (glen(parts[i]) <= 2 && i > 0) {
          parts[i - 1] = parts[i - 1].concat(parts[i]);
          parts.splice(i, 1);
        }
      }
      // never leave a 1–2 glyph part: attach it to a neighbour even if the combined run is slightly over cap
      for (let i = 0; i < parts.length; ) {
        if (glen(parts[i]) > 2 || parts.length === 1) { i++; continue; }
        if (i + 1 < parts.length) { parts[i] = parts[i].concat(parts[i + 1]); parts.splice(i + 1, 1); }
        else if (i > 0) { parts[i - 1] = parts[i - 1].concat(parts[i]); parts.splice(i, 1); }
        else i++;
      }
      // flatten item groups to glyph arrays; drop empty
      const flat = parts.filter(p => p.length).map(p => p.reduce((a, it) => a.concat(it), []));
      return flat.length ? flat : null;
    };
    const splitLongUnits = (units, cap) => {
      const out = [];
      for (const u of units) {
        if ( (u.length * ADV + Math.max(0, u.length - 1) * ls) <= cap + 1e-6) { out.push(u); continue; }
        const byItem = packItemCuts(u, cap);
        if (byItem) { out.push(...byItem); continue; }
        const n = u.length, need = Math.max(2, Math.ceil(emLen(n) / cap - 1e-9));
        const prefer = naturalCuts(u);
        let a = 0, ok = true, parts = [];
        for (let j = 1; j < need && ok; j++) {
          const target = a + Math.round((n - a) / (need - j + 1));
          let best = -1, bc = 1e9;
          const lo = a + 3, hi = n - 3 * (need - j);
          for (let b = lo; b <= hi; b++) {
            if ((b - a) * ADV + Math.max(0, b - a - 1) * ls > cap + 1e-6) break;
            const d = Math.abs(b - target) + (prefer.includes(b) ? -8 : 0);
            if (d < bc) { bc = d; best = b; }
          }
          if (best < 0) ok = false;
          else { parts.push(u.slice(a, best)); a = best; }
        }
        if (ok && (n - a) >= 3 && ((n - a) * ADV + Math.max(0, n - a - 1) * ls) <= cap + 1e-6) { parts.push(u.slice(a)); out.push(...parts); }
        else {
          // equal glyph counts of at least 3 that each fit the cap
          a = 0;
          for (let j = need; j > 1; j--) {
            let take = Math.max(3, Math.round((n - a) / j));
            while (take > 3 && (take * ADV + Math.max(0, take - 1) * ls) > cap + 1e-6) take--;
            if ((take * ADV + Math.max(0, take - 1) * ls) > cap + 1e-6) return null;
            out.push(u.slice(a, a + take)); a += take;
          }
          if (n - a < 1 || ((n - a) * ADV + Math.max(0, n - a - 1) * ls) > cap + 1e-6) return null;
          out.push(u.slice(a));
        }
      }
      return out;
    };
    const breakLine = (L, cap, atFloor, tag, maxC) => {
      if (!L.length) return [L];
      const whole = lenRange(L, 0, L.length);
      const titleLike = isTitle || tag === 't1' || tag === 't2';
      if (whole <= cap + 1e-6) return [L];
      if (titleLike && !atFloor) return null;
      let units = unitsOf(L);
      if (units.some(u => emLen(u.length) > cap + 1e-6)) {
        // 16em is a hard horizontal row cap (shrinking the font does not raise it). A cap that comes from the
        // stage size grows when the type shrinks, so keep the phrase whole and try a smaller step first.
        const hardCap = vert ? 1e9 : 16;
        const canGrow = units.every(u => emLen(u.length) <= hardCap + 1e-6);
        if (canGrow && !atFloor) return null;
        units = splitLongUnits(units, cap);
      }
      if (!units) return atFloor ? evenSplit(L, cap) : null;
      const budget = maxC != null ? maxC : units.length;
      const want = parallelMin(units);
      // if every phrase (including a 3+ run of equal-length ones) fits a column of its own and the stage can hold them, prefer that
      if (want >= 3 && units.length <= budget && units.every(u =>  (u.length * ADV + Math.max(0, u.length - 1) * ls) <= cap + 1e-6)) {
        const isol = packUnits(units, cap, units.length, units.length);
        if (isol && isol.every(col => lenCol(col) <= cap + 1e-6)) return isol;
      }
      const packed = packUnits(units, cap, 1, budget);
      if (packed) return packed;
      return atFloor ? evenSplit(L, cap) : null;
    };
    const layout = (S, atFloor) => {
      const budget = maxColsOf(S);
      const out = [];
      let used = 0;
      for (let li = 0; li < rawLines.length; li++) {
        const remain = Math.max(1, budget - used - (rawLines.length - li - 1));
        const cols = breakLine(rawLines[li], capOf(S, tags[li]), atFloor, tags[li], remain);
        if (!cols) return null;
        out.push(cols);
        used += cols.length;
        if (used > budget) return null;
      }
      return out;
    };
    const stageFits = (all, S) => {
      if (!all) return false;
      const nCols = all.reduce((m, x) => m + x.length, 0);
      return nCols * pitchOf(S) <= (vert ? AW : AH) + 0.5;
    };
    const isolateScore = all => {
      if (!all) return -1;
      let score = 0;
      for (const cols of all) {
        const lens = cols.map(c => c.length);
        for (let i = 0; i < lens.length; i++) if (lens[i] >= 5 && lens.filter(x => x === lens[i]).length >= 3) score++;
      }
      return score;
    };
    const stubby = all => {
      if (!all) return true;
      for (let li = 0; li < all.length; li++) {
        const whole = rawLines[li].length;
        for (const col of all[li]) if (col.length <= 2 && whole > 2) return true;
      }
      return false;
    };
    const okAt = (S, atFloor) => {
      const all = layout(S, atFloor);
      return all && !stubby(all) && stageFits(all, S);
    };
    if (probeOnly) {
      const S = steps[0];
      return okAt(S, false) ? S : 0;
    }
    const candidates = [];
    for (const s of steps) if (okAt(s, false)) candidates.push(s);
    // also try sizes between the last ladder step and the typographic floor, still keeping phrases whole
    if (!candidates.length) {
      let s = steps[steps.length - 1] - 2;
      const lo = vert ? 18 : 16; // shrink below the typographic floor before mid-phrase splits
      while (s >= lo) {
        if (okAt(s, false)) candidates.push(s);
        s -= 2;
      }
    }
    let S, all;
    if (candidates.length) {
      candidates.sort((a, b) => isolateScore(layout(b, false)) - isolateScore(layout(a, false)) || b - a);
      S = candidates[0];
      all = layout(S, false);
    } else {
      // only now allow a mid-phrase split, and only as an emergency below the typographic floor
      const emergency = vert ? 18 : 16;
      S = Math.min(typoFloor, maxS != null ? maxS : typoFloor);
      while (S > emergency && !okAt(S, true)) S -= 2;
      if (!okAt(S, true)) S = Math.max(emergency, S);
      all = layout(S, true) || rawLines.map(L => [L]);
    }
    const maybeSplitParallels = (all0, S0) => {
      const budget = maxColsOf(S0);
      let used = 0;
      const all1 = all0.map((cols, li) => {
        const units = splitLongUnits(unitsOf(rawLines[li]), capOf(S0, tags[li]));
        const want = units ? parallelMin(units) : 0;
        if (!units || want < 3) { used += cols.length; return cols; }
        const cap = capOf(S0, tags[li]);
        const remain = Math.max(cols.length, budget - used - (all0.length - li - 1));
        const isol = packUnits(units, cap, Math.min(units.length, remain), remain);
        const chosen = isol && isol.length > cols.length && isol.length <= remain && isol.every(col => lenCol(col) <= cap + 1e-6) ? isol : cols;
        used += chosen.length;
        return chosen;
      });
      return stageFits(all1, S0) && !stubby(all1) && all1.reduce((m, x) => m + x.length, 0) <= budget ? all1 : all0;
    };
    all = maybeSplitParallels(all, S);
    t.replaceChildren();
    t.classList.add('rf');
    t.classList.toggle('is-title', isTitle);
    all.forEach((cols, li) => {
      const tag = tags[li];
      cols.forEach((col, ci) => {
        const wrap = document.createElement('span');
        wrap.className = 'ln' + (tag ? ' ' + tag : '');
        wrap.dataset.col = col.map(o => o.n.textContent).join('');
        col.forEach((o, i) => {
          const g = i === col.length - 1 ? 0 : o.g;
          o.n.classList.toggle('g1', g === 1);
          o.n.classList.toggle('g2', g === 2);
          const [w, op] = inkScale(o.n.textContent);
          o.n.classList.toggle('w', w < 1);
          if (w < 1) { o.n.style.setProperty('--w', w.toFixed(3)); o.n.style.setProperty('--o', op.toFixed(2)); }
          else { o.n.style.removeProperty('--w'); o.n.style.removeProperty('--o'); }
          wrap.appendChild(o.n);
        });
        t.appendChild(wrap);
        if (ci < cols.length - 1 || li < all.length - 1) t.appendChild(document.createElement('br'));
      });
    });
    t.style.letterSpacing = ls + 'em';
    t.style.maxHeight = '';
    t.style.maxWidth = '';
    t.style.fontSize = S + 'px';
    el.style.setProperty('--fs-ink', S + 'px');
    el.style.fontSize = S + 'px';
    el.dataset.fs = String(S);
    el.dataset.cols = String(all.reduce((m, x) => m + x.length, 0));
    return S;
  }
  function fit(el) {
    const vert = stage.dataset.vert === '1', t = $('.ink-text', el), k = el.dataset.k;
    const cs = getComputedStyle(field);
    const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
    const padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
    const AW = field.clientWidth - padL - padR;
    const AH = field.clientHeight - padT - padB;
    const floor = vert ? 22 : 18;
    const contentBox = () => {
      const b = field.getBoundingClientRect();
      return { left: b.left + padL, right: b.right - padR, top: b.top + padT, bottom: b.bottom - padB };
    };
    const glyphBox = () => {
      const boxes = [...t.querySelectorAll('.ch')].map(n => n.getBoundingClientRect());
      return (boxes.length ? boxes : [t.getBoundingClientRect()]).reduce((a, b) => ({
        left: Math.min(a.left, b.left), right: Math.max(a.right, b.right),
        top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom)
      }));
    };
    const measure = () => {
      const prev = stage.style.overflow;
      stage.style.overflow = 'visible';
      void t.offsetWidth;
      const f = contentBox(), r = glyphBox();
      stage.style.overflow = prev;
      return r.left >= f.left - 0.5 && r.right <= f.right + 0.5 && r.top >= f.top - 0.5 && r.bottom <= f.bottom + 0.5;
    };
    const applySize = s => {
      t.style.transform = 'none';
      t.style.fontSize = s + 'px';
      el.style.setProperty('--fs-ink', s + 'px');
      el.style.fontSize = s + 'px';
      t.querySelectorAll('.ch').forEach(n => {
        const ln = n.closest('.ln');
        const scale = ln && ln.classList.contains('t1') ? 1.3 : ln && ln.classList.contains('t2') ? 0.46 : 1;
        n.style.setProperty('font-size', (s * scale) + 'px', 'important');
      });
      void t.offsetWidth;
    };
    const centre = () => {
      t.style.transform = 'none';
      void t.offsetWidth;
      const prev = stage.style.overflow;
      stage.style.overflow = 'visible';
      void t.offsetWidth;
      const f = contentBox(), r = glyphBox();
      stage.style.overflow = prev;
      const dx = ((f.left + f.right) - (r.left + r.right)) / 2;
      const dy = ((f.top + f.bottom) - (r.top + r.bottom)) / 2;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) t.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };
    t.style.transform = 'none';
    let S = layoutInk(el, vert, t, k, AW, AH);
    applySize(S);
    centre();
    glyphBox(); // flush WebKit boxes before measuring
    let guard = 0;
    const emergency = vert ? 18 : 16;
    while (!measure() && S > emergency && guard++ < 30) {
      S = layoutInk(el, vert, t, k, AW, AH, Math.max(emergency, S - 2));
      applySize(S);
      centre();
      glyphBox();
    }
    el.style.setProperty('--fs-ink', S + 'px');
    el.dataset.fs = String(S);
  }

  let pageVert = '', pageW = 0, pageH = 0;
  const pageKey = () => (stage.dataset.vert || '') + 'x' + field.clientWidth + 'x' + field.clientHeight;
  const needsPaginate = () => pageVert !== (stage.dataset.vert || '') || pageW !== field.clientWidth || pageH !== field.clientHeight;
  const fieldBox = () => {
    const cs = getComputedStyle(field);
    const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
    const padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
    return { AW: field.clientWidth - padL - padR, AH: field.clientHeight - padT - padB, padL, padR, padT, padB };
  };
  const largestStep = (k, vert, stageW) => {
    const nk = k === 'n' && hasSpeakers ? 0.75 : 1;
    const base = vert ? Math.min(56, 4 * Math.round(stageW * 0.031)) : Math.min(44, 4 * Math.round(stageW * 0.024));
    return 2 * Math.round(base * nk / 2);
  };
  const makePass = (k, raw, i = 0) => {
    const intro = k === 'i';
    const el = document.createElement('div');
    el.className = `ink-pass k-${k}`; el.dataset.i = String(i); el.dataset.k = k;
    let n = 0, gapW = 0;
    const leadEnd = (!intro && k !== 't' && k !== 'n') ? ((raw.match(LEAD_RE) || ['', ''])[1].length) : 0;
    const chars = (s, base = 0) => {
      const toks = [];
      let i0 = base;
      for (const c of s) {
        if (ENUM.test(c)) { if (toks.length) toks[toks.length - 1].item = true; }
        else if (MINOR.test(c)) { if (toks.length) toks[toks.length - 1].g = Math.max(toks[toks.length - 1].g, 1); }
        else if (MAJOR.test(c)) { if (toks.length) toks[toks.length - 1].g = 2; }
        else if (DROP.test(c)) { if (OPEN.test(c) && toks.length) toks[toks.length - 1].g = Math.max(toks[toks.length - 1].g, 1); i0 += c.length; continue; }
        else toks.push({ c, g: 0, lead: i0 < leadEnd });
        i0 += c.length;
      }
      if (toks.length) toks[toks.length - 1].g = 0;
      return toks.map(o => { gapW += o.g === 2 ? 0.7 : o.g === 1 ? 0.3 : 0; return `<span class="ch${o.lead ? ' lead' : ''}${o.g ? ' g' + o.g : ''}${o.item ? ' item' : ''}"${o.item ? ' data-item="1"' : ''} style="--i:${n++}">${esc(o.c)}</span>`; }).join('');
    };
    let body, off = 0;
    const linesOf = s => s.split('\n').map(line => { const html = chars(line, off); off += line.length + 1; return html; });
    if (intro) body = `<span class="ln t1">${chars(introLines[0])}</span><br><span class="ln t2">${chars(introLines[1], introLines[0].length + 1)}</span>`;
    else if (k === 't') {
      const [a, b] = raw.split('\n');
      body = `<span class="ln t1">${chars(a)}</span>` + (b ? `<br><span class="ln t2">${chars(b, a.length + 1)}</span>` : '');
    } else body = linesOf(raw).map(html => `<span class="ln">${html}</span>`).join('<br>');
    el.dataset.n = String(n); el.dataset.w = String(n + gapW);
    el.innerHTML = `<p class="ink-text" aria-hidden="true">${body}</p>`;
    if (k !== 'i' && k !== 't' && raw.includes('\n')) el.querySelector('.ink-text').classList.add('is-verse');
    return el;
  };
  const fitsLargest = (k, text) => {
    if (!text || !field.clientWidth) return true;
    if (displayGlyphs(text) <= 8) return true;
    const vert = stage.dataset.vert === '1';
    const { AW, AH, padL, padR, padT, padB } = fieldBox();
    const el = makePass(k, text, -2);
    el.style.cssText = 'position:absolute;inset:0;visibility:hidden;pointer-events:none;';
    field.appendChild(el);
    const te = el.querySelector('.ink-text');
    const S0 = largestStep(k, vert, field.clientWidth);
    const laid = layoutInk(el, vert, te, k, AW, AH, S0, true);
    el.remove();
    return laid >= S0;
  };
  const pagesForTurn = (k, text) => {
    // titles and four-line 偈 stay one page (they may still shrink); shrink a lone phrase only when it cannot fit
    if (k === 't' || k === 'i' || (k !== 'n' && text.includes('\n'))) return [text];
    if (fitsLargest(k, text)) return [text];
    const units = phraseUnits(text);
    if (units.length <= 1) return [text];
    const join = (a, b) => units.slice(a, b).join('');
    const pages = [];
    let i = 0;
    while (i < units.length) {
      if (fitsLargest(k, join(i, units.length))) { pages.push(join(i, units.length)); break; }
      if (!fitsLargest(k, units[i])) { pages.push(units[i]); i += 1; continue; } // single phrase may shrink
      let lo = i + 1, hi = units.length - 1, best = i + 1;
      while (lo <= hi) {
        const mid = (lo + hi + 1) >> 1;
        if (fitsLargest(k, join(i, mid))) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      // no 1–2 glyph leftover page: back up so the remainder has at least 3 glyphs when possible
      const rest = displayGlyphs(join(best, units.length));
      if (rest > 0 && rest < 3 && best > i + 1 && displayGlyphs(join(i, best - 1)) >= 3) best -= 1;
      pages.push(join(i, best));
      i = best;
    }
    return pages;
  };
  const paginateToFit = want => {
    if (!field.clientWidth) return (want != null ? want : idx);
    const src = want != null ? want : idx;
    const keep = src >= 0 && turns[src] ? turns[src][1] : '';
    const next = [];
    for (const t0 of rawTurns) {
      for (const part of pagesForTurn(t0[0], t0[1])) next.push([t0[0], part, t0[2]]);
    }
    turns = next;
    N = turns.length;
    refreshLotusRanges();
    buildScrubTicks();
    pageVert = stage.dataset.vert || '';
    pageW = field.clientWidth;
    pageH = field.clientHeight;
    if (keep) {
      const j = turns.findIndex(t => t[1] === keep || t[1].startsWith(keep) || keep.startsWith(t[1]));
      if (j >= 0) { idx = j; return j; }
    }
    idx = Math.max(-1, Math.min(src, N - 1));
    return idx;
  };

  R.fitInk = () => {
    if (R.mode !== 'dlg') return;
    if (needsPaginate()) {
      const j = paginateToFit();
      if (cur()) mount(j, 'instant');
    } else {
      const e = cur(); if (e) fit(e);
    }
  };

  // ---------- writing, holding, dissolving ----------
  const stepMs = () => SPEEDS[speedI].step * (cur()?.dataset.k === 'n' ? 0.7 : 1);
  const writeMs = el => (+el.dataset.n) * stepMs() + 900;
  // Reading pause after the ink has finished: ~1.2s + ~0.35s/glyph at 中; title/lead/intro shorter.
  const holdMs = () => {
    const k = idx < 0 ? 'i' : (cur()?.dataset.k || (turns[idx] && turns[idx][0]));
    const n = idx < 0 ? displayGlyphs(introLines.join('')) : displayGlyphs((turns[idx] || ['', ''])[1]);
    const short = k === 't' || k === 'n' || k === 'i';
    const ms = (short ? 700 : 1200) + n * (short ? 160 : 350);
    return Math.min(14000, Math.max(short ? 800 : 1400, ms)) / SPEEDS[speedI].k;
  };
  let wakeLock = null;
  const requestWake = () => {
    if (!navigator.wakeLock?.request) return;
    navigator.wakeLock.request('screen').then(l => {
      wakeLock = l;
      l.addEventListener?.('release', () => { if (wakeLock === l) wakeLock = null; });
    }).catch(() => {});
  };
  const releaseWake = () => { const l = wakeLock; wakeLock = null; try { l?.release(); } catch {} };
  function mount(i, how) {
    clearTimeout(tWrite); clearTimeout(tHold); clearTimeout(tOut); pendingNext = null;
    if (needsPaginate()) i = paginateToFit(i);
    field.textContent = '';
    idx = i;
    const el = build(i);
    field.appendChild(el);
    fit(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!R.dead && R.mode === 'dlg' && cur() === el) fit(el); }));
    el.style.setProperty('--step', stepMs() + 'ms');
    if (how === 'write' && !reduced()) {
      el.classList.add('writing'); phase = 'writing';
      tWrite = setTimeout(() => finish(), writeMs(el));
    } else {
      el.classList.add('done', (how === 'instant' || how === 'scrub') ? 'instant' : 'fade'); phase = 'held'; held();
    }
    paint(); savePos();
    if (how !== 'scrub') notePin(i, how);
    if (i >= 0) live.textContent = turns[i][1].replace(/\n/g, '');
    if (i >= 0 && !started) { started = true; stage.classList.remove('show-hint'); clearTimeout(tHint); }
  }
  function finish() {
    clearTimeout(tWrite);
    const el = cur(); if (!el) return;
    el.classList.remove('writing'); el.classList.add('done'); phase = 'held'; held(); paint();
  }
  function held() {
    clearTimeout(tHold);
    if (!playing) return;
    if (finalePlaying) return; // finish the lotus first; endFinale resumes held()
    if (idx >= N - 1) { tHold = setTimeout(() => pause(), Math.min(1200, holdMs())); return; }
    tHold = setTimeout(() => next(), holdMs());
  }
  function dissolveThen(cb) {
    const el = cur();
    if (!el) { cb(); return; }
    clearTimeout(tHold); phase = 'out'; pendingNext = cb;
    el.classList.remove('writing'); el.classList.add('out');
    tOut = setTimeout(() => { const f = pendingNext; pendingNext = null; f && f(); }, reduced() ? 260 : 720);
  }
  function next() {
    if (phase === 'out') { clearTimeout(tOut); const f = pendingNext; pendingNext = null; f && f(); return; }
    if (phase === 'writing') { finish(); return; }
    if (idx >= N - 1) { restart(); return; }
    dissolveThen(() => mount(idx + 1, 'write'));
  }
  function prev() {
    clearTimeout(tOut); pendingNext = null;
    if (idx < 0 && phase !== 'out') return;
    const t = Math.max(-1, (phase === 'out' ? idx : idx) - 1);
    mount(t, 'fade');
  }
  function restart() { pause(); mount(-1, 'write'); }
  function play() {
    if (idx >= N - 1 && phase !== 'out') mount(-1, 'write');
    playing = true; requestWake(); paint(); if (phase === 'held') held();
    announce('自動播放 Auto-play on');
  }
  function pause() { playing = false; clearTimeout(tHold); releaseWake(); paint(); }

  // ---------- chrome: the faint dot, tools, contents ----------
  function paint() {
    /* progress width + thumb are painted in paintScrub() */
    const sp = SPEEDS[speedI];
    $$('[data-a="play"]', stage).forEach(pl => {
      pl.setAttribute('aria-pressed', String(playing));
      const lab = playing ? '暫停 Pause auto-play' : '自動播放 Auto-play';
      pl.title = lab; pl.setAttribute('aria-label', lab);
    });
    $$('[data-a="speed"]', stage).forEach(sb => {
      sb.textContent = sp.t;
      const lab = `速度 Speed: ${sp.en}`;
      sb.setAttribute('aria-label', lab); sb.title = lab;
    });
    const vb = btn('vert'), v = stage.dataset.vert === '1'; vb.textContent = v ? '直' : '橫'; vb.setAttribute('aria-pressed', String(v)); vb.title = v ? '直排 Vertical · 點擊改橫排' : '橫排 Horizontal · 點擊改直排';
    $('#inkDot', stage).setAttribute('aria-label', `Show dialogue tools 顯示工具 (${idx + 1} / ${N})`);
    stage.classList.toggle('is-playing', playing);
    paintScrub();
    R.markToc?.();
  }
  const peek = on => {
    clearTimeout(tPeek);
    tools.classList.toggle('open', !!on);
    $('#inkDot', stage).setAttribute('aria-expanded', String(!!on));
    if (on) { revealScrub(3800); tPeek = setTimeout(() => peek(false), 3800); }
  };
  const bump = () => { if (tools.classList.contains('open')) { clearTimeout(tPeek); tPeek = setTimeout(() => peek(false), 3800); } };
  $('#inkDot', stage).onclick = e => { e.stopPropagation(); peek(true); if (e.detail === 0) btn('read').focus(); };
  const buildToc = () => {
    const list = $('#inkTocList', stage), c = R.curToc ? R.curToc() : -1;
    list.innerHTML = (R.toc || []).map((e, i) => `<li><button type="button" class="ink-toc-item${i === c ? ' cur' : ''}" data-i="${i}"${i === c ? ' aria-current="true"' : ''}>${esc(e.label)}</button></li>`).join('');
  };
  const toc = on => {
    tocEl.hidden = !on;
    if (on) { buildToc(); peek(false); $('.ink-toc-item.cur', tocEl)?.scrollIntoView({ block: 'center' }); ($('.ink-toc-item.cur', tocEl) || $('#inkTocX', stage)).focus({ preventScroll: true }); }
    else stage.focus({ preventScroll: true });
  };
  $('#inkTocX', stage).onclick = e => { e.stopPropagation(); toc(false); };
  $('#inkTocList', stage).onclick = e => { const b = e.target.closest('.ink-toc-item'); if (!b) return; e.stopPropagation(); R.gotoToc(R.toc[+b.dataset.i]); toc(false); };
  const act = {
    read: () => R.setMode('read'), prev: () => prev(), restart: () => restart(),
    play: () => (playing ? pause() : play()),
    speed: () => { speedI = (speedI + 1) % SPEEDS.length; st.dlgSpeed = SPEEDS[speedI].k; store.save(); const e = cur(); if (e) e.style.setProperty('--step', stepMs() + 'ms'); paint(); if (playing && phase === 'held') held(); },
    vert: () => { stage.dataset.vert = stage.dataset.vert === '1' ? '0' : '1'; st.dlgVert = stage.dataset.vert === '1'; store.save(); mount(paginateToFit(idx), 'instant'); paint(); },
    toc: () => toc(true), fs: () => fs.toggle(), close: () => peek(false),
    'lotus-reset': () => resetLotus(),
  };
  $('.ink-row', stage).addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; e.stopPropagation(); act[b.dataset.a]?.(); if (b.dataset.a !== 'close' && b.dataset.a !== 'read' && b.dataset.a !== 'toc') bump(); });
  $('.ink-row', stage).addEventListener('pointerdown', bump);
  const scrubEl = $('#inkScrub', stage), scrubLab = $('#inkScrubLab', stage), scrubHit = $('#inkScrubHit', stage), scrubThumb = $('#inkScrubThumb', stage);
  let scrubbing = false;
  const pinTitleAt = i => {
    if (i < 0) return introLines[0] || '';
    let title = '';
    for (let j = 0; j <= Math.min(i, N - 1); j++) if (turns[j][0] === 't') title = turns[j][1].split('\n')[0];
    return title;
  };
  const scrubLabel = i => {
    const title = pinTitleAt(i);
    if (i < 0) return (title || introLines[0] || '序') + ' · 序';
    return (title ? title + ' · ' : '') + (i + 1) + ' / ' + N;
  };
  const buildScrubTicks = () => {
    const box = $('#inkScrubTicks', stage);
    if (!box) return;
    box.textContent = '';
    for (let i = 0; i < N; i++) {
      if (turns[i][0] !== 't') continue;
      const tick = document.createElement('i');
      tick.className = 'ink-scrub-tick';
      tick.style.left = ((i + 1) / N * 100).toFixed(3) + '%';
      box.appendChild(tick);
    }
  };
  const paintScrub = () => {
    const pct = N ? ((idx + 1) / N * 100) : 0;
    const p = pct.toFixed(2) + '%';
    prog.style.width = p;
    if (scrubThumb) scrubThumb.style.left = p;
    if (scrubEl) {
      scrubEl.setAttribute('aria-valuenow', String(idx + 1));
      scrubEl.setAttribute('aria-valuemax', String(N));
      scrubEl.setAttribute('aria-valuetext', scrubLabel(idx));
    }
    if (scrubbing && scrubLab) { scrubLab.hidden = false; scrubLab.textContent = scrubLabel(idx); }
  };
  const revealScrub = (hold = 2800) => {
    if (!scrubEl) return;
    scrubEl.classList.add('show');
    clearTimeout(tScrub);
    if (!scrubbing) tScrub = setTimeout(() => { if (!scrubbing) scrubEl.classList.remove('show'); }, hold);
  };
  const idxFromClientX = x => {
    const track = $('.ink-scrub-track', stage);
    if (!track || !N) return idx;
    const r = track.getBoundingClientRect();
    const t = r.width ? (x - r.left) / r.width : 0;
    return Math.max(-1, Math.min(N - 1, Math.round(t * N) - 1));
  };
  const jumpScrub = i => {
    if (i === idx && phase !== 'out') { paintScrub(); return; }
    mount(i, 'scrub');
  };
  if (scrubEl) {
    scrubEl.setAttribute('role', 'slider');
    scrubEl.setAttribute('aria-label', '進度 Progress');
    scrubEl.setAttribute('aria-valuemin', '0');
  }
  const onScrubPtr = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    ptr0 = null;
    suppressNav = true;
    scrubbing = true;
    if (playing) pause();
    scrubEl.classList.add('dragging');
    revealScrub(60000);
    if (scrubLab) { scrubLab.hidden = false; }
    const go = ev => jumpScrub(idxFromClientX(ev.clientX));
    go(e);
    const move = ev => { ev.preventDefault(); go(ev); };
    const up = ev => {
      go(ev);
      scrubbing = false;
      scrubEl.classList.remove('dragging');
      if (scrubLab) tScrub = setTimeout(() => { if (!scrubbing) scrubLab.hidden = true; }, 900);
      revealScrub();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  scrubHit?.addEventListener('pointerdown', onScrubPtr);
  buildScrubTicks();

  $('#inkPlaybar', stage).addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; e.stopPropagation(); act[b.dataset.a]?.(); revealScrub(); });
  $('#inkPlaybar', stage).addEventListener('pointerdown', e => { e.stopPropagation(); revealScrub(); });
  // Phone / narrow / coarse-pointer, matching right-to-left vertical reading:
  // left two-thirds (including the centre) = next; right third = previous.
  // Desktop (wide + fine pointer): click anywhere still goes next, as before.
  // A tap while the passage is still being revealed always finishes the writing first.
  // Taps on the dot, tool row or contents do not navigate; a swipe is ignored; a tap
  // that only closes the tools or contents does not also turn the page.
  const sideNav = () => matchMedia('(max-width: 860px), (pointer: coarse)').matches;
  let ptr0 = null, suppressNav = false;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.ink-tools, .ink-toc, .ink-lotus, .ink-lotus-finale, .ink-lotus-tip, .ink-playbar, .ink-scrub')) { ptr0 = null; return; }
    suppressNav = false;
    if (tools.classList.contains('open')) { peek(false); suppressNav = true; }
    if (!tocEl.hidden) { toc(false); suppressNav = true; }
    ptr0 = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('click', e => {
    if (e.target.closest('.ink-tools, .ink-toc, .ink-lotus, .ink-lotus-finale, .ink-lotus-tip, .ink-playbar, .ink-scrub')) { suppressNav = false; return; }
    if (suppressNav) { suppressNav = false; return; }
    if (ptr0 && Math.hypot(e.clientX - ptr0.x, e.clientY - ptr0.y) > 28) { ptr0 = null; return; }
    ptr0 = null;
    if (playing) { pause(); return; }
    if (phase === 'writing') { finish(); return; }
    if (sideNav()) {
      const r = stage.getBoundingClientRect();
      if (e.clientX >= r.left + r.width * 2 / 3) prev();
      else next();
    } else next();
  });
  const onKey = e => {
    if (R.dead || R.mode !== 'dlg' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    const t = e.target, tag = t?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
    const k = e.key, onBtn = tag === 'BUTTON' || tag === 'A';
    if (k === 'Escape') { if (!tocEl.hidden) { toc(false); e.preventDefault(); } else if (tools.classList.contains('open')) { peek(false); } else if (playing) pause(); return; }
    if (!tocEl.hidden) return;
    if ((k === ' ' || k === 'Enter') && !onBtn) { e.preventDefault(); next(); }
    else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev(); }
    else if (k === 'p' || k === 'P') { e.preventDefault(); playing ? pause() : play(); }
  };
  document.addEventListener('keydown', onKey);
  const onVis = () => { if (document.hidden && playing) pause(); };
  document.addEventListener('visibilitychange', onVis);
  const onRs = debounce(() => R.fitInk(), 150);
  addEventListener('resize', onRs);
  R.cleanup.push(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); removeEventListener('resize', onRs); [tWrite, tHold, tOut, tPeek, tHint, tFinale, tLotusTip, tLotusLong, tScrub].forEach(clearTimeout); root.classList.remove('ink-lock'); releaseWake(); });

  // ---------- going to a place (TOC, switching modes) ----------
  const firstTurnOfBlock = bi => { const i = turns.findIndex(t => t[2] >= bi); return i < 0 ? N - 1 : i; };
  R.dlgGoto = bi => { pause(); mount(firstTurnOfBlock(bi), 'fade'); R.markToc?.(); };
  const num = a => +String(a).slice(1);
  const baseCur = R.curToc, baseGoto = R.gotoToc, baseFit = R.fitVertical;
  const lastBlock = () => (idx >= 0 && turns[idx] ? turns[idx][2] : -1);
  R.curToc = () => {
    if (R.mode !== 'dlg') return baseCur();
    const b = Math.max(0, lastBlock()); let c = 0;
    R.toc.forEach((e, i) => { if (num(e.anchor) <= b) c = i; });
    return c;
  };
  R.gotoToc = e => { if (R.mode !== 'dlg') return baseGoto(e); R.dlgGoto(num(e.anchor)); if (innerWidth < 860) R.closePanel(); };
  R.fitVertical = () => {
    if (R.mode !== 'dlg') return baseFit && baseFit();
    $$('#fontUp, #landPop [data-size="1"]').forEach(b => { b.removeAttribute('aria-disabled'); b.title = 'Larger text'; });
  };

  // ---------- 閱讀 Reading ⇄ 對話 Dialogue ----------
  const syncUI = () => {
    const dlg = R.mode === 'dlg';
    $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.m === 'dlg') === dlg)));
    const mb = $('#modeBtn');
    if (mb) { mb.textContent = dlg ? '閱讀' : '對話'; const l = dlg ? '切換到閱讀 Switch to Reading' : '切換到對話 Switch to Dialogue'; mb.setAttribute('aria-label', l); mb.title = l; }
    const tm = $('#tabMode');
    if (tm) { tm.setAttribute('aria-pressed', String(dlg)); const l = dlg ? '切換到閱讀 Switch to Reading' : '切換到對話 Switch to Dialogue'; tm.setAttribute('aria-label', l); tm.title = l; }
  };
  R.setMode = (m, { remember = true, silent = false } = {}) => {
    if (m === R.mode) return;
    const wasRead = R.mode === 'read';
    const keepEl = wasRead ? R.firstVisible() : null;
    pause(); clearTimeout(tWrite); clearTimeout(tOut);
    R.mode = m;
    const dlg = m === 'dlg';
    rd.classList.toggle('mode-dlg', dlg);
    root.classList.toggle('ink-lock', dlg);
    const docEl = $('.doc', R.root);
    rd.classList.toggle('is-vertical', !dlg && docEl.classList.contains('vertical'));
    hideBar(); getSelection().removeAllRanges();
    if (remember) { modeMap[R.id] = m; store.save(); }
    syncUI();
    if (dlg) {
      $('.vcoach button')?.click();
      if (R.sheetOpen && R.sheetOpen()) R.closePanel();
      peek(false); tocEl.hidden = true;
      let start = idx;
      if (keepEl && keepEl.dataset.anchor) { const t = firstTurnOfBlock(num(keepEl.dataset.anchor)); if (t > Math.max(idx, 0)) start = t; }
      const ready = Promise.race([document.fonts?.load('40px "RW Brush"', '世尊善現須菩提能斷金剛分金剛般若波羅蜜經玄奘譯鳩摩羅什藥師琉璃光如來本願功德經曼殊室利文殊阿難救脫藥叉馬鳴大乘起信論真諦菩薩造').catch(() => {}), new Promise(r => setTimeout(r, 1800))]);
      requestAnimationFrame(async () => {
        await ready;
        if (R.dead || R.mode !== 'dlg') return;
        fs.sync();
        mount(start, start < 0 ? 'write' : 'fade');
        if (start < 0 && !started) { clearTimeout(tHint); tHint = setTimeout(() => stage.classList.add('show-hint'), 2600); }
        stage.focus({ preventScroll: true });
        R.fitVertical();
      });
    } else {
      baseFit && baseFit();
      const b = lastBlock();
      requestAnimationFrame(() => {
        const el = b >= 0 && R.root.querySelector(`[data-anchor="b${b}"]`);
        if (el) R.restoreTo(el); else { scrollTo(0, 0); const d = R.vdoc && R.vdoc(); if (d) d.scrollLeft = 0; }
        R.edge && R.edge(); R.markToc?.();
      });
    }
    if (!silent) announce(dlg ? '對話模式 Dialogue mode' : '閱讀模式 Reading mode');
  };
  $$('#modeSeg button').forEach(b => b.onclick = () => R.setMode(b.dataset.m));
  $('#modeBtn')?.addEventListener('click', () => R.setMode(R.mode === 'dlg' ? 'read' : 'dlg'));
  $('#tabMode')?.addEventListener('click', () => R.setMode(R.mode === 'dlg' ? 'read' : 'dlg'));
  // anything that targets the reading text (notes list, links) shows the reading view first
  R.toReading = () => { if (R.mode === 'dlg') R.setMode('read', { silent: true }); };

  // state for tests / debugging
  R.dlg = { next, prev, play, pause, restart, goto: R.dlgGoto, finish,
    show: i => { pause(); mount(i, 'instant'); },
    open: (i, how) => { pause(); mount(i, how || 'fade'); },
    get shown() { return idx + 1; }, get idx() { return idx; }, get total() { return N; }, get playing() { return playing; }, get phase() { return phase; },
    get speed() { return SPEEDS[speedI].t; }, holdMs,
    scrubTo: i => { pause(); jumpScrub(i); }, revealScrub,
    sideNav, get turns() { return turns; }, paginate: () => paginateToFit(idx),
    lotus: {
      get has() { return hasLotus; },
      done: () => [...lotusState.done].sort((a, b) => a - b),
      get finalePlayed() { return !!lotusState.finale; },
      get finalePlaying() { return finalePlaying; },
      get ranges() { return lotusRanges; },
      pinOf: pinOfLastPage,
      lastPageOf: pin => (lotusRanges && pin >= 1 && pin <= 32) ? lotusRanges[pin - 1].end : -1,
      seed: (pins, { finale = false } = {}) => {
        if (!hasLotus) return;
        lotusState.done = new Set((pins || []).filter(n => n >= 1 && n <= 32));
        lotusState.finale = !!finale;
        persistLotus();
        endFinale();
        paintLotus();
      },
      earn: pin => notePin(lotusRanges && pin >= 1 && pin <= 32 ? lotusRanges[pin - 1].end : -1, 'fade'),
      reset: () => resetLotus({ confirm: false }),
      playFinale: () => playFinale({ replay: true }),
      endFinale,
    },
  };
  // start where we left off (the stage is drawn when the mode is entered)
  const saved = Math.min(N, Math.max(0, +posMap[R.id] || 0));
  idx = saved - 1;
  syncUI(); paint();
  if (modeMap[R.id] === 'dlg') requestAnimationFrame(() => requestAnimationFrame(() => { if (!R.dead) R.setMode('dlg', { remember: false, silent: true }); }));
}
