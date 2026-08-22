/**
 * Frontmatter taxonomy resolution for note collections — turns the
 * classification fields on each entry (kind / domains / tags / status /
 * dates) into data a browse UI can render directly.
 *
 * Model:
 *  - A "hub" is a top-level note that declares `nav` — a multi-chapter
 *    collection note. Chapter pages inherit the hub's taxonomy unless they
 *    set their own (arrays override wholesale, never merge).
 *  - Locale mirrors (`en/<id>`, …) inherit from the primary-language entry
 *    (the prefix is stripped to find the canonical id).
 *  - Browse units = primary-language top-level entries. A hub counts as one
 *    unit; chapters and mirrors are not listed separately.
 *
 * The vocabulary itself (which kinds/domains/statuses exist, their labels,
 * tone colors and other display metadata) is site-owned. Bind it once in a
 * small site module and import the bound helpers everywhere else:
 *
 *   // src/lib/taxonomy.ts
 *   import { createTaxonomy } from 'astro-inkstone/lib/taxonomy';
 *   import { KINDS, DOMAINS, STATUSES } from '../content/notes/_meta/taxonomy';
 *   export const { getWikiUnits, groupByKind, groupByDomain, tagIndex, ... } =
 *     createTaxonomy({
 *       kinds: KINDS.map((k) => ({ ...k, label: k.zh })), // map your label field
 *       domains: DOMAINS.map((d) => ({ ...d, label: d.zh })),
 *       statuses: STATUSES.map((s) => ({ ...s, label: s.zh })),
 *     });
 */
import { getCollection } from 'astro:content';

/** Minimal shape of one vocabulary definition. Extra fields pass through. */
export interface TaxonomyDef {
  id: string;
  label: string;
}

/** The fields taxonomy resolution reads off an entry's frontmatter data. */
export interface TaxonomyNoteData extends Record<string, unknown> {
  nav?: { pages: readonly unknown[] }[] | undefined;
  kind?: string | undefined;
  domains: string[];
  tags: string[];
  status?: string | undefined;
  created?: Date | undefined;
  updated?: Date | undefined;
  sources: SourceRecord[];
  aliases: string[];
}

/** One bibliography/source record; the concrete shape is site-schema-owned. */
export type SourceRecord = Record<string, unknown>;

/** Structural view of a content-collection entry (`CollectionEntry<'…'>`). */
export interface TaxonomyNoteEntry {
  id: string;
  data: TaxonomyNoteData;
}

export interface TaxonomyLocale {
  /** locale code, e.g. 'en' */
  code: string;
  /** id prefix of that locale's mirrors, e.g. 'en/' */
  prefix: string;
}

export interface TaxonomyOptions {
  /** content collection to read in getWikiUnits(). Default 'notes'. */
  collection?: string;
  /** mirror-locale prefixes. Default en/ + de/. The primary locale has none. */
  locales?: TaxonomyLocale[];
  /** locale code reported for unprefixed ids. Default 'zh'. */
  primary?: string;
}

export interface ResolvedNote<
  K extends TaxonomyDef = TaxonomyDef,
  D extends TaxonomyDef = TaxonomyDef,
  S extends TaxonomyDef = TaxonomyDef,
  E extends TaxonomyNoteEntry = TaxonomyNoteEntry,
> {
  entry: E;
  /** canonical primary-locale id ("getting-started", "guides") */
  id: string;
  isHub: boolean;
  /** hubs only: chapter count, as declared by nav */
  chapterCount?: number | undefined;
  kind?: K['id'] | undefined;
  /** resolved own → hub; untagged = [] */
  domains: D['id'][];
  tags: string[];
  status?: S['id'] | undefined;
  created?: Date | undefined;
  /** falls back to created */
  updated?: Date | undefined;
  sources: SourceRecord[];
  aliases: string[];
  /** locales this note exists in (always includes the primary) */
  locales: string[];
}

/* Field-level inheritance: "explicitly set" means non-undefined for optional
 * scalars, non-empty for defaulted arrays. */
function pickScalar<T>(chain: TaxonomyNoteData[], get: (d: TaxonomyNoteData) => T | undefined): T | undefined {
  for (const d of chain) {
    const v = get(d);
    if (v !== undefined) return v;
  }
  return undefined;
}
function pickArray<T>(chain: TaxonomyNoteData[], get: (d: TaxonomyNoteData) => T[]): T[] {
  for (const d of chain) {
    const v = get(d);
    if (v.length > 0) return v;
  }
  return [];
}

const DEFAULT_LOCALES: TaxonomyLocale[] = [
  { code: 'en', prefix: 'en/' },
  { code: 'de', prefix: 'de/' },
];

/**
 * Bind the taxonomy helpers to a site's vocabulary registry. Returns the full
 * helper set; each function's behavior is documented on the returned member.
 */
export function createTaxonomy<
  K extends TaxonomyDef,
  D extends TaxonomyDef,
  S extends TaxonomyDef,
  E extends TaxonomyNoteEntry = TaxonomyNoteEntry,
