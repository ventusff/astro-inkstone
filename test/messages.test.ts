import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMessages } from '../lib/messages.ts';

const m = createMessages(
  {
    zh: { nav: { search: '搜索' }, pages: '{n} 篇', only: { zh: '只有中文' } },
    en: { nav: { search: 'Search' }, pages: '{n, plural, one {# page} other {# pages}}', added: 'Added in English' },
    de: { nav: { search: 'Suche' }, only: { zh: '' } },
  },
  {
    pending: { zh: '(正在翻译)', en: '(translation in progress)', de: '(wird übersetzt)' },
    formatLocales: { zh: 'zh-CN' },
  },
);

test('a key answers in the requested language', () => {
  assert.equal(m.t('de', 'nav.search'), 'Suche');
  assert.deepEqual(m.resolve('en', 'nav.search'), { text: 'Search', pending: false });
});

test('ICU arguments and plural rules follow the language', () => {
  assert.equal(m.t('en', 'pages', { n: 1 }), '1 page');
  assert.equal(m.t('en', 'pages', { n: 3 }), '3 pages');
  assert.equal(m.t('zh', 'pages', { n: 3 }), '3 篇');
});

test('a key the language lacks answers with its pending text, never another language', () => {
  assert.deepEqual(m.resolve('de', 'pages', { n: 2 }), { text: '(wird übersetzt)', pending: true });
  assert.equal(m.t('de', 'added'), '(wird übersetzt)');
  assert.equal(m.t('en', 'only.zh'), '(translation in progress)');
  assert.equal(m.t('zh', 'added'), '(正在翻译)');
});

test('a blank message is written text that shows nothing', () => {
  assert.deepEqual(m.resolve('de', 'only.zh'), { text: '', pending: false });
});

test('missing() lists what a language has yet to be written in', () => {
  assert.deepEqual(m.missing('de'), ['added', 'pages']);
  assert.deepEqual(m.missing('en'), ['only.zh']);
  assert.deepEqual(m.missing('zh'), ['added']);
  assert.deepEqual(m.keys, ['added', 'nav.search', 'only.zh', 'pages']);
});

test('a key no catalog has is an error, never a silent blank', () => {
  // @ts-expect-error — not a key of any catalog
  assert.throws(() => m.t('zh', 'nope'), /no catalog has "nope"/);
});
