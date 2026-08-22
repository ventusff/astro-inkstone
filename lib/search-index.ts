/**
 * Build-time search index for the ⌘K palette — endpoint factory. The
 * endpoint is prerendered into the static bundle and served live by the dev
 * server, so the palette works on a reading host and on an editing host
 * alike (an index built from `dist/` exists only after a build).
 *
 * Site wiring: create `src/pages/search-index.json.ts` and hand over "which
 * documents, and how routes/locales/breadcrumbs are computed" as a callback;
 * body cleanup and truncation are done here:
 *
 *   import { getCollection } from 'astro:content';
 *   import { buildSearchIndexEndpoint } from 'astro-inkstone/lib/search-index';
 *
 *   export const GET = buildSearchIndexEndpoint({
 *     loadDocs: async () =>
 *       (await getCollection('docs')).map((entry) => ({
 *         id: entry.id,
 *         route: `/docs/${entry.id}/`, // the site's own routing rule
 *         locale: 'any',               // or the entry's locale code
 *         title: entry.data.title,
 *         crumb: '',                   // label next to the title in results
 *         body: entry.body ?? '',
 *       })),
 *   });
 *   // fully static sites prerender by default; hybrid sites need
 *   // `export const prerender = true`
 *
 * The emitted JSON is exactly search-client.ts's SearchDoc[] — both ends are
 * pinned by the same type.
 */
import type { APIRoute } from 'astro';

import type { SearchDoc } from './search-client.ts';

/** Raw material from the site callback: one record per searchable page;
 *  body is the uncleaned MDX/markdown source. */
export interface SearchIndexSource {
  id: string;
  route: string;
  locale: SearchDoc['locale'];
  title: string;
  /** chapter label, shown next to the title in the result list */
  crumb: string;
  /** raw MDX/markdown body — the factory strips syntax and truncates */
  body: string;
}

export interface SearchIndexOptions {
  /** return every searchable page (usually a thin getCollection wrapper) */
  loadDocs: () => SearchIndexSource[] | Promise<SearchIndexSource[]>;
  /** how much body text of one page goes into the index (a positive integer; default 12_000) */
  maxChars?: number;
}

/**
 * MDX source → searchable prose. Removes frontmatter, import/export lines,
 * JSX tags, link targets and image syntax; keeps link text and inline-code
 * words; drops fenced code blocks entirely (code is found through the prose
 * that explains it, not by token).
 */
function plainText(body: string, maxChars: number): string {
  return body
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/^import\s.+$/gm, '')
    .replace(/^export\s.+$/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // `_` stays: snake_case identifiers are searched whole
    .replace(/[#>*`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/** h2/h3 lines outside frontmatter and fenced code, without markers and
 *  without a trailing `{#id …}` attribute block */
function headingsOf(body: string): string[] {
  const masked = body.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/```[\s\S]*?```/g, ' ');
  return [...masked.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)].map((m) =>
    m[1]!.replace(/\s*`\{[^{}]*\}`\s*$/, '').replace(/[`*_]/g, ''),
  );
}

export function buildSearchIndexEndpoint(opts: SearchIndexOptions): APIRoute {
  const maxChars = opts.maxChars ?? 12_000;
  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new Error(`buildSearchIndexEndpoint: maxChars must be a positive integer, got ${opts.maxChars}`);
  }
  return async () => {
    const sources = await opts.loadDocs();
    const out: SearchDoc[] = sources.map((s) => ({
      id: s.id,
      route: s.route,
      locale: s.locale,
      title: s.title,
      crumb: s.crumb,
      headings: headingsOf(s.body),
      text: plainText(s.body, maxChars),
    }));

    return new Response(JSON.stringify(out), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  };
}
