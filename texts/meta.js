// Built-in materials. Texts live in texts/<id>.js (bundled locally, never fetched from the web).
window.RW_META = [
  {
    id: 'diamond-zh', kind: 'text', lang: 'zh-Hant', group: 'diamond', dialogue: 211,
    title: '金剛般若波羅蜜經', short: '金剛經 · 中文',
    subtitle: '姚秦 鳩摩羅什 譯（大正藏 T0235）· 含「對話」模式：世尊與須菩提',
    source: '臺大佛學數位圖書館 NTU Digital Library of Buddhist Studies PDF of T0235（CBETA 電子佛典集成 2023.Q4）。昭明太子三十二分科為本應用於目錄的標題，不在該 PDF 中。',
    url: 'https://dlbs.liberal.ntu.edu.tw/FULLTEXT/sutra/chi_pdf/sutra3/T08n0235.pdf',
    license: 'Fifth-century translation in the public domain; this e-text follows the NTU-hosted CBETA 2023.Q4 ebook (non-commercial use, keep the CBETA header intact). The 對話 Dialogue split into speaker turns is this app’s own arrangement.'
  },
  {
    id: 'diamond-xz', kind: 'text', lang: 'zh-Hant', group: 'diamond', dialogue: 231,
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
    id: 'medicine-zh', kind: 'text', lang: 'zh-Hant', group: 'medicine', dialogue: 163,
    title: '藥師琉璃光如來本願功德經', short: '藥師經 · 中文',
    subtitle: '唐 玄奘 譯（大正藏 T0450）· 含「對話」模式：世尊、曼殊室利、阿難、救脫菩薩、十二藥叉大將',
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
    id: 'qixin-zh', kind: 'text', lang: 'zh-Hant', group: 'qixin', dialogue: 333,
    title: '大乘起信論', short: '大乘起信論 · 真諦譯',
    subtitle: '馬鳴菩薩造 · 梁 真諦 譯（大正藏 T1666）· 含「對話」模式：墨書一節一節現前',
    source: '以 Kanripo KR6o0078（CC BY-SA 4.0）與 CBETA 電子佛典 T32n1666 對讀；標點為西蓮淨苑新式標點（經 CBETA 收錄）',
    url: 'https://www.kanripo.org/text/KR6o0078/001',
    license: 'Sixth-century translation in the public domain (traditionally attributed to Aśvaghoṣa 馬鳴; translated by Paramārtha 真諦 in 553 CE). Kanripo e-text: CC BY-SA 4.0. CBETA punctuation and e-text: CC BY-NC-SA 4.0 (this app is non-commercial; share-alike applies to those text files).'
  },
  {
    id: 'tara-white-praise', kind: 'text', lang: 'zh-Hant', group: 'tara',
    bilingual: true, verticalDefault: false,
    title: '白救度佛母讚', short: '白救度佛母讚 · 漢藏',
    subtitle: '清 阿旺扎什 譯（大正藏 T1109）· 藏文傳統歸於二世達賴喇嘛根敦嘉措',
    source: '漢文以 Kanripo KR6j0319 為底（CC BY-SA 4.0），標點與「輪／輸」校訂參 CBETA T20n1109；藏文為與 T1109 對應的《སྒྲོལ་དཀར་བསྟོད་པ།》傳本',
    url: 'https://www.kanripo.org/text/KR6j0319/001',
    license: 'Literary works are in the public domain (Qing translation; 16th-century Tibetan praise). Kanripo e-text: CC BY-SA 4.0. CBETA punctuation and e-text: CC BY-NC-SA 4.0 (this app is non-commercial; share-alike applies to those text files). These are praises (讚) and a mantra, not the full White Tara daily sadhana.'
  },
  {
    id: 'tara-21-praises', kind: 'text', lang: 'zh-Hant', group: 'tara',
    bilingual: true, verticalDefault: false,
    title: '聖救度佛母二十一種禮讚經', short: '度母二十一禮讚 · 漢藏',
    subtitle: '元 安藏 譯（大正藏 T1108A）· 藏文德格版甘珠爾 D438 / Toh 438',
    source: '漢文據 CBETA 電子佛典 T20n1108A；藏文據 Esukhia Digital Derge Kangyur（UVA-SOAS 2013 eKangyur 的校訂轉寫，德格木刻版 vol. 81 / BDRC W4CZ5369）',
    url: 'https://github.com/cbeta-org/xml-p5/blob/master/T/T20/T20n1108A.xml',
    license: 'The Yuan translation and the Derge woodblock text are in the public domain. CBETA e-text: CC BY-NC-SA 4.0 (this app is non-commercial; share-alike applies to those text files). Esukhia / UVA-SOAS Digital Derge Kangyur is a mechanical reproduction of a public-domain work, and is itself in the public domain (credit Esukhia, UVA-SOAS eKangyur, BDRC W4CZ5369). These are praises (讚) and mantras, not a full sadhana.'
  },
  {
    id: 'peak', kind: 'pdf', lang: 'en', group: 'peak', userFile: true,
    title: 'Peak: Secrets from the New Science of Expertise', short: '刻意練習 · Peak (English)',
    subtitle: 'Anders Ericsson & Robert Pool (2016). Copyrighted — upload your own copy (PDF). It is stored only in this browser.',
    source: 'Your own copy', url: '', license: 'Copyrighted; not included.'
  }
];
