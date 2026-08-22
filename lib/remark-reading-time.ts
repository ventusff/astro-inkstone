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
    // the astro frontmatter containers are created when absent, so the value
    // lands even when this plugin runs first
    const data = file.data as { astro?: { frontmatter?: Record<string, unknown> } };
    const astro = (data.astro ??= {});
    const fm = (astro.frontmatter ??= {});
    fm['readingMinutes'] = minutes;
  };
}
