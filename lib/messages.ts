/**
 * messages.ts — interface text kept as one catalog per language.
 *
 * Each language's catalog is a JSON object (nested freely) whose leaves are
 * ICU MessageFormat strings: `"pages": "{n, plural, one {# page} other {# pages}}"`.
 * A key may exist in any subset of the catalogs — text is written in one
 * language and the others are filled in later — so a lookup falls back:
 * the requested language, then the default language, then the remaining
 * languages in the order given. `resolve()` reports which language actually
 * answered (for `lang` attributes on fallback text) and `missing()` lists a
 * language's absent keys (for showing that its text is still being written).
 *
 * The key type is the union of every catalog's key paths, so a key added to
 * a single catalog type-checks everywhere.
 */
import { IntlMessageFormat } from 'intl-messageformat';

/** a catalog: nested objects whose leaves are ICU MessageFormat strings */
export interface Catalog {
  [key: string]: string | Catalog;
}

/** every dotted key path that ends at a string leaf */
export type KeyPath<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${KeyPath<T[K]>}` }[keyof T & string];

/** ICU argument values */
export type MessageValues = Record<string, string | number | boolean | Date | null | undefined>;

export interface Messages<L extends string, K extends string> {
  /** the text for `key` in `locale`, or the first fallback language that has it */
  t(locale: L, key: K, values?: MessageValues): string;
  /** the text and the language it came from; `null` when no catalog has the key */
  resolve(locale: L, key: K, values?: MessageValues): { text: string; locale: L } | null;
  /** keys present in some catalog but absent from `locale`'s */
  missing(locale: L): K[];
  /** every key, sorted */
  readonly keys: readonly K[];
}

function flatten(catalog: Catalog, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [k, v] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(path, v);
    else flatten(v, path, out);
  }
  return out;
}

/**
 * Bind the catalogs of a site. `catalogs` lists the languages in fallback
 * order after the default; `formatLocales` maps a language code to the BCP 47
 * tag ICU formats it with (plural rules, numbers, dates) when the two differ.
 */
export function createMessages<const C extends Record<string, Catalog>>(
  catalogs: C,
  options: { defaultLocale: keyof C & string; formatLocales?: Partial<Record<keyof C & string, string>> },
): Messages<keyof C & string, { [L in keyof C]: KeyPath<C[L]> }[keyof C]> {
  type L = keyof C & string;
  type K = { [X in keyof C]: KeyPath<C[X]> }[keyof C];
  const { defaultLocale } = options;
  const formatLocales: Partial<Record<L, string>> = options.formatLocales ?? {};
  const locales = Object.keys(catalogs) as L[];
  if (!locales.includes(defaultLocale)) {
    throw new Error(`createMessages: defaultLocale "${defaultLocale}" has no catalog`);
  }
  const flat = new Map(locales.map((l) => [l, flatten(catalogs[l]!)] as const));
  const keys = [...new Set(locales.flatMap((l) => [...flat.get(l)!.keys()]))].sort() as K[];
  const order = (locale: L): L[] => [locale, defaultLocale, ...locales].filter((l, i, a) => a.indexOf(l) === i);
  const formats = new Map<string, IntlMessageFormat>();
  const format = (locale: L, key: string, source: string, values?: MessageValues): string => {
    const id = `${locale}\u0000${key}`;
    let f = formats.get(id);
    if (!f) {
      f = new IntlMessageFormat(source, formatLocales[locale] ?? locale);
      formats.set(id, f);
    }
    return String(f.format(values as Record<string, never> | undefined));
  };

  const resolve = (locale: L, key: K, values?: MessageValues) => {
    for (const l of order(locale)) {
      const source = flat.get(l)!.get(key);
      if (source !== undefined) return { text: format(l, key, source, values), locale: l };
    }
    return null;
  };

  return {
    resolve,
    t(locale, key, values) {
      const hit = resolve(locale, key, values);
      if (!hit) throw new Error(`messages: no catalog has "${key}"`);
      return hit.text;
    },
    missing: (locale) => keys.filter((k) => !flat.get(locale)!.has(k)),
    keys,
  };
}
