# Reading Web — Zen modern redesign (和紙 · 墨 · 間)

Date: 2026-11-18 · Backup of the pre-redesign app: `/workspace/reading-web-backup-20261118-113947`

## Direction
A quiet reading room: washi paper and sumi ink, generous ma (whitespace), 1px hairlines in place of boxes
and shadows, small radii (6/10px), one ink-indigo action colour, and a vermilion seal (hanko) used sparingly.
Highlights use natural pigments at low opacity, so marked passages look like a brush wash, not neon.

## Palette
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F7F4EE` washi | `#15171C` sumi-ai black | page |
| `--paper` | `#FBFAF6` | `#1C1F25` | cards, note items, dialog |
| `--panel` | `#F1EDE5` | `#191C22` | notes panel |
| `--ink` | `#2B2B2B` sumi | `#E7E2D7` | body text (12.9:1 / 13.9:1) |
| `--muted` | `#6B665E` | `#A29D93` | secondary text (5.2:1 / 6.6:1) |
| `--line` / `--line-strong` | `#E2DCD0` / `#CFC7B8` | `#2A2E36` / `#3A3F49` | hairlines, button borders |
| `--accent` | `#2F4B6E` ai 藍 | `#9DB4D3` | primary buttons, links, focus (8.1:1 / 8.5:1) |
| `--shu` | `#A8442A` shu/kaki 柿 | `#D98A6A` | logo seal, sutra section headings, progress line, note underline (5.4:1 / 6.7:1) |
| `--danger` | `#A3392B` | `#E39486` | delete |

Highlight colours (stored keys unchanged: yellow/green/pink/blue, so existing highlights still render):
| Key | Name | Light fill | Dark fill | Swatch |
|---|---|---|---|---|
| yellow | 山吹 Yamabuki | `rgba(214,168,58,.30)` | `rgba(216,178,98,.26)` | `#D2A443` |
| green | 抹茶 Matcha | `rgba(128,152,76,.30)` | `rgba(163,179,122,.24)` | `#8A9B5A` |
| pink | 桜 Sakura | `rgba(214,128,140,.28)` | `rgba(217,161,169,.24)` | `#D49AA2` |
| blue | 藍 Ai | `rgba(88,124,170,.26)` | `rgba(140,170,212,.26)` | `#5E7FA8` |

## Type
Fonts load from Google Fonts (`display=swap`) with system fallbacks: **Noto Serif TC** (CJK sutra text, headings),
**Noto Serif** (English reading), **Inter + Noto Sans TC** (UI).

| Role | Font | Size / line-height / tracking |
|---|---|---|
| Hero title | Noto Serif TC 500 | clamp(28–40px) / 1.3 / .04em |
| Page title (deck, review) | Noto Serif TC 500 | clamp(24–32px) |
| Card title | Noto Serif TC 500 | 21px / 1.45 / .03em |
| Reading, English | Noto Serif | `--fs` (19px default, A−/A+ 14–32) / 1.9, measure 40em |
| Reading, Chinese | Noto Serif TC | `--fs` / **2.15** / **.06em**, measure 34em (~32 字/行), justified, strict line-break |
| Vertical 直排 | Noto Serif TC | `--fs` / 2.1 / .12em |
| Sutra section heading | Noto Serif TC 600, shu | 1.02em / .08em |
| UI body | Inter / Noto Sans TC | 15px / 1.5; buttons 14px (small 13px) |
| Labels / eyebrow | Inter 500–600 uppercase | 11.5–13px / .12–.14em |

Spacing: library 56px top padding, 20px grid gap, 26/24px card padding; reader 64px top padding.
Motion: 0.28s `cubic-bezier(.2,.6,.2,1)` fades/lifts, 0.7s card flip; everything is disabled under `prefers-reduced-motion`.
Touch targets: `--tap` = 40px on desktop, **44px** on coarse pointers (all buttons, nav, swatches, note-panel controls).

## Files changed
- `css/app.css`: rewritten (all tokens, components, responsive rules, vertical mode, reduced motion). The vendored pdf.js `.textLayer` rules are kept unchanged.
- `index.html`: Google Fonts preconnect and stylesheet, theme-color `#F7F4EE`, vermilion seal favicon, named and aria-labelled highlight swatches (Yamabuki/Matcha/Sakura/Ai), aria-label on the remove button.
- `js/app.js` (small, targeted):
  - `COLORS` now points at CSS variables (`var(--sw-*)`), so the panel follows the theme; added `COLOR_NAMES`.
  - Theme-color meta values updated.
  - The note-panel colour pickers are now real swatch dots (`.dot`) with `aria-pressed` and labels (were ○/● glyphs); filter swatches have `aria-pressed`.
  - **Mobile highlight flow:** on touch or narrow screens the selection toolbar docks to the bottom of the screen (44px targets) instead of floating next to the selection, where it collided with the OS copy/paste callout.
  - **直排 vertical text** (Chinese texts only, toggle button in the reader bar). **On by default** for 金剛經 · 中文 and 藥師經 · 中文 (decision 2026-11-18). If the user switches a text to horizontal (or back), that choice is remembered **per text** in `settings.verticalByDoc[docId]`. English texts and PDFs are never vertical and don't show the button. How it works: `writing-mode: vertical-rl`, horizontal scroller, the mouse wheel scrolls right→left, and progress and reading position are tracked. Highlights, notes, cards and jump-to-highlight all work in vertical mode (tested).
  - Reader root gets `data-lang`; panel title is now “Highlights & notes · 筆記”; close button has an aria-label.

