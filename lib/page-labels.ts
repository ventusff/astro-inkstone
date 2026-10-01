/**
 * page-labels.ts — the words base.css draws itself, in the page's language.
 *
 * A few labels belong to rendered content rather than to a site's chrome:
 * the code frame's copy button and fold hints, the "in plain words" and
 * "vs prior" markers. base.css takes them from custom properties so a note
 * rendered once reads in the language of whichever page shows it; a site
 * emits `pageLabelStyle(labels)` in a `<style>` element of its layout.
 * Omitted labels keep base.css's English defaults.
 */

export interface PageLabels {
  /** code frame copy button, idle */
  codeCopy?: string;
  /** its accessible name */
  codeCopyName?: string;
  /** after a successful copy */
  codeCopied?: string;
  /** fold hint while a collapsible frame is closed */
  codeExpand?: string;
  /** fold hint while it is open */
  codeCollapse?: string;
  /** marker before a plain-words aside */
  speak?: string;
  /** marker before a comparison with the prior version */
  diff?: string;
}

const PROPERTY: Record<keyof PageLabels, string> = {
  codeCopy: '--code-copy',
  codeCopyName: '--code-copy-name',
  codeCopied: '--code-copied',
  codeExpand: '--code-expand',
  codeCollapse: '--code-collapse',
  speak: '--speak-label',
  diff: '--diff-label',
};

/** a CSS string literal: quotes, backslashes and line breaks escaped */
function cssString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ')}"`;
}

/** `:root{…}` setting every given label; safe to place in a `<style>` element */
export function pageLabelStyle(labels: PageLabels): string {
  const decls = (Object.keys(PROPERTY) as (keyof PageLabels)[])
    .filter((k) => labels[k] !== undefined)
    .map((k) => `${PROPERTY[k]}:${cssString(labels[k]!)}`);
  return `:root{${decls.join(';')}}`.replace(/</g, '\\3c ');
}