>(
  registry: { kinds: readonly K[]; domains: readonly D[]; statuses: readonly S[] },
  options: TaxonomyOptions = {},
) {
  const { kinds, domains, statuses } = registry;
  const collection = options.collection ?? 'notes';
  const locales = options.locales ?? DEFAULT_LOCALES;
  const primary = options.primary ?? 'zh';

  type Resolved = ResolvedNote<K, D, S, E>;

  /** Strip a mirror-locale prefix → [locale, canonical id]. */
  function stripLocale(id: string): { locale: string; baseId: string } {
    for (const l of locales) {
      if (id.startsWith(l.prefix)) return { locale: l.code, baseId: id.slice(l.prefix.length) };
    }
    return { locale: primary, baseId: id };
  }

  /** Resolve one entry's taxonomy (chapter → hub, mirror → primary entry).
   *  `byId` must contain the whole collection. */
  function resolveTaxonomy(entry: E, byId: Map<string, E>): Resolved {
    const { baseId } = stripLocale(entry.id);
    const segments = baseId.split('/');
    const top = segments[0] ?? baseId;
    const hubEntry = segments.length > 1 ? byId.get(top) : undefined;
    const canonical = byId.get(baseId);

    const chain: TaxonomyNoteData[] = [entry.data];
    if (canonical && canonical !== entry) chain.push(canonical.data);
    if (hubEntry?.data.nav) chain.push(hubEntry.data);

    const created = pickScalar(chain, (d) => d.created);
    const isHub = segments.length === 1 && entry.data.nav !== undefined;

    const present: string[] = [primary];
    for (const l of locales) {
      if (byId.has(`${l.prefix}${baseId}`)) present.push(l.code);
    }

    return {
      entry,
      id: baseId,
      isHub,
      ...(isHub && entry.data.nav
        ? { chapterCount: entry.data.nav.reduce((n, g) => n + g.pages.length, 0) }
        : {}),
      kind: pickScalar(chain, (d) => d.kind) as K['id'] | undefined,
      domains: pickArray(chain, (d) => d.domains) as D['id'][],
      tags: pickArray(chain, (d) => d.tags),
      status: pickScalar(chain, (d) => d.status) as S['id'] | undefined,
      created,
      updated: pickScalar(chain, (d) => d.updated) ?? created,
      sources: pickArray(chain, (d) => d.sources),
      aliases: entry.data.aliases,
      locales: present,
    };
  }

  /** All browse units: primary-locale top-level entries (hubs included),
   *  excluding chapters and mirrors; sorted by updated, newest first. */
  async function getWikiUnits(): Promise<Resolved[]> {
    const notes = (await getCollection(collection as Parameters<typeof getCollection>[0])) as unknown as E[];
    const byId = new Map(notes.map((n) => [n.id, n]));
    const units = notes.filter((n) => !n.id.includes('/')).map((n) => resolveTaxonomy(n, byId));
    return units.sort(
      (a, b) => (b.updated?.getTime() ?? 0) - (a.updated?.getTime() ?? 0) || a.id.localeCompare(b.id),
    );
  }

  /* Grouping helpers — registry order is stable; notes stay updated-desc. */

  function groupByKind(units: Resolved[]): { def: K; notes: Resolved[] }[] {
    return kinds
      .map((def) => ({ def, notes: units.filter((u) => u.kind === def.id) }))
      .filter((g) => g.notes.length > 0);
  }

  function groupByDomain(units: Resolved[]): { def: D; notes: Resolved[] }[] {
    return domains
      .map((def) => ({ def, notes: units.filter((u) => u.domains.includes(def.id)) }))
      .filter((g) => g.notes.length > 0);
  }

  /** Group by primary domain (domains[0]) — landing-page shelf: each unit
   *  appears exactly once. */
  function groupByPrimaryDomain(units: Resolved[]): { def: D; notes: Resolved[] }[] {
    return domains
      .map((def) => ({ def, notes: units.filter((u) => u.domains[0] === def.id) }))
      .filter((g) => g.notes.length > 0);
  }

  /** tag → notes (by count desc, then lexicographic). */
  function tagIndex(units: Resolved[]): Map<string, Resolved[]> {
    const map = new Map<string, Resolved[]>();
    for (const u of units) {
      for (const tag of u.tags) {
        const list = map.get(tag) ?? [];
        list.push(u);
        map.set(tag, list);
      }
    }
    return new Map(
      [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])),
    );
  }

  function statusDef(id: S['id']): S {
    const def = statuses.find((s) => s.id === id);
    if (!def) throw new Error(`unknown status: ${id}`);
    return def;
  }
  function kindDef(id: K['id']): K {
    const def = kinds.find((k) => k.id === id);
    if (!def) throw new Error(`unknown kind: ${id}`);
    return def;
  }
  function domainDef(id: D['id']): D {
    const def = domains.find((d) => d.id === id);
    if (!def) throw new Error(`unknown domain: ${id}`);
    return def;
  }

  return {
    stripLocale,
    resolveTaxonomy,
    getWikiUnits,
    groupByKind,
    groupByDomain,
    groupByPrimaryDomain,
    tagIndex,
    statusDef,
    kindDef,
    domainDef,
  };
}

/** YYYY.MM (UTC fields; `z.coerce.date` parses `2026-05-01` as UTC midnight). */
export function fmtMonth(d: Date | undefined): string {
  if (!d) return '';
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
