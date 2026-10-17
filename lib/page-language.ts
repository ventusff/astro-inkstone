/**
 * page-language.ts — the Vite plugin behind `virtual:page-text`
 * (lib/page-text.ts).
 *
 * Each page that imports `virtual:page-text` gets the module bound to its own
 * language: the language of the content directory the page sits in — under a
 * locale's prefix (`<content>/en/…` is English), else the default locale —
 * the same rule as the page's route. The page's script therefore names no
 * language and is identical in every language.
 *
 *   // astro.config.mjs
 *   import { pageLanguage } from 'astro-inkstone/lib/page-language';
 *   vite: { plugins: [pageLanguage({ locales: LOCALES, defaultLocale: DEFAULT_LOCALE, messages: new URL('./src/lib/i18n.ts', import.meta.url) })] }
 *
 * `messages` names the module that exports the site's catalogs as `messages`
 * (lib/messages.ts `createMessages`). TypeScript learns the module's shape
 * from a declaration in the site, bound to its own keys:
 *
 *   declare module 'virtual:page-text' {
 *     type PageText = import('astro-inkstone/lib/page-text').PageText<MessageKey, Locale>;
 *     export const locale: PageText['locale'];
 *     export const t: PageText['t'];
 *     export const n: PageText['n'];
 *     export const list: PageText['list'];
 *   }
 */
import { isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

export const PAGE_TEXT_MODULE = 'virtual:page-text';
const RESOLVED = `\0${PAGE_TEXT_MODULE}:`;
const PAGE_TEXT = fileURLToPath(new URL('./page-text.ts', import.meta.url));

export interface PageLanguageOptions {
  /** the locale registry: codes, route prefixes (exactly one is ''), and the `<html lang>` each is written with */
  locales: readonly { code: string; prefix: string; htmlLang?: string }[];
  /** the locale of the pages at the content root */
  defaultLocale: string;
  /** the module exporting the site's catalogs as `messages`: a path or a file URL */
  messages: string | URL;
  /** the pages' content directory: absolute, or relative to the Vite root (default src/content/docs) */
  content?: string | URL;
}

const pathOf = (p: string | URL): string => (p instanceof URL ? fileURLToPath(p) : p);

/** the language of a page file under `content` (an absolute directory), from where it sits */
export function localeOfContentFile(path: string, options: Pick<PageLanguageOptions, 'locales' | 'defaultLocale'> & { content: string }): string {
  const file = resolve(path.split('?')[0]!);
  const root = resolve(options.content) + sep;
  if (!file.startsWith(root)) throw new Error(`${PAGE_TEXT_MODULE} is for pages under ${options.content}; imported from ${path}`);
  const inside = file.slice(root.length).split(sep).join('/');
  return options.locales.find((l) => l.prefix !== '' && inside.startsWith(l.prefix))?.code ?? options.defaultLocale;
}

export function pageLanguage(options: PageLanguageOptions): Plugin {
  const messages = pathOf(options.messages);
  let content = pathOf(options.content ?? 'src/content/docs');
  return {
    name: 'page-language',
    configResolved(config) {
      if (!isAbsolute(content)) content = resolve(config.root, content);
    },
    resolveId(id, importer) {
      if (id !== PAGE_TEXT_MODULE) return null;
      if (importer === undefined) throw new Error(`${PAGE_TEXT_MODULE} has no importing page`);
      return `${RESOLVED}${localeOfContentFile(importer, { ...options, content })}`;
    },
    load(id) {
      if (!id.startsWith(RESOLVED)) return null;
      const locale = id.slice(RESOLVED.length);
      const tag = options.locales.find((l) => l.code === locale)?.htmlLang ?? locale;
      return [
        `import { pageText } from ${JSON.stringify(PAGE_TEXT)};`,
        `import { messages } from ${JSON.stringify(messages)};`,
        `export const { locale, t, n, list } = pageText(messages, ${JSON.stringify(locale)}, ${JSON.stringify(tag)});`,
        '',
      ].join('\n');
    },
  };
}
