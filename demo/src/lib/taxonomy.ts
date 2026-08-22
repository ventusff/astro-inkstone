/**
 * Site binding of the package's taxonomy helpers — the reference
 * implementation of the three-line contract: registry in the content tree,
 * `createTaxonomy` from the package, bound helpers exported for every page.
 *
 * This garden's registry already uses `label` as its display field; a site
 * whose registry carries language-specific fields maps them here instead
 * (e.g. `KINDS.map((k) => ({ ...k, label: k.zh }))`).
 */
import type { CollectionEntry } from 'astro:content';
import { createTaxonomy, fmtMonth } from 'astro-inkstone/lib/taxonomy';

import { DOMAINS, KINDS, STATUSES } from '../content/notes/_meta/taxonomy';

export type NoteEntry = CollectionEntry<'notes'>;

export const {
  stripLocale,
  resolveTaxonomy,
  getWikiUnits,
  groupByKind,
  groupByDomain,
  groupByPrimaryDomain,
  tagIndex,
  statusDef,
  kindDef,
  domainDef,
} = createTaxonomy<
  (typeof KINDS)[number],
  (typeof DOMAINS)[number],
  (typeof STATUSES)[number],
  NoteEntry
>(
  { kinds: KINDS, domains: DOMAINS, statuses: STATUSES },
  { collection: 'notes', locales: [{ code: 'zh', prefix: 'zh/' }], primary: 'en' },
);

export type ResolvedNote = ReturnType<typeof resolveTaxonomy>;

export { fmtMonth };
