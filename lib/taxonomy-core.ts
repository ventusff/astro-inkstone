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
 *    default them to `[]`. `aliases` are the one exception: entry-local,
 *    never inherited (see resolveTaxonomy), so a schema may default them.
 *  - Locale mirrors (`en/<id>`, …) inherit from the primary-language entry
 *    (the prefix is stripped to find the canonical id).
 *  - Browse units = primary-language top-level entries. A hub counts as one
 *    unit; chapters and mirrors are not listed separately.
 *  - A unit's latest change is the newest commit touching any file of it —
 *    its own directory, its chapters and every locale mirror — when the
 *    caller passes the repo's file changes (lib/git-changes.ts); otherwise
 *    the frontmatter `updated` (falling back to `created`) stands in.
 *  - A unit's authors are the people who wrote its primary-language pages.
 *    Frontmatter `authors` on the unit's own entry names them for the whole
 *    unit (chapters inherit it); without it, each page — the entry, then the
 *    chapters in path order — contributes its own frontmatter `authors`, else
 *    the person whose commit created the page's file. Translations, mirrors
 *    and later edits never make someone an author.
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
  authors?: string[] | undefined;
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

/** one file's latest change and its creator — the shape lib/git-changes.ts reports */
export interface ChangeRecord {
  at: Date;
  createdBy?: string | undefined;
}

