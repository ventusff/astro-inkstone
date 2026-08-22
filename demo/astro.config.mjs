// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { buildWikilinkResolver, cachedScan } from 'astro-inkbrush/wikilinks';

// The demo consumes the package one directory up via `file:..`; the package's
// own dependencies resolve from the repo-root node_modules (the engine is
// supplied through the root `workspaces` field). WIKI=1 astro dev is editing
// mode: the astro-inkbrush integration is imported and mounted. A static
// build never imports it, so the output carries zero CMS bytes; the Markdown
// dialect and content guard come from the engine in both modes, through
// siteMarkdown, so the editor and the page share one grammar.
const WIKI_MODE = Boolean(process.env.WIKI);
const { siteMarkdown } = await import('astro-inkstone/lib/markdown-preset');
const { secureFsDeny } = await import('astro-inkstone/lib/vite-security');
const inkbrush = WIKI_MODE ? (await import('astro-inkbrush')).inkbrush : null;

// Deploy target comes from env: on GitHub Pages the site lives under the
// /astro-inkstone/ project path; local dev defaults to the root. Internal
// links always go through import.meta.env.BASE_URL, so both mounts share one
// codebase.
const SITE = process.env.DEMO_SITE || 'https://example.com';
const BASE = process.env.DEMO_BASE || '/';

// [[wikilinks]] resolve against the note collection with the engine's own
// resolver — the same alias/brand/locale rules the CMS preview and the
// check-wikilinks CLI use, so the three can never drift. en is the primary
// locale (unprefixed ids); zh mirrors live under zh/.
const resolve = buildWikilinkResolver({
  notes: cachedScan('src/content/notes'),
  urlFor: (id) => `${BASE}${id}/`.replace(/\/{2,}/g, '/'),
  locales: [
    { code: 'en', prefix: '' },
    { code: 'zh', prefix: 'zh/' },
  ],
});

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  integrations: [mdx(), ...(inkbrush ? [inkbrush()] : [])],

  // The whole Markdown pipeline in one call: chapter numbering (hub chapters
  // read frontmatter `part:` for their §k.n heading numbers), math, callouts,
  // mermaid, code frames, :gemoji:, reading time, wikilinks, and the
  // build-failing content guard, whose autoNumberedHeadings switch rejects
  // hand-typed heading numbers (numbering belongs to the build).
  markdown: {
    ...siteMarkdown({
      numbering: 'chapters',
      math: true,
      codeFrame: true,
      mermaid: true,
      callouts: true,
      gemoji: true,
      readingTime: true,
      wikiBlocks: WIKI_MODE,
      guard: { autoNumberedHeadings: true },
      wikilinks: {
        resolve,
        noteIdOf: (path) => path?.match(/src\/content\/notes\/(.+)\/index\.mdx?$/)?.[1],
        onBroken: ({ file, target, kind }) =>
          console.warn(`[wikilinks] ${kind}: [[${target}]] ← ${file ?? '(unknown)'}`),
      },
    }),
  },

  // An editing host is a permanent dev server: Vite's /@fs route must never
  // serve the CMS state, env files or key material. The deny list is the
  // package's; a site adds its own sensitive paths via extraDeny.
  vite: {
    server: {
      allowedHosts: process.env.SITE_HOST ? [process.env.SITE_HOST] : [],
      ...secureFsDeny(),
    },
  },
});
