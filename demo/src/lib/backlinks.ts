/**
 * Site binding of the package's backlink-index builder. One instance for
 * the whole site. The docs corpus is memoized on the collection's CONTENT
 * — every entry's id and digest (the glob loader's content hash) — never
 * on the array `getCollection` returns: that is a fresh array of fresh
 * entry objects on every call, and a per-page caller keyed on it would
 * re-index the whole site on every page. The index is memoized per docs
 * array by the package, so one corpus means one index; a note edited in
 * dev changes its digest and the site is indexed anew.
 */
import type { CollectionEntry } from 'astro:content';
import { createBacklinks, type BacklinkDoc } from 'astro-inkstone/lib/backlinks';

import { LOCALE_DEFS } from '../content/notes/_meta/locales';
import { href } from './i18n';

export type { BacklinkItem } from 'astro-inkstone/lib/backlinks';

export const backlinks = createBacklinks({
  urlFor: (id) => href(`${id}/`),
  locales: LOCALE_DEFS.map(({ code, prefix }) => ({ code, prefix })),
});

let corpus: { key: string; docs: BacklinkDoc[] } | undefined;

export function toDocs(entries: CollectionEntry<'notes'>[]): BacklinkDoc[] {
  const key = entries.map((e) => `${e.id}\0${e.digest}`).join('\n');
  if (corpus?.key !== key) {
    const docs = entries.map((e) => ({
      id: e.id,
      title: e.data.title,
      brand: e.data.brand,
      aliases: e.data.aliases,
      body: e.body,
      // the grammar of the body follows the source file: .mdx bodies parse
      // as MDX, so ESM/JSX/expressions never become backlink edges
      mdx: e.filePath?.endsWith('.mdx') ?? false,
    }));
    corpus = { key, docs };
  }
  return corpus.docs;
}
