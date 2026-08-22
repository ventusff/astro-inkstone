import assert from 'node:assert/strict';
import { test } from 'node:test';

import { localTocRows, renderTocLabel } from '../lib/toc.ts';
import type { TocData as ChaptersToc } from '../lib/toc-types.ts';
import type { TocData as SectionsToc } from '../lib/rehype-sections.ts';

test('chapters shape: every depth-two entry becomes a row, unnumbered ones included', () => {
  const toc: ChaptersToc = {
    items: [
      { kind: 'entry', depth: 2, id: 'intro', num: '', label: 'Overview' },
      { kind: 'group', num: 'PART I', label: 'Foundations' },
      { kind: 'entry', depth: 2, id: 'setup', num: '§1.1', label: 'Setup' },
      { kind: 'entry', depth: 3, id: 'detail', num: '', label: 'Detail' },
    ],
    numbers: { setup: '§1.1' },
  };
  assert.deepEqual(localTocRows(toc), [
    { id: 'intro', num: '', label: 'Overview' },
    { id: 'setup', num: '§1.1', label: 'Setup' },
  ]);
});

test('sections shape: depth-two entries pass through, depth-three do not', () => {
  const toc: SectionsToc = {
    entries: [
      { depth: 2, id: 'first', num: '1', label: 'First' },
      { depth: 3, id: 'inner', num: '1.1', label: 'Inner' },
    ],
  };
  assert.deepEqual(localTocRows(toc), [{ id: 'first', num: '1', label: 'First' }]);
});

test('renderTocLabel escapes text and renders inline TeX', () => {
  const html = renderTocLabel('a <b> and $x^2$');
  assert.match(html, /a &lt;b&gt; and /);
  assert.match(html, /katex/);
});
