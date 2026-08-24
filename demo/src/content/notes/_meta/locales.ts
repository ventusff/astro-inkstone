/**
 * Locale registry — the single source of truth for the languages this garden
 * grows in. Pure data, zero imports (only erasable TS syntax), so the content
 * config, the site binding, astro.config and plain Node scripts can all
 * import it directly.
 *
 * Adding a language = one row here + a `ui/<code>.ts` strings file (the
 * UIStrings type makes an incomplete file a type error) + a content directory
 * `notes/<prefix>…`. The routes, the language menu, the wikilink resolver and
 * the checks all read this table — no component changes.
 *
 * Exactly one locale has prefix '' — the default; its note ids are unprefixed
 * and served at root paths. Every other locale's ids and routes carry its
 * prefix. The id↔route identity (route = `/${id}/`) is load-bearing for the
 * CMS's single note-url template.
 *
 * Every locale here is written left-to-right. RTL languages (Arabic, Hebrew)
 * need a mirrored edition of the appearance layer first — do not add one as
 * a row alone.
 */

export interface LocaleDef {
  /** locale code; also the id/route prefix segment for non-default locales */
  code: string;
  /** note-id prefix: '' for the default locale, `${code}/` otherwise */
  prefix: string;
  /** the language's name in itself — the only honest label for a switcher */
  label: string;
  /** value for <html lang> and hreflang */
  htmlLang: string;
  /** the language's name in English — the menu's secondary line */
  englishName: string;
}

export const LOCALE_DEFS = [
  { code: 'en', prefix: '', label: 'English', htmlLang: 'en', englishName: 'English' },
  { code: 'zh', prefix: 'zh/', label: '简体中文', htmlLang: 'zh-CN', englishName: 'Chinese (Simplified)' },
  { code: 'ja', prefix: 'ja/', label: '日本語', htmlLang: 'ja', englishName: 'Japanese' },
  { code: 'ko', prefix: 'ko/', label: '한국어', htmlLang: 'ko', englishName: 'Korean' },
  { code: 'de', prefix: 'de/', label: 'Deutsch', htmlLang: 'de', englishName: 'German' },
  { code: 'fr', prefix: 'fr/', label: 'Français', htmlLang: 'fr', englishName: 'French' },
  { code: 'es', prefix: 'es/', label: 'Español', htmlLang: 'es', englishName: 'Spanish' },
  { code: 'pt', prefix: 'pt/', label: 'Português', htmlLang: 'pt-BR', englishName: 'Portuguese (Brazil)' },
  { code: 'it', prefix: 'it/', label: 'Italiano', htmlLang: 'it', englishName: 'Italian' },
  { code: 'nl', prefix: 'nl/', label: 'Nederlands', htmlLang: 'nl', englishName: 'Dutch' },
  { code: 'pl', prefix: 'pl/', label: 'Polski', htmlLang: 'pl', englishName: 'Polish' },
  { code: 'ru', prefix: 'ru/', label: 'Русский', htmlLang: 'ru', englishName: 'Russian' },
  { code: 'uk', prefix: 'uk/', label: 'Українська', htmlLang: 'uk', englishName: 'Ukrainian' },
  { code: 'tr', prefix: 'tr/', label: 'Türkçe', htmlLang: 'tr', englishName: 'Turkish' },
  { code: 'vi', prefix: 'vi/', label: 'Tiếng Việt', htmlLang: 'vi', englishName: 'Vietnamese' },
  { code: 'id', prefix: 'id/', label: 'Bahasa Indonesia', htmlLang: 'id', englishName: 'Indonesian' },
  { code: 'th', prefix: 'th/', label: 'ไทย', htmlLang: 'th', englishName: 'Thai' },
  { code: 'hi', prefix: 'hi/', label: 'हिन्दी', htmlLang: 'hi', englishName: 'Hindi' },
] as const satisfies readonly LocaleDef[];

export type Locale = (typeof LOCALE_DEFS)[number]['code'];

export const DEFAULT_LOCALE = 'en' satisfies Locale;

/** the codes whose ids carry a prefix — every locale but the default */
export type MirrorLocale = Exclude<Locale, typeof DEFAULT_LOCALE>;

export const LOCALE_CODES = LOCALE_DEFS.map((l) => l.code) as [Locale, ...Locale[]];
