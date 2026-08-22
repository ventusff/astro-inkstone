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

import { BOOK, chapterOf } from '../lib/book';
import { baseIdOf, localeOfId, routeOfId } from '../lib/i18n';

export const GET = buildSearchIndexEndpoint({
  loadDocs: async () =>
    (await getCollection('docs')).map((entry) => {
      const locale = localeOfId(entry.id);
      const chapter = chapterOf(baseIdOf(entry.id));
      const n = chapter ? BOOK.indexOf(chapter) + 1 : 0;
      return {
        id: entry.id,
        route: routeOfId(entry.id),
        locale,
        title: entry.data.title,
        crumb: chapter ? `${n} ${locale === 'en' ? chapter.en : chapter.zh}` : '',
        body: entry.body ?? '',
      };
    }),
});
