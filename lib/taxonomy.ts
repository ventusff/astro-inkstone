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

import { fileChanges } from './git-changes.ts';
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
export type { ChangeRecord, IdentifyAuthor, NoteAuthor } from './taxonomy-core.ts';
export { ageDays, fmtDay, fmtMonth, latestOf, recentUnits } from './taxonomy-core.ts';

export interface CollectionTaxonomyOptions extends TaxonomyOptions {
  /** content collection read by getWikiUnits(). Default 'notes'. */
  collection?: string;
  /**
   * Root of the note files inside their git work tree (path or file URL,
   * e.g. `new URL('../content/notes/', import.meta.url)`). With it, every
   * unit carries `changed`: the latest commit touching any of its files, and
   * units sort by that; and a page that does not name its `authors` in
   * frontmatter is credited to the person whose commit created its file
   * (identities folded by the repo's `.mailmap`). Without it, frontmatter
   * dates order the units and only frontmatter names authors.
   */
  contentDir?: string | URL;
  /**
   * Author names or emails whose commits do not count: services that derive
   * content from what people wrote, such as a translation sync. A note they
   * touched keeps the last change a person made, and they never author one.
   */
  excludeAuthors?: readonly string[];
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
  const { collection = 'notes', contentDir, excludeAuthors, ...rest } = options;
  const core = createTaxonomyCore<K, D, S, E>(registry, rest);
  return {
    ...core,
    /** All browse units of the collection, newest first (core.unitsOf over getCollection, with the repo's changes when `contentDir` is set). */
    async getWikiUnits() {
      const [notes, changes] = await Promise.all([
        getCollection(collection as Parameters<typeof getCollection>[0]) as unknown as Promise<E[]>,
        contentDir ? fileChanges(contentDir, { excludeAuthors }) : undefined,
      ]);
      return core.unitsOf(notes, changes);
    },
  };
}
