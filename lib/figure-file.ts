/**
 * figure-file.ts — a figure kept in one JSON file, its words in every
 * language the site speaks.
 *
 * A figure file is drawn once and shown wherever it is needed: the page that
 * answers it, another page, another book, a slide. Each of them imports the
 * same file and hands it to `FigureFile` (a FlowDiagram) or to an interactive
 * figure's module (a DemoMount `module`), so changing the file changes every
 * place that shows it.
 *
 *   {
 *     "title":   { "zh": "一份定义,三个函数", "en": "One definition, three functions" },
 *     "caption": { "zh": "…" },
 *     "flow":    { "cols": 2, "nodes": [{ "id": "site", "title": { "zh": "站点定义" }, … }], … }
 *   }
 *
 * Every word a reader sees is an object of the languages, `{ "<locale>": … }`.
 * The figure's source language is the first key of its `title`; a word is an
 * object whose values are all strings and that holds the source language. A
 * word with no text in the reader's language shows in the source language,
 * so a figure written in one language reads in every language until the
 * translation service fills the others in. Everything else in the file (ids,
 * columns, tones, numbers) is passed through as written.
 */

/** one word of a figure: its text in each language that has one */
export type Words = Readonly<Record<string, string>>;

/** a figure file: its name, an optional caption, and what draws it */
export interface FigureFileData {
  /** what the figure is: a noun phrase or a question */
  title: Words | string;
  /** a sentence or two under the figure */
  caption?: Words | string | undefined;
  /** a FlowDiagram spec whose words are `Words` (FigureFile draws it) */
  flow?: unknown;
  /** anything else an interactive figure's module reads */
  [field: string]: unknown;
}

/** the language a figure is written in: the first key of its title, or none when its title is a plain string */
export function sourceLanguageOf(figure: Pick<FigureFileData, 'title'>): string | undefined {
  return typeof figure.title === 'string' ? undefined : Object.keys(figure.title)[0];
}

/** `value` is one word of a figure written in `source` */
export function isWords(value: unknown, source: string): value is Words {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    source in value &&
    Object.values(value).every((text) => typeof text === 'string')
  );
}

/**
 * A figure file, or any part of one, with every word in `locale`.
 *
 * @param value  the figure file or a part of it
 * @param locale the reader's language; a word without it reads in the source language
 * @param source the figure's source language (`sourceLanguageOf`); left out, read from `value.title`
 */
export function inLocale<T = unknown>(value: unknown, locale: string | undefined, source?: string): T {
  const from = source ?? sourceLanguageOf(value as FigureFileData);
  if (from === undefined) return value as T;
  const walk = (part: unknown): unknown => {
    if (isWords(part, from)) return (locale !== undefined ? part[locale] : undefined) ?? part[from];
    if (Array.isArray(part)) return part.map(walk);
    if (typeof part === 'object' && part !== null) return Object.fromEntries(Object.entries(part).map(([k, v]) => [k, walk(v)]));
    return part;
  };
  return walk(value) as T;
}
