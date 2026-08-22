/**
 * display.ts — turn resolved taxonomy data into the display-ready props the
 * package's presentational components take (NoteCard, FacetNav,
 * TaxonomyLine). One place, so every browse page assembles cards the same
 * way.
 */
import type { NoteCardData } from 'astro-inkstone/components/wiki/NoteCard.astro';

import { href, LOCALES } from './i18n';
import { domainDef, fmtMonth, kindDef, statusDef, type ResolvedNote } from './taxonomy';

/** browse route helpers (root-relative, then through the deploy base) */
export const browseHref = {
  kind: (id: string) => href(`kind/${id}/`),
  domain: (id: string) => href(`domain/${id}/`),
  tag: (tag: string) => href(`tag/${tag}/`),
  all: () => href('all/'),
};

/** FacetNav's `base` prop: the deploy base without its trailing slash. */
export const facetBase = href('').replace(/\/$/, '');

export function cardOf(note: ResolvedNote): NoteCardData {
  return {
    id: note.id,
    href: href(`${note.id}/`),
    title: note.entry.data.title,
    description: note.entry.data.description,
    kind: note.kind ? kindDef(note.kind) : undefined,
    domains: note.domains.map((d) => ({ ...domainDef(d), href: browseHref.domain(d) })),
    status: note.status ? statusDef(note.status) : undefined,
    updated: fmtMonth(note.updated),
    chapterCount: note.chapterCount,
    mirrors: note.locales
      .filter((code) => code !== 'en')
      .map((code) => {
        const l = LOCALES.find((x) => x.code === code)!;
        return { label: l.label, href: href(`${l.prefix}${note.id}/`) };
      }),
  };
}

/** the TaxonomyLine strip for a note page */
export function stripOf(note: ResolvedNote) {
  return {
    kind: note.kind ? kindDef(note.kind) : undefined,
    domains: note.domains.map((d) => ({ ...domainDef(d), href: browseHref.domain(d) })),
    status: note.status ? statusDef(note.status) : undefined,
    updated: fmtMonth(note.updated),
  };
}
