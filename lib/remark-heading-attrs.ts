/**
 * remark-heading-attrs — parse a trailing attribute block on markdown
 * headings. `{…}` is a JSX expression in MDX, so the block is written as
 * trailing INLINE CODE (backticks), which MDX treats as literal text:
 *
 *   ## What is an inkstone? `{#inkstone toc="Inkstone"}`
 *   ### 术语与记号 `{notoc}`
 *
 * Attributes:
 *   #id          — explicit anchor id (stable across rewording; CJK headings
 *                  otherwise slug to CJK anchors)
 *   toc="…"      — short ToC label (may contain inline math `$…$`)
 *   notoc        — exclude this heading from the ToC
 *
 * The block is removed only when it yields at least one attribute; any
 * other trailing inline code is ordinary heading content. Values are stored
 * as hProperties (`id`, `data-toc`, `data-notoc`); the numbering preset
 * consumes and strips them (heading-core.takeHeadingAttrs).
 */
import type { Heading, InlineCode, Root } from 'mdast';
import { visit } from 'unist-util-visit';

const ATTR_BLOCK_RE = /^\{([^{}]*)\}$/;
const ATTR_TOKEN_RE = /#([^\s"]+)|([a-zA-Z-]+)="((?:[^"\\]|\\.)*)"|([a-zA-Z-]+)/g;

interface HeadingData {
  hProperties?: Record<string, string | boolean>;
}

export function remarkHeadingAttrs() {
  return function transform(tree: Root): void {
    visit(tree, 'heading', (node: Heading) => {
      const last = node.children.at(-1);
      if (!last || last.type !== 'inlineCode') return;
      const code = last as InlineCode;
      const match = ATTR_BLOCK_RE.exec(code.value.trim());
      if (!match) return;

      const props: Record<string, string | boolean> = {};
      const body = match[1] ?? '';
      for (const token of body.matchAll(ATTR_TOKEN_RE)) {
        const [, id, key, value, flag] = token;
        if (id !== undefined) props['id'] = id;
        else if (key !== undefined && value !== undefined) {
          // only \" is an escape — bare backslashes are TeX and must survive
          props[`data-${key}`] = value.replace(/\\"/g, '"');
        } else if (flag !== undefined) props[`data-${flag}`] = true;
      }

      if (Object.keys(props).length === 0) return;

      node.children.pop();
      // drop trailing whitespace left on the preceding text node
      const prev = node.children.at(-1);
      if (prev && prev.type === 'text') {
        prev.value = prev.value.trimEnd();
        if (prev.value === '') node.children.pop();
      }

      const data = (node.data ??= {}) as HeadingData;
      data.hProperties = { ...data.hProperties, ...props };
    });
  };
}
