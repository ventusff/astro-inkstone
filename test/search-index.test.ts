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

test('tilde and longer fences mask; closing needs at least as many of the same char', async () => {
  const tricky = [
    '~~~text',
    '## Tilde heading',
    'tildecode',
    '~~~',
    '',
    '````md',
    '```',
    '## Inner heading',
    '```',
    '````',
    '',
    '## Real one',
    'prose tail',
  ].join('\n');
  const [doc] = await emit([{ id: 't', route: '/t/', locale: 'any', title: 'T', crumb: '', body: tricky }]);
  assert.deepEqual(doc!.headings, ['Real one']);
  assert.doesNotMatch(doc!.text, /tildecode|Tilde heading|Inner heading/);
  assert.match(doc!.text, /prose tail/);
});

test('an unclosed fence masks to the end of the file', async () => {
  const body = 'Prose before.\n```js\nconst leaked = 1;\n## Fenced heading\n';
  const [doc] = await emit([{ id: 'u', route: '/u/', locale: 'any', title: 'U', crumb: '', body }]);
  assert.deepEqual(doc!.headings, []);
  assert.equal(doc!.text, 'Prose before.');
});

test('CRLF frontmatter is stripped and CRLF heading lines are found', async () => {
  const crlf = '---\r\ntitle: X\r\n---\r\nProse here.\r\n\r\n## Heading line\r\nMore.\r\n';
  const [doc] = await emit([{ id: 'c', route: '/c/', locale: 'any', title: 'C', crumb: '', body: crlf }]);
  assert.deepEqual(doc!.headings, ['Heading line']);
  assert.doesNotMatch(doc!.text, /title: X/);
  assert.match(doc!.text, /Prose here/);
});

test('multiline import/export statements are masked to their closing line', async () => {
  const body = [
    'import {',
    '  Alpha,',
    '  Beta,',
    "} from 'somewhere';",
    'export const meta = {',
    "  hidden: 'secretvalue',",
    '};',
    'Prose survives.',
    '',
    '## After imports',
  ].join('\n');
  const [doc] = await emit([{ id: 'i', route: '/i/', locale: 'any', title: 'I', crumb: '', body }]);
  assert.doesNotMatch(doc!.text, /somewhere|secretvalue|Alpha/);
  assert.match(doc!.text, /Prose survives/);
  assert.deepEqual(doc!.headings, ['After imports']);
});
