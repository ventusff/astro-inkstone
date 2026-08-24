/**
 * UIStrings — the contract every locale's strings file fulfils. One file per
 * locale in this directory, named `<code>.ts`, exporting `strings: UIStrings`;
 * the locale registry row and this file together are what "the site speaks
 * that language" means. The type is total on purpose: a new locale that
 * misses one string — the taxonomy records included — is a type error, not a
 * silent English fallback.
 *
 * Count-taking strings are functions so a locale can apply its own plural
 * rules (Russian and Polish need three forms; CJK needs a measure word) —
 * templates cannot.
 */
import type { DomainId, KindId, StatusId } from '../../content/notes/_meta/taxonomy';

/** a taxonomy value's display strings in one language */
export interface FacetText {
  label: string;
  desc: string;
}

export interface UIStrings {
  /* ---- search palette ---- */
  searchPlaceholder: string;
  searchHint: string;
  searchEmpty: string;
  searchUnavailable: string;
  /** unit noun after the result count, e.g. 'pages' / '篇' */
  searchUnit: string;
  searchScopeAll: string;
  searchDialog: string;
  searchInput: string;
  searchResults: string;
  searchButton: string;

  /* ---- language menu (the site's one language control) ---- */
  /** accessible name of the menu button and its popover nav */
  languages: string;

  /* ---- chrome ---- */
  breadcrumb: string;
  contents: string;
  chapterNav: string;
  prev: string;
  next: string;
  hub: string;
  /** a hub's own rail row when its nav gives it no label */
  overview: string;
  updated: string;
  backlinks: string;
  localGraph: string;
  lightbox: string;
  close: string;
  copied: string;
  copyFailed: string;
  theme: string;
  menu: string;
  skip: string;
  /** chapter numeral label: partLabel('II') → 'Part II' / '第 II 部' */
  partLabel: (roman: string) => string;
  readingTime: (min: number) => string;
  footer: string;

  /* ---- landing page <title> and meta description ---- */
  landingTitle: string;
  landingDesc: string;

  /* ---- content-layer generated labels (--speak-label / --diff-label) ---- */
  speakLabel: string;
  diffLabel: string;

  /* ---- taxonomy display strings (canonical ids → this language) ---- */
  kinds: Record<KindId, FacetText>;
  domains: Record<DomainId, FacetText>;
  statuses: Record<StatusId, FacetText>;

  /* ---- browse pages: landing, facets, the all-notes index ---- */
  browse: {
    kicker: string;
    kickerSub: string;
    title: string;
    titleSub: string;
    lede: (notes: number, domains: number) => string;
    /** between the lede and the source line, and the sentence's full stop */
    sep: string;
    stop: string;
    source: string;
    thisPackage: string;
    theEngine: string;
    editsThesePages: string;
    recent: string;
    recentSub: string;
    shelfCount: (n: number) => string;
    allNotes: string;
    byKind: string;
    byDomain: string;
    byStatus: string;
    byTag: string;
    facetLede: (desc: string, n: number) => string;
    domainLede: (desc: string, n: number) => string;
    tagLede: (n: number) => string;
    tagDesc: (tag: string, n: number) => string;
    facetDesc: (desc: string, n: number) => string;
    all: string;
    allKicker: string;
    allEntries: (n: number) => string;
    allDesc: (n: number) => string;
    allLede: string;
    dimKind: string;
    dimDomain: string;
    dimStatus: string;
    dimTag: string;
    facetsAria: string;
    facetAll: string;
    clear: string;
    noMatch: string;
    allTags: string;
    chapters: (n: number) => string;
  };
}
