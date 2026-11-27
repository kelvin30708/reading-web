// 對話 Dialogue mode: a text's speaker turns (window.RW_DIALOGUE[id]) shown as chat bubbles, one by one.
// World: 世尊 (the Buddha) on the left, 善現 / 須菩提 (Subhūti) on the right, narration as small centred captions.
// The reading view (.doc) stays untouched in the DOM, so highlights, notes, flashcards and links keep their anchors.
// Dialogue bubbles are a read-only presentation (no [data-anchor]): marking happens in 閱讀 Reading.
const SPK = {
  b: { name: '世尊', sub: 'The Buddha', av: '<svg viewBox="0 0 40 40" focusable="false"><circle cx="20" cy="20" r="14.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="82 9" transform="rotate(-64 20 20)"/><circle cx="20" cy="20" r="3.3" fill="var(--shu)"/></svg>' },
  s: { name: '善現', sub: '須菩提 Subhūti', av: '<svg viewBox="0 0 40 40" focusable="false"><rect x="5.5" y="5.5" width="29" height="29" rx="4.5" fill="var(--shu)"/><text x="20" y="27.6" text-anchor="middle" font-size="19" font-weight="600" fill="var(--bg)">現</text></svg>' },
};
const SPEEDS = [{ k: 0.7, t: '慢', en: 'slow' }, { k: 1, t: '中', en: 'normal' }, { k: 1.7, t: '快', en: 'fast' }];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function setupDialogue(R, { store, $, $$, esc, announce, debounce, hideBar }) {
  const turns = window.RW_DIALOGUE?.[R.id];
  if (!turns || !turns.length) return;
  const N = turns.length, st = store.data.settings;
  const posMap = (st.dlgPos ||= {});
  const modeMap = (st.modeByDoc ||= {});
  const rd = $('.reader');
  R.mode = 'read';

  // ---- build the stage (all rows exist, hidden, so a reveal never reflows what is already read)
  const stage = document.createElement('section');
  stage.className = 'chat'; stage.id = 'dlgStage'; stage.setAttribute('lang', 'zh-Hant'); stage.setAttribute('aria-label', '對話 Dialogue');
  let prevSp = null;
  const rows = turns.map(([k, text, b], i) => {
    if (k === 'n') { prevSp = null; return `<li class="dl-row dl-n" data-i="${i}" data-b="${b}" hidden><p class="dl-cap">${esc(text)}</p></li>`; }
    const sp = SPK[k], cont = prevSp === k; prevSp = k;
    const verse = text.includes('\n');
    return `<li class="dl-row dl-${k}${cont ? ' dl-cont' : ''}" data-i="${i}" data-b="${b}" hidden>
      <span class="dl-av" aria-hidden="true">${cont ? '' : sp.av}</span>
      <div class="dl-body">${cont ? '' : `<span class="dl-name"><b>${sp.name}</b><small>${sp.sub}</small></span>`}<p class="dl-bub${verse ? ' dl-verse' : ''}"><span class="sr-only">${sp.name}：</span>${esc(text)}</p></div></li>`;
  }).join('');
  stage.innerHTML = `<div class="chat-scroll" id="dlgScroll" tabindex="-1">
      <div class="chat-col">
        <header class="chat-intro">
          <p class="chat-kicker">對話 Dialogue</p>
          <h2>${esc(R.info.short)}</h2>
          <p class="chat-legend"><span class="lg"><i class="dl-av" aria-hidden="true">${SPK.b.av}</i>世尊 · The Buddha</span><span class="lg"><i class="dl-av" aria-hidden="true">${SPK.s.av}</i>善現（須菩提）· Subhūti</span></p>
          <p class="chat-hint"><span class="chat-hint-go">輕點畫面、按空白鍵或 → 顯示下一句</span><br><small>Tap, press Space or → for the next line · ← goes back · P plays</small></p>
          <p class="chat-hint2"><small>螢光筆、筆記與單字卡請在「閱讀」中使用 · Highlights, notes and flashcards live in Reading.</small></p>
        </header>
        <ol class="chat-list" id="dlgList">${rows}</ol>
        <div class="dl-row dl-typing" id="dlgTyping" hidden aria-hidden="true"><span class="dl-av"></span><div class="dl-body"><p class="dl-bub"><i></i><i></i><i></i></p></div></div>
        <p class="chat-end" id="dlgEnd" hidden>— 圓滿 · End —</p>
      </div>
    </div>
    <div class="chat-dock" role="group" aria-label="Dialogue controls 對話控制">
      <button type="button" class="dk dk-prev" id="dlgPrev" aria-label="上一句 Previous line" title="上一句 Previous (←)"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <button type="button" class="dk dk-next" id="dlgNext" aria-label="下一句 Next line" title="下一句 Next (Space / →)"><span class="dk-t">下一句</span><small class="dk-c"></small></button>
      <button type="button" class="dk dk-play" id="dlgPlay" aria-pressed="false" aria-label="自動播放 Auto-play" title="自動播放 Auto-play (P)"><svg class="i-play" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3 L13 8 L5 13 Z" fill="currentColor"/></svg><svg class="i-pause" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
      <button type="button" class="dk dk-speed" id="dlgSpeed" aria-label="" title="速度 Speed"></button>
      <button type="button" class="dk dk-restart" id="dlgRestart" aria-label="從頭開始 Restart" title="從頭開始 Restart"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v2.5h2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
    <p class="sr-only" id="dlgLive" aria-live="polite"></p>`;
  R.root.appendChild(stage);

  const sc = $('#dlgScroll', stage), list = $('#dlgList', stage), typing = $('#dlgTyping', stage), end = $('#dlgEnd', stage), live = $('#dlgLive', stage);
  const rowEls = [...list.children];
  const btn = { prev: $('#dlgPrev', stage), next: $('#dlgNext', stage), play: $('#dlgPlay', stage), speed: $('#dlgSpeed', stage), restart: $('#dlgRestart', stage) };
  let shown = 0, playing = false, timer = 0, typingT = 0, speedI = SPEEDS.findIndex(s => s.k === st.dlgSpeed); if (speedI < 0) speedI = 1;

  const savePos = debounce(() => { if (!R.dead) { posMap[R.id] = shown; store.save(); } }, 300);
  const lastBlock = () => (shown ? turns[shown - 1][2] : -1);
  const paint = () => {
    btn.prev.disabled = shown <= 0;
    const done = shown >= N;
    $('.dk-t', btn.next).textContent = done ? '從頭 Again' : shown ? '下一句' : '開始';
    $('.dk-c', btn.next).textContent = `${shown} / ${N}`;
    btn.next.setAttribute('aria-label', done ? '從頭再來 Start again' : shown ? `下一句 Next line (${shown} of ${N})` : '開始 Begin');
    end.hidden = !done;
    stage.classList.toggle('dl-started', shown > 0);
    if (R.mode === 'dlg') $('#prog').style.width = (shown / N * 100).toFixed(1) + '%';
    btn.play.setAttribute('aria-pressed', String(playing));
    btn.play.setAttribute('aria-label', playing ? '暫停 Pause auto-play' : '自動播放 Auto-play');
    btn.play.title = playing ? '暫停 Pause (P)' : '自動播放 Auto-play (P)';
    stage.classList.toggle('dl-playing', playing);
    const sp = SPEEDS[speedI]; btn.speed.textContent = sp.t; btn.speed.setAttribute('aria-label', `速度 Speed: ${sp.en}`); btn.speed.title = `速度 Speed: ${sp.en} · 點擊切換 click to change`;
    R.markToc?.();
  };
  const scrollEnd = (instant) => {
    const smooth = !instant && !reduced();
    sc.scrollTo({ top: sc.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };
  const hideTyping = () => { clearTimeout(typingT); typing.hidden = true; };
  // reveal rows [from, to) – animate only a single new row
  const setShown = (n, { animate = true, silent = false } = {}) => {
    n = Math.max(0, Math.min(N, n));
    const was = shown; shown = n;
    hideTyping();
    rowEls.forEach((el, i) => {
      const on = i < n;
      if (on && el.hidden) { el.hidden = false; if (animate && n === was + 1 && i === n - 1 && !reduced()) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); } }
      else if (!on && !el.hidden) { el.hidden = true; el.classList.remove('enter'); }
    });
    paint(); savePos();
    if (n > was && n === was + 1) scrollEnd(!animate); else if (n !== was) scrollEnd(true);
    if (!silent && n > was && n === was + 1) {
      const t = turns[n - 1]; live.textContent = t[0] === 'n' ? t[1] : `${SPK[t[0]].name}：${t[1].replace(/\n/g, '')}`;
    }
    if (n >= N) pause();
    return n;
  };
  // ---- auto-play: read time scales with the line, a soft "typing" beat before a spoken line
  const readMs = i => {
    const t = turns[i]; const len = t[1].length;
    const base = t[0] === 'n' ? 1100 + len * 60 : 1300 + len * 85;
    return Math.min(9000, Math.max(1500, base)) / SPEEDS[speedI].k;
  };
  const schedule = () => {
    clearTimeout(timer); hideTyping();
    if (!playing || R.mode !== 'dlg') return;
    if (shown >= N) { pause(); return; }
    const wait = shown ? readMs(shown - 1) : 700;
    const next = turns[shown];
    const beat = (!reduced() && next[0] !== 'n') ? Math.min(650, 430 / SPEEDS[speedI].k + 150) : 0;
    timer = setTimeout(() => {
      if (!playing) return;
      if (beat) {
        typing.className = `dl-row dl-typing dl-${next[0]}`; typing.hidden = false;
        $('.dl-av', typing).innerHTML = prevKind() === next[0] ? '' : SPK[next[0]].av;
        scrollEnd();
        typingT = setTimeout(() => { typing.hidden = true; if (playing) { setShown(shown + 1); schedule(); } }, beat);
      } else { setShown(shown + 1); schedule(); }
    }, Math.max(0, wait - beat));
  };
  const prevKind = () => { const t = shown ? turns[shown - 1][0] : null; return t === 'n' ? null : t; };
  function play() { if (shown >= N) setShown(0, { animate: false, silent: true }); playing = true; paint(); schedule(); announce('Auto-play on'); }
  function pause() { if (!playing && !timer) { paint(); return; } playing = false; clearTimeout(timer); timer = 0; hideTyping(); paint(); }
  const next = () => { if (shown >= N) { restart(); return; } setShown(shown + 1); if (playing) schedule(); };
  const prev = () => { setShown(shown - 1, { animate: false, silent: true }); if (playing) schedule(); };
  const restart = () => { pause(); setShown(0, { animate: false, silent: true }); sc.scrollTo({ top: 0, behavior: 'auto' }); };
  btn.next.onclick = e => { e.stopPropagation(); next(); };
  btn.prev.onclick = e => { e.stopPropagation(); prev(); };
  btn.restart.onclick = e => { e.stopPropagation(); restart(); };
  btn.play.onclick = e => { e.stopPropagation(); playing ? pause() : play(); };
  btn.speed.onclick = e => { e.stopPropagation(); speedI = (speedI + 1) % SPEEDS.length; st.dlgSpeed = SPEEDS[speedI].k; store.save(); paint(); if (playing) schedule(); };
  // tap / click on the page = next line (not while selecting text, not on controls)
  stage.addEventListener('click', e => {
    if (e.target.closest('.chat-dock, button, a, summary')) return;
    if (!getSelection().isCollapsed) return;
    next();
  });
  const onKey = e => {
    if (R.dead || R.mode !== 'dlg' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    const t = e.target, tag = t?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable || t?.closest?.('#panel, #ctxMenu, #selbar')) return;
    const onBtn = tag === 'BUTTON' || tag === 'A';
    const k = e.key;
    if ((k === ' ' || k === 'Enter') && !onBtn) { e.preventDefault(); next(); }
    else if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'Backspace') { e.preventDefault(); prev(); }
    else if (k === 'p' || k === 'P') { e.preventDefault(); playing ? pause() : play(); }
    else if (k === 'Escape' && playing) { pause(); }
  };
  document.addEventListener('keydown', onKey);
  const onVis = () => { if (document.hidden && playing) pause(); };
  document.addEventListener('visibilitychange', onVis);
  R.cleanup.push(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); clearTimeout(timer); clearTimeout(typingT); });

  // ---- going to a place (TOC, switching modes)
  const firstTurnOfBlock = bi => { const i = turns.findIndex(t => t[2] >= bi); return i < 0 ? N - 1 : i; };
  R.dlgGoto = bi => {
    const i = firstTurnOfBlock(bi);
    pause(); setShown(i + 1, { animate: false, silent: true });
    const row = rowEls[i]; if (row) row.scrollIntoView({ block: 'center', behavior: 'auto' });
    R.markToc?.();
  };
  const num = a => +String(a).slice(1);
  const baseCur = R.curToc, baseGoto = R.gotoToc;
  R.curToc = () => {
    if (R.mode !== 'dlg') return baseCur();
    const b = Math.max(0, lastBlock()); let cur = 0;
    R.toc.forEach((e, i) => { if (num(e.anchor) <= b) cur = i; });
    return cur;
  };
  R.gotoToc = e => {
    if (R.mode !== 'dlg') return baseGoto(e);
    R.dlgGoto(num(e.anchor));
    if (innerWidth < 860) R.closePanel();
  };
  const baseFit = R.fitVertical;
  R.fitVertical = () => {
    if (R.mode !== 'dlg') return baseFit && baseFit();
    $$('#fontUp, #landPop [data-size="1"]').forEach(b => { b.removeAttribute('aria-disabled'); b.title = 'Larger text'; });
  };

  // ---- 閱讀 Reading ⇄ 對話 Dialogue
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
    pause();
    R.mode = m;
    const dlg = m === 'dlg';
    rd.classList.toggle('mode-dlg', dlg);
    const docEl = $('.doc', R.root);
    // the bar reads right → left only for 直排 text; the chat is always horizontal
    rd.classList.toggle('is-vertical', !dlg && docEl.classList.contains('vertical'));
    hideBar();
    getSelection().removeAllRanges();
    if (remember) { modeMap[R.id] = m; store.save(); }
    syncUI();
    if (dlg) {
      $('.vcoach button')?.click(); // the 直排 swipe hint does not apply to the chat
      if (keepEl && keepEl.dataset.anchor) { const t = firstTurnOfBlock(num(keepEl.dataset.anchor)); if (t + 1 > shown) setShown(t + 1, { animate: false, silent: true }); }
      paint();
      requestAnimationFrame(() => { scrollEnd(true); if (shown === 0) sc.scrollTo({ top: 0, behavior: 'auto' }); });
      R.fitVertical();
    } else {
      baseFit && baseFit();
      const b = lastBlock();
      requestAnimationFrame(() => {
        const el = b >= 0 && R.root.querySelector(`[data-anchor="b${b}"]`);
        if (el) R.restoreTo(el); else { scrollTo(0, 0); const d = R.vdoc && R.vdoc(); if (d) d.scrollLeft = 0; }
        R.edge && R.edge(); R.markToc?.();
      });
      $('#prog').style.width = '';
    }
    if (!silent) announce(dlg ? '對話模式 Dialogue mode' : '閱讀模式 Reading mode');
  };
  $$('#modeSeg button').forEach(b => b.onclick = () => R.setMode(b.dataset.m));
  $('#modeBtn')?.addEventListener('click', () => R.setMode(R.mode === 'dlg' ? 'read' : 'dlg'));
  $('#tabMode')?.addEventListener('click', () => R.setMode(R.mode === 'dlg' ? 'read' : 'dlg'));
  // anything that targets the reading text (notes list, links) shows the reading view first
  R.toReading = () => { if (R.mode === 'dlg') R.setMode('read', { silent: true }); };

  // state for tests / debugging
  R.dlg = { next, prev, play, pause, restart, goto: R.dlgGoto, get shown() { return shown; }, get total() { return N; }, get playing() { return playing; }, turns };
  // start where we left off
  const saved = Math.min(N, Math.max(0, +posMap[R.id] || 0));
  if (saved) setShown(saved, { animate: false, silent: true }); else paint();
  syncUI();
  if (modeMap[R.id] === 'dlg') requestAnimationFrame(() => requestAnimationFrame(() => { if (!R.dead) R.setMode('dlg', { remember: false, silent: true }); }));
}
