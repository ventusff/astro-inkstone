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
import { getWikiUnits, kindDef } from '../lib/taxonomy';

export const GET = buildSearchIndexEndpoint({
  loadDocs: async () => {
    const units = await getWikiUnits();
    const kindOf = new Map(units.map((u) => [u.id, u.kind]));
    return (await getCollection('notes')).map((entry) => {
      const kind = kindOf.get(entry.id.replace(/^zh\//, ''));
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
