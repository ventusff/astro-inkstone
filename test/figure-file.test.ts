import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inLocale } from '../lib/figure-file.ts';

test('a figure file reads in the page language, a missing word in its source language, the rest as written', () => {
  const file = {
    title: { zh: '一份定义', en: 'One definition' },
    flow: {
      cols: 2,
      nodes: [{ id: 'site', title: { zh: '站点' }, lines: [{ zh: '外壳', de: 'Hülle' }], col: 1, row: 1 }],
      edges: [{ from: 'site', to: 'view' }],
    },
  };
  assert.deepEqual(inLocale(file, 'de'), {
    title: '一份定义',
    flow: { cols: 2, nodes: [{ id: 'site', title: '站点', lines: ['Hülle'], col: 1, row: 1 }], edges: [{ from: 'site', to: 'view' }] },
  });
  assert.equal(inLocale<{ title: string }>(file, 'en').title, 'One definition');
  assert.deepEqual(inLocale({ title: 'plain', n: 1 }, 'en'), { title: 'plain', n: 1 });
});
