// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { buildWikilinkResolver, cachedScan } from 'astro-inkbrush/wikilinks';

// The demo consumes the package one directory up via `file:..`; the package's
// own dependencies resolve from the repo-root node_modules (the engine is
// supplied through the root `workspaces` field). WIKI=1 astro dev is editing
// mode: the astro-inkbrush integration is imported and mounted. A static
// build never imports it, so the output carries zero CMS bytes; the Markdown
// dialect and content guard come from the engine in both modes, through
// siteMarkdown, so the editor and the page share one grammar.
const WIKI_MODE = Boolean(process.env.WIKI);
// PLAYGROUND=1 astro build → the browser-local playground: the build stamps
// blocks (data-wiki-src) and ships the sources manifest; postbuild declares
// the shape with check-dist --playground. Default builds stay untouched.
const PLAYGROUND = Boolean(process.env.PLAYGROUND);
const { siteMarkdown, sitePluginSets } = await import('astro-inkstone/markdown-preset');
const { secureFsDeny } = await import('astro-inkstone/lib/vite-security');
const { normalizeBase } = await import('astro-inkstone/lib/base');
const inkbrush = WIKI_MODE ? (await import('astro-inkbrush')).inkbrush : null;

// Deploy target comes from env: on GitHub Pages the site lives under the
// /astro-inkstone/ project path; local dev defaults to the root. Internal
// links always go through import.meta.env.BASE_URL, so both mounts share one
// codebase.
const SITE = process.env.DEMO_SITE || 'https://example.com';
const BASE = process.env.DEMO_BASE || '/';
// DEMO_BASE accepts any spelling ('/docs', 'docs/'); links are built from
// the normalized prefix — '' at the root, '/docs' under a subpath
const BASE_PREFIX = normalizeBase(BASE);

// [[wikilinks]] resolve against the note collection with the engine's own
// resolver — the same alias/brand/locale rules the CMS preview and the
// check-wikilinks CLI use, so the three can never drift. The locale table is
// the site registry's: the default locale's ids are unprefixed, every other
// locale's mirrors live under its prefix.
const { LOCALE_DEFS } = await import('./src/content/notes/_meta/locales.ts');
const resolve = buildWikilinkResolver({
  notes: cachedScan('src/content/notes'),
  urlFor: (id) => `${BASE_PREFIX}/${id}/`,
  locales: LOCALE_DEFS.map(({ code, prefix }) => ({ code, prefix })),
});

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    // sitemap-index.xml at the deploy root, every page with its hreflang
    // twins — the locale table is the site registry's
    sitemap({
      i18n: {
        defaultLocale: LOCALE_DEFS.find((l) => l.prefix === '')?.code ?? 'en',
        locales: Object.fromEntries(LOCALE_DEFS.map((l) => [l.code, l.htmlLang])),
      },
    }),
    // The CMS preview and save gate get the page's own plugin set (table
    // wrapper, callouts, math, …) rather than the bare dialect; numbering
    // and reading time need the whole document, and the engine mounts its
    // own wikilink resolver.
    ...(inkbrush
      ? [
          inkbrush({
            markdown: {
              ...sitePluginSets({
                math: true,
                callouts: true,
                gemoji: true,
                mermaid: true,
                base: BASE_PREFIX,
                numbering: false,
                readingTime: false,
              }),
              guard: { autoNumberedHeadings: true },
              urlFor: (id) => `${BASE_PREFIX}/${id}/`,
            },
          }),
        ]
      : []),
    // the playground's client mount: injected only when the env is set, so
    // a default build's module graph never contains the playground at all
    ...(PLAYGROUND
      ? [
          {
            name: 'playground-mount',
            hooks: {
              /** @param {{ injectScript: (stage: string, code: string) => void }} arg */
              'astro:config:setup': ({ injectScript }) => {
                injectScript(
                  'page',
                  "import { mountPlayground } from '/src/lib/playground'; mountPlayground();",
                );
              },
            },
          },
        ]
      : []),
  ],

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
      wikiBlocks: WIKI_MODE || PLAYGROUND,
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
