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
