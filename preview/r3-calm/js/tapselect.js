// 點選 Tap-select: an easier way to select text, made for 直排 on phones (works with mouse too).
//  · tap a character      → selects its phrase (up to ，。；：、！？ and the like)
//  · tap another character → extends the selection to cover it (tap the start, then the end)
//  · double-tap / long-press → the whole sentence (up to 。！？) or verse line
//  · drag the two handles  → adjust start and end, one character at a time
//  · tap inside the selection or on blank space → clear
// It only ever produces an ordinary DOM Range, so highlights are anchored exactly as before.
const PHRASE = /[，。；：、！？,.;:!?「」『』“”‘’（）()《》\n]/;
const SENTENCE = /[。！？.!?\n]/;
const OPEN = /[「『“‘（(《\s]/;
const CLOSE = /[」』”’）)》]/;

function nodesOf(el) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const out = []; let n; while ((n = w.nextNode())) out.push(n); return out; }
function index(el) { const nodes = nodesOf(el); let full = ''; const starts = []; for (const n of nodes) { starts.push(full.length); full += n.data; } return { nodes, starts, full }; }
function toPos(ix, i) {
  for (let k = ix.nodes.length - 1; k >= 0; k--) if (i >= ix.starts[k]) return [ix.nodes[k], Math.min(i - ix.starts[k], ix.nodes[k].data.length)];
  return [ix.nodes[0], 0];
}
function toIndex(ix, node, off) { const k = ix.nodes.indexOf(node); return k < 0 ? -1 : ix.starts[k] + off; }

// the character under a point: [container, index into its text] or null
export function charAt(root, x, y) {
  let node, off;
  if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (!p) return null; node = p.offsetNode; off = p.offset; }
  else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (!r) return null; node = r.startContainer; off = r.startOffset; }
  if (!node || node.nodeType !== 3) return null;
  const el = node.parentElement?.closest('[data-anchor]'); if (!el || !root.contains(el)) return null;
  const ix = index(el); const base = toIndex(ix, node, off); if (base < 0) return null;
  // the caret sits between characters; pick the neighbour whose box contains the point
  const r = document.createRange();
  for (const i of [base, base - 1, base + 1]) {
    if (i < 0 || i >= ix.full.length) continue;
    r.setStart(...toPos(ix, i)); r.setEnd(...toPos(ix, i + 1));
    for (const b of r.getClientRects()) if (x >= b.left - 2 && x <= b.right + 2 && y >= b.top - 2 && y <= b.bottom + 2) return { el, i, ix };
  }
  return { el, i: Math.min(base, ix.full.length - 1), ix };
}
function span(full, i, re) {
  let s = i, e = i + 1;
  if (re.test(full[i])) return [i, i + 1];
  while (s > 0 && !re.test(full[s - 1])) s--;
  while (e < full.length && !re.test(full[e])) e++;
  if (e < full.length && full[e] !== '\n' && !OPEN.test(full[e])) e++;   // take the closing mark (，。) with the phrase
  while (e < full.length && CLOSE.test(full[e])) e++;
  while (s < e && OPEN.test(full[s])) s++;
  return [s, e];
}
const cmp = (a, b) => { const r = document.createRange(); r.setStart(a[0], a[1]); r.collapse(true); const q = document.createRange(); q.setStart(b[0], b[1]); q.collapse(true); return r.compareBoundaryPoints(Range.START_TO_START, q); };

