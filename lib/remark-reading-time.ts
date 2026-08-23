/**
 * CJK-aware reading minutes: CJK counts at 400 characters/minute, Latin at
 * 200 words/minute. The result is written to
 * `remarkPluginFrontmatter.readingMinutes` for the page layout to read.
 */
import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';

// CJK = the Han, kana and hangul scripts, by Unicode script property — all
// planes, CJK Extension B+ included. Punctuation is Script=Common, so it is
// never a CJK character.
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
// punctuation and symbols are not prose: dropped before the word split, so
// CJK punctuation (、。「」…) counts as neither a CJK character nor a word
const PUNCT = /[\p{P}\p{S}]/gu;

export function remarkReadingTime() {
  return (tree: Root, file: VFile): void => {
    let text = '';
    visit(tree, ['text', 'inlineCode', 'code'], (node) => {
      text += ' ' + (('value' in node ? node.value : '') as string);
    });
    const cjkChars = (text.match(CJK) ?? []).length;
    const latinWords = text
      .replace(CJK, ' ')
      .replace(PUNCT, ' ')
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
