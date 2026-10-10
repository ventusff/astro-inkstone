import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ageDays, createTaxonomyCore, fmtDay, fmtMonth, latestOf, recentUnits, type TaxonomyNoteEntry } from '../lib/taxonomy-core.ts';

const registry = {
  kinds: [{ id: 'guide', label: 'Guide' }, { id: 'reference', label: 'Reference' }],
  domains: [{ id: 'design', label: 'Design' }, { id: 'pipeline', label: 'Pipeline' }],
  statuses: [{ id: 'growing', label: 'Growing' }, { id: 'evergreen', label: 'Evergreen' }],
};
const note = (id: string, data: Record<string, unknown>): TaxonomyNoteEntry => ({ id, data: data as never });
const bind = (notes: TaxonomyNoteEntry[]) => {
  const t = createTaxonomyCore(registry, { locales: [{ code: 'zh', prefix: 'zh/' }], primary: 'en' });
  return { t, byId: new Map(notes.map((n) => [n.id, n])) };
};

test('a chapter inherits what it leaves undefined and keeps what it sets, an empty array included', () => {
  const hub = note('guides', { nav: [{ group: 'g', pages: ['a', 'b'] }], kind: 'reference', domains: ['design'], tags: ['x'], status: 'evergreen', created: new Date('2026-01-01') });
  const a = note('guides/a', {});
  const b = note('guides/b', { domains: [], tags: ['own'] });
  const { t, byId } = bind([hub, a, b]);
  const ra = t.resolveTaxonomy(a, byId);
  assert.equal(ra.kind, 'reference');
  assert.deepEqual(ra.domains, ['design']);
  assert.deepEqual(ra.tags, ['x']);
  assert.equal(ra.status, 'evergreen');
  assert.equal(ra.isHub, false);
  const rb = t.resolveTaxonomy(b, byId);
  assert.deepEqual(rb.domains, []);
  assert.deepEqual(rb.tags, ['own']);
  assert.equal(t.resolveTaxonomy(hub, byId).chapterCount, 2);
});

test('a mirror inherits from the primary entry and reports the locales that exist', () => {
  const en = note('tokens', { kind: 'guide', domains: ['design'], created: new Date('2026-02-01') });
  const zh = note('zh/tokens', {});
  const { t, byId } = bind([en, zh]);
  const r = t.resolveTaxonomy(zh, byId);
  assert.equal(r.id, 'tokens');
  assert.equal(r.kind, 'guide');
  assert.deepEqual(r.locales, ['en', 'zh']);
  assert.deepEqual(t.stripLocale('zh/tokens'), { locale: 'zh', baseId: 'tokens' });
  assert.deepEqual(t.resolveTaxonomy(note('zh/orphan', {}), new Map([['zh/orphan', note('zh/orphan', {})]])).locales, ['zh']);
});

test('units are top-level primary entries, newest first; grouping follows registry order', () => {
  const notes = [
    note('old', { kind: 'guide', domains: ['pipeline', 'design'], updated: new Date('2026-01-01'), tags: ['t'] }),
    note('new', { kind: 'reference', domains: ['design'], updated: new Date('2026-03-01'), tags: ['t', 'u'] }),
    note('new/chapter', {}),
    note('zh/new', {}),
  ];
  const { t } = bind(notes);
  const units = t.unitsOf(notes);
  assert.deepEqual(units.map((u) => u.id), ['new', 'old']);
  assert.deepEqual(t.groupByKind(units).map((g) => [g.def.id, g.notes.length]), [['guide', 1], ['reference', 1]]);
  assert.deepEqual(t.groupByPrimaryDomain(units).map((g) => [g.def.id, g.notes.map((n) => n.id)]), [['design', ['new']], ['pipeline', ['old']]]);
  assert.deepEqual([...t.tagIndex(units).keys()], ['t', 'u']);
  assert.equal(fmtMonth(new Date('2026-03-01')), '2026.03');
});

test('duplicate tags resolve to one: facet counts and the tag index count the note once', () => {
  const dup = note('dup', { tags: ['t', 't', 'u'] });
  const { t, byId } = bind([dup]);
  assert.deepEqual(t.resolveTaxonomy(dup, byId).tags, ['t', 'u']);
  const units = t.unitsOf([dup]);
  assert.deepEqual([...t.tagIndex(units).entries()].map(([tag, list]) => [tag, list.length]), [['t', 1], ['u', 1]]);
});

test('locales are mirror prefixes: non-empty and unique, or the binding throws', () => {
  assert.throws(
    () => createTaxonomyCore(registry, { locales: [{ code: 'en', prefix: '' }], primary: 'zh' }),
    /MIRROR prefixes only and they must be non-empty/,
  );
  assert.throws(
    () => createTaxonomyCore(registry, { locales: [{ code: 'en', prefix: 'x/' }, { code: 'de', prefix: 'x/' }] }),
    /mirror prefixes must be unique/,
  );
  createTaxonomyCore(registry, { locales: [{ code: 'en', prefix: 'en/' }, { code: 'de', prefix: 'de/' }] });
});

test('aliases are entry-local: neither a chapter nor a mirror inherits them', () => {
  const hub = note('guides', { nav: [{ group: 'g', pages: ['a'] }], aliases: ['the-guides'] });
  const chapter = note('guides/a', {});
  const en = note('tokens', { aliases: ['tok'] });
  const zh = note('zh/tokens', {});
  const { t, byId } = bind([hub, chapter, en, zh]);
  assert.deepEqual(t.resolveTaxonomy(hub, byId).aliases, ['the-guides']);
  assert.deepEqual(t.resolveTaxonomy(chapter, byId).aliases, []);
  assert.deepEqual(t.resolveTaxonomy(en, byId).aliases, ['tok']);
  assert.deepEqual(t.resolveTaxonomy(zh, byId).aliases, []);
});

