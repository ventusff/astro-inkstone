/**
 * Code-frame transformer — wraps every highlighted block in a frame with a
 * title bar (file name or language), a copy button and, for `collapse`
 * fences, a fold. Runs in Shiki's root hook: Astro highlights after the
 * site's rehype plugins, so the rehype stage never sees the code element.
 *
 * Fence meta: `title="train.py"` names the frame; `collapse` renders it
 * folded. Every visible and accessible string is a label (English defaults).
 *
 * Usage (in the site markdown preset's shikiConfig.transformers):
 *   transformers: [transformerCodeFrame({ copy: '复制' }), ...]
 */
import type { Element } from 'hast';
import { h } from 'hastscript';

import type { transformerMetaHighlight } from '@shikijs/transformers';

/** Under pnpm's strict layout 'shiki' is not a direct dependency; derive the
 *  type from a transformer's return value instead. */
type ShikiTransformer = ReturnType<typeof transformerMetaHighlight>;

export interface CodeFrameLabels {
  /** copy button, idle. Default 'copy' */
  copy?: string;
  /** copy button after a successful copy. Default '✓ copied' */
  copied?: string;
  /** copy button's accessible name. Default 'Copy code' */
  copyLabel?: string;
  /** fold hint while the frame is collapsed. Default 'Expand' */
  expandLabel?: string;
  /** fold hint while the frame is open. Default 'Collapse' */
  collapseLabel?: string;
}

export function transformerCodeFrame(opts: CodeFrameLabels = {}): ShikiTransformer {
  const copy = opts.copy ?? 'copy';
  const copied = opts.copied ?? '✓ copied';
  const copyLabel = opts.copyLabel ?? 'Copy code';
  const expandLabel = opts.expandLabel ?? 'Expand';
  const collapseLabel = opts.collapseLabel ?? 'Collapse';
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
          h('span', { className: ['code-copy-idle'] }, copy),
          h('span', { className: ['code-copy-done'] }, copied),
        ],
      );

      const frame: Element = collapse
        ? h('details', { className: ['code-frame', 'is-collapsible'] }, [
            h('summary', { className: ['code-frame-head'] }, [
              h('span', { className: ['code-lang'] }, title ?? lang),
              h('span', { className: ['code-fold-hint'] }, [
                h('span', { className: ['code-fold-closed'] }, expandLabel),
                h('span', { className: ['code-fold-open'] }, collapseLabel),
              ]),
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
