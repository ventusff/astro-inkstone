/**
 * Taxonomy helpers bound to a site's vocabulary registry, with the
 * `astro:content` loader attached. The resolution itself is ./taxonomy-core.ts.
 *
 * Bind once in a small site module and import the bound helpers everywhere:
 *
 *   // src/lib/taxonomy.ts
 *   import { createTaxonomy } from 'astro-inkstone/lib/taxonomy';
 *   import { KINDS, DOMAINS, STATUSES } from '../content/notes/_meta/taxonomy';
 *   export const { getWikiUnits, groupByKind, groupByDomain, tagIndex, ... } =
 *     createTaxonomy(
 *       {
 *         kinds: KINDS.map((k) => ({ ...k, label: k.zh })), // map your label field
 *         domains: DOMAINS.map((d) => ({ ...d, label: d.zh })),
 *         statuses: STATUSES.map((s) => ({ ...s, label: s.zh })),
 *       },
 *       { collection: 'notes' },
 *     );
 */
import { getCollection } from 'astro:content';

import {
  createTaxonomyCore,
  type TaxonomyDef,
  type TaxonomyNoteEntry,
  type TaxonomyOptions,
} from './taxonomy-core.ts';

export type {
  ResolvedNote,
  SourceRecord,
  TaxonomyDef,
  TaxonomyLocale,
  TaxonomyNoteData,
  TaxonomyNoteEntry,
  TaxonomyOptions,
} from './taxonomy-core.ts';
export { fmtMonth } from './taxonomy-core.ts';

export interface CollectionTaxonomyOptions extends TaxonomyOptions {
  /** content collection read by getWikiUnits(). Default 'notes'. */
  collection?: string;
}

export function createTaxonomy<
  K extends TaxonomyDef,
  D extends TaxonomyDef,
  S extends TaxonomyDef,
  E extends TaxonomyNoteEntry = TaxonomyNoteEntry,
>(
  registry: { kinds: readonly K[]; domains: readonly D[]; statuses: readonly S[] },
  options: CollectionTaxonomyOptions = {},
) {
  const { collection = 'notes', ...rest } = options;
  const core = createTaxonomyCore<K, D, S, E>(registry, rest);
  return {
    ...core,
    /** All browse units of the collection, newest first (core.unitsOf over getCollection). */
    async getWikiUnits() {
      const notes = (await getCollection(collection as Parameters<typeof getCollection>[0])) as unknown as E[];
      return core.unitsOf(notes);
    },
  };
}
