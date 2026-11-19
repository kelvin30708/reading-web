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
    if (unlocated.has(h)) continue;
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

// Safe re-anchor: if a stored quote no longer matches the text at its offsets
// (the block was edited), search the same block and update {c,s,e} only.
// Records whose quote cannot be found are kept but not painted.
const unlocated = new WeakSet();
export const isUnlocated = rec => !!rec && unlocated.has(rec);

export function normAnchor(s) {
  return tidyCJK(String(s ?? '').replace(/\s+/g, ' ')).trim();
}

function tidyIndexMap(s) {
  const chars = [], map = [];
  const CJK = /[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/;
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) {
      const prev = chars[chars.length - 1];
      let j = i; while (j < s.length && /\s/.test(s[j])) j++;
      const next = s[j];
      if (!(prev && CJK.test(prev) && next && CJK.test(next))) {
        if (chars.length) { chars.push(' '); map.push(i); }
      }
      i = j; continue;
    }
    chars.push(s[i]); map.push(i); i++;
  }
  while (chars.length && chars[0] === ' ') { chars.shift(); map.shift(); }
  while (chars.length && chars[chars.length - 1] === ' ') { chars.pop(); map.pop(); }
  return { tidy: chars.join(''), map };
}

function lev(a, b, cap) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function editCap(n) { return n < 8 ? 1 : n < 20 ? 2 : 3; }

export function closeEnough(a, b) {
  const na = normAnchor(a), nb = normAnchor(b);
  if (na === nb) return true;
  if (!na || !nb) return false;
  const cap = editCap(Math.max(na.length, nb.length));
  return lev(na, nb, cap) <= cap;
}

export function findOccurrences(text, quote) {
  const nq = normAnchor(quote);
  if (!nq || !text) return [];
  const hits = [];
  const seen = new Set();
  const add = (s, e) => {
    if (e > s && s >= 0 && e <= text.length && !seen.has(s + ':' + e)) {
      seen.add(s + ':' + e); hits.push({ s, e });
    }
  };
  if (quote) {
    let i = 0;
    while ((i = text.indexOf(quote, i)) !== -1) { add(i, i + quote.length); i += Math.max(1, quote.length); }
  }
  const { tidy, map } = tidyIndexMap(text);
  let i = 0;
  while ((i = tidy.indexOf(nq, i)) !== -1) {
    const s = map[i], last = map[i + nq.length - 1];
    if (s != null && last != null) add(s, last + 1);
    i += 1;
  }
  if (!hits.length && nq.length >= 4 && nq.length <= 80) {
    const cap = Math.min(2, editCap(nq.length));
    for (let k = 0; k < tidy.length; k++) {
      for (let len = Math.max(1, nq.length - cap); len <= nq.length + cap && k + len <= tidy.length; len++) {
        if (lev(tidy.slice(k, k + len), nq, cap) <= cap) {
          const s = map[k], last = map[k + len - 1];
          if (s != null && last != null) add(s, last + 1);
        }
      }
    }
  }
  return hits;
}

function pickHit(hits, hintS, context, text, quote) {
  if (!hits.length) return null;
  if (hits.length === 1) return hits[0];
  const hint = Number.isFinite(hintS) ? hintS : 0;
  const nq = normAnchor(quote), nc = context ? normAnchor(context) : '';
  const scored = hits.map(h => {
    let score = -Math.abs(h.s - hint);
    if (nc) {
      const win = normAnchor(text.slice(Math.max(0, h.s - 120), Math.min(text.length, h.e + 120)));
      if (win.includes(nc)) score += 1000;
      else {
        const i = nc.indexOf(nq);
        if (i >= 0) {
          const before = nc.slice(Math.max(0, i - 24), i);
          const after = nc.slice(i + nq.length, i + nq.length + 24);
          const gotB = normAnchor(text.slice(Math.max(0, h.s - 40), h.s));
          const gotA = normAnchor(text.slice(h.e, Math.min(text.length, h.e + 40)));
          if (before && gotB.endsWith(before)) score += 400;
          if (after && gotA.startsWith(after)) score += 400;
        }
      }
    }
    return { h, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].h;
}

export function healRecord(rec, getText) {
  if (!rec || !rec.parts?.length || !rec.quote) return 'ok';
  const texts = rec.parts.map(p => getText(p.c));
  const missing = texts.some(t => t == null);
  if (!missing) {
    unlocated.delete(rec);
    const combined = rec.parts.map((p, i) => {
      const t = texts[i];
      const s = Math.max(0, p.s ?? 0), e = Math.min(t.length, p.e ?? t.length);
      return s < e ? t.slice(s, e) : '';
    }).join('');
    if (closeEnough(combined, rec.quote)) return 'ok';
  }
  const available = rec.parts.map((p, i) => ({ p, t: texts[i] })).filter(x => x.t != null);
  for (const { p, t } of available) {
    const found = pickHit(findOccurrences(t, rec.quote), p.s, rec.context, t, rec.quote);
    if (found) {
      rec.parts = [{ c: p.c, s: found.s, e: found.e }];
      unlocated.delete(rec);
      return 'updated';
    }
  }
  if (missing) return 'pending';
  unlocated.add(rec);
  return 'skip';
}

export function healForContainer(container, records) {
  const key = container.dataset.anchor;
  const text = containerText(container);
  const getText = c => c === key ? text : null;
  const updated = [];
  for (const rec of records || []) {
    if (!rec?.parts?.some(p => p.c === key)) continue;
    if (healRecord(rec, getText) === 'updated') updated.push(rec);
  }
  return updated;
}
