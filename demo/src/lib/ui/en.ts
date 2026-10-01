/**
 * English — the garden's canonical language. The taxonomy records are the
 * registry's own canonical strings, mapped once so the registry stays the
 * single place they are written.
 */
import { DOMAINS, KINDS, STATUSES } from '../../content/notes/_meta/taxonomy';
import type { FacetText, UIStrings } from './types';

const facet = <T extends { id: string; label: string; desc: string }, I extends T['id']>(
  defs: readonly T[],
): Record<I, FacetText> =>
  Object.fromEntries(defs.map((d) => [d.id, { label: d.label, desc: d.desc }])) as Record<I, FacetText>;

export const strings: UIStrings = {
  searchPlaceholder: 'Search the garden… (Esc to close)',
  searchHint: 'Titles, sections and body text, in this language.',
  searchEmpty: 'No note matches.',
  searchUnavailable: 'The search index could not be loaded.',
  searchUnit: 'pages',
  searchScopeAll: 'All',
  searchDialog: 'Site search',
  searchInput: 'Search the manual',
  searchResults: 'Search results',
  searchButton: 'Search (⌘K)',

  languages: 'Language',

  breadcrumb: 'Breadcrumb',
  contents: 'Contents',
  chapterNav: 'Chapter navigation',
  prev: '← prev',
  next: 'next →',
  hub: 'Hub',
  overview: 'Overview',
  updated: 'updated',
  backlinks: 'Linked mentions',
  localGraph: 'Local graph',
  lightbox: 'Image viewer',
  close: 'Close',
  copied: 'Code copied to the clipboard',
  copyFailed: 'Copy failed — the clipboard is not available',
  theme: 'Toggle light / dark theme',
  github: 'Source on GitHub',
  menu: 'Menu',
  skip: 'Skip to content',
  partLabel: (roman) => `Part ${roman}`,
  readingTime: (min) => `${min} min read`,
  footer: 'astro-inkstone demo · the notes are the manual, the manual is the demo',

  landingTitle: 'A paper-and-ink garden',
  landingDesc: "astro-inkstone — the Astro wiki you can write in. Paper-and-ink typography for documentation sites, wikis and digital gardens, with in-place editing through astro-inkbrush. This demo is the package's own manual, written with the package itself.",

  speakLabel: 'In plain words →',
  diffLabel: 'vs prior →',

  kinds: facet(KINDS),
  domains: facet(DOMAINS),
  statuses: facet(STATUSES),

  browse: {
    kicker: 'Garden',
    kickerSub: 'the manual, grown as notes',
    title: 'Paper & ink',
    titleSub: 'a growing garden of working notes',
    lede: (notes, domains) =>
      `The astro-inkstone manual, grown as a garden — ${notes} notes across ${domains} domains, browsable by kind, domain and tag. Every rendering effect on these pages is the package at work.`,
    sep: ' ',
    stop: '.',
    source: 'Source:',
    thisPackage: 'this package',
    theEngine: 'the CMS engine —',
    editsThesePages: 'edits these very pages',
    recent: 'Recently updated',
    recentSub: 'the last three to change',
    shelfCount: (n) => `${n} primary · all →`,
    allNotes: 'All notes →',
    byKind: 'By kind',
    byDomain: 'By domain',
    byStatus: 'By status',
    byTag: 'By tag',
    facetLede: (desc, n) => `${desc} — ${n} notes.`,
    domainLede: (desc, n) => `${desc} — ${n} notes, primary or secondary.`,
    tagLede: (n) => `${n} notes.`,
    tagDesc: (tag, n) => `Notes tagged ${tag} (${n})`,
    facetDesc: (desc, n) => `${desc} (${n} notes)`,
    all: 'All notes',
    allKicker: 'everything',
    allEntries: (n) => `${n} entries`,
    allDesc: (n) => `Every note in the garden (${n}), newest first, with instant filters.`,
    allLede: 'Newest first. The pills below filter in place; without JavaScript they lead to the facet pages.',
    dimKind: 'Kind',
    dimDomain: 'Domain',
    dimStatus: 'Status',
    dimTag: 'Tags',
    facetsAria: 'Browse index',
    facetAll: 'All →',
    clear: 'Clear filters',
    noMatch: 'No note matches every selected filter.',
    allTags: 'All tags',
    chapters: (n) => `${n} chapters`,
  },
};
