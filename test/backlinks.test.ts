import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type BacklinkDoc, createBacklinks } from '../lib/backlinks.ts';

const backlinks = createBacklinks({ urlFor: (id) => `/n/${id}/` });

const corpus = (): BacklinkDoc[] => [
  { id: 'alpha', title: 'Alpha Note', aliases: [], body: 'Alpha mentions [[beta|the beta note]] here, and [[nope]] is broken.' },
  { id: 'beta', title: 'Beta Note', aliases: ['B'], body: 'Beta stands alone.' },
  { id: 'gamma', title: 'Gamma Note', aliases: [], body: 'Gamma cites [[alpha]] and [[beta]].' },
];

test('build inverts mentions into inbound/outbound and collects broken links', () => {
  const index = backlinks.build(corpus());
  const intoBeta = index.inbound.get('beta') ?? [];
  assert.deepEqual(intoBeta.map((i) => [i.sourceId, i.href, i.title, i.label]), [
    ['alpha', '/n/alpha/', 'Alpha Note', 'the beta note'],
    ['gamma', '/n/gamma/', 'Gamma Note', 'beta'],
  ]);
  // the snippet keeps context on both sides of the mention
  assert.match(intoBeta[0]!.before, /Alpha mentions\s*$/);
  assert.match(intoBeta[0]!.after, /^\s*here/);
  assert.deepEqual(index.outbound.get('alpha'), [
    { target: 'beta', resolved: 'beta' },
    { target: 'nope', resolved: null },
  ]);
  assert.deepEqual(index.broken, [{ sourceId: 'alpha', target: 'nope' }]);
});

test('localGraph lists inbound sources first, then resolved outbound targets, capped', () => {
  const index = backlinks.build(corpus());
  const titleOf = (id: string) => id.toUpperCase();
  assert.deepEqual(index.localGraph('alpha', titleOf), [
    { id: 'gamma', title: 'Gamma Note', href: '/n/gamma/', dir: 'in' },
    { id: 'beta', title: 'BETA', href: '/n/beta/', dir: 'out' },
  ]);
  assert.deepEqual(index.localGraph('alpha', titleOf, 1).length, 1);
});

test('the index is memoized per docs array: same array, same index; new corpus, new index', () => {
  const docs = corpus();
  const first = backlinks.build(docs);
  assert.equal(backlinks.build(docs), first);

  const other: BacklinkDoc[] = [
    { id: 'solo', title: 'Solo', aliases: [], body: 'links [[alpha]] into the void.' },
    { id: 'alpha', title: 'Alpha Note', aliases: [], body: 'no links here.' },
  ];
  const second = backlinks.build(other);
  assert.notEqual(second, first);
  assert.deepEqual((second.inbound.get('alpha') ?? []).map((i) => i.sourceId), ['solo']);
  // the first corpus' index is untouched
  assert.deepEqual((first.inbound.get('alpha') ?? []).map((i) => i.sourceId), ['gamma']);
});

test('a fresh array of an edited corpus indexes the corpus as it is now', () => {
  const live = createBacklinks({ urlFor: (id) => `/n/${id}/` });
  const fresh = (docs: BacklinkDoc[]) => createBacklinks({ urlFor: (id) => `/n/${id}/` }).build(docs);
  const shape = (i: ReturnType<typeof live.build>) => ({ inbound: [...i.inbound], outbound: [...i.outbound], broken: i.broken });

  // the same bodies in a new array: the same index as a cold instance builds
  live.build(corpus());
  assert.deepEqual(shape(live.build(corpus())), shape(fresh(corpus())));

  // a body edited, a doc gone, an alias added elsewhere: every change shows
  const edited: BacklinkDoc[] = [
    { id: 'alpha', title: 'Alpha Note', aliases: [], body: 'Alpha now cites [[B]] by its alias.' },
    { id: 'beta', title: 'Beta Note', aliases: ['B', 'Bee'], body: 'Beta stands alone.' },
    { id: 'delta', title: 'Delta', aliases: [], body: 'Delta points at [[Bee]].' },
  ];
  const index = live.build(edited);
  assert.deepEqual(shape(index), shape(fresh(edited)));
  assert.deepEqual((index.inbound.get('beta') ?? []).map((i) => i.sourceId), ['alpha', 'delta']);
  assert.equal(index.inbound.get('alpha'), undefined);
  assert.deepEqual(index.broken, []);
});

