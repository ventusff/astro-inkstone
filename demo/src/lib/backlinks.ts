/**
 * Site binding of the package's backlink-index builder. One instance for the
 * whole site (it memoizes across pages in production builds); pages map the
 * collection into `BacklinkDoc`s and ask for the index.
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

export function toDocs(entries: CollectionEntry<'notes'>[]): BacklinkDoc[] {
  return entries.map((e) => ({
    id: e.id,
    title: e.data.title,
    brand: e.data.brand,
    aliases: e.data.aliases,
    body: e.body,
  }));
}
