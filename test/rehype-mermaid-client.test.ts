import assert from 'node:assert/strict';
import { test } from 'node:test';
import { h } from 'hastscript';
import type { Element, Root } from 'hast';

import { rehypeMermaidClient } from '../lib/rehype-mermaid-client.ts';

test('a mermaid fence becomes a client-render block keeping the source text', () => {
  const tree: Root = {
    type: 'root',
    children: [h('pre', [h('code', { className: ['language-mermaid'] }, 'graph TD; A-->B')])],
  };
  rehypeMermaidClient()(tree);
  const block = tree.children[0] as Element;
  assert.equal(block.tagName, 'div');
  assert.deepEqual(block.properties?.['className'], ['mermaid-block']);
  const pre = block.children[0] as Element;
  assert.equal(pre.tagName, 'pre');
  assert.deepEqual(pre.properties?.['className'], ['mermaid']);
  assert.deepEqual(pre.children, [{ type: 'text', value: 'graph TD; A-->B' }]);
});

test('other code blocks are left untouched', () => {
  const tree: Root = {
    type: 'root',
    children: [h('pre', [h('code', { className: ['language-js'] }, 'x')]), h('pre', 'bare')],
  };
  const before = JSON.stringify(tree);
  rehypeMermaidClient()(tree);
  assert.equal(JSON.stringify(tree), before);
});
