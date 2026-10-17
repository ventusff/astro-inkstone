/**
 * page-text.ts — the words a page's own script writes, in the page's language.
 *
 * A page of a translated site imports them from `virtual:page-text`
 * (lib/page-language.ts binds that module to the language of the importing
 * page):
 *
 *   import { t, n, list } from 'virtual:page-text';
 *   export const rows = tasks.map((id) => ({ label: t(`task.${id}`), values: … }));
 *
 * so the script reads the same in every language and only the site's
 * catalogs (lib/messages.ts) hold words. A translation service that copies a
 * page's code unchanged into the other languages then carries no word of one
 * language into another.
 */
import type { MessageValues } from './messages.ts';

export interface PageText<K extends string = string, L extends string = string> {
  /** the page's language */
  locale: L;
  /** a catalog entry in the page's language */
  t: (key: K, values?: MessageValues) => string;
  /** a number written the way the page's language writes it */
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** a list joined the way the page's language joins one: 甲、乙和丙 · a, b, and c · a, b und c */
  list: (items: readonly string[]) => string;
}

/**
 * The page text of `locale` over the site's catalogs. `formatLocale` is the
 * BCP 47 tag numbers and lists are written with (the page's `<html lang>`),
 * when it differs from the language code.
 */
export function pageText<L extends string, K extends string>(
  messages: { t(locale: L, key: K, values?: MessageValues): string },
  locale: L,
  formatLocale: string = locale,
): PageText<K, L> {
  const and = new Intl.ListFormat(formatLocale, { type: 'conjunction' });
  return {
    locale,
    t: (key, values) => messages.t(locale, key, values),
    n: (value, options) => value.toLocaleString(formatLocale, options),
    list: (items) => and.format(items),
  };
}
