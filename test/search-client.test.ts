import assert from 'node:assert/strict';
import { test } from 'node:test';

import { search, type SearchDoc } from '../lib/search-client.ts';

const doc = (id: string, title: string, text: string, headings: string[] = []): SearchDoc => ({
  id, route: `/${id}/`, locale: 'any', title, crumb: '', headings, text,
});

test('every word must occur, across any field', () => {
  const docs = [
    doc('a', 'Alpha notes', 'the beta section explains it'),
    doc('b', 'Alpha only', 'nothing else'),
    doc('c', 'Other', 'beta beta beta'),
  ];
  assert.deepEqual(search(docs, 'alpha beta', 'en').map((h) => h.doc.id), ['a']);
});

test('the whole phrase ranks above the separate words', () => {
  const docs = [
    doc('words', 'x', 'precision here, and mixed there, and precision again'),
    doc('phrase', 'x', 'a note on mixed precision training'),
  ];
  assert.deepEqual(search(docs, 'mixed precision', 'en').map((h) => h.doc.id), ['phrase', 'words']);
});

test('identifiers match as substrings, CJK needs no segmentation', () => {
  const docs = [doc('id', 'x', 'set mixed_precision_training=true'), doc('cjk', 'x', '张量并行与流水并行')];
  assert.equal(search(docs, 'precision_train', 'en')[0]?.doc.id, 'id');
  assert.equal(search(docs, '流水', 'en')[0]?.doc.id, 'cjk');
});

test('locale filtering and the snippet highlight', () => {
  const docs = [{ ...doc('zh', 'x', '只有中文'), locale: 'zh' as const }, doc('any', 'x', 'shared body text')];
  assert.deepEqual(search(docs, 'body', 'en').map((h) => h.doc.id), ['any']);
  assert.deepEqual(search(docs, '中文', 'en'), []);
  assert.match(search(docs, 'body', 'en')[0]!.snippet, /<mark>body<\/mark>/);
});

test('locale is an open code: any registry code filters, "any" always matches', () => {
  const docs = [
    { ...doc('fr', 'x', 'le corps du texte'), locale: 'fr' },
    { ...doc('shared', 'x', 'texte partagé'), locale: 'any' },
  ];
  assert.deepEqual(search(docs, 'texte', 'fr').map((h) => h.doc.id).sort(), ['fr', 'shared']);
  assert.deepEqual(search(docs, 'texte', 'de').map((h) => h.doc.id), ['shared']);
});
