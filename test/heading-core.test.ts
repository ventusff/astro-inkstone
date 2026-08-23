import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assignHeadingId, letter, roman, slugify } from '../lib/heading-core.ts';

test('slugify keeps letters and digits of any script, folds separators', () => {
  assert.equal(slugify('What is an inkstone?'), 'what-is-an-inkstone');
  assert.equal(slugify('术语与记号 · Notation'), '术语与记号-notation');
  assert.equal(slugify('a/b  c'), 'a-b-c');
  assert.equal(slugify('!!!'), 'section');
});

test('canonical equivalence: NFC and NFD spellings yield the same slug', () => {
  const nfc = 'Résumé notes'.normalize('NFC');
  const nfd = 'Résumé notes'.normalize('NFD');
  assert.notEqual(nfc, nfd); // the fixture really is two spellings
  assert.equal(slugify(nfd), slugify(nfc));
  assert.equal(slugify(nfd), 'résumé-notes');
});

test('roman covers the whole range, letters continue past Z', () => {
  assert.equal(roman(1), 'I');
  assert.equal(roman(4), 'IV');
  assert.equal(roman(21), 'XXI');
  assert.equal(roman(1994), 'MCMXCIV');
  assert.equal(letter(1), 'A');
  assert.equal(letter(26), 'Z');
  assert.equal(letter(27), 'AA');
  assert.equal(letter(52), 'AZ');
});

test('assignHeadingId: generated ids are deduplicated, explicit duplicates are an error', () => {
  const used = new Set<string>();
  assert.equal(assignHeadingId({}, 'Setup', used, 'a.mdx'), 'setup');
  assert.equal(assignHeadingId({}, 'Setup', used, 'a.mdx'), 'setup-2');
  assert.equal(assignHeadingId({ id: 'custom' }, 'Anything', used, 'a.mdx'), 'custom');
  assert.throws(() => assignHeadingId({ id: 'custom' }, 'Again', used, 'a.mdx'), /duplicate heading id "#custom"/);
});