export interface TaxonomyOptions {
  /**
   * MIRROR locales only: each entry is a mirror's id prefix (non-empty,
   * unique) — the primary locale is not listed here, it is named by
   * `primary` and its ids carry no prefix. Note the difference from
   * backlinks' `locales` option (lib/backlinks.ts), which is the full
   * registry and includes the primary as the one `''`-prefix entry.
   * Default en/ + de/.
   */
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
  /** frontmatter `updated`, falling back to `created` */
  updated?: Date | undefined;
  /** time of the latest commit touching any file of the unit (own directory, chapters, mirrors); unset without repo history */
  changed?: Date | undefined;
  /**
   * who wrote it. resolveTaxonomy reads frontmatter `authors` (own → primary
   * entry → hub); unitsOf adds the history: one name list over the unit's
   * primary-language pages, first page first. Empty when neither says.
   */
  authors: string[];
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
  if (locales.some((l) => l.prefix === '')) {
    throw new Error(
      "createTaxonomyCore: locales lists MIRROR prefixes only and they must be non-empty — the primary locale is named by `primary` and carries no prefix (an empty prefix would claim every id)",
    );
  }
  const prefixes = new Set(locales.map((l) => l.prefix));
  if (prefixes.size !== locales.length) {
    throw new Error(
      `createTaxonomyCore: mirror prefixes must be unique, got ${locales.map((l) => l.prefix).join(', ')}`,
    );
  }

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
      // deduplicated: a tag repeated in one note is one tag, so facet
      // counts and the tag index count the note once
      tags: [...new Set(pick(chain, (d) => d.tags) ?? [])],
      status: pick(chain, (d) => d.status) as S['id'] | undefined,
      created,
      updated: pick(chain, (d) => d.updated) ?? created,
      sources: pick(chain, (d) => d.sources) ?? [],
      // aliases are entry-local by contract, never inherited: an alias
      // identifies exactly one note, and a chapter or mirror inheriting
      // its hub's aliases would make `[[alias]]` links ambiguous
      aliases: entry.data.aliases ?? [],
      authors: pick(chain, (d) => d.authors) ?? [],
      locales: present,
    };
  }

  /** The browse units of a collection: primary-locale top-level entries
   *  (hubs included), excluding chapters and mirrors; newest first by
   *  `latestOf`. `changes` (repo-relative path → latest change and creator)
   *  attaches each unit's latest commit across its own directory and every
   *  mirror, and the authors of its pages. */
  function unitsOf(notes: E[], changes?: ReadonlyMap<string, ChangeRecord>): Resolved[] {
    const byId = new Map(notes.map((n) => [n.id, n]));
    const changedAt = changes ? latestChangesByUnit(changes) : undefined;
    const pagesByUnit = new Map<string, E[]>();
    for (const n of notes) {
      if (stripLocale(n.id).baseId !== n.id) continue;
      const top = n.id.split('/')[0]!;
      pagesByUnit.set(top, [...(pagesByUnit.get(top) ?? []), n]);
    }
    const units = notes
      .filter((n) => !n.id.includes('/'))
      .map((n) => {
        const unit = resolveTaxonomy(n, byId);
        const changed = changedAt?.get(unit.id);
        const authors = authorsOf(pagesByUnit.get(unit.id) ?? [n], unit.id, changes);
        return { ...unit, authors, ...(changed ? { changed } : {}) };
      });
    return units.sort(
      (a, b) => (latestOf(b)?.getTime() ?? 0) - (latestOf(a)?.getTime() ?? 0) || a.id.localeCompare(b.id),
    );
  }

  /** the names behind a unit: its own entry's frontmatter `authors` when it
   *  names them; else, over its primary-language pages (the entry first, then
   *  chapters in path order), each page's `authors` or its file's creator */
  function authorsOf(pages: E[], unitId: string, changes?: ReadonlyMap<string, ChangeRecord>): string[] {
    const named = (page: E) => (page.data.authors ?? []).filter((name) => name.trim() !== '');
    const own = pages.find((p) => p.id === unitId);
    if (own && named(own).length > 0) return [...new Set(named(own))];
    const ordered = [...pages].sort((a, b) => Number(b.id === unitId) - Number(a.id === unitId) || a.id.localeCompare(b.id));
    const names: string[] = [];
    for (const page of ordered) {
      if (named(page).length > 0) {
        names.push(...named(page));
        continue;
      }
      const creator = creatorOf(page.id, changes);
      if (creator) names.push(creator);
    }
    return [...new Set(names)];
  }

  /** who created the file behind an entry id: `<id>/index.mdx`, `<id>/index.md`, `<id>.mdx` or `<id>.md` */
  function creatorOf(id: string, changes?: ReadonlyMap<string, ChangeRecord>): string | undefined {
    if (!changes) return undefined;
    for (const file of [`${id}/index.mdx`, `${id}/index.md`, `${id}.mdx`, `${id}.md`]) {
      const createdBy = changes.get(file)?.createdBy;
      if (createdBy) return createdBy;
    }
    return undefined;
  }

  /** unit id of a repo-relative file path: the first segment after any mirror prefix */
  function unitOfPath(path: string): string | undefined {
    const { baseId } = stripLocale(path);
    const top = baseId.split('/')[0];
    return top && top !== baseId ? top : undefined;
  }

  /** the newest change among all files of each unit */
  function latestChangesByUnit(changes: ReadonlyMap<string, ChangeRecord>): Map<string, Date> {
    const latest = new Map<string, Date>();
    for (const [path, { at }] of changes) {
      const id = unitOfPath(path);
      if (!id) continue;
      const seen = latest.get(id);
      if (!seen || at.getTime() > seen.getTime()) latest.set(id, at);
    }
    return latest;
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

/** When a unit last changed: its latest commit, else its frontmatter date. */
export function latestOf(unit: { updated?: Date | undefined; changed?: Date | undefined }): Date | undefined {
  return unit.changed ?? unit.updated;
}

/** Units whose latest change falls within the last `days` days (calendar days in `timeZone`, see ageDays); order kept. */
export function recentUnits<U extends { updated?: Date | undefined; changed?: Date | undefined }>(
  units: U[],
  window: { days: number; now?: Date | undefined; timeZone?: string | undefined },
): U[] {
  return units.filter((u) => {
    const age = ageDays(latestOf(u), window);
    return age !== undefined && age <= window.days;
  });
}

/** YYYY.MM (UTC fields; `z.coerce.date` parses a YYYY-MM-DD string as UTC midnight). */
export function fmtMonth(d: Date | undefined): string {
  if (!d) return '';
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** calendar day of `d` in `timeZone` as YYYY-MM-DD (UTC when no zone is given) */
function dayOf(d: Date, timeZone: string | undefined): string {
  if (!timeZone) return d.toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** YYYY.MM.DD of `d` as a calendar day in `timeZone` (UTC fields without one). */
export function fmtDay(d: Date | undefined, timeZone?: string): string {
  if (!d) return '';
  return dayOf(d, timeZone).replaceAll('-', '.');
}

/**
 * Whole calendar days from `d` to now in `timeZone` — 0 is today, 1 is
 * yesterday — or undefined without a date. A change at 23:50 counts as
 * yesterday from 00:10 on, the way people read "yesterday".
 */
export function ageDays(d: Date | undefined, opts: { now?: Date | undefined; timeZone?: string | undefined } = {}): number | undefined {
  if (!d) return undefined;
  const now = opts.now ?? new Date();
  const day = (x: Date) => Date.parse(`${dayOf(x, opts.timeZone)}T00:00:00Z`);
  return Math.round((day(now) - day(d)) / 86_400_000);
}
