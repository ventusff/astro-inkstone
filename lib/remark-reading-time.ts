/**
 * CJK-aware reading minutes: CJK counts at 400 characters/minute, Latin at
 * 200 words/minute. The result is written to
 * `remarkPluginFrontmatter.readingMinutes` for the page layout to read.
 */
import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

const CJK = /[⺀-鿿豈-﫿぀-ヿ가-힯]/g;

export function remarkReadingTime() {
  return (tree: Root, file: VFile): void => {
    let text = '';
    visit(tree, ['text', 'inlineCode', 'code'], (node) => {
      text += ' ' + (('value' in node ? node.value : '') as string);
    });
    const cjkChars = (text.match(CJK) ?? []).length;
    const latinWords = text
      .replace(CJK, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const minutes = Math.max(1, Math.round(cjkChars / 400 + latinWords / 200));
    const fm = (file.data as { astro?: { frontmatter?: Record<string, unknown> } }).astro
      ?.frontmatter;
    if (fm) fm['readingMinutes'] = minutes;
  };
}
