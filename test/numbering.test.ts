import assert from 'node:assert/strict';
import { test } from 'node:test';
import { h } from 'hastscript';
import type { Root } from 'hast';

import { rehypeChapters } from '../lib/rehype-chapters.ts';
import { rehypeSections } from '../lib/rehype-sections.ts';
import { remarkHeadingAttrs } from '../lib/remark-heading-attrs.ts';

const part = (title: string, appendix = false) => ({
  type: 'mdxJsxFlowElement',
  name: 'Part',
  attributes: [
    ...(appendix ? [{ type: 'mdxJsxAttribute', name: 'appendix', value: null }] : []),
    ...(title ? [{ type: 'mdxJsxAttribute', name: 'title', value: title }] : []),
  ],
  children: [],
});
const file = () => ({ data: { astro: { frontmatter: {} } }, path: 'note.mdx' }) as never;
const tocOf = (f: { data: { astro: { frontmatter: Record<string, unknown> } } }) => f.data.astro.frontmatter['toc'] as never;
const text = (el: { children: { type: string; value?: string; children?: unknown[] }[] }): string =>
  el.children.map((c) => (c.type === 'text' ? c.value : text(c as never))).join('');

test('chapters: parts number h2s as §k.n, the appendix as letters, refs are substituted', () => {
  const tree = {
    type: 'root',
    children: [
      part('Foundations'),
      h('h2', 'Setup'),
      h('h3', 'Detail'),
      part('Practice'),
      h('h2', { dataNotoc: true }, 'Hidden'),
      h('h2', { dataToc: 'Short' }, 'A very long heading'),
      part('', true),
      h('h2', 'Glossary'),
      h('p', [h('a', { href: '#glossary' }, '§'), h('a', { href: '#setup' }, '§§')]),
    ],
  } as unknown as Root;
  const f = file();
  rehypeChapters()(tree, f);
  const toc = tocOf(f) as { items: { kind: string; num: string; label: string; id?: string }[]; numbers: Record<string, string> };
  assert.deepEqual(toc.items.map((i) => [i.kind, i.num, i.label]), [
    ['group', 'PART I', 'Foundations'],
    ['entry', '§1.1', 'Setup'],
    ['entry', '', 'Detail'],
    ['group', 'PART II', 'Practice'],
    ['entry', '§2.2', 'Short'],
    ['group', 'Appendix', ''],
    ['entry', '§A', 'Glossary'],
  ]);
  assert.equal(toc.numbers['hidden'], '§2.1');
  const p = tree.children.at(-1) as never as { children: { children: { value: string }[] }[] };
  assert.equal(p.children[0]!.children[0]!.value, '§A');
  assert.equal(p.children[1]!.children[0]!.value, '§1.1 Setup');
  assert.equal(text(tree.children[1] as never), '§1.1Setup');
});

test('chapters: a hub chapter numbers from frontmatter part, chapters:false switches numbering off', () => {
  const numbered = { type: 'root', children: [h('h2', 'One')] } as unknown as Root;
  const f1 = { data: { astro: { frontmatter: { part: 3 } } }, path: 'x.mdx' } as never;
  rehypeChapters()(numbered, f1);
  assert.equal(text(numbered.children[0] as never), '§3.1One');
  const plain = { type: 'root', children: [h('h2', 'One')] } as unknown as Root;
  const f2 = { data: { astro: { frontmatter: { chapters: false } } }, path: 'x.mdx' } as never;
  rehypeChapters()(plain, f2);
  assert.equal(text(plain.children[0] as never), 'One');
});

test('sections: nested headings are numbered, an orphan h3 keeps its id unnumbered, footnotes are skipped', () => {
  const tree = {
    type: 'root',
    children: [
      h('h3', 'Orphan'),
      h('h2', 'First'),
      h('div', [h('h3', { dataToc: 'Inner' }, 'Inner heading')]),
      h('section', { dataFootnotes: true }, [h('h2', { className: ['sr-only'] }, 'Footnotes')]),
    ],
  } as unknown as Root;
  const f = file();
  rehypeSections()(tree, f);
  const toc = tocOf(f) as { entries: { id: string; num: string; label: string; depth: number }[] };
  assert.deepEqual(toc.entries.map((e) => [e.depth, e.num, e.id, e.label]), [
    [3, '', 'orphan', 'Orphan'],
    [2, '1', 'first', 'First'],
    [3, '1.1', 'inner-heading', 'Inner'],
  ]);
});

test('heading attrs: a trailing `{…}` inline code is parsed and removed; other inline code stays', () => {
  const heading = (code: string) => ({ type: 'heading', depth: 2, children: [{ type: 'text', value: 'Title ' }, { type: 'inlineCode', value: code }] });
  const tree = { type: 'root', children: [heading('{#custom toc="Short" notoc}'), heading('{}'), heading('npm run build')] };
  remarkHeadingAttrs()(tree as never);
  const [a, b, c] = tree.children as unknown as { children: unknown[]; data?: { hProperties: Record<string, unknown> } }[];
  assert.deepEqual(a!.data?.hProperties, { id: 'custom', 'data-toc': 'Short', 'data-notoc': true });
  assert.equal(a!.children.length, 1);
  assert.equal(b!.children.length, 2);
  assert.equal(c!.children.length, 2);
});