export function setupTapSelect(R, { isOn, onCleared }) {
  const root = R.root;
  const sel = () => getSelection();
  const hs = document.createElement('div'); hs.className = 'ts-handle ts-start'; hs.setAttribute('aria-hidden', 'true');
  const he = document.createElement('div'); he.className = 'ts-handle ts-end'; he.setAttribute('aria-hidden', 'true');
  document.body.append(hs, he);
  const setRange = (a, b) => { const r = document.createRange(); r.setStart(...a); r.setEnd(...b); sel().removeAllRanges(); sel().addRange(r); place(); };
  const cur = () => { const s = sel(); return s.rangeCount && !s.isCollapsed && root.contains(s.getRangeAt(0).commonAncestorContainer) ? s.getRangeAt(0) : null; };
  const vert = () => !!R.vdoc?.();
  function place() {
    const r = isOn() && cur(); if (!r) { hs.hidden = he.hidden = true; return; }
    const rects = [...r.getClientRects()].filter(b => b.width && b.height); if (!rects.length) { hs.hidden = he.hidden = true; return; }
    const a = rects[0], z = rects[rects.length - 1], v = vert();
    hs.hidden = he.hidden = false; hs.classList.toggle('v', v); he.classList.toggle('v', v);
    // 直排: start handle above the first character, end handle below the last; 橫排: before / after
    const P = v ? [[a.left + a.width / 2, a.top], [z.left + z.width / 2, z.bottom]] : [[a.left, a.top + a.height / 2], [z.right, z.top + z.height / 2]];
    hs.style.transform = `translate(${P[0][0]}px,${P[0][1]}px)`; he.style.transform = `translate(${P[1][0]}px,${P[1][1]}px)`;
  }
  function pick(c, re) { const [s, e] = span(c.ix.full, c.i, re); setRange(toPos(c.ix, s), toPos(c.ix, e)); }
  let last = null, lpTimer = null, lpDone = false, down = null, lpAt = 0, lpRange = null;
  function tap(x, y, dbl) {
    const c = charAt(root, x, y);
    if (!c) { if (cur()) { sel().removeAllRanges(); place(); onCleared?.(); } return; }
    if (dbl) { pick(c, SENTENCE); return; }
    const r = cur();
    if (r) {
      const p = toPos(c.ix, c.i), q = toPos(c.ix, c.i + 1);
      const inside = cmp(p, [r.startContainer, r.startOffset]) >= 0 && cmp(q, [r.endContainer, r.endOffset]) <= 0;
      if (inside) { sel().removeAllRanges(); place(); onCleared?.(); return; }
      const [s, e] = span(c.ix.full, c.i, PHRASE); const ps = toPos(c.ix, s), pe = toPos(c.ix, e);
      const a = cmp(ps, [r.startContainer, r.startOffset]) < 0 ? ps : [r.startContainer, r.startOffset];
      const b = cmp(pe, [r.endContainer, r.endOffset]) > 0 ? pe : [r.endContainer, r.endOffset];
      setRange(a, b); return;
    }
    pick(c, PHRASE);
  }
  const onDown = e => {
    if (!isOn() || e.button > 0 || e.target.closest('mark.hl, .xl, .xt') && !cur() && !document.body.classList.contains('link-mode')) return;
    if (!e.target.closest('[data-anchor]') && !e.target.closest('.doc')) return;
    down = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId }; lpDone = false;
    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => { if (!down) return; lpDone = true; const c = charAt(root, down.x, down.y); if (c) { pick(c, SENTENCE); lpAt = Date.now(); lpRange = cur()?.cloneRange(); navigator.vibrate?.(8); } }, 450);
    if (e.pointerType === 'mouse') e.preventDefault(); // no native drag-select fighting the tap
  };
  const onMove = e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; clearTimeout(lpTimer); } };
  const onUp = e => {
    clearTimeout(lpTimer);
    if (!down || !isOn()) { down = null; return; }
    const d = down; down = null;
    if (lpDone) { e.preventDefault(); return; }
    const now = Date.now(), dbl = last && now - last.t < 380 && Math.hypot(d.x - last.x, d.y - last.y) < 24;
    last = dbl ? null : { t: now, x: d.x, y: d.y };
    // let a single tap settle first, so a double-tap doesn't flash the phrase then the sentence
    tap(d.x, d.y, dbl);
    e.preventDefault();
  };
  const onCtx = e => { if (isOn() && root.contains(e.target)) e.preventDefault(); };   // no OS menu on long-press
  const onClick = e => { if (isOn() && root.contains(e.target) && (!e.target.closest('mark.hl, .xl, .xt') || document.body.classList.contains('link-mode'))) e.stopPropagation(); };
  root.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove, { passive: true });
  root.addEventListener('pointerup', onUp); root.addEventListener('contextmenu', onCtx); root.addEventListener('click', onClick);
  root.addEventListener('pointercancel', () => { down = null; clearTimeout(lpTimer); });
  root.addEventListener('mousedown', e => { if (isOn() && e.button === 0 && !e.target.closest('a,button,mark.hl,.xl,.xt')) e.preventDefault(); });
  // handles: drag to move the start or the end, snapping to characters
  for (const [h, isStart] of [[hs, true], [he, false]]) {
    h.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); h.setPointerCapture?.(e.pointerId); h.classList.add('drag');
      const mv = ev => {
        const r = cur(); if (!r) return;
        const v = vert(); // aim at the character just past the knob, not under the finger
        const x = ev.clientX + (v ? 0 : (isStart ? 12 : -12)), y = ev.clientY + (v ? (isStart ? 14 : -14) : 0);
        const c = charAt(root, x, y); if (!c) return;
        if (isStart) { const p = toPos(c.ix, c.i); if (cmp(p, [r.endContainer, r.endOffset]) < 0) setRange(p, [r.endContainer, r.endOffset]); }
        else { const p = toPos(c.ix, c.i + 1); if (cmp(p, [r.startContainer, r.startOffset]) > 0) setRange([r.startContainer, r.startOffset], p); }
      };
      const up = () => { h.classList.remove('drag'); h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
  }
  // a phone's own long-press word selection can land just after ours: put the sentence back
  const onSel = () => {
    if (lpRange && Date.now() - lpAt < 900) { const r = cur(); if (!r || r.compareBoundaryPoints(Range.START_TO_START, lpRange) || r.compareBoundaryPoints(Range.END_TO_END, lpRange)) { const k = lpRange; lpRange = null; sel().removeAllRanges(); sel().addRange(k); lpRange = k; } }
    requestAnimationFrame(place);
  };
  document.addEventListener('selectionchange', onSel);
  const onScroll = () => place();
  addEventListener('scroll', onScroll, { passive: true }); root.addEventListener('scroll', onScroll, { capture: true, passive: true }); addEventListener('resize', onScroll);
  R.cleanup.push(() => { hs.remove(); he.remove(); removeEventListener('pointermove', onMove); document.removeEventListener('selectionchange', onSel); removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); clearTimeout(lpTimer); });
  return { place, clear: () => { if (cur()) sel().removeAllRanges(); place(); } };
}
