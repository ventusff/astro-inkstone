/**
 * Obsidian/GitHub-style callout blockquote syntax → the same markup the
 * <Callout> component renders (`<aside class="callout …">` with a
 * `.callout-title`), so plain Markdown — including `.md` notes imported from
 * an inbox — gets the same visual as MDX:
 *
 *   > [!tip] Intuition
 *   > body…
 *
 * Obsidian's fold marker is honoured: `> [!note]-` renders as a collapsed
 * `<details class="callout">` whose `<summary>` is the title, `> [!note]+`
 * as the same details open.
 *
 * Options: `{ labels }` overrides the default title shown when the callout
 * has no explicit title, keyed by variant keyword or by visual class (a
 * keyword entry wins over its class entry):
 *
 *   [remarkCallouts, { labels: { tip: '直觉 · Intuition', warn: '注意 · Warning' } }]
 */
import type { Blockquote, Paragraph, Root, Text } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Visual class (variant) → default title. The single source of the default
 * labels: the `<Callout>` component reads this same table, so the quote
 * syntax and the component always share one set of defaults.
 */
export const CALLOUT_LABELS = {
  note: 'Note',
  intuition: 'Intuition',
  warn: 'Warning',
  system: 'Important',
  abstract: 'Abstract',
} as const;

export type CalloutVariant = keyof typeof CALLOUT_LABELS;

/** variant keyword → visual class */
const VARIANT_CLASS: Record<string, CalloutVariant> = {
  note: 'note',
  info: 'note',
  tip: 'intuition',
  intuition: 'intuition',
  hint: 'intuition',
  warn: 'warn',
  warning: 'warn',
  caution: 'warn',
  danger: 'warn',
  important: 'system',
  system: 'system',
  abstract: 'abstract',
  summary: 'abstract',
  quote: 'abstract',
};

export interface CalloutOptions {
  /** default titles, keyed by variant keyword or visual class; a keyword
   *  entry wins over its class entry, both win over CALLOUT_LABELS */
  labels?: Partial<Record<string, string>>;
}

const MARK = /^\[!(\w+)\]([+-]?)[ \t]*([^\n]*)\n?/;

export function remarkCallouts(options: CalloutOptions = {}) {
  const overrides = options.labels ?? {};
  return (tree: Root): void => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0];
      if (!first || first.type !== 'paragraph') return;
      const firstText = first.children[0];
      if (!firstText || firstText.type !== 'text') return;
      const m = MARK.exec(firstText.value);
      if (!m) return;
      const kind = (m[1] ?? '').toLowerCase();
      const cls = VARIANT_CLASS[kind];
      if (!cls) return;
      const fold = m[2] === '-' ? 'closed' : m[2] === '+' ? 'open' : null;

      const title = (m[3] ?? '').trim() || overrides[kind] || overrides[cls] || CALLOUT_LABELS[cls];
      firstText.value = firstText.value.slice(m[0].length);
      if (firstText.value === '' && first.children.length === 1) {
        node.children.shift();
      } else if (firstText.value === '') {
        (first.children as Text[]).shift();
      }

      const titleNode: Paragraph = {
        type: 'paragraph',
        data: {
          hName: fold ? 'summary' : 'div',
          hProperties: { className: ['callout-title'] },
        },
        children: [{ type: 'text', value: title }],
      };
      node.children.unshift(titleNode);
      node.data = {
        ...node.data,
        hName: fold ? 'details' : 'aside',
        hProperties: {
          className: cls === 'note' ? ['callout'] : ['callout', cls],
          ...(fold === 'open' ? { open: true } : {}),
        },
      };
    });
  };
}