test('one body text read under both grammars keeps one parse per grammar', () => {
  const body = 'export const meta = "[[t]]";\n\nProse cites [[t]].';
  const docs = (mdx: boolean): BacklinkDoc[] => [
    { id: 't', title: 'Target', aliases: [], body: 'plain target note.' },
    { id: 's', title: 'Source', aliases: [], body, mdx },
  ];
  const live = createBacklinks({ urlFor: (id) => `/n/${id}/` });
  assert.equal(live.build(docs(false)).outbound.get('s')?.length, 2);
  assert.equal(live.build(docs(true)).outbound.get('s')?.length, 1);
  assert.equal(live.build(docs(false)).outbound.get('s')?.length, 2);
});

test('an .mdx doc (mdx: true) grows edges from prose only — ESM and JSX carry none', () => {
  const docs: BacklinkDoc[] = [
    { id: 't', title: 'Target', aliases: [], body: 'plain target note.' },
    {
      id: 'mdx-doc',
      title: 'MDX Doc',
      aliases: [],
      mdx: true,
      body: [
        "export const x = '[[t]]';",
        '',
        "<X v={'[[t]]'} />",
        '',
        'Prose mentions [[t]] once.',
      ].join('\n'),
    },
  ];
  const index = backlinks.build(docs);
  const intoT = index.inbound.get('t') ?? [];
  assert.deepEqual(intoT.map((i) => [i.sourceId, i.label]), [['mdx-doc', 't']]);
  assert.deepEqual(index.outbound.get('mdx-doc'), [{ target: 't', resolved: 't' }]);

  // the same body read as CommonMark (mdx unset) treats the ESM line as prose
  const plain = backlinks.build(docs.map((d) => ({ ...d, mdx: undefined })));
  assert.ok((plain.inbound.get('t') ?? []).length > 1);
});

test('locales: at most one primary prefix, unique codes and prefixes', () => {
  const urlFor = (id: string) => `/n/${id}/`;
  assert.throws(
    () =>
      createBacklinks({
        urlFor,
        locales: [{ code: 'en', prefix: '' }, { code: 'zh', prefix: '' }],
      }),
    /at most one primary \(prefix ''\)/,
  );
  assert.throws(
    () =>
      createBacklinks({
        urlFor,
        locales: [{ code: 'en', prefix: '' }, { code: 'en', prefix: 'en/' }],
      }),
    /locale codes must be unique/,
  );
  assert.throws(
    () =>
      createBacklinks({
        urlFor,
        locales: [{ code: 'en', prefix: 'x/' }, { code: 'zh', prefix: 'x/' }],
      }),
    /locale prefixes must be unique/,
  );
  // the full registry with one '' primary and distinct mirrors is valid
  createBacklinks({ urlFor, locales: [{ code: 'en', prefix: '' }, { code: 'zh', prefix: 'zh/' }] });
});

test('snippetSpan and cap must be positive integers', () => {
  assert.throws(
    () => createBacklinks({ urlFor: (id) => `/n/${id}/`, snippetSpan: 0 }),
    /createBacklinks: snippetSpan must be a positive integer, got 0/,
  );
  assert.throws(
    () => createBacklinks({ urlFor: (id) => `/n/${id}/`, snippetSpan: 4.5 }),
    /snippetSpan must be a positive integer/,
  );
  const index = backlinks.build(corpus());
  assert.throws(() => index.localGraph('alpha', (id) => id, 0), /localGraph: cap must be a positive integer, got 0/);
  assert.throws(() => index.localGraph('alpha', (id) => id, 2.5), /cap must be a positive integer/);
});
