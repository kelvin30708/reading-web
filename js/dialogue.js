// 對話 Dialogue mode — "ink in the dark": one passage (one speaker turn, or a screen-sized part of a long one)
// writes itself character by character in brush script on a near-black screen, holds, then dissolves like ink.
// Speakers are told apart by ink colour only — there is no vermilion name-seal, so the screen stays quiet.
// The sutra's own speaker leads (佛告須菩提、須菩提白佛言、佛告具壽善現曰, 善現答言, and so on) are their own narration-colour pages, styled like 如是我聞, and sit immediately before the speech page. Punctuation is still not drawn. Classic four-phrase 偈 stay one page, one line per phrase, without the lead.
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
const MINOR = /[，、；：,;:]/, MAJOR = /[。！？!?．\s\u3000]/, DROP = /[「」『』《》〈〉（）()\[\]【】"'“”‘’·・—–…～~﹁﹂﹃﹄]/;
// Narrator frames spoken by Ānanda (佛告須菩提, 須菩提白佛言, 佛言, 曼殊室利言, 阿難白言, 而說偈言, …).
const LEAD_RE = /^((?:說是語已[，、]?|作是語已[，、]?)?(?:爾時[，、]?)?(?:(?:佛復告|佛告|世尊[，、]?復告|世尊告|世尊讚諸?)[^「」：:。！？，、；\n]{0,16}(?:曰|言)?|佛言|世尊而說(?:偈言|頌曰)|(?:同時舉聲)?[^「」：:。！？，、；\n]{0,16}(?:復|即)?(?:白佛言|白言|答言|問[^「」：:。！？，、；\n]{0,12}言|言曰|言[「：:]))[「：:]?)/;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ico = {
  prev: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg class="i-play" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3 L13 8 L5 13 Z" fill="currentColor"/></svg><svg class="i-pause" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 3.5v9M10.8 3.5v9" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>',
  restart: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v2.5h2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 9 L7 5 L11 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function setupDialogue(R, { store, $, $$, esc, announce, debounce, hideBar, fs }) {
  const turns = window.RW_DIALOGUE?.[R.id];
  if (!turns || !turns.length) return;
  const SPK = SPK_BY[R.id] || {};
  const introLines = INTRO[R.id] || ['', ''];
  const N = turns.length, st = store.data.settings;
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
    <p class="ink-hint" id="inkHint" aria-hidden="true"><span class="ink-hint-phone">左／中 下一頁 · 右 上一頁</span><span class="ink-hint-desk">輕點繼續 · Tap, Space or → · ← back · P plays</span></p>
    <div class="ink-edges" aria-hidden="true"><span class="ink-edge ink-edge-next">‹</span><span class="ink-edge ink-edge-prev">›</span></div>
    <div class="ink-line" aria-hidden="true"><i id="inkProg"></i></div>
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
        <button type="button" class="ik" data-a="close" aria-label="Hide tools 收起工具" title="Hide tools 收起工具">${ico.close}</button>
      </div>
    </div>
    <div class="ink-toc" id="inkToc" hidden role="dialog" aria-label="目錄 Contents"><button type="button" class="ik ink-toc-x" id="inkTocX" aria-label="Close contents 關閉目錄">✕</button><ol id="inkTocList"></ol></div>
    <p class="sr-only" id="dlgLive" aria-live="polite"></p>`;
  R.root.appendChild(stage);
  const field = $('#inkField', stage), hint = $('#inkHint', stage), prog = $('#inkProg', stage), live = $('#dlgLive', stage);
  const tools = $('#inkTools', stage), tocEl = $('#inkToc', stage);
  const btn = a => $(`[data-a="${a}"]`, stage);

  // ---------- state ----------
  let idx = -1, phase = 'idle', playing = false, tWrite = 0, tHold = 0, tOut = 0, tPeek = 0, tHint = 0, pendingNext = null, started = false;
  let speedI = SPEEDS.findIndex(s => s.k === st.dlgSpeed); if (speedI < 0) speedI = 1;
  const cur = () => field.firstElementChild;
  const lenOf = i => (i < 0 ? introLines.join('').length : turns[i][1].replace(/\n/g, '').length);
  const savePos = debounce(() => { if (!R.dead) { posMap[R.id] = idx + 1; store.save(); } }, 300);

  // ---------- building a passage ----------
  function build(i) {
    const intro = i < 0, t = intro ? null : turns[i], k = intro ? 'i' : t[0];
    const el = document.createElement('div');
    el.className = `ink-pass k-${k}`; el.dataset.i = String(i); el.dataset.k = k;
    let n = 0, gapW = 0;
    // Calligraphy has no punctuation marks: 「」『』 and other marks are dropped; ，、；： leave a small gap and 。！？ or a space a larger one,
    // as spacing on the preceding character (padding-inline-end works in vertical and horizontal writing). Display only: RW_DIALOGUE and the reading text keep their punctuation.
    const raw = intro ? introLines.join('\n') : t[1];
    const leadEnd = (!intro && k !== 't' && k !== 'n') ? ((raw.match(LEAD_RE) || ['',''])[1].length) : 0;
    const chars = (s, base = 0) => {
      const toks = [];
      let i = base;
      for (const c of s) {
        if (MINOR.test(c)) { if (toks.length) toks[toks.length - 1].g = Math.max(toks[toks.length - 1].g, 1); }
        else if (MAJOR.test(c)) { if (toks.length) toks[toks.length - 1].g = 2; }
        else if (DROP.test(c)) { i += c.length; continue; }
        else toks.push({ c, g: 0, lead: i < leadEnd });
        i += c.length;
      }
      if (toks.length) toks[toks.length - 1].g = 0;
      return toks.map(t => { gapW += t.g === 2 ? 0.7 : t.g === 1 ? 0.3 : 0; return `<span class="ch${t.lead ? ' lead' : ''}${t.g ? ' g' + t.g : ''}" style="--i:${n++}">${esc(t.c)}</span>`; }).join('');
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
  // font size: large and calligraphic, shrunk until the passage fits the screen without scrolling
  function fit(el) {
    const vert = stage.dataset.vert === '1', t = $('.ink-text', el), k = el.dataset.k;
    const cs = getComputedStyle(field);
    const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
    const padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
    const aw = field.clientWidth - padL - padR;
    const ah = field.clientHeight - padT - padB;
    const AW = aw, AH = ah;
    const len = +el.dataset.n, wlen = +el.dataset.w || len, verse = k !== 'i' && k !== 't' && t.querySelectorAll('.ln').length > 1;
    const f = (k === 'i' || k === 't') ? 1.0 : len <= 8 ? 1.32 : len <= 16 ? 1.2 : len <= 30 ? 1.08 : 1;
    const kf = k === 'n' ? 0.66 : 1;
    let S = (vert ? 56 : Math.min(aw / 12, ah / 15) * f) * kf;
    S = Math.max(17, Math.min(vert ? 56 : 46, S));
    const ls = k === 'n' ? 0.16 : 0.1;
    t.style.letterSpacing = ls + 'em';
    t.style.transform = 'none';
    // Content box of the field (inside padding). WebKit's vertical-rl often reports a stretched
    // parent box and, with overflow:hidden on the stage, may clamp glyph rects — open overflow
    // while measuring, then centre the painted glyphs (Safari packs vertical-rl to the right).
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
    const apply = s => {
      t.style.transform = 'none';
      t.style.fontSize = s + 'px';
      el.style.setProperty('--fs-ink', s + 'px');
      el.style.fontSize = s + 'px';
      t.querySelectorAll('.ch').forEach(n => {
        const ln = n.closest('.ln');
        const scale = ln && ln.classList.contains('t1') ? 1.3 : ln && ln.classList.contains('t2') ? 0.46 : 1;
        n.style.setProperty('font-size', (s * scale) + 'px', 'important');
      });
      if (!vert && t.classList.contains('is-verse')) {
        const pitch = 1.85 * s;
        t.querySelectorAll('.ln').forEach(n => {
          if (n.classList.contains('t1') || n.classList.contains('t2')) return;
          n.style.fontSize = s + 'px';
          n.style.lineHeight = pitch + 'px';
          n.style.height = pitch + 'px';
        });
      }
      if (vert) { t.style.maxHeight = AH + 'px'; t.style.maxWidth = ''; }
      else { t.style.maxWidth = AW + 'px'; t.style.maxHeight = ''; }
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
    apply(S);
    let guard = 0;
    while (!measure() && S > 12 && guard++ < 50) { S -= 1.5; apply(S); }
    // balance the columns so a short passage is not one long column plus a stub
    if (vert && !verse && len > 10 && k !== 'i' && k !== 't') {
      const r = t.getBoundingClientRect(), pitch = S * (1 + ls) * 1.0, linePitch = S * (vert ? 1.75 : 1.85);
      const cols = Math.max(1, Math.round(r.width / linePitch));
      if (cols > 1) {
        const per = Math.ceil(wlen / cols), h = Math.min(AH, (per + 0.7) * pitch);
        t.style.maxHeight = h + 'px';
        if (t.getBoundingClientRect().width > r.width + 2) t.style.maxHeight = AH + 'px';
      }
    }
    centre();
    guard = 0;
    while (!measure() && S > 12 && guard++ < 30) { S -= 1.5; apply(S); centre(); }
    el.style.setProperty('--fs-ink', S + 'px');
  }
  R.fitInk = () => { const e = cur(); if (e && R.mode === 'dlg') fit(e); };

  // ---------- writing, holding, dissolving ----------
  const stepMs = () => SPEEDS[speedI].step * (cur()?.dataset.k === 'n' ? 0.7 : 1);
  const writeMs = el => (+el.dataset.n) * stepMs() + 900;
  const holdMs = () => Math.min(7500, Math.max(1500, 1000 + lenOf(idx) * 70)) / SPEEDS[speedI].k;
  function mount(i, how) {
    clearTimeout(tWrite); clearTimeout(tHold); clearTimeout(tOut); pendingNext = null;
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
      el.classList.add('done', how === 'instant' ? 'instant' : 'fade'); phase = 'held'; held();
    }
    paint(); savePos();
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
    if (idx >= N - 1) { tHold = setTimeout(() => pause(), 900); return; }
    tHold = setTimeout(() => next(), idx < 0 ? 1600 : holdMs());
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
    if (idx >= N - 1 && phase !== 'out') { pause(); mount(-1, 'write'); }
    playing = true; paint(); if (phase === 'held') held();
    announce('Auto-play on');
  }
  function pause() { playing = false; clearTimeout(tHold); paint(); }

  // ---------- chrome: the faint dot, tools, contents ----------
  function paint() {
    prog.style.width = ((idx + 1) / N * 100).toFixed(2) + '%';
    const pl = btn('play'); pl.setAttribute('aria-pressed', String(playing)); pl.title = playing ? '暫停 Pause (P)' : '自動播放 Auto-play (P)'; pl.setAttribute('aria-label', playing ? '暫停 Pause auto-play' : '自動播放 Auto-play');
    const sp = SPEEDS[speedI], sb = btn('speed'); sb.textContent = sp.t; sb.setAttribute('aria-label', `速度 Speed: ${sp.en}`); sb.title = `速度 Speed: ${sp.en}`;
    const vb = btn('vert'), v = stage.dataset.vert === '1'; vb.textContent = v ? '直' : '橫'; vb.setAttribute('aria-pressed', String(v)); vb.title = v ? '直排 Vertical · 點擊改橫排' : '橫排 Horizontal · 點擊改直排';
    $('#inkDot', stage).setAttribute('aria-label', `Show dialogue tools 顯示工具 (${idx + 1} / ${N})`);
    stage.classList.toggle('is-playing', playing);
    R.markToc?.();
  }
  const peek = on => {
    clearTimeout(tPeek);
    tools.classList.toggle('open', !!on);
    $('#inkDot', stage).setAttribute('aria-expanded', String(!!on));
    if (on) tPeek = setTimeout(() => peek(false), 3800);
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
    vert: () => { stage.dataset.vert = stage.dataset.vert === '1' ? '0' : '1'; st.dlgVert = stage.dataset.vert === '1'; store.save(); const e = cur(); if (e) { fit(e); } paint(); },
    toc: () => toc(true), fs: () => fs.toggle(), close: () => peek(false),
  };
  $('.ink-row', stage).addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; e.stopPropagation(); act[b.dataset.a]?.(); if (b.dataset.a !== 'close' && b.dataset.a !== 'read' && b.dataset.a !== 'toc') bump(); });
  $('.ink-row', stage).addEventListener('pointerdown', bump);
  // Phone / narrow / coarse-pointer, matching right-to-left vertical reading:
  // left two-thirds (including the centre) = next; right third = previous.
  // Desktop (wide + fine pointer): click anywhere still goes next, as before.
  // A tap while the passage is still being revealed always finishes the writing first.
  // Taps on the dot, tool row or contents do not navigate; a swipe is ignored; a tap
  // that only closes the tools or contents does not also turn the page.
  const sideNav = () => matchMedia('(max-width: 860px), (pointer: coarse)').matches;
  let ptr0 = null, suppressNav = false;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.ink-tools, .ink-toc')) { ptr0 = null; return; }
    if (tools.classList.contains('open')) { peek(false); suppressNav = true; }
    if (!tocEl.hidden) { toc(false); suppressNav = true; }
    ptr0 = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('click', e => {
    if (e.target.closest('.ink-tools, .ink-toc')) { suppressNav = false; return; }
    if (suppressNav) { suppressNav = false; return; }
    if (ptr0 && Math.hypot(e.clientX - ptr0.x, e.clientY - ptr0.y) > 28) { ptr0 = null; return; }
    ptr0 = null;
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
  R.cleanup.push(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); removeEventListener('resize', onRs); [tWrite, tHold, tOut, tPeek, tHint].forEach(clearTimeout); root.classList.remove('ink-lock'); });

  // ---------- going to a place (TOC, switching modes) ----------
  const firstTurnOfBlock = bi => { const i = turns.findIndex(t => t[2] >= bi); return i < 0 ? N - 1 : i; };
  R.dlgGoto = bi => { pause(); mount(firstTurnOfBlock(bi), 'fade'); R.markToc?.(); };
  const num = a => +String(a).slice(1);
  const baseCur = R.curToc, baseGoto = R.gotoToc, baseFit = R.fitVertical;
  const lastBlock = () => (idx >= 0 ? turns[idx][2] : -1);
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
  R.dlg = { next, prev, play, pause, restart, goto: R.dlgGoto, finish, show: i => { pause(); mount(i, 'instant'); },
    get shown() { return idx + 1; }, get idx() { return idx; }, get total() { return N; }, get playing() { return playing; }, get phase() { return phase; },
    sideNav, turns };
  // start where we left off (the stage is drawn when the mode is entered)
  const saved = Math.min(N, Math.max(0, +posMap[R.id] || 0));
  idx = saved - 1;
  syncUI(); paint();
  if (modeMap[R.id] === 'dlg') requestAnimationFrame(() => requestAnimationFrame(() => { if (!R.dead) R.setMode('dlg', { remember: false, silent: true }); }));
}