test('repo changes attach each unit\'s newest commit across its directory, chapters and mirrors, and order the units', () => {
  const notes = [
    note('old', { updated: new Date('2026-03-01') }),
    note('new', { updated: new Date('2026-01-01') }),
    note('new/chapter', {}),
    note('zh/new', {}),
    note('untracked', { updated: new Date('2026-02-01') }),
  ];
  const { t } = bind(notes);
  const changes = new Map([
    ['old/index.mdx', { at: new Date('2026-04-01T08:00:00Z'), createdBy: 'A' }],
    ['new/index.mdx', { at: new Date('2026-04-02T08:00:00Z'), createdBy: 'B' }],
    ['zh/new/index.mdx', { at: new Date('2026-04-03T08:00:00Z'), createdBy: 'C' }],
    ['new/chapter/figure.svg', { at: new Date('2026-04-02T09:00:00Z'), createdBy: 'D' }],
    ['README.md', { at: new Date('2026-05-01T08:00:00Z'), createdBy: 'E' }],
  ]);
  const units = t.unitsOf(notes, changes);
  assert.deepEqual(units.map((u) => u.id), ['new', 'old', 'untracked']);
  assert.deepEqual(units[0]!.changed, new Date('2026-04-03T08:00:00Z'));
  assert.equal(units[2]!.changed, undefined);
  assert.equal(latestOf(units[2]!)?.toISOString(), '2026-02-01T00:00:00.000Z');
  assert.deepEqual(t.unitsOf(notes).map((u) => u.id), ['old', 'untracked', 'new']);
});

test('authors are the people who wrote the primary-language pages: frontmatter first, else the creator of each page file', () => {
  const notes = [
    note('hub', { nav: [{ group: 'g', pages: ['a', 'b', 'c'] }] }),
    note('hub/a', {}),
    note('hub/b', { authors: ['Guest Writer'] }),
    note('hub/c', {}),
    note('zh/hub', {}),
    note('named', { authors: ['Named Person', ' '] }),
    note('plain', {}),
  ];
  const { t } = bind(notes);
  const at = new Date('2026-04-01T08:00:00Z');
  const changes = new Map([
    ['hub/index.mdx', { at, createdBy: 'Hub Author' }],
    ['hub/a/index.md', { at, createdBy: 'Chapter Author' }],
    ['hub/b/index.mdx', { at, createdBy: 'Importer' }],
    ['hub/c/index.mdx', { at, createdBy: 'Hub Author' }],
    ['hub/c/demo.ts', { at, createdBy: 'Demo Author' }],
    ['zh/hub/index.mdx', { at, createdBy: 'Translator' }],
    ['named/index.mdx', { at, createdBy: 'Migrator' }],
  ]);
  const byId = new Map(t.unitsOf(notes, changes).map((u) => [u.id, u.authors]));
  assert.deepEqual(byId.get('hub'), ['Hub Author', 'Chapter Author', 'Guest Writer']);
  assert.deepEqual(byId.get('named'), ['Named Person']);
  const credited = notes.map((n) => (n.id === 'hub' ? note('hub', { ...n.data, authors: ['Series Editor'] }) : n));
  assert.deepEqual(new Map(bind(credited).t.unitsOf(credited, changes).map((u) => [u.id, u.authors])).get('hub'), ['Series Editor']);
  assert.deepEqual(byId.get('plain'), []);
  assert.deepEqual(new Map(t.unitsOf(notes).map((u) => [u.id, u.authors])).get('hub'), ['Guest Writer']);
});

test('ages are calendar days in the given zone; recentUnits keeps what changed within the window', () => {
  const now = new Date('2026-10-02T00:30:00Z'); // 02:30 in Berlin
  assert.equal(ageDays(new Date('2026-10-01T22:30:00Z'), { now, timeZone: 'Europe/Berlin' }), 0);
  assert.equal(ageDays(new Date('2026-10-01T21:30:00Z'), { now, timeZone: 'Europe/Berlin' }), 1);
  assert.equal(ageDays(new Date('2026-10-01T21:30:00Z'), { now }), 1);
  assert.equal(ageDays(new Date('2026-09-02T12:00:00Z'), { now, timeZone: 'Europe/Berlin' }), 30);
  assert.equal(ageDays(undefined, { now }), undefined);
  assert.equal(fmtDay(new Date('2026-10-01T22:30:00Z'), 'Europe/Berlin'), '2026.10.02');
  assert.equal(fmtDay(new Date('2026-10-01T22:30:00Z')), '2026.10.01');

  const units = [
    { id: 'today', changed: new Date('2026-10-01T23:00:00Z') },
    { id: 'week', changed: new Date('2026-09-26T12:00:00Z') },
    { id: 'month', updated: new Date('2026-09-10') },
    { id: 'stale', updated: new Date('2026-08-01') },
    { id: 'undated' },
  ];
  const window = { now, timeZone: 'Europe/Berlin' };
  assert.deepEqual(recentUnits(units, { days: 7, ...window }).map((u) => u.id), ['today', 'week']);
  assert.deepEqual(recentUnits(units, { days: 30, ...window }).map((u) => u.id), ['today', 'week', 'month']);
});
