/**
 * i18n.ts — locale model shared by routes, layout and sidebar.
 *
 * en is the primary locale: en note ids carry NO prefix and are served at
 * root paths; zh mirror ids carry `zh/` and are served under /zh/... . The
 * id↔route identity (route = `/${id}/`) is load-bearing: it is what makes
 * the single inkbrush-note-url template `${base}{id}/` work for the
 * language-switch jump in astro-inkbrush (whose locale registry likewise
 * treats the default locale as unprefixed). Mirrors are materialized only
 * where a zh file exists — there is no fallback route tree.
 */

export type Locale = 'en' | 'zh';

export const LOCALES: { code: Locale; prefix: string; label: string; htmlLang: string }[] = [
  { code: 'en', prefix: '', label: 'English', htmlLang: 'en' },
  { code: 'zh', prefix: 'zh/', label: '中文', htmlLang: 'zh-CN' },
];

export function localeOfId(id: string): Locale {
  return id === 'zh' || id.startsWith('zh/') ? 'zh' : 'en';
}

/** strip the locale prefix: 'zh/design/tokens' → 'design/tokens' */
export function baseIdOf(id: string): string {
  return localeOfId(id) === 'zh' ? id.slice(3) : id;
}

/** counterpart id in the other locale */
export function counterpartId(id: string): string {
  return localeOfId(id) === 'zh' ? baseIdOf(id) : `zh/${id}`;
}

/** site-root-relative route of a page id ('' = home) */
export function routeOfId(id: string): string {
  return id === '' ? '' : `${id}/`;
}

/** the other locale of the two */
export function otherLocale(locale: Locale): Locale {
  return locale === 'zh' ? 'en' : 'zh';
}

/** route prefix of a locale's page tree: '' for en, 'zh/' for zh */
export function localePrefix(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)!.prefix;
}

/** the locale's landing page route ('' or 'zh/') — where a language switch
 *  lands when the current page has no twin */
export function landingRoute(locale: Locale): string {
  return localePrefix(locale);
}

