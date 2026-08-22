/**
 * Site binding of the package's backlink-index builder. One instance for the
 * whole site; the docs array is the index's memo key, so pages share one
 * corpus built once from the collection.
 */
import type { CollectionEntry } from 'astro:content';
import { createBacklinks, type BacklinkDoc } from 'astro-inkstone/lib/backlinks';

import { href } from './i18n';

export type { BacklinkItem } from 'astro-inkstone/lib/backlinks';

export const backlinks = createBacklinks({
  urlFor: (id) => href(`${id}/`),
  locales: [
    { code: 'en', prefix: '' },
    { code: 'zh', prefix: 'zh/' },
  ],
});

let corpus: BacklinkDoc[] | undefined;

export function toDocs(entries: CollectionEntry<'notes'>[]): BacklinkDoc[] {
  return (corpus ??= entries.map((e) => ({
    id: e.id,
    title: e.data.title,
    brand: e.data.brand,
    aliases: e.data.aliases,
    body: e.body,
  })));
}
