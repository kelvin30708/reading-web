// 目錄 Contents: section list for built-in texts, the PDF outline for PDFs (or headings detected from the text layer).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 藥師經 (T0450) has no headings in the text; these are the traditional landmarks, keyed by paragraph.
const LANDMARKS = {
  'medicine-zh': [[1, '序分 · 廣嚴城法會'], [2, '曼殊室利請法'], [5, '東方淨琉璃世界'], [6, '十二大願'],
    ...['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'].map((n, i) => [7 + i, `第${n}大願`, 1]),
    [19, '淨琉璃國土莊嚴'], [21, '聞名功德 · 離慳貪'], [27, '藥師灌頂真言'], [29, '持咒供養'], [31, '曼殊室利誓願流通'],
    [35, '阿難信受'], [41, '救脫菩薩 · 續命幡燈'], [47, '十二藥叉大將'], [50, '經名 · 奉持'], [51, '流通分']],
};
const ZH_NUM = '[一二三四五六七八九十百千零〇两兩0-9０-９]+';
const CHAPTER = new RegExp(`^(第${ZH_NUM}[章節节篇部回卷講讲課课]|(chapter|part|book|section)\\s+([0-9]+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\b|prologue\\b|epilogue\\b|introduction\\b|conclusion\\b|preface\\b|acknowledg)`, 'i');

export function textToc(R) {
  const cs = R.containers();
  const heads = cs.filter(c => c.tagName === 'H3');
  if (heads.length) return heads.map(h => { const t = h.textContent.trim(); const m = t.match(/^(.*?)『(.*)』$/);
    return { label: m ? m[1] : t, sub: m ? m[2] : '', level: 0, anchor: h.dataset.anchor }; });
  return (LANDMARKS[R.id] || []).map(([i, label, level = 0]) => ({ label, level, anchor: 'b' + i, landmark: true })).filter(e => cs.some(c => c.dataset.anchor === e.anchor));
}

async function resolveDest(pdf, dest) {
  try {
    if (typeof dest === 'string') dest = await pdf.getDestination(dest);
    if (!Array.isArray(dest) || !dest.length) return null;
    const ref = dest[0];
    const page = typeof ref === 'number' ? ref + 1 : (await pdf.getPageIndex(ref)) + 1;
    const top = dest[1]?.name === 'XYZ' ? dest[3] : (dest[1]?.name === 'FitH' || dest[1]?.name === 'FitBH') ? dest[2] : null;
    return { page, top: typeof top === 'number' ? top : null };
  } catch { return null; }
}
export async function pdfOutline(pdf) {
  const ol = await pdf.getOutline().catch(() => null);
  if (!ol || !ol.length) return null;
  const out = [];
  const walk = async (items, level) => { for (const it of items) {
    const d = await resolveDest(pdf, it.dest);
    out.push({ label: (it.title || '').trim() || '—', level: Math.min(level, 4), page: d?.page ?? null, top: d?.top ?? null, url: it.url || null });
    if (it.items?.length) await walk(it.items, level + 1);
  } };
  await walk(ol, 0);
  return out;
}
// No outline: look for lines set larger than the body text, or "Chapter 3" / "第三章" lines.
export async function pdfDetect(pdf, onProgress, isDead) {
  const N = Math.min(pdf.numPages, 600); const lines = [];
  for (let n = 1; n <= N; n++) {
    if (isDead()) return null;
    const page = await pdf.getPage(n); const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const size = Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10 || it.height;
      const y = Math.round(it.transform[5]);
      const k = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
      const r = rows.get(k) || { y: k, size: 0, text: '', chars: 0 }; r.text += (/[A-Za-z0-9,.;:]$/.test(r.text) && /^[A-Za-z0-9]/.test(it.str) ? ' ' : '') + it.str; r.size = Math.max(r.size, size); r.chars += it.str.length; rows.set(k, r);
    }
    for (const r of rows.values()) lines.push({ page: n, top: r.y + r.size, text: r.text.replace(/\s+/g, ' ').trim(), size: r.size, chars: r.chars, h: vp.height });
    if (n % 10 === 0) { onProgress?.(n, N); await new Promise(r => setTimeout(r)); }
  }
  if (!lines.length) return [];
  // body size = the size carrying the most characters
  const bySize = new Map(); for (const l of lines) bySize.set(l.size, (bySize.get(l.size) || 0) + l.chars);
  const body = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0][0];
  // running heads/feet repeat on many pages: drop them
  const freq = new Map(); for (const l of lines) freq.set(l.text, (freq.get(l.text) || 0) + 1);
  let cand = lines.filter(l => l.text.length >= 2 && l.text.length <= 90 && freq.get(l.text) <= 3 && !/^\d+$/.test(l.text) &&
    (CHAPTER.test(l.text) || l.size >= body * 1.3));
  const perPage = new Map(); for (const l of cand) perPage.set(l.page, (perPage.get(l.page) || 0) + 1);
  cand = cand.filter(l => CHAPTER.test(l.text) || perPage.get(l.page) <= 3);
  const sizes = [...new Set(cand.map(l => l.size))].sort((a, b) => b - a);
  const out = []; for (const l of cand) {
    const prev = out[out.length - 1];
    if (prev && prev.page === l.page && Math.abs(prev.top - l.top) < l.size * 2.2 && prev.size === l.size) { prev.label += ' ' + l.text; continue; } // a title wrapped onto 2 lines
    out.push({ label: l.text, level: CHAPTER.test(l.text) || l.size >= sizes[0] ? 0 : 1, page: l.page, top: l.top, size: l.size, auto: true });
  }
  return out.slice(0, 300);
}

export function renderTocList(el, entries, { auto, landmark, empty }) {
  if (!entries) { el.innerHTML = `<p class="hint toc-note">${empty}</p>`; return; }
  if (!entries.length) { el.innerHTML = `<div class="empty-state"><p lang="zh-Hant">沒有找到目錄</p><p>No contents found in this document.</p></div>`; return; }
  el.innerHTML = (auto ? `<p class="hint toc-note">自動偵測 · Auto-detected from headings in the text</p>` : landmark ? `<p class="hint toc-note">段落標記 · Traditional landmarks (the text has no headings)</p>` : '') +
    `<ol class="toc" role="list">${entries.map((e, i) => `<li style="--lvl:${e.level || 0}"><button type="button" class="toc-item" data-i="${i}"${e.page == null && e.anchor == null ? ' disabled' : ''}>
      <span class="toc-l">${esc(e.label)}</span>${e.sub ? `<span class="toc-s">${esc(e.sub)}</span>` : ''}${e.page != null ? `<span class="toc-p">${e.page}</span>` : ''}</button></li>`).join('')}</ol>`;
}