## Verified (headless Chrome, 1280×800 and 390×844 @2x)
0 console errors. Fresh storage opens 金剛經 in 直排 by default; a per-text horizontal choice survives reload while 藥師經 stays vertical; English and PDF stay horizontal; saved position restores in vertical mode; jump-to-highlight works in vertical mode. Open text → highlight (horizontal and vertical) → note → flashcard create → review (flip + Known → box 2) → PDF upload/render → dark mode. On mobile, no visible control is under 44px.
Screenshots: `screenshots/zen/` (default-vertical proof: `fresh-diamond-zh-vertical-default.png`). Test script: `/workspace/zen_shots.py`.

## Open items
- Fonts come from Google Fonts (external request). For fully offline or private use, self-host the woff2 files in `vendor/fonts/`.
- In 直排 mode, Latin and digits in the colophon run sideways (`text-orientation: mixed`); `text-combine-upright` for numbers could be added later.
- PDF pages keep their own paper colour. Dark mode still uses the existing invert filter (now with a slight sepia).

## 對話 Dialogue mode — "ink in the dark" (Xuanzang Diamond Sutra, diamond-xz)
- texts/diamond-xz.js: the CBETA T07n0220 juan 577 text (RW_TEXTS) and 233 speaker passages (RW_DIALOGUE: [n|b|s, text, block]). A passage = one speaker turn; long turns are cut at clause punctuation (<= ~64 chars) so each fits one phone screen; verses stay whole with their line breaks. Speaker leads such as 佛告具壽善現曰 / 佛告善現 / 善現答言 stay at the start of the passage; there is no name-seal.
- js/dialogue.js: a fixed full-screen near-black stage (.ink) over the reader, with a faint ink-wash/vignette. ONE passage at a time. Reading .doc stays in the DOM (highlights/notes/cards/links keep their anchors).
- Type: "RW Brush" = subset of MasaFont 正風毛筆 (OFL 1.1). Vertical (直排, right-to-left) by default, horizontal available from the tools. fit() picks the largest font size (<= 56px) that fits without scrolling, balancing columns.
- Reveal: every character is a span with --i; keyframes ink-in (transparent + wide blurred halo -> sharp stroke) staggered 80-150ms/char (speed button: 慢/中/快). Speakers are told apart by ink colour only (no vermilion name-seal). Narration is smaller and dimmer. The sutra's own speaker leads stay at the start of the passage. Tap while writing = finish writing; tap when written = dissolve (opacity + blur, 720ms) then the next one writes in. ← goes back.
- Chrome: only the faint dot (top-right). It opens a one-row tool strip (閱讀, back, play, speed, 直/橫, contents, restart, fullscreen). Hairline vermilion progress at the bottom edge.
- Settings: modeByDoc, dlgPos, dlgSpeed, dlgVert (optional keys, storage format unchanged).
- Keys: Space/Enter/→/↓ next, ←/↑/Backspace back, P play/pause, Esc close. prefers-reduced-motion: no per-character animation, simple fades.
- Gotcha: transitions on .ink-text are disabled (a reduced-motion rule gives every element a .01ms transition and getComputedStyle then lags, breaking fit()).

## 對話 Dialogue mode — Kumārajīva Chinese Diamond Sutra (diamond-zh)
- Same ink-in-the-dark stage as the Xuanzang text. 閱讀/對話 toggle; Reading mode (highlights, links, re-anchor) is unchanged: RW_TEXTS is not altered.
- texts/diamond-zh.js: NTU/CBETA T0235 text plus the traditional 昭明太子 32 分 headings, and 212 speaker passages (RW_DIALOGUE: [t|n|b|s, text, block]). t = a title card for each 分 heading (title + the 『』 gloss); n = narration (如是我聞, 爾時…, the byline and close); b = 世尊; s = 須菩提 (not 善現). Speaker leads such as 佛告須菩提 / 須菩提白佛言 / 須菩提言 are kept at the start of the passage; substantial narration is kept. There is no name-seal. The two 偈 are 世尊 passages and stay whole. The closing 真言 is narration (not a verse spoken in the sutra frame).
- Intro title card: 金剛般若波羅蜜經 / 鳩摩羅什譯.
- Screenshots: `screenshots/kumarajiva-ink/`.

## v16 — calligraphy 對話 mode: no punctuation, ink per speaker, font decision
- **Display-only punctuation removal.** `dialogue.js` tokenizes each passage at render time: 「」『』《》（）etc. are dropped; 、，；： leave a small gap (.3em), 。！？ and spaces leave a larger gap (.7em); the last token of a verse line gets none. Gaps are `padding-inline-end` on the previous `.ch`, so they work in vertical-rl and horizontal. `fit()` uses a gap-weighted length (`data-w`) to balance columns. RW_TEXTS / reading mode are untouched.
- **Ink per speaker** (`--ink-c`, with matching glow/halo): 世尊 warm gold #ecd49a; 須菩提 / 善現 pale silver-blue #b6cfec; 分 titles and intro ivory #f0e7d5; narration neutral grey rgba(196,190,180,.7). There is no speaker name-seal (it broke the calm of the page); the sutra wording that names the speaker is kept instead. All pass WCAG AA on the darkest-to-lightest vignette wash (narration is the tightest, raised from .62 to .7 alpha).
- **Font decision.** No true 王羲之 行書 font is freely licensed for embedding, so none is shipped. Keep MasaFont 正風毛筆 (OFL 1.1; derived from 衡山毛筆フォント行書), the closest legal 行書. Candidates reviewed: 方正王羲之行書 (proprietary; free grant only for named organisations / personal non-commercial desktop use; embedding needs written license), Zhi Mang Xing (OFL, Simplified-only, 402/613 glyphs), Long Cang / Liu Jian Mao Cao / Ma Shan Zheng (OFL, Simplified, not Wang-style). NPM 集聖教序 rubbings are images, not a font. Comparison: screenshots/ink-v16/font-candidates.png.
