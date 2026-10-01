/**
 * page-labels.ts — the words rendered content carries, in the page's language.
 *
 * A few words belong to rendered content rather than to a site's chrome:
 *
 * - the "in plain words" and "vs prior" markers, which base.css draws from
 *   the custom properties `--speak-label` / `--diff-label` (English
 *   defaults);
 * - the code frame's copy button and fold hints, which `siteMarkdown`
 *   writes into a note when it is built, in the one language of its
 *   `codeFrame` labels.
 *
 * A page whose language differs from those words relabels them: emit
 * `pageLabelStyle(labels)` in a `<style>` element and, when code-frame
 * labels are given, `pageLabelScript(labels)` in a `<script>` element —
 * components/PageLabels.astro does both. A page that needs no other words
 * emits nothing and keeps the content exactly as built; any label left out
 * keeps its built or default text.
 */
import type { CodeFrameLabels } from './code-frame.ts';

export interface PageLabels {
  /** marker before a plain-words aside (`--speak-label`) */
  speak?: string;
  /** marker before a comparison with the prior version (`--diff-label`) */
  diff?: string;
  /** the code frame's words, in the vocabulary of `siteMarkdown({ codeFrame })` */
  codeFrame?: CodeFrameLabels;
}

/** a CSS string literal: quotes, backslashes and line breaks (LF, CR, CRLF, FF) escaped */
function cssString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r\n|[\n\r\f]/g, '\\a ')}"`;
}

/** `:root{…}` setting the given markers; safe to place in a `<style>` element */
export function pageLabelStyle(labels: PageLabels): string {
  const decls: string[] = [];
  if (labels.speak !== undefined) decls.push(`--speak-label:${cssString(labels.speak)}`);
  if (labels.diff !== undefined) decls.push(`--diff-label:${cssString(labels.diff)}`);
  return `:root{${decls.join(';')}}`.replace(/</g, '\\3c ');
}

/** each code-frame label and the element of the frame that shows it */
const FRAME_TEXT: [keyof CodeFrameLabels, string][] = [
  ['copy', '.code-copy > .code-copy-idle'],
  ['copied', '.code-copy > .code-copy-done'],
  ['expandLabel', '.code-fold-hint > .code-fold-closed'],
  ['collapseLabel', '.code-fold-hint > .code-fold-open'],
];

/**
 * A script relabeling every code frame on the page with the given labels:
 * the visible words, and the copy button's accessible name and tooltip
 * (`copyLabel`). It runs once the document is parsed; safe to place in a
 * `<script>` element anywhere in the page.
 */
export function pageLabelScript(labels: PageLabels): string {
  const frame = labels.codeFrame ?? {};
  const text = FRAME_TEXT.flatMap(([key, selector]) => (frame[key] === undefined ? [] : [[selector, frame[key]]]));
  const data = JSON.stringify({ text, name: frame.copyLabel ?? null }).replace(/</g, '\\u003c');
  return `(() => {
  const labels = ${data};
  const relabel = () => {
    for (const [selector, text] of labels.text)
      for (const el of document.querySelectorAll(selector)) el.textContent = text;
    if (labels.name !== null)
      for (const btn of document.querySelectorAll('.code-copy')) {
        btn.setAttribute('aria-label', labels.name);
        btn.setAttribute('title', labels.name);
      }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', relabel);
  else relabel();
})();`;
}
