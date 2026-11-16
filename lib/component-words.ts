/**
 * component-words.ts — the words the engine's wiki components print when a
 * site passes no label of its own, in the page's language.
 *
 * Every label stays a prop: a site's own string always wins. Without one, a
 * component speaks the page's language — Chinese, English and German are
 * written here; any other language, and a page whose language is unknown,
 * gets English. Terms the Chinese interface writes in English (Linked
 * mentions, local graph) keep that English in every language.
 */

export interface ComponentWords {
  backlinks: { heading: string; sub: string };
  localGraph: string;
  search: {
    dialog: string;
    input: string;
    results: string;
    placeholder: string;
    hint: string;
    empty: string;
    unavailable: string;
    /** counter suffix: "12 pages" */
    unit: string;
  };
  facets: { kind: string; domain: string; status: string; tag: string; people: string; all: string; aria: string };
  deck: {
    /** the button that starts the full-screen show */
    present: string;
    /** the button that leaves it */
    exit: string;
    previous: string;
    next: string;
    /** the button and key (O) that shows every slide as a grid to jump from */
    overview: string;
    /** the label of the deck as a whole, for assistive technology */
    deck: string;
    /** a slide's position: "Slide 3 of 42"; `{n}` and `{total}` are filled in */
    position: string;
    /** what one slide is, for assistive technology (aria-roledescription) */
    slide: string;
  };
}

const WORDS = {
  en: {
    backlinks: { heading: 'Linked mentions', sub: '' },
    localGraph: 'Local graph',
    search: {
      dialog: 'Site search',
      input: 'Search',
      results: 'Search results',
      placeholder: 'Search…',
      hint: 'Type to search · ↑↓ to choose · Enter to open',
      empty: 'No results.',
      unavailable: 'Search index unavailable.',
      unit: 'pages',
    },
    facets: { kind: 'Kind', domain: 'Domain', status: 'Status', tag: 'Tags', people: 'Authors', all: 'All →', aria: 'Browse index' },
    deck: { present: 'Present', exit: 'Exit', previous: 'Previous slide', next: 'Next slide', overview: 'Overview', deck: 'Slides', position: 'Slide {n} of {total}', slide: 'slide' },
  },
  zh: {
    backlinks: { heading: '反向链接', sub: 'Linked mentions' },
    localGraph: '邻域 · local graph',
    search: {
      dialog: '站内搜索',
      input: '搜索',
      results: '搜索结果',
      placeholder: '搜索…',
      hint: '输入即搜 · ↑↓ 选择 · Enter 打开',
      empty: '没有结果。',
      unavailable: '搜索索引暂时不可用。',
      unit: '页',
    },
    facets: { kind: '形式', domain: '方向', status: '成熟度', tag: '标签', people: '作者', all: '全部 →', aria: '导览索引' },
    deck: { present: '放映', exit: '退出放映', previous: '上一张', next: '下一张', overview: '概览', deck: '演示稿', position: '第 {n} 张,共 {total} 张', slide: '幻灯片' },
  },
  de: {
    backlinks: { heading: 'Backlinks', sub: '' },
    localGraph: 'Local Graph',
    search: {
      dialog: 'Seitensuche',
      input: 'Suche',
      results: 'Suchergebnisse',
      placeholder: 'Suchen …',
      hint: 'Tippen zum Suchen · ↑↓ zum Auswählen · Enter öffnet',
      empty: 'Keine Treffer.',
      unavailable: 'Der Suchindex ist nicht verfügbar.',
      unit: 'Seiten',
    },
    facets: { kind: 'Form', domain: 'Richtung', status: 'Reifegrad', tag: 'Tags', people: 'Autoren', all: 'Alle →', aria: 'Index durchstöbern' },
    deck: { present: 'Präsentieren', exit: 'Beenden', previous: 'Vorherige Folie', next: 'Nächste Folie', overview: 'Übersicht', deck: 'Folien', position: 'Folie {n} von {total}', slide: 'Folie' },
  },
} satisfies Record<string, ComponentWords>;

/** the component words for a BCP 47 locale (`zh`, `zh-CN`, `de-DE`, …); English when the language has none */
export function componentWords(locale: string | undefined): ComponentWords {
  const language = (locale ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  return language in WORDS ? WORDS[language as keyof typeof WORDS] : WORDS.en;
}
