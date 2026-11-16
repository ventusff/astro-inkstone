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
    /** the button and key (P) that opens the presenter view in a second window */
    presenter: string;
    /** the presenter view's heading over what the next click shows */
    upNext: string;
    /** the presenter view's heading over the slide's speaker notes */
    notes: string;
    /** in place of the notes, on a slide that has none */
    noNotes: string;
    /** in place of the next click, after the last slide's last click */
    end: string;
    /** the button that starts the presenter view's clock from zero again */
    restartClock: string;
    /** the time the whole deck is planned to take, beside the present button: `{minutes}` is filled in */
    planned: string;
    /** the presenter view's time on the slide against its plan: `{elapsed}` and `{planned}` are filled in (m:ss) */
    slideTime: string;
    /** the presenter view's pace: the talk is `{t}` (m:ss) later than its plan up to this slide */
    behind: string;
    /** the presenter view's pace: the talk is `{t}` (m:ss) earlier than its plan up to this slide */
    ahead: string;
    /** the presenter view's pace: the talk keeps to its plan */
    onPlan: string;
    /** the button that prints the deck, one page per click, or saves it as a PDF */
    exportPdf: string;
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
    deck: { present: 'Present', exit: 'Exit', previous: 'Previous slide', next: 'Next slide', overview: 'Overview', deck: 'Slides', position: 'Slide {n} of {total}', slide: 'slide', presenter: 'Presenter view', upNext: 'Next', notes: 'Notes', noNotes: 'No notes on this slide.', end: 'The last slide ends here.', restartClock: 'Restart the clock', planned: 'About {minutes} min', slideTime: 'This slide {elapsed} of {planned}', behind: '{t} behind the plan', ahead: '{t} ahead of the plan', onPlan: 'On the plan', exportPdf: 'Print or PDF' },
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
    deck: { present: '放映', exit: '退出放映', previous: '上一张', next: '下一张', overview: '概览', deck: '演示稿', position: '第 {n} 张,共 {total} 张', slide: '幻灯片', presenter: '演讲者视图', upNext: '下一步', notes: '备注', noNotes: '这一张没有备注。', end: '这是最后一张的最后一步。', restartClock: '计时从零开始', planned: '约 {minutes} 分钟', slideTime: '这一张 {elapsed},计划 {planned}', behind: '比计划慢 {t}', ahead: '比计划快 {t}', onPlan: '与计划一致', exportPdf: '打印或导出 PDF' },
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
    deck: { present: 'Präsentieren', exit: 'Beenden', previous: 'Vorherige Folie', next: 'Nächste Folie', overview: 'Übersicht', deck: 'Folien', position: 'Folie {n} von {total}', slide: 'Folie', presenter: 'Referentenansicht', upNext: 'Als Nächstes', notes: 'Notizen', noNotes: 'Keine Notizen zu dieser Folie.', end: 'Hier endet die letzte Folie.', restartClock: 'Uhr neu starten', planned: 'Etwa {minutes} Min.', slideTime: 'Diese Folie {elapsed} von {planned}', behind: '{t} hinter dem Plan', ahead: '{t} vor dem Plan', onPlan: 'Im Plan', exportPdf: 'Drucken oder PDF' },
  },
} satisfies Record<string, ComponentWords>;

/** the component words for a BCP 47 locale (`zh`, `zh-CN`, `de-DE`, …); English when the language has none */
export function componentWords(locale: string | undefined): ComponentWords {
  const language = (locale ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  return language in WORDS ? WORDS[language as keyof typeof WORDS] : WORDS.en;
}
