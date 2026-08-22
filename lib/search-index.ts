/**
 * Build-time search index for the ⌘K palette — endpoint factory.
 *
 * Why not Pagefind alone: Pagefind indexes `dist/`, so it only exists after a
 * build — and an editing host that runs a permanent `astro dev` never serves
 * that directory, leaving its search box dead on the very host people edit
 * from. This endpoint is prerendered into the static bundle AND served live
 * by the dev server, so the palette works in both forms.
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
 *         locale: 'any',               // or the site's locale ('zh' | 'en' | 'any')
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

import type { SearchDoc } from './search-client';

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
  /** how much body text of one page goes into the index (default 12_000) */
  maxChars?: number;
}

/**
 * MDX source → searchable prose. Strips the syntax nobody types into a search
 * box (frontmatter, imports, JSX tags, link targets, fences) while keeping
 * the words inside them.
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
    // NOT `_`: technical prose is full of snake_case identifiers
    // (batch_size, eval_runner, …), and stripping the underscore splits each
    // into separate words — making every identifier unfindable while plain
    // words still match. Markdown emphasis via underscores is not used here.
    .replace(/[#>*`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function headingsOf(body: string): string[] {
  return [...body.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)].map((m) => m[1]!.replace(/[`*_]/g, ''));
}

export function buildSearchIndexEndpoint(opts: SearchIndexOptions): APIRoute {
  const maxChars = opts.maxChars ?? 12_000;
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
