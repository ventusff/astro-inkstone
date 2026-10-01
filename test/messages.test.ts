import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMessages } from '../lib/messages.ts';

const m = createMessages(
  {
    zh: { nav: { search: '搜索' }, pages: '{n} 篇', only: { zh: '只有中文' } },
    en: { nav: { search: 'Search' }, pages: '{n, plural, one {# page} other {# pages}}', added: 'Added in English' },
    de: { nav: { search: 'Suche' } },
  },
  { defaultLocale: 'zh', formatLocales: { zh: 'zh-CN' } },
);

test('a key present in the requested catalog answers in that language', () => {
  assert.equal(m.t('de', 'nav.search'), 'Suche');
  assert.deepEqual(m.resolve('en', 'nav.search'), { text: 'Search', locale: 'en' });
});

test('ICU arguments and plural rules follow the answering language', () => {
  assert.equal(m.t('en', 'pages', { n: 1 }), '1 page');
  assert.equal(m.t('en', 'pages', { n: 3 }), '3 pages');
  assert.equal(m.t('zh', 'pages', { n: 3 }), '3 篇');
});

test('an absent key falls back to the default language, then to the others in order', () => {
  assert.deepEqual(m.resolve('de', 'pages', { n: 2 }), { text: '2 篇', locale: 'zh' });
  assert.deepEqual(m.resolve('de', 'added'), { text: 'Added in English', locale: 'en' });
  assert.deepEqual(m.resolve('en', 'only.zh'), { text: '只有中文', locale: 'zh' });
});

test('missing() lists what a language has yet to be written in', () => {
  assert.deepEqual(m.missing('de'), ['added', 'only.zh', 'pages']);
  assert.deepEqual(m.missing('en'), ['only.zh']);
  assert.deepEqual(m.missing('zh'), ['added']);
  assert.deepEqual(m.keys, ['added', 'nav.search', 'only.zh', 'pages']);
});

test('a key no catalog has is an error, never a silent blank', () => {
  // @ts-expect-error — not a key of any catalog
  assert.throws(() => m.t('zh', 'nope'), /no catalog has "nope"/);
  // @ts-expect-error — not a key of any catalog
  assert.equal(m.resolve('zh', 'nope'), null);
});

test('a default language without a catalog fails at bind time', () => {
  // @ts-expect-error — 'fr' is not a catalog
  assert.throws(() => createMessages({ zh: {} }, { defaultLocale: 'fr' }), /defaultLocale "fr"/);
});
