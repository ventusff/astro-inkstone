/**
 * mermaid fences → client-side lazy-render blocks.
 * The ```mermaid source is kept as `<pre class="mermaid">`; the site layout's
 * loader dynamically import('mermaid')s only when a page contains a .mermaid
 * node, so the chunk never ships on ordinary pages.
 */
import type { Element, ElementContent, Root } from 'hast';
import { h } from 'hastscript';
import { visit } from 'unist-util-visit';

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

export function rehypeMermaidClient() {
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || index === undefined) return;
      if (node.tagName !== 'pre') return;
      const code = node.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code',
      );
      if (!code) return;
      const cls = code.properties?.['className'];
      const isMermaid =
        Array.isArray(cls) && cls.some((c) => String(c) === 'language-mermaid');
      if (!isMermaid) return;
      const src = code.children.map(textOf).join('');
      parent.children[index] = h('div', { className: ['mermaid-block'] }, [
        h('pre', { className: ['mermaid'] }, src),
      ]);
    });
  };
}
