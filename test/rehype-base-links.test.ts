import assert from 'node:assert/strict';
import { test } from 'node:test';
import { h } from 'hastscript';
import type { Root } from 'hast';

import { rehypeBaseLinks } from '../lib/rehype-base-links.ts';

const hrefs = (tree: Root): string[] => {
  const out: string[] = [];
  const walk = (n: { type: string; tagName?: string; properties?: Record<string, unknown>; children?: unknown[] }): void => {
    if (n.type === 'element' && typeof n.properties?.['href'] === 'string') out.push(n.properties['href'] as string);
    for (const c of (n.children ?? []) as typeof n[]) walk(c);
  };
  walk(tree as never);
  return out;
};

test('root-absolute links get the base; the base itself and its subtree are left alone', () => {
  const tree = { type: 'root', children: [
    h('a', { href: '/guide/' }), h('a', { href: '/docs' }), h('a', { href: '/docs/x/' }),
    h('a', { href: '/docs-old/' }), h('a', { href: '//cdn.example.com/x' }), h('a', { href: 'https://x' }),
  ] } as Root;
  rehypeBaseLinks({ base: '/docs' })(tree);
  assert.deepEqual(hrefs(tree), ['/docs/guide/', '/docs', '/docs/x/', '/docs/docs-old/', '//cdn.example.com/x', 'https://x']);
});

test('exempt prefixes match whole segments', () => {
  const tree = { type: 'root', children: [h('a', { href: '/api/x' }), h('a', { href: '/apiary/' })] } as Root;
  rehypeBaseLinks({ base: '/docs', exempt: ['/api'] })(tree);
  assert.deepEqual(hrefs(tree), ['/api/x', '/docs/apiary/']);
});

test('MDX JSX attributes on native tags are rewritten, component props are not', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'mdxJsxFlowElement', name: 'a', attributes: [{ type: 'mdxJsxAttribute', name: 'href', value: '/x/' }], children: [] },
      { type: 'mdxJsxFlowElement', name: 'Card', attributes: [{ type: 'mdxJsxAttribute', name: 'href', value: '/x/' }], children: [] },
    ],
  } as unknown as Root;
  rehypeBaseLinks({ base: '/docs' })(tree);
  const [a, card] = tree.children as unknown as { attributes: { value: string }[] }[];
  assert.equal(a!.attributes[0]!.value, '/docs/x/');
  assert.equal(card!.attributes[0]!.value, '/x/');
});
