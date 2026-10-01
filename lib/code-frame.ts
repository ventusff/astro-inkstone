/**
 * Code-frame transformer — wraps every highlighted block in a frame with a
 * title bar (file name or language), a copy button and, for `collapse`
 * fences, a fold. Runs in Shiki's root hook: Astro highlights after the
 * site's rehype plugins, so the rehype stage never sees the code element.
 *
 * Fence meta: `title="train.py"` names the frame; `collapse` renders it
 * folded.
 *
 * The frame carries no words of its own: the copy button and fold hints are
 * drawn by base.css from page-level custom properties (lib/page-labels.ts),
 * so one rendered note reads in the language of the page that shows it.
 */
import type { Element } from 'hast';
import { h } from 'hastscript';

import type { transformerMetaHighlight } from '@shikijs/transformers';

/** Under pnpm's strict layout 'shiki' is not a direct dependency; derive the
 *  type from a transformer's return value instead. */
type ShikiTransformer = ReturnType<typeof transformerMetaHighlight>;

export function transformerCodeFrame(): ShikiTransformer {
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

      // the pre is a horizontal scroll region: it must be keyboard-reachable
      // (and focus inside the block reveals focus-notation-dimmed lines)
      (pre.properties ??= {})['tabIndex'] = 0;

      const copyBtn = h('button', { className: ['code-copy'], type: 'button' }, [
        h('span', { className: ['code-copy-idle'] }),
        h('span', { className: ['code-copy-done'] }),
      ]);

      const frame: Element = collapse
        ? h('details', { className: ['code-frame', 'is-collapsible'] }, [
            h('summary', { className: ['code-frame-head'] }, [
              h('span', { className: ['code-lang'] }, title ?? lang),
              h('span', { className: ['code-fold-hint'] }, [
                h('span', { className: ['code-fold-closed'] }),
                h('span', { className: ['code-fold-open'] }),
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
