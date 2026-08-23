import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTaxonomyCore, fmtMonth, type TaxonomyNoteEntry } from '../lib/taxonomy-core.ts';

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
