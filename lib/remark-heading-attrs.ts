/**
 * remark-heading-attrs — parse a trailing attribute block on markdown
 * headings. `{…}` is a JSX expression in MDX, so the block is written as
 * trailing INLINE CODE (backticks), which MDX treats as literal text:
 *
 *   ## What is an inkstone? `{#inkstone toc="Inkstone"}`
 *   ### 术语与记号 `{notoc}`
 *
 * The vocabulary — anything else in a block is a build error:
 *   #id          — explicit anchor id (stable across rewording; CJK headings
 *                  otherwise slug to CJK anchors); at most one per block
 *   toc="…"      — short ToC label (may contain inline math `$…$`); single
 *                  quotes work too, for labels that contain double quotes
 *   notoc        — exclude this heading from the ToC
 *
 * A trailing `{…}` inline-code block is always an attribute block: an
 * unknown word, a duplicate attribute or unparsed residue fails the build
 * with the file and the heading named, so a typo can never silently turn
 * into a stray data-* attribute or a truncated label. An empty `{}` and
 * inline code without the braces are ordinary heading content. Values are
 * stored as hProperties (`id`, `data-toc`, `data-notoc`); the numbering
 * preset consumes and strips them (heading-core.takeHeadingAttrs).
 */
import type { Heading, InlineCode, Root } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

const ATTR_BLOCK_RE = /^\{([^{}]*)\}$/;
const ID_RE = /^#([^\s"'#]+)/;
const TOC_RE = /^toc=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/;
const NOTOC_RE = /^notoc(?=\s|$)/;

interface HeadingData {
  hProperties?: Record<string, string | boolean>;
}

/** Visible heading text without the trailing attribute block, for errors. */
function headingLabel(node: Heading): string {
  const textOf = (n: { value?: unknown; children?: unknown[] }): string =>
    typeof n.value === 'string' ? n.value : ((n.children ?? []) as (typeof n)[]).map(textOf).join('');
  return node.children
    .slice(0, -1)
    .map((c) => textOf(c as never))
    .join('')
    .trim();
}

export function remarkHeadingAttrs() {
  return function transform(tree: Root, file?: VFile): void {
    const where = file?.path ?? '(unknown file)';
    visit(tree, 'heading', (node: Heading) => {
      const last = node.children.at(-1);
      if (!last || last.type !== 'inlineCode') return;
      const code = last as InlineCode;
      const match = ATTR_BLOCK_RE.exec(code.value.trim());
      if (!match) return;
      const body = (match[1] ?? '').trim();
      if (body === '') return; // `{}` is ordinary content

      const fail = (reason: string): never => {
        throw new Error(
          `${where}: heading "${headingLabel(node)}" has a bad attribute block \`{${match[1]}}\` — ${reason}`,
        );
      };

      const props: Record<string, string | boolean> = {};
      let rest = body;
      while (rest !== '') {
        let m: RegExpExecArray | null;
        if ((m = ID_RE.exec(rest))) {
          if ('id' in props) fail(`more than one #id (#${props['id']}, #${m[1]})`);
          props['id'] = m[1]!;
        } else if ((m = TOC_RE.exec(rest))) {
          if ('data-toc' in props) fail('more than one toc="…"');
          const quoted = m[1]!;
          const q = quoted[0]!;
          // only the wrapping quote has an escape — bare backslashes are TeX
          // and survive verbatim
          props['data-toc'] = quoted.slice(1, -1).replaceAll(`\\${q}`, q);
        } else if ((m = NOTOC_RE.exec(rest))) {
          if ('data-notoc' in props) fail('notoc given twice');
          props['data-notoc'] = true;
        } else {
          fail(`unrecognized attribute at "${rest}" (the vocabulary is #id, toc="…", notoc)`);
          return; // unreachable; narrows for the loop below
        }
        rest = rest.slice(m![0].length).trimStart();
      }

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
