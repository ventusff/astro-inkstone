import assert from 'node:assert/strict';
import { test } from 'node:test';

import { remarkDeckNotes } from '../lib/remark-deck-notes.ts';

type Node = { type: string; value?: string; name?: string; data?: { hName?: string; hProperties?: Record<string, unknown> }; children?: Node[] };
const comment = (value: string): Node => ({ type: 'mdxFlowExpression', value });
const para: Node = { type: 'paragraph', children: [{ type: 'text', value: 'words' }] };
const hr: Node = { type: 'thematicBreak' };

test('a comment that ends a slide becomes its hidden notes; a comment elsewhere stays a comment', () => {
  const deck: Node = {
    type: 'mdxJsxFlowElement',
    name: 'Deck',
    children: [para, comment('/* Ask the room first.\n\n  Then show the number. */'), hr, comment('/* mid-slide */'), para, comment('/* the last slide */')],
  };
  const tree = { type: 'root', children: [deck] };
  remarkDeckNotes()(tree as never);
  const [, first, , mid, , last] = deck.children!;
  assert.equal(first!.data?.hName, 'aside');
  assert.deepEqual(first!.data?.hProperties, { className: ['deck-marker', 'deck-notes'], dataDeckMarker: 'notes', hidden: true });
  assert.deepEqual(
    first!.children!.map((p) => p.children![0]!.value),
    ['Ask the room first.', 'Then show the number.'],
  );
  assert.equal(mid!.type, 'mdxFlowExpression');
  assert.equal(last!.children![0]!.children![0]!.value, 'the last slide');
});
