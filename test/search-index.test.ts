import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSearchIndexEndpoint, type SearchIndexSource } from '../lib/search-index.ts';
import type { SearchDoc } from '../lib/search-client.ts';

const body = [
  '---',
  'title: Frontmatter',
  '---',
  'Intro prose.',
  '',
  '## Real heading `{#real toc="R"}`',
  '',
  '```js',
  '## Fake heading in code',
  'const x = 1;',
  '```',
  '',
  '### Sub *heading*',
  'Body text after.',
  '',
].join('\n');

async function emit(sources: SearchIndexSource[], maxChars?: number): Promise<SearchDoc[]> {
  const endpoint = buildSearchIndexEndpoint({
    loadDocs: () => sources,
    ...(maxChars !== undefined ? { maxChars } : {}),
  }) as unknown as () => Promise<Response>;
  const res = await endpoint();
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  return JSON.parse(await res.text()) as SearchDoc[];
}

test('headings come from real heading lines only: fenced code and frontmatter are masked', async () => {
  const [doc] = await emit([{ id: 'a', route: '/a/', locale: 'any', title: 'A', crumb: 'Guide', body }]);
  assert.deepEqual(doc!.headings, ['Real heading', 'Sub heading']);
  assert.equal(doc!.route, '/a/');
  assert.equal(doc!.crumb, 'Guide');
});

test('body text keeps prose, drops fenced code, and truncates at maxChars', async () => {
  const [doc] = await emit([{ id: 'a', route: '/a/', locale: 'any', title: 'A', crumb: '', body }]);
  assert.match(doc!.text, /Intro prose/);
  assert.match(doc!.text, /Body text after/);
  assert.doesNotMatch(doc!.text, /Fake heading/);
  const [cut] = await emit([{ id: 'a', route: '/a/', locale: 'any', title: 'A', crumb: '', body }], 5);
  assert.equal(cut!.text.length, 5);
});

test('a non-positive maxChars is rejected at construction', () => {
  assert.throws(
    () => buildSearchIndexEndpoint({ loadDocs: () => [], maxChars: 0 }),
    /maxChars must be a positive integer/,
  );
});
