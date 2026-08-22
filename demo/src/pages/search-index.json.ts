/**
 * Build-time search index for the ⌘K palette.
 *
 * The endpoint FACTORY lives in the package (body cleanup, truncation, the
 * SearchDoc shape shared with the client); this file only answers the
 * site-specific questions — which documents, what route, which locale, what
 * crumb label. Prerendered into the static bundle AND served live by the dev
 * server, so the palette works in both forms (unlike a dist-only indexer).
 */
import { getCollection } from 'astro:content';
import { buildSearchIndexEndpoint } from 'astro-inkstone/lib/search-index';

import { localeOfId, routeOfId } from '../lib/i18n';
import { kindDef, resolveTaxonomy } from '../lib/taxonomy';

export const GET = buildSearchIndexEndpoint({
  loadDocs: async () => {
    const notes = await getCollection('notes');
    const byId = new Map(notes.map((n) => [n.id, n]));
    return notes.map((entry) => {
      // full taxonomy resolution: a chapter inherits its kind from the hub
      // and a mirror from the primary entry, so every page gets its crumb
      const { kind } = resolveTaxonomy(entry, byId);
      return {
        id: entry.id,
        route: routeOfId(entry.id),
        locale: localeOfId(entry.id),
        title: entry.data.title,
        crumb: kind ? kindDef(kind).label : '',
        body: entry.body ?? '',
      };
    });
  },
});
