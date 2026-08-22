/**
 * Frontmatter taxonomy resolution for note collections — turns the
 * classification fields on each entry (kind / domains / tags / status /
 * dates) into data a browse UI can render directly. Pure: no Astro imports;
 * ./taxonomy.ts adds the `astro:content` loader on top.
 *
 * Model:
 *  - A "hub" is a top-level note that declares `nav` — a multi-chapter
 *    collection note. Chapter pages inherit the hub's taxonomy field by
 *    field: a field the chapter leaves undefined comes from the hub; a field
 *    it sets — an empty array included — is its own (arrays never merge).
 *    A site schema must therefore keep inheritable arrays optional, not
 *    default them to `[]`.
 *  - Locale mirrors (`en/<id>`, …) inherit from the primary-language entry
 *    (the prefix is stripped to find the canonical id).
 *  - Browse units = primary-language top-level entries. A hub counts as one
 *    unit; chapters and mirrors are not listed separately.
 */

/** Minimal shape of one vocabulary definition. Extra fields pass through. */
export interface TaxonomyDef {
  id: string;
  label: string;
}

/** The fields taxonomy resolution reads off an entry's frontmatter data. */
export interface TaxonomyNoteData extends Record<string, unknown> {
  nav?: { pages: readonly unknown[] }[] | undefined;
  kind?: string | undefined;
  domains?: string[] | undefined;
  tags?: string[] | undefined;
  status?: string | undefined;
  created?: Date | undefined;
  updated?: Date | undefined;
  sources?: SourceRecord[] | undefined;
  aliases?: string[] | undefined;
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
  /** locales this note exists in: the primary when its entry exists, plus every mirror */
  locales: string[];
}

/** Field-level inheritance: the first entry of the chain that defines the field wins. */
function pick<T>(chain: TaxonomyNoteData[], get: (d: TaxonomyNoteData) => T | undefined): T | undefined {
  for (const d of chain) {
    const v = get(d);
    if (v !== undefined) return v;
  }
  return undefined;
}

const DEFAULT_LOCALES: TaxonomyLocale[] = [
  { code: 'en', prefix: 'en/' },
  { code: 'de', prefix: 'de/' },
];

/**
 * Bind the resolution helpers to a site's vocabulary registry. Returns the
 * helper set; each function's behavior is documented on the returned member.
 */
export function createTaxonomyCore<
  K extends TaxonomyDef,
  D extends TaxonomyDef,
  S extends TaxonomyDef,
  E extends TaxonomyNoteEntry = TaxonomyNoteEntry,
>(
  registry: { kinds: readonly K[]; domains: readonly D[]; statuses: readonly S[] },
  options: TaxonomyOptions = {},
) {
  const { kinds, domains, statuses } = registry;
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

    const created = pick(chain, (d) => d.created);
    const isHub = segments.length === 1 && entry.data.nav !== undefined;

    const present: string[] = byId.has(baseId) ? [primary] : [];
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
      kind: pick(chain, (d) => d.kind) as K['id'] | undefined,
      domains: (pick(chain, (d) => d.domains) ?? []) as D['id'][],
      tags: pick(chain, (d) => d.tags) ?? [],
      status: pick(chain, (d) => d.status) as S['id'] | undefined,
      created,
      updated: pick(chain, (d) => d.updated) ?? created,
      sources: pick(chain, (d) => d.sources) ?? [],
      aliases: entry.data.aliases ?? [],
      locales: present,
    };
  }

  /** The browse units of a collection: primary-locale top-level entries
   *  (hubs included), excluding chapters and mirrors; newest first. */
  function unitsOf(notes: E[]): Resolved[] {
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
    unitsOf,
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
