/**
 * Site binding of the package's backlink-index builder. One instance for
 * the whole site. Both memo layers are keyed by the array they were built
 * from — `toDocs` per entries array, the index per docs array — so pages
 * that share one collection fetch share one index, and a fresh collection
 * (a dev rebuild) is indexed anew.
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

const corpora = new WeakMap<CollectionEntry<'notes'>[], BacklinkDoc[]>();

export function toDocs(entries: CollectionEntry<'notes'>[]): BacklinkDoc[] {
  let docs = corpora.get(entries);
  if (!docs) {
    docs = entries.map((e) => ({
      id: e.id,
      title: e.data.title,
      brand: e.data.brand,
      aliases: e.data.aliases,
      body: e.body,
      // the grammar of the body follows the source file: .mdx bodies parse
      // as MDX, so ESM/JSX/expressions never become backlink edges
      mdx: e.filePath?.endsWith('.mdx') ?? false,
    }));
    corpora.set(entries, docs);
  }
  return docs;
}
