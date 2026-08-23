import assert from 'node:assert/strict';
import { test } from 'node:test';

import { remarkReadingTime } from '../lib/remark-reading-time.ts';

const treeOf = (text: string) => ({
  type: 'root',
  children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }],
});
type FileData = { data: { astro?: { frontmatter?: Record<string, unknown> } } };

test('the astro frontmatter containers are created when absent', () => {
  const file: FileData = { data: {} };
  remarkReadingTime()(treeOf('short note') as never, file as never);
  assert.equal(file.data.astro?.frontmatter?.['readingMinutes'], 1);
});

test('an existing frontmatter object keeps its fields and gains the minutes', () => {
  const file: FileData = { data: { astro: { frontmatter: { title: 'T' } } } };
  remarkReadingTime()(treeOf('short note') as never, file as never);
  assert.deepEqual(file.data.astro?.frontmatter, { title: 'T', readingMinutes: 1 });
});

test('CJK Extension B counts as CJK; CJK punctuation counts as neither', () => {
  // 800 Han characters read as 2 minutes whichever plane they live on
  const extB: FileData = { data: {} };
  remarkReadingTime()(treeOf('\u{20000}'.repeat(800)) as never, extB as never);
  assert.equal(extB.data.astro?.frontmatter?.['readingMinutes'], 2);
  // punctuation on top of the same text changes nothing: it is neither a
  // CJK character nor a Latin word
  const punct: FileData = { data: {} };
  remarkReadingTime()(treeOf(('字。、「」'.repeat(200) + '字'.repeat(200))) as never, punct as never);
  assert.equal(punct.data.astro?.frontmatter?.['readingMinutes'], 1);
});

test('CJK counts at 400 chars/min, Latin at 200 words/min, floor 1 minute', () => {
  const cjk: FileData = { data: {} };
  remarkReadingTime()(treeOf('字'.repeat(800)) as never, cjk as never);
  assert.equal(cjk.data.astro?.frontmatter?.['readingMinutes'], 2);
  const latin: FileData = { data: {} };
  remarkReadingTime()(treeOf('word '.repeat(300).trim()) as never, latin as never);
  assert.equal(latin.data.astro?.frontmatter?.['readingMinutes'], 2);
  const tiny: FileData = { data: {} };
  remarkReadingTime()(treeOf('hi') as never, tiny as never);
  assert.equal(tiny.data.astro?.frontmatter?.['readingMinutes'], 1);
});
