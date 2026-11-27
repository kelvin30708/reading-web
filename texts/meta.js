// Built-in materials. Texts live in texts/<id>.js (bundled locally, never fetched from the web).
window.RW_META = [
  {
    id: 'diamond-zh', kind: 'text', lang: 'zh-Hant', group: 'diamond',
    title: '金剛般若波羅蜜經', short: '金剛經 · 中文',
    subtitle: '姚秦 鳩摩羅什 譯（大正藏 T0235）',
    source: '臺大佛學數位圖書館 NTU Digital Library of Buddhist Studies PDF of T0235（CBETA 電子佛典集成 2023.Q4）。昭明太子三十二分科為本應用於目錄的標題，不在該 PDF 中。',
    url: 'https://dlbs.liberal.ntu.edu.tw/FULLTEXT/sutra/chi_pdf/sutra3/T08n0235.pdf',
    license: 'Fifth-century translation in the public domain; this e-text follows the NTU-hosted CBETA 2023.Q4 ebook (non-commercial use, keep the CBETA header intact).'
  },
  {
    id: 'diamond-xz', kind: 'text', lang: 'zh-Hant', group: 'diamond', dialogue: 170,
    title: '能斷金剛分', short: '金剛經 · 玄奘譯',
    subtitle: '唐 玄奘 譯 · 《大般若波羅蜜多經》卷第五百七十七 第九能斷金剛分（大正藏 T0220）· 含「對話」模式：世尊與善現（須菩提）',
    source: 'CBETA 電子佛典集成 T07n0220 卷577（cbeta-org/xml-p5）',
    url: 'https://github.com/cbeta-org/xml-p5/blob/master/T/T07/T07n0220.xml',
    license: 'Seventh-century translation in the public domain. E-text and punctuation from CBETA (Taishō Tripiṭaka electronic version; “available for non-commercial use when distributed with this header intact”; punctuation by 眾生出版社). The 對話 Dialogue split into speaker turns is this app’s own arrangement.'
  },
  {
    id: 'diamond-en', kind: 'text', lang: 'en', group: 'diamond',
    title: 'The Diamond Sutra', short: 'Diamond Sutra · English',
    subtitle: 'Vajracchedikā Prajñāpāramitā Sūtra, translated from Kumārajīva’s Chinese (T0235) by Lapis Lazuli Texts',
    source: 'Lapis Lazuli Texts',
    url: 'https://www.lapislazulitexts.com/tripitaka/T0235-LL-vajracchedika/',
    license: 'CC0 1.0 Universal (public domain dedication).'
  },
  {
    id: 'medicine-zh', kind: 'text', lang: 'zh-Hant', group: 'medicine',
    title: '藥師琉璃光如來本願功德經', short: '藥師經 · 中文',
    subtitle: '唐 玄奘 譯（大正藏 T0450）',
    source: 'Wikisource 維基文庫：藥師琉璃光如來本願功德經（誦本斷句空格已移除）',
    url: 'https://zh.wikisource.org/wiki/藥師琉璃光如來本願功德經',
    license: 'Public domain (7th-century translation).'
  },
  {
    id: 'medicine-en', kind: 'text', lang: 'en', group: 'medicine',
    title: 'Sutra of the Medicine Buddha', short: 'Medicine Buddha Sutra · English',
    subtitle: 'From Xuanzang’s Chinese (T0450). Translated by Minh Thành & P. D. Leigh under the guidance of Dharma Master Hsuan Jung (International Buddhist Monastic Institute, 2001)',
    source: 'Text from the free-distribution edition (BuddhaNet eLibrary PDF); also archived on Zenodo record 14569042 under CC BY 4.0',
    url: 'https://zenodo.org/records/14569042',
    license: 'CC BY 4.0 per the Zenodo record; the book itself says © 2001 Minh Thanh, “strictly for free distribution”, reprint permission granted on request. Free, non-commercial use with attribution. Footnote markers removed.'
  },
  {
    id: 'peak', kind: 'pdf', lang: 'en', group: 'peak', userFile: true,
    title: 'Peak: Secrets from the New Science of Expertise', short: '刻意練習 · Peak (English)',
    subtitle: 'Anders Ericsson & Robert Pool (2016). Copyrighted — upload your own copy (PDF). It is stored only in this browser.',
    source: 'Your own copy', url: '', license: 'Copyrighted; not included.'
  }
];
