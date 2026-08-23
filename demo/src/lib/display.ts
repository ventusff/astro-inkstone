/**
 * display.ts — turn resolved taxonomy data into the display-ready props the
 * package's presentational components take (NoteCard, FacetNav,
 * TaxonomyLine). One place, so every browse page assembles cards the same
 * way, in the page's language: labels and descriptions come from the
 * registry's en or zh fields, browse links stay inside the locale's page
 * tree, and a card titles itself after the note's mirror in that locale
 * when one exists.
 */
import type { NoteCardData } from 'astro-inkstone/components/wiki/NoteCard.astro';

import { STATUSES } from '../content/notes/_meta/taxonomy';
import { href, LOCALES, localePrefix, UI, type Locale } from './i18n';
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

/** registry def → the label and description of the page's language (the
 *  registry carries both) */
export const localized = <T extends { label: string; zh: string; desc?: string; descZh?: string }>(
  def: T,
  locale: Locale,
): T => (locale === 'zh' ? { ...def, label: def.zh, ...(def.descZh !== undefined ? { desc: def.descZh } : {}) } : def);

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
 * lets a zh page title the card after the note's zh mirror and link to it;
 * a note with no mirror in that locale keeps its primary title and link, and
 * the card's mirror chips point at the other locale's page.
 */
export function cardOf(
  note: ResolvedNote,
  locale: Locale = 'en',
  byId?: Map<string, NoteEntry>,
): NoteCardData {
  const links = browseHrefFor(locale);
  const ownId = `${localePrefix(locale)}${note.id}`;
  const shown = (locale !== 'en' && byId?.get(ownId)) || note.entry;
  const shownId = shown === note.entry ? note.id : ownId;
  return {
    id: note.id,
    href: href(`${shownId}/`),
    title: shown.data.title,
    description: shown.data.description,
    kind: note.kind ? localized(kindDef(note.kind), locale) : undefined,
    domains: note.domains.map((d) => ({ ...localized(domainDef(d), locale), href: links.domain(d) })),
    status: note.status ? localized(statusDef(note.status), locale) : undefined,
    updated: fmtMonth(note.updated),
    chapterCount: note.chapterCount,
    // the note's other-locale pages: every locale it exists in except the
    // one this card already links to
    mirrors: note.locales
      .filter((code) => code !== (shownId === note.id ? 'en' : locale))
      .map((code) => {
        const l = LOCALES.find((x) => x.code === code)!;
        return { label: l.label, href: href(`${l.prefix}${note.id}/`) };
      }),
  };
}

/** the TaxonomyLine strip for a note page, labelled in the page's language */
export function stripOf(note: ResolvedNote, locale: Locale = 'en', readingMinutes?: number) {
  const links = browseHrefFor(locale);
  return {
    kind: note.kind ? localized(kindDef(note.kind), locale) : undefined,
    domains: note.domains.map((d) => ({ ...localized(domainDef(d), locale), href: links.domain(d) })),
    status: note.status ? localized(statusDef(note.status), locale) : undefined,
    updated: fmtMonth(note.updated),
    reading: readingMinutes ? UI[locale].readingTime(readingMinutes) : undefined,
  };
}

/** FacetNav's rows for a set of units, labelled in the page's language:
 *  kinds, domains and statuses that occur (with counts) and the ten most
 *  used tags */
export function facetsOf(units: ResolvedNote[], locale: Locale) {
  return {
    kinds: groupByKind(units).map((g) => ({ def: localized(g.def, locale), count: g.notes.length })),
    domains: groupByDomain(units).map((g) => ({ def: localized(g.def, locale), count: g.notes.length })),
    statuses: STATUSES.map((s) => ({ def: localized(s, locale), count: units.filter((u) => u.status === s.id).length })).filter(
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
