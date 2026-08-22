/**
 * i18n.ts — locale model shared by routes, layout and sidebar.
 *
 * en is the default locale: en page ids carry NO prefix and are served at
 * root paths; zh ids carry `zh/` and are served under /zh/... . The id↔route
 * identity (route = `/${id}/`) is load-bearing: it is what makes the single
 * inkbrush-note-url template `${base}{id}/` work for the language-switch
 * jump in astro-inkbrush (whose locale registry likewise treats the default
 * locale as unprefixed).
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

/** locale-aware root-relative route for a locale-free page id */
export function localeRoute(baseId: string, locale: Locale): string {
  return locale === 'zh' ? `zh/${routeOfId(baseId)}` : routeOfId(baseId);
}

/** the public repositories this demo documents — the one allowed outbound link */
export const GITHUB_URL = 'https://github.com/ventusff/astro-inkstone';
export const ENGINE_URL = 'https://github.com/ventusff/astro-inkbrush';

/** UI chrome strings; en is the default locale, zh the mirror */
export const UI = {
  en: {
    brandSub: 'paper & ink for Astro docs',
    tocLabel: 'On this page',
    searchPlaceholder: 'Search the manual… (Esc to close)',
    searchHint: 'Titles, sections and body text — English and Chinese both.',
    searchEmpty: 'No page matches.',
    fallbackNotice: 'This page has no English translation yet — showing the Chinese original.',
    langSwitch: '中文',
    home: 'Cover',
    footer: 'astro-inkstone demo · the manual is the demo (en canonical, zh mirror)',
    menu: 'Contents',
  },
  zh: {
    brandSub: 'paper & ink for Astro docs',
    tocLabel: '本页目录',
    searchPlaceholder: '搜索这份手册…（Esc 关闭）',
    searchHint: '标题、小节与正文全文,中英文都能搜。',
    searchEmpty: '没有匹配的页面。',
    fallbackNotice: '本页尚无中文译文,以下为英文原文。',
    langSwitch: 'English',
    home: '封面',
    footer: 'astro-inkstone 示范站 · 内容即手册（en 为准,zh 为镜像）',
    menu: '目录',
  },
} as const;
