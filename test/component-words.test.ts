import assert from 'node:assert/strict';
import { test } from 'node:test';

import { componentWords } from '../lib/component-words.ts';

test('the words follow the page language, region subtags included', () => {
  assert.equal(componentWords('zh').search.dialog, '站内搜索');
  assert.equal(componentWords('zh-CN').backlinks.heading, '反向链接');
  assert.equal(componentWords('de-DE').search.results, 'Suchergebnisse');
  assert.equal(componentWords('en-GB').localGraph, 'Local graph');
});

test('an unknown or missing language gets English', () => {
  assert.deepEqual(componentWords('fr'), componentWords('en'));
  assert.deepEqual(componentWords(undefined), componentWords('en'));
});

test('English terms the Chinese interface keeps stay English', () => {
  assert.equal(componentWords('zh').backlinks.sub, 'Linked mentions');
  assert.match(componentWords('zh').localGraph, /local graph/);
});

test('every language fills every word', () => {
  const shape = (w: unknown): string[] =>
    Object.entries(w as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? shape(v).map((s) => `${k}.${s}`) : [k],
    );
  const en = shape(componentWords('en'));
  for (const lang of ['zh', 'de']) {
    assert.deepEqual(shape(componentWords(lang)), en);
    for (const path of en.filter((p) => p !== 'backlinks.sub')) {
      const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], componentWords(lang));
      assert.ok(typeof value === 'string' && value.length > 0, `${lang} ${path}`);
    }
  }
});
