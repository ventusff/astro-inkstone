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
  },
} satisfies Record<string, ComponentWords>;

/** the component words for a BCP 47 locale (`zh`, `zh-CN`, `de-DE`, …); English when the language has none */
export function componentWords(locale: string | undefined): ComponentWords {
  const language = (locale ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  return language in WORDS ? WORDS[language as keyof typeof WORDS] : WORDS.en;
}
