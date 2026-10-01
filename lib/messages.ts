/**
 * messages.ts — interface text kept as one catalog per language.
 *
 * Each language's catalog is a JSON object (nested freely) whose leaves are
 * ICU MessageFormat strings: `"pages": "{n, plural, one {# page} other {# pages}}"`.
 * A reader only ever reads their own language. A key may exist in some
 * catalogs and not yet in others — text is written in one language and the
 * others are filled in behind it — and where the reader's catalog lacks the
 * key, the lookup answers with that language's `pending` text ("translation
 * in progress"), never with another language. `missing()` lists a
 * language's absent keys; scripts/check-messages.mjs fails a build whose
 * catalogs disagree, so pending text is a transient state of a live site.
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
  /** the text for `key` in `locale`; the language's pending text while it lacks the key */
  t(locale: L, key: K, values?: MessageValues): string;
  /** the text, and whether it is the pending text */
  resolve(locale: L, key: K, values?: MessageValues): { text: string; pending: boolean };
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
 * Bind the catalogs of a site. `pending` gives each language its words for
 * text not yet written in it; `formatLocales` maps a language code to the
 * BCP 47 tag ICU formats it with (plural rules, numbers, dates) when the two
 * differ.
 */
export function createMessages<const C extends Record<string, Catalog>>(
  catalogs: C,
  options: {
    pending: Record<keyof C & string, string>;
    formatLocales?: Partial<Record<keyof C & string, string>>;
  },
): Messages<keyof C & string, { [L in keyof C]: KeyPath<C[L]> }[keyof C]> {
  type L = keyof C & string;
  type K = { [X in keyof C]: KeyPath<C[X]> }[keyof C];
  const { pending } = options;
  const formatLocales: Partial<Record<L, string>> = options.formatLocales ?? {};
  const locales = Object.keys(catalogs) as L[];
  const flat = new Map(locales.map((l) => [l, flatten(catalogs[l]!)] as const));
  const keys = [...new Set(locales.flatMap((l) => [...flat.get(l)!.keys()]))].sort() as K[];
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

  const known = new Set<string>(keys);
  const resolve = (locale: L, key: K, values?: MessageValues) => {
    if (!known.has(key)) throw new Error(`messages: no catalog has "${key}"`);
    const source = flat.get(locale)!.get(key);
    return source === undefined
      ? { text: pending[locale], pending: true }
      : { text: format(locale, key, source, values), pending: false };
  };

  return {
    resolve,
    t: (locale, key, values) => resolve(locale, key, values).text,
    missing: (locale) => keys.filter((k) => !flat.get(locale)!.has(k)),
    keys,
  };
}
