import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { createMessages } from '../lib/messages.ts';
import { localeOfContentFile, pageLanguage, PAGE_TEXT_MODULE } from '../lib/page-language.ts';
import { pageText } from '../lib/page-text.ts';

const LOCALES = [
  { code: 'zh', prefix: '', htmlLang: 'zh-CN' },
  { code: 'en', prefix: 'en/', htmlLang: 'en' },
  { code: 'de', prefix: 'de/', htmlLang: 'de' },
] as const;

const messages = createMessages(
  {
    zh: { task: { count: '数货' }, page: { items: '{n} 道题' } },
    en: { task: { count: 'Count' }, page: { items: '{n, plural, one {# item} other {# items}}' } },
    de: { task: { count: 'Zählen' } },
  },
  { pending: { zh: '(正在翻译)', en: '(translation in progress)', de: '(wird übersetzt)' }, formatLocales: { zh: 'zh-CN' } },
);

test('a page text speaks its language: catalog entries, numbers and lists', () => {
  const zh = pageText(messages, 'zh', 'zh-CN');
  const en = pageText(messages, 'en');
  const de = pageText(messages, 'de');
  assert.equal(zh.t('task.count'), '数货');
  assert.equal(en.t('page.items', { n: 1 }), '1 item');
  assert.equal(de.t('page.items', { n: 2 }), '(wird übersetzt)');
  assert.equal(en.n(12345.5), '12,345.5');
  assert.equal(de.n(12345.5), '12.345,5');
  assert.equal(zh.list(['甲', '乙', '丙']), '甲、乙和丙');
  assert.equal(en.list(['a', 'b', 'c']), 'a, b, and c');
  assert.equal(de.list(['a', 'b', 'c']), 'a, b und c');
});

test('a content file\'s language is its locale prefix under the content directory', () => {
  const at = (p: string) => localeOfContentFile(p, { locales: LOCALES, defaultLocale: 'zh', content: '/site/src/content/docs' });
  assert.equal(at('/site/src/content/docs/bank/locate/index.mdx'), 'zh');
  assert.equal(at('/site/src/content/docs/en/bank/locate/index.mdx?astroPropagatedAssets'), 'en');
  assert.equal(at('/site/src/content/docs/de/cover/index.mdx'), 'de');
  assert.equal(at('/site/src/content/docs/english/index.mdx'), 'zh');
  assert.throws(() => at('/site/src/components/Bars.astro'), /virtual:page-text is for pages under/);
});

test('the plugin binds the module to the importing page\'s language, and the module speaks it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'page-language-'));
  try {
    mkdirSync(join(dir, 'lib'));
    writeFileSync(
      join(dir, 'lib/i18n.ts'),
      `import { createMessages } from ${JSON.stringify(new URL('../lib/messages.ts', import.meta.url).pathname)};\n` +
        `export const messages = createMessages({ zh: { a: '甲' }, en: { a: 'A' } }, { pending: { zh: '…', en: '…' } });\n`,
    );
    const plugin = pageLanguage({ locales: LOCALES, defaultLocale: 'zh', messages: pathToFileURL(join(dir, 'lib/i18n.ts')) });
    const hook = <T>(h: unknown): T => (typeof h === 'function' ? h : (h as { handler: unknown }).handler) as T;
    hook<(c: { root: string }) => void>(plugin.configResolved)({ root: dir });
    const resolveId = hook<(id: string, importer?: string) => string | null>(plugin.resolveId);
    const load = hook<(id: string) => string | null>(plugin.load);
    assert.equal(resolveId('other', join(dir, 'src/content/docs/x/index.mdx')), null);
    const id = resolveId(PAGE_TEXT_MODULE, join(dir, 'src/content/docs/en/x/index.mdx'))!;
    assert.match(id, /^\0virtual:page-text:en$/);
    const code = load(id)!;
    assert.match(code, /pageText\(messages, "en", "en"\)/);
    const module = join(dir, 'page-text-en.mjs');
    writeFileSync(module, code.replace(/from "([^"]+)"/g, (_, p: string) => `from ${JSON.stringify(pathToFileURL(p).href)}`));
    const { t, locale } = (await import(pathToFileURL(module).href)) as { t: (k: string) => string; locale: string };
    assert.equal(locale, 'en');
    assert.equal(t('a'), 'A');
    assert.throws(() => resolveId(PAGE_TEXT_MODULE), /has no importing page/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
