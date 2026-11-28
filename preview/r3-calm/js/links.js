import { isUnlocated } from './anchor.js';
// Cross-reference links between passages. Stored separately from highlights (store.data.links),
// anchored with the same {c, s, e} parts; painted as <span> wrappers that never add or remove text,
// so highlight offsets and every other anchor stay exactly as they were.
function textNodes(el) { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) out.push(n); return out; }
function wrap(container, s, e, mk) {
  let pos = 0;
  for (const t of textNodes(container)) {
    const a = pos, b = pos + t.data.length; pos = b;
    if (b <= s || a >= e) continue;
    let node = t; const from = Math.max(s, a) - a, to = Math.min(e, b) - a;
    if (to < node.data.length) node.splitText(to);
    if (from > 0) node = node.splitText(from);
    if (!node.data.length) continue;
    const m = mk(); node.parentNode.insertBefore(m, node); m.appendChild(node);
  }
}
export function unpaintLinks(container) {
  const spans = container.querySelectorAll('span.xl, span.xt'); if (!spans.length) return;
  spans.forEach(m => m.replaceWith(...m.childNodes)); container.normalize();
}
const short = s => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > 40 ? s.slice(0, 40) + '…' : s; };
// links: [{id, src:{parts,quote}, dst:{parts,quote}}] for this document
export function paintLinks(container, links) {
  const key = container.dataset.anchor;
  for (const L of links) for (const [side, cls] of [['src', 'xl'], ['dst', 'xt']]) {
    if (isUnlocated(L[side])) continue;
    const parts = L[side]?.parts || []; const lastIdx = parts.length - 1;
    parts.forEach((p, pi) => {
      if (p.c !== key) return;
      const made = [];
      wrap(container, p.s, p.e, () => { const m = document.createElement('span'); m.className = cls; m.dataset.lid = L.id; made.push(m); return m; });
      if (pi === 0 && made[0]) { const m = made[0]; m.tabIndex = 0; m.setAttribute('role', 'link');
        m.setAttribute('aria-label', side === 'src' ? `連結 Link to: ${short(L.dst.quote)}` : `被連結 Linked from: ${short(L.src.quote)} — go back`); }
      if (pi === lastIdx && made.length) made[made.length - 1].classList.add(cls + '-end');
    });
  }
}
