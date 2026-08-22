import assert from 'node:assert/strict';
import { test } from 'node:test';

import { remarkCallouts } from '../lib/remark-callouts.ts';

const quote = (first: string, more = '') => ({
  type: 'root',
  children: [{ type: 'blockquote', children: [{ type: 'paragraph', children: [{ type: 'text', value: first + more }] }] }],
});
type Node = { type: string; data?: { hName?: string; hProperties?: Record<string, unknown> }; children: Node[]; value?: string };

test('the marker becomes an aside with a title line; the variant keyword maps to its class', () => {
  const tree = quote('[!tip] Why\n', 'body');
  remarkCallouts()(tree as never);
  const bq = tree.children[0] as unknown as Node;
  assert.equal(bq.data?.hName, 'aside');
  assert.deepEqual(bq.data?.hProperties?.['className'], ['callout', 'intuition']);
  assert.equal(bq.children[0]!.data?.hName, 'div');
  assert.equal(bq.children[0]!.children[0]!.value, 'Why');
  assert.equal(bq.children[1]!.children[0]!.value, 'body');
});

test('default and localized labels; unknown keywords are left alone', () => {
  const tree = quote('[!warn]\n', 'careful');
  remarkCallouts({ labels: { warn: '注意' } })(tree as never);
  assert.equal((tree.children[0] as unknown as Node).children[0]!.children[0]!.value, '注意');
  const other = quote('[!custom] x');
  remarkCallouts()(other as never);
  assert.equal((other.children[0] as unknown as Node).data, undefined);
});

test('the fold marker renders a details/summary, closed or open', () => {
  const closed = quote('[!note]- Folded\n', 'hidden');
  remarkCallouts()(closed as never);
  const c = closed.children[0] as unknown as Node;
  assert.equal(c.data?.hName, 'details');
  assert.equal(c.data?.hProperties?.['open'], undefined);
  assert.equal(c.children[0]!.data?.hName, 'summary');
  const open = quote('[!note]+ Open\n', 'shown');
  remarkCallouts()(open as never);
  assert.equal((open.children[0] as unknown as Node).data?.hProperties?.['open'], true);
});

test('one label table for both spellings: the shared defaults per visual class', async () => {
  const { CALLOUT_LABELS } = await import('../lib/remark-callouts.ts');
  assert.deepEqual(CALLOUT_LABELS, {
    note: 'Note',
    intuition: 'Intuition',
    warn: 'Warning',
    system: 'Important',
    abstract: 'Abstract',
  });
  const sys = quote('[!system]\n', 'body');
  remarkCallouts()(sys as never);
  assert.equal((sys.children[0] as unknown as Node).children[0]!.children[0]!.value, 'Important');
  const imp = quote('[!important]\n', 'body');
  remarkCallouts()(imp as never);
  assert.equal((imp.children[0] as unknown as Node).children[0]!.children[0]!.value, 'Important');
  const info = quote('[!info]\n', 'body');
  remarkCallouts()(info as never);
  assert.equal((info.children[0] as unknown as Node).children[0]!.children[0]!.value, 'Note');
});

test('label overrides: a keyword entry wins over its class entry, both over the defaults', () => {
  const byClass = quote('[!caution]\n', 'body');
  remarkCallouts({ labels: { warn: '注意' } })(byClass as never);
  assert.equal((byClass.children[0] as unknown as Node).children[0]!.children[0]!.value, '注意');
  const byKeyword = quote('[!caution]\n', 'body');
  remarkCallouts({ labels: { caution: '小心', warn: '注意' } })(byKeyword as never);
  assert.equal((byKeyword.children[0] as unknown as Node).children[0]!.children[0]!.value, '小心');
});

test('a non-folding callout aside is a named landmark: aria-label equals the resolved title', () => {
  const explicit = quote('[!tip] Why\n', 'body');
  remarkCallouts()(explicit as never);
  assert.equal((explicit.children[0] as unknown as Node).data?.hProperties?.['ariaLabel'], 'Why');
  const fallback = quote('[!warn]\n', 'body');
  remarkCallouts({ labels: { warn: '注意' } })(fallback as never);
  assert.equal((fallback.children[0] as unknown as Node).data?.hProperties?.['ariaLabel'], '注意');
  // a folding callout is a details named by its summary — no aria-label
  const folded = quote('[!note]- Folded\n', 'x');
  remarkCallouts()(folded as never);
  assert.equal((folded.children[0] as unknown as Node).data?.hProperties?.['ariaLabel'], undefined);
});
