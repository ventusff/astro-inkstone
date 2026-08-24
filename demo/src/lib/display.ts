/**
 * display.ts — turn resolved taxonomy data into the display-ready props the
 * package's presentational components take (NoteCard, FacetNav,
 * TaxonomyLine). One place, so every browse page assembles cards the same
 * way, in the page's language: labels and descriptions come from the
 * locale's UI strings keyed by the registry's canonical ids, browse links
 * stay inside the locale's page tree, and a card titles itself after the
 * note's mirror in that locale when one exists.
 */
import type { NoteCardData } from 'astro-inkstone/components/wiki/NoteCard.astro';

import type { DomainDef, KindDef, StatusDef } from '../content/notes/_meta/taxonomy';
import { STATUSES } from '../content/notes/_meta/taxonomy';
import { href, idIn, localePrefix, UI, type Locale } from './i18n';
import type { FacetText } from './ui/types';
import {
  domainDef,
  fmtMonth,
  groupByDomain,
  groupByKind,
  kindDef,
  statusDef,
  tagIndex,
  type NoteEntry,
  type ResolvedNote,
} from './taxonomy';

export type FacetDim = 'kind' | 'domain' | 'status';

/** the locale's display strings for one taxonomy dimension, keyed by id */
export function facetTexts(dim: FacetDim, locale: Locale): Record<string, FacetText> {
  const t = UI[locale];
  return { kind: t.kinds, domain: t.domains, status: t.statuses }[dim];
}

/** registry def → the def with label/desc in the page's language */
export const localized = <T extends KindDef | DomainDef | StatusDef>(
  dim: FacetDim,
  def: T,
  locale: Locale,
): T => ({ ...def, ...facetTexts(dim, locale)[def.id] });

/**
 * The decorative counterpart language of a page — the small sub-line under
 * shelf titles and facet headings: English everywhere, and Chinese on the
 * English pages themselves (the garden's paper-and-ink identity).
 */
export function subLocaleOf(locale: Locale): Locale {
  return locale === 'en' ? 'zh' : 'en';
}

/** browse route helpers for one locale (root-relative, then through the
 *  deploy base); ids and tags are slugs by schema, so they are path segments
 *  as they are */
export function browseHrefFor(locale: Locale) {
  const p = localePrefix(locale);
  return {
    home: () => href(p),
    kind: (id: string) => href(`${p}kind/${id}/`),
    domain: (id: string) => href(`${p}domain/${id}/`),
    status: (id: string) => href(`${p}status/${id}/`),
    tag: (tag: string) => href(`${p}tag/${tag}/`),
    all: () => href(`${p}all/`),
  };
}

/** FacetNav's `base` prop for one locale: the deploy base plus the locale's
 *  page-tree prefix, without a trailing slash. */
export function facetBaseFor(locale: Locale): string {
  return href(localePrefix(locale)).replace(/\/$/, '');
}

/**
 * A note card in the page's language. `byId` (the collection keyed by id)
 * lets a page title the card after the note's mirror in its own locale and
 * link to it; a note with no mirror in that locale keeps its primary title
 * and link. The language menu is the site's one language control — cards
 * carry no per-locale chips.
 */
export function cardOf(
  note: ResolvedNote,
  locale: Locale,
  byId?: Map<string, NoteEntry>,
): NoteCardData {
  const links = browseHrefFor(locale);
  const shown = byId?.get(idIn(locale, note.id)) ?? note.entry;
  const shownId = shown === note.entry ? note.id : idIn(locale, note.id);
  return {
    id: note.id,
    href: href(`${shownId}/`),
    title: shown.data.title,
    description: shown.data.description,
    kind: note.kind ? localized('kind', kindDef(note.kind), locale) : undefined,
    domains: note.domains.map((d) => ({ ...localized('domain', domainDef(d), locale), href: links.domain(d) })),
    status: note.status ? localized('status', statusDef(note.status), locale) : undefined,
    updated: fmtMonth(note.updated),
    chapterCount: note.chapterCount,
  };
}

/** the TaxonomyLine strip for a note page, labelled in the page's language */
export function stripOf(note: ResolvedNote, locale: Locale, readingMinutes?: number) {
  const links = browseHrefFor(locale);
  return {
    kind: note.kind ? localized('kind', kindDef(note.kind), locale) : undefined,
    domains: note.domains.map((d) => ({ ...localized('domain', domainDef(d), locale), href: links.domain(d) })),
    status: note.status ? localized('status', statusDef(note.status), locale) : undefined,
    updated: fmtMonth(note.updated),
    reading: readingMinutes ? UI[locale].readingTime(readingMinutes) : undefined,
  };
}

/** FacetNav's rows for a set of units, labelled in the page's language:
 *  kinds, domains and statuses that occur (with counts) and the ten most
 *  used tags */
export function facetsOf(units: ResolvedNote[], locale: Locale) {
  return {
    kinds: groupByKind(units).map((g) => ({ def: localized('kind', g.def, locale), count: g.notes.length })),
    domains: groupByDomain(units).map((g) => ({ def: localized('domain', g.def, locale), count: g.notes.length })),
    statuses: STATUSES.map((s) => ({ def: localized('status', s, locale), count: units.filter((u) => u.status === s.id).length })).filter(
      (s) => s.count > 0,
    ),
    tags: [...tagIndex(units).entries()].slice(0, 10).map(([tag, list]) => ({ tag, count: list.length })),
    labels: {
      kind: UI[locale].browse.dimKind,
      domain: UI[locale].browse.dimDomain,
      status: UI[locale].browse.dimStatus,
      tag: UI[locale].browse.dimTag,
      all: UI[locale].browse.facetAll,
      aria: UI[locale].browse.facetsAria,
    },
  };
}
