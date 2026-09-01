import assert from 'node:assert/strict';
import { test } from 'node:test';
import { h } from 'hastscript';
import type { Root } from 'hast';

import { rehypeTaskLists } from '../lib/rehype-task-lists.ts';

const checkbox = (extra: Record<string, unknown> = {}) => h('input', { type: 'checkbox', disabled: true, ...extra });
const labelOf = (li: unknown): unknown =>
  ((li as { children: { properties?: Record<string, unknown> }[] }).children[0]!.properties ?? {})['ariaLabel'];

test('a task-list checkbox is named after its item text, markup flattened', () => {
  const done = h('li.task-list-item', checkbox({ checked: true }), ' tokens ', h('code', 'imported'), '  and styled');
  const open = h('li.task-list-item', checkbox(), ' brand palette overridden');
  const tree = { type: 'root', children: [h('ul.contains-task-list', done, open)] } as Root;
  rehypeTaskLists()(tree);
  assert.equal(labelOf(done), 'tokens imported and styled');
  assert.equal(labelOf(open), 'brand palette overridden');
});

test('an input that already has a name, a non-checkbox input and an empty item are left alone', () => {
  const named = h('li', checkbox({ ariaLabel: 'given' }), ' text');
  const other = h('li', h('input', { type: 'text' }), ' text');
  const empty = h('li', checkbox());
  const tree = { type: 'root', children: [h('ul', named, other, empty)] } as Root;
  rehypeTaskLists()(tree);
  assert.equal(labelOf(named), 'given');
  assert.equal(labelOf(other), undefined);
  assert.equal(labelOf(empty), undefined);
});