/** join a root-relative route with the deploy base */
export function href(route: string): string {
  const base = import.meta.env.BASE_URL;
  const b = base.endsWith('/') ? base : `${base}/`;
  return b + route.replace(/^\//, '');
}

/** the public repositories this demo documents — the one allowed outbound link */
export const GITHUB_URL = 'https://github.com/ventusff/astro-inkstone';
export const ENGINE_URL = 'https://github.com/ventusff/astro-inkbrush';

/** UI chrome strings; en is the default locale, zh the mirror */
export const UI = {
  en: {
    searchPlaceholder: 'Search the garden… (Esc to close)',
    searchHint: 'Titles, sections and body text — English and Chinese both.',
    searchEmpty: 'No note matches.',
    searchUnavailable: 'The search index could not be loaded.',
    searchUnit: 'pages',
    searchScopeAll: 'All',
    searchDialog: 'Site search',
    searchInput: 'Search the manual',
    searchResults: 'Search results',
    searchButton: 'Search (⌘K)',
    langSwitch: '中文',
    langButton: 'Read this page in Chinese',
    langHome: 'Switch to the Chinese site',
    /** the trail's root and the mark's tooltip: the garden's name */
    home: 'inkstone',
    breadcrumb: 'Breadcrumb',
    contents: 'Contents',
    languages: 'Languages',
    chapterNav: 'Chapter navigation',
    prev: '← prev',
    next: 'next →',
    hub: 'Hub',
    updated: 'updated',
    backlinks: 'Linked mentions',
    localGraph: 'Local graph',
    lightbox: 'Image viewer',
    close: 'Close',
    copied: 'Code copied to the clipboard',
    copyFailed: 'Copy failed — the clipboard is not available',
    theme: 'Toggle light / dark theme',
    readingTime: (min: number) => `${min} min read`,
    footer: 'astro-inkstone demo · the notes are the manual, the manual is the demo',
    menu: 'Menu',
    skip: 'Skip to content',
    /** browse pages: landing, facets, the all-notes index */
    browse: {
      kicker: 'Garden',
      kickerSub: 'the manual, grown as notes',
      title: 'Paper & ink',
      titleSub: 'a growing garden of working notes',
      lede: (notes: number, domains: number) =>
        `The astro-inkstone manual, grown as a garden — ${notes} notes across ${domains} domains, browsable by kind, domain and tag. Every rendering effect on these pages is the package at work.`,
      /** between the lede and the source line, and the sentence's full stop */
      sep: ' ',
      stop: '.',
      source: 'Source:',
      thisPackage: 'this package',
      theEngine: 'the CMS engine —',
      editsThesePages: 'edits these very pages',
      recent: 'Recently updated',
      recentSub: 'the last three to change',
      shelfCount: (n: number) => `${n} primary · all →`,
      allNotes: 'All notes →',
      byKind: 'By kind',
      byDomain: 'By domain',
      byStatus: 'By status',
      byTag: 'By tag',
      facetLede: (desc: string, n: number) => `${desc} — ${n} notes.`,
      domainLede: (desc: string, n: number) => `${desc} — ${n} notes, primary or secondary.`,
      tagLede: (n: number) => `${n} notes.`,
      tagDesc: (tag: string, n: number) => `Notes tagged ${tag} (${n})`,
      facetDesc: (desc: string, n: number) => `${desc} (${n} notes)`,
      all: 'All notes',
      allKicker: 'everything',
      allEntries: (n: number) => `${n} entries`,
      allDesc: (n: number) => `Every note in the garden (${n}), newest first, with instant filters.`,
      allLede: 'Newest first. The pills below filter in place; without JavaScript they lead to the facet pages.',
      dimKind: 'Kind',
      dimDomain: 'Domain',
      dimStatus: 'Status',
      dimTag: 'Tags',
      facetsAria: 'Browse index',
      facetAll: 'All →',
      clear: 'Clear filters',
      noMatch: 'No note matches every selected filter.',
      allTags: 'All tags',
      chapters: (n: number) => `${n} chapters`,
      recentlyUpdated: 'Recently updated',
    },
  },
  zh: {
    searchPlaceholder: '搜索这座园地…（Esc 关闭）',
    searchHint: '标题、小节与正文全文,中英文都能搜。',
    searchEmpty: '没有匹配的笔记。',
    searchUnavailable: '搜索索引加载失败。',
    searchUnit: '篇',
    searchScopeAll: '全部',
    searchDialog: '站内搜索',
    searchInput: '搜索这份手册',
    searchResults: '搜索结果',
    searchButton: '搜索（⌘K）',
    langSwitch: 'English',
    langButton: '阅读本页的英文版',
    langHome: '切换到英文站',
    home: 'inkstone',
    breadcrumb: '面包屑',
    contents: '目录',
    languages: '语言',
    chapterNav: '章节导航',
    prev: '← 上一章',
    next: '下一章 →',
    hub: '总览',
    updated: '更新',
    backlinks: '反向链接',
    localGraph: '邻域 · local graph',
    lightbox: '图片查看器',
    close: '关闭',
    copied: '代码已复制到剪贴板',
    copyFailed: '复制失败,剪贴板不可用',
    theme: '切换浅色 / 深色主题',
    readingTime: (min: number) => `阅读约 ${min} 分钟`,
    footer: 'astro-inkstone 示范站 · 笔记即手册,手册即示范',
    menu: '菜单',
    skip: '跳到正文',
    browse: {
      kicker: '园地',
      kickerSub: '手册长成了笔记',
      title: '纸与墨',
      titleSub: '一座还在生长的工作笔记园地',
      lede: (notes: number, domains: number) =>
        `astro-inkstone 的使用手册,以园地的形式生长——${notes} 篇笔记、${domains} 个方向,可按形式、方向和标签浏览。这些页面上的每一处渲染效果,都是这个包在工作。`,
      sep: '',
      stop: '。',
      source: '源码:',
      thisPackage: '本包',
      theEngine: 'CMS 引擎——',
      editsThesePages: '编辑的就是这些页面',
      recent: '最近更新',
      recentSub: '最近改动的三篇',
      shelfCount: (n: number) => `${n} 篇以此为主 · 全部 →`,
      allNotes: '全部笔记 →',
      byKind: '按形式',
      byDomain: '按方向',
      byStatus: '按成熟度',
      byTag: '按标签',
      facetLede: (desc: string, n: number) => `${desc}——共 ${n} 篇。`,
      domainLede: (desc: string, n: number) => `${desc}——共 ${n} 篇,主方向或次方向。`,
      tagLede: (n: number) => `共 ${n} 篇。`,
      tagDesc: (tag: string, n: number) => `带 ${tag} 标签的笔记(${n} 篇)`,
      facetDesc: (desc: string, n: number) => `${desc}(${n} 篇)`,
      all: '全部笔记',
      allKicker: '一篇不落',
      allEntries: (n: number) => `共 ${n} 篇`,
      allDesc: (n: number) => `园地里的全部笔记(${n} 篇),最新的在前,可即时筛选。`,
      allLede: '最新的在前。下面的筛选项就地过滤;没有 JavaScript 时它们会跳到对应的分类页。',
      dimKind: '形式',
      dimDomain: '方向',
      dimStatus: '状态',
      dimTag: '标签',
      facetsAria: '浏览索引',
      facetAll: '全部 →',
      clear: '清除筛选',
      noMatch: '没有笔记同时满足所选条件。',
      allTags: '全部标签',
      chapters: (n: number) => `${n} 章`,
      recentlyUpdated: '最近更新',
    },
  },
} as const;
