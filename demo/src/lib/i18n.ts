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
    searchPlaceholder: 'Search the garden… (Esc to close)',
    searchHint: 'Titles, sections and body text — English and Chinese both.',
    searchEmpty: 'No note matches.',
    langSwitch: '中文',
    home: 'Garden',
    footer: 'astro-inkstone demo · the notes are the manual, the manual is the demo',
    menu: 'Menu',
  },
  zh: {
    brandSub: 'paper & ink for Astro docs',
    tocLabel: '本页目录',
    searchPlaceholder: '搜索这座园地…（Esc 关闭）',
    searchHint: '标题、小节与正文全文,中英文都能搜。',
    searchEmpty: '没有匹配的笔记。',
    langSwitch: 'English',
    home: '园地',
    footer: 'astro-inkstone 示范站 · 笔记即手册,手册即示范',
    menu: '菜单',
  },
} as const;
