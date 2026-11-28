# Reading Web · 讀書筆記

A static reading and note-taking web app. No backend, no build step, no account. Everything is saved in your browser (localStorage + IndexedDB).

## Run it
Browsers block ES modules on `file://`, so serve the folder:

    cd reading-web
    python3 -m http.server 8000      # then open http://localhost:8000

Any static host works too (GitHub Pages, Netlify, Cloudflare Pages, etc.): upload the folder as-is.

## Features
- Library: built-in slots for the Diamond Sutra (Chinese Kumārajīva and Xuanzang, plus English), the Medicine Buddha Sutra (Chinese and English), the Awakening of Faith 大乘起信論 (Paramārtha), two bilingual Chinese–Tibetan Tara praises, and 刻意練習 *Peak* (your own PDF), plus “Upload your own PDF”.
- Reader for built-in texts and PDFs (pdf.js with text layer). Select text, then pick a color: yellow, green, pink or blue. Click a highlight to recolor it, add a note, or remove it.
- Side panel lists every highlight and note (filter by color, click to jump), plus **Export .md**.
- Flashcards 單字卡: select a word, then **＋ Card**. It saves the sentence context and source. English words are looked up automatically at dictionaryapi.dev (editable); for Chinese terms you type your own definition. Review mode flips cards, and you mark them Known or Again (Leitner boxes 1–5: every session, 1, 3, 7, 14 days). Keys: Space to flip, 1 for Again, 2 for Known.
- Light/dark theme, text size (A−/A+; on PDFs it changes zoom), responsive layout (the panel becomes a bottom sheet on phones), reading position remembered, JSON backup/restore.

## Texts & licenses
| Slot | Text | Source | License |
|---|---|---|---|
| 金剛經 中文 | 鳩摩羅什 譯 (T0235), 江味農校定本 with 32 分 headings | https://zh.wikisource.org/wiki/金剛般若波羅蜜經_(鳩摩羅什) | Public domain |
| Diamond Sutra EN | Lapis Lazuli Texts translation of Kumārajīva’s T0235 | https://www.lapislazulitexts.com/tripitaka/T0235-LL-vajracchedika/ | CC0 1.0 |
| 藥師經 中文 | 玄奘 譯 (T0450) | https://zh.wikisource.org/wiki/藥師琉璃光如來本願功德經 | Public domain |
| Medicine Buddha EN | Minh Thành & P. D. Leigh, *Sutra of the Medicine Buddha* (IBMI 2001), from Xuanzang’s T0450 | https://zenodo.org/records/14569042 (CC BY 4.0); text taken from the free-distribution PDF https://www.buddhistelibrary.org/en/albums/asst/ebook/medbudsutra.pdf | CC BY 4.0 (Zenodo); the book says “strictly for free distribution”, reprint permission granted on request |
| 大乘起信論 | 真諦 譯 (T1666), traditionally 馬鳴菩薩造; 序 and the five 分 as headings | Kanripo KR6o0078; CBETA T32n1666 (punctuation by 西蓮淨苑) | Work PD; Kanripo CC BY-SA 4.0; CBETA e-text CC BY-NC-SA 4.0 |
| 白救度佛母讚 · 漢藏 | 清 阿旺扎什 譯 (T1109) with the matching Tibetan praise traditionally by the 2nd Dalai Lama | Kanripo KR6j0319; CBETA T20n1109; Tibetan recension aligned to T1109 | Works PD; Kanripo CC BY-SA 4.0; CBETA e-text CC BY-NC-SA 4.0 |
| 度母二十一禮讚 · 漢藏 | 元 安藏 譯 (T1108A) with Derge Kangyur D438 / Toh 438 | CBETA T20n1108A; Esukhia Digital Derge Kangyur (UVA-SOAS eKangyur, BDRC W4CZ5369) | Works PD; CBETA e-text CC BY-NC-SA 4.0; Esukhia transcription PD |
| 刻意練習 Peak | Not included (copyrighted) | your own PDF | — |

pdf.js (Apache-2.0) is in `vendor/pdfjs/`.
