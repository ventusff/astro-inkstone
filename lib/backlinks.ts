/**
 * Build-time backlink index — scan every note body for `[[wikilinks]]` and
 * invert them into a target ← sources map, with a context snippet for each
 * mention. Resolution uses the engine's own resolver, so alias / brand /
 * locale-mirror rules match page rendering exactly.
 *
 * Bind it once in a site module and reuse the instance everywhere (the
 * instance memoizes the index across pages in production builds):
 *
 *   // src/lib/backlinks.ts
 *   import { createBacklinks } from 'astro-inkstone/lib/backlinks';
 *   export const backlinks = createBacklinks({
 *     urlFor: (id) => `/notes/${id}/`,
 *     locales: [{ code: 'en', prefix: '' }, { code: 'zh', prefix: 'zh/' }],
 *   });
 *
 *   // a note page
 *   const index = backlinks.build(notes.map((e) => ({
 *     id: e.id, title: e.data.title, brand: e.data.brand,
 *     aliases: e.data.aliases, body: e.body,
 *   })));
 *   const items = index.inbound.get(entry.id) ?? [];   // → <Backlinks items={items} />
 *
 * Corpora beyond one collection are the site's business: map extra
 * collections into `BacklinkDoc`s under a namespace of your choosing
 * (e.g. `cards/<slug>`) and concatenate before calling `build`.
 *
 * `index.localGraph(id, titleOf)` turns the same index into the one-hop
 * neighbourhood that components/LocalGraph.astro draws in the sidebar.
 */
import { buildWikilinkResolver, extractWikilinks, maskNonProse } from 'astro-inkbrush/wikilinks';

/** One document in the link corpus. */
export interface BacklinkDoc {
  id: string;
  title: string;
  brand?: string | undefined;
  aliases: string[];
  body: string | undefined;
}

/** One mention of a target note (shape consumed by components/Backlinks.astro). */
export interface BacklinkItem {
  /** the mentioning note */
  sourceId: string;
  href: string;
  title: string;
  /** mention context triple: before + label (highlighted) + after */
  before: string;
  label: string;
  after: string;
}

export interface BacklinkIndex {
  /** target id → the entries that mention it */
  inbound: Map<string, BacklinkItem[]>;
  /** source id → the targets it points at (unresolved included) */
  outbound: Map<string, { target: string; resolved: string | null }[]>;
  broken: { sourceId: string; target: string }[];
  /**
   * One-hop neighbourhood of `id`: inbound sources first, then resolved
   * outbound targets, de-duplicated, capped at `cap` (default 12). Shape is
   * what components/LocalGraph.astro takes; add a `color` per neighbour
   * (e.g. by collection) before passing it on.
   */
  localGraph: (id: string, titleOf: (id: string) => string, cap?: number) => GraphNeighbor[];
}

/** One node of a note's link neighbourhood. */
export interface GraphNeighbor {
  id: string;
  title: string;
  href: string;
  dir: 'in' | 'out';
}

export interface BacklinksOptions {
  /** note id → site URL (the same mapping the site's wikilink rendering uses) */
  urlFor: (id: string) => string;
  /** locale registry for mirror-aware resolution; defaults to the engine's */
  locales?: { code: string; prefix: string }[] | undefined;
  /** characters of context kept on each side of a mention. Default 90. */
  snippetSpan?: number | undefined;
}

/** Light markdown-marker stripping for display snippets (not exhaustive). */
function plainish(s: string): string {
  return s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[*_~#>`]+/g, '')
    .replace(/\s+/g, ' ');
}

export function createBacklinks(options: BacklinksOptions) {
  const { urlFor, locales, snippetSpan = 90 } = options;

  /** Slice a snippet around `offset`, widened to whitespace boundaries. */
  function snippetAround(
    masked: string,
    offset: number,
    rawLen: number,
  ): { before: string; after: string } {
    let start = Math.max(0, offset - snippetSpan);
    let end = Math.min(masked.length, offset + rawLen + snippetSpan);
    while (start > 0 && !/[\s\n]/.test(masked[start]!)) start -= 1;
    while (end < masked.length && !/[\s\n]/.test(masked[end]!)) end += 1;
    const before = plainish(masked.slice(start, offset)).trimStart();
    const after = plainish(masked.slice(offset + rawLen, end)).trimEnd();
    return {
      before: (start > 0 ? '…' : '') + before,
      after: after + (end < masked.length ? '…' : ''),
    };
  }

  // production builds index the corpus once per instance; dev rebuilds on
  // every call so edits show up
  let prodCache: BacklinkIndex | null = null;

  function build(docs: BacklinkDoc[]): BacklinkIndex {
    if (import.meta.env.PROD && prodCache) return prodCache;

    const infos = docs.map(({ id, title, brand, aliases }) => ({ id, title, brand, aliases }));
    const resolve = buildWikilinkResolver({
      notes: () => infos,
      urlFor,
      ...(locales ? { locales } : {}),
    });
    const byId = new Map(docs.map((d) => [d.id, d]));

    const inbound = new Map<string, BacklinkItem[]>();
    const outbound = new Map<string, { target: string; resolved: string | null }[]>();
    const broken: { sourceId: string; target: string }[] = [];

    for (const doc of docs) {
      const body = doc.body;
      if (!body) continue;
      const links = extractWikilinks(body);
      if (links.length === 0) continue;
      const masked = maskNonProse(body);
      const out: { target: string; resolved: string | null }[] = [];

      for (const link of links) {
        const res = resolve(link.target, doc.id);
        if (res.kind !== 'ok') {
          out.push({ target: link.target, resolved: null });
          broken.push({ sourceId: doc.id, target: link.target });
          continue;
        }
        out.push({ target: link.target, resolved: res.id });
        const { before, after } = snippetAround(masked, link.offset, link.raw.length);
        const source = byId.get(doc.id)!;
        const list = inbound.get(res.id) ?? [];
        list.push({
          sourceId: doc.id,
          href: urlFor(doc.id),
          title: source.title,
          before,
          label: link.label ?? (link.anchor ? `${link.target}#${link.anchor}` : link.target),
          after,
        });
        inbound.set(res.id, list);
      }
      outbound.set(doc.id, out);
    }

    const localGraph = (id: string, titleOf: (id: string) => string, cap = 12): GraphNeighbor[] => {
      const seen = new Set<string>([id]);
      const out: GraphNeighbor[] = [];
      for (const item of inbound.get(id) ?? []) {
        if (seen.has(item.sourceId)) continue;
        seen.add(item.sourceId);
        out.push({ id: item.sourceId, title: item.title, href: item.href, dir: 'in' });
      }
      for (const o of outbound.get(id) ?? []) {
        if (!o.resolved || seen.has(o.resolved)) continue;
        seen.add(o.resolved);
        out.push({ id: o.resolved, title: titleOf(o.resolved), href: urlFor(o.resolved), dir: 'out' });
      }
      return out.slice(0, cap);
    };

    const index: BacklinkIndex = { inbound, outbound, broken, localGraph };
    if (import.meta.env.PROD) prodCache = index;
    return index;
  }

  return { build };
}
