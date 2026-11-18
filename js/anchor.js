// Highlight anchoring engine. A "container" is any element with [data-anchor];
// highlights are stored as character offsets inside containers (+ the quoted text),
// so they survive re-rendering of text and of pdf.js text layers.

// whitespace between two CJK characters/punctuation is a layout artefact (line breaks), not a real space
export const CJK_GAP = /([\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF])\s+(?=[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF])/g;
export const tidyCJK = s => s.replace(CJK_GAP, '$1');

function textNodes(el) {
  const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) out.push(n);
  return out;
}
export function containerText(el) { return textNodes(el).map(n => n.data).join(''); }

function offsetIn(container, node, offset) {
  // character offset of (node, offset) within container's text
  if (node.nodeType !== 3) {
    // element boundary: count text before child[offset]
    const r = document.createRange(); r.setStart(container, 0);
    try { r.setEnd(node, offset); } catch { return 0; }
    return r.toString().length;
  }
  let total = 0;
  for (const t of textNodes(container)) { if (t === node) return total + offset; total += t.data.length; }
  return total;
}

// Split a DOM Range into per-container parts {c, s, e}
export function rangeToParts(range, root) {
  const parts = [];
  const all = [...root.querySelectorAll('[data-anchor]')];
  for (const c of all) {
    if (!range.intersectsNode(c)) continue;
    const len = containerText(c).length;
    const s = c.contains(range.startContainer) ? offsetIn(c, range.startContainer, range.startOffset) : 0;
    const e = c.contains(range.endContainer) ? offsetIn(c, range.endContainer, range.endOffset) : len;
    if (e > s && containerText(c).slice(s, e).trim()) parts.push({ c: c.dataset.anchor, s, e });
  }
  return parts;
}

export function partsText(parts, root) {
  return parts.map(p => {
    const c = root.querySelector(`[data-anchor="${p.c}"]`);
    return c ? containerText(c).slice(p.s, p.e) : '';
  }).join(' ').replace(/\s+/g, ' ').replace(CJK_GAP, '$1').trim();
}

function wrap(container, s, e, mk) {
  let pos = 0;
  for (const t of textNodes(container)) {
    const a = pos, b = pos + t.data.length; pos = b;
    if (b <= s || a >= e) continue;
    let node = t;
    const from = Math.max(s, a) - a, to = Math.min(e, b) - a;
    if (to < node.data.length) node.splitText(to);
    if (from > 0) node = node.splitText(from);
    if (!node.data.length) continue;
    const m = mk(); node.parentNode.insertBefore(m, node); m.appendChild(node);
  }
}

export function unpaint(container) {
  container.querySelectorAll('mark.hl').forEach(m => { m.replaceWith(...m.childNodes); });
  container.normalize();
}

// Paint all highlights (array) that touch this container.
export function paint(container, highlights) {
  unpaint(container);
  const key = container.dataset.anchor;
  for (const h of highlights) {
    for (const p of h.parts) {
      if (p.c !== key) continue;
      let first = true;
      wrap(container, p.s, p.e, () => {
        const m = document.createElement('mark');
        m.className = `hl hl-${h.color}` + (h.note ? ' has-note' : '');
        m.dataset.id = h.id;
        if (first) { m.tabIndex = -1; /* roving tabindex: app.js makes one mark the Tab stop (N5a) */ m.setAttribute('role', 'button'); m.setAttribute('aria-label', 'Highlight: ' + (h.quote || '').slice(0, 80)); first = false; }
        return m;
      });
    }
  }
}

// Sentence around a selection (for flashcard context)
export function sentenceAround(text, s, e) {
  const stop = /[.!?。！？；\n」』”]/;
  let a = s; while (a > 0 && !stop.test(text[a - 1])) a--;
  let b = e; while (b < text.length && !stop.test(text[b])) b++;
  if (b < text.length) b++;
  let out = text.slice(a, b).trim();
  if (out.length > 320) { const mid = Math.max(0, s - a - 140); out = (mid > 0 ? '…' : '') + out.slice(mid, mid + 300).trim() + '…'; }
  return tidyCJK(out);
}
