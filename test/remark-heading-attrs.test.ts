import assert from 'node:assert/strict';
import { test } from 'node:test';

import { remarkHeadingAttrs } from '../lib/remark-heading-attrs.ts';

const heading = (code: string, text = 'Title ') => ({
  type: 'heading',
  depth: 2,
  children: [
    { type: 'text', value: text },
    { type: 'inlineCode', value: code },
  ],
});
const tree = (...headings: unknown[]) => ({ type: 'root', children: headings });
const file = { path: 'note.mdx' } as never;
type Parsed = { children: unknown[]; data?: { hProperties: Record<string, unknown> } };

test('the whole vocabulary parses: #id, toc (double- or single-quoted), notoc', () => {
  const t = tree(
    heading('{#custom toc="Short" notoc}'),
    heading(`{toc='a "quoted" label'}`),
    heading('{toc="a \\"q\\" b"}'),
    heading('{toc="$\\frac ab$"}'),
  );
  remarkHeadingAttrs()(t as never, file);
  const [a, b, c, d] = t.children as Parsed[];
  assert.deepEqual(a!.data?.hProperties, { id: 'custom', 'data-toc': 'Short', 'data-notoc': true });
  assert.equal(a!.children.length, 1);
  assert.equal(b!.data?.hProperties['data-toc'], 'a "quoted" label');
  assert.equal(c!.data?.hProperties['data-toc'], 'a "q" b');
  // bare backslashes are TeX and survive verbatim
  assert.equal(d!.data?.hProperties['data-toc'], '$\\frac ab$');
});

test('an empty block and non-brace inline code are ordinary heading content', () => {
  const t = tree(heading('{}'), heading('npm run build'));
  remarkHeadingAttrs()(t as never, file);
  for (const node of t.children as Parsed[]) {
    assert.equal(node.data, undefined);
    assert.equal(node.children.length, 2);
  }
});

test('an unknown word, an unknown key and unparsed residue are errors naming file and heading', () => {
  assert.throws(
    () => remarkHeadingAttrs()(tree(heading('{notc}', 'My heading ')) as never, file),
    /note\.mdx: heading "My heading" has a bad attribute block `\{notc\}` — unrecognized attribute/,
  );
  assert.throws(
    () => remarkHeadingAttrs()(tree(heading('{toc="Good" =broken}')) as never, file),
    /unrecognized attribute at "=broken"/,
  );
  assert.throws(
    () => remarkHeadingAttrs()(tree(heading('{foo="x"}')) as never, file),
    /unrecognized attribute/,
  );
});

test('duplicate attributes are errors', () => {
  assert.throws(
    () => remarkHeadingAttrs()(tree(heading('{#a #b}')) as never, file),
    /more than one #id \(#a, #b\)/,
  );
  assert.throws(
    () => remarkHeadingAttrs()(tree(heading('{toc="a" toc="b"}')) as never, file),
    /more than one toc/,
  );
  assert.throws(
    () => remarkHeadingAttrs()(tree(heading('{notoc notoc}')) as never, file),
    /notoc given twice/,
  );
});
