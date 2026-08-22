import assert from 'node:assert/strict';
import { test } from 'node:test';
import { h } from 'hastscript';
import type { Element, Root } from 'hast';

import { transformerCodeFrame } from '../lib/code-frame.ts';

const run = (meta: string, lang = 'py'): Root => {
  const root: Root = { type: 'root', children: [h('pre', [h('code', 'x = 1')])] };
  const t = transformerCodeFrame({ copy: 'copy', copied: 'done' });
  const ctx = { options: { meta: { __raw: meta }, lang } };
  return (t.root as (this: typeof ctx, r: Root) => Root).call(ctx, root);
};

const classesOf = (el: Element): string[] => (el.properties?.['className'] as string[]) ?? [];
const find = (el: Element, cls: string): Element | undefined => {
  if (classesOf(el).includes(cls)) return el;
  for (const c of el.children) {
    if (c.type !== 'element') continue;
    const hit = find(c, cls);
    if (hit) return hit;
  }
  return undefined;
};

test('a plain fence becomes a figure frame with title bar and copy button', () => {
  const root = run('title="train.py"');
  const frame = root.children[0] as Element;
  assert.equal(frame.tagName, 'figure');
  assert.deepEqual(classesOf(frame), ['code-frame']);
  const langEl = find(frame, 'code-lang')!;
  assert.deepEqual(langEl.children, [{ type: 'text', value: 'train.py' }]);
  assert.ok(find(frame, 'code-copy'));
  assert.ok(find(frame, 'code-frame-head'));
});

test('an untitled fence shows its language; `collapse` renders a folded details', () => {
  const plain = run('').children[0] as Element;
  assert.deepEqual(find(plain, 'code-lang')!.children, [{ type: 'text', value: 'py' }]);

  const folded = run('collapse').children[0] as Element;
  assert.equal(folded.tagName, 'details');
  assert.deepEqual(classesOf(folded), ['code-frame', 'is-collapsible']);
  assert.equal((folded.children[0] as Element).tagName, 'summary');
  assert.ok(find(folded, 'code-fold-hint'));
  assert.ok(find(folded, 'code-frame-body'));
});
