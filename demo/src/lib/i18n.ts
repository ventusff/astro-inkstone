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
  },
} as const;
