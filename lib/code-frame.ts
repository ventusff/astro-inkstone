/**
 * Code-frame transformer: Astro runs shiki highlighting after user rehype
 * plugins, so the wrapping has to happen in a transformer's root hook (the
 * rehype stage never sees the astro-code element).
 * Fence meta contract: `title="train.py"` shows a filename in the title bar;
 * `collapse` renders the frame collapsed by default.
 *
 * Usage (in the site markdown preset's shikiConfig.transformers):
 *   transformers: [transformerCodeFrame({ copyLabel: 'Copy code' }), ...]
 */
import type { Element } from 'hast';
import { h } from 'hastscript';

import type { transformerMetaHighlight } from '@shikijs/transformers';

/** Under pnpm's strict layout 'shiki' is not a direct dependency; derive the
 *  type from a transformer's return value instead. */
type ShikiTransformer = ReturnType<typeof transformerMetaHighlight>;

export interface CodeFrameLabels {
  /** copy-button tooltip + accessible name. Default 'Copy code' */
  copyLabel?: string;
  /** collapsed-frame hint in the summary bar (the open-state marker is
   *  CSS-only). Default 'Expand' */
  expandLabel?: string;
}

export function transformerCodeFrame(opts: CodeFrameLabels = {}): ShikiTransformer {
  const copyLabel = opts.copyLabel ?? 'Copy code';
  const expandLabel = opts.expandLabel ?? 'Expand';
  return {
    name: 'code-frame',
    root(root) {
      const pre = root.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'pre',
      );
      if (!pre) return root;
      const raw = this.options.meta?.__raw ?? '';
      const title = /title="([^"]+)"/.exec(raw)?.[1];
      const collapse = /(^|\s)collapse(\s|$)/.test(raw);
      const lang = this.options.lang || 'text';

      const copyBtn = h(
        'button',
        {
          className: ['code-copy'],
          type: 'button',
          'aria-label': copyLabel,
          title: copyLabel,
        },
        [
          h('span', { className: ['code-copy-idle'] }, 'copy'),
          h('span', { className: ['code-copy-done'] }, '✓ copied'),
        ],
      );

      const frame: Element = collapse
        ? h('details', { className: ['code-frame', 'is-collapsible'] }, [
            h('summary', { className: ['code-frame-head'] }, [
              h('span', { className: ['code-lang'] }, title ?? lang),
              h('span', { className: ['code-fold-hint'] }, expandLabel),
            ]),
            h('div', { className: ['code-frame-body'] }, [
              h('div', { className: ['code-frame-head'] }, [
                h('span', { className: ['code-lang'] }, lang),
                copyBtn,
              ]),
              pre,
            ]),
          ])
        : h('figure', { className: ['code-frame'] }, [
            h('div', { className: ['code-frame-head'] }, [
              h('span', { className: ['code-lang'] }, title ?? lang),
              copyBtn,
            ]),
            pre,
          ]);

      root.children = [frame];
      return root;
    },
  };
}
