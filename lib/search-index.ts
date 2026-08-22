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
 * Mask the non-prose regions of an MDX source, replacing their lines with
 * blank ones so nothing in them can read as prose or as a heading:
 *
 *  - frontmatter (LF or CRLF line endings);
 *  - fenced code opened by three or more backticks or tildes, closed by a
 *    bare fence of at least as many of the same character (an unclosed
 *    fence masks to the end of the file);
 *  - module-level import/export statements, multiline ones included.
 *
 * The import/export scan is a pragmatic bracket/quote balance: it tracks
 * (), [], {} nesting and string/template quotes, and ends the statement at
 * the first line end that is back in balance. It does not parse comments,
 * regex literals or template interpolations, and a statement continued
 * without an open bracket or quote (e.g. a line-broken binary expression)
 * is cut at the first balanced line end.
 */
function maskNonProse(body: string): string {
  const src = body.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/, '');
  const out: string[] = [];
  let fence: { ch: string; len: number } | null = null;
  let stmt: { depth: number; quote: string | null } | null = null;

  const scan = (line: string, st: { depth: number; quote: string | null }): void => {
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i]!;
      if (st.quote !== null) {
        if (c === '\\') i += 1;
        else if (c === st.quote) st.quote = null;
      } else if (c === "'" || c === '"' || c === '`') st.quote = c;
      else if (c === '(' || c === '[' || c === '{') st.depth += 1;
      else if (c === ')' || c === ']' || c === '}') st.depth -= 1;
    }
  };

  for (const raw of src.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (fence !== null) {
      out.push('');
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1]![0] === fence.ch && close[1]!.length >= fence.len) fence = null;
      continue;
    }
    if (stmt !== null) {
      out.push('');
      scan(line, stmt);
      if (stmt.depth <= 0 && stmt.quote === null) stmt = null;
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) {
      fence = { ch: open[1]![0]!, len: open[1]!.length };
      out.push('');
      continue;
    }
    if (/^(?:import|export)\s/.test(line)) {
      out.push('');
      const st = { depth: 0, quote: null as string | null };
      scan(line, st);
      if (st.depth > 0 || st.quote !== null) stmt = st;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Masked MDX source (maskNonProse) → searchable prose. Removes JSX tags,
 * link targets and image syntax; keeps link text and inline-code words
 * (code blocks are already masked — code is found through the prose that
 * explains it, not by token).
 */
function plainText(masked: string, maxChars: number): string {
  return masked
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // `_` stays: snake_case identifiers are searched whole
    .replace(/[#>*`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/** h2/h3 lines of the masked source (maskNonProse), without markers and
 *  without a trailing `{#id …}` attribute block */
function headingsOf(masked: string): string[] {
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
    const out: SearchDoc[] = sources.map((s) => {
      const masked = maskNonProse(s.body);
      return {
        id: s.id,
        route: s.route,
        locale: s.locale,
        title: s.title,
        crumb: s.crumb,
        headings: headingsOf(masked),
        text: plainText(masked, maxChars),
      };
    });

    return new Response(JSON.stringify(out), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  };
}
